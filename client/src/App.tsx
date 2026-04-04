import { Switch, Route } from "wouter";
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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/home" component={Home} />
      <Route path="/dashboard" component={Home} />
      <Route path="/auth/google/callback" component={GoogleCallback} />
      <Route path="/reset-password" component={ResetPasswordPage} />
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
