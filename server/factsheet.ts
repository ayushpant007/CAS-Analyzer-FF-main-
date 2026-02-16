import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";

const execAsync = promisify(exec);

const FACTSHEET_DIR = path.join(process.cwd(), "Edited Factsheets");

const FUND_HOUSE_FILE_MAP: Record<string, string> = {
  "360one": "360ONE_removed.pdf",
  "aditya birla": "Aditya-birla_removed_compressed.pdf",
  "angel one": "Angel-one_removed.pdf",
  "axis": "Axis Fund _removed.pdf",
  "bajaj finserv": "Bajaj-finserv_removed.pdf",
  "bank of india": "Bank-of-india_removed.pdf",
  "baroda bnp": "Baroda BNP Paribas_removed.pdf",
  "canara robeco": "Canara-Robeco_removed.pdf",
  "edelweiss": "Edelweiss_removed.pdf",
  "franklin": "Franklin_removed.pdf",
  "groww": "Groww_removed.pdf",
  "hdfc": "HDFC_removed.pdf",
  "helios": "Helios_removed.pdf",
  "hsbc": "HSBC_removed.pdf",
  "icici": "ICICI_removed.pdf",
  "invesco": "invesco_removed.pdf",
  "iti": "ITI_removed.pdf",
  "jm financial": "JMFinancial_removed.pdf",
  "kotak": "Kotak_removed.pdf",
  "lic": "lic-mf_removed.pdf",
  "mahindra manulife": "MahindraManulife_removed.pdf",
  "mirae": "Mirae_removed.pdf",
  "navi": "Navi_removed.pdf",
  "nippon": "Nippon_removed_compressed.pdf",
  "nj": "NJ_removed.pdf",
  "old bridge": "OLD_BRIDGE_removed.pdf",
  "pgim": "PGIM_removed.pdf",
  "ppfas": "ppfas_removed.pdf",
  "parag parikh": "ppfas_removed.pdf",
  "quant": "quant_removed.pdf",
  "quantum": "Quantum_removed.pdf",
  "samco": "samco_removed.pdf",
  "sbi": "SBI_removed.pdf",
  "sundaram": "sundaram_removed.pdf",
  "taurus": "taurus_removed.pdf",
  "trust": "Trust_removed.pdf",
  "unifi": "Unifi_removed.pdf",
  "union": "Union_removed.pdf",
  "uti": "UTI_removed.pdf",
  "whiteoak": "Whiteoak Capital _removed.pdf",
  "dsp": "DSP_removed.pdf",
  "motilal oswal": "Motilal_removed.pdf",
  "tata": "Tata_removed.pdf",
  "bandhan": "Bandhan_removed.pdf",
};

export interface FactsheetMetrics {
  alpha: string;
  beta: string;
  sharpe_ratio: string;
  std_deviation: string;
  expense_ratio: string;
  aum_crores: string;
  benchmark_name: string;
  portfolio_turnover: string;
  source: string;
}

const factsheetTextCache: Record<string, string> = {};
const metricsCache: Record<string, FactsheetMetrics> = {};

function identifyFundHouse(schemeName: string): string | null {
  const lower = schemeName.toLowerCase();

  const sortedKeys = Object.keys(FUND_HOUSE_FILE_MAP).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return key;
    }
  }
  return null;
}

async function extractFactsheetText(fundHouseKey: string): Promise<string | null> {
  if (factsheetTextCache[fundHouseKey]) {
    return factsheetTextCache[fundHouseKey];
  }

  const filename = FUND_HOUSE_FILE_MAP[fundHouseKey];
  if (!filename) return null;

  const filePath = path.join(FACTSHEET_DIR, filename);

  try {
    await fs.access(filePath);
  } catch {
    console.log(`Factsheet not found: ${filePath}`);
    return null;
  }

  try {
    const { stdout } = await execAsync(`pdftotext "${filePath}" -`, { maxBuffer: 50 * 1024 * 1024 });
    factsheetTextCache[fundHouseKey] = stdout;
    return stdout;
  } catch (error) {
    console.error(`Error extracting factsheet text for ${fundHouseKey}:`, error);
    return null;
  }
}

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4
].filter(Boolean) as string[];

