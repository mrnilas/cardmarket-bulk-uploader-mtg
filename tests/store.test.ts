import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createExpansionIndex } from '../src/lib/expansions';
import {
  EXPANSION_TABLE_MAX_AGE_MS,
  expansionCache,
  expansionTableInfo,
  loadExpansionIndex,
  pendingCards,
  pendingExpansions,
  refreshExpansionTable,
} from '../src/lib/store';
import { card } from './helpers';

describe('pendingCards', () => {
  const de = card({ language: 'de', sourceLine: 2 });
  const en = card({ language: 'en', sourceLine: 3 });
  const deListed = card({ language: 'de', sourceLine: 4 });

  it('keeps the selected language and drops listed rows', () => {
    expect(pendingCards([de, en, deListed], 'de', [4])).toEqual([de]);
  });

  it('returns nothing without a selected language', () => {
    expect(pendingCards([de, en], null, [])).toEqual([]);
  });
});

describe('pendingExpansions', () => {
  it('counts cards per Cardmarket expansion and unmapped sets', () => {
    const index = createExpansionIndex({
      DFT: { name: 'Aetherdrift', ids: [5982, 6011] },
      BLB: { name: 'Bloomburrow', ids: [5658] },
    });
    const result = pendingExpansions(
      [
        card({ setCode: 'DFT', quantity: 2 }),
        card({ setCode: 'BLB' }),
        card({ setCode: 'XYZ', quantity: 3 }),
      ],
      index,
    );
    expect(result).toEqual({
      expansions: [
        { idExpansion: 5658, cards: 1 },
        { idExpansion: 5982, cards: 2 },
        { idExpansion: 6011, cards: 2 },
      ],
      unmapped: 3,
    });
  });
});

describe('expansion table', () => {
  beforeEach(() => fakeBrowser.reset());

  const setList = (sets: object[]) => async () => new Response(JSON.stringify({ data: sets }));
  const dft = { code: 'DFT', name: 'Aetherdrift', mcmId: 5982, mcmIdExtras: 6011 };

  it('downloads the table when there is none and uses it from then on', async () => {
    expect((await expansionTableInfo()).source).toBe('bundled');
    expect(await refreshExpansionTable({ fetch: setList([dft]) })).toBe(true);

    expect(await expansionTableInfo()).toMatchObject({ source: 'mtgjson', sets: 1 });
    expect((await loadExpansionIndex()).idsForSet('DFT')).toEqual([5982, 6011]);
  });

  it('skips the download while the table is fresh, unless forced', async () => {
    const fetchedAt = '2026-10-01T00:00:00.000Z';
    await expansionCache.setValue({ table: {}, mtgjsonVersion: null, fetchedAt });
    const now = Date.parse(fetchedAt) + EXPANSION_TABLE_MAX_AGE_MS - 1;
    const fail = async () => {
      throw new Error('should not fetch');
    };

    expect(await refreshExpansionTable({ now, fetch: fail })).toBe(false);
    expect(await refreshExpansionTable({ now: now + 1, fetch: setList([dft]) })).toBe(true);
    expect(await refreshExpansionTable({ force: true, fetch: setList([dft]) })).toBe(true);
  });

  it('keeps the current table when the download fails', async () => {
    await refreshExpansionTable({ fetch: setList([dft]) });
    await expect(refreshExpansionTable({ force: true, fetch: setList([]) })).rejects.toThrow();
    expect((await loadExpansionIndex()).idsForSet('DFT')).toEqual([5982, 6011]);
  });
});
