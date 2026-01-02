import { useState } from "react";
import { UploadCard } from "@/components/UploadCard";
import { ReportView } from "@/components/ReportView";
import { useReport, useReports } from "@/hooks/use-reports";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronRight, BarChart2, ShieldCheck, Zap } from "lucide-react";
import { format } from "date-fns";

export default function Home() {
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  
  // Fetch specific report if selected
  const { data: activeReport, isLoading: isLoadingReport } = useReport(activeReportId);
  
  // Fetch list of past reports
  const { data: reportsList } = useReports();

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans pb-20">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => setActiveReportId(null)}>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20 cursor-pointer">
              <BarChart2 className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold font-display text-slate-900 cursor-pointer">FinAnalyze</span>
          </div>
          <div className="text-sm text-slate-500 font-medium">
            AI-Powered Portfolio Insights
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <AnimatePresence mode="wait">
          {!activeReportId ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-16"
            >
              {/* Hero Section */}
              <div className="text-center space-y-6 max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-sm font-medium border border-blue-100 mb-2">
                  <Zap className="w-4 h-4 fill-primary" />
                  <span>Instant Portfolio X-Ray</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold font-display text-slate-900 tracking-tight leading-tight">
                  Unlock hidden insights in your <span className="gradient-text">Investment Portfolio</span>
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                  Upload your CAS (Consolidated Account Statement) PDF securely. Our AI analyzes your holdings, asset allocation, and provides actionable insights in seconds.
                </p>
                
                <div className="flex flex-wrap justify-center gap-8 text-sm font-medium text-slate-500 pt-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    Secure Analysis
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    PDF Support
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-violet-500" />
                    Visual Reports
                  </div>
                </div>
              </div>

              {/* Upload Component */}
              <div className="relative z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/50 to-transparent -z-10 blur-3xl scale-150 transform opacity-50" />
                <UploadCard onSuccess={setActiveReportId} />
              </div>

              {/* Recent Reports List */}
              {reportsList && reportsList.length > 0 && (
                <div className="max-w-4xl mx-auto pt-10 border-t border-slate-200">
                  <h3 className="text-xl font-bold font-display text-slate-900 mb-6">Recent Analyses</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportsList.map((report) => (
                      <div 
                        key={report.id}
                        onClick={() => setActiveReportId(report.id)}
                        className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-primary/50 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-primary transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900 group-hover:text-primary transition-colors">{report.filename}</h4>
                            <p className="text-xs text-slate-500">
                              {report.createdAt ? format(new Date(report.createdAt), "MMM d, yyyy • h:mm a") : "Unknown Date"}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="report"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button 
                onClick={() => setActiveReportId(null)}
                className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Upload
              </button>

              {isLoadingReport ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">Loading report data...</p>
                </div>
              ) : activeReport ? (
                <ReportView report={activeReport} />
              ) : (
                <div className="text-center py-20">
                  <p className="text-slate-500">Report not found.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
