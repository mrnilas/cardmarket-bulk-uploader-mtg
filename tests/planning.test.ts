import { describe, expect, it } from 'vitest';
import { createExpansionIndex } from '../src/lib/expansions';
import { planPage, type PageRow } from '../src/lib/planning';
import { card } from './helpers';

const expansions = createExpansionIndex({ DFT: { name: 'Aetherdrift', ids: [5982, 6011] } });

const pageRows: PageRow[] = [
  { index: 0, productId: 808219, englishName: 'Brightfield Glider', languageIds: [1, 3], trendPrice: 0.09 },
  { index: 1, productId: 807833, englishName: 'Brightfield Mustang', languageIds: [1, 3], trendPrice: 0.5 },
  { index: 2, productId: 900001, englishName: 'Twin Name', languageIds: [1, 3] },
  { index: 3, productId: 900002, englishName: 'Twin Name', languageIds: [1, 3] },
  { index: 4, productId: 900003, englishName: 'English Only', languageIds: [1], trendPrice: 3 },
];

const plan = (cards: ReturnType<typeof card>[], expansionId: number | null = 5982) =>
  planPage({ pageRows, cards, expansionId, expansions });

describe('planPage', () => {
  it('matches by Cardmarket id and prices with trend + minimum', () => {
    const glider = card({ cardmarketId: 808219, quantity: 2 });
    const mustang = card({ cardmarketId: 807833, rarity: 'rare' });
    const result = plan([glider, mustang]);

    expect(result.matched).toBe(2);
    expect(result.review).toEqual([]);
    expect(result.rows.map((r) => r.row.productId)).toEqual([808219, 807833]);
    expect(result.rows[0]!.placements).toEqual([
      {
        productId: 808219,
        languageId: 3,
        conditionId: 2,
        foil: false,
        signed: false,
        amount: 2,
        price: 0.1,
        sources: [glider],
      },
    ]);
    expect(result.rows[1]!.placements[0]!.price).toBe(0.5);
  });

  it('matches by Cardmarket id on any page, regardless of the set mapping', () => {
    expect(plan([card({ setCode: 'OTHER', cardmarketId: 808219 })], 1234).matched).toBe(1);
  });

  it('ignores cards that are not on this page', () => {
    const result = plan([card({ cardmarketId: 1 }), card({ setCode: 'DFT', name: 'Elsewhere' })]);
    expect(result).toEqual({ rows: [], review: [], matched: 0 });
  });

  it('falls back to the English name only for mapped expansions', () => {
    const byName = card({ setCode: 'DFT', name: 'brightfield  glider', cardmarketId: null });
    expect(plan([byName]).matched).toBe(1);
    expect(plan([byName], 6011).matched).toBe(1);
    expect(plan([byName], 1234).matched).toBe(0);
    expect(plan([card({ setCode: 'XYZ', name: 'Brightfield Glider' })]).matched).toBe(0);
  });

  it('sends ambiguous names to review instead of guessing', () => {
    const result = plan([card({ setCode: 'DFT', name: 'Twin Name' })]);
    expect(result.matched).toBe(0);
    expect(result.review).toEqual([expect.objectContaining({ reason: 'ambiguous-name' })]);
  });

  it('sends unavailable languages and altered cards to review', () => {
    const result = plan([
      card({ cardmarketId: 900003, language: 'de' }),
      card({ cardmarketId: 808219, altered: true }),
    ]);
    expect(result.matched).toBe(0);
    expect(result.review.map((r) => r.reason)).toEqual(['language-unavailable', 'altered']);
  });

  it('puts non-foil in the original row and foil in a copy', () => {
    const foil = card({ cardmarketId: 808219, finish: 'foil' });
    const normal = card({ cardmarketId: 808219, quantity: 3 });
    const [row] = plan([foil, normal]).rows;
    expect(row!.placements.map((p) => [p.foil, p.amount])).toEqual([
      [false, 3],
      [true, 1],
    ]);
  });

  it('merges identical variants and splits amounts above 32', () => {
    const a = card({ cardmarketId: 808219, quantity: 30 });
    const b = card({ cardmarketId: 808219, quantity: 10 });
    const [row] = plan([a, b]).rows;
    expect(row!.placements.map((p) => p.amount)).toEqual([32, 8]);
    expect(row!.placements[0]!.sources).toEqual([a, b]);
  });

  it('keeps different conditions apart', () => {
    const [row] = plan([card({ cardmarketId: 808219 }), card({ cardmarketId: 808219, condition: 'EX' })]).rows;
    expect(row!.placements.map((p) => p.conditionId)).toEqual([2, 3]);
  });
});
