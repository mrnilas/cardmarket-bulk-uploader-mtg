import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseManaBoxCsv } from '../src/lib/csv/manabox';

const sample = readFileSync(new URL('./fixtures/manabox-sample.csv', import.meta.url), 'utf8');

const HEADER =
  'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added';

const line = (overrides: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    Name: 'Test Card',
    'Set code': 'tst',
    'Set name': 'Test Set',
    'Collector number': '1',
    Foil: 'normal',
    Rarity: 'common',
    Quantity: '1',
    'ManaBox ID': '1',
    'Scryfall ID': '00000000-0000-0000-0000-000000000000',
    'Purchase price': '0.10',
    Misprint: 'false',
    Altered: 'false',
    Signed: 'false',
    Condition: 'near_mint',
    Language: 'en',
    Proxy: 'false',
    'Purchase price currency': 'EUR',
    Added: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  return HEADER.split(',')
    .map((col) => base[col] ?? '')
    .join(',');
};

describe('parseManaBoxCsv', () => {
  it('parses the sample export without issues', () => {
    const { rows, issues } = parseManaBoxCsv(sample);
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(11);
  });

  it('maps fields into the CardRow model', () => {
    const { rows } = parseManaBoxCsv(sample);
    expect(rows[0]).toEqual({
      name: 'Dig Site Inventory',
      setCode: 'SOS',
      setName: 'Secrets of Strixhaven',
      collectorNumber: '10',
      finish: 'normal',
      rarity: 'common',
      quantity: 4,
      condition: 'NM',
      language: 'de',
      misprint: false,
      altered: false,
      signed: false,
      scryfallId: 'e52464ee-df8b-41ec-af93-4b0eb004383e',
      purchasePrice: 0.1,
      purchaseCurrency: 'EUR',
      sourceLine: 2,
    });
  });

  it('handles quoted names with commas and non-numeric collector numbers', () => {
    const { rows } = parseManaBoxCsv(sample);
    expect(rows.map((r) => r.name)).toContain('Vega, the Watcher');
    expect(rows.map((r) => r.collectorNumber)).toEqual(expect.arrayContaining(['228s', 'C13-243']));
  });

  it('accepts a UTF-8 BOM and CRLF line endings', () => {
    const text = '\uFEFF' + [HEADER, line()].join('\r\n') + '\r\n';
    const { rows, issues } = parseManaBoxCsv(text);
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.setCode).toBe('TST');
  });

  it('rejects files that are not ManaBox exports', () => {
    const { rows, issues } = parseManaBoxCsv('Card,Count\nForest,4\n');
    expect(rows).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', line: 1 });
    expect(issues[0]?.message).toContain('Set code');
  });

  it('maps all ManaBox conditions to Cardmarket grades', () => {
    const conditions = ['mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor'];
    const text = [HEADER, ...conditions.map((Condition) => line({ Condition }))].join('\n');
    expect(parseManaBoxCsv(text).rows.map((r) => r.condition)).toEqual([
      'MT',
      'NM',
      'EX',
      'GD',
      'LP',
      'PL',
      'PO',
    ]);
  });

  it('reports invalid rows with line and field, and keeps the valid ones', () => {
    const text = [
      HEADER,
      line({ Name: 'Good' }),
      line({ Quantity: '0' }),
      line({ Condition: 'damaged' }),
      line({ Language: 'xx' }),
      line({ Foil: 'shiny' }),
    ].join('\n');
    const { rows, issues } = parseManaBoxCsv(text);
    expect(rows.map((r) => r.name)).toEqual(['Good']);
    expect(issues.map((i) => [i.line, i.field, i.severity])).toEqual([
      [3, 'Quantity', 'error'],
      [4, 'Condition', 'error'],
      [5, 'Language', 'error'],
      [6, 'Foil', 'error'],
    ]);
  });

  it('skips proxies with a warning', () => {
    const { rows, issues } = parseManaBoxCsv([HEADER, line({ Proxy: 'true' })].join('\n'));
    expect(rows).toEqual([]);
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', field: 'Proxy', line: 2 })]);
  });

  it('keeps the row but drops an invalid purchase price', () => {
    const { rows, issues } = parseManaBoxCsv([HEADER, line({ 'Purchase price': 'abc' })].join('\n'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.purchasePrice).toBeUndefined();
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', field: 'Purchase price' })]);
  });
});
