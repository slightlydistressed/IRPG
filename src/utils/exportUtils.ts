/**
 * exportUtils.ts
 *
 * Reader session export helpers.
 *
 * Replaces the former Q&A-specific export.  Functions here work with the
 * current document's filled forms/checklists, highlights, and bookmarks.
 *
 * The `docx` and `file-saver` packages are loaded lazily (dynamic import)
 * inside `exportReaderSessionDocx` so they do not increase the initial
 * bundle size.
 */

import type { Paragraph as DocxParagraph } from 'docx';
import { type Highlight, type Bookmark, type FormValues, type FormSchema, HIGHLIGHT_COLORS } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ExportPayload {
  pdfName: string;
  forms: FormSchema[];
  formValues: FormValues;
  highlights: Highlight[];
  bookmarks: Bookmark[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function colorLabel(hex: string): string {
  return HIGHLIGHT_COLORS.find((c) => c.value === hex)?.label ?? 'Custom';
}

function formatDate(): string {
  return new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Plain-text builder ─────────────────────────────────────────────────────

/**
 * Builds a human-readable plain-text summary of the current reader session:
 * filled form values, highlights, and bookmarks.
 */
export function buildReaderSessionText(payload: ExportPayload): string {
  const { pdfName, forms, formValues, highlights, bookmarks } = payload;
  const lines: string[] = [];

  lines.push(`IRPG Reader – Session Export`);
  lines.push(`Document: ${pdfName}`);
  lines.push(`Exported: ${formatDate()}`);
  lines.push('');

  // ── Forms / Checklists ──────────────────────────────────────────────────
  const filledForms = forms.filter((form) =>
    form.sections.some((sec) =>
      sec.fields.some((field) => {
        if (field.type === 'checklist' && field.options) {
          return field.options.some(
            (_, idx) => formValues[`${form.id}|${field.id}|${idx}`] === 'true',
          );
        }
        return Boolean(formValues[`${form.id}|${field.id}`]);
      }),
    ),
  );

  if (filledForms.length > 0) {
    lines.push('── Forms & Checklists ' + '─'.repeat(28));
    lines.push('');
    for (const form of filledForms) {
      lines.push(form.title.toUpperCase());
      if (form.description) lines.push(`  ${form.description}`);
      lines.push('');
      for (const sec of form.sections) {
        lines.push(`  ${sec.title}`);
        for (const field of sec.fields) {
          if (field.type === 'checklist' && field.options) {
            const checked = field.options.filter(
              (_, idx) =>
                formValues[`${form.id}|${field.id}|${idx}`] === 'true',
            );
            if (checked.length > 0) {
              lines.push(`    ${field.label}:`);
              checked.forEach((opt) => lines.push(`      ☑ ${opt}`));
            }
          } else if (field.type === 'checkbox') {
            const val = formValues[`${form.id}|${field.id}`];
            if (val === 'true') {
              lines.push(`    ☑ ${field.label}`);
            }
          } else {
            const val = formValues[`${form.id}|${field.id}`];
            if (val) {
              lines.push(`    ${field.label}: ${val}`);
            }
          }
        }
        lines.push('');
      }
    }
  } else {
    lines.push('── Forms & Checklists ' + '─'.repeat(28));
    lines.push('');
    lines.push('  (no form values filled)');
    lines.push('');
  }

  // ── Highlights ──────────────────────────────────────────────────────────
  lines.push('── Highlights ' + '─'.repeat(36));
  lines.push('');
  if (highlights.length === 0) {
    lines.push('  (no highlights)');
  } else {
    const sorted = [...highlights].sort((a, b) => a.page - b.page);
    for (const h of sorted) {
      lines.push(`  [Page ${h.page}] [${colorLabel(h.color)}] "${h.text}"`);
      if (h.note) lines.push(`    Note: ${h.note}`);
    }
  }
  lines.push('');

  // ── Bookmarks ───────────────────────────────────────────────────────────
  lines.push('── Bookmarks ' + '─'.repeat(37));
  lines.push('');
  if (bookmarks.length === 0) {
    lines.push('  (no bookmarks)');
  } else {
    const sorted = [...bookmarks].sort((a, b) => a.page - b.page);
    for (const bm of sorted) {
      lines.push(`  Page ${bm.page} – ${bm.title}`);
    }
  }

  return lines.join('\n');
}

// ── Clipboard copy ─────────────────────────────────────────────────────────

/**
 * Copies the given text to the clipboard.
 * Returns true on success, false on failure.
 *
 * Falls back to the legacy `execCommand` approach in non-secure or older
 * browser contexts where the Clipboard API is unavailable.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Legacy fallback
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Copies the session text to the clipboard. Returns true on success. */
export async function copyReaderSessionToClipboard(
  payload: ExportPayload,
): Promise<boolean> {
  return copyTextToClipboard(buildReaderSessionText(payload));
}

// ── .docx export ──────────────────────────────────────────────────────────

/**
 * Exports the reader session as a .docx file with structured sections for
 * filled forms, highlights, and bookmarks.
 *
 * `docx` and `file-saver` are loaded on-demand so they are not included in
 * the initial JS bundle.
 */
export async function exportReaderSessionDocx(
  payload: ExportPayload,
): Promise<void> {
  // Dynamic imports keep docx out of the initial bundle.
  const [
    { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer },
    { saveAs },
  ] = await Promise.all([import('docx'), import('file-saver')]);

  const { pdfName, forms, formValues, highlights, bookmarks } = payload;

  const children: DocxParagraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: `Session Export – ${pdfName}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Exported: ${formatDate()}`, italics: true, size: 18 }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
  );

  // Forms section
  children.push(
    new Paragraph({
      text: 'Forms & Checklists',
      heading: HeadingLevel.HEADING_2,
    }),
  );

  const filledForms = forms.filter((form) =>
    form.sections.some((sec) =>
      sec.fields.some((field) => {
        if (field.type === 'checklist' && field.options) {
          return field.options.some(
            (_, idx) => formValues[`${form.id}|${field.id}|${idx}`] === 'true',
          );
        }
        return Boolean(formValues[`${form.id}|${field.id}`]);
      }),
    ),
  );

  if (filledForms.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '(no form values filled)', italics: true })] }));
  } else {
    for (const form of filledForms) {
      children.push(
        new Paragraph({ text: form.title, heading: HeadingLevel.HEADING_3 }),
      );
      for (const sec of form.sections) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: sec.title, bold: true, size: 22 })],
          }),
        );
        for (const field of sec.fields) {
          if (field.type === 'checklist' && field.options) {
            const checked = field.options.filter(
              (_, idx) =>
                formValues[`${form.id}|${field.id}|${idx}`] === 'true',
            );
            if (checked.length > 0) {
              children.push(
                new Paragraph({ children: [new TextRun({ text: `${field.label}:`, bold: true })] }),
              );
              checked.forEach((opt) =>
                children.push(new Paragraph({ children: [new TextRun({ text: `  ☑ ${opt}` })], indent: { left: 360 } })),
              );
            }
          } else if (field.type === 'checkbox') {
            const val = formValues[`${form.id}|${field.id}`];
            if (val === 'true') {
              children.push(
                new Paragraph({ children: [new TextRun({ text: `☑ ${field.label}` })], indent: { left: 360 } }),
              );
            }
          } else {
            const val = formValues[`${form.id}|${field.id}`];
            if (val) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `${field.label}: `, bold: true }),
                    new TextRun({ text: val }),
                  ],
                  indent: { left: 360 },
                }),
              );
            }
          }
        }
        children.push(new Paragraph({ text: '' }));
      }
    }
  }

  children.push(new Paragraph({ text: '' }));

  // Highlights section
  children.push(
    new Paragraph({ text: 'Highlights', heading: HeadingLevel.HEADING_2 }),
  );
  if (highlights.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '(no highlights)', italics: true })] }));
  } else {
    [...highlights]
      .sort((a, b) => a.page - b.page)
      .forEach((h) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Page ${h.page}  `, bold: true }),
              new TextRun({ text: `[${colorLabel(h.color)}]  `, color: '555555' }),
              new TextRun({ text: `"${h.text}"` }),
            ],
          }),
        );
        if (h.note) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `Note: ${h.note}`, italics: true })],
              indent: { left: 360 },
            }),
          );
        }
      });
  }
  children.push(new Paragraph({ text: '' }));

  // Bookmarks section
  children.push(
    new Paragraph({ text: 'Bookmarks', heading: HeadingLevel.HEADING_2 }),
  );
  if (bookmarks.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '(no bookmarks)', italics: true })] }));
  } else {
    [...bookmarks]
      .sort((a, b) => a.page - b.page)
      .forEach((bm) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Page ${bm.page}`, bold: true }),
              new TextRun({ text: `  –  ${bm.title}` }),
            ],
          }),
        );
      });
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const baseName = pdfName.replace(/\.pdf$/i, '');
  saveAs(blob, `${baseName}-session.docx`);
}

