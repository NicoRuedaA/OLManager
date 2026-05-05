# UI Decision Cards

Decision cards are used when the player chooses between gameplay/management options, such as training focus, tactics, or post-scrim actions.

## Goal

Keep decision surfaces visually consistent across Training, Tactics, Scrims, and future management modules.

## Base Style

Decision cards should follow the Training/Tactics pattern:

- Same background plane as the parent module; avoid darker nested panels unless the whole section requires grouping.
- Separate options with borders, not colored blocks.
- Use neutral borders by default:
  - light: `border-gray-200`
  - dark: `dark:border-navy-600`
- Use `border-2` for selectable cards.
- Use neutral hover:
  - light: `hover:border-gray-300`
  - dark: `dark:hover:border-navy-500`
- Reserve `primary` styling for an actual selected/recommended state, not for normal containers.
- Avoid semantic color noise (`emerald`, `rose`, `amber`) inside decision options unless representing a real alert state.

## Card Content Structure

Each decision card should contain:

1. Optional icon, matching the module style.
2. Title in heading font, uppercase, bold.
3. Short description, 1–2 lines.
4. Impact tags, using the same visual language as Training attribute tags.

Example structure:

```tsx
<button className="rounded-xl border-2 border-gray-200 bg-transparent p-4 text-left transition-all hover:border-gray-300 dark:border-navy-600 dark:hover:border-navy-500">
  <Icon className="mb-2 h-5 w-5 text-gray-600 dark:text-gray-300" />
  <p className="font-heading text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
    Practice Champion Pool
  </p>
  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
    Refine comfort picks and mechanical patterns.
  </p>
  <div className="mt-3 flex flex-wrap gap-2">
    <span className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">Mechanics +</span>
    <span className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">Champion Pool +</span>
    <span className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">Laning +</span>
  </div>
</button>
```

## Impact Tags

Impact tags explain what the decision improves or worsens.

Rules:

- Use compact labels: `Mental +`, `Volumen -`, `Mecánicas +`.
- Keep tags visually neutral; the `+`/`-` conveys direction.
- Avoid green/red coloring for normal tradeoffs.
- Prefer domain language the player already sees elsewhere.
- Keep each card to 2–4 tags.

Good examples:

- `Mecánicas +`
- `Champion Pool +`
- `Fatiga -`
- `Recuperación +`
- `Volumen -`
- `Mental +`

Bad examples:

- Large colored impact panels inside each card.
- Red/green badges for every positive/negative effect.
- Long sentences as tags.
- Cards with a darker background than their parent module.

## Scrims-Specific Guidance

Post-scrim decisions should use the same card pattern as Training focus cards.

Examples:

- `Push Through`: `Volumen +`, `Aprendizaje +`, `Mental -`
- `Cancelar scrims`: `Recuperación +`, `Riesgo -`, `Volumen -`
- `VOD Review`: `Análisis +`, `Calidad +`, `Recuperación -`
- `Mental Reset`: `Mental +`, `Recuperación +`, `Técnica -`
- `Targeted Drills`: `Issue +`, `Mecánicas +`, `Fatiga -`

## Principle

Decision cards are not alert panels. They are choice surfaces. Use consistent neutral UI first, then communicate tradeoffs through compact tags.
