import { parseManaBoxCsv } from '../../lib/csv/manabox';
import { summarize } from '../../lib/grouping';
import { currentImport, type StoredImport } from '../../lib/import-store';
import type { ParseIssue } from '../../lib/model';

const MAX_ISSUES_SHOWN = 50;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fileInput = $<HTMLInputElement>('file');
const status = $('status');
const summarySection = $('summary');
const issuesBox = $<HTMLDetailsElement>('issues');
const clearButton = $<HTMLButtonElement>('clear');

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const { rows, issues } = parseManaBoxCsv(await file.text());
  renderIssues(issues);

  if (rows.length === 0) {
    status.textContent = `${file.name}: no valid rows found.`;
    status.className = 'error';
    summarySection.hidden = true;
    return;
  }

  const stored: StoredImport = { fileName: file.name, importedAt: new Date().toISOString(), rows };
  await currentImport.setValue(stored);
  renderImport(stored);
});

clearButton.addEventListener('click', async () => {
  await currentImport.setValue(null);
  fileInput.value = '';
  renderImport(null);
  renderIssues([]);
});

function renderImport(data: StoredImport | null): void {
  clearButton.hidden = !data;
  summarySection.hidden = !data;
  if (!data) {
    status.textContent = 'No file imported yet.';
    status.className = 'muted';
    return;
  }

  const s = summarize(data.rows);
  status.textContent = `${data.fileName} – imported ${new Date(data.importedAt).toLocaleString()}`;
  status.className = 'ok';
  $('s-rows').textContent = String(s.rows);
  $('s-cards').textContent = String(s.cards);
  $('s-sets').textContent = String(s.sets);
  $('s-finish').textContent = formatCounts(s.byFinish);
  $('s-lang').textContent = formatCounts(s.byLanguage);
}

function renderIssues(issues: ParseIssue[]): void {
  const list = $('issues-list');
  list.replaceChildren();
  issuesBox.hidden = issues.length === 0;
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
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

void currentImport.getValue().then(renderImport);
