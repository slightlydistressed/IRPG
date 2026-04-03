import { useState, useMemo, useCallback } from 'react';
import {
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Copy,
  Eraser,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HIGHLIGHT_COLORS, DESKTOP_MIN_WIDTH } from '../types';
import { copyTextToClipboard, colorLabel } from '../utils/exportUtils';

type SortKey = 'newest' | 'oldest' | 'page-asc' | 'page-desc';

export default function HighlightPanel() {
  const {
    highlights,
    removeHighlight,
    updateHighlightNote,
    updateHighlightColor,
    clearAllHighlights,
    selectedHighlightId,
    setSelectedHighlightId,
    setSidebarOpen,
  } = useApp();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: string; value: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    let list = [...highlights];

    if (colorFilter) {
      list = list.filter((h) => h.color === colorFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          h.text.toLowerCase().includes(q) ||
          h.note.toLowerCase().includes(q),
      );
    }

    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case 'page-asc':
        list.sort((a, b) => a.page - b.page);
        break;
      case 'page-desc':
        list.sort((a, b) => b.page - a.page);
        break;
      default: // newest
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    return list;
  }, [highlights, colorFilter, search, sortBy]);

  const handleExport = useCallback(() => {
    if (filtered.length === 0) return;
    const lines = filtered.map((h) => {
      const color =
        HIGHLIGHT_COLORS.find((c) => c.value === h.color)?.label ?? h.color;
      let line = `[Page ${h.page}] [${color}] "${h.text}"`;
      if (h.note) line += `\n  Note: ${h.note}`;
      return line;
    });
    const text = lines.join('\n\n');

    copyTextToClipboard(text).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  }, [filtered]);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Delete all highlights? This cannot be undone.')) {
      clearAllHighlights();
    }
  }, [clearAllHighlights]);

  if (highlights.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">
        No highlights yet.
        <br />
        <span className="text-xs mt-1 block">
          Select text in the PDF, then click&nbsp;
          <strong>Highlight</strong> in the popup.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* ── Toolbar ── */}
      <div className="px-2 pt-2 pb-1.5 flex flex-col gap-1.5 border-b border-[var(--color-border)]">
        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
          />
          <input
            type="text"
            className="input-base w-full text-xs pl-6 pr-6 py-1"
            placeholder="Search highlights…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search highlights"
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sort + Color filter */}
        <div className="flex items-center gap-1.5">
          <select
            className="input-base text-xs py-0.5 px-1.5 flex-1 min-w-0"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            title="Sort highlights"
            aria-label="Sort highlights"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="page-asc">Page ↑</option>
            <option value="page-desc">Page ↓</option>
          </select>

          {/* Color filter dots */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setColorFilter(null)}
              className={`w-4 h-4 rounded-full border-2 text-[9px] flex items-center justify-center transition-transform ${
                !colorFilter
                  ? 'border-[var(--color-accent)] scale-125'
                  : 'border-[var(--color-border)] hover:scale-110'
              }`}
              style={{ backgroundColor: 'var(--color-bg)' }}
              title="All colors"
              aria-label="Show all colors"
              aria-pressed={!colorFilter}
            >
              ✦
            </button>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() =>
                  setColorFilter(colorFilter === c.value ? null : c.value)
                }
                className={`w-4 h-4 rounded-full border-2 transition-transform ${
                  colorFilter === c.value
                    ? 'border-[var(--color-accent)] scale-125'
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
                aria-label={`Filter by ${c.label}`}
                aria-pressed={colorFilter === c.value}
              />
            ))}
          </div>
        </div>

        {/* Count + actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            {filtered.length !== highlights.length
              ? `${filtered.length} of ${highlights.length}`
              : `${highlights.length}`}{' '}
            highlight{highlights.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className={`transition-colors disabled:opacity-40 ${
                copied
                  ? 'text-green-500'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
              }`}
              title={copied ? 'Copied to clipboard!' : 'Copy highlights to clipboard'}
              aria-label={copied ? 'Copied to clipboard' : 'Copy highlights to clipboard'}
            >
              <Copy size={13} />
            </button>
            <button
              onClick={handleClearAll}
              className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
              title="Delete all highlights"
              aria-label="Delete all highlights"
            >
              <Eraser size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── List ── */}
      <div className="p-2 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
            No highlights match your filter.
          </p>
        ) : (
          filtered.map((h) => (
            <div
              key={h.id}
              className={`rounded-lg border overflow-hidden transition-colors ${
                selectedHighlightId === h.id
                  ? 'border-[var(--color-accent)]'
                  : 'border-[var(--color-border)]'
              }`}
            >
              {/* Main row */}
              <div className="flex items-start gap-2 p-2">
                {/* Color swatch */}
                <div
                  className="w-3 h-full min-h-[2rem] rounded-sm shrink-0 mt-0.5"
                  style={{ backgroundColor: h.color }}
                />

                {/* Text + meta */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    setSelectedHighlightId(h.id);
                    if (window.innerWidth < DESKTOP_MIN_WIDTH) setSidebarOpen(false);
                  }}
                >
                  <p className="text-sm line-clamp-3 text-[var(--color-text)] leading-snug">
                    "{h.text}"
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Page {h.page}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: h.color + '66',
                        color: 'var(--color-text)',
                      }}
                    >
                      {colorLabel(h.color)}
                    </span>
                  </div>
                  {h.note && (
                    <p className="text-xs text-[var(--color-text-muted)] italic truncate mt-0.5 flex items-center gap-1">
                      <FileText size={10} className="shrink-0" />
                      {h.note}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    onClick={() => removeHighlight(h.id)}
                    className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                    title="Delete highlight"
                    aria-label="Delete highlight"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === h.id ? null : h.id)
                    }
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                    title="Notes & color"
                    aria-label="Toggle notes and color picker"
                    aria-expanded={expandedId === h.id}
                  >
                    {expandedId === h.id ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded: color picker + note */}
              {expandedId === h.id && (
                <div className="border-t border-[var(--color-border)] p-2 bg-[var(--color-bg-secondary)]">
                  {/* Color re-picker */}
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                      Color:
                    </span>
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateHighlightColor(h.id, c.value)}
                        className={`w-4 h-4 rounded-full border-2 transition-transform ${
                          h.color === c.value
                            ? 'border-[var(--color-accent)] scale-125'
                            : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                        aria-label={c.label}
                        aria-pressed={h.color === c.value}
                      />
                    ))}
                  </div>

                  {/* Note */}
                  <div className="flex items-center gap-1 mb-1 text-xs text-[var(--color-text-muted)]">
                    <FileText size={12} />
                    Note
                  </div>
                  {editingNote?.id === h.id ? (
                    <div className="flex flex-col gap-1">
                      <textarea
                        className="input-base w-full text-xs resize-none"
                        rows={3}
                        value={editingNote.value}
                        onChange={(e) =>
                          setEditingNote({ id: h.id, value: e.target.value })
                        }
                        autoFocus
                      />
                      <div className="flex gap-1 justify-end">
                        <button
                          className="btn-sm"
                          onClick={() => {
                            updateHighlightNote(h.id, editingNote.value);
                            setEditingNote(null);
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="btn-sm btn-ghost"
                          onClick={() => setEditingNote(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="text-xs text-[var(--color-text)] cursor-pointer hover:underline min-h-[1.5rem]"
                      onClick={() =>
                        setEditingNote({ id: h.id, value: h.note })
                      }
                    >
                      {h.note || (
                        <span className="text-[var(--color-text-muted)] italic">
                          Click to add a note…
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
