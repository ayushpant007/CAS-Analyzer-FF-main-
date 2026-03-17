import fs from "fs/promises";
import path from "path";

interface PriceEntry {
  date: Date;
  price: number;
}

interface SummaryEntry {
  benchmarkName: string;
  category: string;
  subCategory: string;
  source: string;
  status: string;
  dataRows: number;
}

export interface BenchmarkData {
  "1y": string;
  "3y": string;
  "5y": string;
  resolvedName?: string;
}

const ATTACHED_ASSETS = path.join(process.cwd(), "attached_assets");

const DATA_FILES = [
  "master_benchmark_returns_organized.xlsx_-_Equity_1773724210120.csv",
  "master_benchmark_returns_organized.xlsx_-_Debt_1773724225974.csv",
  "master_benchmark_returns_organized.xlsx_-_Hybrid_1773724236896.csv",
  "master_benchmark_returns_organized.xlsx_-_Solution_Oriented_1773724248286.csv",
  "master_benchmark_returns_organized.xlsx_-_Others_1773724262918.csv",
];

const SUMMARY_FILE =
  "master_benchmark_returns_organized.xlsx_-_Summary_(1)_1773724187734.csv";

// benchmark name → sorted price entries (newest first)
const benchmarkPrices = new Map<string, PriceEntry[]>();
// benchmark name → summary info
const summaryMap = new Map<string, SummaryEntry>();
// "Category|||SubCategory" → preferred benchmark name
const subCategoryMap = new Map<string, string>();

let dataLoaded = false;
let loadPromise: Promise<void> | null = null;

// ── CSV parsing helpers ──────────────────────────────────────────────────────

function parseDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

async function parseSummaryCSV(): Promise<void> {
  const content = await fs.readFile(path.join(ATTACHED_ASSETS, SUMMARY_FILE), "utf-8");
  const lines = content.split("\n");

  // For each sub-category, track the best benchmark (NSE India + OK + most rows)
  const subCatCandidates = new Map<string, SummaryEntry>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    if (cols.length < 6) continue;

    const entry: SummaryEntry = {
      benchmarkName: cols[0].trim(),
      category: cols[1].trim(),
      subCategory: cols[2].trim(),
      source: cols[3].trim(),
      status: cols[4].trim(),
      dataRows: parseInt(cols[5].trim(), 10) || 0,
    };

    summaryMap.set(entry.benchmarkName, entry);

    const key = `${entry.category}|||${entry.subCategory}`;
    const existing = subCatCandidates.get(key);

    if (!existing) {
      subCatCandidates.set(key, entry);
    } else {
      const existingOk = existing.status === "OK";
      const newOk = entry.status === "OK";
      const existingNSE = existing.source === "NSE India";
      const newNSE = entry.source === "NSE India";
      const newIsBetter =
        (!existingOk && newOk) ||
        (existingOk === newOk && !existingNSE && newNSE) ||
        (existingOk === newOk && existingNSE === newNSE && entry.dataRows > existing.dataRows);
      if (newIsBetter) subCatCandidates.set(key, entry);
    }
  }

  for (const [key, entry] of subCatCandidates) {
    subCategoryMap.set(key, entry.benchmarkName);
  }
}

async function parseDataCSV(filename: string): Promise<void> {
  const content = await fs.readFile(path.join(ATTACHED_ASSETS, filename), "utf-8");
  const lines = content.split("\n");
  const tempMap = new Map<string, PriceEntry[]>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    if (cols.length < 8) continue;

    const dateStr = cols[0].trim();
    const priceStr = cols[1].trim();
    const benchmarkName = cols[7].trim();

    if (!dateStr || !priceStr || !benchmarkName) continue;
    const date = parseDate(dateStr);
    const price = parseFloat(priceStr);
    if (!date || isNaN(price) || price <= 0) continue;

    if (!tempMap.has(benchmarkName)) tempMap.set(benchmarkName, []);
    tempMap.get(benchmarkName)!.push({ date, price });
  }

  for (const [name, entries] of tempMap) {
    entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    if (!benchmarkPrices.has(name)) {
      benchmarkPrices.set(name, entries);
    } else {
      const merged = [...benchmarkPrices.get(name)!, ...entries];
      merged.sort((a, b) => b.date.getTime() - a.date.getTime());
      benchmarkPrices.set(name, merged);
    }
  }
}

