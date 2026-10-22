import { describe, expect, it, vi } from 'vitest';
import { fetchCardmarketIds, SCRYFALL_BATCH_SIZE, SCRYFALL_COLLECTION_URL } from '../src/lib/scryfall';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fake Scryfall: every id "card-N" has cardmarket_id N, ids starting with "x" are unknown. */
function fakeScryfall() {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: { id: string }[] };
    const data = identifiers
      .filter(({ id }) => !id.startsWith('x'))
      .map(({ id }) => (id === 'card-0' ? { id } : { id, cardmarket_id: Number(id.split('-')[1]) }));
    const not_found = identifiers.filter(({ id }) => id.startsWith('x'));
    return json({ object: 'list', data, not_found });
  });
}

describe('fetchCardmarketIds', () => {
  it('posts the ids to the collection endpoint', async () => {
    const fetch = fakeScryfall();
    const result = await fetchCardmarketIds(['card-1', 'card-2'], { fetch, delayMs: 0 });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(SCRYFALL_COLLECTION_URL);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ identifiers: [{ id: 'card-1' }, { id: 'card-2' }] });
    expect([...result]).toEqual([
      ['card-1', 1],
      ['card-2', 2],
    ]);
  });

  it('maps unknown cards and cards without cardmarket_id to null', async () => {
    const result = await fetchCardmarketIds(['x-1', 'card-0'], { fetch: fakeScryfall(), delayMs: 0 });
    expect(result.get('x-1')).toBeNull();
    expect(result.get('card-0')).toBeNull();
  });

  it('batches by 75 and requests duplicates once', async () => {
    const fetch = fakeScryfall();
    const ids = Array.from({ length: 160 }, (_, i) => `card-${i + 1}`);
    const onBatch = vi.fn();
    const result = await fetchCardmarketIds([...ids, 'card-1'], { fetch, delayMs: 0, onBatch });
    expect(fetch).toHaveBeenCalledTimes(Math.ceil(160 / SCRYFALL_BATCH_SIZE));
    expect(result.size).toBe(160);
    expect(onBatch.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      [75, 160],
      [150, 160],
      [160, 160],
    ]);
  });

  it('retries on HTTP 429 and fails on other errors', async () => {
    const ok = fakeScryfall();
    const flaky = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      flaky.mock.calls.length === 1 ? json({}, 429) : ok(url, init),
    );
    expect((await fetchCardmarketIds(['card-5'], { fetch: flaky, delayMs: 0 })).get('card-5')).toBe(5);

    const broken = vi.fn(async () => json({}, 400));
    await expect(fetchCardmarketIds(['card-5'], { fetch: broken, delayMs: 0 })).rejects.toThrow('HTTP 400');
  });
});
