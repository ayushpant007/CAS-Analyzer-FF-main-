import fs from "fs/promises";
import path from "path";
import { parse } from "date-fns";

const BENCHMARK_DIR = path.join(process.cwd(), "Benchmarks");

interface BenchmarkData {
  "1y": string;
  "3y": string;
  "5y": string;
}

export async function getBenchmarkReturns(benchmarkName: string): Promise<BenchmarkData | null> {
  if (!benchmarkName || benchmarkName === "Data unavailable") return null;

  try {
    const files = await fs.readdir(BENCHMARK_DIR);
    const normalizedTarget = benchmarkName.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    // Try to find the closest matching file
    let bestFile = "";
    let bestScore = 0;

    for (const file of files) {
      if (!file.endsWith(".csv")) continue;
      const normalizedFile = file.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      // Simple containment or overlap check
      if (normalizedFile.includes(normalizedTarget) || normalizedTarget.includes(normalizedFile)) {
        bestFile = file;
        break; 
      }
      
      // Word based matching
      const targetWords = benchmarkName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let score = 0;
      for (const word of targetWords) {
        if (file.toLowerCase().includes(word)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestFile = file;
      }
    }

    if (!bestFile || (bestScore < 2 && !bestFile.toLowerCase().includes(benchmarkName.toLowerCase().substring(0, 10)))) {
      console.log(`No matching benchmark file found for: ${benchmarkName}`);
      return null;
    }

    const filePath = path.join(BENCHMARK_DIR, bestFile);
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    
    if (lines.length < 2) return null;

    // Detect format and parse
    // Format 1: Date,Price,Change % (Ascending)
    // Format 2: Date,Price (Descending)
    
    const data: { date: Date; price: number }[] = [];
    const headers = lines[0].toLowerCase();
    const isPriceOnly = !headers.includes("change");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Handle quoted values with commas
      const parts = line.match(/(".*?"|[^,]+)/g)?.map(p => p.replace(/"/g, "").trim()) || [];
      if (parts.length < 2) continue;

      let dateStr = parts[0];
      let priceStr = parts[1].replace(/,/g, "");
      
      let date: Date;
      // Try various formats
      if (dateStr.includes("-")) {
        date = parse(dateStr, "dd-MM-yyyy", new Date());
      } else if (dateStr.includes(",")) {
        date = new Date(dateStr);
      } else {
        date = new Date(dateStr);
      }

      const price = parseFloat(priceStr);
      if (!isNaN(price) && date instanceof Date && !isNaN(date.getTime())) {
        data.push({ date, price });
      }
    }

    if (data.length < 2) return null;

    // Sort by date ascending for calculation
    data.sort((a, b) => a.date.getTime() - b.date.getTime());

    const latest = data[data.length - 1];
    const latestDate = latest.date;
    
    const getReturns = (years: number) => {
      const targetDate = new Date(latestDate);
      targetDate.setFullYear(latestDate.getFullYear() - years);
      
      // Find closest date in data
      let closest = data[0];
      let minDiff = Math.abs(data[0].date.getTime() - targetDate.getTime());
      
      for (const entry of data) {
        const diff = Math.abs(entry.date.getTime() - targetDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closest = entry;
        }
      }

      // If the closest date is more than 30 days away, we don't have enough history
      if (minDiff > 30 * 24 * 60 * 60 * 1000) return "N/A";

      // CAGR = (End Value / Start Value)^(1/Years) - 1
      const cagr = Math.pow(latest.price / closest.price, 1 / years) - 1;
      return (cagr * 100).toFixed(2) + "%";
    };

    return {
      "1y": getReturns(1),
      "3y": getReturns(3),
      "5y": getReturns(5)
    };

  } catch (error) {
    console.error(`Error calculating benchmark returns for ${benchmarkName}:`, error);
    return null;
  }
}
