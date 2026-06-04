import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import changelogRaw from "../../../CHANGELOG.md?raw";

interface ChangeGroup {
  type: string;
  items: string[];
}

interface Release {
  version: string;
  date?: string;
  groups: ChangeGroup[];
}

/** Parse a Keep a Changelog style markdown file into structured releases. */
function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  let release: Release | null = null;
  let group: ChangeGroup | null = null;

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();

    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      const text = h2[1].trim();
      const match = /^\[?([^\]]+?)\]?\s*(?:[-–]\s*(.+))?$/.exec(text);
      release = {
        version: match ? match[1].trim() : text,
        date: match?.[2]?.trim(),
        groups: [],
      };
      releases.push(release);
      group = null;
      continue;
    }

    // Ignore the leading "# Changelog" title and its intro paragraph.
    if (!release) continue;

    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      group = { type: h3[1].trim(), items: [] };
      release.groups.push(group);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      if (!group) {
        group = { type: "", items: [] };
        release.groups.push(group);
      }
      group.items.push(bullet[1].trim());
      continue;
    }

    // Wrapped continuation line: append to the previous bullet.
    const trimmed = line.trim();
    if (trimmed && group && group.items.length > 0) {
      group.items[group.items.length - 1] += ` ${trimmed}`;
    }
  }

  return releases;
}

/** Visual treatment + localised label for each changelog group. */
function groupStyle(
  type: string,
  t: (key: string, def: string) => string,
): { label: string; className: string } {
  const key = type.toLowerCase();
  switch (key) {
    case "added":
      return { label: t("patchNotes.added", "Añadido"), className: "text-green-400" };
    case "changed":
      return { label: t("patchNotes.changed", "Cambiado"), className: "text-accent-400" };
    case "fixed":
      return { label: t("patchNotes.fixed", "Arreglado"), className: "text-amber-400" };
    case "removed":
      return { label: t("patchNotes.removed", "Eliminado"), className: "text-red-400" };
    case "security":
      return { label: t("patchNotes.security", "Seguridad"), className: "text-purple-400" };
    case "chores":
      return { label: t("patchNotes.chores", "Mantenimiento"), className: "text-gray-400" };
    case "contributors":
      return { label: t("patchNotes.contributors", "Colaboradores"), className: "text-sky-400" };
    case "notes":
      return { label: t("patchNotes.notes", "Notas"), className: "text-gray-400" };
    default:
      return { label: type, className: "text-gray-300" };
  }
}

export default function PatchNotesPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const releases = useMemo(() => parseChangelog(changelogRaw), []);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-heading font-bold uppercase tracking-wide text-white">
          {t("menu.patchNotes", "Novedades")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto overscroll-contain pr-1 flex flex-col gap-6">
        {releases.length === 0 ? (
          <p className="text-sm text-gray-400">
            {t("patchNotes.empty", "Todavía no hay notas de versión.")}
          </p>
        ) : (
          releases.map((release) => (
            <div key={release.version}>
              <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-white/10">
                <h3 className="text-lg font-heading font-bold text-accent-400">
                  v{release.version}
                </h3>
                {release.date && (
                  <span className="text-xs text-gray-500">{release.date}</span>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {release.groups.map((g, gi) => {
                  const style = g.type ? groupStyle(g.type, t) : null;
                  return (
                    <div key={`${release.version}-${gi}`}>
                      {style && (
                        <p
                          className={`text-2xs font-heading font-bold uppercase tracking-wider mb-1 ${style.className}`}
                        >
                          {style.label}
                        </p>
                      )}
                      <ul className="flex flex-col gap-1">
                        {g.items.map((item, ii) => (
                          <li
                            key={ii}
                            className="text-sm text-gray-300 leading-snug pl-3 relative before:absolute before:left-0 before:top-2 before:w-1 before:h-1 before:rounded-full before:bg-gray-500"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
