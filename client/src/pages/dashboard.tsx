import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, useSpring, useInView } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import {
  LayoutDashboard, BarChart2, FileText, Settings, LogOut,
  Search, Bell, Zap, TrendingUp, TrendingDown,
  CheckCircle2, Clock, XCircle, Upload, Cpu, MemoryStick,
  Wifi, HardDrive, ChevronRight, Activity, Menu, X,
} from "lucide-react";

// ─── Injected CSS for animated gradient border ────────────────────────────────
const STYLE = `
  @keyframes spin-gradient {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
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
    background: linear-gradient(135deg, #22d3ee44, #a855f744, #22d3ee44);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  .grad-border-glow::before {
    background: linear-gradient(135deg, #22d3ee88, #a855f788, #22d3ee88);
    opacity: 1;
  }
  @keyframes pulse-orb {
    0%, 100% { opacity: 0.35; transform: scale(1); }
    50%       { opacity: 0.55; transform: scale(1.08); }
  }
  @keyframes slide-up-fade {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dot-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
    50%       { box-shadow: 0 0 0 6px rgba(52,211,153,0); }
  }
  .dot-pulse { animation: dot-pulse 2s ease-in-out infinite; }
  @keyframes ticker {
    0%   { transform: translateY(0); }
    100% { transform: translateY(-50%); }
  }
`;

// ─── Static / placeholder data ────────────────────────────────────────────────

const THIRTY_DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 2, 1 + i);
  return {
    day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    uploads: Math.floor(8 + Math.random() * 22 + Math.sin(i / 3.5) * 6),
    analyzed: Math.floor(6 + Math.random() * 18 + Math.cos(i / 4) * 5),
  };
});

const CATEGORY_DATA = [
  { name: "Equity",   value: 54, color: "#22d3ee" },
  { name: "Debt",     value: 24, color: "#a855f7" },
  { name: "Hybrid",   value: 14, color: "#f59e0b" },
  { name: "Other",    value: 8,  color: "#34d399"  },
];

const HEALTH = [
  { label: "CPU",     value: 67, color: "#22d3ee" },
  { label: "Memory",  value: 54, color: "#a855f7" },
  { label: "Network", value: 38, color: "#f59e0b" },
  { label: "Storage", value: 41, color: "#34d399" },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  completed:  { label: "Analyzed",   color: "#34d399", bg: "rgba(52,211,153,0.1)",  icon: CheckCircle2 },
  processing: { label: "Processing", color: "#22d3ee", bg: "rgba(34,211,238,0.1)",  icon: Clock },
  failed:     { label: "Failed",     color: "#f87171", bg: "rgba(248,113,113,0.1)", icon: XCircle },
  pending:    { label: "Pending",    color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  icon: Clock },
};

