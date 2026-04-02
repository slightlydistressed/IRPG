import React, { useRef, useCallback, useLayoutEffect, Suspense, lazy } from 'react';
import { List, Highlighter, ClipboardList, Bookmark } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import TableOfContents from './TableOfContents';
import HighlightPanel from './HighlightPanel';
import BookmarksPanel from './BookmarksPanel';
import type { SidebarTab } from '../types';

// FormPanel imports docx export utilities; lazy-load it so those heavy
// modules are deferred until the user first opens the Forms tab.
const FormPanel = lazy(() => import('./FormPanel'));

const TABS: { id: SidebarTab; label: string; Icon: React.ElementType }[] = [
  { id: 'toc',        label: 'Contents',   Icon: List         },
  { id: 'highlights', label: 'Highlights', Icon: Highlighter  },
  { id: 'forms',      label: 'Forms',      Icon: ClipboardList },
  { id: 'bookmarks',  label: 'Bookmarks',  Icon: Bookmark     },
];

/** Minimum sidebar width in pixels (desktop only). */
const SIDEBAR_MIN_WIDTH = 200;
/** Maximum sidebar width in pixels (desktop only). */
const SIDEBAR_MAX_WIDTH = 480;
/** Default sidebar width in pixels. */
const SIDEBAR_DEFAULT_WIDTH = 288;

export default function Sidebar() {
  const { sidebarTab, setSidebarTab, sidebarOpen, setSidebarOpen, highlights, bookmarks } = useApp();

  // Persist the user's chosen sidebar width across sessions.
  // Only applied on desktop – the mobile CSS media query overrides it.
  const [sidebarWidth, setSidebarWidth] = useLocalStorage<number>(
    'irpg-sidebar-width',
    SIDEBAR_DEFAULT_WIDTH,
  );

  // Refs track drag state so the stable callbacks below can always read the
  // latest values without being recreated on every pixel of drag.
  const sidebarWidthRef = useRef(sidebarWidth);
  // Keep the ref in sync so drag handlers always see the latest persisted width.
  useLayoutEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);
  const startXRef = useRef(0);
  const startWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  // Pending requestAnimationFrame handle – used to batch width updates to one
  // per frame and avoid flooding React with a re-render per pointer event.
  const rafRef = useRef<number | null>(null);

  /** Restore body styles that are set during a drag (cursor + user-select). */
  const restoreDragStyles = useCallback(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  /** Begin a resize drag when the right-edge handle is pressed. */
  const handleResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidthRef.current;
    // Pointer capture routes all subsequent move/up events to this element
    // even when the pointer leaves it, giving smooth drag-to-edge behaviour.
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  /** Update sidebar width while the pointer is captured (rAF-throttled). */
  const handleResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startXRef.current;
    const newWidth = Math.max(
      SIDEBAR_MIN_WIDTH,
      Math.min(SIDEBAR_MAX_WIDTH, startWidthRef.current + dx),
    );
    // Cancel any pending frame so only the most recent value is applied.
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setSidebarWidth(newWidth);
    });
  }, [setSidebarWidth]);

  /** Finish a resize drag and restore global cursor state. */
  const handleResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    restoreDragStyles();
  }, [restoreDragStyles]);

  /** Restore styles if the drag is cancelled (e.g. window loses focus). */
  const handleResizePointerCancel = useCallback(() => {
    restoreDragStyles();
  }, [restoreDragStyles]);

  // Cancel any pending rAF when the component unmounts.
  React.useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <>
      {/* Tap-outside backdrop – rendered on mobile only via CSS */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar flex flex-col shrink-0 overflow-hidden${sidebarOpen ? ' sidebar-open' : ''}`}
        style={{ '--sidebar-width-desktop': `${sidebarWidth}px` } as React.CSSProperties}
      >
        {/* Drag handle – visual affordance for mobile bottom sheet */}
        <div className="sheet-drag-handle" aria-hidden="true" />

        {/* Tab bar */}
        <div className="flex border-b border-[var(--color-border)] shrink-0" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSidebarTab(id)}
              className={`tab-btn flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                sidebarTab === id ? 'tab-btn-active' : ''
              }`}
              title={label}
              aria-selected={sidebarTab === id}
              role="tab"
            >
              <div className="relative">
                <Icon size={16} />
                {id === 'highlights' && highlights.length > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold leading-none"
                    aria-label={`${highlights.length} highlight${highlights.length !== 1 ? 's' : ''}`}
                  >
                    {highlights.length > 99 ? '99+' : highlights.length}
                  </span>
                )}
                {id === 'bookmarks' && bookmarks.length > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold leading-none"
                    aria-label={`${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''}`}
                  >
                    {bookmarks.length > 99 ? '99+' : bookmarks.length}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'toc' && <TableOfContents />}
          {sidebarTab === 'highlights' && <HighlightPanel />}
          {sidebarTab === 'forms' && (
            <Suspense fallback={<div role="status" aria-live="polite" className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</div>}>
              <FormPanel />
            </Suspense>
          )}
          {sidebarTab === 'bookmarks' && <BookmarksPanel />}
        </div>

        {/* Desktop resize handle – drag to adjust sidebar width. Hidden on mobile via CSS.
            Double-click resets to the default width. */}
        <div
          className="sidebar-resize-handle"
          aria-hidden="true"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerCancel}
          onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
        />
      </aside>
    </>
  );
}
