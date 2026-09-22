import { type LucideIcon } from 'lucide-react';

export default function StatCard({
    label,
    value,
    icon: Icon,
    onClick,
}: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    onClick?: () => void;
}) {
    const content = (
        <div className="flex min-h-14 items-center justify-between gap-4">
            <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-slate-950">
                    {value}
                </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
                <Icon className="h-5 w-5" />
            </div>
        </div>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-label={`Open ${label}`}
                className="app-kpi-card group w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2"
            >
                {content}
            </button>
        );
    }

    return (
        <div className="app-kpi-card group p-4">
            {content}
        </div>
    );
}
