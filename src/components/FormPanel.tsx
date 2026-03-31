import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, Calendar, Copy, FileDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { IRPG_FORMS } from '../data/irpgForms';
import { BUILTIN_DOC_ID } from '../utils/docStorage';
import {
  copyReaderSessionToClipboard,
  exportReaderSessionDocx,
} from '../utils/exportUtils';
import type { FormSchema, FormField, DeviceAction } from '../types';

// ── Device action helpers ─────────────────────────────────────────────────

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getNowString(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function triggerDeviceAction(
  action: DeviceAction,
  onResult: (value: string) => void,
  onError: (msg: string) => void,
) {
  switch (action.type) {
    case 'currentDate':
      onResult(getTodayString());
      break;
    case 'currentTime':
      onResult(getNowString());
      break;
    case 'geolocation':
      if (!navigator.geolocation) {
        onError('Geolocation is not supported by this browser.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          onResult(
            `${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`,
          );
        },
        (err) => {
          const messages: Record<number, string> = {
            1: 'Location permission denied.',
            2: 'Location unavailable.',
            3: 'Location request timed out.',
          };
          onError(messages[err.code] ?? 'Geolocation failed.');
        },
        { timeout: 10000 },
      );
      break;
  }
}

function deviceActionIcon(action: DeviceAction) {
  switch (action.type) {
    case 'geolocation':
      return <MapPin size={12} />;
    case 'currentDate':
      return <Calendar size={12} />;
    case 'currentTime':
      return <Clock size={12} />;
  }
}

// ── Field renderer ─────────────────────────────────────────────────────────

interface FieldRendererProps {
  formId: string;
  field: FormField;
  value: string;
  onChange: (key: string, value: string) => void;
}

function FieldRenderer({ formId, field, value, onChange }: FieldRendererProps) {
  const fieldKey = `${formId}|${field.id}`;
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleDeviceAction = useCallback(() => {
    if (!field.deviceAction) return;
    setPending(true);
    setDeviceError(null);
    triggerDeviceAction(
      field.deviceAction,
      (v) => {
        onChange(fieldKey, v);
        setPending(false);
      },
      (msg) => {
        setDeviceError(msg);
        setPending(false);
      },
    );
  }, [field.deviceAction, fieldKey, onChange]);

  const inputClass =
    'input-base w-full text-sm';

  // Single checkbox
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="accent-[var(--color-accent)]"
          checked={value === 'true'}
          onChange={(e) => onChange(fieldKey, e.target.checked ? 'true' : '')}
        />
        <span className="text-sm text-[var(--color-text)]">{field.label}</span>
      </label>
    );
  }

  // All other field types (text, textarea, richText, date, time, number)
  const inputElement =
    field.type === 'textarea' || field.type === 'richText' ? (
      <textarea
        className={`${inputClass} resize-none`}
        rows={3}
        placeholder={field.placeholder ?? ''}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        aria-label={field.label}
      />
    ) : (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
        className={inputClass}
        placeholder={field.placeholder ?? ''}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        aria-label={field.label}
      />
    );

  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text)] mb-1">
        {field.label}
      </label>
      {field.deviceAction ? (
        <div className="flex gap-1.5">
          <div className="flex-1 min-w-0">{inputElement}</div>
          <button
            type="button"
            className="btn-secondary btn-sm flex items-center gap-1 shrink-0 whitespace-nowrap"
            onClick={handleDeviceAction}
            disabled={pending}
            title={field.deviceAction.buttonLabel}
            aria-label={field.deviceAction.buttonLabel}
          >
            {deviceActionIcon(field.deviceAction)}
            {pending ? '…' : field.deviceAction.buttonLabel}
          </button>
        </div>
      ) : (
        inputElement
      )}
      {deviceError && (
        <p className="text-xs text-red-500 mt-1">{deviceError}</p>
      )}
    </div>
  );
}

// ── Checklist-aware field value lookup ─────────────────────────────────────
/**
 * For a checklist field, each option has its own storage key.
 * This wrapper resolves the correct value for the FieldRenderer,
 * which for checklist options is keyed by `formId|fieldId|idx`.
 */
interface ChecklistOptionProps {
  formId: string;
  fieldId: string;
  label: string;
  index: number;
  options: string[];
  formValues: Record<string, string>;
  setFormValue: (key: string, value: string) => void;
}

