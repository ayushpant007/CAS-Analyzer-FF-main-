import { useParams, useLocation } from "wouter";
import { useReport } from "@/hooks/use-reports";
import { useRef, useState, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ArrowLeft, Calendar, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BarChart2 } from "lucide-react";

const IDEAL_ALLOCATIONS: Record<string, Record<string, Record<string, string>>> = {
  "20-35": {
    "High Aggressive": { "Equity": "85%", "Debt": "5%", "Hybrid": "0%", "Gold/Silver": "5%", "Others": "5%" },
    "Aggressive": { "Equity": "75%", "Debt": "10%", "Hybrid": "5%", "Gold/Silver": "5%", "Others": "5%" },
    "Moderate": { "Equity": "60%", "Debt": "20%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Conservative": { "Equity": "40%", "Debt": "35%", "Hybrid": "15%", "Gold/Silver": "5%", "Others": "5%" }
  },
  "35-50": {
    "High Aggressive": { "Equity": "75%", "Debt": "10%", "Hybrid": "5%", "Gold/Silver": "5%", "Others": "5%" },
    "Aggressive": { "Equity": "65%", "Debt": "15%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Moderate": { "Equity": "50%", "Debt": "30%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Conservative": { "Equity": "30%", "Debt": "50%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" }
  },
  "50-60": {
    "High Aggressive": { "Equity": "65%", "Debt": "15%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Aggressive": { "Equity": "50%", "Debt": "30%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Moderate": { "Equity": "35%", "Debt": "45%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Conservative": { "Equity": "20%", "Debt": "65%", "Hybrid": "5%", "Gold/Silver": "5%", "Others": "5%" }
  },
  "60+": {
    "High Aggressive": { "Equity": "40%", "Debt": "40%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Aggressive": { "Equity": "30%", "Debt": "50%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Moderate": { "Equity": "20%", "Debt": "60%", "Hybrid": "10%", "Gold/Silver": "5%", "Others": "5%" },
    "Conservative": { "Equity": "10%", "Debt": "75%", "Hybrid": "5%", "Gold/Silver": "5%", "Others": "5%" }
  }
};

const CATEGORY_META: Record<string, { color: string }> = {
  "Equity":      { color: "#3b82f6" },
  "Debt":        { color: "#f59e0b" },
  "Hybrid":      { color: "#94a3b8" },
  "Gold/Silver": { color: "#d97706" },
  "Others":      { color: "#10b981" },
};

function calcPerfScore(schemeReturns: any, benchmarkReturns: any) {
  if (!schemeReturns || !benchmarkReturns) return { total: 0, breakDown: { "1y": 0, "3y": 0, "5y": 0 } };
  const pv = (v: string) => parseFloat(v?.replace(/[^\d.-]/g, "") || "0");
  const diff1 = pv(schemeReturns["1y"]) - pv(benchmarkReturns["1y"]);
  const diff3 = pv(schemeReturns["3y"]) - pv(benchmarkReturns["3y"]);
  const diff5 = pv(schemeReturns["5y"]) - pv(benchmarkReturns["5y"]);
  const s1 = diff1 >= 3 ? 10 : diff1 >= 1.5 ? 8 : diff1 >= 0 ? 6 : diff1 >= -1.49 ? 4 : diff1 >= -2.99 ? 2 : 0;
  const s3 = diff3 >= 3 ? 15 : diff3 >= 1.5 ? 13 : diff3 >= 0 ? 11 : diff3 >= -1.49 ? 9 : diff3 >= -2.99 ? 7 : 0;
  const s5 = diff5 >= 3 ? 15 : diff5 >= 1.5 ? 13 : diff5 >= 0 ? 11 : diff5 >= -1.49 ? 9 : diff5 >= -2.99 ? 7 : 0;
  return { total: s1 + s3 + s5, breakDown: { "1y": s1, "3y": s3, "5y": s5 } };
}

export default function ConciseReport() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const reportId = params.id ? parseInt(params.id) : null;
  const { data: report, isLoading } = useReport(reportId);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const storedPerformances = useMemo<Record<string, any>>(() => {
    if (!reportId) return {};
    try { return JSON.parse(localStorage.getItem(`fin_perf_${reportId}`) || "{}"); } catch { return {}; }
  }, [reportId]);

  const storedScoring = useMemo<Record<string, any>>(() => {
    if (!reportId) return {};
    try { return JSON.parse(localStorage.getItem(`fin_scoring_${reportId}`) || "{}"); } catch { return {}; }
  }, [reportId]);

  const analysis = (report?.analysis as any) || {};

  const mfSnapshot = useMemo(() => {
    return (analysis.mf_snapshot || []).map((mf: any) => {
      const units = mf.units || mf.closing_balance || 0;
      const nav = mf.nav ?? 0;
      const valuation = units * nav;
      const unrealised_profit_loss = valuation - (mf.invested_amount || 0);
      return { ...mf, nav, valuation, unrealised_profit_loss };
    });
  }, [analysis.mf_snapshot]);

  const totalInvested = useMemo(() => mfSnapshot.reduce((a: number, m: any) => a + (m.invested_amount || 0), 0), [mfSnapshot]);
  const totalValuation = useMemo(() => mfSnapshot.reduce((a: number, m: any) => a + (m.valuation || 0), 0), [mfSnapshot]);
  const totalUnrealised = useMemo(() => mfSnapshot.reduce((a: number, m: any) => a + (m.unrealised_profit_loss || 0), 0), [mfSnapshot]);

  const investorName = (() => {
    const raw = (analysis.investor_name as string | undefined)?.trim();
    if (raw && raw.length >= 2) {
      const hasSpace = raw.includes(" ");
      const hasOnlyNameChars = /^[a-zA-Z\s.\-']+$/.test(raw);
      const isAllLowerNoSpace = raw === raw.toLowerCase() && !hasSpace;
      if (hasOnlyNameChars && !isAllLowerNoSpace) return raw;
    }
    if (!report?.filename) return "";
    let name = report.filename.replace(/\.pdf$/i, "");
    name = name.replace(/\s*\([A-Z0-9\-\s]+\)\s*/gi, " ").trim();
    name = name.replace(/\b(CDSL|NSDL|BSE|NSE)\b/gi, "").replace(/\s{2,}/g, " ").trim();
    return name;
  })();

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const PAGE_W_PT = 595.28;
      const PAGE_H_PT = 841.89;
      const MARGIN_PT = 28;
      const CONTENT_W_PT = PAGE_W_PT - MARGIN_PT * 2;
      const CONTENT_H_PT = PAGE_H_PT - MARGIN_PT * 2;

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const sections = Array.from(reportRef.current.children) as HTMLElement[];

      let cursorY = MARGIN_PT;
      let firstPage = true;

      const h2cOptions = {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f8fafc",
        logging: false,
        onclone: (_doc: Document, el: HTMLElement) => {
          el.querySelectorAll<HTMLElement>("button, [role='button'], .no-print").forEach(n => { n.style.display = "none"; });
        },
      } as any;

      for (const section of sections) {
        if (!section.textContent?.trim()) continue;
        const canvas = await html2canvas(section, { ...h2cOptions, width: section.scrollWidth });
        const ratio = CONTENT_W_PT / canvas.width;
        const imgH = canvas.height * ratio;
        const imgData = canvas.toDataURL("image/jpeg", 0.93);

        if (!firstPage && cursorY + imgH > PAGE_H_PT - MARGIN_PT) {
          pdf.addPage();
          cursorY = MARGIN_PT;
        }

        if (imgH > CONTENT_H_PT) {
          let srcOffsetPt = 0;
          while (srcOffsetPt < imgH) {
            const sliceH = Math.min(CONTENT_H_PT, imgH - srcOffsetPt);
            const srcY = srcOffsetPt / ratio;
            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceH / ratio;
            const ctx = sliceCanvas.getContext("2d")!;
            ctx.drawImage(canvas, 0, -srcY);
            const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.93);
            if (!firstPage || srcOffsetPt > 0) { pdf.addPage(); cursorY = MARGIN_PT; }
            pdf.addImage(sliceData, "JPEG", MARGIN_PT, cursorY, CONTENT_W_PT, sliceH);
            srcOffsetPt += CONTENT_H_PT;
            firstPage = false;
          }
        } else {
          pdf.addImage(imgData, "JPEG", MARGIN_PT, cursorY, CONTENT_W_PT, imgH);
          cursorY += imgH + 12;
          firstPage = false;
        }
      }

      const name = investorName || "Portfolio";
      pdf.save(`${name}_Concise_Report.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Report not found.
      </div>
    );
  }

  const formatLakh = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(2)} L` : `₹${v.toLocaleString()}`;
  const allCategories = ["Equity", "Debt", "Hybrid", "Gold/Silver", "Others"];
  const parseIdeal = (v: string) => parseFloat(v?.replace("%", "") || "0");
  const idealRaw = IDEAL_ALLOCATIONS[report.ageGroup || ""]?.[report.investorType || ""] || {};

  const actualMap: Record<string, number> = {};
  const typeMap: Record<string, Record<string, number>> = {};
  const totalVal = mfSnapshot.reduce((a: number, m: any) => a + (m.valuation || 0), 0);
  mfSnapshot.forEach((mf: any) => {
    const cat = (mf.fund_category || "").toLowerCase();
    const type = mf.fund_type || "Other";
    const pct = totalVal > 0 ? (mf.valuation / totalVal) * 100 : 0;
    let mainCat = "Others";
    if (cat.includes("equity")) mainCat = "Equity";
    else if (cat.includes("debt")) mainCat = "Debt";
    else if (cat.includes("hybrid")) mainCat = "Hybrid";
    else if (cat.includes("gold") || cat.includes("silver")) mainCat = "Gold/Silver";
    actualMap[mainCat] = (actualMap[mainCat] || 0) + pct;
    if (!typeMap[mainCat]) typeMap[mainCat] = {};
    typeMap[mainCat][type] = (typeMap[mainCat][type] || 0) + pct;
  });

  const categorize = (type: string) => {
    const t = type.toLowerCase().trim();
    if (t === "sip" || ["systematic investment", "purchase"].some(k => t.includes(k))) return "SIP";
    if (t === "swp" || ["systematic withdrawal", "redemption"].some(k => t.includes(k))) return "SWP";
    if (["stp", "stp-out", "stp-in", "systematic transfer", "switch"].some(k => t.includes(k))) return "STP";
    return null;
  };
  const fundCategoryMap: Record<string, string> = {};
  (analysis.mf_snapshot || []).forEach((mf: any) => {
    if (mf.scheme_name) fundCategoryMap[mf.scheme_name] = (mf.fund_category || "").toLowerCase();
  });
  const txSections: Record<string, any[]> = {
    "STP (Systematic Transfer Plan)": [],
    "SIP (Systematic Investment Plan)": [],
    "SWP (Systematic Withdrawal Plan)": []
  };
  (analysis.transactions || []).forEach((tx: any) => {
    const rawType = (tx.type || "").toLowerCase().trim();
    const category = categorize(rawType);
    if (category === "STP") {
      if (rawType === "stp-in" || rawType.includes("switch in")) return;
      if (rawType === "stp") {
        const fundCat = fundCategoryMap[tx.scheme_name] || "";
        if (fundCat && fundCat !== "debt") return;
      }
      txSections["STP (Systematic Transfer Plan)"].push(tx);
    } else if (category === "SIP") txSections["SIP (Systematic Investment Plan)"].push(tx);
    else if (category === "SWP") txSections["SWP (Systematic Withdrawal Plan)"].push(tx);
  });

  const getYearMonth = (dateStr: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      const monthMap: Record<string, string> = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
      const year = parts[2].padStart(4, "0");
      const rawM = parts[1];
      const month = isNaN(parseInt(rawM)) ? (monthMap[rawM.toLowerCase().slice(0,3)] ?? "00") : String(parseInt(rawM)).padStart(2, "0");
      return `${year}-${month}`;
    }
    return "";
  };

  const sipItems = txSections["SIP (Systematic Investment Plan)"];
  const latestMonthByScheme: Record<string, string> = {};
  sipItems.forEach((tx: any) => {
    const key = tx.scheme_name || "unknown";
    const ym = getYearMonth(tx.date);
    if (!latestMonthByScheme[key] || ym > latestMonthByScheme[key]) latestMonthByScheme[key] = ym;
  });
  txSections["SIP (Systematic Investment Plan)"] = sipItems.filter((tx: any) => getYearMonth(tx.date) === latestMonthByScheme[tx.scheme_name || "unknown"]);

  return (
    <div className="min-h-screen font-sans pb-20 relative">
      <AnimatedBackground />
      {/* Navbar */}
      <nav className="border-b" style={{ background: "rgba(10,14,46,0.6)", backdropFilter: "blur(16px)", borderColor: "rgba(96,165,250,0.15)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg" style={{ background: "linear-gradient(135deg,#3b6fff,#9333ea)", boxShadow: "0 0 16px rgba(59,111,255,0.5)" }}>
              <BarChart2 className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold font-display" style={{ background: "linear-gradient(90deg,#60a5fa,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              FinAnalyze
            </span>
          </div>
          <span className="text-slate-400 text-sm font-medium">AI-Powered Portfolio Insights</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4 relative z-10">
        {/* Top bar: Back + title + Download */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Full Report
          </button>
          <Button
            onClick={downloadPDF}
            disabled={isDownloading}
            className="bg-slate-900 text-white hover:bg-slate-700"
            data-testid="button-download-concise-pdf"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isDownloading ? "Generating PDF..." : "Download PDF"}
          </Button>
        </div>

        {/* Report content */}
        <div ref={reportRef} className="space-y-6">

          {/* Header */}
          <div className="pb-4 border-b border-slate-200/20">
            {investorName && <h1 className="text-3xl font-bold text-[#d0f70f] mb-1">{investorName}</h1>}
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Concise Report · Analyzed on {report.createdAt ? format(new Date(report.createdAt), "MMMM d, yyyy") : "Unknown Date"}</span>
            </div>
          </div>

          {/* 1. Portfolio Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 pt-5 pb-2 border-b border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Portfolio Overview&nbsp;&nbsp;·&nbsp;&nbsp;{format(new Date(), "MMM d, yyyy")}
              </p>
            </div>
            <div className="p-5 space-y-5">
              {(() => {
                const absoluteReturn = totalValuation - totalInvested;
                const absoluteReturnPct = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;
                const approxCagr = totalInvested > 0 ? ((Math.pow(totalValuation / totalInvested, 1 / 2) - 1) * 100) : 0;
                const accounts = analysis.account_summaries || [];
                const totalSchemes = mfSnapshot.length;
                const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444'];
                const pieData = accounts.map((a: any) => ({ name: a.type, value: a.value || 0 }));
                const pieTotal = accounts.reduce((s: number, a: any) => s + (a.value || 0), 0);
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl bg-slate-50">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Value</p>
                        <p className="text-xl font-bold text-slate-900">{formatLakh(totalValuation)}</p>
                        <p className={`text-xs font-semibold mt-0.5 ${absoluteReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {absoluteReturn >= 0 ? '+' : ''}{absoluteReturnPct.toFixed(1)}% overall return
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Approx. CAGR</p>
                        <p className="text-xl font-bold text-slate-900">{approxCagr.toFixed(1)}%</p>
                        <p className="text-xs text-slate-400 mt-0.5">estimated 2-year</p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Absolute Gain</p>
                        <p className={`text-xl font-bold ${absoluteReturn >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {absoluteReturn >= 0 ? '+' : ''}{formatLakh(Math.abs(absoluteReturn))}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${absoluteReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          on ₹{(totalInvested / 100000).toFixed(2)} L invested
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Schemes</p>
                        <p className="text-xl font-bold text-slate-900">{totalSchemes}</p>
                        <p className="text-xs text-slate-400 mt-0.5">across {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Allocation Donut */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Allocation</p>
                        {accounts.length > 0 ? (
                          <div className="flex items-center gap-4">
                            <PieChart width={130} height={130}>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                                {pieData.map((_: any, idx: number) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                              </Pie>
                              <RechartsTooltip formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            </PieChart>
                            <div className="flex flex-col gap-2 flex-1">
                              {accounts.map((a: any, idx: number) => {
                                const pct = pieTotal > 0 ? ((a.value / pieTotal) * 100).toFixed(1) : '0.0';
                                return (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    <span className="text-xs text-slate-600 flex-1 leading-tight">{a.type}</span>
                                    <span className="text-xs font-bold text-slate-700">{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : <div className="h-36 flex items-center justify-center text-slate-400 text-xs">No allocation data</div>}
                      </div>
                      {/* Accounts */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Accounts</p>
                        <div className="space-y-2">
                          {accounts.map((acc: any, idx: number) => {
                            const initials = (acc.type || '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                            const pct = pieTotal > 0 ? ((acc.value / pieTotal) * 100).toFixed(1) : '0.0';
                            return (
                              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                                  {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{acc.type}</p>
                                  <p className="text-[10px] text-slate-400 leading-tight truncate">{acc.count} scheme{acc.count !== 1 ? 's' : ''}{acc.details ? ` · ${acc.details}` : ''}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs font-bold text-slate-800">{formatLakh(acc.value || 0)}</p>
                                  <p className="text-[10px] text-slate-400">{pct}%</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* 2. Asset Allocation Check */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {(() => {
              const idealMap: Record<string, number> = {};
              allCategories.forEach(c => { idealMap[c] = parseIdeal(idealRaw[c]); });
              const actMap: Record<string, number> = {};
              mfSnapshot.forEach((mf: any) => {
                const cat = (mf.fund_category || "").toLowerCase();
                const pct = totalVal > 0 ? (mf.valuation / totalVal) * 100 : 0;
                if (cat.includes("equity")) actMap["Equity"] = (actMap["Equity"] || 0) + pct;
                else if (cat.includes("debt")) actMap["Debt"] = (actMap["Debt"] || 0) + pct;
                else if (cat.includes("hybrid")) actMap["Hybrid"] = (actMap["Hybrid"] || 0) + pct;
                else if (cat.includes("gold") || cat.includes("silver")) actMap["Gold/Silver"] = (actMap["Gold/Silver"] || 0) + pct;
                else actMap["Others"] = (actMap["Others"] || 0) + pct;
              });
              let healthScore = 100;
              allCategories.forEach(c => { healthScore -= Math.abs((actMap[c] || 0) - (idealMap[c] || 0)) * 0.8; });
              healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
              const healthLabel = healthScore >= 80 ? "Well balanced" : healthScore >= 60 ? "Needs rebalancing" : "Needs attention";
              const healthColor = healthScore >= 80 ? "#10b981" : healthScore >= 60 ? "#f59e0b" : "#ef4444";
              const missingCategories = allCategories.filter(c => (actMap[c] || 0) < 0.01 && idealMap[c] > 0);
              const fmtDiff = (actual: number, ideal: number) => {
                const d = actual - ideal;
                return `${d >= 0 ? '+' : ''}${Math.abs(d).toFixed(2)}% ${d >= 0 ? "over" : "under"} ideal`;
              };
              const equityActual = actMap["Equity"] || 0;
              const equityIdeal = idealMap["Equity"] || 0;
              const debtActual = actMap["Debt"] || 0;
              const debtIdeal = idealMap["Debt"] || 0;
              return (
                <>
                  <div className="px-6 pt-5 pb-4 flex items-start justify-between border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Asset allocation check</h3>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full border border-blue-100">{report.investorType || "—"}</span>
                        <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">Age {report.ageGroup || "—"}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-medium mb-0.5">Overall health</div>
                      <div className="text-3xl font-bold" style={{ color: healthColor }}>{healthScore}<span className="text-base font-semibold text-slate-400">/100</span></div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: `${healthColor}18`, color: healthColor }}>{healthLabel}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-0 border-b border-slate-100">
                    <div className="px-6 py-4 border-r border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Equity Exposure</div>
                      <div className="text-2xl font-bold text-blue-600">{equityActual.toFixed(2)}%</div>
                      <div className="text-xs mt-0.5" style={{ color: equityActual > equityIdeal ? "#ef4444" : "#10b981" }}>{fmtDiff(equityActual, equityIdeal)}</div>
                    </div>
                    <div className="px-6 py-4 border-r border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Debt Exposure</div>
                      <div className="text-2xl font-bold text-amber-500">{debtActual.toFixed(2)}%</div>
                      <div className="text-xs mt-0.5" style={{ color: debtActual > debtIdeal ? "#ef4444" : "#10b981" }}>{fmtDiff(debtActual, debtIdeal)}</div>
                    </div>
                    <div className="px-6 py-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Missing Allocation</div>
                      {missingCategories.length === 0 ? (
                        <div className="text-2xl font-bold text-emerald-500">None</div>
                      ) : (
                        <>
                          <div className="text-2xl font-bold text-red-500">{missingCategories.length} categories</div>
                          <div className="text-xs text-slate-400 mt-0.5">{missingCategories.join(", ")}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Category</th>
                          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actual</th>
                          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ideal</th>
                          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCategories.map(cat => {
                          const actual = actMap[cat] || 0;
                          const ideal = idealMap[cat] || 0;
                          const meta = CATEGORY_META[cat] || { color: "#64748b" };
                          const diff = actual - ideal;
                          let statusColor = "#10b981";
                          if (Math.abs(diff) >= 1) statusColor = diff > 0 ? "#ef4444" : "#f59e0b";
                          return (
                            <tr key={cat} className="border-b border-slate-100 last:border-0">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                                  <span className="font-semibold text-slate-800 text-sm">{cat}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: actual === 0 ? "#ef4444" : "#1e293b" }}>{actual.toFixed(2)}%</td>
                              <td className="px-5 py-3.5 text-sm text-slate-600 font-medium">{ideal.toFixed(0)}%</td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 bg-slate-100 rounded-full h-2" style={{ maxWidth: 120 }}>
                                    <div className="h-2 rounded-full" style={{ width: `${Math.min(actual, 100)}%`, backgroundColor: meta.color }} />
                                  </div>
                                  <span className="text-xs font-semibold" style={{ color: statusColor }}>
                                    {Math.abs(diff) < 1 ? "On target" : diff > 0 ? "Over" : "Under"}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 3. Category Wise Distribution */}
          <div className="bg-[#f5f0e8] rounded-2xl border border-slate-200 overflow-hidden p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
              Category Wise Distribution · Portfolio Weightage by Fund Category
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {["Equity","Debt","Hybrid","Gold/Silver"].map(cat => {
                const meta = { Equity: { color:"#3b82f6",label:"Equity" }, Debt: { color:"#f59e0b",label:"Debt" }, Hybrid: { color:"#94a3b8",label:"Hybrid" }, "Gold/Silver": { color:"#d97706",label:"Gold / Silver" } }[cat]!;
                const pct = actualMap[cat] || 0;
                const subCount = Object.keys(typeMap[cat] || {}).length;
                return (
                  <div key={cat} className="bg-white rounded-xl p-4 border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: meta.color }}>{meta.label}</div>
                    <div className="text-2xl font-bold text-slate-800">{pct.toFixed(2)}%</div>
                    <div className="text-xs text-slate-400 mt-0.5">{subCount > 0 ? `${subCount} sub-categor${subCount === 1 ? "y" : "ies"}` : "No data"}</div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allCategories.filter(c => (actualMap[c] || 0) > 0.01).map(cat => {
                const meta = { Equity:{color:"#3b82f6",abbr:"EQ",label:"Equity"}, Debt:{color:"#f59e0b",abbr:"DB",label:"Debt"}, Hybrid:{color:"#94a3b8",abbr:"HB",label:"Hybrid"}, "Gold/Silver":{color:"#d97706",abbr:"GS",label:"Gold / Silver"}, Others:{color:"#10b981",abbr:"OT",label:"Others"} }[cat] || {color:"#64748b",abbr:"OT",label:cat};
                const pct = actualMap[cat] || 0;
                const subs = Object.entries(typeMap[cat] || {}).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={cat} className="bg-white rounded-xl border border-slate-100 p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: meta.color }}>{meta.abbr}</span>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{meta.label}</div>
                        <div className="text-xs text-slate-400">{pct.toFixed(2)}% of portfolio</div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full mb-4 overflow-hidden bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: meta.color }} />
                    </div>
                    <div className="space-y-2">
                      {subs.map(([type, subPct]) => (
                        <div key={type} className="flex items-center gap-3">
                          <span className="text-xs text-slate-600 w-28 flex-shrink-0 truncate">{type}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(subPct, 100)}%`, backgroundColor: meta.color }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 w-12 text-right">{subPct.toFixed(2)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Concise Performance Check */}
          {Object.keys(storedPerformances).length > 0 && (() => {
            const RATING_STYLE: Record<string, { pill: string; bar: string }> = {
              "Excellent": { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "#10b981" },
              "Good":      { pill: "bg-blue-100 text-blue-700 border-blue-200",          bar: "#3b82f6" },
              "Average":   { pill: "bg-amber-100 text-amber-700 border-amber-200",       bar: "#f59e0b" },
              "Poor":      { pill: "bg-rose-100 text-rose-600 border-rose-200",          bar: "#ef4444" },
              "Very Poor": { pill: "bg-rose-200 text-rose-800 border-rose-300",          bar: "#b91c1c" },
            };
            const rows = mfSnapshot
              .filter((mf: any) => storedPerformances[mf.isin])
              .map((mf: any) => {
                const perf = storedPerformances[mf.isin];
                const sc = storedScoring[mf.isin];
                const perfScore = calcPerfScore(perf?.cagr, perf?.benchmark_returns);
                const scoringTotal = sc?.totalScore ?? 0;
                const combined = scoringTotal + perfScore.total;
                const maxScore = perf ? 80 : 40;
                const rating: string = sc?.fundRating || "";
                const pct = maxScore > 0 ? Math.round((combined / maxScore) * 100) : 0;
                const cagr1y = perf?.cagr?.["1y"] ?? "—";
                const cagr3y = perf?.cagr?.["3y"] ?? "—";
                const cagr5y = perf?.cagr?.["5y"] ?? "—";
                const bm1y = perf?.benchmark_returns?.["1y"] ?? null;
                const bm3y = perf?.benchmark_returns?.["3y"] ?? null;
                const bm5y = perf?.benchmark_returns?.["5y"] ?? null;
                return { mf, perf, sc, perfScore, combined, maxScore, rating, pct, cagr1y, cagr3y, cagr5y, bm1y, bm3y, bm5y };
              });

            return (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-violet-600 to-indigo-700 p-4 text-white">
                  <h3 className="text-lg font-bold">Concise Performance Check</h3>
                  <p className="text-violet-200 text-xs mt-0.5">Fund-level scores vs benchmark · Risk Metrics Summary</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 w-8">#</th>
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400">Fund Name</th>
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">Risk Type</th>
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">1Y CAGR</th>
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">3Y CAGR</th>
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">5Y CAGR</th>
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">Score</th>
                        <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r, idx) => {
                        const style = RATING_STYLE[r.rating] ?? { pill: "bg-slate-100 text-slate-500 border-slate-200", bar: "#94a3b8" };
                        const fmtCagr = (v: string, bm: string | null) => {
                          const val = parseFloat(v?.replace(/[^\d.-]/g, "") || "");
                          const bmVal = parseFloat(bm?.replace(/[^\d.-]/g, "") ?? "");
                          const isGood = !isNaN(val) && !isNaN(bmVal) && val >= bmVal;
                          const isAvail = !isNaN(val);
                          return (
                            <span className={`font-bold text-[11px] ${!isAvail ? "text-slate-300" : isGood ? "text-emerald-600" : "text-rose-500"}`}>
                              {isAvail ? `${val.toFixed(1)}%` : "—"}
                              {isAvail && !isNaN(bmVal) && (
                                <span className="block text-[9px] font-normal text-slate-400">BM: {bmVal.toFixed(1)}%</span>
                              )}
                            </span>
                          );
                        };
                        return (
                          <tr key={r.mf.isin || idx} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-violet-50/30 transition-colors`}>
                            <td className="px-4 py-3 text-[10px] text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5 max-w-[260px]">
                                <span className="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2">{r.mf.scheme_name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-100">{r.mf.fund_category || "—"}</span>
                                  <span className="text-[9px] text-slate-400">{r.mf.isin}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                {r.mf.fund_type || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">{fmtCagr(r.cagr1y, r.bm1y)}</td>
                            <td className="px-4 py-3 text-center">{fmtCagr(r.cagr3y, r.bm3y)}</td>
                            <td className="px-4 py-3 text-center">{fmtCagr(r.cagr5y, r.bm5y)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[13px] font-black text-slate-800">{r.combined}<span className="text-[9px] font-normal text-slate-400">/{r.maxScore}</span></span>
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, backgroundColor: style.bar }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.rating ? (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide border ${style.pill}`}>
                                  {r.rating}
                                </span>
                              ) : <span className="text-slate-300 text-[10px]">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* 5. Portfolio Snapshot - Mutual Fund Units */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
              <h3 className="text-lg font-bold">Portfolio Snapshot - Mutual Fund Units</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-100 uppercase tracking-wide text-[9px]">
                  <tr>
                    <th className="px-3 py-2">Scheme</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Units</th>
                    <th className="px-3 py-2 text-right">NAV (₹)</th>
                    <th className="px-3 py-2 text-right">Invested (₹)</th>
                    <th className="px-3 py-2 text-right">Value (₹)</th>
                    <th className="px-3 py-2 text-right">P/L (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mfSnapshot.map((mf: any, i: number) => {
                    const name = (mf.scheme_name || "")
                      .replace(/\s*\(Erstwhile[^)]*\)/gi, "")
                      .replace(/\s*-\s*(Regular|Direct) Plan\s*-?\s*/gi, " ")
                      .replace(/\s*Growth (Option|Plan)?\s*/gi, "")
                      .replace(/\s*-\s*Growth\s*$/i, "")
                      .replace(/\s+/g, " ").trim();
                    const shortName = name.length > 40 ? name.slice(0, 38) + "…" : name;
                    return (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2 font-semibold text-slate-700 max-w-[200px]" title={mf.scheme_name}>{shortName}</td>
                        <td className="px-3 py-2 text-slate-600">{mf.fund_category || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{(mf.units || mf.closing_balance)?.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                        <td className="px-3 py-2 text-right font-mono">{mf.nav?.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{mf.invested_amount?.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{mf.valuation?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${mf.unrealised_profit_loss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {mf.unrealised_profit_loss?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-800 text-white font-bold text-[10px]">
                    <td colSpan={4} className="px-3 py-2 text-right uppercase tracking-wider text-[9px]">Grand Total</td>
                    <td className="px-3 py-2 text-right">₹{totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right">₹{totalValuation.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right">₹{totalUnrealised.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