// ── Per-form single-form exports ──────────────────────────────────────────

export interface SingleFormExportPayload {
  form: FormSchema;
  formValues: FormValues;
  pdfName: string;
}

/** Sanitise a form title for use in a file name. */
function safeFileName(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, '-').trim();
}

/**
 * Builds a plain-text export of a single form using a question-and-answer
 * layout: each label appears on its own line; the filled answer is indented
 * on the line(s) below it.  Empty text fields are omitted; checkboxes and
 * checklists always show their full state.
 */
export function buildFormText(payload: SingleFormExportPayload): string {
  const { form, formValues, pdfName } = payload;
  const lines: string[] = [];

  lines.push(form.title.toUpperCase());
  if (pdfName) lines.push(`Document: ${pdfName}`);
  lines.push(`Exported: ${formatDate()}`);

  for (const section of form.sections) {
    lines.push('');
    const bar = '─'.repeat(Math.max(0, 44 - section.title.length - 4));
    lines.push(`─── ${section.title} ${bar}`);
    lines.push('');

    for (const field of section.fields) {
      if (field.type === 'checklist' && field.options) {
        lines.push(field.label);
        field.options.forEach((opt, idx) => {
          const checked =
            formValues[`${form.id}|${field.id}|${idx}`] === 'true';
          lines.push(`    ${checked ? '☑' : '☐'} ${opt}`);
        });
        lines.push('');
      } else if (field.type === 'checkbox') {
        const val = formValues[`${form.id}|${field.id}`];
        lines.push(field.label);
        lines.push(`    ${val === 'true' ? '☑ Yes' : '☐ No'}`);
        lines.push('');
      } else {
        const val = (formValues[`${form.id}|${field.id}`] ?? '').trim();
        if (val) {
          lines.push(field.label);
          val.split('\n').forEach((line) => lines.push(`    ${line}`));
          lines.push('');
        }
      }
    }
  }

  return lines.join('\n');
}

