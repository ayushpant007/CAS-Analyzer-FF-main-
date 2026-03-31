import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import {
  LayoutDashboard, BarChart2, FileText, Settings, LogOut,
  Search, Bell, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Activity, Cpu, Wifi, HardDrive, MemoryStick, ExternalLink, Menu, X,
} from "lucide-react";
import { Zap } from "lucide-react";

// ── Placeholder data ──────────────────────────────────────────────────────────

const ACTIVITY_DATA = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 2, 1 + i);
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    scans: Math.floor(60 + Math.random() * 120 + Math.sin(i / 3) * 30),
    processed: Math.floor(50 + Math.random() * 100 + Math.cos(i / 4) * 25),
  };
});

const SPARKLINE = (base: number) =>
  Array.from({ length: 8 }, (_, i) => ({ v: base + Math.floor(Math.random() * 20 - 10 + i * 2) }));

const KPI_CARDS = [
  { title: "Total Processed", value: 48291, suffix: "", trend: "+5.2%", up: true, color: "#00d4ff", spark: SPARKLINE(120) },
  { title: "Active Sessions", value: 1847, suffix: "", trend: "+12.1%", up: true, color: "#7c3aed", spark: SPARKLINE(80) },
  { title: "Error Rate", value: 0.42, suffix: "%", trend: "-0.18%", up: false, color: "#f59e0b", spark: SPARKLINE(10) },
  { title: "System Load", value: 67, suffix: "%", trend: "+3.4%", up: true, color: "#10b981", spark: SPARKLINE(60) },
];

const RECENT_ACTIVITY = [
  { id: "CAS-7841", status: "Completed", date: "31 Mar 2026, 10:42 AM", user: "Arjun Sharma" },
  { id: "CAS-7840", status: "Processing", date: "31 Mar 2026, 10:38 AM", user: "Priya Mehta" },
  { id: "CAS-7839", status: "Completed", date: "31 Mar 2026, 10:31 AM", user: "Rohit Verma" },
  { id: "CAS-7838", status: "Failed", date: "31 Mar 2026, 10:15 AM", user: "Sneha Iyer" },
  { id: "CAS-7837", status: "Completed", date: "31 Mar 2026, 09:58 AM", user: "Kabir Nair" },
  { id: "CAS-7836", status: "Pending", date: "31 Mar 2026, 09:44 AM", user: "Ananya Joshi" },
  { id: "CAS-7835", status: "Completed", date: "31 Mar 2026, 09:30 AM", user: "Dev Malhotra" },
];

