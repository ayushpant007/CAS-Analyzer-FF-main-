import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Info } from "lucide-react";

interface FundBenchmarkResult {
  scheme_name: string;
  isin: string;
  benchmark_name: string;
  total_invested: number;
  fund_current_value: number;
  benchmark_current_value: number;
  benchmark_found: boolean;
  benchmark_latest_date: string;
  transactions_count: number;
  excess_return: number;
}

interface Props {
  reportId: number;
}

function formatLakh(v: number) {
  const abs = Math.abs(v);
  if (abs >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000)   return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function shortName(name: string) {
  return name
    .replace(/\s*-\s*(Direct|Regular)\s*(Plan|Growth)?\s*/gi, "")
    .replace(/\s*(Growth|Plan)\s*$/i, "")
    .trim();
}

const FUND_COLOR      = "#3b82f6"; // blue
const BENCHMARK_COLOR = "#f59e0b"; // amber
const INVESTED_COLOR  = "#94a3b8"; // slate

export default function FundVsBenchmark({ reportId }: Props) {
  const { data, isLoading, isError } = useQuery<{ results: FundBenchmarkResult[]; cas_source: string }>({
    queryKey: ["/api/fund-vs-benchmark", reportId],
    queryFn: () => fetch(`/api/fund-vs-benchmark/${reportId}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Fund vs Benchmark · Since Inception
          </p>
        </div>
        <div className="p-6 flex items-center justify-center gap-3 text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading benchmark comparison…</span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Fund vs Benchmark · Since Inception
          </p>
        </div>
        <div className="p-6 flex items-center gap-2 text-slate-400">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span className="text-sm">Could not load benchmark data.</span>
        </div>
      </div>
    );
  }

  const results = data.results || [];
  // Only show funds where benchmark was found and there are transactions
  const withBenchmark = results.filter(r => r.benchmark_found && r.benchmark_current_value > 0);
  const withoutBenchmark = results.filter(r => !r.benchmark_found || r.benchmark_current_value === 0);

  if (withBenchmark.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Fund vs Benchmark · Since Inception
          </p>
        </div>
        <div className="p-6 flex items-center gap-2 text-slate-400">
          <Info className="w-4 h-4" />
          <span className="text-sm">No benchmark data could be matched to the funds in this portfolio.</span>
        </div>
      </div>
    );
  }

  // Sort by invested amount descending for chart (top 10 max)
  const chartFunds = [...withBenchmark]
    .sort((a, b) => b.total_invested - a.total_invested)
    .slice(0, 10);

  const chartData = chartFunds.map(f => ({
    name: shortName(f.scheme_name).slice(0, 22) + (shortName(f.scheme_name).length > 22 ? "…" : ""),
    fullName: f.scheme_name,
    Invested: Math.round(f.total_invested),
    "Fund Value": Math.round(f.fund_current_value),
    "Benchmark Value": Math.round(f.benchmark_current_value),
    beats: f.fund_current_value >= f.benchmark_current_value,
  }));

  const totalInvested  = withBenchmark.reduce((s, f) => s + f.total_invested, 0);
  const totalFundVal   = withBenchmark.reduce((s, f) => s + f.fund_current_value, 0);
  const totalBmVal     = withBenchmark.reduce((s, f) => s + f.benchmark_current_value, 0);
  const beatingCount   = withBenchmark.filter(f => f.fund_current_value >= f.benchmark_current_value).length;
  const laggingCount   = withBenchmark.length - beatingCount;
  const totalAlpha     = totalFundVal - totalBmVal;
  const alphaPositive  = totalAlpha >= 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Fund vs Benchmark · Since Inception
          </p>
          <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
            CAMS Report
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Shows what the same SIP/purchase investments would be worth if invested in each fund's benchmark index.
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-slate-50">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Invested</p>
            <p className="text-lg font-bold text-slate-900">{formatLakh(totalInvested)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{withBenchmark.length} funds tracked</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-50">
            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-1">Fund Value</p>
            <p className="text-lg font-bold text-blue-700">{formatLakh(totalFundVal)}</p>
            <p className="text-[10px] text-blue-400 mt-0.5">
              {totalInvested > 0 ? ((totalFundVal / totalInvested - 1) * 100).toFixed(1) : 0}% return
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50">
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-1">Benchmark Value</p>
            <p className="text-lg font-bold text-amber-700">{formatLakh(totalBmVal)}</p>
            <p className="text-[10px] text-amber-400 mt-0.5">
              {totalInvested > 0 ? ((totalBmVal / totalInvested - 1) * 100).toFixed(1) : 0}% return
            </p>
          </div>
          <div className={`p-4 rounded-xl ${alphaPositive ? "bg-emerald-50" : "bg-rose-50"}`}>
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${alphaPositive ? "text-emerald-500" : "text-rose-400"}`}>
              Alpha (Excess)
            </p>
            <p className={`text-lg font-bold ${alphaPositive ? "text-emerald-700" : "text-rose-700"}`}>
              {totalAlpha >= 0 ? "+" : ""}{formatLakh(totalAlpha)}
            </p>
            <p className={`text-[10px] mt-0.5 ${alphaPositive ? "text-emerald-500" : "text-rose-500"}`}>
              {beatingCount} beat · {laggingCount} lag
            </p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Invested vs Fund Value vs Benchmark Value
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 60 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                width={34}
              />
              <RechartsTooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(val: any, name: string) => [formatLakh(Number(val)), name]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item?.fullName || label;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                iconSize={8}
                iconType="circle"
              />
              <Bar dataKey="Invested" fill={INVESTED_COLOR} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Fund Value" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.beats ? "#22c55e" : "#3b82f6"} />
                ))}
              </Bar>
              <Bar dataKey="Benchmark Value" fill={BENCHMARK_COLOR} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Green = beats benchmark &nbsp;
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Blue = lags benchmark
          </p>
        </div>

        {/* Per-fund table */}
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Fund-level Comparison</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-bold w-48">Fund</th>
                  <th className="text-right px-3 py-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-bold">Benchmark</th>
                  <th className="text-right px-3 py-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-bold">Invested</th>
                  <th className="text-right px-3 py-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-bold">Fund Value</th>
                  <th className="text-right px-3 py-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-bold">Bm Value</th>
                  <th className="text-right px-3 py-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-bold">Alpha</th>
                  <th className="text-center px-3 py-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {withBenchmark.map((fund, idx) => {
                  const alpha   = fund.fund_current_value - fund.benchmark_current_value;
                  const beats   = alpha >= 0;
                  const alphaPct = fund.benchmark_current_value > 0
                    ? ((fund.fund_current_value / fund.benchmark_current_value - 1) * 100).toFixed(1)
                    : "–";
                  return (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[190px]">
                        <div className="truncate" title={fund.scheme_name}>{shortName(fund.scheme_name)}</div>
                        <div className="text-[9px] text-slate-400 truncate">{fund.isin}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-500 max-w-[140px]">
                        <div className="truncate text-[10px]" title={fund.benchmark_name}>{fund.benchmark_name.slice(0, 22)}{fund.benchmark_name.length > 22 ? "…" : ""}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 font-medium">{formatLakh(fund.total_invested)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{formatLakh(fund.fund_current_value)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-600 font-medium">{formatLakh(fund.benchmark_current_value)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${beats ? "text-emerald-600" : "text-rose-600"}`}>
                        {beats ? "+" : ""}{formatLakh(alpha)}
                        <div className="text-[9px] font-normal">({beats ? "+" : ""}{alphaPct}%)</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center">
                          {beats ? (
                            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 text-[9px] font-bold">
                              <TrendingUp className="w-2.5 h-2.5" />Beats
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5 text-[9px] font-bold">
                              <TrendingDown className="w-2.5 h-2.5" />Lags
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Funds without benchmark */}
        {withoutBenchmark.length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Funds without benchmark data ({withoutBenchmark.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {withoutBenchmark.map((f, i) => (
                <span key={i} className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-0.5">
                  {shortName(f.scheme_name)}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-400 leading-relaxed">
          * Benchmark values are calculated by simulating the same investment amounts on the same dates in the respective benchmark index.
          The comparison uses the closing price of the benchmark index on or nearest to each transaction date.
        </p>
      </div>
    </div>
  );
}
