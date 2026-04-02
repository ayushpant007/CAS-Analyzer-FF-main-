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
import nodemailer from "nodemailer";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { google } from "googleapis";
import { registerChatRoutes } from "./replit_integrations/chat/routes";
import { registerImageRoutes } from "./replit_integrations/image/routes";
import { fetchNavForScheme, fetchNavByISIN, findSchemeCode, searchSchemeCodes } from "./mfapi";
import { extractMetricsFromFactsheet } from "./factsheet";
import { getMetricsFromJson } from "./json_factsheet";
import { getBenchmarkReturns } from "./benchmarks";
import { lookupByIsinOrName } from "./scoring";
import { detectCasSource, calculateFundVsBenchmark } from "./fund-benchmark";

const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4
].filter(Boolean) as string[];

// ── OTP store (in-memory, 10 min expiry) ──────────────────────────────────────
const otpStore = new Map<string, { otp: string; expiresAt: number; name: string; password?: string; mobile?: string }>();

// ── Password reset token store (in-memory, 1 hour expiry) ─────────────────────
const resetTokenStore = new Map<string, { email: string; expiresAt: number }>();

// ── Google Sheets helper ───────────────────────────────────────────────────────
async function appendToSheet(row: (string | number)[]) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!serviceAccountJson || !sheetId) return;
  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
  } catch (err: any) {
    console.error("[Sheets] Error writing to sheet:", err.message);
  }
}

function createTransporter() {
  const user = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}
// ──────────────────────────────────────────────────────────────────────────────

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
    const userEmail = req.body.userEmail ? String(req.body.userEmail).toLowerCase() : null;

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
0. Investor name: Extract the full name of the investor/account holder from the CAS report header or personal details section. Return as "investor_name": string.
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
   - Explicitly says "SIP", "Purchase – SIP", "Purchase – Systematic", or "Systematic Investment" → type: "SIP"
   - Says "Purchase – Lumpsum", "Purchase – Online", "Purchase – Initial", "Purchase – NFO", or is clearly a one-time purchase without SIP/Systematic qualifier → type: "PURCHASE"
   - "Switch Out" or "Systematic Transfer Plan - Switch Out" → type: "STP-OUT"
   - "Switch In" or "Systematic Transfer Plan - Switch In" → type: "STP-IN"
   - "STP" or "Systematic Transfer" (direction unclear) → type: "STP-OUT"
   - "SWP", "Systematic Withdrawal", "Redemption" → type: "SWP"
   - Extract the correct date (e.g., DD-MMM-YYYY or DD/MM/YYYY), scheme name, and amount.
   - CRITICAL: Distinguish Switch In (receiving fund, destination) from Switch Out (source fund, money leaving). Only use "STP-OUT" for the fund from which money is transferred out.
   - CRITICAL: Do NOT classify STP-IN as SIP. STP-IN is money arriving from a debt fund via transfer, NOT a new SIP investment.
   - Be comprehensive: extract ALL systematic transactions found in the text.
   - For amount, use the numerical value (e.g., if it says ₹1,000, extract 1000).

