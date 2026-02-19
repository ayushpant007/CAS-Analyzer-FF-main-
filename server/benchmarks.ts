import fs from "fs/promises";
import path from "path";

const BENCHMARK_JSON = path.join(process.cwd(), "server/assets/benchmarks.json");

interface BenchmarkData {
  "1y": string;
  "3y": string;
  "5y": string;
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
  if (lower.includes("large cap")) return "Nifty 100 TRI";
  if (lower.includes("large & mid cap") || lower.includes("largemidcap")) return "Nifty LargeMidcap 250 TRI";
  if (lower.includes("flexi cap")) return "Nifty 500 TRI";
  if (lower.includes("multi cap")) return "Nifty 500 TRI";
  if (lower.includes("focused")) return "Nifty 500 TRI";
  if (lower.includes("value") || lower.includes("contra")) return "Nifty 500 TRI";
  if (lower.includes("elss") || lower.includes("tax saver")) return "Nifty 500 TRI";
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
      "5y": entry.returns["5Y"]
    };
  }

  return null;
}
