import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import DashboardV2 from "./dashboard/DashboardV2";
import { TitleBarV2 } from "./components/TitleBarV2";
import ErrorBoundary from "./components/ErrorBoundary";
import FloatingBugButton from "@/components/dashboard/FloatingBugButton";

const MainMenu = lazy(() => import("@/pages/MainMenu"));
const TeamSelectionV2 = lazy(() => import("@/pages/TeamSelectionV2"));
const MatchSimulation = lazy(() => import("@/pages/MatchSimulation"));
const SettingsV2 = lazy(() => import("@/pages/SettingsV2"));

function LazyFallback() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export default function AppV2() {
  return (
    <div className="flex h-screen flex-col dark">
      <TitleBarV2 />
      <div className="flex min-h-0 flex-1 flex-col">
        <ErrorBoundary>
          <BrowserRouter>
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
            <FloatingBugButton />
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  </div>
  );
}
