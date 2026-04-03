import React, { useRef, useState, useLayoutEffect } from 'react';
import { Highlighter, X } from 'lucide-react';
import { HIGHLIGHT_COLORS, type SelectionState } from '@/types';

interface HighlightToolbarProps {
  selection: SelectionState;
  chosenColor: string;
  /** Called when the user picks a new colour for the just-saved highlight. */
  onColorChange: (color: string) => void;
  onDismiss: () => void;
  /** The scrollable PDF container – used for clamping the toolbar position. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Minimum gap (px) between the toolbar edge and the container edge. */
const TOOLBAR_MARGIN = 8;

/**
 * Floating toolbar that appears after a highlight is saved.
 *
 * Shows a row of colour swatches so the user can immediately recolour the
 * highlight that was just created.  Pointer events are stopped at this element
 * so the PDF container's pointer handlers are not triggered during toolbar
 * interactions.
 */
export default function HighlightToolbar({
  selection,
  chosenColor,
  onColorChange,
  onDismiss,
  containerRef,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
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
  }, [selection, containerRef]);

  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={toolbarRef}
      className="highlight-toolbar absolute z-20 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl p-2"
      style={{
        left: pos.left,
        top: pos.top,
        visibility: pos.visible ? 'visible' : 'hidden',
        maxWidth: `calc(100% - ${TOOLBAR_MARGIN * 2}px)`,
        minWidth: 'fit-content',
      }}
      onPointerDown={stopPointer}
      onPointerUp={stopPointer}
    >
      <div className="flex items-center gap-2">
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
            aria-label={`Recolor highlight in ${c.label}`}
            aria-pressed={chosenColor === c.value}
          />
        ))}

        <button
          onClick={onDismiss}
          className="btn-icon text-[var(--color-text-muted)]"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
