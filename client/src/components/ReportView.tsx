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
    "High Aggressive": { "Equity": "100%", "Debt": "0%", "Hybrid": "0%", "Gold/Silver/Other": "0%" },
    "Aggressive": { "Equity": "90%", "Debt": "10%", "Hybrid": "0%", "Gold/Silver/Other": "0%" },
    "Moderate": { "Equity": "55%", "Debt": "25%", "Hybrid": "20%", "Gold/Silver/Other": "0%" },
    "Conservative": { "Equity": "50%", "Debt": "40%", "Hybrid": "10%", "Gold/Silver/Other": "0%" }
  },
  "35-50": {
    "High Aggressive": { "Equity": "90%", "Debt": "10%", "Hybrid": "0%", "Gold/Silver/Other": "0%" },
    "Aggressive": { "Equity": "75%", "Debt": "15%", "Hybrid": "10%", "Gold/Silver/Other": "0%" },
    "Moderate": { "Equity": "55%", "Debt": "30%", "Hybrid": "15%", "Gold/Silver/Other": "0%" },
    "Conservative": { "Equity": "40%", "Debt": "50%", "Hybrid": "10%", "Gold/Silver/Other": "0%" }
  },
  "50-60": {
    "High Aggressive": { "Equity": "60%", "Debt": "30%", "Hybrid": "10%", "Gold/Silver/Other": "0%" },
    "Aggressive": { "Equity": "50%", "Debt": "40%", "Hybrid": "10%", "Gold/Silver/Other": "0%" },
    "Moderate": { "Equity": "45%", "Debt": "40%", "Hybrid": "15%", "Gold/Silver/Other": "0%" },
    "Conservative": { "Equity": "30%", "Debt": "60%", "Hybrid": "10%", "Gold/Silver/Other": "0%" }
  },
  "60+": {
    "High Aggressive": { "Equity": "35%", "Debt": "40%", "Hybrid": "20%", "Gold/Silver/Other": "5%" },
    "Aggressive": { "Equity": "30%", "Debt": "40%", "Hybrid": "20%", "Gold/Silver/Other": "10%" },
    "Moderate": { "Equity": "10%", "Debt": "50%", "Hybrid": "30%", "Gold/Silver/Other": "10%" },
    "Conservative": { "Equity": "10%", "Debt": "70%", "Hybrid": "20%", "Gold/Silver/Other": "0%" }
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
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f8fafc" // match bg-slate-50
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
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
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 text-white">
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
                const categories = ["Equity", "Debt", "Hybrid", "Gold/Silver/Other"];
                
                // Group actual allocation by requested categories
                const actualMap: Record<string, number> = {};
                (analysis.mf_snapshot || []).forEach((mf: any) => {
                  const cat = (mf.fund_category || "").toLowerCase();
                  const valuation = mf.valuation || 0;
                  const totalValuation = (analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0);
                  const percentage = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;

                  if (cat.includes("equity")) actualMap["Equity"] = (actualMap["Equity"] || 0) + percentage;
                  else if (cat.includes("debt")) actualMap["Debt"] = (actualMap["Debt"] || 0) + percentage;
                  else if (cat.includes("hybrid")) actualMap["Hybrid"] = (actualMap["Hybrid"] || 0) + percentage;
                  else actualMap["Gold/Silver/Other"] = (actualMap["Gold/Silver/Other"] || 0) + percentage;
                });

                return categories.map((cat) => (
                  <tr key={cat} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{cat}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {(actualMap[cat] || 0).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 font-medium">
                      {ideal[cat] || "0%"}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Scheme Level Performance Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
          <h3 className="text-lg font-bold">Scheme Level Performance</h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Benchmark Comparison & Historical Returns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Scheme Name</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(analysis.mf_snapshot || []).map((scheme: any, i: number) => (
                <PerformanceRow key={i} scheme={scheme} reportId={report.id} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Scheme Level Performance Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
          <h3 className="text-lg font-bold">Scheme Level Performance</h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Benchmark Comparison & Historical Returns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Scheme Name</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(analysis.mf_snapshot || []).map((scheme: any, i: number) => (
                <PerformanceRow key={i} scheme={scheme} reportId={report.id} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Risk Metrics Check Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 text-white">
          <h3 className="text-lg font-bold">Risk Metrics Check </h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Historical Returns & Risk Metrics</p>
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
                  className="space-y-6 pt-4 border-t border-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Returns & Basic Stats */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance & NAV</h5>
                        <p className="text-[10px] text-slate-500">NAV: ₹{performances[mf.isin].nav?.value} ({performances[mf.isin].nav?.date})</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">1-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["1y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">3-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["3y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">5-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["5y"]}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">AUM (Cr)</p>
                          <p className="text-xs font-bold text-slate-700">₹{performances[mf.isin].stats?.aum_crores}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Exp. Ratio</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.expense_ratio}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Turnover</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.turnover}</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Ratios */}
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Metrics (Fund vs Cat Avg)</h5>
                      <div className="grid grid-cols-4 gap-2">
                        {['std_dev', 'sharpe', 'beta', 'alpha'].map((ratio) => (
                          <div key={ratio} className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[10px] text-slate-500 capitalize">{ratio.replace('_', ' ')}</p>
                            <p className="font-bold text-slate-900 text-xs">{(performances[mf.isin].risk_ratios as any)[ratio]?.fund}</p>
                            <p className="text-[8px] text-slate-400">Avg: {(performances[mf.isin].risk_ratios as any)[ratio]?.category_avg}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Holdings</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.holdings?.slice(0, 5).map((h, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{h.name}</span>
                            <span className="font-bold text-slate-900">{h.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Sectors</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.sectors?.slice(0, 5).map((s, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{s.name}</span>
                            <span className="font-bold text-slate-900">{s.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Scheme Level Performance Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
          <h3 className="text-lg font-bold">Scheme Level Performance</h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Benchmark Comparison & Historical Returns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Scheme Name</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(analysis.mf_snapshot || []).map((scheme: any, i: number) => (
                <PerformanceRow key={i} scheme={scheme} reportId={report.id} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Risk Metrics Check Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 text-white">
          <h3 className="text-lg font-bold">Risk Metrics Check </h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Historical Returns & Risk Metrics</p>
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
                  className="space-y-6 pt-4 border-t border-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Returns & Basic Stats */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance & NAV</h5>
                        <p className="text-[10px] text-slate-500">NAV: ₹{performances[mf.isin].nav?.value} ({performances[mf.isin].nav?.date})</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">1-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["1y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">3-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["3y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">5-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["5y"]}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">AUM (Cr)</p>
                          <p className="text-xs font-bold text-slate-700">₹{performances[mf.isin].stats?.aum_crores}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Exp. Ratio</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.expense_ratio}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Turnover</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.turnover}</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Ratios */}
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Metrics (Fund vs Cat Avg)</h5>
                      <div className="grid grid-cols-4 gap-2">
                        {['std_dev', 'sharpe', 'beta', 'alpha'].map((ratio) => (
                          <div key={ratio} className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[10px] text-slate-500 capitalize">{ratio.replace('_', ' ')}</p>
                            <p className="font-bold text-slate-900 text-xs">{(performances[mf.isin].risk_ratios as any)[ratio]?.fund}</p>
                            <p className="text-[8px] text-slate-400">Avg: {(performances[mf.isin].risk_ratios as any)[ratio]?.category_avg}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Holdings</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.holdings?.slice(0, 5).map((h, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{h.name}</span>
                            <span className="font-bold text-slate-900">{h.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Sectors</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.sectors?.slice(0, 5).map((s, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{s.name}</span>
                            <span className="font-bold text-slate-900">{s.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Scheme Level Performance Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white">
          <h3 className="text-lg font-bold">Scheme Level Performance</h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Benchmark Comparison & Historical Returns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Scheme Name</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(analysis.mf_snapshot || []).map((scheme: any, i: number) => (
                <PerformanceRow key={i} scheme={scheme} reportId={report.id} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Risk Metrics Check Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 text-white">
          <h3 className="text-lg font-bold">Risk Metrics Check </h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Historical Returns & Risk Metrics</p>
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
                  className="space-y-6 pt-4 border-t border-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Returns & Basic Stats */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance & NAV</h5>
                        <p className="text-[10px] text-slate-500">NAV: ₹{performances[mf.isin].nav?.value} ({performances[mf.isin].nav?.date})</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">1-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["1y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">3-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["3y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">5-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["5y"]}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">AUM (Cr)</p>
                          <p className="text-xs font-bold text-slate-700">₹{performances[mf.isin].stats?.aum_crores}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Exp. Ratio</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.expense_ratio}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Turnover</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.turnover}</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Ratios */}
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Metrics (Fund vs Cat Avg)</h5>
                      <div className="grid grid-cols-4 gap-2">
                        {['std_dev', 'sharpe', 'beta', 'alpha'].map((ratio) => (
                          <div key={ratio} className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[10px] text-slate-500 capitalize">{ratio.replace('_', ' ')}</p>
                            <p className="font-bold text-slate-900 text-xs">{(performances[mf.isin].risk_ratios as any)[ratio]?.fund}</p>
                            <p className="text-[8px] text-slate-400">Avg: {(performances[mf.isin].risk_ratios as any)[ratio]?.category_avg}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Holdings</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.holdings?.slice(0, 5).map((h, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{h.name}</span>
                            <span className="font-bold text-slate-900">{h.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Sectors</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.sectors?.slice(0, 5).map((s, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{s.name}</span>
                            <span className="font-bold text-slate-900">{s.weight}%</span>
                          </div>
                        ))}
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
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <h3 className="text-lg font-bold">Portfolio Snapshot - Mutual Fund Units</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Scheme Name</th>
                <th className="px-4 py-3">Category / Type</th>
                <th className="px-4 py-3">Folio No.</th>
                <th className="px-4 py-3 text-right">Closing Bal (Units)</th>
                <th className="px-4 py-3 text-right">NAV (₹)</th>
                <th className="px-4 py-3 text-right">Invested Amount (₹)</th>
                <th className="px-4 py-3 text-right">Valuation (₹)</th>
                <th className="px-4 py-3 text-right">Unrealised P/L (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(analysis.mf_snapshot || []).map((mf: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-700 max-w-[250px]" title={mf.scheme_name}>{mf.scheme_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{mf.fund_category || 'N/A'}</span>
                      <span className="text-slate-500 text-[10px]">{mf.fund_type || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{mf.folio_no}</td>
                  <td className="px-4 py-3 text-right">{mf.closing_balance?.toLocaleString(undefined, {minimumFractionDigits: 3})}</td>
                  <td className="px-4 py-3 text-right">{mf.nav?.toLocaleString(undefined, {minimumFractionDigits: 4})}</td>
                  <td className="px-4 py-3 text-right">{mf.invested_amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{mf.valuation?.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${mf.unrealised_profit_loss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {mf.unrealised_profit_loss?.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider text-[10px]">Grand Total</td>
                <td className="px-4 py-3 text-right">
                  ₹{(analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.invested_amount || 0), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  ₹{(analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.valuation || 0), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                   ₹{(analysis.mf_snapshot || []).reduce((acc: number, curr: any) => acc + (curr.unrealised_profit_loss || 0), 0).toLocaleString()}
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

      {/* Allocation Comparison Section */}
      {(analysis.category_comparison || analysis.type_comparison) && (
        <motion.div variants={item} className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 text-white">
              <h3 className="text-lg font-bold">Risk-Based Allocation Analysis</h3>
              <p className="text-xs opacity-80 uppercase tracking-wider">Profile: {report.investorType} | Age: {report.ageGroup}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Category Table */}
              <div className="p-4">
                <h4 className="text-sm font-bold text-slate-900 mb-4 px-2 uppercase tracking-tight">Category Allocation</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Current %</th>
                        <th className="px-4 py-3 text-right">Target %</th>
                        <th className="px-4 py-3 text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(analysis.category_comparison || []).map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700">{c.category}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{(c.current_pct || 0).toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right text-slate-500">{(c.target_pct || 0).toFixed(2)}%</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${((c.current_pct || 0) - (c.target_pct || 0)) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {((c.current_pct || 0) - (c.target_pct || 0)) > 0 ? '+' : ''}{((c.current_pct || 0) - (c.target_pct || 0)).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Type Table */}
              <div className="p-4">
                <h4 className="text-sm font-bold text-slate-900 mb-4 px-2 uppercase tracking-tight">Fund Type Allocation</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Current %</th>
                        <th className="px-4 py-3 text-right">Target %</th>
                        <th className="px-4 py-3 text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(analysis.type_comparison || []).map((t: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700">{t.type}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{(t.current_pct || 0).toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right text-slate-500">{(t.target_pct || 0).toFixed(2)}%</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${((t.current_pct || 0) - (t.target_pct || 0)) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {((t.current_pct || 0) - (t.target_pct || 0)) > 0 ? '+' : ''}{((t.current_pct || 0) - (t.target_pct || 0)).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Scheme Performance Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 text-white">
          <h3 className="text-lg font-bold">Risk Metrics Check </h3>
          <p className="text-xs opacity-80 uppercase tracking-wider">Historical Returns & Risk Metrics</p>
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
                  className="space-y-6 pt-4 border-t border-slate-200"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Returns & Basic Stats */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance & NAV</h5>
                        <p className="text-[10px] text-slate-500">NAV: ₹{performances[mf.isin].nav?.value} ({performances[mf.isin].nav?.date})</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">1-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["1y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">3-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["3y"]}</p>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                          <p className="text-[10px] text-slate-500">5-Year</p>
                          <p className="font-bold text-slate-900">{performances[mf.isin].cagr["5y"]}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">AUM (Cr)</p>
                          <p className="text-xs font-bold text-slate-700">₹{performances[mf.isin].stats?.aum_crores}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Exp. Ratio</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.expense_ratio}</p>
                        </div>
                        <div className="bg-slate-100/50 p-2 rounded-lg text-center">
                          <p className="text-[10px] text-slate-500">Turnover</p>
                          <p className="text-xs font-bold text-slate-700">{performances[mf.isin].stats?.turnover}</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Ratios */}
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Metrics (Fund vs Cat Avg)</h5>
                      <div className="grid grid-cols-4 gap-2">
                        {['std_dev', 'sharpe', 'beta', 'alpha'].map((ratio) => (
                          <div key={ratio} className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                            <p className="text-[10px] text-slate-500 capitalize">{ratio.replace('_', ' ')}</p>
                            <p className="font-bold text-slate-900 text-xs">{(performances[mf.isin].risk_ratios as any)[ratio]?.fund}</p>
                            <p className="text-[8px] text-slate-400">Avg: {(performances[mf.isin].risk_ratios as any)[ratio]?.category_avg}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Portfolio Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Holdings</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.holdings?.slice(0, 5).map((h, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{h.name}</span>
                            <span className="font-bold text-slate-900">{h.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top Sectors</h5>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {performances[mf.isin].portfolio?.sectors?.slice(0, 5).map((s, idx) => (
                          <div key={idx} className="flex justify-between p-2 text-[10px]">
                            <span className="text-slate-700 truncate mr-2">{s.name}</span>
                            <span className="font-bold text-slate-900">{s.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  </div>
);
}
