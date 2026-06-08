# Social Feed — Architecture & Usage

## Overview

The Social Feed simulates a Twitter/X-style timeline of posts generated
automatically after each live match. Accounts belong to teams, fans, analysts,
journalists, and players — each with their own personality, language, and
favorite teams. The manager can also publish their own posts (280 chars max).

Posts are **generated in Rust using templates with deterministic seeding**, so
the same match always produces the same posts. The frontend simply renders what
the backend sends.

---

## Data flow

```
MATCH ENDS (live_match.rs)
       │
       ▼
generate_match_social_posts()
  │
  ├─ ensure_social_registry_defaults()  ← loads accounts/templates if empty
  ├─ Determines winner/loser/score/stomp/featured_player
  ├─ Builds MatchTemplateContext
  ├─ Per slot (TeamBanter / FanOpinion / AnalystTake / PlayerReaction):
  │   └─ select_match_template_for_language()
  │       ├─ game.social_templates (user overrides from DB)
  │       └─ fallback: social_match_templates.json (embedded)
  ├─ Calculates engagement (likes/reposts/replies) with deterministic seed
  └─ game.social_posts.extend([...])
        │
        ▼
StateManager::set_game()
        │
        ▼
JSON response → Tauri invoke
        │
        ▼
SocialTab (frontend)
  ├─ get_social_feed() → game.social_posts
  ├─ Sorted by date DESC
  ├─ Filtered by language (Bouzys easter egg only shows in ES)
  └─ Rendered: avatar + name + handle + body + badges + actions

LANGUAGE SWITCH
       │
       ▼
relocalizeSocialFeed(lang)
       │
       ▼
relocalize_social_posts()
  └─ Regenerates body of all existing posts using templates in new language
```

---

## Trigger

Posts are generated **only for live matches** — simulated background matches do
not produce social content.

| Trigger | Location | Function |
|---|---|---|
| Live match ends | `src/application/live_match.rs:348` | `generate_match_social_posts()` |
| Manager publishes | UI → `socialService.createManagerSocialPost()` | `publish_manager_post()` |

---

## Posts generated per match

Each live match produces **6–7 posts**:

| # | Author type | Sentiment | Source |
|---|---|---|---|
| 1 | Team (winner) | Hype | Template (TeamBanter slot) |
| 2 | Team (loser) | Worried | Hardcoded `team_loser_post_text()` |
| 3 | Fan | varies | Template (FanOpinion slot) |
| 4 | Analyst | varies | Template (AnalystTake slot) |
| 5 | Fan of winner team | varies | Hardcoded `team_fan_reaction_text()` |
| 6 | Fan of loser team | varies | Hardcoded `team_fan_reaction_text()` |
| 7 | Player (MVP) | varies | Template (PlayerReaction slot), if featured player exists |

Plus an **easter egg**: if Fnatic loses and the locale is Spanish, a special
Bouzys post is generated (`bouzys_vs_fnatic_text()`).

---

## Template system

Templates live in two places:

### 1. Base templates (embedded JSON)

**File:** `src-tauri/crates/olm_core/src/social_match_templates.json`

32 templates across 8 languages and 4 slots:

| Language | Slots | Variants per slot |
|---|---|---|
| `es, en, fr, de, it, pt, pt-BR, tr` | TeamBanter, FanOpinion, AnalystTake, PlayerReaction | 3 variants each |

Example (Spanish TeamBanter):
```json
{
  "id": "team-global-es",
  "language": "es",
  "slot": "TeamBanter",
  "weight": 5,
  "variants": [
    "GG {loser_short_name}. Buen partido y seguimos sumando. {score}",
    "Victoria importante. Gracias a todos los que nos apoyaron hoy. #Vamos{winner_short_name}",
    "Cerramos la serie con calma, buen macro y mucha confianza. {score}"
  ]
}
```

### 2. User overrides (DB)

Players can create custom templates via the **Social Editor** UI. These are
stored in `game.social_templates` (SQLite-backed). They have priority over base
templates and support **runtime conditions**:

```json
{
  "conditions": {
    "requires_stomp": true,
    "manager_result": "win",
    "opponent_team_id": "team_xxx"
  }
}
```

### Template tokens

Rendered via `render_text()` in `social_templates.rs`:

| Token | Replaced with |
|---|---|
| `{score}` | `"2 - 1"` |
| `{winner_name}` | Full team name |
| `{winner_short_name}` | Short name (e.g. `G2`) |
| `{loser_name}` | Full team name |
| `{loser_short_name}` | Short name |
| `{winner_objectives}` | Drake/Baron counts |
| `{player_name}` | Featured player name |

### Selection algorithm

`select_match_template_for_language()` in `social_templates.rs`:

```
1. Filter overrides matching slot + language + runtime_conditions
2. If none found, fall back to base templates from social_match_templates.json
3. If no match in target language, fall back to English
4. Pick with weighted random using deterministic_index(seed)
   → seed = hash(fixture_id + winner_id + score)
   → Same match always picks the same variant
```

---

## Accounts

### Default accounts

Defined in `social_registry.rs` — 35+ accounts with real Twitter personas:

| Account | Author type | Language | Fandom |
|---|---|---|---|
| CATXALOTE | Fan | es | Fnatic |
| DvD | Analyst | en | G2 |
| fezzysucks | Fan | en | Heretics |
| LEC Enjoyer | Fan | en | General |
| Manu | Analyst | es | General |
| Rift Newswire | Journalist | en | General |
| SoloQ Chaos | MemeAccount | en | General |
| ... | ... | ... | ... |

