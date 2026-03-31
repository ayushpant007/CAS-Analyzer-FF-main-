import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, BarChart3, Shield, TrendingUp, Brain, FileText, ChevronRight, Star } from "lucide-react";
import { AuthModal, type AuthView } from "./auth";

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

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.2 }}
      className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 flex flex-col gap-1">
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs text-white/40 tracking-wide">{label}</span>
    </motion.div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────
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

// ── Mini chart bars (decorative) ─────────────────────────────────────────────
function MiniChart() {
  const bars = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95];
  return (
    <div className="flex items-end gap-1 h-12">
      {bars.map((h, i) => (
        <motion.div key={i} className="flex-1 rounded-sm"
          style={{ height: `${h}%`, background: i === bars.length - 1 ? "#00d4ff" : `rgba(0,212,255,${0.2 + i * 0.06})` }}
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
          transition={{ delay: 0.8 + i * 0.05, duration: 0.4, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");

  const openAuth = (view: AuthView) => {
    setAuthView(view);
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <CyberBackground />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        {/* Logo */}
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

        {/* Nav buttons */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-3">
          <button data-testid="button-nav-login" onClick={() => openAuth("login")}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/70 border border-white/15 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all duration-200">
            Log In
          </button>
          <button data-testid="button-nav-signup" onClick={() => openAuth("signup")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:shadow-[0_0_32px_rgba(0,212,255,0.6)] hover:scale-[1.03] transition-all duration-200">
            Sign Up
          </button>
        </motion.div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="flex flex-col lg:flex-row items-center gap-14">

          {/* Left: Text */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
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

            {/* CTA buttons */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button data-testid="button-hero-signup" onClick={() => openAuth("signup")}
                className="group flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_28px_rgba(0,212,255,0.5)] hover:shadow-[0_0_42px_rgba(0,212,255,0.7)] hover:scale-[1.03] transition-all duration-200">
                Get Started Free
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button data-testid="button-hero-login" onClick={() => openAuth("login")}
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 hover:scale-[1.02] transition-all duration-200">
                Log In
              </button>
            </motion.div>
          </div>

          {/* Right: Dashboard Preview Card */}
          <motion.div initial={{ opacity: 0, x: 30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="flex-1 w-full max-w-md lg:max-w-none">
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#00d4ff]/15 via-transparent to-[#7c3aed]/15 blur-2xl" />

              {/* Preview panel */}
              <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 space-y-5">
                {/* Top chrome */}
                <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/50 to-transparent" />

                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/30 uppercase tracking-widest">Portfolio Overview</p>
                    <p className="text-white font-bold text-lg mt-0.5">₹14,82,350</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-semibold">+18.4%</span>
                  </div>
                </div>

                {/* Mini chart */}
                <MiniChart />

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="XIRR" value="18.4%" color="#00d4ff" />
                  <StatCard label="Alpha" value="+3.2%" color="#7c3aed" />
                  <StatCard label="Funds" value="12" color="#f59e0b" />
                </div>

                {/* Fund rows */}
                <div className="space-y-2">
                  {[
                    { name: "Mirae Asset Large Cap", score: 87, change: "+2.1%", color: "#00d4ff" },
                    { name: "Parag Parikh Flexi Cap", score: 92, change: "+4.8%", color: "#7c3aed" },
                    { name: "Axis Small Cap Fund", score: 78, change: "-1.2%", color: "#f59e0b" },
                  ].map((fund, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + i * 0.1 }}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: fund.color, boxShadow: `0 0 8px ${fund.color}80` }} />
                        <div>
                          <p className="text-xs font-medium text-white/80">{fund.name}</p>
                          <p className="text-[10px] text-white/30">Score: {fund.score}/100</p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${fund.change.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>
                        {fund.change}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
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

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button data-testid="button-cta-signup" onClick={() => openAuth("signup")}
              className="group flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-[#020817] bg-gradient-to-r from-[#00d4ff] to-[#0096b4] shadow-[0_0_28px_rgba(0,212,255,0.5)] hover:shadow-[0_0_42px_rgba(0,212,255,0.7)] hover:scale-[1.03] transition-all duration-200">
              Create Free Account <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button data-testid="button-cta-login" onClick={() => openAuth("login")}
              className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 hover:scale-[1.02] transition-all duration-200">
              Already have an account
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center pb-8 text-[11px] text-white/20 tracking-widest uppercase">
        CAS Analyzer · Secure · Encrypted · Powered by AI
      </footer>

      {/* ── Auth Modal ── */}
      <AuthModal isOpen={authOpen} defaultView={authView} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
