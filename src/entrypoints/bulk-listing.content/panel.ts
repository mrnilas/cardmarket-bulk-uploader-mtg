import {
  applyPlan,
  readAmount,
  readPage,
  SUBMIT_BUTTON_SELECTOR,
  type FillReport,
} from '../../lib/cardmarket/bulk-listing';
import { bulkListingUrl, type ExpansionIndex } from '../../lib/expansions';
import { lowestPrice, type LowestPrices } from '../../lib/cardmarket/price-guide';
import { requestPrices, requestSetCards } from '../../lib/messages';
import type { CardRow } from '../../lib/model';
import { planPage, type PagePlan } from '../../lib/planning';
import {
  cardIdCache,
  currentImport,
  loadExpansionIndex,
  loadSettings,
  markListed,
  pendingCards,
  pendingExpansions,
  productIdLookup,
  progress,
  setsNeedingCardIds,
  watchStorage,
} from '../../lib/store';
import { formatNumber, h } from '../../lib/ui/dom';
import { PANEL_CSS } from './panel-css';
import { expansionFooter, setupSection, updateExpansions, type SetupState } from './setup';

/** How long to wait for Cardmarket's "recently listed" area after submitting. */
const CONFIRM_TIMEOUT_MS = 20_000;

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'waiting'; sourceLines: number[] }
  | { kind: 'confirmed'; cards: number }
  | { kind: 'unconfirmed'; sourceLines: number[] };

interface CardIdState {
  /** Progress while card ids are downloaded from MTGJSON. */
  loading?: { done: number; total: number };
  /** Set codes whose download failed in this tab (retried via the button). */
  failed: Set<string>;
}

/** Lowest offers of the products on this page, from Cardmarket's price guide. */
type PriceState =
  | { status: 'loading' }
  | { status: 'ready'; prices: Record<string, LowestPrices>; priceDate: string }
  | { status: 'failed'; error: string };

interface State extends SetupState {
  plan?: PagePlan;
  report?: FillReport;
  submit: SubmitState;
  collapsed: boolean;
  cardIds: CardIdState;
  prices?: PriceState;
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

  const state: State = {
    submit: { kind: 'idle' },
    collapsed: false,
    issues: [],
    expansionUpdating: false,
    cardIds: { failed: new Set() },
  };

  const render = async () => {
    root.replaceChildren(...(await buildContent(state, render)));
  };

  const onClick = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(SUBMIT_BUTTON_SELECTOR)) onSubmit(state, render);
  };
  document.addEventListener('click', onClick, true);

  // Re-plan when import, settings or the expansion table change (also from other tabs), but never under a filled form.
  const unwatch = watchStorage(() => {
    if (!state.report) void render();
  });

  void render();
  void updateExpansions(state, render, false);

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
  const expansions = await loadExpansionIndex();

  const nodes: Node[] = [header, setupSection(state, render, data, settings, listed, Boolean(state.report))];
  const footer = await expansionFooter(state, render);
  if (!data || !settings.language) return [...nodes, footer];

  const url = new URL(location.href);
  const page = readPage(document, url);
  const pending = pendingCards(data.rows, settings.language, listed);
  const cache = await cardIdCache.getValue();
  const productIdFor = productIdLookup(cache);
  const missingSets = setsNeedingCardIds(pending, cache).filter((code) => !state.cardIds.failed.has(code));
  if (missingSets.length && !state.cardIds.loading && !state.report) void loadCardIds(state, render, missingSets);
  if (!state.prices && page.rows.length) void loadPrices(state, render, page.rows.map((r) => r.productId));
  const prices = state.prices?.status === 'ready' ? state.prices.prices : {};

  if (!state.report) {
    state.plan = planPage({
      pageRows: page.rows,
      cards: pending,
      expansionId: page.expansionId,
      expansions,
      productIdFor,
      lowestPrice: (productId, foil) => lowestPrice(prices, productId, foil),
      priceRules: settings.priceRules,
    });
  }
  const plan = state.plan!;
  const pendingCount = pending.reduce((n, c) => n + c.quantity, 0);
  const planCards = plan.rows.flatMap((r) => r.placements).reduce((n, p) => n + p.amount, 0);

  nodes.push(
    h(
      'p',
      {},
      `Language ${settings.language.toUpperCase()} · ${formatNumber(pendingCount)} cards pending`,
      h('br'),
      page.expansionId
        ? `${page.expansionName ?? `Expansion ${page.expansionId}`} · page ${page.site}`
        : 'Select an expansion and click "Filter".',
    ),
  );

  nodes.push(
    h(
      'p',
      { class: plan.rows.length ? 'ok' : 'muted' },
      plan.rows.length
        ? `This page: ${formatNumber(planCards)} cards in ${plan.rows.length} products`
        : 'No pending cards on this page.',
    ),
  );

  nodes.push(...cardIdNodes(state, render, pending, productIdFor), ...priceNodes(state, render));

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
  nodes.push(navigation(pending, expansions, page.expansionId, page.nextPageUrl, url), footer);
  return nodes;
}