// ─── Animated number ──────────────────────────────────────────────────────────
function AnimatedNum({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) spring.set(value);
  }, [inView, value, spring]);

  useEffect(() => {
    return spring.on("change", v => setDisplay(decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()));
  }, [spring, decimals]);

  return <span ref={ref}>{display}</span>;
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(9,13,22,0.97)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "10px 14px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      backdropFilter: "blur(20px)",
    }}>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span style={{ color: "rgba(255,255,255,0.5)", textTransform: "capitalize" }}>{p.dataKey}:</span>
          <span style={{ color: "#fff", fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Health bar ───────────────────────────────────────────────────────────────
function HealthBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: "monospace" }}>{value}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
          style={{
            height: "100%",
            borderRadius: 4,
            background: `linear-gradient(90deg, ${color}60, ${color})`,
            boxShadow: `0 0 12px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", active: true },
  { icon: BarChart2,        label: "Analytics",  href: "/dashboard" },
  { icon: Upload,           label: "Upload CAS", href: "/home" },
  { icon: FileText,         label: "Reports",    href: "/home" },
  { icon: Settings,         label: "Settings",   href: "/dashboard" },
];

function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const [, nav] = useLocation();
  const items = (
    <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      {NAV.map(({ icon: Icon, label, href, active }) => (
        <div key={label} style={{ position: "relative" }}>
          <button
            onClick={() => { nav(href); onClose(); }}
            title={label}
            data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 0",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: active ? "rgba(34,211,238,0.1)" : "transparent",
              color: active ? "#22d3ee" : "rgba(255,255,255,0.3)",
              boxShadow: active ? "0 0 16px rgba(34,211,238,0.2), inset 0 0 12px rgba(34,211,238,0.05)" : "none",
              position: "relative",
            }}
            className={active ? "" : "sidebar-btn"}
          >
            {active && (
              <span style={{
                position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                width: 3, height: 20, borderRadius: 2,
                background: "linear-gradient(180deg, #22d3ee, #a855f7)",
                boxShadow: "0 0 8px #22d3ee",
              }} />
            )}
            <Icon size={18} />
          </button>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex" style={{
        position: "fixed", left: 0, top: 0, height: "100%", width: 60,
        flexDirection: "column", alignItems: "center",
        background: "rgba(9,13,22,0.98)", borderRight: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)", zIndex: 30, padding: "16px 6px",
        gap: 8,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, marginBottom: 20,
          background: "linear-gradient(135deg, #22d3ee, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 24px rgba(34,211,238,0.5), 0 0 48px rgba(168,85,247,0.2)",
          flexShrink: 0,
        }}>
          <Zap size={17} color="#fff" />
        </div>
        {items}
        <button
          onClick={() => nav("/")}
          title="Log Out"
          data-testid="nav-logout"
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
            background: "transparent", color: "rgba(255,255,255,0.2)",
            transition: "all 0.2s ease",
          }}
          className="sidebar-btn-red"
        >
          <LogOut size={17} />
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 40 }}
          />
          <motion.aside
            initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              position: "fixed", left: 0, top: 0, height: "100%", width: 220,
              background: "rgba(9,13,22,0.99)", borderRight: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)", zIndex: 50, padding: "20px 12px",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #22d3ee, #a855f7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 20px rgba(34,211,238,0.4)",
              }}>
                <Zap size={16} color="#fff" />
              </div>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "0.02em" }}>CAS Analyzer</span>
              <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
                <X size={15} />
              </button>
            </div>
            <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              {NAV.map(({ icon: Icon, label, href, active }) => (
                <button
                  key={label}
                  onClick={() => { nav(href); onClose(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
                    background: active ? "rgba(34,211,238,0.1)" : "transparent",
                    color: active ? "#22d3ee" : "rgba(255,255,255,0.4)",
                    fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => nav("/")}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                borderRadius: 10, border: "none", cursor: "pointer",
                background: "transparent", color: "rgba(248,113,113,0.6)",
                fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              }}
            >
              <LogOut size={16} />
              Log Out
            </button>
          </motion.aside>
        </>
      )}
    </>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0,
      marginLeft: 0,
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 20px", height: 56,
      background: "rgba(9,13,22,0.85)", backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      zIndex: 20,
    }} className="md:ml-[60px]">
      <button onClick={onMenu} className="md:hidden" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }} data-testid="button-mobile-menu">
        <Menu size={20} />
      </button>

      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px", borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        color: "rgba(255,255,255,0.25)", cursor: "text",
        flex: 1, maxWidth: 320, transition: "all 0.2s",
      }}>
        <Search size={13} />
        <span style={{ fontSize: 13, flex: 1 }}>Search reports, funds...</span>
        <kbd style={{
          fontSize: 10, padding: "2px 6px", borderRadius: 5,
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.2)", fontFamily: "inherit",
        }}>⌘K</kbd>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
        {/* Bell */}
        <button data-testid="button-notifications" style={{
          position: "relative", padding: 8, borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)", cursor: "pointer",
          color: "rgba(255,255,255,0.4)", transition: "all 0.2s",
        }}>
          <Bell size={15} />
          <span style={{
            position: "absolute", top: 8, right: 8,
            width: 6, height: 6, borderRadius: "50%",
            background: "#22d3ee", boxShadow: "0 0 8px #22d3ee",
          }} />
        </button>

        {/* Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.06)" }} data-testid="user-profile">
          <div className="hidden sm:block" style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>Arjun Sharma</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.3 }}>Administrator</p>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "linear-gradient(135deg, #22d3ee, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 900, color: "#fff",
            boxShadow: "0 0 16px rgba(34,211,238,0.4)",
            flexShrink: 0,
          }}>AS</div>
        </div>
      </div>
    </header>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: reports = [] } = useQuery<any[]>({
    queryKey: ["/api/reports"],
  });

  const totalReports = reports.length;
  const completedReports = reports.filter((r: any) =>
    r.status === "completed" || r.analysisData
  ).length;
  const successRate = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 98;
  const avgFunds = reports.length > 0
    ? Math.round(reports.reduce((a: number, r: any) => a + (r.analysisData?.funds?.length ?? 12), 0) / reports.length)
    : 12;

  const recentRows = reports.slice(0, 8).map((r: any, i: number) => ({
    id: r.id ?? `CAS-${7841 - i}`,
    name: r.analysisData?.investorInfo?.name ?? ["Arjun Sharma", "Priya Mehta", "Rohit Verma", "Sneha Iyer", "Kabir Nair", "Ananya Joshi", "Dev Malhotra", "Riya Patel"][i % 8],
    status: r.status ?? (i % 5 === 3 ? "failed" : i % 4 === 1 ? "processing" : "completed"),
    funds: r.analysisData?.funds?.length ?? (14 - i * 1),
    date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : `31 Mar 2026`,
  }));

  const FALLBACK_ROWS = [
    { id: "CAS-7841", name: "Arjun Sharma",  status: "completed",  funds: 14, date: "31 Mar 2026" },
    { id: "CAS-7840", name: "Priya Mehta",   status: "processing", funds: 9,  date: "31 Mar 2026" },
    { id: "CAS-7839", name: "Rohit Verma",   status: "completed",  funds: 17, date: "31 Mar 2026" },
    { id: "CAS-7838", name: "Sneha Iyer",    status: "failed",     funds: 0,  date: "31 Mar 2026" },
    { id: "CAS-7837", name: "Kabir Nair",    status: "completed",  funds: 11, date: "31 Mar 2026" },
    { id: "CAS-7836", name: "Ananya Joshi",  status: "pending",    funds: 8,  date: "30 Mar 2026" },
    { id: "CAS-7835", name: "Dev Malhotra",  status: "completed",  funds: 21, date: "30 Mar 2026" },
  ];
  const tableRows = recentRows.length > 0 ? recentRows : FALLBACK_ROWS;

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] } }),
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#090d16",
      color: "#fff",
      fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
    }}>
      <style>{STYLE}</style>
      <style>{`
        .sidebar-btn:hover { background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.7) !important; }
        .sidebar-btn-red:hover { background: rgba(248,113,113,0.08) !important; color: #f87171 !important; }
        .row-hover:hover { background: rgba(255,255,255,0.025) !important; }
        .view-btn:hover { color: #22d3ee !important; }
        .md\\:ml-\\[60px\\] { margin-left: 0; }
        @media (min-width: 768px) { .md\\:ml-\\[60px\\] { margin-left: 60px !important; } }
      `}</style>

      {/* Ambient glows */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(34,211,238,0.07) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 50% 35% at 85% 85%, rgba(168,85,247,0.06) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.025,
        backgroundImage: "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }} />

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <TopBar onMenu={() => setMobileOpen(true)} />

      <main style={{ marginLeft: 0, paddingTop: 56, minHeight: "100vh" }} className="md:ml-[60px]">
        <div style={{ padding: "28px 24px", maxWidth: 1560 }}>

          {/* ── HERO ROW ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}
          >
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(34,211,238,0.7)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>
                Command Center
              </p>
              <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                Welcome back, Arjun
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
                Your CAS analytics overview · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 100,
                border: "1px solid rgba(52,211,153,0.25)",
                background: "rgba(52,211,153,0.07)",
              }} data-testid="status-system">
                <span className="dot-pulse" style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#34d399", display: "inline-block",
                  boxShadow: "0 0 8px #34d399",
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399", letterSpacing: "0.04em" }}>
                  CAS System · Online
                </span>
              </div>
            </div>
          </motion.div>

          {/* ── BENTO KPI GRID ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 20,
          }} className="kpi-grid">
            <style>{`
              @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
              @media (max-width: 600px)  { .kpi-grid { grid-template-columns: 1fr !important; } }
            `}</style>

            {/* KPI 1 — Featured (reports analyzed) */}
            {[
              {
                label: "Reports Analyzed",
                value: totalReports || 2841,
                suffix: "",
                trend: "+18.4%",
                up: true,
                color: "#22d3ee",
                sub: "Total CAS files processed",
                icon: FileText,
              },
              {
                label: "Active Portfolios",
                value: 1247,
                suffix: "",
                trend: "+9.2%",
                up: true,
                color: "#a855f7",
                sub: "Unique investor portfolios",
                icon: BarChart2,
              },
              {
                label: "Success Rate",
                value: successRate,
                suffix: "%",
                trend: "+1.2%",
                up: true,
                color: "#34d399",
                sub: "Analysis completion rate",
                icon: CheckCircle2,
              },
              {
                label: "Avg Funds / CAS",
                value: avgFunds,
                suffix: "",
                trend: "+2.1%",
                up: true,
                color: "#f59e0b",
                sub: "Average schemes per statement",
                icon: Activity,
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ y: -4, scale: 1.015 }}
                  className="grad-border"
                  data-testid={`kpi-card-${card.label.toLowerCase().replace(/ /g, "-")}`}
                  style={{
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.025)",
                    backdropFilter: "blur(20px)",
                    padding: "22px 22px 18px",
                    overflow: "hidden",
                    position: "relative",
                    cursor: "default",
                    border: "1px solid rgba(255,255,255,0.06)",
                    transition: "box-shadow 0.3s ease, transform 0.3s ease",
                  }}
                  onHoverStart={(e) => {
                    const el = e.target as HTMLElement;
                    el.closest('[data-testid]')?.setAttribute('style', `
                      border-radius:18px;background:rgba(255,255,255,0.025);
                      backdrop-filter:blur(20px);padding:22px 22px 18px;
                      overflow:hidden;position:relative;cursor:default;
                      border:1px solid ${card.color}30;
                      box-shadow:0 0 30px ${card.color}15, 0 20px 60px rgba(0,0,0,0.3);
                      transition:box-shadow 0.3s ease, transform 0.3s ease;
                    `);
                  }}
                >
                  {/* Ambient orb */}
                  <div style={{
                    position: "absolute", top: -20, right: -20,
                    width: 100, height: 100, borderRadius: "50%",
                    background: `radial-gradient(circle, ${card.color}20, transparent 70%)`,
                    animation: "pulse-orb 3s ease-in-out infinite",
                    animationDelay: `${i * 0.5}s`,
                    pointerEvents: "none",
                  }} />

                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      {card.label}
                    </span>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: `${card.color}15`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 0 10px ${card.color}25`,
                    }}>
                      <Icon size={14} style={{ color: card.color }} />
                    </div>
                  </div>

                  <p style={{ fontSize: "clamp(28px, 3vw, 38px)", fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 10, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                    <AnimatedNum value={typeof card.value === "number" ? card.value : 0} />
                    <span style={{ fontSize: "0.45em", color: "rgba(255,255,255,0.5)", marginLeft: 2 }}>{card.suffix}</span>
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 11, fontWeight: 700,
                      color: card.up ? "#34d399" : "#f87171",
                      padding: "2px 8px", borderRadius: 100,
                      background: card.up ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                    }}>
                      {card.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {card.trend}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>vs last month</span>
                  </div>

                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>{card.sub}</p>
                </motion.div>
              );
            })}
          </div>

          {/* ── MAIN CHART + CATEGORY ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 260px",
            gap: 16,
            marginBottom: 20,
          }} className="chart-grid">
            <style>{`
              @media (max-width: 900px) { .chart-grid { grid-template-columns: 1fr !important; } }
            `}</style>

            {/* Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{
                borderRadius: 18,
                background: "rgba(255,255,255,0.022)",
                backdropFilter: "blur(20px)",
                padding: "22px 24px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>
                    30-Day Activity
                  </p>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                    CAS Processing Timeline
                  </h2>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {[{ label: "Uploads", color: "#22d3ee" }, { label: "Analyzed", color: "#a855f7" }].map(l => (
                    <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      <span style={{ width: 22, height: 2, borderRadius: 2, background: l.color, boxShadow: `0 0 6px ${l.color}`, display: "inline-block" }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ height: 220 }} data-testid="chart-activity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={THIRTY_DAYS} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <filter id="ln-glow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} interval={5} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="uploads" stroke="#22d3ee" strokeWidth={2.5}
                      fill="url(#gc)" filter="url(#ln-glow)" dot={false}
                      activeDot={{ r: 5, fill: "#22d3ee", strokeWidth: 0, filter: "url(#ln-glow)" }} />
                    <Area type="monotone" dataKey="analyzed" stroke="#a855f7" strokeWidth={2.5}
                      fill="url(#gp)" filter="url(#ln-glow)" dot={false}
                      activeDot={{ r: 5, fill: "#a855f7", strokeWidth: 0, filter: "url(#ln-glow)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Fund Category Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.46, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{
                borderRadius: 18,
                background: "rgba(255,255,255,0.022)",
                backdropFilter: "blur(20px)",
                padding: "22px 20px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>
                Distribution
              </p>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 20, letterSpacing: "-0.01em" }}>
                Fund Categories
              </h2>

              <div style={{ height: 150, marginBottom: 20 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CATEGORY_DATA} margin={{ top: 0, right: 0, left: -30, bottom: 0 }} barSize={24}>
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {CATEGORY_DATA.map((d, i) => (
                        <Cell key={i} fill={d.color} style={{ filter: `drop-shadow(0 0 6px ${d.color}80)` }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {CATEGORY_DATA.map(d => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, boxShadow: `0 0 6px ${d.color}`, display: "inline-block" }} />
                      {d.name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: d.color }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── BOTTOM ROW ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 280px",
            gap: 16,
            paddingBottom: 40,
          }} className="bottom-grid">
            <style>{`
              @media (max-width: 900px) { .bottom-grid { grid-template-columns: 1fr !important; } }
            `}</style>

            {/* Recent Reports Table */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{
                borderRadius: 18,
                background: "rgba(255,255,255,0.022)",
                backdropFilter: "blur(20px)",
                padding: "22px 24px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>
                    Live Feed
                  </p>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                    Recent Submissions
                  </h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", display: "inline-block", boxShadow: "0 0 6px #22d3ee" }}
                  />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Live</span>
                </div>
              </div>

              <div style={{ overflowX: "auto" }} data-testid="table-recent-scans">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {["Submission ID", "Investor", "Funds", "Status", "Date", ""].map((h, i) => (
                        <th key={i} style={{
                          textAlign: "left", fontSize: 10, fontWeight: 700,
                          color: "rgba(255,255,255,0.22)", textTransform: "uppercase",
                          letterSpacing: "0.12em", paddingBottom: 12, paddingRight: 20,
                          whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row: any, i: number) => {
                      const s = STATUS_MAP[row.status] ?? STATUS_MAP.completed;
                      const SIcon = s.icon;
                      return (
                        <motion.tr
                          key={row.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.65 + i * 0.05 }}
                          className="row-hover"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "default", transition: "background 0.15s" }}
                        >
                          <td style={{ padding: "13px 20px 13px 0", fontFamily: "monospace", fontSize: 12, color: "#22d3ee", fontWeight: 700, letterSpacing: "0.05em" }}>
                            {row.id}
                          </td>
                          <td style={{ padding: "13px 20px 13px 0", fontSize: 12, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap", fontWeight: 500 }}>
                            {row.name}
                          </td>
                          <td style={{ padding: "13px 20px 13px 0" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
                              {row.funds > 0 ? row.funds : "—"}
                            </span>
                          </td>
                          <td style={{ padding: "13px 20px 13px 0" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "4px 10px", borderRadius: 100,
                              fontSize: 11, fontWeight: 700,
                              color: s.color, background: s.bg,
                              border: `1px solid ${s.color}30`,
                              boxShadow: `0 0 8px ${s.color}20`,
                            }}>
                              <SIcon size={10} />
                              {s.label}
                            </span>
                          </td>
                          <td style={{ padding: "13px 20px 13px 0", fontSize: 11, color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>
                            {row.date}
                          </td>
                          <td style={{ padding: "13px 0 13px 0" }}>
                            <button
                              data-testid={`button-view-${row.id}`}
                              className="view-btn"
                              style={{
                                display: "flex", alignItems: "center", gap: 4,
                                fontSize: 11, color: "rgba(255,255,255,0.2)",
                                background: "none", border: "none", cursor: "pointer",
                                fontWeight: 600, transition: "color 0.15s",
                              }}
                            >
                              View <ChevronRight size={11} />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* System Health */}
            <motion.div
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.58, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="grad-border"
              style={{
                borderRadius: 18,
                background: "rgba(255,255,255,0.022)",
                backdropFilter: "blur(20px)",
                padding: "22px 20px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              data-testid="widget-system-health"
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>
                Infrastructure
              </p>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 22, letterSpacing: "-0.01em" }}>
                System Health
              </h2>

              {HEALTH.map(h => <HealthBar key={h.label} {...h} />)}

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { icon: Cpu,         label: "CPU Cores", value: "16 vCPU", color: "#22d3ee" },
                  { icon: MemoryStick, label: "RAM",       value: "32 GB",   color: "#a855f7" },
                  { icon: HardDrive,   label: "Storage",   value: "500 GB",  color: "#34d399" },
                  { icon: Wifi,        label: "Uptime",    value: "99.97%",  color: "#f59e0b" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${color}12`, boxShadow: `0 0 8px ${color}20`,
                    }}>
                      <Icon size={12} style={{ color }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                      <p style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{value}</p>
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
