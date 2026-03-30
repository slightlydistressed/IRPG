import React from 'react';
import { List, Highlighter, ClipboardList } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { SidebarTab } from '../types';

const TABS: { id: SidebarTab; label: string; Icon: React.ElementType }[] = [
  { id: 'toc',        label: 'Contents',   Icon: List         },
  { id: 'highlights', label: 'Highlights', Icon: Highlighter  },
  { id: 'forms',      label: 'Forms',      Icon: ClipboardList },
];

/**
 * Bottom navigation bar rendered only on mobile (≤ 640 px via CSS).
 *
 * Tapping a tab:
 * - opens the sidebar to that tab if it was closed or on a different tab, or
 * - closes the sidebar if the same tab was already active.
 */
export default function MobileNav() {
  const {
    sidebarTab,
    setSidebarTab,
    sidebarOpen,
    setSidebarOpen,
    highlights,
  } = useApp();

  const handleTabPress = (tab: SidebarTab) => {
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarTab(tab);
      setSidebarOpen(true);
    }
  };

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`mobile-nav-btn${sidebarOpen && sidebarTab === id ? ' mobile-nav-btn-active' : ''}`}
          onClick={() => handleTabPress(id)}
          aria-label={label}
          aria-pressed={sidebarOpen && sidebarTab === id}
        >
          <div className="relative">
            <Icon size={20} />
            {id === 'highlights' && highlights.length > 0 && (
              <span
                className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold leading-none"
                aria-hidden="true"
              >
                {highlights.length > 99 ? '99+' : highlights.length}
              </span>
            )}
          </div>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
