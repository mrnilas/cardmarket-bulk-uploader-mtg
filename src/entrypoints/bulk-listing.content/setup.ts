/**
 * Panel sections for everything before listing: CSV import, run settings and
 * the expansion table status.
 */
import { parseManaBoxCsv } from '../../lib/csv/manabox';
import { summarize } from '../../lib/grouping';
import { requestExpansionRefresh } from '../../lib/messages';
import type { Language, ParseIssue, Rarity } from '../../lib/model';
import {
  currentImport,
  expansionTableInfo,
  loadSettings,
  progress,
  saveSettings,
  type Settings,
  type StoredImport,
} from '../../lib/store';
import { formatNumber, h } from '../../lib/ui/dom';

const MAX_ISSUES_SHOWN = 50;
const PRICE_FIELDS = ['common', 'uncommon', 'rare', 'mythic'] as const;

export interface SetupState {
  /** Issues of the last import in this tab (not stored). */
  issues: ParseIssue[];
  importError?: string;
  /** `undefined` = open while nothing is imported or no language is chosen. */
  setupOpen?: boolean;
  expansionUpdating: boolean;
  expansionError?: string;
}

type Render = () => Promise<void>;

/** Import and settings; `locked` while a filled form is waiting for submission. */
export function setupSection(
  state: SetupState,
  render: Render,
  data: StoredImport | null,
  settings: Settings,
  listed: readonly number[],
  locked: boolean,
): Node {
  const summary = data ? summarize(data.rows) : null;
  const open = state.setupOpen ?? (!data || !settings.language);

  const fileInput = h('input', {
    type: 'file',
    accept: '.csv,text/csv',
    disabled: locked,
    onchange: async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) await importFile(file, state, render);
    },
  });

  return h(
    'details',
    {
      class: 'setup',
      open,
      ontoggle: (event: Event) => {
        state.setupOpen = (event.currentTarget as HTMLDetailsElement).open;
      },
    },
    h(
      'summary',
      {},
      data && summary ? `${data.fileName} · ${formatNumber(summary.cards)} cards` : 'Import ManaBox CSV',
    ),
    locked ? h('p', { class: 'muted' }, 'Reload the page to change the import or settings.') : null,
    h('label', { class: 'field' }, h('span', {}, data ? 'Replace CSV' : 'ManaBox CSV export'), fileInput),
    state.importError ? h('p', { class: 'error' }, state.importError) : null,
    issuesNode(state.issues),
    data && summary
      ? h(
          'p',
          { class: 'muted' },
          `${formatNumber(summary.rows)} rows · ${formatNumber(summary.cards)} cards · ${formatNumber(summary.sets)} sets`,
          h('br'),
          formatCounts(summary.byFinish),
          h('br'),
          `Imported ${new Date(data.importedAt).toLocaleString()}`,
        )
      : null,
    data && summary ? languageField(summary.byLanguage, settings, locked, render) : null,
    data ? progressLine(data, settings, listed) : null,
    pricesNode(settings, locked, render),
    data
      ? h(
          'div',
          { class: 'actions' },
          h(
            'button',
            {
              disabled: locked,
              onclick: async () => {
                if (!confirm('Forget which cards were marked as listed?')) return;
                await progress.setValue({ listed: [] });
                await render();
              },
            },
            'Reset progress',
          ),
          h(
            'button',
            {
              disabled: locked,
              onclick: async () => {
                if (!confirm('Remove the imported CSV?')) return;
                state.issues = [];
                state.importError = undefined;
                await currentImport.setValue(null);
                await progress.setValue({ listed: [] });
                await render();
              },
            },
            'Clear import',
          ),
        )
      : null,
  );
}

async function importFile(file: File, state: SetupState, render: Render): Promise<void> {
  const { rows, issues } = parseManaBoxCsv(await file.text());
  state.issues = issues;
  if (rows.length === 0) {
    state.importError = `${file.name}: no valid rows found.`;
    return render();
  }
  state.importError = undefined;

  await currentImport.setValue({ fileName: file.name, importedAt: new Date().toISOString(), rows });
  await progress.setValue({ listed: [] });

  // One language per run: preselect it if the file only has one.
  const languages = [...new Set(rows.map((r) => r.language))];
  const { language } = await loadSettings();
  await saveSettings({
    language: languages.length === 1 ? languages[0]! : language && languages.includes(language) ? language : null,
  });
  await render();
}

