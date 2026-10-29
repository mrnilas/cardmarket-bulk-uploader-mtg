/**
 * Cardmarket ids from MTGJSON (MIT licensed):
 * - the expansion table (set code → `idExpansion`s) from the SetList,
 * - card ids (set code + collector number → `idProduct`) from the set files.
 *
 * Used at runtime by the background script and by scripts/generate-expansions.mjs for the
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

/** Card id map of one set: collector number (normalised) → `idProduct`, `null` if ambiguous. */
export type SetCardIds = Record<string, number | null>;

interface MtgjsonCard {
  number: string;
  identifiers?: { mcmId?: string | number };
}

/** MTGJSON appends `_` to set codes that are reserved file names on Windows (e.g. `CON_`). */
const RESERVED_FILE_NAMES = new Set(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'LPT1', 'LPT2']);

export function setFileUrl(setCode: string): string {
  const code = setCode.toUpperCase();
  return `https://mtgjson.com/api/v5/${RESERVED_FILE_NAMES.has(code) ? `${code}_` : code}.json`;
}

export function normalizeCollectorNumber(number: string): string {
  return number.trim().toLowerCase();
}

/**
 * Maps collector numbers to Cardmarket product ids. Foil and non-foil share
 * one product; a number with different ids (rare) is marked ambiguous.
 */
export function buildSetCardIds(cards: readonly MtgjsonCard[]): SetCardIds {
  const ids: SetCardIds = {};
  for (const card of cards) {
    const id = Number(card.identifiers?.mcmId);
    if (!Number.isInteger(id) || id <= 0) continue;
    const key = normalizeCollectorNumber(card.number);
    ids[key] = key in ids && ids[key] !== id ? null : id;
  }
  return ids;
}

/** Downloads one set file. Returns `null` if MTGJSON has no file for this code. */
export async function fetchSetCardIds(
  setCode: string,
  doFetch: typeof fetch = fetch.bind(globalThis),
): Promise<SetCardIds | null> {
  const response = await doFetch(setFileUrl(setCode), { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`MTGJSON request failed for ${setCode}: HTTP ${response.status}`);
  const body = (await response.json()) as { data?: { cards?: MtgjsonCard[] } };
  return buildSetCardIds(body.data?.cards ?? []);
}
