import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
  QAPair,
  Theme,
  SidebarTab,
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

  // Q&A
  qaPairs: QAPair[];
  updateAnswer: (id: string, answer: string) => void;
  addQAPair: (question: string, page?: number) => void;
  removeQAPair: (id: string) => void;
  setQAPairs: (pairs: QAPair[]) => void;

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

  const [theme, setTheme] = useLocalStorage<Theme>('irpg-theme', 'light');

  // Per-document persisted state ──────────────────────────────────────────
  const [highlights, setHighlights] = useDocStorage<Highlight[]>(documentId, 'highlights', []);
  const [bookmarks, setBookmarks] = useDocStorage<Bookmark[]>(documentId, 'bookmarks', []);
  const [qaPairs, setQAPairs] = useDocStorage<QAPair[]>(documentId, 'qa', []);
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
    setPdfFileState(file);
    setPdfName(file ? file.name : '');
    // Assign a new documentId so per-document hooks load the correct storage
    // slot for this file.  The bundled PDF keeps BUILTIN_DOC_ID (see
    // auto-load effect below).
    setDocumentId(file ? getDocumentId(file) : BUILTIN_DOC_ID);
    setNumPages(0);
    // Persist the uploaded file in IndexedDB so it can be restored on reload.
    if (file) {
      savePdfToIdb(file).catch((err) =>
        console.error('Could not save PDF to IndexedDB:', err),
      );
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
    const loadBundled = () =>
      fetchBundledPdf()
        .then((file) => {
          setPdfFileState(file);
          setPdfName('irpg.pdf');
          // documentId stays BUILTIN_DOC_ID (its initial value)
        })
        .catch((err) => console.error('Could not auto-load irpg.pdf:', err))
        .finally(() => setPdfLoading(false));

    loadPdfFromIdb()
      .then((savedFile) => {
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
      .catch(() => loadBundled()); // IDB unavailable – fall back to bundled PDF
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

  // Q&A
  const updateAnswer = useCallback(
    (id: string, answer: string) => {
      setQAPairs((prev) =>
        prev.map((qa) => (qa.id === id ? { ...qa, answer } : qa)),
      );
    },
    [setQAPairs],
  );

  const addQAPair = useCallback(
    (question: string, page?: number) => {
      const newPair: QAPair = {
        id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        question,
        answer: '',
        page,
      };
      setQAPairs((prev) => [...prev, newPair]);
    },
    [setQAPairs],
  );

  const removeQAPair = useCallback(
    (id: string) => {
      setQAPairs((prev) => prev.filter((qa) => qa.id !== id));
    },
    [setQAPairs],
  );

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
        qaPairs,
        updateAnswer,
        addQAPair,
        removeQAPair,
        setQAPairs,
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
