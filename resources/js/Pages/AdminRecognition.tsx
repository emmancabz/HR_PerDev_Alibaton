import { AppModal, Field } from '@/Components/Competency/CompetencyUI';
import DataTable from '@/Components/DataTable';
import RecognitionNominationForm from '@/Components/Recognition/RecognitionNominationForm';
import StatCard from '@/Components/StatCard';
import SystemSelect from '@/Components/SystemSelect';
import AuthenticatedLayout, { HeaderActions, HeaderFilters } from '@/Layouts/AuthenticatedLayout';
import { recognitionClient, recognitionError } from '@/data/recognitionClient';
import {
    RECOGNITION_ADMIN_WORKSPACES,
    normalizeRecognitionState,
    type RecognitionAdminWorkspace,
    type RecognitionCategory,
    type RecognitionEvidence,
    type RecognitionRecord,
    type RecognitionState,
    type RecognitionStatus,
} from '@/data/recognition';
import { useHashWorkspace } from '@/workspaceNavigation';
import { Head } from '@inertiajs/react';
import {
    Award,
    Building2,
    CheckCircle2,
    Clock3,
    FileCheck2,
    FileText,
    Medal,
    Plus,
    RotateCcw,
    Settings2,
    ShieldCheck,
    UserRoundCheck,
    Users,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

const button = 'app-button';
const primary = 'app-button app-button-primary';
const input = 'app-control';

type Props = { initialRecognitionState?: unknown };
type Filters = { department: string; category: string; status: string; nominator: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { department: 'all', category: 'all', status: 'all', nominator: 'all', from: '', to: '' };
const OFFICIAL_EVIDENCE = new Set(['Performance', 'Competency', 'Learning', 'Training']);

function initialState(value: unknown): RecognitionState | null {
    try { return value ? normalizeRecognitionState(value) : null; } catch { return null; }
}

function formatDate(value: string | null | undefined) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function recordActivityDate(record: RecognitionRecord): string {
    return record.recognizedAt ?? record.reviewedAt ?? record.submittedAt ?? record.achievementDate ?? record.createdAt ?? '';
}

function statusClass(status: RecognitionStatus | string): string {
    if (status === 'Recognized') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Pending Review') return 'bg-amber-100 text-amber-800';
    if (status === 'Declined' || status === 'Revoked') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-600';
}

function StatusPill({ value }: { value: string }) {
    return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusClass(value)}`}>{value}</span>;
}

type EvidenceSummary = {
    label: string;
    tone: string;
    count: number;
    kind: 'verified' | 'note' | 'missing';
};

function evidenceStatus(evidence: RecognitionEvidence[]): EvidenceSummary {
    const official = evidence.filter((item) => item.sourceModule && OFFICIAL_EVIDENCE.has(item.sourceModule) && item.sourceFinalizedAt);
    if (official.length) return {
        label: 'Verified Context',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        count: official.length,
        kind: 'verified',
    };
    if (evidence.some((item) => item.description?.trim())) return {
        label: 'Supporting Note',
        tone: 'border-amber-200 bg-amber-50 text-amber-800',
        count: evidence.length,
        kind: 'note',
    };
    return {
        label: 'Needs Clarification',
        tone: 'border-slate-200 bg-slate-50 text-slate-600',
        count: 0,
        kind: 'missing',
    };
}

function EvidenceIndicator({ summary, compact = false }: { summary: EvidenceSummary; compact?: boolean }) {
    const Icon = summary.kind === 'note' ? FileText : summary.kind === 'verified' ? ShieldCheck : FileCheck2;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-lg border font-bold ${summary.tone} ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'}`}>
            <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            <span className="whitespace-nowrap">{summary.label}</span>
            {summary.count > 0 && (
                <span className="text-[9px] font-extrabold opacity-70">· {summary.count}</span>
            )}
        </span>
    );
}

function isCurrentQuarter(value: string | null | undefined, now = new Date()) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
}

function DetailStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start gap-2"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</span><span className="mt-1 block text-xs font-bold leading-relaxed text-slate-800">{value}</span></span></div></div>;
}

