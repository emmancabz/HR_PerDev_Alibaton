import SystemSelect from '@/Components/SystemSelect';
import StatCard from "@/Components/StatCard";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { normalizeTrainingState, type AttendanceStatus, type TrainingEnrollment, type TrainingState } from "@/data/training";
import { trainingClient, trainingError } from "@/data/trainingClient";
import { Head } from "@inertiajs/react";
import { AlertCircle, Award, CalendarClock, CheckCircle2, ClipboardCheck, Clock, MapPin, RefreshCcw, ShieldCheck, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const button = "app-button";
const primary = `${button} app-button-primary`;
const input = "app-control";
const card = "app-card";
type Props = { initialTrainingState?: unknown };

function initial(value: unknown): TrainingState | null {
    try { return value == null ? null : normalizeTrainingState(value); } catch { return null; }
}

export default function LearnerTraining({ initialTrainingState }: Props) {
    const [state, setState] = useState<TrainingState | null>(() => initial(initialTrainingState));
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(!state);
    const [feedback, setFeedback] = useState<{ sessionId: string; sessionLabel: string } | null>(null);
    const [ratings, setRatings] = useState({ content_rating: 0, facilitator_rating: 0, relevance_rating: 0, organization_rating: 0, overall_satisfaction: 0, comments: "" });
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const load = useCallback(async () => { setLoading(true); setError(""); try { setState(await trainingClient.state()); } catch (reason) { setError(trainingError(reason)); } finally { setLoading(false); } }, []);
    useEffect(() => { if (!state) void load(); }, [load, state]);
    const upcoming = useMemo(() => state?.enrollments.flatMap((enrollment) => enrollment.sessions.filter((session) => ["Scheduled", "Ongoing"].includes(session.sessionStatus)).map((session) => ({ enrollment, session }))) ?? [], [state]);
    const completed = state?.enrollments.filter((row) => row.completion?.status === "Passed").length ?? 0;
    const certificates = state?.enrollments.filter((row) => row.completion?.certificate).length ?? 0;

    if (loading || !state) return <AuthenticatedLayout><Head title="My Training" /><div className="app-page"><div className={`${card} p-8 text-center`}>{error ? <><AlertCircle className="mx-auto h-7 w-7 text-rose-500" /><p className="mt-2 text-sm font-bold">My Training could not be loaded</p><p className="mt-1 text-xs text-slate-500">{error}</p><button className={`${primary} mt-4`} onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Retry</button></> : <p className="text-sm text-slate-500">Loading your persisted Training records…</p>}</div></div></AuthenticatedLayout>;

    const submitFeedback = async () => {
        if (!feedback) return;
        setBusy(true); setError("");
        try { setState(await trainingClient.feedback(feedback.sessionId, ratings)); setNotice("Your Training feedback was saved."); setFeedback(null); }
        catch (reason) { setError(trainingError(reason)); }
        finally { setBusy(false); }
    };
    const transitionEnrollment = async (id: string, status: "Confirmed" | "Withdrawn", reason?: string) => {
        setBusy(true); setError(""); setNotice("");
        try { setState(await trainingClient.transitionEnrollment(id, status, reason)); setNotice(status === "Confirmed" ? "Your Training assignment is confirmed." : "Your Training assignment was withdrawn."); }
        catch (cause) { setError(trainingError(cause)); }
        finally { setBusy(false); }
    };
    const saveAttendance = async (id: string, status: AttendanceStatus, note: string) => {
        setBusy(true); setError(""); setNotice("");
        try { setState(await trainingClient.markAttendance(id, status, note)); setNotice("Facilitator attendance Draft saved for HR review."); }
        catch (cause) { setError(trainingError(cause)); }
        finally { setBusy(false); }
    };
    const saveAssessment = async (id: string, payload: Record<string, unknown>) => {
        setBusy(true); setError(""); setNotice("");
        try { setState(await trainingClient.assess(id, payload)); setNotice("Facilitator assessment Draft saved for HR review."); }
        catch (cause) { setError(trainingError(cause)); }
        finally { setBusy(false); }
    };

    return <AuthenticatedLayout><Head title="My Training" /><div className="app-page app-page-enter">
        {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</div>}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Assigned Programs" value={state.enrollments.length} icon={CalendarClock} /><StatCard label="Upcoming Sessions" value={upcoming.length} icon={Clock} /><StatCard label="Completed Training" value={completed} icon={CheckCircle2} /><StatCard label="Certificates" value={certificates} icon={Award} /></section>
        {error && !feedback && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
        {state.actor.canFacilitate && <FacilitatorWorkspace state={state} busy={busy} onSave={saveAttendance} onAssess={saveAssessment} />}
        {state.enrollments.length === 0 ? <section className={`${card} mt-4 p-10 text-center`}><CalendarClock className="mx-auto h-8 w-8 text-slate-300" /><h2 className="mt-3 text-base font-extrabold text-slate-900">No Training assignments yet</h2><p className="mt-1 text-sm text-slate-500">Assigned onsite, workshop, practical, and instructor-led programs will appear here.</p></section> : <div className="mt-4 grid gap-4 xl:grid-cols-2">{state.enrollments.map((enrollment) => <TrainingCard key={enrollment.id} state={state} enrollment={enrollment} busy={busy} onTransition={transitionEnrollment} onFeedback={(sessionId, sessionLabel) => { setRatings({ content_rating: 0, facilitator_rating: 0, relevance_rating: 0, organization_rating: 0, overall_satisfaction: 0, comments: "" }); setFeedback({ sessionId, sessionLabel }); setError(""); }} />)}</div>}
        {feedback && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={() => setFeedback(null)}><section className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="flex justify-between border-b border-slate-200 p-5"><div><h2 className="font-extrabold text-slate-950">Training Feedback</h2><p className="mt-1 text-xs text-slate-500">{feedback.sessionLabel}</p></div><button onClick={() => setFeedback(null)}><X className="h-4 w-4" /></button></header><div className="space-y-4 p-5">{([ ["Content", "content_rating"], ["Facilitator", "facilitator_rating"], ["Relevance", "relevance_rating"], ["Organization", "organization_rating"], ["Overall satisfaction", "overall_satisfaction"] ] as const).map(([label, key]) => <div key={key} className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">{label}</span><div className="flex">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setRatings({ ...ratings, [key]: value })} aria-label={`${label} ${value}`}><Star className={`h-5 w-5 ${value <= ratings[key] ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} /></button>)}</div></div>)}<label className="block text-xs font-bold text-slate-700">Comments<textarea className={`${input} mt-1 min-h-24`} value={ratings.comments} onChange={(event) => setRatings({ ...ratings, comments: event.target.value })} /></label>{error && <p className="text-sm font-semibold text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><button className={button} onClick={() => setFeedback(null)}>Cancel</button><button className={primary} disabled={busy || Object.entries(ratings).some(([key, value]) => key !== "comments" && Number(value) === 0)} onClick={() => void submitFeedback()}>{busy ? "Saving…" : "Submit Feedback"}</button></div></div></section></div>}
    </div></AuthenticatedLayout>;
}

function FacilitatorWorkspace({ state, busy, onSave, onAssess }: { state: TrainingState; busy: boolean; onSave: (id: string, status: AttendanceStatus, note: string) => Promise<void>; onAssess: (id: string, payload: Record<string, unknown>) => Promise<void> }) {
    const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [assessments, setAssessments] = useState<Record<string, { result: string; score: string; maximumScore: string; notes: string }>>({});
    const rows = state.facilitation.flatMap((enrollment) => enrollment.sessions.map((session) => ({ enrollment, session })));
    return <section className={`${card} mt-4 overflow-hidden`}><header className="flex items-start gap-3 border-b border-slate-200 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" /><div><h2 className="text-sm font-extrabold text-slate-950">Facilitator Draft Workspace</h2><p className="mt-1 text-xs text-slate-500">Record attendance and assessment observations here. Only HR/Training Officer can finalize and lock them.</p></div></header><div className="space-y-3 p-4">{rows.length === 0 ? <p className="text-sm text-slate-500">No participants are assigned to your facilitated sessions.</p> : rows.map(({ enrollment, session }) => { const attendance = session.attendance; const status = statuses[attendance?.id ?? ""] ?? attendance?.trainingStatus ?? "Pending"; const note = notes[attendance?.id ?? ""] ?? attendance?.note ?? ""; return <article key={`${enrollment.id}-${session.id}`} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-900">{enrollment.participant}</p><p className="mt-1 text-[11px] text-slate-500">{session.label} · {formatDate(session.startsAt)}</p></div><span className="text-[11px] font-semibold text-slate-500">HR 2: {attendance?.workforceSyncStatus ?? "Not Connected"}</span></div><div className="mt-3 grid gap-2 md:grid-cols-[160px_1fr_auto]"><SystemSelect className={input} value={status} disabled={!attendance || Boolean(attendance.finalizedAt)} onChange={(event) => attendance && setStatuses({ ...statuses, [attendance.id]: event.target.value as AttendanceStatus })}>{(["Pending", "Present", "Late", "Partial", "Absent", "Excused"] as AttendanceStatus[]).map((value) => <option key={value}>{value}</option>)}</SystemSelect><input className={input} value={note} disabled={!attendance || Boolean(attendance.finalizedAt)} onChange={(event) => attendance && setNotes({ ...notes, [attendance.id]: event.target.value })} placeholder="Observation note required while HR 2 is not connected" /><button className={button} disabled={busy || !attendance || Boolean(attendance.finalizedAt)} onClick={() => attendance && void onSave(attendance.id, status, note)}><ClipboardCheck className="h-3.5 w-3.5" />Save Attendance</button></div>{attendance?.finalizedAt && <p className="mt-2 text-[11px] font-semibold text-emerald-700">Finalized by HR and locked</p>}</article>; })}<div className="border-t border-slate-200 pt-4"><h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Participant assessment Drafts</h3><div className="mt-3 space-y-3">{state.facilitation.map((enrollment) => { const current = assessments[enrollment.id] ?? { result: enrollment.assessment?.result ?? "Pending", score: enrollment.assessment?.score ?? "", maximumScore: enrollment.assessment?.maximumScore ?? "100", notes: enrollment.assessment?.notes ?? "" }; return <article key={enrollment.id} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-bold text-slate-900">{enrollment.participant}</p><div className="mt-3 grid gap-2 md:grid-cols-[160px_120px_120px_1fr_auto]"><SystemSelect className={input} value={current.result} disabled={Boolean(enrollment.completion)} onChange={(event) => setAssessments({ ...assessments, [enrollment.id]: { ...current, result: event.target.value } })}><option>Pending</option><option>Passed</option><option>Failed</option><option>Needs Improvement</option></SystemSelect><input type="number" className={input} value={current.score} disabled={Boolean(enrollment.completion)} onChange={(event) => setAssessments({ ...assessments, [enrollment.id]: { ...current, score: event.target.value } })} placeholder="Score" /><input type="number" className={input} value={current.maximumScore} disabled={Boolean(enrollment.completion)} onChange={(event) => setAssessments({ ...assessments, [enrollment.id]: { ...current, maximumScore: event.target.value } })} placeholder="Maximum" /><input className={input} value={current.notes} disabled={Boolean(enrollment.completion)} onChange={(event) => setAssessments({ ...assessments, [enrollment.id]: { ...current, notes: event.target.value } })} placeholder="Assessment observations" /><button className={button} disabled={busy || Boolean(enrollment.completion)} onClick={() => void onAssess(enrollment.id, { result: current.result, score: current.score ? Number(current.score) : null, maximumScore: current.maximumScore ? Number(current.maximumScore) : null, checklist: [], notes: current.notes })}><ClipboardCheck className="h-3.5 w-3.5" />Save Assessment</button></div></article>; })}</div></div></div></section>;
}

function TrainingCard({ state, enrollment, busy, onTransition, onFeedback }: { state: TrainingState; enrollment: TrainingEnrollment; busy: boolean; onTransition: (id: string, status: "Confirmed" | "Withdrawn", reason?: string) => Promise<void>; onFeedback: (sessionId: string, label: string) => void }) {
    const program = state.programs.find((row) => row.id === enrollment.programId);
    const canWithdraw = ["Assigned", "Confirmed"].includes(enrollment.status) && !enrollment.sessions.some((session) => ["Ongoing", "Completed"].includes(session.sessionStatus));
    return <article className={`${card} overflow-hidden`}><header className="border-b border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{program?.code}</p><h2 className="mt-1 text-base font-extrabold text-slate-950">{program?.title ?? "Training Program"}</h2><p className="mt-1 text-xs text-slate-500">{program?.category} · {program?.deliveryType}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{enrollment.completion?.status ?? enrollment.status}</span></div>{!enrollment.completion && <div className="mt-3 flex flex-wrap gap-2">{enrollment.status === "Assigned" && <button className={primary} disabled={busy} onClick={() => void onTransition(enrollment.id, "Confirmed")}>Confirm Assignment</button>}{canWithdraw && <button className={button} disabled={busy} onClick={() => { const reason = window.prompt("Enter your reason for withdrawing before the session starts:"); if (reason?.trim()) void onTransition(enrollment.id, "Withdrawn", reason.trim()); }}>Withdraw</button>}</div>}</header><div className="space-y-3 p-4">{enrollment.sessions.map((session) => <div key={session.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold text-slate-900">{session.label}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><CalendarClock className="h-3 w-3" />{formatDate(session.startsAt)}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><MapPin className="h-3 w-3" />{session.venue}</p></div><div className="text-right"><p className="text-[11px] font-semibold text-slate-500">Attendance</p><p className="mt-1 text-xs font-bold text-slate-800">{session.attendance?.trainingStatus ?? "Pending"}</p></div></div>{["Ongoing", "Completed"].includes(session.sessionStatus) && !["Withdrawn", "Cancelled"].includes(enrollment.status) && <button className={`${button} mt-3`} onClick={() => onFeedback(session.sessionId, `${program?.title} — ${session.label}`)}><Star className="h-3.5 w-3.5" />Give Feedback</button>}</div>)}{enrollment.completion?.certificate?.status === "Active" && <a className={primary} target="_blank" rel="noreferrer" href={`/training/api/certificates/${enrollment.completion.certificate.id}`}><Award className="h-4 w-4" />Open Certificate</a>}</div></article>;
}

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }); }
