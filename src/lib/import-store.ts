import { storage } from 'wxt/utils/storage';
import type { CardRow } from './model';

export interface StoredImport {
  fileName: string;
  importedAt: string;
  rows: CardRow[];
}

/** The last imported card list, shared between popup and content scripts. */
export const currentImport = storage.defineItem<StoredImport | null>('local:currentImport', {
  fallback: null,
});
