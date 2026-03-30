import { useState } from 'react';
import { Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HIGHLIGHT_COLORS } from '../types';

export default function HighlightPanel() {
  const { highlights, removeHighlight, updateHighlightNote, scrollToPage, setSidebarOpen } =
    useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: string; value: string } | null>(null);

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

  const colorLabel = (hex: string) =>
    HIGHLIGHT_COLORS.find((c) => c.value === hex)?.label ?? 'Custom';

  return (
    <div className="p-2 flex flex-col gap-2">
      <div className="text-xs text-[var(--color-text-muted)] px-1">
        {highlights.length} highlight{highlights.length !== 1 ? 's' : ''}
      </div>

      {highlights.map((h) => (
        <div
          key={h.id}
          className="rounded-lg border border-[var(--color-border)] overflow-hidden"
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
                scrollToPage(h.page);
                // On small screens the sidebar overlays the PDF – close it so the
                // highlighted passage is visible.
                if (window.innerWidth < 640) setSidebarOpen(false);
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
                  style={{ backgroundColor: h.color + '66', color: 'var(--color-text)' }}
                >
                  {colorLabel(h.color)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button
                onClick={() => removeHighlight(h.id)}
                className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                title="Delete highlight"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() =>
                  setExpandedId(expandedId === h.id ? null : h.id)
                }
                className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                title="Add/edit note"
              >
                {expandedId === h.id ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            </div>
          </div>

          {/* Note area */}
          {expandedId === h.id && (
            <div className="border-t border-[var(--color-border)] p-2 bg-[var(--color-bg-secondary)]">
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
                  onClick={() => setEditingNote({ id: h.id, value: h.note })}
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
      ))}
    </div>
  );
}
