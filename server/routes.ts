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
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { registerImageRoutes } from "./replit_integrations/image/routes";
import { fetchNavForScheme, fetchNavByISIN, findSchemeCode, searchSchemeCodes } from "./mfapi";
import { extractMetricsFromFactsheet } from "./factsheet";
import { getMetricsFromJson } from "./json_factsheet";
import { getBenchmarkReturns } from "./benchmarks";
import { lookupByIsinOrName } from "./scoring";

const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

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
    }
  }
  throw lastError || new Error("All Gemini API keys failed");
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
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

      let text = "";
      try {
        const { stdout } = await execAsync(`pdftotext -upw "${password}" "${tempPath}" -`);
        text = stdout;
      } catch (e: any) {
        console.error("PDF Parsing error:", e);
        if (e.message.includes("Incorrect password") || (e.stderr && e.stderr.includes("Incorrect password"))) {
            return res.status(401).json({ message: "Incorrect password" });
        }
        if (e.code === 3 || e.code === 1) {
             return res.status(401).json({ message: "Incorrect password or file permission error" });
        }
        throw e;
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract text from PDF. It might be empty or scanned." });
      }

      let csvContent = "";
      try {
        csvContent = await fs.readFile(path.join(process.cwd(), "server/assets/category_ratios.csv"), "utf-8");
      } catch (e) {
        console.error("Error reading ratios CSV:", e);
      }

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

  app.get("/api/nav/:schemeName", async (req, res) => {
    const schemeName = decodeURIComponent(req.params.schemeName);
    try {
      const navData = await fetchNavForScheme(schemeName);
      if (!navData) {
        return res.status(404).json({ message: "NAV data not found for this scheme" });
      }
      res.json(navData);
    } catch (error: any) {
      console.error("NAV fetch error:", error);
      res.status(500).json({ message: "Failed to fetch NAV data" });
    }
  });

  app.get("/api/scheme-codes/search", async (req, res) => {
    const query = (req.query.q as string) || "";
    if (!query || query.length < 3) {
      return res.json([]);
    }
    try {
      const results = await searchSchemeCodes(query);
      res.json(results);
    } catch (error: any) {
      console.error("Scheme code search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
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

      console.log(`Fetching real data for: ${fundName} (${isin})`);

      const [navData, jsonMetrics] = await Promise.all([
        fetchNavByISIN(isin, fundName),
        getMetricsFromJson(fundName)
      ]);

      const mergedMetrics = jsonMetrics;
      const reportedBenchmarkName = mergedMetrics?.benchmark_name || "Data unavailable";
      const benchmarkReturns = await getBenchmarkReturns(fundName, reportedBenchmarkName);
      const benchmarkName = benchmarkReturns?.resolvedName || reportedBenchmarkName;

      const formatCagr = (val: number | null) => val !== null ? `${val.toFixed(2)}%` : "N/A";
      
      let aiInsight = null;
      try {
        const insightPrompt = `You are a financial analyst. For the Indian mutual fund "${fundName}" (ISIN: ${isin}), provide ONLY textual insights. Do NOT provide any numerical data like NAV, returns, ratios, or AUM.

Provide:
1. A brief 2-3 sentence qualitative assessment of this fund's investment strategy
2. Top 5 sector names this fund typically invests in (just names, no percentages)
3. Top 5 stock holding names (just names, no percentages)

Return JSON:
{
  "sectors": [{"name": string, "weight": 0}],
  "holdings": [{"name": string, "weight": 0}]
}

Return ONLY JSON. No markdown.`;
        const insightText = await generateWithFallback(insightPrompt);
        const jsonMatch = insightText?.match(/\{[\s\S]*\}/);
        aiInsight = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch (e) {
        console.log("AI insight fetch failed, using empty data");
      }

      const performance = {
        nav: {
          value: navData?.current_nav ?? 0,
          date: navData?.nav_date || "Data unavailable",
        },
        cagr: {
          "1y": formatCagr(navData?.cagr_1y ?? null),
          "3y": formatCagr(navData?.cagr_3y ?? null),
          "5y": formatCagr(navData?.cagr_5y ?? null),
        },
        benchmark_name: benchmarkName,
        benchmark_returns: benchmarkReturns || {
          "1y": "N/A",
          "3y": "N/A",
          "5y": "N/A",
        },
        portfolio: {
          sectors: aiInsight?.sectors || [],
          holdings: aiInsight?.holdings || [],
        },
        stats: {
          aum_crores: mergedMetrics?.aum_crores || "Data unavailable",
          expense_ratio: mergedMetrics?.expense_ratio || "Data unavailable",
          turnover: mergedMetrics?.portfolio_turnover || "Data unavailable",
          factsheet_month: (mergedMetrics as any)?.factsheet_month || "Data unavailable",
          last_updated: (mergedMetrics as any)?.last_updated || "Data unavailable",
          scheme_category: (mergedMetrics as any)?.scheme_category || "Data unavailable",
        },
        risk_ratios: {
          std_dev: { fund: mergedMetrics?.std_deviation || "Data unavailable", category_avg: "Data unavailable" },
          sharpe: { fund: mergedMetrics?.sharpe_ratio || "Data unavailable", category_avg: "Data unavailable" },
          beta: { fund: mergedMetrics?.beta || "Data unavailable", category_avg: "Data unavailable" },
          alpha: { fund: mergedMetrics?.alpha || "Data unavailable", category_avg: "Data unavailable" },
        },
        data_sources: {
          nav: navData ? "MFAPI (api.mfapi.in)" : "Data unavailable",
          returns: navData ? "Calculated from MFAPI NAV history" : "Data unavailable",
          risk_metrics: mergedMetrics ? mergedMetrics.source : "Data unavailable",
        },
      };

      res.json(performance);
    } catch (error: any) {
      console.error("Performance fetch error:", error);
      res.status(500).json({ message: "Failed to fetch performance data" });
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

      console.log(`Fetching scheme performance from MFAPI for: ${fundName} (${isin})`);

      const [navData, factsheetMetrics] = await Promise.all([
        fetchNavByISIN(isin, fundName),
        extractMetricsFromFactsheet(fundName),
      ]);

      const reportedBenchmarkName2 = factsheetMetrics?.benchmark_name || "Data unavailable";
      const benchmarkReturns2 = await getBenchmarkReturns(fundName, reportedBenchmarkName2);
      const benchmarkName2 = benchmarkReturns2?.resolvedName || reportedBenchmarkName2;

      const formatCagr = (val: number | null) => val !== null ? `${val.toFixed(2)}%` : "N/A";

      const result = {
        scheme_returns: {
          "1y": formatCagr(navData?.cagr_1y ?? null),
          "3y": formatCagr(navData?.cagr_3y ?? null),
          "5y": formatCagr(navData?.cagr_5y ?? null),
        },
        benchmark_name: benchmarkName2,
        benchmark_returns: benchmarkReturns2 || {
          "1y": "N/A",
          "3y": "N/A",
          "5y": "N/A",
        },
        nav: {
          value: navData?.current_nav ?? 0,
          date: navData?.nav_date || "Data unavailable",
        },
        data_sources: {
          returns: navData ? "Calculated from MFAPI NAV history" : "Data unavailable",
          benchmark: factsheetMetrics ? factsheetMetrics.source : "Data unavailable",
        },
      };

      return res.json(result);
    } catch (err: any) {
      console.error(`Scheme performance error:`, err.message);
      res.status(500).json({ message: "Failed to fetch scheme performance" });
    }
  });

  app.get("/api/scoring/:isin", async (req, res) => {
    const isin = req.params.isin.trim();
    const schemeName = (req.query.schemeName as string | undefined) || undefined;
    const plan = (req.query.plan as string | undefined) || undefined;
    try {
      const record = lookupByIsinOrName(isin, schemeName, plan);
      if (!record) {
        return res.status(404).json({ message: "No scoring data found for ISIN: " + isin });
      }
      res.json(record);
    } catch (err: any) {
      console.error("Scoring lookup error:", err.message);
      res.status(500).json({ message: "Scoring lookup failed" });
    }
  });

  app.get("/api/bulk-nav", async (req, res) => {
    const schemeNames = (req.query.schemes as string || "").split("|").filter(Boolean);
    if (schemeNames.length === 0) {
      return res.json({});
    }

    const results: Record<string, any> = {};

    const batchSize = 5;
    for (let i = 0; i < schemeNames.length; i += batchSize) {
      const batch = schemeNames.slice(i, i + batchSize);
      const promises = batch.map(async (name) => {
        try {
          const navData = await fetchNavForScheme(name);
          if (navData) {
            results[name] = {
              current_nav: navData.current_nav,
              nav_date: navData.nav_date,
              cagr_1y: navData.cagr_1y,
              cagr_3y: navData.cagr_3y,
              cagr_5y: navData.cagr_5y,
            };
          }
        } catch (e) {
          console.error(`Bulk NAV error for ${name}:`, e);
        }
      });
      await Promise.all(promises);
    }

    res.json(results);
  });

  return httpServer;
}
