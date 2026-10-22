import { CONDITION_IDS, LANGUAGE_IDS, MAX_AMOUNT_PER_ROW } from './cardmarket/ids';
import type { ExpansionIndex } from './expansions';
import type { CardRow } from './model';
import { computePrice, DEFAULT_PRICE_RULES, type PriceRules } from './pricing';

/** One product row of Cardmarket's "List by expansion" table (DOM-free). */
export interface PageRow {
  /** Position in the table (0-based). */
  index: number;
  productId: number;
  englishName: string;
  /** `idLanguage` values offered for this product. */
  languageIds: number[];
  trendPrice?: number;
}

/** What to write into one table row (original or copy). */
export interface Placement {
  productId: number;
  languageId: number;
  conditionId: number;
  foil: boolean;
  signed: boolean;
  amount: number;
  price: number;
  /** CSV rows covered by this placement. */
  sources: CardRow[];
}

/** placements[0] goes into the original row; every further one into a copy of it. */
export interface RowPlan {
  row: PageRow;
  placements: Placement[];
}

export type ReviewReason = 'ambiguous-name' | 'language-unavailable' | 'altered';

export interface ReviewItem {
  card: CardRow;
  reason: ReviewReason;
  detail: string;
}

export interface PagePlan {
  rows: RowPlan[];
  review: ReviewItem[];
  /** Number of CSV rows that will be filled on this page. */
  matched: number;
}

export interface PlanInput {
  pageRows: readonly PageRow[];
  /** Pending CSV rows (already filtered to the selected language). */
  cards: readonly CardRow[];
  /** `idExpansion` of the loaded page, needed for the name fallback. */
  expansionId: number | null;
  expansions: ExpansionIndex;
  priceRules?: PriceRules;
}

/**
 * Matches pending cards to the rows of the current page.
 *
 * 1. Cards with a Cardmarket id match the row with that `idProduct` (any page).
 * 2. Cards without one fall back to the English name, but only on pages of an
 *    expansion their set maps to, and only if the name is unique on the page.
 * Anything uncertain goes to the review list – nothing is guessed.
 */
export function planPage(input: PlanInput): PagePlan {
  const { pageRows, cards, expansionId, expansions } = input;
  const priceRules = input.priceRules ?? DEFAULT_PRICE_RULES;

  const byProduct = new Map(pageRows.map((row) => [row.productId, row]));
  const byName = new Map<string, PageRow[]>();
  for (const row of pageRows) {
    const key = normalizeName(row.englishName);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }

  const review: ReviewItem[] = [];
  // productId → variant key → placement without amount split
  const groups = new Map<number, { row: PageRow; variants: Map<string, Placement> }>();
  let matched = 0;

  for (const card of cards) {
    let row: PageRow | undefined;
    if (typeof card.cardmarketId === 'number') {
      row = byProduct.get(card.cardmarketId);
    } else if (expansionId !== null && expansions.setIncludes(card.setCode, expansionId)) {
      const candidates = byName.get(normalizeName(card.name)) ?? [];
      if (candidates.length > 1) {
        review.push({
          card,
          reason: 'ambiguous-name',
          detail: `${candidates.length} products named "${card.name}" on this page`,
        });
        continue;
      }
      row = candidates[0];
    }
    if (!row) continue;

    if (card.altered) {
      review.push({ card, reason: 'altered', detail: 'Altered cards must be listed manually' });
      continue;
    }
    const languageId = LANGUAGE_IDS[card.language];
    if (!row.languageIds.includes(languageId)) {
      review.push({
        card,
        reason: 'language-unavailable',
        detail: `Cardmarket offers no "${card.language}" version of this product`,
      });
      continue;
    }

    const group = groups.get(row.productId) ?? { row, variants: new Map<string, Placement>() };
    groups.set(row.productId, group);

    const foil = card.finish !== 'normal';
    const conditionId = CONDITION_IDS[card.condition];
    const key = [languageId, conditionId, foil, card.signed].join('|');
    const existing = group.variants.get(key);
    if (existing) {
      existing.amount += card.quantity;
      existing.sources.push(card);
    } else {
      group.variants.set(key, {
        productId: row.productId,
        languageId,
        conditionId,
        foil,
        signed: card.signed,
        amount: card.quantity,
        price: computePrice(card.rarity, row.trendPrice, priceRules),
        sources: [card],
      });
    }
    matched++;
  }

  const rows: RowPlan[] = [];
  for (const { row, variants } of groups.values()) {
    // Non-foil first, so the original row keeps the most common variant.
    const ordered = [...variants.values()].sort((a, b) => Number(a.foil) - Number(b.foil));
    rows.push({ row, placements: ordered.flatMap(splitByMaxAmount) });
  }
  rows.sort((a, b) => a.row.index - b.row.index);

  return { rows, review, matched };
}

/** Cardmarket accepts at most 32 copies per row → split larger amounts. */
function splitByMaxAmount(placement: Placement): Placement[] {
  if (placement.amount <= MAX_AMOUNT_PER_ROW) return [placement];
  const parts: Placement[] = [];
  for (let left = placement.amount; left > 0; left -= MAX_AMOUNT_PER_ROW) {
    parts.push({ ...placement, amount: Math.min(left, MAX_AMOUNT_PER_ROW) });
  }
  return parts;
}

export function normalizeName(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
