import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { normalizeTrainingState, type AttendanceStatus, type TrainerEvaluationTask, type TrainingEnrollment, type TrainingState } from '@/data/training';
import { trainingClient, trainingError } from '@/data/trainingClient';
import { Head, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Award,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    Download,
    Eye,
    MapPin,
    Printer,
    RefreshCcw,
    Send,
    ShieldCheck,
    Star,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const button = 'app-button';
const primary = `${button} app-button-primary`;
const input = 'app-control';
const card = 'app-card';
const tabs = ['Schedule', 'Attendance', 'Trainer Evaluations', 'Training Requests'] as const;
type TrainingTab = (typeof tabs)[number];
type Props = { initialTrainingState?: unknown };

type TrainerEvaluationTarget = TrainerEvaluationTask;

type TrainerEvaluationForm = {
    knowledge_rating: number;
    clarity_rating: number;
    communication_rating: number;
    engagement_rating: number;
    professionalism_rating: number;
    practical_relevance_rating: number;
    time_management_rating: number;
    safety_emphasis_rating: number | null;
    content_rating: number;
    relevance_rating: number;
    organization_rating: number;
    overall_satisfaction: number;
    trainer_strengths: string;
    trainer_improvements: string;
    comments: string;
};

const emptyTrainerEvaluation = (): TrainerEvaluationForm => ({
    knowledge_rating: 0,
    clarity_rating: 0,
    communication_rating: 0,
    engagement_rating: 0,
    professionalism_rating: 0,
    practical_relevance_rating: 0,
    time_management_rating: 0,
    safety_emphasis_rating: null,
    content_rating: 0,
    relevance_rating: 0,
    organization_rating: 0,
    overall_satisfaction: 0,
    trainer_strengths: '',
    trainer_improvements: '',
    comments: '',
});

function initial(value: unknown): TrainingState | null {
    try {
        return value == null ? null : normalizeTrainingState(value);
    } catch {
        return null;
    }
}

function tabFromHash(): TrainingTab {
    if (typeof window === 'undefined') return 'Schedule';
    const decoded = decodeURIComponent(window.location.hash.replace(/^#/, '').replace(/\+/g, ' '));
    return tabs.includes(decoded as TrainingTab) ? (decoded as TrainingTab) : 'Schedule';
}

export default function LearnerTraining({ initialTrainingState }: Props) {
    const { auth } = usePage().props;
    const isTrainee = auth.user.persona === 'trainee';
    const [state, setState] = useState<TrainingState | null>(() => initial(initialTrainingState));
    const [activeTab, setActiveTab] = useState<TrainingTab>(() => tabFromHash());
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(!state);
    const [feedback, setFeedback] = useState<TrainerEvaluationTarget | null>(null);
    const [ratings, setRatings] = useState<TrainerEvaluationForm>(() => emptyTrainerEvaluation());
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');

    const traineeHeader = (
        <div className="min-w-0 py-0.5">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-950">Learning Dashboard</h1>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">Current section: {activeTab}</p>
        </div>
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setState(await trainingClient.state());
        } catch (reason) {
            setError(trainingError(reason));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!state) void load();
    }, [load, state]);

    useEffect(() => {
        const sync = () => setActiveTab(tabFromHash());
        window.addEventListener('hashchange', sync);
        return () => window.removeEventListener('hashchange', sync);
    }, []);

    const selectTab = (tab: TrainingTab) => {
        setActiveTab(tab);
        window.history.replaceState(null, '', `#${encodeURIComponent(tab)}`);
    };

    const upcoming = useMemo(
        () =>
            (state?.enrollments.flatMap((enrollment) =>
                enrollment.sessions
                    .filter((session) => ['Scheduled', 'Ongoing'].includes(session.sessionStatus))
                    .map((session) => ({ enrollment, session })),
            ) ?? []).sort((left, right) => {
                const leftTime = new Date(left.session.startsAt).getTime();
                const rightTime = new Date(right.session.startsAt).getTime();
                return (Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER) -
                    (Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER);
            }),
        [state],
    );

    const scheduleRows = useMemo(
        () =>
            (state?.enrollments.flatMap((enrollment) =>
                enrollment.sessions.map((session) => ({ enrollment, session })),
            ) ?? []).sort((left, right) => {
                const leftTime = new Date(left.session.startsAt).getTime();
                const rightTime = new Date(right.session.startsAt).getTime();
                return (Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER) -
                    (Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER);
            }),
        [state],
    );

    const attendanceRows = useMemo(
        () =>
            state?.enrollments.flatMap((enrollment) =>
                enrollment.sessions.map((session) => ({ enrollment, session })),
            ) ?? [],
        [state],
    );

    useEffect(() => {
        if (!state) return;

        window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
            detail: {
                source: 'learner-training',
                context: {
                    workspace: activeTab,
                    assignedPrograms: state.enrollments.length,
                    upcomingSessions: upcoming.slice(0, 10).map(({ enrollment, session }) => ({
                        programId: enrollment.programId,
                        status: enrollment.status,
                        session: session.label,
                        startsAt: session.startsAt,
                        venue: session.venue,
                        sessionStatus: session.sessionStatus,
                    })),
                    attendance: attendanceRows.slice(0, 15).map(({ enrollment, session }) => ({
                        programId: enrollment.programId,
                        session: session.label,
                        trainingStatus: session.attendance?.trainingStatus ?? 'Pending',
                    })),
                    trainerEvaluations: {
                        quarter: state.trainerEvaluationQuarter,
                        pending: state.trainerEvaluationTasks.filter((row) => row.status === 'Pending').length,
                        done: state.trainerEvaluationTasks.filter((row) => row.status === 'Done').length,
                        notOpen: state.trainerEvaluationTasks.filter((row) => row.status === 'Not Open').length,
                        tasks: state.trainerEvaluationTasks.slice(0, 12).map((row) => ({
                            quarter: row.quarterLabel,
                            trainer: row.trainerName,
                            status: row.status,
                            sessionCount: row.sessionCount,
                            trainingTitles: row.trainingTitles,
                        })),
                    },
                },
            },
        }));

        return () => {
            window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
                detail: { source: 'learner-training', context: null },
            }));
        };
    }, [state, activeTab, upcoming, attendanceRows]);

    if (loading || !state) {
        return (
            <AuthenticatedLayout header={isTrainee ? traineeHeader : undefined}>
                <Head title="Training" />
                <div className="app-page">
                    <div className={`${card} p-8 text-center`}>
                        {error ? (
                            <>
                                <AlertCircle className="mx-auto h-7 w-7 text-rose-500" />
                                <p className="mt-2 text-sm font-bold">Training could not be loaded</p>
                                <p className="mt-1 text-xs text-slate-500">{error}</p>
                                <button className={`${primary} mt-4`} onClick={() => void load()}>
                                    <RefreshCcw className="h-4 w-4" /> Retry
                                </button>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500">Loading your persisted Training records…</p>
                        )}
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    const submitFeedback = async () => {
        if (!feedback) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            setState(await trainingClient.submitTrainerEvaluation({
                quarterKey: feedback.quarterKey,
                trainerKey: feedback.trainerKey,
                ...ratings,
            }));
            setNotice('Trainer evaluation submitted. This response is final and is now marked DONE.');
            setFeedback(null);
        } catch (reason) {
            setError(trainingError(reason));
        } finally {
            setBusy(false);
        }
    };

    const transitionEnrollment = async (id: string, status: 'Confirmed' | 'Withdrawn', reason?: string) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            setState(await trainingClient.transitionEnrollment(id, status, reason));
            setNotice(status === 'Confirmed' ? 'Your Training assignment is confirmed.' : 'Your Training assignment was withdrawn.');
        } catch (cause) {
            setError(trainingError(cause));
        } finally {
            setBusy(false);
        }
    };

    const saveAttendance = async (id: string, status: AttendanceStatus, note: string) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            setState(await trainingClient.markAttendance(id, status, note));
            setNotice('Facilitator attendance Draft saved for HR review.');
        } catch (cause) {
            setError(trainingError(cause));
        } finally {
            setBusy(false);
        }
    };

    const saveAssessment = async (id: string, payload: Record<string, unknown>) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            setState(await trainingClient.assess(id, payload));
            setNotice('Facilitator assessment Draft saved for HR review.');
        } catch (cause) {
            setError(trainingError(cause));
        } finally {
            setBusy(false);
        }
    };

    const evaluationIncomplete = [
        ratings.knowledge_rating,
        ratings.clarity_rating,
        ratings.communication_rating,
        ratings.engagement_rating,
        ratings.professionalism_rating,
        ratings.practical_relevance_rating,
        ratings.time_management_rating,
        ratings.content_rating,
        ratings.relevance_rating,
        ratings.organization_rating,
        ratings.overall_satisfaction,
    ].some((value) => value < 1 || value > 5);

    return (
        <AuthenticatedLayout header={isTrainee ? traineeHeader : <h1 className="truncate text-sm font-bold text-slate-900">Training</h1>}>
            <Head title="Training" />
            <div className="app-page app-page-enter space-y-5">
                {!isTrainee && (
                    <section>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Training Center</p>
                        <h2 className="mt-2 text-3xl font-bold text-slate-900">Stay on top of training</h2>
                        <p className="mt-1 text-sm text-slate-500">Review your schedule and attendance. Training governance and finalization remain with authorized HR/Training personnel.</p>
                    </section>
                )}

                {!isTrainee && (
                    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                        {tabs.filter((tab) => tab !== 'Trainer Evaluations').map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => selectTab(tab)}
                                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-[#121922] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-[#F4B400] hover:text-slate-900'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                )}

                {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</div>}
                {error && !feedback && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}

                {activeTab === 'Schedule' && (
                    isTrainee ? (
                        <TraineeSchedule
                            state={state}
                            rows={scheduleRows}
                            traineeName={auth.user.name}
                        />
                    ) : (
                        <>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <SnapshotCard label="Assigned Programs" value={state.enrollments.length} icon={CalendarClock} />
                                <SnapshotCard label="Upcoming Sessions" value={upcoming.length} icon={Clock} />
                                <SnapshotCard label="Completed Training" value={state.enrollments.filter((row) => row.completion?.status === 'Passed').length} icon={CheckCircle2} />
                            </div>
                            {state.actor.canFacilitate && <FacilitatorWorkspace state={state} busy={busy} onSave={saveAttendance} onAssess={saveAssessment} />}
                            {state.enrollments.length === 0 ? (
                                <section className={`${card} p-10 text-center`}>
                                    <CalendarClock className="mx-auto h-8 w-8 text-slate-300" />
                                    <h3 className="mt-3 text-base font-extrabold text-slate-900">No Training assignments yet</h3>
                                    <p className="mt-1 text-sm text-slate-500">Assigned onsite, workshop, practical, and instructor-led programs will appear here.</p>
                                </section>
                            ) : (
                                <div className="grid gap-4 xl:grid-cols-2">
                                    {state.enrollments.map((enrollment) => (
                                        <TrainingCard
                                            key={enrollment.id}
                                            state={state}
                                            enrollment={enrollment}
                                            busy={busy}
                                            onTransition={transitionEnrollment}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )
                )}

                {activeTab === 'Attendance' && <AttendanceWorkspace state={state} rows={attendanceRows} />}

                {activeTab === 'Trainer Evaluations' && isTrainee && (
                    <TrainerEvaluationsWorkspace
                        state={state}
                        onEvaluate={(task) => {
                            if (task.status !== 'Pending') return;
                            setRatings(emptyTrainerEvaluation());
                            setFeedback(task);
                            setError('');
                            setNotice('');
                        }}
                    />
                )}

                {activeTab === 'Training Requests' && <TrainingRequestsWorkspace state={state} onState={setState} />}

                {feedback && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={() => !busy && setFeedback(null)}>
                        <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                            <header className="flex items-start justify-between border-b border-slate-200 p-5">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">Trainer / Instructor Evaluation</p>
                                    <h3 className="mt-1 text-lg font-extrabold text-slate-950">{feedback.trainerName}</h3>
                                    <p className="mt-1 text-xs text-slate-500">{feedback.quarterLabel} · {feedback.sessionCount} verified attended session{feedback.sessionCount === 1 ? '' : 's'}</p>
                                </div>
                                <button type="button" disabled={busy} onClick={() => setFeedback(null)} aria-label="Close trainer evaluation">
                                    <X className="h-4 w-4" />
                                </button>
                            </header>

                            <div className="overflow-y-auto p-5">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                                    Submit one final evaluation for this trainer based on your verified attended Training sessions during the quarter. After submission, you will only see DONE and cannot reopen or view your answers. Aevyn may explain the criteria, but it does not choose ratings on your behalf.
                                </div>

                                <section className="mt-5">
                                    <div className="mb-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">A. Trainer Evaluation</p>
                                        <h4 className="mt-1 text-sm font-extrabold text-slate-900">How the trainer delivered Training during this quarter</h4>
                                    </div>
                                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                                        {([
                                            ['Knowledge of the subject', 'knowledge_rating'],
                                            ['Clarity of explanation', 'clarity_rating'],
                                            ['Communication', 'communication_rating'],
                                            ['Engagement with trainees', 'engagement_rating'],
                                            ['Professionalism', 'professionalism_rating'],
                                            ['Practical relevance', 'practical_relevance_rating'],
                                            ['Time management', 'time_management_rating'],
                                        ] as const).map(([label, key]) => (
                                            <div key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                                <span className="text-xs font-bold text-slate-700">{label}</span>
                                                <div className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <button key={value} type="button" onClick={() => setRatings((current) => ({ ...current, [key]: value }))} aria-label={`${label} ${value}`}>
                                                            <Star className={`h-5 w-5 ${value <= ratings[key] ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                                            <div>
                                                <span className="text-xs font-bold text-slate-700">Safety emphasis</span>
                                                <p className="mt-0.5 text-[10px] text-slate-400">Choose N/A when the session has no safety-specific delivery.</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((value) => (
                                                    <button key={value} type="button" onClick={() => setRatings((current) => ({ ...current, safety_emphasis_rating: value }))} aria-label={`Safety emphasis ${value}`}>
                                                        <Star className={`h-5 w-5 ${value <= (ratings.safety_emphasis_rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    className={`ml-2 rounded-lg border px-2 py-1 text-[10px] font-bold ${ratings.safety_emphasis_rating === null ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500'}`}
                                                    onClick={() => setRatings((current) => ({ ...current, safety_emphasis_rating: null }))}
                                                >
                                                    N/A
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <label className="block text-xs font-bold text-slate-700">
                                            What did the trainer do well?
                                            <textarea className={`${input} mt-1 min-h-24`} value={ratings.trainer_strengths} onChange={(event) => setRatings((current) => ({ ...current, trainer_strengths: event.target.value }))} />
                                        </label>
                                        <label className="block text-xs font-bold text-slate-700">
                                            What could be improved?
                                            <textarea className={`${input} mt-1 min-h-24`} value={ratings.trainer_improvements} onChange={(event) => setRatings((current) => ({ ...current, trainer_improvements: event.target.value }))} />
                                        </label>
                                    </div>
                                </section>

                                <section className="mt-6">
                                    <div className="mb-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">B. Training Experience</p>
                                        <h4 className="mt-1 text-sm font-extrabold text-slate-900">How useful and organized the attended Training was</h4>
                                    </div>
                                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                                        {([
                                            ['Content quality', 'content_rating'],
                                            ['Training relevance', 'relevance_rating'],
                                            ['Organization', 'organization_rating'],
                                            ['Overall satisfaction', 'overall_satisfaction'],
                                        ] as const).map(([label, key]) => (
                                            <div key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                                <span className="text-xs font-bold text-slate-700">{label}</span>
                                                <div className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <button key={value} type="button" onClick={() => setRatings((current) => ({ ...current, [key]: value }))} aria-label={`${label} ${value}`}>
                                                            <Star className={`h-5 w-5 ${value <= ratings[key] ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <label className="mt-4 block text-xs font-bold text-slate-700">
                                        Additional comments
                                        <textarea className={`${input} mt-1 min-h-24`} value={ratings.comments} onChange={(event) => setRatings((current) => ({ ...current, comments: event.target.value }))} />
                                    </label>
                                </section>

                                {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
                            </div>

                            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
                                <p className="text-[10px] text-slate-400">One final evaluation is allowed per trainee, trainer, and quarter. Submitted answers cannot be reopened from the trainee portal.</p>
                                <div className="flex gap-2">
                                    <button type="button" className={button} disabled={busy} onClick={() => setFeedback(null)}>Cancel</button>
                                    <button type="button" className={primary} disabled={busy || evaluationIncomplete} onClick={() => void submitFeedback()}>
                                        {busy ? 'Submitting…' : 'Submit Evaluation'}
                                    </button>
                                </div>
                            </footer>
                        </section>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}


function TrainerEvaluationsWorkspace({
    state,
    onEvaluate,
}: {
    state: TrainingState;
    onEvaluate: (task: TrainerEvaluationTask) => void;
}) {
    const tasks = state.trainerEvaluationTasks;
    const quarterOptions = useMemo(() => {
        const keys = new Map<string, string>();
        tasks.forEach((task) => keys.set(task.quarterKey, task.quarterLabel));
        if (state.trainerEvaluationQuarter.key) {
            keys.set(state.trainerEvaluationQuarter.key, state.trainerEvaluationQuarter.label);
        }
        return Array.from(keys.entries())
            .sort(([left], [right]) => right.localeCompare(left))
            .map(([key, label]) => ({ key, label }));
    }, [state.trainerEvaluationQuarter, tasks]);

    const [selectedQuarter, setSelectedQuarter] = useState(
        tasks.find((task) => task.status === 'Pending')?.quarterKey
        ?? quarterOptions[0]?.key
        ?? state.trainerEvaluationQuarter.key
        ?? '',
    );

    useEffect(() => {
        if (!selectedQuarter && quarterOptions[0]?.key) {
            setSelectedQuarter(quarterOptions[0].key);
        }
    }, [quarterOptions, selectedQuarter]);

    const rows = tasks.filter((task) => !selectedQuarter || task.quarterKey === selectedQuarter);
    const selectedMeta = rows[0] ?? (
        selectedQuarter === state.trainerEvaluationQuarter.key
            ? {
                quarterLabel: state.trainerEvaluationQuarter.label,
                isOpen: state.trainerEvaluationQuarter.isOpen,
                quarterEnd: state.trainerEvaluationQuarter.endDate,
            }
            : null
    );

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Trainer Evaluations</p>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-950">Quarterly trainer / instructor evaluation</h3>
                    <p className="mt-1 max-w-3xl text-sm text-slate-500">
                        Evaluate trainers who taught sessions you actually attended during the selected quarter. One final submission is allowed per trainer per quarter.
                    </p>
                </div>
                {quarterOptions.length > 0 && (
                    <select
                        className="app-control w-auto min-w-32"
                        aria-label="Evaluation quarter"
                        value={selectedQuarter}
                        onChange={(event) => setSelectedQuarter(event.target.value)}
                    >
                        {quarterOptions.map((quarter) => (
                            <option key={quarter.key} value={quarter.key}>{quarter.label}</option>
                        ))}
                    </select>
                )}
            </header>

            {selectedMeta && !selectedMeta.isOpen && (
                <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs font-semibold text-amber-900">
                    {selectedMeta.quarterLabel} evaluations are not open yet. The evaluation period begins after the quarter ends.
                </div>
            )}

            {rows.length === 0 ? (
                <div className="p-10 text-center">
                    <Star className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-900">No trainer evaluations for this quarter</p>
                    <p className="mt-1 text-xs text-slate-500">
                        A trainer appears here only when you have verified attendance in a completed Training session during the quarter.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            <tr>
                                <th className="px-6 py-3">Trainer / Instructor</th>
                                <th className="px-6 py-3">Training Attended</th>
                                <th className="px-6 py-3">Quarter</th>
                                <th className="px-6 py-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((task) => (
                                <tr key={`${task.quarterKey}-${task.trainerKey}`} className="hover:bg-slate-50/70">
                                    <td className="px-6 py-4">
                                        <p className="font-extrabold text-slate-900">{task.trainerName}</p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            {task.sessionCount} verified attended session{task.sessionCount === 1 ? '' : 's'}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            {task.trainingTitles.map((title) => (
                                                <p key={title} className="font-semibold text-slate-700">{title}</p>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-700">{task.quarterLabel}</td>
                                    <td className="px-6 py-4 text-center">
                                        {task.status === 'Done' ? (
                                            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-extrabold tracking-wide text-emerald-700">
                                                DONE
                                            </span>
                                        ) : task.status === 'Pending' ? (
                                            <button
                                                type="button"
                                                className="app-button app-button-primary"
                                                onClick={() => onEvaluate(task)}
                                            >
                                                Evaluate
                                            </button>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                Not yet open
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function attendanceTone(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === 'present') return 'bg-emerald-50 text-emerald-700';
    if (normalized === 'late' || normalized === 'partial') return 'bg-amber-50 text-amber-700';
    if (normalized === 'absent') return 'bg-rose-50 text-rose-700';
    return 'bg-slate-100 text-slate-600';
}

function formatDateOnly(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatTimeOnly(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function AttendanceWorkspace({ state, rows }: { state: TrainingState; rows: Array<{ enrollment: TrainingEnrollment; session: TrainingEnrollment['sessions'][number] }> }) {
    const [filter, setFilter] = useState('All');
    const filtered = rows.filter(({ session }) => {
        if (filter === 'All') return true;
        return String(session.attendance?.trainingStatus ?? 'Pending') === filter;
    });

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Attendance</p>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-950">Your official training attendance</h3>
                    <p className="mt-1 text-sm text-slate-500">Attendance records are read-only and controlled by authorized personnel or the attendance integration.</p>
                </div>
                <select className="app-control !h-9 !w-24 !min-w-0 !px-3 !py-1.5 text-xs" value={filter} onChange={(event) => setFilter(event.target.value)}>
                    {['All', 'Present', 'Late', 'Partial', 'Absent', 'Excused', 'Pending'].map((value) => <option key={value}>{value}</option>)}
                </select>
            </header>
            <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-xs">
                    <thead className="border-y border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                            <th className="px-5 py-3">Training</th>
                            <th className="px-5 py-3">Date</th>
                            <th className="px-5 py-3">Scheduled Time</th>
                            <th className="px-5 py-3">Time In / Out</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(({ enrollment, session }) => {
                            const program = state.programs.find((row) => row.id === enrollment.programId);
                            const attendance = (session.attendance ?? {}) as any;
                            const status = String(attendance.trainingStatus ?? 'Pending');
                            const timeIn = attendance.timeIn ?? attendance.time_in ?? attendance.clockedInAt ?? attendance.clocked_in_at ?? null;
                            const timeOut = attendance.timeOut ?? attendance.time_out ?? attendance.clockedOutAt ?? attendance.clocked_out_at ?? null;
                            const remarks = attendance.remarks ?? attendance.note ?? attendance.notes ?? (attendance.finalizedAt ? 'Official attendance record' : 'Awaiting finalization');
                            return (
                                <tr key={`${enrollment.id}-${session.id}`} className="hover:bg-slate-50/70">
                                    <td className="px-5 py-4 font-extrabold text-slate-900">{program?.title ?? enrollment.programId}</td>
                                    <td className="px-5 py-4 text-slate-600">{formatDateOnly(session.startsAt)}</td>
                                    <td className="px-5 py-4 text-slate-600">{formatTimeOnly(session.startsAt)} - {formatTimeOnly((session as any).endsAt ?? (session as any).ends_at)}</td>
                                    <td className="px-5 py-4 text-slate-600">{timeIn || timeOut ? `${formatTimeOnly(timeIn)} / ${formatTimeOnly(timeOut)}` : '—'}</td>
                                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 font-bold ${attendanceTone(status)}`}>{status}</span></td>
                                    <td className="px-5 py-4 text-slate-600">{remarks}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {filtered.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No attendance record matches this filter.</div>}
        </section>
    );
}

function TrainingRequestsWorkspace({ state, onState }: { state: TrainingState; onState: (next: TrainingState) => void }) {
    const client = trainingClient as any;
    const requestRows = ((state as any).requests ?? (state as any).trainingRequests ?? (state as any).training_requests ?? []) as any[];
    const canSubmit = typeof client.requestTraining === 'function' || typeof client.createRequest === 'function';
    const canCancel = typeof client.cancelRequest === 'function' || typeof client.cancelTrainingRequest === 'function';
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Professional Development');
    const [reason, setReason] = useState('');
    const [selected, setSelected] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const submitRequest = async () => {
        if (!canSubmit || !title.trim() || !reason.trim()) return;
        setBusy(true);
        setMessage('');
        try {
            const method = client.requestTraining ?? client.createRequest;
            const next = await method({ title: title.trim(), category, reason: reason.trim() });
            if (next) onState(normalizeTrainingState(next));
            setTitle('');
            setReason('');
            setMessage('Training request submitted.');
        } catch (error) {
            setMessage(trainingError(error));
        } finally {
            setBusy(false);
        }
    };

    const cancelRequest = async (row: any) => {
        if (!canCancel) return;
        setBusy(true);
        setMessage('');
        try {
            const method = client.cancelRequest ?? client.cancelTrainingRequest;
            const next = await method(row.id);
            if (next) onState(normalizeTrainingState(next));
            setMessage('Training request cancelled.');
        } catch (error) {
            setMessage(trainingError(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 px-5 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Training Requests</p>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-950">Request training for your development</h3>
                    <p className="mt-1 text-sm text-slate-500">Requests follow the governed approval workflow. Approval, assignment, and attendance remain controlled by authorized personnel.</p>
                </header>
                <div className="p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="text-xs font-bold text-slate-700">Requested training
                        <input className="app-control mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Training title" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Training category
                        <select className="app-control mt-2" value={category} onChange={(event) => setCategory(event.target.value)}>
                            {['Professional Development', 'Safety & Compliance', 'Technical Skills', 'Leadership Development'].map((value) => <option key={value}>{value}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-bold text-slate-700 lg:col-span-2">Reason or development need
                        <textarea className="app-control mt-2 min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain how this training supports your development" />
                    </label>
                </div>
                {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{message}</p>}
                {!canSubmit && <p className="mt-4 text-xs text-amber-700">Request submission will activate once the Training service exposes the governed self-service request endpoint. The form is ready, but the portal will not create a fake request.</p>}
                <button type="button" className={`${primary} mt-4`} disabled={!canSubmit || busy || !title.trim() || !reason.trim()} onClick={() => void submitRequest()}>
                    <Send className="h-4 w-4" /> {busy ? 'Submitting…' : 'Request Training'}
                </button>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 px-5 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Request History</p>
                    <h3 className="mt-2 text-lg font-extrabold text-slate-950">Your submitted requests</h3>
                </header>
                <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-left text-xs">
                        <thead className="border-y border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            <tr>
                                <th className="px-5 py-3">Training</th>
                                <th className="px-5 py-3">Request Date</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Reviewed By</th>
                                <th className="px-5 py-3">Decision Date</th>
                                <th className="px-5 py-3">Remarks</th>
                                <th className="px-5 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {requestRows.map((row: any) => {
                                const status = firstTextTraining(row.status) || 'Pending';
                                return (
                                    <tr key={row.id} className="hover:bg-slate-50/70">
                                        <td className="px-5 py-4"><p className="font-extrabold text-slate-900">{row.title ?? row.training_title}</p><p className="mt-1 text-[11px] text-slate-500">{row.category ?? row.training_category ?? 'Training'}</p></td>
                                        <td className="px-5 py-4 text-slate-600">{formatDateOnly(row.requested_at ?? row.request_date ?? row.created_at)}</td>
                                        <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 font-bold ${status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{status}</span></td>
                                        <td className="px-5 py-4 text-slate-600">{row.reviewed_by_name ?? row.reviewed_by ?? 'Not reviewed'}</td>
                                        <td className="px-5 py-4 text-slate-600">{formatDateOnly(row.decision_at ?? row.decision_date)}</td>
                                        <td className="px-5 py-4 text-slate-600">{row.remarks ?? row.review_note ?? '—'}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-3">
                                                <button type="button" className="inline-flex items-center gap-1 font-bold text-slate-900 underline decoration-amber-400 underline-offset-4" onClick={() => setSelected(row)}><Eye className="h-3.5 w-3.5" /> View Request</button>
                                                {status === 'Pending' && canCancel && <button type="button" disabled={busy} className="font-bold text-rose-600 underline underline-offset-4" onClick={() => void cancelRequest(row)}>Cancel Request</button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {requestRows.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No submitted training requests are available yet.</div>}
            </section>

            {selected && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={() => setSelected(null)}>
                    <section className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                        <header className="flex items-start justify-between border-b border-slate-200 p-5"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Training Request</p><h3 className="mt-1 text-lg font-extrabold text-slate-950">{selected.title ?? selected.training_title}</h3></div><button type="button" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button></header>
                        <div className="space-y-3 p-5 text-sm text-slate-600"><p><b className="text-slate-900">Category:</b> {selected.category ?? selected.training_category ?? '—'}</p><p><b className="text-slate-900">Reason:</b> {selected.reason ?? selected.development_need ?? '—'}</p><p><b className="text-slate-900">Status:</b> {selected.status ?? 'Pending'}</p><p><b className="text-slate-900">Remarks:</b> {selected.remarks ?? selected.review_note ?? '—'}</p></div>
                    </section>
                </div>
            )}
        </div>
    );
}

function firstTextTraining(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function TraineeSchedule({
    state,
    rows,
    traineeName,
}: {
    state: TrainingState;
    rows: Array<{ enrollment: TrainingEnrollment; session: TrainingEnrollment['sessions'][number] }>;
    traineeName: string;
}) {
    const grouped = useMemo(() => {
        const groups = new Map<string, Array<{ enrollment: TrainingEnrollment; session: TrainingEnrollment['sessions'][number] }>>();
        rows.forEach((row) => {
            const key = row.enrollment.id;
            const existing = groups.get(key) ?? [];
            existing.push(row);
            groups.set(key, existing);
        });
        return Array.from(groups.values());
    }, [rows]);

    const exportRows = rows.map(({ enrollment, session }) => {
        const program = state.programs.find((row) => row.id === enrollment.programId);
        const endsAt = (session as any).endsAt ?? (session as any).ends_at ?? null;
        const mode = firstTextTraining(
            (session as any).modality,
            (session as any).mode,
            (session as any).deliveryMode,
            (session as any).delivery_mode,
            (program as any)?.modality,
            (program as any)?.mode,
            (program as any)?.deliveryMode,
            (program as any)?.delivery_mode,
        ) || '—';
        const trainer = firstTextTraining(
            (session as any).facilitator,
            (session as any).facilitatorName,
            (session as any).facilitator_name,
            (session as any).trainerName,
            (session as any).trainer_name,
            (enrollment as any).facilitatorName,
            (enrollment as any).facilitator_name,
            (enrollment as any).trainerName,
            (enrollment as any).trainer_name,
            (program as any)?.facilitatorName,
            (program as any)?.facilitator_name,
            (program as any)?.trainerName,
            (program as any)?.trainer_name,
        ) || 'Not assigned yet';
        const date = new Date(session.startsAt);
        const day = Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { weekday: 'short' });
        return {
            training: program?.title ?? enrollment.programId,
            category: program?.category ?? 'Training',
            dayDate: `${day} · ${formatDateOnly(session.startsAt)}`,
            time: `${formatTimeOnly(session.startsAt)} - ${formatTimeOnly(endsAt)}`,
            session: session.label || 'Session',
            mode,
            venue: session.venue || 'Venue TBA',
            trainer,
            status: session.sessionStatus || enrollment.status,
        };
    });

    const openPrintableSchedule = () => {
        const popup = window.open('', '_blank', 'width=1100,height=800');
        if (!popup) return;

        const body = exportRows.map((row) => `
            <tr>
                <td><strong>${escapeTrainingHtml(row.training)}</strong><br><span>${escapeTrainingHtml(row.category)}</span></td>
                <td>${escapeTrainingHtml(row.dayDate)}</td>
                <td>${escapeTrainingHtml(row.time)}</td>
                <td>${escapeTrainingHtml(row.session)}</td>
                <td><strong>${escapeTrainingHtml(row.mode)}</strong><br><span>${escapeTrainingHtml(row.venue)}</span></td>
                <td>${escapeTrainingHtml(row.trainer)}</td>
                <td>${escapeTrainingHtml(row.status)}</td>
            </tr>
        `).join('');

        popup.document.write(`<!doctype html><html><head><title>Training Schedule</title><style>
            body{font-family:Arial,sans-serif;color:#0f172a;padding:28px} h1{font-size:22px;margin:0 0 4px} p{color:#64748b;margin:0 0 20px;font-size:12px}
            table{width:100%;border-collapse:collapse;font-size:11px} th{padding:10px 8px;text-align:left;border-bottom:1px solid #cbd5e1;color:#475569;text-transform:uppercase;font-size:9px;letter-spacing:.08em}
            td{padding:12px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top} td span{color:#64748b;font-size:10px} .meta{margin-bottom:16px;color:#334155;font-size:12px}
            @page{size:landscape;margin:12mm}
            @media print{body{padding:0}}
        </style></head><body><h1>Training Schedule</h1><div class="meta">${escapeTrainingHtml(traineeName)}</div><p>Your assigned training sessions</p><table><thead><tr><th>Training / Program</th><th>Day / Date</th><th>Time</th><th>Session</th><th>Mode / Venue</th><th>Trainer</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></body></html>`);
        popup.document.close();
        popup.focus();
        window.setTimeout(() => popup.print(), 150);
    };

    const printSchedule = () => openPrintableSchedule();
    const downloadSchedulePdf = () => {
        const pdf = createTrainingSchedulePdf(traineeName, exportRows);
        const url = URL.createObjectURL(pdf);
        const link = document.createElement('a');
        const safeName = traineeName
            .replace(/[^a-z0-9]+/gi, '_')
            .replace(/^_+|_+$/g, '') || 'Trainee';
        const dateStamp = new Date().toISOString().slice(0, 10);

        link.href = url;
        link.download = `Training_Schedule_${safeName}_${dateStamp}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-6 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Training Schedule</p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-950">Your assigned training sessions</h3>
                <p className="mt-1 text-sm text-slate-500">Only sessions relevant to your trainee learning path are shown.</p>
            </header>

            {rows.length === 0 ? (
                <div className="p-10 text-center">
                    <CalendarClock className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-900">No assigned training sessions yet</p>
                    <p className="mt-1 text-xs text-slate-500">Your schedule will appear here when training sessions are assigned to your account.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-[1120px] w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            <tr>
                                <th className="px-5 py-3">Training / Program</th>
                                <th className="px-5 py-3">Day / Date</th>
                                <th className="px-5 py-3">Time</th>
                                <th className="px-5 py-3">Session</th>
                                <th className="px-5 py-3">Mode / Venue</th>
                                <th className="px-5 py-3">Trainer</th>
                                <th className="px-5 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {grouped.flatMap((group) => {
                                const first = group[0];
                                const program = state.programs.find((row) => row.id === first.enrollment.programId);
                                return group.map(({ enrollment, session }, index) => {
                                    const endsAt = (session as any).endsAt ?? (session as any).ends_at ?? null;
                                    const mode = firstTextTraining(
                                        (session as any).modality,
                                        (session as any).mode,
                                        (session as any).deliveryMode,
                                        (session as any).delivery_mode,
                                        (program as any)?.modality,
                                        (program as any)?.mode,
                                        (program as any)?.deliveryMode,
                                        (program as any)?.delivery_mode,
                                    ) || '—';
                                    const trainer = firstTextTraining(
                                        (session as any).facilitator,
                                        (session as any).facilitatorName,
                                        (session as any).facilitator_name,
                                        (session as any).trainerName,
                                        (session as any).trainer_name,
                                        (enrollment as any).facilitatorName,
                                        (enrollment as any).facilitator_name,
                                        (enrollment as any).trainerName,
                                        (enrollment as any).trainer_name,
                                        (program as any)?.facilitatorName,
                                        (program as any)?.facilitator_name,
                                        (program as any)?.trainerName,
                                        (program as any)?.trainer_name,
                                    ) || 'Not assigned yet';
                                    const date = new Date(session.startsAt);
                                    const day = Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { weekday: 'short' });
                                    return (
                                        <tr key={`${enrollment.id}-${session.id}`} className="align-top hover:bg-slate-50/70">
                                            {index === 0 && (
                                                <td rowSpan={group.length} className="px-5 py-4 align-top">
                                                    <p className="font-extrabold text-slate-900">{program?.title ?? enrollment.programId}</p>
                                                    <p className="mt-1 text-[11px] text-slate-500">{program?.category ?? 'Training'}</p>
                                                </td>
                                            )}
                                            <td className="px-5 py-4 text-slate-700">
                                                <p className="font-semibold text-slate-900">{day}</p>
                                                <p className="mt-1 text-[11px] text-slate-500">{formatDateOnly(session.startsAt)}</p>
                                            </td>
                                            <td className="px-5 py-4 text-slate-700">{formatTimeOnly(session.startsAt)} - {formatTimeOnly(endsAt)}</td>
                                            <td className="px-5 py-4 text-slate-700">{session.label || 'Session'}</td>
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-800">{mode}</p>
                                                <p className="mt-1 text-[11px] text-slate-500">{session.venue || 'Venue TBA'}</p>
                                            </td>
                                            <td className="px-5 py-4 text-slate-700">{trainer}</td>
                                            <td className="px-5 py-4">
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${trainingScheduleStatusTone(session.sessionStatus || enrollment.status)}`}>
                                                    {session.sessionStatus || enrollment.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                });
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
                <button type="button" className="app-button" disabled={rows.length === 0} onClick={printSchedule}>
                    <Printer className="h-4 w-4" /> Print Schedule
                </button>
                <button type="button" className="app-button app-button-primary" disabled={rows.length === 0} onClick={downloadSchedulePdf}>
                    <Download className="h-4 w-4" /> Download PDF
                </button>
            </footer>
        </section>
    );
}

type TrainingScheduleExportRow = {
    training: string;
    category: string;
    dayDate: string;
    time: string;
    session: string;
    mode: string;
    venue: string;
    trainer: string;
    status: string;
};

function createTrainingSchedulePdf(traineeName: string, rows: TrainingScheduleExportRow[]) {
    const ascii = (value: unknown) => String(value ?? '')
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u00B7/g, '-')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, '?');

    const pdfText = (value: unknown) => ascii(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    const wrap = (value: unknown, maxChars: number, maxLines = 3) => {
        const words = ascii(value).trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return ['-'];

        const lines: string[] = [];
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length <= maxChars || !current) {
                current = candidate;
                continue;
            }
            lines.push(current);
            current = word;
            if (lines.length >= maxLines - 1) break;
        }
        if (current && lines.length < maxLines) lines.push(current);

        const usedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
        if (usedWords < words.length && lines.length > 0) {
            const last = lines.length - 1;
            lines[last] = `${lines[last].slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
        }
        return lines;
    };

    const pageWidth = 842;
    const pageHeight = 595;
    const margin = 34;
    const tableWidth = pageWidth - margin * 2;
    const columns = [
        { key: 'training', label: 'TRAINING / PROGRAM', width: 166, chars: 30, lines: 3 },
        { key: 'dayDate', label: 'DAY / DATE', width: 102, chars: 17, lines: 2 },
        { key: 'time', label: 'TIME', width: 82, chars: 14, lines: 2 },
        { key: 'session', label: 'SESSION', width: 86, chars: 15, lines: 2 },
        { key: 'modeVenue', label: 'MODE / VENUE', width: 120, chars: 21, lines: 3 },
        { key: 'trainer', label: 'TRAINER', width: 116, chars: 20, lines: 3 },
        { key: 'status', label: 'STATUS', width: 74, chars: 12, lines: 2 },
    ] as const;

    const normalizedRows = rows.map((row) => ({
        training: `${row.training}\n${row.category}`,
        dayDate: row.dayDate,
        time: row.time,
        session: row.session,
        modeVenue: `${row.mode}\n${row.venue}`,
        trainer: row.trainer,
        status: row.status,
    }));

    const rowLayouts = normalizedRows.map((row) => {
        const cells = columns.map((column) => {
            const raw = row[column.key];
            const parts = raw.split('\n');
            const wrapped = parts.flatMap((part) => wrap(part, column.chars, column.lines));
            return wrapped.slice(0, column.lines);
        });
        const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
        return { cells, height: Math.max(30, 10 + lineCount * 10) };
    });

    const firstPageTop = 489;
    const nextPageTop = 525;
    const bottomY = 52;
    const pages: Array<Array<{ cells: string[][]; height: number }>> = [];
    let currentPage: Array<{ cells: string[][]; height: number }> = [];
    let remaining = firstPageTop - bottomY;

    for (const row of rowLayouts) {
        if (currentPage.length > 0 && row.height > remaining) {
            pages.push(currentPage);
            currentPage = [];
            remaining = nextPageTop - bottomY;
        }
        currentPage.push(row);
        remaining -= row.height;
    }
    if (currentPage.length > 0 || pages.length === 0) pages.push(currentPage);

    const pageStreams = pages.map((pageRows, pageIndex) => {
        const content: string[] = [];
        const text = (x: number, y: number, size: number, value: unknown, bold = false) => {
            content.push(`0 g BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfText(value)}) Tj ET`);
        };
        const line = (x1: number, y1: number, x2: number, y2: number, gray = 0.82) => {
            content.push(`${gray} G 0.5 w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
        };

        if (pageIndex === 0) {
            text(margin, 558, 17, 'Training Schedule', true);
            text(margin, 540, 10, traineeName, true);
            text(margin, 525, 9, 'Your assigned training sessions');
            text(pageWidth - margin - 150, 540, 8, `Generated ${new Date().toLocaleDateString('en-PH')}`);
        } else {
            text(margin, 558, 13, 'Training Schedule', true);
            text(margin, 542, 8.5, traineeName);
        }

        let y = pageIndex === 0 ? 505 : 535;
        content.push(`0.94 g ${margin} ${(y - 20).toFixed(1)} ${tableWidth} 22 re f`);
        let x = margin;
        columns.forEach((column) => {
            text(x + 4, y - 13, 7.3, column.label, true);
            x += column.width;
        });
        line(margin, y - 20, pageWidth - margin, y - 20, 0.7);
        y -= 20;

        pageRows.forEach((row) => {
            let cellX = margin;
            row.cells.forEach((cellLines, columnIndex) => {
                const column = columns[columnIndex];
                cellLines.forEach((cellLine, lineIndex) => {
                    text(cellX + 4, y - 12 - lineIndex * 9.5, 7.6, cellLine, columnIndex === 0 && lineIndex === 0);
                });
                cellX += column.width;
            });
            y -= row.height;
            line(margin, y, pageWidth - margin, y, 0.88);
        });

        text(pageWidth - margin - 72, 28, 7.5, `Page ${pageIndex + 1} of ${pages.length}`);
        return content.join('\n');
    });

    const encoder = new TextEncoder();
    const pageObjectNumbers = pageStreams.map((_, index) => 5 + index * 2);
    const contentObjectNumbers = pageStreams.map((_, index) => 6 + index * 2);
    const objectCount = 4 + pageStreams.length * 2;
    const objects = new Map<number, string>();

    objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objects.set(2, `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageStreams.length} >>`);
    objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    pageStreams.forEach((stream, index) => {
        const pageNumber = pageObjectNumbers[index];
        const contentNumber = contentObjectNumbers[index];
        const streamLength = encoder.encode(stream).length;
        objects.set(pageNumber, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`);
        objects.set(contentNumber, `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
    });

    let pdf = '%PDF-1.4\n%ALIBATON\n';
    const offsets = new Array<number>(objectCount + 1).fill(0);
    for (let number = 1; number <= objectCount; number += 1) {
        offsets[number] = encoder.encode(pdf).length;
        pdf += `${number} 0 obj\n${objects.get(number) ?? ''}\nendobj\n`;
    }

    const xrefOffset = encoder.encode(pdf).length;
    pdf += `xref\n0 ${objectCount + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let number = 1; number <= objectCount; number += 1) {
        pdf += `${String(offsets[number]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([encoder.encode(pdf)], { type: 'application/pdf' });
}

function trainingScheduleStatusTone(status: string) {
    const normalized = String(status).toLowerCase();
    if (normalized === 'completed') return 'bg-emerald-50 text-emerald-700';
    if (normalized === 'ongoing' || normalized === 'confirmed') return 'bg-blue-50 text-blue-700';
    if (normalized === 'cancelled' || normalized === 'withdrawn') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
}

function escapeTrainingHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function SnapshotCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarClock }) {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <Icon className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-xl font-extrabold text-slate-950">{value}</p>
        </article>
    );
}

function FacilitatorWorkspace({ state, busy, onSave, onAssess }: { state: TrainingState; busy: boolean; onSave: (id: string, status: AttendanceStatus, note: string) => Promise<void>; onAssess: (id: string, payload: Record<string, unknown>) => Promise<void> }) {
    const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const rows = state.facilitation.flatMap((enrollment) => enrollment.sessions.map((session) => ({ enrollment, session })));

    return (
        <section className={`${card} overflow-hidden`}>
            <header className="flex items-start gap-3 border-b border-slate-200 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" />
                <div>
                    <h3 className="text-sm font-extrabold text-slate-950">Facilitator Draft Workspace</h3>
                    <p className="mt-1 text-xs text-slate-500">Record permitted facilitator observations. Only authorized HR/Training personnel can finalize governed records.</p>
                </div>
            </header>
            <div className="space-y-3 p-4">
                {rows.length === 0 ? (
                    <p className="text-sm text-slate-500">No participants are assigned to your facilitated sessions.</p>
                ) : rows.map(({ enrollment, session }) => {
                    const attendance = session.attendance;
                    const attendanceId = attendance?.id;
                    const status = attendanceId ? (statuses[attendanceId] ?? attendance?.trainingStatus ?? 'Pending') : 'Pending';
                    const note = attendanceId ? (notes[attendanceId] ?? attendance?.note ?? '') : '';
                    return (
                        <article key={`${enrollment.id}-${session.id}`} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-bold text-slate-900">{enrollment.participant}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{session.label} · {formatDate(session.startsAt)}</p>
                                </div>
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">{status}</span>
                            </div>
                            {attendanceId && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                                    <select className={input} value={status} onChange={(event) => setStatuses((current) => ({ ...current, [attendanceId]: event.target.value as AttendanceStatus }))}>
                                        {(['Pending', 'Present', 'Late', 'Partial', 'Absent', 'Excused'] as AttendanceStatus[]).map((option) => <option key={option}>{option}</option>)}
                                    </select>
                                    <input className={input} value={note} placeholder="Attendance note" onChange={(event) => setNotes((current) => ({ ...current, [attendanceId]: event.target.value }))} />
                                    <button className={button} disabled={busy} onClick={() => void onSave(attendanceId, status, note)}>Save Draft</button>
                                </div>
                            )}
                            {enrollment.assessment && (
                                <button className={`${button} mt-3`} disabled={busy} onClick={() => void onAssess(enrollment.id, { result: enrollment.assessment?.result ?? 'Pending', score: enrollment.assessment?.score, maximumScore: enrollment.assessment?.maximumScore, checklist: enrollment.assessment?.checklist ?? [], notes: enrollment.assessment?.notes })}>
                                    <ClipboardCheck className="h-3.5 w-3.5" /> Save Assessment Draft
                                </button>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function TrainingCard({ state, enrollment, busy, onTransition }: { state: TrainingState; enrollment: TrainingEnrollment; busy: boolean; onTransition: (id: string, status: 'Confirmed' | 'Withdrawn', reason?: string) => Promise<void> }) {
    const program = state.programs.find((row) => row.id === enrollment.programId);
    const starts = enrollment.sessions.map((session) => new Date(session.startsAt).getTime()).filter(Number.isFinite);
    const canWithdraw = ['Assigned', 'Confirmed'].includes(enrollment.status) && starts.some((value) => value > Date.now());

    return (
        <article className={`${card} overflow-hidden`}>
            <header className="border-b border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">{program?.category ?? 'Training'}</p>
                        <h3 className="mt-1 text-base font-extrabold text-slate-950">{program?.title ?? enrollment.programId}</h3>
                        <p className="mt-1 text-xs text-slate-500">{enrollment.source} · {enrollment.status}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">{enrollment.status}</span>
                </div>
                {['Assigned', 'Confirmed'].includes(enrollment.status) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {enrollment.status === 'Assigned' && <button className={primary} disabled={busy} onClick={() => void onTransition(enrollment.id, 'Confirmed')}>Confirm Assignment</button>}
                        {canWithdraw && <button className={button} disabled={busy} onClick={() => { const reason = window.prompt('Enter your reason for withdrawing before the session starts:'); if (reason?.trim()) void onTransition(enrollment.id, 'Withdrawn', reason.trim()); }}>Withdraw</button>}
                    </div>
                )}
            </header>
            <div className="space-y-3 p-4">
                {enrollment.sessions.map((session) => {
                    return (
                        <div key={session.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex flex-wrap justify-between gap-2">
                                <div>
                                    <p className="text-xs font-bold text-slate-900">{session.label}</p>
                                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><CalendarClock className="h-3 w-3" />{formatDate(session.startsAt)}</p>
                                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><MapPin className="h-3 w-3" />{session.venue}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] font-semibold text-slate-500">Attendance</p>
                                    <p className="mt-1 text-xs font-bold text-slate-800">{session.attendance?.trainingStatus ?? 'Pending'}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {enrollment.completion?.certificate?.status === 'Active' && (
                    <a className={primary} target="_blank" rel="noreferrer" href={`/training/api/certificates/${enrollment.completion.certificate.id}`}><Award className="h-4 w-4" /> Open Certificate</a>
                )}
            </div>
        </article>
    );
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}
