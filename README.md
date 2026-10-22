# Cardmarket Bulk Uploader (MTG)

Browser extension for **Chrome and Firefox** that lists Magic: The Gathering cards from a
**ManaBox CSV export** in your [Cardmarket](https://www.cardmarket.com) store.

> ⚠️ **Prototype.** The form filling is tested against saved Cardmarket pages, not yet
> against live listings. Always check the filled rows before you click Cardmarket's list button.

## Status

- [x] Parse and validate ManaBox CSV exports
- [x] Match cards to Cardmarket products via Scryfall (`cardmarket_id`)
- [x] Fill Cardmarket's "List by expansion" form (language, condition, foil, amount, price)
- [x] Price = trend price, never below a minimum per rarity
- [x] Foil and non-foil of one card via Cardmarket's "copy row"
- [x] Progress across pages and expansions
- [ ] Live-tested on Cardmarket

## How it works

The extension does **not** use the Cardmarket API (it is closed for new applications).
It fills Cardmarket's own listing form in your logged-in browser session. **It never
submits** – you review the highlighted rows and click Cardmarket's list button yourself.

1. **Popup:** import your ManaBox CSV. The extension looks up the Cardmarket product id of
   every card via [Scryfall](https://scryfall.com). Choose the language to list (one
   language per run) and adjust the minimum prices.
2. **Open Cardmarket listing:** opens *Stock → Listing methods → List by expansion* for the
   first expansion with pending cards.
3. **Panel on the page:** shows how many of your cards are on this page. *Fill form* writes
   them into the table; anything uncertain is listed for manual review.
4. **Check and list** with Cardmarket's button. The panel marks those cards as listed and
   links to the next page or expansion.

## Development

Requires Node.js ≥ 22.

```bash
npm install
npm run gen:expansions # download the expansion table from MTGJSON (once, and for new sets)
npm run dev            # Chrome with hot reload
npm run dev:firefox    # Firefox with hot reload
npm run check          # type check + lint + tests
npm run build          # production build → .output/
```

Load the unpacked build from `.output/chrome-mv3` (Chrome: `chrome://extensions` →
Developer mode → *Load unpacked*) or `.output/firefox-mv2`
(Firefox: `about:debugging` → *Load Temporary Add-on* → `manifest.json`).

`npm run dev:firefox` starts a fresh Firefox profile in which you are not logged in to
Cardmarket. To test listing, load the build into your normal profile instead.

### Expansion table

Cardmarket identifies expansions by its own ids and splits sets into e.g. main set and
"Extras". `src/data/expansions.json` maps Scryfall/ManaBox set codes to those ids and is
generated from [MTGJSON](https://mtgjson.com)'s SetList. Corrections go to
`src/data/expansions.overrides.json`, which the generator never touches.

## Export from ManaBox

ManaBox → collection or binder → menu → **Export** → **CSV**.
Your exports are git-ignored; only anonymised fixtures live in `tests/fixtures/`.

## Contributing

Pull requests are welcome – please target `dev` and run `npm run check` first.
Decisions are recorded in [`docs/decisions.md`](docs/decisions.md), the structure of the
Cardmarket page in [`docs/cardmarket-bulk-listing.md`](docs/cardmarket-bulk-listing.md).

## Data sources

- Card data: [Scryfall API](https://scryfall.com/docs/api)
- Expansion ids: [MTGJSON](https://mtgjson.com) (MIT)

## Disclaimer

Not affiliated with, endorsed by or connected to Cardmarket / Sammelkartenmarkt GmbH,
ManaBox, Scryfall or MTGJSON. Always double-check your listings before they go live.

## License

[MIT](LICENSE) © 2026 Niklas Jäger
