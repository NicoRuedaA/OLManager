import { useEffect, useMemo, useState } from "react";
import type { GameStateData } from "../../store/gameStore";
import type { SocialAccountData, SocialTemplateData } from "../../store/types";
import {
  getSocialAccounts,
  getSocialTemplates,
  saveSocialAccounts,
  saveSocialTemplates,
} from "../../services/socialService";

interface SocialEditorProps {
  onGameUpdate: (state: GameStateData) => void;
}

type TemplateConditions = {
  requires_stomp?: boolean;
  winner_team_slug?: string;
  requires_player_name?: boolean;
};

function parseConditions(value: string): TemplateConditions {
  try {
    const parsed = JSON.parse(value) as TemplateConditions;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyConditions(value: TemplateConditions): string {
  const normalized: TemplateConditions = {};
  if (typeof value.requires_stomp === "boolean") normalized.requires_stomp = value.requires_stomp;
  if (value.winner_team_slug && value.winner_team_slug.trim()) normalized.winner_team_slug = value.winner_team_slug.trim();
  if (value.requires_player_name) normalized.requires_player_name = true;
  return JSON.stringify(normalized);
}

function newAccount(index: number, language: string): SocialAccountData {
  return {
    id: `custom_account_${Date.now()}_${index}`,
    language,
    display_name: "Nueva Cuenta",
    handle: `@nuevaCuenta${index}`,
    author_type: "Fan",
    profile_image_url: null,
    favorite_team_ids: [],
    active: true,
  };
}

function newTemplate(index: number, language: string): SocialTemplateData {
  return {
    id: `custom_template_${Date.now()}_${index}`,
    language,
    slot: "FanOpinion",
    author_id: null,
    conditions_json: "{}",
    variants: ["Nuevo tweet"],
    tags: ["custom"],
    weight: 1,
    active: true,
  };
}

export default function SocialEditor({ onGameUpdate }: SocialEditorProps) {
  const [editorLanguage, setEditorLanguage] = useState("all");
  const [accounts, setAccounts] = useState<SocialAccountData[]>([]);
  const [templates, setTemplates] = useState<SocialTemplateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => account.language === "all" || account.language === editorLanguage),
    [accounts, editorLanguage],
  );
  const filteredTemplates = useMemo(
    () => templates.filter((template) => template.language === "all" || template.language === editorLanguage),
    [templates, editorLanguage],
  );

  async function loadEditor(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [loadedAccounts, loadedTemplates] = await Promise.all([
        getSocialAccounts(),
        getSocialTemplates(),
      ]);
      setAccounts(loadedAccounts);
      setTemplates(loadedTemplates);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el editor");
    } finally {
      setLoading(false);
    }
  }

  async function saveEditor(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await saveSocialAccounts(accounts);
      const gameState = await saveSocialTemplates(templates);
      onGameUpdate(gameState);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el editor");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadEditor();
  }, []);

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-navy-600 dark:bg-navy-700/40">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Idioma</label>
        <select
          value={editorLanguage}
          onChange={(event) => setEditorLanguage(event.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
        >
          <option value="all">all</option>
          <option value="es">es</option>
          <option value="fr">fr</option>
          <option value="de">de</option>
          <option value="en">en</option>
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void loadEditor();
          }}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-600 transition hover:bg-gray-100 disabled:opacity-50 dark:border-navy-500 dark:text-gray-300 dark:hover:bg-navy-700"
        >
          {loading ? "Cargando..." : "Recargar"}
        </button>
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => {
            void saveEditor();
          }}
          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar editor"}
        </button>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Cuentas ({filteredAccounts.length})
          </p>
          <button
            type="button"
            onClick={() =>
              setAccounts((current) => [...current, newAccount(current.length + 1, editorLanguage)])
            }
            className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:border-navy-500 dark:text-gray-300"
          >
            + Cuenta
          </button>
        </div>
        <div className="space-y-2">
          {filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-2 dark:border-navy-600 md:grid-cols-2"
            >
              <input
                value={account.display_name}
                onChange={(event) =>
                  setAccounts((current) =>
                    current.map((entry) =>
                      entry.id === account.id ? { ...entry, display_name: event.target.value } : entry,
                    ),
                  )
                }
                placeholder="Nombre"
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
              />
              <input
                value={account.handle}
                onChange={(event) =>
                  setAccounts((current) =>
                    current.map((entry) =>
                      entry.id === account.id ? { ...entry, handle: event.target.value } : entry,
                    ),
                  )
                }
                placeholder="@handle"
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
              />
              <input
                value={account.profile_image_url ?? ""}
                onChange={(event) =>
                  setAccounts((current) =>
                    current.map((entry) =>
                      entry.id === account.id
                        ? { ...entry, profile_image_url: event.target.value || null }
                        : entry,
                    ),
                  )
                }
                placeholder="Avatar / media URL"
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200 md:col-span-2"
              />
              <input
                value={account.favorite_team_ids.join(",")}
                onChange={(event) =>
                  setAccounts((current) =>
                    current.map((entry) =>
                      entry.id === account.id
                        ? {
                            ...entry,
                            favorite_team_ids: event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          }
                        : entry,
                    ),
                  )
                }
                placeholder="Favorite team ids (coma)"
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200 md:col-span-2"
              />
              <div className="flex items-center justify-between md:col-span-2">
                <label className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={account.active}
                    onChange={(event) =>
                      setAccounts((current) =>
                        current.map((entry) =>
                          entry.id === account.id ? { ...entry, active: event.target.checked } : entry,
                        ),
                      )
                    }
                  />
                  Activa
                </label>
                <button
                  type="button"
                  onClick={() => setAccounts((current) => current.filter((entry) => entry.id !== account.id))}
                  className="rounded-full border border-red-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Templates ({filteredTemplates.length})
          </p>
          <button
            type="button"
            onClick={() =>
              setTemplates((current) => [...current, newTemplate(current.length + 1, editorLanguage)])
            }
            className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:border-navy-500 dark:text-gray-300"
          >
            + Template
          </button>
        </div>
        <div className="space-y-2">
          {filteredTemplates.map((template) => {
            const parsedConditions = parseConditions(template.conditions_json);
            return (
              <details key={template.id} className="rounded-lg border border-gray-200 p-2 text-xs dark:border-navy-600">
                <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200">
                  {template.id} · {template.slot} · w:{template.weight}
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="text-[11px] text-gray-500">
                      language
                      <select
                        value={template.language}
                        onChange={(event) =>
                          setTemplates((current) =>
                            current.map((entry) =>
                              entry.id === template.id ? { ...entry, language: event.target.value } : entry,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
                      >
                        <option value="all">all</option>
                        <option value="es">es</option>
                        <option value="fr">fr</option>
                        <option value="de">de</option>
                        <option value="en">en</option>
                      </select>
                    </label>
                    <label className="text-[11px] text-gray-500">
                      slot
                      <input
                        value={template.slot}
                        onChange={(event) =>
                          setTemplates((current) =>
                            current.map((entry) =>
                              entry.id === template.id ? { ...entry, slot: event.target.value } : entry,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
                      />
                    </label>
                    <label className="text-[11px] text-gray-500">
                      weight
                      <input
                        type="number"
                        min={1}
                        value={template.weight}
                        onChange={(event) => {
                          const nextWeight = Number.parseInt(event.target.value, 10);
                          setTemplates((current) =>
                            current.map((entry) =>
                              entry.id === template.id
                                ? { ...entry, weight: Number.isFinite(nextWeight) ? Math.max(1, nextWeight) : 1 }
                                : entry,
                            ),
                          );
                        }}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
                      />
                    </label>
                  </div>
                  <input
                    value={template.author_id ?? ""}
                    onChange={(event) =>
                      setTemplates((current) =>
                        current.map((entry) =>
                          entry.id === template.id
                            ? { ...entry, author_id: event.target.value || null }
                            : entry,
                        ),
                      )
                    }
                    placeholder="author_id (opcional)"
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
                  />
                  <textarea
                    value={template.variants.join("\n---\n")}
                    onChange={(event) =>
                      setTemplates((current) =>
                        current.map((entry) =>
                          entry.id === template.id
                            ? {
                                ...entry,
                                variants: event.target.value
                                  .split("\n---\n")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              }
                            : entry,
                        ),
                      )
                    }
                    className="min-h-[88px] w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="text-[11px] text-gray-500">
                      requires_stomp
                      <select
                        value={
                          typeof parsedConditions.requires_stomp === "boolean"
                            ? String(parsedConditions.requires_stomp)
                            : "any"
                        }
                        onChange={(event) => {
                          const next: TemplateConditions = { ...parsedConditions };
                          if (event.target.value === "any") delete next.requires_stomp;
                          else next.requires_stomp = event.target.value === "true";
                          setTemplates((current) =>
                            current.map((entry) =>
                              entry.id === template.id
                                ? { ...entry, conditions_json: stringifyConditions(next) }
                                : entry,
                            ),
                          );
                        }}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
                      >
                        <option value="any">any</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                    <label className="text-[11px] text-gray-500">
                      winner_team_slug
                      <input
                        value={parsedConditions.winner_team_slug ?? ""}
                        onChange={(event) => {
                          const next: TemplateConditions = {
                            ...parsedConditions,
                            winner_team_slug: event.target.value,
                          };
                          setTemplates((current) =>
                            current.map((entry) =>
                              entry.id === template.id
                                ? { ...entry, conditions_json: stringifyConditions(next) }
                                : entry,
                            ),
                          );
                        }}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-navy-500 dark:bg-navy-800 dark:text-gray-200"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1 self-end text-[11px] text-gray-500">
                      <input
                        type="checkbox"
                        checked={Boolean(parsedConditions.requires_player_name)}
                        onChange={(event) => {
                          const next: TemplateConditions = {
                            ...parsedConditions,
                            requires_player_name: event.target.checked,
                          };
                          setTemplates((current) =>
                            current.map((entry) =>
                              entry.id === template.id
                                ? { ...entry, conditions_json: stringifyConditions(next) }
                                : entry,
                            ),
                          );
                        }}
                      />
                      requires_player_name
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                      <input
                        type="checkbox"
                        checked={template.active}
                        onChange={(event) =>
                          setTemplates((current) =>
                            current.map((entry) =>
                              entry.id === template.id
                                ? { ...entry, active: event.target.checked }
                                : entry,
                            ),
                          )
                        }
                      />
                      Activo
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplates((current) => current.filter((entry) => entry.id !== template.id))
                      }
                      className="rounded-full border border-red-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
