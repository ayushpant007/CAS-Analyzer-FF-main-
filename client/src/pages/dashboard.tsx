import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  LayoutDashboard, BarChart2, FileText, Settings, LogOut,
  Search, Bell, TrendingUp, TrendingDown, Activity,
  Cpu, Wifi, HardDrive, MemoryStick, ExternalLink, Menu, X, Zap,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const ACTIVITY_DATA = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 2, 1 + i);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    scans: Math.floor(60 + Math.random() * 120 + Math.sin(i / 3) * 30),
    processed: Math.floor(50 + Math.random() * 100 + Math.cos(i / 4) * 25),
  };
});

const spark = (base: number) =>
  Array.from({ length: 10 }, (_, i) => ({
    v: base + Math.floor(Math.random() * 20 - 10 + i * 1.5),
  }));

const KPI = [
  { title: "Total Processed", value: 48291, suffix: "", trend: "+5.2%", up: true,  color: "#00d4ff", spark: spark(120) },
  { title: "Active Sessions",  value: 1847,  suffix: "", trend: "+12.1%", up: true, color: "#7c3aed", spark: spark(80)  },
  { title: "Error Rate",       value: 0.42,  suffix: "%", trend: "-0.18%", up: false, color: "#f59e0b", spark: spark(10) },
  { title: "System Load",      value: 67,    suffix: "%", trend: "+3.4%", up: true,  color: "#10b981", spark: spark(60) },
];

const SCANS = [
  { id: "CAS-7841", status: "Completed", date: "31 Mar 2026, 10:42 AM", user: "Arjun Sharma" },
  { id: "CAS-7840", status: "Processing", date: "31 Mar 2026, 10:38 AM", user: "Priya Mehta" },
  { id: "CAS-7839", status: "Completed", date: "31 Mar 2026, 10:31 AM", user: "Rohit Verma" },
  { id: "CAS-7838", status: "Failed",    date: "31 Mar 2026, 10:15 AM", user: "Sneha Iyer" },
  { id: "CAS-7837", status: "Completed", date: "31 Mar 2026, 09:58 AM", user: "Kabir Nair" },
  { id: "CAS-7836", status: "Pending",   date: "31 Mar 2026, 09:44 AM", user: "Ananya Joshi" },
  { id: "CAS-7835", status: "Completed", date: "31 Mar 2026, 09:30 AM", user: "Dev Malhotra" },
];

const HEALTH = [
  { label: "CPU Usage",   value: 67, color: "#00d4ff" },
  { label: "Memory",      value: 54, color: "#7c3aed" },
  { label: "Network I/O", value: 82, color: "#f59e0b" },
  { label: "Storage",     value: 39, color: "#10b981" },
];

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", active: true },
  { icon: BarChart2,        label: "Analytics",  href: "/dashboard" },
  { icon: FileText,         label: "Reports",    href: "/home" },
  { icon: Settings,         label: "Settings",   href: "/dashboard" },
];

const BADGE: Record<string, { ring: string; text: string; glow: string; dot: string }> = {
  Completed:  { ring: "border-emerald-500/40",  text: "text-emerald-400",  glow: "shadow-[0_0_8px_rgba(16,185,129,0.3)]",  dot: "bg-emerald-400" },
  Processing: { ring: "border-[#00d4ff]/40",    text: "text-[#00d4ff]",    glow: "shadow-[0_0_8px_rgba(0,212,255,0.3)]",    dot: "bg-[#00d4ff]" },
  Failed:     { ring: "border-red-500/40",       text: "text-red-400",      glow: "shadow-[0_0_8px_rgba(239,68,68,0.3)]",    dot: "bg-red-400" },
  Pending:    { ring: "border-amber-500/40",     text: "text-amber-400",    glow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",   dot: "bg-amber-400" },
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCounter(target: number, duration = 1500) {
  const [n, setN] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return n;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#080c15]/95 backdrop-blur-2xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/50 capitalize">{p.dataKey}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ card, delay }: { card: typeof KPI[0]; delay: number }) {
  const raw = useCounter(Math.round(card.value));
  const display = card.suffix === "%" && card.value < 10
    ? card.value.toFixed(2)
    : raw.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: "easeOut" }}
      whileHover={{ y: -5, scale: 1.025 }}
      className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-5 overflow-hidden group cursor-default"
      style={{ transition: "box-shadow 0.3s ease, border-color 0.3s ease" }}
      data-testid={`kpi-card-${card.title.toLowerCase().replace(/ /g, "-")}`}
    >
      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
        style={{ boxShadow: `inset 0 0 40px ${card.color}12, 0 0 30px ${card.color}10` }}
      />
      {/* Top-right corner bleed */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none"
        style={{ background: `${card.color}30` }}
      />

      {/* Sparkline bg */}
      <div className="absolute bottom-0 right-0 w-28 h-12 opacity-25 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={card.spark}>
            <Line type="monotone" dataKey="v" stroke={card.color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-3">{card.title}</p>
      <p className="text-[2rem] font-black text-white leading-none mb-3 tabular-nums">
        {display}<span className="text-lg font-bold ml-0.5 text-white/60">{card.suffix}</span>
      </p>
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${card.up ? "text-emerald-400" : "text-red-400"}`}>
        {card.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {card.trend}
        <span className="text-white/25 font-normal ml-1">vs last week</span>
      </span>
    </motion.div>
  );
}

function HealthBar({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay * 1000 + 300);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div className="space-y-2" data-testid={`health-${label.toLowerCase().replace(/ /g, "-")}`}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/45">{label}</span>
        <span className="text-xs font-black tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${w}%` }}
          transition={{ duration: 1.1, ease: "easeOut", delay: delay + 0.35 }}
          style={{
            background: `linear-gradient(90deg, ${color}70, ${color})`,
            boxShadow: `0 0 10px ${color}60`,
          }}
        />
      </div>
    </div>
  );
}

