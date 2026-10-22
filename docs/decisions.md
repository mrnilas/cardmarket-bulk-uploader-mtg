# Decision log

| # | Date | Decision | Reason |
|---|---|---|---|
| 1 | 2026-10-22 | No Cardmarket API; automate the web forms via content scripts | API does not accept new applications and is limited to professional sellers |
| 2 | 2026-10-22 | Build from scratch; `PedroPerpetua/cardmarket-bulk-import` is an idea source only | That repo has no license, so a fork could not be published |
| 3 | 2026-10-22 | License: MIT | Maximum reuse |
| 4 | 2026-10-22 | Framework: WXT + TypeScript | One codebase for Chrome and Firefox, Manifest V3 |
| 5 | 2026-10-22 | Input format: ManaBox CSV, parsed into a source-agnostic `CardRow` model | Other exporters (Dragon Shield, Delver, …) can be added as extra parsers later |
| 6 | 2026-10-22 | Proxy rows are skipped with a warning | Proxies must not be sold |
| 7 | 2026-10-22 | Target page: "List by expansion" (`BulkListing`), not "List mixed products" | Exact matching via `idProduct`, ~100× fewer requests, low bot risk – see [analysis](cardmarket-bulk-listing.md) |
| 8 | 2026-10-22 | Work happens on `dev`; `main` only receives tested states | Keep `main` releasable |
| 9 | 2026-10-22 | Matching: Scryfall `cardmarket_id` = Cardmarket `idProduct`; English name as fallback; ambiguous rows go to a review list, never guessed | Exact for variants and promos |
| 10 | 2026-10-22 | Expansions: mapping table in the repo, Scryfall set code → one or more Cardmarket `idExpansion`s (main set plus Extras/Promos/Tokens) | Cardmarket splits sets that Scryfall keeps together; table is verifiable via the set code in product image URLs |
| 11 | 2026-10-22 | Submit mode: the extension only fills the form; the user reviews and clicks "list" | Maximum control, no auto-submit |
| 12 | 2026-10-22 | Price: row's `trendPrice`, but never below a minimum per rarity (defaults: 0.10 € common/uncommon, 0.25 € rare/mythic; Cardmarket floor 0.02 €) | Market-based, protects bulk from being sold for cents |
| 13 | 2026-10-22 | Foil + non-foil of the same product: duplicate the row via Cardmarket's "copy row" button; fall back to a second pass if copying fails | One pass per page where possible |
| 14 | 2026-10-22 | One language per run: the user picks the language in the popup (preselected if the CSV has only one); rows of other languages are not filled | Avoids multiple language variants sharing one table row |
| 15 | 2026-10-22 | Expansion table is generated from MTGJSON's `SetList` (`mcmId`, `mcmIdExtras`) by `npm run gen:expansions`; manual fixes go to `expansions.overrides.json` | MTGJSON (MIT) already maintains Cardmarket ids per set |
| 16 | 2026-10-22 | Scryfall lookup runs in the popup, batched (75 ids/request), progress saved after each batch | No background worker needed; closing the popup only pauses it |
| 17 | 2026-10-22 | Cards count as listed when Cardmarket's "Recently listed" area changes after the user clicks submit; otherwise the user can mark them manually | Keeps progress across pages without guessing |

## Open
- Verify live: Cardmarket's "copy row" behaviour and the "Recently listed" update after submit
- Rows marked `select[]` – check whether Cardmarket needs them ticked for submission
