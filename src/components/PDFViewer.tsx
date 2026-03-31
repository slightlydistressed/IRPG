import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Bug,
  ArrowLeftRight,
  Maximize2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useDocStorage } from '../hooks/useDocStorage';
import { HIGHLIGHT_COLORS } from '../types';
import type { HighlightRect, SelectionState } from '../types';
import HighlightToolbar from './HighlightToolbar';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/** Tags that should not trigger keyboard shortcuts (focus is on interactive element) */
const INTERACTIVE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'A', 'BUTTON'];

/** Fit modes for the PDF viewer */
type FitMode = 'width' | 'page' | 'actual' | null;

/** Padding (px) subtracted from each side when computing fit scales */
const FIT_PADDING = 24;

/** Gap (px) between the two pages in spread mode */
const SPREAD_GAP = 12;

/** Minimum container width (px) for spread mode to activate */
const MIN_SPREAD_WIDTH = 640;

/** How long (ms) a newly created or clicked highlight stays visually focused. */
const HIGHLIGHT_FOCUS_DURATION_MS = 2000;

/**
 * Number of pages to keep pre-rendered on each side of the current page.
 * Only (2 × RENDER_WINDOW + 1) pages are in the DOM at any time.
 */
const RENDER_WINDOW = 1;

/**
 * Number of adjacent spreads to keep in the DOM on each side of the current
 * spread in two-page spread mode. Each spread is 2 pages, so a value of 1
 * keeps up to 6 pages in the DOM (current spread ± 1).
 */
const SPREAD_RENDER_WINDOW = 1;

/** Round a scale value to the nearest tenth */
function roundScale(s: number): number {
  return Math.round(s * 10) / 10;
}

/** Walk the DOM to find the page number attribute */
function getPageFromNode(node: Node | null): number {
  let el = node instanceof Element ? node : node?.parentElement;
  while (el && el !== document.body) {
    const pg = (el as HTMLElement).dataset?.pageNumber;
    if (pg) return parseInt(pg, 10);
    el = el.parentElement;
  }
  return 0;
}

