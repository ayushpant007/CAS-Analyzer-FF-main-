import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, useSpring, useInView, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
  LineChart, Line,
  BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import {
  LayoutDashboard, BarChart2, FileText, Settings, LogOut,
  Search, Bell, Zap, TrendingUp, TrendingDown,
  CheckCircle2, Clock, XCircle, Upload,
  ChevronRight, Activity, Menu, X,
  Sparkles, Shield, ArrowUpRight, Construction, User,
} from "lucide-react";
import { AuthModal, type AuthView } from "./auth";
import { GmailPanel } from "@/components/GmailPanel";

// ─── Injected CSS ──────────────────────────────────────────────────────────────
const STYLE = `
  @keyframes spin-gradient {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes pulse-orb {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(1.12); }
  }
  @keyframes dot-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.6); }
    50%       { box-shadow: 0 0 0 7px rgba(52,211,153,0); }
  }
  @keyframes ticker-scroll {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes float-particle {
    0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.4; }
    33%       { transform: translateY(-30px) translateX(15px); opacity: 0.7; }
    66%       { transform: translateY(-15px) translateX(-10px); opacity: 0.5; }
  }
  @keyframes scan-line {
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(400%); opacity: 0; }
  }
  @keyframes border-glow {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
  @keyframes ring-spin {
    from { stroke-dashoffset: 400; }
    to   { stroke-dashoffset: 0; }
  }
  .dot-pulse { animation: dot-pulse 2s ease-in-out infinite; }
  .grad-border {
    position: relative;
    isolation: isolate;
  }
  .grad-border::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, #22d3ee22, #a855f722, #22d3ee22);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    animation: border-glow 3s ease-in-out infinite;
  }
  .grad-border-bright::before {
    background: linear-gradient(135deg, #22d3ee55, #a855f755, #22d3ee55);
  }
  .sidebar-btn:hover { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.8) !important; }
  .sidebar-btn-red:hover { background: rgba(248,113,113,0.1) !important; color: #f87171 !important; }
  .row-hover:hover { background: rgba(34,211,238,0.04) !important; }
  .view-btn:hover { color: #22d3ee !important; }
  .ticker-wrap { overflow: hidden; white-space: nowrap; }
  .ticker-inner { display: inline-flex; animation: ticker-scroll 28s linear infinite; }
  .particle { position: absolute; border-radius: 50%; pointer-events: none; }
  @media (min-width: 768px) { .md-ml-60 { margin-left: 60px !important; } }
`;

// ─── Data ──────────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORY_DATA = [
  { name: "Equity",  value: 54, fill: "#22d3ee" },
  { name: "Debt",    value: 24, fill: "#a855f7" },
  { name: "Hybrid",  value: 14, fill: "#f59e0b" },
  { name: "Other",   value: 8,  fill: "#34d399" },
];


const SPARKLINES: Record<string, number[]> = {
  "Reports Analyzed": [48, 62, 55, 71, 68, 80, 75, 92, 88, 100],
  "Active Portfolios": [30, 40, 38, 52, 49, 58, 62, 70, 68, 80],
  "Success Rate":     [88, 90, 87, 92, 91, 94, 93, 96, 95, 98],
  "Avg Funds / CAS":  [9, 10, 11, 10, 12, 11, 13, 12, 13, 14],
};

const FALLBACK_TICKER = [
  { label: "NIFTY 50",   value: "--", up: true },
  { label: "SENSEX",     value: "--", up: true },
  { label: "NIFTY BANK", value: "--", up: true },
  { label: "NIFTY IT",   value: "--", up: true },
  { label: "NIFTY MID",  value: "--", up: true },
  { label: "GOLD ETF",   value: "--", up: true },
  { label: "SMALL CAP",  value: "--", up: true },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  completed:  { label: "Analyzed",   color: "#34d399", bg: "rgba(52,211,153,0.08)",  icon: CheckCircle2 },
  processing: { label: "Processing", color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  icon: Clock },
  failed:     { label: "Failed",     color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: XCircle },
  pending:    { label: "Pending",    color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: Clock },
};

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", section: "dashboard", active: true,  comingSoon: false },
  { icon: BarChart2,        label: "Analytics", href: "",           section: "analytics", active: false, comingSoon: false },
  { icon: Upload,           label: "Upload CAS",href: "/home",      section: "",          active: false, comingSoon: false },
  { icon: FileText,         label: "Reports",   href: "/reports",   section: "",          active: false, comingSoon: false },
];

