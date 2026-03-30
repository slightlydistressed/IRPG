import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type {
  Highlight,
  Bookmark,
  QAPair,
  Theme,
  SidebarTab,
} from '../types';

interface AppState {
  // PDF
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  pdfName: string;
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
  addHighlight: (h: Omit<Highlight, 'id' | 'createdAt'>) => void;
  removeHighlight: (id: string) => void;
  updateHighlightNote: (id: string, note: string) => void;

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
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [pdfFile, setPdfFileState] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('toc');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [theme, setTheme] = useLocalStorage<Theme>('irpg-theme', 'light');
  const [highlights, setHighlights] = useLocalStorage<Highlight[]>('irpg-highlights', []);
  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>('irpg-bookmarks', []);
  const [qaPairs, setQAPairs] = useLocalStorage<QAPair[]>('irpg-qa', []);

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
    setCurrentPage(1);
    setNumPages(0);
  }, []);

  // Highlights
  const addHighlight = useCallback(
    (h: Omit<Highlight, 'id' | 'createdAt'>) => {
      const newHighlight: Highlight = {
        ...h,
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setHighlights((prev) => [newHighlight, ...prev]);
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

  return (
    <AppContext.Provider
      value={{
        pdfFile,
        setPdfFile,
        pdfName,
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
        bookmarks,
        addBookmark,
        removeBookmark,
        isBookmarked,
        qaPairs,
        updateAnswer,
        addQAPair,
        removeQAPair,
        setQAPairs,
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
