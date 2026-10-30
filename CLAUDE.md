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
- `npm run gen:expansions` – refresh the bundled fallback `src/data/expansions.json` from MTGJSON
  (the extension downloads the current table itself at runtime)

## Layout
- `src/lib/model.ts` – internal `CardRow` model (source-agnostic)
- `src/lib/csv/manabox.ts` – ManaBox CSV → `CardRow[]` + issues
- `src/lib/expansions.ts` + `src/data/expansions*.json` – set code → Cardmarket `idExpansion`s
- `src/lib/mtgjson.ts` – MTGJSON downloads: expansion table (SetList) and per-set card ids
  (collector number → `idProduct`); both cached in `store.ts`
- `src/lib/planning.ts` – pure matching (`idProduct`, English name as fallback): pending cards × page rows → fill plan + review list
- `src/lib/pricing.ts` – lowest offer (same foiling) + markup, rounded up to cents
- `src/lib/cardmarket/` – Cardmarket ids, the DOM adapter for the BulkListing page and the
  public price guide download (`price-guide.ts`)
- `src/lib/store.ts` – extension storage (import, settings, progress)
- `src/entrypoints/background.ts` – icon click opens the listing page; MTGJSON downloads
- `src/entrypoints/bulk-listing.content/` – panel injected into the BulkListing page: import,
  settings (`setup.ts`) and form filling (`panel.ts`) – there is no popup
- `tests/fixtures/bulk-listing.html` – hand-written replica of the listing table
- `docs/decisions.md` – decision log; append new decisions there
- `docs/cardmarket-bulk-listing.md` – structure of Cardmarket's listing pages (form fields, IDs, limits)

## Git workflow
- Work on `dev`; merge into `main` only when `npm run check` and both builds pass.
- Never commit saved Cardmarket pages (they contain session tokens).

## Conversation language
The maintainer communicates in German; code, comments and commits are in English.
