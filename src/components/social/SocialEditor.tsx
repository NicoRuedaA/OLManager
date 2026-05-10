import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { GameStateData, PlayerData, TeamData } from "../../store/gameStore";
import type { SocialAccountData, SocialAuthorType, SocialTemplateData } from "../../store/types";
import {
  getSocialAccounts,
  getSocialTemplates,
  saveSocialAccounts,
  saveSocialTemplates,
} from "../../services/socialService";

interface SocialEditorProps {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
}

type TemplateConditions = {
  requires_stomp?: boolean;
  manager_result?: "win" | "loss";
  opponent_team_id?: string;
  winner_team_id?: string;
  loser_team_id?: string;
  winner_team_slug?: string;
  featured_player_id?: string;
  requires_player_name?: boolean;
};

type LanguageOption = {
  value: string;
  label: string;
  hint: string;
};

type SlotOption = {
  value: string;
  label: string;
  description: string;
  defaultAuthorType: SocialAuthorType;
};

const LANGUAGES: LanguageOption[] = [
  { value: "all", label: "Global", hint: "Se usa en cualquier idioma si no hay una version especifica." },
  { value: "es", label: "Espanol", hint: "Textos para jugadores en espanol." },
  { value: "en", label: "English", hint: "Textos para jugadores en ingles." },
  { value: "fr", label: "Francais", hint: "Textos para jugadores en frances." },
  { value: "de", label: "Deutsch", hint: "Textos para jugadores en aleman." },
  { value: "it", label: "Italiano", hint: "Textos para jugadores en italiano." },
  { value: "pt", label: "Portugues", hint: "Textos para jugadores en portugues." },
  { value: "pt-BR", label: "Portugues BR", hint: "Textos para jugadores en portugues brasileno." },
  { value: "tr", label: "Turkce", hint: "Textos para jugadores en turco." },
];

const SLOT_OPTIONS: SlotOption[] = [
  {
    value: "TeamBanter",
    label: "Broma del equipo ganador",
    description: "Post oficial del equipo que gano el partido.",
    defaultAuthorType: "Team",
  },
  {
    value: "FanOpinion",
    label: "Opinion de fans",
    description: "Reaccion de una cuenta fan o meme despues del partido.",
    defaultAuthorType: "Fan",
  },
  {
    value: "AnalystTake",
    label: "Analisis / prensa",
    description: "Lectura tactica o comentario de analista.",
    defaultAuthorType: "Analyst",
  },
  {
    value: "PlayerReaction",
    label: "Reaccion de jugador",
    description: "Post de un jugador destacado del equipo ganador.",
    defaultAuthorType: "Player",
  },
];

const AUTHOR_TYPES: Array<{ value: SocialAuthorType; label: string }> = [
  { value: "Fan", label: "Fan" },
  { value: "MemeAccount", label: "Cuenta meme" },
  { value: "Analyst", label: "Analista" },
  { value: "Journalist", label: "Periodista" },
  { value: "Team", label: "Equipo" },
  { value: "Player", label: "Jugador" },
  { value: "Manager", label: "Manager" },
];

const TOKENS = [
  { value: "{score}", label: "Resultado" },
  { value: "{winner_name}", label: "Equipo ganador" },
  { value: "{winner_short_name}", label: "Siglas ganador" },
  { value: "{loser_name}", label: "Equipo perdedor" },
  { value: "{loser_short_name}", label: "Siglas perdedor" },
  { value: "{winner_objectives}", label: "Objetivos ganados" },
  { value: "{player_name}", label: "Jugador destacado" },
];

const FIELD_CLASS =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary-400 dark:border-navy-500 dark:bg-navy-900 dark:text-gray-100";

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
  if (value.manager_result) normalized.manager_result = value.manager_result;
  if (value.opponent_team_id?.trim()) normalized.opponent_team_id = value.opponent_team_id.trim();
  if (value.winner_team_id?.trim()) normalized.winner_team_id = value.winner_team_id.trim();
  if (value.loser_team_id?.trim()) normalized.loser_team_id = value.loser_team_id.trim();
  if (value.winner_team_slug?.trim()) normalized.winner_team_slug = value.winner_team_slug.trim();
  if (value.featured_player_id?.trim()) normalized.featured_player_id = value.featured_player_id.trim();
  if (value.requires_player_name) normalized.requires_player_name = true;
  return JSON.stringify(normalized);
}

