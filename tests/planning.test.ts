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

/** A card of the mapped set DFT. */
const dft = (overrides: Parameters<typeof card>[0] = {}) =>
  card({ setCode: 'DFT', name: 'Brightfield Glider', ...overrides });

describe('planPage', () => {
  it('matches by English name and prices with trend + minimum', () => {
    const glider = dft({ quantity: 2 });
    const mustang = dft({ name: 'Brightfield Mustang', rarity: 'rare' });
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

  it('normalises case and whitespace in names', () => {
    expect(plan([dft({ name: 'brightfield  glider ' })]).matched).toBe(1);
  });

  it('matches only on pages of an expansion the set maps to', () => {
    expect(plan([dft()], 6011).matched).toBe(1);
    expect(plan([dft()], 1234).matched).toBe(0);
    expect(plan([dft()], null).matched).toBe(0);
    expect(plan([card({ setCode: 'XYZ', name: 'Brightfield Glider' })]).matched).toBe(0);
  });

  it('ignores cards that are not on this page', () => {
    expect(plan([dft({ name: 'Elsewhere' })])).toEqual({ rows: [], review: [], matched: 0 });
  });

  it('sends ambiguous names to review instead of guessing', () => {
    const result = plan([dft({ name: 'Twin Name' })]);
    expect(result.matched).toBe(0);
    expect(result.review).toEqual([expect.objectContaining({ reason: 'ambiguous-name' })]);
  });

  it('sends unavailable languages and altered cards to review', () => {
    const result = plan([dft({ name: 'English Only', language: 'de' }), dft({ altered: true })]);
    expect(result.matched).toBe(0);
    expect(result.review.map((r) => r.reason)).toEqual(['language-unavailable', 'altered']);
  });

  it('puts non-foil in the original row and foil in a copy', () => {
    const foil = dft({ finish: 'foil' });
    const normal = dft({ quantity: 3 });
    const [row] = plan([foil, normal]).rows;
    expect(row!.placements.map((p) => [p.foil, p.amount])).toEqual([
      [false, 3],
      [true, 1],
    ]);
  });

  it('merges identical variants and splits amounts above 32', () => {
    const a = dft({ quantity: 30 });
    const b = dft({ quantity: 10 });
    const [row] = plan([a, b]).rows;
    expect(row!.placements.map((p) => p.amount)).toEqual([32, 8]);
    expect(row!.placements[0]!.sources).toEqual([a, b]);
  });

  it('keeps different conditions apart', () => {
    const [row] = plan([dft(), dft({ condition: 'EX' })]).rows;
    expect(row!.placements.map((p) => p.conditionId)).toEqual([2, 3]);
  });
});
