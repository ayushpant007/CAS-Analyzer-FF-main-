import fs from "fs/promises";
import path from "path";

const BENCHMARK_JSON = path.join(process.cwd(), "server/assets/benchmarks.json");

interface BenchmarkData {
  "1y": string;
  "3y": string;
  "5y": string;
  resolvedName?: string;
}

interface BenchmarkEntry {
  benchmark: string;
  returns: {
    "1Y": string;
    "3Y": string;
    "5Y": string;
  };
}

let benchmarkData: BenchmarkEntry[] = [];
let dataLoaded = false;

async function loadBenchmarks() {
  if (dataLoaded) return;
  try {
    const content = await fs.readFile(BENCHMARK_JSON, "utf-8");
    benchmarkData = JSON.parse(content);
    dataLoaded = true;
  } catch (error) {
    console.error("Error loading benchmark JSON:", error);
  }
}

function getCategoryBenchmark(schemeName: string): string | null {
  const lower = schemeName.toLowerCase();
  if (lower.includes("small cap")) return "Nifty Smallcap 250 TRI";
  if (lower.includes("mid cap")) return "Nifty Midcap 150 TRI";
  if (lower.includes("large & mid cap") || lower.includes("largemidcap")) return "Nifty LargeMidcap 250 TRI";
  if (lower.includes("large cap")) return "Nifty 100 TRI";
  if (lower.includes("multi cap") || lower.includes("multicap")) return "Nifty500 Multicap 50:25:25 TRI";
  if (lower.includes("flexi cap") || lower.includes("flexicap")) return "Nifty 500 TRI";
  if (lower.includes("focused")) return "Nifty 50 TRI";
  if (lower.includes("value") || lower.includes("contra")) return "Nifty 500 TRI";
  if (lower.includes("elss") || lower.includes("tax saver")) return "Nifty 500 TRI";
  if (lower.includes("dividend yield")) return "Nifty 500 TRI";
  if (lower.includes("aggressive hybrid")) return "Nifty 50 Hybrid Composite Debt 70:30 TRI";
  if (lower.includes("balanced hybrid")) return "Nifty 50 Hybrid Composite Debt 50:50 TRI";
  if (lower.includes("conservative hybrid")) return "Nifty 50 Hybrid Composite Debt 15:85 TRI";
  if (lower.includes("dynamic asset allocation") || lower.includes("balanced advantage")) return "Nifty 50 Hybrid Composite Debt 65:35 TRI";
  if (lower.includes("multi asset")) return "Nifty 50 Hybrid Composite Debt 65:35 TRI";
  if (lower.includes("arbitrage")) return "Nifty 50 Arbitrage Index";
  if (lower.includes("equity savings")) return "Nifty Equity Savings Index";
  if (lower.includes("overnight")) return "Nifty 1D Rate Index";
  if (lower.includes("liquid")) return "Nifty Ultra Short Duration G-Sec Index";
  if (lower.includes("money market")) return "Nifty Low Duration G-Sec Index";
  if (lower.includes("ultra short")) return "Nifty Ultra Short Duration G-Sec Index";
  if (lower.includes("low duration")) return "Nifty Low Duration G-Sec Index";
  if (lower.includes("short duration")) return "Nifty Short Duration G-Sec Index";
  if (lower.includes("medium to long") || lower.includes("med to long")) return "Nifty Med-Long Duration G-Sec Index";
  if (lower.includes("medium duration")) return "Nifty Medium Duration G-Sec Index";
  if (lower.includes("long duration")) return "Nifty Long Duration G-Sec Index";
  if (lower.includes("dynamic bond")) return "Nifty Med Duration G-Sec Index";
  if (lower.includes("corporate bond")) return "CRISIL Corporate Bond Fund Index";
  if (lower.includes("banking & psu") || lower.includes("banking and psu")) return "CRISIL Banking & PSU Debt Index";
  if (lower.includes("credit risk")) return "CRISIL Credit Risk Debt Index";
  if (lower.includes("floater")) return "Nifty Ultra Short G-Sec Index";
  if (lower.includes("gilt with 10") || lower.includes("10 yr") || lower.includes("10yr")) return "Nifty 10 Yr Benchmark G-Sec TRI";
  if (lower.includes("gilt")) return "Nifty Composite G-Sec Index";
  if (lower.includes("gold etf") || lower.includes("gold fof") || lower.includes("gold fund")) return "Domestic Gold Price (INR) - MCX Spot";
  if (lower.includes("silver etf") || lower.includes("silver fof") || lower.includes("silver fund")) return "Domestic Silver Price (INR) - MCX Spot";
  if (lower.includes("banking") || lower.includes("financial")) return "Nifty Financial Services TRI";
  if (lower.includes("it ") || lower.includes("technology")) return "Nifty IT TRI";
  if (lower.includes("pharma") || lower.includes("healthcare")) return "Nifty Pharma TRI";
  if (lower.includes("consumption")) return "Nifty India Consumption TRI";
  if (lower.includes("infrastructure")) return "Nifty Infrastructure TRI";
  if (lower.includes("energy")) return "Nifty Energy TRI";
  if (lower.includes("realty")) return "Nifty Realty TRI";
  if (lower.includes("auto")) return "Nifty Auto TRI";
  if (lower.includes("fmcg")) return "Nifty FMCG TRI";
  if (lower.includes("bank")) return "Nifty Bank TRI";

  return "Nifty 50 TRI";
}

export async function getBenchmarkReturns(schemeName: string, reportedBenchmarkName?: string): Promise<BenchmarkData | null> {
  await loadBenchmarks();
  
  let targetName = reportedBenchmarkName && reportedBenchmarkName !== "Data unavailable" 
    ? reportedBenchmarkName 
    : getCategoryBenchmark(schemeName);

  if (!targetName) return null;

  // Try exact match first
  let entry = benchmarkData.find(b => b.benchmark.toLowerCase() === targetName!.toLowerCase());

  // If no exact match, try fuzzy match
  if (!entry) {
    const normalizedTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, "");
    entry = benchmarkData.find(b => {
      const normalizedBenchmark = b.benchmark.toLowerCase().replace(/[^a-z0-9]/g, "");
      return normalizedBenchmark.includes(normalizedTarget) || normalizedTarget.includes(normalizedBenchmark);
    });
  }

  if (entry) {
    return {
      "1y": entry.returns["1Y"],
      "3y": entry.returns["3Y"],
      "5y": entry.returns["5Y"],
      resolvedName: entry.benchmark
    };
  }

  return null;
}
