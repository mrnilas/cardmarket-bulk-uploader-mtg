// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPlan, getProductRows, readAmount, readPage } from '../src/lib/cardmarket/bulk-listing';
import type { Placement, RowPlan } from '../src/lib/planning';
import { card } from './helpers';

// The DOM environment replaces the global URL, so resolve the path without it.
const fixture = readFileSync(join(import.meta.dirname, 'fixtures/bulk-listing.html'), 'utf8');
const url = new URL('https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing?idExpansion=5982');

const value = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;

/** Simulates Cardmarket's "copy row" button: clones the row with the next index. */
function enableCopyButtons() {
  let next = 100;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button.copy-row-button')) {
    button.addEventListener('click', () => {
      const tr = button.closest('tr')!;
      const copy = tr.cloneNode(true) as HTMLTableRowElement;
      const index = next++;
      copy.id = `BulkListingRow${index}`;
      for (const el of copy.querySelectorAll<HTMLInputElement>('[name*="["]')) {
        el.name = el.name.replace(/\[\d+\]/, `[${index}]`);
      }
      setTimeout(() => tr.after(copy), 5);
    });
  }
}

const placement = (overrides: Partial<Placement> = {}): Placement => ({
  productId: 808219,
  languageId: 3,
  conditionId: 2,
  foil: false,
  signed: false,
  amount: 2,
  price: 0.1,
  sources: [card()],
  ...overrides,
});

const rowPlan = (placements: Placement[]): RowPlan => ({
  row: { index: 0, productId: 808219, englishName: 'Brightfield Glider', languageIds: [1, 3] },
  placements,
});

beforeEach(() => {
  document.body.innerHTML = fixture;
});

describe('readPage', () => {
  it('reads expansion, paging and product rows', () => {
    const page = readPage(document, url);
    expect(page.expansionId).toBe(5982);
    expect(page.expansionName).toBe('Aetherdrift');
    expect(page.site).toBe(1);
    expect(page.nextPageUrl).toBe(
      'https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing?idExpansion=5982&sortBy=number&site=2',
    );
    expect(page.rows).toEqual([
      { index: 0, productId: 808219, englishName: 'Brightfield Glider', languageIds: [1, 3], trendPrice: 0.09 },
      { index: 1, productId: 807000, englishName: "Basri, Tomorrow's Champion", languageIds: [1, 3], trendPrice: 1.75 },
    ]);
  });

  it('falls back to the selected expansion and reports the last page', () => {
    document.querySelector('a[data-direction="next"]')!.classList.add('disabled');
    const page = readPage(document, new URL('https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing'));
    expect(page.expansionId).toBe(5982);
    expect(page.nextPageUrl).toBeNull();
  });

  it('returns no rows without the listing form', () => {
    document.body.innerHTML = '<p>nothing</p>';
    expect(readPage(document, url).rows).toEqual([]);
  });
});

describe('applyPlan', () => {
  it('fills the row and fires change events', async () => {
    const onChange = vi.fn();
    document.addEventListener('change', onChange);

    const report = await applyPlan(document, [rowPlan([placement({ foil: true, price: 0.5 })])]);

    expect(report.errors).toEqual([]);
    expect(report.filled).toHaveLength(1);
    expect(value('idLanguage[0]').value).toBe('3');
    expect(value('idCondition[0]').value).toBe('2');
    expect(value('isFoil[0]').checked).toBe(true);
    expect(value('isSigned[0]').checked).toBe(false);
    expect(value('amount[0]').value).toBe('2');
    expect(value('price[0]').value).toBe('0.50');
    expect(value('amount[1]').value).toBe('0');
    expect(onChange).toHaveBeenCalled();
    expect(readAmount(report.filled[0]!.row)).toBe(2);
  });

  it('puts further placements into copied rows', async () => {
    enableCopyButtons();
    const report = await applyPlan(document, [
      rowPlan([placement({ amount: 3 }), placement({ foil: true, amount: 1, price: 0.3 })]),
    ]);

    expect(report.deferred).toEqual([]);
    expect(report.filled).toHaveLength(2);
    expect(getProductRows(document)).toHaveLength(3);
    expect(value('amount[0]').value).toBe('3');
    expect(value('isFoil[100]').checked).toBe(true);
    expect(value('amount[100]').value).toBe('1');
    expect(value('price[100]').value).toBe('0.30');
  });

  it('defers placements when copying fails', async () => {
    const report = await applyPlan(
      document,
      [rowPlan([placement(), placement({ foil: true })])],
      { copyTimeoutMs: 20 },
    );
    expect(report.filled).toHaveLength(1);
    expect(report.deferred).toEqual([expect.objectContaining({ foil: true })]);
  });

  it('reports missing rows and unavailable options', async () => {
    const missing: RowPlan = { ...rowPlan([placement()]), row: { ...rowPlan([]).row, productId: 1 } };
    const badLanguage = rowPlan([placement({ languageId: 7 })]);
    const report = await applyPlan(document, [missing, badLanguage]);
    expect(report.filled).toEqual([]);
    expect(report.errors).toHaveLength(2);
    expect(report.errors[1]).toContain('Option 7');
  });
});
