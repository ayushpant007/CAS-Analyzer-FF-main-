import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Shield, ChevronLeft, RefreshCw, Zap } from "lucide-react";
import { SiGoogle } from "react-icons/si";

// ─── Firebase placeholder hooks ───────────────────────────────────────────────
async function firebaseCreateUser(email: string, password: string, displayName: string) {
  console.log("[Firebase] createUserWithEmailAndPassword", { email, displayName });
  return { user: { uid: "mock-uid", email, displayName } };
}
async function firebaseSignIn(email: string, password: string) {
  console.log("[Firebase] signInWithEmailAndPassword", { email });
  return { user: { uid: "mock-uid", email } };
}
async function firebaseGoogleSignIn() {
  console.log("[Firebase] signInWithPopup (Google)");
  return { user: { uid: "mock-uid", email: "user@gmail.com", displayName: "Google User" } };
}
async function firebaseSendPasswordReset(email: string) {
  console.log("[Firebase] sendPasswordResetEmail", { email });
}
async function firebaseSendEmailVerification() {
  console.log("[Firebase] sendEmailVerification");
}
async function firebaseVerifyCode(code: string) {
  console.log("[Firebase] verifyCode (Cloud Function)", { code });
  return code.length === 6;
}
async function firebaseUpdatePassword(newPassword: string) {
  console.log("[Firebase] updatePassword", { newPassword });
}
// ──────────────────────────────────────────────────────────────────────────────

type AuthView = "login" | "signup" | "verify" | "forgot-email" | "forgot-verify" | "forgot-reset";

interface FormState {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  password: string;
  newPassword: string;
  confirmPassword: string;
  resetEmail: string;
}

const INITIAL_FORM: FormState = {
  firstName: "", lastName: "", mobile: "", email: "",
  password: "", newPassword: "", confirmPassword: "", resetEmail: "",
};

// Animated cyber-grid background
function CyberBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#020817] via-[#0a0f1e] to-[#050d1a]" />

      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.8) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow center */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,212,255,0.06)_0%,transparent_70%)]" />

      {/* Corner accent glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(124,58,237,0.15)_0%,transparent_70%)] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(0,212,255,0.12)_0%,transparent_70%)] translate-x-1/2 translate-y-1/2" />

      {/* Floating orbs */}
      {[
        { x: "15%", y: "20%", size: 3, color: "#00d4ff", delay: 0 },
        { x: "80%", y: "15%", size: 2, color: "#7c3aed", delay: 1.5 },
        { x: "70%", y: "75%", size: 4, color: "#00d4ff", delay: 0.8 },
        { x: "25%", y: "70%", size: 2, color: "#7c3aed", delay: 2.2 },
        { x: "50%", y: "90%", size: 3, color: "#00d4ff", delay: 1.1 },
        { x: "90%", y: "50%", size: 2, color: "#7c3aed", delay: 3 },
        { x: "10%", y: "50%", size: 2, color: "#00d4ff", delay: 2.5 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: orb.x, top: orb.y,
            width: orb.size * 2, height: orb.size * 2,
            backgroundColor: orb.color,
            boxShadow: `0 0 ${orb.size * 6}px ${orb.size * 3}px ${orb.color}55`,
          }}
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
          transition={{ duration: 3 + orb.delay, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Scanline */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] opacity-10"
        style={{ background: "linear-gradient(90deg,transparent,#00d4ff,transparent)" }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// Six-box code input
function CodeInput({ onComplete, onResend }: { onComplete: (code: string) => void; onResend: () => void }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...digits];
    next[i] = val.slice(-1);
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (next.every(d => d !== "")) onComplete(next.join(""));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    pasted.split("").forEach((ch, idx) => { next[idx] = ch; });
    setDigits(next);
    if (pasted.length === 6) { onComplete(pasted); refs.current[5]?.focus(); }
    else refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 sm:gap-3 justify-center">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            data-testid={`input-code-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className={`
              w-11 h-14 sm:w-13 sm:h-16 text-center text-xl font-bold rounded-lg border-2 outline-none
              bg-white/5 text-white transition-all duration-200
              ${d ? "border-[#00d4ff] shadow-[0_0_14px_rgba(0,212,255,0.5)] text-[#00d4ff]" : "border-white/20 focus:border-[#7c3aed] focus:shadow-[0_0_14px_rgba(124,58,237,0.4)]"}
            `}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onResend}
        data-testid="button-resend-code"
        className="flex items-center gap-1.5 mx-auto text-xs text-white/40 hover:text-[#00d4ff] transition-colors"
      >
        <RefreshCw size={11} /> Resend code
      </button>
    </div>
  );
}

// Neon input field
function NeonInput({
  icon: Icon, placeholder, type = "text", value, onChange, testId, rightEl,
}: {
  icon: React.ElementType; placeholder: string; type?: string;
  value: string; onChange: (v: string) => void; testId: string;
  rightEl?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`
        relative flex items-center rounded-xl border bg-white/5 backdrop-blur-sm transition-all duration-300
        ${focused ? "border-[#7c3aed] shadow-[0_0_20px_rgba(124,58,237,0.3)]" : "border-white/15 hover:border-white/30"}
      `}
    >
      <Icon size={16} className={`absolute left-3.5 transition-colors duration-300 ${focused ? "text-[#7c3aed]" : "text-white/30"}`} />
      <input
        data-testid={testId}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-white placeholder-white/25 outline-none"
      />
      {rightEl && <div className="absolute right-3">{rightEl}</div>}
    </div>
  );
}

// Primary glowing button
function GlowButton({
  children, onClick, type = "button", loading = false, variant = "cyan", testId,
}: {
  children: React.ReactNode; onClick?: () => void; type?: "button" | "submit";
  loading?: boolean; variant?: "cyan" | "purple" | "ghost"; testId?: string;
}) {
  const styles = {
    cyan: "bg-gradient-to-r from-[#00d4ff] to-[#0096b4] text-[#020817] shadow-[0_0_24px_rgba(0,212,255,0.5)] hover:shadow-[0_0_36px_rgba(0,212,255,0.7)] hover:scale-[1.02]",
    purple: "bg-gradient-to-r from-[#7c3aed] to-[#5b21b6] text-white shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:shadow-[0_0_36px_rgba(124,58,237,0.7)] hover:scale-[1.02]",
    ghost: "bg-white/5 border border-white/20 text-white hover:bg-white/10 hover:border-white/30 hover:scale-[1.02]",
  };
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={loading}
      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 ${styles[variant]} disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100`}
    >
      {loading ? <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} /> : children}
    </button>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 40, opacity: 0 }),
};

