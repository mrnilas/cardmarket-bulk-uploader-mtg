import { CARDMARKET_MIN_PRICE } from './cardmarket/ids';
import type { Rarity } from './model';

export interface PriceRules {
  /** Minimum selling price in EUR per rarity. */
  minPrice: Record<Rarity, number>;
}

export const DEFAULT_PRICE_RULES: PriceRules = {
  minPrice: {
    common: 0.1,
    uncommon: 0.1,
    rare: 0.25,
    mythic: 0.25,
    special: 0.25,
    bonus: 0.25,
  },
};

/**
 * Selling price = Cardmarket trend price, but never below the minimum for the
 * card's rarity and never below Cardmarket's floor. Rounded to cents.
 */
export function computePrice(
  rarity: Rarity,
  trendPrice: number | undefined,
  rules: PriceRules = DEFAULT_PRICE_RULES,
): number {
  const trend = trendPrice !== undefined && Number.isFinite(trendPrice) && trendPrice > 0 ? trendPrice : 0;
  const price = Math.max(trend, rules.minPrice[rarity], CARDMARKET_MIN_PRICE);
  return Math.round(price * 100) / 100;
}