function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg border border-white/10 bg-[#080c15]/95 backdrop-blur-xl px-3 py-1.5 text-xs font-medium text-white shadow-2xl pointer-events-none"
          >
            {label}
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#080c15]/95" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, nav] = useLocation();
  return (
    <>
      {/* Desktop sidebar — always visible, icon-only */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-16 z-30 flex-col items-center border-r border-white/[0.06] bg-[#080c15]/95 backdrop-blur-2xl py-4 gap-2">
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center mb-4 shadow-[0_0_18px_rgba(0,212,255,0.45)] flex-shrink-0">
          <Zap size={16} className="text-white" />
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1 w-full px-2">
          {NAV.map(({ icon: Icon, label, href, active }) => (
            <NavTooltip key={label} label={label}>
              <button
                onClick={() => nav(href)}
                data-testid={`nav-${label.toLowerCase()}`}
                className={`w-full flex items-center justify-center rounded-xl p-2.5 transition-all duration-200 relative group
                  ${active
                    ? "bg-[#00d4ff]/10 text-[#00d4ff] shadow-[0_0_14px_rgba(0,212,255,0.2)]"
                    : "text-white/30 hover:bg-white/[0.06] hover:text-white/70"
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-[#00d4ff] shadow-[0_0_8px_#00d4ff]" />
                )}
                <Icon size={18} className="flex-shrink-0" />
              </button>
            </NavTooltip>
          ))}
        </nav>

        {/* Logout */}
        <NavTooltip label="Log Out">
          <button
            onClick={() => nav("/")}
            data-testid="nav-logout"
            className="w-full flex items-center justify-center p-2.5 rounded-xl text-white/25 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut size={18} />
          </button>
        </NavTooltip>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 md:hidden backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed left-0 top-0 h-full w-56 z-50 md:hidden flex flex-col border-r border-white/[0.06] bg-[#080c15]/98 backdrop-blur-2xl py-5 px-3"
            >
              <div className="flex items-center gap-3 px-1 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center shadow-[0_0_14px_rgba(0,212,255,0.4)]">
                  <Zap size={15} className="text-white" />
                </div>
                <span className="text-white font-bold text-sm tracking-wide">CAS Analyzer</span>
                <button onClick={onClose} className="ml-auto text-white/30 hover:text-white transition-colors">
                  <X size={15} />
                </button>
              </div>
              <nav className="flex flex-col gap-1 flex-1">
                {NAV.map(({ icon: Icon, label, href, active }) => (
                  <button
                    key={label}
                    onClick={() => { nav(href); onClose(); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium
                      ${active ? "bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20" : "text-white/40 hover:bg-white/[0.05] hover:text-white/80"}`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </nav>
              <button
                onClick={() => nav("/")}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 text-sm font-medium"
              >
                <LogOut size={16} /> Log Out
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const notifs = 3;
  return (
    <header className="fixed top-0 left-0 md:left-16 right-0 z-20 flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] bg-[#080c15]/80 backdrop-blur-2xl">
      <button onClick={onMenu} className="md:hidden text-white/40 hover:text-white transition-colors mr-1" data-testid="button-mobile-menu">
        <Menu size={19} />
      </button>

      {/* Search */}
      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/25 hover:border-white/15 hover:bg-white/[0.05] transition-all duration-200 cursor-text flex-1 max-w-sm">
        <Search size={13} />
        <span className="text-sm flex-1 select-none">Search...</span>
        <span className="hidden sm:flex items-center gap-0.5 text-[10px] border border-white/[0.08] rounded px-1.5 py-0.5 font-medium">⌘K</span>
      </div>

      <div className="flex items-center gap-2.5 ml-auto">
        {/* Bell */}
        <button
          className="relative p-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/15 transition-all duration-200"
          data-testid="button-notifications"
        >
          <Bell size={15} />
          {notifs > 0 && (
            <>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#00d4ff]" />
              <motion.span
                className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#00d4ff]"
                animate={{ scale: [1, 2.5, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
            </>
          )}
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-white/[0.08]" data-testid="user-profile">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-white leading-tight">Arjun Sharma</p>
            <p className="text-[10px] text-white/25 leading-tight">arjun@casanalyzer.in</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center text-white text-[11px] font-black shadow-[0_0_12px_rgba(0,212,255,0.35)] flex-shrink-0">
            AS
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>

      {/* Background: cyber grid + radial haze */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,1) 1px,transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,212,255,0.06)_0%,transparent_70%)]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_50%_40%_at_80%_80%,rgba(124,58,237,0.05)_0%,transparent_70%)]" />

      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <TopBar onMenu={() => setMobileOpen(true)} />

      {/* Content */}
      <main className="md:ml-16 pt-[57px] min-h-screen">
        <div className="p-5 md:p-7 space-y-6 max-w-[1600px]">

          {/* ── Welcome ── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-start sm:items-center justify-between flex-wrap gap-4 pt-1"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Welcome back, Arjun
              </h1>
              <p className="text-sm text-white/35 mt-1">Here's your CAS command center — all systems nominal.</p>
            </div>
            <div
              className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08]"
              data-testid="status-system"
            >
              <motion.span
                className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <span className="text-[11px] font-semibold text-emerald-400 tracking-wide">CAS System · Online</span>
            </div>
          </motion.div>

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {KPI.map((card, i) => <KpiCard key={card.title} card={card} delay={0.08 + i * 0.09} />)}
          </div>

          {/* ── Area chart ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.55 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm p-6"
          >
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-1">Activity Monitor</p>
                <h2 className="text-base font-bold text-white">CAS Activity — Last 30 Days</h2>
              </div>
              <div className="flex items-center gap-5 text-xs text-white/40">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-[2px] rounded-full bg-[#00d4ff] shadow-[0_0_6px_#00d4ff] inline-block" />
                  Scans
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-5 h-[2px] rounded-full bg-[#7c3aed] shadow-[0_0_6px_#7c3aed] inline-block" />
                  Processed
                </span>
              </div>
            </div>

            <div className="h-64" data-testid="chart-activity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(255,255,255,0.07)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="scans" stroke="#00d4ff" strokeWidth={2} fill="url(#gCyan)"
                    filter="url(#glow)" dot={false} activeDot={{ r: 4, fill: "#00d4ff", strokeWidth: 0, filter: "url(#glow)" }} />
                  <Area type="monotone" dataKey="processed" stroke="#7c3aed" strokeWidth={2} fill="url(#gPurple)"
                    filter="url(#glow)" dot={false} activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0, filter: "url(#glow)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* ── Bottom row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 pb-8">

            {/* Recent scans table */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.58, duration: 0.55 }}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-0.5">Live Feed</p>
                  <h2 className="text-base font-bold text-white">Recent Scans</h2>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/25">
                  <Activity size={11} />
                  <span>Live</span>
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] ml-0.5"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                </div>
              </div>

              <div className="overflow-x-auto" data-testid="table-recent-scans">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      {["Scan ID", "User", "Status", "Date", "Action"].map(h => (
                        <th key={h} className="text-left text-[10px] uppercase tracking-widest text-white/25 font-semibold pb-3 pr-5 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SCANS.map((row, i) => {
                      const b = BADGE[row.status] ?? BADGE.Completed;
                      return (
                        <motion.tr
                          key={row.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7 + i * 0.06 }}
                          className="border-b border-white/[0.035] hover:bg-white/[0.025] transition-colors group"
                        >
                          <td className="py-3.5 pr-5 font-mono text-xs text-[#00d4ff] font-bold tracking-wide">{row.id}</td>
                          <td className="py-3.5 pr-5 text-xs text-white/60 whitespace-nowrap">{row.user}</td>
                          <td className="py-3.5 pr-5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${b.ring} ${b.text} ${b.glow} bg-white/[0.03]`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3.5 pr-5 text-[11px] text-white/25 whitespace-nowrap">{row.date}</td>
                          <td className="py-3.5">
                            <button
                              data-testid={`button-view-${row.id}`}
                              className="flex items-center gap-1 text-[11px] text-white/25 hover:text-[#00d4ff] transition-colors duration-200 font-medium"
                            >
                              <ExternalLink size={11} />
                              View
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* System health */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.63, duration: 0.55 }}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm p-6 flex flex-col"
              data-testid="widget-system-health"
            >
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-0.5">Infrastructure</p>
                <h2 className="text-base font-bold text-white">System Health</h2>
              </div>

              <div className="space-y-5 flex-1">
                {HEALTH.map((h, i) => <HealthBar key={h.label} {...h} delay={i * 0.13} />)}
              </div>

              <div className="mt-6 pt-5 border-t border-white/[0.05] grid grid-cols-2 gap-3">
                {[
                  { icon: Cpu,        label: "CPU Cores",  value: "16 vCPU",    color: "#00d4ff" },
                  { icon: MemoryStick,label: "RAM",        value: "32 GB",      color: "#7c3aed" },
                  { icon: HardDrive,  label: "Storage",    value: "500 GB SSD", color: "#10b981" },
                  { icon: Wifi,       label: "Uptime",     value: "99.97%",     color: "#f59e0b" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-start gap-2">
                    <div
                      className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}15`, boxShadow: `0 0 8px ${color}20` }}
                    >
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/25">{label}</p>
                      <p className="text-xs font-bold text-white">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
