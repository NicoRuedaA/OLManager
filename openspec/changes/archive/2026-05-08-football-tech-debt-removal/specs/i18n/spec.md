# Delta: i18n Locales

## Context

Remove football-related i18n keys. Rename the guard file.

---

## REMOVED Requirements

### Requirement: Remove pitchInteractionHint

Remove `pitchInteractionHint` key from all locale JSON files (en, es, de, fr, it, pt, pt-BR, tr).

#### Scenario: pitchInteractionHint absent from all locales

- GIVEN each locale JSON file
- WHEN searched for `pitchInteractionHint`
- THEN the key MUST NOT exist

### Requirement: Remove footballHerald source key

Remove `be.source.footballHerald` key from the `news` section of all locale JSON files.

#### Scenario: footballHerald absent from all locales

- GIVEN each locale JSON file
- WHEN searched for `footballHerald`
- THEN the key MUST NOT exist

---

## MODIFIED Requirements

### Requirement: Rename guard file

Rename `src/i18n/locales/footballTermGuard.test.ts` to remove the football prefix. The test logic (i18n locale football term guard) remains identical — only the filename changes.

(Previously: `footballTermGuard.test.ts`)

#### Scenario: File renamed to guard.ts

- GIVEN the locales directory
- THEN a file named `guard.test.ts` MUST exist with matching logic
- AND the old `footballTermGuard.test.ts` MUST NOT exist
