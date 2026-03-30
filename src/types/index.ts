export type Theme = 'light' | 'dark';
export type SidebarTab = 'toc' | 'highlights' | 'qa';

export interface Highlight {
  id: string;
  text: string;
  page: number;
  color: string;
  note: string;
  createdAt: string;
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
