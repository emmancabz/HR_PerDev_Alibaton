import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export default function RecordDetailsDrawer({
    eyebrow = 'Record details',
    title,
    subtitle,
    badges,
    children,
    actions,
    onClose,
}: {
    eyebrow?: string;
    title: string;
    subtitle?: ReactNode;
    badges?: ReactNode;
    children: ReactNode;
    actions?: ReactNode;
    onClose: () => void;
}) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex justify-end bg-slate-950/60 backdrop-blur-sm"
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={`${title} details`}
                className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl animate-in slide-in-from-right duration-200"
            >
                <header className="relative shrink-0 bg-gradient-to-br from-[#121212] to-[#242424] px-6 py-6 text-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"
                        aria-label="Close details"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <p className="pr-10 text-[11px] font-bold uppercase tracking-widest text-[#F4B400]">{eyebrow}</p>
                    <h2 className="mt-3 pr-10 text-xl font-bold">{title}</h2>
                    {subtitle && <div className="mt-1 text-sm text-white/60">{subtitle}</div>}
                    {badges && <div className="mt-3 flex flex-wrap gap-2">{badges}</div>}
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
                <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                    {actions}
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                        Close
                    </button>
                </footer>
            </aside>
        </div>
    );
}
