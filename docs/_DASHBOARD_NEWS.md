# News System — Architecture & Usage

## Overview

The news system generates articles automatically during gameplay (match reports,
standings updates, transfer rumours, storylines, etc.) and displays them in the
**News** tab of the dashboard. Articles travel embedded in the `Game` state from
Rust to the frontend — there is no separate API or polling.

---

## Data flow

```
Rust Backend                              Frontend
───────────                               ─────────
game.news.push(article)  ──┐
                           │
StateManager::set_game()   ├── JSON response ──→ gameState.news
                           │                        │
                    (every Tauri invoke        resolveNewsArticle()
                     that mutates game)            │
                                                   ▼
                                             NewsTab (v1/v2)
                                          ArticleCard / HeroArticle
                                               / ArticleDetail
```

**Key points:**
- News is **never fetched separately** — it's always part of the `Game` state.
- `resolveNewsArticle()` in `src/lib/i18n/backendI18n.ts` resolves `headline_key`,
  `body_key`, and `source_key` using the active locale, falling back to the
  raw English text embedded in the article.

---

## News types & triggers

| Article type | `NewsCategory` | Trigger | Rust function |
|---|---|---|---|
| Season Preview | `SeasonPreview` | `start_new_game` | `season_preview_article()` |
| Match Report | `MatchReport` | Match completed (live or sim) | `match_report_article()` |
| League Roundup | `LeagueRoundup` | End of matchday | `league_roundup_article()` |
| Standings Update | `StandingsUpdate` | End of matchday | `standings_update_article()` |
| Weekly Digest | `Editorial` | Every Monday | `weekly_digest_article()` |
| Title Race Storyline | `Editorial` | Weekly digest, leader ≤3 pts ahead | `title_race_storyline_article()` |
| Unbeaten Streak Storyline | `Editorial` | Weekly digest, any team ≥5 undefeated | `unbeaten_streak_storyline_article()` |
| Major Transfer | `TransferRumour` | Transfer completed ≥$1M | `major_transfer_article()` |
| Injury News | `InjuryNews` | Internal simulation | _(inline)_ |
| Managerial Change | `ManagerialChange` | Firing/hiring cycle | _(inline)_ |

All news generation happens in `src-tauri/crates/olm_core/src/`:

| File | Role |
|---|---|
| `news.rs` | Generation functions for each article type |
| `news/match_report.rs` | Match report generation (separate module) |
| `news/template_store.rs` | Template-based article builder (new) |
| `turn/news.rs` | Orchestrator — calls generators on matchdays, mondays, etc. |
| `domain/news.rs` | `NewsArticle` & `NewsCategory` types |

---

## Template system (data-driven)

Instead of hardcoding headlines, bodies, and sources in Rust, templates live in
`data/news/` as JSON files and are **embedded at compile time** via
`include_str!()`.

### Directory structure

```
data/news/
├── season_preview/
│   └── template.json          # SeasonPreview category
└── editorial/
    ├── weekly_digest.json      # Editorial — id: "weekly_digest"
    ├── title_race.json         # Editorial — id: "title_race"
    └── unbeaten_streak.json    # Editorial — id: "unbeaten_streak"
```

### JSON schema

```json
{
  "id": "unique_template_id",
  "category": "SeasonPreview | Editorial | LeagueRoundup | …",
  "headlines": [
    { "key": "be.news.section.headline0", "text": "Headline with {placeholder}" }
  ],
  "body": "Body text with {placeholder}",
  "body_key": "be.news.section.body",
  "body_variants": [
    { "body_key": "be.news.section.bodyVariant", "text": "Alternative body" }
  ],
  "sources": [
    { "key": "be.source.riftHerald", "text": "Riot Games Newsroom" }
  ],
  "translations": {
    "es": {
      "headlines": [
        { "key": "be.news.section.headline0", "text": "Título traducido" }
      ],
      "body": "Cuerpo traducido",
      "body_variants": []
    }
  }
}
```

**Fields:**
- `id` — unique string ID for `get_by_id()` lookups (required for Editorials)
- `category` — must match a `NewsCategory` variant name
- `headlines` — array of variants; one is picked randomly per article
- `body` + `body_key` — default body (optional if only `body_variants` are used)
- `body_variants` — alternative bodies, selected by index from the caller (e.g. weekly digest uses variant 0 when no top scorer, variant 1 when there is one)
- `sources` — array of journalist sources; one is picked randomly
- `translations` — per-language overrides for any of the above fields

