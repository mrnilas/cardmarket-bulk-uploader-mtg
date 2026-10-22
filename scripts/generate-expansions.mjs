#!/usr/bin/env node
/**
 * Generates src/data/expansions.json: Scryfall/MTGJSON set code → Cardmarket
 * expansion id(s) (`idExpansion`), based on MTGJSON's SetList (MIT licensed).
 *
 * Usage: npm run gen:expansions
 *
 * Manual corrections belong in src/data/expansions.overrides.json, which is
 * merged on top at runtime and never overwritten by this script.
 */
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const SET_LIST_URL = 'https://mtgjson.com/api/v5/SetList.json';
const OUTPUT = new URL('../src/data/expansions.json', import.meta.url);

/**
 * @param {Array<{code: string, name: string, isOnlineOnly?: boolean, mcmId?: number, mcmIdExtras?: number, mcmName?: string}>} sets
 * @returns {Record<string, {name: string, ids: number[]}>}
 */
export function buildExpansionTable(sets) {
  /** @type {Record<string, {name: string, ids: number[]}>} */
  const table = {};
  const sorted = [...sets].sort((a, b) => a.code.localeCompare(b.code));
  for (const set of sorted) {
    if (set.isOnlineOnly || !Number.isInteger(set.mcmId)) continue;
    const ids = [set.mcmId, set.mcmIdExtras].filter(
      (id, i, all) => Number.isInteger(id) && all.indexOf(id) === i,
    );
    table[set.code.toUpperCase()] = { name: set.mcmName ?? set.name, ids };
  }
  return table;
}

async function main() {
  console.log(`Downloading ${SET_LIST_URL} …`);
  const response = await fetch(SET_LIST_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${SET_LIST_URL}`);
  const { data, meta } = await response.json();
  const sets = buildExpansionTable(data);
  const output = {
    source: 'MTGJSON SetList (https://mtgjson.com, MIT)',
    mtgjsonVersion: meta?.version ?? null,
    generatedAt: new Date().toISOString(),
    sets,
  };
  await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(sets).length} sets to src/data/expansions.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
