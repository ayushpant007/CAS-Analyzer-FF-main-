import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import multer from "multer";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { registerImageRoutes } from "./replit_integrations/image/routes";
import Groq from "groq-sdk";

const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_4 || "");

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Register integration routes
  registerChatRoutes(app);
  registerImageRoutes(app);

  app.post(api.analyze.path, upload.single("file"), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const password = req.body.password;
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    const investorType = req.body.investorType || "Aggressive";
    const ageGroup = req.body.ageGroup || "20-35";

    const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}.pdf`);

    try {
      await fs.writeFile(tempPath, req.file.buffer);

      // Parse PDF
      let text = "";
      try {
        const { stdout } = await execAsync(`pdftotext -upw "${password}" "${tempPath}" -`);
        text = stdout;
      } catch (e: any) {
        console.error("PDF Parsing error:", e);
        if (e.message.includes("Incorrect password") || (e.stderr && e.stderr.includes("Incorrect password"))) {
            return res.status(401).json({ message: "Incorrect password" });
        }
        // Fallback: sometimes generic error code 3 means bad password in poppler
        // But for now let's assume if it fails it's likely password or corrupt file
        if (e.code === 3 || e.code === 1) { // 3 is "Permissions error", 1 can be generic
             return res.status(401).json({ message: "Incorrect password or file permission error" });
        }
        throw e;
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract text from PDF. It might be empty or scanned." });
      }

      // Read CSV ratios
      let csvContent = "";
      try {
        csvContent = await fs.readFile(path.join(process.cwd(), "server/assets/category_ratios.csv"), "utf-8");
      } catch (e) {
        console.error("Error reading ratios CSV:", e);
      }

      // Analyze with Gemini
      const rawModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const sanitizedModel = rawModel.toLowerCase().replace(/\s+/g, '-');
      
      const model = genAI.getGenerativeModel({ 
        model: sanitizedModel,
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `You are a financial analyst. Analyze the following Consolidated Account Statement (CAS) text. 
Investor Profile: Age Group: ${ageGroup}, Risk Profile: ${investorType}.

Reference Ratios CSV:
${csvContent}

Extract:
1. Portfolio summary: {"net_asset_value": number, "total_cost": number}
2. Account-wise summary table: [{"type": string, "details": string, "count": number, "value": number}]
3. Historical Portfolio Valuation: [{"month_year": string, "valuation": number, "change_value": number, "change_percentage": number}]
4. Asset Class Allocation for the month: [{"asset_class": string, "value": number, "percentage": number}]
5. Mutual Fund Portfolio Snapshot: [{"scheme_name": string, "folio_no": string, "closing_balance": number, "nav": number, "invested_amount": number, "valuation": number, "unrealised_profit_loss": number, "fund_category": string, "fund_type": string, "isin": string}]
6. Comparison Tables (using the CSV ratios for the given Age Group and Risk Profile):
   - Current Category Allocation (Equity, Debt, Hybrid, Others)
   - Comparison with Category Ratio (Current % vs Target % from CSV)
   - Category-Fund Type Comparison (Large Cap, Mid Cap, Small Cap, etc. for Equity portion)
   - Comparison with Type Ratio (Current % vs Target % from CSV)

Return ONLY valid JSON with this exact structure: {
  "summary": {"net_asset_value": number, "total_cost": number}, 
  "account_summaries": [...], 
  "historical_valuations": [...], 
  "asset_allocation": [...], 
  "mf_snapshot": [...],
  "category_comparison": [{"category": string, "current_pct": number, "target_pct": number}],
  "type_comparison": [{"type": string, "current_pct": number, "target_pct": number}]
}. 

For mf_snapshot, ensure you accurately identify:
- fund_category: e.g. Equity, Debt, Hybrid, etc.
- fund_type: e.g. Flexi Cap, Bluechip, Large Cap, Mid Cap, Small Cap, Sectoral, etc.
- isin: The 12-character International Securities Identification Number for the fund.

Ensure ALL funds and folios are extracted comprehensively without omission. Ensure all numerical values are numbers.

