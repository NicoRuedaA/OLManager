import { useTranslation } from "react-i18next";
import { X, Heart, ExternalLink } from "lucide-react";

const DISCORD_URL = "https://discord.gg/aFSDrebA";
const GITHUB_URL = "https://github.com/OpenLeagueManager";
const TWITTER_URL = "https://x.com/OpenLeagueMngr";

/**
 * People who have supported the project the most. Edit this list to add or
 * reorder mentions; `note` is an optional short role/credit line.
 */
const SUPPORTERS: Array<{ name: string; note?: string }> = [
  // TODO: rellenar con los nombres reales de quienes más han apoyado.
];

/** Open an external URL via the Tauri opener when available, else a new tab. */
function openExternal(url: string): void {
  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (isTauri) {
    void import("@tauri-apps/plugin-opener")
      .then((m) => m.openUrl(url))
      .catch(() => window.open(url, "_blank", "noopener,noreferrer"));
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.607-.719 1.4-.984 2.022a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.997-2.022.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 7.55.642 10.65.992 13.71a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127c-.598.349-1.22.644-1.873.892a.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-3.547-.838-6.624-3.549-9.314a.06.06 0 0 0-.031-.028ZM8.02 11.85c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.598 24 12.297c0-6.627-5.373-12-12-12Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export default function CommunityPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center pb-5">
        <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-white drop-shadow">
          {t("community.title", "Comunidad")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed border-t border-white/10 py-4">
        {t(
          "community.blurb",
          "Open League Manager es un proyecto open source y gratuito, hecho por y para la comunidad. Únete, propón ideas o contribuye con código: cualquier ayuda suma.",
        )}
      </p>

      {/* External links */}
      <div className="flex flex-col border-t border-white/10">
        <button
          type="button"
          onClick={() => openExternal(DISCORD_URL)}
          className="group flex items-center justify-between gap-3 w-full py-4 text-white transition-colors border-b border-white/10 hover:bg-white/5"
        >
          <span className="flex items-center gap-3 min-w-0">
            <DiscordIcon className="w-5 h-5 text-accent-400 shrink-0" />
            <span className="font-heading font-bold uppercase tracking-wider">
              Discord
            </span>
          </span>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-accent-400 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => openExternal(GITHUB_URL)}
          className="group flex items-center justify-between gap-3 w-full py-4 text-white transition-colors border-b border-white/10 hover:bg-white/5"
        >
          <span className="flex items-center gap-3 min-w-0">
            <GithubIcon className="w-5 h-5 text-gray-300 shrink-0 group-hover:text-white transition-colors" />
            <span className="font-heading font-bold uppercase tracking-wider">
              GitHub
            </span>
          </span>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-accent-400 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => openExternal(TWITTER_URL)}
          className="group flex items-center justify-between gap-3 w-full py-4 text-white transition-colors border-b border-white/10 hover:bg-white/5"
        >
          <span className="flex items-center gap-3 min-w-0">
            <XIcon className="w-5 h-5 text-gray-300 shrink-0 group-hover:text-white transition-colors" />
            <span className="font-heading font-bold uppercase tracking-wider">
              Twitter
            </span>
          </span>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-accent-400 transition-colors" />
        </button>
      </div>

      {/* Mentions */}
      <div className="border-t border-white/10 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Heart className="w-4 h-4 text-accent-400" />
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-white">
            {t("community.mentionsTitle", "Menciones")}
          </h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {t(
            "community.mentionsSubtitle",
            "Gracias a quienes más han apoyado el proyecto",
          )}
        </p>

        {SUPPORTERS.length === 0 ? (
          <p className="text-xs text-gray-500 italic">
            {t(
              "community.mentionsEmpty",
              "¿Quieres aparecer aquí? Únete al Discord y contribuye.",
            )}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {SUPPORTERS.map((s) => (
              <li key={s.name} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-400/15 text-accent-400 font-heading font-bold text-sm shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{s.name}</p>
                  {s.note && (
                    <p className="text-xs text-gray-400 truncate">{s.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
