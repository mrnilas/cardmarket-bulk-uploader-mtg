# CLAUDE.md

Browser extension (Chrome + Firefox) that bulk-lists Magic: The Gathering cards from a
ManaBox CSV export in the user's Cardmarket store.

## Ground rules
- **License: MIT.** Everything in this repo must be original work.
- **No Cardmarket API.** New API access is closed; we automate the logged-in web forms
  via content scripts only.
- **Clean room:** `PedroPerpetua/cardmarket-bulk-import` has no license. Use it only as
  an idea source – never copy or closely paraphrase its code.
- **Never auto-submit without a dry run.** Listing must be reviewable before it goes live.
- Never commit real user CSV exports (`*.csv` is git-ignored except `tests/fixtures/`).

## Stack
- WXT 0.21 + TypeScript 6 (strict), Manifest V3, `imports: false` (explicit imports only)
- Vitest for unit tests, ESLint (typescript-eslint)
- PapaParse for CSV

## Commands
- `npm run dev` / `npm run dev:firefox` – dev build with hot reload
- `npm run build` / `npm run build:firefox`
- `npm run check` – type check + lint + tests (run before every commit)

## Layout
- `src/lib/model.ts` – internal `CardRow` model (source-agnostic)
- `src/lib/csv/manabox.ts` – ManaBox CSV → `CardRow[]` + issues
- `src/lib/grouping.ts` – group by set, batching, summary
- `src/lib/targets/listing-target.ts` – adapter interface for Cardmarket listing pages
- `src/entrypoints/` – WXT entrypoints (popup, later content scripts)
- `docs/decisions.md` – decision log; append new decisions there

## Conversation language
The maintainer communicates in German; code, comments and commits are in English.
