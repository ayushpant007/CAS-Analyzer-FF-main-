import { type EnhancedReport } from "@/hooks/use-reports";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis } from "recharts";
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

function AssetCategoryRow({ 
  category, 
  actual, 
  ideal, 
  subCategories, 
  actualSubMap 
}: { 
  category: string; 
  actual: number; 
  ideal: string; 
  subCategories: Record<string, string>;
  actualSubMap: Record<string, number>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <tr 
        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          {category}
        </td>
        <td className="px-6 py-4 text-right font-bold text-blue-600">
          {actual.toFixed(2)}%
        </td>
        <td className="px-6 py-4 text-right font-bold text-slate-900">
          {ideal}
        </td>
      </tr>
      {isOpen && (
        <>
          {Object.entries(subCategories).map(([type, targetPct]) => (
            <tr key={type} className="bg-slate-50/30">
              <td className="px-6 py-3 pl-12 text-slate-600 italic">
                {type}
              </td>
              <td className="px-6 py-3 text-right text-slate-600">
                {(actualSubMap[type] || 0).toFixed(2)}%
              </td>
              <td className="px-6 py-3 text-right text-slate-400">
                {targetPct}
              </td>
            </tr>
          ))}
        </>
      )}
    </>
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

export function ReportView({ report }: ReportViewProps) {
  const analysis = report.analysis as any;
  const [analyzingIsin, setAnalyzingIsin] = useState<string | null>(null);
  const [performances, setPerformances] = useState<Record<string, PerformanceData>>({});
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
      
      // Temporary style to ensure full visibility for capture
      const originalStyle = element.style.height;
      element.style.height = 'auto';
      
      const canvas = await html2canvas(element, {
        scale: 1.5, // Reduced scale for smaller file size
        useCORS: true,
        logging: false,
        backgroundColor: "#f8fafc",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      
      element.style.height = originalStyle;
      
      const imgData = canvas.toDataURL("image/jpeg", 0.7); // Use JPEG with 70% quality for significant size reduction
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      pdf.save(`FinAnalyze_Report_${report.filename.replace(/\.[^/.]+$/, "")}.pdf`);
      
      toast({
        title: "Success",
        description: "PDF report downloaded successfully",
      });
    } catch (err: any) {
      console.error("PDF Export Error:", err);
      toast({
        title: "Download Failed",
        description: "There was an error generating your PDF report.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(null as any); // Reset to false
      setIsDownloading(false);
    }
  };

  const analyzePerformance = async (isin: string) => {
    if (!isin) return;
    setAnalyzingIsin(isin);
    try {
      const res = await fetch(`/api/scrape-performance/${isin}?reportId=${report.id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to fetch performance data");
      }
      const data = await res.json();
      setPerformances(prev => ({ ...prev, [isin]: data }));
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
    <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex justify-end sticky top-0 z-50 py-2 bg-slate-50/80 backdrop-blur-sm">
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
          <h1 className="text-3xl font-bold font-display text-slate-900 mb-1">{cleanFilename(report.filename)}</h1>
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

      {/* Summary Section - Account Wise */}
      <motion.div variants={item} className="flex flex-col gap-8">
        <motion.div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center">
            <h3 className="text-lg font-bold">Portfolio Account Summary</h3>
            <div className="text-right">
              <p className="text-xs opacity-80 uppercase tracking-wider font-semibold">Consolidated Value</p>
              <p className="text-xl font-bold">₹{analysis.summary?.net_asset_value?.toLocaleString() ?? '0'}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Account Type</th>
                  <th className="px-6 py-4">Account Details</th>
                  <th className="px-6 py-4 text-right">No. of Schemes</th>
                  <th className="px-6 py-4 text-right">Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(analysis.account_summaries || [])
                  .map((acc: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{acc.type}</td>
                    <td className="px-6 py-4 text-slate-500">{acc.details}</td>
                    <td className="px-6 py-4 text-right font-mono">{acc.count}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {acc.value?.toLocaleString() ?? '0.00'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <td colSpan={3} className="px-6 py-4 text-right uppercase tracking-wider text-xs text-slate-500">Total Portfolio Value</td>
                  <td className="px-6 py-4 text-right text-lg text-slate-900">
                    ₹{analysis.summary?.net_asset_value?.toLocaleString() ?? '0'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center">
            <h3 className="text-lg font-bold">Investment Stats</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Invested Amount</p>
                <p className="text-2xl font-bold text-slate-900">
                  ₹{totalInvested.toLocaleString()}
                </p>
              </div>
              <div className="p-5 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-1">Current Valuation</p>
                <p className="text-2xl font-bold text-blue-900">
                  ₹{totalValuation.toLocaleString()}
                </p>
              </div>
              <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider mb-1">Total Absolute Return</p>
                {(() => {
                  const absoluteReturn = totalValuation - totalInvested;
                  const absoluteReturnPct = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;
                  return (
                    <div>
                      <p className={`text-2xl font-bold ${absoluteReturn >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        ₹{absoluteReturn.toLocaleString()}
                      </p>
                      <p className={`text-sm font-semibold ${absoluteReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {absoluteReturn >= 0 ? '+' : ''}{absoluteReturnPct.toFixed(2)}%
                      </p>
                    </div>
                  );
                })()}
              </div>
              <div className="p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider mb-1">Approx. CAGR (Portfolio)</p>
                {(() => {
                  const absoluteReturnPct = totalInvested > 0 ? (totalValuation / totalInvested) - 1 : 0;
                  return (
                    <div>
                      <p className="text-2xl font-bold text-indigo-900">
                        {totalInvested > 0 ? ((Math.pow(1 + absoluteReturnPct, 1/2) - 1) * 100).toFixed(2) : '0.00'}%
                      </p>
                      <p className="text-[10px] text-indigo-400 font-medium">Estimated 2-Year CAGR</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Asset Allocation Check */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <h3 className="text-lg font-bold">Asset Allocation Check</h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Profile: {report.investorType} | Age: {report.ageGroup}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Fund Category / Type</th>
                <th className="px-6 py-4 text-right">Actual</th>
                <th className="px-6 py-4 text-right">Ideal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => {
                const ideal = IDEAL_ALLOCATIONS[report.ageGroup || ""]?.[report.investorType || ""] || {};
                const categories = ["Equity", "Debt", "Hybrid", "Gold/Silver", "Others"];
                
                // Detailed breakdown from CSV (Moderate 20-35 as fallback)
                const detailedIdeal: Record<string, Record<string, string>> = {
                  "Equity": {
                    "Multi Cap": "9.00%", "Large Cap": "12.00%", "Large & Mid": "9.00%", "Mid Cap": "3.00%", 
                    "Small Cap": "3.00%", "Value Fund": "3.00%", "ELSS": "6.00%", "Flexi Cap": "12.00%", "Dividend Yield": "3.00%"
                  },
                  "Debt": {
                    "Liquid": "2.00%", "Money Market": "3.00%", "Short Duration": "5.00%", "Corporate Bond": "4.00%", 
                    "Banking & PSU": "4.00%", "Gilt Fund": "2.00%"
                  },
                  "Hybrid": {
                    "Aggressive Hybrid": "3.00%", "Multi Asset Allocation": "5.00%", "Equity Savings Fund": "2.00%"
                  },
                  "Gold/Silver": {
                    "Gold ETF/Fund": "4.00%", "Silver ETF/Fund": "1.00%"
                  },
                  "Others": {
                    "Index Funds": "2.50%", "REITs/InvITs": "1.00%", "International": "1.00%", "Other Assets": "0.50%"
                  }
                };

                // Actual allocation grouping
                const actualMap: Record<string, number> = {};
                const actualSubMap: Record<string, number> = {};
                
                (analysis.mf_snapshot || []).forEach((mf: any) => {
                  const cat = (mf.fund_category || "").toLowerCase();
                  const type = (mf.fund_type || "").toLowerCase();
                  const valuation = mf.valuation || 0;
                  const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;

                  if (cat.includes("equity")) {
                    actualMap["Equity"] = (actualMap["Equity"] || 0) + percentage;
                    // Attempt to map sub-types
                    Object.keys(detailedIdeal["Equity"]).forEach(t => {
                      if (type.includes(t.toLowerCase())) actualSubMap[t] = (actualSubMap[t] || 0) + percentage;
                    });
                  }
                  else if (cat.includes("debt")) {
                    actualMap["Debt"] = (actualMap["Debt"] || 0) + percentage;
                    Object.keys(detailedIdeal["Debt"]).forEach(t => {
                      if (type.includes(t.toLowerCase())) actualSubMap[t] = (actualSubMap[t] || 0) + percentage;
                    });
                  }
                  else if (cat.includes("hybrid")) {
                    actualMap["Hybrid"] = (actualMap["Hybrid"] || 0) + percentage;
                    Object.keys(detailedIdeal["Hybrid"]).forEach(t => {
                      if (type.includes(t.toLowerCase())) actualSubMap[t] = (actualSubMap[t] || 0) + percentage;
                    });
                  }
                  else if (cat.includes("gold") || cat.includes("silver")) {
                    actualMap["Gold/Silver"] = (actualMap["Gold/Silver"] || 0) + percentage;
                    if (type.includes("gold")) actualSubMap["Gold ETF/Fund"] = (actualSubMap["Gold ETF/Fund"] || 0) + percentage;
                    if (type.includes("silver")) actualSubMap["Silver ETF/Fund"] = (actualSubMap["Silver ETF/Fund"] || 0) + percentage;
                  }
                  else {
                    actualMap["Others"] = (actualMap["Others"] || 0) + percentage;
                  }
                });

                return categories.map(cat => (
                  <AssetCategoryRow 
                    key={cat}
                    category={cat}
                    actual={actualMap[cat] || 0}
                    ideal={ideal[cat] || "0%"}
                    subCategories={detailedIdeal[cat]}
                    actualSubMap={actualSubMap}
                  />
                ));
              })()}
            </tbody>
          </table>
        </div>
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

      {/* Risk Metrics Check Section */}
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
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold text-slate-500">
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">ISIN: {mf.isin || 'N/A'}</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{mf.fund_category}</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{mf.fund_type}</span>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => analyzePerformance(mf.isin)}
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
                            ? `This fund is generating a positive alpha of ${performances[mf.isin].risk_ratios.alpha.fund}, indicating superior stock selection and management performance relative to its benchmark. `
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
                      <div className="grid grid-cols-1">
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center border border-slate-200">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">NAV</p>
                          <p className="text-sm font-bold text-slate-900">₹{performances[mf.isin].nav?.value} ({performances[mf.isin].nav?.date})</p>
                        </div>
                      </div>

                      {/* Financial Metrics Section */}
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Metrics (Factsheet)</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">Alpha</p>
                            <div className="space-y-1">
                              {(() => {
                                const perf = performances[mf.isin];
                                if (!perf || !perf.cagr || !perf.benchmark_returns) {
                                  return <p className="text-xs font-bold text-slate-900">{(perf?.risk_ratios as any)?.alpha?.fund || "N/A"}</p>;
                                }

                                const parseVal = (v: string) => parseFloat(v?.replace(/[^\d.-]/g, '') || "0");
                                
                                const val1y = parseVal(perf.benchmark_returns["1y"]) - parseVal(perf.cagr["1y"]);
                                const val3y = parseVal(perf.benchmark_returns["3y"]) - parseVal(perf.cagr["3y"]);
                                const val5y = parseVal(perf.benchmark_returns["5y"]) - parseVal(perf.cagr["5y"]);
                                
                                const avgAlpha = (val1y + val3y + val5y) / 3;

                                return (
                                  <>
                                    <p className={`text-xs font-bold ${avgAlpha >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {avgAlpha.toFixed(2)}%
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-1 text-[8px] font-medium text-slate-400">
                                      <span title="1Y Alpha">{val1y >= 0 ? '+' : ''}{val1y.toFixed(1)}</span>
                                      <span>|</span>
                                      <span title="3Y Alpha">{val3y >= 0 ? '+' : ''}{val3y.toFixed(1)}</span>
                                      <span>|</span>
                                      <span title="5Y Alpha">{val5y >= 0 ? '+' : ''}{val5y.toFixed(1)}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">Beta</p>
                            <p className="text-xs font-bold text-slate-900">{(performances[mf.isin].risk_ratios as any).beta?.fund}</p>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">Sharpe</p>
                            <p className="text-xs font-bold text-slate-900">{(performances[mf.isin].risk_ratios as any).sharpe?.fund}</p>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">Std Dev</p>
                            <p className="text-xs font-bold text-slate-900">{(performances[mf.isin].risk_ratios as any).std_dev?.fund}</p>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">Exp. Ratio</p>
                            <p className="text-xs font-bold text-slate-900">{(performances[mf.isin].stats as any).expense_ratio}</p>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">AUM (Cr)</p>
                            <p className="text-xs font-bold text-slate-900">₹{(performances[mf.isin].stats as any).aum_crores}</p>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">Month</p>
                            <p className="text-xs font-bold text-slate-900">{(performances[mf.isin].stats as any).factsheet_month}</p>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[9px] text-slate-500 uppercase">Updated</p>
                            <p className="text-xs font-bold text-slate-900">{(performances[mf.isin].stats as any).last_updated}</p>
                          </div>
                        </div>
                      </div>
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
              
              // Skip "Switch In" or "STP In" transactions as per user request
              // Usually Switch In/STP In are identified by keywords or being the destination of a transfer
              const isSwitchIn = typeLower.includes("switch in") || 
                                 typeLower.includes("stp in") || 
                                 (category === "STP" && !typeLower.includes("out") && !typeLower.includes("withdrawal"));

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
