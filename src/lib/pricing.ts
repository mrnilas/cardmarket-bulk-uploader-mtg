import { CARDMARKET_MIN_PRICE } from './cardmarket/ids';

export interface PriceRules {
  /** Markup on the lowest offer in percent. */
  markupPercent: number;
}

export const DEFAULT_PRICE_RULES: PriceRules = { markupPercent: 10 };

/**
 * Selling price = lowest offer of the same foiling plus the markup, rounded
 * **up** to full cents (1.00 € → 1.10 €, 0.25 € → 0.28 €). Calculated in cents
 * to avoid float errors; never below Cardmarket's floor.
 */
export function computePrice(lowestPrice: number, rules: PriceRules = DEFAULT_PRICE_RULES): number {
  const baseCents = Math.round((Number.isFinite(lowestPrice) ? lowestPrice : 0) * 100);
  // The epsilon keeps exact results (100 ct × 110 % = 110 ct) from being bumped by float noise.
  const cents = Math.ceil((baseCents * (100 + rules.markupPercent)) / 100 - 1e-9);
  return Math.max(cents, Math.round(CARDMARKET_MIN_PRICE * 100)) / 100;
}
