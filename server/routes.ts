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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "");

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
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

    try {
      // Direct approach: Moneycontrol URLs are often predictable if we have the ISIN
      // but they don't use ISIN in the URL directly. They use a scheme code.
      // So we still need to search. Let's use a more robust search and handle failures.
      
      const searchUrl = `https://www.google.com/search?q=site%3Amoneycontrol.com+%22${isin}%22+performance`;
      const curlCommand = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36" "${searchUrl}"`;
      
      console.log(`Searching for performance: ${isin}`);
      let mcUrl = "";
      try {
        const { stdout: searchResult } = await execAsync(curlCommand);
        // Fallback search if the first one fails or returns nothing useful
        if (!searchResult || searchResult.includes("did not match any documents")) {
           console.log(`Initial Google search for ${isin} returned no results.`);
           throw new Error("No results");
        }
        
        const $search = cheerio.load(searchResult);
        
        $search('a').each((_, el) => {
          const href = $search(el).attr('href');
          if (href) {
            const match = href.match(/\/url\?q=(https?:\/\/[^&]+)/);
            const candidateUrl = match ? decodeURIComponent(match[1]) : href;
            
            if (candidateUrl.includes('moneycontrol.com/mutual-funds/') && !candidateUrl.includes('google.com')) {
              mcUrl = candidateUrl;
              return false;
            }
          }
        });
      } catch (searchError) {
        console.log(`Initial search failed for ${isin}, trying direct ISIN search.`);
        const directUrl = `https://www.google.com/search?q=moneycontrol+mutual+fund+${isin}+nav`;
        const { stdout: directResult } = await execAsync(`curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" "${directUrl}"`);
        const $direct = cheerio.load(directResult);
        $direct('a').each((_, el) => {
          const href = $direct(el).attr('href');
          if (href) {
            const match = href.match(/\/url\?q=(https?:\/\/[^&]+)/);
            const candidateUrl = match ? decodeURIComponent(match[1]) : href;
            if (candidateUrl.includes('moneycontrol.com/mutual-funds/') && !candidateUrl.includes('google.com')) {
              mcUrl = candidateUrl;
              return false;
            }
          }
        });
      }

      // Final fallback: try searching by fund name if we have it
      if (!mcUrl) {
        const reportId = req.query.reportId;
        if (reportId) {
          const report = await storage.getReport(Number(reportId));
          const snapshot = (report?.analysis as any)?.mf_snapshot || [];
          const fund = snapshot.find((f: any) => f.isin === isin);
          if (fund?.scheme_name) {
            console.log(`Trying name-based search for: ${fund.scheme_name}`);
            // Clean fund name: remove common suffixes and terms
            const cleanName = fund.scheme_name
              .replace(/-(?:\s+)?Regular(?:\s+)?Scheme/i, "")
              .replace(/-(?:\s+)?Regular(?:\s+)?Plan/i, "")
              .replace(/-(?:\s+)?Direct(?:\s+)?Plan/i, "")
              .replace(/-(?:\s+)?Growth/i, "")
              .replace(/\(Formerly.*?\)/i, "")
              .replace(/Mutual Fund/i, "")
              .replace(/Plan/i, "")
              .replace(/Scheme/i, "")
              .trim();
              
            const nameSearchUrl = `https://www.google.com/search?q=site%3Amoneycontrol.com+${encodeURIComponent(cleanName)}+mutual+fund+nav`;
            console.log(`Searching with name: ${cleanName}`);
            const { stdout: nameResult } = await execAsync(`curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" "${nameSearchUrl}"`);
            const $name = cheerio.load(nameResult);
            $name('a').each((_, el) => {
              const href = $name(el).attr('href');
              if (href) {
                const match = href.match(/\/url\?q=(https?:\/\/[^&]+)/);
                const candidateUrl = match ? decodeURIComponent(match[1]) : href;
                if (candidateUrl.includes('moneycontrol.com/mutual-funds/') && !candidateUrl.includes('google.com')) {
                  mcUrl = candidateUrl;
                  return false;
                }
              }
            });
          }
        }
      }

      if (!mcUrl) {
        // Last-ditch: simpler search on Bing as a backup search engine
        console.log(`Trying last-ditch search for ${isin} on Bing`);
        const finalUrl = `https://www.bing.com/search?q=moneycontrol+mutual+fund+${isin}`;
        const { stdout: finalResult } = await execAsync(`curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" "${finalUrl}"`);
        const $final = cheerio.load(finalResult);
        $final('a').each((_, el) => {
          const href = $final(el).attr('href');
          if (href && href.includes('moneycontrol.com/mutual-funds/')) {
            mcUrl = href;
            return false;
          }
        });
      }

      if (!mcUrl) {
        return res.status(404).json({ message: `Could not find performance page for fund ${isin}.` });
      }

      console.log(`Fetching performance from: ${mcUrl}`);
      const { stdout: mcPage } = await execAsync(`curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" "${mcUrl}"`);
      const $ = cheerio.load(mcPage);

      const performance: any = {
        cagr: { "1y": "N/A", "3y": "N/A", "5y": "N/A" },
        risk_ratios: { "std_dev": "N/A", "sharpe": "N/A", "beta": "N/A", "alpha": "N/A" }
      };

      // Moneycontrol performance table structure analysis
      // They often use "mctable1" or just "table" with specific text headers
      $('table tr').each((_, el) => {
        const row = $(el);
        const text = row.text().toLowerCase();
        const cells = row.find('td');
        
        if (cells.length >= 2) {
          const value = cells.last().text().trim();
          
          // CAGR checks
          if (text.includes("1-year") || text.includes("1 year")) performance.cagr["1y"] = value;
          else if (text.includes("3-year") || text.includes("3 year")) performance.cagr["3y"] = value;
          else if (text.includes("5-year") || text.includes("5 year")) performance.cagr["5y"] = value;
          
          // Risk ratio checks
          if (text.includes("std dev") || text.includes("standard deviation")) performance.risk_ratios["std_dev"] = value;
          else if (text.includes("sharpe")) performance.risk_ratios["sharpe"] = value;
          else if (text.includes("beta")) performance.risk_ratios["beta"] = value;
          else if (text.includes("alpha")) performance.risk_ratios["alpha"] = value;
        }
      });

      // Secondary check for headers if table rows didn't match perfectly
      if (performance.cagr["1y"] === "N/A") {
        $('.perf_table, .mctable1').find('tr').each((_, el) => {
           const row = $(el);
           const cells = row.find('td, th');
           if (cells.length >= 2) {
             const key = cells.eq(0).text().toLowerCase();
             const val = cells.last().text().trim();
             if (key.includes('1 year') || key.includes('1y')) performance.cagr["1y"] = val;
             if (key.includes('3 year') || key.includes('3y')) performance.cagr["3y"] = val;
             if (key.includes('5 year') || key.includes('5y')) performance.cagr["5y"] = val;
           }
        });
      }

      res.json(performance);
    } catch (error: any) {
      console.error("Scraping error:", error);
      res.status(500).json({ message: "Performance data currently unavailable" });
    }
  });

  return httpServer;
}
