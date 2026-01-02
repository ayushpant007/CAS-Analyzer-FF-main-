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
  const { analysis } = report;
  
  // Transform allocation object for Pie Chart
  const allocationData = Object.entries(analysis.allocation || {}).map(([name, value]) => ({
    name,
    value
  }));

  // Top holdings for bar chart (first 5)
  const topHoldings = [...(analysis.holdings || [])]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

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

      {/* Summary Card */}
      <motion.div variants={item} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-primary" />
          Portfolio Summary
        </h3>
        <p className="text-slate-600 leading-relaxed">
          {typeof analysis.summary === 'string' 
            ? analysis.summary 
            : `Net Asset Value: ₹${analysis.summary?.net_asset_value?.toLocaleString() ?? '0'}, Total Cost: ₹${analysis.summary?.total_cost?.toLocaleString() ?? '0'}`}
        </p>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Asset Allocation Chart */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Asset Allocation</h3>
          <div className="h-64 w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Holdings Chart */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Top Holdings</h3>
          <div className="h-64 w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topHoldings} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <RechartsTooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={item} className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-6 border border-violet-100">
          <div className="flex items-center gap-2 mb-4 text-violet-700">
            <Lightbulb className="w-5 h-5" />
            <h3 className="font-bold">Key Insights</h3>
          </div>
          <ul className="space-y-3">
            {analysis.insights?.map((insight, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700 bg-white/50 p-3 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
                {insight}
              </li>
            ))}
            {!analysis.insights?.length && (
              <p className="text-slate-500 italic">No specific insights generated.</p>
            )}
          </ul>
        </motion.div>

        <motion.div variants={item} className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-6 border border-amber-100">
          <div className="flex items-center gap-2 mb-4 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold">Risk Assessment</h3>
          </div>
          <div className="bg-white/60 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
            Based on your asset allocation, ensure your portfolio is diversified across multiple sectors to minimize risk. Consider reviewing debt instruments if equity exposure is high.
          </div>
          <button className="mt-4 text-amber-700 text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
            View full risk report <ArrowUpRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>

      {/* Holdings Table */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Detailed Holdings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Asset Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Value</th>
                <th className="px-6 py-4 text-right">Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analysis.holdings?.map((holding, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{holding.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                      {holding.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">
                    ₹{holding.value?.toLocaleString() ?? "0"}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500">
                    {/* Simplified allocation calc just for display */}
                    -
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
