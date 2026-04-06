import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Shield, ChevronLeft, RefreshCw, Zap, X } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { firebaseSaveUser, firebaseLoginUser } from "@/lib/firebase";

export async function firebaseUpdatePassword(newPassword: string) {
  console.log("[Firebase] updatePassword placeholder", { newPassword });
}
// ──────────────────────────────────────────────────────────────────────────────

export type AuthView = "login" | "signup" | "verify" | "forgot-email" | "forgot-verify" | "forgot-reset" | "forgot-sent";

interface FormState {
  firstName: string; lastName: string; mobile: string; email: string;
  password: string; newPassword: string; confirmPassword: string; resetEmail: string;
}
const INITIAL_FORM: FormState = {
  firstName: "", lastName: "", mobile: "", email: "",
  password: "", newPassword: "", confirmPassword: "", resetEmail: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CodeInput({ onComplete, onResend, loading, devOtp }: { onComplete: (code: string) => void; onResend: () => void; loading?: boolean; devOtp?: string }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (devOtp && devOtp.length === 6) {
      const filled = devOtp.split("").slice(0, 6);
      setDigits(filled);
    }
  }, [devOtp]);

  const isFull = digits.every(d => d !== "");

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...digits];
    next[i] = val.slice(-1);
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "Enter" && isFull) onComplete(digits.join(""));
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    pasted.split("").forEach((ch, idx) => { next[idx] = ch; });
    setDigits(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 sm:gap-3 justify-center">
        {digits.map((d, i) => (
          <input key={i} ref={el => { refs.current[i] = el; }}
            data-testid={`input-code-${i}`} type="text" inputMode="numeric"
            maxLength={1} value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className={`w-11 h-14 text-center text-xl font-bold rounded-lg border-2 outline-none bg-white/5 text-white transition-all duration-200
              ${d ? "border-[#00d4ff] shadow-[0_0_14px_rgba(0,212,255,0.5)] text-[#00d4ff]" : "border-white/20 focus:border-[#7c3aed] focus:shadow-[0_0_14px_rgba(124,58,237,0.4)]"}`}
          />
        ))}
      </div>

      <button
        type="button"
        data-testid="button-verify-otp"
        onClick={() => { if (isFull) onComplete(digits.join("")); }}
        disabled={!isFull || loading}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2
          ${isFull
            ? "bg-gradient-to-r from-[#00d4ff] to-[#0096b4] text-[#020817] shadow-[0_0_24px_rgba(0,212,255,0.5)] hover:shadow-[0_0_36px_rgba(0,212,255,0.7)] hover:scale-[1.02] active:scale-[0.98]"
            : "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
          }`}
      >
        {loading
          ? <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
          : <><Shield size={14} /> Verify Code</>}
      </button>

      <button type="button" onClick={onResend} data-testid="button-resend-code"
        className="flex items-center gap-1.5 mx-auto text-xs text-white/40 hover:text-[#00d4ff] transition-colors">
        <RefreshCw size={11} /> Resend code
      </button>
    </div>
  );
}

function NeonInput({ icon: Icon, placeholder, type = "text", value, onChange, testId, rightEl }: {
  icon: React.ElementType; placeholder: string; type?: string;
  value: string; onChange: (v: string) => void; testId: string; rightEl?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`relative flex items-center rounded-xl border bg-white/5 backdrop-blur-sm transition-all duration-300
        ${focused ? "border-[#7c3aed] shadow-[0_0_20px_rgba(124,58,237,0.3)]" : "border-white/15 hover:border-white/30"}`}>
      <Icon size={16} className={`absolute left-3.5 transition-colors duration-300 ${focused ? "text-[#7c3aed]" : "text-white/30"}`} />
      <input data-testid={testId} type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-white placeholder-white/25 outline-none autofill-dark" />
      {rightEl && <div className="absolute right-3">{rightEl}</div>}
    </div>
  );
}

function GlowButton({ children, onClick, type = "button", loading = false, variant = "cyan", testId }: {
  children: React.ReactNode; onClick?: () => void; type?: "button" | "submit";
  loading?: boolean; variant?: "cyan" | "purple" | "ghost"; testId?: string;
}) {
  const styles = {
    cyan: "bg-gradient-to-r from-[#00d4ff] to-[#0096b4] text-[#020817] shadow-[0_0_24px_rgba(0,212,255,0.5)] hover:shadow-[0_0_36px_rgba(0,212,255,0.7)] hover:scale-[1.02]",
    purple: "bg-gradient-to-r from-[#7c3aed] to-[#5b21b6] text-white shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:shadow-[0_0_36px_rgba(124,58,237,0.7)] hover:scale-[1.02]",
    ghost: "bg-white/5 border border-white/20 text-white hover:bg-white/10 hover:border-white/30 hover:scale-[1.02]",
  };
  return (
    <button type={type} data-testid={testId} onClick={onClick} disabled={loading}
      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 ${styles[variant]} disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100`}>
      {loading
        ? <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
        : children}
    </button>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 40, opacity: 0 }),
};

