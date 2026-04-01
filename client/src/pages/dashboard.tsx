import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, useSpring, useInView, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
  LineChart, Line,
} from "recharts";
import {
  LayoutDashboard, BarChart2, FileText, Settings, LogOut,
  Search, Bell, Zap, TrendingUp, TrendingDown,
  CheckCircle2, Clock, XCircle, Upload, Cpu, MemoryStick,
  Wifi, HardDrive, ChevronRight, Activity, Menu, X,
  Sparkles, Shield, ArrowUpRight, Construction, User,
} from "lucide-react";
import { AuthModal, type AuthView } from "./auth";

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
const THIRTY_DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 2, 1 + i);
  return {
    day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    uploads: Math.floor(8 + Math.random() * 22 + Math.sin(i / 3.5) * 6),
    analyzed: Math.floor(6 + Math.random() * 18 + Math.cos(i / 4) * 5),
  };
});

const CATEGORY_DATA = [
  { name: "Equity",  value: 54, fill: "#22d3ee" },
  { name: "Debt",    value: 24, fill: "#a855f7" },
  { name: "Hybrid",  value: 14, fill: "#f59e0b" },
  { name: "Other",   value: 8,  fill: "#34d399" },
];

const RADIAL_HEALTH = [
  { name: "CPU",     value: 67, fill: "#22d3ee" },
  { name: "Memory",  value: 54, fill: "#a855f7" },
  { name: "Network", value: 38, fill: "#f59e0b" },
  { name: "Storage", value: 41, fill: "#34d399" },
];

const SPARKLINES: Record<string, number[]> = {
  "Reports Analyzed": [48, 62, 55, 71, 68, 80, 75, 92, 88, 100],
  "Active Portfolios": [30, 40, 38, 52, 49, 58, 62, 70, 68, 80],
  "Success Rate":     [88, 90, 87, 92, 91, 94, 93, 96, 95, 98],
  "Avg Funds / CAS":  [9, 10, 11, 10, 12, 11, 13, 12, 13, 14],
};

const TICKER_ITEMS = [
  { label: "NIFTY 50",    value: "+1.24%", up: true },
  { label: "SENSEX",      value: "+0.98%", up: true },
  { label: "NIFTY BANK",  value: "-0.31%", up: false },
  { label: "GOLD ETF",    value: "+0.57%", up: true },
  { label: "NIFTY IT",    value: "+2.11%", up: true },
  { label: "NIFTY MID",   value: "+1.56%", up: true },
  { label: "SMALL CAP",   value: "-0.74%", up: false },
  { label: "DEBT FUNDS",  value: "+0.12%", up: true },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  completed:  { label: "Analyzed",   color: "#34d399", bg: "rgba(52,211,153,0.08)",  icon: CheckCircle2 },
  processing: { label: "Processing", color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  icon: Clock },
  failed:     { label: "Failed",     color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: XCircle },
  pending:    { label: "Pending",    color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: Clock },
};

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", active: true, comingSoon: false },
  { icon: BarChart2,        label: "Analytics",  href: "",           active: false, comingSoon: true  },
  { icon: Upload,           label: "Upload CAS", href: "/home",      active: false, comingSoon: false },
  { icon: FileText,         label: "Reports",    href: "/home",      active: false, comingSoon: false },
  { icon: Settings,         label: "Settings",   href: "",           active: false, comingSoon: true  },
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

