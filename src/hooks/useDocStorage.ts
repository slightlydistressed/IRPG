import { useState, useCallback } from 'react';
import { docKey } from '../utils/docStorage';

/** Read a value from localStorage, returning `fallback` if absent or unreadable. */
function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = window.localStorage.getItem(key);
    return item !== null ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Like `useLocalStorage` but scoped to a specific document ID.
 *
 * When `docId` changes (the user opens a different PDF), the hook
 * automatically reloads its value from the new per-document storage key so
 * each PDF gets its own independent state.
 *
 * When the key changes, the current value is derived directly from
 * localStorage during the render (a pure read, no setState call) to keep
 * renders pure and avoid setState-during-render warnings in concurrent mode.
 * State is updated the next time `setValue` is called for the new document.
 */
export function useDocStorage<T>(
  docId: string,
  suffix: string,
  initialValue: T,
) {
  const key = docKey(docId, suffix);

  // Capture the initial value once so we have a stable fallback even when the
  // caller passes a new array/object literal on every render (e.g. `[]`).
  const [fallback] = useState<T>(() => initialValue);

  const [state, setState] = useState<{ key: string; value: T }>(() => ({
    key,
    value: readFromStorage(key, initialValue),
  }));

  // When the key changes (new document), derive the current value directly
  // from localStorage without calling setState during the render phase or
  // inside an effect. State will be updated the next time setValue is called.
  const currentValue: T =
    state.key === key ? state.value : readFromStorage(key, fallback);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setState((prev) => {
          // If state is stale (key changed before this setState ran), derive
          // the base value from the new key's storage slot.
          const baseValue: T =
            prev.key === key ? prev.value : readFromStorage(key, fallback);
          const valueToStore = value instanceof Function ? value(baseValue) : value;
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          return { key, value: valueToStore };
        });
      } catch (error) {
        console.error('localStorage error:', error);
      }
    },
    [key, fallback],
  );

  return [currentValue, setValue] as const;
}