// ─── Floating Particles ────────────────────────────────────────────────────────
function Particles() {
  const particles = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 3,
      delay: Math.random() * 6,
      dur: 6 + Math.random() * 8,
      color: ["#22d3ee", "#a855f7", "#34d399", "#f59e0b"][i % 4],
    }))
  ).current;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `float-particle ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Number ───────────────────────────────────────────────────────────
function AnimatedNum({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 55, damping: 16 });
  const [display, setDisplay] = useState("0");

  useEffect(() => { if (inView) spring.set(value); }, [inView, value, spring]);
  useEffect(() => spring.on("change", v =>
    setDisplay(decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString())
  ), [spring, decimals]);

  return <span ref={ref}>{display}</span>;
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={44}>
      <LineChart data={pts} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <filter id={`spark-glow-${color.replace("#","")}`}>
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <Line
          type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} dot={false}
          filter={`url(#spark-glow-${color.replace("#","")})`}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Animated Donut ───────────────────────────────────────────────────────────
function AnimatedDonut({ data, activeIdx, onHover }: { data: typeof CATEGORY_DATA; activeIdx: number; onHover: (i: number) => void }) {
  const renderActive = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
          startAngle={startAngle} endAngle={endAngle} fill={fill}
          style={{ filter: `drop-shadow(0 0 12px ${fill})` }} />
      </g>
    );
  };

  return (
    <PieChart width={180} height={180}>
      <defs>
        {data.map((d, i) => (
          <radialGradient key={i} id={`pie-grad-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={d.fill} stopOpacity={1} />
            <stop offset="100%" stopColor={d.fill} stopOpacity={0.6} />
          </radialGradient>
        ))}
      </defs>
      <Pie
        data={data} dataKey="value" cx={86} cy={86}
        innerRadius={50} outerRadius={76}
        startAngle={90} endAngle={-270}
        paddingAngle={3}
        activeIndex={activeIdx}
        activeShape={renderActive}
        onMouseEnter={(_, idx) => onHover(idx)}
      >
        {data.map((d, i) => (
          <Cell key={i} fill={`url(#pie-grad-${i})`}
            style={{ filter: i === activeIdx ? `drop-shadow(0 0 8px ${d.fill})` : "none", cursor: "pointer" }} />
        ))}
      </Pie>
    </PieChart>
  );
}

// ─── Chart Tooltip ─────────────────────────────────────────────────────────────
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(9,13,22,0.98)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 20px rgba(34,211,238,0.08)",
      backdropFilter: "blur(20px)",
    }}>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` }} />
          <span style={{ color: "rgba(255,255,255,0.45)", textTransform: "capitalize" }}>{p.dataKey}:</span>
          <span style={{ color: "#fff", fontWeight: 800 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Market Ticker ─────────────────────────────────────────────────────────────
function MarketTicker() {
  const { data: indices } = useQuery<{ label: string; value: string; up: boolean }[]>({
    queryKey: ["/api/market/indices"],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
  const items = indices && indices.length > 0 ? indices : FALLBACK_TICKER;
  const doubled = [...items, ...items];
  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.04)",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      background: "rgba(255,255,255,0.015)",
      backdropFilter: "blur(10px)",
      padding: "7px 0",
      overflow: "hidden",
      marginBottom: 0,
    }}>
      <div className="ticker-inner" style={{ gap: 0 }}>
        {doubled.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 28px", borderRight: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>{t.label}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: t.up ? "#34d399" : "#f87171", letterSpacing: "0.02em" }}>
              {t.value !== "--" ? (t.up ? "▲" : "▼") : ""} {t.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ mobileOpen, onClose, onLogout, comingSoonToast, activeSection, onSectionChange }: {
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  comingSoonToast: (label: string) => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}) {
  const [, nav] = useLocation();

  const handleNav = (item: typeof NAV[0]) => {
    if (item.comingSoon) { comingSoonToast(item.label); onClose(); return; }
    if (item.section) { onSectionChange(item.section); onClose(); return; }
    nav(item.href); onClose();
  };

  const items = (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = item.section ? activeSection === item.section : item.active;
        return (
          <div key={item.label} style={{ position: "relative" }}>
            <button
              onClick={() => handleNav(item)}
              title={item.label}
              data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "11px 0", borderRadius: 12, border: "none",
                cursor: "pointer",
                transition: "all 0.25s ease",
                background: isActive ? "rgba(34,211,238,0.12)" : "transparent",
                color: isActive ? "#22d3ee" : "rgba(255,255,255,0.28)",
                boxShadow: isActive ? "0 0 20px rgba(34,211,238,0.22), inset 0 0 14px rgba(34,211,238,0.06)" : "none",
                position: "relative",
              }}
              className={isActive ? "" : "sidebar-btn"}
            >
              {isActive && (
                <motion.span layoutId="active-pill" style={{
                  position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                  width: 3, height: 22, borderRadius: 2,
                  background: "linear-gradient(180deg, #22d3ee, #a855f7)",
                  boxShadow: "0 0 10px #22d3ee",
                }} />
              )}
              <Icon size={18} />
            </button>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="hidden md:flex" style={{
        position: "fixed", left: 0, top: 0, height: "100%", width: 60,
        flexDirection: "column", alignItems: "center",
        background: "rgba(7,10,18,0.99)", borderRight: "1px solid rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)", zIndex: 30, padding: "16px 6px", gap: 8,
      }}>
        <motion.div
          animate={{ boxShadow: ["0 0 20px rgba(34,211,238,0.4)", "0 0 40px rgba(168,85,247,0.4)", "0 0 20px rgba(34,211,238,0.4)"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 36, height: 36, borderRadius: 10, marginBottom: 20,
            background: "linear-gradient(135deg, #22d3ee, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <Zap size={17} color="#fff" />
        </motion.div>
        {items}
        <button
          onClick={onLogout}
          title="Log Out"
          data-testid="nav-logout"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
            background: "transparent", color: "rgba(255,255,255,0.2)", transition: "all 0.2s ease",
          }}
          className="sidebar-btn-red"
        >
          <LogOut size={17} />
        </button>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 40 }}
            />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              style={{
                position: "fixed", left: 0, top: 0, height: "100%", width: 220,
                background: "rgba(7,10,18,0.99)", borderRight: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(24px)", zIndex: 50, padding: "20px 12px",
                display: "flex", flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #22d3ee, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(34,211,238,0.4)" }}>
                  <Zap size={16} color="#fff" />
                </div>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "0.02em" }}>CAS Analyzer</span>
                <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
                  <X size={15} />
                </button>
              </div>
              <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const isItemActive = item.section ? activeSection === item.section : item.active;
                  return (
                    <button key={item.label} onClick={() => handleNav(item)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
                        background: isItemActive ? "rgba(34,211,238,0.1)" : "transparent",
                        color: isItemActive ? "#22d3ee" : "rgba(255,255,255,0.4)",
                        fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                        position: "relative",
                      }}>
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
              <button onClick={onLogout}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", color: "rgba(248,113,113,0.6)", fontSize: 13, fontWeight: 600 }}>
                <LogOut size={16} />Log Out
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

const NOTIFICATIONS = [
  { id: 1, title: "New CAS Uploaded",     body: "Priya Mehta uploaded CAS-7840",           time: "2 min ago",  color: "#22d3ee", unread: true  },
  { id: 2, title: "Analysis Complete",    body: "CAS-7839 (Rohit Verma) fully analyzed",   time: "18 min ago", color: "#34d399", unread: true  },
  { id: 3, title: "System Health Alert",  body: "CPU usage peaked at 89% momentarily",     time: "1 hr ago",   color: "#f59e0b", unread: false },
  { id: 4, title: "Report Exported",      body: "Dev Malhotra exported PDF report",        time: "3 hr ago",   color: "#a855f7", unread: false },
];

// ─── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({ onMenu, user, onOpenAuth, searchQuery, setSearchQuery }: {
  onMenu: () => void;
  user: { name: string; email: string } | null;
  onOpenAuth: (view: AuthView) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(NOTIFICATIONS.filter(n => n.unread).length);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = user ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0,
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 20px", height: 56,
      background: "rgba(7,10,18,0.92)", backdropFilter: "blur(24px)",
      borderBottom: "1px solid rgba(255,255,255,0.04)", zIndex: 20,
    }} className="md-ml-60">
      <button onClick={onMenu} className="md:hidden" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }} data-testid="button-mobile-menu">
        <Menu size={20} />
      </button>

      {/* Working search input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)",
        flex: 1, maxWidth: 300, transition: "all 0.2s",
      }}>
        <Search size={13} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
        <input
          data-testid="input-search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search reports, funds..."
          style={{
            background: "none", border: "none", outline: "none",
            fontSize: 12, color: "#fff", flex: 1, minWidth: 0,
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <motion.button
            data-testid="button-notifications"
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { setNotifOpen(o => !o); setUnreadCount(0); }}
            style={{
              position: "relative", padding: 8, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.05)",
              background: notifOpen ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.02)",
              cursor: "pointer", color: "rgba(255,255,255,0.35)",
            }}>
            <Bell size={15} />
            {unreadCount > 0 && (
              <motion.span
                animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                style={{
                  position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%",
                  background: "#22d3ee", boxShadow: "0 0 8px #22d3ee", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 900, color: "#070a12",
                }}>
              </motion.span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  width: 320, borderRadius: 16,
                  background: "rgba(7,10,18,0.98)", border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 30px rgba(34,211,238,0.06)",
                  backdropFilter: "blur(24px)", overflow: "hidden", zIndex: 100,
                }}
                data-testid="dropdown-notifications"
              >
                <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Notifications</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>All caught up</span>
                </div>
                {NOTIFICATIONS.map(n => (
                  <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 12, alignItems: "flex-start", background: n.unread ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.color, boxShadow: `0 0 8px ${n.color}`, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: n.unread ? "#fff" : "rgba(255,255,255,0.55)", marginBottom: 2 }}>{n.title}</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{n.body}</p>
                    </div>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2 }}>{n.time}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User area */}
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.05)" }} data-testid="user-profile">
            <div className="hidden sm:block" style={{ textAlign: "right" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{user.name}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", lineHeight: 1.3 }}>{user.email}</p>
            </div>
            <motion.div whileHover={{ scale: 1.08 }} style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg, #22d3ee, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 900, color: "#fff",
              boxShadow: "0 0 20px rgba(34,211,238,0.5)", flexShrink: 0, cursor: "pointer",
            }}>
              {initials}
            </motion.div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              data-testid="button-header-signin"
              onClick={() => { window.location.href = "/login"; }}
              style={{
                padding: "7px 14px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #22d3ee, #a855f7)",
                color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 0 16px rgba(34,211,238,0.3)",
              }}>
              Sign In
            </motion.button>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── CAS Launch Popup ──────────────────────────────────────────────────────────
function CASLaunchPopup({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [progress, setProgress] = useState(100);
  const DURATION = 6000;
  const INTERVAL = 50;

  useEffect(() => {
    const step = (INTERVAL / DURATION) * 100;
    const timer = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(timer); onClose(); return 0; }
        return p - step;
      });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -80, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -60, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, width: "min(440px, calc(100vw - 32px))",
      }}
    >
      <div style={{
        background: "rgba(8,15,31,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(0,212,255,0.25)",
        borderRadius: 20,
        padding: "18px 20px 14px",
        boxShadow: "0 0 40px rgba(0,212,255,0.15), 0 20px 60px rgba(0,0,0,0.5)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* top glow line */}
        <div style={{ position: "absolute", top: 0, left: 16, right: 16, height: 1, background: "linear-gradient(90deg,transparent,#00d4ff,transparent)" }} />

        {/* close */}
        <button
          onClick={onClose}
          data-testid="button-popup-close"
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", lineHeight: 1 }}
        >
          <X size={15} />
        </button>

        {/* content */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(124,58,237,0.2))",
            border: "1px solid rgba(0,212,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 22 }}>🚀</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
              Ready to launch CAS Analyzer
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              You're signed in. Explore your portfolio insights.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { onClose(); navigate("/home"); }}
            data-testid="button-popup-go"
            style={{
              flexShrink: 0, padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              boxShadow: "0 0 16px rgba(0,212,255,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            Go to CAS
          </motion.button>
        </div>

        {/* progress bar */}
        <div style={{ marginTop: 12, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: "linear-gradient(90deg,#00d4ff,#7c3aed)",
            width: `${progress}%`,
            transition: `width ${INTERVAL}ms linear`,
          }} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Analytics View ────────────────────────────────────────────────────────────
function AnalyticsView({ reports, user }: { reports: any[]; user: { name: string; email: string } | null }) {
  const report = reports[0];
  const analysis = report?.analysis;

  if (!analysis) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
        <BarChart2 size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
        <p style={{ fontSize: 15, fontWeight: 600 }}>No CAS data yet</p>
        <p style={{ fontSize: 13, marginTop: 6 }}>Upload a CAS statement to see analytics</p>
      </div>
    );
  }

  const mfSnapshot: any[] = analysis.mf_snapshot ?? [];
  const historicalVals: any[] = (analysis.historical_valuations ?? []).map((v: any) => ({
    name: v.month_year,
    value: Math.round(v.valuation),
    change: v.change_percentage ?? 0,
  }));
  const transactions: any[] = analysis.transactions ?? [];
  const categoryComparison: any[] = analysis.category_comparison ?? [];

  // Build fund-category distribution from mf_snapshot
  const catMap: Record<string, number> = {};
  mfSnapshot.forEach((f: any) => {
    const cat = /equity/i.test(f.fund_category) ? "Equity"
      : /debt|bond|liquid|money market/i.test(f.fund_category) ? "Debt"
      : /hybrid|balanced/i.test(f.fund_category) ? "Hybrid"
      : /gold|silver|commodity/i.test(f.fund_category) ? "Commodity"
      : "Other";
    catMap[cat] = (catMap[cat] || 0) + (f.valuation || 0);
  });
  const catTotal = Object.values(catMap).reduce((a, b) => a + b, 0);
  const PIE_COLORS: Record<string, string> = { Equity: "#22d3ee", Debt: "#a855f7", Hybrid: "#f59e0b", Commodity: "#f87171", Other: "#34d399" };
  const catPieData = Object.entries(catMap).map(([name, value]) => ({
    name, value: Math.round(value), pct: catTotal > 0 ? Math.round((value / catTotal) * 100) : 0, fill: PIE_COLORS[name] || "#94a3b8",
  })).sort((a, b) => b.value - a.value);

  // Top 5 funds
  const top5 = [...mfSnapshot].sort((a, b) => (b.valuation || 0) - (a.valuation || 0)).slice(0, 5);

  // Category vs Target
  const catVsTarget = categoryComparison.map((c: any) => ({
    name: c.category,
    current: c.current_pct ?? 0,
    target: c.target_pct ?? 0,
  }));

  // Transaction summary
  const txSummary: Record<string, number> = {};
  transactions.forEach((t: any) => {
    txSummary[t.type] = (txSummary[t.type] || 0) + (t.amount || 0);
  });

  const totalValue = mfSnapshot.reduce((a: number, f: any) => a + (f.valuation || 0), 0);
  const totalInvested = mfSnapshot.reduce((a: number, f: any) => a + (f.invested_amount || 0), 0);
  const totalPL = mfSnapshot.reduce((a: number, f: any) => a + (f.unrealised_profit_loss || 0), 0);
  const plPct = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(1) : "0";

  const fmtCr = (v: number) => v >= 10000000 ? `₹${(v / 10000000).toFixed(2)}Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString("en-IN")}`;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
      style={{ padding: "28px 24px 48px", maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(34,211,238,0.8)", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 6 }}>
          Analytics
        </p>
        <h2 style={{ fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
          Portfolio Analytics — <span style={{ background: "linear-gradient(135deg, #22d3ee, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{analysis.investor_name ?? "Unknown"}</span>
        </h2>
      </div>

      {/* Summary KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Portfolio Value", value: fmtCr(totalValue), color: "#22d3ee" },
          { label: "Total Invested", value: fmtCr(totalInvested), color: "#a855f7" },
          { label: "Unrealised P&L", value: fmtCr(totalPL), color: totalPL >= 0 ? "#34d399" : "#f87171" },
          { label: "Overall Return", value: `${totalPL >= 0 ? "+" : ""}${plPct}%`, color: totalPL >= 0 ? "#34d399" : "#f87171" },
          { label: "Funds", value: mfSnapshot.length, color: "#f59e0b" },
          { label: "Transactions", value: transactions.length, color: "#22d3ee" },
        ].map((kpi) => (
          <div key={kpi.label} style={{ borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "18px 20px" }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginBottom: 6 }}>{kpi.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1: Historical + Pie */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 }} className="chart-grid">

        {/* Historical Valuations */}
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "22px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Portfolio Value Trend</p>
          {historicalVals.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={historicalVals} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="an-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip contentStyle={{ background: "#0d1020", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, color: "#fff", fontSize: 12 }}
                  formatter={(v: any) => [fmtCr(v), "Value"]} />
                <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} fill="url(#an-grad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, paddingTop: 16 }}>No historical data available</p>}
        </div>

        {/* Category Pie */}
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "22px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Fund Categories</p>
          <PieChart width={180} height={180} style={{ margin: "0 auto" }}>
            <Pie data={catPieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={3}>
              {catPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#0d1020", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }}
              formatter={(v: any, _: any, props: any) => [`${fmtCr(v)} (${props.payload.pct}%)`, props.payload.name]} />
          </PieChart>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {catPieData.map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.fill, flexShrink: 0 }} />
                <span style={{ color: "rgba(255,255,255,0.5)", flex: 1 }}>{c.name}</span>
                <span style={{ color: "#fff", fontWeight: 700 }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2: Top Funds + Category vs Target */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }} className="chart-grid">

        {/* Top Funds */}
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "22px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Top Funds by Value</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top5.map((f: any, i: number) => {
              const pct = totalValue > 0 ? ((f.valuation / totalValue) * 100).toFixed(1) : "0";
              const pl = f.unrealised_profit_loss ?? 0;
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.scheme_name}</span>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ color: "#fff", fontWeight: 700 }}>{fmtCr(f.valuation)}</span>
                      <span style={{ color: pl >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{pl >= 0 ? "+" : ""}{fmtCr(Math.abs(pl))}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #22d3ee, #a855f7)", width: `${pct}%`, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category vs Target */}
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "22px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Current vs Target Allocation</p>
          {catVsTarget.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catVsTarget} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "#0d1020", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }}
                  formatter={(v: any, name: any) => [`${v}%`, name === "current" ? "Current" : "Target"]} />
                <Legend formatter={(v) => v === "current" ? "Current %" : "Target %"} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
                <Bar dataKey="current" name="current" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="target" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>No comparison data</p>}
        </div>
      </div>

      {/* Transactions table */}
      {transactions.length > 0 && (
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "22px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Transactions ({transactions.length})
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Date", "Scheme", "Type", "Amount"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 12).map((tx: any, i: number) => {
                  const typeColor = tx.type === "SIP" ? "#22d3ee" : tx.type === "SWP" ? "#f87171" : tx.type?.includes("STP") ? "#f59e0b" : "#a855f7";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.4)" }}>{tx.date}</td>
                      <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.7)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.scheme_name}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}33`, borderRadius: 6, padding: "2px 8px", fontWeight: 700, fontSize: 11 }}>{tx.type}</span>
                      </td>
                      <td style={{ padding: "9px 12px", color: "#fff", fontWeight: 700 }}>₹{Number(tx.amount).toLocaleString("en-IN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </motion.div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDonut, setActiveDonut] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutOptionsOpen, setLogoutOptionsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  // Read ?welcome=1 synchronously so it's available on first render
  const [showLaunchPopup, setShowLaunchPopup] = useState(() => {
    return new URLSearchParams(window.location.search).get("welcome") === "1";
  });
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    try { const s = localStorage.getItem("cas_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  // Route protection
  useEffect(() => {
    if (!localStorage.getItem("cas_user")) {
      navigate("/landing");
    }
  }, [navigate]);

  // Clean ?welcome=1 from URL and handle FF-AI redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("name");
    const email = params.get("email");
    const welcome = params.get("welcome");

    if (name && email) {
      const u = { name, email };
      localStorage.setItem("cas_user", JSON.stringify(u));
      setUser(u);
      setShowLaunchPopup(true);
    }

    if (name || email || welcome) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const openAuth = (view: AuthView) => { setAuthView(view); setAuthOpen(true); };
  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };
  const performLogout = () => {
    localStorage.removeItem("cas_user");
    setUser(null);
    setLogoutConfirmOpen(false);
    setLogoutOptionsOpen(false);
    navigate("/landing");
  };
  const handleAuthSuccess = (u: { name: string; email: string }) => { localStorage.setItem("cas_user", JSON.stringify(u)); setUser(u); setAuthOpen(false); };
  const comingSoonToast = (label: string) => { setComingSoon(label); setTimeout(() => setComingSoon(null), 2800); };

  const userEmail = user?.email ?? "";
  const { data: reports = [] } = useQuery<any[]>({ queryKey: ["/api/reports", userEmail], queryFn: () => fetch(`/api/reports${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ""}`).then(r => r.json()), refetchInterval: 30000 });
  const { data: timelineData = [] } = useQuery<{ day: string; uploads: number; analyzed: number }[]>({ queryKey: ["/api/reports/timeline", userEmail], queryFn: () => fetch(`/api/reports/timeline${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ""}`).then(r => r.json()), refetchInterval: 30000 });
  const { data: categoryData = DEFAULT_CATEGORY_DATA } = useQuery<{ name: string; value: number; fill: string }[]>({ queryKey: ["/api/reports/categories", userEmail], queryFn: () => fetch(`/api/reports/categories${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ""}`).then(r => r.json()), refetchInterval: 30000 });

  const totalReports = reports.length;
  const completedReports = reports.filter((r: any) => r.analysis != null).length;
  const successRate = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;
  const avgFunds = totalReports > 0
    ? Math.round(reports.reduce((a: number, r: any) => a + ((r.analysis?.mf_snapshot ?? r.analysis?.funds ?? []).length), 0) / totalReports)
    : 0;

  const tableRows = reports
    .slice(0, 8)
    .map((r: any, i: number) => ({
      id: r.id ?? `CAS-${i}`,
      name: r.analysis?.investor_name ?? r.filename ?? "Unknown",
      status: r.analysis ? "completed" : "pending",
      funds: (r.analysis?.mf_snapshot ?? r.analysis?.funds ?? []).length,
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
      initials: (r.analysis?.investor_name ?? r.filename ?? "?").slice(0, 2).toUpperCase(),
      avatarColor: ["#22d3ee","#a855f7","#34d399","#f59e0b"][i % 4],
    }))
    .filter(r =>
      !searchQuery.trim() ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(r.id).toLowerCase().includes(searchQuery.toLowerCase())
    );

  const hasData = totalReports > 0;

  const KPI_CARDS = [
    { label: "Reports Analyzed", value: totalReports,    suffix: "",  trend: hasData ? "+18.4%" : null, up: true, color: "#22d3ee", sub: "CAS files processed",       icon: FileText    },
    { label: "Analyzed Reports", value: completedReports,suffix: "",  trend: hasData ? "+9.2%"  : null, up: true, color: "#a855f7", sub: "Successfully analyzed",      icon: BarChart2   },
    { label: "Success Rate",     value: successRate,     suffix: "%", trend: hasData ? "+1.2%"  : null, up: true, color: "#34d399", sub: "Analysis completion rate",    icon: CheckCircle2},
    { label: "Avg Funds / CAS",  value: avgFunds,        suffix: "",  trend: hasData ? "+2.1%"  : null, up: true, color: "#f59e0b", sub: "Schemes per statement",       icon: Activity    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#070a12", color: "#fff", fontFamily: "'Inter','Space Grotesk',system-ui,sans-serif" }}>
      <style>{STYLE}</style>
      <style>{`
        .md-ml-60 { margin-left: 0; }
        @media (min-width: 768px) { .md-ml-60 { margin-left: 60px !important; } }
        @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 600px)  { .kpi-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 960px)  { .chart-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 960px)  { .bottom-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Background layers */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(34,211,238,0.1) 0%, transparent 55%)" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 55% 40% at 90% 90%, rgba(168,85,247,0.09) 0%, transparent 55%)" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 40% 35% at 10% 60%, rgba(52,211,153,0.05) 0%, transparent 50%)" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.018,
        backgroundImage: "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
        backgroundSize: "48px 48px" }} />
      <Particles />

      {/* Coming Soon toast */}
      <AnimatePresence>
        {comingSoon && (
          <motion.div
            initial={{ opacity: 0, y: 60, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 60, x: "-50%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              position: "fixed", bottom: 28, left: "50%", zIndex: 200,
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 22px", borderRadius: 14,
              background: "rgba(7,10,18,0.97)", border: "1px solid rgba(245,158,11,0.35)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(245,158,11,0.15)",
              backdropFilter: "blur(24px)",
            }}
          >
            <Construction size={15} style={{ color: "#f59e0b" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{comingSoon}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>is coming soon</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CAS Launch Popup */}
      <AnimatePresence>
        {showLaunchPopup && <CASLaunchPopup onClose={() => setShowLaunchPopup(false)} />}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal isOpen={authOpen} defaultView={authView} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={handleLogout} comingSoonToast={comingSoonToast} activeSection={activeSection} onSectionChange={setActiveSection} />
      <TopBar onMenu={() => setMobileOpen(true)} user={user} onOpenAuth={openAuth} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <main style={{ marginLeft: 0, paddingTop: 56, minHeight: "100vh", position: "relative", zIndex: 1 }} className="md-ml-60">

        {/* Market Ticker */}
        <MarketTicker />

        {activeSection === "analytics" && <AnalyticsView reports={reports} user={user} />}

        {activeSection === "dashboard" && <div style={{ padding: "28px 24px 48px", maxWidth: 1600 }}>

          {/* ── HERO ROW ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 30 }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid transparent",
                    borderTopColor: "#22d3ee", borderRightColor: "#a855f7" }}
                />
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(34,211,238,0.8)", textTransform: "uppercase", letterSpacing: "0.18em" }}>
                  Command Center
                </p>
              </div>
              <h1 style={{ fontSize: "clamp(22px,3vw,34px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 8 }}>
                Welcome back,{" "}
                <span style={{ background: "linear-gradient(135deg, #22d3ee, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {user ? user.name.split(" ")[0] : "Guest"}
                </span>
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 100,
                  border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)",
                }}
                data-testid="status-system"
              >
                <span className="dot-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block", boxShadow: "0 0 10px #34d399" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399", letterSpacing: "0.04em" }}>CAS System · Online</span>
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => {}}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 100,
                  border: "1px solid rgba(34,211,238,0.25)", background: "rgba(34,211,238,0.08)",
                  color: "#22d3ee", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 0 16px rgba(34,211,238,0.12)",
                }}
              >
                <Sparkles size={12} />
                New Analysis
              </motion.button>
            </div>
          </motion.div>

          {/* ── KPI GRID ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }} className="kpi-grid">
            {KPI_CARDS.map((card, i) => {
              const Icon = card.icon;
              const sparkData = hasData ? (SPARKLINES[card.label]?.map((v, idx) => ({ v, idx })) ?? []) : [];
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.09, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="grad-border grad-border-bright"
                  data-testid={`kpi-card-${card.label.toLowerCase().replace(/ /g, "-")}`}
                  style={{
                    borderRadius: 20, background: "rgba(255,255,255,0.025)",
                    backdropFilter: "blur(24px)", padding: "22px 22px 16px",
                    overflow: "hidden", position: "relative", cursor: "default",
                    border: "1px solid rgba(255,255,255,0.05)",
                    transition: "box-shadow 0.3s ease",
                  }}
                >
                  {/* Glow orb */}
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.45, 0.25] }}
                    transition={{ duration: 3 + i * 0.7, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute", top: -30, right: -30,
                      width: 120, height: 120, borderRadius: "50%",
                      background: `radial-gradient(circle, ${card.color}25, transparent 70%)`,
                      pointerEvents: "none",
                    }}
                  />
                  {/* Scan line */}
                  <motion.div
                    initial={{ y: "-100%", opacity: 0 }}
                    animate={{ y: ["−100%", "200%"] }}
                    transition={{ duration: 2.5, delay: 1 + i * 0.4, repeat: Infinity, repeatDelay: 5 }}
                    style={{
                      position: "absolute", left: 0, right: 0, height: 1,
                      background: `linear-gradient(90deg, transparent, ${card.color}40, transparent)`,
                      pointerEvents: "none",
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      {card.label}
                    </span>
                    <motion.div
                      whileHover={{ rotate: 12 }}
                      style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: `${card.color}18`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: `0 0 14px ${card.color}30`,
                      }}
                    >
                      <Icon size={14} style={{ color: card.color }} />
                    </motion.div>
                  </div>

                  <p style={{ fontSize: "clamp(28px,3vw,40px)", fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 8, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}>
                    <AnimatedNum value={typeof card.value === "number" ? card.value : 0} />
                    <span style={{ fontSize: "0.42em", color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>{card.suffix}</span>
                  </p>

                  <div style={{ marginBottom: 10 }}>
                    <Sparkline data={hasData ? (SPARKLINES[card.label] ?? []) : []} color={card.color} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {card.trend ? (
                      <>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 11, fontWeight: 800,
                          color: card.up ? "#34d399" : "#f87171",
                          padding: "3px 9px", borderRadius: 100,
                          background: card.up ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                          border: `1px solid ${card.up ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
                        }}>
                          {card.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {card.trend}
                        </span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>vs last month</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                        No data yet
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── GMAIL AUTO-IMPORT ── */}
          {userEmail && (
            <div style={{ marginBottom: 20 }}>
              <GmailPanel userEmail={userEmail} />
            </div>
          )}

          {/* ── CHART ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 20 }} className="chart-grid">

            {/* Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{ borderRadius: 20, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)", padding: "24px 26px", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>30-Day Activity</p>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>CAS Processing Timeline</h2>
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                  {[{ label: "Uploads", color: "#22d3ee" }, { label: "Analyzed", color: "#a855f7" }].map(l => (
                    <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                      <span style={{ width: 24, height: 2, borderRadius: 2, background: l.color, boxShadow: `0 0 8px ${l.color}`, display: "inline-block" }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ height: 230 }} data-testid="chart-activity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.38} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <filter id="ln-glow">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10 }} axisLine={false} tickLine={false} interval={5} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="uploads" stroke="#22d3ee" strokeWidth={3} fill="url(#gc)" filter="url(#ln-glow)" dot={false} activeDot={{ r: 6, fill: "#22d3ee", strokeWidth: 0, filter: "url(#ln-glow)" }} />
                    <Area type="monotone" dataKey="analyzed" stroke="#a855f7" strokeWidth={3} fill="url(#gp)" filter="url(#ln-glow)" dot={false} activeDot={{ r: 6, fill: "#a855f7", strokeWidth: 0, filter: "url(#ln-glow)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Animated Donut + Legend */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.48, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{ borderRadius: 20, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)", padding: "24px 20px", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>Distribution</p>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 18, letterSpacing: "-0.01em" }}>Fund Categories</h2>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, position: "relative" }}>
                <AnimatedDonut data={categoryData} activeIdx={Math.min(activeDonut, categoryData.length - 1)} onHover={setActiveDonut} />
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  textAlign: "center", pointerEvents: "none",
                }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: categoryData[Math.min(activeDonut, categoryData.length - 1)]?.fill, lineHeight: 1, fontFamily: "monospace" }}>
                    {categoryData[Math.min(activeDonut, categoryData.length - 1)]?.value}%
                  </p>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {categoryData[Math.min(activeDonut, categoryData.length - 1)]?.name}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {categoryData.map((d, i) => (
                  <motion.div
                    key={d.name}
                    onClick={() => setActiveDonut(i)}
                    whileHover={{ x: 3 }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderRadius: 8, padding: "4px 6px",
                      background: i === activeDonut ? `${d.fill}10` : "transparent", transition: "background 0.2s" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: i === activeDonut ? "#fff" : "rgba(255,255,255,0.45)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.fill, boxShadow: i === activeDonut ? `0 0 8px ${d.fill}` : "none", display: "inline-block" }} />
                      {d.name}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: d.fill, fontFamily: "monospace" }}>{d.value}%</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── BOTTOM ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }} className="bottom-grid">

            {/* Recent Reports Table */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.54, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{ borderRadius: 20, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)", padding: "24px 26px", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>Live Feed</p>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Recent Submissions</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <motion.span animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d3ee", display: "inline-block", boxShadow: "0 0 8px #22d3ee" }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", fontWeight: 600 }}>Live</span>
                </div>
              </div>

              <div style={{ overflowX: "auto" }} data-testid="table-recent-scans">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {["ID", "Investor", "Funds", "Status", "Date", ""].map((h, i) => (
                        <th key={i} style={{ textAlign: "left", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.12em", paddingBottom: 14, paddingRight: 18, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div style={{ padding: "48px 0", textAlign: "center" }}>
                            <motion.div
                              animate={{ opacity: [0.4, 0.8, 0.4] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              style={{ marginBottom: 14 }}
                            >
                              <FileText size={36} style={{ color: "rgba(255,255,255,0.1)", margin: "0 auto" }} />
                            </motion.div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>
                              {!user ? "Sign in to see your CAS reports" : "No reports yet"}
                            </p>
                            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.12)" }}>
                              {!user ? "Your submissions will appear here after logging in" : "Upload a CAS file to get started"}
                            </p>
                            {!user && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => { window.location.href = "/login"; }}
                                data-testid="button-table-signin"
                                style={{
                                  marginTop: 16, padding: "8px 22px", borderRadius: 100,
                                  background: "linear-gradient(135deg,#22d3ee,#a855f7)",
                                  border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                Sign In
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {tableRows.map((row: any, i: number) => {
                      const s = STATUS_MAP[row.status] ?? STATUS_MAP.completed;
                      const SIcon = s.icon;
                      return (
                        <motion.tr
                          key={row.id}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                          className="row-hover"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "default", transition: "background 0.18s" }}
                        >
                          <td style={{ padding: "12px 18px 12px 0", fontFamily: "monospace", fontSize: 12, color: "#22d3ee", fontWeight: 700, letterSpacing: "0.04em" }}>
                            {row.id}
                          </td>
                          <td style={{ padding: "12px 18px 12px 0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                background: `linear-gradient(135deg, ${row.avatarColor}60, ${row.avatarColor}30)`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 9, fontWeight: 900, color: row.avatarColor,
                                border: `1px solid ${row.avatarColor}40`,
                                boxShadow: `0 0 8px ${row.avatarColor}30`,
                              }}>{row.initials}</div>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500, whiteSpace: "nowrap" }}>{row.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px 12px 0" }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.45)" }}>{row.funds > 0 ? row.funds : "—"}</span>
                          </td>
                          <td style={{ padding: "12px 18px 12px 0" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                              color: s.color, background: s.bg, border: `1px solid ${s.color}28`,
                              boxShadow: `0 0 10px ${s.color}18`,
                            }}>
                              <SIcon size={10} />
                              {s.label}
                            </span>
                          </td>
                          <td style={{ padding: "12px 18px 12px 0", fontSize: 11, color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap" }}>
                            {row.date}
                          </td>
                          <td style={{ padding: "12px 0 12px 0" }}>
                            <motion.button
                              data-testid={`button-view-${row.id}`}
                              whileHover={{ x: 3, color: "#22d3ee" }}
                              className="view-btn"
                              onClick={() => navigate(`/reports/${row.id}/concise`)}
                              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.18)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                            >
                              View <ChevronRight size={11} />
                            </motion.button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Portfolio Summary Card */}
            {(() => {
              const analyzed = reports.filter((r: any) => r.analysis?.mf_snapshot?.length || r.analysis?.funds?.length);
              if (!analyzed.length) return null;
              const latest = analyzed[analyzed.length - 1];
              const funds: any[] = latest.analysis?.mf_snapshot ?? latest.analysis?.funds ?? [];
              const totalValue = funds.reduce((s: number, f: any) => s + (f.valuation ?? 0), 0);
              const totalInvested = funds.reduce((s: number, f: any) => s + (f.invested_amount ?? 0), 0);
              const returnPct = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
              const topFunds = [...funds].sort((a, b) => (b.valuation ?? 0) - (a.valuation ?? 0)).slice(0, 3);
              const hist: any[] = latest.analysis?.historical_valuations ?? [];
              let bars: number[] = [];
              if (hist.length >= 2) {
                const vals = hist.slice(-10).map((h: any) => h.valuation);
                const min = Math.min(...vals), max = Math.max(...vals);
                bars = vals.map((v: number) => max === min ? 60 : Math.round(20 + ((v - min) / (max - min)) * 75));
              } else {
                bars = [30, 42, 35, 55, 45, 62, 50, 70, 60, 80];
              }
              const fmt = (v: number) => v >= 10000000 ? `₹${(v/10000000).toFixed(2)} Cr` : v >= 100000 ? `₹${(v/100000).toFixed(2)} L` : `₹${v.toLocaleString("en-IN")}`;
              const FUND_COLORS = ["#22d3ee", "#a855f7", "#f59e0b", "#34d399", "#ec4899"];
              const investorName = latest.analysis?.investor_name ?? user?.name ?? "";
              return (
                <motion.div
                  initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  data-testid="widget-portfolio-summary"
                  style={{ borderRadius: 20, background: "rgba(7,10,18,0.9)", backdropFilter: "blur(24px)", border: "1px solid rgba(34,211,238,0.18)", overflow: "hidden", position: "relative" }}
                >
                  {/* Scan line */}
                  <motion.div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(34,211,238,0.5),transparent)", zIndex: 1, pointerEvents: "none" }}
                    animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} />
                  {/* Corner brackets */}
                  {[["top:0;left:0","borderTop:1px solid #22d3ee,borderLeft:1px solid #22d3ee"],["top:0;right:0","borderTop:1px solid #22d3ee,borderRight:1px solid #22d3ee"],["bottom:0;left:0","borderBottom:1px solid #22d3ee,borderLeft:1px solid #22d3ee"],["bottom:0;right:0","borderBottom:1px solid #22d3ee,borderRight:1px solid #22d3ee"]].map(([pos, borders], i) => {
                    const p: any = {}; pos.split(";").forEach(s => { const [k,v]=s.split(":"); p[k]=v; });
                    const b: any = {}; borders.split(",").forEach(s => { const idx=s.indexOf(":"); b[s.slice(0,idx)]=s.slice(idx+1); });
                    return <motion.div key={i} style={{ position:"absolute", width:18, height:18, ...p, ...b, zIndex:2 }} animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2, repeat:Infinity, delay:i*0.4 }} />;
                  })}
                  <div style={{ padding: "22px 20px", position: "relative", zIndex: 3 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <motion.div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }}
                            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                          <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                            Live · {investorName}
                          </span>
                        </div>
                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Total Portfolio Value</p>
                        <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>{fmt(totalValue)}</p>
                      </div>
                      <motion.div
                        animate={{ boxShadow: returnPct >= 0 ? ["0 0 0px rgba(52,211,153,0)","0 0 14px rgba(52,211,153,0.5)","0 0 0px rgba(52,211,153,0)"] : ["0 0 0px rgba(248,113,113,0)","0 0 14px rgba(248,113,113,0.5)","0 0 0px rgba(248,113,113,0)"] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:999, background: returnPct>=0?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)", border:`1px solid ${returnPct>=0?"rgba(52,211,153,0.4)":"rgba(248,113,113,0.4)"}` }}
                      >
                        <TrendingUp size={11} style={{ color: returnPct>=0?"#34d399":"#f87171" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: returnPct>=0?"#34d399":"#f87171" }}>{returnPct>=0?"+":""}{returnPct.toFixed(1)}%</span>
                      </motion.div>
                    </div>

                    {/* Historical bars */}
                    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:52, marginBottom:16, padding:"0 2px" }}>
                      {bars.map((h, i) => (
                        <motion.div key={i} style={{ flex:1, borderRadius:3,
                          background: i===bars.length-1 ? "linear-gradient(180deg,#22d3ee,#0096b4)" : `rgba(34,211,238,${0.12+i*0.07})`,
                          boxShadow: i===bars.length-1 ? "0 0 10px rgba(34,211,238,0.6)" : "none",
                        }}
                          initial={{ scaleY:0, height:`${h}%` }} animate={{ scaleY:1 }} transition={{ delay:0.5+i*0.05, duration:0.4, ease:"easeOut" }} />
                      ))}
                    </div>

                    {/* Stats row */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                      {[
                        { label:"RETURN",   value:`${returnPct>=0?"+":""}${returnPct.toFixed(1)}%`, color: returnPct>=0?"#34d399":"#f87171" },
                        { label:"INVESTED", value:fmt(totalInvested), color:"#a855f7" },
                        { label:"FUNDS",    value:String(funds.length), color:"#f59e0b" },
                      ].map(({ label, value, color }) => (
                        <motion.div key={label} whileHover={{ scale:1.04 }}
                          style={{ borderRadius:12, padding:"10px 8px", textAlign:"center", background:`${color}0d`, border:`1px solid ${color}25` }}>
                          <p style={{ fontSize:13, fontWeight:800, color }}>{value}</p>
                          <p style={{ fontSize:9, color:"rgba(255,255,255,0.28)", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:2 }}>{label}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Top holdings */}
                    <div style={{ marginBottom:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                        <Activity size={10} style={{ color:"#22d3ee" }} />
                        <span style={{ fontSize:9, color:"#22d3ee", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em" }}>Top Holdings</span>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {topFunds.map((f: any, i: number) => {
                          const fRet = f.invested_amount>0 ? ((f.valuation-f.invested_amount)/f.invested_amount)*100 : 0;
                          const color = FUND_COLORS[i % FUND_COLORS.length];
                          return (
                            <motion.div key={i} initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }}
                              transition={{ delay:0.9+i*0.1 }} whileHover={{ x:3 }}
                              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", borderRadius:10, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", position:"relative", overflow:"hidden" }}>
                              <motion.div style={{ position:"absolute", left:0, top:0, bottom:0, width:2, background:color, borderRadius:"2px 0 0 2px" }}
                                animate={{ boxShadow:[`0 0 4px ${color}60`,`0 0 10px ${color}`,`0 0 4px ${color}60`] }}
                                transition={{ duration:2, repeat:Infinity, delay:i*0.5 }} />
                              <div style={{ marginLeft:10, minWidth:0 }}>
                                <p style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.82)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:140 }}>
                                  {f.scheme_name ?? f.name ?? "Fund"}
                                </p>
                                <p style={{ fontSize:9, color:"rgba(255,255,255,0.28)" }}>{fmt(f.valuation ?? 0)}</p>
                              </div>
                              <span style={{ fontSize:12, fontWeight:700, flexShrink:0, marginLeft:8, color: fRet>=0?"#34d399":"#f87171" }}>
                                {fRet>=0?"+":""}{fRet.toFixed(1)}%
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

          </div>
        </div>}
      </main>

      {/* ── Logout Confirmation Dialog ── */}
      <AnimatePresence>
        {logoutConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setLogoutConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "linear-gradient(135deg,#0d1117,#0a0f1e)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "32px 28px", maxWidth: 360, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <LogOut size={22} style={{ color: "#f87171" }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Log Out?</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28, lineHeight: 1.6 }}>
                Are you sure you want to log out of your account?
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  data-testid="button-logout-no"
                  onClick={() => setLogoutConfirmOpen(false)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                >
                  No, Stay
                </button>
                <button
                  data-testid="button-logout-yes"
                  onClick={() => { setLogoutConfirmOpen(false); setLogoutOptionsOpen(true); }}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                >
                  Yes, Log Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Logout Options Dialog ── */}
      <AnimatePresence>
        {logoutOptionsOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setLogoutOptionsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "linear-gradient(135deg,#0d1117,#0a0f1e)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "32px 28px", maxWidth: 360, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Choose Log Out Type</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 24, lineHeight: 1.6 }}>
                How would you like to log out?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  data-testid="button-logout-this-device"
                  onClick={performLogout}
                  style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Log Out</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>Sign out from this device only</div>
                </button>
                <button
                  data-testid="button-logout-all-devices"
                  onClick={performLogout}
                  style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Log Out of All Devices</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>Sign out from every device</div>
                </button>
                <button
                  data-testid="button-logout-cancel"
                  onClick={() => setLogoutOptionsOpen(false)}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
