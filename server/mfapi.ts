import fs from "fs/promises";
import path from "path";

interface SchemeCodeEntry {
  code: number;
  name: string;
  nameNorm: string;
}

let schemeCodesCache: SchemeCodeEntry[] | null = null;

async function loadSchemeCodes(): Promise<SchemeCodeEntry[]> {
  if (schemeCodesCache) return schemeCodesCache;

  const csvPath = path.join(process.cwd(), "server/assets/scheme_codes.csv");
  const content = await fs.readFile(csvPath, "utf-8");
  const lines = content.split("\n");
  const entries: SchemeCodeEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const commaIdx = line.indexOf(",");
    if (commaIdx === -1) continue;
    const codeStr = line.substring(0, commaIdx).trim();
    const name = line.substring(commaIdx + 1).trim();
    const code = parseInt(codeStr, 10);
    if (isNaN(code) || !name) continue;
    entries.push({ code, name, nameNorm: normalize(name) });
  }

  schemeCodesCache = entries;
  console.log(`Loaded ${entries.length} scheme codes from CSV`);
  return entries;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\(erstwhile[^)]*\)/gi, "")
    .replace(/\(formerly[^)]*\)/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/mid\s*cap/g, "midcap")
    .replace(/small\s*cap/g, "smallcap")
    .replace(/large\s*cap/g, "largecap")
    .replace(/flexi\s*cap/g, "flexicap")
    .replace(/multi\s*cap/g, "multicap")
    .replace(/blue\s*chip/g, "bluechip")
    .replace(/\s+/g, " ")
    .trim();
}

function isDirect(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("direct");
}

function isGrowth(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("growth");
}

function isIDCW(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("idcw") || n.includes("dividend");
}

const FUND_HOUSES = [
  "aditya birla sun life", "aditya birla", "axis", "bajaj finserv", "bandhan",
  "bank of india", "baroda bnp", "canara robeco", "dsp", "edelweiss",
  "franklin templeton", "franklin", "groww", "hdfc", "helios", "hsbc",
  "icici prudential", "icici", "invesco", "iti", "jm financial", "kotak",
  "lic", "mahindra manulife", "mirae asset", "mirae", "motilal oswal",
  "navi", "nippon india", "nippon", "nj", "old bridge", "parag parikh", "ppfas",
  "pgim", "quant", "quantum", "samco", "sbi", "sundaram", "tata", "taurus",
  "trust", "unifi", "union", "uti", "whiteoak", "360 one",
  "angel one", "angel"
];

function extractFundHouse(name: string): string | null {
  const lower = name.toLowerCase();
  for (const fh of FUND_HOUSES) {
    if (lower.includes(fh)) return fh;
  }
  return null;
}

