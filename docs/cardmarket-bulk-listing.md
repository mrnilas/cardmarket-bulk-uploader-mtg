# Cardmarket listing pages – analysis

Analysis of Cardmarket's seller listing pages (state: 2026-10-22), based on pages saved
from a logged-in session. No session data, tokens or personal data are stored here.
Selectors and IDs may change at any time – the adapter must verify them at runtime.

## Pages compared

| | "List by expansion" (`BulkListing`) | "List mixed products" (`ListMixedProducts`) |
|---|---|---|
| URL | `/{lang}/Magic/Stock/ListingMethods/BulkListing` | `/{lang}/Magic/Stock/ListingMethods/ListMixedProducts` |
| Flow | Load one expansion as a table, fill rows, submit | AJAX search per card (name, language, expansion), pick result, add |
| Requests for a 2,743-row CSV | ~ one page per 100 products of each expansion | ~ 2,743 searches + adds |
| Matching | Exact via hidden `idProduct` per row | Name search, ambiguous for reprints/variants |
| Bot risk | Low (regular page loads) | High (thousands of AJAX calls) |

**Decision:** we target **"List by expansion"** (see `decisions.md`).

## "List by expansion" in detail

### Filter (GET)

```
/de/Magic/Stock/ListingMethods/BulkListing?idExpansion=5982&idRarity=22&sortBy=number&site=2
```

| Param | Meaning |
|---|---|
| `idExpansion` | Cardmarket expansion id (~774 for Magic). Required – no "all" option. |
| `idRarity` | Optional. `64` Masterpiece, `17` Mythic, `18` Rare, `20` Time Shifted, `21` Uncommon, `22` Common, `23` Land, `19` Special, `24` Token, `155` Code Card, `55` Tip Card |
| `sortBy` | `number`, `engName`, `locName`, `rarenumber` |
| `site` | Page number, 1-based |

- **100 rows per page.** Example: Aetherdrift, all rarities → 291 hits → 3 pages.
- Changing the page discards unsubmitted input (Cardmarket shows a note).
- Expansion names in the select are localised (German UI: "Ätherdrift").
- Variants such as "Extras", "Promos", "Tokens" are **separate expansions** on Cardmarket,
  while Scryfall/ManaBox often keep them in the main set code.

### Listing form

`form#BulkListingForm` (AJAX action `Article_BulkListProduct`), one `tr#BulkListingRow{i}`
per product, `i` = 0…99 on the current page:

| Field | Name | Values |
|---|---|---|
| Select | `select[]` | checkbox |
| Language | `idLanguage[i]` | `1` EN, `2` FR, `3` DE, `4` ES, `5` IT, `6` ZH-S, `7` JA, `8` PT, `9` RU, `10` KO, `11` ZH-T, `12` NL, `13` PL, `14` CS, `15` HU, `16` ID, `17` TH – only languages available for that product are offered |
| Condition | `idCondition[i]` | `1` MT, `2` NM (default), `3` EX, `4` GD, `5` LP, `6` PL, `7` PO |
| Foil | `isFoil[i]` | checkbox |
| Signed | `isSigned[i]` | checkbox |
| Comment | `comments[i]` | text |
| Amount | `amount[i]` | number, `0`–`32` |
| Price | `price[i]` | text, decimal `.` or `,`, min. 0.02 € |
| Product | `idProduct[i]` | hidden, Cardmarket product id |

Read-only price data per row (disabled hidden inputs): `lowPrice`, `trendPrice`,
`avg1Price`, `avg7Price`, `avg30Price`, `myPrice`.

Each row also shows the localised and the English card name. **No collector number** is shown.

The product image URL contains Cardmarket's set code, e.g.
`product-images.s3.cardmarket.com/1/DFT/808219/808219.jpg` → useful to verify the
loaded expansion.

### Submit

- Button `input[type=submit][form=BulkListingForm]` ("Karte(n) zum Verkauf einstellen").
- Cardmarket warns that **more than 100 different articles per submission** may cause
  some articles not to be listed. Multiple copies of the same article do not count extra.
  With 100 rows per page, one page = at most one submission.
- Submission is AJAX; results appear under "Recently listed" (`#NewArticleTableWrapper`).

### Bulk modification

`form#BulkModificationForm` applies language, condition, comment, amount, price
(`priceSelect`: own, low, trend, avg1, avg7, avg30, my highest), foil and signed to
all selected rows. Useful for manual fixes, not needed by the adapter.

## Consequences for the adapter

1. **Matching:** ManaBox `Scryfall ID` → Scryfall `cardmarket_id` = Cardmarket `idProduct`.
2. **Expansion:** the product id must be resolved to an `idExpansion` to load the right page.
3. **Paging:** a product can be on any of the expansion's pages → walk `site=1…n`,
   fill the rows found, submit, continue.
4. **Foil and non-foil** of the same card share one product row → needs two submissions
   (or the "copy row" button) when both exist in the CSV.
5. **Pricing:** trend/low/average prices are available in the row; no extra request needed.
6. **Safety:** fill → show diff/preview → submit only after user confirmation (dry run first).

## Open questions

- How are foil and non-foil of the same product listed in one go (copy row vs. two passes)?
- Response format of `Article_BulkListProduct` / content of "Recently listed" for success checks.
- How to resolve `idProduct` → `idExpansion` reliably (mapping table, product page, …).
