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

/** Apply visual highlights to a rendered page's text layer */
function applyHighlightsToPage(
  container: HTMLElement,
  pageNumber: number,
  highlights: { id: string; text: string; page: number; color: string }[],
) {
  const textLayer = container.querySelector<HTMLElement>(
    `[data-page-number="${pageNumber}"] .react-pdf__Page__textContent`,
  );
  if (!textLayer) return;

  // Remove existing mark elements first (re-render safety)
  textLayer.querySelectorAll('mark[data-highlight-id]').forEach((m) => {
    const parent = m.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ''), m);
      parent.normalize();
    }
  });

  const pageHighlights = highlights.filter((h) => h.page === pageNumber);
  for (const h of pageHighlights) {
    const walker = document.createTreeWalker(
      textLayer,
      NodeFilter.SHOW_TEXT,
    );
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const txt = node.textContent ?? '';
      const idx = txt.indexOf(h.text);
      if (idx === -1) continue;
      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + h.text.length);
        const mark = document.createElement('mark');
        mark.style.backgroundColor = h.color;
        mark.style.color = 'inherit';
        mark.style.borderRadius = '2px';
        mark.dataset.highlightId = h.id;
        range.surroundContents(mark);
      } catch {
        // surroundContents can throw if range crosses elements
      }
      break;
    }
  }
}

export default function PDFViewer() {
  const {
    pdfFile,
    currentPage,
    setCurrentPage,
    numPages,
    setNumPages,
    scale,
    setScale,
    addHighlight,
    highlights,
    setSidebarTab,
    setQAPairs,
    qaPairs,
    pdfName,
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [chosenColor, setChosenColor] = useState<string>(HIGHLIGHT_COLORS[0].value);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  // Re-apply highlights whenever they change or new pages render
  useEffect(() => {
    if (!containerRef.current) return;
    renderedPages.forEach((pg) => {
      applyHighlightsToPage(containerRef.current!, pg, highlights);
    });
  }, [highlights, renderedPages]);

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

  // Handle text selection
  const handleMouseUp = useCallback(
    () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null);
        return;
      }

      const text = sel.toString().trim();
      const page = getPageFromNode(sel.anchorNode);
      if (!page) return;

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (!containerRect) return;

      setSelection({
        text,
        page,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
      });
    },
    [],
  );

  const handleHighlight = useCallback(() => {
    if (!selection) return;
    addHighlight({ text: selection.text, page: selection.page, color: chosenColor, note: '' });
    setSidebarTab('highlights');
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, chosenColor, addHighlight, setSidebarTab]);

  const dismissSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  const handlePageRenderSuccess = useCallback((pageNumber: number) => {
    setRenderedPages((prev) => {
      const next = new Set(prev);
      next.add(pageNumber);
      return next;
    });
  }, []);

  // Scroll to page when currentPage changes
  useEffect(() => {
    const el = pageRefs.current.get(currentPage);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

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

  if (!pdfFile) {
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
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-mono text-[var(--color-text)] min-w-[80px] text-center">
            {currentPage} / {numPages}
          </span>
          <button
            className="btn-icon"
            onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            title="Next page"
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
              className="shadow-lg"
            >
              <Page
                pageNumber={pg}
                scale={scale}
                renderTextLayer
                renderAnnotationLayer
                onRenderSuccess={() => handlePageRenderSuccess(pg)}
              />
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