function extractCoreFundName(name: string): string {
  let core = normalize(name);
  for (const fh of FUND_HOUSES) {
    core = core.replace(new RegExp(`\\b${fh.replace(/\s+/g, "\\s+")}\\b`, "g"), "");
  }
  core = core
    .replace(/\b(regular|direct|plan|growth|option|idcw|dividend|bonus|reinvestment)\b/g, "")
    .replace(/\b(fund|scheme|gr|std|cum|capital|withdrawal|income|distribution)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return core;
}

export async function findSchemeCode(schemeName: string): Promise<{ code: number; name: string } | null> {
  const entries = await loadSchemeCodes();
  const inputNorm = normalize(schemeName);
  const inputFH = extractFundHouse(schemeName);
  const inputDirect = isDirect(schemeName);
  const inputGrowth = isGrowth(schemeName);
  const inputIDCW = isIDCW(schemeName);
  const inputCore = extractCoreFundName(schemeName);
  const inputCoreWords = inputCore.split(" ").filter(w => w.length > 1);

  let bestMatch: SchemeCodeEntry | null = null;
  let bestScore = -Infinity;

  for (const entry of entries) {
    let score = 0;

    const entryFH = extractFundHouse(entry.name);
    if (inputFH && entryFH) {
      if (inputFH !== entryFH && !inputFH.includes(entryFH) && !entryFH.includes(inputFH)) {
        continue;
      }
      score += 50;
    } else if (inputFH && !entryFH) {
      continue;
    }

    if (entry.nameNorm === inputNorm) {
      return { code: entry.code, name: entry.name };
    }

    const entryCore = extractCoreFundName(entry.name);
    const entryCoreWords = entryCore.split(" ").filter(w => w.length > 1);

    let coreMatched = 0;
    for (const w of inputCoreWords) {
      if (entryCoreWords.includes(w) || entryCore.includes(w)) {
        coreMatched++;
      }
    }
    let coreMissed = 0;
    for (const w of entryCoreWords) {
      if (!inputCoreWords.includes(w) && !inputCore.includes(w)) {
        coreMissed++;
      }
    }

    if (inputCoreWords.length > 0) {
      score += (coreMatched / inputCoreWords.length) * 40;
    }
    score -= coreMissed * 3;

    const entryDirect = isDirect(entry.name);
    const entryGrowth = isGrowth(entry.name);
    const entryIDCW = isIDCW(entry.name);

    if (inputDirect === entryDirect) {
      score += 10;
    } else {
      score -= 20;
    }

    if (inputGrowth && entryGrowth && !entryIDCW) {
      score += 15;
    } else if (inputGrowth && entryIDCW) {
      score -= 30;
    } else if (!inputIDCW && entryIDCW) {
      score -= 25;
    } else if (inputIDCW && !entryIDCW) {
      score -= 25;
    } else if (inputIDCW && entryIDCW) {
      score += 15;
    }

    if (!inputGrowth && !inputIDCW && entryGrowth && !entryIDCW) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestScore >= 50) {
    return { code: bestMatch.code, name: bestMatch.name };
  }

  return null;
}

export async function searchSchemeCodes(query: string): Promise<Array<{ code: number; name: string }>> {
  const entries = await loadSchemeCodes();
  const queryNorm = normalize(query);
  const queryWords = queryNorm.split(" ").filter(w => w.length > 1);

  const results: Array<{ code: number; name: string; score: number }> = [];

  for (const entry of entries) {
    let matched = 0;
    for (const word of queryWords) {
      if (entry.nameNorm.includes(word)) matched++;
    }
    const score = queryWords.length > 0 ? matched / queryWords.length : 0;
    if (score >= 0.5) {
      results.push({ code: entry.code, name: entry.name, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10).map(r => ({ code: r.code, name: r.name }));
}

interface MFAPIResponse {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
    isin_growth: string;
    isin_div_reinvestment: string;
  };
  data: Array<{ date: string; nav: string }>;
  status: string;
}

interface NavData {
  current_nav: number;
  nav_date: string;
  scheme_name: string;
  scheme_code: number;
  fund_house: string;
  cagr_1y: number | null;
  cagr_3y: number | null;
  cagr_5y: number | null;
}

function parseMFAPIDate(dateStr: string): Date {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return new Date(0);
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1];
  const year = parseInt(parts[2], 10);

  const months: Record<string, number> = {
    "01": 0, "02": 1, "03": 2, "04": 3, "05": 4, "06": 5,
    "07": 6, "08": 7, "09": 8, "10": 9, "11": 10, "12": 11
  };

  let month = months[monthStr];
  if (month === undefined) {
    month = new Date(`${monthStr} 1, 2000`).getMonth();
  }

  return new Date(year, month, day);
}

function findNavOnOrBefore(data: Array<{ date: string; nav: string }>, targetDate: Date): { nav: number; date: string } | null {
  for (const entry of data) {
    const entryDate = parseMFAPIDate(entry.date);
    if (entryDate <= targetDate) {
      return { nav: parseFloat(entry.nav), date: entry.date };
    }
  }
  return null;
}

function calculateCAGR(currentNav: number, oldNav: number, years: number): number {
  if (oldNav <= 0 || years <= 0) return 0;
  return (Math.pow(currentNav / oldNav, 1 / years) - 1) * 100;
}

export async function fetchNavData(schemeCode: number): Promise<NavData | null> {
  try {
    const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!response.ok) return null;

    const result: MFAPIResponse = await response.json();
    if (!result.data || result.data.length === 0) return null;

    const latestNav = parseFloat(result.data[0].nav);
    const latestDate = result.data[0].date;
    const currentDate = parseMFAPIDate(latestDate);

    const date1y = new Date(currentDate);
    date1y.setFullYear(date1y.getFullYear() - 1);
    const date3y = new Date(currentDate);
    date3y.setFullYear(date3y.getFullYear() - 3);
    const date5y = new Date(currentDate);
    date5y.setFullYear(date5y.getFullYear() - 5);

    const nav1y = findNavOnOrBefore(result.data, date1y);
    const nav3y = findNavOnOrBefore(result.data, date3y);
    const nav5y = findNavOnOrBefore(result.data, date5y);

    return {
      current_nav: latestNav,
      nav_date: latestDate,
      scheme_name: result.meta.scheme_name,
      scheme_code: schemeCode,
      fund_house: result.meta.fund_house,
      cagr_1y: nav1y ? calculateCAGR(latestNav, nav1y.nav, 1) : null,
      cagr_3y: nav3y ? calculateCAGR(latestNav, nav3y.nav, 3) : null,
      cagr_5y: nav5y ? calculateCAGR(latestNav, nav5y.nav, 5) : null,
    };
  } catch (error) {
    console.error(`MFAPI fetch error for scheme ${schemeCode}:`, error);
    return null;
  }
}

export async function fetchNavForScheme(schemeName: string): Promise<NavData | null> {
  const match = await findSchemeCode(schemeName);
  if (!match) {
    console.log(`No scheme code found for: ${schemeName}`);
    return null;
  }

  console.log(`Matched "${schemeName}" -> code ${match.code} (${match.name})`);
  return fetchNavData(match.code);
}
