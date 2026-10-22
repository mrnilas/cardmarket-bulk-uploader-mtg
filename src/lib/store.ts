import { storage } from 'wxt/utils/storage';
import { expansionIndex, type ExpansionIndex } from './expansions';
import type { CardRow, Language } from './model';
import { DEFAULT_PRICE_RULES, type PriceRules } from './pricing';

export interface StoredImport {
  fileName: string;
  importedAt: string;
  rows: CardRow[];
}

export interface Settings {
  /** Language listed in the current run (one language per run). */
  language: Language | null;
  priceRules: PriceRules;
}

export interface Progress {
  /** `sourceLine`s of CSV rows the user listed on Cardmarket. */
  listed: number[];
}

/** The last imported card list, shared between popup and content script. */
export const currentImport = storage.defineItem<StoredImport | null>('local:currentImport', {
  fallback: null,
});

const settingsItem = storage.defineItem<Partial<Settings>>('local:settings', { fallback: {} });

export const progress = storage.defineItem<Progress>('local:progress', { fallback: { listed: [] } });

export async function loadSettings(): Promise<Settings> {
  const stored = await settingsItem.getValue();
  return {
    language: stored.language ?? null,
    priceRules: {
      minPrice: { ...DEFAULT_PRICE_RULES.minPrice, ...stored.priceRules?.minPrice },
    },
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await settingsItem.setValue(next);
  return next;
}

export function watchStorage(callback: () => void): () => void {
  const unwatch = [currentImport.watch(callback), settingsItem.watch(callback), progress.watch(callback)];
  return () => unwatch.forEach((fn) => fn());
}

/** Rows of the selected language that are not marked as listed yet. */
export function pendingCards(rows: readonly CardRow[], language: Language | null, listed: readonly number[]): CardRow[] {
  if (!language) return [];
  const done = new Set(listed);
  return rows.filter((row) => row.language === language && !done.has(row.sourceLine));
}

export async function markListed(sourceLines: Iterable<number>): Promise<void> {
  const current = await progress.getValue();
  await progress.setValue({ listed: [...new Set([...current.listed, ...sourceLines])] });
}

export interface PendingExpansion {
  idExpansion: number;
  cards: number;
}

/**
 * Cardmarket expansions that still have pending cards, in a stable order
 * (by set code). Cards of unmapped sets are counted separately.
 */
export function pendingExpansions(
  cards: readonly CardRow[],
  index: ExpansionIndex = expansionIndex,
): { expansions: PendingExpansion[]; unmapped: number } {
  const counts = new Map<number, number>();
  let unmapped = 0;
  const sorted = [...cards].sort((a, b) => a.setCode.localeCompare(b.setCode));
  for (const card of sorted) {
    const ids = index.idsForSet(card.setCode);
    if (ids.length === 0) unmapped += card.quantity;
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + card.quantity);
  }
  return {
    expansions: [...counts].map(([idExpansion, count]) => ({ idExpansion, cards: count })),
    unmapped,
  };
}
