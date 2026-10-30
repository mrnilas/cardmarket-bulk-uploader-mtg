// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { mountPanel } from '../src/entrypoints/bulk-listing.content/panel';
import { cardIdCache, currentImport, expansionCache, loadSettings } from '../src/lib/store';

const fixture = readFileSync(join(import.meta.dirname, 'fixtures/bulk-listing.html'), 'utf8');
const header =
  'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added';
const csv = [
  header,
  'Brightfield Glider,DFT,Aetherdrift,1,normal,common,3,1,x,0.1,false,false,false,near_mint,de,false,EUR,2026-01-01',
].join('\n');

const panel = () => document.querySelector('#cbu-panel-host')!.shadowRoot!;
const text = () => panel().textContent ?? '';
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));

describe('panel', () => {
  let unmount: () => void;

  beforeEach(async () => {
    fakeBrowser.reset();
    Element.prototype.scrollIntoView = vi.fn(); // missing in jsdom
    document.body.innerHTML = fixture;
    await expansionCache.setValue({
      table: { DFT: { name: 'Aetherdrift', ids: [5982] } },
      mtgjsonVersion: null,
      fetchedAt: new Date().toISOString(),
    });
    unmount = mountPanel();
  });

  afterEach(() => unmount());

  it('imports a CSV in the panel and plans the current page', async () => {
    await until(() => text().includes('Import ManaBox CSV'));
    expect(panel().querySelector<HTMLDetailsElement>('details.setup')!.open).toBe(true);

    const input = panel().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File([csv], 'collection.csv', { type: 'text/csv' })] });
    input.dispatchEvent(new Event('change'));

    await until(() => text().includes('This page: 3 cards in 1 products'));
    expect((await currentImport.getValue())?.fileName).toBe('collection.csv');
    expect((await loadSettings()).language).toBe('de');
    expect(text()).toContain('collection.csv · 3 cards');
    expect(text()).toContain('Expansions: 1 sets');
    // No background script in tests → the download fails and the name is used.
    expect(text()).toContain('Card numbers could not be loaded for DFT');
    expect(text()).toContain('3 cards without Cardmarket id in MTGJSON');
  });

  it('matches by Cardmarket id when the set is loaded', async () => {
    await cardIdCache.setValue({ DFT: { fetchedAt: new Date().toISOString(), ids: { '1': 807000 } } });
    await until(() => text().includes('Import ManaBox CSV'));
    const input = panel().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File([csv], 'collection.csv', { type: 'text/csv' })] });
    input.dispatchEvent(new Event('change'));

    // #1 is product 807000 (the second fixture row), although the name matches the first row.
    await until(() => text().includes('This page: 3 cards in 1 products'));
    expect(text()).not.toContain('without Cardmarket id');
    const fill = panel().querySelector<HTMLButtonElement>('button.primary')!;
    expect(fill.disabled).toBe(false);
    fill.click();
    await until(() => text().includes('Filled 3 cards'));
    expect(document.querySelector<HTMLInputElement>('[name="amount[1]"]')!.value).toBe('3');
    expect(document.querySelector<HTMLInputElement>('[name="amount[0]"]')!.value).toBe('0');
    // No price guide in tests → the row's lowest price 1.20 € + 10 %.
    expect(document.querySelector<HTMLInputElement>('[name="price[1]"]')!.value).toBe('1.32');
    expect(text()).toContain('Price guide unavailable');
  });
});
