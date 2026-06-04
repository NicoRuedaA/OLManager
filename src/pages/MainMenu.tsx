import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { useSettingsStore } from "../store/settingsStore";
import { Button, ThemeToggle, DatePicker, CountryFlag } from "../components/ui";
import SavesList from "../components/menu/SavesList";
import MenuBackground from "../components/menu/MenuBackground";
import CommunityPanel from "../components/menu/CommunityPanel";
import PatchNotesPanel from "../components/menu/PatchNotesPanel";
import {
  FolderOpen,
  Settings,
  X,
  PlusCircle,
  ChevronRight,
  AlertCircle,
  ChevronDown,
  Check,
  Power,
  Database,
  Users,
  Newspaper,
} from "lucide-react";
import { countryName, allNationalities } from "../lib/countries";

const canUseTauriInvoke = () => {
  if (import.meta.env.MODE === "test") return true;
  if (import.meta.env.MODE === "web") return true;
  if (typeof window === "undefined") return false;
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: unknown } })
    .__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function";
};

interface SaveEntry {
  id: string;
  name: string;
  manager_name: string;
  db_filename: string;
  checksum: string;
  created_at: string;
  last_played_at: string;
}

function normaliseSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function flooredAgeFromIsoDate(isoDob: string): number | null {
  if (!isoDob) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDob);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() > month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return Number.isNaN(age) ? null : age;
}

