import { ScrollText } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ViewLayoutPanel() {
  const { readingMode, setReadingMode } = useApp();

  return (
    <div className="p-4 flex flex-col gap-5">
      {/* Reading mode */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          Reading Mode
        </h2>
        <div className="flex flex-col gap-1.5">
          <button
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
              readingMode === 'scroll'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium'
                : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text)]'
            }`}
            onClick={() => setReadingMode('scroll')}
            aria-pressed={readingMode === 'scroll'}
          >
            <ScrollText size={16} className="shrink-0" />
            <div>
              <div className="font-medium leading-tight">Infinite Scroll</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Continuous vertical reading
              </div>
            </div>
          </button>

          <button
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
              readingMode === '1p'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium'
                : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text)]'
            }`}
            onClick={() => setReadingMode('1p')}
            aria-pressed={readingMode === '1p'}
          >
            {/* Single-page icon */}
            <span className="w-4 h-5 border-2 border-current rounded-sm shrink-0 flex items-center justify-center text-[8px] font-bold leading-none select-none">
              1
            </span>
            <div>
              <div className="font-medium leading-tight">Single Page</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                One page at a time
              </div>
            </div>
          </button>

          <button
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
              readingMode === '2p'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium'
                : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text)]'
            }`}
            onClick={() => setReadingMode('2p')}
            aria-pressed={readingMode === '2p'}
          >
            {/* Two-page spread icon */}
            <span className="flex gap-0.5 shrink-0" aria-hidden="true">
              <span className="w-2 h-5 border-2 border-current rounded-sm" />
              <span className="w-2 h-5 border-2 border-current rounded-sm" />
            </span>
            <div>
              <div className="font-medium leading-tight">Two-Page Spread</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Side-by-side pages, best on wide screens
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Sizing info */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
          Page Sizing
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Pages are fitted to the available width automatically.
        </p>
      </section>
    </div>
  );
}
