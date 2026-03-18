import puppeteer from "puppeteer";
import type { Report } from "@shared/schema";

function fmt(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function cleanFilename(filename: string) {
  return filename.replace(/\.pdf$/i, "").replace(/\s*\([A-Z0-9\-\s]+\)\s*/gi, " ").trim();
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

const CATEGORY_COLORS: Record<string, string> = {
  Equity:      "#3b82f6",
  Debt:        "#f59e0b",
  Hybrid:      "#8b5cf6",
  "Gold/Silver": "#d97706",
  Others:      "#10b981",
};

export function buildReportHtml(report: Report, performances: Record<string, any>): string {
  const analysis = report.analysis as any;
  const funds: any[] = analysis.mf_snapshot || [];
  const accounts: any[] = analysis.account_summaries || [];

  const totalValuation = funds.reduce((s, f) => s + (f.valuation || 0), 0);
  const totalInvested  = funds.reduce((s, f) => s + (f.invested_amount || 0), 0);
  const absoluteGain   = totalValuation - totalInvested;
  const overallPct     = totalInvested > 0 ? (absoluteGain / totalInvested) * 100 : 0;
  const approxCagr     = totalInvested > 0 ? (Math.pow(totalValuation / totalInvested, 1 / 2) - 1) * 100 : 0;

  const analyzedDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown Date";

  // Category allocation
  const catMap: Record<string, number> = {};
  funds.forEach((f) => {
    const cat = f.category || "Others";
    catMap[cat] = (catMap[cat] || 0) + (f.valuation || 0);
  });

  // Fund rows HTML
  const fundRows = funds.map((f, i) => {
    const gain = (f.valuation || 0) - (f.invested_amount || 0);
    const gainPct = f.invested_amount > 0 ? (gain / f.invested_amount) * 100 : 0;
    const perf = performances[f.isin];
    const ret1y = perf?.cagr?.["1y"] || perf?.scheme_returns?.["1y"] || "–";
    const bench1y = perf?.benchmark_returns?.["1y"] || "–";
    const benchName = perf?.benchmark_name || "–";
    const gainColor = gain >= 0 ? "#16a34a" : "#dc2626";

    return `
    <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
      <td style="padding:10px 12px;font-size:12px;max-width:220px;word-break:break-word;">${f.scheme_name || "–"}</td>
      <td style="padding:10px 12px;font-size:11px;color:#64748b;">${f.category || "–"}</td>
      <td style="padding:10px 12px;font-size:12px;text-align:right;">${fmt(f.invested_amount || 0)}</td>
      <td style="padding:10px 12px;font-size:12px;font-weight:600;text-align:right;">${fmt(f.valuation || 0)}</td>
      <td style="padding:10px 12px;font-size:12px;font-weight:600;text-align:right;color:${gainColor};">${pct(gainPct)}</td>
      <td style="padding:10px 12px;font-size:11px;text-align:right;">${ret1y}</td>
      <td style="padding:10px 12px;font-size:11px;text-align:right;color:#64748b;">${bench1y}</td>
      <td style="padding:10px 12px;font-size:10px;color:#94a3b8;max-width:160px;word-break:break-word;">${benchName}</td>
    </tr>`;
  }).join("");

  // Category bars
  const catBars = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
    const pctVal = totalValuation > 0 ? (val / totalValuation) * 100 : 0;
    const color = CATEGORY_COLORS[cat] || "#64748b";
    return `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:12px;font-weight:600;color:#1e293b;">${cat}</span>
        <span style="font-size:12px;color:#64748b;">${fmt(val)} · ${pctVal.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;">
        <div style="background:${color};height:100%;width:${pctVal}%;border-radius:4px;"></div>
      </div>
    </div>`;
  }).join("");

  // Performance detail cards for analyzed funds
  const perfCards = funds.filter(f => performances[f.isin]).map(f => {
    const perf = performances[f.isin];
    const ret = perf.cagr || perf.scheme_returns || {};
    const bench = perf.benchmark_returns || {};
    const benchName = perf.benchmark_name || "–";
    const nav = perf.nav;
    const stats = perf.stats || {};

    const mkRow = (label: string, fund: string, benchmark: string) => {
      const fv = parseFloat((fund || "0").replace(/[^0-9.-]/g, ""));
      const bv = parseFloat((benchmark || "0").replace(/[^0-9.-]/g, ""));
      const better = !isNaN(fv) && !isNaN(bv) && bv !== 0 && fv >= bv;
      const worse  = !isNaN(fv) && !isNaN(bv) && bv !== 0 && fv < bv;
      return `
      <tr>
        <td style="padding:6px 10px;font-size:11px;color:#64748b;">${label}</td>
        <td style="padding:6px 10px;font-size:12px;font-weight:600;text-align:right;color:${better ? "#16a34a" : worse ? "#dc2626" : "#1e293b"};">${fund || "–"}</td>
        <td style="padding:6px 10px;font-size:12px;text-align:right;color:#64748b;">${benchmark || "–"}</td>
      </tr>`;
    };

    return `
    <div style="break-inside:avoid;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">${f.scheme_name}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">ISIN: ${f.isin || "–"}${nav ? ` · NAV ₹${nav.value?.toFixed(4)} (${nav.date})` : ""}</div>
        ${stats.expense_ratio && stats.expense_ratio !== "Data unavailable" ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">Expense Ratio: ${stats.expense_ratio}${stats.aum_crores && stats.aum_crores !== "Data unavailable" ? ` · AUM ₹${stats.aum_crores} Cr` : ""}</div>` : ""}
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">Benchmark: ${benchName}</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:6px 10px;font-size:10px;color:#94a3b8;text-align:left;font-weight:600;">Period</th>
            <th style="padding:6px 10px;font-size:10px;color:#94a3b8;text-align:right;font-weight:600;">Fund Return</th>
            <th style="padding:6px 10px;font-size:10px;color:#94a3b8;text-align:right;font-weight:600;">Benchmark</th>
          </tr>
        </thead>
        <tbody>
          ${mkRow("1 Year", ret["1y"], bench["1y"])}
          ${mkRow("3 Year (CAGR)", ret["3y"], bench["3y"])}
          ${mkRow("5 Year (CAGR)", ret["5y"], bench["5y"])}
        </tbody>
      </table>
    </div>`;
  }).join("");

  const hasPerfCards = Object.keys(performances).length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Portfolio Report – ${cleanFilename(report.filename)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{
    font-family:'Inter',sans-serif;
    background:#f8fafc;
    color:#1e293b;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  .page{padding:40px;}
  h2{font-size:16px;font-weight:700;margin-bottom:14px;color:#1e293b;}
  table{border-collapse:collapse;width:100%;}
  th{background:#f1f5f9;font-size:10px;color:#64748b;font-weight:600;text-align:left;padding:8px 12px;}
  @media print{
    body{background:#f8fafc;}
    .no-print{display:none;}
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;padding:28px 32px;margin-bottom:28px;color:#fff;">
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Portfolio Analysis Report</div>
    <div style="font-size:26px;font-weight:800;color:#d0f70f;margin-bottom:6px;">${cleanFilename(report.filename)}</div>
    <div style="font-size:12px;color:#94a3b8;">Analyzed on ${analyzedDate} · ${funds.length} scheme${funds.length !== 1 ? "s" : ""} · ${accounts.length} account${accounts.length !== 1 ? "s" : ""}</div>
  </div>

  <!-- PORTFOLIO SUMMARY KPI ROW -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px;">
    ${[
      { label: "Total Value",    value: fmt(totalValuation),          sub: `${pct(overallPct)} overall return`, color: absoluteGain >= 0 ? "#16a34a" : "#dc2626" },
      { label: "Approx. CAGR",  value: `${approxCagr.toFixed(1)}%`,  sub: "estimated 2-year",               color: "#3b82f6" },
      { label: "Absolute Gain", value: `${absoluteGain >= 0 ? "+" : ""}${fmt(Math.abs(absoluteGain))}`, sub: `on ${fmt(totalInvested)} invested`, color: absoluteGain >= 0 ? "#16a34a" : "#dc2626" },
      { label: "Total Schemes", value: String(funds.length),           sub: `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`, color: "#8b5cf6" },
    ].map(k => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">${k.label}</div>
      <div style="font-size:20px;font-weight:800;color:#1e293b;">${k.value}</div>
      <div style="font-size:11px;font-weight:600;color:${k.color};margin-top:3px;">${k.sub}</div>
    </div>`).join("")}
  </div>

  <!-- ASSET ALLOCATION -->
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:28px;break-inside:avoid;">
    <h2>Asset Allocation</h2>
    ${catBars}
  </div>

  <!-- HOLDINGS TABLE -->
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
    <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
      <h2 style="margin:0;">Fund Holdings</h2>
    </div>
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>Scheme Name</th>
            <th>Category</th>
            <th style="text-align:right;">Invested</th>
            <th style="text-align:right;">Current Value</th>
            <th style="text-align:right;">Return</th>
            <th style="text-align:right;">1Y CAGR</th>
            <th style="text-align:right;">Benchmark 1Y</th>
            <th>Benchmark Index</th>
          </tr>
        </thead>
        <tbody>${fundRows}</tbody>
      </table>
    </div>
  </div>

  ${hasPerfCards ? `
  <!-- SCHEME PERFORMANCE DETAILS -->
  <div style="margin-bottom:8px;">
    <h2>Scheme Performance Details</h2>
    <p style="font-size:11px;color:#94a3b8;margin-bottom:16px;">For schemes where performance was analyzed</p>
    ${perfCards}
  </div>` : ""}

  <!-- FOOTER -->
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:#94a3b8;">Generated by FinAnalyze · ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</div>
    <div style="font-size:10px;color:#94a3b8;">Data sourced from MFAPI & public benchmark indices</div>
  </div>

</div>
</body>
</html>`;
}

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
