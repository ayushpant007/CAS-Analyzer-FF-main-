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
      const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || config.googleRedirectUri || `${window.location.origin}/auth/google/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: "openid email profile",
        include_granted_scopes: "true",
        prompt: "select_account",
      });
      const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      const popup = window.open(googleUrl, "google_oauth", "width=520,height=620,left=200,top=100");
      if (!popup) {
        window.location.href = googleUrl;
        return;
      }
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
          window.removeEventListener("message", handler);
          const { name, email } = event.data;
          localStorage.setItem("cas_user", JSON.stringify({ name, email }));
          setLoading(false);
          window.location.href = "/landing";
        } else if (event.data?.type === "GOOGLE_OAUTH_ERROR") {
          window.removeEventListener("message", handler);
          setError(event.data.error || "Google Sign-In failed. Please try again.");
          setLoading(false);
        }
      };
      window.addEventListener("message", handler);
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener("message", handler);
          setLoading(false);
        }
      }, 500);
    } catch {
      setError("Google Sign-In is not available. Please try again.");
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

// ── Glass input for the split-page layout ────────────────────────────────────
function GlassInput({ icon: Icon, placeholder, type = "text", value, onChange, testId, rightEl }: {
  icon: React.ElementType; placeholder: string; type?: string;
  value: string; onChange: (v: string) => void; testId: string; rightEl?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`relative flex items-center rounded-xl border backdrop-blur-sm transition-all duration-300
        ${focused
          ? "border-[#a78bfa] bg-white/10 shadow-[0_0_0_2px_rgba(167,139,250,0.25),0_0_20px_rgba(124,58,237,0.2)]"
          : "border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/8"}`}>
      <Icon size={15} className={`absolute left-3.5 transition-colors duration-300 ${focused ? "text-[#a78bfa]" : "text-white/35"}`} />
      <input data-testid={testId} type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full bg-transparent pl-10 pr-10 py-3.5 text-sm text-white placeholder-white/30 outline-none" />
      {rightEl && <div className="absolute right-3">{rightEl}</div>}
    </div>
  );
}

function GlassButton({ children, onClick, loading = false, variant = "primary", testId }: {
  children: React.ReactNode; onClick?: () => void;
  loading?: boolean; variant?: "primary" | "ghost" | "google"; testId?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-gradient-to-r from-[#7c3aed] to-[#4f46e5] text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_32px_rgba(124,58,237,0.6)] hover:from-[#8b5cf6] hover:to-[#6366f1] border border-white/10",
    ghost: "bg-white/8 backdrop-blur-sm border border-white/20 text-white hover:bg-white/15 hover:border-white/35 shadow-[0_0_12px_rgba(255,255,255,0.05)]",
    google: "bg-white/8 backdrop-blur-sm border border-white/15 text-white/90 hover:bg-white/15 hover:border-white/30",
  };
  return (
    <button type="button" data-testid={testId} onClick={onClick} disabled={loading}
      className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 active:scale-[0.97] flex items-center justify-center gap-2.5 ${styles[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}>
      {loading
        ? <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
        : children}
    </button>
  );
}

function FloatingOrb({ x, y, size, color, duration }: { x: string; y: string; size: number; color: string; duration: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: `blur(${size * 0.6}px)`, opacity: 0.25 }}
      animate={{ x: [0, 30, -20, 15, 0], y: [0, -25, 20, -10, 0], scale: [1, 1.1, 0.95, 1.05, 1] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
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
      const redirectUri2 = import.meta.env.VITE_GOOGLE_REDIRECT_URI || config.googleRedirectUri || `${window.location.origin}/auth/google/callback`;
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri2, response_type: "token", scope: "openid email profile", include_granted_scopes: "true", prompt: "select_account" });
      const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      const popup = window.open(googleUrl, "google_oauth", "width=520,height=620,left=200,top=100");
      if (!popup) { window.location.href = googleUrl; return; }
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
          window.removeEventListener("message", handler);
          localStorage.setItem("cas_user", JSON.stringify({ name: event.data.name, email: event.data.email }));
          setLoading(false);
          window.location.href = "/landing";
        } else if (event.data?.type === "GOOGLE_OAUTH_ERROR") {
          window.removeEventListener("message", handler);
          setError(event.data.error || "Google Sign-In failed.");
          setLoading(false);
        }
      };
      window.addEventListener("message", handler);
      const timer = setInterval(() => { if (popup.closed) { clearInterval(timer); window.removeEventListener("message", handler); setLoading(false); } }, 500);
    } catch { setError("Google Sign-In is not available."); setLoading(false); }
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
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-xs text-white/30 font-medium">or</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );

  const renderForm = () => {
    if (subView === "verify") return (
      <div className="space-y-5">
        <p className="text-sm text-white/50 text-center">We sent a 6-digit code to <span className="font-semibold text-[#a78bfa]">{form.email}</span></p>
        {devOtp && (
          <div className="rounded-xl bg-white/5 border border-[#a78bfa]/30 px-4 py-3 text-center backdrop-blur-sm">
            <p className="text-[#a78bfa] font-semibold text-xs mb-1">Dev OTP:</p>
            <p className="text-white text-2xl font-bold tracking-widest">{devOtp}</p>
          </div>
        )}
        <div className="flex gap-2 justify-center">
          {[0,1,2,3,4,5].map(i => (
            <input key={i} type="text" inputMode="numeric" maxLength={1}
              data-testid={`input-code-${i}`}
              className="w-11 h-13 text-center text-xl font-bold rounded-lg border-2 border-white/15 bg-white/5 focus:border-[#a78bfa] focus:shadow-[0_0_14px_rgba(167,139,250,0.4)] outline-none text-white transition-all backdrop-blur-sm"
              onChange={e => {
                const val = e.target.value.replace(/\D/g, "");
                if (val) (document.querySelectorAll(`[data-testid^="input-code-"]`)[i + 1] as HTMLInputElement)?.focus();
              }}
            />
          ))}
        </div>
        <GlassButton onClick={() => {
          const digits = Array.from(document.querySelectorAll('[data-testid^="input-code-"]')).map((el: any) => el.value).join("");
          if (digits.length === 6) handleVerifyCode(digits);
        }} loading={loading} testId="button-verify-otp">
          <Shield size={15} /> Verify & Continue
        </GlassButton>
        <button onClick={() => setSubView("signup")} className="w-full text-xs text-white/30 hover:text-[#a78bfa] transition-colors">← Back</button>
      </div>
    );

    if (subView === "forgot-email") return (
      <div className="space-y-4">
        <p className="text-sm text-white/50">Enter your registered email and we'll send you a reset link.</p>
        <GlassInput icon={Mail} placeholder="Email Address" type="email" value={form.resetEmail} onChange={setField("resetEmail")} testId="input-reset-email" />
        <GlassButton onClick={handleForgotSend} loading={loading} testId="button-send-reset"><ArrowRight size={15} /> Send Reset Link</GlassButton>
        <button onClick={() => setSubView("login")} className="w-full text-xs text-white/30 hover:text-[#a78bfa] transition-colors">← Back to Sign In</button>
      </div>
    );

    if (subView === "forgot-sent") return (
      <div className="space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-[#a78bfa]/30 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(167,139,250,0.2)]">
          <Mail size={24} className="text-[#a78bfa]" />
        </div>
        <div>
          <p className="text-sm text-white/50">Reset link sent to</p>
          <p className="font-semibold text-[#a78bfa] mt-1">{form.resetEmail}</p>
          <p className="text-xs text-white/30 mt-2">Check your inbox. It expires in 1 hour.</p>
        </div>
        <button onClick={() => { setSubView("login"); setView("login"); }} className="text-xs text-white/30 hover:text-[#a78bfa] transition-colors">Back to Sign In</button>
      </div>
    );

    if (view === "login") return (
      <div className="space-y-4">
        <GlassInput icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={setField("email")} testId="input-email" />
        <GlassInput icon={Lock} placeholder="Password" type={showPass ? "text" : "password"} value={form.password} onChange={setField("password")} testId="input-password"
          rightEl={<button type="button" onClick={() => setShowPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
        <div className="flex justify-end">
          <button type="button" onClick={() => setSubView("forgot-email")} className="text-xs text-[#a78bfa] hover:text-[#c4b5fd] font-medium transition-colors">Forgot Password?</button>
        </div>
        <GlassButton onClick={handleLogin} loading={loading} testId="button-login"><Zap size={15} /> Sign In</GlassButton>
        {divider}
        <GlassButton onClick={() => redirectToGoogle("login")} variant="google" testId="button-google">
          <SiGoogle size={14} /> Continue with Google
        </GlassButton>
      </div>
    );

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <GlassInput icon={User} placeholder="First Name" value={form.firstName} onChange={setField("firstName")} testId="input-firstname" />
          <GlassInput icon={User} placeholder="Last Name" value={form.lastName} onChange={setField("lastName")} testId="input-lastname" />
        </div>
        <GlassInput icon={Phone} placeholder="Mobile Number" type="tel" value={form.mobile} onChange={setField("mobile")} testId="input-mobile" />
        <GlassInput icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={setField("email")} testId="input-signup-email" />
        <GlassInput icon={Lock} placeholder="Password" type={showPass ? "text" : "password"} value={form.password} onChange={setField("password")} testId="input-signup-password"
          rightEl={<button type="button" onClick={() => setShowPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
        <GlassButton onClick={handleSignUp} loading={loading} testId="button-signup"><Zap size={15} /> Create Account</GlassButton>
        {divider}
        <GlassButton onClick={() => redirectToGoogle("signup")} variant="google" testId="button-google-signup">
          <SiGoogle size={14} /> Continue with Google
        </GlassButton>
      </div>
    );
  };

  const isLogin = view === "login" && subView === "login";

  const features = ["AI-powered CAS PDF analysis", "Portfolio health & asset allocation", "SIP & investment tracking"];

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", background: "#07091a" }}
    >
      {/* ── Animated background orbs ── */}
      <FloatingOrb x="-5%" y="5%"   size={500} color="radial-gradient(circle, #7c3aed, transparent)" duration={14} />
      <FloatingOrb x="70%" y="60%"  size={420} color="radial-gradient(circle, #0ea5e9, transparent)" duration={17} />
      <FloatingOrb x="40%" y="80%"  size={300} color="radial-gradient(circle, #4f46e5, transparent)" duration={11} />
      <FloatingOrb x="85%" y="5%"   size={280} color="radial-gradient(circle, #a78bfa, transparent)" duration={13} />
      <FloatingOrb x="20%" y="50%"  size={200} color="radial-gradient(circle, #06b6d4, transparent)" duration={9}  />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(167,139,250,1) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,1) 1px,transparent 1px)", backgroundSize: "52px 52px" }} />

      {/* ── Centered glass card ── */}
      <motion.div
        key={isLogin ? "login-card" : "signup-card"}
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl shadow-[0_8px_60px_rgba(124,58,237,0.2),0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.08)] px-8 py-10">

          {/* Top shimmer */}
          <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full" />

          {/* Logo */}
          <motion.div
            className="mb-8 cursor-pointer w-fit"
            onClick={() => navigate("/landing")}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          >
            <img src="/ff-logo.png" alt="Financial Friend" className="h-10 w-auto object-contain" />
          </motion.div>

          {/* Header */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`hdr-${subView}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mb-7"
            >
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {subView === "verify"       ? "Verify your email"   :
                 subView === "forgot-email" ? "Reset password"      :
                 subView === "forgot-sent"  ? "Check your inbox"    :
                 isLogin                    ? "Welcome back"        : "Create account"}
              </h1>
              <p className="text-white/40 mt-1.5 text-sm">
                {subView === "verify"       ? "Enter the 6-digit code we sent you"  :
                 subView === "forgot-email" ? "We'll send a reset link to your email" :
                 subView === "forgot-sent"  ? "Reset link sent — check your inbox"   :
                 isLogin                    ? "Sign in to access CAS Analyzer"       :
                                             "Join CAS Analyzer today — it's free"}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Form content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`form-${subView}`}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              {renderForm()}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl py-2.5 px-3.5"
                data-testid="text-error"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer toggle */}
          {(subView === "login" || subView === "signup") && (
            <p className="mt-6 text-sm text-white/35 text-center">
              {isLogin ? (
                <>Don't have an account?{" "}
                  <button onClick={() => navigate("/signup")} className="font-semibold text-[#a78bfa] hover:text-[#c4b5fd] transition-colors" data-testid="link-signup">Sign up</button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button onClick={() => navigate("/login")} className="font-semibold text-[#a78bfa] hover:text-[#c4b5fd] transition-colors" data-testid="link-login">Sign in</button>
                </>
              )}
            </p>
          )}

          {/* Bottom shimmer */}
          <div className="absolute bottom-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#7c3aed]/30 to-transparent rounded-full" />
        </div>
      </motion.div>
    </div>
  );
}
