import DataTable from "@/Components/DataTable";
import { AppModal, Field, primaryButtonClass, secondaryButtonClass } from "@/Components/Competency/CompetencyUI";
import StatCard from "@/Components/StatCard";
import SystemSelect from "@/Components/SystemSelect";
import AuthenticatedLayout, { HeaderActions, HeaderFilters } from "@/Layouts/AuthenticatedLayout";
import {
    SUCCESSION_WORKSPACES,
    emptyPositionDraft,
    normalizeSuccessionState,
    type CriticalPosition,
    type Criticality,
    type DevelopmentAction,
    type DevelopmentPlan,
    type ReadinessAssessment,
    type ReadinessBand,
    type SuccessionCandidate,
    type SuccessionState,
    type SuccessionWorkspace,
} from "@/data/succession";
import { successionClient, successionError } from "@/data/successionClient";
import { useHashWorkspace } from "@/workspaceNavigation";
import { Head } from "@inertiajs/react";
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    FileCheck2,
    ListChecks,
    Plus,
    RefreshCcw,
    RotateCcw,
    ShieldCheck,
    Target,
    UserCheck,
    UserPlus,
    Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = { initialSuccessionState?: unknown };
type CoverageFilter = "all" | "covered" | "at-risk" | "ready-now" | "review-due";
type CandidateFilter = "all" | "needs-review" | "decision-pending" | "accepted" | "development";

type PositionFilters = {
    department: string;
    criticality: string;
    coverage: CoverageFilter;
    status: string;
};

type CandidateRow = {
    key: string;
    position: CriticalPosition;
    candidate: SuccessionCandidate;
    actionNeeded: string;
    evidenceCount: number;
    activePlanCount: number;
};

const EMPTY_POSITION_FILTERS: PositionFilters = {
    department: "all",
    criticality: "all",
    coverage: "all",
    status: "all",
};

const inputClass = "app-control w-full";

