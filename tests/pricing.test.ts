import { describe, expect, it } from 'vitest';
import { computePrice } from '../src/lib/pricing';

describe('computePrice', () => {
  it('adds 10 % to the lowest offer and rounds up to full cents', () => {
    expect(computePrice(1)).toBe(1.1);
    expect(computePrice(0.25)).toBe(0.28);
    expect(computePrice(4.72)).toBe(5.2); // 5.192 → 5.20
    expect(computePrice(7.95)).toBe(8.75); // 8.745 → 8.75
    expect(computePrice(0.3)).toBe(0.33);
    expect(computePrice(0.02)).toBe(0.03); // 2.2 ct → 3 ct
  });

  it('never goes below the Cardmarket floor of 0.02 €', () => {
    expect(computePrice(0)).toBe(0.02);
    expect(computePrice(Number.NaN)).toBe(0.02);
    expect(computePrice(0.01, { markupPercent: 0 })).toBe(0.02);
  });

  it('respects a custom markup', () => {
    expect(computePrice(0.5, { markupPercent: 0 })).toBe(0.5);
    expect(computePrice(0.5, { markupPercent: 25 })).toBe(0.63);
  });
});
