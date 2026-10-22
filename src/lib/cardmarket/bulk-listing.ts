/**
 * DOM adapter for Cardmarket's "List by expansion" page (BulkListing).
 * Structure: see docs/cardmarket-bulk-listing.md. Fills the form only –
 * submitting is always left to the user.
 */
import type { PageRow, Placement, RowPlan } from '../planning';

export const BULK_LISTING_MATCHES = ['*://*.cardmarket.com/*/Magic/Stock/ListingMethods/BulkListing*'];

const FORM_SELECTOR = '#BulkListingForm';
const PRODUCT_INPUT = 'input[name^="idProduct["]';
const COPY_BUTTON = 'button.copy-row-button';
export const SUBMIT_BUTTON_SELECTOR = 'input[type="submit"][form="BulkListingForm"], #BulkListingForm [type="submit"]';

export interface PageInfo {
  expansionId: number | null;
  expansionName: string | null;
  site: number;
  nextPageUrl: string | null;
  rows: PageRow[];
}

/** Reads the loaded page. Returns no rows if the table is missing. */
export function readPage(doc: Document, url: URL): PageInfo {
  const select = doc.querySelector<HTMLSelectElement>('select[name="idExpansion"]');
  const fromUrl = Number(url.searchParams.get('idExpansion'));
  const fromSelect = Number(select?.value);
  const expansionId = fromUrl > 0 ? fromUrl : fromSelect > 0 ? fromSelect : null;
  const selected = expansionId
    ? select?.querySelector<HTMLOptionElement>(`option[value="${expansionId}"]`)
    : select?.selectedOptions[0];

  const next = doc.querySelector<HTMLAnchorElement>('a[data-direction="next"]:not(.disabled)[href]');
  const site = Number(url.searchParams.get('site')) || 1;

  return {
    expansionId,
    expansionName: selected?.textContent?.trim() || null,
    site,
    nextPageUrl: next ? new URL(next.getAttribute('href')!, url).href : null,
    rows: getProductRows(doc)
      .map((tr, index) => parseRow(tr, index))
      .filter((row): row is PageRow => row !== null),
  };
}

/** All product rows of the listing table, including copies. */
export function getProductRows(doc: Document): HTMLTableRowElement[] {
  const form = doc.querySelector(FORM_SELECTOR);
  if (!form) return [];
  return [...form.querySelectorAll<HTMLTableRowElement>('tbody tr')].filter((tr) => tr.querySelector(PRODUCT_INPUT));
}

function parseRow(tr: HTMLTableRowElement, index: number): PageRow | null {
  const productId = Number(tr.querySelector<HTMLInputElement>(PRODUCT_INPUT)?.value);
  if (!Number.isInteger(productId) || productId <= 0) return null;

  const product = tr.querySelector('.col-product');
  const englishName = (
    product?.querySelector('.fst-italic')?.textContent ??
    product?.querySelector('a')?.textContent ??
    ''
  ).trim();

  const languageIds = [...(tr.querySelector<HTMLSelectElement>('select[name^="idLanguage["]')?.options ?? [])]
    .map((option) => Number(option.value))
    .filter((id) => id > 0);

  const trend = Number.parseFloat(tr.querySelector<HTMLInputElement>('input[name="trendPrice"]')?.value ?? '');

  return {
    index,
    productId,
    englishName,
    languageIds,
    trendPrice: Number.isFinite(trend) ? trend : undefined,
  };
}

/** Writes one placement into a table row and fires the events Cardmarket listens to. */
export function fillRow(tr: HTMLTableRowElement, placement: Placement): void {
  setSelect(tr, 'idLanguage[', placement.languageId);
  setSelect(tr, 'idCondition[', placement.conditionId);
  setCheckbox(tr, 'isFoil[', placement.foil);
  setCheckbox(tr, 'isSigned[', placement.signed);
  setInput(tr, 'amount[', String(placement.amount));
  setInput(tr, 'price[', placement.price.toFixed(2));
  tr.dataset.cbuFilled = 'true';
}

