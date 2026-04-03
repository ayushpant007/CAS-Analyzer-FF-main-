import { useState } from "react";
import { UploadCard } from "@/components/UploadCard";
import { ReportView } from "@/components/ReportView";
import { useReport, useReports } from "@/hooks/use-reports";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronRight, BarChart2, ShieldCheck, Zap, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { GmailPanel } from "@/components/GmailPanel";
import { useLocation } from "wouter";


export default function Home() {
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [autoAnalyzeNewReport, setAutoAnalyzeNewReport] = useState(false);
  const [, navigate] = useLocation();

  const userEmail = (() => {
    try { const s = localStorage.getItem("cas_user"); return s ? JSON.parse(s)?.email ?? "" : ""; } catch { return ""; }
  })();

  const { data: activeReport, isLoading: isLoadingReport } = useReport(activeReportId);
  const { data: reportsList } = useReports();

  return (
    <div className="min-h-screen font-sans pb-20 relative">
      <AnimatedBackground />
      {/* Navbar */}
      <nav
        className="border-b"
        style={{
          background: "rgba(10, 14, 46, 0.6)",
          backdropFilter: "blur(16px)",
          borderColor: "rgba(96, 165, 250, 0.15)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setActiveReportId(null)}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg"
              style={{
                background: "linear-gradient(135deg, #3b6fff, #9333ea)",
                boxShadow: "0 0 16px rgba(59,111,255,0.5)",
              }}
            >
              <BarChart2 className="w-5 h-5" />
            </div>
            <span
              className="text-xl font-bold font-display"
              style={{
                background: "linear-gradient(90deg, #60a5fa, #c084fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FinAnalyze
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium" style={{ color: "rgba(148,163,184,0.9)" }}>
              AI-Powered Portfolio Insights
            </div>
            <button
              data-testid="button-back-dashboard"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 relative z-10">
        <AnimatePresence mode="wait">
          {!activeReportId ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Hero Section */}
              <div className="text-center space-y-6 max-w-3xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border mb-2"
                  style={{
                    background: "rgba(59,111,255,0.15)",
                    borderColor: "rgba(59,111,255,0.4)",
                    color: "#93c5fd",
                  }}
                >
                  <Zap className="w-4 h-4" style={{ fill: "#60a5fa", color: "#60a5fa" }} />
                  <span>Instant Portfolio X-Ray</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl md:text-6xl font-bold font-display tracking-tight leading-tight"
                  style={{ color: "#f1f5f9" }}
                >
                  Unlock hidden insights in your{" "}
                  <span
                    style={{
                      background: "linear-gradient(90deg, #60a5fa, #c084fc, #34d399)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Investment Portfolio
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg max-w-2xl mx-auto leading-relaxed"
                  style={{ color: "rgba(148,163,184,0.9)" }}
                >
                  Upload your CAS (Consolidated Account Statement) PDF securely. Our AI analyzes
                  your holdings, asset allocation, and provides actionable insights in seconds.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-wrap justify-center gap-8 text-sm font-medium pt-4"
                  style={{ color: "rgba(148,163,184,0.8)" }}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" style={{ color: "#34d399" }} />
                    Secure Analysis
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" style={{ color: "#60a5fa" }} />
                    PDF Support
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5" style={{ color: "#c084fc" }} />
                    Visual Reports
                  </div>
                </motion.div>
              </div>

              {/* Gmail Auto-Import Panel */}
              {userEmail && <GmailPanel userEmail={userEmail} />}

              {/* Upload Component */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="relative z-10"
              >
                <div
                  className="absolute inset-0 -z-10 blur-3xl scale-150 transform opacity-20"
                  style={{
                    background: "radial-gradient(ellipse, #3b6fff 0%, transparent 70%)",
                  }}
                />
                <UploadCard onSuccess={(id) => { setAutoAnalyzeNewReport(true); setActiveReportId(id); }} userEmail={userEmail || undefined} />
              </motion.div>

              {/* Recent Reports List */}
              {reportsList && reportsList.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="max-w-4xl mx-auto pt-10"
                  style={{ borderTop: "1px solid rgba(96,165,250,0.15)" }}
                >
                  <h3
                    className="text-xl font-bold font-display mb-6"
                    style={{ color: "#e2e8f0" }}
                  >
                    Recent Analyses
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportsList.map((report) => (
                      <div
                        key={report.id}
                        onClick={() => { setAutoAnalyzeNewReport(false); setActiveReportId(report.id); }}
                        className="group p-5 rounded-xl border cursor-pointer flex items-center justify-between transition-all duration-300"
                        style={{
                          background: "rgba(15, 20, 50, 0.6)",
                          borderColor: "rgba(96,165,250,0.2)",
                          backdropFilter: "blur(12px)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(96,165,250,0.6)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px rgba(59,111,255,0.2)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(96,165,250,0.2)";
                          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background: "rgba(59,111,255,0.15)", color: "#60a5fa" }}
                          >
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold transition-colors" style={{ color: "#e2e8f0" }}>
                              {report.filename}
                            </h4>
                            <p className="text-xs" style={{ color: "rgba(148,163,184,0.7)" }}>
                              {report.createdAt
                                ? format(new Date(report.createdAt), "MMM d, yyyy • h:mm a")
                                : "Unknown Date"}
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          className="w-5 h-5 transition-colors"
                          style={{ color: "rgba(96,165,250,0.4)" }}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="report"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-[#00ddff]">
              <button
                onClick={() => setActiveReportId(null)}
                className="mb-6 flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color: "rgba(148,163,184,0.8)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#60a5fa")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(148,163,184,0.8)")}
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Upload
              </button>

              {isLoadingReport ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div
                    className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
                    style={{ borderColor: "rgba(59,111,255,0.3)", borderTopColor: "#3b6fff" }}
                  />
                  <p className="font-medium" style={{ color: "rgba(148,163,184,0.8)" }}>Loading report data...</p>
                </div>
              ) : activeReport ? (
                <ReportView report={activeReport} autoAnalyze={autoAnalyzeNewReport} />
              ) : (
                <div className="text-center py-20">
                  <p style={{ color: "rgba(148,163,184,0.7)" }}>Report not found.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
