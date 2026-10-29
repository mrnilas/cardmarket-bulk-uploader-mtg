import type { CardRow } from '../src/lib/model';

let line = 2;

/** Builds a valid CardRow; override what the test cares about. */
export function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    name: 'Test Card',
    setCode: 'TST',
    setName: 'Test Set',
    collectorNumber: '1',
    finish: 'normal',
    rarity: 'common',
    quantity: 1,
    condition: 'NM',
    language: 'de',
    misprint: false,
    altered: false,
    signed: false,
    sourceLine: line++,
    ...overrides,
  };
}
