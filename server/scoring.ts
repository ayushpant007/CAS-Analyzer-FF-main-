import xlsx from "xlsx";
import path from "path";

interface ScoringRecord {
  fundName: string;
  plan: string;
  category: string;
  isin: string;
  schemeCode: number;
  fundType: "equity" | "hybrid" | "debt" | "solution";
  totalScore: number;
  riskCategory: string;
  fundRating: string;
  metrics: Record<string, number | string | null>;
  scores: Record<string, number | null>;
}

const STOP_WORDS = new Set([
  "fund", "funds", "plan", "plans", "growth", "growth plan", "direct", "regular",
  "option", "scheme", "india", "the", "a", "an", "of", "and", "or", "for", "in",
  "on", "at", "to", "by", "with", "from", "is", "are", "was", "be", "been",
  "erstwhile", "previously", "known", "as", "formerly", "new", "standard",
  "institutional", "retail", "super", "ultra", "bonus", "dividend", "payout",
  "reinvest", "reinvestment", "idcw", "growth plan growth option",
]);

const ABBREV_MAP: Record<string, string> = {
  "pru": "prudential",
  "hdfc": "hdfc",
  "sbi": "sbi",
  "icici": "icici",
  "axis": "axis",
  "kotak": "kotak",
  "nippon": "nippon",
  "dsp": "dsp",
  "absl": "aditya birla sun life",
  "aditya birla": "aditya birla sun life",
  "mirae": "mirae",
  "tata": "tata",
  "uti": "uti",
  "franklin": "franklin",
  "invesco": "invesco",
  "bandhan": "bandhan",
  "pgim": "pgim",
  "hsbc": "hsbc",
  "canara": "canara",
  "l&t": "l t",
  "l & t": "l t",
};

function normalizeName(name: string): Set<string> {
  let n = name.toLowerCase();
  
  // apply abbreviation expansions
  for (const [abbr, full] of Object.entries(ABBREV_MAP)) {
    n = n.replace(new RegExp(`\\b${abbr}\\b`, "g"), full);
  }

  // remove special chars except spaces
  n = n.replace(/[-&().,\/\\*]/g, " ");

  // tokenize and filter stop words
  const tokens = n.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

let scoringDb: Map<string, ScoringRecord> | null = null;
let nameIndex: Array<{ tokens: Set<string>; record: ScoringRecord }> | null = null;

function loadScoring(): { db: Map<string, ScoringRecord>; nameIdx: Array<{ tokens: Set<string>; record: ScoringRecord }> } {
  const db = new Map<string, ScoringRecord>();
  const nameIdx: Array<{ tokens: Set<string>; record: ScoringRecord }> = [];
  const base = path.join(process.cwd(), "Scoring");

  const addRows = (filePath: string, fundType: ScoringRecord["fundType"]) => {
    try {
      const wb = xlsx.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json<any>(ws);
      for (const row of rows) {
        const isin = (row["ISIN"] || "").toString().trim();
        if (!isin) continue;

        const metrics: Record<string, number | string | null> = {};
        const scores: Record<string, number | null> = {};

        for (const [key, val] of Object.entries(row)) {
          if (["ISIN", "Scheme Code", "VR ID", "Plan", "Fund Name", "Category", "Risk Category", "Fund Rating"].includes(key)) continue;
          const isScore = key.includes("Score(") || key === "Debt Quality" || key === "Risk&Return" || key === "Diversification" || key === "Valuation" || key === "PortBreadth" || key === "Total Score(40)";
          if (isScore) {
            scores[key] = val != null ? Number(val) : null;
          } else {
            metrics[key] = val != null ? val : null;
          }
        }

        const record: ScoringRecord = {
          fundName: row["Fund Name"] || "",
          plan: row["Plan"] || "",
          category: row["Category"] || "",
          isin,
          schemeCode: Number(row["Scheme Code"]) || 0,
          fundType,
          totalScore: Number(row["Total Score(40)"]) || 0,
          riskCategory: row["Risk Category"] || "",
          fundRating: row["Fund Rating"] || "",
          metrics,
          scores,
        };

        db.set(isin, record);
        nameIdx.push({ tokens: normalizeName(record.fundName), record });
      }
      console.log(`Loaded ${rows.length} records from ${path.basename(filePath)} (${fundType})`);
    } catch (e: any) {
      console.error(`Failed to load ${filePath}:`, e.message);
    }
  };

  addRows(path.join(base, "All_Funds_Metrices_Scored.xlsx"), "equity");
  addRows(path.join(base, "Hybrid_Funds_Metrices_Scored.xlsx"), "hybrid");
  addRows(path.join(base, "Debt_Funds_Metrices_Scored.xlsx"), "debt");
  addRows(path.join(base, "Solution_Oriented_Funds_Scored.xlsx"), "solution");

  return { db, nameIdx };
}

function ensureLoaded() {
  if (!scoringDb || !nameIndex) {
    const { db, nameIdx } = loadScoring();
    scoringDb = db;
    nameIndex = nameIdx;
  }
}

export function lookupByIsin(isin: string): ScoringRecord | null {
  ensureLoaded();
  return scoringDb!.get(isin.trim()) ?? null;
}

export function lookupByName(schemeName: string, preferPlan?: string): ScoringRecord | null {
  ensureLoaded();
  const queryTokens = normalizeName(schemeName);
  if (queryTokens.size === 0) return null;

  let bestScore = 0;
  let bestRecord: ScoringRecord | null = null;
  let bestPlanBonus = 0;

  for (const { tokens, record } of nameIndex!) {
    const sim = jaccardSimilarity(queryTokens, tokens);
    // Give small bonus when the plan type matches
    const planBonus = preferPlan && record.plan.toLowerCase() === preferPlan.toLowerCase() ? 0.05 : 0;
    const total = sim + planBonus;

    if (total > bestScore + bestPlanBonus) {
      bestScore = sim;
      bestPlanBonus = planBonus;
      bestRecord = record;
    }
  }

  // Only return if similarity is above threshold
  return bestScore >= 0.35 ? bestRecord : null;
}

export function lookupByIsinOrName(isin: string, schemeName?: string, preferPlan?: string): ScoringRecord | null {
  const byIsin = lookupByIsin(isin);
  if (byIsin) return byIsin;
  if (schemeName) return lookupByName(schemeName, preferPlan);
  return null;
}
