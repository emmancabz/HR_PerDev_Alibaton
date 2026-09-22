import SystemSelect from '@/Components/SystemSelect';
import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';

export type ChartDatePreset = '30d' | '90d' | '180d' | '1y' | 'ytd' | 'all' | 'custom';
export type ChartDateRangeValue = {
    preset: ChartDatePreset;
    from: string;
    to: string;
};

export const DEFAULT_CHART_DATE_RANGE: ChartDateRangeValue = {
    preset: '1y',
    from: '',
    to: '',
};

const DATE_PRESET_OPTIONS: Array<{ value: ChartDatePreset; label: string }> = [
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '180d', label: 'Last 180 days' },
    { value: '1y', label: 'Last 12 months' },
    { value: 'ytd', label: 'Year to date' },
    { value: 'all', label: 'All dates' },
    { value: 'custom', label: 'Custom date' },
];

function localIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function resolveChartDateRange(
    value: ChartDateRangeValue,
    now = new Date(),
): { from: string | null; to: string | null; label: string } {
    const to = localIsoDate(now);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (value.preset === 'all') {
        return { from: null, to: null, label: 'All available dates' };
    }
    if (value.preset === 'custom') {
        return {
            from: value.from || null,
            to: value.to || null,
            label:
                value.from || value.to
                    ? `${value.from || 'Beginning'} – ${value.to || 'Today'}`
                    : 'Custom range',
        };
    }
    if (value.preset === 'ytd') {
        return {
            from: `${now.getFullYear()}-01-01`,
            to,
            label: `Year to date ${now.getFullYear()}`,
        };
    }

    const days = value.preset === '30d' ? 30 : value.preset === '90d' ? 90 : value.preset === '180d' ? 180 : 365;
    start.setDate(start.getDate() - (days - 1));
    return {
        from: localIsoDate(start),
        to,
        label: `Last ${days === 365 ? '12 months' : `${days} days`}`,
    };
}

export function dateFallsInChartRange(
    dateValue: string | null | undefined,
    range: ChartDateRangeValue,
    now = new Date(),
): boolean {
    if (!dateValue) return false;
    const iso = dateValue.slice(0, 10);
    const resolved = resolveChartDateRange(range, now);
    if (resolved.from && iso < resolved.from) return false;
    if (resolved.to && iso > resolved.to) return false;
    return true;
}

export function ChartDateRangeControl({
    value,
    onChange,
    compact = false,
    label = 'Chart date',
}: {
    value: ChartDateRangeValue;
    onChange: (value: ChartDateRangeValue) => void;
    compact?: boolean;
    label?: string;
}) {
    const resolved = useMemo(() => resolveChartDateRange(value), [value]);
    const dateInputClass = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

    return (
        <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'rounded-xl border border-slate-200 bg-slate-50 p-2'}`}>
            {!compact && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" /> {label}
                </span>
            )}
            <SystemSelect
                aria-label={label}
                menuLabel={label}
                value={value.preset}
                onChange={(event) => onChange({ ...value, preset: event.target.value as ChartDatePreset })}
                triggerClassName="h-9 w-40 max-w-[10rem] text-xs"
                title={resolved.label}
            >
                {DATE_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </SystemSelect>
            {value.preset === 'custom' && (
                <>
                    <input
                        aria-label={`${label} from`}
                        type="date"
                        value={value.from}
                        max={value.to || undefined}
                        onChange={(event) => onChange({ ...value, from: event.target.value })}
                        className={dateInputClass}
                    />
                    <span className="text-[11px] text-slate-400">to</span>
                    <input
                        aria-label={`${label} to`}
                        type="date"
                        value={value.to}
                        min={value.from || undefined}
                        onChange={(event) => onChange({ ...value, to: event.target.value })}
                        className={dateInputClass}
                    />
                </>
            )}
        </div>
    );
}
