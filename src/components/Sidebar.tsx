import React, { Suspense, lazy } from 'react';
import { List, Highlighter, ClipboardList } from 'lucide-react';
import { useApp } from '../context/AppContext';
import TableOfContents from './TableOfContents';
import HighlightPanel from './HighlightPanel';
import type { SidebarTab } from '../types';

// FormPanel imports docx export utilities; lazy-load it so those heavy
// modules are deferred until the user first opens the Forms tab.
const FormPanel = lazy(() => import('./FormPanel'));

const TABS: { id: SidebarTab; label: string; Icon: React.ElementType }[] = [
  { id: 'toc', label: 'Contents', Icon: List },
  { id: 'highlights', label: 'Highlights', Icon: Highlighter },
  { id: 'forms', label: 'Forms', Icon: ClipboardList },
];

export default function Sidebar() {
  const { sidebarTab, setSidebarTab, sidebarOpen, setSidebarOpen, highlights } = useApp();

  return (
    <>
      {/* Tap-outside backdrop – rendered on mobile only via CSS */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar flex flex-col shrink-0 overflow-hidden${sidebarOpen ? ' sidebar-open' : ''}`}>
        {/* Tab bar */}
        <div className="flex border-b border-[var(--color-border)] shrink-0" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSidebarTab(id)}
              className={`tab-btn flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                sidebarTab === id ? 'tab-btn-active' : ''
              }`}
              title={label}
              aria-selected={sidebarTab === id}
              role="tab"
            >
              <div className="relative">
                <Icon size={16} />
                {id === 'highlights' && highlights.length > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold leading-none"
                    aria-label={`${highlights.length} highlight${highlights.length !== 1 ? 's' : ''}`}
                  >
                    {highlights.length > 99 ? '99+' : highlights.length}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'toc' && <TableOfContents />}
          {sidebarTab === 'highlights' && <HighlightPanel />}
          {sidebarTab === 'forms' && (
            <Suspense fallback={<div role="status" aria-live="polite" className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</div>}>
              <FormPanel />
            </Suspense>
          )}
        </div>
      </aside>
    </>
  );
}
