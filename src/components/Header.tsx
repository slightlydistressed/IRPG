import React, { useRef, useCallback, useState } from 'react';
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
  MoreVertical,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { useBackupHandlers } from '@/hooks/useBackupHandlers';
import { validatePdfFile } from '@/utils/pdfUtils';

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
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const { handleExportBackup, handleImportBackupFile, importError } = useBackupHandlers();

  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), []);
  useOutsideClick(moreMenuRef, moreMenuOpen, closeMoreMenu, moreMenuBtnRef);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validatePdfFile(file)) {
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
          className="btn-icon hidden sm:inline-flex"
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
            className={`btn-icon hidden sm:inline-flex ${isBookmarked(currentPage) ? 'text-yellow-300' : ''}`}
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
            className="btn-icon hidden sm:inline-flex"
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
            className="btn-icon hidden sm:inline-flex"
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

        {/* ⋮ overflow menu – mobile only */}
        <div className="relative sm:hidden" ref={moreMenuRef}>
          <button
            ref={moreMenuBtnRef}
            className="btn-icon"
            onClick={() => setMoreMenuOpen((v) => !v)}
            aria-label="More actions"
            aria-expanded={moreMenuOpen}
            aria-haspopup="menu"
          >
            <MoreVertical size={20} />
          </button>
          {moreMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-lg z-50 py-1 overflow-hidden"
            >
              {pdfName && numPages > 0 && (
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                  onClick={() => {
                    handleBookmarkCurrent();
                    setMoreMenuOpen(false);
                  }}
                >
                  <BookmarkCheck
                    size={16}
                    className={isBookmarked(currentPage) ? 'text-yellow-400' : ''}
                  />
                  {isBookmarked(currentPage) ? 'Remove bookmark' : 'Bookmark page'}
                </button>
              )}
              {pdfName && (
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                  onClick={() => {
                    handleExportBackup();
                    setMoreMenuOpen(false);
                  }}
                >
                  <Download size={16} />
                  Export backup
                </button>
              )}
              {pdfName && (
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                  onClick={() => {
                    backupInputRef.current?.click();
                    setMoreMenuOpen(false);
                  }}
                >
                  <FolderOpen size={16} />
                  Import backup
                </button>
              )}
            </div>
          )}
        </div>

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
