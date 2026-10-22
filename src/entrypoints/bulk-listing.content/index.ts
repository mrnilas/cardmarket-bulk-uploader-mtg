import { defineContentScript } from 'wxt/utils/define-content-script';
import { BULK_LISTING_MATCHES } from '../../lib/cardmarket/bulk-listing';
import { mountPanel } from './panel';

export default defineContentScript({
  matches: BULK_LISTING_MATCHES,
  runAt: 'document_idle',
  main(ctx) {
    const unmount = mountPanel();
    ctx.onInvalidated(unmount);
  },
});
