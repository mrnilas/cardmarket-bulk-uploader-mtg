import type { Condition, Language } from '../model';

/** Cardmarket `idCondition` values (see docs/cardmarket-bulk-listing.md). */
export const CONDITION_IDS: Record<Condition, number> = {
  MT: 1,
  NM: 2,
  EX: 3,
  GD: 4,
  LP: 5,
  PL: 6,
  PO: 7,
};

/** Cardmarket `idLanguage` values for the languages ManaBox/Scryfall use. */
export const LANGUAGE_IDS: Record<Language, number> = {
  en: 1,
  fr: 2,
  de: 3,
  es: 4,
  it: 5,
  zhs: 6,
  ja: 7,
  pt: 8,
  ru: 9,
  ko: 10,
  zht: 11,
};

/** Cardmarket accepts at most this many copies per row. */
export const MAX_AMOUNT_PER_ROW = 32;

/** Cardmarket's lowest accepted price in EUR. */
export const CARDMARKET_MIN_PRICE = 0.02;
