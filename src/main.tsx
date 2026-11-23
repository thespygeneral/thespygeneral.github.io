import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/oswald/700.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Offline support + "install as an app". Only in the built site.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
