# Cardmarket Bulk Uploader (MTG)

Browser extension for **Chrome and Firefox** that lists Magic: The Gathering cards from a
**ManaBox CSV export** in your [Cardmarket](https://www.cardmarket.com) store.

> ⚠️ **Work in progress.** CSV import and validation work; filling Cardmarket's listing
> form is not implemented yet.

## Status

- [x] Parse and validate ManaBox CSV exports
- [x] Summary by set, language and finish in the popup
- [ ] Fill the Cardmarket listing form (content script)
- [ ] Pricing rules
- [ ] Dry run + review before listing

## How it works

The extension does **not** use the Cardmarket API (it is closed for new applications).
It fills Cardmarket's own listing forms in your logged-in browser session. You stay in
control: nothing is listed before you review it.

## Development

Requires Node.js ≥ 22.

```bash
npm install
npm run dev            # Chrome with hot reload
npm run dev:firefox    # Firefox with hot reload
npm run check          # type check + lint + tests
npm run build          # production build → .output/
```

Load the unpacked build from `.output/chrome-mv3` (Chrome: `chrome://extensions` →
Developer mode → *Load unpacked*) or `.output/firefox-mv2` / `firefox-mv3`
(Firefox: `about:debugging` → *Load Temporary Add-on*).

## Export from ManaBox

ManaBox → collection or binder → menu → **Export** → **CSV**.
Your exports are git-ignored; only anonymised fixtures live in `tests/fixtures/`.

## Contributing

Pull requests are welcome. Please run `npm run check` before submitting.
Decisions are recorded in [`docs/decisions.md`](docs/decisions.md).

## Disclaimer

Not affiliated with, endorsed by or connected to Cardmarket / Sammelkartenmarkt GmbH
or ManaBox. Always double-check your listings before they go live.

## License

[MIT](LICENSE) © 2026 Niklas Jäger
