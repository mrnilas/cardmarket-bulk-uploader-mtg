import { describe, expect, it } from 'vitest';
import { bulkListingUrl, createExpansionIndex } from '../src/lib/expansions';
import {
  buildExpansionTable,
  buildSetCardIds,
  fetchExpansionTable,
  fetchSetCardIds,
  SET_LIST_URL,
  setFileUrl,
} from '../src/lib/mtgjson';

describe('buildExpansionTable', () => {
  it('maps set codes to main and extras expansion ids, skipping online-only sets', () => {
    const table = buildExpansionTable([
      { code: 'DFT', name: 'Aetherdrift', mcmId: 5982, mcmIdExtras: 6011, mcmName: 'Aetherdrift' },
      { code: 'PDFT', name: 'Aetherdrift Promos', mcmId: 5991 },
      { code: 'YDFT', name: 'Alchemy: Aetherdrift', isOnlineOnly: true, mcmId: 1 },
      { code: 'NOPE', name: 'Not on Cardmarket' },
      { code: 'SAME', name: 'Same', mcmId: 7, mcmIdExtras: 7 },
    ]);
    expect(table).toEqual({
      DFT: { name: 'Aetherdrift', ids: [5982, 6011] },
      PDFT: { name: 'Aetherdrift Promos', ids: [5991] },
      SAME: { name: 'Same', ids: [7] },
    });
  });
});

describe('fetchExpansionTable', () => {
  const respond = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

  it('downloads the SetList and keeps the MTGJSON version', async () => {
    let url = '';
    const result = await fetchExpansionTable(async (input) => {
      url = String(input);
      return respond({ meta: { version: '5.2.2' }, data: [{ code: 'dft', name: 'Aetherdrift', mcmId: 5982 }] })();
    });
    expect(url).toBe(SET_LIST_URL);
    expect(result.table).toEqual({ DFT: { name: 'Aetherdrift', ids: [5982] } });
    expect(result.mtgjsonVersion).toBe('5.2.2');
  });

  it('rejects HTTP errors and responses without Cardmarket sets', async () => {
    await expect(fetchExpansionTable(respond({}, 503))).rejects.toThrow('HTTP 503');
    await expect(fetchExpansionTable(respond({ data: [{ code: 'X', name: 'X' }] }))).rejects.toThrow('no Cardmarket sets');
  });
});

describe('createExpansionIndex', () => {
  const index = createExpansionIndex({ DFT: { name: 'Aetherdrift', ids: [5982, 6011] } });

  it('looks up ids case-insensitively', () => {
    expect(index.idsForSet('dft')).toEqual([5982, 6011]);
    expect(index.idsForSet('XYZ')).toEqual([]);
    expect(index.setIncludes('DFT', 6011)).toBe(true);
    expect(index.setIncludes('DFT', 1)).toBe(false);
    expect(index.size).toBe(1);
  });
});

describe('bulkListingUrl', () => {
  it('builds the "list by expansion" URL', () => {
    expect(bulkListingUrl('de', 5982)).toBe(
      'https://www.cardmarket.com/de/Magic/Stock/ListingMethods/BulkListing?idExpansion=5982&sortBy=number',
    );
    expect(bulkListingUrl('en', 5982, 3)).toContain('&site=3');
  });
});

describe('set card ids', () => {
  it('maps collector numbers to Cardmarket ids, marking conflicts as ambiguous', () => {
    expect(
      buildSetCardIds([
        { number: '4', identifiers: { mcmId: '808219' } },
        { number: '354★', identifiers: { mcmId: '807382' } },
        { number: '10', identifiers: {} },
        { number: '20a', identifiers: { mcmId: '1' } },
        { number: '20A', identifiers: { mcmId: '1' } },
        { number: '30', identifiers: { mcmId: '2' } },
        { number: '30', identifiers: { mcmId: '3' } },
      ]),
    ).toEqual({ '4': 808219, '354★': 807382, '20a': 1, '30': null });
  });

  it('uses MTGJSON file names, including reserved ones', () => {
    expect(setFileUrl('dft')).toBe('https://mtgjson.com/api/v5/DFT.json');
    expect(setFileUrl('con')).toBe('https://mtgjson.com/api/v5/CON_.json');
  });

  it('returns null for sets MTGJSON has no file for', async () => {
    expect(await fetchSetCardIds('XYZ', async () => new Response('', { status: 404 }))).toBeNull();
    await expect(fetchSetCardIds('DFT', async () => new Response('', { status: 500 }))).rejects.toThrow('HTTP 500');
  });
});
