import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  buildDocBackup,
  downloadDocBackup,
  parseDocBackup,
  readFileAsText,
} from '../utils/backupUtils';

/**
 * Shared hook for backup export and import, used by both Header (mobile) and
 * IconRail (desktop).  Returns handlers and the current import error message.
 */
export function useBackupHandlers() {
  const {
    documentId,
    pdfName,
    highlights,
    bookmarks,
    formValues,
    currentPage,
    scale,
    restoreDocumentData,
  } = useApp();

  const [importError, setImportError] = useState<string | null>(null);

  const handleExportBackup = useCallback(() => {
    if (!pdfName) return;
    const backup = buildDocBackup(
      documentId,
      pdfName,
      highlights,
      bookmarks,
      formValues,
      currentPage,
      scale,
    );
    downloadDocBackup(backup);
  }, [documentId, pdfName, highlights, bookmarks, formValues, currentPage, scale]);

  const handleImportBackupFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setImportError(null);
      let text: string;
      try {
        text = await readFileAsText(file);
      } catch {
        setImportError('Could not read the backup file.');
        setTimeout(() => setImportError(null), 5000);
        return;
      }

      const backup = parseDocBackup(text);
      if (!backup) {
        setImportError('The selected file is not a valid IRPG Reader backup.');
        setTimeout(() => setImportError(null), 5000);
        return;
      }

      if (backup.docId !== documentId) {
        const proceed = window.confirm(
          `This backup is for "${backup.pdfName}" (not the currently open document).\n\n` +
            `Importing it will replace the current document's highlights, bookmarks, and form data with data from that backup.\n\n` +
            `Continue anyway?`,
        );
        if (!proceed) return;
      } else {
        const proceed = window.confirm(
          `Restore backup from ${new Date(backup.exportedAt).toLocaleString()}?\n\n` +
            `This will replace your current highlights, bookmarks, and form data for this document.`,
        );
        if (!proceed) return;
      }

      restoreDocumentData({
        highlights: backup.highlights,
        bookmarks: backup.bookmarks,
        formValues: backup.formValues,
        currentPage: backup.currentPage,
        scale: backup.scale,
      });
    },
    [documentId, restoreDocumentData],
  );

  return { handleExportBackup, handleImportBackupFile, importError, setImportError };
}
