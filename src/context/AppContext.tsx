import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDocStorage } from '../hooks/useDocStorage';
import {
  BUILTIN_DOC_ID,
  getDocumentId,
  migrateGlobalData,
} from '../utils/docStorage';
import {
  savePdfToIdb,
  loadPdfFromIdb,
  deletePdfFromIdb,
} from '../utils/pdfStorage';
import type {
  Highlight,
  Bookmark,
  Theme,
  SidebarTab,
  FormValues,
} from '../types';

// Migrate legacy single-bucket keys into per-document keys on first load.
// Runs once synchronously when the module is imported (before any render).
migrateGlobalData();

/** Fetch the bundled irpg.pdf and return it as a File object. */
function fetchBundledPdf(): Promise<File> {
  return fetch(import.meta.env.BASE_URL + 'irpg.pdf')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to fetch irpg.pdf');
      return res.blob();
    })
    .then((blob) => new File([blob], 'irpg.pdf', { type: 'application/pdf' }));
}

interface AppState {
  // PDF
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  pdfLoading: boolean;
  pdfName: string;
  /** Stable identifier for the currently open document. */
  documentId: string;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  numPages: number;
  setNumPages: (n: number) => void;
  scale: number;
  setScale: (s: number) => void;

  // UI
  theme: Theme;
  toggleTheme: () => void;
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Highlights
  highlights: Highlight[];
  addHighlight: (h: Omit<Highlight, 'id' | 'createdAt'>) => string;
  removeHighlight: (id: string) => void;
  updateHighlightNote: (id: string, note: string) => void;
  updateHighlightColor: (id: string, color: string) => void;
  clearAllHighlights: () => void;
  /** Ephemeral ID of the highlight that should appear focused in the PDF overlay. */
  selectedHighlightId: string | null;
  setSelectedHighlightId: (id: string | null) => void;

  // Bookmarks
  bookmarks: Bookmark[];
  addBookmark: (title: string, page: number) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (page: number) => boolean;

  // Forms / Checklists
  formValues: FormValues;
  setFormValue: (key: string, value: string) => void;
  clearFormValues: () => void;

  /** True when a user-uploaded PDF is active (not the bundled irpg.pdf). */
  isUploadedPdf: boolean;
  /** Clears the stored uploaded PDF from IndexedDB and reverts to the bundled IRPG PDF. */
  clearUploadedPdf: () => void;

