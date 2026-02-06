import { type EnhancedReport } from "@/hooks/use-reports";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ArrowUpRight, TrendingUp, AlertTriangle, Lightbulb, PieChart as PieChartIcon, Calendar, Activity, Loader2, Download, Flag } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface SchemePerformanceData {
  scheme_returns: { "1y": string; "3y": string; "5y": string };
  benchmark_name: string;
  benchmark_returns: { "1y": string; "3y": string; "5y": string };
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

  const compare = (s: string, b: string) => {
    const sv = parseFloat(s.replace('%', ''));
    const bv = parseFloat(b.replace('%', ''));
    if (isNaN(sv) || isNaN(bv)) return null;
    return sv > bv ? "green" : "red";
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Scheme CAGR</h4>
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
  portfolio: {
    sectors: Array<{ name: string; weight: number }>;
    holdings: Array<{ name: string; weight: number }>;
  };
  stats: { aum_crores: number; expense_ratio: string; turnover: string };
  risk_ratios: {
    std_dev: { fund: string; category_avg: string };
    sharpe: { fund: string; category_avg: string };
    beta: { fund: string; category_avg: string };
    alpha: { fund: string; category_avg: string };
  };
}

const IDEAL_ALLOCATIONS: Record<string, Record<string, Record<string, string>>> = {
  "20-35": {
    "High Aggressive": { "Equity": "85%", "Debt": "5%", "Hybrid": "0%", "Gold/Silver & Others": "10%" },
    "Aggressive": { "Equity": "75%", "Debt": "10%", "Hybrid": "5%", "Gold/Silver & Others": "10%" },
    "Moderate": { "Equity": "60%", "Debt": "20%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Conservative": { "Equity": "40%", "Debt": "35%", "Hybrid": "15%", "Gold/Silver & Others": "10%" }
  },
  "35-50": {
    "High Aggressive": { "Equity": "75%", "Debt": "10%", "Hybrid": "5%", "Gold/Silver & Others": "10%" },
    "Aggressive": { "Equity": "65%", "Debt": "15%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Moderate": { "Equity": "50%", "Debt": "30%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Conservative": { "Equity": "30%", "Debt": "50%", "Hybrid": "10%", "Gold/Silver & Others": "10%" }
  },
  "50-60": {
    "High Aggressive": { "Equity": "65%", "Debt": "15%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Aggressive": { "Equity": "50%", "Debt": "30%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Moderate": { "Equity": "35%", "Debt": "45%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Conservative": { "Equity": "20%", "Debt": "65%", "Hybrid": "5%", "Gold/Silver & Others": "10%" }
  },
  "60+": {
    "High Aggressive": { "Equity": "40%", "Debt": "40%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Aggressive": { "Equity": "30%", "Debt": "50%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Moderate": { "Equity": "20%", "Debt": "60%", "Hybrid": "10%", "Gold/Silver & Others": "10%" },
    "Conservative": { "Equity": "10%", "Debt": "75%", "Hybrid": "5%", "Gold/Silver & Others": "10%" }
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
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    
    try {
      const element = reportRef.current;
      
      const originalStyle = element.style.height;
      element.style.height = 'auto';
      
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#f8fafc",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      
      element.style.height = originalStyle;
      
      const imgData = canvas.toDataURL("image/jpeg", 0.7);
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
          <h1 className="text-3xl font-bold font-display text-slate-900 mb-1">{report.filename}</h1>
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
                  .filter((acc: any) => acc.type === "Mutual Fund Folios")
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
                  ₹{(analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.invested_amount || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-5 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mb-1">Current Valuation</p>
                <p className="text-2xl font-bold text-blue-900">
                  ₹{(analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider mb-1">Total Absolute Return</p>
                {(() => {
                  const totalInvested = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.invested_amount || 0), 0);
                  const currentValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  const absoluteReturn = currentValuation - totalInvested;
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
                  const totalInvested = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.invested_amount || 0), 0);
                  const currentValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  const absoluteReturnPct = totalInvested > 0 ? (currentValuation / totalInvested) - 1 : 0;
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
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Fund Category</th>
                <th className="px-6 py-4 text-right">Actual</th>
                <th className="px-6 py-4 text-right">Ideal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => {
                const ideal = IDEAL_ALLOCATIONS[report.ageGroup || ""]?.[report.investorType || ""] || {};
                const categories = ["Equity", "Debt", "Hybrid", "Gold/Silver & Others"];
                
                const actualMap: Record<string, number> = {};
                const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);

                (analysis.mf_snapshot || []).forEach((mf: any) => {
                  const cat = (mf.fund_category || "").toLowerCase();
                  const valuation = mf.valuation || 0;
                  const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;

                  if (cat.includes("equity")) actualMap["Equity"] = (actualMap["Equity"] || 0) + percentage;
                  else if (cat.includes("debt")) actualMap["Debt"] = (actualMap["Debt"] || 0) + percentage;
                  else if (cat.includes("hybrid")) actualMap["Hybrid"] = (actualMap["Hybrid"] || 0) + percentage;
                  else actualMap["Gold/Silver & Others"] = (actualMap["Gold/Silver & Others"] || 0) + percentage;
                });

                return categories.map((cat) => {
                  const actual = actualMap[cat] || 0;
                  const idealStr = ideal[cat] || "0%";
                  const idealVal = parseFloat(idealStr.replace('%', ''));
                  
                  let statusColor = "text-slate-900";
                  if (actual < idealVal) statusColor = "text-rose-600";
                  else if (actual > idealVal) statusColor = "text-amber-500";
                  else if (actual === idealVal && actual > 0) statusColor = "text-emerald-600";

                  return (
                    <tr key={cat} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-700">{cat}</td>
                      <td className={`px-6 py-4 text-right font-bold ${statusColor}`}>
                        {actual.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 font-medium">
                        {idealStr}
                      </td>
                    </tr>
                  );
                });
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
                  const dataMap: Record<string, number> = {};
                  const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  
                  (analysis.mf_snapshot || []).forEach((mf: any) => {
                    const type = mf.fund_type || "Other";
                    const val = mf.valuation || 0;
                    const pct = totalValuation > 0 ? (val / totalValuation) * 100 : 0;
                    dataMap[type] = (dataMap[type] || 0) + pct;
                  });

                  return Object.entries(dataMap)
                    .map(([name, percentage]) => ({ name, percentage }))
                    .sort((a, b) => b.percentage - a.percentage);
                })()}
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <XAxis type="number" unit="%" />
                <YAxis type="category" dataKey="name" width={120} style={{ fontSize: '12px' }} />
                <RechartsTooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Allocation']} />
                <Bar dataKey="percentage" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Allocation Comparison Bar Chart */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <h3 className="text-lg font-bold">Allocation Comparison</h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Current vs Targeted Allocation</p>
        </div>
        <div className="p-6">
          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(() => {
                  const ideal = IDEAL_ALLOCATIONS[report.ageGroup || ""]?.[report.investorType || ""] || {};
                  const categories = ["Equity", "Debt", "Hybrid", "Gold/Silver & Others"];
                  const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  
                  const actualMap: Record<string, number> = {};
                  (analysis.mf_snapshot || []).forEach((mf: any) => {
                    const cat = (mf.fund_category || "").toLowerCase();
                    const valuation = mf.valuation || 0;
                    const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;

                    if (cat.includes("equity")) actualMap["Equity"] = (actualMap["Equity"] || 0) + percentage;
                    else if (cat.includes("debt")) actualMap["Debt"] = (actualMap["Debt"] || 0) + percentage;
                    else if (cat.includes("hybrid")) actualMap["Hybrid"] = (actualMap["Hybrid"] || 0) + percentage;
                    else actualMap["Gold/Silver & Others"] = (actualMap["Gold/Silver & Others"] || 0) + percentage;
                  });

                  return categories.map(cat => ({
                    name: cat,
                    current: parseFloat((actualMap[cat] || 0).toFixed(2)),
                    target: parseFloat((ideal[cat] || "0%").replace('%', ''))
                  }));
                })()}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="current" fill="#3b82f6" name="Current Allocation" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="#94a3b8" name="Target Allocation" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Portfolio Insights */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-amber-500 p-4 text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-lg font-bold">Key Observations</h3>
          </div>
          <div className="p-6">
            <ul className="space-y-4">
              {(() => {
                const observations = [];
                const ideal = IDEAL_ALLOCATIONS[report.ageGroup || ""]?.[report.investorType || ""] || {};
                const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                
                const actualMap: Record<string, number> = {};
                (analysis.mf_snapshot || []).forEach((mf: any) => {
                  const cat = (mf.fund_category || "").toLowerCase();
                  const valuation = mf.valuation || 0;
                  const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;
                  if (cat.includes("equity")) actualMap["Equity"] = (actualMap["Equity"] || 0) + percentage;
                  else if (cat.includes("debt")) actualMap["Debt"] = (actualMap["Debt"] || 0) + percentage;
                });

                const actualEquity = actualMap["Equity"] || 0;
                const targetEquity = parseFloat((ideal["Equity"] || "0%").replace('%', ''));

                if (actualEquity > targetEquity + 10) {
                  observations.push(`Your Equity allocation (${actualEquity.toFixed(1)}%) is significantly higher than the target of ${targetEquity}%. Consider rebalancing.`);
                } else if (actualEquity < targetEquity - 10) {
                  observations.push(`Your Equity allocation (${actualEquity.toFixed(1)}%) is lower than the target of ${targetEquity}%. You might be missing growth opportunities.`);
                }

                if ((analysis.mf_snapshot || []).length > 15) {
                  observations.push(`Your portfolio has ${analysis.mf_snapshot.length} schemes. This might lead to over-diversification and overlap.`);
                }

                const lossCount = (analysis.mf_snapshot || []).filter((mf: any) => (mf.unrealised_profit_loss || 0) < 0).length;
                if (lossCount > (analysis.mf_snapshot || []).length / 2) {
                  observations.push("More than half of your schemes are currently in negative territory.");
                }

                if (observations.length === 0) observations.push("Your portfolio allocation is generally in line with your risk profile.");
                
                return observations.map((obs, i) => (
                  <li key={i} className="flex gap-3 text-slate-700">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-sm leading-relaxed">{obs}</span>
                  </li>
                ));
              })()}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-500 p-4 text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            <h3 className="text-lg font-bold">Suggested Actions</h3>
          </div>
          <div className="p-6">
            <ul className="space-y-4">
              {(() => {
                const actions = [];
                const ideal = IDEAL_ALLOCATIONS[report.ageGroup || ""]?.[report.investorType || ""] || {};
                const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                
                const actualMap: Record<string, number> = {};
                (analysis.mf_snapshot || []).forEach((mf: any) => {
                  const cat = (mf.fund_category || "").toLowerCase();
                  const valuation = mf.valuation || 0;
                  const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;
                  if (cat.includes("equity")) actualMap["Equity"] = (actualMap["Equity"] || 0) + percentage;
                });

                const actualEquity = actualMap["Equity"] || 0;
                const targetEquity = parseFloat((ideal["Equity"] || "0%").replace('%', ''));

                if (actualEquity > targetEquity + 5) {
                  actions.push("Review underperforming equity schemes for potential exit.");
                  actions.push("Consider increasing your Debt or Hybrid allocation to reduce risk.");
                } else if (actualEquity < targetEquity - 5) {
                  actions.push("Gradually increase equity exposure through SIPs in quality schemes.");
                }

                actions.push("Check for portfolio overlap across similar fund types.");
                actions.push("Ensure your ELSS investments are optimized for tax saving.");

                return actions.map((act, i) => (
                  <li key={i} className="flex gap-3 text-slate-700">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm leading-relaxed">{act}</span>
                  </li>
                ));
              })()}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* MF Snapshot Table */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
          <h3 className="text-lg font-bold">Mutual Fund Portfolio Snapshot</h3>
          <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 font-mono">
            {analysis.mf_snapshot?.length || 0} SCHEMES
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Scheme Name</th>
                <th className="px-6 py-4 text-right">Balance Units</th>
                <th className="px-6 py-4 text-right">Invested (₹)</th>
                <th className="px-6 py-4 text-right">Valuation (₹)</th>
                <th className="px-6 py-4 text-right">Gain/Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(analysis.mf_snapshot || []).map((mf: any, i: number) => (
                <PerformanceRow key={i} scheme={mf} reportId={report.id} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
      </motion.div>
    </div>
  );
}