async function loadAllData(): Promise<void> {
  if (dataLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      await parseSummaryCSV();
      for (const file of DATA_FILES) {
        await parseDataCSV(file);
      }
      dataLoaded = true;
      console.log(
        `[Benchmarks] Loaded ${benchmarkPrices.size} benchmarks across ${subCategoryMap.size} sub-categories`
      );
    } catch (err) {
      console.error("[Benchmarks] Failed to load benchmark data:", err);
    }
  })();

  return loadPromise;
}

// ── CAGR calculation ─────────────────────────────────────────────────────────

/**
 * Compute CAGR between the latest data point and a point `yearsBack` years ago.
 * Returns "N/A" if sufficient historical data is not available (missing or
 * the closest matching date is more than 45 days away from the target).
 */
function computeCAGR(prices: PriceEntry[], yearsBack: number): string {
  if (!prices || prices.length === 0) return "N/A";

  const latestPrice = prices[0].price;
  const latestDate = prices[0].date;

  const targetDate = new Date(latestDate);
  targetDate.setFullYear(targetDate.getFullYear() - yearsBack);
  const targetTime = targetDate.getTime();

  const TOLERANCE_MS = 45 * 24 * 60 * 60 * 1000; // ±45 days

  let closestEntry: PriceEntry | null = null;
  let minDiff = Infinity;

  for (const entry of prices) {
    const diff = Math.abs(entry.date.getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestEntry = entry;
    }
    // Prices are sorted newest→oldest; once we overshoot by more than tolerance, stop
    if (entry.date.getTime() < targetTime - TOLERANCE_MS) break;
  }

  if (!closestEntry || minDiff > TOLERANCE_MS) return "N/A";

  const cagr = Math.pow(latestPrice / closestEntry.price, 1 / yearsBack) - 1;
  return `${(cagr * 100).toFixed(2)}%`;
}

// ── Name resolution ───────────────────────────────────────────────────────────

/** Try to find a matching key in benchmarkPrices for a given name. */
function resolveBenchmarkName(name: string): string | null {
  if (!name) return null;
  if (benchmarkPrices.has(name)) return name;

  const lower = name.toLowerCase().trim();
  for (const key of benchmarkPrices.keys()) {
    if (key.toLowerCase() === lower) return key;
  }

  const normalized = lower.replace(/[^a-z0-9]/g, "");
  for (const key of benchmarkPrices.keys()) {
    if (key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized) return key;
  }

  // Partial match (longer name contains shorter one)
  for (const key of benchmarkPrices.keys()) {
    const kl = key.toLowerCase();
    if (kl.includes(lower) || lower.includes(kl)) return key;
  }

  return null;
}

// ── Category / sub-category inference ────────────────────────────────────────

