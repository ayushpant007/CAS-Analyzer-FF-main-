import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, RefreshCw, Unlink, Lock, CheckCircle2, AlertCircle, X, DatabaseZap, Clock, Calendar, ChevronRight, FileText, Download, Search } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@shared/routes";

const PENDING_SCAN_KEY = "gmail_pending_scan_pdfs";
const PENDING_SCAN_META_KEY = "gmail_pending_scan_meta";

export type PendingScanPdf = {
  messageId: string;
  attachmentId: string;
  filename: string;
  emailDate: string;
  from: string;
  subject: string;
};

function GmailConnectModal({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const [password, setPassword] = useState("");

  function handleConnect() {
    window.location.href = `/auth/gmail?email=${encodeURIComponent(userEmail)}&password=${encodeURIComponent(password)}`;
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

        <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">What we'll watch for</p>
          {["CAMS (camsonline.com)", "KFintech (kfintech.com)", "MFCentral (mfcentral.com)", "NSDL / CDSL", "Any sender — friend / advisor forwarding a CAS PDF"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <CheckCircle2 size={11} className={i === 4 ? "text-purple-400 shrink-0" : "text-emerald-400 shrink-0"} />
              <span className={`text-xs ${i === 4 ? "text-purple-300" : "text-white/60"}`}>{s}</span>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">CAS PDF Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE1234F (your PAN)"
              data-testid="input-cas-password"
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              onFocus={e => (e.target.style.borderColor = "rgba(96,165,250,0.5)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
          <p className="text-xs text-white/30 mt-2">Most CAS PDFs are password-protected with your PAN number.</p>
        </div>

        <div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.2)" }}>
          <p className="text-xs font-semibold text-yellow-400 mb-1">⚠ Google may show a warning screen</p>
          <p className="text-xs text-white/50 leading-relaxed">
            Google will show <span className="text-white/70 font-medium">"Google hasn't verified this app"</span> because our app verification is in progress.
          </p>
          <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
            To proceed: click <span className="text-white/70 font-medium">Advanced</span> → <span className="text-white/70 font-medium">"Go to CAS Analyzer (unsafe)"</span>. Your data is safe — we only read emails, never modify them.
          </p>
        </div>

        <button
          onClick={handleConnect}
          disabled={!password.trim()}
          data-testid="button-connect-gmail"
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{
            background: password.trim() ? "linear-gradient(135deg,#3b6fff,#7c3aed)" : "rgba(255,255,255,0.06)",
            color: password.trim() ? "#fff" : "rgba(255,255,255,0.25)",
            boxShadow: password.trim() ? "0 0 24px rgba(59,111,255,0.4)" : "none",
            cursor: password.trim() ? "pointer" : "not-allowed",
          }}
        >Continue to Google →</button>
        <p className="text-center text-xs text-white/20 mt-3">We only request read-only access to your Gmail.</p>
      </motion.div>
    </motion.div>
  );
}

type ScanStep = "idle" | "picking-dates" | "searching" | "showing-results" | "importing";

function ScanInboxModal({
  userEmail,
  onClose,
  onNavigateToReport,
}: {
  userEmail: string;
  onClose: () => void;
  onNavigateToReport: (reportId: number, remaining: PendingScanPdf[]) => void;
}) {
  const [step, setStep] = useState<ScanStep>("picking-dates");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [foundPdfs, setFoundPdfs] = useState<PendingScanPdf[]>([]);
  const [importingIdx, setImportingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [importError, setImportError] = useState<string>("");

  async function handleSearch() {
    setError("");
    setStep("searching");
    try {
      const res = await fetch("/api/gmail/scan-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, fromDate, toDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      const pdfs: PendingScanPdf[] = data.pdfs || [];
      setFoundPdfs(pdfs);
      if (pdfs.length === 1) {
        setStep("importing");
        await importPdf(pdfs, 0);
      } else {
        setStep("showing-results");
      }
    } catch (e: any) {
      setError(e.message || "Search failed");
      setStep("picking-dates");
    }
  }

  async function importPdf(pdfs: PendingScanPdf[], idx: number) {
    setImportingIdx(idx);
    setImportError("");
    const pdf = pdfs[idx];
    try {
      const res = await fetch("/api/gmail/import-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          messageId: pdf.messageId,
          attachmentId: pdf.attachmentId,
          filename: pdf.filename,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      const remaining = pdfs.filter((_, i) => i !== idx);
      sessionStorage.setItem(PENDING_SCAN_KEY, JSON.stringify(remaining));
      sessionStorage.setItem(PENDING_SCAN_META_KEY, JSON.stringify({ fromDate, toDate }));
      onNavigateToReport(data.reportId, remaining);
    } catch (e: any) {
      setImportError(e.message || "Could not import PDF");
      setImportingIdx(null);
      setStep("showing-results");
    }
  }

  const fmtDate = (iso: string) => {
    try { return format(new Date(iso), "dd MMM yyyy"); } catch { return iso; }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}
      onClick={step === "picking-dates" ? onClose : undefined}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl"
        style={{ background: "linear-gradient(135deg,#0d1117,#0a0f1e)", border: "1px solid rgba(147,51,234,0.3)", boxShadow: "0 28px 90px rgba(0,0,0,0.7)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(147,51,234,0.18)", border: "1px solid rgba(167,139,250,0.3)" }}>
              <DatabaseZap size={16} className="text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Scan Full Inbox</h3>
              <p className="text-xs text-white/40">Find CAS PDFs in a date range</p>
            </div>
          </div>
          {step !== "importing" && (
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors"><X size={16} /></button>
          )}
        </div>

        <div className="px-6 pb-6">
          {/* Step: Date Picker */}
          {step === "picking-dates" && (
            <div className="space-y-4">
              <p className="text-xs text-white/50 leading-relaxed">
                Select the time period to scan your Gmail for CAS statements (NSDL, CDSL, CAMS, KFintech, etc.)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">From</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate}
                      onChange={e => setFromDate(e.target.value)}
                      data-testid="input-scan-from-date"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(147,51,234,0.3)", colorScheme: "dark" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">To</label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={e => setToDate(e.target.value)}
                      data-testid="input-scan-to-date"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(147,51,234,0.3)", colorScheme: "dark" }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick date shortcuts */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Last 1 month", months: 1 },
                  { label: "Last 3 months", months: 3 },
                  { label: "Last 6 months", months: 6 },
                  { label: "Last 1 year", months: 12 },
                  { label: "Last 2 years", months: 24 },
                ].map(({ label, months }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const to = new Date();
                      const from = new Date();
                      from.setMonth(from.getMonth() - months);
                      setFromDate(from.toISOString().split("T")[0]);
                      setToDate(to.toISOString().split("T")[0]);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ background: "rgba(147,51,234,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#c084fc" }}
                  >{label}</button>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <button
                onClick={handleSearch}
                disabled={!fromDate || !toDate}
                data-testid="button-scan-search"
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: "linear-gradient(135deg,rgba(147,51,234,0.85),rgba(79,70,229,0.85))",
                  color: "#fff",
                  boxShadow: "0 0 24px rgba(147,51,234,0.4)",
                }}
              >
                <Search size={14} />
                Search Inbox ({fmtDate(fromDate)} – {fmtDate(toDate)})
              </button>
            </div>
          )}

          {/* Step: Searching */}
          {step === "searching" && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(147,51,234,0.15)", border: "1px solid rgba(167,139,250,0.3)" }}>
                <RefreshCw size={20} className="text-purple-400 animate-spin" />
              </div>
              <p className="text-white font-semibold text-sm">Scanning your inbox...</p>
              <p className="text-white/40 text-xs">Looking for CAS PDFs from {fmtDate(fromDate)} to {fmtDate(toDate)}</p>
            </div>
          )}

          {/* Step: Importing (single PDF or selected from list) */}
          {step === "importing" && importingIdx !== null && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>
                <RefreshCw size={20} className="text-emerald-400 animate-spin" />
              </div>
              <p className="text-white font-semibold text-sm">Importing PDF...</p>
              <p className="text-white/50 text-xs max-w-xs mx-auto truncate">{foundPdfs[importingIdx]?.filename}</p>
              <p className="text-white/30 text-xs">Analysing with AI — this may take 20–30 seconds</p>
            </div>
          )}

          {/* Step: Showing results */}
          {step === "showing-results" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <p className="text-sm text-white font-semibold">
                  Found {foundPdfs.length} PDF{foundPdfs.length !== 1 ? "s" : ""} from {fmtDate(fromDate)} to {fmtDate(toDate)}
                </p>
              </div>

              {foundPdfs.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-white/40 text-sm">No CAS PDFs found in this date range.</p>
                  <p className="text-white/25 text-xs mt-1">Try a wider date range or check your email sender settings.</p>
                  <button
                    onClick={() => setStep("picking-dates")}
                    className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(147,51,234,0.12)", border: "1px solid rgba(167,139,250,0.2)", color: "#c084fc" }}
                  >Try different dates</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-white/40">Select which PDF to import:</p>
                  {importError && (
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
                      <AlertCircle size={13} /> {importError}
                    </div>
                  )}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {foundPdfs.map((pdf, idx) => (
                      <motion.button
                        key={`${pdf.messageId}-${pdf.attachmentId}`}
                        onClick={() => { setStep("importing"); importPdf(foundPdfs, idx); }}
                        disabled={importingIdx !== null}
                        data-testid={`button-import-pdf-${idx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="w-full text-left rounded-xl p-3.5 transition-all group"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(147,51,234,0.1)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                      >
                        <div className="flex items-start gap-2.5">
                          <FileText size={14} className="text-purple-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{pdf.filename || "CAS Statement"}</p>
                            <p className="text-[10px] text-white/40 mt-0.5 truncate">{pdf.subject || pdf.from}</p>
                            <p className="text-[10px] text-white/30 mt-0.5">{fmtDate(pdf.emailDate)}</p>
                          </div>
                          <ChevronRight size={14} className="text-purple-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                  <button
                    onClick={() => setStep("picking-dates")}
                    className="w-full mt-1 py-2 rounded-xl text-xs font-medium text-white/40 hover:text-white/60 transition-colors"
                  >← Change date range</button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function GmailPanel({ userEmail, onNewReports }: { userEmail: string; onNewReports?: () => void }) {
  const [status, setStatus] = useState<{ connected: boolean; lastCheckedAt?: string; createdAt?: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ pdfCount: number } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [pendingPdfs, setPendingPdfs] = useState<PendingScanPdf[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const justConnected = params.get("gmail") === "connected";
  const justError = params.get("gmail") === "error";
  const resumeScan = params.get("gmail") === "resume-scan";

  function showToast(msg: string, type: "success" | "error" | "info") {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => {
    if (justConnected || justError || resumeScan) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (resumeScan) {
      const pending = getPendingPdfs();
      if (pending.length > 0) {
        setPendingPdfs(pending);
        setShowScanModal(true);
      }
    }
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function getPendingPdfs(): PendingScanPdf[] {
    try { return JSON.parse(sessionStorage.getItem(PENDING_SCAN_KEY) || "[]"); } catch { return []; }
  }

  async function loadStatus() {
    try {
      const r = await fetch(`/api/gmail/status?email=${encodeURIComponent(userEmail)}`);
      const data = await r.json();
      setStatus(data);
    } catch { setStatus({ connected: false }); }
  }

  useEffect(() => { if (userEmail) loadStatus(); }, [userEmail]);

  async function handleManualCheck() {
    if (checking) return;
    setChecking(true);
    setCheckResult(null);
    showToast("Scanning inbox for latest CAS email...", "info");
    try {
      const res = await fetch(`/api/gmail/check?email=${encodeURIComponent(userEmail)}&latestOnly=true`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const pdfCount: number = data.pdfCount ?? 0;
        const reportIds: number[] = data.reportIds ?? [];
        await loadStatus();
        setCheckResult({ pdfCount });
        if (pdfCount > 0) {
          showToast("CAS PDF found — opening report...", "success");
          await queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
          onNewReports?.();
          if (reportIds.length > 0) {
            setTimeout(() => navigate(`/reports/${reportIds[0]}/concise`), 1500);
          }
        } else {
          showToast("No new CAS PDF found in your latest email.", "info");
        }
        setTimeout(() => setCheckResult(null), 8000);
      } else {
        showToast("Check request failed. Please try again.", "error");
      }
    } catch {
      showToast("Network error — could not trigger check.", "error");
    } finally {
      setChecking(false);
    }
  }

  function handleNavigateToReport(reportId: number, remaining: PendingScanPdf[]) {
    queryClient.invalidateQueries({ queryKey: [api.reports.list.path] });
    onNewReports?.();
    setShowScanModal(false);
    sessionStorage.setItem(PENDING_SCAN_KEY, JSON.stringify(remaining));
    navigate(`/reports/${reportId}/concise`);
  }

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/gmail/disconnect?email=${encodeURIComponent(userEmail)}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Gmail disconnected successfully.", "success");
        await loadStatus();
      } else {
        showToast("Disconnect failed. Please try again.", "error");
      }
    } catch {
      showToast("Network error — could not disconnect.", "error");
    } finally {
      setDisconnecting(false);
    }
  }

  if (!status) return null;

  const toastColors = {
    success: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", color: "#34d399" },
    error:   { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", color: "#f87171" },
    info:    { bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)",  color: "#60a5fa" },
  };

  const savedPending = getPendingPdfs();

  return (
    <>
      <AnimatePresence>
        {showModal && <GmailConnectModal userEmail={userEmail} onClose={() => setShowModal(false)} />}
        {showScanModal && (
          <ScanInboxModal
            userEmail={userEmail}
            onClose={() => { setShowScanModal(false); setPendingPdfs([]); sessionStorage.removeItem(PENDING_SCAN_KEY); }}
            onNavigateToReport={handleNavigateToReport}
          />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <AnimatePresence>
          {justConnected && (
            <motion.div key="connected-toast" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 text-sm font-medium"
              style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>
              <CheckCircle2 size={15} /> Gmail connected! Scanning your inbox for CAS PDFs now.
            </motion.div>
          )}
          {justError && (
            <motion.div key="error-toast" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 text-sm font-medium"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
              <AlertCircle size={15} /> Gmail connection failed. Please try again.
            </motion.div>
          )}
          {toast && (
            <motion.div key="toast" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 text-sm font-medium"
              style={{ background: toastColors[toast.type].bg, border: `1px solid ${toastColors[toast.type].border}`, color: toastColors[toast.type].color }}>
              {toast.type === "success" && <CheckCircle2 size={15} />}
              {toast.type === "error" && <AlertCircle size={15} />}
              {toast.type === "info" && <RefreshCw size={15} className="animate-spin" />}
              {toast.msg}
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
                <p className="text-xs mt-0.5" style={{ color: checkResult?.pdfCount ? "#34d399" : "rgba(255,255,255,0.35)" }}>
                  {status.connected
                    ? checkResult !== null
                      ? checkResult.pdfCount > 0
                        ? `✓ Fetched ${checkResult.pdfCount} PDF${checkResult.pdfCount === 1 ? "" : "s"} from your inbox`
                        : "No new CAS PDFs found"
                      : status.lastCheckedAt
                        ? `Last checked ${formatDistanceToNow(new Date(status.lastCheckedAt), { addSuffix: true })}`
                        : "Connected — first scan pending"
                    : "Auto-import CAS PDFs from CAMS, KFintech & MFCentral emails"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {status.connected ? (
                <>
                  <button
                    onClick={handleManualCheck}
                    disabled={checking}
                    data-testid="button-gmail-check"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: checking ? "rgba(96,165,250,0.2)" : "rgba(96,165,250,0.1)",
                      border: "1px solid rgba(96,165,250,0.25)",
                      color: "#60a5fa",
                      cursor: checking ? "not-allowed" : "pointer",
                      opacity: checking ? 0.8 : 1,
                    }}
                  >
                    <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                    {checking ? "Checking..." : "Check Now"}
                  </button>
                  <button
                    onClick={() => setShowScanModal(true)}
                    data-testid="button-gmail-full-scan"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all relative"
                    style={{
                      background: "rgba(147,51,234,0.12)",
                      border: "1px solid rgba(167,139,250,0.3)",
                      color: "#c084fc",
                      cursor: "pointer",
                    }}
                  >
                    <DatabaseZap size={12} />
                    Scan Full Inbox
                    {savedPending.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                        style={{ background: "#c084fc", color: "#0a0f1e" }}>
                        {savedPending.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    data-testid="button-gmail-disconnect"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: disconnecting ? "rgba(248,113,113,0.15)" : "rgba(248,113,113,0.08)",
                      border: "1px solid rgba(248,113,113,0.2)",
                      color: "#f87171",
                      cursor: disconnecting ? "not-allowed" : "pointer",
                      opacity: disconnecting ? 0.7 : 1,
                    }}
                  >
                    <Unlink size={12} className={disconnecting ? "animate-pulse" : ""} />
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  data-testid="button-connect-gmail-open"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "linear-gradient(135deg,rgba(59,111,255,0.8),rgba(124,58,237,0.8))", color: "#fff", boxShadow: "0 0 18px rgba(59,111,255,0.3)", cursor: "pointer" }}
                >
                  <Mail size={12} />
                  Connect Gmail
                </button>
              )}
            </div>
          </div>

          {status.connected && !status.lastCheckedAt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="mt-4 pt-4 flex items-start gap-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <Clock size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-400">First scan pending</p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Gmail is connected. Click <strong className="text-white/60">Check Now</strong> to scan your inbox immediately, or wait — it will auto-scan within the next few minutes.
                </p>
              </div>
            </motion.div>
          )}

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
