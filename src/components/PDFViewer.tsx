import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
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

/** Padding (px) subtracted from each side when computing fit scales */
const FIT_PADDING = 24;

/** Gap (px) between the two pages in spread mode */
const SPREAD_GAP = 12;

/** Minimum container width (px) for spread mode to activate */
const MIN_SPREAD_WIDTH = 640;

/** How long (ms) a newly created or clicked highlight stays visually focused. */
const HIGHLIGHT_FOCUS_DURATION_MS = 2000;

/**
 * Number of pages to keep pre-rendered on each side of the current page
 * in single-page (1p) mode. Only (2 × RENDER_WINDOW + 1) pages are in
 * the DOM at any time.
 */
const RENDER_WINDOW = 1;

/**
 * Number of adjacent spreads to keep in the DOM on each side of the current
 * spread in two-page spread mode. Each spread is 2 pages, so a value of 1
 * keeps up to 6 pages in the DOM (current spread ± 1).
 */
const SPREAD_RENDER_WINDOW = 1;

/**
 * Number of pages to keep fully rendered on each side of the current page
 * in infinite-scroll mode. Pages outside this window render as height-
 * preserving placeholders so scroll position stays stable.
 */
const SCROLL_RENDER_WINDOW = 3;

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
    currentPage,
    setCurrentPage,
    numPages,
    setNumPages,
    scale,
    setScale,
    addHighlight,
    highlights,
    updateHighlightColor,
    scrollKey,
    selectedHighlightId,
    setSelectedHighlightId,
    readingMode,
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [chosenColor, setChosenColor] = useState<string>(HIGHLIGHT_COLORS[0].value);
  // Live-preview selection (rAF-throttled selectionchange) shown while dragging.
  const [previewSelection, setPreviewSelection] = useState<SelectionState | null>(null);
  // ID of the highlight that was just saved – drives the recolor toolbar.
  const [pendingRecolorId, setPendingRecolorId] = useState<string | null>(null);
  // rAF handle for throttling live-preview updates.
  const rafPreviewRef = useRef<number | null>(null);
  const [pageInputValue, setPageInputValue] = useState('');
  const [isEditingPage, setIsEditingPage] = useState(false);
  // Incremented to force a Document remount when the user clicks "Try Again".
  const [pdfDocKey, setPdfDocKey] = useState(0);
  // Page labels from the PDF (e.g. "i", "ii", "1", "2"). null = use index.
  const [pageLabels, setPageLabels] = useState<string[] | null>(null);
  // When true, the upcoming scroll-to-top effect is suppressed so the
  // selectedHighlightId scroll can position the view correctly.
  const skipScrollToTopRef = useRef(false);

  // Tracks the latest effectiveScale so the wheel-zoom handler can read it
  // without being recreated on every scale change.
  const effectiveScaleRef = useRef(1);

  // Debounce timer for the selectionchange fallback (mobile touch handles).
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Natural (scale=1) dimensions of page 1, used to compute fit-width scale.
  const [naturalPageSize, setNaturalPageSize] = useState<{ width: number; height: number } | null>(null);
  // Current container dimensions tracked via ResizeObserver.
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  // Two-page spread is only active in '2p' mode AND when the container
  // is wide enough. This prevents spread on narrow screens.
  const isSpreadActive = readingMode === '2p' && (containerSize?.width ?? 0) >= MIN_SPREAD_WIDTH;

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

    return {
      text,
      page,
      x: selRect.left - containerRect.left + selRect.width / 2,
      yTop: selRect.top - containerRect.top + scrollTop,
      yBottom: selRect.bottom - containerRect.top + scrollTop,
      rects,
    };
  }, []); // containerRef is a stable ref – no deps needed

  /**
   * Pointer-up handler on the PDF container.
   *
   * Immediately saves the current selection as a highlight (default colour)
   * then shows the recolor toolbar.  The debounced selectionchange listener
   * handles the equivalent flow for mobile selection-handle drags.
   */
  const handlePointerUp = useCallback(() => {
    // Cancel any pending mobile-fallback commit so we don't double-save.
    if (selectionTimerRef.current !== null) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }
    // Clear live preview (committed highlight will render instead).
    if (rafPreviewRef.current !== null) {
      cancelAnimationFrame(rafPreviewRef.current);
      rafPreviewRef.current = null;
    }
    setPreviewSelection(null);

    const captured = captureCurrentSelection();
    if (captured) {
      const newId = addHighlight({
        text: captured.text,
        page: captured.page,
        color: chosenColor,
        note: '',
        rects: captured.rects,
      });
      setSelectedHighlightId(newId);
      setPendingRecolorId(newId);
      setSelection(captured); // position info for recolor toolbar
      window.getSelection()?.removeAllRanges();
    } else {
      // Pointer released with no active selection – dismiss any open toolbar.
      setSelection(null);
      setPendingRecolorId(null);
    }
  }, [captureCurrentSelection, chosenColor, addHighlight, setSelectedHighlightId]);

  /**
   * Combined selectionchange listener:
   *   - rAF-throttled: updates the live preview while the user is dragging.
   *   - Debounced (350 ms): mobile fallback that commits the highlight once
   *     the user pauses after dragging OS selection handles (where pointerup
   *     never fires against our container).
   */
  useEffect(() => {
    const onSelectionChange = () => {
      // ── Live preview (rAF-throttled) ──
      if (rafPreviewRef.current !== null) cancelAnimationFrame(rafPreviewRef.current);
      rafPreviewRef.current = requestAnimationFrame(() => {
        rafPreviewRef.current = null;
        const captured = captureCurrentSelection();
        setPreviewSelection(captured);
      });

      // ── Mobile commit fallback (debounced 350 ms) ──
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
        if (!captured) return;

        setPreviewSelection(null);
        const newId = addHighlight({
          text: captured.text,
          page: captured.page,
          color: chosenColor,
          note: '',
          rects: captured.rects,
        });
        setSelectedHighlightId(newId);
        setPendingRecolorId(newId);
        setSelection(captured);
        window.getSelection()?.removeAllRanges();
      }, 350);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (selectionTimerRef.current !== null) clearTimeout(selectionTimerRef.current);
      if (rafPreviewRef.current !== null) cancelAnimationFrame(rafPreviewRef.current);
    };
  }, [captureCurrentSelection, chosenColor, addHighlight, setSelectedHighlightId]);

  /**
   * Called when the user picks a colour in the recolor toolbar.
   * Updates the just-saved highlight and also sets it as the new default.
   */
  const handleRecolor = useCallback((color: string) => {
    if (pendingRecolorId) {
      updateHighlightColor(pendingRecolorId, color);
      setChosenColor(color);
    }
    setSelection(null);
    setPendingRecolorId(null);
  }, [pendingRecolorId, updateHighlightColor]);

  /**
   * Called when the user starts a new pointer gesture.
   * Clears any existing recolor toolbar and live preview so the next
   * selection starts from a clean state.
   */
  const handlePointerDown = useCallback(() => {
    setSelection(null);
    setPendingRecolorId(null);
    setPreviewSelection(null);
  }, []);

  const dismissSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setPendingRecolorId(null);
    setPreviewSelection(null);
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

  // In single-page (1p/2p) view, scroll the container back to the top whenever
  // the active page changes (unless a highlight-scroll is about to handle it).
  // In scroll mode this is skipped – scrolling is managed by the user and
  // IntersectionObserver; programmatic scroll happens via scrollKey below.
  // scrollKey forces a re-run even when currentPage hasn't changed.
  useEffect(() => {
    if (readingMode === 'scroll') return;
    if (skipScrollToTopRef.current) {
      skipScrollToTopRef.current = false;
      return;
    }
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  // scrollKey intentionally forces a re-run even when currentPage hasn't changed
  }, [currentPage, scrollKey, readingMode]);

  // In scroll mode, scrollKey (incremented by scrollToPage()) drives a jump
  // to the target page element so TOC / bookmark navigation still works.
  useEffect(() => {
    if (readingMode !== 'scroll' || !scrollKey) return;
    const el = pageRefs.current.get(currentPage);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // scrollKey intentionally forces a re-run even when currentPage hasn't changed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey, readingMode]);

  // When switching to scroll mode, immediately scroll to the current page so
  // the user's position is preserved rather than jumping to page 1.
  useEffect(() => {
    if (readingMode !== 'scroll' || numPages === 0) return;
    // Use requestAnimationFrame to wait for the DOM to fully render the new
    // page groups before trying to scroll.
    const raf = requestAnimationFrame(() => {
      const el = pageRefs.current.get(currentPage);
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  // currentPage intentionally excluded – we only want to run on mode change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingMode, numPages]);

  // In spread mode, currentPage must always be the start of a spread (odd page, 1-based).
  // If an external source (TOC, bookmarks) sets currentPage to an even page, snap back
  // to the preceding odd page so the correct spread is shown.
  useEffect(() => {
    if (readingMode !== '2p' || numPages === 0) return;
    if (currentPage % 2 === 0) {
      setCurrentPage(Math.max(1, currentPage - 1));
    }
  }, [readingMode, currentPage, numPages, setCurrentPage]);

  // Keyboard shortcuts: ArrowLeft/Right and PageUp/Down for page navigation.
  // In scroll mode the browser handles scrolling naturally; only Home/End are
  // intercepted (to jump to first/last page).
  // Only fires when focus is not on an interactive element to avoid conflicts.
  useEffect(() => {
    if (!pdfFile || numPages === 0) return;
    const step = isSpreadActive ? 2 : 1;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (INTERACTIVE_TAGS.includes(tag)) return;
      if (readingMode === 'scroll') {
        // In scroll mode only handle Home/End to jump to first/last page.
        if (e.key === 'Home') {
          e.preventDefault();
          const el = pageRefs.current.get(1);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setCurrentPage(1);
        } else if (e.key === 'End') {
          e.preventDefault();
          const el = pageRefs.current.get(numPages);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setCurrentPage(numPages);
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage(Math.max(1, currentPage - step));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPage(Math.min(numPages, currentPage + step));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentPage(numPages);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfFile, numPages, currentPage, setCurrentPage, isSpreadActive, readingMode]);

  // Ctrl/Cmd + scroll wheel to zoom in or out, matching standard PDF reader
  // behaviour.  Uses a non-passive listener so we can call preventDefault()
  // to prevent the browser from zooming the page instead.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const next = Math.max(0.5, Math.min(3, roundScale(effectiveScaleRef.current + delta)));
      setScale(next);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setScale]); // containerRef is stable; effectiveScaleRef is a ref

  // IntersectionObserver for scroll mode: watches all page containers and
  // updates currentPage to whichever page is most visible in the viewport.
  // Reconnects whenever numPages changes (new doc loaded) or mode switches.
  useEffect(() => {
    if (readingMode !== 'scroll' || numPages === 0) return;
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          // Pick the entry with the largest intersection ratio that is visible.
          let best: IntersectionObserverEntry | null = null;
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (!best || entry.intersectionRatio > best.intersectionRatio) {
                best = entry;
              }
            }
          }
          if (best) {
            const pg = parseInt((best.target as HTMLElement).dataset.pageNumber ?? '0', 10);
            if (pg > 0) setCurrentPage(pg);
          }
        });
      },
      { root: container, threshold: [0.1, 0.3, 0.5, 0.7] },
    );

    // Observe all page containers that are currently in pageRefs.
    pageRefs.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // Re-run when mode or document changes; currentPage intentionally excluded
    // so the observer doesn't reconnect on every scroll-driven page update.
  }, [readingMode, numPages, setCurrentPage]);
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
  // fitMode is always 'width' so we always derive scale from container width.
  const effectiveScale = useMemo(() => {
    if (!naturalPageSize || !containerSize) return scale;
    // In 2p mode each page gets half the available width (minus the gap between them).
    const spreadActive = readingMode === '2p' && containerSize.width >= MIN_SPREAD_WIDTH;
    const pagesShown = spreadActive ? 2 : 1;
    const gapTotal = spreadActive ? SPREAD_GAP : 0;
    const availableWidth = Math.max(1, (containerSize.width - FIT_PADDING * 2 - gapTotal) / pagesShown);
    return availableWidth / naturalPageSize.width;
  }, [naturalPageSize, containerSize, scale, readingMode]);

  // Keep the ref in sync so the wheel-zoom handler always sees the latest value.
  useLayoutEffect(() => {
    effectiveScaleRef.current = effectiveScale;
  }, [effectiveScale]);

  /**
   * Page groups to render.  Only pages within the render window are included;
   * pages outside the window are not mounted at all.  Adjacent pages inside the
   * window are kept in the DOM but hidden (display:none) so navigation to them
   * is instant.
   *
   * Using useMemo avoids recomputing the list on every render.  The loop is
   * O(RENDER_WINDOW) rather than O(numPages) so large PDFs don't pay a cost
   * proportional to total page count.
   */
  const pageGroups = useMemo((): Array<{ pages: number[]; isVisible: boolean }> => {
    if (numPages === 0) return [];

    if (readingMode === 'scroll') {
      // Scroll mode: ALL pages are in the DOM as containers. Pages within
      // SCROLL_RENDER_WINDOW of the current page are fully rendered; others
      // show a height-preserving placeholder. This keeps scroll position stable
      // as the render window shifts.
      const winStart = Math.max(1, currentPage - SCROLL_RENDER_WINDOW);
      const winEnd = Math.min(numPages, currentPage + SCROLL_RENDER_WINDOW);
      const groups: Array<{ pages: number[]; isVisible: boolean }> = [];
      for (let pg = 1; pg <= numPages; pg++) {
        groups.push({ pages: [pg], isVisible: pg >= winStart && pg <= winEnd });
      }
      return groups;
    }

    if (isSpreadActive) {
      // Keep the current spread ± SPREAD_RENDER_WINDOW adjacent spreads in DOM.
      const halfWindow = SPREAD_RENDER_WINDOW * 2;
      const rawStart = currentPage - halfWindow;
      const rawEnd   = currentPage + halfWindow + 1;
      // Spreads always start on odd pages; round rawStart down if needed.
      const firstSpread = Math.max(1, rawStart % 2 === 0 ? rawStart - 1 : rawStart);
      const lastSpread  = Math.min(numPages, rawEnd);
      const groups: Array<{ pages: number[]; isVisible: boolean }> = [];
      for (let i = firstSpread; i <= lastSpread; i += 2) {
        const pages = i + 1 <= numPages ? [i, i + 1] : [i];
        groups.push({ pages, isVisible: i === currentPage });
      }
      return groups;
    }

    // Single-page (1p) mode: keep current page ± RENDER_WINDOW pages in DOM.
    const startPg = Math.max(1, currentPage - RENDER_WINDOW);
    const endPg   = Math.min(numPages, currentPage + RENDER_WINDOW);
    const groups: Array<{ pages: number[]; isVisible: boolean }> = [];
    for (let pg = startPg; pg <= endPg; pg++) {
      groups.push({ pages: [pg], isVisible: pg === currentPage });
    }
    return groups;
  }, [numPages, currentPage, isSpreadActive, readingMode]);

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
        {/* Page navigation – prev/next only shown in 1p/2p modes */}
        <div className="toolbar-group shrink-0">
          {readingMode !== 'scroll' && (
            <button
              className="btn-icon"
              onClick={() => setCurrentPage(Math.max(1, currentPage - (isSpreadActive ? 2 : 1)))}
              disabled={currentPage <= 1}
              title="Previous page (←)"
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
          )}
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
              {/* Show PDF-native page label (e.g. "iii", "A-1") when it differs
                  from the page index, giving users a clear match to the TOC. */}
              {!isSpreadActive && (() => {
                const lbl = pageLabels?.[currentPage - 1];
                return lbl && lbl !== String(currentPage)
                  ? <span className="ml-1 opacity-50 text-xs">({lbl})</span>
                  : null;
              })()}
            </button>
          )}
          {readingMode !== 'scroll' && (
            <button
              className="btn-icon"
              onClick={() => setCurrentPage(Math.min(numPages, currentPage + (isSpreadActive ? 2 : 1)))}
              disabled={currentPage + (isSpreadActive ? 2 : 1) > numPages}
              title="Next page (→)"
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Colour pre-selector – hidden on mobile (the floating HighlightToolbar has its own) */}
        <div className="hidden sm:flex toolbar-group shrink-0">
          <Highlighter size={14} className="text-[var(--color-text-muted)] mx-1" />
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setChosenColor(c.value)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                chosenColor === c.value
                  ? 'border-[var(--color-accent)] scale-125'
                  : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c.value }}
              title={`Highlight in ${c.label}`}
              aria-label={`Highlight in ${c.label}`}
              aria-pressed={chosenColor === c.value}
            />
          ))}
        </div>
      </div>

      {/* PDF pages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto pdf-container relative select-text"
        onPointerDown={handlePointerDown}
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
          {pageGroups.map(({ pages, isVisible }) => {
            // In scroll mode: always show the container (never display:none),
            // but render a height-preserving placeholder for pages outside the
            // render window so the scroll position stays stable as the window shifts.
            const useScrollPlaceholder = readingMode === 'scroll' && !isVisible;
            return (
            <div
              key={pages[0]}
              className={pages.length > 1 ? 'flex items-start gap-3' : undefined}
              style={(!useScrollPlaceholder && !isVisible) ? { display: 'none' } : undefined}
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
                    {useScrollPlaceholder && naturalPageSize ? (
                      // Height-preserving placeholder keeps layout stable while
                      // the page is outside the render window.
                      <div
                        aria-hidden="true"
                        style={{
                          width: Math.round(naturalPageSize.width * effectiveScale),
                          height: Math.round(naturalPageSize.height * effectiveScale),
                          background: 'var(--color-bg-secondary)',
                        }}
                      />
                    ) : (
                    <Page
                      pageNumber={pg}
                      scale={effectiveScale}
                      renderTextLayer
                      renderAnnotationLayer
                      loading={
                        naturalPageSize ? (
                          <div
                            role="status"
                            aria-label={`Loading page ${pg}`}
                            style={{
                              width: Math.round(naturalPageSize.width * effectiveScale),
                              height: Math.round(naturalPageSize.height * effectiveScale),
                              background: 'var(--color-bg-secondary)',
                            }}
                          />
                        ) : undefined
                      }
                    />
                    )}
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
                      {/* Live preview – shown while the user is actively dragging */}
                      {previewSelection?.page === pg &&
                        previewSelection.rects?.map((r, i) => (
                          <div
                            key={`preview-${i}`}
                            className="absolute dark:mix-blend-screen mix-blend-multiply"
                            style={{
                              left: `${r.left * 100}%`,
                              top: `${r.top * 100}%`,
                              width: `${r.width * 100}%`,
                              height: `${r.height * 100}%`,
                              backgroundColor: chosenColor,
                              opacity: 0.4,
                            }}
                          />
                        ))}
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
            );
          })}
        </Document>

        {/* Floating recolor toolbar – shown after a highlight is saved */}
        {selection && pendingRecolorId && (
          <HighlightToolbar
            selection={selection}
            chosenColor={chosenColor}
            onColorChange={handleRecolor}
            onDismiss={dismissSelection}
            containerRef={containerRef}
          />
        )}
      </div>
    </div>
  );
}