function RecordDetails({
    record,
    busy,
    onApprove,
    onDecline,
    onRevoke,
    onEditDraft,
    onCorrect,
}: {
    record: RecognitionRecord;
    busy: boolean;
    onApprove: () => void;
    onDecline: () => void;
    onRevoke: () => void;
    onEditDraft: () => void;
    onCorrect: () => void;
}) {
    const evidence = evidenceStatus(record.evidence);
    const actions = record.status === 'Pending Review' ? (
        <><button type="button" className="app-button app-button-danger" onClick={onDecline} disabled={busy}><XCircle className="h-4 w-4" />Decline</button><button type="button" className={primary} onClick={onApprove} disabled={busy}><CheckCircle2 className="h-4 w-4" />Approve Recognition</button></>
    ) : record.status === 'Recognized' ? (
        <button type="button" className="app-button app-button-danger" onClick={onRevoke} disabled={busy}>Revoke Recognition</button>
    ) : record.status === 'Draft' ? (
        <button type="button" className={primary} onClick={onEditDraft}>Edit Draft</button>
    ) : (
        <button type="button" className={button} onClick={onCorrect}><RotateCcw className="h-4 w-4" />Create Corrected Nomination</button>
    );

    return (
        <section>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h4 className="text-sm font-extrabold text-slate-950">{record.recipient.name}</h4>
                    <p className="mt-1 text-xs text-slate-500">{record.recipient.position ?? 'Unassigned'} · {record.recipient.department ?? 'Unassigned'} · Achievement {formatDate(record.achievementDate)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2"><StatusPill value={record.status} />{actions}</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DetailStat icon={Medal} label="Category" value={record.category?.name ?? 'Uncategorized'} />
                <DetailStat icon={Users} label="Nominated By" value={`${record.nominator.name}${record.nominator.position ? ` · ${record.nominator.position}` : ''}`} />
                <DetailStat icon={FileCheck2} label="Evidence" value={`${evidence.label}${evidence.count ? ` · ${evidence.count}` : ''}`} />
                <DetailStat icon={Clock3} label="Reviewed / Published" value={formatDate(record.recognizedAt ?? record.reviewedAt)} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h5 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Achievement / Contribution</h5>
                    <p className="mt-3 text-sm font-bold text-slate-900">{record.title}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-600">{record.achievementDetails}</p>
                    {record.replacesId && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">This nomination is linked to a prior governed record and does not overwrite its history.</p>}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Supporting Evidence</h5>
                        <EvidenceIndicator summary={evidence} />
                    </div>
                    <div className="mt-3 space-y-2">
                        {record.evidence.length ? record.evidence.map((item) => (
                            <div key={item.id ?? `${item.type}-${item.description}`} className="rounded-lg bg-slate-50 p-3">
                                <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-800">{item.type || 'Evidence'}</p>{item.sourceModule && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{item.sourceModule}</span>}</div>
                                {item.description && <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.description}</p>}
                                {item.sourceFinalizedAt && <p className="mt-1 text-[10px] font-semibold text-emerald-600">Finalized source · {formatDate(item.sourceFinalizedAt)}</p>}
                            </div>
                        )) : <p className="rounded-lg bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">No supporting evidence is attached. Review the nomination narrative before deciding.</p>}
                    </div>
                    {record.status === 'Declined' && record.declineReason && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><strong>Decline reason:</strong> {record.declineReason}</div>}
                    {record.status === 'Revoked' && record.revocationReason && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><strong>Revocation reason:</strong> {record.revocationReason}</div>}
                </section>
            </div>
        </section>
    );
}

function ReasonModal({
    title,
    description,
    confirmLabel,
    busy,
    error,
    onClose,
    onConfirm,
}: {
    title: string; description: string; confirmLabel: string; busy: boolean; error: string; onClose: () => void; onConfirm: (reason: string) => Promise<void>;
}) {
    const [reason, setReason] = useState('');
    return (
        <AppModal show title={title} description={description} onClose={onClose} maxWidth="lg" layer="confirmation" footer={<><button type="button" className={button} onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="app-button app-button-danger" disabled={busy || reason.trim().length < 3} onClick={() => void onConfirm(reason.trim())}>{busy ? 'Saving…' : confirmLabel}</button></>}>
            {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
            <Field label="Reason" required hint="Required for the governance and audit history."><textarea className={`${input} min-h-28 resize-y`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter a clear reason" /></Field>
        </AppModal>
    );
}

function ApproveModal({ record, busy, error, onClose, onConfirm }: { record: RecognitionRecord; busy: boolean; error: string; onClose: () => void; onConfirm: () => Promise<void> }) {
    return (
        <AppModal show title="Approve Recognition" description={`${record.recipient.name} · ${record.title}`} onClose={onClose} maxWidth="lg" layer="confirmation" footer={<><button type="button" className={button} onClick={onClose} disabled={busy}>Cancel</button><button type="button" className={primary} disabled={busy} onClick={() => void onConfirm()}>{busy ? 'Publishing…' : 'Approve & Publish'}</button></>}>
            {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">Approving publishes this recognition to the social recognition feed and employee history. The published record becomes immutable; corrections require governed revocation and a new nomination.</div>
        </AppModal>
    );
}

function CategoryManager({ state, onClose, onSaved }: { state: RecognitionState; onClose: () => void; onSaved: () => Promise<void> }) {
    const ordered = [...state.categories].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    const [selectedId, setSelectedId] = useState<string | 'new'>(ordered[0]?.id ?? 'new');
    const selected = ordered.find((category) => category.id === selectedId) ?? null;
    const [form, setForm] = useState(() => categoryForm(selected));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    function choose(category: RecognitionCategory | null) {
        setSelectedId(category?.id ?? 'new');
        setForm(categoryForm(category));
        setError('');
    }

    async function save() {
        if (form.name.trim().length < 3) return;
        setBusy(true); setError('');
        try {
            const payload = { ...form, code: selected ? selected.code : slugCode(form.name), name: form.name.trim(), description: form.description.trim() || null };
            if (selected) await recognitionClient.updateCategory(selected.id, payload);
            else await recognitionClient.createCategory(payload);
            await onSaved();
            onClose();
        } catch (requestError) {
            setError(recognitionError(requestError));
        } finally { setBusy(false); }
    }

    return (
        <AppModal show title="Manage Recognition Categories" description="Keep social recognition categories concise, clear, and governed." onClose={onClose} maxWidth="2xl" footer={<><button type="button" className={button} onClick={onClose} disabled={busy}>Close</button><button type="button" className={primary} onClick={() => void save()} disabled={busy || form.name.trim().length < 3}>{busy ? 'Saving…' : selected ? 'Save Category' : 'Add Category'}</button></>}>
            {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <button type="button" onClick={() => choose(null)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800"><Plus className="h-4 w-4" />Add Category</button>
                    <div className="space-y-2">{ordered.map((category) => <button key={category.id} type="button" onClick={() => choose(category)} className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedId === category.id ? 'border-amber-300 bg-white ring-1 ring-amber-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-800">{category.name}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${category.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{category.isActive ? 'Active' : 'Inactive'}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{category.description || 'No description'}</p></button>)}</div>
                </section>
                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="grid gap-4 sm:grid-cols-2"><Field label="Category name" required><input className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Display order" required><input className={input} type="number" min={0} max={999} value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></Field></div>
                    <Field label="Description"><textarea className={`${input} min-h-24 resize-y`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What kind of contribution belongs in this category?" /></Field>
                    <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><span><span className="block text-xs font-bold text-slate-700">Active category</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">Inactive categories cannot be used for new nominations. Pending nominations must be resolved before deactivation.</span></span><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" /></label>
                </section>
            </div>
        </AppModal>
    );
}

function categoryForm(category: RecognitionCategory | null) {
    return { code: category?.code ?? '', name: category?.name ?? '', description: category?.description ?? '', color: category?.color ?? 'amber', icon: category?.icon ?? 'award', isActive: category?.isActive ?? true, displayOrder: category?.displayOrder ?? 0 };
}

function slugCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'RECOGNITION_CATEGORY';
}

export default function AdminRecognition({ initialRecognitionState }: Props) {
    const [workspace, setWorkspace] = useHashWorkspace<RecognitionAdminWorkspace>(RECOGNITION_ADMIN_WORKSPACES, 'Overview');
    const [state, setState] = useState<RecognitionState | null>(() => initialState(initialRecognitionState));
    const [loading, setLoading] = useState(!state);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showNomination, setShowNomination] = useState(false);
    const [draftRecord, setDraftRecord] = useState<RecognitionRecord | null>(null);
    const [replacementRecord, setReplacementRecord] = useState<RecognitionRecord | null>(null);
    const [showCategories, setShowCategories] = useState(false);
    const [approveRecord, setApproveRecord] = useState<RecognitionRecord | null>(null);
    const [reasonAction, setReasonAction] = useState<{ type: 'decline' | 'revoke'; record: RecognitionRecord } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [modalError, setModalError] = useState('');

    async function reload() {
        setLoading(true); setError('');
        try { setState(await recognitionClient.state()); }
        catch (requestError) { setError(recognitionError(requestError)); }
        finally { setLoading(false); }
    }

    useEffect(() => { if (!state) void reload(); }, []);

    const departments = useMemo(() => [...new Set((state?.personnel ?? []).map((person) => person.department).filter(Boolean) as string[])].sort(), [state]);
    const nominators = useMemo(() => [...new Set((state?.records ?? []).map((record) => record.nominator.name))].sort(), [state]);
    const categories = useMemo(() => (state?.categories ?? []).filter((category) => category.isActive), [state]);
    const activeFilter = Object.entries(filters).some(([key, value]) => value !== EMPTY_FILTERS[key as keyof Filters]);

    const baseFiltered = useMemo(() => (state?.records ?? []).filter((record) => {
        const activity = recordActivityDate(record).slice(0, 10);
        return (filters.department === 'all' || record.recipient.department === filters.department)
            && (filters.category === 'all' || record.category?.id === filters.category)
            && (filters.nominator === 'all' || record.nominator.name === filters.nominator)
            && (!filters.from || activity >= filters.from)
            && (!filters.to || activity <= filters.to);
    }), [state, filters]);
    const registerRows = useMemo(() => baseFiltered.filter((record) => filters.status === 'all' || record.status === filters.status), [baseFiltered, filters.status]);
    const reviewRows = useMemo(() => baseFiltered.filter((record) => record.status === 'Pending Review'), [baseFiltered]);
    const recognizedRows = useMemo(() => baseFiltered.filter((record) => record.status === 'Recognized'), [baseFiltered]);
    const quarterRecognized = useMemo(() => recognizedRows.filter((record) => isCurrentQuarter(record.recognizedAt ?? record.achievementDate)), [recognizedRows]);
    const quarterPeople = useMemo(() => new Set(quarterRecognized.map((record) => record.recipient.personnelKey)).size, [quarterRecognized]);
    const quarterDepartments = useMemo(() => new Set(quarterRecognized.map((record) => record.recipient.department).filter(Boolean)).size, [quarterRecognized]);
    const recentRecognized = useMemo(() => [...recognizedRows].sort((a, b) => recordActivityDate(b).localeCompare(recordActivityDate(a))).slice(0, 5), [recognizedRows]);
    const categoryCounts = useMemo(() => {
        const counts = new Map<string, number>();
        quarterRecognized.forEach((record) => counts.set(record.category?.name ?? 'Uncategorized', (counts.get(record.category?.name ?? 'Uncategorized') ?? 0) + 1));
        return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }, [quarterRecognized]);

    function openRow(record: RecognitionRecord) { setExpandedId(record.id); }
    function goto(next: RecognitionAdminWorkspace, status: string = 'all') { setFilters((current) => ({ ...current, status })); setExpandedId(null); setWorkspace(next); }

    async function decide(record: RecognitionRecord, decision: 'Recognized' | 'Declined', reason?: string) {
        setBusyId(record.id); setModalError(''); setError('');
        try { await recognitionClient.decide(record.id, decision, reason); await reload(); setApproveRecord(null); setReasonAction(null); }
        catch (requestError) { setModalError(recognitionError(requestError)); }
        finally { setBusyId(null); }
    }

    async function revoke(record: RecognitionRecord, reason: string) {
        setBusyId(record.id); setModalError(''); setError('');
        try { await recognitionClient.revoke(record.id, reason); await reload(); setReasonAction(null); }
        catch (requestError) { setModalError(recognitionError(requestError)); }
        finally { setBusyId(null); }
    }

    if (!state) return <AuthenticatedLayout header={<h1 className="text-lg font-bold text-slate-950">Social Recognition</h1>}><Head title="Social Recognition" /><div className="app-card p-10 text-center text-sm text-slate-500">{loading ? 'Loading Social Recognition…' : error || 'Recognition state is unavailable.'}</div></AuthenticatedLayout>;

    const details = (record: RecognitionRecord) => <RecordDetails
        record={record}
        busy={busyId === record.id}
        onApprove={() => { setExpandedId(null); setModalError(''); setApproveRecord(record); }}
        onDecline={() => { setExpandedId(null); setModalError(''); setReasonAction({ type: 'decline', record }); }}
        onRevoke={() => { setExpandedId(null); setModalError(''); setReasonAction({ type: 'revoke', record }); }}
        onEditDraft={() => { setExpandedId(null); setDraftRecord(record); }}
        onCorrect={() => { setExpandedId(null); setReplacementRecord(record); }}
    />;
    const selectedRecord = expandedId ? state.records.find((record) => record.id === expandedId) ?? null : null;
    const columns = [
        { key: 'recipient', header: 'Recipient', render: (record: RecognitionRecord) => <div><p className="font-bold text-slate-900">{record.recipient.name}</p><p className="text-[11px] text-slate-400">{record.recipient.position ?? 'Unassigned'} · {record.recipient.department ?? 'Unassigned'}</p></div> },
        { key: 'recognition', header: 'Recognition', render: (record: RecognitionRecord) => <div><p className="max-w-xs truncate font-semibold text-slate-800">{record.title}</p><p className="text-[11px] text-slate-400">{record.category?.name ?? 'Uncategorized'}</p></div> },
        { key: 'nominator', header: 'Nominated By', render: (record: RecognitionRecord) => <div><p className="text-xs font-semibold text-slate-700">{record.nominator.name}</p><p className="text-[10px] text-slate-400">{record.nominator.position ?? record.nominator.role ?? '—'}</p></div> },
        { key: 'date', header: 'Achievement', render: (record: RecognitionRecord) => formatDate(record.achievementDate) },
        { key: 'evidence', header: 'Evidence', render: (record: RecognitionRecord) => { const evidence = evidenceStatus(record.evidence); return <EvidenceIndicator summary={evidence} compact />; } },
        { key: 'status', header: 'Status', render: (record: RecognitionRecord) => <StatusPill value={record.status} /> },
    ];

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-lg font-bold text-slate-950">Social Recognition</h1>}>
            <Head title="Social Recognition" />
            <HeaderFilters active={activeFilter} onReset={() => setFilters(EMPTY_FILTERS)}>
                <SystemSelect aria-label="Department" value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}><option value="all">All Departments</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</SystemSelect>
                <SystemSelect aria-label="Category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="all">All Categories</option>{state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</SystemSelect>
                <SystemSelect aria-label="Nominator" value={filters.nominator} onChange={(event) => setFilters({ ...filters, nominator: event.target.value })}><option value="all">All Nominators</option>{nominators.map((name) => <option key={name} value={name}>{name}</option>)}</SystemSelect>
                {workspace === 'Recognition Register' && <SystemSelect aria-label="Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">All Statuses</option><option>Draft</option><option>Pending Review</option><option>Recognized</option><option>Declined</option><option>Revoked</option></SystemSelect>}
                <input aria-label="From date" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
                <input aria-label="To date" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
            </HeaderFilters>
            <HeaderActions>
                {state.actor.canManageCategories && <button type="button" className={button} onClick={() => setShowCategories(true)}><Settings2 className="h-4 w-4" />Manage Categories</button>}
                <button type="button" className={primary} onClick={() => setShowNomination(true)}><Plus className="h-4 w-4" />Nominate Employee</button>
            </HeaderActions>

            {selectedRecord && <AppModal
                show
                title="Recognition Details"
                description={`${selectedRecord.recipient.name} · ${selectedRecord.title}`}
                onClose={() => setExpandedId(null)}
                maxWidth="2xl"
            >
                {details(selectedRecord)}
            </AppModal>}

            {showNomination && <RecognitionNominationForm state={state} onClose={() => setShowNomination(false)} onSaved={reload} />}
            {draftRecord && <RecognitionNominationForm state={state} record={draftRecord} onClose={() => setDraftRecord(null)} onSaved={reload} />}
            {replacementRecord && <RecognitionNominationForm state={state} replacementOf={replacementRecord} onClose={() => setReplacementRecord(null)} onSaved={reload} />}
            {showCategories && <CategoryManager state={state} onClose={() => setShowCategories(false)} onSaved={reload} />}
            {approveRecord && <ApproveModal record={approveRecord} busy={busyId === approveRecord.id} error={modalError} onClose={() => { setApproveRecord(null); setModalError(''); }} onConfirm={() => decide(approveRecord, 'Recognized')} />}
            {reasonAction && <ReasonModal title={reasonAction.type === 'decline' ? 'Decline Recognition' : 'Revoke Recognition'} description={reasonAction.type === 'decline' ? `${reasonAction.record.recipient.name} · ${reasonAction.record.title}` : 'The published record remains in history and is marked Revoked.'} confirmLabel={reasonAction.type === 'decline' ? 'Confirm Decline' : 'Confirm Revocation'} busy={busyId === reasonAction.record.id} error={modalError} onClose={() => { setReasonAction(null); setModalError(''); }} onConfirm={(reason) => reasonAction.type === 'decline' ? decide(reasonAction.record, 'Declined', reason) : revoke(reasonAction.record, reason)} />}

            <div className="app-page app-page-enter space-y-4">
                {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <StatCard label="Pending Review" value={reviewRows.length} icon={Clock3} onClick={() => goto('Review Queue')} />
                    <StatCard label="Recognized This Quarter" value={quarterRecognized.length} icon={Award} onClick={() => goto('Recognition Register', 'Recognized')} />
                    <StatCard label="People Recognized" value={quarterPeople} icon={UserRoundCheck} onClick={() => goto('Recognition Register', 'Recognized')} />
                    <StatCard label="Departments Reached" value={quarterDepartments} icon={Building2} onClick={() => goto('Recognition Register', 'Recognized')} />
                </div>

                {workspace === 'Overview' && (
                    <>
                        <div className="grid gap-4 xl:grid-cols-2">
                            <DataTable title="Needs Review" data={reviewRows.slice(0, 5)} rowKey={(record) => record.id} pageSize={5} onRowClick={openRow} getRowLabel={(record) => `Open ${record.recipient.name} recognition review`} columns={columns.filter((column) => !['status'].includes(column.key))} emptyTitle="Review queue is clear" emptyDescription="New nominations awaiting governance review will appear here." />
                            <DataTable title="Recent Recognitions" data={recentRecognized} rowKey={(record) => record.id} pageSize={5} onRowClick={openRow} getRowLabel={(record) => `Open ${record.recipient.name} recognized record`} columns={columns.filter((column) => ['recipient', 'recognition', 'date'].includes(column.key))} emptyTitle="No recognized records yet" emptyDescription="Approved social recognitions will appear here." />
                        </div>
                        <section className="app-card p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-700" /><h2 className="text-sm font-bold text-slate-950">Recognition by Category</h2></div><p className="mt-1 text-xs text-slate-500">Simple current-quarter distribution of published recognitions.</p></div><button type="button" className="text-xs font-bold text-amber-700" onClick={() => goto('Recognition Register', 'Recognized')}>Open Register</button></div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{categoryCounts.length ? categoryCounts.map((row) => <button key={row.name} type="button" onClick={() => { const category = state.categories.find((item) => item.name === row.name); if (category) setFilters((current) => ({ ...current, category: category.id, status: 'Recognized' })); setWorkspace('Recognition Register'); }} className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-amber-200 hover:bg-amber-50/30"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-800">{row.name}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-700">{row.count}</span></div></button>) : <p className="col-span-full py-6 text-center text-xs text-slate-400">No recognized activity in the current quarter.</p>}</div>
                        </section>
                    </>
                )}

                {workspace === 'Review Queue' && (
                    <DataTable title="Review Queue" data={reviewRows} rowKey={(record) => record.id} onRowClick={openRow} getRowLabel={(record) => `Open ${record.recipient.name} recognition review`} columns={columns.filter((column) => column.key !== 'status')} emptyTitle="Review queue is clear" emptyDescription="Only nominations waiting for Admin/HR review appear here." />
                )}

                {workspace === 'Recognition Register' && (
                    <DataTable title="Recognition Register" data={registerRows} rowKey={(record) => record.id} onRowClick={openRow} getRowLabel={(record) => `Open ${record.recipient.name} recognition record`} columns={columns} emptyTitle="No recognition records found" emptyDescription="Try changing the header filters or create a nomination." footer={<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{registerRows.length} record(s)</span>{activeFilter && <button type="button" className="font-bold text-amber-700" onClick={() => setFilters(EMPTY_FILTERS)}>Reset filters</button>}</div>} />
                )}
            </div>
        </AuthenticatedLayout>
    );
}
