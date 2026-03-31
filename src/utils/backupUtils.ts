/**
 * backupUtils.ts
 *
 * Local backup (export/import) helpers for per-document reader data.
 *
 * The exported file is a portable JSON document (`.irpg-backup.json`) that
 * holds all lightweight reader state for a single document:
 * highlights, bookmarks, form/checklist values, current page, and zoom.
 *
 * No server or cloud dependency — everything is local.
 */

import type { Highlight, Bookmark, FormValues } from '../types';

// ── Schema ─────────────────────────────────────────────────────────────────

export interface DocBackup {
  /** Schema version — increment when shape changes incompatibly. */
  version: 1;
  /** Stable document identifier (matches the docKey prefix in localStorage). */
  docId: string;
  /** Human-readable document name at time of export. */
  pdfName: string;
  /** ISO 8601 timestamp. */
  exportedAt: string;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  formValues: FormValues;
  currentPage: number;
  scale: number;
}

// ── Build ──────────────────────────────────────────────────────────────────

export function buildDocBackup(
  docId: string,
  pdfName: string,
  highlights: Highlight[],
  bookmarks: Bookmark[],
  formValues: FormValues,
  currentPage: number,
  scale: number,
): DocBackup {
  return {
    version: 1,
    docId,
    pdfName,
    exportedAt: new Date().toISOString(),
    highlights,
    bookmarks,
    formValues,
    currentPage,
    scale,
  };
}

// ── Download ───────────────────────────────────────────────────────────────

/**
 * Serialises the backup and triggers a browser file download.
 * File name is derived from the document name.
 */
export function downloadDocBackup(backup: DocBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const baseName = backup.pdfName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  anchor.href = url;
  anchor.download = `${baseName}-backup.json`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ── Validate & parse ───────────────────────────────────────────────────────

/**
 * Parses and validates a JSON string as a `DocBackup`.
 * Returns the backup object on success, or `null` if the data is invalid.
 */
export function parseDocBackup(json: string): DocBackup | null {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;

    if (
      data.version !== 1 ||
      typeof data.docId !== 'string' ||
      typeof data.pdfName !== 'string' ||
      typeof data.exportedAt !== 'string' ||
      !Array.isArray(data.highlights) ||
      !Array.isArray(data.bookmarks) ||
      typeof data.formValues !== 'object' ||
      data.formValues === null ||
      typeof data.currentPage !== 'number' ||
      typeof data.scale !== 'number'
    ) {
      return null;
    }

    // Shallow-validate highlight shape
    for (const h of data.highlights as unknown[]) {
      if (
        typeof h !== 'object' ||
        h === null ||
        typeof (h as Record<string, unknown>).id !== 'string' ||
        typeof (h as Record<string, unknown>).text !== 'string'
      ) {
        return null;
      }
    }

    // Shallow-validate bookmark shape
    for (const b of data.bookmarks as unknown[]) {
      if (
        typeof b !== 'object' ||
        b === null ||
        typeof (b as Record<string, unknown>).id !== 'string' ||
        typeof (b as Record<string, unknown>).page !== 'number'
      ) {
        return null;
      }
    }

    return data as unknown as DocBackup;
  } catch {
    return null;
  }
}

// ── Read file ──────────────────────────────────────────────────────────────

/** Reads a File object as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
