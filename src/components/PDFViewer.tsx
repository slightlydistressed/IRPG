import {
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HIGHLIGHT_COLORS } from '../types';
import type { HighlightRect } from '../types';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface SelectionState {
  text: string;
  page: number;
  x: number;
  y: number;
  rects: HighlightRect[];
}

/** Walk the DOM to find the page number attribute */
/** Tags that should not trigger keyboard shortcuts (focus is on interactive element) */
const INTERACTIVE_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'A', 'BUTTON'];

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
    setSidebarTab,
    setSidebarOpen,
    setQAPairs,
    qaPairs,
    pdfName,
    scrollKey,
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [chosenColor, setChosenColor] = useState<string>(HIGHLIGHT_COLORS[0].value);
  const [pageInputValue, setPageInputValue] = useState('');
  const [isEditingPage, setIsEditingPage] = useState(false);

  const onDocumentLoadSuccess = useCallback(
    async ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);

      // Extract questions from the PDF text
      if (pdfFile && qaPairs.length === 0) {
        try {
          const { getDocument } = await import('pdfjs-dist');
          const ab = await pdfFile.arrayBuffer();
          const pdf = await getDocument({ data: ab }).promise;
          const allQuestions: { question: string; page: number }[] = [];
          // Limit extraction to first 50 pages to avoid blocking the UI
          const pagesToScan = Math.min(n, 50);

          for (let i = 1; i <= pagesToScan; i++) {
            const page = await pdf.getPage(i);
            const tc = await page.getTextContent();
            const text = tc.items
              .filter((it) => 'str' in it)
              .map((it) => (it as { str: string }).str)
              .join(' ');

            // Match sentences ending in ?
            const matches = text.match(/[^.!?]*\?/g) ?? [];
            matches.forEach((m) => {
              const q = m.trim();
              if (q.length > 10 && q.length < 500) {
                allQuestions.push({ question: q, page: i });
              }
            });
          }

          if (allQuestions.length > 0) {
            setQAPairs(
              allQuestions.map(({ question, page }, idx) => ({
                id: `qa-pdf-${idx}-${Date.now()}`,
                question,
                answer: '',
                page,
              })),
            );
          }
        } catch (err) {
          console.error('Question extraction failed:', err);
        }
      }
    },
    [setNumPages, pdfFile, qaPairs.length, setQAPairs],
  );

  // Handle text selection – capture bounding rects relative to the page element
  // so highlight overlays render correctly at any zoom level.
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    const page = getPageFromNode(sel.anchorNode);
    if (!page) return;

    const range = sel.getRangeAt(0);
    const selRect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Build normalised rects (fraction of page dimensions) for the overlay divs.
    const pageEl = containerRef.current?.querySelector<HTMLElement>(
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

    // Account for scroll offset so the floating toolbar appears above the selection
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    setSelection({
      text,
      page,
      x: selRect.left - containerRect.left + selRect.width / 2,
      y: selRect.top - containerRect.top + scrollTop - 8,
      rects,
    });
  }, []);

  const handleHighlight = useCallback(() => {
    if (!selection) return;
    addHighlight({
      text: selection.text,
      page: selection.page,
      color: chosenColor,
      note: '',
      rects: selection.rects,
    });
    // Open the sidebar on the Highlights tab so the user can see the new entry
    setSidebarOpen(true);
    setSidebarTab('highlights');
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, chosenColor, addHighlight, setSidebarTab, setSidebarOpen]);

  const dismissSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  // Scroll to page when currentPage changes or when a force-scroll is requested
  useEffect(() => {
    const el = pageRefs.current.get(currentPage);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // scrollKey intentionally forces a re-run even when currentPage hasn't changed
  }, [currentPage, scrollKey]);

  // Track visible page via IntersectionObserver
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return;
    const observers: IntersectionObserver[] = [];

    pageRefs.current.forEach((el, pg) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setCurrentPage(pg);
        },
        { threshold: 0.5, root: containerRef.current },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [numPages, setCurrentPage]);

  // Keyboard shortcuts: ArrowLeft/Right and PageUp/Down for page navigation
  // Only fires when focus is not on an interactive element to avoid conflicts.
  useEffect(() => {
    if (!pdfFile || numPages === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (INTERACTIVE_TAGS.includes(tag)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage(Math.max(1, currentPage - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPage(Math.min(numPages, currentPage + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfFile, numPages, currentPage, setCurrentPage]);

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
            <li>Q&amp;A section with Word export</li>
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
      <div className="viewer-toolbar flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            className="btn-icon"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            title="Previous page (←)"
          >
            <ChevronLeft size={18} />
          </button>
          {isEditingPage ? (
            <input
              type="number"
              className="input-base text-sm font-mono text-center min-w-[60px] max-w-[60px] px-1 py-0.5"
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
              className="text-sm font-mono text-[var(--color-text)] min-w-[80px] text-center hover:bg-[var(--color-border)]/40 rounded px-1 py-0.5 transition-colors"
              onClick={handleStartPageEdit}
              title="Click to jump to a page"
            >
              {currentPage} / {numPages}
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            title="Next page (→)"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        <div className="flex items-center gap-1">
          <button
            className="btn-icon"
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            disabled={scale <= 0.5}
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm font-mono text-[var(--color-text)] min-w-[52px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="btn-icon"
            onClick={() => setScale(Math.min(3, scale + 0.1))}
            disabled={scale >= 3}
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setScale(1.2)}
            title="Reset zoom"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        <div className="flex items-center gap-1">
          <Highlighter size={14} className="text-[var(--color-text-muted)]" />
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
      </div>

      {/* PDF pages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto pdf-container relative select-text"
        onMouseUp={handleMouseUp}
      >
        <Document
          file={pdfFile}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
              Loading PDF…
            </div>
          }
          error={
            <div className="flex items-center justify-center h-64 text-red-500">
              Failed to load PDF. Please try another file.
            </div>
          }
          className="flex flex-col items-center gap-4 py-4"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
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
                scale={scale}
                renderTextLayer
                renderAnnotationLayer
              />
              {/* Highlight overlays – rendered as absolutely positioned divs so they
                  work reliably regardless of how react-pdf splits text into spans. */}
              {highlights
                .filter((h) => h.page === pg && h.rects && h.rects.length > 0)
                .flatMap((h) =>
                  h.rects!.map((r, i) => (
                    <div
                      key={`${h.id}-${i}`}
                      className="absolute pointer-events-none dark:mix-blend-screen mix-blend-multiply"
                      style={{
                        left: `${r.left * 100}%`,
                        top: `${r.top * 100}%`,
                        width: `${r.width * 100}%`,
                        height: `${r.height * 100}%`,
                        backgroundColor: h.color,
                        opacity: 0.55,
                      }}
                    />
                  )),
                )}
            </div>
          ))}
        </Document>

        {/* Floating highlight toolbar */}
        {selection && (
          <div
            className="absolute z-20 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl p-2 flex items-center gap-2"
            style={{
              left: `${Math.max(0, selection.x - 80)}px`,
              top: `${Math.max(0, selection.y - 60)}px`,
            }}
          >
            <Highlighter size={14} className="text-[var(--color-text-muted)]" />
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setChosenColor(c.value)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  chosenColor === c.value
                    ? 'border-[var(--color-accent)] scale-125'
                    : 'border-[var(--color-border)] hover:scale-110'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
            <button
              onClick={handleHighlight}
              className="btn-primary btn-sm ml-1 flex items-center gap-1"
            >
              <Highlighter size={12} />
              Highlight
            </button>
            <button
              onClick={dismissSelection}
              className="btn-icon text-[var(--color-text-muted)]"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
