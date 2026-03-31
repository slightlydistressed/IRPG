import React, { useRef } from 'react';
import {
  BookOpen,
  Upload,
  FileText,
  Trash2,
  ArrowRight,
  Loader2,
  Moon,
  Sun,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function HomeView() {
  const {
    theme,
    toggleTheme,
    pdfFile,
    pdfName,
    pdfLoading,
    savedUploadedName,
    isUploadedPdf,
    openReader,
    openBuiltinIrpg,
    openSavedPdf,
    removeSavedPdf,
    setPdfFile,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdfMime = file.type === 'application/pdf';
      const isUnknownType = !file.type;
      const hasPdfExtension = /\.pdf$/i.test(file.name);

      if (!isPdfMime && !isUnknownType && !hasPdfExtension) {
        window.dispatchEvent(
          new CustomEvent('irpg-app-warning', {
            detail: `"${file.name}" is not a PDF file. Please select a valid PDF.`,
          }),
        );
        e.target.value = '';
        return;
      }

      setPdfFile(file);
      openReader();
    }
    e.target.value = '';
  };

  // Whether there is a different document already open in the reader
  // (i.e. the user came back to home mid-session).
  const hasOpenDocument = pdfFile !== null;

  return (
    <div className="home-view">
      {/* Top bar */}
      <header className="home-topbar">
        <div className="flex items-center gap-2.5 text-white font-semibold text-sm tracking-tight">
          <BookOpen size={19} className="shrink-0 opacity-90" />
          <span>IRPG Reader</span>
        </div>
        <button
          onClick={toggleTheme}
          className="btn-icon text-white/75 hover:text-white"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark/light mode"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Scrollable main area */}
      <div className="home-scroll">
        <main className="home-main">
          {/* Hero */}
          <div className="home-hero">
            <h1 className="home-title">Your Field Library</h1>
            <p className="home-subtitle">
              Open the built-in IRPG, reopen a saved PDF, or upload your own document.
            </p>
          </div>

          {/* Continue reading – shown when a document is already open */}
          {hasOpenDocument && (
            <section className="home-section">
              <h2 className="home-section-label">Currently open</h2>
              <button
                className="home-continue-card"
                onClick={openReader}
                aria-label={`Continue reading ${pdfName}`}
              >
                <div className="home-continue-icon">
                  <FileText size={22} />
                </div>
                <div className="home-continue-text">
                  <span className="home-continue-name">{pdfName}</span>
                  {isUploadedPdf && (
                    <span className="home-badge">Your upload</span>
                  )}
                </div>
                <ArrowRight size={18} className="text-[var(--color-accent)] shrink-0" />
              </button>
            </section>
          )}

          {/* Library */}
          <section className="home-section">
            <h2 className="home-section-label">Library</h2>

            <div className="home-card-list">
              {/* Built-in IRPG */}
              <div className="home-doc-card">
                <div className="home-doc-icon home-doc-icon--builtin">
                  <BookOpen size={20} />
                </div>
                <div className="home-doc-info">
                  <p className="home-doc-name">IRPG Field Operations Guide</p>
                  <p className="home-doc-meta">Interagency Wildland Firefighter Reference · Built-in</p>
                </div>
                <button
                  className="btn-primary btn-sm shrink-0"
                  onClick={openBuiltinIrpg}
                  disabled={pdfLoading}
                  aria-label="Open IRPG Field Operations Guide"
                >
                  {pdfLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    'Open'
                  )}
                </button>
              </div>

              {/* Saved uploaded PDF */}
              {savedUploadedName && (
                <div className="home-doc-card">
                  <div className="home-doc-icon home-doc-icon--upload">
                    <HardDrive size={20} />
                  </div>
                  <div className="home-doc-info">
                    <p className="home-doc-name">{savedUploadedName}</p>
                    <p className="home-doc-meta">Saved on this device · local only</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="btn-primary btn-sm"
                      onClick={openSavedPdf}
                      disabled={pdfLoading}
                      aria-label={`Reopen ${savedUploadedName}`}
                    >
                      {pdfLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        'Open'
                      )}
                    </button>
                    <button
                      className="btn-icon text-[var(--color-text-muted)] hover:text-red-500"
                      onClick={removeSavedPdf}
                      title={`Remove ${savedUploadedName} from local storage`}
                      aria-label={`Remove ${savedUploadedName} from local storage`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Upload a new PDF */}
          <section className="home-section">
            <h2 className="home-section-label">Upload</h2>
            <button
              className="home-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload a PDF file"
            >
              <Upload size={20} className="shrink-0" />
              <span>Open a PDF from your device</span>
            </button>
            <p className="home-upload-hint">
              Your PDF will be saved locally so you can reopen it after a reload.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload PDF"
            />
          </section>
        </main>
      </div>
    </div>
  );
}
