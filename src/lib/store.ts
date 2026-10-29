import { storage } from 'wxt/utils/storage';
import {
  bundledExpansionTable,
  bundledExpansionTableDate,
  indexWithOverrides,
  type ExpansionIndex,
} from './expansions';
import type { CardRow, Language } from './model';
import { fetchExpansionTable, type FetchedExpansionTable } from './mtgjson';
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

/** The last imported card list, shared by all listing tabs and the background script. */
export const currentImport = storage.defineItem<StoredImport | null>('local:currentImport', {
  fallback: null,
});

const settingsItem = storage.defineItem<Partial<Settings>>('local:settings', { fallback: {} });

export const progress = storage.defineItem<Progress>('local:progress', { fallback: { listed: [] } });

/** Expansion table downloaded from MTGJSON (replaces the bundled snapshot). */
export const expansionCache = storage.defineItem<FetchedExpansionTable | null>('local:expansionCache', {
  fallback: null,
});

/** Refresh the downloaded expansion table after a week (new sets appear every few weeks). */
export const EXPANSION_TABLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ExpansionTableInfo {
  source: 'mtgjson' | 'bundled';
  sets: number;
  /** ISO date of the download or of the bundled snapshot. */
  updatedAt: string | null;
}

/** Downloaded table if available, else the bundled one – always with overrides. */
export async function loadExpansionIndex(): Promise<ExpansionIndex> {
  const cache = await expansionCache.getValue();
  return indexWithOverrides(cache?.table ?? bundledExpansionTable);
}

export async function expansionTableInfo(): Promise<ExpansionTableInfo> {
  const cache = await expansionCache.getValue();
  return cache
    ? { source: 'mtgjson', sets: Object.keys(cache.table).length, updatedAt: cache.fetchedAt }
    : { source: 'bundled', sets: Object.keys(bundledExpansionTable).length, updatedAt: bundledExpansionTableDate };
}

/**
 * Downloads the table from MTGJSON if there is none yet or it is older than
 * the max age (`force` skips that check). On failure the current table stays.
 */
export async function refreshExpansionTable(
  options: { force?: boolean; now?: number; fetch?: typeof fetch } = {},
): Promise<boolean> {
  const cache = await expansionCache.getValue();
  const age = cache ? (options.now ?? Date.now()) - Date.parse(cache.fetchedAt) : Infinity;
  if (!options.force && age < EXPANSION_TABLE_MAX_AGE_MS) return false;
  await expansionCache.setValue(await fetchExpansionTable(options.fetch));
  return true;
}

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
  const unwatch = [
    currentImport.watch(callback),
    settingsItem.watch(callback),
    progress.watch(callback),
    expansionCache.watch(callback),
  ];
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
  index: ExpansionIndex,
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
