import Papa from 'papaparse';
import {
  FINISHES,
  LANGUAGES,
  RARITIES,
  type CardRow,
  type Condition,
  type ParseIssue,
  type ParseResult,
} from '../model';

/** Columns we need from a ManaBox export. Extra columns are ignored. */
export const MANABOX_REQUIRED_COLUMNS = [
  'Name',
  'Set code',
  'Set name',
  'Collector number',
  'Foil',
  'Rarity',
  'Quantity',
  'Scryfall ID',
  'Condition',
  'Language',
] as const;

const CONDITION_MAP: Record<string, Condition> = {
  mint: 'MT',
  near_mint: 'NM',
  excellent: 'EX',
  good: 'GD',
  light_played: 'LP',
  played: 'PL',
  poor: 'PO',
};

type RawRow = Record<string, string | undefined>;

/** Parses the text of a ManaBox CSV export into `CardRow`s plus issues. */
export function parseManaBoxCsv(text: string): ParseResult {
  const parsed = Papa.parse<RawRow>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const issues: ParseIssue[] = [];
  const header = parsed.meta.fields ?? [];
  const missing = MANABOX_REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    issues.push({
      severity: 'error',
      line: 1,
      message: `Not a ManaBox export – missing column(s): ${missing.join(', ')}`,
    });
    return { rows: [], issues };
  }

  for (const err of parsed.errors) {
    issues.push({
      severity: 'error',
      line: (err.row ?? 0) + 2,
      message: `CSV syntax: ${err.message}`,
    });
  }

  const rows: CardRow[] = [];
  parsed.data.forEach((raw, index) => {
    const line = index + 2; // +1 for header, +1 for 1-based
    const row = toCardRow(raw, line, issues);
    if (row) rows.push(row);
  });

  return { rows, issues };
}

function toCardRow(raw: RawRow, line: number, issues: ParseIssue[]): CardRow | null {
  const errorsBefore = issues.length;
  const err = (field: string, message: string) =>
    issues.push({ severity: 'error', line, field, message });

  const get = (col: string) => (raw[col] ?? '').trim();

  if (bool(get('Proxy'))) {
    issues.push({ severity: 'warning', line, field: 'Proxy', message: 'Proxy skipped – proxies must not be sold' });
    return null;
  }

  const name = get('Name');
  if (!name) err('Name', 'Name is empty');

  const setCode = get('Set code').toUpperCase();
  if (!setCode) err('Set code', 'Set code is empty');

  const quantity = Number(get('Quantity'));
  if (!Number.isInteger(quantity) || quantity < 1) {
    err('Quantity', `Invalid quantity "${get('Quantity')}"`);
  }

  const finish = get('Foil').toLowerCase();
  if (!isOneOf(FINISHES, finish)) err('Foil', `Unknown finish "${get('Foil')}"`);

  const rarity = get('Rarity').toLowerCase();
  if (!isOneOf(RARITIES, rarity)) err('Rarity', `Unknown rarity "${get('Rarity')}"`);

  const condition = CONDITION_MAP[get('Condition').toLowerCase()];
  if (!condition) err('Condition', `Unknown condition "${get('Condition')}"`);

  const language = get('Language').toLowerCase();
  if (!isOneOf(LANGUAGES, language)) err('Language', `Unknown language "${get('Language')}"`);

  const priceText = get('Purchase price');
  const purchasePrice = priceText === '' ? undefined : Number(priceText);
  if (purchasePrice !== undefined && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
    issues.push({ severity: 'warning', line, field: 'Purchase price', message: `Invalid price "${priceText}" ignored` });
  }

  if (issues.slice(errorsBefore).some((i) => i.severity === 'error')) {
    return null;
  }

  return {
    name,
    setCode,
    setName: get('Set name'),
    collectorNumber: get('Collector number'),
    finish: finish as CardRow['finish'],
    rarity: rarity as CardRow['rarity'],
    quantity,
    condition: condition as Condition,
    language: language as CardRow['language'],
    misprint: bool(get('Misprint')),
    altered: bool(get('Altered')),
    signed: bool(get('Signed')),
    scryfallId: get('Scryfall ID'),
    purchasePrice:
      purchasePrice !== undefined && Number.isFinite(purchasePrice) && purchasePrice >= 0
        ? purchasePrice
        : undefined,
    purchaseCurrency: get('Purchase price currency') || undefined,
    sourceLine: line,
  };
}

function bool(value: string): boolean {
  return value.toLowerCase() === 'true';
}

function isOneOf<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}
