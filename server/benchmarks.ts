import fs from "fs/promises";
import path from "path";
import { parse } from "date-fns";

const BENCHMARK_DIR = path.join(process.cwd(), "Benchmarks");
const MAPPING_FILE = path.join(process.cwd(), "attached_assets/Which_Benchmark_To_use_-_Which_Benchmark_To_use_1771491333227.csv");

interface BenchmarkData {
  "1y": string;
  "3y": string;
  "5y": string;
}

let benchmarkMapping: Record<string, string> = {};
let mappingLoaded = false;

async function loadMapping() {
  if (mappingLoaded) return;
  try {
    const content = await fs.readFile(MAPPING_FILE, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    for (const line of lines.slice(1)) {
      const parts = line.split(",");
      if (parts.length >= 6) {
        const schemeName = parts[3].trim().toLowerCase();
        const benchmark = parts[5].trim();
        benchmarkMapping[schemeName] = benchmark;
      }
    }
    mappingLoaded = true;
  } catch (error) {
    console.error("Error loading benchmark mapping:", error);
  }
}

function getCategoryBenchmark(schemeName: string): string | null {
  const lower = schemeName.toLowerCase();
  if (lower.includes("small cap")) return "NIFTY Smallcap 250 TRI";
  if (lower.includes("mid cap")) return "NIFTY Midcap 150 TRI";
  if (lower.includes("large cap")) return "Nifty 100 TRI";
  if (lower.includes("large & mid cap") || lower.includes("largemidcap")) return "NIFTY LargeMidcap 250 TRI";
  if (lower.includes("flexi cap")) return "NIFTY 500 TRI";
  if (lower.includes("multi cap")) return "NIFTY 500 Multicap 50:25:25 TRI";
  if (lower.includes("focused")) return "NIFTY 500 TRI";
  if (lower.includes("value") || lower.includes("contra")) return "NIFTY 500 TRI";
  if (lower.includes("elss") || lower.includes("tax saver")) return "NIFTY 500 TRI";
  if (lower.includes("banking") || lower.includes("financial")) return "NIFTY Financial Services TRI";
  if (lower.includes("it ") || lower.includes("technology")) return "NIFTY IT TRI";
  if (lower.includes("pharma") || lower.includes("healthcare")) return "NIFTY Pharma TRI";
  if (lower.includes("consumption")) return "NIFTY India Consumption TRI";
  if (lower.includes("infrastructure")) return "NIFTY Infrastructure TRI";
  if (lower.includes("manufacturing")) return "NIFTY India Manufacturing TRI";
  if (lower.includes("mnc")) return "NIFTY MNC TRI";
  if (lower.includes("psu")) return "S&P BSE PSU TRI";
  if (lower.includes("liquid")) return "NIFTY Liquid Index";
  if (lower.includes("overnight")) return "NIFTY 1D Rate Index";
  if (lower.includes("money market")) return "NIFTY Money Market Index (A-I / B-I)";
  if (lower.includes("ultra short")) return "NIFTY Ultra Short Duration Debt Index";
  if (lower.includes("low duration")) return "NIFTY Low Duration Debt Index";
  if (lower.includes("short duration")) return "NIFTY Short Duration Debt Index";
  
  return null;
}

export async function getBenchmarkReturns(schemeName: string, reportedBenchmarkName?: string): Promise<BenchmarkData | null> {
  await loadMapping();
  
  let targetBenchmark = benchmarkMapping[schemeName.toLowerCase()];
  
  if (!targetBenchmark) {
    targetBenchmark = getCategoryBenchmark(schemeName);
  }
  
  if (!targetBenchmark && reportedBenchmarkName && reportedBenchmarkName !== "Data unavailable") {
    targetBenchmark = reportedBenchmarkName;
  }

  if (!targetBenchmark) return null;

  try {
    const files = await fs.readdir(BENCHMARK_DIR);
    const normalizedTarget = targetBenchmark.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    let bestFile = "";
    let bestScore = 0;

    for (const file of files) {
      if (!file.endsWith(".csv")) continue;
      const normalizedFile = file.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      if (normalizedFile.includes(normalizedTarget) || normalizedTarget.includes(normalizedFile)) {
        bestFile = file;
        break; 
      }
      
      const targetWords = targetBenchmark.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let score = 0;
      for (const word of targetWords) {
        if (file.toLowerCase().includes(word)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestFile = file;
      }
    }

    if (!bestFile || (bestScore < 1 && !bestFile.toLowerCase().includes(targetBenchmark.toLowerCase().substring(0, 5)))) {
      return null;
    }

    const filePath = path.join(BENCHMARK_DIR, bestFile);
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    
    if (lines.length < 2) return null;
    
    const data: { date: Date; price: number }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.match(/(".*?"|[^,]+)/g)?.map(p => p.replace(/"/g, "").trim()) || [];
      if (parts.length < 2) continue;

      let dateStr = parts[0];
      let priceStr = parts[1].replace(/,/g, "");
      
      let date: Date;
      if (dateStr.includes("-")) {
        date = parse(dateStr, "dd-MM-yyyy", new Date());
      } else {
        date = new Date(dateStr);
      }

      const price = parseFloat(priceStr);
      if (!isNaN(price) && date instanceof Date && !isNaN(date.getTime())) {
        data.push({ date, price });
      }
    }

    if (data.length < 2) return null;
    data.sort((a, b) => a.date.getTime() - b.date.getTime());

    const latest = data[data.length - 1];
    const latestDate = latest.date;
    
    const getReturns = (years: number) => {
      const targetDate = new Date(latestDate);
      targetDate.setFullYear(latestDate.getFullYear() - years);
      
      let closest = data[0];
      let minDiff = Math.abs(data[0].date.getTime() - targetDate.getTime());
      
      for (const entry of data) {
        const diff = Math.abs(entry.date.getTime() - targetDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closest = entry;
        }
      }

      if (minDiff > 60 * 24 * 60 * 60 * 1000) return "N/A";

      const cagr = Math.pow(latest.price / closest.price, 1 / years) - 1;
      return (cagr * 100).toFixed(2) + "%";
    };

    return {
      "1y": getReturns(1),
      "3y": getReturns(3),
      "5y": getReturns(5)
    };

  } catch (error) {
    console.error(`Error calculating benchmark returns for ${targetBenchmark}:`, error);
    return null;
  }
}