const CREATE_MANAGER_FIELD_ORDER = [
  "nickname",
  "firstName",
  "lastName",
  "dob",
  "nationality",
] as const;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function focusFirstCreateManagerError(errors: Record<string, string>): void {
  const first = CREATE_MANAGER_FIELD_ORDER.find((k) => errors[k]);
  if (!first) return;
  const root = document.getElementById(`create-manager-field-${first}`);
  root?.scrollIntoView?.({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
  const focusable = root?.querySelector<HTMLElement>(
    "input:not([type=hidden]), button:not([disabled]), select, textarea",
  );
  focusable?.focus({ preventScroll: true });
}

function logNationalityDebug(
  message: string,
  details?: Record<string, unknown>,
): void {
  console.debug("[MainMenu nationality]", {
    message,
    ...(details ?? {}),
  });
}

export default function MainMenu() {
  const navigate = useNavigate();
  const setGameActive = useGameStore((state) => state.setGameActive);
  const debugToolsEnabled = useSettingsStore(
    (state) => state.settings.debug_tools_enabled,
  );
  const { t, i18n } = useTranslation();

  const [menuState, setMenuState] = useState<
    "main" | "create" | "load" | "community" | "patchnotes"
  >("main");
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [loadingSaveId, setLoadingSaveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const [formData, setFormData] = useState({
    nickname: "",
    firstName: "",
    lastName: "",
    dob: "",
    nationality: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const nationalityRef = useRef<HTMLDivElement>(null);

  const countriesList = allNationalities(i18n.language);
  const normalisedNationalitySearch = normaliseSearchText(nationalitySearch);

  /** Same messages as `validateForm` for DOB so feedback surfaces while typing. */
  const dobLiveRuleMessage = (() => {
    if (!formData.dob) return null;
    const age = flooredAgeFromIsoDate(formData.dob);
    if (age === null) return t("validation.invalidDate");
    if (age > 99) return t("validation.invalidDob");
    return null;
  })();
  const dobDisplayedError = formErrors.dob || dobLiveRuleMessage;

  const filteredNationalities = countriesList.filter((nationality) => {
    const normalisedName = normaliseSearchText(nationality.name);
    const normalisedCode = normaliseSearchText(nationality.code);

    return (
      normalisedName.includes(normalisedNationalitySearch) ||
      normalisedCode.includes(normalisedNationalitySearch)
    );
  });

  const toggleNationalityDropdown = () => {
    setNationalityOpen((open) => {
      const nextOpen = !open;
      logNationalityDebug("toggle button", { nextOpen });
      return nextOpen;
    });
    setNationalitySearch("");
  };

  const validateForm = (): {
    ok: boolean;
    errors: Record<string, string>;
  } => {
    const errors: Record<string, string> = {};
    if (formData.nickname.trim().length > 20) {
      errors.nickname = t("validation.maxLength", {
        field: t("createManager.nickname", "Nick"),
        max: 20,
      });
    }

    if (!formData.firstName.trim()) {
      errors.firstName = t("validation.required", {
        field: t("createManager.firstName"),
      });
    } else if (formData.firstName.length > 30) {
      errors.firstName = t("validation.maxLength", {
        field: t("createManager.firstName"),
        max: 30,
      });
    }

    if (!formData.lastName.trim()) {
      errors.lastName = t("validation.required", {
        field: t("createManager.lastName"),
      });
    } else if (formData.lastName.length > 30) {
      errors.lastName = t("validation.maxLength", {
        field: t("createManager.lastName"),
        max: 30,
      });
    }

    if (!formData.dob) {
      errors.dob = t("validation.required", { field: t("createManager.dob") });
    } else {
      const age = flooredAgeFromIsoDate(formData.dob);
      if (age === null) {
        errors.dob = t("validation.invalidDate");
      } else if (age > 99) {
        errors.dob = t("validation.invalidDob");
      }
    }
    if (!formData.nationality)
      errors.nationality = t("validation.required", {
        field: t("createManager.countryOfOrigin", "Country/Region of Origin"),
      });
    setFormErrors(errors);
    return {
      ok: Object.keys(errors).length === 0,
      errors,
    };
  };

  const handleStartCareer = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm();
    if (!validation.ok) {
      requestAnimationFrame(() =>
        focusFirstCreateManagerError(validation.errors),
      );
      return;
    }
    void handleStartGame();
  };

  // Close nationality dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!nationalityOpen || !nationalityRef.current) {
        return;
      }

      const targetNode = e.target instanceof Node ? e.target : null;
      const eventPath =
        typeof e.composedPath === "function" ? e.composedPath() : [];
      const clickedInside =
        eventPath.includes(nationalityRef.current) ||
        (targetNode ? nationalityRef.current.contains(targetNode) : false);
      const targetElement = e.target instanceof HTMLElement ? e.target : null;

      logNationalityDebug("document mousedown", {
        clickedInside,
        targetTag: targetElement?.tagName.toLowerCase(),
        targetClass: targetElement?.className ?? "",
        targetText: targetElement?.textContent?.trim().slice(0, 60) ?? "",
      });

      if (!clickedInside) {
        logNationalityDebug("closing from outside click");
        setNationalityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [nationalityOpen]);

  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      if (!canUseTauriInvoke()) {
        throw new Error(
          "Backend Tauri no disponible. Cierra cualquier `npm run tauri dev` suelto y ejecutá `npm run tauri dev`.",
        );
      }

      await invoke<string>("start_new_game_lightweight", {
        nickname: formData.nickname || null,
        firstName: formData.firstName,
        lastName: formData.lastName,
        dob: formData.dob,
        nationality: formData.nationality,
      });

      const displayName =
        formData.nickname?.trim() || `${formData.firstName} ${formData.lastName}`;
      setGameActive(true, displayName.trim());
      console.debug(
        "[MainMenu] start_new_game_lightweight completed, navigating to /select-team",
      );
      navigate("/select-team");
    } catch (error) {
      console.error("Failed to start game:", error);
      alert(t("menu.failedStartGame", { error: String(error) }));
    } finally {
      setIsStarting(false);
    }
  };

  const handleOpenLoadMenu = async () => {
    setMenuState("load");
    setIsLoadingSaves(true);
    try {
      const dbSaves = await invoke<SaveEntry[]>("get_saves");
      setSaves(dbSaves);
    } catch (error) {
      console.error("Failed to load saves:", error);
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleLoadGame = async (saveId: string) => {
    console.log("[MainMenu] handleLoadGame start, saveId:", saveId);
    setLoadingSaveId(saveId);
    try {
      const managerName = await invoke<string>("load_game", { saveId });
      console.log("[MainMenu] load_game returned, managerName:", managerName);
      setGameActive(true, managerName);
      console.log("[MainMenu] setGameActive called, navigating to /dashboard");
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to load game:", error);
      setLoadingSaveId(null);
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    try {
      await invoke<boolean>("delete_save", { saveId });
      setSaves((prev) => prev.filter((s) => s.id !== saveId));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Failed to delete save:", error);
    }
  };

  const handleExitApp = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await getCurrentWindow().destroy();
    } catch (error) {
      console.error("Failed to exit app:", error);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans text-white">
      <MenuBackground />

      {/* Theme Toggle */}
      <ThemeToggle className="absolute top-6 right-6 z-20" />

      {/* Classic-client two-column layout (stacks below lg) */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left column — logo + framed nav panel */}
        <div className="w-full lg:max-w-sm lg:shrink-0 flex flex-col justify-center px-6 sm:px-10 lg:px-14 pt-12 pb-6 lg:py-0">
          <div className="w-full animate-fade-in-up">
            <img
              src="/olmanager-logo.svg"
              alt="Open League Manager"
              className="h-20 mb-6 drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
            />

            <div className="border border-gold-dark/60 bg-hextech-blue/85 backdrop-blur-md shadow-2xl">
              <div className="px-5 py-3 border-b border-gold-dark/50 bg-gradient-to-b from-white/[0.06] to-transparent">
                <span className="font-heading font-bold uppercase tracking-[0.25em] text-gold text-xs">
                  {t("menu.mainMenu", "Menú Principal")}
                </span>
              </div>
              <nav className="flex flex-col py-1.5">
              <MenuItem
                icon={<PlusCircle />}
                label={t("menu.newGame")}
                active={menuState === "create"}
                onClick={() => setMenuState("create")}
              />
              <MenuItem
                icon={<FolderOpen />}
                label={t("menu.loadGame")}
                active={menuState === "load"}
                onClick={handleOpenLoadMenu}
              />
              <MenuItem
                icon={<Settings />}
                tone="muted"
                label={t("menu.settings")}
                onClick={() =>
                  navigate("/settings", { state: { from: "/", menuStyle: true } })
                }
              />
              <MenuItem
                icon={<Users />}
                label={t("menu.community", "Comunidad")}
                active={menuState === "community"}
                onClick={() => setMenuState("community")}
              />
              <MenuItem
                icon={<Newspaper />}
                tone="muted"
                label={t("menu.patchNotes", "Novedades")}
                active={menuState === "patchnotes"}
                onClick={() => setMenuState("patchnotes")}
              />
              {debugToolsEnabled && (
                <MenuItem
                  icon={<Database />}
                  tone="primary"
                  label="World Editor"
                  title="World Editor"
                  onClick={() => navigate("/world-editor")}
                />
              )}
              <MenuItem
                icon={<Power />}
                tone="danger"
                label={t("menu.exitGame")}
                onClick={() => {
                  void handleExitApp();
                }}
              />
              </nav>
            </div>
          </div>
        </div>

        {/* Right column — active panel beside the nav (below on mobile) */}
        {menuState !== "main" && (
          <div className="dark w-full lg:flex-1 min-w-0 flex flex-col lg:overflow-y-auto px-6 pb-12 lg:p-10">
            <div
              key={menuState}
              className="w-full max-w-lg mx-auto my-auto animate-fade-in-up border border-gold-dark/60 shadow-2xl bg-hextech-blue/90 backdrop-blur-xl"
            >
              <div className="h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
              <div className="p-6 sm:p-8">

          {/* Step 1: Create Manager Form */}
          {menuState === "create" && (
            <form
              onSubmit={handleStartCareer}
              className="flex flex-col gap-4"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-heading font-bold uppercase tracking-wide text-white">
                  {t("createManager.title")}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setMenuState("main");
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gold text-navy-950 text-xs font-bold">
                  1
                </div>
                <span className="text-xs text-gray-400 font-heading uppercase tracking-wide">
                  {t("worldSelect.startCareer")}
                </span>
              </div>

              {/* Nickname */}
              <div id="create-manager-field-nickname">
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  {t("createManager.nickname", "Nick")}
                </label>
                <input
                  maxLength={20}
                  className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 ${formErrors.nickname
                      ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-white/15 focus:border-gold focus:ring-gold/20"
                    }`}
                  placeholder={t("createManager.placeholderNickname", "ej. Faker")}
                  value={formData.nickname}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      nickname: e.target.value,
                    }));
                    setFormErrors((prev) => ({ ...prev, nickname: "" }));
                  }}
                />
                {formErrors.nickname && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.nickname}
                  </p>
                )}
              </div>

              {/* Name fields with labels */}
              <div className="flex gap-3">
                <div className="flex-1" id="create-manager-field-firstName">
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                    {t("createManager.firstName")}
                  </label>
                  <input
                    maxLength={30}
                    className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 ${formErrors.firstName
                        ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-white/15 focus:border-gold focus:ring-gold/20"
                      }`}
                    placeholder={t("createManager.placeholderFirst")}
                    value={formData.firstName}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }));
                      setFormErrors((prev) => ({ ...prev, firstName: "" }));
                    }}
                  />
                  {formErrors.firstName && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="flex-1" id="create-manager-field-lastName">
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                    {t("createManager.lastName")}
                  </label>
                  <input
                    maxLength={30}
                    className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 ${formErrors.lastName
                        ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "border-white/15 focus:border-gold focus:ring-gold/20"
                      }`}
                    placeholder={t("createManager.placeholderLast")}
                    value={formData.lastName}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }));
                      setFormErrors((prev) => ({ ...prev, lastName: "" }));
                    }}
                  />
                  {formErrors.lastName && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {formErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* Date of Birth with label */}
              <div id="create-manager-field-dob">
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  {t("createManager.dob")}
                </label>
                <DatePicker
                  value={formData.dob}
                  onChange={(date) => {
                    setFormData((prev) => ({
                      ...prev,
                      dob: date,
                    }));
                    setFormErrors((prev) => ({ ...prev, dob: "" }));
                  }}
                  error={!!dobDisplayedError}
                />
                {dobDisplayedError && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {dobDisplayedError}
                  </p>
                )}
              </div>

              {/* Country/Region combobox — elevate stacking when open so the menu paints above the submit button */}
              <div
                id="create-manager-field-nationality"
                ref={nationalityRef}
                className={nationalityOpen ? "relative z-50" : undefined}
              >
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  {t(
                    "createManager.countryOfOrigin",
                    "Country/Region of Origin",
                  )}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleNationalityDropdown();
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) {
                        toggleNationalityDropdown();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey) {
                        e.preventDefault();
                        if (nationalityOpen) setNationalityOpen(false);
                        document.getElementById("create-manager-submit")?.focus();
                      }
                    }}
                    className={`w-full flex items-center justify-between bg-white/5 border text-left rounded-lg p-3 outline-none transition-all ${formErrors.nationality
                        ? "border-red-400 dark:border-red-500"
                        : nationalityOpen
                          ? "border-gold ring-2 ring-gold/20"
                          : "border-white/15"
                      }`}
                  >
                    <span
                      className={
                        formData.nationality ? "text-white" : "text-gray-400"
                      }
                    >
                      {formData.nationality ? (
                        <span className="flex items-center gap-2">
                          <CountryFlag
                            code={formData.nationality}
                            locale={i18n.language}
                            className="text-lg leading-none"
                          />
                          <span>
                            {countryName(formData.nationality, i18n.language) ||
                              formData.nationality}
                          </span>
                        </span>
                      ) : (
                        t(
                          "createManager.selectCountry",
                          "Select Country/Region",
                        )
                      )}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${nationalityOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {nationalityOpen && (
                    <div
                      className="absolute z-50 bottom-full mb-1 left-0 right-0 bg-navy-800 rounded-lg shadow-xl border border-white/10 overflow-hidden"
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        logNationalityDebug("dropdown panel mousedown");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab") {
                          e.preventDefault();
                          setNationalityOpen(false);
                          setNationalitySearch("");
                          document.getElementById("create-manager-submit")?.focus();
                        }
                      }}
                    >
                      <div className="p-2 border-b border-white/10">
                        <input
                          type="text"
                          autoFocus
                          placeholder={t("createManager.searchNationalities")}
                          value={nationalitySearch}
                          onChange={(e) => setNationalitySearch(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm outline-none focus:border-gold transition-colors placeholder:text-gray-500"
                        />
                      </div>
                      <div className="max-h-[min(20rem,calc(100vh-9rem))] overflow-y-auto overscroll-contain">
                        {filteredNationalities.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-400">
                            {t("menu.noResults")}
                          </p>
                        ) : (
                          filteredNationalities.map((nat) => (
                            <button
                              key={nat.code}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                logNationalityDebug("option selected", {
                                  code: nat.code,
                                  name: nat.name,
                                });
                                setFormData((prev) => ({
                                  ...prev,
                                  nationality: nat.code,
                                }));
                                setNationalityOpen(false);
                                setNationalitySearch("");
                                setFormErrors((prev) => ({
                                  ...prev,
                                  nationality: "",
                                }));
                              }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${formData.nationality === nat.code
                                  ? "bg-gold/10 text-gold"
                                  : "text-gray-200 hover:bg-white/10"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <CountryFlag
                                  code={nat.code}
                                  locale={i18n.language}
                                  className="text-lg leading-none"
                                />
                                <span>{nat.name}</span>
                              </div>
                              {formData.nationality === nat.code && (
                                <Check className="w-4 h-4 text-gold" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {formErrors.nationality && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.nationality}
                  </p>
                )}
              </div>

              <Button
                id="create-manager-submit"
                type="submit"
                variant="primary"
                size="lg"
                className="mt-2 w-full"
                iconRight={<ChevronRight />}
                disabled={isStarting}
              >
                {isStarting ? t("worldSelect.creatingWorld") : t("worldSelect.startCareer")}
              </Button>
            </form>
          )}

          {/* Load Game List */}
          {menuState === "load" && (
            <SavesList
              loadingSaveId={loadingSaveId}
              saves={saves}
              isLoading={isLoadingSaves}
              confirmDeleteId={confirmDeleteId}
              onLoad={handleLoadGame}
              onDelete={handleDeleteSave}
              onConfirmDelete={setConfirmDeleteId}
              onClose={() => setMenuState("main")}
            />
          )}

          {/* Community */}
          {menuState === "community" && (
            <CommunityPanel onClose={() => setMenuState("main")} />
          )}

          {/* Patch notes */}
          {menuState === "patchnotes" && (
            <PatchNotesPanel onClose={() => setMenuState("main")} />
          )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Version */}
      <div className="absolute bottom-4 right-4 text-gray-300/70 text-xs font-heading uppercase tracking-widest drop-shadow z-20">
        {t("app.version")} {__APP_VERSION__}
      </div>
    </div>
  );
}

type MenuItemTone = "accent" | "muted" | "primary" | "danger";

function MenuItem({
  icon,
  label,
  onClick,
  active = false,
  tone = "accent",
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: MenuItemTone;
  title?: string;
}) {
  const bar =
    tone === "danger"
      ? "bg-red-500"
      : tone === "primary"
        ? "bg-primary-500"
        : "bg-gold";
  const iconColor =
    tone === "danger"
      ? "text-red-400"
      : tone === "primary"
        ? "text-primary-400"
        : tone === "muted"
          ? "text-gray-300"
          : "text-gold";
  const hoverBg = tone === "danger" ? "hover:bg-red-500/10" : "hover:bg-gold/10";

  return (
    <button
      onClick={onClick}
      title={title}
      className={`group relative flex items-center gap-3.5 w-full py-2.5 pl-5 pr-6 text-left transition-colors duration-200 ${
        active ? "bg-gold/10" : hoverBg
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 transition-all duration-200 ${bar} ${
          active ? "h-3/5" : "h-0 group-hover:h-3/5"
        }`}
      />
      <span
        className={`${iconColor} transition-transform group-hover:scale-110 [&>svg]:w-5 [&>svg]:h-5`}
      >
        {icon}
      </span>
      <span
        className={`font-heading font-bold text-xl uppercase tracking-wider transition-all ${
          active
            ? "text-gold-bright translate-x-0.5"
            : "text-gray-200 group-hover:text-gold-bright group-hover:translate-x-0.5"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
