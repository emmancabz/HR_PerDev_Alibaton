import DataTable from '@/Components/DataTable';
import { AppModal } from '@/Components/Competency/CompetencyUI';
import StatCard from '@/Components/StatCard';
import SystemSelect from '@/Components/SystemSelect';
import AuthenticatedLayout, { HeaderActions, HeaderFilters } from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    Archive,
    Award,
    BookOpenCheck,
    ClipboardCheck,
    Download,
    FileClock,
    FileSpreadsheet,
    FileText,
    GraduationCap,
    Printer,
    ShieldCheck,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type ReportRow = Record<string, unknown> & { id: string | number };
type Metric = { label: string; value: string | number };
type ExportRow = { id: string | number; report: string; format: string; row_count: number; actor: string; exported_at: string };
type ReportsState = {
    role: 'admin' | 'hr' | 'user';
    selected_report: string;
    catalog: { key: string; label: string }[];
    filters: { department: string; date_from: string; date_to: string };
    departments: string[];
    metrics: Metric[];
    report: { key: string; title: string; rows: ReportRow[]; row_count: number; date_basis: string };
    exports: ExportRow[];
};

const metricIcons: Record<string, LucideIcon[]> = {
    'workforce-development': [Users, ClipboardCheck, ShieldCheck, GraduationCap],
    'performance-cycle': [ClipboardCheck, ShieldCheck, FileClock, FileText],
    'learning-compliance': [BookOpenCheck, GraduationCap, Award, FileClock],
    'training-effectiveness': [Users, ClipboardCheck, ShieldCheck, Award],
    'succession-risk': [Archive, ShieldCheck, Award, FileClock],
    'recognition-activity': [Award, ShieldCheck, FileClock, Users],
};

const label = (key: string) => key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              ...(value.includes('T') || value.includes(':') ? { hour: 'numeric', minute: '2-digit' } : {}),
          });
}

