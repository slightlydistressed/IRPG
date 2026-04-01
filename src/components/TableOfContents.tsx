import React, { useEffect, useState, useCallback } from 'react';
import { BookmarkPlus, BookmarkMinus, ChevronRight, ChevronDown } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import { useApp } from '../context/AppContext';
import type { TOCItem } from '../types';

/** Minimal shape of a pdfjs-dist RefProxy needed for getPageIndex */
interface PdfRef {
  num: number;
  gen: number;
}

interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
}

function flattenOutline(
  nodes: OutlineNode[],
  level: number,
  pageResolver: (dest: string | unknown[] | null) => Promise<number>,
): Promise<TOCItem[]> {
  return Promise.all(
    nodes.map(async (node) => {
      const page = await pageResolver(node.dest);
      const children = node.items?.length
        ? await flattenOutline(node.items, level + 1, pageResolver)
        : undefined;
      return { title: node.title, page, level, items: children };
    }),
  );
}

/** Maps IRPG (PMS 461) top-level section titles to their CSS-variable accent colour.
 *  The PDF outline uses ALL-CAPS titles with colour hints in parentheses, so we
 *  match by uppercased keyword rather than exact string. */
function getIrpgSectionColorVar(title: string): string | undefined {
  const t = title.toUpperCase();
  if (t.includes('OPERATIONAL ENGAGEMENT')) return 'var(--toc-color-operational)';
  if (t.includes('SPECIFIC HAZARD'))        return 'var(--toc-color-hazards)';
  if (t.includes('FIRE ENVIRONMENT'))       return 'var(--toc-color-fire)';
  if (t.includes('ALL HAZARD'))             return 'var(--toc-color-allhazards)';
  if (t.includes('EMERGENCY MEDICAL'))      return 'var(--toc-color-medical)';
  if (t.includes('AVIATION'))              return 'var(--toc-color-aviation)';
  if (t.includes('OTHER REFERENCE'))       return 'var(--toc-color-references)';
  return undefined;
}

/** Strips the "(... pages)" annotation from IRPG section headings and
 *  converts ALL-CAPS titles to Title Case for a cleaner display. */
function cleanSectionTitle(title: string): string {
  const stripped = title.replace(/\s*\([^)]*pages\)/i, '').trim();
  if (stripped === stripped.toUpperCase() && stripped.length > 1) {
    return stripped.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return stripped;
}

