import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import MenuBackground from "../components/menu/MenuBackground";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
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
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
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
        </div>
      </form>
    </div>
  );
}