function inferSubCategory(schemeName: string): { category: string; subCategory: string } | null {
  const s = schemeName.toLowerCase();

  // ── Equity ──────────────────────────────────────────────────────────────────
  if (s.includes("small cap") || s.includes("smallcap"))
    return { category: "Equity", subCategory: "Small Cap" };
  if (
    s.includes("large & mid cap") ||
    s.includes("large and mid cap") ||
    s.includes("largemidcap") ||
    s.includes("large midcap") ||
    s.includes("large & midcap")
  )
    return { category: "Equity", subCategory: "Large & Mid Cap" };
  if (s.includes("mid cap") || s.includes("midcap"))
    return { category: "Equity", subCategory: "Mid Cap" };
  if (s.includes("large cap") || s.includes("largecap"))
    return { category: "Equity", subCategory: "Large Cap" };
  if (s.includes("multi cap") || s.includes("multicap"))
    return { category: "Equity", subCategory: "Multi Cap" };
  if (s.includes("flexi cap") || s.includes("flexicap"))
    return { category: "Equity", subCategory: "Flexi Cap / Diversified" };
  if (s.includes("focused fund") || s.includes("focused equity"))
    return { category: "Equity", subCategory: "Flexi Cap / Diversified" };
  if (s.includes("dividend yield"))
    return { category: "Equity", subCategory: "Dividend Yield" };
  if (s.includes("value fund") || s.includes("value -") || s.includes("contra"))
    return { category: "Equity", subCategory: "Value / Contra" };
  if (s.includes("elss") || s.includes("tax saver") || s.includes("tax saving"))
    return { category: "Equity", subCategory: "Flexi Cap / Diversified" };

  // Thematic / Factor
  if (s.includes("esg") || s.includes("sustainable"))
    return { category: "Equity", subCategory: "ESG / Sustainable" };
  if (s.includes("momentum"))
    return { category: "Equity", subCategory: "Factor – Momentum" };
  if (s.includes("alpha") || s.includes("low volatility") || s.includes("low vol"))
    return { category: "Equity", subCategory: "Factor – Low Volatility / Alpha" };
  if (s.includes("quality fund"))
    return { category: "Equity", subCategory: "Factor – Quality" };
  if (s.includes("psu") || s.includes("public sector unit"))
    return { category: "Equity", subCategory: "Thematic – PSU / Government" };
  if (s.includes("mnc"))
    return { category: "Equity", subCategory: "Thematic – MNC" };
  if (s.includes("realty") || s.includes("real estate"))
    return { category: "Equity", subCategory: "Sector – Real Estate" };
  if (s.includes("pharma") || s.includes("healthcare") || s.includes("health care"))
    return { category: "Equity", subCategory: "Sector – Pharma & Healthcare" };
  if (
    s.includes("technology") ||
    s.includes(" it ") ||
    s.includes("it fund") ||
    s.includes("infotech")
  )
    return { category: "Equity", subCategory: "Sector – Technology / IT" };
  if (s.includes("infrastructure") || s.includes("infra"))
    return { category: "Equity", subCategory: "Sector – Infrastructure" };
  if (s.includes("consumption") || s.includes("fmcg"))
    return { category: "Equity", subCategory: "Sector – Consumption / FMCG" };
  if (s.includes("energy") || s.includes("commodit"))
    return { category: "Equity", subCategory: "Sector – Energy & Commodities" };
  if (s.includes("banking") || s.includes("financial service") || s.includes("bank fund"))
    return { category: "Equity", subCategory: "Sector – Financial Services" };

  // ── Hybrid ───────────────────────────────────────────────────────────────────
  if (s.includes("aggressive hybrid"))
    return { category: "Hybrid", subCategory: "Aggressive Hybrid (65:35)" };
  if (
    s.includes("balanced advantage") ||
    s.includes("dynamic asset allocation") ||
    s.includes("dynamic aa")
  )
    return { category: "Hybrid", subCategory: "Aggressive Hybrid (65:35)" };
  if (s.includes("balanced hybrid"))
    return { category: "Hybrid", subCategory: "Balanced Hybrid (50:50)" };
  if (s.includes("conservative hybrid"))
    return { category: "Hybrid", subCategory: "Conservative Hybrid" };
  if (s.includes("multi asset"))
    return { category: "Hybrid", subCategory: "Multi Asset Allocation" };
  if (s.includes("equity savings"))
    return { category: "Hybrid", subCategory: "Equity Savings" };
  if (s.includes("hybrid"))
    return { category: "Hybrid", subCategory: "Aggressive Hybrid (65:35)" };

  // ── Debt ─────────────────────────────────────────────────────────────────────
  if (s.includes("overnight"))
    return { category: "Debt", subCategory: "Liquid / Overnight" };
  if (s.includes("liquid fund") || s.includes("liquid -"))
    return { category: "Debt", subCategory: "Liquid / Overnight" };
  if (s.includes("money market"))
    return { category: "Debt", subCategory: "Money Market" };
  if (s.includes("ultra short") || s.includes("ultra-short"))
    return { category: "Debt", subCategory: "Ultra Short Duration" };
  if (s.includes("low duration"))
    return { category: "Debt", subCategory: "Low Duration" };
  if (s.includes("floater"))
    return { category: "Debt", subCategory: "Low Duration" };
  if (s.includes("short duration"))
    return { category: "Debt", subCategory: "Short Duration" };
  if (s.includes("medium to long") || s.includes("medium-to-long"))
    return { category: "Debt", subCategory: "Medium to Long Duration" };
  if (s.includes("medium duration"))
    return { category: "Debt", subCategory: "Medium Duration" };
  if (s.includes("long duration"))
    return { category: "Debt", subCategory: "Long Duration" };
  if (s.includes("dynamic bond"))
    return { category: "Debt", subCategory: "Dynamic / Composite Bond" };
  if (s.includes("corporate bond"))
    return { category: "Debt", subCategory: "Corporate Bond" };
  if (
    s.includes("banking & psu") ||
    s.includes("banking and psu") ||
    s.includes("bank & psu")
  )
    return { category: "Debt", subCategory: "Banking & PSU Debt" };
  if (s.includes("credit risk"))
    return { category: "Debt", subCategory: "Credit Risk" };
  if (
    s.includes("gilt with 10") ||
    s.includes("10 year gilt") ||
    s.includes("10yr gilt")
  )
    return { category: "Debt", subCategory: "Gilt / G-Sec" };
  if (s.includes("gilt"))
    return { category: "Debt", subCategory: "Gilt / G-Sec" };
  if (s.includes("bond fund") || s.includes("income fund"))
    return { category: "Debt", subCategory: "Dynamic / Composite Bond" };

  // ── Solution Oriented ────────────────────────────────────────────────────────
  if (s.includes("children") || s.includes("child"))
    return { category: "Solution Oriented", subCategory: "Children's / Retirement – Equity" };
  if (s.includes("retirement"))
    return { category: "Solution Oriented", subCategory: "Children's / Retirement – Equity" };

  // ── Commodities & FoF ────────────────────────────────────────────────────────
  if (s.includes("gold"))
    return { category: "Commodities & FoF", subCategory: "Gold" };
  if (s.includes("silver"))
    return { category: "Commodities & FoF", subCategory: "Silver" };
  if (s.includes("arbitrage"))
    return { category: "Commodities & FoF", subCategory: "Arbitrage" };
  if (
    s.includes("international") ||
    s.includes("global") ||
    s.includes("overseas") ||
    s.includes("world fund")
  )
    return { category: "Commodities & FoF", subCategory: "International / Global FoF" };
  if (
    s.includes("index fund") ||
    s.includes("nifty 50 fund") ||
    s.includes("sensex fund")
  )
    return { category: "Commodities & FoF", subCategory: "Index Fund / ETF" };

  // Generic equity fallback
  if (s.includes("equity") || s.includes("growth fund") || s.includes("opportunities fund"))
    return { category: "Equity", subCategory: "Flexi Cap / Diversified" };

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns CAGR-based benchmark returns for a mutual fund.
 *
 * Priority:
 *  1. If reportedBenchmarkName resolves to a benchmark with price data → compute CAGR
 *  2. If reportedBenchmarkName is a CRISIL index (no public data) → N/A for all periods
 *  3. Fall back to sub-category mapping inferred from schemeName
 */
export async function getBenchmarkReturns(
  schemeName: string,
  reportedBenchmarkName?: string
): Promise<BenchmarkData | null> {
  await loadAllData();

  let resolvedName: string | null = null;

  // Step 1: try reported benchmark name
  if (
    reportedBenchmarkName &&
    reportedBenchmarkName.trim().length > 2 &&
    reportedBenchmarkName !== "Data unavailable"
  ) {
    resolvedName = resolveBenchmarkName(reportedBenchmarkName);

    // Not in price data — check if it's a known no-data benchmark (CRISIL etc.)
    if (!resolvedName) {
      const isCrisil = reportedBenchmarkName.toLowerCase().includes("crisil");
      const knownEntry = [...summaryMap.values()].find(
        (e) => e.benchmarkName.toLowerCase() === reportedBenchmarkName.toLowerCase().trim()
      );
      if (isCrisil || (knownEntry && knownEntry.status !== "OK")) {
        return {
          "1y": "N/A",
          "3y": "N/A",
          "5y": "N/A",
          resolvedName: reportedBenchmarkName.trim(),
        };
      }
    }
  }

  // Step 2: fallback via scheme name → sub-category → Summary CSV mapping
  if (!resolvedName) {
    const subCat = inferSubCategory(schemeName);
    if (subCat) {
      const key = `${subCat.category}|||${subCat.subCategory}`;
      const mappedName = subCategoryMap.get(key);
      if (mappedName) {
        resolvedName = resolveBenchmarkName(mappedName) ?? mappedName;
      }
    }
  }

  if (!resolvedName) return null;

  // Step 3: check availability in price data
  const summaryEntry = summaryMap.get(resolvedName);
  const prices = benchmarkPrices.get(resolvedName);

  // No data (CRISIL / computed benchmarks)
  if (!prices || prices.length === 0 || (summaryEntry && summaryEntry.status !== "OK")) {
    return { "1y": "N/A", "3y": "N/A", "5y": "N/A", resolvedName };
  }

  return {
    "1y": computeCAGR(prices, 1),
    "3y": computeCAGR(prices, 3),
    "5y": computeCAGR(prices, 5),
    resolvedName,
  };
}
