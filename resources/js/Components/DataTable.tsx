import { Fragment, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

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
    pageSize = 10,
    getRowLabel,
    getRowClassName,
    tableLayout = 'auto',
    emptyTitle = 'No records found',
    emptyDescription = 'Try changing the current filters.',
    overlay,
    expandedRowKey,
    renderExpandedRow,
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
    pageSize?: number;
    getRowLabel?: (row: T) => string;
    getRowClassName?: (row: T) => string;
    tableLayout?: 'auto' | 'fixed';
    emptyTitle?: string;
    emptyDescription?: string;
    overlay?: ReactNode;
    expandedRowKey?: string | null;
    renderExpandedRow?: (row: T) => ReactNode;
}) {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const pagedData = useMemo(
        () => data.slice((page - 1) * pageSize, page * pageSize),
        [data, page, pageSize],
    );

    useEffect(() => {
        setPage((current) => Math.min(current, totalPages));
    }, [totalPages]);

    function openRow(event: MouseEvent<HTMLTableRowElement>, row: T) {
        const target = event.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea, [role="menuitem"]')) return;
        onRowClick?.(row);
    }

    const pagination = totalPages > 1 ? (
        <div className="flex w-full items-center justify-between gap-3 text-xs text-slate-500">
            <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} of {data.length}
            </span>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="app-table-page-button"
                    aria-label={`Previous page of ${title}`}
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        aria-current={pageNumber === page ? 'page' : undefined}
                        className={`app-table-page-button ${pageNumber === page ? 'bg-[#F4B400] text-black' : ''}`}
                    >
                        {pageNumber}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                    className="app-table-page-button"
                    aria-label={`Next page of ${title}`}
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    ) : null;

    return (
        <section className="app-card relative" aria-label={title}>
            <div className="app-card-header">
                <h3 className="text-sm font-bold text-slate-950">{title}</h3>
                <div className="flex items-center gap-2">
                    {headerExtra}
                    {filterTabs && onFilterChange && (
                        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
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
                <table className={`w-full text-left ${tableLayout === 'fixed' ? 'table-fixed' : 'table-auto'}`}>
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-100">
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
                                    className="px-4 py-8 text-center"
                                >
                                    <Inbox className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
                                    <span className="mt-2 block text-sm font-semibold text-slate-600">{emptyTitle}</span>
                                    <span className="mx-auto mt-1 block max-w-xl text-xs leading-relaxed text-slate-400">{emptyDescription}</span>
                                </td>
                            </tr>
                        ) : (
                            pagedData.map((row, rowIndex) => {
                                const key = rowKey(row);
                                const expandedRenderer = renderExpandedRow;
                                const expanded = Boolean(expandedRenderer && expandedRowKey === key);
                                const expandedContent = expanded && expandedRenderer ? expandedRenderer(row) : null;
                                return (
                                    <Fragment key={key}>
                                        <tr
                                            onClick={(event) => openRow(event, row)}
                                            onKeyDown={(event) => {
                                                if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return;
                                                event.preventDefault();
                                                onRowClick(row);
                                            }}
                                            role={onRowClick ? 'button' : undefined}
                                            tabIndex={onRowClick ? 0 : undefined}
                                            aria-expanded={onRowClick && renderExpandedRow ? expanded : undefined}
                                            aria-label={onRowClick ? (getRowLabel?.(row) ?? `Open row ${(page - 1) * pageSize + rowIndex + 1} in ${title}`) : undefined}
                                            className={`border-b border-slate-200 transition-colors hover:bg-slate-50 ${onRowClick ? 'cursor-pointer focus-visible:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F4B400]' : ''} ${expanded ? 'bg-amber-50/30' : ''} ${getRowClassName?.(row) ?? ''}`}
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
                                        {expandedContent !== null && (
                                            <tr className="border-b border-slate-200 bg-slate-50/70">
                                                <td colSpan={columns.length} className="p-0">
                                                    {expandedContent}
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {(footer || pagination) && (
                <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3">
                    <div className="flex flex-col gap-2">
                        {footer}
                        {pagination}
                    </div>
                </div>
            )}

            {overlay}
        </section>
    );
}
