import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Zap, CheckCircle, XCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) setError("Invalid or missing reset link. Please request a new one.");
    else setToken(t);
  }, []);

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to reset password."); return; }
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] flex items-center justify-center p-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#7c3aed]/20 via-transparent to-[#00d4ff]/20 blur-xl opacity-70" />
        <div className="relative rounded-2xl border border-white/10 bg-[#080f1f]/95 backdrop-blur-2xl p-8 shadow-2xl">
          <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#7c3aed]/60 to-transparent" />

          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <CheckCircle size={48} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Password Updated!</h2>
              <p className="text-sm text-white/50">Your password has been changed. Redirecting to login...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-white">Set New Password</h2>
                <p className="text-sm text-white/40 mt-1">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  <XCircle size={14} />
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    data-testid="input-new-password"
                    type={showPass ? "text" : "password"}
                    placeholder="New Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 text-sm outline-none focus:border-[#7c3aed] transition-colors"
                  />
                  <button type="button" data-testid="button-toggle-password"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    data-testid="input-confirm-password"
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 text-sm outline-none focus:border-[#7c3aed] transition-colors"
                    onKeyDown={e => e.key === "Enter" && handleReset()}
                  />
                </div>
              </div>

              <button
                data-testid="button-reset-password"
                onClick={handleReset}
                disabled={loading || !token}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-semibold transition-colors"
              >
                {loading ? <span className="animate-spin rounded-full w-4 h-4 border-2 border-white/30 border-t-white" /> : <Zap size={15} />}
                Update Password
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
