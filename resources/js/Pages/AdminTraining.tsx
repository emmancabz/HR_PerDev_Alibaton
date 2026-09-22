import DataTable from "@/Components/DataTable";
import { AppModal, Field } from "@/Components/Competency/CompetencyUI";
import StatCard from "@/Components/StatCard";
import SystemSelect from "@/Components/SystemSelect";
import AuthenticatedLayout, { HeaderFilters } from "@/Layouts/AuthenticatedLayout";
import {
    TRAINING_WORKSPACES,
    normalizeTrainingState,
    type TrainingEnrollment,
    type TrainingProgram,
    type TrainingRecommendation,
    type TrainingSession,
    type TrainingState,
    type TrainingWorkspace,
} from "@/data/training";
import { trainingClient, trainingError } from "@/data/trainingClient";
import { useHashWorkspace } from "@/workspaceNavigation";
import { Head } from "@inertiajs/react";
import {
    AlertCircle,
    CalendarCheck2,
    CalendarClock,
    CalendarDays,
    CheckCircle2,
    Clock3,
    MapPin,
    RefreshCcw,
    RotateCcw,
    ShieldCheck,
    UserCheck,
    Users,
    type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const card = "app-card";
const button = "app-button";
const primary = `${button} app-button-primary`;
const input = "app-control";

type Props = { initialTrainingState?: unknown };

type RequirementGroup = {
    key: string;
    title: string;
    programId: string | null;
    programTitle: string | null;
    requirements: TrainingRecommendation[];
    ready: number;
    waiting: number;
    source: string;
};

type RegisterRow = {
    key: string;
    program: TrainingProgram;
    session: TrainingSession;
    participants: TrainingEnrollment[];
    displayStatus: string;
    completionCount: number;
    pendingCount: number;
};

type RecordRow = {
    key: string;
    enrollment: TrainingEnrollment;
    program: TrainingProgram | null;
    completedAt: string;
    attendanceRate: string;
    result: string;
};

type Filters = {
    training: string;
    department: string;
    source: string;
    readiness: string;
    status: string;
    facilitator: string;
    date: string;
    result: string;
    certificate: string;
};

const EMPTY_FILTERS: Filters = {
    training: "all",
    department: "all",
    source: "all",
    readiness: "all",
    status: "all",
    facilitator: "all",
    date: "",
    result: "all",
    certificate: "all",
};

function initial(value: unknown): TrainingState | null {
    try {
        return value == null ? null : normalizeTrainingState(value);
    } catch {
        return null;
    }
}

function StatusPill({ value }: { value: string }) {
    const normalized = value.toLowerCase();
    const tone = normalized.includes("ready") || normalized.includes("completed") || normalized.includes("passed") || normalized.includes("verified")
        ? "bg-emerald-50 text-emerald-700"
        : normalized.includes("cancel") || normalized.includes("failed") || normalized.includes("absent")
          ? "bg-rose-50 text-rose-700"
          : normalized.includes("waiting") || normalized.includes("pending") || normalized.includes("mapping") || normalized.includes("retraining")
            ? "bg-amber-50 text-amber-800"
            : normalized.includes("scheduled") || normalized.includes("ongoing")
              ? "bg-blue-50 text-blue-700"
              : "bg-slate-100 text-slate-600";
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{value}</span>;
}

export default function AdminTraining({ initialTrainingState }: Props) {
    const [workspace, setWorkspace] = useHashWorkspace<TrainingWorkspace>(TRAINING_WORKSPACES, "Overview");
    const [state, setState] = useState<TrainingState | null>(() => initial(initialTrainingState));
    const [loading, setLoading] = useState(!state);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [expandedRequirement, setExpandedRequirement] = useState<string | null>(null);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
    const [scheduleGroup, setScheduleGroup] = useState<RequirementGroup | null>(null);
    const [rescheduleRow, setRescheduleRow] = useState<RegisterRow | null>(null);
    const [cancelRow, setCancelRow] = useState<RegisterRow | null>(null);
    const workspaceFilterPreset = useRef<Partial<Filters> | null>(null);
    const workspaceExpandedSession = useRef<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setState(await trainingClient.state());
        } catch (cause) {
            setError(trainingError(cause));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!state) void load();
    }, [load, state]);

    useEffect(() => {
        const preset = workspaceFilterPreset.current;
        setFilters(preset ? { ...EMPTY_FILTERS, ...preset } : EMPTY_FILTERS);
        workspaceFilterPreset.current = null;
        setExpandedRequirement(null);
        setExpandedSession(workspaceExpandedSession.current);
        workspaceExpandedSession.current = null;
        setExpandedRecord(null);
    }, [workspace]);

    const openWorkspace = useCallback((next: TrainingWorkspace, preset?: Partial<Filters>, sessionId?: string | null) => {
        if (next === workspace) {
            setFilters(preset ? { ...EMPTY_FILTERS, ...preset } : EMPTY_FILTERS);
            setExpandedSession(sessionId ?? null);
            return;
        }
        workspaceFilterPreset.current = preset ?? null;
        workspaceExpandedSession.current = sessionId ?? null;
        setWorkspace(next);
    }, [setWorkspace, workspace]);

    const programsById = useMemo(() => new Map((state?.programs ?? []).map((program) => [program.id, program])), [state]);

    const requirementGroups = useMemo<RequirementGroup[]>(() => {
        if (!state) return [];
        const open = state.recommendations.filter((row) => ["Ready", "Waiting", "Needs Mapping"].includes(row.readiness));
        const groups = new Map<string, TrainingRecommendation[]>();
        for (const row of open) {
            const key = row.recommendedProgramId ?? `need:${row.developmentNeed.trim().toLowerCase()}`;
            groups.set(key, [...(groups.get(key) ?? []), row]);
        }
        return Array.from(groups.entries()).map(([key, rows]) => {
            const program = rows.find((row) => row.recommendedProgramId)?.recommendedProgramTitle ?? null;
            const sources = Array.from(new Set(rows.map((row) => row.sourceLabel)));
            return {
                key,
                title: program ?? rows[0]?.developmentNeed ?? "Training Requirement",
                programId: rows.find((row) => row.recommendedProgramId)?.recommendedProgramId ?? null,
                programTitle: program,
                requirements: rows,
                ready: rows.filter((row) => row.readiness === "Ready").length,
                waiting: rows.filter((row) => row.readiness !== "Ready").length,
                source: sources.length === 1 ? sources[0] : "Multiple development sources",
            };
        }).sort((a, b) => b.ready - a.ready || a.title.localeCompare(b.title));
    }, [state]);

    const registerRows = useMemo<RegisterRow[]>(() => {
        if (!state) return [];
        return state.programs.filter((program) => !["Archived", "Cancelled"].includes(program.status)).flatMap((program) => program.sessions
            .filter((session) => session.status !== "Draft")
            .map((session) => {
                const participants = state.enrollments.filter((enrollment) => enrollment.sessions.some((link) =>
                    link.sessionId === session.id && !["Withdrawn", "Cancelled"].includes(link.participationStatus),
                ));
                const pendingCount = participants.filter((row) => !row.completion).length;
                const completionCount = participants.length - pendingCount;
                const displayStatus = session.status === "Completed" && pendingCount > 0
                    ? "Pending Finalization"
                    : session.status === "Ongoing" && new Date(session.endsAt).getTime() < Date.now() && !session.attendanceFinalizedAt
                      ? "Pending Attendance"
                      : session.status;
                return { key: session.id, program, session, participants, displayStatus, completionCount, pendingCount };
            }))
            .sort((a, b) => new Date(b.session.startsAt).getTime() - new Date(a.session.startsAt).getTime());
    }, [state]);

    const records = useMemo<RecordRow[]>(() => {
        if (!state) return [];
        return state.enrollments.filter((row) => row.completion).map((enrollment) => ({
            key: enrollment.id,
            enrollment,
            program: programsById.get(enrollment.programId) ?? null,
            completedAt: enrollment.completion?.finalizedAt ?? enrollment.assignedAt,
            attendanceRate: enrollment.completion?.attendanceRate ?? "0",
            result: enrollment.completion?.status ?? "Pending",
        })).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    }, [programsById, state]);

    const filteredRequirements = useMemo(() => requirementGroups.filter((group) => {
        if (filters.training !== "all" && group.key !== filters.training && group.programId !== filters.training) return false;
        if (filters.department !== "all" && !group.requirements.some((row) => row.department === filters.department)) return false;
        if (filters.source !== "all" && !group.requirements.some((row) => row.sourceLabel === filters.source)) return false;
        if (filters.readiness === "ready" && group.ready === 0) return false;
        if (filters.readiness === "waiting" && group.waiting === 0) return false;
        return true;
    }), [filters, requirementGroups]);

    const filteredRegister = useMemo(() => registerRows.filter((row) => {
        if (filters.training !== "all" && row.program.id !== filters.training) return false;
        if (filters.status === "Pending Action" && !["Pending Attendance", "Pending Finalization"].includes(row.displayStatus)) return false;
        if (filters.status !== "all" && filters.status !== "Pending Action" && row.displayStatus !== filters.status) return false;
        if (filters.facilitator !== "all" && (row.session.facilitator ?? "") !== filters.facilitator) return false;
        if (filters.department !== "all" && !row.participants.some((item) => item.department === filters.department)) return false;
        if (filters.date && localDate(row.session.startsAt) !== filters.date) return false;
        return true;
    }), [filters, registerRows]);

    const filteredRecords = useMemo(() => records.filter((row) => {
        if (filters.training !== "all" && row.program?.id !== filters.training) return false;
        if (filters.department !== "all" && row.enrollment.department !== filters.department) return false;
        if (filters.result !== "all" && row.result !== filters.result) return false;
        if (filters.certificate !== "all") {
            const certificate = row.enrollment.completion?.certificate;
            const value = certificate ? certificate.status : "None";
            if (value !== filters.certificate) return false;
        }
        if (filters.date && localDate(row.completedAt) !== filters.date) return false;
        return true;
    }), [filters, records]);

    const metrics = useMemo(() => ({
        ready: state?.recommendations.filter((row) => row.readiness === "Ready").length ?? 0,
        upcoming: registerRows.filter((row) => row.session.status === "Scheduled").length,
        ongoing: registerRows.filter((row) => row.displayStatus === "Ongoing").length,
        pending: registerRows.filter((row) => ["Pending Attendance", "Pending Finalization"].includes(row.displayStatus)).length,
    }), [registerRows, state]);

    if (loading || !state) {
        return <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Training Management</h1>}><Head title="Training Management" /><div className="app-page"><section className={`${card} p-8 text-center`}>
            {error ? <><AlertCircle className="mx-auto h-7 w-7 text-rose-500" /><h2 className="mt-2 text-sm font-extrabold text-slate-900">Training Management could not be loaded</h2><p className="mt-1 text-xs text-slate-500">{error}</p><button type="button" className={`${primary} mt-4`} onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Retry</button></> : <p className="text-sm font-semibold text-slate-500">Loading Training Management…</p>}
        </section></div></AuthenticatedLayout>;
    }

    const departments = Array.from(new Set(state.personnel.map((row) => row.department).filter(Boolean))).sort();
    const sources = Array.from(new Set(state.recommendations.map((row) => row.sourceLabel).filter(Boolean))).sort();
    const facilitators = Array.from(new Set(registerRows.map((row) => row.session.facilitator).filter((value): value is string => Boolean(value)))).sort();
    const activePrograms = state.programs.filter((program) => program.status === "Active" && (Boolean(program.relatedLearningCourseId) || program.competencies.length > 0)).sort((a, b) => a.title.localeCompare(b.title));
    const registerStatuses = Array.from(new Set([
        ...(metrics.pending > 0 ? ["Pending Action"] : []),
        ...registerRows.map((row) => row.displayStatus),
    ])).sort();
    const resultOptions = Array.from(new Set(records.map((row) => row.result))).sort();
    const certificateOptions = Array.from(new Set(records.map((row) => row.enrollment.completion?.certificate?.status ?? "None"))).sort();
    const activeFilter = Object.entries(filters).some(([key, value]) => value !== (EMPTY_FILTERS as Record<string, string>)[key]);

    const mutate = async (job: () => Promise<TrainingState>, success: string) => {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            setState(await job());
            setNotice(success);
        } catch (cause) {
            setError(trainingError(cause));
            return false;
        } finally {
            setBusy(false);
        }
        return true;
    };

    const selectedRequirement = expandedRequirement ? requirementGroups.find((row) => row.key === expandedRequirement) ?? null : null;
    const selectedSession = expandedSession ? registerRows.find((row) => row.key === expandedSession) ?? null : null;
    const selectedRecord = expandedRecord ? records.find((row) => row.key === expandedRecord) ?? null : null;

    return <AuthenticatedLayout
        header={<h1 className="truncate text-sm font-bold text-slate-900">Training Management</h1>}
    >
        <Head title="Training Management" />
        <HeaderFilters active={activeFilter} onReset={() => setFilters(EMPTY_FILTERS)}>
            {workspace !== "Training Records" && <SystemSelect aria-label="Training" value={filters.training} onChange={(event) => setFilters((current) => ({ ...current, training: event.target.value }))}>
                <option value="all">All training</option>
                {workspace === "Overview"
                    ? requirementGroups.map((group) => <option key={group.key} value={group.programId ?? group.key}>{group.title}</option>)
                    : activePrograms.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
            </SystemSelect>}
            {workspace === "Training Records" && <SystemSelect aria-label="Training" value={filters.training} onChange={(event) => setFilters((current) => ({ ...current, training: event.target.value }))}>
                <option value="all">All training</option>
                {state.programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
            </SystemSelect>}
            <SystemSelect aria-label="Department" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
                <option value="all">All departments</option>{departments.map((value) => <option key={value}>{value}</option>)}
            </SystemSelect>
            {workspace === "Overview" && <>
                <SystemSelect aria-label="Requirement source" value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}>
                    <option value="all">All sources</option>{sources.map((value) => <option key={value}>{value}</option>)}
                </SystemSelect>
                <SystemSelect aria-label="Readiness" value={filters.readiness} onChange={(event) => setFilters((current) => ({ ...current, readiness: event.target.value }))}>
                    <option value="all">All readiness</option><option value="ready">Ready to schedule</option><option value="waiting">Waiting / needs mapping</option>
                </SystemSelect>
            </>}
            {workspace === "Training Register" && <>
                <SystemSelect aria-label="Status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                    <option value="all">All statuses</option>{registerStatuses.map((value) => <option key={value}>{value}</option>)}
                </SystemSelect>
                <SystemSelect aria-label="Facilitator" value={filters.facilitator} onChange={(event) => setFilters((current) => ({ ...current, facilitator: event.target.value }))}>
                    <option value="all">All facilitators</option>{facilitators.map((value) => <option key={value}>{value}</option>)}
                </SystemSelect>
            </>}
            {workspace === "Training Records" && <>
                <SystemSelect aria-label="Completion result" value={filters.result} onChange={(event) => setFilters((current) => ({ ...current, result: event.target.value }))}>
                    <option value="all">All results</option>{resultOptions.map((value) => <option key={value}>{value}</option>)}
                </SystemSelect>
                <SystemSelect aria-label="Certificate status" value={filters.certificate} onChange={(event) => setFilters((current) => ({ ...current, certificate: event.target.value }))}>
                    <option value="all">All certificate states</option>{certificateOptions.map((value) => <option key={value}>{value}</option>)}
                </SystemSelect>
            </>}
            {workspace !== "Overview" && <input aria-label={workspace === "Training Records" ? "Completion date" : "Training date"} type="date" value={filters.date} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))} />}
        </HeaderFilters>

        <div className="app-page app-page-enter">
            {notice && <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
            {error && <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

            {workspace === "Overview" && <>
                <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <StatCard label="Ready to Schedule" value={metrics.ready} icon={CalendarCheck2} onClick={() => { setFilters({ ...EMPTY_FILTERS, readiness: "ready" }); setExpandedRequirement(null); }} />
                    <StatCard label="Upcoming Training" value={metrics.upcoming} icon={CalendarClock} onClick={() => openWorkspace("Training Register", { status: "Scheduled" })} />
                    <StatCard label="Ongoing" value={metrics.ongoing} icon={Clock3} onClick={() => openWorkspace("Training Register", { status: "Ongoing" })} />
                    <StatCard label="Pending Finalization" value={metrics.pending} icon={ShieldCheck} onClick={() => openWorkspace("Training Register", { status: "Pending Action" })} />
                </section>

                <div className="mt-4 space-y-4">
                    <DataTable
                        title="Training Requirements"
                        data={filteredRequirements}
                        rowKey={(row) => row.key}
                        pageSize={10}
                        onRowClick={(row) => setExpandedRequirement(row.key)}
                        getRowLabel={(row) => `Open ${row.title} training requirements`}
                        emptyTitle="No open facilitated or practical training requirements"
                        emptyDescription="Verified development needs will appear here when practical or facilitated Training is required."
                        columns={[
                            { key: "training", header: "Required Training", render: (row) => <div><p className="font-bold text-slate-900">{row.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{row.programId ? "Governed training definition matched" : "Training definition requires review"}</p></div> },
                            { key: "ready", header: "Ready", className: "w-24", render: (row) => <span className="font-extrabold tabular-nums text-emerald-700">{row.ready}</span> },
                            { key: "waiting", header: "Waiting", className: "w-24", render: (row) => <span className="font-extrabold tabular-nums text-amber-700">{row.waiting}</span> },
                            { key: "source", header: "Primary Need", render: (row) => <span className="text-xs font-semibold text-slate-600">{row.source}</span> },
                            { key: "status", header: "Readiness", className: "w-40", render: (row) => <StatusPill value={row.ready > 0 ? "Ready to Schedule" : row.programId ? "Waiting" : "Needs Mapping"} /> },
                        ]}
                    />

                    <DataTable
                        title="Upcoming & Active Training"
                        data={filteredRegister.filter((row) => ["Scheduled", "Ongoing", "Pending Attendance", "Pending Finalization"].includes(row.displayStatus))}
                        rowKey={(row) => row.key}
                        pageSize={10}
                        onRowClick={(row) => setExpandedSession(row.key)}
                        emptyTitle="No scheduled or active training"
                        emptyDescription="Once a ready requirement is scheduled, its session will appear here."
                        columns={registerColumns()}
                    />
                </div>
            </>}

            {workspace === "Training Register" && <DataTable
                title="Training Register"
                data={filteredRegister}
                rowKey={(row) => row.key}
                pageSize={10}
                onRowClick={(row) => setExpandedSession(row.key)}
                getRowLabel={(row) => `Open ${row.program.title} training details`}
                emptyTitle="No training sessions match the current filters"
                emptyDescription="Ready requirements are scheduled from the Overview instead of being created as blank events."
                columns={registerColumns()}
            />}

            {workspace === "Training Records" && <DataTable
                title="Training Records"
                data={filteredRecords}
                rowKey={(row) => row.key}
                pageSize={10}
                onRowClick={(row) => setExpandedRecord(row.key)}
                getRowLabel={(row) => `Open ${row.enrollment.participant} training record`}
                emptyTitle="No finalized Training records match the current filters"
                emptyDescription="Finalized attendance, practical outcomes, completions, and certificates remain traceable here."
                columns={[
                    { key: "employee", header: "Employee", render: (row) => <div><p className="font-bold text-slate-900">{row.enrollment.participant}</p><p className="mt-0.5 text-[11px] text-slate-400">{row.enrollment.position} · {row.enrollment.department}</p></div> },
                    { key: "training", header: "Training", render: (row) => <div><p className="font-semibold text-slate-800">{row.program?.title ?? "Training"}</p><p className="mt-0.5 text-[11px] text-slate-400">{row.program?.code ?? "—"}</p></div> },
                    { key: "date", header: "Finalized", render: (row) => <span className="text-xs font-semibold text-slate-600">{formatDate(row.completedAt)}</span> },
                    { key: "attendance", header: "Attendance", className: "w-28", render: (row) => <span className="font-bold tabular-nums text-slate-800">{Number(row.attendanceRate).toFixed(0)}%</span> },
                    { key: "result", header: "Result", className: "w-28", render: (row) => <StatusPill value={row.result} /> },
                    { key: "certificate", header: "Certificate", className: "w-32", render: (row) => <StatusPill value={row.enrollment.completion?.certificate?.status ?? "None"} /> },
                ]}
            />}
        </div>

        {selectedRequirement && <AppModal
            show
            title="Training Requirement"
            description={selectedRequirement.title}
            onClose={() => setExpandedRequirement(null)}
            maxWidth="2xl"
        >
            <RequirementDetails group={selectedRequirement} busy={busy} onSchedule={() => { setExpandedRequirement(null); setScheduleGroup(selectedRequirement); }} />
        </AppModal>}

        {selectedSession && <AppModal
            show
            title="Training Details"
            description={`${selectedSession.program.title} · ${formatDateTime(selectedSession.session.startsAt)}`}
            onClose={() => setExpandedSession(null)}
            maxWidth="2xl"
        >
            <TrainingDetails
                row={selectedSession}
                canFinalize={state.actor.canFinalize}
                busy={busy}
                onReschedule={() => { setExpandedSession(null); setRescheduleRow(selectedSession); }}
                onCancel={() => { setExpandedSession(null); setCancelRow(selectedSession); }}
                onRefreshAttendance={() => void mutate(() => trainingClient.syncWorkforce(selectedSession.session.id), "Attendance evidence refreshed.")}
                onFinalizeAttendance={() => void mutate(() => trainingClient.finalizeAttendance(selectedSession.session.id), "Attendance finalized and locked.")}
                onComplete={() => void mutate(() => trainingClient.transitionSession(selectedSession.session.id, "Completed"), "Training session marked Completed.")}
                onFinalizeReady={() => void mutate(() => trainingClient.finalizeReadyParticipants(selectedSession.session.id), "Ready participant completions finalized.")}
            />
        </AppModal>}

        {selectedRecord && <AppModal
            show
            title="Finalized Training Record"
            description={`${selectedRecord.enrollment.participant} · ${selectedRecord.program?.title ?? "Training"}`}
            onClose={() => setExpandedRecord(null)}
            maxWidth="2xl"
        >
            <RecordDetails row={selectedRecord} />
        </AppModal>}

        {scheduleGroup && <ScheduleTrainingModal state={state} group={scheduleGroup} busy={busy} error={error} onClose={() => { setScheduleGroup(null); setError(""); }} onSchedule={async (payload) => {
            if (await mutate(() => trainingClient.scheduleRequirements(payload), "Training session scheduled from ready development requirements.")) setScheduleGroup(null);
        }} />}
        {rescheduleRow && <RescheduleModal state={state} row={rescheduleRow} busy={busy} error={error} onClose={() => { setRescheduleRow(null); setError(""); }} onSave={async (payload) => {
            if (await mutate(() => trainingClient.updateSession(rescheduleRow.program.id, rescheduleRow.session.id, payload), "Training schedule updated.")) setRescheduleRow(null);
        }} />}
        {cancelRow && <CancelTrainingModal row={cancelRow} busy={busy} error={error} onClose={() => { setCancelRow(null); setError(""); }} onConfirm={async (reason) => {
            if (await mutate(() => trainingClient.transitionSession(cancelRow.session.id, "Cancelled", reason), "Training session cancelled. Affected participants returned to the scheduling queue.")) setCancelRow(null);
        }} />}
    </AuthenticatedLayout>;
}

function registerColumns() {
    return [
        { key: "training", header: "Training", render: (row: RegisterRow) => <div><p className="font-bold text-slate-900">{row.program.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{row.program.deliveryType} · {row.program.code}</p></div> },
        { key: "schedule", header: "Schedule", render: (row: RegisterRow) => <div><p className="text-xs font-semibold text-slate-700">{formatDateTime(row.session.startsAt)}</p><p className="mt-0.5 text-[11px] text-slate-400">{row.session.venue}</p></div> },
        { key: "facilitator", header: "Facilitator", render: (row: RegisterRow) => <span className="text-xs font-semibold text-slate-600">{row.session.facilitator ?? "Not assigned"}</span> },
        { key: "participants", header: "Participants", className: "w-28", render: (row: RegisterRow) => <span className="font-extrabold tabular-nums text-slate-800">{row.participants.length}</span> },
        { key: "progress", header: "Progress", className: "w-36", render: (row: RegisterRow) => <div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#F4B400]" style={{ width: `${row.participants.length ? Math.round((row.completionCount / row.participants.length) * 100) : 0}%` }} /></div><p className="mt-1 text-[10px] font-semibold text-slate-400">{row.completionCount}/{row.participants.length} finalized</p></div> },
        { key: "status", header: "Status", className: "w-40", render: (row: RegisterRow) => <StatusPill value={row.displayStatus} /> },
    ];
}

function RequirementDetails({ group, busy, onSchedule }: { group: RequirementGroup; busy: boolean; onSchedule: () => void }) {
    const schedulable = group.requirements.some((row) => ["Ready", "Needs Mapping"].includes(row.readiness));
    return <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-700">Development-driven training</p>
                <h4 className="mt-1 text-sm font-extrabold text-slate-950">{group.title}</h4>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">The system groups people who share the same facilitated or practical requirement. Only people whose prerequisites are satisfied are scheduled.</p>
            </div>
            <button type="button" className={primary} disabled={busy || !schedulable} onClick={onSchedule}><CalendarCheck2 className="h-4 w-4" />{group.programId ? "Schedule Training" : "Resolve & Schedule"}</button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left">
                <thead><tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Why Required</th><th className="px-3 py-2">Prerequisite</th><th className="px-3 py-2">Readiness</th></tr></thead>
                <tbody>{group.requirements.map((row) => <tr key={row.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2.5"><p className="text-xs font-bold text-slate-900">{row.participant}</p><p className="mt-0.5 text-[10px] text-slate-400">{row.position} · {row.department}</p></td><td className="px-3 py-2.5"><p className="text-xs font-semibold text-slate-700">{row.sourceLabel}</p><p className="mt-0.5 max-w-sm text-[10px] leading-relaxed text-slate-400">{row.reason}</p></td><td className="px-3 py-2.5"><p className="text-xs font-semibold text-slate-700">{row.prerequisiteTitle ?? "No learning prerequisite"}</p><p className="mt-0.5 text-[10px] text-slate-400">{row.prerequisiteStatus}</p></td><td className="px-3 py-2.5"><StatusPill value={row.readiness} /></td></tr>)}</tbody>
            </table>
        </div>
    </section>;
}

function TrainingDetails({ row, canFinalize, busy, onReschedule, onCancel, onRefreshAttendance, onFinalizeAttendance, onComplete, onFinalizeReady }: {
    row: RegisterRow; canFinalize: boolean; busy: boolean; onReschedule: () => void; onCancel: () => void; onRefreshAttendance: () => void; onFinalizeAttendance: () => void; onComplete: () => void; onFinalizeReady: () => void;
}) {
    const allAttendanceReady = row.participants.length > 0 && row.participants.every((enrollment) => {
        const link = enrollment.sessions.find((session) => session.sessionId === row.session.id);
        return link?.attendance && link.attendance.trainingStatus !== "Pending";
    });
    const readyForCompletion = row.participants.filter((enrollment) => {
        if (enrollment.completion) return false;
        const link = enrollment.sessions.find((session) => session.sessionId === row.session.id);
        const attendance = link?.attendance?.trainingStatus;
        if (inList(attendance, ["Absent", "Excused"])) return true;
        const rules = row.program.completionRules;
        if (!rules.assessmentRequired) return true;
        return inList(enrollment.assessment?.result, ["Passed", "Failed", "Needs Improvement"]);
    }).length;

    return <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-extrabold text-slate-950">{row.program.title}</h4><StatusPill value={row.displayStatus} /></div>
                <p className="mt-1 text-xs text-slate-500">{row.program.deliveryType} · {row.program.category}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
                {row.session.status === "Scheduled" && <><button type="button" className={button} disabled={busy} onClick={onReschedule}>Reschedule</button><button type="button" className={button} disabled={busy} onClick={onCancel}>Cancel Training</button></>}
                {row.session.status === "Ongoing" && <><button type="button" className={button} disabled={busy} onClick={onCancel}>Cancel Training</button><button type="button" className={button} disabled={busy} onClick={onRefreshAttendance}><RefreshCcw className="h-3.5 w-3.5" />Refresh Attendance</button>{canFinalize && !row.session.attendanceFinalizedAt && <button type="button" className={primary} disabled={busy || !allAttendanceReady} onClick={onFinalizeAttendance}>Finalize Attendance</button>}{canFinalize && row.session.attendanceFinalizedAt && <button type="button" className={primary} disabled={busy} onClick={onComplete}>Complete Session</button>}</>}
                {row.session.status === "Completed" && canFinalize && row.pendingCount > 0 && <button type="button" className={primary} disabled={busy || readyForCompletion === 0} onClick={onFinalizeReady}>Finalize Session Outcomes ({readyForCompletion})</button>}
            </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Summary icon={CalendarDays} label="Schedule" value={formatDateTime(row.session.startsAt)} />
            <Summary icon={MapPin} label="Venue" value={row.session.venue} />
            <Summary icon={UserCheck} label="Facilitator" value={row.session.facilitator ?? "Not assigned"} />
            <Summary icon={Users} label="Participants" value={`${row.participants.length} / ${row.session.capacity}`} />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left">
                <thead><tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2">Practical / Facilitated Result</th><th className="px-3 py-2">Completion</th></tr></thead>
                <tbody>{row.participants.length === 0 ? <tr><td colSpan={4} className="px-3 py-7 text-center text-xs text-slate-400">No participants are assigned to this session.</td></tr> : row.participants.map((enrollment) => {
                    const link = enrollment.sessions.find((session) => session.sessionId === row.session.id);
                    const attendance = link?.attendance;
                    const result = enrollment.assessment?.result ?? "Pending";
                    const completion = enrollment.completion?.status ?? (result === "Failed" || result === "Needs Improvement" ? "Needs Retraining" : "Pending");
                    return <tr key={enrollment.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2.5"><p className="text-xs font-bold text-slate-900">{enrollment.participant}</p><p className="mt-0.5 text-[10px] text-slate-400">{enrollment.position} · {enrollment.department}</p></td><td className="px-3 py-2.5"><StatusPill value={attendance?.trainingStatus ?? "Pending"} />{attendance?.finalizedAt && <p className="mt-1 text-[10px] font-semibold text-emerald-600">Verified & locked</p>}</td><td className="px-3 py-2.5"><StatusPill value={result} />{enrollment.assessment?.notes && <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-slate-400">{enrollment.assessment.notes}</p>}</td><td className="px-3 py-2.5"><StatusPill value={completion} /></td></tr>;
                })}</tbody>
            </table>
        </div>
        {row.session.status === "Ongoing" && !allAttendanceReady && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Waiting for verified attendance or authorized facilitator input before the session can be finalized.</p>}
    </section>;
}

function RecordDetails({ row }: { row: RecordRow }) {
    const completion = row.enrollment.completion;
    return <section>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-700">Finalized Training Record</p><h4 className="mt-1 text-sm font-extrabold text-slate-950">{row.enrollment.participant} · {row.program?.title ?? "Training"}</h4><p className="mt-1 text-xs text-slate-500">Finalized {formatDateTime(row.completedAt)}</p></div><StatusPill value={row.result} /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary icon={ShieldCheck} label="Source" value={row.enrollment.source} /><Summary icon={CheckCircle2} label="Attendance" value={`${Number(row.attendanceRate).toFixed(0)}%`} /><Summary icon={UserCheck} label="Practical Result" value={row.enrollment.assessment?.result ?? "Not required"} /><Summary icon={CalendarCheck2} label="Certificate" value={completion?.certificate?.status ?? "None"} /></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4"><h5 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Training execution</h5><div className="mt-3 space-y-2">{row.enrollment.sessions.map((session) => <div key={session.id} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-800">{session.label}</p><p className="mt-1 text-[11px] text-slate-500">{formatDateTime(session.startsAt)} · {session.venue}</p><div className="mt-2 flex flex-wrap gap-2"><StatusPill value={session.attendance?.trainingStatus ?? "Pending"} /><StatusPill value={session.sessionStatus} /></div></div>)}</div></section>
            <section className="rounded-xl border border-slate-200 bg-white p-4"><h5 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Outcome evidence</h5><dl className="mt-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-xs"><dt className="font-semibold text-slate-400">Assessment</dt><dd className="font-bold text-slate-700">{row.enrollment.assessment?.result ?? "Not required"}</dd><dt className="font-semibold text-slate-400">Score</dt><dd className="font-bold text-slate-700">{row.enrollment.assessment?.score && row.enrollment.assessment?.maximumScore ? `${row.enrollment.assessment.score}/${row.enrollment.assessment.maximumScore}` : "—"}</dd><dt className="font-semibold text-slate-400">Completion</dt><dd className="font-bold text-slate-700">{completion?.status ?? "—"}</dd><dt className="font-semibold text-slate-400">Certificate No.</dt><dd className="font-bold text-slate-700">{completion?.certificate?.number ?? "—"}</dd><dt className="font-semibold text-slate-400">Valid until</dt><dd className="font-bold text-slate-700">{completion?.certificate?.expiresAt ? formatDate(completion.certificate.expiresAt) : "No expiry / Not applicable"}</dd></dl>{completion?.certificate?.status === "Active" && <a className={`${primary} mt-4 inline-flex`} target="_blank" rel="noreferrer" href={`/training/api/certificates/${completion.certificate.id}`}>Open Certificate</a>}</section>
        </div>
    </section>;
}

function ScheduleTrainingModal({ state, group, busy, error, onClose, onSchedule }: { state: TrainingState; group: RequirementGroup; busy: boolean; error: string; onClose: () => void; onSchedule: (payload: Record<string, unknown>) => Promise<void> }) {
    const programs = state.programs.filter((program) => program.status === "Active" && (Boolean(program.relatedLearningCourseId) || program.competencies.length > 0));
    const schedulable = group.requirements.filter((row) => ["Ready", "Needs Mapping"].includes(row.readiness) && row.participantId);
    const [selectedIds, setSelectedIds] = useState<string[]>(schedulable.map((row) => row.id));
    const [programId, setProgramId] = useState(group.programId ?? "");
    const [startsAt, setStartsAt] = useState(defaultDateTime(1, 9));
    const [endsAt, setEndsAt] = useState(defaultDateTime(1, 16));
    const [venue, setVenue] = useState("");
    const [capacity, setCapacity] = useState(Math.max(1, schedulable.length));
    const [facilitatorId, setFacilitatorId] = useState("");
    const [externalFacilitatorName, setExternalFacilitatorName] = useState("");
    const selectedProgram = programs.find((program) => program.id === programId);
    const facilitators = state.personnel.filter((person) => person.personType !== "Trainee");
    const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    const valid = Boolean(programId && startsAt && endsAt && venue.trim() && selectedIds.length && capacity >= selectedIds.length && (facilitatorId || externalFacilitatorName.trim()));

    return (
        <AppModal
            show
            title="Schedule Training"
            description={group.programTitle ?? group.title}
            onClose={onClose}
            maxWidth="2xl"
            footer={
                <>
                    <button type="button" className={button} onClick={onClose} disabled={busy}>Cancel</button>
                    <button
                        type="button"
                        className={primary}
                        disabled={busy || !valid}
                        onClick={() => void onSchedule({
                            recommendationIds: selectedIds,
                            programId,
                            startsAt,
                            endsAt,
                            venue: venue.trim(),
                            capacity,
                            facilitatorId: facilitatorId ? Number(facilitatorId) : null,
                            externalFacilitatorName: facilitatorId ? null : externalFacilitatorName.trim() || null,
                            enrollmentClosesAt: null,
                        })}
                    >
                        {busy ? "Scheduling…" : "Schedule Training"}
                    </button>
                </>
            }
        >
            <div className="space-y-5">
                {error && (
                    <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                        {error}
                    </div>
                )}

                <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="mb-4">
                        <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Training arrangement</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Confirm the approved training definition, schedule, venue, facilitator, and capacity.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <Field label="Training definition" required>
                                <SystemSelect className={input} value={programId} disabled={Boolean(group.programId)} onChange={(event) => setProgramId(event.target.value)}>
                                    <option value="">Select approved training</option>
                                    {programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
                                </SystemSelect>
                            </Field>
                        </div>
                        <Field label="Start" required>
                            <input className={input} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                        </Field>
                        <Field label="End" required>
                            <input className={input} type="datetime-local" value={endsAt} min={startsAt} onChange={(event) => setEndsAt(event.target.value)} />
                        </Field>
                        <div className="md:col-span-2">
                            <Field label="Venue / location" required>
                                <input className={input} value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Training yard, approved site, training room…" />
                            </Field>
                        </div>
                        <Field label="Facilitator / authorized assessor" required>
                            <SystemSelect className={input} value={facilitatorId} onChange={(event) => setFacilitatorId(event.target.value)}>
                                <option value="">External / not listed</option>
                                {facilitators.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.position}</option>)}
                            </SystemSelect>
                        </Field>
                        <Field label="External facilitator" hint={facilitatorId ? "Disabled because an internal facilitator is selected." : "Required when no internal facilitator is selected."}>
                            <input className={input} value={externalFacilitatorName} disabled={Boolean(facilitatorId)} onChange={(event) => setExternalFacilitatorName(event.target.value)} placeholder="Name of external facilitator" />
                        </Field>
                        <Field label="Capacity" required hint={`Must accommodate all ${selectedIds.length} selected participant${selectedIds.length === 1 ? "" : "s"}.`}>
                            <input className={input} type="number" min={selectedIds.length || 1} max={5000} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} />
                        </Field>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Completion basis</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">
                                {selectedProgram?.completionRules.assessmentRequired ? "Verified attendance + practical/facilitated assessment" : "Verified attendance"}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <div>
                            <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Eligible participants</h3>
                            <p className="mt-1 text-xs text-slate-500">Only personnel whose prerequisite state permits scheduling can be selected.</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-700">{selectedIds.length} selected</span>
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto p-3">
                        {group.requirements.map((row) => {
                            const selectable = ["Ready", "Needs Mapping"].includes(row.readiness) && Boolean(row.participantId);
                            const selected = selectedIds.includes(row.id);
                            return (
                                <label key={row.id} className={`flex items-start gap-3 rounded-lg border p-3 transition ${selectable ? "cursor-pointer border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/30" : "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"}`}>
                                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" disabled={!selectable} checked={selected} onChange={() => selectable && toggle(row.id)} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-900">{row.participant}</p>
                                        <p className="mt-0.5 text-[10px] text-slate-400">{row.position} · {row.department}</p>
                                        <p className="mt-1 text-[10px] font-semibold text-slate-500">{row.prerequisiteTitle ? `${row.prerequisiteTitle}: ${row.prerequisiteStatus}` : row.prerequisiteStatus}</p>
                                    </div>
                                    <StatusPill value={row.readiness} />
                                </label>
                            );
                        })}
                    </div>
                </section>
            </div>
        </AppModal>
    );
}

function RescheduleModal({ state, row, busy, error, onClose, onSave }: { state: TrainingState; row: RegisterRow; busy: boolean; error: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
    const [startsAt, setStartsAt] = useState(toDateTimeLocal(row.session.startsAt));
    const [endsAt, setEndsAt] = useState(toDateTimeLocal(row.session.endsAt));
    const [venue, setVenue] = useState(row.session.venue);
    const [capacity, setCapacity] = useState(row.session.capacity);
    const [facilitatorId, setFacilitatorId] = useState(row.session.facilitatorId ? String(row.session.facilitatorId) : "");
    const [external, setExternal] = useState(row.session.externalFacilitatorName ?? "");
    const facilitators = state.personnel.filter((person) => person.personType !== "Trainee");
    const valid = Boolean(startsAt && endsAt && venue.trim() && capacity >= row.participants.length && (facilitatorId || external.trim()));

    return (
        <AppModal
            show
            title="Reschedule Training"
            description={row.program.title}
            onClose={onClose}
            maxWidth="lg"
            footer={
                <>
                    <button type="button" className={button} onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="button" className={primary} disabled={busy || !valid} onClick={() => void onSave({ label: row.session.label, startsAt, endsAt, venue: venue.trim(), capacity, facilitatorId: facilitatorId ? Number(facilitatorId) : null, externalFacilitatorName: facilitatorId ? null : external.trim() || null, enrollmentClosesAt: row.session.enrollmentClosesAt, status: "Scheduled" })}>
                        {busy ? "Saving…" : "Save Schedule"}
                    </button>
                </>
            }
        >
            {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
            <div className="grid gap-4 md:grid-cols-2">
                <Field label="Start" required><input className={input} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field>
                <Field label="End" required><input className={input} type="datetime-local" value={endsAt} min={startsAt} onChange={(event) => setEndsAt(event.target.value)} /></Field>
                <div className="md:col-span-2"><Field label="Venue / location" required><input className={input} value={venue} onChange={(event) => setVenue(event.target.value)} /></Field></div>
                <Field label="Facilitator" required>
                    <SystemSelect className={input} value={facilitatorId} onChange={(event) => setFacilitatorId(event.target.value)}>
                        <option value="">External / not listed</option>
                        {facilitators.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.position}</option>)}
                    </SystemSelect>
                </Field>
                <Field label="External facilitator" hint={facilitatorId ? "Disabled because an internal facilitator is selected." : "Required when no internal facilitator is selected."}>
                    <input className={input} value={external} disabled={Boolean(facilitatorId)} onChange={(event) => setExternal(event.target.value)} />
                </Field>
                <Field label="Capacity" required hint={`Current participants: ${row.participants.length}`}>
                    <input className={input} type="number" min={row.participants.length || 1} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} />
                </Field>
            </div>
        </AppModal>
    );
}

function CancelTrainingModal({ row, busy, error, onClose, onConfirm }: { row: RegisterRow; busy: boolean; error: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
    const [reason, setReason] = useState("");
    return (
        <AppModal
            show
            title="Cancel Training"
            description={row.program.title}
            onClose={onClose}
            maxWidth="lg"
            layer="confirmation"
            footer={
                <>
                    <button type="button" className={button} onClick={onClose} disabled={busy}>Keep Training</button>
                    <button type="button" className="app-button app-button-danger" disabled={busy || !reason.trim()} onClick={() => void onConfirm(reason.trim())}>
                        {busy ? "Cancelling…" : "Cancel Training"}
                    </button>
                </>
            }
        >
            {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                Cancelling this session does not erase the underlying development requirement. Affected personnel remain traceable and can return to the scheduling queue.
            </div>
            <div className="mt-4">
                <Field label="Cancellation reason" required hint="Required for the audit trail.">
                    <textarea className={`${input} min-h-28 resize-y`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this training session is being cancelled" />
                </Field>
            </div>
        </AppModal>
    );
}

function Summary({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start gap-2"><div className="rounded-lg bg-amber-50 p-2 text-amber-600"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-bold leading-relaxed text-slate-800">{value}</p></div></div></div>;
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function localDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function inList(value: string | null | undefined, allowed: string[]) {
    return Boolean(value && allowed.includes(value));
}

function toDateTimeLocal(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (number: number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDateTime(daysAhead: number, hour: number) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    date.setHours(hour, 0, 0, 0);
    return toDateTimeLocal(date.toISOString());
}
