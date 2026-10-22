import type { CardRow } from '../model';

/**
 * Adapter for one Cardmarket listing page (e.g. "List bulk items" or
 * "List Mixed Products"). Implementations run inside a content script.
 */

export interface ListingItem {
  card: CardRow;
  /** Selling price in EUR. */
  price: number;
  comment?: string;
}

export interface ListingBatch {
  /** Set code, or undefined when the target accepts mixed sets. */
  setCode?: string;
  items: ListingItem[];
}

export interface SkippedItem {
  item: ListingItem;
  reason: string;
}

export interface ListingResult {
  /** Items written into the form (dry run) or actually listed. */
  filled: ListingItem[];
  skipped: SkippedItem[];
}

export interface ListingOptions {
  /** Fill the form but do not submit it. */
  dryRun: boolean;
  signal?: AbortSignal;
}

export interface ListingTarget {
  /** Stable id, e.g. "bulk-listing". */
  readonly id: string;
  /** Max. items one form submission accepts. */
  readonly maxItemsPerBatch: number;
  /** Whether batches must contain a single set. */
  readonly singleSetPerBatch: boolean;
  /** True if this adapter handles the given page. */
  matches(url: URL): boolean;
  fill(batch: ListingBatch, options: ListingOptions): Promise<ListingResult>;
}
