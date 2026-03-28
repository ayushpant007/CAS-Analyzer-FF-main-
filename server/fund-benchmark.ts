import fs from "fs/promises";
import path from "path";

const BENCHMARK_BASE = path.join(process.cwd(), "FundVsBenchmark)(sinceinception)");

let isinBenchmarkMap: Map<string, string> | null = null;
const benchmarkDataCache = new Map<string, Map<string, number>>();

// ── CSV helpers ──────────────────────────────────────────────────────────────

/** Parse a single CSV line (no embedded newlines) */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parse full CSV content that may have newlines inside quoted fields → array of row arrays */
function parseCSVFull(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      // Handle escaped double quotes
      if (inQ && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      // Skip \r in \r\n pairs
      if (ch === '\r' && content[i + 1] === '\n') continue;
      row.push(cell.trim());
      cell = "";
      if (row.some(c => c.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  // Flush last cell/row
  row.push(cell.trim());
  if (row.some(c => c.length > 0)) rows.push(row);
  return rows;
}

function parsePrice(val: string): number {
  if (!val || val === "-") return 0;
  return parseFloat(val.replace(/[",]/g, "")) || 0;
}

/** Normalise various date strings → YYYY-MM-DD */
function normalizeDate(raw: string): string {
  if (!raw) return "";
  raw = raw.trim();

  // DD-MM-YYYY or DD/MM/YYYY
  const m1 = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD-Mon-YYYY  (e.g. 24-Mar-2025 or 24-Mar-25)
  const m2 = raw.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
  if (m2) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    let [, d, mon, y] = m2;
    if (y.length === 2) y = "20" + y;
    const mo = months[mon.toLowerCase()] || "01";
    return `${y}-${mo}-${d.padStart(2, "0")}`;
  }

  // DD Mon YYYY  (e.g. "20 Mar 2025" – hybrid benchmark format)
  const m3 = raw.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  if (m3) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const [, d, mon, y] = m3;
    const mo = months[mon.toLowerCase()] || "01";
    return `${y}-${mo}-${d.padStart(2, "0")}`;
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  return raw;
}

// ── Category-based fallback benchmarks ──────────────────────────────────────

const CATEGORY_BENCHMARK: Record<string, string> = {
  // Equity — by fund_type
  "elss":                 "Nifty 500 TR INR",
  "elss (tax saver)":    "Nifty 500 TR INR",
  "large cap":            "Nifty 100 TR INR",
  "large cap fund":       "Nifty 100 TR INR",
  "mid cap":              "Nifty Midcap 150 TR INR",
  "mid cap fund":         "Nifty Midcap 150 TR INR",
  "small cap":            "BSE 250 SmallCap TR INR",
  "small cap fund":       "BSE 250 SmallCap TR INR",
  "large & mid cap":      "Nifty 500 TR INR",
  "large and mid cap":    "Nifty 500 TR INR",
  "flexi cap":            "Nifty 500 TR INR",
  "flexi-cap":            "Nifty 500 TR INR",
  "multi cap":            "Nifty 500 Multicap 50-25-25 TR INR",
  "value/contra":         "Nifty 500 TR INR",
  "value / contra":       "Nifty 500 TR INR",
  "focused":              "Nifty 100 TR INR",
  "bluechip":             "Nifty 100 TR INR",
  "blue chip":            "Nifty 100 TR INR",
  // Debt — by fund_type
  "low duration":         "Nifty Composite Debt TR INR",
  "short duration":       "Nifty Composite Debt TR INR",
  "medium duration":      "Nifty Composite Debt TR INR",
  "long duration":        "Nifty Composite Debt TR INR",
  "savings":              "Nifty Composite Debt TR INR",
  "liquid":               "Nifty Composite Debt TR INR",
  "overnight":            "Nifty Composite Debt TR INR",
  "money market":         "Nifty Composite Debt TR INR",
  "ultra short duration": "Nifty Composite Debt TR INR",
  "floater":              "Nifty Composite Debt TR INR",
  "banking and psu":      "Nifty Composite Debt TR INR",
  "corporate bond":       "Nifty Composite Debt TR INR",
  "credit risk":          "Nifty Composite Debt TR INR",
  "gilt":                 "Nifty Composite Debt TR INR",
};

function categoryFallbackBenchmark(fundType: string, fundCategory: string): string | null {
  const key = (fundType || "").toLowerCase().trim();
  const cat = (fundCategory || "").toLowerCase().trim();
  return CATEGORY_BENCHMARK[key] || CATEGORY_BENCHMARK[cat] || null;
}

// ── Load ISIN → Benchmark name map ──────────────────────────────────────────

async function loadIsinBenchmarkMap(): Promise<Map<string, string>> {
  if (isinBenchmarkMap) return isinBenchmarkMap;

  const map = new Map<string, string>();
  const dir = path.join(BENCHMARK_BASE, "Right benchmark for right categories");

  const specs = [
    { file: "Copy of All Funds(Ayush) - Equity.csv",       isinCol: 12, bmCol: 3 },
    { file: "Copy of All Funds(Ayush) - Debt Funds.csv",   isinCol: 10, bmCol: 4 },
    { file: "Copy of All Funds(Ayush) - Hybrid Funds.csv", isinCol: 24, bmCol: 3 },
  ];

  for (const { file, isinCol, bmCol } of specs) {
    try {
      const content = await fs.readFile(path.join(dir, file), "utf-8");
      const rows = parseCSVFull(content).slice(1); // skip header row
      for (const cols of rows) {
        const isin = cols[isinCol]?.trim();
        const bm   = cols[bmCol]?.trim();
        if (isin && isin.startsWith("INF") && bm && bm !== "Not Available" && bm !== "Benchmark Name") {
          map.set(isin, bm);
        }
      }
    } catch (e) {
      console.error(`fund-benchmark: error loading ${file}:`, e);
    }
  }

  isinBenchmarkMap = map;
  return map;
}

// ── Find benchmark CSV file ──────────────────────────────────────────────────

type BmType = "equity" | "debt" | "hybrid";

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, " ").trim();

async function findBenchmarkFiles(
  benchmarkName: string
): Promise<Array<{ file: string; type: BmType }>> {
  const dirs: { dir: string; type: BmType }[] = [
    { dir: path.join(BENCHMARK_BASE, "Equity Benchmarks"),  type: "equity" },
    { dir: path.join(BENCHMARK_BASE, "Debt Benchmarks"),    type: "debt" },
    { dir: path.join(BENCHMARK_BASE, "Hybrid Benchmarks"),  type: "hybrid" },
  ];

  const normName = norm(benchmarkName);
  const results: Array<{ file: string; type: BmType }> = [];

  for (const { dir, type } of dirs) {
    try {
      const files = await fs.readdir(dir);
      const matched: string[] = [];

      // Exact match first
      for (const f of files) {
        if (!f.endsWith(".csv")) continue;
        if (norm(f.replace(/\.csv$/i, "")) === normName) matched.push(f);
      }
      // Partial match (if no exact)
      if (matched.length === 0) {
        for (const f of files) {
          if (!f.endsWith(".csv")) continue;
          const fNorm = norm(f.replace(/\.csv$/i, ""));
          // Require the search term to be at least 6 chars to avoid spurious matches
          if (normName.length >= 6 && (fNorm.includes(normName) || normName.includes(fNorm))) {
            matched.push(f);
          }
        }
      }

      if (matched.length > 0) {
        for (const f of matched) results.push({ file: path.join(dir, f), type });
        break; // stop at first directory with results
      }
    } catch { /* ignore missing dir */ }
  }

  return results;
}

// Convenience wrapper (returns single best file, first match)
async function findBenchmarkFile(benchmarkName: string): Promise<{ file: string; type: BmType } | null> {
  const all = await findBenchmarkFiles(benchmarkName);
  return all.length > 0 ? all[0] : null;
}

// ── Load benchmark price data ────────────────────────────────────────────────

function parsePriceRows(lines: string[], type: BmType, dateToPrice: Map<string, number>) {
  const header = parseCSVLine(lines[0]);

  if (type === "equity") {
    // "Date","Price","Open","High","Low","Vol.","Change %"
    const dateIdx  = header.findIndex(h => h.toLowerCase().includes("date"));
    const priceIdx = header.findIndex(h => h.toLowerCase() === "price");
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols  = parseCSVLine(line);
      const d     = normalizeDate(cols[dateIdx] || "");
      const price = parsePrice(cols[priceIdx] || "");
      if (d && price > 0) dateToPrice.set(d, price);
    }
  } else if (type === "debt") {
    // Index Name, Date(YYYY-MM-DD), Open, High, Low, Close
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols  = parseCSVLine(line);
      const d     = normalizeDate(cols[1] || "");
      const price = parsePrice(cols[5] || "");
      if (d && price > 0) dateToPrice.set(d, price);
    }
  } else {
    // Hybrid: "Index Name","Date (20 Mar 2025)","Open","High","Low","Close"
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols  = parseCSVLine(line);
      const d     = normalizeDate(cols[1] || "");
      const price = parsePrice(cols[5] || "");
      if (d && price > 0) dateToPrice.set(d, price);
    }
  }
}

async function loadBenchmarkData(benchmarkName: string): Promise<Map<string, number>> {
  if (benchmarkDataCache.has(benchmarkName)) {
    return benchmarkDataCache.get(benchmarkName)!;
  }

  const dateToPrice = new Map<string, number>();
  const foundFiles  = await findBenchmarkFiles(benchmarkName);

  if (foundFiles.length === 0) {
    console.warn(`fund-benchmark: no CSV for "${benchmarkName}"`);
    benchmarkDataCache.set(benchmarkName, dateToPrice);
    return dateToPrice;
  }

  for (const found of foundFiles) {
    try {
      const content = await fs.readFile(found.file, "utf-8");
      parsePriceRows(content.split("\n"), found.type, dateToPrice);
    } catch (e) {
      console.error(`fund-benchmark: error reading ${found.file}:`, e);
    }
  }

  benchmarkDataCache.set(benchmarkName, dateToPrice);
  return dateToPrice;
}

// ── Nearest price lookup ─────────────────────────────────────────────────────

function findClosestPrice(
  dateMap: Map<string, number>,
  target: string,
  dayRange = 7
): number | null {
  if (dateMap.has(target)) return dateMap.get(target)!;

  const tMs = new Date(target).getTime();
  if (isNaN(tMs)) return null;

  let best: { diff: number; price: number } | null = null;
  Array.from(dateMap.entries()).forEach(([d, price]) => {
    const diff = Math.abs(new Date(d).getTime() - tMs);
    if (diff <= dayRange * 86400000 && (!best || diff < best.diff)) {
      best = { diff, price };
    }
  });
  return best ? (best as any).price : null;
}

function latestEntry(dateMap: Map<string, number>): { date: string; price: number } | null {
  let best: { date: string; price: number } | null = null;
  Array.from(dateMap.entries()).forEach(([d, p]) => {
    if (!best || d > best.date) best = { date: d, price: p };
  });
  return best;
}

// ── Public result type ───────────────────────────────────────────────────────

export interface FundBenchmarkResult {
  scheme_name: string;
  isin: string;
  benchmark_name: string;
  total_invested: number;
  fund_current_value: number;
  benchmark_current_value: number;
  benchmark_found: boolean;
  benchmark_latest_date: string;
  transactions_count: number;
  excess_return: number; // fund value – benchmark value
}

// ── Main calculation ─────────────────────────────────────────────────────────

export async function calculateFundVsBenchmark(
  snapshot: Array<{ scheme_name: string; isin: string; invested_amount: number; valuation: number; fund_type?: string; fund_category?: string }>,
  transactions: Array<{ date: string; scheme_name: string; type: string; amount: number }>,
): Promise<FundBenchmarkResult[]> {
  const isinMap = await loadIsinBenchmarkMap();
  const results: FundBenchmarkResult[] = [];

  // Group BUY transactions (SIP + PURCHASE) by scheme name
  const byScheme: Record<string, Array<{ date: string; amount: number }>> = {};
  for (const tx of transactions) {
    const type = (tx.type || "").toUpperCase();
    if (!["SIP", "PURCHASE"].includes(type)) continue;
    if (!tx.scheme_name || !tx.amount) continue;
    (byScheme[tx.scheme_name] ??= []).push({ date: tx.date, amount: tx.amount });
  }

  for (const fund of snapshot) {
    // Look up benchmark: ISIN map first, then category fallback
    const benchmarkName = isinMap.get(fund.isin)
      || categoryFallbackBenchmark(fund.fund_type || "", fund.fund_category || "");

    if (!benchmarkName) {
      results.push({
        scheme_name: fund.scheme_name,
        isin: fund.isin,
        benchmark_name: "N/A",
        total_invested: fund.invested_amount || 0,
        fund_current_value: fund.valuation || 0,
        benchmark_current_value: 0,
        benchmark_found: false,
        benchmark_latest_date: "",
        transactions_count: 0,
        excess_return: 0,
      });
      continue;
    }

    const bmData    = await loadBenchmarkData(benchmarkName);
    const latestBm  = latestEntry(bmData);

    // Match transactions to this fund (exact or partial name match)
    let fundTxns = byScheme[fund.scheme_name] || [];
    if (fundTxns.length === 0) {
      const sl = fund.scheme_name.toLowerCase().slice(0, 20);
      for (const [name, txns] of Object.entries(byScheme)) {
        const nl = name.toLowerCase();
        if (nl.includes(sl) || sl.includes(nl.slice(0, 20))) {
          fundTxns = txns;
          break;
        }
      }
    }

    let bmUnits = 0;
    for (const tx of fundTxns) {
      const normDate = normalizeDate(tx.date);
      const bmPrice  = findClosestPrice(bmData, normDate);
      if (bmPrice && bmPrice > 0) {
        bmUnits += tx.amount / bmPrice;
      }
    }

    const bmCurrentValue = latestBm ? bmUnits * latestBm.price : 0;
    const fundVal        = fund.valuation || 0;
    const invested       = fund.invested_amount || 0;

    results.push({
      scheme_name: fund.scheme_name,
      isin: fund.isin,
      benchmark_name: benchmarkName,
      total_invested: invested,
      fund_current_value: fundVal,
      benchmark_current_value: bmCurrentValue,
      benchmark_found: bmData.size > 0,
      benchmark_latest_date: latestBm?.date || "",
      transactions_count: fundTxns.length,
      excess_return: fundVal - bmCurrentValue,
    });
  }

  return results;
}

/** Detect whether a PDF text body is from a CAMS CAS */
export function detectCasSource(text: string): "CAMS" | "NSDL" | "CDSL" | "UNKNOWN" {
  const t = text.toLowerCase();
  if (t.includes("cams") || t.includes("camsonline") || t.includes("kfintech")) return "CAMS";
  if (t.includes("nsdl"))  return "NSDL";
  if (t.includes("cdsl"))  return "CDSL";
  return "UNKNOWN";
}
