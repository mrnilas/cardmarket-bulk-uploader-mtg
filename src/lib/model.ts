/**
 * Source-agnostic card model. Every importer (ManaBox, later others) maps its
 * rows into `CardRow`; everything downstream only knows this type.
 */

export const FINISHES = ['normal', 'foil', 'etched'] as const;
export type Finish = (typeof FINISHES)[number];

export const RARITIES = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'] as const;
export type Rarity = (typeof RARITIES)[number];

/** Cardmarket condition grades, best to worst. */
export const CONDITIONS = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Card languages as used by Scryfall/ManaBox. */
export const LANGUAGES = ['en', 'de', 'fr', 'it', 'es', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface CardRow {
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  finish: Finish;
  rarity: Rarity;
  quantity: number;
  condition: Condition;
  language: Language;
  misprint: boolean;
  altered: boolean;
  signed: boolean;
  scryfallId: string;
  /** Buying price from the source app – NOT a selling price. */
  purchasePrice?: number;
  purchaseCurrency?: string;
  /** 1-based line number in the source file (header = line 1). */
  sourceLine: number;
}

export type IssueSeverity = 'error' | 'warning';

export interface ParseIssue {
  severity: IssueSeverity;
  line: number;
  field?: string;
  message: string;
}

export interface ParseResult {
  rows: CardRow[];
  issues: ParseIssue[];
}
