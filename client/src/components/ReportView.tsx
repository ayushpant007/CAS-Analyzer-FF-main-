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

      {/* Historical Portfolio Valuation Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <h3 className="text-lg font-bold">Consolidated Portfolio Valuation for Year</h3>
        </div>
        <div className="p-6">
          <div className="h-64 w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.historical_valuations || []}>
                <XAxis dataKey="month_year" tick={{fontSize: 12}} />
                <YAxis hide />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="valuation" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Month-Year</th>
                  <th className="px-6 py-4 text-right">Portfolio Valuation (In ₹)</th>
                  <th className="px-6 py-4 text-right">Changes in ₹</th>
                  <th className="px-6 py-4 text-right">Changes in %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(analysis.historical_valuations || []).map((v: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{v.month_year}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{v.valuation?.toLocaleString() ?? '0.00'}</td>
                    <td className={`px-6 py-4 text-right font-mono ${v.change_value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {v.change_value >= 0 ? '+' : ''}{v.change_value?.toLocaleString() ?? '0.00'}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${v.change_percentage >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {v.change_percentage >= 0 ? '+' : ''}{v.change_percentage?.toFixed(2) ?? '0.00'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Asset Class Allocation Section */}
      <motion.div variants={item} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-4 text-white">
          <h3 className="text-lg font-bold">Consolidated Portfolio for Accounts for the Month</h3>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analysis.asset_allocation || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="asset_class"
                >
                  {(analysis.asset_allocation || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="right" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Asset Class</th>
                  <th className="px-6 py-4 text-right">Value</th>
                  <th className="px-6 py-4 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(analysis.asset_allocation || []).map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{a.asset_class}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{a.value?.toLocaleString() ?? '0.00'}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">{a.percentage?.toFixed(2) ?? '0.00'}%</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <td className="px-6 py-4 uppercase tracking-wider text-xs text-slate-500">Total</td>
                  <td className="px-6 py-4 text-right text-lg text-slate-900">₹{analysis.summary?.net_asset_value?.toLocaleString() ?? '0'}</td>
                  <td className="px-6 py-4 text-right text-slate-500">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
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
    </motion.div>
  );
}
