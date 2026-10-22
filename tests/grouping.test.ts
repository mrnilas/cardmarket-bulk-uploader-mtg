import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseManaBoxCsv } from '../src/lib/csv/manabox';
import { chunk, groupBySet, summarize } from '../src/lib/grouping';

const { rows } = parseManaBoxCsv(
  readFileSync(new URL('./fixtures/manabox-sample.csv', import.meta.url), 'utf8'),
);

describe('groupBySet', () => {
  it('groups by set code and sorts by set name', () => {
    const groups = groupBySet(rows);
    expect(groups.map((g) => g.setCode)).toEqual(['BLB', 'PEOE', 'KHM', 'MSH', 'M3C', 'SOS', 'PLST']);
    expect(groups.find((g) => g.setCode === 'MSH')?.rows).toHaveLength(3);
  });

  it('keeps every row exactly once', () => {
    const total = groupBySet(rows).reduce((n, g) => n + g.rows.length, 0);
    expect(total).toBe(rows.length);
  });
});

describe('chunk', () => {
  it('splits into chunks of at most the given size', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    expect(chunk(items, 100).map((c) => c.length)).toEqual([100, 100, 50]);
  });

  it('returns an empty list for empty input', () => {
    expect(chunk([], 100)).toEqual([]);
  });

  it('rejects invalid sizes', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});

describe('summarize', () => {
  it('counts rows, cards, sets, finishes and languages', () => {
    expect(summarize(rows)).toEqual({
      rows: 11,
      cards: 16,
      sets: 7,
      byFinish: { normal: 13, foil: 3 },
      byLanguage: { de: 11, en: 5 },
    });
  });
});