function languageLabel(value: string): string {
  return LANGUAGES.find((language) => language.value === value)?.label ?? value;
}

function slotLabel(value: string): string {
  return SLOT_OPTIONS.find((slot) => slot.value === value)?.label ?? value;
}

function newAccount(index: number, language: string): SocialAccountData {
  return {
    id: `custom_account_${Date.now()}_${index}`,
    language,
    display_name: "Nueva cuenta",
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
    variants: [""],
    tags: ["custom"],
    weight: 3,
    active: true,
  };
}

function updateTemplate(
  setTemplates: Dispatch<SetStateAction<SocialTemplateData[]>>,
  templateId: string,
  update: (template: SocialTemplateData) => SocialTemplateData,
): void {
  setTemplates((current) => current.map((template) => (template.id === templateId ? update(template) : template)));
}

function updateAccount(
  setAccounts: Dispatch<SetStateAction<SocialAccountData[]>>,
  accountId: string,
  update: (account: SocialAccountData) => SocialAccountData,
): void {
  setAccounts((current) => current.map((account) => (account.id === accountId ? update(account) : account)));
}

export default function SocialEditor({ gameState, onGameUpdate }: SocialEditorProps) {
  const [editorLanguage, setEditorLanguage] = useState("all");
  const [section, setSection] = useState<"templates" | "accounts">("templates");
  const [accounts, setAccounts] = useState<SocialAccountData[]>([]);
  const [templates, setTemplates] = useState<SocialTemplateData[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamsByName = useMemo(
    () => [...gameState.teams].sort((a, b) => a.name.localeCompare(b.name)),
    [gameState.teams],
  );

  const playersByName = useMemo(
    () => [...gameState.players].sort((a, b) => a.match_name.localeCompare(b.match_name)),
    [gameState.players],
  );

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => account.language === "all" || account.language === editorLanguage),
    [accounts, editorLanguage],
  );

  const visibleTemplates = useMemo(
    () => templates.filter((template) => template.language === "all" || template.language === editorLanguage),
    [templates, editorLanguage],
  );

  const selectedTemplate = useMemo(
    () => visibleTemplates.find((template) => template.id === selectedTemplateId) ?? visibleTemplates[0] ?? null,
    [selectedTemplateId, visibleTemplates],
  );

  const selectedAccount = useMemo(
    () => visibleAccounts.find((account) => account.id === selectedAccountId) ?? visibleAccounts[0] ?? null,
    [selectedAccountId, visibleAccounts],
  );

  const authorOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.active)
        .filter((account) => account.language === "all" || account.language === editorLanguage)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [accounts, editorLanguage],
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
      setSelectedAccountId((current) => current ?? loadedAccounts[0]?.id ?? null);
      setSelectedTemplateId((current) => current ?? loadedTemplates[0]?.id ?? null);
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
      const gameStateAfterSave = await saveSocialTemplates(templates);
      onGameUpdate(gameStateAfterSave);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el editor");
    } finally {
      setSaving(false);
    }
  }

  function addTemplate(): void {
    const template = newTemplate(templates.length + 1, editorLanguage);
    setTemplates((current) => [...current, template]);
    setSelectedTemplateId(template.id);
    setSection("templates");
  }

  function duplicateTemplate(template: SocialTemplateData): void {
    const copy: SocialTemplateData = {
      ...template,
      id: `${template.id}_copy_${Date.now()}`,
      variants: [...template.variants],
      tags: [...template.tags, "copy"],
    };
    setTemplates((current) => [...current, copy]);
    setSelectedTemplateId(copy.id);
  }

  function addAccount(): void {
    const account = newAccount(accounts.length + 1, editorLanguage);
    setAccounts((current) => [...current, account]);
    setSelectedAccountId(account.id);
    setSection("accounts");
  }

  useEffect(() => {
    void loadEditor();
  }, []);

  useEffect(() => {
    if (selectedTemplateId && visibleTemplates.some((template) => template.id === selectedTemplateId)) return;
    setSelectedTemplateId(visibleTemplates[0]?.id ?? null);
  }, [selectedTemplateId, visibleTemplates]);

  useEffect(() => {
    if (selectedAccountId && visibleAccounts.some((account) => account.id === selectedAccountId)) return;
    setSelectedAccountId(visibleAccounts[0]?.id ?? null);
  }, [selectedAccountId, visibleAccounts]);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-inner dark:border-navy-600 dark:bg-navy-900/40">
      <div className="border-b border-gray-200 bg-white p-4 dark:border-navy-600 dark:bg-navy-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-500">Editor social</p>
            <h3 className="mt-1 font-heading text-lg font-bold text-gray-950 dark:text-white">
              Tweets con reglas
            </h3>
            <p className="mt-1 max-w-xl text-xs text-gray-500 dark:text-gray-400">
              Agrega un tweet concreto, elige que cuenta lo publica y marca exactamente cuando debe aparecer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={editorLanguage}
              onChange={(event) => setEditorLanguage(event.target.value)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-navy-500 dark:bg-navy-900 dark:text-gray-200"
            >
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>{language.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void loadEditor();
              }}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 transition hover:bg-gray-100 disabled:opacity-50 dark:border-navy-500 dark:text-gray-300 dark:hover:bg-navy-700"
            >
              {loading ? "Cargando..." : "Recargar"}
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => {
                void saveEditor();
              }}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
          <strong>{languageLabel(editorLanguage)}:</strong> {LANGUAGES.find((language) => language.value === editorLanguage)?.hint}
        </div>
        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 bg-white p-4 dark:border-navy-600 dark:bg-navy-800/60 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={() => setSection("templates")}
              className={`rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition ${section === "templates" ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-navy-700 dark:text-gray-300"}`}
            >
              Tweets ({visibleTemplates.length})
            </button>
            <button
              type="button"
              onClick={() => setSection("accounts")}
              className={`rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition ${section === "accounts" ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-navy-700 dark:text-gray-300"}`}
            >
              Cuentas ({visibleAccounts.length})
            </button>
          </div>

          {section === "templates" ? (
            <TemplateList
              templates={visibleTemplates}
              selectedTemplateId={selectedTemplate?.id ?? null}
              onAdd={addTemplate}
              onSelect={setSelectedTemplateId}
            />
          ) : (
            <AccountList
              accounts={visibleAccounts}
              selectedAccountId={selectedAccount?.id ?? null}
              onAdd={addAccount}
              onSelect={setSelectedAccountId}
            />
          )}
        </aside>

        <main className="min-h-[520px] p-5 lg:p-6">
          {section === "templates" ? (
            selectedTemplate ? (
              <TemplateEditor
                accounts={authorOptions}
                players={playersByName}
                teams={teamsByName}
                template={selectedTemplate}
                onDuplicate={() => duplicateTemplate(selectedTemplate)}
                onDelete={() => {
                  setTemplates((current) => current.filter((template) => template.id !== selectedTemplate.id));
                  setSelectedTemplateId(null);
                }}
                onUpdate={(update) => updateTemplate(setTemplates, selectedTemplate.id, update)}
              />
            ) : (
              <EmptyState title="No hay tweets" body="Crea un tweet concreto y despues elegi sus reglas de aparicion." action="Crear tweet" onAction={addTemplate} />
            )
          ) : selectedAccount ? (
            <AccountEditor
              account={selectedAccount}
              teams={teamsByName}
              onDelete={() => {
                setAccounts((current) => current.filter((account) => account.id !== selectedAccount.id));
                setSelectedAccountId(null);
              }}
              onUpdate={(update) => updateAccount(setAccounts, selectedAccount.id, update)}
            />
          ) : (
            <EmptyState title="No hay cuentas" body="Crea una cuenta fan, meme o analista para usarla como autor." action="Crear cuenta" onAction={addAccount} />
          )}
        </main>
      </div>
    </div>
  );
}

