import { describe, expect, it } from 'vitest';
import { createExpansionIndex } from '../src/lib/expansions';
import { pendingCards, pendingExpansions } from '../src/lib/store';
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
