import { describe, expect, it } from 'vitest';
import { computePrice, DEFAULT_PRICE_RULES } from '../src/lib/pricing';

describe('computePrice', () => {
  it('uses the trend price when above the minimum', () => {
    expect(computePrice('common', 0.37)).toBe(0.37);
    expect(computePrice('rare', 4.5)).toBe(4.5);
  });

  it('never goes below the minimum for the rarity', () => {
    expect(computePrice('common', 0.02)).toBe(0.1);
    expect(computePrice('uncommon', 0.09)).toBe(0.1);
    expect(computePrice('rare', 0.15)).toBe(0.25);
    expect(computePrice('mythic', 0.2)).toBe(0.25);
  });

  it('falls back to the minimum without a usable trend price', () => {
    expect(computePrice('common', undefined)).toBe(0.1);
    expect(computePrice('rare', 0)).toBe(0.25);
    expect(computePrice('rare', Number.NaN)).toBe(0.25);
  });

  it('rounds to cents', () => {
    expect(computePrice('common', 0.456)).toBe(0.46);
  });

  it('respects custom rules and the Cardmarket floor of 0.02 €', () => {
    const rules = { minPrice: { ...DEFAULT_PRICE_RULES.minPrice, common: 0 } };
    expect(computePrice('common', undefined, rules)).toBe(0.02);
    expect(computePrice('common', 0.05, rules)).toBe(0.05);
  });
});
