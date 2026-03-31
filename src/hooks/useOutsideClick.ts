import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Closes a popup/menu when the user clicks or touches outside `containerRef`
 * or presses the Escape key.
 *
 * Accepts an optional `restoreFocusRef` whose element receives focus after an
 * Escape dismissal, keeping keyboard navigation predictable.
 *
 * The listeners are only active while `isOpen` is true.
 *
 * @param containerRef    - ref attached to the popup container element
 * @param isOpen          - whether the popup is currently open
 * @param onClose         - called when an outside click or Escape is detected;
 *                          wrap in `useCallback` so the effect does not
 *                          re-register listeners on every render
 * @param restoreFocusRef - optional element to focus after Escape
 */
export function useOutsideClick(
  containerRef: RefObject<Element | null>,
  isOpen: boolean,
  onClose: () => void,
  restoreFocusRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!isOpen) return;

    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        restoreFocusRef?.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [containerRef, isOpen, onClose, restoreFocusRef]);
}
