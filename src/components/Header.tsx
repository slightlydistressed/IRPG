import React, { useRef, useState, useCallback } from 'react';
import {
  BookOpen,
  Moon,
  Sun,
  Upload,
  PanelLeftOpen,
  PanelLeftClose,
  BookmarkCheck,
  LayoutGrid,
  Download,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  buildDocBackup,
  downloadDocBackup,
  parseDocBackup,
  readFileAsText,
} from '../utils/backupUtils';

export default function Header() {
  const {
    theme,
    toggleTheme,
    setPdfFile,
    openReader,
    goHome,
    pdfName,
    currentPage,
    numPages,
    sidebarOpen,
    setSidebarOpen,
    isBookmarked,
    addBookmark,
    removeBookmark,
    bookmarks,
    documentId,
    highlights,
    formValues,
    scale,
    restoreDocumentData,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdfMime = file.type === 'application/pdf';
      const isUnknownType = !file.type;
      const hasPdfExtension = /\.pdf$/i.test(file.name);

      if (!isPdfMime && !isUnknownType && !hasPdfExtension) {
        window.dispatchEvent(
          new CustomEvent('irpg-app-warning', {
            detail: `"${file.name}" is not a PDF file. Please select a valid PDF.`,
          }),
        );
        e.target.value = '';
        return;
      }

      setPdfFile(file);
      // Stay in reader when uploading from the reader header.
      openReader();
    }
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleBookmarkCurrent = () => {
    if (!pdfName || !numPages) return;
    const label = `Page ${currentPage}`;
    if (isBookmarked(currentPage)) {
      const bm = bookmarks.find((b) => b.page === currentPage);
      if (bm) removeBookmark(bm.id);
    } else {
      addBookmark(label, currentPage);
    }
  };

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

  return (
    <header className="header flex items-center justify-between px-4 py-2 shadow-md z-10 shrink-0">
      {/* Left: Home button + sidebar toggle + doc name */}
      <div className="flex items-center gap-1 min-w-0">
        <button
          onClick={goHome}
          className="btn-icon"
          title="Back to library"
          aria-label="Back to library"
        >
          <LayoutGrid size={20} />
        </button>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="btn-icon"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <PanelLeftClose size={20} />
          ) : (
            <PanelLeftOpen size={20} />
          )}
        </button>

        <div className="w-px h-5 bg-white/20 mx-2 shrink-0" />

        <div className="flex items-center gap-2 font-semibold text-sm text-white truncate min-w-0">
          <BookOpen size={18} className="shrink-0 opacity-80" />
          <span className="hidden sm:inline truncate opacity-90">
            {pdfName || 'IRPG PDF Reader'}
          </span>
        </div>
      </div>

      {/* Center: Page indicator pill */}
      {numPages > 0 && (
        <div className="text-white/75 text-xs font-mono hidden md:flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full shrink-0">
          <span>{currentPage}</span>
          <span className="opacity-50">/</span>
          <span>{numPages}</span>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {pdfName && numPages > 0 && (
          <button
            onClick={handleBookmarkCurrent}
            className={`btn-icon ${isBookmarked(currentPage) ? 'text-yellow-300' : ''}`}
            title={
              isBookmarked(currentPage)
                ? 'Remove bookmark from current page'
                : 'Bookmark current page'
            }
            aria-label={
              isBookmarked(currentPage)
                ? `Remove bookmark from page ${currentPage}`
                : `Bookmark page ${currentPage}`
            }
            aria-pressed={isBookmarked(currentPage)}
          >
            <BookmarkCheck size={20} />
          </button>
        )}

        {/* Backup: export */}
        {pdfName && (
          <button
            onClick={handleExportBackup}
            className="btn-icon"
            title="Export backup for this document"
            aria-label="Export backup for this document"
          >
            <Download size={19} />
          </button>
        )}

        {/* Backup: import */}
        {pdfName && (
          <button
            onClick={() => backupInputRef.current?.click()}
            className="btn-icon"
            title="Import backup for this document"
            aria-label="Import backup for this document"
          >
            <FolderOpen size={19} />
          </button>
        )}

        <input
          ref={backupInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportBackupFile}
          aria-label="Import backup file"
        />

        {/* Import error flash */}
        {importError && (
          <span
            role="alert"
            className="text-xs text-red-300 bg-red-900/40 px-2 py-1 rounded max-w-[160px] truncate"
            title={importError}
          >
            {importError}
          </span>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary flex items-center gap-1.5 text-sm"
          title="Upload a PDF file"
        >
          <Upload size={15} />
          <span className="hidden sm:inline">Open PDF</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Upload PDF"
        />

        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark/light mode"
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>
    </header>
  );
}