function issuesNode(issues: readonly ParseIssue[]): Node | null {
  if (issues.length === 0) return null;
  const errors = issues.filter((i) => i.severity === 'error').length;
  return h(
    'details',
    {},
    h('summary', { class: errors ? 'error' : 'warn' }, `${errors} error(s), ${issues.length - errors} warning(s)`),
    h(
      'ul',
      {},
      ...issues
        .slice(0, MAX_ISSUES_SHOWN)
        .map((issue) => h('li', { class: issue.severity === 'error' ? 'error' : 'warn' }, `Line ${issue.line}: ${issue.message}`)),
      issues.length > MAX_ISSUES_SHOWN ? h('li', {}, `… and ${issues.length - MAX_ISSUES_SHOWN} more`) : null,
    ),
  );
}

function languageField(
  byLanguage: Partial<Record<Language, number>>,
  settings: Settings,
  locked: boolean,
  render: Render,
): Node {
  const select = h(
    'select',
    {
      disabled: locked,
      onchange: async (event: Event) => {
        const value = (event.target as HTMLSelectElement).value;
        await saveSettings({ language: (value || null) as Language | null });
        await render();
      },
    },
    h('option', { value: '' }, '– choose –'),
    ...Object.entries(byLanguage).map(([lang, cards]) =>
      h('option', { value: lang }, `${lang.toUpperCase()} (${formatNumber(cards ?? 0)} cards)`),
    ),
  );
  select.value = settings.language ?? '';
  return h('label', { class: 'field' }, h('span', {}, 'Language to list (one per run)'), select);
}

function progressLine(data: StoredImport, settings: Settings, listed: readonly number[]): Node {
  if (!settings.language) return h('p', { class: 'warn' }, 'Choose a language – each language is listed in its own run.');
  const rows = data.rows.filter((r) => r.language === settings.language);
  const done = new Set(listed);
  const total = rows.reduce((n, r) => n + r.quantity, 0);
  const listedCards = rows.filter((r) => done.has(r.sourceLine)).reduce((n, r) => n + r.quantity, 0);
  return h('p', { class: 'muted' }, `Listed ${formatNumber(listedCards)} of ${formatNumber(total)} cards.`);
}

function pricesNode(settings: Settings, locked: boolean, render: Render): Node {
  return h(
    'fieldset',
    { class: 'prices' },
    h('legend', {}, 'Minimum price (€) – trend price, but never below'),
    ...PRICE_FIELDS.map((rarity) =>
      h(
        'label',
        {},
        rarity[0]!.toUpperCase() + rarity.slice(1),
        h('input', {
          type: 'number',
          min: 0.02,
          step: 0.01,
          value: settings.priceRules.minPrice[rarity].toFixed(2),
          disabled: locked,
          onchange: async (event: Event) => {
            const value = Number((event.target as HTMLInputElement).value);
            if (!Number.isFinite(value) || value < 0.02) return render();
            const { priceRules } = await loadSettings();
            const minPrice: Record<Rarity, number> = { ...priceRules.minPrice, [rarity]: value };
            // Special/bonus cards follow the rare minimum.
            if (rarity === 'rare') Object.assign(minPrice, { special: value, bonus: value });
            await saveSettings({ priceRules: { minPrice } });
          },
        }),
      ),
    ),
  );
}

/** Expansion table status with a manual update button. */
export async function expansionFooter(state: SetupState, render: Render): Promise<Node> {
  const info = await expansionTableInfo();
  const date = info.updatedAt ? new Date(info.updatedAt).toLocaleDateString() : null;
  let text: string;
  if (state.expansionUpdating) text = 'Updating expansions…';
  else if (info.sets === 0) text = 'No expansion table yet – cards cannot be matched.';
  else if (info.source === 'mtgjson') text = `Expansions: ${formatNumber(info.sets)} sets, updated ${date}`;
  else text = `Expansions: ${formatNumber(info.sets)} sets (bundled${date ? `, ${date}` : ''})`;
  if (state.expansionError) text += ` – update failed: ${state.expansionError}`;

  return h(
    'footer',
    {},
    h('span', { class: state.expansionError || info.sets === 0 ? 'warn' : 'muted' }, text),
    h(
      'button',
      { class: 'small', disabled: state.expansionUpdating, onclick: () => void updateExpansions(state, render, true) },
      'Update',
    ),
  );
}

/** Asks the background to download the table if missing or stale (or `force`). */
export async function updateExpansions(state: SetupState, render: Render, force: boolean): Promise<void> {
  state.expansionUpdating = force;
  state.expansionError = undefined;
  if (force) await render();
  const result = await requestExpansionRefresh(force);
  state.expansionUpdating = false;
  if (!result.ok) state.expansionError = result.error;
  if (force || !result.ok) await render();
}

function formatCounts(counts: Record<string, number | undefined>): string {
  return Object.entries(counts)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .map(([key, value]) => `${key}: ${formatNumber(value ?? 0)}`)
    .join(' · ');
}
