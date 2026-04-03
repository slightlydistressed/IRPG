export type Theme = 'light' | 'dark';
export type SidebarTab = 'view' | 'toc' | 'highlights' | 'forms' | 'bookmarks';
export type ReadingMode = 'scroll' | '1p' | '2p';

/** Minimum viewport width (px) at which the desktop layout activates.
 *  Matches the CSS @media (min-width: 641px) breakpoint in index.css. */
export const DESKTOP_MIN_WIDTH = 641;

/** Minimum viewport width (px) considered wide enough to default to 2P reading mode. */
export const WIDE_VIEWPORT_2P_MIN = 1000;

/**
 * A highlight's bounding rectangle expressed as fractions of the containing
 * page element's width/height (0–1).  Storing percentages keeps the overlay
 * scale-invariant so highlights render correctly at any zoom level.
 */
export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  text: string;
  page: number;
  color: string;
  note: string;
  createdAt: string;
  /** Positional data used to render overlay divs instead of manipulating the text layer. */
  rects?: HighlightRect[];
}

export interface Bookmark {
  id: string;
  title: string;
  page: number;
  createdAt: string;
}


export interface TOCItem {
  title: string;
  page: number;
  level: number;
  items?: TOCItem[];
}

/**
 * Transient UI state representing an active text selection that the user may
 * choose to highlight.  All positions are in pixels, scroll-adjusted, relative
 * to the top-left of the scrollable PDF container element.
 */
export interface SelectionState {
  text: string;
  page: number;
  /** Horizontal centre of the selection bounding box. */
  x: number;
  /** Top edge of the selection bounding box (scroll-adjusted). */
  yTop: number;
  /** Bottom edge of the selection bounding box (scroll-adjusted). */
  yBottom: number;
  rects: HighlightRect[];
}

export const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fde68a' },
  { label: 'Green', value: '#86efac' },
  { label: 'Blue', value: '#93c5fd' },
  { label: 'Pink', value: '#f9a8d4' },
  { label: 'Orange', value: '#fdba74' },
] as const;

// ── Forms / Checklists ────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richText'
  | 'checklist'
  | 'checkbox'
  | 'date'
  | 'time'
  | 'number';

export type DeviceActionType = 'geolocation' | 'currentDate' | 'currentTime';

export interface DeviceAction {
  type: DeviceActionType;
  buttonLabel: string;
  allowManualOverride: boolean;
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** Option labels used by the 'checklist' type. */
  options?: string[];
  deviceAction?: DeviceAction;
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface FormSchema {
  id: string;
  title: string;
  /** When true, this form is only shown for the bundled IRPG PDF. */
  irpgOnly?: boolean;
  /** PDF page that most closely relates to this form. */
  relatedPage?: number;
  description?: string;
  sections: FormSection[];
}

/**
 * Persisted user-entered values for all forms in a document, keyed by:
 *   `${formId}|${fieldId}`          – for text, textarea, date, time, number, checkbox
 *   `${formId}|${fieldId}|${index}` – for each option in a checklist field
 */
export type FormValues = Record<string, string>;
