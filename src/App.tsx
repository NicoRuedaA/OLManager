import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useSettingsStore } from "./store/settingsStore";
import { useUpdater } from "./hooks/useUpdater";
import UpdateModal from "./components/updater/UpdateModal";
import FloatingBugButton from "./components/dashboard/FloatingBugButton";
import i18n from "./i18n";
import "./App.css";

const MainMenu = lazy(() => import("./pages/MainMenu"));
const TeamSelection = lazy(() => import("./pages/TeamSelection"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MatchSimulation = lazy(() => import("./pages/MatchSimulation"));
const Settings = lazy(() => import("./pages/Settings"));

function LazyFallback() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const SCALE_MAP: Record<string, string> = {
  xsmall: "9px",
  small: "14px",
  normal: "16px",
  large: "18px",
  xlarge: "20px",
};

const AUTO_CHECK_UPDATES = import.meta.env.PROD;

function App() {
  const { settings, loaded, loadSettings } = useSettingsStore();
  const {
    updateAvailable,
    updateInfo,
    downloading,
    progress,
    error,
    dismissed,
    install,
    dismiss,
  } = useUpdater(AUTO_CHECK_UPDATES);

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  useEffect(() => {
    const size = SCALE_MAP[settings.ui_scale] || "16px";
    document.documentElement.style.fontSize = size;
  }, [settings.ui_scale]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "high-contrast",
      settings.high_contrast,
    );
  }, [settings.high_contrast]);

  // Apply saved language from settings once loaded (overrides OS detection)
  useEffect(() => {
    if (loaded && settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [loaded, settings.language]);

  useEffect(() => {
    const isAndroid = /Android/i.test(window.navigator.userAgent);
    if (!isAndroid) return;

    let cancelled = false;

    const applyAndroidImmersive = async () => {
      if (cancelled) return;

      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setFullscreen(true);
      } catch {
        // Ignore when not running inside Tauri window context
      }

      try {
        if (document.fullscreenElement == null && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen API may require user gesture depending on WebView version
      }

      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch {
        // Some Android versions/devices block orientation lock silently
      }
    };

    void applyAndroidImmersive();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void applyAndroidImmersive();
      }
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const blockMouseBackForward = (event: MouseEvent) => {
      if (event.button === 3 || event.button === 4) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const blockKeyboardHistoryShortcuts = (event: KeyboardEvent) => {
      if (
        event.key === "BrowserBack" ||
        event.key === "BrowserForward" ||
        event.code === "BrowserBack" ||
        event.code === "BrowserForward"
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("mousedown", blockMouseBackForward, { capture: true });
    window.addEventListener("mouseup", blockMouseBackForward, { capture: true });
    window.addEventListener("keydown", blockKeyboardHistoryShortcuts, { capture: true });

    return () => {
      window.removeEventListener("mousedown", blockMouseBackForward, { capture: true });
      window.removeEventListener("mouseup", blockMouseBackForward, { capture: true });
      window.removeEventListener("keydown", blockKeyboardHistoryShortcuts, { capture: true });
    };
  }, []);

  return (
    <BrowserRouter>
      <AppContent
        updateAvailable={updateAvailable}
        dismissed={dismissed}
        updateInfo={updateInfo}
        downloading={downloading}
        progress={progress}
        error={error}
        install={install}
        dismiss={dismiss}
      />
    </BrowserRouter>
  );
}

function AppContent({
  updateAvailable,
  dismissed,
  updateInfo,
  downloading,
  progress,
  error,
  install,
  dismiss,
}: {
  updateAvailable: boolean;
  dismissed: boolean;
  updateInfo: object | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  install: () => void;
  dismiss: () => void;
}) {
  const location = useLocation();
  const showBugButton = ["/dashboard", "/match", "/select-team"].includes(location.pathname);

  return (
    <>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/select-team" element={<TeamSelection />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/match" element={<MatchSimulation />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
      {showBugButton && <FloatingBugButton />}
      {updateAvailable && !dismissed && updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          downloading={downloading}
          progress={progress}
          error={error}
          onInstall={install}
          onDismiss={dismiss}
        />
      )}
    </>
  );
}

export default App;