### How it works in Rust

```rust
// Lookup
let tpl = NewsTemplateStore::global().get(&NewsCategory::SeasonPreview)?;
let tpl = NewsTemplateStore::global().get_by_id("weekly_digest")?;

// Build article
let article = tpl.build_article(
    "unique_id".to_string(),
    date.to_string(),
    &[("placeholder", "value")],
    "en",              // language code
    Some(0),           // body_variant index (None for default body)
);
```

The `NewsTemplateStore` uses a `OnceLock` global singleton, same pattern as
`messages/template_store.rs`. Templates are loaded once at first access and
never reloaded (they're embedded in the binary).

### Indexing strategy

- **`by_category`** — one template per `NewsCategory`. Used for categories that
  have a single article type (SeasonPreview, LeagueRoundup, etc.)
- **`by_id`** — multiple templates per category. Used for `Editorial` where
  weekly digest, title race, and unbeaten streak all share the category.

### Adding a new template

1. Create `data/news/<category>/<file>.json`
2. In `news/template_store.rs`, add a `load_template!()` call:
   ```rust
   load_template!(
       "../../../../../data/news/<category>/<file>.json",
       "<label>"
   );
   ```
3. In the Rust generation function, replace hardcoded strings with:
   ```rust
   let tpl = NewsTemplateStore::global().get_by_id("<id>")
       .expect("Template <id> not found");
   tpl.build_article(…)
   ```
4. Rebuild the binary — the JSON is embedded at compile time.

---

## Frontend

### Wrapper

`NewsTabV2` (`src/ui-v2/dashboard/tabs/NewsTabV2.tsx`) delegates to the legacy
`NewsTab` component from `src/components/news/NewsTab.tsx` inside a
`.news-v2` container.

### Legacy component

`NewsTab` (`src/components/news/NewsTab.tsx`):

- Reads `gameState.news`, maps through `resolveNewsArticle()`
- Sorts by date descending
- Filters by category (pills) and team (dropdown)
- Paginates 13 articles per page (1 hero + 12 grid)
- Two views: list (hero + grid) and detail (`ArticleDetail`)

```
┌─────────────────────────────────────────┐
│  [All] [Match Report] [Standings] …     │  ← category pills
│                         [All Teams ▾]   │  ← team filter
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ Hero Article (latest)           │    │  ← HeroArticle
│  └─────────────────────────────────┘    │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ Card │ │ Card │ │ Card │           │  ← ArticleCard grid
│  └──────┘ └──────┘ └──────┘           │
│  ───── 1 / 3 ─────                     │  ← pagination
└─────────────────────────────────────────┘
```

### Article detail

Clicking any article opens `ArticleDetail`, a full-width view with back
navigation, category badge, headline, optional match score block, body text,
and team/player links.

### i18n resolution

`resolveNewsArticle()` in `src/lib/i18n/backendI18n.ts`:

```typescript
function resolveNewsArticle(article: NewsArticle): NewsArticle {
  const p = normalizeNewsParams(article);
  return {
    ...article,
    headline: resolve(article.headline_key, article.headline, p),
    body: resolve(article.body_key, article.body, p),
    source: resolve(article.source_key, article.source, p),
  };
}
```

If the active locale has a translation for the `headline_key` / `body_key` /
`source_key`, it's used; otherwise the raw English text from the Rust struct
is the fallback.

---

## Home tab integration

The Home tab (`HomeTabV2`) shows the latest **League Roundup** and
**Standings Update** articles via `getLeagueDigestArticles()` helper. This runs
through the same `resolveNewsArticle()` pipeline.

---

## Gotchas

- **Deduplication** is handled in `turn/news.rs` by checking if an article with
  the same `id` already exists in `game.news` before pushing.
- **Template parsing panics** at startup if a JSON file is invalid — this is
  intentional (fail fast). Messages are clear: `"Failed to parse <label>: <e>"`.
- **Translations** in the template JSON are optional. Missing translations
  silently fall back to the default (English) text.
- **`body_variants` vs `body`**: if a template only uses `body_variants`,
  omit `body` and `body_key` in the JSON. The Rust struct handles both cases.
- **Editorials** must be looked up by `id`, not by `NewsCategory`. The
  `get_by_id()` method exists specifically for this.
