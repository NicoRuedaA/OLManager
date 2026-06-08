# Messages (Bandeja / Inbox)

The Messages tab is a master/detail interface for all in-game communications. It receives messages from ~47 different game events and displays them with sender icons, priority badges, and interactive action buttons.

## Architecture

```
Game events (Rust)
  │
  ▼
Message creation functions (~47)
  │
  ├─ data/messages/<trigger>/*.json  (template-based)
  │     └─ TemplateStore.build_message()
  │
  └─ Hardcoded fallback (legacy)
  │
  ▼
InboxMessage { subject, body, sender, sender_icon, actions, ... }
  │
  ▼
game.messages.push() → SQLite save → Frontend
  │
  ▼
resolveMessage() → MessageData → InboxTabV2 (React)
```

## Frontend: InboxTabV2

**File:** `src/ui-v2/dashboard/tabs/InboxTabV2.tsx` (550 lines)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar                                                    │
│  [Inbox Icon] Bandeja [total] [unread] | [Search...] [Sort] │
│  [Mark Read] [Clear Old]                                    │
├─────────────────────────────────────────────────────────────┤
│  Filter chips: [All] [Unread] [Category A] [Category B] ... │
├──────────────────────┬──────────────────────────────────────┤
│  Message list (360px) │  Detail pane (1fr)                  │
│                      │                                      │
│  [Icon] Subject      │  [Back]                          [🗑]│
│         Sender       │  ───────────────────────             │
│         Body preview │  Subject                             │
│         [date]       │  Sender · Role · Date                │
│                      │  ───────────────────────             │
│  [Icon] Subject      │  Body text                           │
│         Sender       │                                      │
│         Body preview │  [Action Button 1] [Action Button 2] │
│         [date]       │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

### Toolbar

| Element | Purpose |
|---|---|
| Badge total | Count of all messages |
| Badge unread | Count of unread messages (accent color) |
| Search | Filters by subject, body, sender (min 2 chars) |
| Sort | Newest / oldest toggle |
| Mark Read | Marks all messages as read (`invoke mark_all_messages_read`) |
| Clear Old | Deletes old read messages (`invoke clear_old_messages`) |

### Filter Chips

Each chip toggles filtering by `category`. The "Unread" chip uses a special `UNREAD_FILTER` constant. The "All" chip resets the filter.

### Master/Detail

Uses a CSS grid: `lg:grid-cols-[360px_1fr]`.

**Left panel:** Scrollable list of `MessageRow` components. Each shows:
- **Sender icon** (from `/messages-icons/{sender_icon}`) or fallback initial letter
- **Subject** (resolved via i18n if `subject_key` exists, or direct string)
- **Sender name**
- **Body preview** (truncated)
- **Date** (compact format)
- **Priority indicator**: unread messages have a primary-color left border
- **Selected state**: background highlight

**Right panel:** `DetailPane` component showing the full selected message:
- **Header**: Back button, delete button
- **Subject** (resolved)
- **Sender** with icon, role, date
- **Body** (whitespace-preserving)
- **Actions**: Interactive buttons rendered from `ActionType`
- **Effect feedback**: Transient message (4s) after resolving an action

### Key State

| State | Type | Purpose |
|---|---|---|
| `selectedId` | `string \| null` | Currently selected message |
| `filter` | `string \| null` | Active category filter (or `UNREAD_FILTER`) |
| `sortOrder` | `"newest" \| "oldest"` | Date sort direction |
| `query` | `string` | Search text |
| `effect` | `string \| null` | Transient feedback text after action |

## Rust: Message Template System

### Template Store (`src/messages/template_store.rs`)

Loaded at app startup during `select_team`. Scans `data/messages/*/*.json`, groups by `trigger`.

```rust
TemplateStore {
    by_trigger: HashMap<String, Vec<MessageTemplate>>
}
```

**Key functions:**

| Function | Purpose |
|---|---|
| `init_template_store(path)` | Load all templates from directory |
| `pick_random(trigger)` | Weighted random selection |
| `build_message(trigger, id, date, lang, params)` | Build a complete `InboxMessage` |
| `get_sender(id)` | Look up sender definition from store |

### Senders Store (`data/messages/senders/`)

Separate store for reusable sender definitions:

```json
{
  "id": "director_of_football",
  "name": "Director of Football",
  "name_key": "be.sender.directorOfFootball",
  "role": "Director of Football",
  "role_key": "be.role.directorOfFootball",
  "icon": "director.jpg"
}
```

Used by templates via `"sender": "director_of_football"` and by inline messages via `with_sender()`.

### Helper: `with_sender()`

Applies sender name, role, and icon from the senders store to any `InboxMessage`:

```rust
crate::messages::with_sender(msg, "director_of_football", vec![("player", &name)])
```

## Data Format

### Template JSON (`data/messages/<trigger>/<file>.json`)

