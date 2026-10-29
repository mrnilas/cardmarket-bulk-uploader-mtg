/**
 * Messages between the content script and the background script. MTGJSON is
 * fetched in the background, where Cardmarket's page CSP does not apply.
 */
import { browser } from 'wxt/browser';

export interface RefreshExpansionsMessage {
  type: 'refresh-expansions';
  force: boolean;
}

export interface RefreshExpansionsResult {
  ok: boolean;
  /** True if a new table was downloaded. */
  updated?: boolean;
  error?: string;
}

export function isRefreshExpansionsMessage(message: unknown): message is RefreshExpansionsMessage {
  return (message as RefreshExpansionsMessage | null)?.type === 'refresh-expansions';
}

export async function requestExpansionRefresh(force: boolean): Promise<RefreshExpansionsResult> {
  const message: RefreshExpansionsMessage = { type: 'refresh-expansions', force };
  try {
    return ((await browser.runtime.sendMessage(message)) as RefreshExpansionsResult | undefined) ?? {
      ok: false,
      error: 'No response from the extension',
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
