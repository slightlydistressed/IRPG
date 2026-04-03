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
  getUploadedPdfMeta,
} from '../utils/pdfStorage';
import type {
  Highlight,
  Bookmark,
  Theme,
  SidebarTab,
  FormValues,
  ReadingMode,
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
  // View / navigation
  /** Whether the app is showing the home/library screen or the reader. */
  view: 'home' | 'reader';
  /** Switch to the home/library screen (keeps any loaded PDF in memory). */
  goHome: () => void;
  /** Switch to the reader screen. */
  openReader: () => void;
  /** Load and open the bundled IRPG PDF in the reader. */
  openBuiltinIrpg: () => void;
  /** Load and open the saved uploaded PDF from IndexedDB in the reader. */
  openSavedPdf: () => void;
  /**
   * Remove the saved uploaded PDF from IndexedDB.
   * If it was the currently loaded document, clears pdfFile too.
   */
  removeSavedPdf: () => void;
  /**
   * Filename of the PDF currently stored in IndexedDB, or null if none.
   * Independent of which PDF is currently loaded – shows what can be reopened.
   */
  savedUploadedName: string | null;

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
  readingMode: ReadingMode;
  setReadingMode: (mode: ReadingMode) => void;

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

  // Navigation
  /** Scrolls to the given page even if currentPage is already set to that value. */
  scrollToPage: (page: number) => void;
  scrollKey: number;

  // Backup / restore
  /**
   * Bulk-restores reader state from a previously exported backup.
   * All fields are optional; only provided values are applied.
   */
  restoreDocumentData: (data: {
    highlights?: Highlight[];
    bookmarks?: Bookmark[];
    formValues?: FormValues;
    currentPage?: number;
    scale?: number;
  }) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<'home' | 'reader'>('home');
  const [savedUploadedName, setSavedUploadedName] = useState<string | null>(null);

  const [pdfFile, setPdfFileState] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfName, setPdfName] = useState('');
  const [numPages, setNumPages] = useState(0);
  // Default to the View/Layout panel rather than Contents.
  // On desktop, start with the sidebar open; on mobile, start closed.
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('view');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 641);
  const [scrollKey, setScrollKey] = useState(0);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  // documentId scopes all per-document storage.  Starts as the bundled PDF's
  // stable ID; changes when the user uploads a different file.
  const [documentId, setDocumentId] = useState<string>(BUILTIN_DOC_ID);

  const [theme, setTheme] = useLocalStorage<Theme>('irpg-theme', 'light');

  // Per-document persisted state ──────────────────────────────────────────
  const [highlights, setHighlights] = useDocStorage<Highlight[]>(documentId, 'highlights', []);
  const [bookmarks, setBookmarks] = useDocStorage<Bookmark[]>(documentId, 'bookmarks', []);
  const [formValues, setFormValues] = useDocStorage<FormValues>(documentId, 'forms', {});
  const [currentPage, setCurrentPage] = useDocStorage<number>(documentId, 'page', 1);
  const [scale, setScale] = useDocStorage<number>(documentId, 'scale', 1.2);
  // Default reading mode: 2P on wide desktop screens, scroll on narrow / mobile.
  // This only applies when there is no persisted value for the document.
  const [readingMode, setReadingMode] = useDocStorage<ReadingMode>(documentId, 'readingMode', window.innerWidth >= 1000 ? '2p' : 'scroll');

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

  // On first mount: check IndexedDB metadata so the home screen can show
  // whether a saved PDF is available to reopen, without loading the blob yet.
  useEffect(() => {
    getUploadedPdfMeta()
      .then((meta) => {
        if (meta) setSavedUploadedName(meta.name);
      })
      .catch(() => {}); // IDB unavailable – fine, just won't show saved option
  }, []); // intentionally empty – runs once on mount

  const goHome = useCallback(() => setView('home'), []);
  const openReader = useCallback(() => setView('reader'), []);

  /** Load the bundled IRPG PDF and switch to the reader. */
  const openBuiltinIrpg = useCallback(() => {
    setPdfLoading(true);
    fetchBundledPdf()
      .then((file) => {
        setPdfFileState(file);
        setPdfName('irpg.pdf');
        setDocumentId(BUILTIN_DOC_ID);
        setNumPages(0);
        setView('reader');
      })
      .catch((err) => console.error('Could not load irpg.pdf:', err))
      .finally(() => setPdfLoading(false));
  }, []);

  /** Load the last saved uploaded PDF from IndexedDB and switch to the reader. */
  const openSavedPdf = useCallback(() => {
    setPdfLoading(true);
    loadPdfFromIdb()
      .then((file) => {
        if (!file) return;
        setPdfFileState(file);
        setPdfName(file.name);
        setDocumentId(getDocumentId(file));
        setNumPages(0);
        setView('reader');
      })
      .catch((err) => console.error('Could not load saved PDF:', err))
      .finally(() => setPdfLoading(false));
  }, []);

  /**
   * Remove the saved PDF from IndexedDB.
   * If it was the currently loaded document, clears pdfFile and returns to
   * home.  Otherwise just clears the saved name so the home card disappears.
   */
  const removeSavedPdf = useCallback(() => {
    deletePdfFromIdb().catch((err) =>
      console.error('Could not delete PDF from IndexedDB:', err),
    );
    setSavedUploadedName(null);
    if (documentId !== BUILTIN_DOC_ID) {
      // The uploaded PDF was the active document – clear it and go home.
      setPdfFileState(null);
      setPdfName('');
      setDocumentId(BUILTIN_DOC_ID);
      setNumPages(0);
      setView('home');
    }
  }, [documentId]);

  const setPdfFile = useCallback((file: File | null) => {
    setPdfFileState(file);
    setPdfName(file ? file.name : '');
    setDocumentId(file ? getDocumentId(file) : BUILTIN_DOC_ID);
    setNumPages(0);
    if (file) {
      // Track the saved name so the home screen knows what's in IDB.
      setSavedUploadedName(file.name);
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

  const restoreDocumentData = useCallback(
    (data: {
      highlights?: Highlight[];
      bookmarks?: Bookmark[];
      formValues?: FormValues;
      currentPage?: number;
      scale?: number;
    }) => {
      if (data.highlights !== undefined) setHighlights(data.highlights);
      if (data.bookmarks !== undefined) setBookmarks(data.bookmarks);
      if (data.formValues !== undefined) setFormValues(data.formValues);
      if (data.scale !== undefined) setScale(data.scale);
      if (data.currentPage !== undefined) scrollToPage(data.currentPage);
    },
    [setHighlights, setBookmarks, setFormValues, setScale, scrollToPage],
  );

  return (
    <AppContext.Provider
      value={{
        view,
        goHome,
        openReader,
        openBuiltinIrpg,
        openSavedPdf,
        removeSavedPdf,
        savedUploadedName,
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
        readingMode,
        setReadingMode,
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
        restoreDocumentData,
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