/** Downloads card ids set by set (via the background); the storage watch re-plans. */
async function loadCardIds(state: State, render: () => Promise<void>, setCodes: readonly string[]): Promise<void> {
  state.cardIds.loading = { done: 0, total: setCodes.length };
  await render();
  for (const code of setCodes) {
    const result = await requestSetCards(code);
    if (!result.ok) state.cardIds.failed.add(code);
    state.cardIds.loading = { done: state.cardIds.loading.done + 1, total: setCodes.length };
    if (!result.ok && !state.report) await render();
  }
  state.cardIds.loading = undefined;
  if (!state.report) await render();
}

async function loadPrices(state: State, render: () => Promise<void>, productIds: number[]): Promise<void> {
  state.prices = { status: 'loading' };
  await render();
  const result = await requestPrices(productIds);
  state.prices =
    result.ok && result.prices && result.priceDate
      ? { status: 'ready', prices: result.prices, priceDate: result.priceDate }
      : { status: 'failed', error: result.error ?? 'unknown error' };
  if (!state.report) await render();
}

function priceNodes(state: State, render: () => Promise<void>): Node[] {
  const prices = state.prices;
  if (!prices) return [];
  if (prices.status === 'loading') {
    return [h('p', { class: 'muted' }, 'Loading Cardmarket price guide… (first time ~26 MB)')];
  }
  if (prices.status === 'ready') {
    return [h('p', { class: 'muted' }, `Prices: Cardmarket price guide of ${new Date(prices.priceDate).toLocaleDateString()}`)];
  }
  return [
    h(
      'p',
      { class: 'warn' },
      `Price guide unavailable (${prices.error}) – non-foils use the lowest price shown here, foils go to review.`,
    ),
    h(
      'button',
      {
        disabled: Boolean(state.report),
        onclick: () => {
          state.prices = undefined;
          void render();
        },
      },
      'Retry',
    ),
  ];
}

function cardIdNodes(
  state: State,
  render: () => Promise<void>,
  pending: readonly CardRow[],
  productIdFor: (card: CardRow) => number | undefined,
): Node[] {
  const { loading, failed } = state.cardIds;
  if (loading) {
    return [
      h('p', { class: 'muted' }, `Loading card numbers from MTGJSON… ${loading.done} / ${loading.total} sets`),
    ];
  }
  const nodes: Node[] = [];
  const byName = pending.filter((card) => productIdFor(card) === undefined).reduce((n, c) => n + c.quantity, 0);
  if (byName) {
    nodes.push(
      h(
        'p',
        { class: 'muted' },
        `${formatNumber(byName)} cards without Cardmarket id in MTGJSON – matched by English name.`,
      ),
    );
  }
  if (failed.size) {
    nodes.push(
      h('p', { class: 'warn' }, `Card numbers could not be loaded for ${[...failed].join(', ')}.`),
      h(
        'button',
        {
          disabled: Boolean(state.report),
          onclick: () => {
            failed.clear();
            void render();
          },
        },
        'Retry',
      ),
    );
  }
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
          // Wait for the card ids – otherwise variants would be matched by name.
          disabled: !plan?.rows.length || Boolean(state.cardIds.loading) || state.prices?.status === 'loading',
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
  index: ExpansionIndex,
  currentExpansion: number | null,
  nextPageUrl: string | null,
  url: URL,
): Node {
  const locale = url.pathname.split('/')[1] || 'en';
  const names = expansionNames();
  const { expansions, unmapped } = pendingExpansions(pending, index);
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
