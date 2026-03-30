import { useState, useCallback } from 'react';
import { docKey } from '../utils/docStorage';

/**
 * Like `useLocalStorage` but scoped to a specific document ID.
 *
 * When `docId` changes (the user opens a different PDF), the hook
 * automatically reloads its value from the new per-document storage key so
 * each PDF gets its own independent state.
 *
 * Uses React's "derived state update during render" pattern – we store the
 * active key alongside the value so we can detect key changes and reload
 * synchronously without needing a `useEffect`.
 */
export function useDocStorage<T>(
  docId: string,
  suffix: string,
  initialValue: T,
) {
  const key = docKey(docId, suffix);

  // Co-locate key and value in state so a key change is detected during render.
  const [state, setState] = useState<{ key: string; value: T }>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return { key, value: item !== null ? (JSON.parse(item) as T) : initialValue };
    } catch {
      return { key, value: initialValue };
    }
  });

  // When docId changes the key changes.  Reload from the new storage slot
  // synchronously during the render pass (React's "derived state" pattern –
  // React immediately re-renders with the updated state, no effect needed).
  if (state.key !== key) {
    let newValue: T;
    try {
      const item = window.localStorage.getItem(key);
      newValue = item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      newValue = initialValue;
    }
    setState({ key, value: newValue });
  }

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setState((prev) => {
          const valueToStore = value instanceof Function ? value(prev.value) : value;
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          return { key, value: valueToStore };
        });
      } catch (error) {
        console.error('localStorage error:', error);
      }
    },
    [key],
  );

  return [state.value, setValue] as const;
}
