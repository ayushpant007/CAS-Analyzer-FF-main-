import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import ConciseReport from "@/pages/ConciseReport";
import LandingPage from "@/pages/landing";
import ReportsPage from "@/pages/ReportsPage";
import AuthPage from "@/pages/auth";
import GoogleCallback from "@/pages/google-callback";
import ResetPasswordPage from "@/pages/reset-password";
import PrivacyPolicy from "@/pages/privacy";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

const PARENT_ORIGIN = "https://financialfriendai.com";

function SsoHandler() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const isEmbedded = new URLSearchParams(window.location.search).get("embedded") === "true";
    if (!isEmbedded) return;

    let resolved = false;

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== PARENT_ORIGIN) return;
      if (event.data?.type !== "SSO_TOKEN") return;
      if (resolved) return;
      resolved = true;

      const { email, name, uid, token } = event.data;

      try {
        const res = await fetch("/api/auth/sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, uid, token }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem("cas_user", JSON.stringify({ email: data.user.email, name: data.user.name }));
          navigate("/home");
        }
      } catch {
        navigate("/home");
      }
    };

    window.addEventListener("message", handleMessage);

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const alreadyLoggedIn = !!localStorage.getItem("cas_user");
        if (!alreadyLoggedIn) {
          navigate("/home");
        }
      }
    }, 3000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timer);
    };
  }, [navigate]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/signup" component={() => <AuthPage defaultView="signup" />} />
      <Route path="/home" component={Home} />
      <Route path="/dashboard" component={Home} />
      <Route path="/auth/google/callback" component={GoogleCallback} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/reports/:id/concise" component={ConciseReport} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SsoHandler />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
