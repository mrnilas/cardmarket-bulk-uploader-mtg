#!/usr/bin/env node
/**
 * Regenerates src/data/expansions.json, the expansion table bundled as a
 * fallback. The extension downloads a fresh table from MTGJSON at runtime;
 * this snapshot is only used until that succeeds.
 *
 * Usage: npm run gen:expansions
 *
 * Manual corrections belong in src/data/expansions.overrides.json, which is
 * merged on top at runtime and never overwritten by this script.
 */
import { writeFile } from 'node:fs/promises';
import { fetchExpansionTable, SET_LIST_URL } from '../src/lib/mtgjson.ts';

const OUTPUT = new URL('../src/data/expansions.json', import.meta.url);

console.log(`Downloading ${SET_LIST_URL} …`);
const { table, mtgjsonVersion, fetchedAt } = await fetchExpansionTable();
const output = {
  source: 'MTGJSON SetList (https://mtgjson.com, MIT)',
  mtgjsonVersion,
  generatedAt: fetchedAt,
  sets: table,
};
await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote ${Object.keys(table).length} sets to src/data/expansions.json`);