async function callGeminiForExtraction(prompt: string): Promise<string> {
  const modelName = (process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").toLowerCase().replace(/\s+/g, '-');
  let lastError: any;

  for (const key of GEMINI_KEYS) {
    try {
      const client = new GoogleGenerativeAI(key);
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      console.error(`Gemini extraction failed with key ${key.substring(0, 8)}:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini API keys failed");
}

function extractMetricsViaRegex(textChunk: string): Partial<FactsheetMetrics> {
  const result: Partial<FactsheetMetrics> = {};

  const stdDevMatch = textChunk.match(/Standard\s+Deviation\s*[-–:]*\s*([\d.]+%?)/i);
  if (stdDevMatch) result.std_deviation = stdDevMatch[1].includes('%') ? stdDevMatch[1] : stdDevMatch[1] + '%';

  const betaMatch = textChunk.match(/\bBeta\s*[-–:]*\s*([\d.]+)/i);
  if (betaMatch) result.beta = betaMatch[1];

  const sharpeMatch = textChunk.match(/Sharpe\s+Ratio\s*\**\s*[-–:]?\s*(-?[\d.]+)/i);
  if (sharpeMatch) {
    let val = sharpeMatch[1];
    const fullMatch = sharpeMatch[0];
    if (!val.startsWith('-') && fullMatch.match(/\*+-/)) {
      val = '-' + val;
    }
    result.sharpe_ratio = val;
  }

  const alphaMatch = textChunk.match(/\bAlpha\s*[-–:]*\s*(-?[\d.]+)/i);
  if (alphaMatch && !alphaMatch[0].toLowerCase().includes('alphabet')) result.alpha = alphaMatch[1];

  const aumLines = textChunk.match(/(?:MONTHLY\s+AVERAGE\s*\n?\s*)?(?:AUM|AAUM)\s*\n?\s*([\d,]+\.?\d*)\s*Cr/i);
  if (aumLines) {
    result.aum_crores = aumLines[1];
  }
  if (!result.aum_crores) {
    const aumMatch2 = textChunk.match(/([\d,]+\.?\d*)\s*Cr\.?\s*\n/i);
    if (aumMatch2) result.aum_crores = aumMatch2[1];
  }

  const benchmarkPatterns = [
    /BENCHMARK\s*\n+\s*([^\n]+(?:TRI|Index))/i,
    /Sharpe\s+Ratio\s*\**\s*-?[\d.]+\s*\n+\s*([^\n]+(?:TRI|Index))/i,
    /BENCHMARK[:\s]+([^\n]+(?:TRI|Index))/i,
    /BENCHMARK\s*\n+\s*([^\n]{5,40})/i,
  ];
  for (const pat of benchmarkPatterns) {
    const m = textChunk.match(pat);
    if (m) {
      result.benchmark_name = m[1].trim();
      break;
    }
  }

  const turnoverPatterns = [
    /(?:PORTFOLIO\s+TURNOVER|Equity\s+Turnover)\s*(?:\([^)]*\))?\s*\n+\s*([\d.]+\s*times)/i,
    /(?:PORTFOLIO\s+TURNOVER|Equity\s+Turnover)[^]*?([\d.]+\s*times)/i,
  ];
  for (const pat of turnoverPatterns) {
    const m = textChunk.match(pat);
    if (m) {
      result.portfolio_turnover = m[1];
      break;
    }
  }

  const expensePatterns = [
    /(?:Total\s+)?Expense\s+Ratio\s*[-–:]*\s*([\d.]+%)/i,
    /TER\s*[-–:]*\s*([\d.]+%)/i,
    /Regular\s*(?:Plan)?\s*[-–:]*\s*([\d.]+%)\s*[\s\S]*?Direct\s*(?:Plan)?\s*[-–:]*\s*([\d.]+%)/i,
  ];
  for (const pat of expensePatterns) {
    const m = textChunk.match(pat);
    if (m) {
      if (m[2]) {
        result.expense_ratio = `Regular: ${m[1]}, Direct: ${m[2]}`;
      } else {
        result.expense_ratio = m[1];
      }
      break;
    }
  }

  return result;
}

export async function extractMetricsFromFactsheet(schemeName: string): Promise<FactsheetMetrics | null> {
  const cacheKey = schemeName.toLowerCase().trim();
  if (metricsCache[cacheKey]) {
    console.log(`Using cached metrics for: ${schemeName}`);
    return metricsCache[cacheKey];
  }

  const fundHouseKey = identifyFundHouse(schemeName);
  if (!fundHouseKey) {
    console.log(`Could not identify fund house for: ${schemeName}`);
    return null;
  }

  const factsheetText = await extractFactsheetText(fundHouseKey);
  if (!factsheetText) {
    console.log(`No factsheet text available for fund house: ${fundHouseKey}`);
    return null;
  }

  const textChunk = splitTextAroundScheme(factsheetText, schemeName);
  const regexMetrics = extractMetricsViaRegex(textChunk);

  const hasEnoughRegexData = regexMetrics.std_deviation && regexMetrics.beta && regexMetrics.sharpe_ratio;

  let finalMetrics: FactsheetMetrics;

  if (hasEnoughRegexData) {
    console.log(`Extracted metrics via regex for: ${schemeName}`);
    finalMetrics = {
      alpha: regexMetrics.alpha || "Data unavailable",
      beta: regexMetrics.beta || "Data unavailable",
      sharpe_ratio: regexMetrics.sharpe_ratio || "Data unavailable",
      std_deviation: regexMetrics.std_deviation || "Data unavailable",
      expense_ratio: regexMetrics.expense_ratio || "Data unavailable",
      aum_crores: regexMetrics.aum_crores || "Data unavailable",
      benchmark_name: regexMetrics.benchmark_name || "Data unavailable",
      portfolio_turnover: regexMetrics.portfolio_turnover || "Data unavailable",
      source: `${FUND_HOUSE_FILE_MAP[fundHouseKey]} factsheet`,
    };
  } else {
    try {
      const prompt = `You are a data extraction assistant. You are given text extracted from a mutual fund factsheet PDF.

TASK: Find and extract the EXACT numerical values for the scheme "${schemeName}" from the factsheet text below. 

CRITICAL RULES:
- ONLY extract values that are explicitly written in the text. 
- Do NOT calculate, estimate, or generate any numbers.
- If a value is not found in the text, use "Data unavailable".
- Look for the section that matches or closely matches the scheme name "${schemeName}".

Extract these metrics:
1. Standard Deviation (look for "Standard Deviation" or "Std Deviation" followed by a percentage)
2. Beta (look for "Beta" followed by a decimal number)  
3. Sharpe Ratio (look for "Sharpe Ratio" followed by a decimal number)
4. Alpha (look for "Alpha" followed by a number - may not be present in all factsheets)
5. Expense Ratio (look for "Expense Ratio" or "Total Expense Ratio" - find both Regular and Direct if available)
6. AUM (look for "AUM" or "Assets Under Management" or "AAUM" followed by a number in Crores)
7. Benchmark Name (look for "Benchmark" or "Benchmark Index" name)
8. Portfolio Turnover (look for "Portfolio Turnover" or "Equity Turnover")

Return ONLY this JSON:
{
  "alpha": "extracted value or Data unavailable",
  "beta": "extracted value or Data unavailable",
  "sharpe_ratio": "extracted value or Data unavailable",
  "std_deviation": "extracted value or Data unavailable",
  "expense_ratio": "extracted value (e.g. Regular: 1.36%, Direct: 0.68%) or Data unavailable",
  "aum_crores": "extracted value or Data unavailable",
  "benchmark_name": "extracted name or Data unavailable",
  "portfolio_turnover": "extracted value or Data unavailable"
}

FACTSHEET TEXT (relevant sections):
${textChunk}`;

      const responseText = await callGeminiForExtraction(prompt);
      const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText || "{}");

      finalMetrics = {
        alpha: parsed.alpha || regexMetrics.alpha || "Data unavailable",
        beta: parsed.beta || regexMetrics.beta || "Data unavailable",
        sharpe_ratio: parsed.sharpe_ratio || regexMetrics.sharpe_ratio || "Data unavailable",
        std_deviation: parsed.std_deviation || regexMetrics.std_deviation || "Data unavailable",
        expense_ratio: parsed.expense_ratio || regexMetrics.expense_ratio || "Data unavailable",
        aum_crores: parsed.aum_crores || regexMetrics.aum_crores || "Data unavailable",
        benchmark_name: parsed.benchmark_name || regexMetrics.benchmark_name || "Data unavailable",
        portfolio_turnover: parsed.portfolio_turnover || regexMetrics.portfolio_turnover || "Data unavailable",
        source: `${FUND_HOUSE_FILE_MAP[fundHouseKey]} factsheet`,
      };
    } catch (error) {
      console.error(`Gemini extraction failed for ${schemeName}, using regex results:`, error instanceof Error ? error.message : error);
      finalMetrics = {
        alpha: regexMetrics.alpha || "Data unavailable",
        beta: regexMetrics.beta || "Data unavailable",
        sharpe_ratio: regexMetrics.sharpe_ratio || "Data unavailable",
        std_deviation: regexMetrics.std_deviation || "Data unavailable",
        expense_ratio: regexMetrics.expense_ratio || "Data unavailable",
        aum_crores: regexMetrics.aum_crores || "Data unavailable",
        benchmark_name: regexMetrics.benchmark_name || "Data unavailable",
        portfolio_turnover: regexMetrics.portfolio_turnover || "Data unavailable",
        source: `${FUND_HOUSE_FILE_MAP[fundHouseKey]} factsheet`,
      };
    }
  }

  metricsCache[cacheKey] = finalMetrics;
  return finalMetrics;
}

function splitTextAroundScheme(fullText: string, schemeName: string): string {
  const lines = fullText.split("\n");
  const nameNorm = schemeName.toLowerCase()
    .replace(/\(erstwhile[^)]*\)/gi, "")
    .replace(/\(formerly[^)]*\)/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const schemeWords = nameNorm.split(/\s+/).filter(w => w.length > 3 && !["fund", "plan", "growth", "regular", "direct", "option"].includes(w));

  const candidates: { idx: number; score: number; isHeader: boolean }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    let score = 0;
    for (const word of schemeWords) {
      if (lineLower.includes(word)) score++;
    }
    if (score >= 2) {
      const isHeader = lines[i] === lines[i].toUpperCase() && lines[i].trim().length > 5;
      const nextFewLines = lines.slice(i, Math.min(i + 5, lines.length)).join(" ").toLowerCase();
      const hasFactsheet = nextFewLines.includes("factsheet");
      candidates.push({ idx: i, score: score + (isHeader ? 5 : 0) + (hasFactsheet ? 3 : 0), isHeader });
    }
  }

  if (candidates.length === 0) {
    return fullText.substring(0, 15000);
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestLine = candidates[0];

  const contextBefore = 10;
  const contextAfter = 250;
  const startIdx = Math.max(0, bestLine.idx - contextBefore);
  const endIdx = Math.min(lines.length, bestLine.idx + contextAfter);

  const chunk = lines.slice(startIdx, endIdx).join("\n");

  if (chunk.length > 20000) {
    return chunk.substring(0, 20000);
  }
  return chunk;
}
