import { Bookmark, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { DESKTOP_MIN_WIDTH } from '@/types';

export default function BookmarksPanel() {
  const {
    bookmarks,
    removeBookmark,
    scrollToPage,
    setSidebarOpen,
    currentPage,
    numPages,
    addBookmark,
    isBookmarked,
  } = useApp();

  const handleNavigate = (page: number) => {
    scrollToPage(page);
    // Close the panel on mobile after navigation
    if (window.innerWidth < DESKTOP_MIN_WIDTH) {
      setSidebarOpen(false);
    }
  };

  const handleToggleBookmark = () => {
    if (!numPages) return;
    if (isBookmarked(currentPage)) {
      const bm = bookmarks.find((b) => b.page === currentPage);
      if (bm) removeBookmark(bm.id);
    } else {
      addBookmark(`Page ${currentPage}`, currentPage);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add bookmark for current page */}
      {numPages > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-[var(--color-border)] shrink-0">
          <button
            onClick={handleToggleBookmark}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              isBookmarked(currentPage)
                ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-400/20'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            <Bookmark
              size={15}
              className={isBookmarked(currentPage) ? 'fill-current' : ''}
            />
            {isBookmarked(currentPage)
              ? `Remove bookmark (p. ${currentPage})`
              : `Bookmark page ${currentPage}`}
          </button>
        </div>
      )}

      {/* Bookmark list */}
      <div className="flex-1 overflow-y-auto">
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
            <Bookmark size={28} className="text-[var(--color-border-strong)]" />
            <p className="text-sm text-[var(--color-text-muted)]">No bookmarks yet</p>
            <p className="text-xs text-[var(--color-text-muted)] opacity-70">
              Bookmark pages to find them quickly
            </p>
          </div>
        ) : (
          <ul className="py-2">
            {bookmarks.map((bm) => (
              <li key={bm.id} className="group flex items-center gap-1 px-2">
                <button
                  onClick={() => handleNavigate(bm.page)}
                  className="flex-1 flex items-center gap-2.5 px-2 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[var(--color-bg-secondary)] min-w-0"
                >
                  <Bookmark
                    size={14}
                    className="shrink-0 text-yellow-500 fill-current"
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-[var(--color-text)]">
                    {bm.title}
                  </span>
                  <span className="shrink-0 text-xs font-mono text-[var(--color-text-muted)]">
                    p.&thinsp;{bm.page}
                  </span>
                </button>
                <button
                  onClick={() => removeBookmark(bm.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 btn-icon btn-icon-muted shrink-0"
                  title="Remove bookmark"
                  aria-label={`Remove bookmark for ${bm.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
