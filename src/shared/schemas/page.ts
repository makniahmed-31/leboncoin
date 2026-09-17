/**
 * Re-exported rather than redefined.
 *
 * The page envelope is part of the contract between the two applications, so it lives in the
 * shared package and this file exists only so the import paths inside the web app stay stable.
 * Restating the shape here would be a second definition of one contract, and the second one is
 * the one that goes out of date.
 */
export {
  DEFAULT_MESSAGE_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  emptyPage,
  pageSchema,
  type Page,
} from '@/lib/contracts'
