import { browser } from 'wxt/browser';
import { parseManaBoxCsv } from '../../lib/csv/manabox';
import { bulkListingUrl, CARDMARKET_LOCALES, expansionIndex } from '../../lib/expansions';
import { summarize } from '../../lib/grouping';
import type { Language, ParseIssue, Rarity } from '../../lib/model';
import { fetchCardmarketIds } from '../../lib/scryfall';
import {
  currentImport,
  loadSettings,
  pendingCards,
  pendingExpansions,
  progress,
  saveSettings,
  type StoredImport,
} from '../../lib/store';
import { formatNumber } from '../../lib/ui/dom';

const MAX_ISSUES_SHOWN = 50;
const PRICE_FIELDS = ['common', 'uncommon', 'rare', 'mythic'] as const;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fileInput = $<HTMLInputElement>('file');
const status = $('status');
const importSection = $('import');
const languageSelect = $<HTMLSelectElement>('language');
const resolveButton = $<HTMLButtonElement>('resolve');
const resolveStatus = $('resolve-status');

let resolving = false;

// ---------------------------------------------------------------- import

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const { rows, issues } = parseManaBoxCsv(await file.text());
  renderIssues(issues);

  if (rows.length === 0) {
    status.textContent = `${file.name}: no valid rows found.`;
    status.className = 'error';
    return;
  }

  const stored: StoredImport = { fileName: file.name, importedAt: new Date().toISOString(), rows };
  await currentImport.setValue(stored);
  await progress.setValue({ listed: [] });

  // One language per run: preselect it if the file only has one.
  const languages = [...new Set(rows.map((r) => r.language))];
  const { language } = await loadSettings();
  await saveSettings({
    language: languages.length === 1 ? languages[0]! : language && languages.includes(language) ? language : null,
  });

  await render();
  void resolveIds();
});

$('clear').addEventListener('click', async () => {
  await currentImport.setValue(null);
  await progress.setValue({ listed: [] });
  fileInput.value = '';
  renderIssues([]);
  await render();
});

$('reset-progress').addEventListener('click', async () => {
  if (!confirm('Forget which cards were marked as listed?')) return;
  await progress.setValue({ listed: [] });
  await render();
});

// ---------------------------------------------------------------- settings

languageSelect.addEventListener('change', async () => {
  await saveSettings({ language: (languageSelect.value || null) as Language | null });
  await render();
});

for (const rarity of PRICE_FIELDS) {
  $<HTMLInputElement>(`min-${rarity}`).addEventListener('change', async (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 0.02) return render();
    const { priceRules } = await loadSettings();
    const minPrice: Record<Rarity, number> = { ...priceRules.minPrice, [rarity]: value };
    // Special/bonus cards follow the rare minimum.
    if (rarity === 'rare') Object.assign(minPrice, { special: value, bonus: value });
    await saveSettings({ priceRules: { minPrice } });
  });
}

// ---------------------------------------------------------------- Scryfall

resolveButton.addEventListener('click', () => void resolveIds());

async function resolveIds(): Promise<void> {
  const data = await currentImport.getValue();
  if (!data || resolving) return;
  const ids = data.rows.filter((r) => r.cardmarketId === undefined).map((r) => r.scryfallId);
  if (ids.length === 0) return;

  resolving = true;
  await render();
  try {
    await fetchCardmarketIds(ids, {
      onBatch: async (resolved, done, total) => {
        const current = await currentImport.getValue();
        if (!current || current.importedAt !== data.importedAt) throw new Error('Import changed');
        current.rows = current.rows.map((row) =>
          resolved.has(row.scryfallId) ? { ...row, cardmarketId: resolved.get(row.scryfallId) } : row,
        );
        await currentImport.setValue(current);
        resolveStatus.textContent = `Matching with Scryfall… ${done} / ${total}`;
      },
    });
  } catch (error) {
    resolveStatus.textContent = `Scryfall: ${(error as Error).message}. Try again later.`;
    resolveStatus.className = 'error';
    resolving = false;
    return;
  }
  resolving = false;
  await render();
}

// ---------------------------------------------------------------- open Cardmarket

