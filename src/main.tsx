import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./context/ThemeContext";
import "./i18n";
import "./App.css";
import AppV2 from "./ui-v2/AppV2";
import { getApiClient } from "./api/client";

// Disable the native browser context menu in the Tauri app.
document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

function Boot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    getApiClient().then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <ThemeProvider>
      <AppV2 />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Boot />
  </React.StrictMode>,
);
