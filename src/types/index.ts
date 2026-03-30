export type Theme = 'light' | 'dark';
export type SidebarTab = 'toc' | 'highlights' | 'qa';

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

export interface QAPair {
  id: string;
  question: string;
  answer: string;
  page?: number;
}

export interface TOCItem {
  title: string;
  page: number;
  level: number;
  items?: TOCItem[];
}

export const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fde68a' },
  { label: 'Green', value: '#86efac' },
  { label: 'Blue', value: '#93c5fd' },
  { label: 'Pink', value: '#f9a8d4' },
  { label: 'Orange', value: '#fdba74' },
] as const;
