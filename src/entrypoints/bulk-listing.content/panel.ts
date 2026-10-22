import {
  applyPlan,
  readAmount,
  readPage,
  SUBMIT_BUTTON_SELECTOR,
  type FillReport,
} from '../../lib/cardmarket/bulk-listing';
import { bulkListingUrl, expansionIndex } from '../../lib/expansions';
import { planPage, type PagePlan } from '../../lib/planning';
import {
  currentImport,
  loadSettings,
  markListed,
  pendingCards,
  pendingExpansions,
  progress,
  watchStorage,
} from '../../lib/store';
import { formatNumber, h } from '../../lib/ui/dom';
import { PANEL_CSS } from './panel-css';

/** How long to wait for Cardmarket's "recently listed" area after submitting. */
const CONFIRM_TIMEOUT_MS = 20_000;

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'waiting'; sourceLines: number[] }
  | { kind: 'confirmed'; cards: number }
  | { kind: 'unconfirmed'; sourceLines: number[] };

interface State {
  plan?: PagePlan;
  report?: FillReport;
  submit: SubmitState;
  collapsed: boolean;
}

/** Mounts the helper panel on the "List by expansion" page. Returns an unmount function. */
export function mountPanel(): () => void {
  const host = document.createElement('div');
  host.id = 'cbu-panel-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  const root = h('section', { class: 'panel' });
  shadow.append(style, root);
  document.body.append(host);

  const state: State = { submit: { kind: 'idle' }, collapsed: false };

  const render = async () => {
    root.replaceChildren(...(await buildContent(state, render)));
  };

  const onClick = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(SUBMIT_BUTTON_SELECTOR)) onSubmit(state, render);
  };
  document.addEventListener('click', onClick, true);

  // Re-plan when the popup changes import or settings, but never under a filled form.
  const unwatch = watchStorage(() => {
    if (!state.report) void render();
  });

  void render();

  return () => {
    unwatch();
    document.removeEventListener('click', onClick, true);
    host.remove();
  };
}

async function buildContent(state: State, render: () => Promise<void>): Promise<Node[]> {
  const header = h(
    'header',
    {},
    h('strong', {}, 'Bulk Uploader'),
    h(
      'button',
      {
        class: 'icon',
        title: state.collapsed ? 'Expand' : 'Collapse',
        onclick: () => {
          state.collapsed = !state.collapsed;
          void render();
        },
      },
      state.collapsed ? '▴' : '▾',
    ),
  );
  if (state.collapsed) return [header];

  const data = await currentImport.getValue();
  const settings = await loadSettings();
  const { listed } = await progress.getValue();

  if (!data) return [header, h('p', { class: 'muted' }, 'No CSV imported. Open the extension popup to import one.')];
  if (!settings.language) {
    return [header, h('p', { class: 'muted' }, 'Choose the language to list in the extension popup.')];
  }

  const url = new URL(location.href);
  const page = readPage(document, url);
  const pending = pendingCards(data.rows, settings.language, listed);
  if (!state.report) {
    state.plan = planPage({
      pageRows: page.rows,
      cards: pending,
      expansionId: page.expansionId,
      expansions: expansionIndex,
      priceRules: settings.priceRules,
    });
  }
  const plan = state.plan!;
  const pendingCount = pending.reduce((n, c) => n + c.quantity, 0);
  const unresolved = pending.filter((c) => c.cardmarketId === undefined).length;
  const planCards = plan.rows.flatMap((r) => r.placements).reduce((n, p) => n + p.amount, 0);

  const nodes: Node[] = [
    header,
    h(
      'p',
      {},
      `Language ${settings.language.toUpperCase()} · ${formatNumber(pendingCount)} cards pending`,
      h('br'),
      page.expansionId
        ? `${page.expansionName ?? `Expansion ${page.expansionId}`} · page ${page.site}`
        : 'Select an expansion and click "Filter".',
    ),
  ];

  if (unresolved > 0) {
    nodes.push(
      h('p', { class: 'warn' }, `${formatNumber(unresolved)} rows not matched with Scryfall yet – open the popup.`),
    );
  }

  nodes.push(
    h(
      'p',
      { class: plan.rows.length ? 'ok' : 'muted' },
      plan.rows.length
        ? `This page: ${formatNumber(planCards)} cards in ${plan.rows.length} products`
        : 'No pending cards on this page.',
    ),
  );

  if (plan.review.length) {
    nodes.push(
      h(
        'details',
        {},
        h('summary', { class: 'warn' }, `${plan.review.length} need manual review`),
        h('ul', {}, ...plan.review.map((r) => h('li', {}, `${r.card.name} (line ${r.card.sourceLine}): ${r.detail}`))),
      ),
    );
  }

  nodes.push(...actionNodes(state, render, planCards));
  nodes.push(navigation(pending, page.expansionId, page.nextPageUrl, url));
  return nodes;
}

