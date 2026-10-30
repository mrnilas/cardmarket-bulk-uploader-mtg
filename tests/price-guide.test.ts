import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { buildPriceGuide, fetchPriceGuide, lowestPrice, PRICE_GUIDE_URL } from '../src/lib/cardmarket/price-guide';
import {
  loadPriceGuide,
  PRICE_GUIDE_MAX_AGE_MS,
  PRICE_GUIDE_RETRY_MS,
  priceGuideIsStale,
  priceGuideItem,
} from '../src/lib/store';

// Entries as in Cardmarket's price_guide_1.json (2026-10-29, shortened).
const body = {
  version: 1,
  createdAt: '2026-10-29T02:52:45+0100',
  priceGuides: [
    { idProduct: 808219, idCategory: 1, low: 0.02, trend: 0.09, 'low-foil': 0.02, 'trend-foil': 0.13 },
    { idProduct: 807383, idCategory: 1, low: 6.63, trend: 0, avg: null, 'low-foil': 6.63, 'trend-foil': 7.95 },
    { idProduct: 807382, idCategory: 1, low: 1.4, 'low-foil': 2.2 },
    { idProduct: 1, idCategory: 1, low: 0, 'low-foil': null },
  ],
};

describe('buildPriceGuide', () => {
  it('keeps the lowest offer per foiling and converts the date to ISO', () => {
    const guide = buildPriceGuide(body, '2026-10-29T10:00:00.000Z');
    expect(guide).toEqual({
      createdAt: '2026-10-29T01:52:45.000Z',
      fetchedAt: '2026-10-29T10:00:00.000Z',
      prices: { 808219: [0.02, 0.02], 807383: [6.63, 6.63], 807382: [1.4, 2.2] },
    });
    expect(lowestPrice(guide.prices, 807382, true)).toBe(2.2);
    expect(lowestPrice(guide.prices, 807382, false)).toBe(1.4);
    expect(lowestPrice(guide.prices, 1, false)).toBeUndefined();
  });

  it('downloads the file and rejects errors and empty files', async () => {
    let url = '';
    const guide = await fetchPriceGuide(async (input) => {
      url = String(input);
      return new Response(JSON.stringify(body));
    });
    expect(url).toBe(PRICE_GUIDE_URL);
    expect(Object.keys(guide.prices)).toHaveLength(3);
    await expect(fetchPriceGuide(async () => new Response('', { status: 403 }))).rejects.toThrow('HTTP 403');
    await expect(fetchPriceGuide(async () => new Response('{"priceGuides":[]}'))).rejects.toThrow('no prices');
  });
});

describe('loadPriceGuide', () => {
  beforeEach(() => fakeBrowser.reset());

  const created = Date.parse('2026-10-29T01:52:45.000Z');
  const guide = { createdAt: new Date(created).toISOString(), fetchedAt: new Date(created).toISOString(), prices: {} };

  it('renews the guide once a day, but asks at most hourly while no new file is out', () => {
    expect(priceGuideIsStale(null)).toBe(true);
    expect(priceGuideIsStale(guide, created + PRICE_GUIDE_MAX_AGE_MS - 1)).toBe(false);
    expect(priceGuideIsStale(guide, created + PRICE_GUIDE_MAX_AGE_MS)).toBe(true);
    const justTried = { ...guide, fetchedAt: new Date(created + PRICE_GUIDE_MAX_AGE_MS).toISOString() };
    expect(priceGuideIsStale(justTried, created + PRICE_GUIDE_MAX_AGE_MS + PRICE_GUIDE_RETRY_MS - 1)).toBe(false);
  });

  it('stores a fresh download and falls back to the stored guide on errors', async () => {
    const fresh = await loadPriceGuide({ fetch: async () => new Response(JSON.stringify(body)) });
    expect((await priceGuideItem.getValue())?.prices).toEqual(fresh.prices);

    const later = Date.parse(fresh.createdAt) + 2 * PRICE_GUIDE_MAX_AGE_MS;
    const failing = async () => new Response('', { status: 500 });
    expect((await loadPriceGuide({ now: later, fetch: failing })).prices).toEqual(fresh.prices);

    await priceGuideItem.setValue(null);
    await expect(loadPriceGuide({ fetch: failing })).rejects.toThrow('HTTP 500');
  });
});
