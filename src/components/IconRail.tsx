import React, { useRef, useState, useCallback } from 'react';
import {
  LayoutGrid,
  List,
  Highlighter,
  ClipboardList,
  Bookmark,
  BookmarkCheck,
  Sun,
  Moon,
  MoreVertical,
  Upload,
  Download,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOutsideClick } from '../hooks/useOutsideClick';
import {
  buildDocBackup,
  downloadDocBackup,
  parseDocBackup,
  readFileAsText,
} from '../utils/backupUtils';
import type { SidebarTab } from '../types';

const PANEL_TABS: { id: SidebarTab; label: string; Icon: React.ElementType }[] = [
  { id: 'toc',        label: 'Contents',   Icon: List         },
  { id: 'highlights', label: 'Highlights', Icon: Highlighter  },
  { id: 'forms',      label: 'Forms',      Icon: ClipboardList },
  { id: 'bookmarks',  label: 'Bookmarks',  Icon: Bookmark     },
];

export default function IconRail() {
  const {
    theme,
    toggleTheme,
    goHome,
    setPdfFile,
    openReader,
    pdfName,
    currentPage,
    numPages,
    sidebarTab,
    setSidebarTab,
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
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), []);
  useOutsideClick(moreMenuRef, moreMenuOpen, closeMoreMenu, moreMenuBtnRef);

  const handlePanelToggle = (tab: SidebarTab) => {
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarTab(tab);
      setSidebarOpen(true);
    }
  };

  const handleBookmarkCurrent = () => {
    if (!pdfName || !numPages) return;
    if (isBookmarked(currentPage)) {
      const bm = bookmarks.find((b) => b.page === currentPage);
      if (bm) removeBookmark(bm.id);
    } else {
      addBookmark(`Page ${currentPage}`, currentPage);
    }
  };

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
      openReader();
    }
    e.target.value = '';
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

  const bookmarkedNow = isBookmarked(currentPage);

  return (
    <nav className="icon-rail" aria-label="Primary navigation">
      {/* Home */}
      <button
        className="rail-btn"
        onClick={goHome}
        title="Back to library"
        aria-label="Back to library"
      >
        <LayoutGrid size={20} />
      </button>

      <div className="rail-divider" aria-hidden="true" />

      {/* Panel toggle buttons */}
      {PANEL_TABS.map(({ id, label, Icon }) => {
        const isActive = sidebarOpen && sidebarTab === id;
        return (
          <button
            key={id}
            className={`rail-btn${isActive ? ' rail-btn-active' : ''}`}
            onClick={() => handlePanelToggle(id)}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
          >
            <div className="relative">
              <Icon size={20} />
              {id === 'highlights' && highlights.length > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold leading-none"
                  aria-hidden="true"
                >
                  {highlights.length > 99 ? '99+' : highlights.length}
                </span>
              )}
            </div>
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" aria-hidden="true" />

      {/* Bookmark current page */}
      {numPages > 0 && (
        <button
          className={`rail-btn${bookmarkedNow ? ' rail-btn-bookmarked' : ''}`}
          onClick={handleBookmarkCurrent}
          title={bookmarkedNow ? 'Remove bookmark from this page' : 'Bookmark this page'}
          aria-label={
            bookmarkedNow
              ? `Remove bookmark from page ${currentPage}`
              : `Bookmark page ${currentPage}`
          }
          aria-pressed={bookmarkedNow}
        >
          <BookmarkCheck size={20} />
        </button>
      )}

      {/* Theme toggle */}
      <button
        className="rail-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle dark/light mode"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* More menu */}
      <div className="relative" ref={moreMenuRef}>
        <button
          ref={moreMenuBtnRef}
          className="rail-btn"
          onClick={() => setMoreMenuOpen((v) => !v)}
          aria-label="More actions"
          aria-expanded={moreMenuOpen}
          aria-haspopup="menu"
          title="More actions"
        >
          <MoreVertical size={20} />
        </button>

        {moreMenuOpen && (
          <div
            role="menu"
            className="absolute left-full bottom-0 ml-2 w-52 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-lg z-50 py-1 overflow-hidden"
          >
            <button
              role="menuitem"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
              onClick={() => {
                fileInputRef.current?.click();
                setMoreMenuOpen(false);
              }}
            >
              <Upload size={15} />
              Open PDF
            </button>

            {pdfName && (
              <button
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                onClick={() => {
                  handleExportBackup();
                  setMoreMenuOpen(false);
                }}
              >
                <Download size={15} />
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
                <FolderOpen size={15} />
                Import backup
              </button>
            )}
          </div>
        )}
      </div>

      {importError && (
        <div
          role="alert"
          className="absolute left-full bottom-16 ml-2 w-56 text-xs text-red-300 bg-red-900/80 px-3 py-2 rounded-lg shadow-lg z-50"
        >
          {importError}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload PDF"
      />
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportBackupFile}
        aria-label="Import backup file"
      />
    </nav>
  );
}
