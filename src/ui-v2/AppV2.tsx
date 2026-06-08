import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useSettingsStore } from "@/store/settingsStore";
import { useUpdater } from "@/hooks/useUpdater";
import UpdateModal from "@/ui-v2/_legacy/components/updater/UpdateModal";
import DashboardV2 from "./dashboard/DashboardV2";
import { TitleBarV2 } from "./components/TitleBarV2";
import ErrorBoundary from "./components/ErrorBoundary";
import FloatingBugButton from "@/ui-v2/_legacy/components/dashboard/FloatingBugButton";
import i18n from "@/i18n";

const MainMenu = lazy(() => import("@/ui-v2/_legacy/pages/MainMenu"));
const TeamSelectionV2 = lazy(() => import("@/ui-v2/pages/TeamSelectionV2"));
const MatchSimulation = lazy(() => import("@/ui-v2/_legacy/pages/MatchSimulation"));
const SettingsV2 = lazy(() => import("@/ui-v2/pages/SettingsV2"));

const SCALE_MAP: Record<string, string> = {
  xsmall: "9px",
  small: "14px",
  normal: "16px",
  large: "18px",
  xlarge: "20px",
};

const AUTO_CHECK_UPDATES = import.meta.env.PROD;

const DASHBOARD_TAB_ROUTES = [
  "/finanzas",
  "/finances",
  "/competiciones",
  "/competitions",
];

function LazyFallback() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const showBugButton = ["/dashboard", "/match", "/select-team", ...DASHBOARD_TAB_ROUTES].includes(location.pathname);

  return (
    <>
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/select-team" element={<TeamSelectionV2 />} />
          <Route path="/dashboard" element={<DashboardV2 />} />
          <Route path="/finanzas" element={<DashboardV2 />} />
          <Route path="/finances" element={<DashboardV2 />} />
          <Route path="/competiciones" element={<DashboardV2 />} />
          <Route path="/competitions" element={<DashboardV2 />} />
          <Route path="/match" element={<MatchSimulation />} />
          <Route path="/settings" element={<SettingsV2 />} />
        </Routes>
      </Suspense>
      {showBugButton && <FloatingBugButton />}
    </>
  );
}

export default function AppV2() {
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

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loaded) loadSettings();
    if (loaded) setReady(true);
  }, [loaded, loadSettings]);

  useEffect(() => {
    if (!ready) return;
    const size = SCALE_MAP[settings.ui_scale] || "16px";
    document.documentElement.style.fontSize = size;
  }, [settings.ui_scale, ready]);

  useEffect(() => {
    if (!ready) return;
    if (settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [ready, settings.language]);

  useEffect(() => {
    if (!ready) return;
    const isAndroid = /Android/i.test(window.navigator.userAgent);
    if (!isAndroid) return;

    let cancelled = false;

    const applyAndroidImmersive = async () => {
      if (cancelled) return;
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setFullscreen(true);
      } catch {}
      try {
        if (document.fullscreenElement == null && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
      try {
        if (screen.orientation?.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch {}
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
  }, [ready]);

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
    <div className="flex h-screen flex-col dark">
      <TitleBarV2 />
      <div className="flex min-h-0 flex-1 flex-col">
        <ErrorBoundary>
          <BrowserRouter>
            <AppContent />
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
          </BrowserRouter>
        </ErrorBoundary>
      </div>
    </div>
  );
}
