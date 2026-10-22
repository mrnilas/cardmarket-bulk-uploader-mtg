# Decision log

| # | Date | Decision | Reason |
|---|---|---|---|
| 1 | 2026-10-22 | No Cardmarket API; automate the web forms via content scripts | API does not accept new applications and is limited to professional sellers |
| 2 | 2026-10-22 | Build from scratch; `PedroPerpetua/cardmarket-bulk-import` is an idea source only | That repo has no license, so a fork could not be published |
| 3 | 2026-10-22 | License: MIT | Maximum reuse |
| 4 | 2026-10-22 | Framework: WXT + TypeScript | One codebase for Chrome and Firefox, Manifest V3 |
| 5 | 2026-10-22 | Input format: ManaBox CSV, parsed into a source-agnostic `CardRow` model | Other exporters (Dragon Shield, Delver, …) can be added as extra parsers later |
| 6 | 2026-10-22 | Proxy rows are skipped with a warning | Proxies must not be sold |

## Open
- Target form on Cardmarket: "List bulk items" (max. 100 per expansion) vs. "List Mixed Products"
- Selling price: ManaBox `Purchase price` is the buying price, not a selling price
- Exact Cardmarket names/IDs for languages and expansions (to be verified against the live form)
