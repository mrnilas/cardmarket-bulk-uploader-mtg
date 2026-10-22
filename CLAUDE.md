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
- Vitest for unit tests (DOM tests use jsdom – happy-dom mis-parses Cardmarket's table),
  ESLint (typescript-eslint)
- PapaParse for CSV

## Commands
- `npm run dev` / `npm run dev:firefox` – dev build with hot reload
- `npm run build` / `npm run build:firefox`
- `npm run check` – type check + lint + tests (run before every commit)
- `npm run gen:expansions` – regenerate `src/data/expansions.json` from MTGJSON (needs internet)

## Layout
- `src/lib/model.ts` – internal `CardRow` model (source-agnostic)
- `src/lib/csv/manabox.ts` – ManaBox CSV → `CardRow[]` + issues
- `src/lib/scryfall.ts` – Scryfall id → Cardmarket `idProduct`
- `src/lib/expansions.ts` + `src/data/expansions*.json` – set code → Cardmarket `idExpansion`s
- `src/lib/planning.ts` – pure matching: pending cards × page rows → fill plan + review list
- `src/lib/pricing.ts` – trend price with minimum per rarity
- `src/lib/cardmarket/` – Cardmarket ids and the DOM adapter for the BulkListing page
- `src/lib/store.ts` – extension storage (import, settings, progress)
- `src/entrypoints/popup/` – import, Scryfall matching, settings
- `src/entrypoints/bulk-listing.content/` – panel injected into the BulkListing page
- `tests/fixtures/bulk-listing.html` – hand-written replica of the listing table
- `docs/decisions.md` – decision log; append new decisions there
- `docs/cardmarket-bulk-listing.md` – structure of Cardmarket's listing pages (form fields, IDs, limits)

## Git workflow
- Work on `dev`; merge into `main` only when `npm run check` and both builds pass.
- Never commit saved Cardmarket pages (they contain session tokens).

## Conversation language
The maintainer communicates in German; code, comments and commits are in English.
