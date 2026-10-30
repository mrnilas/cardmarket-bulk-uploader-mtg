import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Explicit imports keep the code readable without knowing WXT's auto-import magic.
  imports: false,
  manifest: ({ browser }) => ({
    name: 'Cardmarket Bulk Uploader (MTG)',
    description:
      'Bulk-list Magic: The Gathering cards from a ManaBox CSV export in your Cardmarket store.',
    // unlimitedStorage: the reduced price guide alone takes ~3 MB.
    permissions: ['storage', 'unlimitedStorage'],
    // No popup: clicking the icon opens the listing page, where the panel does everything.
    action: { default_title: 'Open Cardmarket listing' },
    host_permissions: ['*://*.cardmarket.com/*', 'https://mtgjson.com/*', 'https://downloads.s3.cardmarket.com/*'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'cardmarket-bulk-uploader-mtg@mrnilas',
          strict_min_version: '128.0',
        },
      },
    }),
  }),
});
