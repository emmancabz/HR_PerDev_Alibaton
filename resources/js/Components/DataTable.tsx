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
    footer?: ReactNode;
    headerExtra?: ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
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
                        <tr className="border-b border-slate-100 bg-slate-50/80">
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
                                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
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
