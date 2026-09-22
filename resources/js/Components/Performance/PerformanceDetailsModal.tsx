import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

type Props = {
  ariaLabel: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  headerMeta?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  contentClassName?: string;
};

export default function PerformanceDetailsModal({
  ariaLabel,
  eyebrow,
  title,
  subtitle,
  leading,
  headerMeta,
  headerActions,
  footer,
  onClose,
  children,
  contentClassName = 'space-y-4 bg-slate-50/50 p-4 sm:p-6',
}: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        aria-hidden="true"
        data-performance-details-backdrop
        className="pointer-events-auto absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]"
        onMouseDown={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-performance-details-modal
        className="pointer-events-auto relative z-10 flex max-h-[90vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl [color-scheme:light]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              {leading}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">{eyebrow}</p>
                <h2 className="mt-1 truncate text-lg font-extrabold leading-tight text-slate-950">{title}</h2>
                {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
                {headerMeta && <div className="mt-2 flex flex-wrap items-center gap-2">{headerMeta}</div>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close review details"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className={`min-h-0 flex-1 overflow-y-auto ${contentClassName}`}>
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