function ChecklistField({
  formId,
  fieldId,
  label,
  options,
  formValues,
  setFormValue,
}: Omit<ChecklistOptionProps, 'index'>) {
  return (
    <fieldset className="border-none p-0 m-0">
      <legend className="text-xs font-medium text-[var(--color-text)] mb-1.5">
        {label}
      </legend>
      <div className="flex flex-col gap-1.5">
        {options.map((opt, idx) => {
          const optKey = `${formId}|${fieldId}|${idx}`;
          return (
            <label key={idx} className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 accent-[var(--color-accent)]"
                checked={formValues[optKey] === 'true'}
                onChange={(e) =>
                  setFormValue(optKey, e.target.checked ? 'true' : '')
                }
              />
              <span className="text-sm text-[var(--color-text)] leading-snug group-hover:text-[var(--color-accent)]">
                {opt}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── Form renderer ──────────────────────────────────────────────────────────

interface FormRendererProps {
  form: FormSchema;
  formValues: Record<string, string>;
  setFormValue: (key: string, value: string) => void;
  onBack: () => void;
  onJumpToPage: (page: number) => void;
}

function FormRenderer({
  form,
  formValues,
  setFormValue,
  onBack,
  onJumpToPage,
}: FormRendererProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] shrink-0">
        <button
          onClick={onBack}
          className="btn-icon shrink-0"
          aria-label="Back to forms list"
          title="Back to forms list"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-[var(--color-text)] truncate">
            {form.title}
          </h2>
          {form.relatedPage && (
            <button
              className="text-xs text-[var(--color-accent)] hover:underline"
              onClick={() => onJumpToPage(form.relatedPage!)}
            >
              IRPG p.{form.relatedPage} ↗
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {form.description && (
        <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] shrink-0">
          {form.description}
        </div>
      )}

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-5">
        {form.sections.map((section) => (
          <div key={section.id}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-2.5">
              {section.title}
            </h3>
            <div className="flex flex-col gap-3">
              {section.fields.map((field) => {
                if (field.type === 'checklist' && field.options) {
                  return (
                    <ChecklistField
                      key={field.id}
                      formId={form.id}
                      fieldId={field.id}
                      label={field.label}
                      options={field.options}
                      formValues={formValues}
                      setFormValue={setFormValue}
                    />
                  );
                }
                return (
                  <FieldRenderer
                    key={field.id}
                    formId={form.id}
                    field={field}
                    value={formValues[`${form.id}|${field.id}`] ?? ''}
                    onChange={setFormValue}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Form list ──────────────────────────────────────────────────────────────

interface FormListProps {
  forms: FormSchema[];
  onSelect: (form: FormSchema) => void;
  onJumpToPage: (page: number) => void;
}

function FormList({ forms, onSelect, onJumpToPage }: FormListProps) {
  if (forms.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">
        No forms available for this document.
      </div>
    );
  }
  return (
    <div className="p-2 flex flex-col gap-2">
      {forms.map((form) => (
        <div
          key={form.id}
          className="rounded-lg border border-[var(--color-border)] overflow-hidden"
        >
          <button
            className="w-full flex items-start gap-2 p-3 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
            onClick={() => onSelect(form)}
          >
            <ChevronRight
              size={14}
              className="mt-0.5 text-[var(--color-accent)] shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {form.title}
              </p>
              {form.description && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                  {form.description}
                </p>
              )}
            </div>
          </button>
          {form.relatedPage && (
            <div className="px-3 pb-2">
              <button
                className="text-xs text-[var(--color-accent)] hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToPage(form.relatedPage!);
                }}
              >
                IRPG p.{form.relatedPage} ↗
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main FormPanel ─────────────────────────────────────────────────────────

export default function FormPanel() {
  const {
    documentId,
    formValues,
    setFormValue,
    scrollToPage,
    setSidebarOpen,
    pdfName,
    highlights,
    bookmarks,
  } = useApp();

  const [selectedForm, setSelectedForm] = useState<FormSchema | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isBuiltin = documentId === BUILTIN_DOC_ID;

  // For uploaded PDFs show only non-irpgOnly forms; for builtin show all.
  const availableForms = IRPG_FORMS.filter(
    (f) => !f.irpgOnly || isBuiltin,
  );

  const handleJumpToPage = useCallback(
    (page: number) => {
      scrollToPage(page);
      // On mobile, close sidebar so the PDF is visible
      if (window.innerWidth < 640) setSidebarOpen(false);
    },
    [scrollToPage, setSidebarOpen],
  );

  const handleCopy = useCallback(async () => {
    const ok = await copyReaderSessionToClipboard({
      pdfName,
      forms: availableForms,
      formValues,
      highlights,
      bookmarks,
    });
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [pdfName, availableForms, formValues, highlights, bookmarks]);

  const handleDocx = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportReaderSessionDocx({
        pdfName,
        forms: availableForms,
        formValues,
        highlights,
        bookmarks,
      });
    } finally {
      setExporting(false);
    }
  }, [pdfName, availableForms, formValues, highlights, bookmarks, exporting]);

  if (selectedForm) {
    return (
      <FormRenderer
        form={selectedForm}
        formValues={formValues}
        setFormValue={setFormValue}
        onBack={() => setSelectedForm(null)}
        onJumpToPage={handleJumpToPage}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)] shrink-0 flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)] flex-1 min-w-0">
          {isBuiltin
            ? 'IRPG forms and checklists'
            : 'Available forms for this document'}
        </p>
        {/* Export actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className={`btn-icon transition-colors ${
              copied
                ? 'text-green-500'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
            }`}
            title={copied ? 'Copied to clipboard!' : 'Copy session to clipboard'}
            aria-label={copied ? 'Copied to clipboard' : 'Copy session to clipboard'}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={handleDocx}
            disabled={exporting}
            className="btn-icon text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-40"
            title="Export session as .docx"
            aria-label="Export session as .docx"
          >
            <FileDown size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <FormList
          forms={availableForms}
          onSelect={setSelectedForm}
          onJumpToPage={handleJumpToPage}
        />
      </div>
    </div>
  );
}
