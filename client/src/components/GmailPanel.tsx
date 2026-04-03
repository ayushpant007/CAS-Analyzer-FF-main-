import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, RefreshCw, Unlink, Lock, CheckCircle2, AlertCircle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
          {["CAMS (camsonline.com)", "KFintech (kfintech.com)", "MFCentral (mfcentral.com)", "NSDL / CDSL"].map(s => (
            <div key={s} className="flex items-center gap-2">
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-white/60">{s}</span>
            </div>
          ))}
        </div>

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
              data-testid="input-cas-password"
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              onFocus={e => (e.target.style.borderColor = "rgba(96,165,250,0.5)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
          <p className="text-xs text-white/30 mt-2">Most CAS PDFs are password-protected with your PAN number. This is used to auto-decrypt and analyze PDFs found in your Gmail.</p>
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
        >
          Continue to Google →
        </button>
        <p className="text-center text-xs text-white/20 mt-3">We only request read-only access to your Gmail.</p>
      </motion.div>
    </motion.div>
  );
}

export function GmailPanel({ userEmail }: { userEmail: string }) {
  const [status, setStatus] = useState<{ connected: boolean; lastCheckedAt?: string; createdAt?: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const justConnected = params.get("gmail") === "connected";
  const justError = params.get("gmail") === "error";

  useEffect(() => {
    if (justConnected || justError) {
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

  return (
    <>
      <AnimatePresence>
        {showModal && <GmailConnectModal userEmail={userEmail} onClose={() => setShowModal(false)} />}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <AnimatePresence>
          {justConnected && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 text-sm font-medium"
              style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>
              <CheckCircle2 size={15} /> Gmail connected! We're scanning your inbox for CAS PDFs now.
            </motion.div>
          )}
          {justError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 text-sm font-medium"
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

            <div className="flex items-center gap-2">
              {status.connected ? (
                <>
                  <button
                    onClick={handleManualCheck}
                    disabled={checking}
                    data-testid="button-gmail-check"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", color: "#60a5fa" }}
                  >
                    <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                    {checking ? "Checking..." : "Check Now"}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    data-testid="button-gmail-disconnect"
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
                  data-testid="button-connect-gmail-open"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "linear-gradient(135deg,rgba(59,111,255,0.8),rgba(124,58,237,0.8))", color: "#fff", boxShadow: "0 0 18px rgba(59,111,255,0.3)" }}
                >
                  <Mail size={12} />
                  Connect Gmail
                </button>
              )}
            </div>
          </div>

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