// ── Main AuthModal ────────────────────────────────────────────────────────────

interface AuthModalProps {
  isOpen: boolean;
  defaultView?: AuthView;
  onClose: () => void;
  onSuccess?: (user: { name: string; email: string }) => void;
}

export function AuthModal({ isOpen, defaultView = "login", onClose, onSuccess }: AuthModalProps) {
  const [, navigate] = useLocation();
  const [view, setView] = useState<AuthView>(defaultView);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);

  // Reset view when modal opens with a new defaultView
  const lastDefault = useRef(defaultView);
  if (isOpen && defaultView !== lastDefault.current) {
    lastDefault.current = defaultView;
    setView(defaultView);
    setError("");
    setForm(INITIAL_FORM);
  }

  const setField = (key: keyof FormState) => (val: string) => setForm(f => ({ ...f, [key]: val }));
  const go = useCallback((next: AuthView, direction = 1) => { setDir(direction); setError(""); setView(next); if (next !== "verify") setDevOtp(undefined); }, []);

  const handleSignUp = async () => {
    if (!form.firstName || !form.email || !form.password) { setError("Please fill all required fields."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: `${form.firstName} ${form.lastName}`.trim(),
          password: form.password,
          mobile: form.mobile,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send code. Please try again."); return; }
      if (data.devOtp) setDevOtp(data.devOtp);
      go("verify", 1);
    } catch { setError("Sign up failed. Please try again."); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid credentials. Please try again."); return; }
      const name = data.name || form.email.split("@")[0];
      // Sync login to Firebase (best-effort, don't block on failure)
      firebaseLoginUser(form.email, form.password).catch(() => {});
      if (onSuccess) { onSuccess({ name, email: form.email }); }
      else { onClose(); navigate("/home"); }
    } catch { setError("Login failed. Please try again."); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const configRes = await fetch("/api/config/public");
      const config = await configRes.json();
      const clientId = config.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setError("Google Sign-In is not configured. Please contact support.");
        return;
      }
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: "openid email profile",
        include_granted_scopes: "true",
        prompt: "select_account",
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch {
      setError("Google Sign-In is not available. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const email = view === "forgot-verify" ? form.resetEmail : form.email;
    if (!email) return;
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: `${form.firstName} ${form.lastName}`.trim() }),
      });
      const data = await res.json();
      if (data.devOtp) setDevOtp(data.devOtp);
    } catch { /* silent */ }
  };

  const handleVerifyCode = async (code: string) => {
    const email = view === "forgot-verify" ? form.resetEmail : form.email;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Incorrect code. Please try again."); return; }
      if (view === "forgot-verify") {
        go("forgot-reset", 1);
      } else {
        const name = data.name || `${form.firstName} ${form.lastName}`.trim() || email.split("@")[0];
        // Save user to Firebase after successful signup OTP verification
        if (form.password) {
          firebaseSaveUser({
            firstName: form.firstName,
            lastName: form.lastName,
            email,
            mobile: form.mobile,
            password: form.password,
          }).catch(() => {});
        }
        if (onSuccess) { onSuccess({ name, email }); }
        else { onClose(); navigate("/home"); }
      }
    } catch { setError("Verification failed."); }
    finally { setLoading(false); }
  };

  const handleSendReset = async () => {
    if (!form.resetEmail) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send reset link."); return; }
      go("forgot-sent", 1);
    }
    catch { setError("Failed to send reset link."); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!form.newPassword || form.newPassword !== form.confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try { await firebaseUpdatePassword(form.newPassword); onClose(); navigate("/home"); }
    catch { setError("Failed to update password."); }
    finally { setLoading(false); }
  };

  // ── View renderers ──────────────────────────────────────────────────────────

  const renderLogin = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <NeonInput icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={setField("email")} testId="input-email" />
        <NeonInput icon={Lock} placeholder="Password" type={showPass ? "text" : "password"}
          value={form.password} onChange={setField("password")} testId="input-password"
          rightEl={<button type="button" data-testid="button-toggle-password" onClick={() => setShowPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
      </div>
      <div className="flex justify-end">
        <button type="button" data-testid="link-forgot-password" onClick={() => go("forgot-email", 1)}
          className="text-xs text-[#00d4ff]/70 hover:text-[#00d4ff] transition-colors">Forgot Password?</button>
      </div>
      <div className="space-y-3 pt-1">
        <GlowButton variant="cyan" onClick={handleLogin} loading={loading} testId="button-login">
          <Zap size={15} /> Log In
        </GlowButton>
        <GlowButton variant="ghost" onClick={handleGoogleLogin} testId="button-google">
          <SiGoogle size={13} /> Connect with Google
        </GlowButton>
      </div>
    </div>
  );

  const renderSignUp = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NeonInput icon={User} placeholder="First Name" value={form.firstName} onChange={setField("firstName")} testId="input-firstname" />
        <NeonInput icon={User} placeholder="Last Name" value={form.lastName} onChange={setField("lastName")} testId="input-lastname" />
      </div>
      <NeonInput icon={Phone} placeholder="Mobile Number" type="tel" value={form.mobile} onChange={setField("mobile")} testId="input-mobile" />
      <NeonInput icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={setField("email")} testId="input-signup-email" />
      <NeonInput icon={Lock} placeholder="Password" type={showPass ? "text" : "password"}
        value={form.password} onChange={setField("password")} testId="input-signup-password"
        rightEl={<button type="button" data-testid="button-toggle-signup-password" onClick={() => setShowPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
      <div className="pt-1">
        <GlowButton variant="purple" onClick={handleSignUp} loading={loading} testId="button-signup">
          <Zap size={15} /> Sign Up
        </GlowButton>
      </div>
    </div>
  );

  const renderVerify = () => (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-2xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.2)]">
          <Shield size={24} className="text-[#00d4ff]" />
        </div>
      </div>
      {devOtp ? (
        <div className="rounded-xl border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-4 py-3 text-center text-sm">
          <p className="text-[#00d4ff] font-semibold mb-1">Your verification code:</p>
          <p className="text-white text-2xl font-bold tracking-widest">{devOtp}</p>
          <p className="text-white/40 text-xs mt-1">Code has been filled in automatically below</p>
        </div>
      ) : (
        <p className="text-center text-sm text-white/50">
          We sent a 6-digit code to <span className="text-[#00d4ff] font-medium">{form.email || "your email"}</span>.<br />Enter it below to continue.
        </p>
      )}
      <CodeInput onComplete={handleVerifyCode} onResend={handleResendOtp} loading={loading} devOtp={devOtp} />
    </div>
  );

  const renderForgotEmail = () => (
    <div className="space-y-4">
      <p className="text-sm text-white/50 text-center">Enter your registered email and we'll send you a reset code.</p>
      <NeonInput icon={Mail} placeholder="Email Address" type="email" value={form.resetEmail} onChange={setField("resetEmail")} testId="input-reset-email" />
      <GlowButton variant="cyan" onClick={handleSendReset} loading={loading} testId="button-send-reset">
        <ArrowRight size={15} /> Send Reset Code
      </GlowButton>
    </div>
  );

  const renderForgotVerify = () => (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/30 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.2)]">
          <Shield size={24} className="text-[#7c3aed]" />
        </div>
      </div>
      <p className="text-center text-sm text-white/50">
        Reset code sent to <span className="text-[#7c3aed] font-medium">{form.resetEmail}</span>.
      </p>
      <CodeInput onComplete={handleVerifyCode} onResend={handleResendOtp} loading={loading} />
    </div>
  );

  const renderForgotReset = () => (
    <div className="space-y-3">
      <NeonInput icon={Lock} placeholder="New Password" type={showNewPass ? "text" : "password"}
        value={form.newPassword} onChange={setField("newPassword")} testId="input-new-password"
        rightEl={<button type="button" data-testid="button-toggle-newpass" onClick={() => setShowNewPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">{showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
      <NeonInput icon={Lock} placeholder="Confirm Password" type="password" value={form.confirmPassword} onChange={setField("confirmPassword")} testId="input-confirm-password" />
      <div className="pt-1">
        <GlowButton variant="cyan" onClick={handleResetPassword} loading={loading} testId="button-reset-password">
          <Zap size={15} /> Update Password
        </GlowButton>
      </div>
    </div>
  );

  const renderForgotSent = () => (
    <div className="space-y-5 text-center">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-2xl bg-[#22d3ee]/10 border border-[#22d3ee]/30 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)]">
          <Mail size={24} className="text-[#22d3ee]" />
        </div>
      </div>
      <div>
        <p className="text-sm text-white/60">
          A password reset link has been sent to
        </p>
        <p className="text-[#00d4ff] font-semibold mt-1">{form.resetEmail}</p>
        <p className="text-xs text-white/40 mt-3">Click the link in your email to set a new password. It expires in 1 hour.</p>
      </div>
      <button type="button" data-testid="link-back-to-login" onClick={() => go("login", -1)}
        className="text-xs text-white/40 hover:text-[#00d4ff] transition-colors">
        Back to Login
      </button>
    </div>
  );

  const viewConfig: Record<AuthView, { title: string; subtitle: string; back?: AuthView; content: () => React.ReactNode }> = {
    login:         { title: "Welcome Back",     subtitle: "Sign in to access CAS Analyzer",  content: renderLogin },
    signup:        { title: "Create Account",   subtitle: "Join CAS Analyzer today",          content: renderSignUp },
    verify:        { title: "Verify Email",     subtitle: "Check your inbox",  back: "signup", content: renderVerify },
    "forgot-email":  { title: "Forgot Password", subtitle: "Reset your credentials", back: "login", content: renderForgotEmail },
    "forgot-verify": { title: "Check Your Email", subtitle: "Enter the reset code", back: "forgot-email", content: renderForgotVerify },
    "forgot-reset":  { title: "New Password",   subtitle: "Create a strong password", content: renderForgotReset },
    "forgot-sent":   { title: "Check Your Email", subtitle: "Reset link sent", content: renderForgotSent },
  };

  const current = viewConfig[view];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            data-testid="auth-backdrop"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative w-full max-w-md pointer-events-auto" data-testid="auth-modal">
              {/* Glow */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#00d4ff]/20 via-transparent to-[#7c3aed]/20 blur-xl opacity-70" />

              {/* Card */}
              <div className="relative rounded-2xl border border-white/10 bg-[#080f1f]/95 backdrop-blur-2xl p-8 shadow-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {/* Top chrome */}
                <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/60 to-transparent" />

                {/* Close button */}
                <button type="button" onClick={onClose} data-testid="button-close-auth"
                  className="absolute top-4 right-4 text-white/30 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/10">
                  <X size={16} />
                </button>

                {/* Back button */}
                {current.back && (
                  <button type="button" data-testid="button-back" onClick={() => go(current.back!, -1)}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors mb-5">
                    <ChevronLeft size={14} /> Back
                  </button>
                )}

                {/* Header */}
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div key={`header-${view}`} custom={dir} variants={slideVariants}
                    initial="enter" animate="center" exit="exit"
                    transition={{ duration: 0.22, ease: "easeInOut" }} className="mb-7">
                    <h1 className="text-2xl font-bold text-white tracking-tight">{current.title}</h1>
                    <p className="text-sm text-white/40 mt-1">{current.subtitle}</p>
                  </motion.div>
                </AnimatePresence>

                {/* Content */}
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div key={`content-${view}`} custom={dir} variants={slideVariants}
                    initial="enter" animate="center" exit="exit"
                    transition={{ duration: 0.22, ease: "easeInOut" }}>
                    {current.content()}
                  </motion.div>
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      data-testid="text-error"
                      className="mt-4 text-xs text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3">
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer toggles */}
                <AnimatePresence mode="wait">
                  {(view === "login" || view === "signup") && (
                    <motion.div key={`footer-${view}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }} className="mt-6 text-center text-xs text-white/30">
                      {view === "login" ? (
                        <>Don't have an account?{" "}
                          <button type="button" data-testid="link-signup" onClick={() => go("signup", 1)}
                            className="text-[#7c3aed] hover:text-[#9d5ff7] font-semibold transition-colors">Sign up</button>
                        </>
                      ) : (
                        <>Already have an account?{" "}
                          <button type="button" data-testid="link-login" onClick={() => go("login", -1)}
                            className="text-[#00d4ff] hover:text-[#33deff] font-semibold transition-colors">Log in</button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom chrome */}
                <div className="absolute bottom-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#7c3aed]/40 to-transparent" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Default export — standalone /login page
export default function AuthPage() {
  const [, navigate] = useLocation();
  const handleSuccess = (u: { name: string; email: string }) => {
    localStorage.setItem("cas_user", JSON.stringify(u));
    navigate("/home");
  };
  return (
    <div className="fixed inset-0 bg-[#020817] flex items-center justify-center">
      <div className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.8) 1px,transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(0,212,255,0.07)_0%,transparent_70%)]" />
      <AuthModal
        isOpen={true}
        defaultView="login"
        onClose={() => navigate("/landing")}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
