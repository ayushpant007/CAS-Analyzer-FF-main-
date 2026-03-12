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

let scoringDb: Map<string, ScoringRecord> | null = null;

function loadScoring(): Map<string, ScoringRecord> {
  const db = new Map<string, ScoringRecord>();
  const base = path.join(process.cwd(), "Scoring");

  const addRows = (filePath: string, fundType: ScoringRecord["fundType"], sheetIndex = 0) => {
    try {
      const wb = xlsx.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[sheetIndex]];
      const rows = xlsx.utils.sheet_to_json<any>(ws);
      for (const row of rows) {
        const isin = (row["ISIN"] || "").toString().trim();
        if (!isin) continue;

        const metrics: Record<string, number | string | null> = {};
        const scores: Record<string, number | null> = {};

        for (const [key, val] of Object.entries(row)) {
          if (key === "ISIN" || key === "Scheme Code" || key === "VR ID" || key === "Plan" || key === "Fund Name" || key === "Category" || key === "Risk Category" || key === "Fund Rating") continue;
          const isScore = key.includes("Score(") || key === "Debt Quality" || key === "Risk&Return" || key === "Diversification" || key === "Valuation" || key === "PortBreadth" || key === "Total Score(40)";
          if (isScore) {
            scores[key] = val != null ? Number(val) : null;
          } else {
            metrics[key] = val != null ? val : null;
          }
        }

        db.set(isin, {
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
        });
      }
      console.log(`Loaded ${rows.length} records from ${path.basename(filePath)} (${fundType})`);
    } catch (e: any) {
      console.error(`Failed to load ${filePath}:`, e.message);
    }
  };

  addRows(path.join(base, "All_Funds_Metrices_Scored.xlsx"), "equity", 0);
  addRows(path.join(base, "Hybrid_Funds_Metrices_Scored.xlsx"), "hybrid");
  addRows(path.join(base, "Debt_Funds_Metrices_Scored.xlsx"), "debt");
  addRows(path.join(base, "Solution_Oriented_Funds_Scored.xlsx"), "solution");

  return db;
}

export function getScoringDb(): Map<string, ScoringRecord> {
  if (!scoringDb) {
    scoringDb = loadScoring();
  }
  return scoringDb;
}

export function lookupByIsin(isin: string): ScoringRecord | null {
  const db = getScoringDb();
  return db.get(isin.trim()) ?? null;
}
