/**
 * Resolves Cardmarket product ids (`idProduct`) for Scryfall card ids via
 * Scryfall's public API: https://scryfall.com/docs/api/cards/collection
 */

export const SCRYFALL_COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
/** Scryfall accepts at most 75 identifiers per collection request. */
export const SCRYFALL_BATCH_SIZE = 75;
/** Scryfall asks clients to wait 50–100 ms between requests. */
const DEFAULT_DELAY_MS = 120;
const MAX_RETRIES = 3;

interface CollectionResponse {
  data?: { id: string; cardmarket_id?: number }[];
  not_found?: { id?: string }[];
}

export interface ResolveOptions {
  fetch?: typeof fetch;
  delayMs?: number;
  signal?: AbortSignal;
  /** Called after each batch with the ids resolved in it. */
  onBatch?: (resolved: Map<string, number | null>, done: number, total: number) => void | Promise<void>;
}

/**
 * Returns a map Scryfall id → Cardmarket id (`null` if Scryfall has none or
 * does not know the card). Duplicate input ids are requested once.
 */
export async function fetchCardmarketIds(
  scryfallIds: readonly string[],
  options: ResolveOptions = {},
): Promise<Map<string, number | null>> {
  const doFetch = options.fetch ?? fetch.bind(globalThis);
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const unique = [...new Set(scryfallIds.filter(Boolean))];
  const result = new Map<string, number | null>();

  for (let start = 0; start < unique.length; start += SCRYFALL_BATCH_SIZE) {
    if (start > 0) await sleep(delayMs, options.signal);
    const batch = unique.slice(start, start + SCRYFALL_BATCH_SIZE);
    const body = await postWithRetry(doFetch, batch, delayMs, options.signal);

    const resolved = new Map<string, number | null>(batch.map((id) => [id, null]));
    for (const card of body.data ?? []) {
      if (resolved.has(card.id)) {
        resolved.set(card.id, typeof card.cardmarket_id === 'number' ? card.cardmarket_id : null);
      }
    }
    for (const [id, value] of resolved) result.set(id, value);
    await options.onBatch?.(resolved, Math.min(start + batch.length, unique.length), unique.length);
  }

  return result;
}

async function postWithRetry(
  doFetch: typeof fetch,
  ids: string[],
  delayMs: number,
  signal: AbortSignal | undefined,
): Promise<CollectionResponse> {
  for (let attempt = 0; ; attempt++) {
    const response = await doFetch(SCRYFALL_COLLECTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: ids.map((id) => ({ id })) }),
      signal,
    });
    if (response.ok) return (await response.json()) as CollectionResponse;
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(delayMs * 10 * (attempt + 1), signal);
      continue;
    }
    throw new Error(`Scryfall request failed: HTTP ${response.status}`);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