/**
 * Clicks Cardmarket's "copy row" button and resolves with the new row,
 * or `null` if no copy appeared within the timeout.
 */
export function copyRow(tr: HTMLTableRowElement, timeoutMs = 2000): Promise<HTMLTableRowElement | null> {
  const button = tr.querySelector<HTMLButtonElement>(COPY_BUTTON);
  const tbody = tr.parentElement;
  const productId = tr.querySelector<HTMLInputElement>(PRODUCT_INPUT)?.value;
  if (!button || !tbody || !productId) return Promise.resolve(null);

  const before = new Set(tbody.children);
  const findCopy = () =>
    [...tbody.children].find(
      (el): el is HTMLTableRowElement =>
        !before.has(el) &&
        el.tagName === 'TR' &&
        el.querySelector<HTMLInputElement>(PRODUCT_INPUT)?.value === productId,
    ) ?? null;

  return new Promise((resolve) => {
    const finish = (row: HTMLTableRowElement | null) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(row);
    };
    const observer = new MutationObserver(() => {
      const copy = findCopy();
      if (copy) finish(copy);
    });
    observer.observe(tbody, { childList: true });
    const timer = setTimeout(() => finish(findCopy()), timeoutMs);
    button.click();
  });
}

export interface FilledPlacement {
  placement: Placement;
  row: HTMLTableRowElement;
}

export interface FillReport {
  filled: FilledPlacement[];
  /** Placements that need a second pass (row copy failed). */
  deferred: Placement[];
  errors: string[];
}

/** Applies a page plan: first placement into the row, further ones into copies. */
export async function applyPlan(
  doc: Document,
  plans: readonly RowPlan[],
  options: { copyTimeoutMs?: number } = {},
): Promise<FillReport> {
  const report: FillReport = { filled: [], deferred: [], errors: [] };
  const originals = new Map<number, HTMLTableRowElement>();
  for (const tr of getProductRows(doc)) {
    const id = Number(tr.querySelector<HTMLInputElement>(PRODUCT_INPUT)?.value);
    if (!originals.has(id)) originals.set(id, tr);
  }

  for (const { row, placements } of plans) {
    const tr = originals.get(row.productId);
    if (!tr) {
      report.errors.push(`Row for product ${row.productId} not found`);
      continue;
    }
    for (const [i, placement] of placements.entries()) {
      try {
        const target = i === 0 ? tr : await copyRow(tr, options.copyTimeoutMs);
        if (!target) {
          report.deferred.push(placement);
          continue;
        }
        fillRow(target, placement);
        report.filled.push({ placement, row: target });
      } catch (error) {
        report.errors.push(`Product ${row.productId}: ${(error as Error).message}`);
      }
    }
  }
  return report;
}

/** Current amount in a filled row (the user may have changed it). */
export function readAmount(tr: HTMLTableRowElement): number {
  return Number(tr.querySelector<HTMLInputElement>('input[name^="amount["]')?.value) || 0;
}

function field<T extends HTMLElement>(tr: HTMLTableRowElement, prefix: string): T {
  const el = tr.querySelector<T>(`[name^="${prefix}"]`);
  if (!el) throw new Error(`Field ${prefix}…] missing`);
  return el;
}

function setSelect(tr: HTMLTableRowElement, prefix: string, value: number): void {
  const select = field<HTMLSelectElement>(tr, prefix);
  if (![...select.options].some((o) => o.value === String(value))) {
    throw new Error(`Option ${value} not available for ${prefix}…]`);
  }
  select.value = String(value);
  fire(select, 'change');
}

function setCheckbox(tr: HTMLTableRowElement, prefix: string, checked: boolean): void {
  const box = field<HTMLInputElement>(tr, prefix);
  if (box.checked === checked) return;
  box.checked = checked;
  fire(box, 'change');
}

function setInput(tr: HTMLTableRowElement, prefix: string, value: string): void {
  const input = field<HTMLInputElement>(tr, prefix);
  input.value = value;
  fire(input, 'input');
  fire(input, 'change');
}

function fire(el: HTMLElement, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}
