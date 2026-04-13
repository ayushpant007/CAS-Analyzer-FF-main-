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
      else { onClose(); navigate("/landing"); }
    } catch { setError("Login failed. Please try again."); }
    finally { setLoading(false); }
  };

  const redirectToGoogle = async (mode: "login" | "signup") => {
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
      sessionStorage.setItem("google_auth_mode", mode);
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

  const handleGoogleLogin = () => redirectToGoogle("login");
  const handleGoogleSignUp = () => redirectToGoogle("signup");

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
        else {
          // Save to localStorage so landing page knows the user is logged in
          localStorage.setItem("cas_user", JSON.stringify({ name, email: email.toLowerCase() }));
          onClose();
          // Redirect to landing page so user sees "Go To CAS Analyzer" button
          navigate("/landing");
        }
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
      <div className="pt-1 space-y-3">
        <GlowButton variant="purple" onClick={handleSignUp} loading={loading} testId="button-signup">
          <Zap size={15} /> Sign Up
        </GlowButton>
        <GlowButton variant="ghost" onClick={handleGoogleSignUp} testId="button-google-signup">
          <SiGoogle size={13} /> Connect with Google
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

// ── Light-mode input for the split-page layout ───────────────────────────────
function LightInput({ icon: Icon, placeholder, type = "text", value, onChange, testId, rightEl }: {
  icon: React.ElementType; placeholder: string; type?: string;
  value: string; onChange: (v: string) => void; testId: string; rightEl?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`relative flex items-center rounded-xl border bg-gray-50 transition-all duration-200
        ${focused ? "border-[#7c3aed] shadow-[0_0_0_3px_rgba(124,58,237,0.12)]" : "border-gray-200 hover:border-gray-300"}`}>
      <Icon size={16} className={`absolute left-3.5 transition-colors duration-200 ${focused ? "text-[#7c3aed]" : "text-gray-400"}`} />
      <input data-testid={testId} type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full bg-transparent pl-10 pr-10 py-3.5 text-sm text-gray-800 placeholder-gray-400 outline-none" />
      {rightEl && <div className="absolute right-3">{rightEl}</div>}
    </div>
  );
}

