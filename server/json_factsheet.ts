import fs from "fs/promises";
import path from "path";

const JSON_DIR = path.join(process.cwd(), "Factsheet January Json");

export async function getMetricsFromJson(schemeName: string) {
  try {
    const files = await fs.readdir(JSON_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.txt'));
    
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(JSON_DIR, file), 'utf-8');
      try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          const fund = data.find(f => 
            f.scheme_name?.toLowerCase() === schemeName.toLowerCase() ||
            schemeName.toLowerCase().includes(f.scheme_name?.toLowerCase()) ||
            f.scheme_name?.toLowerCase().includes(schemeName.toLowerCase())
          );
          if (fund) {
            return {
              alpha: fund.alpha || "Data unavailable",
              beta: fund.beta || "Data unavailable",
              sharpe_ratio: fund.sharpe_ratio || "Data unavailable",
              std_deviation: fund.standard_deviation || "Data unavailable",
              expense_ratio: fund.expense_ratio_percent || "Data unavailable",
              aum_crores: fund.aum_cr || "Data unavailable",
              factsheet_month: fund.factsheet_month || "Data unavailable",
              last_updated: fund.last_updated || "Data unavailable",
              scheme_category: fund.scheme_category || "Data unavailable",
              source: `Factsheet ${file}`
            };
          }
        }
      } catch (e) {
        // Skip invalid JSON files
      }
    }
  } catch (err) {
    console.error("Error reading JSON factsheets:", err);
  }
  return null;
}
