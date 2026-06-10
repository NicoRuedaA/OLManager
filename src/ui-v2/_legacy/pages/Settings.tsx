import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { useSettingsStore, AppSettings } from "@/store/settingsStore";
import { Select } from "@/ui-v2/_legacy/components/ui";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { setUIVersion, useUIVersion, type UIVersion } from "@/ui-v2/uiVersion";
import {
  ArrowLeft,
  Monitor,
  Moon,
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
} from "lucide-react";
import {
  autoImportDatabase,
  getCatalogSummary,
  type ImportSummary,
} from "@/lib/dataImport";
import { useUpdater } from "@/hooks/useUpdater";
import { APP_VERSION } from "@/lib/common/appInfo";
import { APP_NAME } from "@/lib/common/appInfo";

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
  const uiVersion = useUIVersion();
  const {
    updateAvailable,
    updateInfo,
    checking: checkingUpdate,
    check: checkUpdate,
  } = useUpdater(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("display");
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

  const handleBack = () => {
    navigate(returnTo);
  };

  if (!loaded) {
    return (
      <div className="h-full bg-background flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only the start-menu Settings button opts into the game-style tabbed view;
  // in-game, direct URL and refresh keep the classic scrolling layout.
  const isFromMenu =
    (location.state as { menuStyle?: boolean } | null)?.menuStyle === true;

  // ── Game-style tabbed settings (entered from the start menu) ──
  // Purpose-built components below; deliberately does NOT reuse the classic
  // Section/SettingRow/Toggle/SegmentedControl widgets.
  if (isFromMenu) {
    const gameSections: Array<{
      id: string;
      title: string;
      icon: React.ReactNode;
      content: React.ReactNode;
    }> = [
      {
        id: "display",
        title: t("settings.display"),
        icon: <Monitor className="w-5 h-5" />,
        content: (
          <>
            <GameRow
              label={t("settings.theme")}
              description={t("settings.themeDesc")}
            >
              <GameSegmented
                options={[
                  { value: "light" },
                  { value: "dark", icon: <Moon className="w-4 h-4" /> },
                  { value: "system", icon: <Monitor className="w-4 h-4" /> },
                ]}
                value={settings.theme}
                onChange={(v) =>
                  handleUpdate({ theme: v as AppSettings["theme"] })
                }
              />
            </GameRow>

            <GameRow
              label={t("settings.uiVersion", {
                defaultValue: "Versión de la interfaz",
              })}
              description={t("settings.uiVersionDesc", {
                defaultValue:
                  "Cambia entre la UI clásica (v1) y la nueva (v2). La aplicación se recarga automáticamente.",
              })}
            >
              <Select
                value={uiVersion}
                variant="glass"
                onChange={(e) => setUIVersion(e.target.value as UIVersion)}
                className="min-w-40"
              >
                <option value="v1">Clásica (v1)</option>
                <option value="v2">Nueva (v2)</option>
              </Select>
            </GameRow>

            <GameRow
              label={t("settings.language")}
              description={t("settings.languageDesc")}
            >
              <Select
                value={selectedLanguage}
                variant="glass"
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
            </GameRow>

            <GameRow
              label={t("settings.currency")}
              description={t("settings.currencyDesc")}
            >
              <Select
                value={settings.currency}
                variant="glass"
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
            </GameRow>

            <GameRow
              label={t("settings.uiScale", "UI Scale")}
              description={t(
                "settings.uiScaleDesc",
                "Adjust font size and spacing for readability",
              )}
            >
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground/70" />
                <GameSegmented
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
                  <span className="text-2xs font-heading uppercase tracking-wide text-muted-foreground/70">
                    {t(
                      "settings.uiScaleAndroidLocked",
                      "Bloqueado en XS en Android",
                    )}
                  </span>
                ) : null}
              </div>
            </GameRow>

            <GameRow
              label={t("settings.highContrast", "High Contrast")}
              description={t(
                "settings.highContrastDesc",
                "Boost text contrast in dark mode for improved readability",
              )}
            >
              <GameToggle
                checked={settings.high_contrast}
                onChange={(v) => handleUpdate({ high_contrast: v })}
              />
            </GameRow>

            <GameRow
              label={t("settings.fullscreen", "Fullscreen")}
              description={t(
                "settings.fullscreenDesc",
                "Toggle fullscreen mode for an immersive experience",
              )}
            >
              <GameButton onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
                {isFullscreen
                  ? t("settings.exitFullscreen", "Exit")
                  : t("settings.enterFullscreen", "Enter")}
              </GameButton>
            </GameRow>
          </>
        ),
      },
      {
        id: "gameplay",
        title: t("settings.gameplay"),
        icon: <Gamepad2 className="w-5 h-5" />,
        content: (
          <>
            <GameRow
              label={t("settings.defaultMatchMode")}
              description={t("settings.defaultMatchModeDesc")}
            >
              <Select
                value={settings.default_match_mode}
                variant="glass"
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
            </GameRow>

            <GameRow
              label={t("settings.matchSpeed")}
              description={t("settings.matchSpeedDesc")}
            >
              <GameSegmented
                options={MATCH_SPEED_KEYS.map((k) => ({
                  value: k,
                  label: t(`settings.speeds.${k}`),
                }))}
                value={settings.match_speed}
                onChange={(v) =>
                  handleUpdate({ match_speed: v as AppSettings["match_speed"] })
                }
              />
            </GameRow>

            <GameRow
              label={t("settings.matchCommentary")}
              description={t("settings.matchCommentaryDesc")}
            >
              <GameToggle
                checked={settings.show_match_commentary}
                onChange={(v) => handleUpdate({ show_match_commentary: v })}
              />
            </GameRow>

            <GameRow
              label={t("settings.confirmAdvance")}
              description={t("settings.confirmAdvanceDesc")}
            >
              <GameToggle
                checked={settings.confirm_advance}
                onChange={(v) => handleUpdate({ confirm_advance: v })}
              />
            </GameRow>

            <GameRow
              label={t("settings.debugTools", "Debug tools")}
              description={t(
                "settings.debugToolsDesc",
                "Enable internal tools like draft skip",
              )}
            >
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-muted-foreground/70" />
                <GameToggle
                  checked={settings.debug_tools_enabled}
                  onChange={(v) => handleUpdate({ debug_tools_enabled: v })}
                />
              </div>
            </GameRow>
          </>
        ),
      },
      {
        id: "saves",
        title: t("settings.savesData"),
        icon: <Save className="w-5 h-5" />,
        content: (
          <>
            <GameRow
              label={t("settings.autoSave")}
              description={t("settings.autoSaveDesc")}
            >
              <GameToggle
                checked={settings.auto_save}
                onChange={(v) => handleUpdate({ auto_save: v })}
              />
            </GameRow>

            <GameRow
              label={t("settings.exportWorld")}
              description={t("settings.exportWorldDesc")}
            >
              <GameButton tone="primary" onClick={handleExportWorld}>
                <Download className="w-4 h-4" />
                {t("settings.export")}
              </GameButton>
            </GameRow>
            {exportPath && (
              <p className="text-xs text-accent-400 py-2 ml-1">
                {t("settings.exportedTo", { path: exportPath })}
              </p>
            )}

            <div className="border-t border-border/40 pt-4 mt-2">
              <GameRow
                label={t("settings.clearSaves")}
                description={t("settings.clearSavesDesc")}
                danger
              >
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <GameButton tone="danger" onClick={handleClearSaves}>
                      {t("common.confirm")}
                    </GameButton>
                    <GameButton onClick={() => setConfirmClear(false)}>
                      {t("common.cancel")}
                    </GameButton>
                  </div>
                ) : clearSuccess ? (
                  <span className="text-sm text-accent-400 font-heading font-bold uppercase tracking-wider">
                    {t("settings.savesCleared")}
                  </span>
                ) : (
                  <GameButton tone="danger" onClick={() => setConfirmClear(true)}>
                    <Trash2 className="w-4 h-4" />
                    {t("settings.clear")}
                  </GameButton>
                )}
              </GameRow>
            </div>
          </>
        ),
      },
      {
        id: "updates",
        title: t("settings.updates"),
        icon: <RefreshCw className="w-5 h-5" />,
        content: (
          <>
            <GameRow
              label={t("settings.currentVersion")}
              description={t("settings.currentVersionDesc")}
            >
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-foreground/80">
                {updateInfo?.version ?? APP_VERSION}
              </span>
            </GameRow>

            <GameRow
              label={t("settings.checkForUpdates")}
              description={t("settings.checkForUpdatesDesc")}
            >
              <GameButton
                tone="primary"
                disabled={checkingUpdate}
                onClick={checkUpdate}
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
              </GameButton>
            </GameRow>

            {updateAvailable && updateInfo && (
              <div className="rounded-lg bg-accent-400/10 border border-accent-400/30 p-3">
                <p className="text-xs text-accent-400 font-medium">
                  {t("settings.updateAvailableDetail", {
                    version: updateInfo.version,
                  })}
                </p>
              </div>
            )}

            {showUpToDate && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                <p className="text-xs text-green-400 font-medium">
                  {t("settings.upToDate")}
                </p>
              </div>
            )}
          </>
        ),
      },
      {
        id: "data",
        title: t("settings.data", { defaultValue: "Datos" }),
        icon: <Database className="w-5 h-5" />,
        content: <ImportDataSection />,
      },
      {
        id: "about",
        title: t("settings.about"),
        icon: <Zap className="w-5 h-5" />,
        content: (
          <div className="flex justify-between items-center py-4">
            <div>
              <p className="text-sm font-medium text-foreground">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">{APP_VERSION}</p>
            </div>
            <span className="text-2xs font-heading uppercase tracking-widest text-muted-foreground">
              Open League Manager Community
            </span>
          </div>
        ),
      },
    ];

    const active =
      gameSections.find((s) => s.id === activeSettingsTab) ?? gameSections[0];

    return (
      <div className="dark h-full bg-background text-foreground">
        <div className="h-full flex flex-col px-6 sm:px-10 lg:px-16 py-8 overflow-y-auto scrollbar-v2">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-heading font-bold uppercase tracking-wider text-foreground drop-shadow">
              {t("settings.title")}
            </h1>
          </div>

          {/* Section tabs */}
          <nav className="flex flex-wrap gap-1 border-b border-border/40 mb-6"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const idx = gameSections.findIndex((s) => s.id === active.id);
                const next = (idx + dir + gameSections.length) % gameSections.length;
                setActiveSettingsTab(gameSections[next].id);
              }
            }}
          >
            {gameSections.map((s) => (
              <GameTab
                key={s.id}
                icon={s.icon}
                label={s.title}
                active={s.id === active.id}
                onClick={() => setActiveSettingsTab(s.id)}
              />
            ))}
          </nav>

          {/* Active section — no container box; rows separated by hairlines */}
          <div className="flex-1 overflow-y-auto">
            <div
              key={active.id}
              className="animate-fade-in-up max-w-3xl border-t border-border/40"
            >
              {active.content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sections: Array<{
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
  }> = [
    {
      id: "display",
      title: t("settings.display"),
      icon: <Monitor className="w-5 h-5" />,
      content: (
        <>
          <SettingRow
            label={t("settings.theme")}
            description={t("settings.themeDesc")}
          >
            <SegmentedControl
              options={[
                { value: "light", icon: <span className="w-4 h-4 text-center leading-none text-xs font-bold" aria-hidden="true">☀</span> },
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
              <Type className="w-4 h-4 text-muted-foreground/70" />
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
                <span className="text-2xs font-heading uppercase tracking-wide text-muted-foreground/70">
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground/80 hover:bg-muted/80 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
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
        </>
      ),
    },
    {
      id: "gameplay",
      title: t("settings.gameplay"),
      icon: <Gamepad2 className="w-5 h-5" />,
      content: (
        <>
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
              "Enable internal tools like draft skip",
            )}
          >
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-muted-foreground/70" />
              <Toggle
                checked={settings.debug_tools_enabled}
                onChange={(v) => handleUpdate({ debug_tools_enabled: v })}
              />
            </div>
          </SettingRow>
        </>
      ),
    },
    {
      id: "saves",
      title: t("settings.savesData"),
      icon: <Save className="w-5 h-5" />,
      content: (
        <>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors"
            >
              <Download className="w-4 h-4" />
              {t("settings.export")}
            </button>
          </SettingRow>
          {exportPath && (
            <p className="text-xs text-primary -mt-2 ml-1">
              {t("settings.exportedTo", { path: exportPath })}
            </p>
          )}

          <div className="border-t border-border pt-4 mt-2">
            <SettingRow
              label={t("settings.clearSaves")}
              description={t("settings.clearSavesDesc")}
              danger
            >
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearSaves}
                    className="px-4 py-2 rounded-lg bg-red-500 text-foreground text-sm font-heading font-bold uppercase tracking-wider hover:bg-red-600 transition-colors"
                  >
                    {t("common.confirm")}
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-4 py-2 rounded-lg bg-muted text-foreground/80 text-sm font-heading font-bold uppercase tracking-wider hover:bg-muted hover:bg-muted/80 transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : clearSuccess ? (
                <span className="text-sm text-primary font-heading font-bold uppercase tracking-wider">
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
        </>
      ),
    },
    {
      id: "updates",
      title: t("settings.updates"),
      icon: <RefreshCw className="w-5 h-5" />,
      content: (
        <>
          <SettingRow
            label={t("settings.currentVersion")}
            description={t("settings.currentVersionDesc")}
          >
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
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
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-primary font-medium">
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
        </>
      ),
    },
    {
      id: "data",
      title: t("settings.data", { defaultValue: "Datos" }),
      icon: <Database className="w-5 h-5" />,
      content: <ImportDataSection />,
    },
    {
      id: "about",
      title: t("settings.about"),
      icon: <Zap className="w-5 h-5" />,
      content: (
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-foreground">
              {APP_NAME}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {APP_VERSION}
            </p>
          </div>
          <span className="text-2xs font-heading uppercase tracking-widest text-muted-foreground/70 text-muted-foreground/70">
            Open League Manager Community
          </span>
        </div>
      ),
    },
  ];

  // ── Classic scrolling settings (entered from inside a game) ──
  return (
    <div className="h-full bg-background transition-colors duration-300">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg text-muted-foreground/70 hover:text-foreground/90 hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-heading font-bold uppercase tracking-wide text-foreground">
              {t("settings.title")}
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
        {sections.map((s) => (
          <Section key={s.id} title={s.title} icon={s.icon}>
            {s.content}
          </Section>
        ))}
      </div>
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
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 border-border">
        <span className="text-primary">{icon}</span>
        <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-foreground">
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
          className={`text-sm font-medium ${danger ? "text-red-500" : "text-foreground"}`}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
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
        checked ? "bg-primary-500" : "bg-muted"
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
    <div className="flex rounded-lg bg-muted p-0.5 border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-heading font-bold uppercase tracking-wider transition-all ${
            value === opt.value
              ? "bg-white bg-muted text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground/90 hover:text-foreground/80"
          }`}
        >
          {opt.icon}
          {opt.label || opt.value}
        </button>
      ))}
    </div>
  );
}

// ── Game-style components (start-menu settings only) ──

function GameTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-4 py-3 font-heading font-bold text-sm uppercase tracking-wider transition-colors ${
        active ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground/90"
      }`}
    >
      <span
        className={
          active
            ? "text-accent-400"
            : "text-muted-foreground group-hover:text-foreground/80"
        }
      >
        {icon}
      </span>
      {label}
      <span
        className={`absolute left-0 -bottom-px h-0.5 w-full rounded-full bg-accent-400 transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </button>
  );
}

function GameRow({
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
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border/40 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-heading font-bold uppercase tracking-wider ${
            danger ? "text-red-400" : "text-foreground"
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1 normal-case">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function GameSegmented({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label?: string; icon?: React.ReactNode }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-heading font-bold uppercase tracking-wider transition-all ${
            value === opt.value
              ? "border-accent-400 text-accent-400 bg-accent-400/10"
              : "border-border text-foreground/80 hover:border-white/35 hover:text-foreground"
          }`}
        >
          {opt.icon}
          {opt.label || opt.value}
        </button>
      ))}
    </div>
  );
}

function GameToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full border transition-colors duration-200 ${
        checked
          ? "bg-accent-400/20 border-accent-400"
          : "bg-muted/30 border-border"
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-transform duration-200 ${
          checked
            ? "translate-x-[22px] bg-accent-400"
            : "translate-x-0.5 bg-muted"
        }`}
      />
    </button>
  );
}

function GameButton({
  onClick,
  children,
  tone = "neutral",
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "danger";
  disabled?: boolean;
}) {
  const tones = {
    neutral:
      "border-border text-foreground hover:border-white/40 hover:bg-muted/30",
    primary:
      "border-accent-400/50 text-accent-400 hover:border-accent-400 hover:bg-accent-400/10",
    danger:
      "border-red-500/50 text-red-400 hover:border-red-500 hover:bg-red-500/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border bg-transparent text-sm font-heading font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

// ── Datos: OLMDBManager auto-import (Tauri-native) ──

function ImportDataSection() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string; status: string } | null>(null);

  // Listen for import progress events from Tauri backend
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let cancelled = false;
    listen<{ current: number; total: number; phase: string; status: string }>(
      "import-progress",
      (event) => {
        if (!cancelled) setProgress(event.payload);
      },
    ).then((fn) => { unlistenFn = fn; });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  // Warn when closing the window during import
  useEffect(() => {
    if (status !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // Warn on browser back/forward during import
  useEffect(() => {
    if (status !== "running") return;
    const handler = () => {
      if (!window.confirm(t("settings.importWarningDesc", {
        defaultValue: "Hay una importación en curso. Si sales se cancelará. ¿Estás seguro?",
      }))) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    window.addEventListener("popstate", handler);
    // Push an extra state so back can be intercepted
    window.history.pushState(null, "", window.location.href);
    return () => {
      window.removeEventListener("popstate", handler);
    };
  }, [status, t]);

  // Warn when closing the window during import
  useEffect(() => {
    let cancelled = false;
    getCatalogSummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAutoImport() {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setStatus("running");
    try {
      const imported = await autoImportDatabase();
      setResult(imported);
      setSummary(imported);
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  const isError = status === "error";
  const isSuccess = status === "success";
  const progressPct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 py-4">

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("settings.autoImport", { defaultValue: "Autoimportar BD" })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("settings.autoImportDesc", {
              defaultValue:
                "Descarga la base de datos pública de OLMDBManager (equipos, jugadores, staff e imágenes) y actualiza los datos del juego.",
            })}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleAutoImport}
          className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-heading font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
        >
          {busy ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Database className="w-4 h-4" />
          )}
          {busy
            ? t("settings.importing", { defaultValue: "Importando…" })
            : t("settings.import", { defaultValue: "Importar" })}
        </button>
      </div>

      {status !== "idle" && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            isError
              ? "border-red-500/30 bg-red-500/10 text-red-500"
              : isSuccess
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                : "border-primary/20 bg-primary/5 text-primary"
          }`}
        >
          {busy && (
            <>
              <p className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                {progress?.status ?? t("settings.importRunning", {
                  defaultValue: "Descargando y descomprimiendo datos desde OLMDBManager…",
                })}
              </p>
              {progress && progress.total > 0 && (
                <div className="mt-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/15 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground/60">
                    {progress.phase === "download"
                      ? (progress.current === 0 ? "Descargando..." : "Descarga completa")
                      : `${progress.current}/${progress.total}`}
                  </p>
                </div>
              )}
            </>
          )}
          {error && <p>{error}</p>}
          {result && isSuccess && (
            <p>
              {t("settings.importDone", {
                defaultValue:
                  "{{players}} jugadores, {{teams}} equipos y {{staff}} staff importados. Imágenes: {{photos}}.",
                players: result.player_count,
                teams: result.team_count,
                staff: result.staff_count,
                photos: result.photo_files,
              })}
            </p>
          )}
        </div>
      )}

      {summary && (summary.player_count > 0 || summary.team_count > 0) && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <ImportStat label={t("settings.players", { defaultValue: "Jugadores" })} value={summary.player_count} />
          <ImportStat label={t("settings.teams", { defaultValue: "Equipos" })} value={summary.team_count} />
          <ImportStat label={t("settings.staff", { defaultValue: "Staff" })} value={summary.staff_count} />
        </div>
      )}
    </div>
  );
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-heading font-bold text-foreground">{value}</p>
      <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

