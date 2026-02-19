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
  if (lower.includes("small cap")) return "Nifty Benchmark - NIFTY Smallcap 250 TRI.csv";
  if (lower.includes("mid cap")) return "Nifty Benchmark - NIFTY Midcap 150 TRI.csv";
  if (lower.includes("large cap")) return "Nifty Benchmark - Nifty 100 TRI.csv";
  if (lower.includes("large & mid cap") || lower.includes("largemidcap")) return "Nifty Benchmark - NIFTY LARGEMIDCAP 250.csv";
  if (lower.includes("flexi cap")) return "Nifty Benchmark - Nifty 500 TRI.csv";
  if (lower.includes("multi cap")) return "Nifty Benchmark - NIFTY500 MULTICAP 50_25_25.csv";
  if (lower.includes("focused")) return "Nifty Benchmark - Nifty 500 TRI.csv";
  if (lower.includes("value") || lower.includes("contra")) return "Nifty Benchmark - Nifty 500 TRI.csv";
  if (lower.includes("elss") || lower.includes("tax saver")) return "Nifty Benchmark - Nifty 500 TRI.csv";
  if (lower.includes("banking") || lower.includes("financial")) return "Nifty Benchmark - NIFTY Financial Services TRI.csv";
  if (lower.includes("it ") || lower.includes("technology")) return "Nifty Benchmark - NIFTY IT TRI.csv";
  if (lower.includes("pharma") || lower.includes("healthcare")) return "Nifty Benchmark - NIFTY Pharma TRI.csv";
  if (lower.includes("consumption")) return "Nifty Benchmark - NIFTY India Consumption TRI.csv";
  if (lower.includes("infrastructure")) return "Nifty Benchmark - NIFTY Infrastructure TRI.csv";
  if (lower.includes("manufacturing")) return "Nifty Benchmark - NIFTY India Manufacturing TRI.csv";
  if (lower.includes("mnc")) return "Nifty Benchmark - NIFTY MNC TRI.csv";
  if (lower.includes("psu")) return "Nifty Benchmark - S&P BSE PSU TRI.csv";
  if (lower.includes("liquid")) return "Benchmark Debt - NIFTY Liquid Index.csv";
  if (lower.includes("overnight")) return "Benchmark Debt - NIFTY 1D Rate Index.csv";
  if (lower.includes("money market")) return "Benchmark Debt - NIFTY Money Market Index (A-I _ B-I).csv";
  if (lower.includes("ultra short")) return "Benchmark Debt - NIFTY Ultra Short Duration Debt Index.csv";
  if (lower.includes("low duration")) return "Benchmark Debt - NIFTY Low Duration Debt Index.csv";
  if (lower.includes("short duration")) return "Benchmark Debt - NIFTY Short Duration Debt Index.csv";
  
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
      let priceStr = (parts[4] || parts[1]).replace(/,/g, ""); // Prefer 'Close' price if available at index 4
      
      let date: Date;
      if (dateStr.includes("-")) {
        // Handle various dash formats: dd-MM-yyyy or yyyy-MM-dd or dd-MMM-yy
        if (dateStr.split("-")[0].length === 4) {
          date = parse(dateStr, "yyyy-MM-dd", new Date());
        } else if (dateStr.match(/[a-zA-Z]/)) {
          date = parse(dateStr, "dd-MMM-yy", new Date());
        } else {
          date = parse(dateStr, "dd-MM-yyyy", new Date());
        }
      } else if (dateStr.includes("/")) {
        date = parse(dateStr, "dd/MM/yyyy", new Date());
      } else {
        date = new Date(dateStr);
      }

      const price = parseFloat(priceStr);
      if (!isNaN(price) && date instanceof Date && !isNaN(date.getTime())) {
        data.push({ date, price });
      }
    }

    if (data.length < 2) return null;
    // Sort ascending (oldest first) to ensure correct latest/closest points
    data.sort((a, b) => a.date.getTime() - b.date.getTime());

    const latest = data[data.length - 1];
    const latestDate = latest.date;

    const getReturns = (years: number) => {
      const targetDate = new Date(latestDate);
      targetDate.setFullYear(latestDate.getFullYear() - years);

      // Find the closest date to the target date (X years ago)
      let closest = data[0];
      let minDiff = Math.abs(data[0].date.getTime() - targetDate.getTime());

      for (const entry of data) {
        const diff = Math.abs(entry.date.getTime() - targetDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closest = entry;
        }
      }

      // If the closest data point is more than 90 days away from target, we don't have enough history
      if (minDiff > 90 * 24 * 60 * 60 * 1000) return "N/A";

      // CAGR = (End Value / Start Value)^(1/Years) - 1
      const ratio = latest.price / closest.price;
      const cagr = Math.pow(ratio, 1 / years) - 1;
      const result = (cagr * 100).toFixed(2) + "%";
      
      console.log(`[Benchmark] ${targetBenchmark} - ${years}Y: Start=${closest.price} (${closest.date.toDateString()}), End=${latest.price} (${latest.date.toDateString()}), Ratio=${ratio.toFixed(4)}, CAGR=${result}`);

      // If the 1Y return is suspiciously low (like 1.01%), check if we're using TRI
      if (years === 1 && ratio < 1.05 && !targetBenchmark.toLowerCase().includes("tri")) {
        console.warn(`[Benchmark] Warning: 1Y return for ${targetBenchmark} is very low (${result}). Ensure TRI data is used.`);
      }
      
      return result;
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
