import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useSettingsStore, AppSettings } from "../store/settingsStore";
import { useTheme } from "../context/ThemeContext";
import { ThemeToggle, Select } from "../components/ui";
import { SUPPORTED_LANGUAGES } from "../i18n";
import { setUIVersion, useUIVersion, type UIVersion } from "../ui-v2/uiVersion";
import {
  ArrowLeft,
  Monitor,
  Moon,
  Sun,
  Gamepad2,
  Save,
  Zap,
  Trash2,
  Download,
  Globe,
  Bug,
  Type,
  Maximize,
  Minimize,
  RefreshCw,
  CheckCircle2,
  Database,
  Upload,
  Search,
  UsersRound,
  Building2,
  UserCog,
} from "lucide-react";
import {
  autoImportDatabase,
  getCatalog,
  getCatalogSummary,
  importExportZip,
  type CatalogResponse,
  type ImportSummary,
} from "../web/importData";
import { useUpdater } from "../hooks/useUpdater";
import { APP_VERSION } from "../lib/appInfo";
import { APP_NAME } from "../lib/appInfo";

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro (€)", symbol: "€" },
  { value: "GBP", label: "Pound (£)", symbol: "£" },
  { value: "USD", label: "Dollar ($)", symbol: "$" },
] as const;

const MATCH_MODE_KEYS = ["live", "spectator"] as const;
const MATCH_SPEED_KEYS = ["slow", "normal", "fast"] as const;

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { settings, loaded, loadSettings, updateSettings } = useSettingsStore();
  const { theme, toggleTheme } = useTheme();
  const uiVersion = useUIVersion();
  const {
    updateAvailable,
    updateInfo,
    checking: checkingUpdate,
    check: checkUpdate,
  } = useUpdater(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement,
  );
  const [showUpToDate, setShowUpToDate] = useState(false);
  const prevChecking = useRef(checkingUpdate);
  const selectedLanguage = SUPPORTED_LANGUAGES.some(
    (lang) => lang.code === settings.language,
  )
    ? settings.language
    : "es";
  const isAndroid = /Android/i.test(navigator.userAgent);

  // Where to go back to
  const returnTo = (location.state as { from?: string })?.from || "/";

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  // Sync language with i18n when settings are loaded
  useEffect(() => {
    if (loaded && selectedLanguage && selectedLanguage !== i18n.language) {
      i18n.changeLanguage(selectedLanguage);
    }
  }, [loaded, selectedLanguage, i18n]);

  // Show "up to date" feedback when a manual check completes with no update
  useEffect(() => {
    if (prevChecking.current && !checkingUpdate && !updateAvailable) {
      setShowUpToDate(true);
      const timer = setTimeout(() => setShowUpToDate(false), 3000);
      return () => clearTimeout(timer);
    }
    prevChecking.current = checkingUpdate;
  }, [checkingUpdate, updateAvailable]);

  const handleUpdate = (partial: Partial<AppSettings>) => {
    updateSettings(partial);

    // Sync theme with ThemeContext
    if (partial.theme) {
      const desired =
        partial.theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : partial.theme;
      if (desired !== theme) toggleTheme();
    }

    // Sync language with i18n
    if (partial.language) {
      i18n.changeLanguage(partial.language);
    }
  };

  const handleClearSaves = async () => {
    try {
      await invoke("clear_all_saves");
      setClearSuccess(true);
      setConfirmClear(false);
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to clear saves:", err);
    }
  };

  const handleExportWorld = async () => {
    try {
      // Simple export to app data dir
      const path = await invoke<string>("export_world_database", {
        exportPath: "exported_world.json",
      });
      setExportPath(path);
      setTimeout(() => setExportPath(null), 5000);
    } catch (err) {
      console.error("Failed to export world:", err);
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-navy-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(returnTo)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-heading font-bold uppercase tracking-wide text-gray-900 dark:text-white">
              {t("settings.title")}
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ─── Display ─── */}
        <Section
          title={t("settings.display")}
          icon={<Monitor className="w-5 h-5" />}
        >
          <SettingRow
            label={t("settings.theme")}
            description={t("settings.themeDesc")}
          >
            <SegmentedControl
              options={[
                { value: "light", icon: <Sun className="w-4 h-4" /> },
                { value: "dark", icon: <Moon className="w-4 h-4" /> },
                { value: "system", icon: <Monitor className="w-4 h-4" /> },
              ]}
              value={settings.theme}
              onChange={(v) =>
                handleUpdate({ theme: v as AppSettings["theme"] })
              }
            />
          </SettingRow>

          <SettingRow
            label={t("settings.uiVersion", { defaultValue: "Versión de la interfaz" })}
            description={t("settings.uiVersionDesc", {
              defaultValue: "Cambia entre la UI clásica (v1) y la nueva (v2). La aplicación se recarga automáticamente.",
            })}
          >
            <Select
              value={uiVersion}
              onChange={(e) => setUIVersion(e.target.value as UIVersion)}
              className="min-w-40"
            >
              <option value="v1">Clásica (v1)</option>
              <option value="v2">Nueva (v2)</option>
            </Select>
          </SettingRow>

          <SettingRow
            label={t("settings.language")}
            description={t("settings.languageDesc")}
          >
            <Select
              value={selectedLanguage}
              onChange={(e) => handleUpdate({ language: e.target.value })}
              icon={<Globe className="w-4 h-4" />}
              className="min-w-48"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow
            label={t("settings.currency")}
            description={t("settings.currencyDesc")}
          >
            <Select
              value={settings.currency}
              onChange={(e) =>
                handleUpdate({
                  currency: e.target.value as AppSettings["currency"],
                })
              }
              className="min-w-48"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.symbol} {c.label}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow
            label={t("settings.uiScale", "UI Scale")}
            description={t(
              "settings.uiScaleDesc",
              "Adjust font size and spacing for readability",
            )}
          >
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-gray-400" />
              <SegmentedControl
                options={[
                  { value: "xsmall", label: "XS" },
                  { value: "small", label: "S" },
                  { value: "normal", label: "M" },
                  { value: "large", label: "L" },
                  { value: "xlarge", label: "XL" },
                ]}
                value={settings.ui_scale}
                onChange={(v) => {
                  if (isAndroid) return;
                  handleUpdate({ ui_scale: v as AppSettings["ui_scale"] });
                }}
              />
              {isAndroid ? (
                <span className="text-2xs font-heading uppercase tracking-wide text-gray-400">
                  {t("settings.uiScaleAndroidLocked", "Bloqueado en XS en Android")}
                </span>
              ) : null}
            </div>
          </SettingRow>

          <SettingRow
            label={t("settings.highContrast", "High Contrast")}
            description={t(
              "settings.highContrastDesc",
              "Boost text contrast in dark mode for improved readability",
            )}
          >
            <Toggle
              checked={settings.high_contrast}
              onChange={(v) => handleUpdate({ high_contrast: v })}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.fullscreen", "Fullscreen")}
            description={t(
              "settings.fullscreenDesc",
              "Toggle fullscreen mode for an immersive experience",
            )}
          >
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-600 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
              {isFullscreen
                ? t("settings.exitFullscreen", "Exit")
                : t("settings.enterFullscreen", "Enter")}
            </button>
          </SettingRow>
        </Section>

        {/* ─── Gameplay ─── */}
        <Section
          title={t("settings.gameplay")}
          icon={<Gamepad2 className="w-5 h-5" />}
        >
          <SettingRow
            label={t("settings.defaultMatchMode")}
            description={t("settings.defaultMatchModeDesc")}
          >
            <Select
              value={settings.default_match_mode}
              onChange={(e) =>
                handleUpdate({
                  default_match_mode: e.target
                    .value as AppSettings["default_match_mode"],
                })
              }
              className="min-w-48"
            >
              {MATCH_MODE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(`settings.matchModes.${k}`)}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow
            label={t("settings.matchSpeed")}
            description={t("settings.matchSpeedDesc")}
          >
            <SegmentedControl
              options={MATCH_SPEED_KEYS.map((k) => ({
                value: k,
                label: t(`settings.speeds.${k}`),
              }))}
              value={settings.match_speed}
              onChange={(v) =>
                handleUpdate({ match_speed: v as AppSettings["match_speed"] })
              }
            />
          </SettingRow>

          <SettingRow
            label={t("settings.matchCommentary")}
            description={t("settings.matchCommentaryDesc")}
          >
            <Toggle
              checked={settings.show_match_commentary}
              onChange={(v) => handleUpdate({ show_match_commentary: v })}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.confirmAdvance")}
            description={t("settings.confirmAdvanceDesc")}
          >
            <Toggle
              checked={settings.confirm_advance}
              onChange={(v) => handleUpdate({ confirm_advance: v })}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.debugTools", "Debug tools")}
            description={t(
              "settings.debugToolsDesc",
              "Enable internal tools like draft skip and World Editor",
            )}
          >
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-gray-400" />
              <Toggle
                checked={settings.debug_tools_enabled}
                onChange={(v) => handleUpdate({ debug_tools_enabled: v })}
              />
            </div>
          </SettingRow>
        </Section>

        {/* ─── Saves & Data ─── */}
        <Section
          title={t("settings.savesData")}
          icon={<Save className="w-5 h-5" />}
        >
          <SettingRow
            label={t("settings.autoSave")}
            description={t("settings.autoSaveDesc")}
          >
            <Toggle
              checked={settings.auto_save}
              onChange={(v) => handleUpdate({ auto_save: v })}
            />
          </SettingRow>

          <SettingRow
            label={t("settings.exportWorld")}
            description={t("settings.exportWorldDesc")}
          >
            <button
              onClick={handleExportWorld}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
            >
              <Download className="w-4 h-4" />
              {t("settings.export")}
            </button>
          </SettingRow>
          {exportPath && (
            <p className="text-xs text-primary-500 -mt-2 ml-1">
              {t("settings.exportedTo", { path: exportPath })}
            </p>
          )}

          <div className="border-t border-gray-200 dark:border-navy-600 pt-4 mt-2">
            <SettingRow
              label={t("settings.clearSaves")}
              description={t("settings.clearSavesDesc")}
              danger
            >
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearSaves}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-heading font-bold uppercase tracking-wider hover:bg-red-600 transition-colors"
                  >
                    {t("common.confirm")}
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-navy-600 text-gray-700 dark:text-gray-300 text-sm font-heading font-bold uppercase tracking-wider hover:bg-gray-300 dark:hover:bg-navy-500 transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : clearSuccess ? (
                <span className="text-sm text-primary-500 font-heading font-bold uppercase tracking-wider">
                  {t("settings.savesCleared")}
                </span>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("settings.clear")}
                </button>
              )}
            </SettingRow>
          </div>
        </Section>

        {/* ─── Updates ─── */}
        <Section
          title={t("settings.updates")}
          icon={<RefreshCw className="w-5 h-5" />}
        >
          <SettingRow
            label={t("settings.currentVersion")}
            description={t("settings.currentVersionDesc")}
          >
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {updateInfo?.version ?? APP_VERSION}
            </span>
          </SettingRow>

          <SettingRow
            label={t("settings.checkForUpdates")}
            description={t("settings.checkForUpdatesDesc")}
          >
            <button
              onClick={checkUpdate}
              disabled={checkingUpdate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {checkingUpdate ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : updateAvailable ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {checkingUpdate
                ? t("settings.checking")
                : updateAvailable
                  ? t("settings.updateAvailable")
                  : t("settings.checkNow")}
            </button>
          </SettingRow>

          {updateAvailable && updateInfo && (
            <div className="rounded-lg bg-primary-500/5 border border-primary-500/20 p-3">
              <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                {t("settings.updateAvailableDetail", {
                  version: updateInfo.version,
                })}
              </p>
            </div>
          )}

          {showUpToDate && (
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                {t("settings.upToDate")}
              </p>
            </div>
          )}
        </Section>

        {/* ─── About ─── */}
        {import.meta.env.MODE === "web" && (
          <Section
            title={t("settings.data", { defaultValue: "Datos" })}
            icon={<Database className="w-5 h-5" />}
          >
            <ImportDataSection />
          </Section>
        )}

        <Section title={t("settings.about")} icon={<Zap className="w-5 h-5" />}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {APP_NAME}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {APP_VERSION}
              </p>
            </div>
            <span className="text-2xs font-heading uppercase tracking-widest text-gray-400 dark:text-gray-600">
              Open League Manager Community
            </span>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Import data (web only) ──

function ImportDataSection() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [catalog, setCatalog] = useState<ImportSummary | null>(null);
  const [catalogData, setCatalogData] = useState<CatalogResponse | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogTab, setCatalogTab] = useState<"players" | "teams" | "staff">("players");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");

  async function refreshCatalog() {
    setCatalogBusy(true);
    try {
      const nextCatalog = await getCatalog();
      setCatalogData(nextCatalog);
      setCatalog(nextCatalog.summary);
    } finally {
      setCatalogBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((nextCatalog) => {
        if (!cancelled) {
          setCatalogData(nextCatalog);
          setCatalog(nextCatalog.summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          getCatalogSummary()
            .then((summary) => {
              if (!cancelled) setCatalog(summary);
            })
            .catch(() => {
              if (!cancelled) setCatalog(null);
            });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAutoImport() {
    setAutoBusy(true);
    setError(null);
    setResult(null);
    setStatus("running");
    try {
      const summary = await autoImportDatabase();
      setResult(summary);
      setCatalog(summary);
      await refreshCatalog();
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    } finally {
      setAutoBusy(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus("running");
    try {
      const summary = await importExportZip(file);
      setResult(summary);
      setCatalog(summary);
      await refreshCatalog();
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SettingRow
        label="Autoimportar BD"
        description="Descarga la exportación pública de OLMDBManager configurada en OLM_IMPORT_SOURCE y actualiza datos e imágenes."
      >
        <button
          type="button"
          disabled={autoBusy}
          onClick={handleAutoImport}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {autoBusy ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Database className="w-4 h-4" />
          )}
          {autoBusy ? "Autoimportando..." : "Autoimportar"}
        </button>
      </SettingRow>

      {(autoBusy || busy || status !== "idle") && (
        <ImportStatusPanel
          status={status}
          busy={autoBusy || busy}
          result={result}
          error={error}
        />
      )}

      {catalog && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-navy-600 dark:bg-navy-900/40">
          <ImportStat label="Jugadores" value={catalog.player_count} />
          <ImportStat label="Equipos" value={catalog.team_count} />
          <ImportStat label="Staff" value={catalog.staff_count} />
        </div>
      )}

      <SettingRow
        label="Import manual de respaldo (.zip)"
        description="Usa este zip solo si necesitas forzar una importación puntual sin descargar desde OLMDBManager."
      >
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-gray-200 dark:border-navy-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors">
            {file ? file.name : "Elegir .zip"}
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
            />
          </label>
          <button
            type="button"
            disabled={!file || busy}
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {busy ? "Importando…" : "Importar"}
          </button>
        </div>
      </SettingRow>

      {catalogData && (
        <CatalogPreview
          catalog={catalogData}
          busy={catalogBusy}
          tab={catalogTab}
          search={catalogSearch}
          onTabChange={setCatalogTab}
          onSearchChange={setCatalogSearch}
        />
      )}
    </div>
  );
}

function ImportStatusPanel({
  status,
  busy,
  result,
  error,
}: {
  status: "idle" | "running" | "success" | "error";
  busy: boolean;
  result: ImportSummary | null;
  error: string | null;
}) {
  const isError = status === "error";
  const isSuccess = status === "success";
  return (
    <div
      className={`overflow-hidden rounded-lg border p-3 text-xs ${
        isError
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          : isSuccess
            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300"
            : "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-bold uppercase tracking-wider">
          {isError ? "Importación fallida" : isSuccess ? "Importación completada" : "Importando BD"}
        </p>
        {isSuccess && <CheckCircle2 className="h-4 w-4" />}
        {busy && <RefreshCw className="h-4 w-4 animate-spin" />}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        {busy && (
          <style>
            {`@keyframes olm-import-progress { 0% { transform: translateX(-130%); } 100% { transform: translateX(330%); } }`}
          </style>
        )}
        <div
          className={`h-full rounded-full ${
            busy ? "w-1/3 bg-primary-500" : "w-full"
          } ${isError ? "bg-red-500" : isSuccess ? "bg-green-500" : ""}`}
          style={busy ? { animation: "olm-import-progress 1.15s ease-in-out infinite" } : undefined}
        />
      </div>
      {busy && <p className="mt-2">Descargando y descomprimiendo datos desde OLMDBManager...</p>}
      {error && <p className="mt-2">{error}</p>}
      {result && isSuccess && (
        <p className="mt-2">
          {result.player_count} jugadores, {result.team_count} equipos y{" "}
          {result.staff_count} staff importados. Imágenes copiadas: {result.photo_files}.
          {result.skipped > 0 ? ` Ignorados: ${result.skipped}.` : ""}
        </p>
      )}
    </div>
  );
}

function CatalogPreview({
  catalog,
  busy,
  tab,
  search,
  onTabChange,
  onSearchChange,
}: {
  catalog: CatalogResponse;
  busy: boolean;
  tab: "players" | "teams" | "staff";
  search: string;
  onTabChange: (tab: "players" | "teams" | "staff") => void;
  onSearchChange: (search: string) => void;
}) {
  const teamNames = useMemo(() => {
    return new Map(catalog.teams.map((team) => [team.id, team.name]));
  }, [catalog.teams]);
  const query = search.trim().toLowerCase();
  const entries = useMemo(() => {
    const source = catalog[tab];
    if (!query) return source;
    return source.filter((item) =>
      Object.values(item).some((value) =>
        String(value ?? "").toLowerCase().includes(query),
      ),
    );
  }, [catalog, query, tab]);
  const visible = entries.slice(0, 80);

  const tabs = [
    { id: "players" as const, label: "Jugadores", count: catalog.players.length, icon: UsersRound },
    { id: "teams" as const, label: "Equipos", count: catalog.teams.length, icon: Building2 },
    { id: "staff" as const, label: "Staff", count: catalog.staff.length, icon: UserCog },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-navy-600 dark:bg-navy-900/30">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3 dark:border-navy-700">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-colors ${
                active
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-navy-700 dark:text-gray-300 dark:hover:bg-navy-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              <span className="tabular-nums">{item.count}</span>
            </button>
          );
        })}
        <div className="relative ml-auto min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar en catálogo"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-100"
          />
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto p-3">
        {busy ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando catálogo...</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay resultados.</p>
        ) : (
          <div className="space-y-1.5">
            {visible.map((item, index) => (
              <CatalogRow
                key={`${tab}-${item.id}-${index}`}
                item={item}
                tab={tab}
                teamName={"team_id" in item && item.team_id ? teamNames.get(item.team_id) : null}
              />
            ))}
          </div>
        )}
        {entries.length > visible.length && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Mostrando {visible.length} de {entries.length}. Usa la búsqueda para afinar.
          </p>
        )}
      </div>
    </div>
  );
}

function CatalogRow({
  item,
  tab,
  teamName,
}: {
  item: CatalogResponse["players"][number] | CatalogResponse["teams"][number] | CatalogResponse["staff"][number];
  tab: "players" | "teams" | "staff";
  teamName: string | null | undefined;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = "image_url" in item ? item.image_url : item.logo_url;
  const subtitle = (() => {
    if (tab === "teams") {
      const team = item as CatalogResponse["teams"][number];
      return [team.short_name, team.country, team.competition_id].filter(Boolean).join(" · ");
    }
    const person = item as CatalogResponse["players"][number] | CatalogResponse["staff"][number];
    return [person.role, person.nationality, teamName].filter(Boolean).join(" · ");
  })();
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-navy-800">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-200 dark:bg-navy-700">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Database className="h-4 w-4 text-gray-400" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{item.name}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle || item.id}</p>
      </div>
    </div>
  );
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-heading text-lg font-bold tabular-nums text-gray-900 dark:text-white">
        {value.toLocaleString("es-ES")}
      </p>
      <p className="text-2xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}

// ── Reusable sub-components ──

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 dark:border-navy-700">
        <span className="text-primary-500">{icon}</span>
        <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
          {title}
        </h2>
      </div>
      <div className="px-6 py-4 flex flex-col gap-5">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  danger,
  children,
}: {
  label: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${danger ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}
        >
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {description}
        </p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? "bg-primary-500" : "bg-gray-300 dark:bg-navy-600"
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label?: string; icon?: React.ReactNode }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg bg-gray-100 dark:bg-navy-700 p-0.5 border border-gray-200 dark:border-navy-600">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-heading font-bold uppercase tracking-wider transition-all ${
            value === opt.value
              ? "bg-white dark:bg-navy-500 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {opt.icon}
          {opt.label || opt.value}
        </button>
      ))}
    </div>
  );
}
