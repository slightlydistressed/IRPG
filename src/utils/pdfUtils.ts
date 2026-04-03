/**
 * pdfUtils.ts
 *
 * Shared helpers for PDF file handling.
 */

/**
 * Returns true if the file appears to be a PDF (by MIME type or extension).
 * Dispatches an `irpg-app-warning` event and returns false if the file is not
 * a PDF.
 */
export function validatePdfFile(file: File): boolean {
  const isPdfMime = file.type === 'application/pdf';
  const isUnknownType = !file.type;
  const hasPdfExtension = /\.pdf$/i.test(file.name);

  if (!isPdfMime && !isUnknownType && !hasPdfExtension) {
    window.dispatchEvent(
      new CustomEvent('irpg-app-warning', {
        detail: `"${file.name}" is not a PDF file. Please select a valid PDF.`,
      }),
    );
    return false;
  }
  return true;
}