function actionNodes(state: State, render: () => Promise<void>, planCards: number): Node[] {
  const { report, submit, plan } = state;

  if (!report) {
    return [
      h(
        'button',
        {
          class: 'primary',
          disabled: !plan?.rows.length,
          onclick: async () => {
            if (!state.plan) return;
            state.report = await applyPlan(document, state.plan.rows);
            highlight(state.report);
            void render();
          },
        },
        `Fill form (${formatNumber(planCards)} cards)`,
      ),
    ];
  }

  const filledCards = report.filled.reduce((n, f) => n + f.placement.amount, 0);
  const nodes: Node[] = [];

  if (submit.kind === 'confirmed') {
    nodes.push(h('p', { class: 'ok' }, `✓ ${formatNumber(submit.cards)} cards marked as listed.`));
    if (report.deferred.length) {
      nodes.push(h('p', {}, `${report.deferred.length} variant(s) still open – reload and fill again.`));
    }
    nodes.push(h('button', { class: 'primary', onclick: () => location.reload() }, 'Reload page'));
    return nodes;
  }

  nodes.push(
    h(
      'p',
      { class: 'ok' },
      `✓ Filled ${formatNumber(filledCards)} cards in ${report.filled.length} rows (highlighted). `,
      'Check them, then click Cardmarket’s list button below the table.',
    ),
  );
  if (report.deferred.length) {
    nodes.push(
      h(
        'p',
        { class: 'warn' },
        `${report.deferred.length} extra variant(s) (e.g. foil) could not be added as a copied row. `,
        'List this page first, then reload and fill again.',
      ),
    );
  }
  if (report.errors.length) {
    nodes.push(
      h(
        'details',
        {},
        h('summary', { class: 'error' }, `${report.errors.length} error(s)`),
        h('ul', {}, ...report.errors.map((e) => h('li', {}, e))),
      ),
    );
  }

  if (submit.kind === 'waiting') {
    nodes.push(h('p', { class: 'muted' }, 'Waiting for Cardmarket to confirm the listing…'));
  } else if (submit.kind === 'unconfirmed') {
    nodes.push(
      h('p', { class: 'warn' }, 'Could not detect a confirmation. Check “Recently listed” on Cardmarket.'),
      h(
        'button',
        {
          onclick: async () => {
            await markListed(submit.sourceLines);
            state.submit = { kind: 'confirmed', cards: countCards(state, submit.sourceLines) };
            void render();
          },
        },
        'Mark as listed anyway',
      ),
    );
  }
  nodes.push(h('button', { onclick: () => location.reload() }, 'Discard and reload'));
  return nodes;
}

function navigation(
  pending: ReturnType<typeof pendingCards>,
  currentExpansion: number | null,
  nextPageUrl: string | null,
  url: URL,
): Node {
  const locale = url.pathname.split('/')[1] || 'en';
  const names = expansionNames();
  const { expansions, unmapped } = pendingExpansions(pending);
  const position = expansions.findIndex((e) => e.idExpansion === currentExpansion);
  const nextExpansion = expansions[position + 1] ?? (position === -1 ? expansions[0] : undefined);
  const label = (id: number) => names.get(id) ?? `Expansion ${id}`;

  return h(
    'nav',
    {},
    nextPageUrl ? h('a', { href: nextPageUrl, class: 'button' }, 'Next page →') : null,
    nextExpansion
      ? h(
          'a',
          { href: bulkListingUrl(locale, nextExpansion.idExpansion), class: 'button' },
          `Next: ${label(nextExpansion.idExpansion)} (${nextExpansion.cards}) →`,
        )
      : null,
    expansions.length
      ? h(
          'details',
          {},
          h('summary', {}, `All expansions with pending cards (${expansions.length})`),
          h(
            'ul',
            {},
            ...expansions.map((e) =>
              h('li', {}, h('a', { href: bulkListingUrl(locale, e.idExpansion) }, `${label(e.idExpansion)} – ${e.cards}`)),
            ),
          ),
        )
      : null,
    unmapped ? h('p', { class: 'muted' }, `${formatNumber(unmapped)} cards from sets without expansion mapping.`) : null,
  );
}

/** Cardmarket's own expansion names (localised) from the filter select. */
function expansionNames(): Map<number, string> {
  const select = document.querySelector<HTMLSelectElement>('select[name="idExpansion"]');
  return new Map(
    [...(select?.options ?? [])]
      .filter((o) => Number(o.value) > 0)
      .map((o) => [Number(o.value), o.textContent?.trim() ?? o.value]),
  );
}

function onSubmit(state: State, render: () => Promise<void>): void {
  if (!state.report || state.submit.kind !== 'idle') return;
  // Read amounts now – Cardmarket may reset the form after submitting.
  const sourceLines = state.report.filled
    .filter(({ row }) => readAmount(row) > 0)
    .flatMap(({ placement }) => placement.sources.map((s) => s.sourceLine));
  if (!sourceLines.length) return;

  state.submit = { kind: 'waiting', sourceLines };
  void render();

  const wrapper = document.querySelector('#NewArticleTableWrapper');
  if (!wrapper) {
    state.submit = { kind: 'unconfirmed', sourceLines };
    void render();
    return;
  }
  const observer = new MutationObserver(async () => {
    observer.disconnect();
    clearTimeout(timer);
    await markListed(sourceLines);
    state.submit = { kind: 'confirmed', cards: countCards(state, sourceLines) };
    void render();
  });
  observer.observe(wrapper, { childList: true, subtree: true, attributes: true });
  const timer = setTimeout(() => {
    observer.disconnect();
    state.submit = { kind: 'unconfirmed', sourceLines };
    void render();
  }, CONFIRM_TIMEOUT_MS);
}

function countCards(state: State, sourceLines: number[]): number {
  const lines = new Set(sourceLines);
  const seen = new Set<number>();
  let total = 0;
  for (const { placement } of state.report?.filled ?? []) {
    for (const source of placement.sources) {
      if (lines.has(source.sourceLine) && !seen.has(source.sourceLine)) {
        seen.add(source.sourceLine);
        total += source.quantity;
      }
    }
  }
  return total;
}

function highlight(report: FillReport): void {
  for (const { row } of report.filled) {
    row.style.outline = '2px solid #1a7f37';
    row.style.outlineOffset = '-2px';
  }
  report.filled[0]?.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