export default function AuthPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<AuthView>("login");
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setField = (key: keyof FormState) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const go = useCallback((next: AuthView, direction = 1) => {
    setDir(direction);
    setError("");
    setView(next);
  }, []);

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleSignUp = async () => {
    if (!form.firstName || !form.email || !form.password) { setError("Please fill all required fields."); return; }
    setLoading(true);
    try {
      await firebaseCreateUser(form.email, form.password, `${form.firstName} ${form.lastName}`);
      await firebaseSendEmailVerification();
      go("verify", 1);
    } catch {
      setError("Sign up failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      await firebaseSignIn(form.email, form.password);
      navigate("/");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await firebaseGoogleSignIn();
      navigate("/");
    } catch {
      setError("Google sign-in failed.");
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async (code: string) => {
    setLoading(true);
    try {
      const ok = await firebaseVerifyCode(code);
      if (ok) {
        if (view === "forgot-verify") go("forgot-reset", 1);
        else navigate("/");
      } else setError("Incorrect code. Please try again.");
    } catch {
      setError("Verification failed.");
    } finally { setLoading(false); }
  };

  const handleSendReset = async () => {
    if (!form.resetEmail) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      await firebaseSendPasswordReset(form.resetEmail);
      go("forgot-verify", 1);
    } catch {
      setError("Failed to send reset code.");
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!form.newPassword || form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match."); return;
    }
    setLoading(true);
    try {
      await firebaseUpdatePassword(form.newPassword);
      navigate("/");
    } catch {
      setError("Failed to update password.");
    } finally { setLoading(false); }
  };

  // ── view renderers ─────────────────────────────────────────────────────────

  const renderLogin = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <NeonInput icon={Mail} placeholder="Email Address" type="email" value={form.email} onChange={setField("email")} testId="input-email" />
        <NeonInput
          icon={Lock} placeholder="Password" type={showPass ? "text" : "password"}
          value={form.password} onChange={setField("password")} testId="input-password"
          rightEl={
            <button type="button" data-testid="button-toggle-password" onClick={() => setShowPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          }
        />
      </div>

      <div className="flex justify-end">
        <button type="button" data-testid="link-forgot-password" onClick={() => go("forgot-email", 1)}
          className="text-xs text-[#00d4ff]/70 hover:text-[#00d4ff] transition-colors">
          Forgot Password?
        </button>
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
      <NeonInput
        icon={Lock} placeholder="Password" type={showPass ? "text" : "password"}
        value={form.password} onChange={setField("password")} testId="input-signup-password"
        rightEl={
          <button type="button" data-testid="button-toggle-signup-password" onClick={() => setShowPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
      />
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
      <p className="text-center text-sm text-white/50">
        We sent a 6-digit code to <span className="text-[#00d4ff] font-medium">{form.email || "your email"}</span>.<br />Enter it below to continue.
      </p>
      <CodeInput onComplete={handleVerifyCode} onResend={firebaseSendEmailVerification} />
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
      <CodeInput onComplete={handleVerifyCode} onResend={() => firebaseSendPasswordReset(form.resetEmail)} />
    </div>
  );

  const renderForgotReset = () => (
    <div className="space-y-3">
      <NeonInput
        icon={Lock} placeholder="New Password" type={showNewPass ? "text" : "password"}
        value={form.newPassword} onChange={setField("newPassword")} testId="input-new-password"
        rightEl={
          <button type="button" data-testid="button-toggle-newpass" onClick={() => setShowNewPass(p => !p)} className="text-white/30 hover:text-white/70 transition-colors">
            {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
      />
      <NeonInput icon={Lock} placeholder="Confirm Password" type="password" value={form.confirmPassword} onChange={setField("confirmPassword")} testId="input-confirm-password" />
      <div className="pt-1">
        <GlowButton variant="cyan" onClick={handleResetPassword} loading={loading} testId="button-reset-password">
          <Zap size={15} /> Update Password
        </GlowButton>
      </div>
    </div>
  );

  const viewConfig: Record<AuthView, { title: string; subtitle: string; back?: AuthView; content: () => React.ReactNode }> = {
    login: {
      title: "Welcome Back",
      subtitle: "Sign in to access CAS Analyzer",
      content: renderLogin,
    },
    signup: {
      title: "Create Account",
      subtitle: "Join CAS Analyzer today",
      content: renderSignUp,
    },
    verify: {
      title: "Verify Email",
      subtitle: "Check your inbox",
      back: "signup",
      content: renderVerify,
    },
    "forgot-email": {
      title: "Forgot Password",
      subtitle: "Reset your credentials",
      back: "login",
      content: renderForgotEmail,
    },
    "forgot-verify": {
      title: "Check Your Email",
      subtitle: "Enter the reset code",
      back: "forgot-email",
      content: renderForgotVerify,
    },
    "forgot-reset": {
      title: "New Password",
      subtitle: "Create a strong password",
      content: renderForgotReset,
    },
  };

  const current = viewConfig[view];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <CyberBackground />

      {/* Brand top-left */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center shadow-[0_0_14px_rgba(0,212,255,0.5)]">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-white font-bold tracking-widest text-sm uppercase">CAS Analyzer</span>
      </div>

      {/* Auth Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        data-testid="auth-card"
        className="relative w-full max-w-md"
      >
        {/* Glow behind card */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#00d4ff]/20 via-transparent to-[#7c3aed]/20 blur-xl opacity-60" />

        {/* Card */}
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 shadow-2xl">
          {/* Top chrome bar */}
          <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#00d4ff]/60 to-transparent" />

          {/* Back button */}
          {current.back && (
            <button
              type="button"
              data-testid="button-back"
              onClick={() => go(current.back!, -1)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors mb-5"
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}

          {/* Header */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={`header-${view}`}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="mb-7"
            >
              <h1 className="text-2xl font-bold text-white tracking-tight">{current.title}</h1>
              <p className="text-sm text-white/40 mt-1">{current.subtitle}</p>
            </motion.div>
          </AnimatePresence>

          {/* Form content */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={`content-${view}`}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {current.content()}
            </motion.div>
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                data-testid="text-error"
                className="mt-4 text-xs text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer toggles */}
          <AnimatePresence mode="wait" custom={dir}>
            {(view === "login" || view === "signup") && (
              <motion.div
                key={`footer-${view}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-6 text-center text-xs text-white/30"
              >
                {view === "login" ? (
                  <>Don't have an account?{" "}
                    <button type="button" data-testid="link-signup" onClick={() => go("signup", 1)}
                      className="text-[#7c3aed] hover:text-[#9d5ff7] font-semibold transition-colors">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <button type="button" data-testid="link-login" onClick={() => go("login", -1)}
                      className="text-[#00d4ff] hover:text-[#33deff] font-semibold transition-colors">
                      Log in
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom chrome */}
          <div className="absolute bottom-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#7c3aed]/40 to-transparent" />
        </div>
      </motion.div>

      {/* Corner badge */}
      <div className="absolute bottom-6 right-6 text-[10px] text-white/15 tracking-widest uppercase">
        SECURE · ENCRYPTED · POWERED BY AI
      </div>
    </div>
  );
}
