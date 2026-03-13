import { type EnhancedReport } from "@/hooks/use-reports";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, AreaChart, Area } from "recharts";
import { ArrowUpRight, TrendingUp, AlertTriangle, Lightbulb, PieChart as PieChartIcon, Calendar, Activity, Loader2, Download, Flag, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface SchemePerformanceData {
  scheme_returns: { "1y": string; "3y": string; "5y": string };
  benchmark_name: string;
  benchmark_returns: { "1y": string; "3y": string; "5y": string };
  nav?: { value: number; date: string };
  data_sources?: { returns: string; benchmark: string };
}

const CATEGORY_META: Record<string, { color: string; subtitle: string }> = {
  "Equity":     { color: "#3b82f6", subtitle: "Large, mid & small cap" },
  "Debt":       { color: "#f59e0b", subtitle: "Bonds & fixed income" },
  "Hybrid":     { color: "#94a3b8", subtitle: "Balanced & multi-asset" },
  "Gold/Silver":{ color: "#d97706", subtitle: "Commodity & precious metals" },
  "Others":     { color: "#10b981", subtitle: "REITs, InvITs & alternatives" },
};

function AssetCategoryRow({ 
  category, 
  actual, 
  ideal,
}: { 
  category: string; 
  actual: number; 
  ideal: number;
}) {
  const meta = CATEGORY_META[category] || { color: "#64748b", subtitle: "" };
  const max = Math.max(actual, ideal, 1);
  const actWidth = (actual / max) * 100;
  const idealWidth = (ideal / max) * 100;

  let dotColor = "#10b981";
  const diff = actual - ideal;
  if (Math.abs(diff) < 1) dotColor = "#10b981";
  else if (diff > 0) dotColor = "#ef4444";
  else dotColor = "#f59e0b";

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
          <div>
            <div className="font-semibold text-slate-800 text-sm">{category}</div>
            <div className="text-xs text-slate-400">{meta.subtitle}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: actual === 0 ? "#ef4444" : "#1e293b" }}>
        {actual.toFixed(2)}%
      </td>
      <td className="px-5 py-3.5 text-sm text-slate-600 font-medium">
        {Number(ideal).toFixed(0)}%
      </td>
      <td className="px-5 py-3.5 w-56">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 w-6 flex-shrink-0">Act</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2 relative">
              <div
                className="h-2 rounded-full"
                style={{ width: `${actWidth}%`, backgroundColor: meta.color }}
              />
            </div>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 w-6 flex-shrink-0">Ideal</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2 relative">
              <div
                className="h-2 rounded-full bg-slate-300"
                style={{ width: `${idealWidth}%` }}
              />
            </div>
            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-300" />
          </div>
        </div>
      </td>
    </tr>
  );
}

