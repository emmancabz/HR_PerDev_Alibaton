import { type ReactNode } from 'react';

type Column<T> = {
    key: string;
    header: string;
    className?: string;
    render: (row: T) => ReactNode;
};

type FilterTab = {
    label: string;
    value: string;
};

export default function DataTable<T>({
    title,
    columns,
    data,
    rowKey,
    filterTabs,
    activeFilter,
    onFilterChange,
    onRowClick,
    footer,
    headerExtra,
}: {
    title: string;
    columns: Column<T>[];
    data: T[];
    rowKey: (row: T) => string;
    filterTabs?: FilterTab[];
    activeFilter?: string;
    onFilterChange?: (value: string) => void;
    onRowClick?: (row: T) => void;
    footer?: ReactNode;
    headerExtra?: ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <div className="flex items-center gap-2">
                    {headerExtra}
                    {filterTabs && onFilterChange && (
                        <div className="flex rounded-lg border border-slate-200 p-0.5">
                            {filterTabs.map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => onFilterChange(tab.value)}
                                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                                        activeFilter === tab.value
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full table-auto text-left">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 ${col.className ?? ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-3 py-8 text-center text-sm text-slate-400"
                                >
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            data.map((row) => (
                                <tr
                                    key={rowKey(row)}
                                    onClick={() => onRowClick?.(row)}
                                    className={`border-b border-slate-200 last:border-0 transition-colors hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={`px-3 py-2.5 text-sm text-slate-600 ${col.className ?? ''}`}
                                        >
                                            {col.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {footer && (
                <div className="border-t border-slate-100 px-4 py-3">
                    {footer}
                </div>
            )}
        </div>
    );
}