/**
 * Builds the expansion table (set code → Cardmarket `idExpansion`s) from
 * MTGJSON's SetList (MIT licensed): https://mtgjson.com/api/v5/SetList.json
 *
 * Used at runtime by the popup and by scripts/generate-expansions.mjs for the
 * bundled fallback, so this module must stay free of runtime imports.
 */
import type { ExpansionTable } from './expansions';

export const SET_LIST_URL = 'https://mtgjson.com/api/v5/SetList.json';

export interface MtgjsonSet {
  code: string;
  name: string;
  isOnlineOnly?: boolean;
  mcmId?: number;
  mcmIdExtras?: number;
  mcmName?: string;
}

export interface FetchedExpansionTable {
  table: ExpansionTable;
  mtgjsonVersion: string | null;
  fetchedAt: string;
}

/** Keeps paper sets with a Cardmarket id; main expansion first, then "Extras". */
export function buildExpansionTable(sets: readonly MtgjsonSet[]): ExpansionTable {
  const table: ExpansionTable = {};
  const sorted = [...sets].sort((a, b) => a.code.localeCompare(b.code));
  for (const set of sorted) {
    if (set.isOnlineOnly || !Number.isInteger(set.mcmId)) continue;
    const ids = [set.mcmId, set.mcmIdExtras].filter(
      (id, i, all): id is number => Number.isInteger(id) && all.indexOf(id) === i,
    );
    table[set.code.toUpperCase()] = { name: set.mcmName ?? set.name, ids };
  }
  return table;
}

/** Downloads the SetList and builds the table. Throws on HTTP errors or an empty result. */
export async function fetchExpansionTable(
  doFetch: typeof fetch = fetch.bind(globalThis),
): Promise<FetchedExpansionTable> {
  const response = await doFetch(SET_LIST_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`MTGJSON request failed: HTTP ${response.status}`);
  const body = (await response.json()) as { data?: unknown; meta?: { version?: string } };
  const table = Array.isArray(body.data) ? buildExpansionTable(body.data as MtgjsonSet[]) : {};
  if (Object.keys(table).length === 0) throw new Error('MTGJSON returned no Cardmarket sets');
  return { table, mtgjsonVersion: body.meta?.version ?? null, fetchedAt: new Date().toISOString() };
}
