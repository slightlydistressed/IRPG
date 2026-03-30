import React, { useRef, useState, useLayoutEffect } from 'react';
import { Highlighter, X } from 'lucide-react';
import { HIGHLIGHT_COLORS } from '../types';
import type { SelectionState } from '../types';

interface HighlightToolbarProps {
  selection: SelectionState;
  chosenColor: string;
  onColorChange: (color: string) => void;
  onHighlight: () => void;
  onDismiss: () => void;
  /** The scrollable PDF container – used for clamping the toolbar position. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Minimum gap (px) between the toolbar edge and the container edge. */
const TOOLBAR_MARGIN = 8;

/**
 * Floating toolbar that appears after the user makes a text selection in the
 * PDF viewer.  It measures its own rendered size with `useLayoutEffect` so it
 * can be clamped inside the visible container area regardless of screen size.
 *
 * Pointer events are stopped at this element so they do not bubble up to the
 * PDF container's `onPointerUp` handler (which would incorrectly re-capture or
 * dismiss the selection while the user is interacting with the toolbar).
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
  // Start offscreen + invisible so the first render can measure the toolbar
  // before it is shown.
  const [pos, setPos] = useState<{ left: number; top: number; visible: boolean }>({
    left: -9999,
    top: -9999,
    visible: false,
  });

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const container = containerRef.current;
    if (!toolbar || !container) return;

    const tw = toolbar.offsetWidth;
    const th = toolbar.offsetHeight;
    const cw = container.clientWidth;

    // Horizontally: centre over the selection midpoint, clamped to the
    // container's client width so the toolbar never extends offscreen.
    const left = Math.max(
      TOOLBAR_MARGIN,
      Math.min(selection.x - tw / 2, cw - tw - TOOLBAR_MARGIN),
    );

    // Vertically: place above the selection unless there is not enough room
    // between the selection's top and the current scroll position.
    const spaceAbove = selection.yTop - container.scrollTop;
    const top =
      spaceAbove >= th + TOOLBAR_MARGIN
        ? selection.yTop - th - TOOLBAR_MARGIN
        : selection.yBottom + TOOLBAR_MARGIN;

    setPos({ left, top, visible: true });
  }, [selection, containerRef]);

  // Prevent pointer events from reaching the PDF container so that the
  // container's `onPointerUp` handler does not re-capture or dismiss the
  // selection while the user interacts with toolbar controls.
  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={toolbarRef}
      className="highlight-toolbar absolute z-20 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl p-2 flex items-center gap-2 flex-wrap"
      style={{
        left: pos.left,
        top: pos.top,
        visibility: pos.visible ? 'visible' : 'hidden',
        // Never wider than the container minus its margins
        maxWidth: `calc(100% - ${TOOLBAR_MARGIN * 2}px)`,
      }}
      onPointerDown={stopPointer}
      onPointerUp={stopPointer}
    >
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
        onClick={onHighlight}
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
  );
}
