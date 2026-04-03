import { useState, useEffect } from "react";
import { UploadCard } from "@/components/UploadCard";
import { ReportView } from "@/components/ReportView";
import { useReport, useReports } from "@/hooks/use-reports";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronRight, BarChart2, ShieldCheck, Zap, ArrowLeft, Mail, RefreshCw, Unlink, Lock, CheckCircle2, AlertCircle, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { useLocation } from "wouter";

// ── Gmail Connect Modal ───────────────────────────────────────────────────────
function GmailConnectModal({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"password" | "confirm">("password");

  function handleConnect() {
    const redirectUrl = `/auth/gmail?email=${encodeURIComponent(userEmail)}&password=${encodeURIComponent(password)}`;
    window.location.href = redirectUrl;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-7"
        style={{ background: "linear-gradient(135deg,#0d1117,#0a0f1e)", border: "1px solid rgba(96,165,250,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)" }}>
              <Mail size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Connect Gmail</h3>
              <p className="text-xs text-white/40">Auto-import CAS PDFs from your inbox</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
        </div>

        {/* Info */}
        <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">What we'll watch for</p>
          {["CAMS (camsonline.com)", "KFintech (kfintech.com)", "MFCentral (mfcentral.com)", "NSDL / CDSL"].map(s => (
            <div key={s} className="flex items-center gap-2">
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-white/60">{s}</span>
            </div>
          ))}
        </div>

        {/* Password Input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
            CAS PDF Password
          </label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE1234F (your PAN)"
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              onFocus={e => (e.target.style.borderColor = "rgba(96,165,250,0.5)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
          <p className="text-xs text-white/30 mt-2">Most CAS PDFs are password-protected with your PAN number. This is used to auto-decrypt and analyze PDFs found in your Gmail.</p>
        </div>

        {/* Actions */}
        <button
          onClick={handleConnect}
          disabled={!password.trim()}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{
            background: password.trim() ? "linear-gradient(135deg,#3b6fff,#7c3aed)" : "rgba(255,255,255,0.06)",
            color: password.trim() ? "#fff" : "rgba(255,255,255,0.25)",
            boxShadow: password.trim() ? "0 0 24px rgba(59,111,255,0.4)" : "none",
            cursor: password.trim() ? "pointer" : "not-allowed",
          }}
        >
          Continue to Google →
        </button>
        <p className="text-center text-xs text-white/20 mt-3">We only request read-only access to your Gmail.</p>
      </motion.div>
    </motion.div>
  );
}

// ── Gmail Status Panel ────────────────────────────────────────────────────────
function GmailPanel({ userEmail }: { userEmail: string }) {
  const [status, setStatus] = useState<{ connected: boolean; lastCheckedAt?: string; createdAt?: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Check URL params for callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected" || params.get("gmail") === "error") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function loadStatus() {
    try {
      const r = await fetch(`/api/gmail/status?email=${encodeURIComponent(userEmail)}`);
      const data = await r.json();
      setStatus(data);
    } catch { setStatus({ connected: false }); }
  }

  useEffect(() => { if (userEmail) loadStatus(); }, [userEmail]);

  async function handleManualCheck() {
    setChecking(true);
    try {
      await fetch(`/api/gmail/check?email=${encodeURIComponent(userEmail)}`, { method: "POST" });
      setTimeout(loadStatus, 3000);
    } finally { setChecking(false); }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/gmail/disconnect?email=${encodeURIComponent(userEmail)}`, { method: "DELETE" });
      await loadStatus();
    } finally { setDisconnecting(false); }
  }

  if (!status) return null;

  // Check if just connected via URL param
  const justConnected = new URLSearchParams(window.location.search).get("gmail") === "connected";
  const justError = new URLSearchParams(window.location.search).get("gmail") === "error";

  return (
    <>
      <AnimatePresence>
        {showModal && <GmailConnectModal userEmail={userEmail} onClose={() => setShowModal(false)} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="max-w-2xl mx-auto"
      >
        {/* Just-connected toast */}
        <AnimatePresence>
          {justConnected && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm font-medium"
              style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>
              <CheckCircle2 size={15} /> Gmail connected! We're scanning your inbox for CAS PDFs now.
            </motion.div>
          )}
          {justError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm font-medium"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
              <AlertCircle size={15} /> Gmail connection failed. Please try again.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-2xl p-5" style={{ background: "rgba(10,14,30,0.7)", border: "1px solid rgba(96,165,250,0.15)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: status.connected ? "rgba(52,211,153,0.12)" : "rgba(96,165,250,0.12)", border: `1px solid ${status.connected ? "rgba(52,211,153,0.3)" : "rgba(96,165,250,0.3)"}` }}>
                <Mail size={16} style={{ color: status.connected ? "#34d399" : "#60a5fa" }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Gmail Auto-Import</span>
                  {status.connected && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                      <motion.span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"
                        animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/35 mt-0.5">
                  {status.connected
                    ? status.lastCheckedAt
                      ? `Last checked ${formatDistanceToNow(new Date(status.lastCheckedAt), { addSuffix: true })}`
                      : "Scanning your inbox now..."
                    : "Auto-import CAS PDFs from CAMS, KFintech & MFCentral emails"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {status.connected ? (
                <>
                  <button
                    onClick={handleManualCheck}
                    disabled={checking}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", color: "#60a5fa" }}
                  >
                    <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                    {checking ? "Checking..." : "Check Now"}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}
                  >
                    <Unlink size={12} />
                    {disconnecting ? "..." : "Disconnect"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "linear-gradient(135deg,rgba(59,111,255,0.8),rgba(124,58,237,0.8))", color: "#fff", boxShadow: "0 0 18px rgba(59,111,255,0.3)" }}
                >
                  <Mail size={12} />
                  Connect Gmail
                </button>
              )}
            </div>
          </div>

          {/* How it works (when not connected) */}
          {!status.connected && (
            <div className="mt-4 pt-4 grid grid-cols-3 gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {[
                { step: "1", label: "Connect Gmail", desc: "Authorize read-only access" },
                { step: "2", label: "We Watch", desc: "Polls CAMS, KFintech, MFCentral emails" },
                { step: "3", label: "Auto-Analyzed", desc: "PDF uploaded & AI-analyzed instantly" },
              ].map(s => (
                <div key={s.step} className="text-center">
                  <div className="w-7 h-7 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs font-bold"
                    style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>{s.step}</div>
                  <p className="text-xs font-semibold text-white/70">{s.label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

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
