import type { CardRow, Finish, Language } from './model';

export interface SetGroup {
  setCode: string;
  setName: string;
  rows: CardRow[];
}

/** Groups rows by set code, sorted by set name. Row order inside a set is kept. */
export function groupBySet(rows: readonly CardRow[]): SetGroup[] {
  const groups = new Map<string, SetGroup>();
  for (const row of rows) {
    let group = groups.get(row.setCode);
    if (!group) {
      group = { setCode: row.setCode, setName: row.setName, rows: [] };
      groups.set(row.setCode, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => a.setName.localeCompare(b.setName));
}

/** Splits a list into consecutive chunks of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`Invalid chunk size ${size}`);
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export interface Summary {
  rows: number;
  cards: number;
  sets: number;
  byFinish: Partial<Record<Finish, number>>;
  byLanguage: Partial<Record<Language, number>>;
}

/** Counts rows and cards (sum of quantities); finish/language counts are in cards. */
export function summarize(rows: readonly CardRow[]): Summary {
  const byFinish: Summary['byFinish'] = {};
  const byLanguage: Summary['byLanguage'] = {};
  const sets = new Set<string>();
  let cards = 0;
  for (const row of rows) {
    cards += row.quantity;
    sets.add(row.setCode);
    byFinish[row.finish] = (byFinish[row.finish] ?? 0) + row.quantity;
    byLanguage[row.language] = (byLanguage[row.language] ?? 0) + row.quantity;
  }
  return { rows: rows.length, cards, sets: sets.size, byFinish, byLanguage };
}