function TOCNode({
  item,
  depth = 0,
  pageLabels,
  sectionColor,
}: {
  item: TOCItem;
  depth?: number;
  pageLabels: string[] | null;
  sectionColor?: string;
}) {
  const { setCurrentPage, addBookmark, removeBookmark, isBookmarked, bookmarks, setSidebarOpen } =
    useApp();
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = item.items && item.items.length > 0;
  const bookmarked = isBookmarked(item.page);

  // Resolve the display label for this item's page (e.g. "i", "A-1" or "42").
  const displayLabel = pageLabels?.[item.page - 1] ?? String(item.page);

  // Depth-0 items that match a known IRPG section title define a colour zone
  // for all their descendants.  Other items inherit whatever was passed in.
  const colorForChildren =
    depth === 0
      ? (getIrpgSectionColorVar(item.title) ?? sectionColor)
      : sectionColor;

  const handleNavigate = () => {
    setCurrentPage(item.page);
    // On mobile (bottom-sheet), close the sidebar so the PDF is immediately visible.
    if (window.innerWidth < 640) setSidebarOpen(false);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmarked) {
      const bm = bookmarks.find((b) => b.page === item.page);
      if (bm) removeBookmark(bm.id);
    } else {
      addBookmark(item.title, item.page);
    }
  };

  return (
    <div>
      {depth === 0 ? (
        /* ── Section heading (depth 0) ─────────────────────────────────── */
        <div className="mt-5 first:mt-2">
          <div
            className="group flex items-center gap-2 px-4 pb-2 cursor-pointer"
            onClick={hasChildren ? () => setOpen(!open) : handleNavigate}
          >
            {hasChildren && (
              <button
                className="shrink-0 text-[var(--color-text-muted)]"
                aria-label={open ? 'Collapse' : 'Expand'}
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              >
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
            )}

            <span className="flex-1 text-2xl font-bold text-[var(--color-text)] leading-tight">
              {cleanSectionTitle(item.title)}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); handleBookmark(e); }}
              className={`shrink-0 transition-opacity ${bookmarked ? 'text-yellow-500' : 'text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100'}`}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark this section'}
            >
              {bookmarked ? <BookmarkMinus size={15} /> : <BookmarkPlus size={15} />}
            </button>
          </div>

          {hasChildren && open && (
            <div className="mb-3">
              {item.items!.map((child, i) => (
                <TOCNode key={i} item={child} depth={depth + 1} pageLabels={pageLabels} sectionColor={colorForChildren} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Colored card item (depth ≥ 1) ─────────────────────────────── */
        <div>
          <div
            className={`toc-item group flex items-center gap-3 rounded-2xl cursor-pointer transition-colors mx-3 mb-2 px-4 py-3.5 ${
              sectionColor
                ? 'hover:opacity-90'
                : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:bg-[var(--color-accent)]/10'
            }`}
            style={sectionColor ? { backgroundColor: sectionColor } : undefined}
          >
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                className="shrink-0 text-[var(--color-text-muted)]"
                aria-label={open ? 'Collapse' : 'Expand'}
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}

            <button
              className="flex-1 text-left text-sm leading-snug text-[var(--color-text)] py-0.5"
              onClick={handleNavigate}
              title={`${item.title} – page ${displayLabel}`}
            >
              {item.title} ({displayLabel})
            </button>

            <button
              onClick={handleBookmark}
              className={`shrink-0 transition-opacity ${bookmarked ? 'text-yellow-500' : 'text-[var(--color-text-muted)] opacity-40 group-hover:opacity-100'}`}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark this section'}
            >
              {bookmarked ? <BookmarkMinus size={15} /> : <BookmarkPlus size={15} />}
            </button>

            {!hasChildren && (
              <ChevronRight size={15} className="shrink-0 text-[var(--color-text-muted)] opacity-40 group-hover:opacity-100 transition-opacity" aria-hidden />
            )}
          </div>

          {hasChildren && open && (
            <div>
              {item.items!.map((child, i) => (
                <TOCNode key={i} item={child} depth={depth + 1} pageLabels={pageLabels} sectionColor={colorForChildren} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TableOfContents() {
  const { pdfFile, bookmarks, setCurrentPage, removeBookmark } = useApp();
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLabels, setPageLabels] = useState<string[] | null>(null);

  const loadOutline = useCallback(async () => {
    if (!pdfFile) {
      setTocItems([]);
      setPageLabels(null);
      return;
    }
    setLoading(true);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const [outline, labels] = await Promise.all([
        pdf.getOutline(),
        pdf.getPageLabels().catch(() => null),
      ]);

      setPageLabels(labels && labels.length > 0 ? labels : null);

      if (!outline || outline.length === 0) {
        setTocItems([]);
        setLoading(false);
        return;
      }

      const resolver = async (dest: string | unknown[] | null): Promise<number> => {
        if (!dest) return 1;
        try {
          let destArray: unknown[];
          if (typeof dest === 'string') {
            destArray = await pdf.getDestination(dest) as unknown[];
          } else {
            destArray = dest as unknown[];
          }
          if (!destArray || !destArray[0]) return 1;
          const ref = destArray[0];
          if (
            !ref ||
            typeof ref !== 'object' ||
            !('num' in ref) ||
            !('gen' in ref)
          ) {
            return 1;
          }
          const pageIndex = await pdf.getPageIndex(ref as PdfRef);
          return pageIndex + 1;
        } catch {
          return 1;
        }
      };

      const items = await flattenOutline(
        outline as OutlineNode[],
        0,
        resolver,
      );
      setTocItems(items);
    } catch (err) {
      console.error('Failed to load TOC:', err);
      setTocItems([]);
    } finally {
      setLoading(false);
    }
  }, [pdfFile]);

  useEffect(() => {
    loadOutline();
  }, [loadOutline]);

  if (!pdfFile) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">
        Open a PDF to see the table of contents.
      </div>
    );
  }

  return (
    <div>
      {/* Bookmarks section */}
      {bookmarks.length > 0 && (
        <div className="border-b border-[var(--color-border)]">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Bookmarks
          </div>
          {bookmarks.map((bm) => {
            const bmLabel = pageLabels?.[bm.page - 1] ?? String(bm.page);
            return (
              <div
                key={bm.id}
                className="flex items-center gap-1 px-3 py-1 hover:bg-[var(--color-accent)]/10 rounded transition-colors"
              >
                <button
                  className="flex-1 text-left text-sm text-[var(--color-text)] truncate py-0.5"
                  onClick={() => setCurrentPage(bm.page)}
                >
                  📌 {bm.title}
                </button>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0 mr-1">
                  {bmLabel}
                </span>
                <button
                  onClick={() => removeBookmark(bm.id)}
                  className="text-[var(--color-text-muted)] hover:text-red-500 shrink-0"
                  title="Remove bookmark"
                >
                  <BookmarkMinus size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* TOC section */}
      {loading ? (
        <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">
          Loading contents…
        </div>
      ) : tocItems.length === 0 ? (
        <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">
          No table of contents found in this PDF.
          <br />
          <span className="text-xs mt-1 block">
            Use bookmarks to save pages you visit.
          </span>
        </div>
      ) : (
        <div className="py-1">
          {tocItems.map((item, i) => (
            <TOCNode key={i} item={item} depth={0} pageLabels={pageLabels} />
          ))}
        </div>
      )}
    </div>
  );
}