Return ONLY valid JSON with this exact structure: {
  "investor_name": string,
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
- fund_category: e.g. Equity, Debt, Hybrid, Gold/Commodity, etc. Gold ETF Fund of Fund should be categorized as "Gold/Commodity".
- fund_type: e.g. Flexi Cap, Bluechip, Large Cap, Mid Cap, Small Cap, Sectoral, Gold ETF FoF, etc.
- isin: The 12-character International Securities Identification Number for the fund.

Ensure ALL funds and folios are extracted comprehensively without omission, including Gold ETF Fund of Fund, Silver ETF, and any commodity/alternative fund schemes. Ensure all numerical values are numbers.

Text content:
${text}`;

      const analysisRawResult = await generateWithFallback(analysisPrompt, { responseMimeType: "application/json" });
      const analysisRawStr = typeof analysisRawResult === 'string' ? analysisRawResult : "";
      const analysis = JSON.parse(analysisRawStr || "{}");

      // Detect CAS source (CAMS / NSDL / CDSL) from raw text
      analysis.cas_source = detectCasSource(text);

      const report = await storage.createReport({
        filename: req.file.originalname,
        investorType,
        ageGroup,
        userEmail: userEmail || null,
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
    const email = req.query.email as string | undefined;
    const list = email
      ? await storage.getReportsByEmail(email)
      : await storage.getAllReports();
    res.json(list);
  });

  // ── Dashboard: 30-day upload timeline from real DB data ───────────────────────
  app.get("/api/reports/timeline", async (req, res) => {
    try {
      const email = req.query.email as string | undefined;
      const list = email ? await storage.getReportsByEmail(email) : await storage.getAllReports();
      const today = new Date();
      const days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (29 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });
      const result = days.map(d => {
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const nextDay = new Date(d); nextDay.setDate(d.getDate() + 1);
        const uploads = list.filter(r => {
          const t = new Date(r.createdAt!);
          return t >= d && t < nextDay;
        }).length;
        const analyzed = list.filter(r => {
          const t = new Date(r.createdAt!);
          const hasAnalysis = (r.analysis as any)?.funds?.length > 0;
          return t >= d && t < nextDay && hasAnalysis;
        }).length;
        return { day: label, uploads, analyzed };
      });
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Dashboard: fund category distribution from real report data ───────────────
  app.get("/api/reports/categories", async (req, res) => {
    try {
      const email = req.query.email as string | undefined;
      const list = email ? await storage.getReportsByEmail(email) : await storage.getAllReports();
      const counts: Record<string, number> = {};
      let total = 0;
      for (const r of list) {
        const funds: any[] = (r.analysis as any)?.funds ?? [];
        for (const f of funds) {
          const cat = (f.fund_category || f.category || "Other").trim();
          const key = /equity/i.test(cat) ? "Equity"
            : /debt|bond|liquid|money market/i.test(cat) ? "Debt"
            : /hybrid|balanced/i.test(cat) ? "Hybrid"
            : /gold|silver|commodity/i.test(cat) ? "Commodity"
            : "Other";
          counts[key] = (counts[key] || 0) + 1;
          total++;
        }
      }
      if (total === 0) {
        return res.json([
          { name: "Equity",  value: 54, fill: "#22d3ee" },
          { name: "Debt",    value: 24, fill: "#a855f7" },
          { name: "Hybrid",  value: 14, fill: "#f59e0b" },
          { name: "Other",   value: 8,  fill: "#34d399" },
        ]);
      }
      const COLOR: Record<string, string> = { Equity: "#22d3ee", Debt: "#a855f7", Hybrid: "#f59e0b", Commodity: "#f87171", Other: "#34d399" };
      const result = Object.entries(counts).map(([name, cnt]) => ({
        name, value: Math.round((cnt / total) * 100), fill: COLOR[name] || "#94a3b8",
      })).sort((a, b) => b.value - a.value);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Dashboard: real-time market indices (Yahoo Finance) ───────────────────────
  let marketCache: { data: any[]; ts: number } | null = null;
  app.get("/api/market/indices", async (req, res) => {
    try {
      if (marketCache && Date.now() - marketCache.ts < 5 * 60 * 1000) {
        return res.json(marketCache.data);
      }
      const SYMBOLS = [
        { symbol: "^NSEI",    label: "NIFTY 50" },
        { symbol: "^BSESN",   label: "SENSEX" },
        { symbol: "^NSEBANK", label: "NIFTY BANK" },
        { symbol: "^CNXIT",   label: "NIFTY IT" },
        { symbol: "^NSEMDCP50", label: "NIFTY MID" },
        { symbol: "GOLDBEES.NS", label: "GOLD ETF" },
        { symbol: "NIFTYSMLCAP250.NS", label: "SMALL CAP" },
      ];
      const results = await Promise.allSettled(
        SYMBOLS.map(({ symbol, label }) =>
          fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`, {
            headers: { "User-Agent": "Mozilla/5.0" },
          })
          .then(r => r.json())
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            if (!meta) return null;
            const price = meta.regularMarketPrice ?? 0;
            const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
            const change = prev ? ((price - prev) / prev) * 100 : 0;
            return { label, value: (change >= 0 ? "+" : "") + change.toFixed(2) + "%", up: change >= 0 };
          })
        )
      );
      const data = results
        .map(r => r.status === "fulfilled" ? r.value : null)
        .filter(Boolean) as any[];
      if (data.length > 0) {
        marketCache = { data, ts: Date.now() };
        res.json(data);
      } else {
        res.json(marketCache?.data ?? []);
      }
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get(api.reports.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });
    const report = await storage.getReport(id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  });

  // Fund vs Benchmark (since inception) — CAMS reports only
  app.get("/api/fund-vs-benchmark/:id", async (req, res) => {
    try {
      const report = await storage.getReport(Number(req.params.id));
      if (!report) return res.status(404).json({ message: "Report not found" });

      const analysis    = (report.analysis as any) || {};
      const snapshot    = (analysis.mf_snapshot    || []) as any[];
      const transactions = (analysis.transactions  || []) as any[];

      if (snapshot.length === 0) {
        return res.json({ results: [], cas_source: analysis.cas_source || "UNKNOWN" });
      }

      const results = await calculateFundVsBenchmark(snapshot, transactions);
      res.json({ results, cas_source: analysis.cas_source || "UNKNOWN" });
    } catch (err: any) {
      console.error("fund-vs-benchmark error:", err);
      res.status(500).json({ message: "Failed to calculate benchmark: " + err.message });
    }
  });

  app.get("/api/nav/:schemeName", async (req, res) => {
    const schemeName = decodeURIComponent(req.params.schemeName);
    const isin = (req.query.isin as string | undefined)?.trim();
    try {
      const navData = isin
        ? await fetchNavByISIN(isin, schemeName)
        : await fetchNavForScheme(schemeName);
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
    res.setHeader("Cache-Control", "no-store");

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

      // Sectors/holdings are not fetched from AI to keep analysis fast.
      // They are available from the fund factsheet if needed in future.
      const aiInsight = null;

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

  // ── Auth OTP Routes ─────────────────────────────────────────────────────────
  app.post("/api/auth/send-otp", async (req, res) => {
    const { email, name = "", password = "", mobile = "" } = req.body as { email: string; name?: string; password?: string; mobile?: string };
    if (!email) return res.status(400).json({ error: "Email is required" });

    const otp = generateOtp();
    otpStore.set(email.toLowerCase(), { otp, expiresAt: Date.now() + 10 * 60 * 1000, name, password, mobile });

    const transporter = createTransporter();
    if (!transporter) {
      console.log(`[OTP] Code for ${email}: ${otp} (SMTP not configured)`);
      return res.json({ ok: true, dev: true });
    }

    try {
      await transporter.sendMail({
        from: `"CAS Analyzer" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: "Your CAS Analyzer verification code",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#070a12;color:#fff;border-radius:12px;">
            <h2 style="color:#22d3ee;margin-bottom:8px;">Verify your email</h2>
            <p style="color:rgba(255,255,255,0.6);margin-bottom:24px;">Use the code below to complete your sign-up. It expires in 10 minutes.</p>
            <div style="font-size:36px;font-weight:900;letter-spacing:10px;text-align:center;color:#fff;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.25);border-radius:10px;padding:20px;">${otp}</div>
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[OTP] Email send error:", err.message);
      res.status(500).json({ error: "Failed to send email. Please try again." });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body as { email: string; otp: string };
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const record = otpStore.get(email.toLowerCase());
    if (!record) return res.status(400).json({ error: "No OTP found for this email. Please request a new code." });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }
    if (record.otp !== otp.trim()) return res.status(400).json({ error: "Incorrect code. Please try again." });

    otpStore.delete(email.toLowerCase());

    // If this was a signup OTP (has password), save user to DB
    if (record.password) {
      try {
        const existing = await storage.getUserByEmail(email);
        if (!existing) {
          const passwordHash = await bcrypt.hash(record.password, 10);
          await storage.createUser({
            name: record.name || email.split("@")[0],
            email: email.toLowerCase(),
            passwordHash,
            mobile: record.mobile || null,
          });

          // Send user details to Google Sheets
          const nameParts = (record.name || "").trim().split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          const signedUpAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
          await appendToSheet([firstName, lastName, email.toLowerCase(), record.mobile || "", signedUpAt, "Signup", "Email"]);
          console.log("[Sheets] New signup logged:", email);
        }
      } catch (err: any) {
        console.error("[Auth] User save error:", err.message);
      }
    }

    res.json({ ok: true, name: record.name, email: email.toLowerCase() });
  });

  // ── Forgot Password – send reset link ────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "No account found with this email address." });

    const token = crypto.randomBytes(32).toString("hex");
    resetTokenStore.set(token, { email: email.toLowerCase(), expiresAt: Date.now() + 60 * 60 * 1000 });

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

    const transporter = createTransporter();
    if (!transporter) {
      console.log(`[RESET] Link for ${email}: ${resetUrl} (SMTP not configured)`);
      return res.json({ ok: true, dev: true });
    }

    try {
      await transporter.sendMail({
        from: `"CAS Analyzer" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: "Reset your CAS Analyzer password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#070a12;color:#fff;border-radius:12px;">
            <h2 style="color:#7c3aed;margin-bottom:8px;">Reset your password</h2>
            <p style="color:rgba(255,255,255,0.6);margin-bottom:24px;">Click the button below to set a new password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:block;text-align:center;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:700;font-size:16px;">Reset Password</a>
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
          </div>
        `,
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[RESET] Email send error:", err.message);
      res.status(500).json({ error: "Failed to send reset email. Please try again." });
    }
  });

  // ── Reset Password – set new password via token ───────────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required." });

    const record = resetTokenStore.get(token);
    if (!record) return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
    if (Date.now() > record.expiresAt) {
      resetTokenStore.delete(token);
      return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await storage.updateUserPassword(record.email, passwordHash);
    resetTokenStore.delete(token);
    res.json({ ok: true });
  });

  // ── Login with email/password ─────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password." });

    // Log login to Google Sheets
    const nameParts = (user.name || "").trim().split(" ");
    const loginAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    await appendToSheet([nameParts[0] || "", nameParts.slice(1).join(" ") || "", user.email, user.mobile || "", loginAt, "Login", "Email"]);
    console.log("[Sheets] Email login logged:", user.email);

    res.json({ ok: true, name: user.name, email: user.email });
  });

  // ── Google Login tracking ─────────────────────────────────────────────────────
  app.post("/api/auth/google-login", async (req, res) => {
    const { name, email } = req.body as { name: string; email: string };
    if (!email) return res.status(400).json({ error: "Email is required." });

    const nameParts = (name || "").trim().split(" ");
    const loginAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    await appendToSheet([nameParts[0] || "", nameParts.slice(1).join(" ") || "", email.toLowerCase(), "", loginAt, "Login", "Google"]);
    console.log("[Sheets] Google login logged:", email);

    res.json({ ok: true });
  });
  // ────────────────────────────────────────────────────────────────────────────

  return httpServer;
}
