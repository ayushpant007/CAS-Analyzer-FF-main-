import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function GoogleCallback() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const error = params.get("error");

    if (error) {
      setErrorMsg(error === "access_denied" ? "You cancelled Google sign-in." : `Google error: ${error}`);
      setStatus("error");
      setTimeout(() => navigate("/dashboard"), 3000);
      return;
    }

    if (!accessToken) {
      setErrorMsg("No access token received from Google.");
      setStatus("error");
      setTimeout(() => navigate("/dashboard"), 3000);
      return;
    }

    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(info => {
        const name = info.name ?? info.email?.split("@")[0] ?? "Google User";
        const email = info.email ?? "";
        localStorage.setItem("cas_user", JSON.stringify({ name, email }));
        navigate("/dashboard?welcome=1");
      })
      .catch(() => {
        setErrorMsg("Failed to fetch your Google profile. Please try again.");
        setStatus("error");
        setTimeout(() => navigate("/dashboard"), 3000);
      });
  }, [navigate]);

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
          style={{ textAlign: "center", maxWidth: 360, padding: "0 24px" }}
        >
          <p style={{ color: "#f87171", fontSize: 14, marginBottom: 8, fontWeight: 600 }}>
            {errorMsg}
          </p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
            Redirecting back to the dashboard…
          </p>
        </motion.div>
      )}
    </div>
  );
}