const HEALTH_BARS = [
  { label: "CPU Usage", value: 67, color: "#00d4ff" },
  { label: "Memory", value: 54, color: "#7c3aed" },
  { label: "Network I/O", value: 82, color: "#f59e0b" },
  { label: "Storage", value: 39, color: "#10b981" },
];

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", active: true },
  { icon: BarChart2, label: "Analytics", href: "/dashboard" },
  { icon: FileText, label: "Reports", href: "/home" },
  { icon: Settings, label: "Settings", href: "/dashboard" },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Completed:  { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  Processing: { bg: "bg-[#00d4ff]/10",   text: "text-[#00d4ff]",  border: "border-[#00d4ff]/30",  dot: "bg-[#00d4ff]" },
  Failed:     { bg: "bg-red-500/10",      text: "text-red-400",    border: "border-red-500/30",    dot: "bg-red-400" },
  Pending:    { bg: "bg-amber-500/10",    text: "text-amber-400",  border: "border-amber-500/30",  dot: "bg-amber-400" },
};

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCounter(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(target * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return count;
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b0f19]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <p className="text-[11px] text-white/40 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/60 capitalize">{p.dataKey}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ card, delay }: { card: typeof KPI_CARDS[0]; delay: number }) {
  const displayVal = useCounter(Math.round(card.value));
  const formatted = card.suffix === "%" && card.value < 10
    ? card.value.toFixed(2)
    : displayVal.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 overflow-hidden group transition-all duration-300 hover:border-white/20"
      data-testid={`kpi-card-${card.title.toLowerCase().replace(/ /g, "-")}`}
    >
      {/* Corner glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle,${card.color}18,transparent 70%)`, transform: "translate(30%,-30%)" }} />

      {/* Sparkline bg */}
      <div className="absolute bottom-2 right-0 w-24 h-10 opacity-30">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={card.spark}>
            <Line type="monotone" dataKey="v" stroke={card.color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-white/40 font-medium uppercase tracking-wide mb-3">{card.title}</p>
      <p className="text-3xl font-extrabold text-white mb-2">
        {formatted}<span className="text-lg ml-0.5">{card.suffix}</span>
      </p>
      <div className={`inline-flex items-center gap-1 text-xs font-medium ${card.up ? "text-emerald-400" : "text-red-400"}`}>
        {card.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {card.trend} <span className="text-white/30 font-normal ml-1">vs last week</span>
      </div>
    </motion.div>
  );
}

// ── Health bar ────────────────────────────────────────────────────────────────
function HealthBar({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(value), delay * 1000 + 200); return () => clearTimeout(t); }, [value, delay]);
  return (
    <div className="space-y-1.5" data-testid={`health-${label.toLowerCase().replace(/ /g, "-")}`}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div className="h-full rounded-full"
          style={{ width: `${width}%`, background: `linear-gradient(90deg,${color}99,${color})`, boxShadow: `0 0 8px ${color}60` }}
          initial={{ width: 0 }} animate={{ width: `${width}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: delay + 0.3 }} />
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [, navigate] = useLocation();
  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-full z-30 flex flex-col border-r border-white/[0.06] bg-[#080c15]/95 backdrop-blur-xl overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center flex-shrink-0 shadow-[0_0_14px_rgba(0,212,255,0.4)]">
          <Zap size={15} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }} className="text-white font-bold text-sm tracking-wide whitespace-nowrap">
              CAS Analyzer
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ icon: Icon, label, href, active }) => (
          <button key={label} onClick={() => navigate(href)}
            data-testid={`nav-${label.toLowerCase()}`}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
              ${active ? "bg-[#00d4ff]/10 border border-[#00d4ff]/20 text-[#00d4ff]" : "text-white/40 hover:bg-white/5 hover:text-white/80"}`}
          >
            {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-[#00d4ff] shadow-[0_0_8px_#00d4ff]" />}
            <Icon size={17} className="flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }} className="text-sm font-medium whitespace-nowrap">{label}</motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-5 border-t border-white/[0.06] pt-4">
        <button onClick={() => navigate("/")} data-testid="nav-logout"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200">
          <LogOut size={17} className="flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }} className="text-sm font-medium whitespace-nowrap">Log Out</motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse toggle */}
      <button onClick={onToggle} data-testid="button-sidebar-toggle"
        className="absolute top-5 -right-3 w-6 h-6 rounded-full border border-white/15 bg-[#0b0f19] flex items-center justify-center text-white/40 hover:text-white/80 hover:border-white/30 transition-all duration-200 shadow-md">
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </motion.aside>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar({ sidebarWidth, onMenuClick }: { sidebarWidth: number; onMenuClick: () => void }) {
  const [notifCount] = useState(3);
  return (
    <header className="fixed top-0 right-0 z-20 flex items-center gap-4 px-6 py-3.5 border-b border-white/[0.06] bg-[#080c15]/80 backdrop-blur-xl"
      style={{ left: sidebarWidth }}>
      {/* Mobile menu */}
      <button onClick={onMenuClick} className="md:hidden text-white/50 hover:text-white transition-colors" data-testid="button-mobile-menu">
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white/30 hover:border-white/20 transition-all duration-200 cursor-text">
          <Search size={14} />
          <span className="text-sm flex-1">Search anything...</span>
          <span className="hidden sm:flex items-center gap-1 text-[11px] border border-white/10 rounded-md px-1.5 py-0.5">⌘K</span>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Notifications */}
        <button data-testid="button-notifications"
          className="relative p-2 rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:text-white hover:border-white/20 transition-all duration-200">
          <Bell size={16} />
          {notifCount > 0 && (
            <>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00d4ff]" />
              <motion.span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00d4ff] opacity-60"
                animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }} />
            </>
          )}
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-white/10" data-testid="user-profile">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white">Arjun Sharma</p>
            <p className="text-[10px] text-white/30">arjun@casanalyzer.in</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center text-white text-xs font-bold shadow-[0_0_12px_rgba(0,212,255,0.3)]">
            AS
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarWidth = collapsed ? 64 : 220;

  return (
    <div className="min-h-screen bg-[#0b0f19]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Cyber grid bg */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,1) 1px,transparent 1px)`,
          backgroundSize: "50px 50px",
        }} />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,212,255,0.05)_0%,transparent_70%)]" />

      {/* Sidebar (desktop always visible, mobile drawer) */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 md:hidden" />
            <motion.div initial={{ x: -220 }} animate={{ x: 0 }} exit={{ x: -220 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed left-0 top-0 h-full z-50 w-[220px] md:hidden">
              <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} />
              <button onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <TopBar sidebarWidth={sidebarWidth} onMenuClick={() => setMobileSidebarOpen(true)} />

      {/* Main content */}
      <motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="pt-16 min-h-screen hidden md:block"
      >
        <div className="p-6 space-y-6 max-w-[1600px]">

          {/* ── Welcome header ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome back, Arjun 👋</h1>
              <p className="text-sm text-white/40 mt-0.5">Here's what's happening across your CAS operations today.</p>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10" data-testid="status-system">
              <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
              <span className="text-xs font-medium text-emerald-400">CAS System · Online</span>
            </div>
          </motion.div>

          {/* ── KPI cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {KPI_CARDS.map((card, i) => <KpiCard key={card.title} card={card} delay={0.1 + i * 0.08} />)}
          </div>

          {/* ── Area chart ── */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Activity</p>
                <h2 className="text-lg font-bold text-white">CAS Activity — Last 30 Days</h2>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="w-6 h-0.5 rounded-full bg-[#00d4ff] inline-block" /> Scans
                </span>
                <span className="flex items-center gap-1.5 text-white/50">
                  <span className="w-6 h-0.5 rounded-full bg-[#7c3aed] inline-block" /> Processed
                </span>
              </div>
            </div>
            <div className="h-64" data-testid="chart-activity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="processGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false}
                    interval={4} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="scans" stroke="#00d4ff" strokeWidth={2}
                    fill="url(#scanGrad)" filter="url(#glow)" dot={false} activeDot={{ r: 4, fill: "#00d4ff", strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="processed" stroke="#7c3aed" strokeWidth={2}
                    fill="url(#processGrad)" filter="url(#glow)" dot={false} activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* ── Bottom row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

            {/* Activity table */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.5 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-0.5">Feed</p>
                  <h2 className="text-base font-bold text-white">Recent Scans</h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/30">
                  <Activity size={12} />
                  <span>Live</span>
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] ml-1"
                    animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                </div>
              </div>
              <div className="overflow-x-auto" data-testid="table-recent-scans">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Scan ID", "User", "Status", "Date", "Action"].map(h => (
                        <th key={h} className="text-left text-[11px] text-white/30 font-medium uppercase tracking-wider pb-3 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_ACTIVITY.map((row, i) => {
                      const s = STATUS_CONFIG[row.status] || STATUS_CONFIG.Completed;
                      return (
                        <motion.tr key={row.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.65 + i * 0.06 }}
                          className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group">
                          <td className="py-3.5 pr-4 font-mono text-xs text-[#00d4ff]">{row.id}</td>
                          <td className="py-3.5 pr-4 text-xs text-white/70 whitespace-nowrap">{row.user}</td>
                          <td className="py-3.5 pr-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${s.bg} ${s.text} ${s.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 text-[11px] text-white/30 whitespace-nowrap">{row.date}</td>
                          <td className="py-3.5">
                            <button data-testid={`button-view-${row.id}`}
                              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-[#00d4ff] transition-colors group-hover:text-white/60">
                              <ExternalLink size={11} /> View
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
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 flex flex-col" data-testid="widget-system-health">
              <div className="mb-6">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-0.5">Infrastructure</p>
                <h2 className="text-base font-bold text-white">System Health</h2>
              </div>

              <div className="space-y-5 flex-1">
                {HEALTH_BARS.map((bar, i) => <HealthBar key={bar.label} {...bar} delay={i * 0.12} />)}
              </div>

              {/* Status footer */}
              <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-2 gap-3">
                {[
                  { icon: Cpu, label: "CPU Cores", value: "16 vCPU", color: "#00d4ff" },
                  { icon: MemoryStick, label: "RAM", value: "32 GB", color: "#7c3aed" },
                  { icon: HardDrive, label: "Storage", value: "500 GB SSD", color: "#10b981" },
                  { icon: Wifi, label: "Uptime", value: "99.97%", color: "#f59e0b" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-start gap-2">
                    <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}15` }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30">{label}</p>
                      <p className="text-xs font-semibold text-white">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </motion.main>

      {/* Mobile main content (no margin from sidebar) */}
      <main className="pt-16 min-h-screen block md:hidden">
        <div className="p-4 space-y-5 max-w-[1600px]">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-xl font-extrabold text-white">Welcome back, Arjun 👋</h1>
            <p className="text-xs text-white/40 mt-0.5">CAS operations today.</p>
          </motion.div>
          <div className="grid grid-cols-2 gap-3">
            {KPI_CARDS.map((card, i) => <KpiCard key={card.title} card={card} delay={0.1 + i * 0.08} />)}
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-bold text-white mb-4">CAS Activity — Last 30 Days</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_DATA} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scanGradM" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} interval={7} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="scans" stroke="#00d4ff" strokeWidth={2} fill="url(#scanGradM)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <div className="space-y-4">
            {HEALTH_BARS.map((bar, i) => <HealthBar key={bar.label} {...bar} delay={i * 0.12} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