export default function PDFViewer() {
  const {
    pdfFile,
    pdfLoading,
    documentId,
    currentPage,
    setCurrentPage,
    numPages,
    setNumPages,
    scale,
    setScale,
    addHighlight,
    highlights,
    setSidebarTab,
    setSidebarOpen,
    pdfName,
    scrollKey,
    selectedHighlightId,
    setSelectedHighlightId,
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [chosenColor, setChosenColor] = useState<string>(HIGHLIGHT_COLORS[0].value);
  const [pageInputValue, setPageInputValue] = useState('');
  const [isEditingPage, setIsEditingPage] = useState(false);
  // Incremented to force a Document remount when the user clicks "Try Again".
  const [pdfDocKey, setPdfDocKey] = useState(0);
  // Page labels from the PDF (e.g. "i", "ii", "1", "2"). null = use index.
  const [pageLabels, setPageLabels] = useState<string[] | null>(null);
  // When true, the upcoming scroll-to-top effect is suppressed so the
  // selectedHighlightId scroll can position the view correctly.
  const skipScrollToTopRef = useRef(false);

  // Debounce timer for the selectionchange fallback (mobile touch handles).
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Developer debug: visualise the react-pdf text layer and log selection info.
  // Use a ref so captureCurrentSelection can read the flag without being re-created.
  const [debugTextLayer, setDebugTextLayerState] = useState(false);
  const debugTextLayerRef = useRef(false);
  const toggleDebugTextLayer = useCallback(() => {
    const next = !debugTextLayerRef.current;
    debugTextLayerRef.current = next;
    setDebugTextLayerState(next);
  }, []);

  // Fit mode: 'width' fills container width, 'page' fits entire page in view,
  // 'actual' uses 100% scale, null means manual zoom (uses `scale` from context).
  // Persisted per-document so the user's choice survives page reload.
  const [fitMode, setFitMode] = useDocStorage<FitMode>(documentId, 'fitMode', 'width');
  // Two-page spread mode. Persisted per-document.
  const [spreadMode, setSpreadMode] = useDocStorage<boolean>(documentId, 'spreadMode', false);
  // Natural (scale=1) dimensions of page 1, used to compute fit scales.
  const [naturalPageSize, setNaturalPageSize] = useState<{ width: number; height: number } | null>(null);
  // Current container dimensions tracked via ResizeObserver.
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  // Spread mode is only active when the container is wide enough for two pages.
  // This prevents it from being applied on small screens even if the user had
  // it enabled on a wider device.
  const isSpreadActive = spreadMode && (containerSize?.width ?? 0) >= MIN_SPREAD_WIDTH;

  const onDocumentLoadSuccess = useCallback(
    (pdf: PDFDocumentProxy) => {
      // Get page labels (independent, fire-and-forget).
      pdf
        .getPageLabels()
        .then((labels) =>
          setPageLabels(labels && labels.length > 0 ? labels : null),
        )
        .catch(() => setPageLabels(null));
      // Fetch natural (scale=1) dimensions of page 1 for fit-mode calculations.
      // Set naturalPageSize BEFORE numPages so when pages first render the
      // effectiveScale is already computed from the fit mode rather than
      // falling back to the persisted manual scale (avoiding a scale jump).
      pdf
        .getPage(1)
        .then((page) => {
          const vp = page.getViewport({ scale: 1 });
          setNaturalPageSize({ width: vp.width, height: vp.height });
        })
        .catch((err) => {
          console.warn('[PDFViewer] Could not fetch page dimensions for fit modes:', err);
        })
        .finally(() => {
          setNumPages(pdf.numPages);
        });
    },
    [setNumPages, setPageLabels],
  );

  /**
   * Read the current browser selection and convert it into a `SelectionState`
   * if the selection is non-empty and falls within the PDF container.
   * Returns `null` if no usable selection is found.
   *
   * Called from both the `onPointerUp` handler (immediate, desktop/stylus)
   * and the debounced `selectionchange` listener (mobile touch handles).
   */
  const captureCurrentSelection = useCallback((): SelectionState | null => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return null;

    const text = sel.toString().trim();
    const page = getPageFromNode(sel.anchorNode);
    if (!page) return null;

    const range = sel.getRangeAt(0);
    const selRect = range.getBoundingClientRect();
    const containerEl = containerRef.current;
    const containerRect = containerEl?.getBoundingClientRect();
    if (!containerRect) return null;

    // Build normalised rects (fraction of page dimensions) for the overlay divs.
    const pageEl = containerEl?.querySelector<HTMLElement>(
      `[data-page-number="${page}"]`,
    );
    const pageRect = pageEl?.getBoundingClientRect();
    let rects: HighlightRect[] = [];
    if (pageRect && pageRect.width > 0 && pageRect.height > 0) {
      rects = Array.from(range.getClientRects())
        .filter((r) => r.width > 1 && r.height > 1)
        .map((r) => ({
          left: (r.left - pageRect.left) / pageRect.width,
          top: (r.top - pageRect.top) / pageRect.height,
          width: r.width / pageRect.width,
          height: r.height / pageRect.height,
        }));
    }

    const scrollTop = containerEl?.scrollTop ?? 0;

    // --- Debug logging (only when text-layer debug mode is active) ---
    if (debugTextLayerRef.current) {
      const spanEls = pageEl?.querySelectorAll<HTMLElement>(
        '.react-pdf__Page__textContent span[role="presentation"], .react-pdf__Page__textContent span',
      ) ?? [];
      // Log a sample of the nearest spans to keep the console readable.
      const spanSample = Array.from(spanEls)
        .map((s) => {
          const sr = s.getBoundingClientRect();
          return {
            text: s.textContent?.slice(0, 40) ?? '',
            rect: { top: sr.top, left: sr.left, width: sr.width, height: sr.height },
          };
        })
        .filter((s) => s.text.trim().length > 0)
        .slice(0, 20);
      console.group('[PDF Debug] Text selection on page', page);
      console.log('Selected text:', text);
      console.log('Selection rect (viewport):', {
        top: selRect.top, left: selRect.left, width: selRect.width, height: selRect.height,
      });
      console.log('Normalised highlight rects (fraction of page):', rects);
      console.log('Text-layer spans (sample, up to 20):', spanSample);
      console.groupEnd();
    }

    return {
      text,
      page,
      x: selRect.left - containerRect.left + selRect.width / 2,
      yTop: selRect.top - containerRect.top + scrollTop,
      yBottom: selRect.bottom - containerRect.top + scrollTop,
      rects,
    };
  }, []); // containerRef and debugTextLayerRef are stable refs – no deps needed

  /**
   * Pointer-up handler on the PDF container.
   *
   * `pointerup` fires for mouse, touch, and pen input (unlike `mouseup` which
   * only fires for mouse).  This covers the common desktop/stylus case and
   * also handles single-tap dismissal (pointer released with empty selection).
   */
  const handlePointerUp = useCallback(() => {
    const captured = captureCurrentSelection();
    if (captured) {
      setSelection(captured);
    } else {
      // Pointer released with no active selection – dismiss any open toolbar.
      setSelection(null);
    }
  }, [captureCurrentSelection]);

  /**
   * Debounced `selectionchange` listener.
   *
   * On mobile/tablet, the user drags OS-provided text-selection handles to
   * extend their selection.  During that gesture the browser consumes the
   * touch stream, so no `pointerup` event reaches our handler.  Listening to
   * `selectionchange` on the document – debounced so we only act once the
   * user pauses – fills that gap.
   */
  useEffect(() => {
    const onSelectionChange = () => {
      if (selectionTimerRef.current !== null) clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = setTimeout(() => {
        selectionTimerRef.current = null;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

        // Only act when the selection anchor is inside our container.
        const container = containerRef.current;
        if (!container) return;
        const anchor = sel.anchorNode;
        const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement;
        if (!anchorEl || !container.contains(anchorEl)) return;

        const captured = captureCurrentSelection();
        if (captured) setSelection(captured);
      }, 350);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (selectionTimerRef.current !== null) clearTimeout(selectionTimerRef.current);
    };
  }, [captureCurrentSelection]);

  const handleHighlight = useCallback((note: string, snapshotted: SelectionState) => {
    const newId = addHighlight({
      text: snapshotted.text,
      page: snapshotted.page,
      color: chosenColor,
      note,
      rects: snapshotted.rects,
    });
    // Open the sidebar on the Highlights tab so the user can see the new entry
    setSidebarOpen(true);
    setSidebarTab('highlights');
    // Visually focus the newly created highlight in the overlay
    setSelectedHighlightId(newId);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [chosenColor, addHighlight, setSidebarTab, setSidebarOpen, setSelectedHighlightId]);

  const dismissSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  /**
   * When `selectedHighlightId` is set (either by creating a new highlight or
   * by clicking one in the sidebar), navigate to the highlight's page if
   * needed, then scroll the container so the highlight rect is visible.
   * Auto-clears the focus after HIGHLIGHT_FOCUS_DURATION_MS.
   */
  useEffect(() => {
    if (!selectedHighlightId) return;
    const h = highlights.find((hi) => hi.id === selectedHighlightId);
    if (!h) {
      const clearTimer = setTimeout(() => setSelectedHighlightId(null), HIGHLIGHT_FOCUS_DURATION_MS);
      return () => clearTimeout(clearTimer);
    }

    // In spread mode, navigate to the spread-start (odd page) that contains the
    // highlight's page. This prevents the odd/even flip-flop that would otherwise
    // occur when the normalize-currentPage effect snaps an even targetPage back to odd.
    const targetPage =
      isSpreadActive && h.page % 2 === 0 ? Math.max(1, h.page - 1) : h.page;

    // If the highlight is not on the currently visible page(s), navigate there first.
    // skipScrollToTopRef prevents the scroll-to-top effect from overriding
    // the highlight scroll that runs on the subsequent render.
    if (currentPage !== targetPage) {
      skipScrollToTopRef.current = true;
      setCurrentPage(targetPage);
      return; // effect re-runs after currentPage updates
    }

    const container = containerRef.current;
    if (!container) {
      const clearTimer = setTimeout(() => setSelectedHighlightId(null), HIGHLIGHT_FOCUS_DURATION_MS);
      return () => clearTimeout(clearTimer);
    }
    const pageEl = pageRefs.current.get(h.page);
    if (!pageEl) {
      const clearTimer = setTimeout(() => setSelectedHighlightId(null), HIGHLIGHT_FOCUS_DURATION_MS);
      return () => clearTimeout(clearTimer);
    }

    if (h.rects && h.rects.length > 0) {
      const containerRect = container.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();
      const pageScrollTop = pageRect.top - containerRect.top + container.scrollTop;
      const highlightScrollTop = pageScrollTop + h.rects[0].top * pageEl.offsetHeight;
      container.scrollTo({
        top: Math.max(0, highlightScrollTop - 80),
        behavior: 'smooth',
      });
    } else {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const clearTimer = setTimeout(() => setSelectedHighlightId(null), HIGHLIGHT_FOCUS_DURATION_MS);
    return () => clearTimeout(clearTimer);
  }, [selectedHighlightId, highlights, currentPage, setCurrentPage, setSelectedHighlightId, isSpreadActive]);

  // In single-page view, scroll the container back to the top whenever the
  // active page changes (unless a highlight-scroll is about to handle it).
  // scrollKey forces a re-run even when currentPage hasn't changed.
  useEffect(() => {
    if (skipScrollToTopRef.current) {
      skipScrollToTopRef.current = false;
      return;
    }
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  // scrollKey intentionally forces a re-run even when currentPage hasn't changed
  }, [currentPage, scrollKey]);

  // In spread mode, currentPage must always be the start of a spread (odd page, 1-based).
  // If an external source (TOC, bookmarks) sets currentPage to an even page, snap back
  // to the preceding odd page so the correct spread is shown.
  useEffect(() => {
    if (!spreadMode || numPages === 0) return;
    if (currentPage % 2 === 0) {
      setCurrentPage(Math.max(1, currentPage - 1));
    }
  }, [spreadMode, currentPage, numPages, setCurrentPage]);

  // Keyboard shortcuts: ArrowLeft/Right and PageUp/Down for page navigation
  // Only fires when focus is not on an interactive element to avoid conflicts.
  useEffect(() => {
    if (!pdfFile || numPages === 0) return;
    const step = isSpreadActive ? 2 : 1;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (INTERACTIVE_TAGS.includes(tag)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage(Math.max(1, currentPage - step));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPage(Math.min(numPages, currentPage + step));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfFile, numPages, currentPage, setCurrentPage, isSpreadActive]);

  // Track container size via ResizeObserver so fit modes recompute on resize.
  // Also capture the initial dimensions immediately on mount so effectiveScale
  // is computed from the real container width on the very first render, avoiding
  // the flash where fit-width falls back to the persisted manual scale (1.2×).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Synchronous initial read – prevents one frame of incorrect scale.
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // containerRef is stable

  // Compute the scale to actually use for rendering.
  // In fit modes we derive the scale from container/page dimensions;
  // in manual mode we use the persisted `scale` from context.
  const effectiveScale = useMemo(() => {
    if (!fitMode || !naturalPageSize || !containerSize) return scale;
    if (fitMode === 'actual') return 1.0;
    // In spread mode each page gets half the available width (minus the gap between them).
    const spreadActive = spreadMode && containerSize.width >= MIN_SPREAD_WIDTH;
    const pagesShown = spreadActive ? 2 : 1;
    const gapTotal = spreadActive ? SPREAD_GAP : 0;
    const availableWidth = Math.max(1, (containerSize.width - FIT_PADDING * 2 - gapTotal) / pagesShown);
    if (fitMode === 'width') {
      return availableWidth / naturalPageSize.width;
    }
    // 'page' – fit the whole page in the visible area
    const availableHeight = Math.max(1, containerSize.height - FIT_PADDING * 2);
    return Math.min(
      availableWidth / naturalPageSize.width,
      availableHeight / naturalPageSize.height,
    );
  }, [fitMode, naturalPageSize, containerSize, scale, spreadMode]);

  const commitPageInput = useCallback(() => {
    const parsed = parseInt(pageInputValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
      setCurrentPage(parsed);
    }
    setIsEditingPage(false);
  }, [pageInputValue, numPages, setCurrentPage]);

  const handleStartPageEdit = useCallback(() => {
    setPageInputValue(String(currentPage));
    setIsEditingPage(true);
  }, [currentPage]);

  /** Returns className for a fit-mode toggle button, highlighted when active. */
  const fitBtnClass = useCallback(
    (mode: FitMode, extra = '') =>
      `btn-icon${fitMode === mode ? ' text-[var(--color-accent)] bg-[var(--color-accent-subtle)]' : ''}${extra ? ' ' + extra : ''}`,
    [fitMode],
  );

  if (!pdfFile) {
    if (pdfLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-4xl mb-4 animate-spin">⏳</div>
            <p className="text-[var(--color-text-muted)] text-sm">Loading IRPG…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            Welcome to IRPG PDF Reader
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-4">
            Open a PDF to get started. Features include:
          </p>
          <ul className="text-sm text-[var(--color-text-muted)] text-left list-disc list-inside space-y-1">
            <li>Interactive table of contents</li>
            <li>Text highlighting with notes</li>
            <li>Page bookmarks</li>
            <li>Forms &amp; checklists with export</li>
            <li>Dark &amp; light mode</li>
            <li>Works offline</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="viewer-toolbar flex items-center gap-2 px-3 py-1.5 shrink-0 overflow-x-auto">
        <div className="toolbar-group shrink-0">
          <button
            className="btn-icon"
            onClick={() => setCurrentPage(Math.max(1, currentPage - (isSpreadActive ? 2 : 1)))}
            disabled={currentPage <= 1}
            title="Previous page (←)"
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          {isEditingPage ? (
            <input
              type="number"
              className="input-base text-sm font-mono text-center min-w-[56px] max-w-[56px] px-1 py-0.5"
              value={pageInputValue}
              min={1}
              max={numPages}
              onChange={(e) => setPageInputValue(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPageInput();
                if (e.key === 'Escape') setIsEditingPage(false);
              }}
              autoFocus
            />
          ) : (
            <button
              className="text-sm font-mono text-[var(--color-text)] min-w-[76px] text-center hover:bg-[var(--color-border)]/60 rounded px-1 py-0.5 transition-colors"
              onClick={handleStartPageEdit}
              title="Click to jump to a page"
              aria-label={
                isSpreadActive && currentPage + 1 <= numPages
                  ? `Pages ${currentPage}–${currentPage + 1} of ${numPages}. Click to jump to a page.`
                  : `Page ${currentPage} of ${numPages}. Click to jump to a page.`
              }
            >
              {isSpreadActive && currentPage + 1 <= numPages
                ? `${currentPage}–${currentPage + 1} / ${numPages}`
                : `${currentPage} / ${numPages}`}
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => setCurrentPage(Math.min(numPages, currentPage + (isSpreadActive ? 2 : 1)))}
            disabled={currentPage + (isSpreadActive ? 2 : 1) > numPages}
            title="Next page (→)"
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="toolbar-group shrink-0">
          <button
            className="btn-icon"
            onClick={() => {
              const next = Math.max(0.5, roundScale(effectiveScale - 0.1));
              setFitMode(null);
              setScale(next);
            }}
            disabled={effectiveScale <= 0.5}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm font-mono text-[var(--color-text)] min-w-[48px] text-center" aria-live="polite" aria-label={`Zoom level ${Math.round(effectiveScale * 100)} percent`}>
            {Math.round(effectiveScale * 100)}%
          </span>
          <button
            className="btn-icon"
            onClick={() => {
              const next = Math.min(3, roundScale(effectiveScale + 0.1));
              setFitMode(null);
              setScale(next);
            }}
            disabled={effectiveScale >= 3}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setFitMode('width')}
            title="Reset to fit width"
            aria-label="Reset to fit width"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Fit mode buttons + spread toggle – hidden on small mobile screens */}
        <div className="toolbar-group shrink-0 hidden sm:flex">
          <button
            className={fitBtnClass('width')}
            onClick={() => setFitMode('width')}
            title="Fit width"
            aria-label="Fit width"
            aria-pressed={fitMode === 'width'}
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            className={fitBtnClass('page')}
            onClick={() => setFitMode('page')}
            title="Fit page"
            aria-label="Fit page"
            aria-pressed={fitMode === 'page'}
          >
            <Maximize2 size={14} />
          </button>
          <button
            className={fitBtnClass('actual', 'text-xs font-semibold px-2')}
            onClick={() => setFitMode('actual')}
            title="Actual size (100%)"
            aria-label="Actual size"
            aria-pressed={fitMode === 'actual'}
          >
            1:1
          </button>
          <button
            className={`btn-icon text-xs font-semibold px-2${isSpreadActive ? ' text-[var(--color-accent)] bg-[var(--color-accent-subtle)]' : ''}`}
            onClick={() => setSpreadMode((v) => !v)}
            title={isSpreadActive ? 'Single page view' : 'Two-page spread'}
            aria-label={isSpreadActive ? 'Switch to single page view' : 'Switch to two-page spread view'}
            aria-pressed={isSpreadActive}
          >
            2P
          </button>
        </div>

        {/* Colour pre-selector – hidden on mobile (the floating HighlightToolbar has its own) */}
        <div className="hidden sm:flex toolbar-group shrink-0">
          <Highlighter size={14} className="text-[var(--color-text-muted)] mx-1" />
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setChosenColor(c.value)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                chosenColor === c.value
                  ? 'border-[var(--color-accent)] scale-125'
                  : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c.value }}
              title={`Highlight in ${c.label}`}
            />
          ))}
        </div>

        {pdfName && (
          <span className="ml-auto text-xs text-[var(--color-text-muted)] truncate hidden md:block max-w-xs">
            {pdfName}
          </span>
        )}

        {/* Developer tool: toggle text-layer debug visualisation */}
        <button
          className={`btn-icon ml-auto shrink-0${debugTextLayer ? ' text-orange-400' : ''}`}
          onClick={toggleDebugTextLayer}
          title={debugTextLayer ? 'Disable text-layer debug (Dev)' : 'Enable text-layer debug (Dev)'}
          aria-label={debugTextLayer ? 'Disable text-layer debug mode' : 'Enable text-layer debug mode'}
          aria-pressed={debugTextLayer}
        >
          <Bug size={14} />
        </button>
      </div>

      {/* PDF pages */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto pdf-container relative select-text${debugTextLayer ? ' pdf-debug-text-layer' : ''}`}
        onPointerUp={handlePointerUp}
      >
        <Document
          key={pdfDocKey}
          file={pdfFile}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
              Loading PDF…
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-red-500 text-sm">Failed to load PDF.</p>
              <button
                className="btn-primary btn-sm"
                onClick={() => setPdfDocKey((k) => k + 1)}
              >
                Try Again
              </button>
            </div>
          }
          className="flex flex-col items-center py-4"
        >
          {(() => {
            // Build page groups: in spread mode, pairs [[1,2],[3,4],...];
            // in single mode, singles [[1],[2],...].  Only groups within the
            // render window are included so off-screen pages stay out of the DOM.
            const groups: Array<{ pages: number[]; isVisible: boolean }> = [];
            if (numPages > 0) {
              if (isSpreadActive) {
                for (let i = 1; i <= numPages; i += 2) {
                  const pages = i + 1 <= numPages ? [i, i + 1] : [i];
                  // Keep the current spread ± SPREAD_RENDER_WINDOW adjacent spreads in the DOM.
                  if (Math.abs(i - currentPage) > SPREAD_RENDER_WINDOW * 2) continue;
                  groups.push({ pages, isVisible: i === currentPage });
                }
              } else {
                for (let pg = 1; pg <= numPages; pg++) {
                  if (Math.abs(pg - currentPage) > RENDER_WINDOW) continue;
                  groups.push({ pages: [pg], isVisible: pg === currentPage });
                }
              }
            }

            return groups.map(({ pages, isVisible }) => (
              <div
                key={pages[0]}
                className={pages.length > 1 ? 'flex items-start gap-3' : undefined}
                style={isVisible ? undefined : { display: 'none' }}
              >
                {pages.map((pg) => {
                  const pageLabel = pageLabels?.[pg - 1] ?? String(pg);
                  return (
                    <div
                      key={pg}
                      ref={(el) => {
                        if (el) pageRefs.current.set(pg, el);
                        else pageRefs.current.delete(pg);
                      }}
                      data-page-number={pg}
                      className="shadow-lg relative"
                    >
                      <Page
                        pageNumber={pg}
                        scale={effectiveScale}
                        renderTextLayer
                        renderAnnotationLayer
                      />
                      {/* Highlight overlay layer.
                          z-index: 1 places this container above the PDF canvas (z-index auto)
                          but below the text-selection layer (z-index 2) and annotation layer
                          (z-index 3).  react-pdf__Page has only position:relative (no z-index)
                          so it does not create a new stacking context, meaning all z-indexes
                          here compare in the same ancestor context.
                          Result: highlight color appears as a true background behind the
                          rendered PDF text — text stays fully readable and selectable. */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ zIndex: 1 }}
                      >
                        {highlights
                          .filter((h) => h.page === pg && h.rects && h.rects.length > 0)
                          .flatMap((h) => {
                            const isSelected = h.id === selectedHighlightId;
                            return h.rects!.map((r, i) => (
                              <div
                                key={`${h.id}-${i}`}
                                className="absolute transition-opacity dark:mix-blend-screen mix-blend-multiply"
                                style={{
                                  left: `${r.left * 100}%`,
                                  top: `${r.top * 100}%`,
                                  width: `${r.width * 100}%`,
                                  height: `${r.height * 100}%`,
                                  backgroundColor: h.color,
                                  opacity: isSelected ? 0.5 : 0.3,
                                  boxShadow: isSelected
                                    ? '0 0 0 2px var(--color-accent)'
                                    : undefined,
                                }}
                              />
                            ));
                          })}
                      </div>
                      {/* Static page label badge – helps readers match the on-screen page
                          to the Table of Contents. Shows the PDF's own page label when the
                          document defines one (e.g. "i", "A-1"), otherwise the page index. */}
                      <div
                        aria-hidden="true"
                        className="absolute bottom-2 right-2 pointer-events-none select-none text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          zIndex: 10,
                          background: 'rgba(0,0,0,0.4)',
                          color: 'rgba(255,255,255,0.9)',
                        }}
                      >
                        {pageLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </Document>

        {/* Floating highlight toolbar – viewport-clamped via HighlightToolbar */}
        {selection && (
          <HighlightToolbar
            selection={selection}
            chosenColor={chosenColor}
            onColorChange={setChosenColor}
            onHighlight={handleHighlight}
            onDismiss={dismissSelection}
            containerRef={containerRef}
          />
        )}
      </div>
    </div>
  );
}
