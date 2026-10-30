/**
 * Cardmarket's public price guide for Magic, a daily JSON download (no API):
 * one entry per `idProduct` with low/trend/average prices, separately for foil.
 * We only keep the lowest offer per foiling (`low`, `low-foil`).
 */

export const PRICE_GUIDE_URL = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json';

/** Lowest offer in EUR: [non-foil, foil]; `null` = no offer. */
export type LowestPrices = [number | null, number | null];

export interface PriceGuide {
  /** When Cardmarket created the file (it is published once a day). */
  createdAt: string;
  /** When we downloaded it. */
  fetchedAt: string;
  /** `idProduct` → lowest prices. */
  prices: Record<string, LowestPrices>;
}

interface PriceGuideEntry {
  idProduct: number;
  low?: number | null;
  'low-foil'?: number | null;
}

const positive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

export function buildPriceGuide(
  body: { createdAt?: string; priceGuides?: PriceGuideEntry[] },
  fetchedAt = new Date().toISOString(),
): PriceGuide {
  const prices: Record<string, LowestPrices> = {};
  for (const entry of body.priceGuides ?? []) {
    const low = positive(entry.low);
    const lowFoil = positive(entry['low-foil']);
    if (Number.isInteger(entry.idProduct) && (low !== null || lowFoil !== null)) {
      prices[entry.idProduct] = [low, lowFoil];
    }
  }
  return { createdAt: toIsoDate(body.createdAt) ?? fetchedAt, fetchedAt, prices };
}

/** Cardmarket writes offsets as `+0100`, which not every browser parses. */
function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Downloads the price guide (~26 MB). Throws on HTTP errors or an empty file. */
export async function fetchPriceGuide(doFetch: typeof fetch = fetch.bind(globalThis)): Promise<PriceGuide> {
  const response = await doFetch(PRICE_GUIDE_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Price guide request failed: HTTP ${response.status}`);
  const guide = buildPriceGuide(await response.json());
  if (Object.keys(guide.prices).length === 0) throw new Error('Price guide contains no prices');
  return guide;
}

/** Lowest offer of a product in the given foiling, if Cardmarket knows one. */
export function lowestPrice(
  prices: Readonly<Record<string, LowestPrices>>,
  productId: number,
  foil: boolean,
): number | undefined {
  return prices[productId]?.[foil ? 1 : 0] ?? undefined;
}