$('open').addEventListener('click', async () => {
  const data = await currentImport.getValue();
  const { language } = await loadSettings();
  const { listed } = await progress.getValue();
  const first = pendingExpansions(pendingCards(data?.rows ?? [], language, listed)).expansions[0];
  const uiLocale = navigator.language.slice(0, 2);
  const locale = (CARDMARKET_LOCALES as readonly string[]).includes(uiLocale) ? uiLocale : 'en';
  const url = first
    ? bulkListingUrl(locale, first.idExpansion)
    : `https://www.cardmarket.com/${locale}/Magic/Stock/ListingMethods/BulkListing`;
  await browser.tabs.create({ url });
  window.close();
});

// ---------------------------------------------------------------- render

async function render(): Promise<void> {
  const data = await currentImport.getValue();
  importSection.hidden = !data;
  if (!data) {
    status.textContent = 'No file imported yet.';
    status.className = 'muted';
    return;
  }

  const settings = await loadSettings();
  const { listed } = await progress.getValue();
  const s = summarize(data.rows);

  status.textContent = `${data.fileName} – imported ${new Date(data.importedAt).toLocaleString()}`;
  status.className = 'ok';
  $('s-rows').textContent = formatNumber(s.rows);
  $('s-cards').textContent = formatNumber(s.cards);
  $('s-sets').textContent = formatNumber(s.sets);
  $('s-finish').textContent = formatCounts(s.byFinish);
  $('s-lang').textContent = formatCounts(s.byLanguage);

  // Scryfall
  const unresolved = data.rows.filter((r) => r.cardmarketId === undefined).length;
  const missing = data.rows.filter((r) => r.cardmarketId === null).length;
  if (!resolving) {
    resolveStatus.className = unresolved ? 'warning' : 'ok';
    resolveStatus.textContent = unresolved
      ? `${formatNumber(unresolved)} of ${formatNumber(s.rows)} rows not matched yet.`
      : `All rows matched${missing ? ` – ${formatNumber(missing)} without Cardmarket id (name fallback)` : ''}.`;
  }
  resolveButton.hidden = unresolved === 0;
  resolveButton.disabled = resolving;

  // Language
  languageSelect.replaceChildren(
    new Option('– choose –', ''),
    ...Object.entries(s.byLanguage).map(
      ([lang, cards]) => new Option(`${lang.toUpperCase()} (${formatNumber(cards ?? 0)} cards)`, lang),
    ),
  );
  languageSelect.value = settings.language ?? '';

  const pending = pendingCards(data.rows, settings.language, listed);
  const total = data.rows.filter((r) => r.language === settings.language).reduce((n, r) => n + r.quantity, 0);
  const open = pending.reduce((n, r) => n + r.quantity, 0);
  $('run-progress').textContent = settings.language
    ? `Listed ${formatNumber(total - open)} of ${formatNumber(total)} cards.`
    : 'Choose a language – each language is listed in its own run.';

  for (const rarity of PRICE_FIELDS) {
    $<HTMLInputElement>(`min-${rarity}`).value = settings.priceRules.minPrice[rarity].toFixed(2);
  }

  $('table-warning').hidden = expansionIndex.size > 0;
  $<HTMLButtonElement>('open').disabled = !settings.language;
}

function renderIssues(issues: ParseIssue[]): void {
  const box = $<HTMLDetailsElement>('issues');
  const list = $('issues-list');
  list.replaceChildren();
  box.hidden = issues.length === 0;
  if (issues.length === 0) return;

  const errors = issues.filter((i) => i.severity === 'error').length;
  $('issues-title').textContent = `${errors} error(s), ${issues.length - errors} warning(s)`;
  for (const issue of issues.slice(0, MAX_ISSUES_SHOWN)) {
    const li = document.createElement('li');
    li.className = issue.severity;
    li.textContent = `Line ${issue.line}: ${issue.message}`;
    list.append(li);
  }
  if (issues.length > MAX_ISSUES_SHOWN) {
    const li = document.createElement('li');
    li.textContent = `… and ${issues.length - MAX_ISSUES_SHOWN} more`;
    list.append(li);
  }
}

function formatCounts(counts: Record<string, number | undefined>): string {
  return Object.entries(counts)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .map(([key, value]) => `${key}: ${formatNumber(value ?? 0)}`)
    .join(' · ');
}

void render().then(() => resolveIds());
