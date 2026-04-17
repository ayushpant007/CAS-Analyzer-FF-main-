import { useState, useEffect, useRef } from "react";
import { motion, useSpring, useInView } from "framer-motion";
import { Zap, BarChart3, Shield, TrendingUp, Brain, FileText, ChevronRight, Star, Lock, Activity, Upload, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";

function getLoggedInUser(): { name: string; email: string } | null {
  try {
    const cas = localStorage.getItem("cas_user");
    return cas ? JSON.parse(cas) : null;
  } catch { return null; }
}

function goToLogin() {
  window.location.href = "/login";
}

// ── Cyber animated background ────────────────────────────────────────────────
function CyberBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-[#020817] via-[#0a0f1e] to-[#050d1a]" />
      <div className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.8) 1px,transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(0,212,255,0.07)_0%,transparent_70%)]" />
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_70%)] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(0,212,255,0.10)_0%,transparent_70%)] translate-x-1/2 translate-y-1/2" />
      {[
        { x: "8%",  y: "15%", size: 2.5, color: "#00d4ff", delay: 0 },
        { x: "85%", y: "10%", size: 2,   color: "#7c3aed", delay: 1.5 },
        { x: "75%", y: "80%", size: 3.5, color: "#00d4ff", delay: 0.8 },
        { x: "20%", y: "75%", size: 2,   color: "#7c3aed", delay: 2.2 },
        { x: "50%", y: "92%", size: 2.5, color: "#00d4ff", delay: 1.1 },
        { x: "93%", y: "45%", size: 2,   color: "#7c3aed", delay: 3 },
        { x: "5%",  y: "55%", size: 2,   color: "#00d4ff", delay: 2.5 },
        { x: "60%", y: "25%", size: 1.5, color: "#7c3aed", delay: 0.4 },
      ].map((orb, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ left: orb.x, top: orb.y, width: orb.size * 2, height: orb.size * 2, backgroundColor: orb.color, boxShadow: `0 0 ${orb.size * 6}px ${orb.size * 3}px ${orb.color}55` }}
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
          transition={{ duration: 3 + orb.delay, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
        />
      ))}
      <motion.div className="absolute left-0 right-0 h-[2px] opacity-[0.08]"
        style={{ background: "linear-gradient(90deg,transparent,#00d4ff,transparent)" }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color, delay }: {
  icon: React.ElementType; title: string; desc: string; color: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -6, scale: 1.02 }} className="group rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 cursor-default transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06]">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
        style={{ backgroundColor: `${color}18`, boxShadow: `0 0 0 1px ${color}30` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────
function CountUp({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 60, damping: 18 });

  useEffect(() => {
    if (inView) spring.set(value);
  }, [inView, value, spring]);

  useEffect(() => {
    return spring.on("change", v => {
      if (ref.current) ref.current.textContent = prefix + v.toFixed(decimals) + suffix;
    });
  }, [spring, prefix, suffix, decimals]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

// ── Real portfolio preview card ───────────────────────────────────────────────
function PortfolioCard() {
  const [data, setData] = useState<{
    totalValue: number;
    totalInvested: number;
    returnPct: number;
    fundCount: number;
    topFunds: { name: string; returnPct: number; valuation: number }[];
    historicalBars: number[];
  } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  async function handleUpload(file: File, password?: string) {
    const user = loggedInUser;
    if (!user) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    if (password) formData.append("password", password);
    formData.append("userEmail", user.email);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg: string = err.message ?? "Upload failed.";
        if (/password/i.test(msg)) {
          setNeedsPassword(true);
          setUploadError("This PDF is password-protected. Please enter the password.");
          return;
        }
        setUploadError(msg);
        return;
      }
      setUploadSuccess(true);
      setUploadFile(null);
      setNeedsPassword(false);
      setPdfPassword("");
      setTimeout(() => {
        setUploadSuccess(false);
        setRefreshCount(c => c + 1);
      }, 1500);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const raw = localStorage.getItem("cas_user");
        if (!raw) { setIsLoggedIn(false); setLoading(false); setData(null); return; }
        const user = JSON.parse(raw);
        setIsLoggedIn(true);
        setLoggedInUser(user);
        const res = await fetch(`/api/reports?email=${encodeURIComponent(user.email)}`);
        const reports: any[] = await res.json();
        const analyzed = reports.filter(r => r.analysis?.mf_snapshot?.length || r.analysis?.funds?.length);
        if (!analyzed.length) { setLoading(false); setData(null); return; }

        // Use the most recent report
        const latest = analyzed[analyzed.length - 1];
        const funds: any[] = latest.analysis?.mf_snapshot ?? latest.analysis?.funds ?? [];
        const totalValue = funds.reduce((s: number, f: any) => s + (f.valuation ?? 0), 0);
        const totalInvested = funds.reduce((s: number, f: any) => s + (f.invested_amount ?? 0), 0);
        const returnPct = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

        // Historical bars from historical_valuations if available
        const hist: any[] = latest.analysis?.historical_valuations ?? [];
        let bars: number[] = [];
        if (hist.length >= 2) {
          const vals = hist.slice(-10).map((h: any) => h.valuation);
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          bars = vals.map(v => max === min ? 60 : Math.round(20 + ((v - min) / (max - min)) * 75));
        } else {
          bars = [40, 55, 45, 65, 52, 70, 62, 78, 68, 85];
        }

        // Top 3 funds by valuation
        const topFunds = [...funds]
          .sort((a, b) => (b.valuation ?? 0) - (a.valuation ?? 0))
          .slice(0, 3)
          .map(f => ({
            name: f.scheme_name ?? f.name ?? "Fund",
            valuation: f.valuation ?? 0,
            returnPct: f.invested_amount > 0
              ? ((f.valuation - f.invested_amount) / f.invested_amount) * 100
              : 0,
          }));

        if (!cancelled) setData({
          totalValue,
          totalInvested,
          returnPct,
          fundCount: funds.length,
          topFunds,
          historicalBars: bars,
        });
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshCount]);

  const formatValue = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
    return `₹${v.toLocaleString("en-IN")}`;
  };

  // ── Not logged in state ──
  if (!loading && !isLoggedIn) {
    return (
      <div className="relative">
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#00d4ff]/15 via-transparent to-[#7c3aed]/15 blur-2xl" />
        {[["top-0 left-0","border-t border-l"],["top-0 right-0","border-t border-r"],["bottom-0 left-0","border-b border-l"],["bottom-0 right-0","border-b border-r"]].map(([pos, border], i) => (
          <div key={i} className={`absolute ${pos} w-5 h-5 ${border} border-[#00d4ff]/60 z-20`} />
        ))}
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 text-center space-y-4 overflow-hidden">
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/50 to-transparent" />
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}
            className="w-14 h-14 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center mx-auto">
            <Lock size={22} className="text-[#00d4ff]" />
          </motion.div>
          <p className="text-xs text-[#00d4ff] uppercase tracking-widest font-medium">Live Portfolio Preview</p>
          <p className="text-white font-semibold text-sm">Sign in to see your real portfolio data here</p>
          <p className="text-white/30 text-xs">Your actual holdings, returns, and fund analysis will appear in this panel</p>
          <button onClick={goToLogin}
            className="mt-2 px-5 py-2 rounded-lg text-xs font-semibold text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_18px_rgba(0,212,255,0.4)]">
            Connect Portfolio
          </button>
        </div>
      </div>
    );
  }

  // ── Logged in but no CAS reports uploaded yet ──
  if (!loading && isLoggedIn && !data) {
    return (
      <div className="relative">
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#00d4ff]/15 via-transparent to-[#7c3aed]/15 blur-2xl" />
        {[["top-0 left-0","border-t border-l"],["top-0 right-0","border-t border-r"],["bottom-0 left-0","border-b border-l"],["bottom-0 right-0","border-b border-r"]].map(([pos, border], i) => (
          <motion.div key={i} className={`absolute ${pos} w-6 h-6 ${border} border-[#00d4ff] z-20`}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }} />
        ))}
        <div className="relative rounded-2xl border border-[#00d4ff]/20 bg-[#020817]/80 backdrop-blur-xl p-8 text-center space-y-4 overflow-hidden">
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/50 to-transparent" />
          <motion.div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/40 to-transparent z-10 pointer-events-none"
            animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />

          <div className="flex items-center justify-center gap-2 mb-1">
            <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">Connected · {loggedInUser?.name}</span>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { setUploadFile(f); setUploadError(null); setNeedsPassword(false); setPdfPassword(""); }
              e.target.value = "";
            }}
          />

          {uploadSuccess ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-400/10 border border-emerald-400/40 flex items-center justify-center mx-auto">
                <CheckCircle size={26} className="text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-semibold text-sm">CAS uploaded successfully!</p>
              <p className="text-white/40 text-xs">Refreshing your portfolio data...</p>
            </motion.div>
          ) : uploading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-2">
              <div className="w-14 h-14 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center mx-auto">
                <Loader2 size={26} className="text-[#00d4ff] animate-spin" />
              </div>
              <p className="text-[#00d4ff] font-semibold text-sm">Analyzing your CAS...</p>
              <p className="text-white/30 text-xs">This may take up to 30 seconds</p>
            </motion.div>
          ) : uploadFile ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <FileText size={14} className="text-[#00d4ff] shrink-0" />
                <span className="text-xs text-white/70 truncate flex-1 text-left">{uploadFile.name}</span>
                <button onClick={() => { setUploadFile(null); setUploadError(null); setNeedsPassword(false); setPdfPassword(""); }}
                  className="text-white/30 hover:text-white/60 transition-colors shrink-0">
                  <X size={12} />
                </button>
              </div>

              {needsPassword && (
                <input
                  type="password"
                  placeholder="PDF password"
                  value={pdfPassword}
                  onChange={e => setPdfPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#00d4ff]/60"
                />
              )}

              {uploadError && (
                <div className="flex items-start gap-1.5 text-left">
                  <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400 leading-relaxed">{uploadError}</p>
                </div>
              )}

              <button
                onClick={() => handleUpload(uploadFile, needsPassword ? pdfPassword : undefined)}
                disabled={needsPassword && !pdfPassword}
                className="w-full py-2 rounded-lg text-xs font-semibold text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_18px_rgba(0,212,255,0.4)] hover:shadow-[0_0_28px_rgba(0,212,255,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {needsPassword ? "Analyze with Password" : "Analyze CAS →"}
              </button>
            </motion.div>
          ) : (
            <>
              <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-14 h-14 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center mx-auto">
                <Upload size={22} className="text-[#00d4ff]" />
              </motion.div>

              <p className="text-xs text-[#00d4ff] uppercase tracking-widest font-medium">Live Portfolio Preview</p>
              <p className="text-white font-semibold text-sm">Upload your CAS to see live data</p>
              <p className="text-white/30 text-xs leading-relaxed">Your account is connected. Upload your Consolidated Account Statement to see your holdings, returns, and fund analysis here.</p>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-5 py-2 rounded-lg text-xs font-semibold text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_18px_rgba(0,212,255,0.4)] hover:shadow-[0_0_28px_rgba(0,212,255,0.6)] transition-all">
                Upload CAS Now →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative">
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#00d4ff]/15 via-transparent to-[#7c3aed]/15 blur-2xl" />
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 space-y-4">
          {[1,2,3,4].map(i => (
            <motion.div key={i} className="h-8 rounded-lg bg-white/[0.05]"
              animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </div>
      </div>
    );
  }

  const d = data!;
  const FUND_COLORS = ["#00d4ff", "#7c3aed", "#f59e0b", "#10b981", "#ec4899"];

  return (
    <div className="relative">
      {/* Outer glow */}
      <motion.div className="absolute -inset-4 rounded-3xl blur-2xl"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,212,255,0.15) 0%, rgba(124,58,237,0.10) 60%, transparent 100%)" }}
        animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity }} />

      {/* HUD corner brackets */}
      {[["top-0 left-0","border-t border-l"],["top-0 right-0","border-t border-r"],["bottom-0 left-0","border-b border-l"],["bottom-0 right-0","border-b border-r"]].map(([pos, border], i) => (
        <motion.div key={i} className={`absolute ${pos} w-6 h-6 ${border} border-[#00d4ff] z-20`}
          animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }} />
      ))}

      <div className="relative rounded-2xl border border-[#00d4ff]/20 bg-[#020817]/80 backdrop-blur-xl overflow-hidden">
        {/* Scan line */}
        <motion.div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/60 to-transparent z-10 pointer-events-none"
          animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />

        {/* Top accent */}
        <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/70 to-transparent" />

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">Live · {loggedInUser?.name || "Portfolio"}</span>
              </div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Total Portfolio Value</p>
              <motion.p className="text-white font-bold text-xl mt-0.5 tabular-nums"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                {formatValue(d.totalValue)}
              </motion.p>
            </div>
            <motion.div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: d.returnPct >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                border: `1px solid ${d.returnPct >= 0 ? "rgba(52,211,153,0.4)" : "rgba(248,113,113,0.4)"}`,
              }}
              animate={{ boxShadow: d.returnPct >= 0
                ? ["0 0 0px rgba(52,211,153,0)","0 0 12px rgba(52,211,153,0.4)","0 0 0px rgba(52,211,153,0)"]
                : ["0 0 0px rgba(248,113,113,0)","0 0 12px rgba(248,113,113,0.4)","0 0 0px rgba(248,113,113,0)"] }}
              transition={{ duration: 2, repeat: Infinity }}>
              <TrendingUp size={12} style={{ color: d.returnPct >= 0 ? "#34d399" : "#f87171" }} />
              <span className="text-xs font-semibold" style={{ color: d.returnPct >= 0 ? "#34d399" : "#f87171" }}>
                {d.returnPct >= 0 ? "+" : ""}{d.returnPct.toFixed(1)}%
              </span>
            </motion.div>
          </div>

          {/* Historical bar chart */}
          <div className="flex items-end gap-1 h-14 px-1">
            {d.historicalBars.map((h, i) => (
              <motion.div key={i} className="flex-1 rounded-sm"
                style={{
                  background: i === d.historicalBars.length - 1
                    ? "linear-gradient(180deg,#00d4ff,#0096b4)"
                    : `rgba(0,212,255,${0.15 + i * 0.07})`,
                  boxShadow: i === d.historicalBars.length - 1 ? "0 0 10px rgba(0,212,255,0.6)" : "none",
                }}
                initial={{ scaleY: 0 }} animate={{ scaleY: 1, height: `${h}%` }}
                transition={{ delay: 0.6 + i * 0.05, duration: 0.5, ease: "easeOut" }}
              />
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "RETURN", value: `${d.returnPct >= 0 ? "+" : ""}${d.returnPct.toFixed(1)}%`, color: d.returnPct >= 0 ? "#34d399" : "#f87171" },
              { label: "INVESTED", value: formatValue(d.totalInvested), color: "#7c3aed" },
              { label: "FUNDS", value: String(d.fundCount), color: "#f59e0b" },
            ].map(({ label, value, color }, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.1 }}
                whileHover={{ scale: 1.04 }}
                className="rounded-xl p-3 text-center relative overflow-hidden"
                style={{ background: `${color}0d`, border: `1px solid ${color}25` }}>
                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                  style={{ background: `radial-gradient(ellipse at 50% 100%,${color}15,transparent 70%)` }} />
                <p className="text-sm font-bold" style={{ color }}>{value}</p>
                <p className="text-[9px] text-white/30 tracking-widest mt-0.5">{label}</p>
              </motion.div>
            ))}
          </div>

          {/* Top funds */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={10} className="text-[#00d4ff]" />
              <span className="text-[9px] text-[#00d4ff] uppercase tracking-widest font-semibold">Top Holdings</span>
            </div>
            {d.topFunds.map((fund, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.1 + i * 0.12 }}
                whileHover={{ x: 3 }}
                className="flex items-center justify-between py-2 px-3 rounded-xl relative overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <motion.div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-l"
                  style={{ background: FUND_COLORS[i % FUND_COLORS.length] }}
                  animate={{ boxShadow: [`0 0 4px ${FUND_COLORS[i % FUND_COLORS.length]}60`, `0 0 10px ${FUND_COLORS[i % FUND_COLORS.length]}`, `0 0 4px ${FUND_COLORS[i % FUND_COLORS.length]}60`] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }} />
                <div className="ml-3 min-w-0">
                  <p className="text-[11px] font-medium text-white/85 truncate max-w-[160px]">{fund.name}</p>
                  <p className="text-[9px] text-white/30">{formatValue(fund.valuation)}</p>
                </div>
                <span className={`text-xs font-bold ml-2 shrink-0 ${fund.returnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {fund.returnPct >= 0 ? "+" : ""}{fund.returnPct.toFixed(1)}%
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const isEmbedded = new URLSearchParams(window.location.search).get("embedded") === "true";

  useEffect(() => {
    setCurrentUser(getLoggedInUser());
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <CyberBackground />

      {/* ── Header ── */}
      {!isEmbedded && (
        <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center shadow-[0_0_18px_rgba(0,212,255,0.5)]">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <span className="text-white font-bold tracking-wide text-sm">CAS Analyzer</span>
              <div className="text-[10px] text-white/30 tracking-widest uppercase leading-none">Portfolio Intelligence</div>
            </div>
          </motion.div>
          {currentUser && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "linear-gradient(135deg,#00d4ff,#7c3aed)", color: "#fff", boxShadow: "0 0 12px rgba(0,212,255,0.4)" }}>
                {currentUser.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <span className="text-sm text-white/60 font-medium hidden sm:block">{currentUser.name}</span>
              <button onClick={() => {
                  localStorage.removeItem("cas_user");
                  try { window.parent.postMessage({ type: "CAS_LOGOUT" }, "https://financialfriendai.com"); } catch {}
                  window.location.href = "https://financialfriendai.com";
                }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1 rounded-lg border border-white/10 hover:border-white/20">
                Log out
              </button>
            </motion.div>
          )}
        </header>
      )}

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="flex flex-col lg:flex-row items-center gap-14">

          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 mb-6">
              <Star size={11} className="text-[#00d4ff]" />
              <span className="text-[11px] text-[#00d4ff] font-medium tracking-wide">AI-Powered Portfolio Analysis</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-5">
              Decode Your
              <span className="block" style={{ WebkitTextFillColor: "transparent", background: "linear-gradient(135deg,#00d4ff,#7c3aed)", WebkitBackgroundClip: "text", backgroundClip: "text" }}>
                CAS Portfolio
              </span>
              Like a Pro
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-base text-white/50 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              Upload your Consolidated Account Statement and get deep AI-driven insights — fund performance, risk ratios, benchmark comparison, and actionable recommendations — in seconds.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {currentUser ? (
                <button data-testid="button-hero-go-to-analyzer" onClick={() => { window.location.href = "/home"; }}
                  className="group flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_28px_rgba(0,212,255,0.5)] hover:shadow-[0_0_42px_rgba(0,212,255,0.7)] hover:scale-[1.03] transition-all duration-200">
                  Go To CAS Analyzer
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <button data-testid="button-hero-getstarted" onClick={goToLogin}
                  className="group flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_28px_rgba(0,212,255,0.5)] hover:shadow-[0_0_42px_rgba(0,212,255,0.7)] hover:scale-[1.03] transition-all duration-200">
                  Get Started Free
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </motion.div>
          </div>

          {/* Right: Real Portfolio Card */}
          <motion.div initial={{ opacity: 0, x: 30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="flex-1 w-full max-w-md lg:max-w-none">
            <PortfolioCard />
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="text-center mb-12">
          <p className="text-xs text-[#00d4ff] uppercase tracking-widest mb-2 font-medium">What You Get</p>
          <h2 className="text-3xl font-bold text-white">Intelligence at Every Level</h2>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon={Brain} title="AI-Powered Extraction" color="#00d4ff" delay={0.6}
            desc="Gemini AI parses your CAS PDF and structures every fund, transaction, and valuation automatically." />
          <FeatureCard icon={BarChart3} title="Real-Time NAV & CAGR" color="#7c3aed" delay={0.7}
            desc="Live fund performance data with historical CAGR, alpha, beta, Sharpe ratio, and standard deviation." />
          <FeatureCard icon={TrendingUp} title="Benchmark Comparison" color="#f59e0b" delay={0.8}
            desc="Simulates your SIP/lumpsum history against benchmark indices to calculate true alpha since inception." />
          <FeatureCard icon={Shield} title="Risk Analysis & Scoring" color="#10b981" delay={0.9}
            desc="Each fund scored out of 100 across risk-adjusted metrics and compared against category averages." />
          <FeatureCard icon={FileText} title="Actionable Insights" color="#ec4899" delay={1.0}
            desc="Hold, Sell, or Switch recommendations with clear reasoning — ready to export as PDF or Excel." />
          <FeatureCard icon={Zap} title="Instant Health Score" color="#f97316" delay={1.1}
            desc="Portfolio health checked against age-based and risk-profile models for Aggressive to Conservative investors." />
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-12 text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(0,212,255,0.06)_0%,transparent_70%)]" />
          <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/40 to-transparent" />
          <h2 className="relative text-3xl font-bold text-white mb-3">Ready to analyze your portfolio?</h2>
          <p className="relative text-white/40 mb-8 max-w-md mx-auto text-sm">Create a free account and upload your CAS file — we'll do the rest in seconds.</p>
          <button data-testid="button-cta-getstarted" onClick={goToLogin}
            className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_28px_rgba(0,212,255,0.5)] hover:shadow-[0_0_42px_rgba(0,212,255,0.7)] hover:scale-[1.03] transition-all duration-200">
            Get Started Free <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center pb-8 text-[11px] text-white/20 tracking-widest uppercase">
        CAS Analyzer · Secure · Encrypted · Powered by AI
        <div className="mt-2">
          <a href="/privacy" className="text-white/30 hover:text-white/60 normal-case tracking-normal transition-colors">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