function display(key: string, value: unknown) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string' && (key.endsWith('_at') || key.endsWith('_on') || key === 'due_at' || key === 'expires_on')) {
        return formatDate(value);
    }
    if ((key === 'attendance_rate' || key === 'assessment_score') && !Number.isNaN(Number(value))) {
        return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}%`;
    }
    return String(value);
}

function statusTone(value: unknown) {
    const normalized = String(value ?? '').toLowerCase();
    if (['recognized', 'finalized', 'completed', 'passed', 'valid', 'active', 'covered', 'ready now'].some((item) => normalized.includes(item))) {
        return 'bg-emerald-50 text-emerald-700';
    }
    if (['expired', 'revoked', 'failed', 'declined', 'at risk', 'overdue'].some((item) => normalized.includes(item))) {
        return 'bg-rose-50 text-rose-700';
    }
    if (['pending', 'open', 'developing', 'expiring', 'in progress'].some((item) => normalized.includes(item))) {
        return 'bg-amber-50 text-amber-700';
    }
    return 'bg-slate-100 text-slate-600';
}

export default function Reports({ initialReportsState }: { initialReportsState: ReportsState }) {
    const [state, setState] = useState(initialReportsState);
    const [reportType, setReportType] = useState(initialReportsState.selected_report);
    const [department, setDepartment] = useState(initialReportsState.filters.department);
    const [dateFrom, setDateFrom] = useState(initialReportsState.filters.date_from);
    const [dateTo, setDateTo] = useState(initialReportsState.filters.date_to);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<ReportRow | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

    async function loadReport(report: string, nextDepartment = department, nextDateFrom = dateFrom, nextDateTo = dateTo) {
        setLoading(true);
        try {
            const response = await axios.get(route('governance.api.reports.state'), {
                params: {
                    report,
                    department: nextDepartment,
                    date_from: nextDateFrom,
                    date_to: nextDateTo,
                },
            });
            setState(response.data.data);
            setReportType(response.data.data.selected_report);
            setDepartment(response.data.data.filters.department);
            setDateFrom(response.data.data.filters.date_from);
            setDateTo(response.data.data.filters.date_to);
            setSelected(null);
        } finally {
            setLoading(false);
        }
    }

    const columns = useMemo(() => {
        const keys = state.report.rows.length > 0
            ? Object.keys(state.report.rows[0]).filter((key) => key !== 'id')
            : [];

        return (keys.length > 0 ? keys : ['record']).map((key) => ({
            key,
            header: label(key),
            render: (row: ReportRow) => {
                const value = row[key];
                const isPrimary = ['person', 'position', 'course', 'program', 'title'].includes(key);
                const isStatus = key === 'status' || key.endsWith('_status') || key === 'coverage_risk' || key === 'practical_result';

                if (isStatus && value) {
                    return (
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(value)}`}>
                            {display(key, value)}
                        </span>
                    );
                }

                return <span className={isPrimary ? 'font-semibold text-slate-900' : ''}>{display(key, value)}</span>;
            },
        }));
    }, [state.report.rows]);

    const exportUrl = (format: 'csv' | 'print') => route('governance.api.reports.export', {
        report: state.report.key,
        format,
        department: department || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
    });

    const icons = metricIcons[state.report.key] ?? [Users, ClipboardCheck, BookOpenCheck, FileText];
    const periodText = dateFrom || dateTo
        ? `${dateFrom ? formatDate(dateFrom) : 'Beginning'} – ${dateTo ? formatDate(dateTo) : 'Present'}`
        : 'All available dates';

    return (
        <AuthenticatedLayout
            header={<h1 className="truncate text-lg font-bold text-slate-900">{state.role === 'user' ? 'My Development Reports' : 'Reports'}</h1>}
        >
            <Head title="Reports" />

            <HeaderFilters
                onApply={(filters) => void loadReport(
                    String(filters['Report type'] ?? reportType),
                    String(filters.Department ?? department),
                    String(filters['Date from'] ?? dateFrom),
                    String(filters['Date to'] ?? dateTo),
                )}
            >
                <SystemSelect aria-label="Report type" value={reportType} onChange={(event) => setReportType(event.target.value)} disabled={loading}>
                    {state.catalog.map((report) => <option key={report.key} value={report.key}>{report.label}</option>)}
                </SystemSelect>
                {state.role !== 'user' && (
                    <SystemSelect aria-label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} disabled={loading}>
                        <option value="">All Departments</option>
                        {state.departments.map((item) => <option key={item}>{item}</option>)}
                    </SystemSelect>
                )}
                <input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} disabled={loading} />
                <input aria-label="Date to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} disabled={loading} />
            </HeaderFilters>

            <HeaderActions>
                <button type="button" className="app-button" onClick={() => setHistoryOpen(true)}>
                    <FileClock className="h-4 w-4" /> Export History
                </button>
                <button type="button" className="app-button app-button-primary" onClick={() => setExportOpen(true)}>
                    <Download className="h-4 w-4" /> Export Report
                </button>
            </HeaderActions>

            <div className="flex flex-col gap-4">
                <section className="app-card px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Current report</p>
                            <h2 className="mt-1 text-sm font-bold text-slate-950">{state.report.title}</h2>
                            <p className="mt-1 text-xs text-slate-500">{periodText}{department ? ` · ${department}` : ' · All departments'}</p>
                            <p className="mt-1 text-[10px] text-slate-400">Date basis: {state.report.date_basis}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600">
                            Read-only consolidated view
                        </span>
                    </div>
                </section>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {state.metrics.map((metric, index) => (
                        <StatCard key={metric.label} label={metric.label} value={metric.value} icon={icons[index] ?? FileText} />
                    ))}
                </div>

                <DataTable
                    title={loading ? 'Loading report…' : state.report.title}
                    columns={columns}
                    data={state.report.rows}
                    rowKey={(row) => String(row.id)}
                    onRowClick={setSelected}
                    getRowLabel={(row) => `Open ${display('record', row.person ?? row.position ?? row.title ?? row.id)}`}
                    pageSize={10}
                    footer={
                        <span className="text-xs text-slate-500">
                            {state.report.row_count} authoritative record(s) · maximum 10 per page · source records remain governed by their owning modules
                        </span>
                    }
                    emptyTitle="No report records in scope"
                    emptyDescription="Try another report type, department, or date range from the header filter."
                />
            </div>

            <AppModal
                show={Boolean(selected)}
                title={selected ? display('record', selected.person ?? selected.position ?? selected.title ?? 'Report Record') : 'Report Record'}
                description={state.report.title}
                onClose={() => setSelected(null)}
                maxWidth="2xl"
            >
                {selected && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(selected)
                            .filter(([key]) => key !== 'id')
                            .map(([key, value]) => (
                                <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label(key)}</p>
                                    <div className="mt-1 text-sm font-semibold text-slate-900">
                                        {(key === 'status' || key.endsWith('_status') || key === 'coverage_risk' || key === 'practical_result') && value ? (
                                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(value)}`}>{display(key, value)}</span>
                                        ) : display(key, value)}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </AppModal>

            <AppModal
                show={exportOpen}
                title="Export Report"
                description={`${state.report.title} · ${state.report.row_count} record(s) in the current header-filter scope`}
                onClose={() => setExportOpen(false)}
                maxWidth="lg"
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <a
                        href={exportUrl('csv')}
                        onClick={() => setExportOpen(false)}
                        className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-amber-300 hover:bg-amber-50/30"
                    >
                        <div className="flex items-start gap-3">
                            <span className="rounded-lg bg-amber-50 p-2 text-amber-600"><FileSpreadsheet className="h-5 w-5" /></span>
                            <div>
                                <p className="text-sm font-bold text-slate-900">CSV</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Structured rows for spreadsheet analysis and official data handoff.</p>
                            </div>
                        </div>
                    </a>
                    <a
                        href={exportUrl('print')}
                        onClick={() => setExportOpen(false)}
                        className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-amber-300 hover:bg-amber-50/30"
                    >
                        <div className="flex items-start gap-3">
                            <span className="rounded-lg bg-amber-50 p-2 text-amber-600"><Printer className="h-5 w-5" /></span>
                            <div>
                                <p className="text-sm font-bold text-slate-900">Print / Save PDF</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Open the governed printable report for browser printing or PDF save.</p>
                            </div>
                        </div>
                    </a>
                </div>
            </AppModal>

            <AppModal
                show={historyOpen}
                title="Export History"
                description="The 10 most recent report exports visible to your account."
                onClose={() => setHistoryOpen(false)}
                maxWidth="2xl"
            >
                <DataTable
                    title="Recent Exports"
                    columns={[
                        { key: 'report', header: 'Report', render: (row: ExportRow) => <span className="font-semibold text-slate-900">{row.report}</span> },
                        { key: 'format', header: 'Format', render: (row: ExportRow) => row.format },
                        { key: 'rows', header: 'Rows', render: (row: ExportRow) => row.row_count },
                        { key: 'actor', header: 'Exported By', render: (row: ExportRow) => row.actor },
                        { key: 'date', header: 'Exported', render: (row: ExportRow) => row.exported_at ? formatDate(row.exported_at) : '—' },
                    ]}
                    data={state.exports}
                    rowKey={(row) => String(row.id)}
                    pageSize={10}
                    emptyTitle="No exports yet"
                    emptyDescription="Exports created from this reporting workspace will appear here."
                />
            </AppModal>
        </AuthenticatedLayout>
    );
}
