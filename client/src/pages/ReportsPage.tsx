import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, Search, ChevronRight, BarChart2, Upload,
  Zap, LogOut, CheckCircle2, Clock,
  Filter, Calendar, TrendingUp, Eye, FolderOpen,
} from "lucide-react";

const STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #070a12; }
  .sidebar-btn:hover { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.8) !important; }
  .sidebar-btn-red:hover { background: rgba(248,113,113,0.1) !important; color: #f87171 !important; }
  .card-hover:hover { border-color: rgba(34,211,238,0.25) !important; background: rgba(34,211,238,0.03) !important; transform: translateY(-2px); }
  .card-hover { transition: all 0.22s ease; }
  .view-btn:hover { color: #22d3ee !important; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
`;

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  completed: { label: "Analyzed",  color: "#34d399", bg: "rgba(52,211,153,0.10)", icon: CheckCircle2 },
  pending:   { label: "Pending",   color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: Clock },
};

const AVATAR_COLORS = ["#22d3ee", "#a855f7", "#34d399", "#f59e0b", "#f472b6", "#60a5fa"];

const NAV = [
  { icon: Upload,           label: "Upload CAS", href: "/home" },
  { icon: FileText,         label: "Reports",    href: "/reports" },
  { icon: BarChart2,        label: "Analytics", href: "",          comingSoon: true },
];

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [, navigate] = useLocation();

  return (
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

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/reports";
          return (
            <div key={item.label} style={{ position: "relative" }}>
              <button
                onClick={() => { if (item.href) navigate(item.href); }}
                title={item.label}
                data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer",
                  transition: "all 0.25s ease",
                  background: isActive ? "rgba(34,211,238,0.12)" : "transparent",
                  color: isActive ? "#22d3ee" : "rgba(255,255,255,0.28)",
                  boxShadow: isActive ? "0 0 20px rgba(34,211,238,0.22), inset 0 0 14px rgba(34,211,238,0.06)" : "none",
                  position: "relative",
                }}
                className={isActive ? "" : "sidebar-btn"}
              >
                {isActive && (
                  <motion.span layoutId="active-pill-reports" style={{
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
  );
}

export default function ReportsPage() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    try { const s = localStorage.getItem("cas_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "analyzed" | "pending">("all");

  useEffect(() => {
    if (!localStorage.getItem("cas_user")) navigate("/landing");
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("cas_user");
    setUser(null);
    navigate("/landing");
  };

  const userEmail = user?.email ?? "";
  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports", userEmail],
    queryFn: () => fetch(`/api/reports${userEmail ? `?email=${encodeURIComponent(userEmail)}` : ""}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const filtered = reports
    .filter(r => {
      const name = (r.analysis?.investor_name ?? r.filename ?? "").toLowerCase();
      const id = String(r.id ?? "");
      const matchSearch = !search.trim() || name.includes(search.toLowerCase()) || id.includes(search.toLowerCase());
      const status = r.analysis ? "analyzed" : "pending";
      const matchFilter = filter === "all" || filter === status;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const totalAnalyzed = reports.filter(r => r.analysis != null).length;
  const totalPending = reports.length - totalAnalyzed;

  return (
    <div style={{ minHeight: "100vh", background: "#070a12", color: "#fff", fontFamily: "'Inter','Space Grotesk',system-ui,sans-serif" }}>
      <style>{STYLE}</style>
      <Sidebar onLogout={handleLogout} />

      <main style={{ marginLeft: 60, padding: "32px 32px 48px", minHeight: "100vh" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 8 }}>
            CAS ANALYZER
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff" }}>
                All <span style={{ background: "linear-gradient(135deg,#22d3ee,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Reports</span>
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", marginTop: 4 }}>
                {reports.length} CAS statement{reports.length !== 1 ? "s" : ""} · {totalAnalyzed} analyzed
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/home")}
              data-testid="button-new-upload"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 100,
                background: "linear-gradient(135deg,#22d3ee,#a855f7)",
                border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 0 20px rgba(34,211,238,0.25)",
              }}
            >
              <Upload size={13} /> New Upload
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
          style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
          {[
            { label: "Total Reports", value: reports.length, icon: FolderOpen, color: "#22d3ee" },
            { label: "Analyzed",      value: totalAnalyzed,  icon: TrendingUp,  color: "#34d399" },
            { label: "Pending",       value: totalPending,   icon: Clock,       color: "#f59e0b" },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
                  borderRadius: 14, background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backdropFilter: "blur(12px)", minWidth: 140,
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${stat.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={16} color={stat.color} />
                </div>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Search + Filter */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          style={{ display: "flex", gap: 10, marginTop: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 380 }}>
            <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by investor name or report ID…"
              data-testid="input-search-reports"
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: 12,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff", fontSize: 12, outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "analyzed", "pending"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
                style={{
                  padding: "8px 16px", borderRadius: 100, cursor: "pointer",
                  fontSize: 11, fontWeight: 700, textTransform: "capitalize", letterSpacing: "0.04em",
                  background: filter === f ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.04)",
                  color: filter === f ? "#22d3ee" : "rgba(255,255,255,0.3)",
                  border: filter === f ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  transition: "all 0.18s ease",
                }}>{f}</button>
            ))}
          </div>
        </motion.div>

        {/* Reports Grid */}
        <div style={{ marginTop: 24 }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
              <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
                Loading reports…
              </motion.div>
            </div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "80px 0" }}>
              <FolderOpen size={44} style={{ color: "rgba(255,255,255,0.08)", margin: "0 auto 16px" }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.2)", marginBottom: 6 }}>
                {search || filter !== "all" ? "No reports match your filters" : "No reports yet"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.1)", marginBottom: 20 }}>
                {search || filter !== "all" ? "Try adjusting your search or filter" : "Upload a CAS statement to get started"}
              </p>
              {!search && filter === "all" && (
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate("/home")}
                  style={{
                    padding: "10px 24px", borderRadius: 100,
                    background: "linear-gradient(135deg,#22d3ee,#a855f7)",
                    border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                  Upload CAS
                </motion.button>
              )}
            </motion.div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              <AnimatePresence>
                {filtered.map((report, i) => {
                  const investorName = report.analysis?.investor_name ?? report.filename ?? "Unknown";
                  const fundsCount = (report.analysis?.mf_snapshot ?? report.analysis?.funds ?? []).length;
                  const status = report.analysis ? "completed" : "pending";
                  const s = STATUS_MAP[status];
                  const SIcon = s.icon;
                  const date = report.createdAt
                    ? new Date(report.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—";
                  const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const initials = investorName.slice(0, 2).toUpperCase();
                  const totalValuation = report.analysis?.mf_snapshot?.reduce((sum: number, mf: any) => sum + (mf.valuation || 0), 0) ?? 0;
                  const casSource = report.analysis?.cas_source ?? null;

                  return (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="card-hover"
                      data-testid={`report-card-${report.id}`}
                      style={{
                        borderRadius: 18, padding: "22px 24px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        backdropFilter: "blur(20px)",
                        cursor: "pointer",
                      }}
                      onClick={() => { if (report.analysis) navigate(`/reports/${report.id}/concise`); }}
                    >
                      {/* Card Header */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                            background: `linear-gradient(135deg, ${avatarColor}50, ${avatarColor}20)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, fontWeight: 900, color: avatarColor,
                            border: `1px solid ${avatarColor}35`,
                            boxShadow: `0 0 14px ${avatarColor}25`,
                          }}>{initials}</div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1.2, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {investorName}
                            </p>
                            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 3, fontFamily: "monospace" }}>
                              ID #{report.id} {casSource ? `· ${casSource}` : ""}
                            </p>
                          </div>
                        </div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 100, fontSize: 10, fontWeight: 700,
                          color: s.color, background: s.bg, border: `1px solid ${s.color}28`,
                          flexShrink: 0,
                        }}>
                          <SIcon size={9} />
                          {s.label}
                        </span>
                      </div>

                      {/* Stats Row */}
                      <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 900, color: "#22d3ee", lineHeight: 1 }}>{fundsCount || "—"}</p>
                          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Funds</p>
                        </div>
                        {totalValuation > 0 && (
                          <div>
                            <p style={{ fontSize: 18, fontWeight: 900, color: "#a855f7", lineHeight: 1 }}>
                              ₹{totalValuation >= 1e7 ? `${(totalValuation / 1e7).toFixed(1)}Cr` : totalValuation >= 1e5 ? `${(totalValuation / 1e5).toFixed(1)}L` : totalValuation.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </p>
                            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Valuation</p>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
                          <Calendar size={11} />
                          {date}
                        </div>
                        {report.analysis ? (
                          <motion.button
                            whileHover={{ x: 3 }}
                            onClick={e => { e.stopPropagation(); navigate(`/reports/${report.id}/concise`); }}
                            data-testid={`button-view-report-${report.id}`}
                            className="view-btn"
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.18)",
                              borderRadius: 100, padding: "5px 12px",
                              color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            <Eye size={11} /> View Report
                          </motion.button>
                        ) : (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>Awaiting analysis</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
