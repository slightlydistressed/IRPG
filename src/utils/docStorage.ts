/**
 * Document-scoped localStorage utilities.
 *
 * Every PDF the user opens gets a stable "document ID" so that highlights,
 * bookmarks, Q&A, page position, and zoom are stored separately per document
 * instead of in one global bucket.
 */

/** Stable ID used for the bundled irpg.pdf that is auto-loaded on startup. */
export const BUILTIN_DOC_ID = 'irpg-builtin';

/**
 * Derive a stable document ID from an uploaded File.
 *
 * Uses name + size + lastModified as a practical fingerprint – no content
 * hash needed for typical usage, and it survives page reloads for the same
 * local file without any async work.
 */
export function getDocumentId(file: File): string {
  const slug = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
  return `pdf-${slug}-${file.size}-${file.lastModified}`;
}

/** Build a namespaced localStorage key for a given document and data type. */
export function docKey(docId: string, suffix: string): string {
  return `irpg-doc-${docId}-${suffix}`;
}

const MIGRATION_FLAG = 'irpg-migrated-v1';

/**
 * One-time migration: copy the old single-bucket localStorage keys into the
 * per-document keys for the bundled IRPG PDF so users don't lose their data
 * after upgrading.  Safe to call on every module load – a flag prevents it
 * from running more than once.
 */
export function migrateGlobalData(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    const pairs: [string, string][] = [
      ['irpg-highlights', docKey(BUILTIN_DOC_ID, 'highlights')],
      ['irpg-bookmarks', docKey(BUILTIN_DOC_ID, 'bookmarks')],
      ['irpg-qa', docKey(BUILTIN_DOC_ID, 'qa')],
    ];

    for (const [oldKey, newKey] of pairs) {
      const existing = localStorage.getItem(oldKey);
      if (existing && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, existing);
      }
    }

    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // localStorage may be unavailable (SSR, private mode quota exceeded, etc.)
  }
}
