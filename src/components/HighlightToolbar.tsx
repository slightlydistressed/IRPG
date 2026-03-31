import React, { useRef, useState, useLayoutEffect } from 'react';
import { Highlighter, X, FileText } from 'lucide-react';
import { HIGHLIGHT_COLORS } from '../types';
import type { SelectionState } from '../types';

interface HighlightToolbarProps {
  selection: SelectionState;
  chosenColor: string;
  onColorChange: (color: string) => void;
  /**
   * Called when the user confirms the highlight (step 2).
   * Receives the note text (may be empty) and the snapshotted selection
   * captured at the moment the user clicked "Highlight" in step 1.
   */
  onHighlight: (note: string, snapshotted: SelectionState) => void;
  onDismiss: () => void;
  /** The scrollable PDF container – used for clamping the toolbar position. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Minimum gap (px) between the toolbar edge and the container edge. */
const TOOLBAR_MARGIN = 8;

/**
 * Floating two-step toolbar that appears after the user makes a text selection.
 *
 * Step 1 ("pick"): choose a highlight colour and confirm with "Highlight".
 * Step 2 ("note"): optionally type a note, then "Save" or "Skip".
 *
 * Position is clamped inside the scrollable container via `useLayoutEffect` so
 * the toolbar never appears offscreen.  Pointer events are stopped at this
 * element to prevent the PDF container's `onPointerUp` handler from
 * re-capturing or dismissing the selection during toolbar interactions.
 */
export default function HighlightToolbar({
  selection,
  chosenColor,
  onColorChange,
  onHighlight,
  onDismiss,
  containerRef,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; visible: boolean }>({
    left: -9999,
    top: -9999,
    visible: false,
  });
  // Two-step flow: 'pick' (colour + confirm) → 'note' (optional note entry)
  const [step, setStep] = useState<'pick' | 'note'>('pick');
  const [note, setNote] = useState('');
  // Snapshot the selection when the user clicks "Highlight" in step 1 so it
  // remains available in step 2 even if the textarea's autoFocus clears the
  // browser's native selection and causes PDFViewer to null out its state.
  const snapshotRef = useRef<SelectionState>(selection);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const container = containerRef.current;
    if (!toolbar || !container) return;

    const tw = toolbar.offsetWidth;
    const th = toolbar.offsetHeight;
    const cw = container.clientWidth;

    const left = Math.max(
      TOOLBAR_MARGIN,
      Math.min(selection.x - tw / 2, cw - tw - TOOLBAR_MARGIN),
    );

    const spaceAbove = selection.yTop - container.scrollTop;
    const top =
      spaceAbove >= th + TOOLBAR_MARGIN
        ? selection.yTop - th - TOOLBAR_MARGIN
        : selection.yBottom + TOOLBAR_MARGIN;

    setPos({ left, top, visible: true });
  // step is included so the position recalculates when the toolbar grows for the note input
  }, [selection, containerRef, step]);

  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

  const handleHighlightClick = () => {
    // Snapshot the selection NOW before the textarea steals focus and the
    // browser collapses the native selection (which would null out the parent's
    // `selection` state via the selectionchange listener).
    snapshotRef.current = selection;
    setStep('note');
    setNote('');
  };

  return (
    <div
      ref={toolbarRef}
      className="highlight-toolbar absolute z-20 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl p-2"
      style={{
        left: pos.left,
        top: pos.top,
        visibility: pos.visible ? 'visible' : 'hidden',
        maxWidth: `calc(100% - ${TOOLBAR_MARGIN * 2}px)`,
        minWidth: '220px',
      }}
      onPointerDown={stopPointer}
      onPointerUp={stopPointer}
    >
      {step === 'pick' ? (
        /* ── Step 1: colour picker + Highlight button ── */
        <div className="flex items-center gap-2 flex-wrap">
          <Highlighter size={14} className="text-[var(--color-text-muted)] shrink-0" />

          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                chosenColor === c.value
                  ? 'border-[var(--color-accent)] scale-125'
                  : 'border-[var(--color-border)] hover:scale-110'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
              aria-label={`Highlight in ${c.label}`}
              aria-pressed={chosenColor === c.value}
            />
          ))}

          <button
            onClick={handleHighlightClick}
            className="btn-primary btn-sm flex items-center gap-1.5 ml-1"
          >
            <Highlighter size={12} />
            <span>Highlight</span>
          </button>

          <button
            onClick={onDismiss}
            className="btn-icon text-[var(--color-text-muted)]"
            aria-label="Dismiss selection"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        /* ── Step 2: optional note entry ── */
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <FileText size={12} />
            <span>Add a note (optional)</span>
          </div>

          <textarea
            className="input-base text-xs resize-none w-full"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type a note…"
            autoFocus
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter to save; Escape to skip
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                onHighlight(note.trim(), snapshotRef.current);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onHighlight('', snapshotRef.current);
              }
            }}
          />

          <div className="flex gap-1 justify-end">
            <button
              onClick={() => onHighlight(note.trim(), snapshotRef.current)}
              className="btn-primary btn-sm"
            >
              Save
            </button>
            <button
              onClick={() => onHighlight('', snapshotRef.current)}
              className="btn-ghost btn-sm"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