function SolidButton({ children, onClick, loading = false, variant = "primary", testId }: {
  children: React.ReactNode; onClick?: () => void;
  loading?: boolean; variant?: "primary" | "outline" | "google"; testId?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-md hover:shadow-lg",
    outline: "bg-white border-2 border-white/50 text-white hover:bg-white/10",
    google: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm",
  };
  return (
    <button type="button" data-testid={testId} onClick={onClick} disabled={loading}
      className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2.5 ${styles[variant]} disabled:opacity-60 disabled:cursor-not-allowed`}>
      {loading
        ? <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
        : children}
    </button>
  );
}

// Default export — standalone /login + /signup full-page split layout
export default function AuthPage({ defaultView: initView = "login" }: { defaultView?: "login" | "signup" }) {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"login" | "signup">(initView);
  const [subView, setSubView] = useState<AuthView>(initView);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);

  const setField = (key: keyof FormState) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const switchTo = (v: "login" | "signup") => {
    setView(v); setSubView(v); setError(""); setForm(INITIAL_FORM);
  };

  const handleSuccess = (u: { name: string; email: string }) => {
    localStorage.setItem("cas_user", JSON.stringify(u));
    navigate("/landing");
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, password: form.password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid credentials."); return; }
      firebaseLoginUser(form.email, form.password).catch(() => {});
      handleSuccess({ name: data.name || form.email.split("@")[0], email: form.email });
    } catch { setError("Login failed. Please try again."); }
    finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!form.firstName || !form.email || !form.password) { setError("Please fill all required fields."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, name: `${form.firstName} ${form.lastName}`.trim(), password: form.password, mobile: form.mobile }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send code."); return; }
      if (data.devOtp) setDevOtp(data.devOtp);
      setSubView("verify");
    } catch { setError("Sign up failed. Please try again."); }
    finally { setLoading(false); }
  };

  const handleVerifyCode = async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, otp: code }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Incorrect code."); return; }
      if (form.password) firebaseSaveUser({ firstName: form.firstName, lastName: form.lastName, email: form.email, mobile: form.mobile, password: form.password }).catch(() => {});
      handleSuccess({ name: data.name || `${form.firstName} ${form.lastName}`.trim(), email: form.email });
    } catch { setError("Verification failed."); }
    finally { setLoading(false); }
  };

  const redirectToGoogle = async (mode: "login" | "signup") => {
    setLoading(true); setError("");
    try {
      const config = await fetch("/api/config/public").then(r => r.json());
      const clientId = config.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) { setError("Google Sign-In is not configured."); return; }
      sessionStorage.setItem("google_auth_mode", mode);
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: `${window.location.origin}/auth/google/callback`, response_type: "token", scope: "openid email profile", include_granted_scopes: "true", prompt: "select_account" });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch { setError("Google Sign-In is not available."); }
    finally { setLoading(false); }
  };

  const handleForgotSend = async () => {
    if (!form.resetEmail) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.resetEmail }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send reset link."); return; }
      setSubView("forgot-sent");
    } catch { setError("Failed. Please try again."); }
    finally { setLoading(false); }
  };

  const divider = (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium">or</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );

  const renderForm = () => {
    if (subView === "verify") return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500 text-center">We sent a 6-digit code to <span className="font-semibold text-[#7c3aed]">{form.email}</span></p>
        {devOtp && <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 text-center"><p className="text-purple-700 font-semibold text-xs mb-1">Dev OTP:</p><p className="text-purple-900 text-2xl font-bold tracking-widest">{devOtp}</p></div>}
        <div className="flex gap-2 justify-center">
          {[0,1,2,3,4,5].map(i => (
            <input key={i} type="text" inputMode="numeric" maxLength={1}
              data-testid={`input-code-${i}`}
              className="w-11 h-13 text-center text-xl font-bold rounded-lg border-2 border-gray-200 focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] outline-none bg-gray-50 text-gray-800 transition-all"
              onChange={e => {
                const val = e.target.value.replace(/\D/g, "");
                if (val) (document.querySelectorAll(`[data-testid^="input-code-"]`)[i + 1] as HTMLInputElement)?.focus();
              }}
            />
          ))}
        </div>
        <SolidButton onClick={() => {
          const digits = Array.from(document.querySelectorAll('[data-testid^="input-code-"]')).map((el: any) => el.value).join("");
          if (digits.length === 6) handleVerifyCode(digits);
        }} loading={loading} testId="button-verify-otp">
          <Shield size={15} /> Verify & Continue
        </SolidButton>
        <button onClick={() => setSubView("signup")} className="w-full text-xs text-gray-400 hover:text-[#7c3aed] transition-colors">← Back</button>
      </div>
    );

    if (subView === "forgot-email") return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Enter your registered email and we'll send you a reset link.</p>
        <LightInput icon={Mail} placeholder="Email Address" type="email" value={form.resetEmail} onChange={setField("resetEmail")} testId="input-reset-email" />
        <SolidButton onClick={handleForgotSend} loading={loading} testId="button-send-reset"><ArrowRight size={15} /> Send Reset Link</SolidButton>
        <button onClick={() => setSubView("login")} className="w-full text-xs text-gray-400 hover:text-[#7c3aed] transition-colors">← Back to Sign In</button>
      </div>
    );

    if (subView === "forgot-sent") return (
      <div className="space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto"><Mail size={24} className="text-[#7c3aed]" /></div>
        <div><p className="text-sm text-gray-500">Reset link sent to</p><p className="font-semibold text-[#7c3aed] mt-1">{form.resetEmail}</p><p className="text-xs text-gray-400 mt-2">Check your inbox. It expires in 1 hour.</p></div>
        <button onClick={() => { setSubView("login"); setView("login"); }} className="text-xs text-gray-400 hover:text-[#7c3aed] transition-colors">Back to Sign In</button>
      </div>
    );

    if (view === "login") return (
      <div className="space-y-4">
        <LightInput icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={setField("email")} testId="input-email" />
        <LightInput icon={Lock} placeholder="Password" type={showPass ? "text" : "password"} value={form.password} onChange={setField("password")} testId="input-password"
          rightEl={<button type="button" onClick={() => setShowPass(p => !p)} className="text-gray-400 hover:text-gray-600">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
        <div className="flex justify-end">
          <button type="button" onClick={() => setSubView("forgot-email")} className="text-xs text-[#7c3aed] hover:text-[#6d28d9] font-medium transition-colors">Forgot Password?</button>
        </div>
        <SolidButton onClick={handleLogin} loading={loading} testId="button-login"><Zap size={15} /> Sign In</SolidButton>
        {divider}
        <SolidButton onClick={() => redirectToGoogle("login")} variant="google" testId="button-google">
          <SiGoogle size={14} /> Continue with Google
        </SolidButton>
      </div>
    );

    return (
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <LightInput icon={User} placeholder="First Name" value={form.firstName} onChange={setField("firstName")} testId="input-firstname" />
          <LightInput icon={User} placeholder="Last Name" value={form.lastName} onChange={setField("lastName")} testId="input-lastname" />
        </div>
        <LightInput icon={Phone} placeholder="Mobile Number" type="tel" value={form.mobile} onChange={setField("mobile")} testId="input-mobile" />
        <LightInput icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={setField("email")} testId="input-signup-email" />
        <LightInput icon={Lock} placeholder="Password" type={showPass ? "text" : "password"} value={form.password} onChange={setField("password")} testId="input-signup-password"
          rightEl={<button type="button" onClick={() => setShowPass(p => !p)} className="text-gray-400 hover:text-gray-600">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
        <SolidButton onClick={handleSignUp} loading={loading} testId="button-signup"><Zap size={15} /> Create Account</SolidButton>
        {divider}
        <SolidButton onClick={() => redirectToGoogle("signup")} variant="google" testId="button-google-signup">
          <SiGoogle size={14} /> Continue with Google
        </SolidButton>
      </div>
    );
  };

  const isLogin = view === "login" && subView === "login";
  const isSignup = view === "signup" && (subView === "signup" || subView === "verify");

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
      {/* ── Left panel: Form ─────────────────────────── */}
      <div className="flex-1 lg:w-1/2 flex flex-col justify-center px-6 sm:px-10 md:px-16 lg:px-20 py-12 bg-white overflow-y-auto">
        {/* Logo */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/landing")}>
            <img src="/favicon.png" alt="Financial Friend" className="w-9 h-9 object-contain" />
            <div>
              <p className="text-base font-bold text-gray-900 leading-tight">Financial</p>
              <p className="text-base font-black text-[#7c3aed] leading-tight tracking-wide">FRIEND</p>
            </div>
          </div>
        </div>

        {/* Form header */}
        <div className="mb-8 max-w-sm">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {subView === "verify" ? "Verify Email" : subView === "forgot-email" ? "Reset Password" : subView === "forgot-sent" ? "Check Your Email" : isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            {subView === "verify" ? "Enter the code sent to your inbox" : subView === "forgot-email" ? "We'll send you a reset link" : subView === "forgot-sent" ? "Reset link has been sent" : isLogin ? "Sign in to access CAS Analyzer" : "Join CAS Analyzer today — it's free"}
          </p>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div key={subView} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {renderForm()}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl py-2.5 px-3.5" data-testid="text-error">
              {error}
            </motion.div>
          )}

          {/* Footer toggle */}
          {(subView === "login" || subView === "signup") && (
            <p className="mt-6 text-sm text-gray-500 text-center">
              {isLogin ? (
                <>Don't have an account?{" "}<button onClick={() => switchTo("signup")} className="font-semibold text-[#7c3aed] hover:text-[#6d28d9] transition-colors" data-testid="link-signup">Sign up</button></>
              ) : (
                <>Already have an account?{" "}<button onClick={() => switchTo("login")} className="font-semibold text-[#7c3aed] hover:text-[#6d28d9] transition-colors" data-testid="link-login">Sign in</button></>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── Right panel: Brand ───────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-16 py-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 40%, #0f172a 100%)" }}>
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />

        <div className="relative z-10 text-center max-w-md">
          {/* Brand logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <img src="/favicon.png" alt="Financial Friend" className="w-12 h-12 object-contain brightness-0 invert" />
            <div className="text-left">
              <p className="text-xl font-bold text-white/90 leading-tight">Financial</p>
              <p className="text-xl font-black text-white leading-tight tracking-widest">FRIEND</p>
            </div>
          </div>

          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            {isLogin ? "New beginnings\nstart here." : "Your financial\njourney starts here."}
          </h2>
          <p className="text-white/60 text-base leading-relaxed mb-10">
            {isLogin
              ? "Analyze your mutual fund portfolio with AI-powered insights in minutes."
              : "Get personalized financial guidance, smart investment analysis, and CAS report insights."}
          </p>

          {/* Feature bullets */}
          <div className="space-y-3 text-left mb-10">
            {["AI-powered CAS PDF analysis", "Portfolio health & asset allocation", "SIP & investment tracking"].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <span className="text-white/80 text-sm">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA to switch */}
          <SolidButton
            onClick={() => switchTo(isLogin ? "signup" : "login")}
            variant="outline"
            testId={isLogin ? "button-goto-signup" : "button-goto-login"}
          >
            {isLogin ? "Create an Account →" : "Sign In Instead →"}
          </SolidButton>
        </div>
      </div>
    </div>
  );
}
