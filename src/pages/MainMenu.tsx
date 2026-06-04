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
import { useAuth } from "../web/auth";
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
  UserCircle,
  LogOut,
  Mail,
  KeyRound,
  ImagePlus,
  Clock,
  Globe2,
} from "lucide-react";
import { countryName, allNationalities } from "../lib/countries";
import {
  DEFAULT_MANAGER_ICON_PATH,
  MANAGER_ICON_PATHS,
} from "../lib/managerAvatars";

const canUseTauriInvoke = () => {
  if (import.meta.env.MODE === "test") return true;
  if (import.meta.env.MODE === "web") return true;
  if (typeof window === "undefined") return false;
  const internals = (
    window as unknown as { __TAURI_INTERNALS__?: { invoke?: unknown } }
  ).__TAURI_INTERNALS__;
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

function numericUserMetadataValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatPlaytime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes}m`;
}

export default function MainMenu() {
  const navigate = useNavigate();
  const setGameActive = useGameStore((state) => state.setGameActive);
  const { session, playtimeSeconds, signOut, updateUserAvatarPath } = useAuth();
  const debugToolsEnabled = useSettingsStore(
    (state) => state.settings.debug_tools_enabled,
  );
  const { t, i18n } = useTranslation();
  const isWebSession = import.meta.env.MODE === "web" && !!session;
  const userEmail = session?.user.email ?? "";
  const userDisplayName =
    (session?.user.user_metadata?.full_name as string | undefined) ||
    (session?.user.user_metadata?.name as string | undefined) ||
    userEmail.split("@")[0] ||
    t("auth.user", "Usuario");
  const userAvatarPath =
    (session?.user.user_metadata?.avatar_path as string | undefined) ||
    (session?.user.user_metadata?.avatar_url as string | undefined) ||
    (session?.user.user_metadata?.picture as string | undefined) ||
    DEFAULT_MANAGER_ICON_PATH;
  const userCountry =
    (session?.user.user_metadata?.country as string | undefined) || "";
  const userAge = numericUserMetadataValue(session?.user.user_metadata?.age);

  const [menuState, setMenuState] = useState<
    "main" | "create" | "load" | "community" | "patchnotes" | "profile"
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
        formData.nickname?.trim() ||
        `${formData.firstName} ${formData.lastName}`;
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

  const handleSignOut = async (): Promise<void> => {
    setGameActive(false);
    setMenuState("main");
    await signOut();
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans text-white">
      <MenuBackground />

      {/* Theme Toggle */}
      <ThemeToggle className="absolute top-6 right-6 z-20" />

      {/* Two-column layout: persistent nav on the left, active panel on the right */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left column — logo + nav (always visible) */}
        <div className="flex flex-col justify-start pt-[15vh] pb-8 px-8 sm:px-14 lg:px-20 w-full max-w-md shrink-0">
          <div className="w-full animate-fade-in-up">
            <img
              src="/olmanager-logo.svg"
              alt="Open League Manager"
              className="h-24 mb-10 drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)]"
            />

            <nav className="flex flex-col gap-1">
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
                  navigate("/settings", {
                    state: { from: "/", menuStyle: true },
                  })
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
              {!isWebSession && (
                <MenuItem
                  icon={<Power />}
                  tone="danger"
                  label={t("menu.exitGame")}
                  onClick={() => {
                    void handleExitApp();
                  }}
                />
              )}
            </nav>

            {isWebSession && (
              <button
                type="button"
                onClick={() => setMenuState("profile")}
                className="mt-12 sm:mt-14 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent-400/40 bg-white/10">
                  <img
                    src={userAvatarPath}
                    alt={userDisplayName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-heading text-sm font-bold uppercase tracking-wider text-white">
                    {userDisplayName}
                  </span>
                  <span className="block truncate text-xs text-gray-400">
                    {userEmail}
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Right column — active panel opens beside the nav */}
        {menuState !== "main" && (
          <div className="dark flex-1 min-w-0 flex flex-col justify-center overflow-y-auto p-6 lg:p-10">
            <div
              key={menuState}
              className="w-full max-w-2xl mx-auto animate-fade-in-up border-t border-white/10"
            >
              <div className="pt-6">
                {/* Step 1: Create Manager Form */}
                {menuState === "create" && (
                  <form onSubmit={handleStartCareer} className="flex flex-col">
                    <div className="flex justify-between items-center pb-5">
                      <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-white drop-shadow">
                        {t("createManager.title")}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuState("main");
                          setFormErrors({});
                        }}
                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-3 py-4 border-y border-white/10">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent-400 text-navy-950 text-xs font-bold">
                        1
                      </div>
                      <span className="text-sm text-gray-300 font-heading font-bold uppercase tracking-wider">
                        {t("worldSelect.startCareer")}
                      </span>
                    </div>

                    {/* Nickname */}
                    <div
                      id="create-manager-field-nickname"
                      className="py-4 border-b border-white/10"
                    >
                      <label className="block text-sm font-heading font-bold uppercase tracking-wider text-white mb-1.5">
                        {t("createManager.nickname", "Nick")}
                      </label>
                      <input
                        maxLength={20}
                        className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 ${
                          formErrors.nickname
                            ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "border-white/15 focus:border-accent-400 focus:ring-accent-400/20"
                        }`}
                        placeholder={t(
                          "createManager.placeholderNickname",
                          "ej. Faker",
                        )}
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
                    <div className="flex flex-col sm:flex-row gap-3 py-4 border-b border-white/10">
                      <div
                        className="flex-1"
                        id="create-manager-field-firstName"
                      >
                        <label className="block text-sm font-heading font-bold uppercase tracking-wider text-white mb-1.5">
                          {t("createManager.firstName")}
                        </label>
                        <input
                          maxLength={30}
                          className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 ${
                            formErrors.firstName
                              ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
                              : "border-white/15 focus:border-accent-400 focus:ring-accent-400/20"
                          }`}
                          placeholder={t("createManager.placeholderFirst")}
                          value={formData.firstName}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              firstName: e.target.value,
                            }));
                            setFormErrors((prev) => ({
                              ...prev,
                              firstName: "",
                            }));
                          }}
                        />
                        {formErrors.firstName && (
                          <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            {formErrors.firstName}
                          </p>
                        )}
                      </div>
                      <div
                        className="flex-1"
                        id="create-manager-field-lastName"
                      >
                        <label className="block text-sm font-heading font-bold uppercase tracking-wider text-white mb-1.5">
                          {t("createManager.lastName")}
                        </label>
                        <input
                          maxLength={30}
                          className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 ${
                            formErrors.lastName
                              ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
                              : "border-white/15 focus:border-accent-400 focus:ring-accent-400/20"
                          }`}
                          placeholder={t("createManager.placeholderLast")}
                          value={formData.lastName}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }));
                            setFormErrors((prev) => ({
                              ...prev,
                              lastName: "",
                            }));
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
                    <div
                      id="create-manager-field-dob"
                      className="py-4 border-b border-white/10"
                    >
                      <label className="block text-sm font-heading font-bold uppercase tracking-wider text-white mb-1.5">
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
                      className={`py-4 border-b border-white/10 ${nationalityOpen ? "relative z-50" : ""}`}
                    >
                      <label className="block text-sm font-heading font-bold uppercase tracking-wider text-white mb-1.5">
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
                              document
                                .getElementById("create-manager-submit")
                                ?.focus();
                            }
                          }}
                          className={`w-full flex items-center justify-between bg-white/5 border text-left rounded-lg p-3 outline-none transition-all ${
                            formErrors.nationality
                              ? "border-red-400 dark:border-red-500"
                              : nationalityOpen
                                ? "border-accent-400 ring-2 ring-accent-400/20"
                                : "border-white/15"
                          }`}
                        >
                          <span
                            className={
                              formData.nationality
                                ? "text-white"
                                : "text-gray-400"
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
                                  {countryName(
                                    formData.nationality,
                                    i18n.language,
                                  ) || formData.nationality}
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
                            className="absolute z-50 bottom-full mb-1 left-0 right-0 bg-navy-900/95 backdrop-blur-xl rounded-lg shadow-xl border border-white/10 overflow-hidden"
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              logNationalityDebug("dropdown panel mousedown");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Tab") {
                                e.preventDefault();
                                setNationalityOpen(false);
                                setNationalitySearch("");
                                document
                                  .getElementById("create-manager-submit")
                                  ?.focus();
                              }
                            }}
                          >
                            <div className="p-2 border-b border-white/10">
                              <input
                                type="text"
                                autoFocus
                                placeholder={t(
                                  "createManager.searchNationalities",
                                )}
                                value={nationalitySearch}
                                onChange={(e) =>
                                  setNationalitySearch(e.target.value)
                                }
                                className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm outline-none focus:border-accent-400 transition-colors placeholder:text-gray-500"
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
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                                      formData.nationality === nat.code
                                        ? "bg-accent-400/10 text-accent-400"
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
                                      <Check className="w-4 h-4 text-accent-400" />
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
                      variant="accent"
                      size="lg"
                      className="mt-6 w-full"
                      iconRight={<ChevronRight />}
                      disabled={isStarting}
                    >
                      {isStarting
                        ? t("worldSelect.creatingWorld")
                        : t("worldSelect.startCareer")}
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

                {/* User profile */}
                {menuState === "profile" && session && (
                  <UserProfilePanel
                    email={userEmail}
                    userId={session.user.id}
                    displayName={userDisplayName}
                    avatarPath={userAvatarPath}
                    country={userCountry}
                    age={userAge}
                    playtimeSeconds={playtimeSeconds}
                    createdAt={session.user.created_at}
                    onClose={() => setMenuState("main")}
                    onSignOut={handleSignOut}
                    onAvatarChange={updateUserAvatarPath}
                  />
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

function UserProfilePanel({
  email,
  userId,
  displayName,
  avatarPath,
  country,
  age,
  playtimeSeconds,
  createdAt,
  onClose,
  onSignOut,
  onAvatarChange,
}: {
  email: string;
  userId: string;
  displayName: string;
  avatarPath: string;
  country: string;
  age: number | null;
  playtimeSeconds: number;
  createdAt?: string;
  onClose: () => void;
  onSignOut: () => Promise<void>;
  onAvatarChange: (avatarPath: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const createdDate = createdAt
    ? new Intl.DateTimeFormat(i18n.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(createdAt))
    : null;

  const handleSelectAvatar = async (nextAvatarPath: string) => {
    setIsSavingAvatar(true);
    setAvatarError(null);
    try {
      await onAvatarChange(nextAvatarPath);
      setShowAvatarPicker(false);
    } catch (error) {
      console.error("Failed to update user avatar:", error);
      setAvatarError(t("auth.avatarSaveError"));
    } finally {
      setIsSavingAvatar(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-5">
        <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-white drop-shadow">
          {t("auth.profile")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-t border-white/10">
        <div className="flex items-center gap-4 border-b border-white/10 py-5">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowAvatarPicker((current) => !current)}
              className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-accent-400/40 bg-white/10 shadow-lg shadow-black/20"
              title={t("auth.changeAvatar")}
            >
              <img
                src={avatarPath}
                alt={displayName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                <ImagePlus className="h-6 w-6 text-white" />
              </span>
            </button>

            {showAvatarPicker && (
              <div className="absolute bottom-full left-0 z-50 mb-3 w-[21rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/15 bg-navy-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
                <div className="absolute -bottom-2 left-6 h-4 w-4 rotate-45 border-b border-r border-white/15 bg-navy-900/95" />
                <div className="relative">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                      {t("auth.selectAvatar")}
                    </p>
                    {isSavingAvatar && (
                      <span className="text-xs text-gray-400">
                        {t("common.saving", "Guardando...")}
                      </span>
                    )}
                  </div>
                  <div className="grid max-h-64 grid-cols-6 gap-3 overflow-y-auto pr-1">
                    {MANAGER_ICON_PATHS.map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => {
                          void handleSelectAvatar(path);
                        }}
                        disabled={isSavingAvatar}
                        className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all hover:scale-105 disabled:cursor-wait disabled:opacity-70 ${
                          avatarPath === path
                            ? "border-accent-400 ring-2 ring-accent-400/30"
                            : "border-white/10 hover:border-accent-400/70"
                        }`}
                        aria-label={t("auth.selectAvatar")}
                      >
                        <img
                          src={path}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {avatarPath === path && (
                          <span className="absolute right-1 top-1 rounded-full bg-accent-400 p-0.5 text-navy-950">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {avatarError && (
                    <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {avatarError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-heading text-xl font-bold uppercase tracking-wider text-white">
              {displayName}
            </p>
            <p className="truncate text-sm text-gray-400">{email}</p>
            <button
              type="button"
              onClick={() => setShowAvatarPicker((current) => !current)}
              className="mt-2 font-heading text-xs font-bold uppercase tracking-wider text-accent-400 transition-colors hover:text-accent-300"
            >
              {t("auth.changeAvatar")}
            </button>
          </div>
        </div>

        <ProfileRow
          icon={<Mail />}
          label={t("auth.email")}
          value={email || t("auth.notAvailable")}
        />
        {country && (
          <ProfileRow
            icon={<Globe2 />}
            label={t("auth.country")}
            value={countryName(country, i18n.language)}
          />
        )}
        {age && (
          <ProfileRow
            icon={<UserCircle />}
            label={t("auth.age")}
            value={String(age)}
          />
        )}
        <ProfileRow
          icon={<Clock />}
          label={t("auth.playtime")}
          value={formatPlaytime(playtimeSeconds)}
        />
        <ProfileRow
          icon={<KeyRound />}
          label={t("auth.userId")}
          value={userId}
        />
        {createdDate && (
          <ProfileRow
            icon={<UserCircle />}
            label={t("auth.createdAt")}
            value={createdDate}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          void onSignOut();
        }}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/50 px-4 py-3 font-heading text-lg font-bold uppercase tracking-wide text-red-300 transition-colors hover:border-red-500 hover:bg-red-500/10"
      >
        <LogOut className="h-5 w-5" />
        {t("auth.signOut")}
      </button>
    </div>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-4">
      <div className="flex items-center gap-3 text-gray-300">
        <span className="text-accent-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        <span className="font-heading text-sm font-bold uppercase tracking-wider text-white">
          {label}
        </span>
      </div>
      <span className="min-w-0 truncate text-right text-sm text-gray-400">
        {value}
      </span>
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
        : "bg-accent-400";
  const iconColor =
    tone === "danger"
      ? "text-red-400"
      : tone === "primary"
        ? "text-primary-400"
        : tone === "muted"
          ? "text-gray-300"
          : "text-accent-400";
  const hoverBg =
    tone === "danger" ? "hover:bg-red-500/10" : "hover:bg-white/5";

  return (
    <button
      onClick={onClick}
      title={title}
      className={`group relative flex items-center gap-4 w-full py-3 pl-5 pr-6 text-left rounded-lg transition-colors duration-200 ${
        active ? "bg-white/10" : hoverBg
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-200 ${bar} ${
          active ? "h-3/5" : "h-0 group-hover:h-3/5"
        }`}
      />
      <span
        className={`${iconColor} transition-transform group-hover:scale-110 [&>svg]:w-6 [&>svg]:h-6`}
      >
        {icon}
      </span>
      <span
        className={`font-heading font-bold text-2xl uppercase tracking-wider transition-all ${
          active
            ? "text-white translate-x-1"
            : "text-gray-100 group-hover:text-white group-hover:translate-x-1"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
