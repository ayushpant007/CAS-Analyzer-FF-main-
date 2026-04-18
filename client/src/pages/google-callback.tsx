import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function GoogleCallback() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const isPopup = !!window.opener;

  const sendToOpener = (type: string, payload: Record<string, string>) => {
    try {
      window.opener.postMessage({ type, ...payload }, "*");
    } catch {}
    window.close();
  };

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const error = params.get("error");

    if (error) {
      const msg = error === "access_denied" ? "You cancelled Google sign-in." : `Google error: ${error}`;
      if (isPopup) {
        sendToOpener("GOOGLE_OAUTH_ERROR", { error: msg });
        return;
      }
      setErrorMsg(msg);
      setStatus("error");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    if (!accessToken) {
      const msg = "No access token received from Google.";
      if (isPopup) {
        sendToOpener("GOOGLE_OAUTH_ERROR", { error: msg });
        return;
      }
      setErrorMsg(msg);
      setStatus("error");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    const authMode = sessionStorage.getItem("google_auth_mode") || "login";
    sessionStorage.removeItem("google_auth_mode");

    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(async info => {
        const googleName = info.name ?? info.email?.split("@")[0] ?? "Google User";
        const email = (info.email ?? "").toLowerCase();

        const loginRes = await fetch("/api/auth/google-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: googleName, email, mode: authMode }),
        });
        const loginData = await loginRes.json();

        if (!loginRes.ok) {
          let errMsg = loginData.error || "Login failed. Please try again.";
          if (loginData.alreadyExists) errMsg = "An account with this email already exists. Please log in instead.";
          if (loginData.notFound) errMsg = "No account found for this Google email. Please sign up first.";

          if (isPopup) {
            sendToOpener("GOOGLE_OAUTH_ERROR", { error: errMsg });
            return;
          }
          setErrorMsg(errMsg);
          setStatus("error");
          setTimeout(() => navigate("/login"), 4000);
          return;
        }

        const name = loginData.name || googleName;

        if (isPopup) {
          sendToOpener("GOOGLE_OAUTH_SUCCESS", { name, email });
          return;
        }

        localStorage.setItem("cas_user", JSON.stringify({ name, email }));
        navigate("/landing");
      })
      .catch(() => {
        const msg = "Failed to fetch your Google profile. Please try again.";
        if (isPopup) {
          sendToOpener("GOOGLE_OAUTH_ERROR", { error: msg });
          return;
        }
        setErrorMsg(msg);
        setStatus("error");
        setTimeout(() => navigate("/login"), 3000);
      });
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#070a12", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter','Space Grotesk',system-ui,sans-serif",
    }}>
      {status === "loading" ? (
        <motion.div style={{ textAlign: "center" }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "3px solid rgba(34,211,238,0.2)",
              borderTopColor: "#22d3ee",
              margin: "0 auto 20px",
            }}
          />
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Signing you in with Google…
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center", maxWidth: 380, padding: "0 24px" }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(248,113,113,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            border: "1px solid rgba(248,113,113,0.25)",
          }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
          </div>
          <p style={{ color: "#f87171", fontSize: 15, marginBottom: 8, fontWeight: 600 }}>
            {errorMsg}
          </p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
            Redirecting to login…
          </p>
        </motion.div>
      )}
    </div>
  );
}