```json
{
  "id": "welcome",
  "trigger": "select_team",
  "weight": 1,
  "sender": "board",
  "category": "Welcome",
  "priority": "Normal",
  "actions": [
    { "type": "acknowledge", "label": "OK", "label_key": "be.msg.action.acknowledge" }
  ],
  "subject": "Welcome to {team}!",
  "body": "The board of directors welcomes you...",
  "translations": {
    "es": { "subject": "¡Bienvenido a {team}!", "body": "El consejo directivo..." },
    "de": { "subject": "Willkommen bei {team}!", "body": "Der Vorstand..." }
  }
}
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `trigger` | string | Event that triggers this message |
| `weight` | uint | Random selection probability (higher = more likely) |
| `sender` | string | ID reference to `data/messages/senders/<id>.json` |
| `category` | string | `Welcome`, `Transfer`, `Finance`, `Contract`, etc. |
| `priority` | string | `Low`, `Normal`, `High`, `Urgent` |
| `actions` | array | Interactive action buttons |
| `subject` | string | Default (English) subject text |
| `body` | string | Default (English) body text |
| `translations.xx` | object | Inline translations per language code |

### MessageCategory (filter chips)

| Category | Color/icon | Usage |
|---|---|---|
| `Welcome` | — | New game, hired |
| `LeagueInfo` | — | Schedule, call-ups |
| `MatchPreview` | — | Upcoming fixture |
| `MatchResult` | — | Match outcome |
| `Transfer` | — | Offers, completed transfers |
| `BoardDirective` | — | Expectations, warnings, firing |
| `PlayerMorale` | — | Complaints, happiness, concerns |
| `Training` | — | Fitness, scrims, academy |
| `Finance` | — | Debt, sponsorship, wage budget |
| `Contract` | — | Expirations, renewals |
| `ScoutReport` | — | Scouting assignments |
| `Media` | — | Podcasts, streams, press |
| `System` | — | Patch notes, weekly reports |
| `JobOffer` | — | Job applications |

### Action Types

| `type` | Behavior | JSON Example |
|---|---|---|
| `acknowledge` | Marks read, dismisses | `{ "type": "acknowledge", "label": "OK" }` |
| `navigateto` | Redirects to a dashboard tab | `{ "type": "navigateto", "label": "View", "route": "/dashboard?tab=Squad" }` |
| `chooseoption` | Shows multiple options as buttons | `{ "type": "chooseoption", "label": "Respond", "options": [{ "id": "accept", "label": "Accept" }] }` |
| `dismiss` | Discards the message | `{ "type": "dismiss", "label": "Ignore" }` |

Each action resolved via `invoke("resolve_message_action", { messageId, actionId, optionId })` returns the updated `gameState` and optionally an `effect` text (shown 4s in the detail pane).

## i18n Resolution

The frontend `resolveMessage()` (in `backendI18n.ts`) resolves fields in this order:

1. If `subject_key` exists → `i18n.t(subject_key, i18n_params)`
2. If translation not found → uses `subject` (English fallback, already resolved from template's `translations`)
3. Same for `body_key`, `sender_key`, `sender_role_key`

For template-based messages, the Rust `build_message()` resolves translations inline using the `lang` parameter and the `translations` object in the JSON, then stores the result directly in `subject/body`. No `subject_key` is needed — the text is already in the correct language.

## Existing Triggers (data/messages/)

| Trigger | Templates | Sender |
|---|---|---|
| `select_team` | `welcome/` | board |
| `staff_advice` | `staff/` | assistant_coach |
| `board_expectations` | `board/` | board |
| `board_warning` | `board/` | board |
| `board_final_warning` | `board/` | board |
| `board_fired` | `board/` | board |
| `board_objectives` | `board/` | board |
| `season_schedule` | `season/` | board |
| `match_preview` | `match_preview/` | assistant_coach |
| `match_result` | `match_result/` | assistant_coach |
| `transfer_complete` | `transfer/` | director_of_football |
| `transfer_offer` | `transfer/` | director_of_football |
| `contract_terminated` | `transfer/` | director_of_football |
| `contract_expired` | `contract/` | director_of_football |
| `delegated_renewal` | `contract/` | assistant_coach |
| `academy_acquired` | `academy/` | assistant_coach |
| `academy_player_moved` | `academy/` | assistant_coach |
| `job_welcome` | `jobs/` | board |
| `job_offer` | `jobs/` | board |
| `job_rejection` | `jobs/` | board |
| `sponsor_offer` | `finance/` | board |
| `finance_critical` | `finance/` | board |
| `finance_warning` | `finance/` | board |
| `wage_over_budget` | `finance/` | board |
| `scout_report` | `scout/` | scout |
| `potential_report` | `scout/` | scout |
| `low_morale` | `player_event/` | player_relations |
| `bench_complaint` | `player_event/` | player_relations |
| `happy_player` | `player_event/` | player_relations |
| `contract_concern` | `player_event/` | director_of_football |
| `media_story` | `media/` (20 files) | press |
| `podcast` | `podcast/` (10 files) | al_lio |
| `stream` | `stream/` (20 files) | yuste |
| `rival_interest` | `rival_interest/` (10 files) | director_of_football |

## Services

All called via Tauri `invoke` from `src/services/inboxService.ts`:

| Service | Tauri command | Purpose |
|---|---|---|
| `markMessageRead(id)` | `mark_message_read` | Mark single as read |
| `markAllMessagesRead()` | `mark_all_messages_read` | Mark all as read |
| `clearOldMessages()` | `clear_old_messages` | Delete old/read messages |
| `deleteMessage(id)` | `delete_message` | Delete single message |
| `resolveMessageAction(id, actionId, optionId?)` | `resolve_message_action` | Execute action, return updated game state |

## Adding a New Message Type

1. **Add sender** (if new): Create `data/messages/senders/<id>.json`
2. **Create template(s)**: `data/messages/<trigger>/<file>.json` with `trigger`, `sender`, `subject`, `body`, `translations`
3. **Update Rust function**: Add `template_store().build_message("trigger", ...)` before the hardcoded fallback
4. The template store picks a random template by `weight` and resolves translations from the `lang` parameter
