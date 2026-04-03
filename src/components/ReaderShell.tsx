import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import IconRail from './IconRail';
import Sidebar from './Sidebar';
import PDFViewer from './PDFViewer';
import MobileNav from './MobileNav';

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
    <div role="alert" className="app-warning-banner">
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

/**
 * The reader workspace shell.
 *
 * Desktop (≥ 641 px): three-column layout
 *   [icon rail 48 px] [secondary panel, when open] [main PDF area]
 *
 * Mobile (≤ 640 px): stacked layout
 *   [main PDF area] [bottom nav bar]
 *   The sidebar slides up as a bottom sheet when a nav tab is active.
 */
export default function ReaderShell() {
  const { sidebarOpen } = useApp();

  return (
    <div className="app-shell">
      <AppWarningBanner />
      <div className="reader-workspace">
        {/* Left icon rail – desktop only */}
        <IconRail />

        {/* Secondary panel (contents, highlights, forms, bookmarks) */}
        <Sidebar />

        {/* Main content: PDF viewer */}
        <main
          className="main-content"
          aria-label="PDF reader"
          // Shift main content when the secondary panel is open on desktop
          data-panel-open={sidebarOpen ? 'true' : 'false'}
        >
          <PDFViewer />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
