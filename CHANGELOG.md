# Changelog

All notable changes to OLManager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses GPL-3.0 licensing inherited from the OpenFootManager lineage unless otherwise documented.

## [0.2.0] - 2026-05-07

### Added

- Added Turkish localisation and improved Turkish translations across the game. Thanks @aalonsolopez and Shammminggg on Discord. (#76, #202, #203)
- Added in-app auto-updater flow with Tauri updater integration, frontend updater UI, translations, signed bundles and `latest.json` support. Thanks @108M and @aalonsolopez. (#91, #153)
- Added the Champions/Meta system: champion catalog, champion pages, persistence, progression, stats, role distribution and stat cards. Thanks @NicoRuedaA. (#121, #192)
- Added Scrims and Social V1, including scrim planning, social posts, registry/templates, editor UI and dashboard/training integration. Thanks @chasemrs. (#160, #206)
- Added assistant-coach delegated training. Thanks @almuoluupv / @mezxR. (#136)
- Added x8 and x12 match simulation speed options. Thanks @almuoluupv / @mezxR. (#139)
- Added UI/UX quality-of-life improvements across player profiles, scouting, transfers, finances, academy, dashboard search, logos, photos, role icons and sortable tables. Thanks @NicoRuedaA. (#121, #124)
- Added Rust → TypeScript type generation foundations with `ts-rs`, plus validation groundwork with Rust `validator` and TypeScript Zod schemas. Thanks @NicoRuedaA. (#121)
- Added security hardening around CSP, Tauri capabilities, path traversal protection and safer game DB access patterns. Thanks @NicoRuedaA. (#121)

### Changed

- Completed a major football-to-League-of-Legends migration across domain, database, engine and frontend:
  - `Position` replaced with `LolRole`
  - football match events removed from the engine
  - goals renamed/replaced with LoL score/kills terminology
  - stadium fields renamed to arena fields
  - set-piece concepts replaced with `TeamRoles`
  - football-specific fields such as `football_nation` removed from active models and data  
  Thanks @NicoRuedaA and @aalonsolopez. (#65, #68, #69, #70, #72, #75, #80, #83, #121, #122, #123, #124, #151, #156, #159, #201, #207)
- Reworked the match engine from legacy football simulation toward LoL-native simulation concepts. Thanks @NicoRuedaA and @aalonsolopez. (#123, #124, #207)
- Replaced “Starting XI” terminology and UI with LoL lineup language and five-role lineup expectations. Thanks @aalonsolopez. (#151, #201)
- Unified OVR calculation across Squad, Tactics and Engine views, and renamed player attributes to visible LoL stat names. Thanks @NicoRuedaA. (#194)
- Replaced OpenFoot branding/menu assets and removed remaining football terminology from locale files. Thanks @aalonsolopez. (#158, #159)
- Updated README, roadmap, architecture docs and ADRs to reflect the LoL migration and technical direction. Thanks @NicoRuedaA and @aalonsolopez. (#121)

### Fixed

- Fixed first-year friendly scheduling getting locked. Thanks @aalonsolopez. (#187)
- Fixed player age calculation so ages are based on the in-game date. Thanks @aalonsolopez. (#189)
- Fixed database team upsert crashes and positional row mapping issues. Thanks @NicoRuedaA. (#191)
- Fixed missing scrim columns and related migration/index issues. Thanks @NicoRuedaA and @chasemrs. (#160, #192, #206)
- Fixed scouting of own players so own-team scouting can return perfect-accuracy reports, plus scouting UI overlap. Thanks @108M. (#205)
- Fixed draft champion count issues and progression requiring the five LoL roles. Thanks @almuoluupv / @mezxR and @aalonsolopez. (#132, #157)
- Fixed placeholder coach naming from a football manager reference to a LoL-appropriate placeholder. Thanks @almuoluupv / @mezxR. (#134)
- Fixed updater release metadata by publishing signed latest manifests and adding updater public-key configuration. Thanks @aalonsolopez. (#153)
- Fixed old-save and migration compatibility issues around champion data, profile images, role casing, corrupted locale JSON and DB schema evolution. Thanks @NicoRuedaA. (#121, #122, #124)
- Fixed Dashboard crash caused by conditional hooks and several ChampionPage/ChampionsWorld navigation issues. Thanks @NicoRuedaA. (#121, #124)
- Fixed Rust test compilation and DB runtime test expectations after the migration work. Thanks @aalonsolopez. (#196, #198)
- Fixed Critical issue where some images didn't loaded properly. Thanks @chasemrs.

### Chores

- Renamed backend crate from `openfootmanager_lib` to `olmanager_lib`. Thanks @NicoRuedaA. (#65)
- Removed dead frontend/backend code and renamed legacy identity files away from football-specific naming. Thanks @NicoRuedaA. (#66, #73)
- Enabled/expanded Rust checks, clippy validation and CI security/audit gates. Thanks @NicoRuedaA. (#67, #71, #121)
- Cleaned active seed data and locales to remove football remnants. Thanks @aalonsolopez. (#156, #159)

### Contributors

- Thanks to @keremozmeen (Kerem Özmen) for the LoL-native engine attribute/rating work that was manually ported in #207 from #204.
- Thanks to Shammminggg on Discord for the Turkish translation corrections captured in #202 and shipped via #203.

## [0.1.2] - 2026-04-30

### Added

- Added ScheduleCalendarView to display selected scrims with opponent name and logo when a scrim opponent is configured.
- Added realistic board objectives based on team strength: objectives are now generated based on the roster's average skill compared to the rest of the league, not static reputation thresholds.
- Added end-of-season board objective review message with objectives completed count and satisfaction delta.
- Added visible gold advantage chart with proper LoL-style formatting (blue advantage rises, red advantage falls) and chronological timeline plotting.
- Added i18n keys for board objective review messages (`be.msg.boardObjectiveReview.subject`, `be.msg.boardObjectiveReview.body`).
- Added roster destination selection for new signings: users can now choose to assign a new signing to either the Main Team or the Academy squad.
- Added updated world data with recalibrated player statistics and market costs.

### Changed

- Restyled the post-match gold advantage chart with improved visuals: gradient line, side-colored segments (blue above center, orange below center), final advantage summary, and peak display.
- Adapted tournament and schedule standings tables to LoL format: removed "drawn" column and "points", replaced goals with "Maps" (e.g., "12-4") and "Map Diff" (e.g., "+8", "-3").
- Changed series objective calculation to use roster skill comparison: strong teams get title-contender objectives, mid-table teams get playoff objectives, weak teams get survival objectives.
- NeutralTimersState now uses typed fallbacks instead of empty objects to satisfy TypeScript requirements.
- Refactored world data loading: the system now reads world data exclusively from `lec_world.json`.
- Improved Draft AI logic: refined pick selection to prevent nonsensical choices and ensure bans do not target roles already picked.

### Fixed

- Fixed Bo3/Bo5 series completion: the series now correctly detects when a team reaches the required wins (2 for Bo3, 3 for Bo5) and ends appropriately.
- Fixed Bo3 one-map finalization bug: added a hard invariant requiring both reaching target wins AND having enough played maps to support that score.
- Fixed stale series advance button label: after a Bo3/Bo5 completes, the button now shows "Continue" instead of a stale "Game 2/3" label.
- Fixed final series scoreboard reset: the 2-1 or 3-x final score now persists and displays correctly after series completion instead of resetting to 0-0.
- Fixed press conference availability: press conference is now correctly gated to only appear for single games or completed series, not for in-progress Bo3/Bo5.
- Fixed NeutralTimersState TypeScript error: added typed fallback helpers (`createEmptyNeutralTimersState`, `createDefaultObjectivesState`) to satisfy type requirements.
- Fixed missing handleStartGame function that prevented creating a new career after finishing a previous one.
- Fixed board objective end-of-season feedback: objectives now trigger a visible inbox message with results and satisfaction changes.
- Fixed football/soccer terminology in initial season objectives email: replaced football terms (matches, goals, top half) with LoL/esports terms (split, series, maps, LEC table).
- Fixed gold advantage chart trajectory: the chart now correctly plots blue advantage going up, red advantage going down, and crossing the centerline appropriately.
- Fixed standings table format: converted from soccer-style (drawn, goals for/against, points) to LoL-style (played, won, lost, maps, map difference) in both TournamentsTab and ScheduleTab.
- Fixed position swapping during the draft phase: players can now correctly change positions and roles.

### Contributors

- Thanks to @drumst0ck (Jose Sánchez) for the NeutralTimersState TypeScript fix, amd the help in changing some content in the events of the game to use real media!
- Thanks to @nicoruedaa (Nico Rueda) for all the changes to QoL in UI related to transfers, player list and team icons.
- Thanks to @rcfarah for the help in PT_BR translations.


## [0.1.1] - 2026-04-28

### Added

- Added quality-of-life improvements to champion draft, including faster draft skipping, better role ordering, and champion sorting/filtering by meta and mastery.
- Added spectator/delegated match flow improvements so AI-controlled drafts and simulations can progress more smoothly through series games.

### Changed

- Improved match simulation and draft-result handling for series play, including safer handling of persisted draft results between games.
- Improved translations and UI labels across player, squad, champions, academy, and localized text.
- Removed duplicated draft players and the unavailable Omon free-agent entry from draft data.

### Fixed

- Fixed season-end progression issues and added coverage for end-of-season behavior.
- Fixed repeated press-conference questions by rotating recent questions and selecting a more varied question set.
- Fixed transfer messages to display match names instead of full names.
- Fixed the continue menu dropdown overlapping other UI elements.
- Disabled the native browser context menu in the Tauri app so the desktop experience behaves consistently.
- Fixed multiple transfer, potential, live-match, and match-simulation edge cases.

### Contributors

- Thanks to @drumst0ck (Jose Sánchez) for the transfer-message, continue-menu z-index, and Tauri context-menu fixes.

### Notes

- Release artifacts remain source-first; signing, notarization, and binary packaging policy are still not finalized.

## [0.1.0]

### Added

- Live Game simulation
- Customizable draft
- Player trading
- Installation management
- Functional Academy
- Training plans
- Scouting
- FULLY PLAYABLE (maybe not for long plays, but playable)
- Post-Game Press Conference
- Champion Mastery
- Live Patch/Meta changes
- Repository governance docs, issue templates, PR template, and non-production CI workflow for public OSS preparation.
- Provenance guidance separating GPL-inherited code/assets from third-party datasets and generated caches.
- Inherited documentation audit checklist for deciding which original-repository docs to keep, update, move to legacy, or remove before public OSS release.

### Notes

- Release artifacts are source-first until maintainers decide signing, notarization, and binary packaging policy.
