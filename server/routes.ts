import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, DAILY_UPLOAD_LIMIT } from "./storage";
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

async function uploadToGoogleDrive(filePath: string, fileName: string) {
  const serviceAccountJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!serviceAccountJson || !folderId) {
    console.warn("[Drive] Missing GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_FOLDER_ID — skipping upload");
    return;
  }
  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const drive = google.drive({ version: "v3", auth });
    const { createReadStream } = await import("fs");
    const response = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: "application/pdf",
        body: createReadStream(filePath),
      },
      fields: "id, name, webViewLink",
    });
    console.log(`[Drive] Uploaded "${response.data.name}" → ${response.data.webViewLink}`);
  } catch (err: any) {
    console.error("[Drive] Upload failed:", err.message);
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

async function generateWithFallback(prompt: string, options: { model?: string, responseMimeType?: string, temperature?: number } = {}) {
  const modelName = (options.model || process.env.GEMINI_MODEL || "gemini-2.5-flash").toLowerCase().replace(/\s+/g, '-');
  let lastError: any;

  for (const key of GEMINI_KEYS) {
    try {
      const client = new GoogleGenerativeAI(key);
      const model = client.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          temperature: options.temperature ?? 0,
        }
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

  app.get("/privacy", (_req, res) => {
    res.sendFile("privacy.html", { root: "./client/public" });
  });

  app.get("/google397a04de8718b47e.html", (_req, res) => {
    res.type("text/html").send("google-site-verification: google397a04de8718b47e.html");
  });

  app.get("/api/config/public", (_req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
      googleRedirectUri: process.env.VITE_GOOGLE_REDIRECT_URI || "",
    });
  });

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

    // ── Daily upload limit check ──────────────────────────────────────────────
    if (userEmail) {
      const used = await storage.getDailyUploadCount(userEmail);
      if (used >= DAILY_UPLOAD_LIMIT) {
        return res.status(429).json({
          message: `You've reached your daily limit of ${DAILY_UPLOAD_LIMIT} PDF uploads. Your limit resets at midnight UTC.`,
          limit: DAILY_UPLOAD_LIMIT,
          used,
        });
      }
    }

    const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}.pdf`);

    try {
      await fs.writeFile(tempPath, req.file.buffer);

      // Upload to Google Drive in the background (non-blocking)
      const driveFileName = req.file.originalname || "report.pdf";
      uploadToGoogleDrive(tempPath, driveFileName).catch(() => {});

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
4. Asset Class Allocation: Compute this accurately by grouping all funds from the mf_snapshot into exactly these standard categories using their SEBI/AMFI classification:
   - "Equity": Pure equity funds — Large Cap, Mid Cap, Small Cap, Flexi Cap, Multi Cap, Large & Mid Cap, ELSS, Focused Fund, Value Fund, Contra Fund, Sectoral, Thematic, Overseas/International equity FOF
   - "Debt": All debt/fixed income funds — Liquid, Overnight, Ultra Short Duration, Low Duration, Short Duration, Medium Duration, Medium to Long Duration, Long Duration, Dynamic Bond, Corporate Bond, Credit Risk, Banking & PSU, Gilt, Gilt with 10yr constant duration, Floater
   - "Hybrid": Balanced/hybrid funds — Conservative Hybrid, Balanced Hybrid, Aggressive Hybrid, Dynamic Asset Allocation / Balanced Advantage, Multi Asset Allocation, Arbitrage, Equity Savings, Solution Oriented
   - "Gold/Silver": Gold ETF, Silver ETF, Gold ETF Fund of Fund, Silver ETF Fund of Fund, Gold/Commodity funds
   - "Others": Everything else not fitting above categories
   For each category, sum the current market valuation of all funds in that category. Compute percentage = (category_value / total_portfolio_value) * 100. Only include categories where value > 0.
   Return: [{"asset_class": "Equity"|"Debt"|"Hybrid"|"Gold/Silver"|"Others", "value": number, "percentage": number}]
5. Mutual Fund Portfolio Snapshot: [{"scheme_name": string, "folio_no": string, "units": number, "nav": number, "invested_amount": number, "valuation": number, "unrealised_profit_loss": number, "fund_category": string, "fund_type": string, "isin": string}]
   - IMPORTANT: For "units", strictly extract the "No. of Units" or "Units" column value from the statement for each scheme.
   - For fund_category, use ONLY these exact values: "Equity", "Debt", "Hybrid", "Gold/Commodity", "Others". Apply the same classification rules as in field 4 above.
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

      const investorName = analysis.investor_name || "";
      const report = await storage.upsertReportByInvestorName({
        filename: req.file.originalname,
        investorType,
        ageGroup,
        userEmail: userEmail || null,
        analysis
      }, investorName);

      if (userEmail) await storage.logUpload(userEmail);

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

  // ── Delete a single report ─────────────────────────────────────────────────
  app.delete("/api/reports/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const email = req.query.email as string | undefined;
    if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });
    const deleted = await storage.deleteReport(id, email);
    if (!deleted) return res.status(404).json({ message: "Report not found" });
    res.json({ ok: true, id });
  });

  // ── Bulk-delete non-CAS reports ────────────────────────────────────────────
  app.delete("/api/reports/cleanup/non-cas", async (req, res) => {
    const email = req.query.email as string | undefined;
    const count = await storage.deleteNonCasReports(email);
    console.log(`[Cleanup] Deleted ${count} non-CAS report(s)${email ? ` for ${email}` : ""}`);
    res.json({ ok: true, deleted: count });
  });

  // ── Daily upload usage ─────────────────────────────────────────────────────────
  app.get("/api/reports/daily-usage", async (req, res) => {
    const email = req.query.email as string | undefined;
    const used = email ? await storage.getDailyUploadCount(email) : 0;
    res.json({ limit: DAILY_UPLOAD_LIMIT, used, remaining: Math.max(0, DAILY_UPLOAD_LIMIT - used) });
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

    // Only run duplicate checks for sign-up (when password is provided)
    if (password) {
      const existingByEmail = await storage.getUserByEmail(email.toLowerCase());
      if (existingByEmail) {
        return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
      }
      if (mobile && mobile.trim()) {
        const existingByMobile = await storage.getUserByMobile(mobile.trim());
        if (existingByMobile) {
          return res.status(409).json({ error: "An account with this mobile number already exists." });
        }
      }
    }

    const otp = generateOtp();
    otpStore.set(email.toLowerCase(), { otp, expiresAt: Date.now() + 10 * 60 * 1000, name, password, mobile });

    const transporter = createTransporter();
    if (!transporter) {
      console.log(`[OTP] Code for ${email}: ${otp} (SMTP not configured)`);
      return res.json({ ok: true, dev: true, devOtp: otp });
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

    const existingUser = await storage.getUserByEmail(email.toLowerCase());
    if (!existingUser) {
      return res.status(404).json({ error: "No account found for this email. Please sign up first.", notFound: true });
    }

    const dbName = existingUser.name || name;
    const nameParts = dbName.trim().split(" ");
    const loginAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    await appendToSheet([nameParts[0] || "", nameParts.slice(1).join(" ") || "", email.toLowerCase(), "", loginAt, "Login", "Google"]).catch(() => {});
    console.log("[Sheets] Google login logged:", email);

    res.json({ ok: true, name: dbName, email: existingUser.email });
  });

  // ── Gmail Auto-Import ─────────────────────────────────────────────────────────
  const GMAIL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
  const GMAIL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
  const GMAIL_REDIRECT_URI = (() => {
    if (process.env.GMAIL_REDIRECT_URI) return process.env.GMAIL_REDIRECT_URI;
    const domain = (process.env.REPLIT_DOMAINS || "localhost:5000").split(",")[0].trim();
    return `https://${domain}/auth/gmail/callback`;
  })();

  function makeOAuth2Client() {
    return new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
  }

  const CAS_SENDERS = [
    "donotreply@camsonline.com",
    "statements@kfintech.com",
    "noreply@mfcentral.com",
    "cas@nsdl.co.in",
    "cas@cdslindia.com",
    "consolidatedaccountstatement@camsonline.com",
  ];

  // Validate extracted PDF text to confirm it's actually a CAS statement
  function isCasPdfText(text: string): boolean {
    const markers = [
      /consolidated account statement/i,
      /portfolio\s+valuation/i,
      /\bNSDL\b/,
      /\bCDSL\b/,
      /\bCAMS\b/,
      /\bkfintech\b/i,
      /\bMFCentral\b/i,
      /folio\s*(no|number)/i,
      /\bISIN\b/,
      /net\s+asset\s+value/i,
      /mutual\s+fund\s+statement/i,
      /\bunits\b.*\bnav\b/i,
    ];
    const matched = markers.filter(r => r.test(text)).length;
    return matched >= 2;
  }

  // Core: analyze a PDF buffer and store as report
  async function analyzeCasPdfBuffer(
    pdfBuffer: Buffer,
    filename: string,
    password: string,
    userEmail: string,
    investorType = "Aggressive",
    ageGroup = "20-35",
  ): Promise<number> {
    // Enforce daily upload limit
    const used = await storage.getDailyUploadCount(userEmail);
    if (used >= DAILY_UPLOAD_LIMIT) {
      console.log(`[Gmail] ⛔ Daily limit reached for ${userEmail} (${used}/${DAILY_UPLOAD_LIMIT}) — skipping ${filename}`);
      throw new Error("DAILY_LIMIT_REACHED");
    }

    const tempPath = path.join(os.tmpdir(), `gmail-import-${Date.now()}.pdf`);
    try {
      await fs.writeFile(tempPath, pdfBuffer);

      let text = "";
      try {
        const { stdout } = await execAsync(`pdftotext -upw "${password}" "${tempPath}" -`);
        text = stdout;
      } catch (e: any) {
        console.error(`[Gmail] pdftotext failed for ${filename}:`, e.message);
        throw new Error("PDF_PASSWORD_WRONG");
      }

      if (!text || text.trim().length < 100) throw new Error("PDF_EMPTY");

      // Reject non-CAS PDFs before calling AI
      if (!isCasPdfText(text)) {
        console.log(`[Gmail] ⚠️  Skipping "${filename}" — not a CAS statement (no CAS markers found)`);
        throw new Error("NOT_CAS_PDF");
      }

      let csvContent = "";
      try { csvContent = await fs.readFile(path.join(process.cwd(), "server/assets/category_ratios.csv"), "utf-8"); } catch {}

      const prompt = `You are a precise financial data extraction engine. Your ONLY task is to extract numbers and text that are EXPLICITLY WRITTEN in the CAS document below. 

CRITICAL RULES — VIOLATIONS ARE NOT ACCEPTABLE:
- NEVER invent, estimate, guess, or hallucinate ANY number, name, or value.
- If a value is not explicitly present in the text, return null — never a guess or approximation.
- Do NOT round numbers; use the exact figures as printed.
- Do NOT fill in missing fields with averages, assumptions, or nearby values.
- Every number in your output MUST be traceable to a specific line in the CAS text.
- If you are uncertain about a value, return null rather than guessing.

You are a financial analyst. Analyze the following Consolidated Account Statement (CAS) text EXACTLY as-is. Do NOT invent, hallucinate, or guess any numbers. Only extract what is explicitly present in the text.
Investor Profile: Age Group: ${ageGroup}, Risk Profile: ${investorType}.
Reference Ratios CSV:\n${csvContent}

Extract the following fields:

0. Investor name from the CAS header. Return as "investor_name": string.

1. Portfolio summary (from totals section):
   {"net_asset_value": <total current portfolio value as number>, "total_cost": <total amount invested/cost basis as number>}

2. Account-wise summary: [{"type": string, "details": string, "count": number, "value": number}]

3. Historical Portfolio Valuation (monthly trend if present): [{"month_year": string, "valuation": number, "change_value": number, "change_percentage": number}]

4. Mutual Fund Snapshot — MOST CRITICAL SECTION. For EVERY fund/scheme listed, extract:
   {
     "scheme_name": <exact scheme name as in CAS>,
     "folio_no": <folio number>,
     "isin": <ISIN code e.g. INF123A01234>,
     "units": <closing balance/units as number>,
     "nav": <NAV per unit as number>,
     "invested_amount": <cost/invested amount as number — NEVER 0 if cost data is present>,
     "valuation": <current market value as number — if not explicit, compute as units × nav>,
     "unrealised_profit_loss": <valuation - invested_amount>,
     "fund_category": <MUST be exactly one of: "Equity", "Debt", "Hybrid", "Gold/Silver", "Others"
       Rules:
       - "Equity": for Equity funds, ELSS, Index Funds, ETFs (non-gold), Large Cap, Mid Cap, Small Cap, Multi Cap, Flexi Cap, Focused, Sectoral, Thematic, Value, Contra, Dividend Yield
       - "Debt": for Debt funds, Liquid, Overnight, Money Market, Ultra Short, Low Duration, Short Duration, Medium Duration, Long Duration, Corporate Bond, Banking & PSU, Credit Risk, Gilt, Dynamic Bond, FMP, Floater
       - "Hybrid": for Balanced Advantage, Aggressive Hybrid, Conservative Hybrid, Multi Asset Allocation, Equity Savings, Arbitrage, Dynamic Asset Allocation
       - "Gold/Silver": for Gold ETF, Silver ETF, Gold Fund of Funds, Gold Savings Fund
       - "Others": only if none of the above apply>,
     "fund_type": <specific sub-type e.g. "Large Cap Fund", "Liquid Fund", "ELSS", etc.>
   }

5. Asset Class Allocation — derive from the mf_snapshot above by grouping fund_category:
   For each unique fund_category (Equity/Debt/Hybrid/Gold/Silver/Others), sum all valuations:
   [{"asset_class": <category>, "value": <sum of valuations in that category>, "percentage": <value / total_portfolio_value * 100>}]
   RULE: Only include categories with value > 0. Percentage must add up to 100%. Never return 0% for a category that has holdings.

6. Transactions (SIP/STP/SWP/Purchase/Redemption): [{"date": string, "scheme_name": string, "folio_no": string, "type": string, "amount": number, "nav": number, "units": number, "stamp_duty": number}]

Return ONLY valid JSON (no markdown, no code blocks):
{"investor_name": string, "summary": {...}, "account_summaries": [...], "historical_valuations": [...], "asset_allocation": [...], "mf_snapshot": [...], "category_comparison": [...], "type_comparison": [...], "transactions": [...]}

CAS TEXT:\n${text}`;

      const raw = await generateWithFallback(prompt, { responseMimeType: "application/json" });
      const analysis = JSON.parse(typeof raw === "string" ? raw : "{}");
      analysis.cas_source = detectCasSource(text);

      // ── Post-process: ensure asset_allocation percentages are correct ──────────
      // If AI returned 0% or missing percentages, recompute from mf_snapshot values
      if (analysis.mf_snapshot && Array.isArray(analysis.mf_snapshot) && analysis.mf_snapshot.length > 0) {
        const catValMap: Record<string, number> = {};
        let grandTotal = 0;

        for (const mf of analysis.mf_snapshot) {
          // Ensure valuation is computed from units × nav if missing or zero
          let val = mf.valuation || 0;
          if ((!val || val === 0) && mf.units > 0 && mf.nav > 0) {
            val = mf.units * mf.nav;
            mf.valuation = val;
          }
          if (!val || val <= 0) continue;

          // Normalize fund_category to one of the 5 main categories
          const rawCat = (mf.fund_category || "Others").toLowerCase();
          let mainCat = "Others";
          if (rawCat === "equity" || rawCat.includes("equity") || rawCat === "elss" || rawCat.includes("elss") || rawCat.includes("index") || rawCat.includes("large cap") || rawCat.includes("mid cap") || rawCat.includes("small cap") || rawCat.includes("multi cap") || rawCat.includes("flexi cap") || rawCat.includes("thematic") || rawCat.includes("sectoral") || rawCat.includes("focused") || rawCat.includes("value fund") || rawCat.includes("contra")) {
            mainCat = "Equity";
          } else if (rawCat === "debt" || rawCat.includes("debt") || rawCat.includes("liquid") || rawCat.includes("overnight") || rawCat.includes("money market") || rawCat.includes("duration") || rawCat.includes("corporate bond") || rawCat.includes("credit risk") || rawCat.includes("gilt") || rawCat.includes("banking") || rawCat.includes("floater") || rawCat.includes("fmp")) {
            mainCat = "Debt";
          } else if (rawCat === "hybrid" || rawCat.includes("hybrid") || rawCat.includes("balanced") || rawCat.includes("arbitrage") || rawCat.includes("equity savings") || rawCat.includes("multi asset") || rawCat.includes("dynamic asset")) {
            mainCat = "Hybrid";
          } else if (rawCat.includes("gold") || rawCat.includes("silver")) {
            mainCat = "Gold/Silver";
          }

          // Normalize the stored fund_category to match one of the 5 canonical values
          mf.fund_category = mainCat;
          catValMap[mainCat] = (catValMap[mainCat] || 0) + val;
          grandTotal += val;
        }

        // Rebuild asset_allocation from mf_snapshot if percentages are all 0 or missing
        const existingAlloc = analysis.asset_allocation || [];
        const allPercsZero = existingAlloc.length === 0 || existingAlloc.every((a: any) => !a.percentage || a.percentage === 0);
        if (allPercsZero && grandTotal > 0) {
          analysis.asset_allocation = Object.entries(catValMap)
            .filter(([, val]) => val > 0)
            .map(([asset_class, value]) => ({
              asset_class,
              value: Math.round(value * 100) / 100,
              percentage: Math.round((value / grandTotal) * 10000) / 100,
            }));
        } else if (grandTotal > 0) {
          // Recompute percentages even if they exist, to ensure accuracy
          analysis.asset_allocation = (analysis.asset_allocation || []).map((a: any) => ({
            ...a,
            percentage: catValMap[a.asset_class]
              ? Math.round((catValMap[a.asset_class] / grandTotal) * 10000) / 100
              : a.percentage,
            value: catValMap[a.asset_class] || a.value,
          }));
          // Add any categories from mf_snapshot not in the existing allocation
          for (const [asset_class, value] of Object.entries(catValMap)) {
            if (!analysis.asset_allocation.find((a: any) => a.asset_class === asset_class)) {
              analysis.asset_allocation.push({
                asset_class,
                value: Math.round(value * 100) / 100,
                percentage: Math.round((value / grandTotal) * 10000) / 100,
              });
            }
          }
        }

        // Recompute summary totals from mf_snapshot if missing
        if (!analysis.summary || !analysis.summary.net_asset_value) {
          const totalInvested = analysis.mf_snapshot.reduce((s: number, m: any) => s + (m.invested_amount || 0), 0);
          analysis.summary = analysis.summary || {};
          if (!analysis.summary.net_asset_value) analysis.summary.net_asset_value = grandTotal;
          if (!analysis.summary.total_cost) analysis.summary.total_cost = totalInvested;
        }
      }

      const investorName = analysis.investor_name || "";
      const savedReport = await storage.upsertReportByInvestorName({
        filename,
        investorType,
        ageGroup,
        userEmail: userEmail.toLowerCase(),
        analysis,
      }, investorName);

      await storage.logUpload(userEmail);

      console.log(`[Gmail] ✅ Auto-imported and analyzed: ${filename} for ${userEmail} (reportId=${savedReport.id})`);
      return savedReport.id;
    } finally {
      fs.unlink(tempPath).catch(() => {});
    }
  }

  // Helper: paginate all Gmail message IDs for a query (up to maxTotal)
  async function fetchAllMessageIds(
    gmail: ReturnType<typeof google.gmail>,
    q: string,
    maxTotal = 500,
  ): Promise<{ id?: string | null; threadId?: string | null }[]> {
    const results: { id?: string | null; threadId?: string | null }[] = [];
    let pageToken: string | undefined;
    do {
      const res = await gmail.users.messages.list({
        userId: "me", q,
        maxResults: Math.min(500, maxTotal - results.length),
        ...(pageToken ? { pageToken } : {}),
      });
      const msgs = res.data.messages || [];
      results.push(...msgs);
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken && results.length < maxTotal);
    return results;
  }

  // Shared Gmail helpers (used by pollGmailAccount AND scan-range endpoint)
  type MsgPart = { mimeType?: string | null; filename?: string | null; body?: { attachmentId?: string | null; data?: string | null } | null; parts?: MsgPart[] | null };

  function looksLikeCasPdf(filename: string): boolean {
    const f = filename.toLowerCase();
    if (/[a-z]{5}[0-9]{4}[a-z]/.test(f)) return true;
    const CAS_FILENAME_KW = ["cas", "consolidated", "mfcentral", "cams", "kfintech", "nsdl", "cdsl", "account_statement", "account-statement"];
    return CAS_FILENAME_KW.some(kw => f.includes(kw));
  }

  function collectPdfParts(parts: MsgPart[]): MsgPart[] {
    const result: MsgPart[] = [];
    for (const part of parts) {
      const isPdf = part.mimeType === "application/pdf" ||
        part.mimeType === "application/octet-stream" ||
        (part.filename && part.filename.toLowerCase().endsWith(".pdf"));
      if (isPdf && part.body?.attachmentId) result.push(part);
      if (part.parts && part.parts.length > 0) result.push(...collectPdfParts(part.parts));
    }
    return result;
  }

  async function getGmailClient(conn: { accessToken: string; refreshToken: string; expiresAt: Date; userEmail: string }): Promise<ReturnType<typeof google.gmail>> {
    const oauth2 = makeOAuth2Client();
    oauth2.setCredentials({ access_token: conn.accessToken, refresh_token: conn.refreshToken });
    if (conn.expiresAt && new Date(conn.expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
      const { credentials } = await oauth2.refreshAccessToken();
      if (credentials.access_token && credentials.expiry_date) {
        await storage.updateGmailTokens(conn.userEmail, credentials.access_token, new Date(credentials.expiry_date));
        oauth2.setCredentials(credentials);
      }
    }
    return google.gmail({ version: "v1", auth: oauth2 });
  }

  // Poll one Gmail account for new CAS emails
  async function pollGmailAccount(
    conn: { userEmail: string; accessToken: string; refreshToken: string; expiresAt: Date; casPassword: string | null },
    fullScan = false,
    latestOnly = false,
  ): Promise<{ pdfCount: number; reportIds: number[] }> {
    try {
      const oauth2 = makeOAuth2Client();
      oauth2.setCredentials({ access_token: conn.accessToken, refresh_token: conn.refreshToken });

      // Refresh token if within 5 minutes of expiry
      if (conn.expiresAt && new Date(conn.expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
        const { credentials } = await oauth2.refreshAccessToken();
        if (credentials.access_token && credentials.expiry_date) {
          await storage.updateGmailTokens(conn.userEmail, credentials.access_token, new Date(credentials.expiry_date));
          oauth2.setCredentials(credentials);
        }
      }

      const gmail = google.gmail({ version: "v1", auth: oauth2 });

      // Log which inbox is actually being scanned (helps debug wrong-account issues)
      try {
        const profile = await gmail.users.getProfile({ userId: "me" });
        console.log(`[Gmail] Authenticated as: ${profile.data.emailAddress} (app account: ${conn.userEmail}) fullScan=${fullScan}`);
      } catch (e: any) {
        console.error(`[Gmail] Could not get profile:`, e.message);
      }

      const senderQuery = CAS_SENDERS.map(s => `from:${s}`).join(" OR ");
      let messages: { id?: string | null; threadId?: string | null }[];

      if (fullScan) {
        // ── Full inbox scan: no date filter, paginate through entire inbox ──────
        console.log(`[Gmail] 🔍 Full inbox scan — fetching ALL CAS PDFs ever received`);

        // Query 1: official CAS senders — very targeted, paginate all
        const officialAllQ = `(${senderQuery}) has:attachment (filename:.pdf OR filename:pdf)`;
        // Query 2: subject-based — any sender whose email subject mentions CAS keywords
        const subjectAllQ = `has:attachment (filename:.pdf OR filename:pdf) -from:noreply@accounts.google.com (subject:"consolidated account" OR subject:"account statement" OR subject:CAS OR subject:"mutual fund" OR subject:"portfolio" OR subject:"nsdl" OR subject:"cdsl" OR subject:"kfintech" OR subject:"cams")`;
        // Query 3: filename-based — PDF filenames with CAS-related words
        const filenameAllQ = `has:attachment -from:noreply@accounts.google.com (filename:CAS OR filename:consolidated OR filename:statement OR filename:portfolio OR filename:CAMS OR filename:kfintech OR filename:nsdl OR filename:cdsl)`;
        // Query 4: personal/forwarded — PDFs from gmail.com senders in last 30 days only
        // The isCasPdfText() validator rejects non-CAS PDFs after download
        const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        const personalAllQ = `has:attachment (filename:.pdf OR filename:pdf) from:gmail.com after:${thirtyDaysAgo}`;

        console.log(`[Gmail] fullScan officialQ:  ${officialAllQ}`);
        console.log(`[Gmail] fullScan subjectQ:   ${subjectAllQ}`);
        console.log(`[Gmail] fullScan filenameQ:  ${filenameAllQ}`);
        console.log(`[Gmail] fullScan personalQ:  ${personalAllQ}`);

        const [officialMsgs, subjectMsgs, filenameMsgs, personalMsgs] = await Promise.all([
          fetchAllMessageIds(gmail, officialAllQ, 500),
          fetchAllMessageIds(gmail, subjectAllQ, 500),
          fetchAllMessageIds(gmail, filenameAllQ, 500),
          fetchAllMessageIds(gmail, personalAllQ, 100),
        ]);

        console.log(`[Gmail] fullScan — official: ${officialMsgs.length}, subject: ${subjectMsgs.length}, filename: ${filenameMsgs.length}, personal: ${personalMsgs.length}`);

        const seen = new Set<string>();
        messages = [];
        for (const msg of [...officialMsgs, ...subjectMsgs, ...filenameMsgs, ...personalMsgs]) {
          if (msg.id && !seen.has(msg.id)) { seen.add(msg.id); messages.push(msg); }
        }
      } else {
        // ── Regular incremental check with date filter ────────────────────────
        // Primary: since last check (or 7 days if never checked), with 30-min buffer
        const baseDate = (conn as any).lastCheckedAt
          ? new Date(Math.min(new Date((conn as any).lastCheckedAt).getTime() - 30 * 60 * 1000, Date.now() - 2 * 60 * 60 * 1000))
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const dateQuery = `after:${Math.floor(baseDate.getTime() / 1000)}`;

        // Fallback always searches last 48 hours to catch any emails missed by timing gaps
        const fallback48hDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const fallbackDateQuery = `after:${Math.floor(fallback48hDate.getTime() / 1000)}`;

        // For "Check Now" (latestOnly): also search ANY PDF in last 6 hours — no keyword filter
        // This catches emails from personal contacts (e.g. forwarded CAS with no subject/keywords)
        const last6hDate = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const last6hQuery = `after:${Math.floor(last6hDate.getTime() / 1000)}`;

        console.log(`[Gmail] Primary date filter: emails after ${baseDate.toISOString()} (${dateQuery})`);
        console.log(`[Gmail] Fallback date filter: emails after ${fallback48hDate.toISOString()} (${fallbackDateQuery})`);

        const officialQ = `(${senderQuery}) has:attachment (filename:.pdf OR filename:pdf) ${dateQuery}`;
        // Subject-based: pick up PDFs from emails whose subject mentions CAS keywords
        const broadQ = `has:attachment (filename:.pdf OR filename:pdf) ${dateQuery} -from:noreply@accounts.google.com (subject:"consolidated account" OR subject:"account statement" OR subject:CAS OR subject:"mutual fund" OR subject:"kfintech" OR subject:"cams" OR subject:"nsdl" OR subject:"cdsl")`;
        // Filename-based: catches forwarded/personal emails where the PDF filename itself is CAS-related
        const filenameQ = `has:attachment ${dateQuery} -from:noreply@accounts.google.com (filename:CAS OR filename:consolidated OR filename:statement OR filename:portfolio OR filename:CAMS OR filename:kfintech OR filename:nsdl OR filename:cdsl)`;
        // Fallback: recent inbox emails with CAS subject keywords
        const fallbackQ = `has:attachment ${fallbackDateQuery} (subject:"consolidated account" OR subject:"account statement" OR subject:CAS OR subject:"mutual fund" OR subject:"kfintech" OR subject:"cams" OR subject:"nsdl" OR subject:"cdsl")`;
        // Super-broad (latestOnly only): ANY PDF from last 6 hours — catches personal/forwarded emails with no keywords
        const superBroadQ = `has:attachment (filename:.pdf OR filename:pdf) ${last6hQuery} -from:noreply@accounts.google.com -from:no-reply`;

        console.log(`[Gmail] officialQ:  ${officialQ}`);
        console.log(`[Gmail] broadQ:     ${broadQ}`);
        console.log(`[Gmail] filenameQ:  ${filenameQ}`);
        console.log(`[Gmail] fallbackQ:  ${fallbackQ}`);
        if (latestOnly) console.log(`[Gmail] superBroadQ: ${superBroadQ}`);

        const queryPromises: Promise<any>[] = [
          gmail.users.messages.list({ userId: "me", q: officialQ,  maxResults: 20 }),
          gmail.users.messages.list({ userId: "me", q: broadQ,     maxResults: 20 }),
          gmail.users.messages.list({ userId: "me", q: filenameQ,  maxResults: 20 }),
          gmail.users.messages.list({ userId: "me", q: fallbackQ,  maxResults: 30 }),
        ];
        if (latestOnly) {
          queryPromises.push(gmail.users.messages.list({ userId: "me", q: superBroadQ, maxResults: 10 }));
        }

        const [officialRes, broadRes, filenameRes, fallbackRes, superBroadRes] = await Promise.all(queryPromises);

        console.log(`[Gmail] official hits: ${officialRes.data.messages?.length ?? 0}, broad hits: ${broadRes.data.messages?.length ?? 0}, filename hits: ${filenameRes.data.messages?.length ?? 0}, fallback hits: ${fallbackRes.data.messages?.length ?? 0}${latestOnly ? `, superBroad hits: ${superBroadRes?.data.messages?.length ?? 0}` : ""}`);

        const seen = new Set<string>();
        messages = [];
        const allMsgSources = [
          ...(officialRes.data.messages || []),
          ...(broadRes.data.messages  || []),
          ...(filenameRes.data.messages || []),
          ...(fallbackRes.data.messages || []),
          ...(latestOnly && superBroadRes ? (superBroadRes.data.messages || []) : []),
        ];
        for (const msg of allMsgSources) {
          if (msg.id && !seen.has(msg.id)) { seen.add(msg.id); messages.push(msg); }
        }
      }

      console.log(`[Gmail] Checking ${conn.userEmail} — found ${messages.length} potential emails to inspect`);

      // For latestOnly (Check Now), fetch internalDate for all candidates and pick the absolute newest
      if (latestOnly && messages.length > 0) {
        if (messages.length === 1) {
          console.log(`[Gmail] latestOnly=true — only 1 candidate email found`);
        } else {
          // Fetch internalDate for all candidates to find the truly newest email
          const withDates = await Promise.all(
            messages.map(async (msg) => {
              try {
                const meta = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "metadata", metadataHeaders: ["Date"] });
                return { msg, internalDate: parseInt(meta.data.internalDate || "0", 10) };
              } catch {
                return { msg, internalDate: 0 };
              }
            })
          );
          withDates.sort((a, b) => b.internalDate - a.internalDate);
          messages = [withDates[0].msg];
          const newestDate = new Date(withDates[0].internalDate);
          console.log(`[Gmail] latestOnly=true — picking newest of ${withDates.length} candidates: ${newestDate.toISOString()}`);
        }
      }

      let pdfCount = 0;
      let dailyLimitReached = false;
      const reportIds: number[] = [];

      messageLoop: for (const msg of messages) {
        try {
          const fullMsg = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" });
          const payload = fullMsg.data.payload;
          if (!payload) continue;

          // Collect parts from both top-level and nested structures
          const allParts: MsgPart[] = [];
          if (payload.parts) allParts.push(...payload.parts);
          // Also handle single-part messages
          if (payload.mimeType === "application/pdf" && payload.body?.attachmentId) {
            allParts.push(payload as MsgPart);
          }

          const pdfParts = collectPdfParts(allParts);
          console.log(`[Gmail] Message ${msg.id}: found ${pdfParts.length} PDF part(s) — filenames: [${pdfParts.map(p => p.filename || "(unnamed)").join(", ")}]`);

          for (const part of pdfParts) {
            if (!part.body?.attachmentId) continue;

            // Pre-filter: skip obvious non-CAS files before wasting an API call to download them
            // In latestOnly mode we relax this filter to accept any PDF from the user's inbox
            const preFilterName = (part.filename || "").trim();
            if (preFilterName && !latestOnly && !looksLikeCasPdf(preFilterName)) {
              console.log(`[Gmail] ⏭️  Pre-filter skip: "${preFilterName}" (filename has no PAN/CAS pattern)`);
              continue;
            }

            const filename = part.filename || `cas-${Date.now()}.pdf`;

            // Skip if already imported — BUT always re-analyze when latestOnly=true (Check Now)
            // so the user always gets fresh, correctly-parsed data on Check Now
            if (!latestOnly) {
              const existingReport = await storage.getReportByFilename(filename);
              if (existingReport) {
                console.log(`[Gmail] ⏭️  Already imported: "${filename}" (reportId=${existingReport.id}) — skipping re-analysis`);
                reportIds.push(existingReport.id);
                pdfCount++;
                continue;
              }
            } else {
              console.log(`[Gmail] latestOnly=true — re-analyzing "${filename}" even if previously imported`);
            }

            const att = await gmail.users.messages.attachments.get({
              userId: "me", messageId: msg.id!, id: part.body.attachmentId,
            });
            const data = att.data.data;
            if (!data) continue;

            const pdfBuffer = Buffer.from(data, "base64url");

            // Build list of passwords to try:
            // 1. User's stored password, 2. PAN extracted from filename, 3. empty string
            const passwords: string[] = [];
            if (conn.casPassword) passwords.push(conn.casPassword);
            // Extract PAN-like patterns from filename: e.g. "(AGNPA6149B)" or "AGNPA6149B"
            const panMatches = filename.match(/\(([A-Z]{5}[0-9]{4}[A-Z])\)/g) || filename.match(/([A-Z]{5}[0-9]{4}[A-Z])/g);
            if (panMatches) {
              for (const m of panMatches) {
                const pan = m.replace(/[()]/g, "");
                if (!passwords.includes(pan)) passwords.push(pan);
              }
            }
            if (!passwords.includes("")) passwords.push("");

            pdfCount++;
            console.log(`[Gmail] Processing PDF: ${filename} (trying ${passwords.length} password(s))`);
            let analyzed = false;
            for (const pwd of passwords) {
              try {
                const reportId = await analyzeCasPdfBuffer(pdfBuffer, filename, pwd, conn.userEmail);
                console.log(`[Gmail] ✅ Successfully analyzed ${filename} with password hint: ${pwd ? pwd.slice(0, 3) + "***" : "(empty)"}`);
                reportIds.push(reportId);
                analyzed = true;
                break;
              } catch (e: any) {
                if (e.message === "DAILY_LIMIT_REACHED") {
                  dailyLimitReached = true;
                  break;
                }
                if (e.message === "NOT_CAS_PDF") {
                  break; // skip this PDF silently — not a CAS statement
                }
                if (e.message === "PDF_PASSWORD_WRONG" || e.message === "PDF_EMPTY") {
                  console.log(`[Gmail] Password attempt failed for ${filename}, trying next...`);
                  continue;
                }
                console.error(`[Gmail] Non-password error analyzing ${filename}:`, e.message);
                break;
              }
            }
            if (dailyLimitReached) break messageLoop; // stop processing all further emails
            if (!analyzed) {
              console.error(`[Gmail] ❌ Could not decrypt ${filename} — all passwords failed`);
            }
          }
        } catch (e: any) {
          console.error(`[Gmail] Error processing message ${msg.id}:`, e.message);
        }
      }
      if (dailyLimitReached) {
        console.log(`[Gmail] ⛔ Daily limit of ${DAILY_UPLOAD_LIMIT} reached for ${conn.userEmail} — stopping Gmail import`);
      }

      await storage.updateGmailLastChecked(conn.userEmail);
      console.log(`[Gmail] Done checking ${conn.userEmail} — fetched ${pdfCount} PDF(s), reportIds: [${reportIds.join(",")}]`);
      return { pdfCount, reportIds };
    } catch (e: any) {
      console.error(`[Gmail] Error polling account ${conn.userEmail}:`, e.message);
      return { pdfCount: 0, reportIds: [] };
    }
  }

  // Poll all connected accounts
  async function pollAllGmailAccounts() {
    const conns = await storage.getAllGmailConnections();
    console.log(`[Gmail] Polling ${conns.length} connected accounts...`);
    for (const conn of conns) {
      await pollGmailAccount(conn as any);
    }
  }

  // Run poll every 30 minutes
  const POLL_INTERVAL_MS = 30 * 60 * 1000;
  setInterval(pollAllGmailAccounts, POLL_INTERVAL_MS);
  // Run once after 10 seconds on startup
  setTimeout(pollAllGmailAccounts, 10_000);

  // ── OAuth: start Gmail connect flow
  // Debug endpoint — returns the exact redirect URI being used
  app.get("/auth/gmail/debug-redirect", (req, res) => {
    res.json({ redirect_uri: GMAIL_REDIRECT_URI });
  });

  app.get("/auth/gmail", (req, res) => {
    const userEmail = req.query.email as string;
    const casPassword = req.query.password as string || "";
    if (!userEmail) return res.status(400).send("Missing email param");
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) return res.status(500).send("Gmail OAuth not configured");

    console.log(`[Gmail] OAuth flow started — redirect_uri: ${GMAIL_REDIRECT_URI}`);

    const oauth2 = makeOAuth2Client();
    const state = Buffer.from(JSON.stringify({ email: userEmail, password: casPassword })).toString("base64");
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/gmail.readonly"],
      state,
    });
    res.redirect(url);
  });

  // ── OAuth: callback after user grants permission
  app.get("/auth/gmail/callback", async (req, res) => {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;
    if (!code || !stateRaw) return res.redirect("/home?gmail=error");

    try {
      const { email, password } = JSON.parse(Buffer.from(stateRaw, "base64").toString("utf-8"));
      const oauth2 = makeOAuth2Client();
      const { tokens } = await oauth2.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        return res.redirect("/home?gmail=error&reason=no_tokens");
      }

      await storage.upsertGmailConnection({
        userEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
        casPassword: password || null,
        lastCheckedAt: null,
      });

      console.log(`[Gmail] Connected account: ${email}`);

      // Immediately trigger a check for this user
      const conn = await storage.getGmailConnection(email);
      if (conn) pollGmailAccount(conn as any).catch(() => {});

      res.redirect("/home?gmail=connected");
    } catch (e: any) {
      console.error("[Gmail] Callback error:", e.message);
      res.redirect("/home?gmail=error");
    }
  });

  // ── Gmail status for a user
  app.get("/api/gmail/status", async (req, res) => {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: "Missing email" });
    const conn = await storage.getGmailConnection(email);
    if (!conn) return res.json({ connected: false });
    res.json({ connected: true, lastCheckedAt: conn.lastCheckedAt, createdAt: conn.createdAt });
  });

  // ── Disconnect Gmail
  app.delete("/api/gmail/disconnect", async (req, res) => {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: "Missing email" });
    await storage.deleteGmailConnection(email);
    res.json({ ok: true });
  });

  // ── Manual trigger check
  app.post("/api/gmail/check", async (req, res) => {
    const email = req.query.email as string;
    const fullScan = req.query.fullScan === "true";
    const latestOnly = req.query.latestOnly === "true";
    if (!email) return res.status(400).json({ error: "Missing email" });
    const conn = await storage.getGmailConnection(email);
    if (!conn) return res.status(404).json({ error: "Gmail not connected" });
    const result = await pollGmailAccount(conn as any, fullScan, latestOnly);
    res.json({ ok: true, pdfCount: result.pdfCount, fullScan, reportIds: result.reportIds });
  });

  // ── Scan Gmail inbox for a date range (returns PDF metadata — no import) ─────
  app.post("/api/gmail/scan-range", async (req, res) => {
    const { email, fromDate, toDate } = req.body as { email: string; fromDate: string; toDate: string };
    if (!email || !fromDate || !toDate) return res.status(400).json({ error: "Missing email, fromDate, or toDate" });

    const conn = await storage.getGmailConnection(email);
    if (!conn) return res.status(404).json({ error: "Gmail not connected" });

    try {
      const gmail = await getGmailClient(conn as any);

      const fromUnix = Math.floor(new Date(fromDate).getTime() / 1000);
      // toDate: end of that day
      const toUnix = Math.floor(new Date(toDate).getTime() / 1000) + 86400;
      const dateFilter = `after:${fromUnix} before:${toUnix}`;

      const senderQuery = CAS_SENDERS.map(s => `from:${s}`).join(" OR ");
      const officialQ = `(${senderQuery}) has:attachment (filename:.pdf OR filename:pdf) ${dateFilter}`;
      const subjectQ = `has:attachment (filename:.pdf OR filename:pdf) ${dateFilter} -from:noreply@accounts.google.com (subject:"consolidated account" OR subject:"account statement" OR subject:CAS OR subject:"mutual fund" OR subject:"kfintech" OR subject:"cams" OR subject:"nsdl" OR subject:"cdsl")`;
      const filenameQ = `has:attachment ${dateFilter} -from:noreply@accounts.google.com (filename:CAS OR filename:consolidated OR filename:statement OR filename:portfolio OR filename:CAMS OR filename:kfintech OR filename:nsdl OR filename:cdsl)`;

      console.log(`[Gmail] scan-range: from=${fromDate} to=${toDate} for ${email}`);

      const [officialMsgs, subjectMsgs, filenameMsgs] = await Promise.all([
        fetchAllMessageIds(gmail, officialQ, 200),
        fetchAllMessageIds(gmail, subjectQ, 200),
        fetchAllMessageIds(gmail, filenameQ, 200),
      ]);

      const seen = new Set<string>();
      const allMsgs: { id?: string | null }[] = [];
      for (const msg of [...officialMsgs, ...subjectMsgs, ...filenameMsgs]) {
        if (msg.id && !seen.has(msg.id)) { seen.add(msg.id); allMsgs.push(msg); }
      }

      console.log(`[Gmail] scan-range: found ${allMsgs.length} candidate messages`);

      // For each message, get metadata + PDF parts (no body download)
      const pdfs: { messageId: string; attachmentId: string; filename: string; emailDate: string; from: string; subject: string }[] = [];
      const pdfSeen = new Set<string>();

      await Promise.all(allMsgs.map(async (msg) => {
        try {
          const fullMsg = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" });
          const payload = fullMsg.data.payload;
          if (!payload) return;

          // Extract headers
          const headers = payload.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
          const from = getHeader("From");
          const subject = getHeader("Subject");
          const internalDate = parseInt(fullMsg.data.internalDate || "0", 10);
          const emailDate = internalDate ? new Date(internalDate).toISOString() : "";

          const allParts: MsgPart[] = [];
          if (payload.parts) allParts.push(...(payload.parts as MsgPart[]));
          if (payload.mimeType === "application/pdf" && (payload as any).body?.attachmentId) allParts.push(payload as MsgPart);

          const pdfParts = collectPdfParts(allParts);
          for (const part of pdfParts) {
            if (!part.body?.attachmentId) continue;
            const filename = (part.filename || `cas-${msg.id}.pdf`).trim();
            const key = `${msg.id!}::${part.body.attachmentId}`;
            if (pdfSeen.has(key)) continue;
            pdfSeen.add(key);
            pdfs.push({ messageId: msg.id!, attachmentId: part.body.attachmentId, filename, emailDate, from, subject });
          }
        } catch (e: any) {
          console.error(`[Gmail] scan-range error on message ${msg.id}:`, e.message);
        }
      }));

      // Sort by emailDate descending (newest first)
      pdfs.sort((a, b) => new Date(b.emailDate).getTime() - new Date(a.emailDate).getTime());

      console.log(`[Gmail] scan-range: found ${pdfs.length} PDFs in date range`);
      res.json({ ok: true, pdfs, fromDate, toDate });
    } catch (e: any) {
      console.error(`[Gmail] scan-range error:`, e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Import a specific Gmail attachment by messageId + attachmentId ─────────
  app.post("/api/gmail/import-attachment", async (req, res) => {
    const { email, messageId, attachmentId, filename } = req.body as { email: string; messageId: string; attachmentId: string; filename: string };
    if (!email || !messageId || !attachmentId) return res.status(400).json({ error: "Missing required fields" });

    const conn = await storage.getGmailConnection(email);
    if (!conn) return res.status(404).json({ error: "Gmail not connected" });

    try {
      const gmail = await getGmailClient(conn as any);

      const att = await gmail.users.messages.attachments.get({ userId: "me", messageId, id: attachmentId });
      const data = att.data.data;
      if (!data) return res.status(400).json({ error: "Could not download attachment" });

      const pdfBuffer = Buffer.from(data, "base64url");
      const safeFilename = (filename || `cas-import-${Date.now()}.pdf`).trim();

      // Build password list
      const passwords: string[] = [];
      if (conn.casPassword) passwords.push(conn.casPassword);
      const panMatches = safeFilename.match(/\(([A-Z]{5}[0-9]{4}[A-Z])\)/g) || safeFilename.match(/([A-Z]{5}[0-9]{4}[A-Z])/g);
      if (panMatches) {
        for (const m of panMatches) {
          const pan = m.replace(/[()]/g, "");
          if (!passwords.includes(pan)) passwords.push(pan);
        }
      }
      if (!passwords.includes("")) passwords.push("");

      let reportId: number | null = null;
      let lastError = "";
      for (const pwd of passwords) {
        try {
          reportId = await analyzeCasPdfBuffer(pdfBuffer, safeFilename, pwd, email);
          console.log(`[Gmail] import-attachment ✅ imported ${safeFilename} (reportId=${reportId})`);
          break;
        } catch (e: any) {
          lastError = e.message;
          if (e.message === "NOT_CAS_PDF" || e.message === "DAILY_LIMIT_REACHED") break;
        }
      }

      if (reportId === null) {
        return res.status(422).json({ error: lastError || "Could not analyze PDF" });
      }

      res.json({ ok: true, reportId });
    } catch (e: any) {
      console.error(`[Gmail] import-attachment error:`, e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────

  return httpServer;
}