function PerformanceRow({ scheme, reportId }: { scheme: any, reportId: number }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SchemePerformanceData | null>(null);
  const { toast } = useToast();

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scheme-performance/${scheme.isin}?reportId=${reportId}`);
      if (!res.ok) throw new Error("Failed to fetch performance data");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      toast({
        title: "Analysis Failed",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePerformanceScore = (schemeReturns: any, benchmarkReturns: any) => {
    if (!schemeReturns || !benchmarkReturns) return { total: 0, breakDown: { "1y": 0, "3y": 0, "5y": 0 } };
    
    const parseVal = (v: string) => parseFloat(v?.replace(/[^\d.-]/g, '') || "0");
    
    const s1 = parseVal(schemeReturns["1y"]);
    const b1 = parseVal(benchmarkReturns["1y"]);
    const s3 = parseVal(schemeReturns["3y"]);
    const b3 = parseVal(benchmarkReturns["3y"]);
    const s5 = parseVal(schemeReturns["5y"]);
    const b5 = parseVal(benchmarkReturns["5y"]);

    const getScore1Y = (diff: number) => {
      if (diff >= 3) return 10;
      if (diff >= 1.5) return 8;
      if (diff >= 0) return 6;
      if (diff >= -1.49) return 4;
      if (diff >= -2.99) return 2;
      return 0;
    };

    const getScoreLongTerm = (diff: number) => {
      if (diff >= 3) return 15;
      if (diff >= 1.5) return 13;
      if (diff >= 0) return 11;
      if (diff >= -1.49) return 9;
      if (diff >= -2.99) return 7;
      return 0;
    };

    const score1y = getScore1Y(s1 - b1);
    const score3y = getScoreLongTerm(s3 - b3);
    const score5y = getScoreLongTerm(s5 - b5);

    return {
      total: score1y + score3y + score5y,
      breakDown: { "1y": score1y, "3y": score3y, "5y": score5y }
    };
  };

  const classifyPerformance = (schemeReturns: any, benchmarkReturns: any) => {
    if (!schemeReturns || !benchmarkReturns) return null;
    const s1 = parseFloat(schemeReturns["1y"]?.replace("%", "") || "0");
    const b1 = parseFloat(benchmarkReturns["1y"]?.replace("%", "") || "0");
    const s3 = parseFloat(schemeReturns["3y"]?.replace("%", "") || "0");
    const b3 = parseFloat(benchmarkReturns["3y"]?.replace("%", "") || "0");
    const s5 = parseFloat(schemeReturns["5y"]?.replace("%", "") || "0");
    const b5 = parseFloat(benchmarkReturns["5y"]?.replace("%", "") || "0");

    let greenCount = 0;
    let totalValid = 0;

    if (!isNaN(s1) && !isNaN(b1)) { totalValid++; if (s1 > b1) greenCount++; }
    if (!isNaN(s3) && !isNaN(b3)) { totalValid++; if (s3 > b3) greenCount++; }
    if (!isNaN(s5) && !isNaN(b5)) { totalValid++; if (s5 > b5) greenCount++; }

    if (totalValid === 0) return null;
    const ratio = greenCount / totalValid;
    if (ratio >= 0.66) return "green";
    if (ratio >= 0.33) return "yellow";
    return "red";
  };

  const performanceColor = classifyPerformance(data?.scheme_returns, data?.benchmark_returns);

  const compare = (s: string, b: string) => {
    if (!s || !b || s === "N/A" || b === "N/A") return null;
    const sv = parseFloat(s.replace('%', ''));
    const bv = parseFloat(b.replace('%', ''));
    if (isNaN(sv) || isNaN(bv)) return null;
    return sv >= bv ? "green" : "red";
  };

  return (
    <>
      <tr className="hover:bg-slate-50/50 transition-colors">
        <td className="px-6 py-4 font-semibold text-slate-700">{scheme.scheme_name}</td>
        <td className="px-6 py-4 text-right">
          <Button 
            size="sm" 
            variant="outline"
            onClick={analyze} 
            disabled={loading}
            className="hover-elevate"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Analyse Scheme
          </Button>
        </td>
      </tr>
      {data && (
        <tr className="bg-slate-50/50">
          <td colSpan={2} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Scheme CAGR</h4>
                  {data.data_sources?.returns && data.data_sources.returns !== "Data unavailable" && (
                    <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                      {data.data_sources.returns}
                    </span>
                  )}
                </div>
                <div className="flex gap-4">
                  <div className="bg-slate-50 px-3 py-2 rounded-lg">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">1Y</p>
                    <p className="text-sm font-bold text-slate-900">{data.scheme_returns["1y"]}</p>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 rounded-lg">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">3Y</p>
                    <p className="text-sm font-bold text-slate-900">{data.scheme_returns["3y"]}</p>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 rounded-lg">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">5Y</p>
                    <p className="text-sm font-bold text-slate-900">{data.scheme_returns["5y"]}</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Benchmark: {data.benchmark_name}</h4>
                <div className="flex gap-4">
                  <div className="bg-slate-50 px-3 py-2 rounded-lg relative">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">1Y</p>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-1">
                      {data.benchmark_returns["1y"]}
                      <Flag className={`h-3 w-3 ${compare(data.scheme_returns["1y"], data.benchmark_returns["1y"]) === "green" ? "text-emerald-500 fill-emerald-500" : "text-rose-500 fill-rose-500"}`} />
                    </p>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 rounded-lg relative">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">3Y</p>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-1">
                      {data.benchmark_returns["3y"]}
                      <Flag className={`h-3 w-3 ${compare(data.scheme_returns["3y"], data.benchmark_returns["3y"]) === "green" ? "text-emerald-500 fill-emerald-500" : "text-rose-500 fill-rose-500"}`} />
                    </p>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 rounded-lg relative">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">5Y</p>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-1">
                      {data.benchmark_returns["5y"]}
                      <Flag className={`h-3 w-3 ${compare(data.scheme_returns["5y"], data.benchmark_returns["5y"]) === "green" ? "text-emerald-500 fill-emerald-500" : "text-rose-500 fill-rose-500"}`} />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface PerformanceData {
  nav: { value: number; date: string };
  cagr: { "1y": string; "3y": string; "5y": string };
  benchmark_name?: string;
  benchmark_returns?: { "1y": string; "3y": string; "5y": string };
  portfolio: {
    sectors: Array<{ name: string; weight: number }>;
    holdings: Array<{ name: string; weight: number }>;
  };
  stats: { aum_crores: number | string; expense_ratio: string; turnover: string };
  risk_ratios: {
    std_dev: { fund: string; category_avg: string };
    sharpe: { fund: string; category_avg: string };
    beta: { fund: string; category_avg: string };
    alpha: { fund: string; category_avg: string };
  };
  data_sources?: {
    nav: string;
    returns: string;
    risk_metrics: string;
  };
}

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

interface ReportViewProps {
  report: EnhancedReport;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const CATEGORY_AVG_STD_DEV: Record<string, number> = {
  "Large Cap": 12,
  "Large & Mid Cap": 15,
  "Multi Cap": 16,
  "Flexi Cap": 14,
  "Mid Cap": 19,
  "Small Cap": 26,
  "Focused Fund": 18.5,
  "Value Fund": 17.5,
  "Contra Fund": 17.5,
  "ELSS": 16,
  "Sector Funds": 23,
  "Thematic Funds": 21.5,
  "Debt": 12,
  "Hybrid": 12,
  "Gold / Silver": 12,
  "Others": 12
};

const getRiskRating = (score: number) => {
  if (score >= 32) return { text: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (score >= 24) return { text: "Good", color: "text-blue-600", bg: "bg-blue-50" };
  if (score >= 16) return { text: "Average", color: "text-amber-600", bg: "bg-amber-50" };
  if (score >= 8) return { text: "Below Average", color: "text-orange-600", bg: "bg-orange-50" };
  return { text: "Poor", color: "text-rose-600", bg: "bg-rose-50" };
};

const calculateRiskScore = (perf: any) => {
  if (!perf || !perf.risk_ratios || !perf.cagr || !perf.benchmark_returns) return null;

  const parseVal = (v: any) => {
    if (typeof v === 'number') return v;
    const s = String(v || "0");
    return parseFloat(s.replace(/[^\d.-]/g, '') || "0");
  };

  // 1. Alpha Score
  const c1 = parseVal(perf.cagr["1y"]);
  const b1 = parseVal(perf.benchmark_returns["1y"]);
  const c3 = parseVal(perf.cagr["3y"]);
  const b3 = parseVal(perf.benchmark_returns["3y"]);
  const c5 = parseVal(perf.cagr["5y"]);
  const b5 = parseVal(perf.benchmark_returns["5y"]);
  
  const a1 = c1 - b1;
  const a3 = c3 - b3;
  const a5 = c5 - b5;
  const avgAlpha = (a1 + a3 + a5) / 3;

  let alphaScore = 0;
  if (avgAlpha >= 3) alphaScore = 12;
  else if (avgAlpha >= 2) alphaScore = 10;
  else if (avgAlpha >= 1) alphaScore = 8;
  else if (avgAlpha >= 0) alphaScore = 6;
  else if (avgAlpha >= -1) alphaScore = 4;
  else alphaScore = 2;

  // 2. Beta Score
  const beta = parseVal(perf.risk_ratios.beta?.fund);
  let betaScore = 0;
  if (beta >= 0.9 && beta <= 1.1) betaScore = 6;
  else if ((beta >= 0.8 && beta < 0.9) || (beta > 1.1 && beta <= 1.2)) betaScore = 4;
  else if ((beta >= 0.7 && beta < 0.8) || (beta > 1.2 && beta <= 1.3)) betaScore = 2;
  else betaScore = 0;

  // 3. Std Dev Score
  const fundStdDev = parseVal(perf.risk_ratios.std_dev?.fund);
  const category = perf.fund_category || "Others";
  const categoryAvgStdDev = parseVal(perf.risk_ratios.std_dev?.category_avg) || CATEGORY_AVG_STD_DEV[category] || 12;
  const riskGap = fundStdDev - categoryAvgStdDev;
  
  let stdDevScore = 0;
  if (riskGap <= -2) stdDevScore = 7;
  else if (riskGap <= -1) stdDevScore = 6;
  else if (riskGap <= -0.5) stdDevScore = 5;
  else if (riskGap <= 0.49) stdDevScore = 4;
  else if (riskGap <= 0.99) stdDevScore = 2;
  else stdDevScore = 0;

  // 4. Sharpe Ratio Score
  const sharpe = parseVal(perf.risk_ratios.sharpe?.fund);
  let sharpeScore = 0;
  if (sharpe >= 0.20) sharpeScore = 15;
  else if (sharpe >= 0.15) sharpeScore = 12;
  else if (sharpe >= 0.10) sharpeScore = 10;
  else if (sharpe >= 0.05) sharpeScore = 6;
  else if (sharpe >= 0.01) sharpeScore = 3;
  else sharpeScore = 0;

  const totalScore = alphaScore + betaScore + stdDevScore + sharpeScore;

  const getFundRating = (totalPerfScore: number, totalRiskScore: number) => {
    const combinedScore = totalPerfScore + totalRiskScore;
    // Max combined score is 40 (Perf) + 40 (Risk) = 80
    if (combinedScore >= 64) return { text: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" };
    if (combinedScore >= 48) return { text: "Good", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };
    if (combinedScore >= 32) return { text: "Neutral", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
    return { text: "Poor", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" };
  };

  return {
    alphaDiff: avgAlpha,
    alphaScore,
    beta,
    betaScore,
    riskGap,
    stdDevScore,
    sharpe,
    sharpeScore,
    totalScore,
    rating: getRiskRating(totalScore),
    getFundRating
  };
};

export function ReportView({ report }: ReportViewProps) {
  const analysis = report.analysis as any;
  const [analyzingIsin, setAnalyzingIsin] = useState<string | null>(null);
  const [performances, setPerformances] = useState<Record<string, PerformanceData>>({});
  const [scoringRecords, setScoringRecords] = useState<Record<string, any>>({});
  const [manualRemarks, setManualRemarks] = useState<Record<string, string>>({});
  const [manualNavs, setManualNavs] = useState<Record<string, number>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFetchingNav, setIsFetchingNav] = useState(false);
  const [navFetchStatus, setNavFetchStatus] = useState<Record<string, string>>({});
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchAllNavs = async () => {
    const schemes = analysis.mf_snapshot || [];
    if (schemes.length === 0) return;

    setIsFetchingNav(true);
    const schemeNames = schemes.map((s: any) => s.scheme_name).filter(Boolean);
    const statusMap: Record<string, string> = {};
    schemeNames.forEach((n: string) => { statusMap[n] = "loading"; });
    setNavFetchStatus(statusMap);

    try {
      const batchSize = 5;
      for (let i = 0; i < schemeNames.length; i += batchSize) {
        const batch = schemeNames.slice(i, i + batchSize);
        const promises = batch.map(async (name: string) => {
          try {
            const res = await fetch(`/api/nav/${encodeURIComponent(name)}`);
            if (res.ok) {
              const data = await res.json();
              setManualNavs(prev => ({ ...prev, [name]: data.current_nav }));
              setNavFetchStatus(prev => ({ ...prev, [name]: "done" }));
            } else {
              setNavFetchStatus(prev => ({ ...prev, [name]: "not_found" }));
            }
          } catch {
            setNavFetchStatus(prev => ({ ...prev, [name]: "error" }));
          }
        });
        await Promise.all(promises);
      }
      toast({ title: "NAV Updated", description: "Real-time NAV data fetched from MFAPI" });
    } catch (err: any) {
      toast({ title: "NAV Fetch Error", description: err.message, variant: "destructive" });
    } finally {
      setIsFetchingNav(false);
    }
  };

  const mfSnapshot = useMemo(() => {
    return (analysis.mf_snapshot || []).map((mf: any) => {
      const units = mf.units || mf.closing_balance || 0;
      const nav = manualNavs[mf.scheme_name] ?? mf.nav ?? 0;
      const valuation = units * nav;
      const unrealised_profit_loss = valuation - (mf.invested_amount || 0);
      return {
        ...mf,
        nav,
        valuation,
        unrealised_profit_loss
      };
    });
  }, [analysis.mf_snapshot, manualNavs]);

  const totalInvested = useMemo(() => mfSnapshot.reduce((acc: number, curr: any) => acc + (curr.invested_amount || 0), 0), [mfSnapshot]);
  const totalValuation = useMemo(() => mfSnapshot.reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0), [mfSnapshot]);
  const totalUnrealised = useMemo(() => mfSnapshot.reduce((acc: number, curr: any) => acc + (curr.unrealised_profit_loss || 0), 0), [mfSnapshot]);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);

    try {
      const element = reportRef.current;

      const savedStyle = {
        height: element.style.height,
        maxHeight: element.style.maxHeight,
        overflow: element.style.overflow,
      };
      element.style.height = "auto";
      element.style.maxHeight = "none";
      element.style.overflow = "visible";

      const captureWidth = element.scrollWidth;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f8fafc",
        windowWidth: captureWidth,
        windowHeight: element.scrollHeight,
        width: captureWidth,
        scrollX: 0,
        scrollY: 0,
        onclone: (_doc, clonedElement) => {
          // 1. Fix all overflow clipping and positioning issues
          const allEls = Array.from(clonedElement.querySelectorAll("*")) as HTMLElement[];
          allEls.forEach((el) => {
            const cs = window.getComputedStyle(el);
            if (cs.overflow === "hidden" || cs.overflowY === "hidden" || cs.overflowX === "hidden") {
              el.style.overflow = "visible";
              el.style.overflowX = "visible";
              el.style.overflowY = "visible";
            }
            if (cs.maxHeight && cs.maxHeight !== "none" && cs.maxHeight !== "") {
              el.style.maxHeight = "none";
            }
            if (cs.position === "fixed") {
              el.style.position = "absolute";
            }
          });

          // 2. Lock the cloned root to the capture width
          clonedElement.style.width = captureWidth + "px";
          clonedElement.style.minWidth = captureWidth + "px";

          // 3. Replace input elements with spans that show the live value
          const originalInputs = Array.from(element.querySelectorAll("input"));
          const clonedInputs = Array.from(clonedElement.querySelectorAll("input"));
          originalInputs.forEach((orig, i) => {
            const cloned = clonedInputs[i] as HTMLInputElement | undefined;
            if (!cloned) return;
            const liveValue = orig.value;
            const span = _doc.createElement("span");
            span.textContent = liveValue;
            span.style.display = "inline-block";
            span.style.width = orig.offsetWidth + "px";
            span.style.minWidth = orig.offsetWidth + "px";
            span.style.height = orig.offsetHeight + "px";
            span.style.lineHeight = orig.offsetHeight + "px";
            span.style.textAlign = "right";
            span.style.fontFamily = "ui-monospace, monospace";
            span.style.fontSize = "12px";
            span.style.padding = "0 6px";
            span.style.verticalAlign = "middle";
            span.style.border = "1px solid #e2e8f0";
            span.style.borderRadius = "6px";
            span.style.background = "#fff";
            span.style.color = "#1e293b";
            span.style.boxSizing = "border-box";
            cloned.replaceWith(span);
          });
        },
      });

      element.style.height = savedStyle.height;
      element.style.maxHeight = savedStyle.maxHeight;
      element.style.overflow = savedStyle.overflow;

      const imgData = canvas.toDataURL("image/jpeg", 0.85);

      const pxToMm = 0.264583;
      const pageWidthMm = canvas.width * pxToMm;
      const pageHeightMm = canvas.height * pxToMm;

      const pdf = new jsPDF({
        orientation: pageWidthMm > pageHeightMm ? "l" : "p",
        unit: "mm",
        format: [pageWidthMm, pageHeightMm],
        compress: true,
      });

      pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, pageHeightMm, undefined, "FAST");

      pdf.save(`FinAnalyze_Report_${report.filename.replace(/\.[^/.]+$/, "")}.pdf`);

      toast({
        title: "Success",
        description: "Report downloaded as a single continuous document.",
      });
    } catch (err: any) {
      console.error("PDF Export Error:", err);
      toast({
        title: "Download Failed",
        description: "There was an error generating your report.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const calculatePerformanceScore = (schemeReturns: any, benchmarkReturns: any) => {
    if (!schemeReturns || !benchmarkReturns) return { total: 0, breakDown: { "1y": 0, "3y": 0, "5y": 0 } };
    
    const parseVal = (v: string) => parseFloat(v?.replace(/[^\d.-]/g, '') || "0");
    
    const s1 = parseVal(schemeReturns["1y"]);
    const b1 = parseVal(benchmarkReturns["1y"]);
    const s3 = parseVal(schemeReturns["3y"]);
    const b3 = parseVal(benchmarkReturns["3y"]);
    const s5 = parseVal(schemeReturns["5y"]);
    const b5 = parseVal(benchmarkReturns["5y"]);

    const getScore1Y = (diff: number) => {
      if (diff >= 3) return 10;
      if (diff >= 1.5) return 8;
      if (diff >= 0) return 6;
      if (diff >= -1.49) return 4;
      if (diff >= -2.99) return 2;
      return 0;
    };

    const getScoreLongTerm = (diff: number) => {
      if (diff >= 3) return 15;
      if (diff >= 1.5) return 13;
      if (diff >= 0) return 11;
      if (diff >= -1.49) return 9;
      if (diff >= -2.99) return 7;
      return 0;
    };

    const score1y = getScore1Y(s1 - b1);
    const score3y = getScoreLongTerm(s3 - b3);
    const score5y = getScoreLongTerm(s5 - b5);

    return {
      total: score1y + score3y + score5y,
      breakDown: { "1y": score1y, "3y": score3y, "5y": score5y }
    };
  };

  const analyzePerformance = async (isin: string, schemeName?: string) => {
    if (!isin) return;
    setAnalyzingIsin(isin);
    try {
      const plan = schemeName?.toLowerCase().includes("direct") ? "Direct" : "Regular";
      const scoringParams = new URLSearchParams({ ...(schemeName ? { schemeName } : {}), plan });
      const [perfRes, scoringRes] = await Promise.allSettled([
        fetch(`/api/scrape-performance/${isin}?reportId=${report.id}`),
        fetch(`/api/scoring/${encodeURIComponent(isin)}?${scoringParams}`)
      ]);

      if (perfRes.status === "fulfilled" && perfRes.value.ok) {
        const data = await perfRes.value.json();
        setPerformances(prev => ({ ...prev, [isin]: data }));
      } else if (perfRes.status === "fulfilled") {
        const errorData = await perfRes.value.json();
        throw new Error(errorData.message || "Failed to fetch performance data");
      }

      if (scoringRes.status === "fulfilled" && scoringRes.value.ok) {
        const scoringData = await scoringRes.value.json();
        setScoringRecords(prev => ({ ...prev, [isin]: scoringData }));
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setAnalyzingIsin(null);
    }
  };

  const classifyPerformance = (schemeReturns: any, benchmarkReturns: any) => {
    if (!schemeReturns || !benchmarkReturns) return null;
    const s1 = parseFloat(schemeReturns["1y"]?.replace("%", "") || "0");
    const b1 = parseFloat(benchmarkReturns["1y"]?.replace("%", "") || "0");
    const s3 = parseFloat(schemeReturns["3y"]?.replace("%", "") || "0");
    const b3 = parseFloat(benchmarkReturns["3y"]?.replace("%", "") || "0");
    const s5 = parseFloat(schemeReturns["5y"]?.replace("%", "") || "0");
    const b5 = parseFloat(benchmarkReturns["5y"]?.replace("%", "") || "0");

    let greenCount = 0;
    let totalValid = 0;

    if (!isNaN(s1) && !isNaN(b1)) { totalValid++; if (s1 > b1) greenCount++; }
    if (!isNaN(s3) && !isNaN(b3)) { totalValid++; if (s3 > b3) greenCount++; }
    if (!isNaN(s5) && !isNaN(b5)) { totalValid++; if (s5 > b5) greenCount++; }

    if (totalValid === 0) return null;
    const ratio = greenCount / totalValid;
    if (ratio >= 0.66) return "green";
    if (ratio >= 0.33) return "yellow";
    return "red";
  };

  const performanceClassification = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    Object.values(performances).forEach((p: any) => {
      const s1 = parseFloat(p.cagr?.["1y"]?.replace("%", "") || "0");
      const b1 = parseFloat(p.benchmark_returns?.["1y"]?.replace("%", "") || "0");
      const s3 = parseFloat(p.cagr?.["3y"]?.replace("%", "") || "0");
      const b3 = parseFloat(p.benchmark_returns?.["3y"]?.replace("%", "") || "0");
      const s5 = parseFloat(p.cagr?.["5y"]?.replace("%", "") || "0");
      const b5 = parseFloat(p.benchmark_returns?.["5y"]?.replace("%", "") || "0");

      let greenCount = 0;
      let totalValid = 0;

      if (!isNaN(s1) && !isNaN(b1)) { totalValid++; if (s1 > b1) greenCount++; }
      if (!isNaN(s3) && !isNaN(b3)) { totalValid++; if (s3 > b3) greenCount++; }
      if (!isNaN(s5) && !isNaN(b5)) { totalValid++; if (s5 > b5) greenCount++; }

      if (totalValid === 0) return;
      const ratio = greenCount / totalValid;

      if (ratio >= 0.66) counts.green++;
      else if (ratio >= 0.33) counts.yellow++;
      else counts.red++;
    });
    return counts;
  }, [performances]);

  const getClassifiedColor = (p: any) => {
    const s1 = parseFloat(p.cagr?.["1y"]?.replace("%", "") || "0");
    const b1 = parseFloat(p.benchmark_returns?.["1y"]?.replace("%", "") || "0");
    const s3 = parseFloat(p.cagr?.["3y"]?.replace("%", "") || "0");
    const b3 = parseFloat(p.benchmark_returns?.["3y"]?.replace("%", "") || "0");
    const s5 = parseFloat(p.cagr?.["5y"]?.replace("%", "") || "0");
    const b5 = parseFloat(p.benchmark_returns?.["5y"]?.replace("%", "") || "0");

    let greenCount = 0;
    let totalValid = 0;

    if (!isNaN(s1) && !isNaN(b1)) { totalValid++; if (s1 > b1) greenCount++; }
    if (!isNaN(s3) && !isNaN(b3)) { totalValid++; if (s3 > b3) greenCount++; }
    if (!isNaN(s5) && !isNaN(b5)) { totalValid++; if (s5 > b5) greenCount++; }

    if (totalValid === 0) return "slate";
    const ratio = greenCount / totalValid;
    if (ratio >= 0.66) return "emerald";
    if (ratio >= 0.33) return "amber";
    return "rose";
  };

  const cleanFilename = (filename: string) => {
    if (!filename) return "";
    // Remove .pdf extension (case insensitive)
    let name = filename.replace(/\.pdf$/i, "");
    // Remove pattern like (AJGPA8088H) - parenthesis with alphanumeric content
    name = name.replace(/\s*\([A-Z0-9\-\s]+\)\s*/gi, " ").trim();
    return name;
  };
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end py-2">
        <Button 
          onClick={downloadPDF} 
          disabled={isDownloading}
          className="hover-elevate bg-slate-900 text-white"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isDownloading ? "Generating PDF..." : "Download Full Report"}
        </Button>
      </div>
      <motion.div 
        ref={reportRef}
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8 p-4 md:p-8"
      >
        {/* Header Section */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold font-display mb-1 text-[#d0f70f]">{cleanFilename(report.filename)}</h1>
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Analyzed on {report.createdAt ? format(new Date(report.createdAt), "MMMM d, yyyy") : "Unknown Date"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100">
          <TrendingUp className="w-4 h-4" />
          <span className="font-semibold text-sm">Analysis Complete</span>
        </div>
      </motion.div>

      {/* Portfolio Overview Dashboard */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Dashboard Header */}
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Portfolio Overview&nbsp;&nbsp;·&nbsp;&nbsp;{format(new Date(), "MMM d, yyyy")}
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* KPI Row */}
          {(() => {
            const totalSchemes = (analysis.mf_snapshot || []).length;
            const absoluteReturn = totalValuation - totalInvested;
            const absoluteReturnPct = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;
            const approxCagr = totalInvested > 0 ? ((Math.pow(totalValuation / totalInvested, 1 / 2) - 1) * 100) : 0;
            const accounts = analysis.account_summaries || [];
            const formatLakh = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(2)} L` : `₹${v.toLocaleString()}`;

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

                {/* Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 6-Month Growth */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">6-Month Growth</p>
                    {(analysis.historical_valuations || []).length > 0 ? (
                      <ResponsiveContainer width="100%" height={150}>
                        <AreaChart data={analysis.historical_valuations} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month_year" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} width={36} />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                            formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Value']}
                          />
                          <Area type="monotone" dataKey="valuation" stroke="#3b82f6" strokeWidth={2} fill="url(#growthGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-36 flex items-center justify-center text-slate-400 text-xs">No historical data</div>
                    )}
                  </div>

                  {/* Allocation Donut */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Allocation</p>
                    {accounts.length > 0 ? (() => {
                      const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                      const total = accounts.reduce((s: number, a: any) => s + (a.value || 0), 0);
                      const pieData = accounts.map((a: any) => ({ name: a.type, value: a.value || 0 }));
                      return (
                        <div className="flex items-center gap-4">
                          <PieChart width={130} height={130}>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                              {pieData.map((_: any, idx: number) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                          </PieChart>
                          <div className="flex flex-col gap-2 flex-1">
                            {accounts.map((a: any, idx: number) => {
                              const pct = total > 0 ? ((a.value / total) * 100).toFixed(1) : '0.0';
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
                      );
                    })() : (
                      <div className="h-36 flex items-center justify-center text-slate-400 text-xs">No allocation data</div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Accounts + Top Funds */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Accounts */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Accounts</p>
                    <div className="space-y-2">
                      {(() => {
                        const COLORS_ACC = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                        const total = accounts.reduce((s: number, a: any) => s + (a.value || 0), 0);
                        return accounts.map((acc: any, idx: number) => {
                          const initials = (acc.type || '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                          const pct = total > 0 ? ((acc.value / total) * 100).toFixed(1) : '0.0';
                          const bg = COLORS_ACC[idx % COLORS_ACC.length];
                          return (
                            <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: bg }}>
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
                        });
                      })()}
                    </div>
                  </div>

                  {/* Top 3 Mutual Funds */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Top 3 Mutual Funds</p>
                    <div className="space-y-2">
                      {(() => {
                        const RANK_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];
                        const sorted = [...(analysis.mf_snapshot || [])]
                          .filter((m: any) => m.invested_amount > 0)
                          .sort((a: any, b: any) => {
                            const rA = a.invested_amount > 0 ? (a.unrealised_profit_loss / a.invested_amount) : 0;
                            const rB = b.invested_amount > 0 ? (b.unrealised_profit_loss / b.invested_amount) : 0;
                            return rB - rA;
                          })
                          .slice(0, 3);
                        return sorted.map((mf: any, idx: number) => {
                          const retPct = mf.invested_amount > 0 ? ((mf.unrealised_profit_loss / mf.invested_amount) * 100).toFixed(1) : '0.0';
                          const isPos = mf.unrealised_profit_loss >= 0;
                          const shortName = mf.scheme_name?.replace(/\s*-\s*(Direct|Regular)\s*(Growth|Plan)?/i, '').trim() ?? mf.scheme_name;
                          return (
                            <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: RANK_COLORS[idx] }}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-1">{shortName}</p>
                                <p className="text-[10px] text-slate-400 leading-tight">{mf.fund_category}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-xs font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isPos ? '+' : ''}{retPct}% return
                                </p>
                                <p className="text-[10px] text-slate-400">{formatLakh(mf.valuation || 0)}</p>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </motion.div>

      {/* Asset Allocation Check */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {(() => {
          const idealRaw = IDEAL_ALLOCATIONS[report.ageGroup || ""]?.[report.investorType || ""] || {};
          const categories = ["Equity", "Debt", "Hybrid", "Gold/Silver", "Others"];

          const parseIdeal = (v: string) => parseFloat(v?.replace("%", "") || "0");

          const idealMap: Record<string, number> = {};
          categories.forEach(c => { idealMap[c] = parseIdeal(idealRaw[c]); });

          const actualMap: Record<string, number> = {};
          const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);

          (analysis.mf_snapshot || []).forEach((mf: any) => {
            const cat = (mf.fund_category || "").toLowerCase();
            const valuation = mf.valuation || 0;
            const pct = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;
            if (cat.includes("equity")) actualMap["Equity"] = (actualMap["Equity"] || 0) + pct;
            else if (cat.includes("debt")) actualMap["Debt"] = (actualMap["Debt"] || 0) + pct;
            else if (cat.includes("hybrid")) actualMap["Hybrid"] = (actualMap["Hybrid"] || 0) + pct;
            else if (cat.includes("gold") || cat.includes("silver")) actualMap["Gold/Silver"] = (actualMap["Gold/Silver"] || 0) + pct;
            else actualMap["Others"] = (actualMap["Others"] || 0) + pct;
          });

          const equityActual = actualMap["Equity"] || 0;
          const equityIdeal = idealMap["Equity"] || 0;
          const debtActual = actualMap["Debt"] || 0;
          const debtIdeal = idealMap["Debt"] || 0;

          const missingCategories = categories.filter(c => (actualMap[c] || 0) < 0.01 && idealMap[c] > 0);

          // Overall health: 100 minus sum of abs deviations weighted
          let healthScore = 100;
          categories.forEach(c => {
            const dev = Math.abs((actualMap[c] || 0) - (idealMap[c] || 0));
            healthScore -= dev * 0.8;
          });
          healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

          const healthLabel = healthScore >= 80 ? "Well balanced" : healthScore >= 60 ? "Needs rebalancing" : "Needs attention";
          const healthColor = healthScore >= 80 ? "#10b981" : healthScore >= 60 ? "#f59e0b" : "#ef4444";

          const fmtDiff = (actual: number, ideal: number) => {
            const d = actual - ideal;
            const sign = d >= 0 ? "+" : "";
            return `${sign}${Math.abs(d).toFixed(2)}% ${d >= 0 ? "over" : "under"} ideal`;
          };

          return (
            <>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 flex items-start justify-between border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Asset allocation check</h3>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full border border-blue-100">
                      {report.investorType || "—"}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">
                      Age {report.ageGroup || "—"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-medium mb-0.5">Overall health</div>
                  <div className="text-3xl font-bold" style={{ color: healthColor }}>
                    {healthScore}<span className="text-base font-semibold text-slate-400">/100</span>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${healthColor}18`, color: healthColor }}
                  >
                    {healthLabel}
                  </span>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-0 border-b border-slate-100">
                <div className="px-6 py-4 border-r border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Equity Exposure</div>
                  <div className="text-2xl font-bold text-blue-600">{equityActual.toFixed(2)}%</div>
                  <div className="text-xs mt-0.5" style={{ color: equityActual > equityIdeal ? "#ef4444" : "#10b981" }}>
                    {fmtDiff(equityActual, equityIdeal)}
                  </div>
                </div>
                <div className="px-6 py-4 border-r border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Debt Exposure</div>
                  <div className="text-2xl font-bold text-amber-500">{debtActual.toFixed(2)}%</div>
                  <div className="text-xs mt-0.5" style={{ color: debtActual > debtIdeal ? "#ef4444" : "#10b981" }}>
                    {fmtDiff(debtActual, debtIdeal)}
                  </div>
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

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Category</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actual</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ideal</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Comparison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <AssetCategoryRow
                        key={cat}
                        category={cat}
                        actual={actualMap[cat] || 0}
                        ideal={idealMap[cat] || 0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </motion.div>

      {/* Category Wise Distribution Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <h3 className="text-lg font-bold">Category Wise Distribution</h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Portfolio weightage by fund category</p>
        </div>
        <div className="p-6">
          <div className="h-[500px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={(() => {
                  const data: any[] = [];
                  const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  const mainCategories = ["Equity", "Debt", "Hybrid", "Gold/Silver"];
                  const typeMap: Record<string, Record<string, number>> = {};
                  const mainMap: Record<string, number> = {};

                  (analysis.mf_snapshot || []).forEach((mf: any) => {
                    const cat = (mf.fund_category || "").toLowerCase();
                    const type = mf.fund_type || "Other";
                    const valuation = mf.valuation || 0;
                    const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;

                    let mainCat = "Gold/Silver";
                    if (cat.includes("equity")) mainCat = "Equity";
                    else if (cat.includes("debt")) mainCat = "Debt";
                    else if (cat.includes("hybrid")) mainCat = "Hybrid";

                    mainMap[mainCat] = (mainMap[mainCat] || 0) + percentage;
                    if (!typeMap[mainCat]) typeMap[mainCat] = {};
                    typeMap[mainCat][type] = (typeMap[mainCat][type] || 0) + percentage;
                  });

                  mainCategories.forEach(mainCat => {
                    if (mainMap[mainCat] > 0) {
                      data.push({
                        name: mainCat,
                        value: mainMap[mainCat],
                        isMain: true,
                        category: mainCat
                      });

                      const subTypes = Object.entries(typeMap[mainCat] || {})
                        .sort((a, b) => b[1] - a[1]);
                      
                      subTypes.forEach(([type, val]) => {
                        data.push({
                          name: `  • ${type}`,
                          value: val,
                          isMain: false,
                          category: mainCat
                        });
                      });
                    }
                  });
                  return data;
                })()}
                margin={{ left: 140, right: 60, top: 10, bottom: 10 }}
              >
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={130} 
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const isMain = !payload.value.includes("•");
                    return (
                      <text 
                        x={x} 
                        y={y} 
                        dy={4} 
                        textAnchor="end" 
                        fill={isMain ? "#0f172a" : "#64748b"} 
                        style={{ 
                          fontSize: isMain ? '12px' : '10px', 
                          fontWeight: isMain ? 700 : 400,
                          fontFamily: 'Inter, sans-serif'
                        }}
                      >
                        {payload.value}
                      </text>
                    );
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-xl">
                          <p className="text-xs font-bold text-slate-900 mb-1">{data.name.replace('  • ', '')}</p>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color }} />
                            <p className="text-xs text-blue-600 font-bold">{data.value.toFixed(2)}%</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                >
                  {(() => {
                    const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                    const mainCategories = ["Equity", "Debt", "Hybrid", "Gold/Silver"];
                    const typeMap: Record<string, Record<string, number>> = {};
                    const mainMap: Record<string, number> = {};

                    (analysis.mf_snapshot || []).forEach((mf: any) => {
                      const cat = (mf.fund_category || "").toLowerCase();
                      const type = mf.fund_type || "Other";
                      const valuation = mf.valuation || 0;
                      const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;

                      let mainCat = "Gold/Silver";
                      if (cat.includes("equity")) mainCat = "Equity";
                      else if (cat.includes("debt")) mainCat = "Debt";
                      else if (cat.includes("hybrid")) mainCat = "Hybrid";

                      mainMap[mainCat] = (mainMap[mainCat] || 0) + percentage;
                      if (!typeMap[mainCat]) typeMap[mainCat] = {};
                      typeMap[mainCat][type] = (typeMap[mainCat][type] || 0) + percentage;
                    });

                    const cellData: any[] = [];
                    mainCategories.forEach((mainCat, idx) => {
                      if (mainMap[mainCat] > 0) {
                        cellData.push({ color: COLORS[idx % COLORS.length], opacity: 1 });
                        const subTypesCount = Object.keys(typeMap[mainCat] || {}).length;
                        for(let i=0; i<subTypesCount; i++) {
                          cellData.push({ color: COLORS[idx % COLORS.length], opacity: 0.5 });
                        }
                      }
                    });
                    return cellData.map((d, i) => (
                      <Cell key={`cell-${i}`} fill={d.color} fillOpacity={d.opacity} />
                    ));
                  })()}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {(() => {
              const actualMap: Record<string, number> = {};
              const typeMap: Record<string, Record<string, number>> = {};
              const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
              const mainCategories = ["Equity", "Debt", "Hybrid", "Gold/Silver"];
              
              (analysis.mf_snapshot || []).forEach((mf: any) => {
                const cat = (mf.fund_category || "").toLowerCase();
                const type = mf.fund_type || "Other";
                const valuation = mf.valuation || 0;
                const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;

                let mainCat = "Gold/Silver";
                if (cat.includes("equity")) mainCat = "Equity";
                else if (cat.includes("debt")) mainCat = "Debt";
                else if (cat.includes("hybrid")) mainCat = "Hybrid";

                actualMap[mainCat] = (actualMap[mainCat] || 0) + percentage;
                
                if (!typeMap[mainCat]) typeMap[mainCat] = {};
                typeMap[mainCat][type] = (typeMap[mainCat][type] || 0) + percentage;
              });

              return mainCategories.map((cat, idx) => (
                <div key={cat} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <div className="text-center pb-2 border-b border-slate-200/50">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{cat}</p>
                    <p className="text-xl font-bold text-slate-900">{(actualMap[cat] || 0).toFixed(2)}%</p>
                  </div>
                  <div className="space-y-1.5">
                    {typeMap[cat] && Object.entries(typeMap[cat]).length > 0 ? (
                      Object.entries(typeMap[cat])
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, pct]) => (
                          <div key={type} className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-600 truncate mr-2" title={type}>{type}</span>
                            <span className="font-bold text-slate-900 shrink-0">{pct.toFixed(2)}%</span>
                          </div>
                        ))
                    ) : (
                      <p className="text-[10px] text-slate-400 text-center italic">No data</p>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </motion.div>

      {/* Portfolio Fit & Optimization Section */}
      {Object.keys(performances).length >= (analysis.mf_snapshot || []).length && (analysis.mf_snapshot || []).length > 0 && (
        <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-4 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">PORTFOLIO FIT & OPTIMIZATION</h3>
                <p className="text-xs opacity-80 uppercase tracking-wider">Overall Strategy & Efficiency Check (20 Marks)</p>
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-lg">
                <span className="text-sm font-bold">Portfolio Fit Score: {(() => {
                  const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  const actualMap: Record<string, number> = {};
                  (analysis.mf_snapshot || []).forEach((mf: any) => {
                    const cat = (mf.fund_category || "").toLowerCase();
                    let mainCat = "Gold/Silver";
                    if (cat.includes("equity")) mainCat = "Equity";
                    else if (cat.includes("debt")) mainCat = "Debt";
                    else if (cat.includes("hybrid")) mainCat = "Hybrid";
                    actualMap[mainCat] = (actualMap[mainCat] || 0) + (totalValuation > 0 ? (mf.valuation / totalValuation) * 100 : 0);
                  });
                  const age = analysis.client_details?.age || 30;
                  const riskProfile = analysis.client_details?.risk_profile || "Aggressive";
                  let ageKey = "20-35";
                  if (age > 60) ageKey = "60+";
                  else if (age > 50) ageKey = "50-60";
                  else if (age > 35) ageKey = "35-50";
                  const ideal = IDEAL_ALLOCATIONS[ageKey]?.[riskProfile] || IDEAL_ALLOCATIONS["20-35"]["Aggressive"];
                  let totalScore = 0;
                  Object.entries(ideal).forEach(([cat, target]) => {
                    const idealPct = parseFloat(target as string);
                    const actualPct = actualMap[cat] || 0;
                    const absDiff = Math.abs(actualPct - idealPct);
                    if (absDiff <= 5) totalScore += 4;
                    else if (absDiff <= 10) totalScore += 3;
                    else if (absDiff <= 20) totalScore += 1;
                  });
                  return totalScore;
                })()}/20</span>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* 6.1 Asset Allocation Fit — Per-Category Scoring */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900">6.1 Asset Allocation Fit</h4>
              <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Asset Category</th>
                      <th className="px-4 py-2 text-right">Ideal Allocation</th>
                      <th className="px-4 py-2 text-right">Current Allocation</th>
                      <th className="px-4 py-2 text-center">Score</th>
                      <th className="px-4 py-2 text-left">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(() => {
                      const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                      const actualMap: Record<string, number> = {};
                      (analysis.mf_snapshot || []).forEach((mf: any) => {
                        const cat = (mf.fund_category || "").toLowerCase();
                        let mainCat = "Gold/Silver";
                        if (cat.includes("equity")) mainCat = "Equity";
                        else if (cat.includes("debt")) mainCat = "Debt";
                        else if (cat.includes("hybrid")) mainCat = "Hybrid";
                        actualMap[mainCat] = (actualMap[mainCat] || 0) + (totalValuation > 0 ? (mf.valuation / totalValuation) * 100 : 0);
                      });
                      const age = analysis.client_details?.age || 30;
                      const riskProfile = analysis.client_details?.risk_profile || "Aggressive";
                      let ageKey = "20-35";
                      if (age > 60) ageKey = "60+";
                      else if (age > 50) ageKey = "50-60";
                      else if (age > 35) ageKey = "35-50";
                      const ideal = IDEAL_ALLOCATIONS[ageKey]?.[riskProfile] || IDEAL_ALLOCATIONS["20-35"]["Aggressive"];

                      const catRows = Object.entries(ideal).map(([cat, target]) => {
                        const idealPct = parseFloat(target as string);
                        const actualPct = actualMap[cat] || 0;
                        const diff = actualPct - idealPct;
                        const absDiff = Math.abs(diff);
                        let score: number;
                        let remark: string;
                        let scoreColor: string;
                        let remarkColor: string;
                        if (absDiff <= 5) {
                          score = 4; scoreColor = "text-emerald-600"; remarkColor = "text-emerald-700";
                          remark = "Allocation is within the optimal range.";
                        } else if (absDiff <= 10) {
                          score = 3; scoreColor = "text-blue-600"; remarkColor = "text-blue-700";
                          remark = diff < 0
                            ? "Allocation is slightly lower than recommended. Minor increase advisable."
                            : "Allocation is slightly higher than recommended. Minor reduction advisable.";
                        } else if (absDiff <= 20) {
                          score = 1; scoreColor = "text-amber-600"; remarkColor = "text-amber-700";
                          remark = diff < 0
                            ? "Allocation is lower than recommended. Consider increasing exposure."
                            : "Allocation is higher than recommended. Consider reducing exposure.";
                        } else {
                          score = 0; scoreColor = "text-rose-600"; remarkColor = "text-rose-700";
                          remark = diff < 0
                            ? "Allocation is significantly lower than recommended. Increase exposure to this category."
                            : "Allocation is significantly higher than recommended. Consider reducing exposure.";
                        }
                        return { cat, target, idealPct, actualPct, score, remark, scoreColor, remarkColor };
                      });

                      const totalScore = catRows.reduce((sum, r) => sum + r.score, 0);

                      return (
                        <>
                          {catRows.map(({ cat, target, actualPct, score, remark, scoreColor, remarkColor }) => (
                            <tr key={cat} className="hover:bg-white/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-700">{cat}</td>
                              <td className="px-4 py-3 text-right text-slate-600 font-medium">{target}</td>
                              <td className="px-4 py-3 text-right font-bold text-indigo-600">{actualPct.toFixed(1)}%</td>
                              <td className={`px-4 py-3 text-center font-bold text-base ${scoreColor}`}>{score}/4</td>
                              <td className={`px-4 py-3 text-[11px] leading-relaxed ${remarkColor}`}>{remark}</td>
                            </tr>
                          ))}
                          <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                            <td colSpan={3} className="px-4 py-3 font-bold text-indigo-900 text-sm">Total Portfolio Fit Score</td>
                            <td className="px-4 py-3 text-center font-bold text-lg text-indigo-700">{totalScore}/20</td>
                            <td className="px-4 py-3 text-[11px] font-semibold text-indigo-600">
                              {totalScore >= 16 ? "Excellent alignment with ideal allocation." : totalScore >= 12 ? "Good alignment. Minor adjustments recommended." : totalScore >= 8 ? "Moderate misalignment. Review allocation strategy." : "Significant misalignment. Portfolio rebalancing required."}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6.2 Over-Diversification & Redundancy */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900">6.2 Portfolio Quality Check</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detection Check</p>
                  <ul className="space-y-2">
                    {(() => {
                      const categoryCounts: Record<string, number> = {};
                      (analysis.mf_snapshot || []).forEach((mf: any) => {
                        const cat = mf.fund_category || "Other";
                        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                      });
                      const over5 = Object.values(categoryCounts).some(count => count > 5);
                      const poorFundsList = Object.entries(performances)
                        .filter(([_, p]) => (calculateRiskScore(p)?.totalScore || 0) < 20)
                        .map(([isin, _]) => (analysis.mf_snapshot || []).find((m: any) => m.isin === isin)?.scheme_name)
                        .filter(Boolean);
                      const poorFundsCount = poorFundsList.length;

                      return [
                        { label: "5+ funds in same category", pass: !over5 },
                        { label: "Funds with score < 50", pass: poorFundsCount === 0 },
                        { label: "Excessive overlap (>10 funds)", pass: (analysis.mf_snapshot || []).length <= 10 },
                        { label: "Duplicate strategies", pass: true }
                      ].map((rule, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${rule.pass ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {rule.pass ? "✔" : "✘"}
                          </div>
                          <span className={rule.pass ? "text-slate-600" : "text-rose-600 font-medium"}>{rule.label}</span>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
                <div className="p-4 bg-slate-900 rounded-xl text-white space-y-3">
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Optimization Tip</p>
                  <div className="text-xs leading-relaxed italic">
                    {(() => {
                      const poorFundsList = Object.entries(performances)
                        .filter(([_, p]) => (calculateRiskScore(p)?.totalScore || 0) < 20)
                        .map(([isin, _]) => (analysis.mf_snapshot || []).find((m: any) => m.isin === isin)?.scheme_name)
                        .filter(Boolean);
                      
                      if (poorFundsList.length > 0) {
                        return (
                          <div className="space-y-1">
                            <p className="text-rose-400 font-bold not-italic">Recommended for replacement:</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {poorFundsList.map((name, i) => (
                                <li key={i}>{name}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                      return (analysis.mf_snapshot || []).length > 10
                        ? "Your portfolio has too many funds. Consider consolidating similar funds to reduce tracking overhead and costs."
                        : "Your portfolio size is manageable. Focus on picking best-in-class funds within each category.";
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}



      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">Risk Metrics Check </h3>
              <p className="text-xs opacity-80 uppercase tracking-wider">Historical Returns & Risk Metrics</p>
            </div>
            {Object.values(performanceClassification).some(count => count > 0) && (
              <div className="flex gap-2">
                <div className="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold">{performanceClassification.green} Good</span>
                </div>
                <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-bold">{performanceClassification.yellow} Average</span>
                </div>
                <div className="bg-rose-500/20 border border-rose-500/30 px-3 py-1 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  <span className="text-xs font-bold">{performanceClassification.red} Poor</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 space-y-4">
          {(analysis.mf_snapshot || []).map((mf: any, i: number) => (
            <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900">{mf.scheme_name}</h4>
                  <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">
                    ISIN: {mf.isin || 'N/A'}&nbsp;&nbsp;·&nbsp;&nbsp;{mf.fund_category}&nbsp;&nbsp;·&nbsp;&nbsp;{mf.fund_type}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => analyzePerformance(mf.isin, mf.scheme_name)}
                  disabled={analyzingIsin === mf.isin || !mf.isin}
                  className="hover-elevate"
                >
                  {analyzingIsin === mf.isin ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  Analyze Performance
                </Button>
              </div>

              {performances[mf.isin] && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className={`space-y-6 pt-4 border-t-4 border-${getClassifiedColor(performances[mf.isin])}-500 transition-all duration-500`}
                >
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-${getClassifiedColor(performances[mf.isin])}-500 shadow-[0_0_10px_rgba(0,0,0,0.1)]`} />
                        <p className={`text-sm font-bold text-${getClassifiedColor(performances[mf.isin])}-700 uppercase tracking-wider`}>
                          Performance Status: {
                            getClassifiedColor(performances[mf.isin]) === "emerald" ? "Good (Outperforming Benchmark)" :
                            getClassifiedColor(performances[mf.isin]) === "amber" ? "Average (Matching Benchmark)" :
                            "Poor (Underperforming Benchmark)"
                          }
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <h5 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">AI Reason</h5>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {performances[mf.isin].risk_ratios?.alpha?.fund && parseFloat(performances[mf.isin].risk_ratios.alpha.fund) > 0 
                            ? `This fund is generating a positive alpha, indicating superior stock selection and management performance relative to its benchmark. `
                            : ""}
                          {getClassifiedColor(performances[mf.isin]) === "emerald" 
                            ? "Consistent outperformance across multiple time horizons suggests strong fund management and a robust investment strategy."
                            : getClassifiedColor(performances[mf.isin]) === "amber"
                            ? "Performance is closely tracking the benchmark, providing market-representative returns with standard risk levels."
                            : "Underperformance relative to the benchmark may be due to high expense ratios or defensive positioning in a bullish market."
                          }
                        </p>
                      </div>
                      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                        <h5 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">My Remarks</h5>
                        <textarea
                          className="w-full bg-white/50 border border-amber-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-amber-400 outline-none min-h-[60px] resize-none"
                          placeholder="Add your own observations here..."
                          value={manualRemarks[mf.isin] || ""}
                          onChange={(e) => setManualRemarks(prev => ({ ...prev, [mf.isin]: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                    {/* Returns & Basic Stats */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col gap-1">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance & NAV</h5>
                          <div className="flex flex-wrap gap-1">
                            {performances[mf.isin].benchmark_name && performances[mf.isin].benchmark_name !== "Data unavailable" && (
                              <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                {performances[mf.isin].benchmark_name}
                              </span>
                            )}
                            {performances[mf.isin].data_sources?.nav && (
                              <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                {performances[mf.isin].data_sources.nav}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500">NAV: ₹{performances[mf.isin].nav?.value} ({performances[mf.isin].nav?.date})</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {['1y', '3y', '5y'].map((period) => (
                          <div key={period} className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[10px] text-slate-500 uppercase">{period === '1y' ? '1-Year' : period === '3y' ? '3-Year' : '5-Year'}</p>
                            <p className="font-bold text-slate-900">{performances[mf.isin].cagr[period as "1y" | "3y" | "5y"]}</p>
                            {performances[mf.isin].benchmark_returns && (
                              <div className="mt-1 pt-1 border-t border-slate-50">
                                <p className="text-[8px] text-slate-400 font-medium">Benchmark</p>
                                <p className="text-[9px] font-bold text-blue-600">
                                  {performances[mf.isin].benchmark_returns[period as "1y" | "3y" | "5y"]}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center border border-slate-200">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">NAV</p>
                          <p className="text-sm font-bold text-slate-900">₹{performances[mf.isin].nav?.value} ({performances[mf.isin].nav?.date})</p>
                        </div>
                        {(() => {
                          const score = calculatePerformanceScore(performances[mf.isin].cagr, performances[mf.isin].benchmark_returns);
                          return (
                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                              <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">Performance Scoring Breakdown</p>
                                <p className="text-xs font-bold text-blue-700">Total: {score.total}/40</p>
                              </div>
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                <div className="text-center">
                                  <p className="text-[8px] text-slate-500 uppercase">1Y Score</p>
                                  <p className="text-xs font-bold text-slate-900">{score.breakDown["1y"]}/10</p>
                                </div>
                                <div className="text-center border-x border-blue-100">
                                  <p className="text-[8px] text-slate-500 uppercase">3Y Score</p>
                                  <p className="text-xs font-bold text-slate-900">{score.breakDown["3y"]}/15</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[8px] text-slate-500 uppercase">5Y Score</p>
                                  <p className="text-xs font-bold text-slate-900">{score.breakDown["5y"]}/15</p>
                                </div>
                              </div>
                              <p className="text-[9px] text-center text-blue-500 font-medium italic border-t border-blue-100 pt-1">
                                Performance Score = 1Y Score + 3Y Score + 5Y Score
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Financial Metrics Section — from Scoring files */}
                      {(() => {
                        const sc = scoringRecords[mf.isin];
                        if (!sc) return null;

                        const fmtNum = (v: any, decimals = 2) => v != null && v !== "" ? Number(v).toFixed(decimals) : "N/A";
                        const fmtVal = (v: any) => v != null && v !== "" ? String(v) : "N/A";

                        const ratingColors: Record<string, { bg: string; text: string; border: string }> = {
                          "Excellent": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
                          "Good":      { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-300" },
                          "Average":   { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-300" },
                          "Poor":      { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-300" },
                        };
                        const ratingStyle = ratingColors[sc.fundRating] ?? ratingColors["Average"];

                        const MetricCard = ({ label, value, score, scoreMax, highlight }: { label: string; value: string; score?: number | null; scoreMax?: number; highlight?: "positive" | "negative" | "neutral" }) => (
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center space-y-0.5">
                            <p className="text-[9px] text-slate-500 uppercase font-medium">{label}</p>
                            <p className={`text-xs font-bold ${highlight === "positive" ? "text-emerald-600" : highlight === "negative" ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
                            {score != null && scoreMax != null && (
                              <p className="text-[8px] font-bold text-slate-400">Score: {score}/{scoreMax}</p>
                            )}
                          </div>
                        );

                        const m = sc.metrics;
                        const s = sc.scores;

                        const renderEquityMetrics = () => (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <MetricCard label="Alpha (%)" value={fmtNum(m["Alpha(%)"])} score={s["Alpha Score(12)"]} scoreMax={12} highlight={Number(m["Alpha(%)"]) >= 0 ? "positive" : "negative"} />
                            <MetricCard label="Beta (%)" value={fmtNum(m["Beta(%)"])} score={s["Beta Score(6)"]} scoreMax={6} />
                            <MetricCard label="Sharpe (%)" value={fmtNum(m["Sharpe(%)"])} score={s["Sharpe Score(12)"]} scoreMax={12} highlight={Number(m["Sharpe(%)"]) >= 0 ? "positive" : "negative"} />
                            <MetricCard label="Std Dev (%)" value={fmtNum(m["Standard Deviation(%)"])} score={s["StdDev Score(6)"]} scoreMax={6} />
                            <MetricCard label="Mean Return (%)" value={fmtNum(m["Mean Return(%)"])} />
                            <MetricCard label="Sortino (%)" value={fmtNum(m["Sortino(%)"])} score={s["Sortino Score(4)"]} scoreMax={4} />
                          </div>
                        );

                        const renderHybridMetrics = () => (
                          <div className="space-y-3">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Risk & Return</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="Alpha (%)" value={fmtNum(m["Alpha (%)"])} highlight={Number(m["Alpha (%)"]) >= 0 ? "positive" : "negative"} />
                              <MetricCard label="Beta (%)" value={fmtNum(m["Beta (%)"])} />
                              <MetricCard label="Sharpe (%)" value={fmtNum(m["Sharpe (%)"])} score={s["Sharpe Score(3)"]} scoreMax={3} />
                              <MetricCard label="Sortino (%)" value={fmtNum(m["Sortino (%)"])} score={s["Sortino Score(3)"]} scoreMax={3} />
                              <MetricCard label="Std Dev (%)" value={fmtNum(m["Std Dev (%)"])} score={s["StdDev Score(3)"]} scoreMax={3} />
                              <MetricCard label="Mean Return (%)" value={fmtNum(m["Mean Return (%)"])} score={s["MeanRet Score(3)"]} scoreMax={3} />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Diversification</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="No. of Stocks" value={fmtVal(m["No. of Stocks"])} score={s["NumStocks Score(2.5)"]} scoreMax={2.5} />
                              <MetricCard label="Top 10 Holdings (%)" value={fmtNum(m["Top 10 Holdings (%)"])} score={s["Top10 Score(2.5)"]} scoreMax={2.5} />
                              <MetricCard label="Top 5 Stocks (%)" value={fmtNum(m["Top 5 Stocks (%)"])} score={s["Top5 Score(2.5)"]} scoreMax={2.5} />
                              <MetricCard label="Top 3 Sectors (%)" value={fmtNum(m["Top 3 Sectors (%)"])} score={s["Top3Sec Score(2.5)"]} scoreMax={2.5} />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Valuation</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="P/E Ratio" value={fmtNum(m["Portfolio P/E Ratio"])} score={s["PE Score(2)"]} scoreMax={2} />
                              <MetricCard label="P/B Ratio" value={fmtNum(m["Portfolio P/B Ratio"])} score={s["PB Score(2)"]} scoreMax={2} />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Debt Quality</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="YTM (%)" value={fmtNum(m["Yield to Maturity (%)"])} score={s["YTM Score(3)"]} scoreMax={3} />
                              <MetricCard label="Macaulay Duration (yrs)" value={fmtNum(m["Macaulay Duration (yrs)"])} score={s["Duration Score(3)"]} scoreMax={3} />
                              <MetricCard label="Avg Maturity (yrs)" value={fmtNum(m["Average Maturity (yrs)"])} score={s["Maturity Score(3)"]} scoreMax={3} />
                              <MetricCard label="Avg Credit Rating" value={fmtVal(m["Avg Credit Rating"])} score={s["Credit Score(3)"]} scoreMax={3} />
                              <MetricCard label="Num. Securities" value={fmtVal(m["Number of Securities"])} score={s["NumSec Score(2)"]} scoreMax={2} />
                            </div>
                          </div>
                        );

                        const renderDebtMetrics = () => (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <MetricCard label="YTM (%)" value={fmtNum(m["Yield to Maturity (%)"])} score={s["YTM Score(10)"]} scoreMax={10} />
                            <MetricCard label="Macaulay Duration (yrs)" value={fmtNum(m["Macaulay Duration (yrs)"])} score={s["Duration Score(10)"]} scoreMax={10} />
                            <MetricCard label="Avg Maturity (yrs)" value={fmtNum(m["Average Maturity (yrs)"])} score={s["Maturity Score(10)"]} scoreMax={10} />
                            <MetricCard label="Avg Credit Rating" value={fmtVal(m["Avg Credit Rating"])} score={s["Credit Score(10)"]} scoreMax={10} />
                          </div>
                        );

                        const renderSolutionMetrics = () => (
                          <div className="space-y-3">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Risk-Adjusted Performance</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="Alpha (%)" value={fmtNum(m["Alpha(%)"])} score={s["Alpha Score(4)"]} scoreMax={4} highlight={Number(m["Alpha(%)"]) >= 0 ? "positive" : "negative"} />
                              <MetricCard label="Sharpe (%)" value={fmtNum(m["Sharpe(%)"])} score={s["Sharpe Score(4)"]} scoreMax={4} />
                              <MetricCard label="Sortino (%)" value={fmtNum(m["Sortino(%)"])} score={s["Sortino Score(4)"]} scoreMax={4} />
                              <MetricCard label="Std Dev (%)" value={fmtNum(m["Standard Deviation(%)"])} score={s["StdDev Score(4)"]} scoreMax={4} />
                              <MetricCard label="Mean Return (%)" value={fmtNum(m["Mean Return(%)"])} score={s["MeanRet Score(4)"]} scoreMax={4} />
                              <MetricCard label="Beta (%)" value={fmtNum(m["Beta(%)"])} score={s["Beta Score(2)"]} scoreMax={2} />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Diversification</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="No. of Stocks" value={fmtVal(m["No. of Stocks"])} score={s["NumStocks Score(2)"]} scoreMax={2} />
                              <MetricCard label="Top 10 Stocks (%)" value={fmtNum(m["Top 10 Stocks (%)"])} score={s["Top10 Score(2)"]} scoreMax={2} />
                              <MetricCard label="Top 5 Stocks (%)" value={fmtNum(m["Top 5 Stocks (%)"])} score={s["Top5 Score(2)"]} scoreMax={2} />
                              <MetricCard label="Top 3 Sectors (%)" value={fmtNum(m["Top 3 Sectors (%)"])} score={s["Top3Sec Score(2)"]} scoreMax={2} />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Valuation</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="P/E Ratio" value={fmtNum(m["P/E Ratio"])} score={s["PE Score(3)"]} scoreMax={3} />
                              <MetricCard label="P/B Ratio" value={fmtNum(m["P/B Ratio"])} score={s["PB Score(3)"]} scoreMax={3} />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Debt Quality</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <MetricCard label="YTM (%)" value={fmtNum(m["Yield to Maturity (%)"])} score={s["YTM Score(1)"]} scoreMax={1} />
                              <MetricCard label="Macaulay Duration (yrs)" value={fmtNum(m["Macaulay Duration (yrs)"])} score={s["Duration Score(1)"]} scoreMax={1} />
                              <MetricCard label="Avg Maturity (yrs)" value={fmtNum(m["Average Maturity (yrs)"])} score={s["Maturity Score(1)"]} scoreMax={1} />
                              <MetricCard label="Avg Credit Rating" value={fmtVal(m["Avg Credit Rating"])} score={s["Credit Score(1)"]} scoreMax={1} />
                            </div>
                          </div>
                        );

                        return (
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Financial Metrics — {sc.fundType === "equity" ? "Equity" : sc.fundType === "hybrid" ? "Hybrid" : sc.fundType === "debt" ? "Debt" : "Solution Oriented"}
                              </h5>
                              <div className="flex gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ratingStyle.bg} ${ratingStyle.text} ${ratingStyle.border}`}>
                                  Risk: {sc.riskCategory}
                                </span>
                              </div>
                            </div>

                            {sc.fundType === "equity" && renderEquityMetrics()}
                            {sc.fundType === "hybrid" && renderHybridMetrics()}
                            {sc.fundType === "debt" && renderDebtMetrics()}
                            {sc.fundType === "solution" && renderSolutionMetrics()}

                            <div className={`mt-4 p-4 rounded-xl border-2 ${ratingStyle.bg} ${ratingStyle.border} shadow-sm`}>
                              <div className="flex flex-col items-center text-center space-y-2">
                                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Overall Fund Analysis</h5>
                                <div className="flex items-center gap-6 flex-wrap justify-center">
                                  <div className="text-center">
                                    <p className="text-[8px] text-slate-400 uppercase">Final Score</p>
                                    <p className="text-2xl font-black text-slate-900">{sc.totalScore}<span className="text-sm font-bold text-slate-400">/40</span></p>
                                  </div>
                                  <div className="h-10 w-px bg-slate-200 hidden md:block" />
                                  <div className="text-center">
                                    <p className="text-[8px] text-slate-400 uppercase">Fund Rating</p>
                                    <p className={`text-2xl font-black ${ratingStyle.text} uppercase tracking-tight`}>{sc.fundRating}</p>
                                  </div>
                                  <div className="h-10 w-px bg-slate-200 hidden md:block" />
                                  <div className="text-center">
                                    <p className="text-[8px] text-slate-400 uppercase">Risk Category</p>
                                    <p className="text-sm font-bold text-slate-700">{sc.riskCategory}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Mutual Fund Portfolio Snapshot Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center gap-4 flex-wrap">
          <h3 className="text-lg font-bold">Portfolio Snapshot - Mutual Fund Units</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAllNavs}
            disabled={isFetchingNav}
            className="bg-white/10 border-white/30 text-white"
            data-testid="button-fetch-all-nav"
          >
            {isFetchingNav ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <TrendingUp className="w-4 h-4 mr-2" />
            )}
            {isFetchingNav ? "Fetching NAV..." : "Fetch Real-Time NAV"}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Scheme Name</th>
                <th className="px-4 py-3">Category / Type</th>
                <th className="px-4 py-3">Folio No.</th>
                <th className="px-4 py-3 text-right">No. of Units</th>
                <th className="px-4 py-3 text-right">NAV (₹)</th>
                <th className="px-4 py-3 text-right">Invested Amount (₹)</th>
                <th className="px-4 py-3 text-right">Valuation (₹)</th>
                <th className="px-4 py-3 text-right">Unrealised P/L (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mfSnapshot.map((mf: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-700 max-w-[250px]" title={mf.scheme_name}>{mf.scheme_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{mf.fund_category || 'N/A'}</span>
                      <span className="text-slate-500 text-[10px]">{mf.fund_type || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{mf.folio_no}</td>
                  <td className="px-4 py-3 text-right">{ (mf.units || mf.closing_balance)?.toLocaleString(undefined, {minimumFractionDigits: 3}) }</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {navFetchStatus[mf.scheme_name] === "loading" && (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                      )}
                      {navFetchStatus[mf.scheme_name] === "done" && (
                        <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">LIVE</span>
                      )}
                      {navFetchStatus[mf.scheme_name] === "not_found" && (
                        <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">N/A</span>
                      )}
                      <Input
                        type="number"
                        step="0.0001"
                        className="h-8 text-right w-24 ml-auto text-xs font-mono"
                        value={manualNavs[mf.scheme_name] ?? mf.nav ?? 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setManualNavs(prev => ({
                            ...prev,
                            [mf.scheme_name]: isNaN(val) ? 0 : val
                          }));
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{mf.invested_amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{mf.valuation?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${mf.unrealised_profit_loss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {mf.unrealised_profit_loss?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider text-[10px]">Grand Total</td>
                <td className="px-4 py-3 text-right">
                  ₹{totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  ₹{totalValuation.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right">
                   ₹{totalUnrealised.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Historical Performance Chart */}
      {analysis.historical_valuations && analysis.historical_valuations.length > 0 && (
        <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Historical Portfolio Trend
            </h3>
            <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Portfolio Value</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.historical_valuations}>
                <XAxis 
                  dataKey="month_year" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-800">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{payload[0].payload.month_year}</p>
                          <p className="text-sm font-bold">₹{payload[0].value?.toLocaleString()}</p>
                          {payload[0].payload.change_percentage && (
                            <p className={`text-[10px] font-bold ${payload[0].payload.change_percentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {payload[0].payload.change_percentage >= 0 ? '↑' : '↓'} {Math.abs(payload[0].payload.change_percentage)}%
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="valuation" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Date Wise Investment Amount Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 text-white bg-[#1457f5]">
          <h3 className="text-lg font-bold">Date Wise Investment Amount</h3>
        </div>
        
        <div className="p-6 space-y-8">
          {(() => {
            const transactions = analysis.transactions || [];
            console.log("All transactions read from analysis:", transactions);
            
            const categorize = (type: string) => {
              const t = type.toLowerCase();
              if (["stp", "systematic transfer", "switch"].some(k => t.includes(k))) return "STP";
              if (["sip", "systematic investment", "purchase"].some(k => t.includes(k))) return "SIP";
              if (["swp", "systematic withdrawal", "redemption"].some(k => t.includes(k))) return "SWP";
              
              // Fallback to what Gemini might have directly returned as "type"
              if (t === "stp" || t === "sip" || t === "swp") return t.toUpperCase();
              
              return null;
            };

            const sections = {
              "STP (Systematic Transfer Plan)": [] as any[],
              "SIP (Systematic Investment Plan)": [] as any[],
              "SWP (Systematic Withdrawal Plan)": [] as any[]
            };

            transactions.forEach((tx: any) => {
              const category = categorize(tx.type || "");
              const typeLower = (tx.type || "").toLowerCase();
              const schemeLower = (tx.scheme_name || "").toLowerCase();
              
              // Skip "Switch In" transactions (receiving end of a transfer, not an outflow)
              const isSwitchIn = typeLower.includes("switch in");

              if (isSwitchIn) return;

              if (category === "STP") sections["STP (Systematic Transfer Plan)"].push(tx);
              else if (category === "SIP") sections["SIP (Systematic Investment Plan)"].push(tx);
              else if (category === "SWP") sections["SWP (Systematic Withdrawal Plan)"].push(tx);
            });

            return Object.entries(sections).map(([title, items]) => {
              const isSTP = title.startsWith("STP");
              let filteredItems = items;
              
              const totalAmount = filteredItems.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

              return (
                <div key={title} className="space-y-4">
                  <h4 className="text-md font-bold text-slate-800 border-l-4 border-primary pl-3">{title}</h4>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Scheme Name</th>
                          <th className="px-6 py-3 text-right">Amount in ₹</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.length > 0 ? (
                          items.map((item: any, idx: number) => {
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-6 py-3 text-slate-500 font-medium whitespace-nowrap">
                                  {item.date || "N/A"}
                                </td>
                                <td className="px-6 py-3 text-slate-700">{item.scheme_name || "N/A"}</td>
                                <td className="px-6 py-3 text-right font-mono font-bold text-slate-900">
                                  ₹{item.amount?.toLocaleString() || "0.00"}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">
                              No entries found for this category
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {items.length > 0 && (
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                          <tr>
                            <td colSpan={2} className="px-6 py-3 text-right text-slate-600 uppercase tracking-wider text-[10px]">
                              {isSTP ? "STP Total" : `Total ${title.split(' ')[0]} Amount`}
                            </td>
                            <td className="px-6 py-3 text-right font-mono text-slate-900">
                              ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </motion.div>

    </motion.div>
    </div>
  );
}
