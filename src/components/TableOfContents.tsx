import React, { useEffect, useState, useCallback } from 'react';
import { BookmarkPlus, BookmarkMinus, ChevronRight, ChevronDown } from 'lucide-react';
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

function TOCNode({
  item,
  depth = 0,
}: {
  item: TOCItem;
  depth?: number;
}) {
  const { setCurrentPage, addBookmark, removeBookmark, isBookmarked, bookmarks } =
    useApp();
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = item.items && item.items.length > 0;
  const bookmarked = isBookmarked(item.page);

  const handleNavigate = () => {
    setCurrentPage(item.page);
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
      <div
        className={`toc-item group flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-[var(--color-accent)]/10 transition-colors`}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setOpen(!open)}
            className="shrink-0 text-[var(--color-text-muted)]"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <button
          className="flex-1 text-left text-sm leading-snug truncate text-[var(--color-text)] py-0.5"
          onClick={handleNavigate}
          title={`${item.title} – page ${item.page}`}
        >
          {item.title}
        </button>

        <span className="text-xs text-[var(--color-text-muted)] shrink-0 mr-1">
          {item.page}
        </span>

        <button
          onClick={handleBookmark}
          className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${bookmarked ? '!opacity-100 text-yellow-500' : 'text-[var(--color-text-muted)]'}`}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark this section'}
        >
          {bookmarked ? (
            <BookmarkMinus size={14} />
          ) : (
            <BookmarkPlus size={14} />
          )}
        </button>
      </div>

      {hasChildren && open && (
        <div>
          {item.items!.map((child, i) => (
            <TOCNode key={i} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TableOfContents() {
  const { pdfFile, bookmarks, setCurrentPage, removeBookmark } = useApp();
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOutline = useCallback(async () => {
    if (!pdfFile) {
      setTocItems([]);
      return;
    }
    setLoading(true);
    try {
      const { getDocument } = await import('pdfjs-dist');
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      const outline = await pdf.getOutline();

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
          {bookmarks.map((bm) => (
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
                {bm.page}
              </span>
              <button
                onClick={() => removeBookmark(bm.id)}
                className="text-[var(--color-text-muted)] hover:text-red-500 shrink-0"
                title="Remove bookmark"
              >
                <BookmarkMinus size={14} />
              </button>
            </div>
          ))}
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
            <TOCNode key={i} item={item} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