Each account has:
- `display_name`, `handle`, `author_type`, `language`, `favorite_team_ids`, `profile_image_url`, `active`

### Custom accounts

Managers can create/edit accounts via the Social Editor UI, persisted to DB.

---

## Engagement

Likes, reposts, and replies are calculated deterministically:

```rust
fn engagement(team_reputation: u32, seed: u64) -> (u32, u32, u32)
```

- Based on the winner's team reputation (higher reputation = more engagement)
- Seeded with a hash of `fixture_id + winner_id` for reproducibility
- Range varies by author type (team posts get more engagement than fan posts)

---

## Frontend

### Component hierarchy

```
SocialTabV2 (ui-v2 wrapper)
  └── SocialTab (legacy)
        ├── Header: title + composer button
        ├── Composer: textarea (280 chars) + "Postear" button
        └── Timeline
              └── SocialPost[] sorted by date DESC
                    ├── Avatar (gradient by author_type)
                    ├── Name + Handle + Verification badge
                    ├── Date
                    ├── Body
                    ├── Media (optional)
                    ├── Badges: author_type + sentiment
                    └── Actions: likes / reposts / replies (local count)
```

### Files

| File | Path | Role |
|---|---|---|
| `SocialTabV2.tsx` | `src/ui-v2/dashboard/tabs/SocialTabV2.tsx` | v2 wrapper (delegates to legacy) |
| `SocialTab.tsx` | `src/components/social/SocialTab.tsx` | Real timeline component (419 lines) |
| `SocialEditor.tsx` | `src/components/social/SocialEditor.tsx` | Admin editor for templates & accounts |
| `socialService.ts` | `src/services/socialService.ts` | Tauri invoke wrappers |

### Services

| Function | Command | Description |
|---|---|---|
| `getSocialFeed()` | `social.getFeed` | Returns all posts |
| `createManagerSocialPost(text)` | `social.createPost` | Publish as manager |
| `getSocialAccounts()` | `social.getAccounts` | List accounts |
| `saveSocialAccounts(accounts)` | `social.saveAccounts` | Save accounts |
| `getSocialTemplates()` | `social.getTemplates` | List templates |
| `saveSocialTemplates(templates)` | `social.saveTemplates` | Save templates |
| `relocalizeSocialFeed(language)` | `social.relocalize` | Regenerate post bodies in new language |

### i18n

The frontend **does not translate post bodies**. Bodies are generated in the
backend in the correct language at match time, based on the active locale. When
the user switches language:

1. `relocalizeSocialFeed(lang)` sends the new locale to Rust
2. `relocalize_social_posts()` regenerates the `body` of every existing post
   using templates in the new language
3. UI re-renders with updated bodies

The only frontend i18n strings are UI chrome: `social.title`,
`social.emptyTitle`, `social.composerPlaceholder`, etc.

---

## Rust backend

### Module structure

| File | Path | Lines | Role |
|---|---|---|---|
| `domain/social.rs` | `src-tauri/crates/olm_core/src/domain/social.rs` | 160+ | Types: SocialPost, SocialAccount, SocialTemplate, enums |
| `social.rs` | `src-tauri/crates/olm_core/src/social.rs` | 923 | Main generation logic |
| `social_templates.rs` | `src-tauri/crates/olm_core/src/social_templates.rs` | 537 | Template selection + rendering |
| `social_registry.rs` | `src-tauri/crates/olm_core/src/social_registry.rs` | 467 | Default accounts |
| `social_match_templates.json` | `src-tauri/crates/olm_core/src/social_match_templates.json` | 419 | Base templates (embedded) |
| `commands/social.rs` | `src-tauri/src/commands/social.rs` | 92 | Tauri command handlers |
| `db/repositories/social_repo.rs` | `src-tauri/crates/olm_core/src/db/repositories/social_repo.rs` | 257 | SQLite CRUD |

### Hardcoded fallback text

Three functions generate text without templates (for specific author types):

**`team_loser_post_text(language, team, opponent, score, seed)`**
- Used for the losing team's post
- Supports: `es`, `pt-BR`, `de`, `fr`, `tr`, `en`
- Example (ES): *"Hemos perdido contra {opponent} por {score}. Duele, pero esto no acaba aquí."*

**`team_fan_reaction_text(language, won, team, opponent, score, seed)`**
- Used for fan reactions (both winner and loser fan accounts)
- 4 seed-determined variants per language/outcome
- Supports: `es`, `pt-BR`, `de`, `fr`, `tr`, `en`

**`bouzys_vs_fnatic_text(language, winner, seed)`**
- Easter egg when Fnatic loses and locale is Spanish
- Supports: `es`, `pt-BR`, `de`, `fr`, `tr`, `en`
- Example (ES): *"JUGADORES DE MIERDA"*

---

## Gotchas

- **Only live matches** generate social posts. Background-simulated matches do
  not trigger `generate_match_social_posts()`.
- **Relocalization** regenerates ALL existing post bodies. This is an `O(n)`
  operation where `n` = total posts in the save.
- **Deterministic seed**: `hash(fixture_id + winner_id + score)` ensures the
  same match always produces the same template variant and engagement numbers,
  even across reloads.
- **Bouzys easter egg** is filtered on the frontend: posts with tag
  `_fan_bouzys_fnatic` are hidden unless the UI language is Spanish.
- **Manager posts** bypass the template system entirely — they just store the
  raw text with `author_type: Manager` and `category: ManagerPost`.
- **Press Conference** (`src/content/lol/social/`) is a completely separate
  system for post-match press interviews, not related to the Social Feed.
