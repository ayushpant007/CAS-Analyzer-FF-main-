import { type EnhancedReport } from "@/hooks/use-reports";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ArrowUpRight, TrendingUp, AlertTriangle, Lightbulb, PieChart as PieChartIcon, Calendar } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface ReportViewProps {
  report: EnhancedReport;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ReportView({ report }: ReportViewProps) {
  const analysis = report.analysis as any;
  
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
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
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
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
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
              {(analysis.account_summaries || []).map((acc: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-700">{acc.type}</td>
                  <td className="px-6 py-4 text-slate-500">{acc.details}</td>
                  <td className="px-6 py-4 text-right font-mono">{acc.count}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {acc.value?.toLocaleString() ?? '0.00'}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={3} className="px-6 py-4 text-right uppercase tracking-wider text-xs">Total Portfolio Value</td>
                <td className="px-6 py-4 text-right text-lg">
                  ₹{analysis.summary?.net_asset_value?.toLocaleString() ?? '0'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
