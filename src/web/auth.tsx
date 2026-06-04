import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import MenuBackground from "../components/menu/MenuBackground";
import {
  DEFAULT_MANAGER_ICON_PATH,
  MANAGER_ICON_PATHS,
} from "../lib/managerAvatars";
import { allNationalities } from "../lib/countries";
import { supabase } from "./supabase";

const PLAYTIME_SYNC_INTERVAL_MS = 60_000;

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  playtimeSeconds: number;
  signOut: () => Promise<void>;
  updateUserAvatarPath: (avatarPath: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  playtimeSeconds: 0,
  signOut: async () => {},
  updateUserAvatarPath: async () => {},
});

function numericMetadataValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [playtimeSeconds, setPlaytimeSeconds] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  const scopedSessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
    setPlaytimeSeconds(
      numericMetadataValue(session?.user.user_metadata?.playtime_seconds),
    );
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    if (scopedSessionTokenRef.current === session.access_token) return;
    scopedSessionTokenRef.current = session.access_token;

    void supabase.auth.signOut({ scope: "others" }).catch((error) => {
      console.warn("Failed to revoke other Supabase sessions:", error);
    });
  }, [session?.access_token]);

  const patchUserMetadata = async (patch: Record<string, unknown>) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...currentSession.user.user_metadata,
        ...patch,
      },
    });

    if (error) throw error;
    if (data.user) {
      setSession((current) =>
        current ? { ...current, user: data.user } : current,
      );
    }
  };

  useEffect(() => {
    if (!session?.user.id) return;
    let lastTick = Date.now();

    const syncPlaytime = () => {
      const now = Date.now();
      const deltaSeconds = Math.floor((now - lastTick) / 1000);
      lastTick = now;
      if (deltaSeconds <= 0) return;

      setPlaytimeSeconds((current) => {
        const next = current + deltaSeconds;
        void patchUserMetadata({ playtime_seconds: next }).catch((error) => {
          console.warn("Failed to sync playtime:", error);
        });
        return next;
      });
    };

    const interval = window.setInterval(
      syncPlaytime,
      PLAYTIME_SYNC_INTERVAL_MS,
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        syncPlaytime();
      } else {
        lastTick = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      syncPlaytime();
    };
  }, [session?.user.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateUserAvatarPath = async (avatarPath: string) => {
    await patchUserMetadata({ avatar_path: avatarPath });
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        playtimeSeconds,
        signOut,
        updateUserAvatarPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="dark min-h-screen relative overflow-hidden flex items-center justify-center">
        <MenuBackground />
        <div className="relative z-10 w-8 h-8 border-4 border-accent-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) {
    return <LoginScreen />;
  }
  return <>{children}</>;
}

function LoginScreen() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const countriesList = allNationalities(i18n.language);
  const defaultCountry =
    countriesList.find((country) => country.code === "ES")?.code ??
    countriesList[0]?.code ??
    "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState(defaultCountry);
  const [age, setAge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (googleError) {
        setError(googleError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError(t("auth.passwordMismatch"));
          return;
        }

        const parsedAge = Number(age);
        if (!fullName.trim() || !country || !Number.isFinite(parsedAge)) {
          setError(t("auth.profileFieldsRequired"));
          return;
        }

        if (parsedAge < 13 || parsedAge > 99) {
          setError(t("auth.ageInvalid"));
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              country,
              age: parsedAge,
              avatar_path: MANAGER_ICON_PATHS[0] ?? DEFAULT_MANAGER_ICON_PATH,
              playtime_seconds: 0,
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (!data.session) {
          setMessage(t("auth.registerSuccess"));
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dark min-h-screen relative overflow-hidden flex items-center justify-center px-4 font-sans text-white">
      <MenuBackground />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-sm animate-fade-in-up rounded-2xl border border-white/10 bg-navy-900/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-accent-400" />
        <img
          src="/olmanager-logo.svg"
          alt="Open League Manager"
          className="h-16 mx-auto mb-6 drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)]"
        />
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-lg px-3 py-2 text-sm font-heading font-bold uppercase tracking-wider transition-colors ${
              !isRegister
                ? "bg-accent-400 text-navy-950"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t("auth.login")}
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-lg px-3 py-2 text-sm font-heading font-bold uppercase tracking-wider transition-colors ${
              isRegister
                ? "bg-accent-400 text-navy-950"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t("auth.register")}
          </button>
        </div>
        <div className="space-y-4">
          {isRegister && (
            <>
              <label className="block">
                <span className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  {t("auth.fullName")}
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 p-3 text-white outline-none transition-all placeholder:text-gray-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                  required
                />
              </label>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <label className="block min-w-0">
                  <span className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                    {t("auth.country")}
                  </span>
                  <select
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-navy-900/90 p-3 text-white outline-none transition-all focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                    required
                  >
                    {countriesList.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                    {t("auth.age")}
                  </span>
                  <input
                    type="number"
                    min={13}
                    max={99}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-white/5 p-3 text-white outline-none transition-all placeholder:text-gray-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                    required
                  />
                </label>
              </div>
            </>
          )}
          <label className="block">
            <span className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
              {t("auth.email")}
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 p-3 text-white outline-none transition-all placeholder:text-gray-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
              required
            />
          </label>
          <label className="block">
            <span className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
              {t("auth.password")}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 p-3 text-white outline-none transition-all placeholder:text-gray-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
              required
            />
          </label>
          {isRegister && (
            <label className="block">
              <span className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                {t("auth.confirmPassword")}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 p-3 text-white outline-none transition-all placeholder:text-gray-500 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                required
              />
            </label>
          )}
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-accent-400/30 bg-accent-400/10 px-3 py-2 text-sm text-accent-400">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent-400 px-4 py-3 font-heading text-lg font-bold uppercase tracking-wide text-navy-950 shadow-lg shadow-accent-400/20 transition-colors hover:bg-accent-500 disabled:opacity-60"
          >
            {submitting
              ? isRegister
                ? t("auth.registering")
                : t("auth.signingIn")
              : isRegister
                ? t("auth.createAccount")
                : t("auth.enter")}
          </button>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="font-heading text-xs font-bold uppercase tracking-wider text-gray-500">
              {t("auth.or")}
            </span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <button
            type="button"
            onClick={() => {
              void handleGoogleSignIn();
            }}
            disabled={submitting}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-heading text-base font-bold uppercase tracking-wide text-white transition-colors hover:border-accent-400/60 hover:bg-white/10 disabled:opacity-60"
          >
            {t("auth.continueWithGoogle")}
          </button>
        </div>
      </form>
    </div>
  );
}
