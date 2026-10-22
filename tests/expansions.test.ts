import { describe, expect, it } from 'vitest';
// @ts-expect-error – plain JS build script without type declarations
import { buildExpansionTable } from '../scripts/generate-expansions.mjs';
import { bulkListingUrl, createExpansionIndex } from '../src/lib/expansions';

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
