import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { BULK_LISTING_MATCHES } from '../lib/cardmarket/bulk-listing';
import { bulkListingUrl, CARDMARKET_LOCALES } from '../lib/expansions';
import { isBackgroundMessage, type BackgroundMessage, type BackgroundResult } from '../lib/messages';
import {
  currentImport,
  loadExpansionIndex,
  loadSetCardIds,
  loadSettings,
  pendingCards,
  pendingExpansions,
  progress,
  refreshExpansionTable,
} from '../lib/store';

export default defineBackground(() => {
  const refresh = () =>
    refreshExpansionTable().catch((error: unknown) => console.warn('Expansion table update failed:', error));
  browser.runtime.onInstalled.addListener(() => void refresh());
  browser.runtime.onStartup.addListener(() => void refresh());

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isBackgroundMessage(message)) return;
    handle(message).then(sendResponse, (error: Error) =>
      sendResponse({ ok: false, error: error.message } satisfies BackgroundResult),
    );
    return true; // response is sent asynchronously
  });

  // MV3 has `action`, Firefox MV2 `browserAction`.
  (browser.action ?? browser.browserAction).onClicked.addListener(() => void openListing());
});

async function handle(message: BackgroundMessage): Promise<BackgroundResult> {
  switch (message.type) {
    case 'refresh-expansions':
      return { ok: true, updated: await refreshExpansionTable({ force: message.force }) };
    case 'load-set-cards':
      return { ok: true, cards: await loadSetCardIds(message.setCode) };
  }
}

/** Focuses an open listing tab, or opens the first expansion with pending cards. */
async function openListing(): Promise<void> {
  const [tab] = await browser.tabs.query({ url: BULK_LISTING_MATCHES });
  if (tab?.id !== undefined) {
    await browser.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
    return;
  }

  const data = await currentImport.getValue();
  const { language } = await loadSettings();
  const { listed } = await progress.getValue();
  const pending = pendingCards(data?.rows ?? [], language, listed);
  const first = pendingExpansions(pending, await loadExpansionIndex()).expansions[0];

  const uiLocale = browser.i18n.getUILanguage().slice(0, 2);
  const locale = (CARDMARKET_LOCALES as readonly string[]).includes(uiLocale) ? uiLocale : 'en';
  await browser.tabs.create({
    url: first
      ? bulkListingUrl(locale, first.idExpansion)
      : `https://www.cardmarket.com/${locale}/Magic/Stock/ListingMethods/BulkListing`,
  });
}
