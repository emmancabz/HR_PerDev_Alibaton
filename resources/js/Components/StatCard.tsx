import { type LucideIcon } from 'lucide-react';

export default function StatCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string | number;
    icon: LucideIcon;
}) {
    return (
        <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
                {value}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
        </div>
    );
}
