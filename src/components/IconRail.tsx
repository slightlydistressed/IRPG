import React, { useRef, useState, useCallback } from 'react';
import {
  Columns2,
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
import { useBackupHandlers } from '../hooks/useBackupHandlers';
import { validatePdfFile } from '../utils/pdfUtils';
import type { SidebarTab } from '../types';
import { DESKTOP_MIN_WIDTH } from '../types';

const PANEL_TABS: { id: SidebarTab; label: string; Icon: React.ElementType }[] = [
  { id: 'view',       label: 'View / Layout', Icon: Columns2      },
  { id: 'toc',        label: 'Contents',      Icon: List          },
  { id: 'highlights', label: 'Highlights',    Icon: Highlighter   },
  { id: 'forms',      label: 'Forms',         Icon: ClipboardList },
  { id: 'bookmarks',  label: 'Bookmarks',     Icon: Bookmark      },
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
    highlights,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const { handleExportBackup, handleImportBackupFile, importError } = useBackupHandlers();

  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), []);
  useOutsideClick(moreMenuRef, moreMenuOpen, closeMoreMenu, moreMenuBtnRef);

  const handlePanelToggle = (tab: SidebarTab) => {
    if (window.innerWidth >= DESKTOP_MIN_WIDTH) {
      // Desktop: sidebar is always open — just switch the active tab.
      setSidebarTab(tab);
      setSidebarOpen(true);
    } else {
      // Mobile: toggle the drawer open/closed.
      if (sidebarOpen && sidebarTab === tab) {
        setSidebarOpen(false);
      } else {
        setSidebarTab(tab);
        setSidebarOpen(true);
      }
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
    if (file && validatePdfFile(file)) {
      setPdfFile(file);
      openReader();
    }
    e.target.value = '';
  };

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
