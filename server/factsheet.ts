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

export async function extractMetricsFromFactsheet(schemeName: string): Promise<FactsheetMetrics | null> {
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

  const textChunks = splitTextAroundScheme(factsheetText, schemeName);

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
${textChunks}`;

  try {
    const responseText = await callGeminiForExtraction(prompt);
    const jsonMatch = responseText?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText || "{}");

    return {
      alpha: parsed.alpha || "Data unavailable",
      beta: parsed.beta || "Data unavailable",
      sharpe_ratio: parsed.sharpe_ratio || "Data unavailable",
      std_deviation: parsed.std_deviation || "Data unavailable",
      expense_ratio: parsed.expense_ratio || "Data unavailable",
      aum_crores: parsed.aum_crores || "Data unavailable",
      benchmark_name: parsed.benchmark_name || "Data unavailable",
      portfolio_turnover: parsed.portfolio_turnover || "Data unavailable",
      source: `${FUND_HOUSE_FILE_MAP[fundHouseKey]} factsheet`,
    };
  } catch (error) {
    console.error(`Error extracting metrics for ${schemeName}:`, error);
    return null;
  }
}

function splitTextAroundScheme(fullText: string, schemeName: string): string {
  const lines = fullText.split("\n");
  const schemeWords = schemeName.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  let bestLineIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    let score = 0;
    for (const word of schemeWords) {
      if (lineLower.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLineIdx = i;
    }
  }

  if (bestLineIdx === -1 || bestScore < 2) {
    return fullText.substring(0, 15000);
  }

  const contextBefore = 50;
  const contextAfter = 200;
  const startIdx = Math.max(0, bestLineIdx - contextBefore);
  const endIdx = Math.min(lines.length, bestLineIdx + contextAfter);

  return lines.slice(startIdx, endIdx).join("\n");
}
