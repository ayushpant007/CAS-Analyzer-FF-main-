import fs from "fs/promises";
import path from "path";

const JSON_DIR = path.join(process.cwd(), "Factsheet January Json");
let combinedData: any[] | null = null;

async function loadCombinedData() {
  if (combinedData) return combinedData;
  try {
    const files = await fs.readdir(JSON_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.txt'));
    let allData: any[] = [];
    
    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(JSON_DIR, file), 'utf-8');
      try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          allData = allData.concat(data);
        }
      } catch (e) {
        // Skip invalid JSON files
      }
    }
    combinedData = allData;
    return combinedData;
  } catch (err) {
    console.error("Error reading JSON factsheets:", err);
    return [];
  }
}

export async function getMetricsFromJson(schemeName: string) {
  const data = await loadCombinedData();
  if (!data || !Array.isArray(data)) return null;

  const normalizedSearch = schemeName.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Try exact match first
  let match = data.find(item => 
    item.scheme_name && item.scheme_name.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedSearch
  );

  // Try partial match if no exact match
  if (!match) {
    match = data.find(item => {
      if (!item.scheme_name) return false;
      const normalizedItem = item.scheme_name.toLowerCase().replace(/\s+/g, ' ').trim();
      return normalizedSearch.includes(normalizedItem) || normalizedItem.includes(normalizedSearch);
    });
  }

  if (match) {
    return {
      alpha: match.alpha || "Data unavailable",
      beta: match.beta || "Data unavailable",
      sharpe_ratio: match.sharpe_ratio || "Data unavailable",
      std_deviation: match.standard_deviation || "Data unavailable",
      expense_ratio: match.expense_ratio_percent || "Data unavailable",
      aum_crores: match.aum_cr || "Data unavailable",
      benchmark_name: match.benchmark_name || "Data unavailable",
      factsheet_month: match.factsheet_month || "Data unavailable",
      last_updated: match.last_updated || "Data unavailable",
      scheme_category: match.scheme_category || "Data unavailable",
      source: "Factsheet January Json"
    };
  }

  return null;
}