  // Navigation
  /** Scrolls to the given page even if currentPage is already set to that value. */
  scrollToPage: (page: number) => void;
  scrollKey: number;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [pdfFile, setPdfFileState] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfName, setPdfName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('toc');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scrollKey, setScrollKey] = useState(0);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  // documentId scopes all per-document storage.  Starts as the bundled PDF's
  // stable ID; changes when the user uploads a different file.
  const [documentId, setDocumentId] = useState<string>(BUILTIN_DOC_ID);

  // Tracks whether the user has explicitly selected a PDF so the async
  // IndexedDB restore on mount does not overwrite a user-selected file if it
  // resolves after the user has already uploaded one.
  const userUploadedRef = useRef(false);

  const [theme, setTheme] = useLocalStorage<Theme>('irpg-theme', 'light');

  // Per-document persisted state ──────────────────────────────────────────
  const [highlights, setHighlights] = useDocStorage<Highlight[]>(documentId, 'highlights', []);
  const [bookmarks, setBookmarks] = useDocStorage<Bookmark[]>(documentId, 'bookmarks', []);
  const [formValues, setFormValues] = useDocStorage<FormValues>(documentId, 'forms', {});
  const [currentPage, setCurrentPage] = useDocStorage<number>(documentId, 'page', 1);
  const [scale, setScale] = useDocStorage<number>(documentId, 'scale', 1.2);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, [setTheme]);

  const setPdfFile = useCallback((file: File | null) => {
    // Mark that the user has explicitly selected a file so the async IndexedDB
    // restore on mount does not overwrite it if it resolves later.
    if (file) userUploadedRef.current = true;
    setPdfFileState(file);
    setPdfName(file ? file.name : '');
    // Assign a new documentId so per-document hooks load the correct storage
    // slot for this file.  The bundled PDF keeps BUILTIN_DOC_ID (see
    // auto-load effect below).
    setDocumentId(file ? getDocumentId(file) : BUILTIN_DOC_ID);
    setNumPages(0);
    // Persist the uploaded file in IndexedDB so it can be restored on reload.
    if (file) {
      // Warn the user when the file is large enough that some browsers may
      // refuse to store it in IndexedDB (typical quota: 50–150 MB).
      const MB = file.size / (1024 * 1024);
      if (MB > 50) {
        window.dispatchEvent(
          new CustomEvent('irpg-app-warning', {
            detail: `"${file.name}" is ${Math.round(MB)} MB. Large files may not be saved for offline use in all browsers.`,
          }),
        );
      }
      savePdfToIdb(file).catch((err) => {
        console.error('Could not save PDF to IndexedDB:', err);
        window.dispatchEvent(
          new CustomEvent('irpg-app-warning', {
            detail:
              'Your PDF could not be saved for offline use. It will be available for this session only.',
          }),
        );
      });
    }
  }, []);

  /** Clears the stored uploaded PDF and reverts to the bundled IRPG PDF. */
  const clearUploadedPdf = useCallback(() => {
    deletePdfFromIdb().catch((err) =>
      console.error('Could not delete PDF from IndexedDB:', err),
    );
    setPdfLoading(true);
    fetchBundledPdf()
      .then((file) => {
        setPdfFileState(file);
        setPdfName('irpg.pdf');
        setDocumentId(BUILTIN_DOC_ID);
        setNumPages(0);
      })
      .catch((err) => console.error('Could not reload irpg.pdf:', err))
      .finally(() => setPdfLoading(false));
  }, []);

  // On first mount: try to restore a previously saved upload from IndexedDB;
  // fall back to fetching the bundled irpg.pdf if nothing is stored.
  useEffect(() => {
    // `cancelled` is set to true when the effect is cleaned up (e.g. on
    // unmount in StrictMode).  `userUploadedRef` guards against the async
    // restore overwriting a file the user has already selected before the
    // IndexedDB read could resolve.
    let cancelled = false;

    const loadBundled = () =>
      fetchBundledPdf()
        .then((file) => {
          if (cancelled || userUploadedRef.current) return;
          setPdfFileState(file);
          setPdfName('irpg.pdf');
          // documentId stays BUILTIN_DOC_ID (its initial value)
        })
        .catch((err) => console.error('Could not auto-load irpg.pdf:', err))
        .finally(() => { if (!cancelled) setPdfLoading(false); });

    loadPdfFromIdb()
      .then((savedFile) => {
        if (cancelled || userUploadedRef.current) return;
        if (savedFile) {
          // Restore the previously uploaded PDF with its correct documentId.
          setPdfFileState(savedFile);
          setPdfName(savedFile.name);
          setDocumentId(getDocumentId(savedFile));
          setNumPages(0);
          setPdfLoading(false);
        } else {
          loadBundled();
        }
      })
      .catch(() => { if (!cancelled) loadBundled(); }); // IDB unavailable – fall back to bundled PDF

    return () => { cancelled = true; };
  }, []); // intentionally empty – runs once on mount

  // Highlights
  const addHighlight = useCallback(
    (h: Omit<Highlight, 'id' | 'createdAt'>): string => {
      const newHighlight: Highlight = {
        ...h,
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setHighlights((prev) => [newHighlight, ...prev]);
      return newHighlight.id;
    },
    [setHighlights],
  );

  const removeHighlight = useCallback(
    (id: string) => {
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    },
    [setHighlights],
  );

  const updateHighlightNote = useCallback(
    (id: string, note: string) => {
      setHighlights((prev) =>
        prev.map((h) => (h.id === id ? { ...h, note } : h)),
      );
    },
    [setHighlights],
  );

  const updateHighlightColor = useCallback(
    (id: string, color: string) => {
      setHighlights((prev) =>
        prev.map((h) => (h.id === id ? { ...h, color } : h)),
      );
    },
    [setHighlights],
  );

  const clearAllHighlights = useCallback(() => {
    setHighlights([]);
  }, [setHighlights]);

  // Bookmarks
  const addBookmark = useCallback(
    (title: string, page: number) => {
      const existing = bookmarks.find((b) => b.page === page);
      if (existing) return;
      const newBookmark: Bookmark = {
        id: `b-${Date.now()}`,
        title,
        page,
        createdAt: new Date().toISOString(),
      };
      setBookmarks((prev) => [...prev, newBookmark].sort((a, b) => a.page - b.page));
    },
    [bookmarks, setBookmarks],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    },
    [setBookmarks],
  );

  const isBookmarked = useCallback(
    (page: number) => bookmarks.some((b) => b.page === page),
    [bookmarks],
  );

  // Forms / Checklists
  const setFormValue = useCallback(
    (key: string, value: string) => {
      setFormValues((prev) => ({ ...prev, [key]: value }));
    },
    [setFormValues],
  );

  const clearFormValues = useCallback(() => {
    setFormValues({});
  }, [setFormValues]);

  const scrollToPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      setScrollKey((k) => k + 1);
    },
    [setCurrentPage],
  );

  return (
    <AppContext.Provider
      value={{
        pdfFile,
        setPdfFile,
        pdfLoading,
        pdfName,
        documentId,
        currentPage,
        setCurrentPage,
        numPages,
        setNumPages,
        scale,
        setScale,
        theme,
        toggleTheme,
        sidebarTab,
        setSidebarTab,
        sidebarOpen,
        setSidebarOpen,
        highlights,
        addHighlight,
        removeHighlight,
        updateHighlightNote,
        updateHighlightColor,
        clearAllHighlights,
        selectedHighlightId,
        setSelectedHighlightId,
        bookmarks,
        addBookmark,
        removeBookmark,
        isBookmarked,
        formValues,
        setFormValue,
        clearFormValues,
        scrollToPage,
        scrollKey,
        isUploadedPdf: documentId !== BUILTIN_DOC_ID,
        clearUploadedPdf,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