function TemplateList({
  templates,
  selectedTemplateId,
  onAdd,
  onSelect,
}: {
  templates: SocialTemplateData[];
  selectedTemplateId: string | null;
  onAdd: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onAdd}
        className="w-full rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 transition hover:bg-gray-50 dark:border-navy-500 dark:text-gray-300 dark:hover:bg-navy-700"
      >
        + Nuevo tweet
      </button>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className={`w-full rounded-xl border p-3 text-left transition ${template.id === selectedTemplateId ? "border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-500/10" : "border-gray-200 bg-white hover:bg-gray-50 dark:border-navy-600 dark:bg-navy-800 dark:hover:bg-navy-700"}`}
          >
            <span className="block truncate text-xs font-bold text-gray-950 dark:text-white">{template.variants[0] || "Tweet sin escribir"}</span>
            <span className="mt-1 block text-[11px] text-gray-500 dark:text-gray-400">{slotLabel(template.slot)}</span>
            <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-navy-700 dark:text-gray-300">
              {languageLabel(template.language)} · peso {template.weight}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountList({
  accounts,
  selectedAccountId,
  onAdd,
  onSelect,
}: {
  accounts: SocialAccountData[];
  selectedAccountId: string | null;
  onAdd: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onAdd}
        className="w-full rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 transition hover:bg-gray-50 dark:border-navy-500 dark:text-gray-300 dark:hover:bg-navy-700"
      >
        + Nueva cuenta
      </button>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => onSelect(account.id)}
            className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left transition ${account.id === selectedAccountId ? "border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-500/10" : "border-gray-200 bg-white hover:bg-gray-50 dark:border-navy-600 dark:bg-navy-800 dark:hover:bg-navy-700"}`}
          >
            <AvatarPreview account={account} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-gray-950 dark:text-white">{account.display_name}</span>
              <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{account.handle}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({
  accounts,
  players,
  teams,
  template,
  onDuplicate,
  onDelete,
  onUpdate,
}: {
  accounts: SocialAccountData[];
  players: PlayerData[];
  teams: TeamData[];
  template: SocialTemplateData;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdate: (update: (template: SocialTemplateData) => SocialTemplateData) => void;
}) {
  const conditions = parseConditions(template.conditions_json);
  const slot = SLOT_OPTIONS.find((option) => option.value === template.slot) ?? SLOT_OPTIONS[1];

  function updateConditions(update: (conditions: TemplateConditions) => TemplateConditions): void {
    onUpdate((current) => ({ ...current, conditions_json: stringifyConditions(update(parseConditions(current.conditions_json))) }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tweet concreto</p>
          <h4 className="font-heading text-xl font-bold text-gray-950 dark:text-white">{template.variants[0] || "Tweet sin escribir"}</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{slot.label}: {slot.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDuplicate} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-bold text-gray-600 dark:border-navy-500 dark:text-gray-300">
            Duplicar
          </button>
          <button type="button" onClick={onDelete} className="rounded-full border border-red-300 px-3 py-1 text-xs font-bold text-red-500">
            Eliminar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">1. Tweet</p>
            <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-100/80">Un registro es un tweet. Si queres otro chiste o easter egg, crea otro tweet con sus propias reglas.</p>
          </div>
        </div>
        <textarea
          value={template.variants[0] ?? ""}
          onChange={(event) => onUpdate((current) => ({ ...current, variants: [event.target.value] }))}
          placeholder="Ej: No puedo creer que {player_name} nos haya ganado asi."
          className="min-h-[128px] w-full rounded-xl border border-emerald-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-emerald-500 dark:border-emerald-500/40 dark:bg-navy-900 dark:text-gray-100"
        />
        {template.variants.length > 1 ? (
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-100">
            Este tweet venia de un template antiguo con {template.variants.length} variantes. Al editarlo se simplifica a un tweet concreto.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Field label="2. Donde aparece">
          <select
            value={template.slot}
            onChange={(event) => onUpdate((current) => ({ ...current, slot: event.target.value }))}
            className={FIELD_CLASS}
          >
            {SLOT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Idioma">
          <select
            value={template.language}
            onChange={(event) => onUpdate((current) => ({ ...current, language: event.target.value }))}
            className={FIELD_CLASS}
          >
            {LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>{language.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Frecuencia si hay varios que coinciden">
          <select
            value={String(template.weight)}
            onChange={(event) => onUpdate((current) => ({ ...current, weight: Number.parseInt(event.target.value, 10) }))}
            className={FIELD_CLASS}
          >
            <option value="1">Rara</option>
            <option value="3">Normal</option>
            <option value="5">Frecuente</option>
            <option value="8">Muy frecuente</option>
          </select>
        </Field>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-navy-600 dark:bg-navy-800">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">3. Cuando aparece</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Marca solo lo necesario. Ejemplo: "Mi equipo pierde" + "Jugador destacado X".</p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-navy-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={template.active}
              onChange={(event) => onUpdate((current) => ({ ...current, active: event.target.checked }))}
            />
            Activo
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Field label="Tipo de resultado">
            <select
              value={typeof conditions.requires_stomp === "boolean" ? String(conditions.requires_stomp) : "any"}
              onChange={(event) => {
                updateConditions((current) => {
                  const next = { ...current };
                  if (event.target.value === "any") delete next.requires_stomp;
                  else next.requires_stomp = event.target.value === "true";
                  return next;
                });
              }}
              className={FIELD_CLASS}
            >
              <option value="any">Cualquier resultado</option>
              <option value="true">Paliza / stomp</option>
              <option value="false">Partido igualado</option>
            </select>
          </Field>
          <Field label="Mi equipo">
            <select
              value={conditions.manager_result ?? "any"}
              onChange={(event) => {
                updateConditions((current) => {
                  const next = { ...current };
                  if (event.target.value === "any") delete next.manager_result;
                  else next.manager_result = event.target.value as "win" | "loss";
                  return next;
                });
              }}
              className={FIELD_CLASS}
            >
              <option value="any">Da igual si gano o pierdo</option>
              <option value="win">Solo si mi equipo gana</option>
              <option value="loss">Solo si mi equipo pierde</option>
            </select>
          </Field>
          <Field label="Contra equipo concreto">
            <select
              value={conditions.opponent_team_id ?? ""}
              onChange={(event) => {
                updateConditions((current) => {
                  const next: TemplateConditions = { ...current, opponent_team_id: event.target.value };
                  if (!event.target.value) delete next.opponent_team_id;
                  return next;
                });
              }}
              className={FIELD_CLASS}
            >
              <option value="">Cualquier rival</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Equipo ganador concreto">
            <select
              value={conditions.winner_team_id ?? ""}
              onChange={(event) => {
                updateConditions((current) => {
                  const next: TemplateConditions = { ...current, winner_team_id: event.target.value };
                  if (!event.target.value) delete next.winner_team_id;
                  return next;
                });
              }}
              className={FIELD_CLASS}
            >
              <option value="">Cualquier equipo</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Equipo perdedor concreto">
            <select
              value={conditions.loser_team_id ?? ""}
              onChange={(event) => {
                updateConditions((current) => {
                  const next: TemplateConditions = { ...current, loser_team_id: event.target.value };
                  if (!event.target.value) delete next.loser_team_id;
                  return next;
                });
              }}
              className={FIELD_CLASS}
            >
              <option value="">Cualquier equipo</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Jugador destacado concreto">
            <select
              value={conditions.featured_player_id ?? ""}
              onChange={(event) => {
                updateConditions((current) => {
                  const next: TemplateConditions = { ...current, featured_player_id: event.target.value };
                  if (!event.target.value) delete next.featured_player_id;
                  return next;
                });
              }}
              className={FIELD_CLASS}
            >
              <option value="">Cualquier jugador</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>{player.match_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Necesita jugador destacado">
            <select
              value={conditions.requires_player_name ? "yes" : "no"}
              onChange={(event) => {
                updateConditions((current) => {
                  const next: TemplateConditions = { ...current, requires_player_name: event.target.value === "yes" };
                  if (event.target.value === "no") delete next.requires_player_name;
                  return next;
                });
              }}
              className={FIELD_CLASS}
            >
              <option value="no">No hace falta</option>
              <option value="yes">Si, usa jugador destacado</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-navy-600 dark:bg-navy-800">
        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Field label="Quien publica">
            <select
              value={template.author_id ?? ""}
              onChange={(event) => onUpdate((current) => ({ ...current, author_id: event.target.value || null }))}
              className={FIELD_CLASS}
            >
              <option value="">Automatico segun tipo de post</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.display_name} ({account.handle})</option>
              ))}
            </select>
          </Field>
          <Field label="Etiquetas internas">
            <input
              value={template.tags.join(", ")}
              onChange={(event) =>
                onUpdate((current) => ({
                  ...current,
                  tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))
              }
              placeholder="fan, close-game, meme"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        <div className="mb-4 rounded-xl bg-gray-50 p-4 dark:bg-navy-900/60">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Variables disponibles</p>
          <div className="flex flex-wrap gap-2">
            {TOKENS.map((token) => (
              <span key={token.value} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-300">
                <strong>{token.label}</strong> {token.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountEditor({
  account,
  teams,
  onDelete,
  onUpdate,
}: {
  account: SocialAccountData;
  teams: TeamData[];
  onDelete: () => void;
  onUpdate: (update: (account: SocialAccountData) => SocialAccountData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <AvatarPreview account={account} large />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Cuenta social</p>
            <h4 className="font-heading text-xl font-bold text-gray-950 dark:text-white">{account.display_name}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{account.handle}</p>
          </div>
        </div>
        <button type="button" onClick={onDelete} className="rounded-full border border-red-300 px-3 py-1 text-xs font-bold text-red-500">
          Eliminar
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-navy-600 dark:bg-navy-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Nombre visible">
            <input value={account.display_name} onChange={(event) => onUpdate((current) => ({ ...current, display_name: event.target.value }))} className={FIELD_CLASS} />
          </Field>
          <Field label="Usuario / handle">
            <input value={account.handle} onChange={(event) => onUpdate((current) => ({ ...current, handle: event.target.value }))} className={FIELD_CLASS} />
          </Field>
          <Field label="Idioma de la cuenta">
            <select value={account.language} onChange={(event) => onUpdate((current) => ({ ...current, language: event.target.value }))} className={FIELD_CLASS}>
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>{language.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de autor">
            <select value={account.author_type} onChange={(event) => onUpdate((current) => ({ ...current, author_type: event.target.value as SocialAuthorType }))} className={FIELD_CLASS}>
              {AUTHOR_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </Field>
          <Field label="URL de avatar">
            <input value={account.profile_image_url ?? ""} onChange={(event) => onUpdate((current) => ({ ...current, profile_image_url: event.target.value || null }))} placeholder="https://..." className={FIELD_CLASS} />
          </Field>
          <Field label="Estado">
            <select value={account.active ? "active" : "inactive"} onChange={(event) => onUpdate((current) => ({ ...current, active: event.target.value === "active" }))} className={FIELD_CLASS}>
              <option value="active">Activa</option>
              <option value="inactive">Desactivada</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-navy-600 dark:bg-navy-800">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Equipos favoritos</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Sirve para cuentas fan. Marca equipos si queres que esta cuenta represente a una comunidad concreta.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const checked = account.favorite_team_ids.includes(team.id);
            return (
              <label key={team.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${checked ? "border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-500/10 dark:text-primary-200" : "border-gray-200 text-gray-600 dark:border-navy-600 dark:text-gray-300"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    onUpdate((current) => ({
                      ...current,
                      favorite_team_ids: event.target.checked
                        ? [...current.favorite_team_ids, team.id]
                        : current.favorite_team_ids.filter((teamId) => teamId !== team.id),
                    }));
                  }}
                />
                {team.name}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AvatarPreview({ account, large = false }: { account: SocialAccountData; large?: boolean }) {
  const size = large ? "h-14 w-14" : "h-10 w-10";
  return (
    <span className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary-500 to-accent-400 font-heading text-xs font-bold text-white`}>
      {account.display_name.slice(0, 2).toUpperCase()}
      {account.profile_image_url ? (
        <img
          src={account.profile_image_url}
          alt={account.display_name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-gray-500 dark:text-gray-400">
      <span className="mb-2 block uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center dark:border-navy-600 dark:bg-navy-800">
      <h4 className="font-heading text-lg font-bold text-gray-950 dark:text-white">{title}</h4>
      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">{body}</p>
      <button type="button" onClick={onAction} className="mt-4 rounded-full bg-primary-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
        {action}
      </button>
    </div>
  );
}