// ─── Circular Health Ring ──────────────────────────────────────────────────────
function HealthRing({ label, value, color, size = 72 }: { label: string; value: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const ref = useRef<SVGCircleElement>(null);
  const inView = useInView(ref as any, { once: true });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
          <motion.circle
            ref={ref as any}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={inView ? { strokeDashoffset: circ * (1 - value / 100) } : {}}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 900, color, fontFamily: "monospace",
        }}>
          {value}
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </span>
    </div>
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
  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];
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
              {t.up ? "▲" : "▼"} {t.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ mobileOpen, onClose, onLogout, comingSoonToast }: {
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  comingSoonToast: (label: string) => void;
}) {
  const [, nav] = useLocation();

  const handleNav = (item: typeof NAV[0]) => {
    if (item.comingSoon) { comingSoonToast(item.label); onClose(); return; }
    nav(item.href); onClose();
  };

  const items = (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} style={{ position: "relative" }}>
            <button
              onClick={() => handleNav(item)}
              title={item.comingSoon ? `${item.label} (Coming Soon)` : item.label}
              data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "11px 0", borderRadius: 12, border: "none",
                cursor: item.comingSoon ? "not-allowed" : "pointer",
                transition: "all 0.25s ease",
                background: item.active ? "rgba(34,211,238,0.12)" : "transparent",
                color: item.active ? "#22d3ee" : item.comingSoon ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.28)",
                boxShadow: item.active ? "0 0 20px rgba(34,211,238,0.22), inset 0 0 14px rgba(34,211,238,0.06)" : "none",
                position: "relative",
              }}
              className={item.active || item.comingSoon ? "" : "sidebar-btn"}
            >
              {item.active && (
                <motion.span layoutId="active-pill" style={{
                  position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                  width: 3, height: 22, borderRadius: 2,
                  background: "linear-gradient(180deg, #22d3ee, #a855f7)",
                  boxShadow: "0 0 10px #22d3ee",
                }} />
              )}
              <Icon size={18} />
              {item.comingSoon && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#f59e0b", boxShadow: "0 0 6px #f59e0b",
                }} />
              )}
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
                  return (
                    <button key={item.label} onClick={() => handleNav(item)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        borderRadius: 10, border: "none", cursor: item.comingSoon ? "not-allowed" : "pointer", textAlign: "left",
                        background: item.active ? "rgba(34,211,238,0.1)" : "transparent",
                        color: item.active ? "#22d3ee" : item.comingSoon ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.4)",
                        fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                        position: "relative",
                      }}>
                      <Icon size={16} />
                      {item.label}
                      {item.comingSoon && (
                        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.25)" }}>
                          SOON
                        </span>
                      )}
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
              onClick={() => {
                const loginUrl = import.meta.env.VITE_FF_LOGIN_URL || "https://84e2afd4-aced-4375-a432-63e8f5bfd3c2-00-1jrgs275k2xm7.pike.replit.dev/login";
                const redirectBack = `${window.location.origin}/dashboard`;
                window.location.href = `${loginUrl}?redirect=${encodeURIComponent(redirectBack)}`;
              }}
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

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDonut, setActiveDonut] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    try { const s = localStorage.getItem("cas_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("name");
    const email = params.get("email");
    if (name && email) {
      const u = { name, email };
      localStorage.setItem("cas_user", JSON.stringify(u));
      setUser(u);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const openAuth = (view: AuthView) => { setAuthView(view); setAuthOpen(true); };
  const handleLogout = () => { localStorage.removeItem("cas_user"); setUser(null); navigate("/landing"); };
  const handleAuthSuccess = (u: { name: string; email: string }) => { localStorage.setItem("cas_user", JSON.stringify(u)); setUser(u); setAuthOpen(false); };
  const comingSoonToast = (label: string) => { setComingSoon(label); setTimeout(() => setComingSoon(null), 2800); };

  const { data: reports = [] } = useQuery<any[]>({ queryKey: ["/api/reports"] });

  const totalReports = reports.length;
  const completedReports = reports.filter((r: any) => r.status === "completed" || r.analysisData).length;
  const successRate = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;
  const avgFunds = totalReports > 0
    ? Math.round(reports.reduce((a: number, r: any) => a + (r.analysisData?.funds?.length ?? 0), 0) / totalReports)
    : 0;

  const tableRows = reports
    .slice(0, 8)
    .map((r: any, i: number) => ({
      id: r.id ?? `CAS-${i}`,
      name: r.analysisData?.investorInfo?.name ?? r.filename ?? "Unknown",
      status: r.status ?? "pending",
      funds: r.analysisData?.funds?.length ?? 0,
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
      initials: (r.analysisData?.investorInfo?.name ?? "?").slice(0, 2).toUpperCase(),
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

      {/* Auth Modal */}
      <AuthModal isOpen={authOpen} defaultView={authView} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={handleLogout} comingSoonToast={comingSoonToast} />
      <TopBar onMenu={() => setMobileOpen(true)} user={user} onOpenAuth={openAuth} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <main style={{ marginLeft: 0, paddingTop: 56, minHeight: "100vh", position: "relative", zIndex: 1 }} className="md-ml-60">

        {/* Market Ticker */}
        <MarketTicker />

        <div style={{ padding: "28px 24px 48px", maxWidth: 1600 }}>

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
                  <AreaChart data={THIRTY_DAYS} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
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
                <AnimatedDonut data={CATEGORY_DATA} activeIdx={activeDonut} onHover={setActiveDonut} />
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  textAlign: "center", pointerEvents: "none",
                }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: CATEGORY_DATA[activeDonut].fill, lineHeight: 1, fontFamily: "monospace" }}>
                    {CATEGORY_DATA[activeDonut].value}%
                  </p>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {CATEGORY_DATA[activeDonut].name}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {CATEGORY_DATA.map((d, i) => (
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
                                onClick={() => {
                                  const loginUrl = import.meta.env.VITE_FF_LOGIN_URL || "https://84e2afd4-aced-4375-a432-63e8f5bfd3c2-00-1jrgs275k2xm7.pike.replit.dev/login";
                                  const redirectBack = `${window.location.origin}/dashboard`;
                                  window.location.href = `${loginUrl}?redirect=${encodeURIComponent(redirectBack)}`;
                                }}
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

            {/* System Health — Circular Rings */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{ borderRadius: 20, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)", padding: "24px 22px", border: "1px solid rgba(255,255,255,0.05)" }}
              data-testid="widget-system-health"
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>Infrastructure</p>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 24, letterSpacing: "-0.01em" }}>System Health</h2>

              {/* Circular health rings */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24, justifyItems: "center" }}>
                {RADIAL_HEALTH.map(h => (
                  <HealthRing key={h.name} label={h.name} value={h.value} color={h.fill} size={72} />
                ))}
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { icon: Cpu,         label: "CPU Cores", value: "16 vCPU", color: "#22d3ee" },
                  { icon: MemoryStick, label: "RAM",       value: "32 GB",   color: "#a855f7" },
                  { icon: HardDrive,   label: "Storage",   value: "500 GB",  color: "#34d399" },
                  { icon: Wifi,        label: "Uptime",    value: "99.97%",  color: "#f59e0b" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <motion.div key={label} whileHover={{ scale: 1.04 }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${color}14`, boxShadow: `0 0 10px ${color}22`,
                    }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Overall status badge */}
              <motion.div
                animate={{ borderColor: ["rgba(52,211,153,0.2)", "rgba(52,211,153,0.5)", "rgba(52,211,153,0.2)"] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{ marginTop: 20, borderRadius: 12, border: "1px solid rgba(52,211,153,0.2)", padding: "12px 14px", background: "rgba(52,211,153,0.05)", display: "flex", alignItems: "center", gap: 10 }}
              >
                <Shield size={14} style={{ color: "#34d399", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>All Systems Nominal</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>Last checked: Just now</p>
                </div>
                <ArrowUpRight size={12} style={{ color: "#34d399", marginLeft: "auto", flexShrink: 0 }} />
              </motion.div>
            </motion.div>

          </div>
        </div>
      </main>
    </div>
  );
}
