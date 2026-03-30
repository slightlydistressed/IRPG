import React, { useRef } from 'react';
import {
  BookOpen,
  Moon,
  Sun,
  Upload,
  PanelLeftOpen,
  PanelLeftClose,
  BookmarkCheck,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Header() {
  const {
    theme,
    toggleTheme,
    setPdfFile,
    pdfName,
    currentPage,
    numPages,
    sidebarOpen,
    setSidebarOpen,
    isBookmarked,
    addBookmark,
    removeBookmark,
    bookmarks,
    isUploadedPdf,
    clearUploadedPdf,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type !== 'application/pdf') {
      window.dispatchEvent(
        new CustomEvent('irpg-app-warning', {
          detail: `"${file.name}" is not a PDF file. Please select a valid PDF.`,
        }),
      );
      e.target.value = '';
      return;
    }
    if (file) {
      setPdfFile(file);
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
      {/* Left: Logo + sidebar toggle */}
      <div className="flex items-center gap-3 min-w-0">
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

        <div className="flex items-center gap-2 font-bold text-lg text-white truncate">
          <BookOpen size={22} className="shrink-0" />
          <span className="hidden sm:inline truncate">
            {pdfName || 'IRPG PDF Reader'}
          </span>
        </div>
      </div>

      {/* Center: Page indicator */}
      {numPages > 0 && (
        <div className="text-white/80 text-sm font-mono hidden md:block">
          Page {currentPage} / {numPages}
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
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

        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary flex items-center gap-1.5 text-sm"
          title="Upload a PDF file"
        >
          <Upload size={16} />
          <span className="hidden sm:inline">Open PDF</span>
        </button>

        {isUploadedPdf && (
          <button
            onClick={clearUploadedPdf}
            className="btn-icon"
            title="Close uploaded PDF and revert to IRPG guide"
            aria-label="Close uploaded PDF"
          >
            <Trash2 size={20} />
          </button>
        )}

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
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}