Text content:
${text}`;

      const result = await model.generateContent(prompt);
      const analysisRaw = result.response.text() || "{}";
      const analysis = JSON.parse(analysisRaw);

      const report = await storage.createReport({
        filename: req.file.originalname,
        investorType,
        ageGroup,
        analysis
      });

      res.json(report);

    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Analysis failed: " + error.message });
    } finally {
      try {
        await fs.unlink(tempPath);
      } catch (e) { /* ignore */ }
    }
  });

  app.get(api.reports.list.path, async (req, res) => {
    const list = await storage.getAllReports();
    res.json(list);
  });

  app.get(api.reports.get.path, async (req, res) => {
    const report = await storage.getReport(Number(req.params.id));
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  });

  app.get("/api/scrape-performance/:isin", async (req, res) => {
    const isin = req.params.isin;
    const reportId = req.query.reportId;

    try {
      let fundName = "";
      if (reportId) {
        const report = await storage.getReport(Number(reportId));
        const snapshot = (report?.analysis as any)?.mf_snapshot || [];
        const fund = snapshot.find((f: any) => f.isin === isin);
        fundName = fund?.scheme_name || "";
      }

      const prompt = `You are a financial analyst assistant. Based on your knowledge, provide accurate financial data for the Indian mutual fund: ${fundName} with ISIN ${isin}. 
      
      IMPORTANT: Only provide data you are confident about. Use realistic values typical for Indian mutual funds.
      
      Provide the following details:
      1. nav: Latest NAV (typical range 10-2000 for Indian MFs) and date in YYYY-MM-DD format.
      2. cagr: 1-Year, 3-Year, and 5-Year CAGR as percentage strings like "15.5%".
      3. portfolio: Top 5 Sectors and Top 5 Holdings with percentage weights as numbers (e.g., 12.5 for 12.5%, NOT 0.125).
      4. stats: AUM in Crores (number), Expense Ratio as string like "1.5%", Portfolio Turnover as string like "45%".
      5. risk_ratios: Std Deviation, Sharpe Ratio, Beta, and Alpha. Each with fund value and category average as strings.

      Return the result STRICTLY as a JSON object with this structure:
      {
        "nav": {"value": number, "date": "YYYY-MM-DD"},
        "cagr": {"1y": "X.XX%", "3y": "X.XX%", "5y": "X.XX%"},
        "portfolio": {
          "sectors": [{"name": string, "weight": number}],
          "holdings": [{"name": string, "weight": number}]
        },
        "stats": {"aum_crores": number, "expense_ratio": "X.XX%", "turnover": "XX%"},
        "risk_ratios": {
          "std_dev": {"fund": "XX.XX%", "category_avg": "XX.XX%"},
          "sharpe": {"fund": "X.XX", "category_avg": "X.XX"},
          "beta": {"fund": "X.XX", "category_avg": "X.XX"},
          "alpha": {"fund": "X.XX%", "category_avg": "X.XX%"}
        }
      }
      
      CRITICAL: Weight values must be percentage numbers (12.5 means 12.5%), NOT decimals (0.125).
      Example: {"name": "HDFC Bank", "weight": 8.5} means 8.5% weight.
      
      If you cannot find specific data for this ISIN, return: {"error": "Data Unavailable"}.
      Return ONLY the JSON object, no markdown or extra text.`;

      console.log(`Analyzing fund with Groq: ${fundName} (${isin})`);
      let performance;
      try {
        const result = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.1-8b-instant",
          temperature: 0.1,
          max_tokens: 2048,
        });
        
        const responseText = result.choices[0]?.message?.content || "{}";
        
        // Extract JSON from markdown code block if present
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        performance = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

        if (performance.error) {
          return res.status(404).json({ message: performance.error });
        }
      } catch (groqError: any) {
        console.error("Groq Content Generation Error:", groqError);
        // Check for rate limit error
        if (groqError.status === 429 || (groqError.message && groqError.message.includes("429"))) {
          return res.status(429).json({ message: "API limit reached. Please try again in a minute." });
        }
        throw groqError;
      }

      res.json(performance);
    } catch (error: any) {
      console.error("Groq analysis error:", error);
      res.status(404).json({ message: "Data Unavailable" });
    }
  });

  app.get("/api/scheme-performance/:isin", async (req, res) => {
    const isin = req.params.isin;
    const reportId = req.query.reportId;
    
    try {
      let fundName = "";
      if (reportId) {
        const report = await storage.getReport(Number(reportId));
        const snapshot = (report?.analysis as any)?.mf_snapshot || [];
        const fund = snapshot.find((f: any) => f.isin === isin);
        fundName = fund?.scheme_name || "";
      }

      const prompt = `You are a financial analyst assistant. Based on your knowledge, provide financial data for the mutual fund: ${fundName} with ISIN ${isin}. 
      Provide the following details:
      1. cagr: 1-Year, 3-Year, and 5-Year CAGR for the scheme.
      2. benchmark: Identify the correct benchmark for this fund and provide its 1-Year, 3-Year, and 5-Year returns.
      
      Return the result STRICTLY as a JSON object with this structure:
      {
        "scheme_returns": {"1y": string, "3y": string, "5y": string},
        "benchmark_name": string,
        "benchmark_returns": {"1y": string, "3y": string, "5y": string}
      }
      
      Ensure returns are strings like "15.5%". If data is unavailable, use "N/A".
      Return ONLY the JSON object, no additional text or markdown.`;

      console.log(`Fetching scheme performance with Groq: ${fundName} (${isin})`);
      
      const result = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.1,
        max_tokens: 1024,
      });
      
      const responseText = result.choices[0]?.message?.content || "{}";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const performance = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

      return res.json(performance);
    } catch (err: any) {
      console.error(`Groq scheme performance error:`, err.message);
      if (err.status === 429 || (err.message && err.message.includes("429"))) {
        return res.status(429).json({ message: "API limit reached. Please try again in a minute." });
      }
      res.status(err?.status || 500).json({ message: err?.message || "Failed to fetch scheme performance" });
    }
  });

  return httpServer;
}
