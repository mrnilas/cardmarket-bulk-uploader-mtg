import generated from '../data/expansions.json';
import overrides from '../data/expansions.overrides.json';

export interface ExpansionEntry {
  /** Cardmarket expansion name (English). */
  name: string;
  /** Cardmarket `idExpansion`s – main set first, then e.g. "Extras". */
  ids: number[];
}

export type ExpansionTable = Record<string, ExpansionEntry>;

export interface ExpansionIndex {
  /** Number of mapped set codes. */
  readonly size: number;
  /** Cardmarket expansion ids for a Scryfall/ManaBox set code (empty if unknown). */
  idsForSet(setCode: string): readonly number[];
  /** True if the set code maps to this Cardmarket expansion. */
  setIncludes(setCode: string, idExpansion: number): boolean;
}

export function createExpansionIndex(table: ExpansionTable): ExpansionIndex {
  const map = new Map<string, readonly number[]>();
  for (const [code, entry] of Object.entries(table)) map.set(code.toUpperCase(), entry.ids);
  return {
    size: map.size,
    idsForSet: (setCode) => map.get(setCode.toUpperCase()) ?? [],
    setIncludes: (setCode, idExpansion) => (map.get(setCode.toUpperCase()) ?? []).includes(idExpansion),
  };
}

/** Generated table plus manual overrides (overrides win). */
export const expansionIndex: ExpansionIndex = createExpansionIndex({
  ...(generated.sets as ExpansionTable),
  ...(overrides.sets as ExpansionTable),
});

export const expansionTableGeneratedAt: string | null = generated.generatedAt;

/** Cardmarket UI locales; the extension keeps whatever locale the user is on. */
export const CARDMARKET_LOCALES = ['de', 'en', 'fr', 'es', 'it'] as const;

export function bulkListingUrl(locale: string, idExpansion: number, site = 1): string {
  const params = new URLSearchParams({ idExpansion: String(idExpansion), sortBy: 'number' });
  if (site > 1) params.set('site', String(site));
  return `https://www.cardmarket.com/${locale}/Magic/Stock/ListingMethods/BulkListing?${params}`;
}
