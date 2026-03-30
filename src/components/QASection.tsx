import { useState } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Mail,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportToWord, openEmailClient } from '../utils/exportUtils';

/** Basic but RFC-aware email check: allows +, subdomains, and quoted local parts */
function isValidEmail(value: string): boolean {
  // Supports: user+tag@sub.domain.co.uk, "user name"@domain.com
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    value,
  );
}

function EmailModal({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSend = () => {
    if (!email.trim() || !isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    onSend(email.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-modal-title"
    >
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 id="email-modal-title" className="font-semibold text-[var(--color-text)]">
            Email Q&amp;A Answers
          </h3>
          <button onClick={onClose} className="btn-icon" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          This will open your email client with the Q&amp;A content ready to
          send.
        </p>

        <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
          Recipient email
        </label>
        <input
          type="email"
          className="input-base w-full mb-1"
          placeholder="recipient@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSend}
            className="btn-primary flex items-center gap-1.5 flex-1"
          >
            <Send size={14} />
            Open Email Client
          </button>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QASection() {
  const {
    qaPairs,
    updateAnswer,
    addQAPair,
    removeQAPair,
    setQAPairs,
    pdfName,
    pdfFile,
  } = useApp();

  const [newQuestion, setNewQuestion] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleAddQuestion = () => {
    const q = newQuestion.trim();
    if (!q) return;
    addQAPair(q);
    setNewQuestion('');
    setShowAddForm(false);
  };

  const handleClearAll = () => {
    if (window.confirm('Remove all questions? This cannot be undone.')) {
      setQAPairs([]);
    }
  };

  const handleExportWord = async () => {
    if (!pdfName) return;
    setExporting(true);
    try {
      await exportToWord(qaPairs, pdfName);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleEmail = (email: string) => {
    openEmailClient(email, qaPairs, pdfName || 'Document');
  };

  const answeredCount = qaPairs.filter((qa) => qa.answer.trim()).length;

  if (!pdfFile) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">
        Open a PDF to use the Q&amp;A feature.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-text-muted)]">
          {answeredCount}/{qaPairs.length} answered
        </span>
        <div className="flex items-center gap-1">
          {qaPairs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn-sm btn-ghost flex items-center gap-1 text-[var(--color-text-muted)] hover:text-red-500"
              title="Clear all questions"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-sm flex items-center gap-1"
            title="Add a question"
          >
            <Plus size={13} />
            Add
          </button>
        </div>
      </div>

      {/* Add question form */}
      {showAddForm && (
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <textarea
            className="input-base w-full text-sm resize-none"
            rows={3}
            placeholder="Type your question here…"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAddQuestion}
              className="btn-primary btn-sm flex-1"
            >
              Add Question
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewQuestion('');
              }}
              className="btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Q&A list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
        {qaPairs.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)] text-center py-6">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            No questions yet.
            <br />
            <span className="text-xs">
              Questions extracted from the PDF will appear here. You can also
              add questions manually.
            </span>
          </div>
        ) : (
          qaPairs.map((qa, idx) => (
            <div
              key={qa.id}
              className="rounded-lg border border-[var(--color-border)] overflow-hidden"
            >
              {/* Question */}
              <div className="flex items-start gap-2 p-3 bg-[var(--color-bg-secondary)]">
                <span className="text-xs font-bold text-[var(--color-accent)] shrink-0 mt-0.5">
                  Q{idx + 1}
                </span>
                <p className="flex-1 text-sm text-[var(--color-text)] leading-snug">
                  {qa.question}
                  {qa.page && (
                    <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                      (p.{qa.page})
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === qa.id ? null : qa.id)
                    }
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                    title="Toggle answer"
                    aria-label={expandedId === qa.id ? 'Collapse answer' : 'Expand answer'}
                    aria-expanded={expandedId === qa.id}
                  >
                    {expandedId === qa.id ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => removeQAPair(qa.id)}
                    className="text-[var(--color-text-muted)] hover:text-red-500"
                    title="Remove question"
                    aria-label="Remove question"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Answer (always shown but collapsible) */}
              {(expandedId === qa.id || qa.answer) && (
                <div className="p-3 border-t border-[var(--color-border)]">
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                    Your answer:
                  </label>
                  <textarea
                    className="input-base w-full text-sm resize-none"
                    rows={4}
                    placeholder="Type your answer here…"
                    value={qa.answer}
                    onChange={(e) => updateAnswer(qa.id, e.target.value)}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Export actions */}
      {qaPairs.length > 0 && (
        <div className="border-t border-[var(--color-border)] p-3 flex gap-2">
          <button
            onClick={handleExportWord}
            disabled={exporting}
            className="btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5"
            title="Export to Word document"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export Word'}
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1.5"
            title="Send via email"
          >
            <Mail size={14} />
            Email
          </button>
        </div>
      )}

      {showEmailModal && (
        <EmailModal
          onClose={() => setShowEmailModal(false)}
          onSend={handleEmail}
        />
      )}
    </div>
  );
}
