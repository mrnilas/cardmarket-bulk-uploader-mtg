/**
 * Messages between the content script and the background script. MTGJSON is
 * fetched in the background, where Cardmarket's page CSP does not apply.
 */
import { browser } from 'wxt/browser';
import type { LowestPrices } from './cardmarket/price-guide';

export type BackgroundMessage =
  | { type: 'refresh-expansions'; force: boolean }
  /** Download the card ids (collector number → `idProduct`) of one set. */
  | { type: 'load-set-cards'; setCode: string }
  /** Lowest offers (non-foil, foil) of these products from Cardmarket's price guide. */
  | { type: 'get-prices'; productIds: number[] };

export interface BackgroundResult {
  ok: boolean;
  /** refresh-expansions: true if a new table was downloaded. */
  updated?: boolean;
  /** load-set-cards: number of cards with a Cardmarket id. */
  cards?: number;
  /** get-prices: lowest offers of the requested products that have any. */
  prices?: Record<string, LowestPrices>;
  /** get-prices: creation date of the price guide. */
  priceDate?: string;
  error?: string;
}

const TYPES: ReadonlySet<string> = new Set<BackgroundMessage['type']>([
  'refresh-expansions',
  'load-set-cards',
  'get-prices',
]);

export function isBackgroundMessage(message: unknown): message is BackgroundMessage {
  return TYPES.has((message as { type?: string } | null)?.type ?? '');
}

export async function sendToBackground(message: BackgroundMessage): Promise<BackgroundResult> {
  try {
    return ((await browser.runtime.sendMessage(message)) as BackgroundResult | undefined) ?? {
      ok: false,
      error: 'No response from the extension',
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export const requestExpansionRefresh = (force: boolean) => sendToBackground({ type: 'refresh-expansions', force });
export const requestSetCards = (setCode: string) => sendToBackground({ type: 'load-set-cards', setCode });
export const requestPrices = (productIds: number[]) => sendToBackground({ type: 'get-prices', productIds });
