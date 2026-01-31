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

const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_4 || "");

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

      // Use a more robust model name and check if it exists
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"; 
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        tools: [{ googleSearch: {} }] as any
      });

      const prompt = `Search the latest 2026 financial data for the mutual fund: ${fundName} with ISIN ${isin}. 
      Provide the following details:
      1. nav: Latest NAV and the date it was recorded.
      2. cagr: 1-Year, 3-Year, and 5-Year CAGR.
      3. portfolio: Top 10 Sectors and Top 10 Holdings (with % weights).
      4. stats: AUM (in Crores), Expense Ratio, and Portfolio Turnover.
      5. ratios: Sharpe Ratio, Std Deviation, and Beta. Each must include the Fund Value and the Category Average.

      Return the result STRICTLY as a JSON object with this structure:
      {
        "nav": {"value": number, "date": string},
        "cagr": {"1y": string, "3y": string, "5y": string},
        "portfolio": {
          "sectors": [{"name": string, "weight": number}],
          "holdings": [{"name": string, "weight": number}]
        },
        "stats": {"aum_crores": number, "expense_ratio": string, "turnover": string},
        "risk_ratios": {
          "std_dev": {"fund": string, "category_avg": string},
          "sharpe": {"fund": string, "category_avg": string},
          "beta": {"fund": string, "category_avg": string},
          "alpha": {"fund": string, "category_avg": string}
        }
      }
      
      If you cannot find specific data for this ISIN, return a JSON object with a single "error" key: {"error": "Data Unavailable"}.`;

      console.log(`Analyzing fund with Gemini: ${fundName} (${isin})`);
      let performance;
      try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Extract JSON from markdown code block if present
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        performance = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

        if (performance.error) {
          return res.status(404).json({ message: performance.error });
        }
      } catch (geminiError: any) {
        console.error("Gemini Content Generation Error:", geminiError);
        // Check for quota error
        if (geminiError.status === 429 || (geminiError.message && geminiError.message.includes("429"))) {
          return res.status(429).json({ message: "API limit reached. Please try again in a minute." });
        }
        throw geminiError;
      }

      res.json(performance);
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      res.status(404).json({ message: "Data Unavailable" });
    }
  });

  app.get("/api/scheme-performance/:isin", async (req, res) => {
    const isin = req.params.isin;
    const reportId = req.query.reportId;
    
    // Rotating API keys logic
    const apiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3
    ].filter(Boolean);

    let lastError;
    for (const key of apiKeys) {
      try {
        const genAIInstance = new GoogleGenerativeAI(key!);
        let fundName = "";
        if (reportId) {
          const report = await storage.getReport(Number(reportId));
          const snapshot = (report?.analysis as any)?.mf_snapshot || [];
          const fund = snapshot.find((f: any) => f.isin === isin);
          fundName = fund?.scheme_name || "";
        }

        const modelName = "gemini-2.5-flash-lite"; 
        const model = genAIInstance.getGenerativeModel({ 
          model: modelName,
          tools: [{ googleSearch: {} }] as any
        });

        const prompt = `Search the latest financial data for the mutual fund: ${fundName} with ISIN ${isin}. 
        Provide the following details:
        1. cagr: 1-Year, 3-Year, and 5-Year CAGR for the scheme.
        2. benchmark: Identify the correct benchmark for this fund and provide its 1-Year, 3-Year, and 5-Year returns.
        
        Return the result STRICTLY as a JSON object with this structure:
        {
          "scheme_returns": {"1y": string, "3y": string, "5y": string},
          "benchmark_name": string,
          "benchmark_returns": {"1y": string, "3y": string, "5y": string}
        }
        
        Ensure returns are strings like "15.5%". If data is unavailable, use "N/A".`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const performance = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

        return res.json(performance);
      } catch (err: any) {
        console.error(`Attempt with key failed:`, err.message);
        lastError = err;
        continue;
      }
    }
    
    res.status(lastError?.status || 500).json({ message: lastError?.message || "All API keys failed" });
  });

  return httpServer;
}
