import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const PARENT_ORIGIN = "https://financialfriendai.com";

window.addEventListener("message", (event) => {
  if (event.origin !== PARENT_ORIGIN) return;
});

window.addEventListener("load", () => {
  if (window.parent !== window) {
    window.parent.postMessage({ type: "CAS_ANALYSER_READY" }, PARENT_ORIGIN);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
