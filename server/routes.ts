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

// Initialize Gemini client with multi-key fallback support
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4
].filter(Boolean) as string[];

async function generateWithFallback(prompt: string, options: { model?: string, responseMimeType?: string } = {}) {
  const modelName = (options.model || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").toLowerCase().replace(/\s+/g, '-');
  let lastError: any;

  for (const key of GEMINI_KEYS) {
    try {
      const client = new GoogleGenerativeAI(key);
      const model = client.getGenerativeModel({ 
        model: modelName,
        generationConfig: options.responseMimeType ? { responseMimeType: options.responseMimeType } : undefined
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      console.error(`Gemini call failed with key starting with ${key.substring(0, 8)}:`, err.message);
      lastError = err;
      // If it's a 429 (rate limit), try next key. Otherwise, maybe it's a persistent error
      if (err.status !== 429 && !err.message?.includes("429")) {
        // Break early if it's not a rate limit? 
        // Actually the user wants fallbacks "so it wont show usage issues", implying rate limits.
      }
    }
  }
  throw lastError || new Error("All Gemini API keys failed");
}

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
      const analysisPrompt = `You are a financial analyst. Analyze the following Consolidated Account Statement (CAS) text. 
Investor Profile: Age Group: ${ageGroup}, Risk Profile: ${investorType}.

Reference Ratios CSV:
${csvContent}

Extract:
1. Portfolio summary: {"net_asset_value": number, "total_cost": number}
2. Account-wise summary table: [{"type": string, "details": string, "count": number, "value": number}]
3. Historical Portfolio Valuation: [{"month_year": string, "valuation": number, "change_value": number, "change_percentage": number}]
4. Asset Class Allocation for the month: [{"asset_class": string, "value": number, "percentage": number}]
5. Mutual Fund Portfolio Snapshot: [{"scheme_name": string, "folio_no": string, "units": number, "nav": number, "invested_amount": number, "valuation": number, "unrealised_profit_loss": number, "fund_category": string, "fund_type": string, "isin": string}]
   - IMPORTANT: For "units", strictly extract the "No. of Units" or "Units" column value from the statement for each scheme.
6. Comparison Tables (using the CSV ratios for the given Age Group and Risk Profile):
   - Current Category Allocation (Equity, Debt, Hybrid, Others)
   - Comparison with Category Ratio (Current % vs Target % from CSV)
   - Category-Fund Type Comparison (Large Cap, Mid Cap, Small Cap, etc. for Equity portion)
   - Comparison with Type Ratio (Current % vs Target % from CSV)
   - Transactions (STP/SIP/SWP extraction): [{"date": string, "scheme_name": string, "type": string, "amount": number}]
   
   IMPORTANT: For transactions, carefully identify the type based on transaction keywords in the text:
   - "SIP" or "Systematic Investment" or "Purchase" -> type: "SIP"
   - "STP", "Systematic Transfer", "Switch In", "Switch Out", "Switch" -> type: "STP"
   - "SWP", "Systematic Withdrawal", "Redemption" -> type: "SWP"
   - Extract the correct date (e.g., DD-MMM-YYYY or DD/MM/YYYY), scheme name, and amount.
   - If a transaction is a "Switch Out" or "Switch In", map it to "STP".
   - Be comprehensive: extract ALL systematic transactions found in the text.
   - For amount, use the numerical value (e.g., if it says ₹1,000, extract 1000).

Return ONLY valid JSON with this exact structure: {
  "summary": {"net_asset_value": number, "total_cost": number}, 
  "account_summaries": [...], 
  "historical_valuations": [...], 
  "asset_allocation": [...], 
  "mf_snapshot": [...],
  "category_comparison": [{"category": string, "current_pct": number, "target_pct": number}],
  "type_comparison": [{"type": string, "current_pct": number, "target_pct": number}],
  "transactions": [{"date": string, "scheme_name": string, "type": string, "amount": number}]
}. 

For mf_snapshot, ensure you accurately identify:
- fund_category: e.g. Equity, Debt, Hybrid, etc.
- fund_type: e.g. Flexi Cap, Bluechip, Large Cap, Mid Cap, Small Cap, Sectoral, etc.
- isin: The 12-character International Securities Identification Number for the fund.

Ensure ALL funds and folios are extracted comprehensively without omission. Ensure all numerical values are numbers.

Text content:
${text}`;

      const analysisRawResult = await generateWithFallback(analysisPrompt, { responseMimeType: "application/json" });
      const analysisRawStr = typeof analysisRawResult === 'string' ? analysisRawResult : "";
      const analysis = JSON.parse(analysisRawStr || "{}");

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

      console.log(`Analyzing fund with Gemini: ${fundName} (${isin})`);
      let performance;
      try {
        const responseText = await generateWithFallback(prompt);
        
        // Extract JSON from markdown code block if present
        const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
        performance = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText || "{}");

        if (performance.error) {
          return res.status(404).json({ message: performance.error });
        }
      } catch (geminiError: any) {
        console.error("Gemini Content Generation Error:", geminiError);
        // Check for rate limit error
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

      console.log(`Fetching scheme performance with Gemini: ${fundName} (${isin})`);
      
      const responseText = await generateWithFallback(prompt);
      const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
      const performance = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText || "{}");

      return res.json(performance);
    } catch (err: any) {
      console.error(`Gemini scheme performance error:`, err.message);
      if (err.status === 429 || (err.message && err.message.includes("429"))) {
        return res.status(429).json({ message: "API limit reached. Please try again in a minute." });
      }
      res.status(err?.status || 500).json({ message: err?.message || "Failed to fetch scheme performance" });
    }
  });

  return httpServer;
}
