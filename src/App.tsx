import { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PDFViewer from './components/PDFViewer';
import MobileNav from './components/MobileNav';

/**
 * Listens for `irpg-storage-full` (localStorage quota exceeded) and
 * `irpg-app-warning` (general app warnings dispatched as CustomEvents)
 * and shows a dismissible banner so users are never silently left with
 * unsaved data or failed operations.
 */
function AppWarningBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onStorageFull = () =>
      setMessage(
        'Storage is full — your latest changes could not be saved. ' +
          'Free up browser storage to continue.',
      );
    const onAppWarning = (e: Event) =>
      setMessage((e as CustomEvent<string>).detail);

    window.addEventListener('irpg-storage-full', onStorageFull);
    window.addEventListener('irpg-app-warning', onAppWarning);
    return () => {
      window.removeEventListener('irpg-storage-full', onStorageFull);
      window.removeEventListener('irpg-app-warning', onAppWarning);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="app-warning-banner"
    >
      <span>{message}</span>
      <button
        onClick={() => setMessage(null)}
        className="app-warning-dismiss"
        aria-label="Dismiss warning"
      >
        ×
      </button>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <Header />
        <AppWarningBanner />
        <div className="app-body">
          <Sidebar />
          <main className="main-content">
            <PDFViewer />
          </main>
        </div>
        <MobileNav />
      </div>
    </AppProvider>
  );
}

export default App;