function initial(value: unknown): SuccessionState | null {
    try {
        return value == null ? null : normalizeSuccessionState(value);
    } catch {
        return null;
    }
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function isoToday(): string {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
}

function addMonthsISO(months: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
}

function latestFinalized(candidate: SuccessionCandidate): ReadinessAssessment | null {
    return candidate.assessments
        .filter((assessment) => assessment.status === "Finalized")
        .sort((a, b) => b.version - a.version)[0] ?? null;
}

function draftAssessment(candidate: SuccessionCandidate): ReadinessAssessment | null {
    return candidate.assessments.find((assessment) => assessment.status === "Draft") ?? null;
}

function latestReadiness(candidate: SuccessionCandidate): string {
    return latestFinalized(candidate)?.readinessBand ?? candidate.latestAssessment?.readinessBand ?? "Not Assessed";
}

function evidenceCount(assessment: ReadinessAssessment | null): number {
    if (!assessment) return 0;
    const blocks = [assessment.performance, assessment.competency, assessment.learning, assessment.training];
    return blocks.reduce((sum, block) => sum + (Array.isArray(block.records) ? block.records.length : 0), 0);
}

function actionNeeded(candidate: SuccessionCandidate): string {
    const draft = draftAssessment(candidate);
    const finalized = latestFinalized(candidate);
    if (candidate.status === "Proposed") return "Start readiness review";
    if (draft) return "Finalize draft review";
    if (candidate.status === "Under Review" && finalized) return "Decision pending";
    if (candidate.status === "Under Review") return "Readiness review required";
    if (candidate.status === "Accepted" && latestReadiness(candidate) !== "Ready Now") {
        const active = candidate.plans.some((plan) => plan.status === "Active");
        return active ? "Development in progress" : "Development plan needed";
    }
    if (candidate.status === "Accepted") return "Pipeline current";
    return candidate.status;
}

function criticalityTone(value: Criticality): string {
    if (value === "Critical") return "bg-rose-50 text-rose-700";
    if (value === "High") return "bg-amber-50 text-amber-800";
    return "bg-slate-100 text-slate-600";
}

function readinessTone(value: string): string {
    if (value === "Ready Now") return "bg-emerald-50 text-emerald-700";
    if (value === "Ready Soon") return "bg-blue-50 text-blue-700";
    if (value === "Developing") return "bg-amber-50 text-amber-800";
    if (value === "Needs Significant Development") return "bg-rose-50 text-rose-700";
    return "bg-slate-100 text-slate-600";
}

function statusTone(value: string): string {
    const normalized = value.toLowerCase();
    if (normalized.includes("accepted") || normalized.includes("finalized") || normalized.includes("completed")) return "bg-emerald-50 text-emerald-700";
    if (normalized.includes("declined") || normalized.includes("withdrawn") || normalized.includes("archived")) return "bg-rose-50 text-rose-700";
    if (normalized.includes("review") || normalized.includes("draft") || normalized.includes("proposed")) return "bg-amber-50 text-amber-800";
    return "bg-slate-100 text-slate-600";
}

function Pill({ value, tone }: { value: string; tone?: string }) {
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${tone ?? statusTone(value)}`}>{value}</span>;
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
            {detail ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p> : null}
        </div>
    );
}

function PositionModal({ state, onClose, onSaved }: { state: SuccessionState; onClose: () => void; onSaved: () => Promise<void> }) {
    const [form, setForm] = useState(() => emptyPositionDraft());
    const [requirementLabel, setRequirementLabel] = useState("Role-profile competency readiness");
    const [targetLevel, setTargetLevel] = useState(3);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const departments = Array.from(new Set(state.personnel.map((person) => person.department).filter(Boolean))).sort();
    const incumbents = state.personnel.filter((person) => !form.department || person.department === form.department);

    async function submit() {
        if (!form.positionTitle.trim() || !form.department || !form.businessImpact.trim() || !requirementLabel.trim()) return;
        setBusy(true);
        setError("");
        try {
            await successionClient.createPosition({
                ...form,
                incumbentId: form.incumbentId || null,
                vacancyRisk: form.vacancyRisk || "",
                requirements: [
                    { type: "Competency", label: requirementLabel.trim(), targetLevel, required: true, sourceKey: null, sourceVersion: null },
                    { type: "Performance", label: "Finalized performance evidence", targetLevel: null, required: true, sourceKey: null, sourceVersion: null },
                ],
            });
            await onSaved();
            onClose();
        } catch (cause) {
            setError(successionError(cause));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppModal
            show
            title="Add Critical Position"
            description="Define the governed position and its success-profile evidence requirements. Candidate readiness is reviewed separately."
            onClose={onClose}
            maxWidth="2xl"
            footer={<>
                <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancel</button>
                <button type="button" className={primaryButtonClass} disabled={busy || !form.positionTitle.trim() || !form.department || !form.businessImpact.trim()} onClick={() => void submit()}>{busy ? "Saving…" : "Save as Draft"}</button>
            </>}
        >
            {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Position title" required><input className={inputClass} value={form.positionTitle} onChange={(event) => setForm({ ...form, positionTitle: event.target.value })} /></Field>
                <Field label="Department" required><SystemSelect className={inputClass} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value, incumbentId: null })}><option value="">Select department</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</SystemSelect></Field>
                <Field label="Criticality" required><SystemSelect className={inputClass} value={form.criticality} onChange={(event) => setForm({ ...form, criticality: event.target.value as Criticality })}><option>Critical</option><option>High</option><option>Moderate</option></SystemSelect></Field>
                <Field label="Current incumbent"><SystemSelect className={inputClass} value={form.incumbentId ?? ""} onChange={(event) => setForm({ ...form, incumbentId: event.target.value ? Number(event.target.value) : null })}><option value="">Vacant / not assigned</option>{incumbents.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.position}</option>)}</SystemSelect></Field>
                <Field label="Review cycle" required><SystemSelect className={inputClass} value={form.reviewCycleMonths} onChange={(event) => setForm({ ...form, reviewCycleMonths: Number(event.target.value) })}><option value={3}>Every 3 months</option><option value={6}>Every 6 months</option><option value={12}>Every 12 months</option></SystemSelect></Field>
                <Field label="Next review"><input type="date" className={inputClass} value={form.nextReviewAt} onChange={(event) => setForm({ ...form, nextReviewAt: event.target.value })} /></Field>
            </div>
            <div className="mt-4 grid gap-4">
                <Field label="Business impact" required hint="Explain why continuity in this position matters to operations."><textarea className={`${inputClass} min-h-24`} value={form.businessImpact} onChange={(event) => setForm({ ...form, businessImpact: event.target.value })} /></Field>
                <Field label="Vacancy risk" hint="Document the operational exposure if this role becomes vacant."><textarea className={`${inputClass} min-h-20`} value={form.vacancyRisk} onChange={(event) => setForm({ ...form, vacancyRisk: event.target.value })} /></Field>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-extrabold text-slate-900">Success profile</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Readiness reviews will snapshot finalized evidence against these requirements. Finalized performance evidence is included automatically.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]">
                    <Field label="Primary competency requirement" required><input className={inputClass} value={requirementLabel} onChange={(event) => setRequirementLabel(event.target.value)} /></Field>
                    <Field label="Target level" required><SystemSelect className={inputClass} value={targetLevel} onChange={(event) => setTargetLevel(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</SystemSelect></Field>
                </div>
            </div>
        </AppModal>
    );
}

function NominationModal({ state, position, onClose, onSaved }: { state: SuccessionState; position: CriticalPosition; onClose: () => void; onSaved: () => Promise<void> }) {
    const existing = new Set(position.candidates.filter((candidate) => !["Declined", "Withdrawn"].includes(candidate.status)).map((candidate) => candidate.person.id));
    const eligible = state.personnel.filter((person) => person.id !== position.incumbent?.id && !existing.has(person.id) && person.department === position.department);
    const [candidateId, setCandidateId] = useState<number | null>(eligible[0]?.id ?? null);
    const [rationale, setRationale] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        if (!candidateId || rationale.trim().length < 8) return;
        setBusy(true);
        setError("");
        try {
            await successionClient.nominate(position.id, { candidateId, source: "Talent Review", rationale: rationale.trim() });
            await onSaved();
            onClose();
        } catch (cause) {
            setError(successionError(cause));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppModal
            show
            title="Add to Successor Review"
            description={`${position.positionTitle} · eligible active personnel from ${position.department}. This creates a governed review record, not a promotion decision.`}
            onClose={onClose}
            maxWidth="lg"
            footer={<>
                <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancel</button>
                <button type="button" className={primaryButtonClass} disabled={busy || !candidateId || rationale.trim().length < 8} onClick={() => void submit()}>{busy ? "Adding…" : "Add to Review"}</button>
            </>}
        >
            {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
            {eligible.length ? <div className="space-y-4">
                <Field label="Employee" required><SystemSelect className={inputClass} value={candidateId ?? ""} onChange={(event) => setCandidateId(event.target.value ? Number(event.target.value) : null)}>{eligible.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.position}</option>)}</SystemSelect></Field>
                <Field label="Review rationale" required hint="State the documented reason this employee should enter a readiness review for this position."><textarea className={`${inputClass} min-h-28`} value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field>
            </div> : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center"><Users className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">No eligible personnel in this department</p><p className="mt-1 text-xs text-slate-500">The current incumbent and employees with an active nomination are excluded.</p></div>}
        </AppModal>
    );
}

function ReviewModal({ row, onClose, onSaved }: { row: CandidateRow; onClose: () => void; onSaved: () => Promise<void> }) {
    const draft = draftAssessment(row.candidate);
    const base = draft ?? latestFinalized(row.candidate);
    const [band, setBand] = useState<ReadinessBand>(base?.readinessBand ?? "Developing");
    const [summary, setSummary] = useState(base?.reviewerSummary ?? "");
    const [developmentNeeds, setDevelopmentNeeds] = useState((base?.developmentNeeds ?? []).join("\n"));
    const [riskFlags, setRiskFlags] = useState((base?.riskFlags ?? []).join("\n"));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        if (!summary.trim()) return;
        setBusy(true);
        setError("");
        const payload = {
            readinessBand: band,
            reviewerSummary: summary.trim(),
            developmentNeeds: developmentNeeds.split("\n").map((value) => value.trim()).filter(Boolean),
            riskFlags: riskFlags.split("\n").map((value) => value.trim()).filter(Boolean),
        };
        try {
            if (row.candidate.status === "Proposed") {
                await successionClient.transitionCandidate(row.candidate.id, "Under Review");
            }
            let assessmentId = draft?.id ?? null;
            if (assessmentId) {
                await successionClient.updateAssessment(assessmentId, payload);
            } else {
                const response = await successionClient.createAssessment(row.candidate.id, payload);
                assessmentId = String(response.data?.data?.assessmentId ?? "");
            }
            if (!assessmentId) throw new Error("Readiness assessment could not be created.");
            await successionClient.finalizeAssessment(assessmentId);
            await onSaved();
            onClose();
        } catch (cause) {
            setError(successionError(cause));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppModal
            show
            title="Finalize Readiness Review"
            description={`${row.candidate.person.name} · ${row.position.positionTitle}. The final record snapshots current governed evidence and remains immutable.`}
            onClose={onClose}
            maxWidth="2xl"
            footer={<>
                <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancel</button>
                <button type="button" className={primaryButtonClass} disabled={busy || !summary.trim()} onClick={() => void submit()}>{busy ? "Finalizing…" : "Finalize Review"}</button>
            </>}
        >
            {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
            {base ? <div className="grid gap-3 sm:grid-cols-4">
                <InfoCard label="Performance" value={String(Array.isArray(base.performance.records) ? base.performance.records.length : 0)} detail="finalized review record(s)" />
                <InfoCard label="Competency" value={String(Array.isArray(base.competency.records) ? base.competency.records.length : 0)} detail="finalized snapshot(s)" />
                <InfoCard label="Learning" value={String(Array.isArray(base.learning.records) ? base.learning.records.length : 0)} detail="completion record(s)" />
                <InfoCard label="Training" value={String(Array.isArray(base.training.records) ? base.training.records.length : 0)} detail="finalized completion(s)" />
            </div> : <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">Current finalized Performance, Competency, Learning, and Training evidence will be snapshotted when this readiness review is created.</div>}
            <div className="mt-5 grid gap-4">
                <Field label="Readiness band" required><SystemSelect className={inputClass} value={band} onChange={(event) => setBand(event.target.value as ReadinessBand)}><option>Ready Now</option><option>Ready Soon</option><option>Developing</option><option>Needs Significant Development</option></SystemSelect></Field>
                <Field label="Reviewer summary" required hint="Summarize the evidence-based readiness conclusion. Do not convert source percentages into an automatic readiness decision."><textarea className={`${inputClass} min-h-28`} value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Development needs" hint="One item per line."><textarea className={`${inputClass} min-h-28`} value={developmentNeeds} onChange={(event) => setDevelopmentNeeds(event.target.value)} /></Field>
                    <Field label="Risk flags" hint="One item per line."><textarea className={`${inputClass} min-h-28`} value={riskFlags} onChange={(event) => setRiskFlags(event.target.value)} /></Field>
                </div>
            </div>
        </AppModal>
    );
}

function ReasonModal({ title, description, confirmLabel, danger = false, onClose, onConfirm }: { title: string; description: string; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit() {
        if (reason.trim().length < 8) return;
        setBusy(true);
        setError("");
        try {
            await onConfirm(reason.trim());
            onClose();
        } catch (cause) {
            setError(successionError(cause));
        } finally {
            setBusy(false);
        }
    }
    return (
        <AppModal
            show
            title={title}
            description={description}
            onClose={onClose}
            maxWidth="lg"
            layer="confirmation"
            footer={<>
                <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancel</button>
                <button type="button" className={danger ? "app-button app-button-danger" : primaryButtonClass} disabled={busy || reason.trim().length < 8} onClick={() => void submit()}>{busy ? "Saving…" : confirmLabel}</button>
            </>}
        >
            {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
            <Field label="Reason" required hint="This reason is stored in the succession audit trail."><textarea className={`${inputClass} min-h-28`} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
        </AppModal>
    );
}

function DevelopmentPlanModal({ state, row, onClose, onSaved }: { state: SuccessionState; row: CandidateRow; onClose: () => void; onSaved: () => Promise<void> }) {
    const assessment = latestFinalized(row.candidate);
    const defaultOwner = row.position.incumbent?.id ?? row.candidate.person.managerId ?? row.candidate.person.id;
    const [title, setTitle] = useState(`${row.position.positionTitle} readiness development plan`);
    const [objective, setObjective] = useState(assessment?.developmentNeeds?.join(" ") || "Address the documented readiness requirements before the next succession review.");
    const [ownerId, setOwnerId] = useState(defaultOwner);
    const [startsOn, setStartsOn] = useState(isoToday());
    const [targetDate, setTargetDate] = useState(addMonthsISO(4));
    const [actionType, setActionType] = useState("Mentoring");
    const [actionTitle, setActionTitle] = useState(assessment?.developmentNeeds?.[0] ?? "Complete approved readiness development activity");
    const [dueOn, setDueOn] = useState(addMonthsISO(3));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        if (!assessment || !title.trim() || !objective.trim() || !ownerId || !actionTitle.trim()) return;
        setBusy(true);
        setError("");
        try {
            const planResponse = await successionClient.createPlan(row.candidate.id, {
                assessmentId: assessment.id,
                title: title.trim(),
                objective: objective.trim(),
                startsOn,
                targetDate,
                ownerId,
            });
            const planId = String(planResponse.data?.data?.planId ?? "");
            if (!planId) throw new Error("Development plan could not be created.");
            await successionClient.createAction(planId, {
                actionType,
                title: actionTitle.trim(),
                description: objective.trim(),
                sourceModule: null,
                sourceRecordId: null,
                status: "Planned",
                dueOn,
                evidenceSnapshot: {},
            });
            await successionClient.transitionPlan(planId, "Active", "Approved from the finalized readiness review.");
            await onSaved();
            onClose();
        } catch (cause) {
            setError(successionError(cause));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppModal
            show
            title="Create Development Plan"
            description={`${row.candidate.person.name} · ${row.position.positionTitle}. The plan is anchored to the latest finalized readiness review.`}
            onClose={onClose}
            maxWidth="2xl"
            footer={<>
                <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancel</button>
                <button type="button" className={primaryButtonClass} disabled={busy || !assessment || !title.trim() || !objective.trim() || !actionTitle.trim()} onClick={() => void submit()}>{busy ? "Creating…" : "Create & Activate Plan"}</button>
            </>}
        >
            {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div> : null}
            {!assessment ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">Finalize a readiness review before creating a development plan.</div> : <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Plan title" required><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
                    <Field label="Plan owner" required><SystemSelect className={inputClass} value={ownerId} onChange={(event) => setOwnerId(Number(event.target.value))}>{state.personnel.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.position}</option>)}</SystemSelect></Field>
                    <Field label="Start date"><input type="date" className={inputClass} value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></Field>
                    <Field label="Target date"><input type="date" className={inputClass} min={startsOn} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></Field>
                </div>
                <Field label="Objective" required><textarea className={`${inputClass} min-h-24`} value={objective} onChange={(event) => setObjective(event.target.value)} /></Field>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-extrabold text-slate-900">Initial development action</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label="Action type" required><SystemSelect className={inputClass} value={actionType} onChange={(event) => setActionType(event.target.value)}><option>Learning</option><option>Training</option><option>Mentoring</option><option>Stretch Assignment</option><option>Competency Goal</option><option>Other</option></SystemSelect></Field>
                        <Field label="Due date"><input type="date" className={inputClass} value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></Field>
                    </div>
                    <div className="mt-4"><Field label="Action title" required><input className={inputClass} value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} /></Field></div>
                </div>
            </div>}
        </AppModal>
    );
}

export default function AdminSuccession({ initialSuccessionState }: Props) {
    const [workspace, setWorkspace] = useHashWorkspace<SuccessionWorkspace>(SUCCESSION_WORKSPACES, "Overview");
    const [state, setState] = useState<SuccessionState | null>(() => initial(initialSuccessionState));
    const [loading, setLoading] = useState(!state);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [filters, setFilters] = useState<PositionFilters>(EMPTY_POSITION_FILTERS);
    const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>("all");
    const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
    const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
    const [showPositionModal, setShowPositionModal] = useState(false);
    const [nominatePosition, setNominatePosition] = useState<CriticalPosition | null>(null);
    const [reviewRow, setReviewRow] = useState<CandidateRow | null>(null);
    const [planRow, setPlanRow] = useState<CandidateRow | null>(null);
    const [reasonAction, setReasonAction] = useState<null | {
        title: string;
        description: string;
        confirmLabel: string;
        danger?: boolean;
        run: (reason: string) => Promise<void>;
    }>(null);
    const workspaceFilterPreset = useRef<Partial<PositionFilters> | null>(null);
    const workspaceCandidatePreset = useRef<CandidateFilter | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setState(await successionClient.state());
        } catch (cause) {
            setError(successionError(cause));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!state) void reload();
    }, [reload, state]);

    useEffect(() => {
        const positionPreset = workspaceFilterPreset.current;
        const reviewPreset = workspaceCandidatePreset.current;
        setExpandedPosition(null);
        setExpandedCandidate(null);
        setFilters(positionPreset ? { ...EMPTY_POSITION_FILTERS, ...positionPreset } : EMPTY_POSITION_FILTERS);
        setCandidateFilter(reviewPreset ?? "all");
        workspaceFilterPreset.current = null;
        workspaceCandidatePreset.current = null;
    }, [workspace]);

    const positions = state?.positions ?? [];
    const activePositions = positions.filter((position) => position.status === "Active");
    const candidates = useMemo<CandidateRow[]>(() => positions.flatMap((position) => position.candidates.map((candidate) => {
        const latest = draftAssessment(candidate) ?? latestFinalized(candidate) ?? candidate.latestAssessment;
        return {
            key: candidate.id,
            position,
            candidate,
            actionNeeded: actionNeeded(candidate),
            evidenceCount: evidenceCount(latest),
            activePlanCount: candidate.plans.filter((plan) => plan.status === "Active").length,
        };
    })), [positions]);

    const metrics = useMemo(() => {
        const atRisk = activePositions.filter((position) => position.riskFlags.length > 0).length;
        const covered = activePositions.filter((position) => position.coverage.accepted > 0).length;
        const readyNow = activePositions.filter((position) => position.coverage.readyNow > 0).length;
        const reviewsPending = candidates.filter((row) => ["Start readiness review", "Finalize draft review", "Readiness review required", "Decision pending", "Development plan needed"].includes(row.actionNeeded)).length;
        return { atRisk, covered, readyNow, reviewsPending };
    }, [activePositions, candidates]);

    const departments = useMemo(() => Array.from(new Set(positions.map((position) => position.department).filter(Boolean))).sort(), [positions]);

    const filteredPositions = useMemo(() => positions.filter((position) => {
        if (filters.department !== "all" && position.department !== filters.department) return false;
        if (filters.criticality !== "all" && position.criticality !== filters.criticality) return false;
        if (filters.status !== "all" && position.status !== filters.status) return false;
        if (filters.coverage === "covered" && position.coverage.accepted === 0) return false;
        if (filters.coverage === "at-risk" && position.riskFlags.length === 0) return false;
        if (filters.coverage === "ready-now" && position.coverage.readyNow === 0) return false;
        if (filters.coverage === "review-due" && !(position.nextReviewAt && new Date(position.nextReviewAt).getTime() <= Date.now())) return false;
        return true;
    }), [filters, positions]);

    const filteredCandidates = useMemo(() => candidates.filter((row) => {
        if (filters.department !== "all" && row.position.department !== filters.department) return false;
        if (filters.criticality !== "all" && row.position.criticality !== filters.criticality) return false;
        if (candidateFilter === "needs-review" && !["Start readiness review", "Finalize draft review", "Readiness review required"].includes(row.actionNeeded)) return false;
        if (candidateFilter === "decision-pending" && row.actionNeeded !== "Decision pending") return false;
        if (candidateFilter === "accepted" && row.candidate.status !== "Accepted") return false;
        if (candidateFilter === "development" && !["Development in progress", "Development plan needed"].includes(row.actionNeeded)) return false;
        return true;
    }), [candidateFilter, candidates, filters.criticality, filters.department]);

    const attentionPositions = filteredPositions.filter((position) => position.status === "Active" && position.riskFlags.length > 0);
    const reviewDue = filteredPositions.filter((position) => position.status === "Active" && position.nextReviewAt && new Date(position.nextReviewAt).getTime() <= Date.now()).sort((a, b) => new Date(a.nextReviewAt ?? 0).getTime() - new Date(b.nextReviewAt ?? 0).getTime());

    const pipeline = useMemo(() => {
        const accepted = candidates.filter((row) => row.candidate.status === "Accepted");
        const count = (label: string) => accepted.filter((row) => latestReadiness(row.candidate) === label).length;
        return {
            readyNow: count("Ready Now"),
            readySoon: count("Ready Soon"),
            developing: count("Developing"),
            significant: count("Needs Significant Development"),
            notAssessed: accepted.filter((row) => latestReadiness(row.candidate) === "Not Assessed").length,
        };
    }, [candidates]);

    const openWorkspace = useCallback((next: SuccessionWorkspace, coverage?: CoverageFilter, candidate?: CandidateFilter) => {
        const positionPreset: Partial<PositionFilters> = { coverage: coverage ?? "all" };
        if (next === workspace) {
            setFilters({ ...EMPTY_POSITION_FILTERS, ...positionPreset });
            setCandidateFilter(candidate ?? "all");
            return;
        }
        workspaceFilterPreset.current = positionPreset;
        workspaceCandidatePreset.current = candidate ?? "all";
        setWorkspace(next);
    }, [setWorkspace, workspace]);

    const perform = useCallback(async (job: () => Promise<unknown>, message: string) => {
        setError("");
        setNotice("");
        try {
            await job();
            await reload();
            setNotice(message);
        } catch (cause) {
            setError(successionError(cause));
        }
    }, [reload]);

    async function markAction(plan: DevelopmentPlan, action: DevelopmentAction, status: "In Progress" | "Completed") {
        await perform(() => successionClient.updateAction(plan.id, action.id, {
            actionType: action.actionType,
            title: action.title,
            description: action.description,
            sourceModule: action.sourceModule,
            sourceRecordId: action.sourceRecordId,
            status,
            dueOn: action.dueOn,
            evidenceSnapshot: action.evidence ?? {},
        }), status === "Completed" ? "Development action completed." : "Development action is now in progress.");
    }

    if (loading || !state) {
        return (
            <AuthenticatedLayout header={<h1 className="text-lg font-bold text-slate-950">Succession Planning</h1>}>
                <Head title="Succession Planning" />
                <div className="app-page"><section className="app-card p-8 text-center">{error ? <><AlertTriangle className="mx-auto h-7 w-7 text-rose-500" /><p className="mt-2 text-sm font-bold text-slate-900">Succession Planning could not be loaded</p><p className="mt-1 text-xs text-slate-500">{error}</p><button type="button" className={`${primaryButtonClass} mt-4`} onClick={() => void reload()}><RefreshCcw className="h-4 w-4" />Retry</button></> : <p className="text-sm font-semibold text-slate-500">Loading Succession Planning…</p>}</section></div>
            </AuthenticatedLayout>
        );
    }

    const positionDetails = (position: CriticalPosition) => (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-950">{position.positionTitle}</h4>
                        <Pill value={position.status} />
                        <Pill value={position.criticality} tone={criticalityTone(position.criticality)} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{position.department} · {position.incumbent ? `${position.incumbent.name} (${position.incumbent.employeeId})` : "Vacant"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {position.status === "Draft" ? <button type="button" className={primaryButtonClass} onClick={() => void perform(() => successionClient.transitionPosition(position.id, "Active"), "Critical position activated.")}><CheckCircle2 className="h-4 w-4" />Activate</button> : null}
                    {position.status === "Active" ? <>
                        <button type="button" className={secondaryButtonClass} onClick={() => { setExpandedPosition(null); setNominatePosition(position); }}><UserPlus className="h-4 w-4" />Review Talent Pool</button>
                        <button type="button" className={secondaryButtonClass} onClick={() => setReasonAction({ title: "Archive Critical Position", description: `${position.positionTitle} will leave the active succession register. Existing history remains auditable.`, confirmLabel: "Archive Position", danger: true, run: async (reason) => { await successionClient.transitionPosition(position.id, "Archived", reason); await reload(); setNotice("Critical position archived."); } })}>Archive</button>
                    </> : null}
                </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Accepted successors" value={String(position.coverage.accepted)} />
                <InfoCard label="Ready now" value={String(position.coverage.readyNow)} />
                <InfoCard label="Next review" value={formatDate(position.nextReviewAt)} />
                <InfoCard label="Risk flags" value={String(position.riskFlags.length)} detail={position.riskFlags[0] ?? "No current coverage flag"} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold text-slate-900">Position continuity context</p>
                    <p className="mt-2 text-xs leading-6 text-slate-600">{position.businessImpact}</p>
                    {position.vacancyRisk ? <><p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Vacancy risk</p><p className="mt-1 text-xs leading-6 text-slate-600">{position.vacancyRisk}</p></> : null}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold text-slate-900">Success profile requirements</p>
                    <div className="mt-3 space-y-2">{position.requirements.map((requirement) => <div key={`${requirement.type}:${requirement.label}`} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><div><p className="text-xs font-bold text-slate-800">{requirement.label}</p><p className="text-[10px] text-slate-500">{requirement.type}{requirement.targetLevel ? ` · Target Level ${requirement.targetLevel}` : ""}</p></div><Pill value={requirement.required ? "Required" : "Supporting"} /></div>)}</div>
                </section>
            </div>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><p className="text-xs font-extrabold text-slate-900">Successor pipeline</p><p className="mt-0.5 text-[11px] text-slate-500">Readiness is a governed evidence review. It does not appoint or promote an employee.</p></div>{position.status === "Active" ? <button type="button" className={secondaryButtonClass} onClick={() => { setExpandedPosition(null); setNominatePosition(position); }}><UserPlus className="h-4 w-4" />Add to Review</button> : null}</div>
                <div className="divide-y divide-slate-100">
                    {position.candidates.length ? position.candidates.map((candidate) => {
                        const row = candidates.find((item) => item.candidate.id === candidate.id)!;
                        const draft = draftAssessment(candidate);
                        const finalized = latestFinalized(candidate);
                        return <div key={candidate.id} className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div><p className="text-xs font-extrabold text-slate-900">{candidate.person.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{candidate.person.employeeId} · {candidate.person.position}</p><div className="mt-2 flex flex-wrap gap-1.5"><Pill value={candidate.status} /><Pill value={latestReadiness(candidate)} tone={readinessTone(latestReadiness(candidate))} />{draft ? <Pill value={`Draft review v${draft.version}`} /> : null}</div></div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {candidate.status === "Proposed" || candidate.status === "Under Review" || draft ? <button type="button" className={primaryButtonClass} onClick={() => { setExpandedPosition(null); setExpandedCandidate(null); setReviewRow(row); }}><ClipboardCheck className="h-4 w-4" />{draft ? "Finalize Draft" : "Review Readiness"}</button> : null}
                                    {candidate.status === "Under Review" && finalized ? <button type="button" className={secondaryButtonClass} onClick={() => setReasonAction({ title: "Accept into Succession Pipeline", description: `${candidate.person.name} has a finalized readiness review. Acceptance records governed pipeline inclusion only.`, confirmLabel: "Accept Candidate", run: async (reason) => { await successionClient.transitionCandidate(candidate.id, "Accepted", reason); await reload(); setNotice("Candidate accepted into the succession pipeline."); } })}><UserCheck className="h-4 w-4" />Accept</button> : null}
                                    {candidate.status === "Accepted" && finalized ? <button type="button" className={secondaryButtonClass} onClick={() => setReasonAction({ title: "Start Reassessment", description: `Create a new draft version from ${candidate.person.name}'s latest finalized readiness record.`, confirmLabel: "Create Reassessment", run: async (reason) => { await successionClient.reopenAssessment(finalized.id, reason); await reload(); setNotice("New readiness reassessment draft created."); } })}><RotateCcw className="h-4 w-4" />Reassess</button> : null}
                                    {candidate.status === "Accepted" && finalized && latestReadiness(candidate) !== "Ready Now" && !candidate.plans.some((plan) => plan.status === "Active") ? <button type="button" className={primaryButtonClass} onClick={() => { setExpandedPosition(null); setExpandedCandidate(null); setPlanRow(row); }}><Target className="h-4 w-4" />Development Plan</button> : null}
                                </div>
                            </div>
                            {candidate.rationale ? <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600"><span className="font-bold text-slate-700">Review rationale:</span> {candidate.rationale}</p> : null}
                            {candidate.plans.length ? <div className="mt-3 space-y-2">{candidate.plans.map((plan) => <div key={plan.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{plan.title}</p><p className="text-[10px] text-slate-500">Owner: {plan.owner ?? "Unassigned"} · Target {formatDate(plan.targetDate)}</p></div><Pill value={plan.status} /></div>{plan.actions.length ? <div className="mt-2 space-y-1.5">{plan.actions.map((action) => <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-[11px]"><div><span className="font-bold text-slate-700">{action.title}</span><span className="ml-2 text-slate-400">{action.actionType} · {action.dueOn ? formatDate(action.dueOn) : "No due date"}</span></div><div className="flex items-center gap-1.5"><Pill value={action.status} />{plan.status === "Active" && action.status === "Planned" ? <button type="button" className="text-[10px] font-bold text-amber-700" onClick={() => void markAction(plan, action, "In Progress")}>Start</button> : null}{plan.status === "Active" && action.status !== "Completed" && action.status !== "Cancelled" ? <button type="button" className="text-[10px] font-bold text-emerald-700" onClick={() => void markAction(plan, action, "Completed")}>Complete</button> : null}</div></div>)}</div> : null}{plan.status === "Active" && plan.actions.length > 0 && plan.actions.every((action) => action.status === "Completed") ? <div className="mt-2 flex justify-end"><button type="button" className={secondaryButtonClass} onClick={() => void perform(() => successionClient.transitionPlan(plan.id, "Completed", "All governed development actions completed."), "Development plan completed.")}>Complete Plan</button></div> : null}</div>)}</div> : null}
                        </div>;
                    }) : <div className="p-6 text-center text-xs text-slate-400">No employee is currently in review for this position.</div>}
                </div>
            </section>
        </div>
    );

    const candidateDetails = (row: CandidateRow) => {
        const { candidate, position } = row;
        const draft = draftAssessment(candidate);
        const finalized = latestFinalized(candidate);
        const evidence = draft ?? finalized;
        return (
            <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h4 className="text-sm font-extrabold text-slate-950">{candidate.person.name}</h4><p className="mt-1 text-xs text-slate-500">{candidate.person.position} · reviewed for {position.positionTitle}</p><div className="mt-2 flex flex-wrap gap-1.5"><Pill value={candidate.status} /><Pill value={latestReadiness(candidate)} tone={readinessTone(latestReadiness(candidate))} /></div></div>
                    <div className="flex flex-wrap items-center gap-2">
                        {candidate.status === "Proposed" || candidate.status === "Under Review" || draft ? <button type="button" className={primaryButtonClass} onClick={() => { setExpandedPosition(null); setExpandedCandidate(null); setReviewRow(row); }}><ClipboardCheck className="h-4 w-4" />{draft ? "Finalize Draft" : "Review Readiness"}</button> : null}
                        {candidate.status === "Under Review" && finalized ? <button type="button" className={secondaryButtonClass} onClick={() => setReasonAction({ title: "Accept into Succession Pipeline", description: `${candidate.person.name} has a finalized readiness review. Acceptance does not alter the employee's job record.`, confirmLabel: "Accept Candidate", run: async (reason) => { await successionClient.transitionCandidate(candidate.id, "Accepted", reason); await reload(); setNotice("Candidate accepted into the succession pipeline."); } })}>Accept</button> : null}
                        {["Proposed", "Under Review"].includes(candidate.status) ? <button type="button" className={secondaryButtonClass} onClick={() => setReasonAction({ title: "Decline Successor Review", description: `Close ${candidate.person.name}'s current review record for ${position.positionTitle}.`, confirmLabel: "Decline", danger: true, run: async (reason) => { await successionClient.transitionCandidate(candidate.id, "Declined", reason); await reload(); setNotice("Successor review declined."); } })}>Decline</button> : null}
                        {candidate.status === "Accepted" && finalized && latestReadiness(candidate) !== "Ready Now" && !candidate.plans.some((plan) => plan.status === "Active") ? <button type="button" className={primaryButtonClass} onClick={() => { setExpandedPosition(null); setExpandedCandidate(null); setPlanRow(row); }}><Target className="h-4 w-4" />Create Development Plan</button> : null}
                    </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoCard label="Performance evidence" value={String(Array.isArray(evidence?.performance.records) ? evidence?.performance.records?.length : 0)} />
                    <InfoCard label="Competency evidence" value={String(Array.isArray(evidence?.competency.records) ? evidence?.competency.records?.length : 0)} />
                    <InfoCard label="Learning completions" value={String(Array.isArray(evidence?.learning.records) ? evidence?.learning.records?.length : 0)} />
                    <InfoCard label="Training completions" value={String(Array.isArray(evidence?.training.records) ? evidence?.training.records?.length : 0)} />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-extrabold text-slate-900">Readiness history</p>
                        <div className="mt-3 space-y-2">{candidate.assessments.length ? [...candidate.assessments].sort((a, b) => b.version - a.version).map((assessment) => <div key={assessment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-800">Version {assessment.version}</span><Pill value={assessment.status} /></div><Pill value={assessment.readinessBand ?? "Not Assessed"} tone={readinessTone(assessment.readinessBand ?? "Not Assessed")} /></div>{assessment.reviewerSummary ? <p className="mt-2 text-[11px] leading-5 text-slate-600">{assessment.reviewerSummary}</p> : null}<p className="mt-2 text-[10px] text-slate-400">{assessment.finalizedAt ? `Finalized ${formatDate(assessment.finalizedAt)}` : "Draft review"}</p></div>) : <p className="text-xs text-slate-400">No readiness review yet.</p>}</div>
                    </section>
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-extrabold text-slate-900">Current development context</p>
                        {finalized ? <><div className="mt-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Development needs</p>{finalized.developmentNeeds.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">{finalized.developmentNeeds.map((need) => <li key={need}>{need}</li>)}</ul> : <p className="mt-2 text-xs text-slate-400">No development need recorded.</p>}</div><div className="mt-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Risk flags</p>{finalized.riskFlags.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-700">{finalized.riskFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul> : <p className="mt-2 text-xs text-slate-400">No readiness risk flag recorded.</p>}</div></> : <p className="mt-3 text-xs text-slate-400">Finalize a readiness review to establish development context.</p>}
                    </section>
                </div>
            </div>
        );
    };

    const selectedPosition = expandedPosition ? positions.find((position) => position.id === expandedPosition) ?? null : null;
    const selectedCandidate = expandedCandidate ? candidates.find((row) => row.key === expandedCandidate) ?? null : null;

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-lg font-bold text-slate-950">Succession Planning</h1>}>
            <Head title="Succession Planning" />

            <HeaderFilters
                active={filters.department !== "all" || filters.criticality !== "all" || filters.coverage !== "all" || filters.status !== "all" || candidateFilter !== "all"}
                onReset={() => { setFilters(EMPTY_POSITION_FILTERS); setCandidateFilter("all"); }}
            >
                <SystemSelect aria-label="Department" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}><option value="all">All Departments</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</SystemSelect>
                <SystemSelect aria-label="Criticality" value={filters.criticality} onChange={(event) => setFilters((current) => ({ ...current, criticality: event.target.value }))}><option value="all">All Criticality</option><option>Critical</option><option>High</option><option>Moderate</option></SystemSelect>
                {workspace !== "Readiness Reviews" ? <SystemSelect aria-label="Coverage" value={filters.coverage} onChange={(event) => setFilters((current) => ({ ...current, coverage: event.target.value as CoverageFilter }))}><option value="all">All Coverage</option><option value="covered">Covered</option><option value="at-risk">At Risk</option><option value="ready-now">Ready Now Coverage</option><option value="review-due">Review Due</option></SystemSelect> : null}
                {workspace === "Succession Register" ? <SystemSelect aria-label="Position status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All Status</option><option>Draft</option><option>Active</option><option>Archived</option></SystemSelect> : null}
                {workspace === "Readiness Reviews" ? <SystemSelect aria-label="Review status" value={candidateFilter} onChange={(event) => setCandidateFilter(event.target.value as CandidateFilter)}><option value="all">All Reviews</option><option value="needs-review">Needs Review</option><option value="decision-pending">Decision Pending</option><option value="accepted">Accepted Pipeline</option><option value="development">Development Required</option></SystemSelect> : null}
            </HeaderFilters>

            {workspace === "Succession Register" ? <HeaderActions><button type="button" className={primaryButtonClass} onClick={() => setShowPositionModal(true)}><Plus className="h-4 w-4" />Add Critical Position</button></HeaderActions> : null}

            {selectedPosition ? <AppModal
                show
                title="Succession Position Details"
                description={`${selectedPosition.positionTitle} · ${selectedPosition.department}`}
                onClose={() => setExpandedPosition(null)}
                maxWidth="2xl"
            >
                {positionDetails(selectedPosition)}
            </AppModal> : null}

            {selectedCandidate ? <AppModal
                show
                title="Readiness Review Details"
                description={`${selectedCandidate.candidate.person.name} · ${selectedCandidate.position.positionTitle}`}
                onClose={() => setExpandedCandidate(null)}
                maxWidth="2xl"
            >
                {candidateDetails(selectedCandidate)}
            </AppModal> : null}

            {showPositionModal ? <PositionModal state={state} onClose={() => setShowPositionModal(false)} onSaved={reload} /> : null}
            {nominatePosition ? <NominationModal state={state} position={nominatePosition} onClose={() => setNominatePosition(null)} onSaved={reload} /> : null}
            {reviewRow ? <ReviewModal row={reviewRow} onClose={() => setReviewRow(null)} onSaved={reload} /> : null}
            {planRow ? <DevelopmentPlanModal state={state} row={planRow} onClose={() => setPlanRow(null)} onSaved={reload} /> : null}
            {reasonAction ? <ReasonModal title={reasonAction.title} description={reasonAction.description} confirmLabel={reasonAction.confirmLabel} danger={reasonAction.danger} onClose={() => setReasonAction(null)} onConfirm={reasonAction.run} /> : null}

            <div className="app-page app-page-enter space-y-4">
                {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
                {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

                {workspace === "Overview" ? <>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <StatCard label="Positions At Risk" value={metrics.atRisk} icon={AlertTriangle} onClick={() => openWorkspace("Succession Register", "at-risk")} />
                        <StatCard label="Covered Positions" value={`${metrics.covered}/${Math.max(activePositions.length, 1)}`} icon={ShieldCheck} onClick={() => openWorkspace("Succession Register", "covered")} />
                        <StatCard label="Ready Now Coverage" value={metrics.readyNow} icon={UserCheck} onClick={() => openWorkspace("Succession Register", "ready-now")} />
                        <StatCard label="Needs Admin Review" value={metrics.reviewsPending} icon={ClipboardCheck} onClick={() => openWorkspace("Readiness Reviews", "all", "needs-review")} />
                    </div>

                    <DataTable
                        title="Positions Requiring Attention"
                        data={attentionPositions}
                        rowKey={(position) => position.id}
                        pageSize={10}
                        onRowClick={(position) => setExpandedPosition(position.id)}
                        getRowLabel={(position) => `Open ${position.positionTitle} succession details`}
                        emptyTitle="No active succession risk"
                        emptyDescription="No active position matches the current filters with a coverage or review risk flag."
                        columns={[
                            { key: "position", header: "Critical Position", render: (position) => <div><p className="font-bold text-slate-900">{position.positionTitle}</p><p className="text-[11px] text-slate-400">{position.department}</p></div> },
                            { key: "incumbent", header: "Incumbent", render: (position) => position.incumbent ? <div><p className="text-xs font-semibold text-slate-700">{position.incumbent.name}</p><p className="text-[10px] text-slate-400">{position.incumbent.employeeId}</p></div> : <span className="text-xs font-bold text-rose-600">Vacant</span> },
                            { key: "coverage", header: "Coverage", render: (position) => <span className="text-xs font-bold text-slate-700">{position.coverage.accepted} accepted · {position.coverage.readyNow} ready now</span> },
                            { key: "risk", header: "Needs Attention", render: (position) => <span className="text-xs font-bold text-rose-600">{position.riskFlags.join(" · ")}</span> },
                            { key: "review", header: "Next Review", render: (position) => <span className="text-xs text-slate-600">{formatDate(position.nextReviewAt)}</span> },
                        ]}
                        footer={<span className="text-xs text-slate-500">Operational attention queue derived from active position coverage and review status.</span>}
                    />

                    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
                        <section className="app-card p-5">
                            <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-extrabold text-slate-950">Pipeline Readiness</h2></div><p className="mt-1 text-xs text-slate-500">Accepted successors grouped by the latest finalized readiness review.</p></div><button type="button" className="text-xs font-bold text-amber-700" onClick={() => openWorkspace("Readiness Reviews", "all", "accepted")}>Open pipeline</button></div>
                            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                                <InfoCard label="Ready Now" value={String(pipeline.readyNow)} />
                                <InfoCard label="Ready Soon" value={String(pipeline.readySoon)} />
                                <InfoCard label="Developing" value={String(pipeline.developing)} />
                                <InfoCard label="Significant Gap" value={String(pipeline.significant)} />
                                <InfoCard label="Not Assessed" value={String(pipeline.notAssessed)} />
                            </div>
                        </section>
                        <section className="app-card p-5">
                            <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-extrabold text-slate-950">Governance Reviews Due</h2></div><p className="mt-1 text-xs text-slate-500">Active critical positions whose scheduled review date has arrived.</p>
                            <div className="mt-4 space-y-2">{reviewDue.slice(0, 5).map((position) => <button key={position.id} type="button" onClick={() => setExpandedPosition(position.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-amber-300"><div><p className="text-xs font-bold text-slate-900">{position.positionTitle}</p><p className="mt-0.5 text-[11px] text-slate-500">{position.department} · {position.incumbent?.name ?? "Vacant"}</p></div><span className="text-[10px] font-bold text-rose-600">{formatDate(position.nextReviewAt)}</span></button>)}{!reviewDue.length ? <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" /><p className="mt-2 text-xs font-bold text-slate-600">No overdue position review</p></div> : null}</div>
                        </section>
                    </div>
                </> : null}

                {workspace === "Succession Register" ? <DataTable
                    title="Critical Positions & Successor Coverage"
                    data={filteredPositions}
                    rowKey={(position) => position.id}
                    pageSize={10}
                    onRowClick={(position) => setExpandedPosition(position.id)}
                    getRowLabel={(position) => `Open ${position.positionTitle} succession details`}
                    emptyTitle="No critical position matches these filters"
                    columns={[
                        { key: "position", header: "Position", render: (position) => <div><p className="font-bold text-slate-900">{position.positionTitle}</p><p className="text-[11px] text-slate-400">{position.incumbent?.name ?? "Vacant"}{position.incumbent?.employeeId ? ` · ${position.incumbent.employeeId}` : ""}</p></div> },
                        { key: "department", header: "Department", render: (position) => position.department },
                        { key: "criticality", header: "Criticality", render: (position) => <Pill value={position.criticality} tone={criticalityTone(position.criticality)} /> },
                        { key: "coverage", header: "Successor Coverage", render: (position) => position.coverage.accepted ? <span className="text-xs font-bold text-slate-700">{position.coverage.accepted} accepted · {position.coverage.readyNow} ready now</span> : <span className="text-xs font-bold text-rose-600">No accepted successor</span> },
                        { key: "review", header: "Next Review", render: (position) => formatDate(position.nextReviewAt) },
                        { key: "status", header: "Status", render: (position) => <Pill value={position.status} /> },
                        { key: "risk", header: "Risk", render: (position) => position.riskFlags.length ? <Pill value={`${position.riskFlags.length} flag${position.riskFlags.length === 1 ? "" : "s"}`} tone="bg-rose-50 text-rose-700" /> : <Pill value="Covered" tone="bg-emerald-50 text-emerald-700" /> },
                    ]}
                    footer={<div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>Showing {filteredPositions.length} of {positions.length} position(s)</span><span>Click a row for governed position and successor details.</span></div>}
                /> : null}

                {workspace === "Readiness Reviews" ? <DataTable
                    title="Successor Readiness Reviews"
                    data={filteredCandidates}
                    rowKey={(row) => row.key}
                    pageSize={10}
                    onRowClick={(row) => setExpandedCandidate(row.key)}
                    getRowLabel={(row) => `Open ${row.candidate.person.name} readiness review`}
                    emptyTitle="No readiness review matches these filters"
                    emptyDescription="Successor reviews appear here after an employee is added to a governed critical-position review."
                    columns={[
                        { key: "employee", header: "Employee", render: (row) => <div><p className="font-bold text-slate-900">{row.candidate.person.name}</p><p className="text-[11px] text-slate-400">{row.candidate.person.employeeId} · {row.candidate.person.position}</p></div> },
                        { key: "target", header: "Target Position", render: (row) => <div><p className="text-xs font-bold text-slate-700">{row.position.positionTitle}</p><p className="text-[10px] text-slate-400">{row.position.department}</p></div> },
                        { key: "status", header: "Review Status", render: (row) => <Pill value={row.candidate.status} /> },
                        { key: "readiness", header: "Readiness", render: (row) => <Pill value={latestReadiness(row.candidate)} tone={readinessTone(latestReadiness(row.candidate))} /> },
                        { key: "evidence", header: "Evidence", render: (row) => <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700"><FileCheck2 className="h-3.5 w-3.5 text-slate-400" />{row.evidenceCount} record(s)</span> },
                        { key: "plan", header: "Development", render: (row) => row.activePlanCount ? <Pill value={`${row.activePlanCount} active plan`} tone="bg-blue-50 text-blue-700" /> : <span className="text-xs text-slate-400">No active plan</span> },
                        { key: "action", header: "Needs Action", render: (row) => <span className={`text-xs font-bold ${row.actionNeeded === "Pipeline current" ? "text-emerald-700" : "text-amber-700"}`}>{row.actionNeeded}</span> },
                    ]}
                    footer={<div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>{filteredCandidates.length} review record(s)</span><span>Finalized readiness is versioned and immutable; employment changes remain outside Succession.</span></div>}
                /> : null}
            </div>
        </AuthenticatedLayout>
    );
}
