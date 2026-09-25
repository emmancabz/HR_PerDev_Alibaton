import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
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
    const sectionRef = useRef<HTMLElement | null>(null);
    const searchLocation = typeof window === 'undefined'
        ? ''
        : `${window.location.search}${window.location.hash}`;
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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const targetTable = params.get('gs_table')?.trim() ?? '';
        const targetRecord = params.get('gs_record')?.trim() ?? '';
        const targetMatch = params.get('gs_match')?.trim().toLowerCase() ?? '';
        const shouldOpen = params.get('gs_open') === '1';

        if (!targetTable && !targetRecord && !targetMatch) return;

        const normalize = (value: string) =>
            value
                .toLowerCase()
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();

        const normalizedTitle = normalize(title);
        const normalizedTarget = normalize(targetTable);

        const tableMatches =
            normalizedTarget !== ''
            && (
                normalizedTitle === normalizedTarget
                || normalizedTitle.includes(normalizedTarget)
                || normalizedTarget.includes(normalizedTitle)
            );

        // If the URL names a table, only that table is allowed to consume the
        // target. This prevents another table containing the same person/title from
        // scrolling first and clearing the search parameters.
        if (targetTable && !tableMatches) return;

        const wantsRecord = Boolean(targetRecord || targetMatch);
        let targetIndex = -1;

        if (targetRecord) {
            targetIndex = data.findIndex((row) => String(rowKey(row)) === targetRecord);
        }

        if (targetIndex < 0 && targetMatch) {
            targetIndex = data.findIndex((row) => {
                const accessibleLabel = getRowLabel?.(row)?.toLowerCase() ?? '';

                if (accessibleLabel.includes(targetMatch)) {
                    return true;
                }

                try {
                    return JSON.stringify(row).toLowerCase().includes(targetMatch);
                } catch {
                    return false;
                }
            });
        }

        // A record target may be outside an externally paginated slice. Do not
        // downgrade that request into a table-only jump and do not clear gs_* yet;
        // the owning page can expose the correct page, after which this effect runs
        // again and opens the exact row.
        if (wantsRecord && targetIndex < 0) return;

        // Table-name search without a record simply focuses the requested table.
        if (!wantsRecord && !tableMatches) return;

        const targetPage =
            targetIndex >= 0
                ? Math.floor(targetIndex / pageSize) + 1
                : page;

        if (targetIndex >= 0 && targetPage !== page) {
            setPage(targetPage);
        }

        const targetKey =
            targetIndex >= 0
                ? String(rowKey(data[targetIndex]))
                : null;

        const clearSearchFocusParams = () => {
            const url = new URL(window.location.href);

            [
                'gs_table',
                'gs_record',
                'gs_match',
                'gs_context',
                'gs_open',
                'gs_person',
            ].forEach((key) => url.searchParams.delete(key));

            window.history.replaceState(
                window.history.state,
                '',
                `${url.pathname}${url.search}${url.hash}`,
            );
        };

        const timer = window.setTimeout(() => {
            const section = sectionRef.current;

            if (!section) return;

            let targetElement: HTMLElement = section;

            if (targetKey !== null) {
                const rows = Array.from(
                    section.querySelectorAll<HTMLElement>('[data-global-search-row]'),
                );

                const rowElement = rows.find(
                    (element) =>
                        element.getAttribute('data-global-search-row') === targetKey,
                );

                if (rowElement) {
                    targetElement = rowElement;
                }
            }

            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });

            targetElement.animate(
                [
                    {
                        backgroundColor: 'rgba(244, 180, 0, 0.28)',
                        boxShadow: '0 0 0 2px rgba(244, 180, 0, 0.85)',
                    },
                    {
                        backgroundColor: 'rgba(244, 180, 0, 0.10)',
                        boxShadow: '0 0 0 1px rgba(244, 180, 0, 0.35)',
                    },
                    {
                        backgroundColor: 'transparent',
                        boxShadow: '0 0 0 0 rgba(244, 180, 0, 0)',
                    },
                ],
                {
                    duration: 1100,
                    easing: 'ease-out',
                },
            );

            if (
                shouldOpen
                && targetIndex >= 0
                && onRowClick
            ) {
                window.setTimeout(() => {
                    onRowClick(data[targetIndex]);
                }, 700);
            }

            window.setTimeout(clearSearchFocusParams, 1150);
        }, targetIndex >= 0 && targetPage !== page ? 180 : 80);

        return () => window.clearTimeout(timer);
    }, [
        data,
        getRowLabel,
        onRowClick,
        page,
        pageSize,
        rowKey,
        searchLocation,
        title,
    ]);

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
        <section
            ref={sectionRef}
            data-global-search-table={title}
            className="app-card relative"
            aria-label={title}
        >
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
                                            data-global-search-row={key}
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