/** Downloads the form as a plain-text (.txt) file. */
export async function downloadFormTxt(
  payload: SingleFormExportPayload,
): Promise<void> {
  const { saveAs } = await import('file-saver');
  const text = buildFormText(payload);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${safeFileName(payload.form.title)}.txt`);
}

/** Downloads the form as a Microsoft Word (.docx) file. */
export async function exportFormDocx(
  payload: SingleFormExportPayload,
): Promise<void> {
  const [
    { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer },
    { saveAs },
  ] = await Promise.all([import('docx'), import('file-saver')]);

  const { form, formValues, pdfName } = payload;
  const children: DocxParagraph[] = [];

  // Document header
  children.push(
    new Paragraph({
      text: form.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
  );
  if (pdfName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Document: ${pdfName}`, italics: true, size: 18 }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    );
  }
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported: ${formatDate()}`,
          italics: true,
          size: 18,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
  );

  for (const section of form.sections) {
    children.push(
      new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }),
    );

    for (const field of section.fields) {
      if (field.type === 'checklist' && field.options) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: field.label, bold: true })],
          }),
        );
        field.options.forEach((opt, idx) => {
          const checked =
            formValues[`${form.id}|${field.id}|${idx}`] === 'true';
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `${checked ? '☑' : '☐'} ${opt}` })],
              indent: { left: 360 },
            }),
          );
        });
        children.push(new Paragraph({ text: '' }));
      } else if (field.type === 'checkbox') {
        const val = formValues[`${form.id}|${field.id}`];
        children.push(
          new Paragraph({
            children: [new TextRun({ text: field.label, bold: true })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${val === 'true' ? '☑ Yes' : '☐ No'}` }),
            ],
            indent: { left: 360 },
          }),
          new Paragraph({ text: '' }),
        );
      } else {
        const val = (formValues[`${form.id}|${field.id}`] ?? '').trim();
        if (val) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: field.label, bold: true })],
            }),
          );
          val.split('\n').forEach((line) =>
            children.push(
              new Paragraph({
                children: [new TextRun({ text: line })],
                indent: { left: 360 },
              }),
            ),
          );
          children.push(new Paragraph({ text: '' }));
        }
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeFileName(form.title)}.docx`);
}

/**
 * Opens the default email client (e.g. Outlook) with a pre-composed message
 * containing the form export text.
 */
export function shareFormViaEmail(payload: SingleFormExportPayload): void {
  const text = buildFormText(payload);
  const subject = `${payload.form.title} – IRPG Reader Export`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/**
 * Shares the form export text via Microsoft Teams.
 *
 * On mobile browsers that support the Web Share API the native share sheet
 * is shown, which includes Teams as a share target.
 *
 * On desktop the text is copied to the clipboard and the Teams desktop
 * app is launched via the `msteams://` protocol with the message
 * pre-populated.
 *
 * Returns:
 *   'shared'  – Web Share API accepted the share (mobile)
 *   'copied'  – text was copied to clipboard; Teams may have opened
 *   'error'   – share was cancelled or failed
 */
export async function shareFormViaTeams(
  payload: SingleFormExportPayload,
): Promise<'shared' | 'copied' | 'error'> {
  const text = buildFormText(payload);

  // Mobile: use native Web Share API so the OS share sheet appears
  // (Teams, WhatsApp, email, etc. are all available as share targets).
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: payload.form.title, text });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'error';
      // Fall through to clipboard/Teams deep-link on other errors.
    }
  }

  // Desktop: write to clipboard then attempt to open the Teams app.
  const copied = await copyTextToClipboard(text);
  if (!copied) return 'error';

  // Open Teams with the first 4 000 chars pre-populated (protocol limit).
  const msgEncoded = encodeURIComponent(text.slice(0, 4000));
  window.open(
    `msteams://teams.microsoft.com/l/chat/0/0?message=${msgEncoded}`,
    '_blank',
  );

  return 'copied';
}
