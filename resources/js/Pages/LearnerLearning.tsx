import {
    AppDrawer,
    AppModal,
    ProgressBar,
    StatusBadge,
} from "@/Components/Competency/CompetencyUI";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { LearningState } from "@/data/learning";
import { learningClient, learningError } from "@/data/learningClient";
import { Head, usePage } from "@inertiajs/react";
import {
    Award,
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Download,
    Eye,
    FileText,
    GraduationCap,
    List,
    Lock,
    Menu,
    PlayCircle,
    RotateCcw,
    Sparkles,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const btn =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} border-[#F4B400] bg-[#F4B400] text-slate-950 hover:bg-amber-400`;
const tabs = [
    "My Courses",
    "Assigned Learning",
    "Recommended Learning",
    "Learning Progress",
    "Course Catalog",
    "My Assessments",
    "Results",
    "Certificates",
    "Achievements",
    "Learning History",
] as const;
type Tab = (typeof tabs)[number];
export default function LearnerLearning({
    initialLearningState,
}: {
    initialLearningState: LearningState;
}) {
    const { auth } = usePage().props;
    const isTrainee = auth.user.persona === "trainee";
    const pageTitle = route().current("user.assessments.index")
        ? "Assessments"
        : route().current("user.certificates.index")
          ? "Certificates"
          : "My Learning";
    const pageEyebrow = route().current("user.assessments.index")
        ? "Learner Assessments"
        : route().current("user.certificates.index")
          ? "Learning Records"
          : "Learner LMS";
    const pageDescription = route().current("user.assessments.index")
        ? "Complete available assessments and review your persisted results."
        : route().current("user.certificates.index")
          ? "Review certificates and achievements issued from completed learning."
          : "Version-pinned online courses, saved progress, assessments, results, certificates, and transcript records.";
    const [state, setState] = useState(initialLearningState);
    const canonicalAssignments = useMemo(
        () => canonicalizeLearningAssignments(state.assignments ?? []),
        [state.assignments],
    );
    const activeAssignments = useMemo(
        () =>
            canonicalAssignments.filter(
                (row: any) =>
                    !assignmentIsCompleted(row) &&
                    !["Cancelled", "Expired"].includes(String(row?.status ?? "")),
            ),
        [canonicalAssignments],
    );
    const hashTab = (): Tab => {
        if (typeof window === "undefined") return "My Courses";
        const value = decodeURIComponent(window.location.hash.replace(/^#/, ""));
        const legacyAliases: Record<string, Tab> = {
            "My Learning": "My Courses",
            "Required Assignments": "Assigned Learning",
            "Eligible Course Catalog": "Course Catalog",
            "Learning Transcript": "Learning History",
        };
        const normalized = legacyAliases[value] ?? value;
        return (tabs as readonly string[]).includes(normalized) ? (normalized as Tab) : "My Courses";
    };
    const [tab, setTab] = useState<Tab>(() => hashTab());
    const [player, setPlayer] = useState<any>(null);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
            detail: {
                source: 'learner-learning',
                context: {
                    workspace: tab,
                    activeCourses: activeAssignments.slice(0, 12).map((row: any) => ({
                        id: row?.id,
                        title: row?.title,
                        status: row?.display_status ?? row?.status,
                        progressPercent: Number(row?.progress_percent ?? 0),
                        dueAt: row?.due_at ?? null,
                    })),
                    completedCount: (state.completions ?? []).length,
                    catalogCount: (state.catalog ?? []).length,
                    playerOpen: Boolean(player),
                },
            },
        }));

        return () => {
            window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
                detail: { source: 'learner-learning', context: null },
            }));
        };
    }, [tab, activeAssignments, state.completions, state.catalog, player]);

    useEffect(() => {
        const syncFromHash = () => {
            setPlayer(null);
            setTab(hashTab());
        };

        window.addEventListener("hashchange", syncFromHash);

        return () =>
            window.removeEventListener("hashchange", syncFromHash);
    }, []);

    const selectTab = (value: Tab) => {
        setPlayer(null);
        setTab(value);

        if (typeof window !== "undefined") {
            const next = `#${encodeURIComponent(value)}`;

            if (window.location.hash !== next) {
                window.history.replaceState(null, "", next);
                window.dispatchEvent(new Event("hashchange"));
            }
        }
    };
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const openPlayer = async (id: string) => {
        setLoading(true);
        setError("");
        try {
            const value = await learningClient.player(id);
            assignmentDetailCache.set(String(id), value);
            setPlayer(value);
        } catch (e) {
            setError(learningError(e));
        } finally {
            setLoading(false);
        }
    };
    const refresh = async () => {
        try {
            setState(await learningClient.state());
        } catch (e) {
            setError(learningError(e));
        }
    };
    const selfEnroll = async (
        versionId: string,
        destination: Tab = "My Courses",
    ) => {
        setLoading(true);
        setError("");
        try {
            await learningClient.selfEnroll(versionId);
            await refresh();
            setPlayer(null);
            selectTab(destination);
        } catch (e) {
            setError(learningError(e));
        } finally {
            setLoading(false);
        }
    };
    return (
        <AuthenticatedLayout
            header={
                isTrainee ? (
                    <div className="min-w-0 py-0.5">
                        <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-950">Learning Dashboard</h1>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">Current section: {tab}</p>
                    </div>
                ) : undefined
            }
        >
            <Head title={pageTitle} />
            <div className="mx-auto w-full max-w-[1600px] space-y-4">
                {!isTrainee && (
                    <header className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                                {pageEyebrow}
                            </p>
                            <h1 className="mt-1 text-2xl font-extrabold text-slate-950">
                                {pageTitle}
                            </h1>
                            <p className="mt-1 text-sm text-slate-600">
                                {pageDescription}
                            </p>
                        </div>
                        <button className={btn} onClick={refresh}>
                            Refresh
                        </button>
                    </header>
                )}
                {error && (
                    <p
                        role="alert"
                        className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                    >
                        {error}
                    </p>
                )}
                {!isTrainee && (
                    <nav
                        aria-label="Learner LMS areas"
                        className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
                    >
                        <div className="flex min-w-max gap-1">
                            {tabs.map((value) => (
                                <button
                                    className={`min-h-10 rounded-lg px-4 text-sm font-bold ${tab === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                                    key={value}
                                    onClick={() => selectTab(value)}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                    </nav>
                )}
                {!player && tab === "My Courses" && (
                    <AssignmentCards rows={activeAssignments} open={openPlayer} loading={loading} />
                )}
                {!player && tab === "Assigned Learning" && (
                    <AssignedLearning
                        rows={activeAssignments.filter((row) => row.is_mandatory)}
                        open={openPlayer}
                        loading={loading}
                    />
                )}
                {!player && tab === "Recommended Learning" && (
                    <RecommendedLearning
                        rows={(state as any).recommendations ?? (state as any).recommended_learning ?? (state as any).recommendedLearning ?? []}
                        open={openPlayer}
                        enroll={selfEnroll}
                        loading={loading}
                    />
                )}
                {!player && tab === "Learning Progress" && (
                    <LearningProgress rows={activeAssignments} open={openPlayer} />
                )}
                {!player && tab === "Course Catalog" && (
                    <Catalog
                        rows={state.catalog}
                        assignments={canonicalAssignments}
                        completions={state.completions}
                        enroll={(versionId: string) =>
                            selfEnroll(versionId, "Course Catalog")
                        }
                        loading={loading}
                    />
                )}
                {!player && tab === "My Assessments" && (
                    <AssessmentTable rows={activeAssignments} open={openPlayer} loading={loading} />
                )}
                {!player && tab === "Results" && (
                    <Results assignments={canonicalAssignments} completions={state.completions} open={openPlayer} />
                )}
                {!player && tab === "Certificates" && <Certificates rows={state.completions} />}
                {!player && tab === "Achievements" && <Achievements rows={state.completions} />}
                {!player && tab === "Learning History" && <Transcript rows={state.completions} />}
                <CoursePlayer
                    data={player}
                    close={() => {
                        setPlayer(null);
                        selectTab("My Courses");
                    }}
                    changed={async () => {
                        if (player) {
                            const next = await learningClient.player(
                                player.assignment.id,
                            );
                            assignmentDetailCache.set(String(player.assignment.id), next);
                            setPlayer(next);
                            await refresh();
                        }
                    }}
                />
            </div>
        </AuthenticatedLayout>
    );
}

function assignmentVersionKey(row: any) {
    const versionId = String(
        row?.course_version_id ?? row?.courseVersionId ?? "",
    ).trim();
    if (versionId) return `version:${versionId}`;

    const courseId = String(row?.course_id ?? row?.courseId ?? row?.code ?? "").trim();
    const versionNumber = String(row?.version_number ?? row?.versionNumber ?? "").trim();
    return `${courseId || "course"}:${versionNumber || String(row?.id ?? "unknown")}`;
}

function assignmentCanonicalScore(row: any) {
    const status = String(row?.status ?? row?.display_status ?? "").toLowerCase();
    const progress = Math.max(0, Math.min(100, Number(row?.progress_percent ?? 0)));

    if (assignmentIsCompleted(row)) return 500 + progress;
    if (status === "in progress") return 400 + progress;
    if (status === "failed/attempts exhausted") return 350 + progress;
    if (status === "not started") return 300;
    if (status === "overdue") return 250 + progress;
    if (status === "expired") return 100;
    if (status === "cancelled") return 50;
    return 200 + progress;
}

function canonicalizeLearningAssignments(rows: any[]) {
    const canonical = new Map<string, any>();

    rows.forEach((row: any) => {
        const key = assignmentVersionKey(row);
        const current = canonical.get(key);

        if (!current || assignmentCanonicalScore(row) > assignmentCanonicalScore(current)) {
            canonical.set(key, row);
            return;
        }

        if (assignmentCanonicalScore(row) === assignmentCanonicalScore(current)) {
            const rowTime = Date.parse(
                row?.completed_at ?? row?.last_activity_at ?? row?.assigned_at ?? "",
            );
            const currentTime = Date.parse(
                current?.completed_at ?? current?.last_activity_at ?? current?.assigned_at ?? "",
            );
            if ((Number.isFinite(rowTime) ? rowTime : 0) > (Number.isFinite(currentTime) ? currentTime : 0)) {
                canonical.set(key, row);
            }
        }
    });

    return [...canonical.values()];
}

function assignmentIsCompleted(row: any) {
    const progress = Number(row?.progress_percent ?? 0);
    return (
        row?.status === "Completed" ||
        row?.display_status === "Completed" ||
        (Number.isFinite(progress) && progress >= 100)
    );
}

function assignmentActionLabel(row: any) {
    if (assignmentIsCompleted(row)) return "View Completed Course";
    return Number(row?.progress_percent ?? 0) > 0 ? "Resume Course" : "Start Course";
}

function AssignmentCards({ rows, open, loading }: any) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-5 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">My Learning</p>
                <h2 className="mt-2 text-xl font-extrabold text-slate-950">My courses</h2>
                <p className="mt-1 text-sm text-slate-500">Start courses that are ready for you or resume unfinished learning from your saved progress.</p>
            </header>

            <div className="grid items-stretch gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {rows.length ? (
                    rows.map((row: any) => {
                        const completed = assignmentIsCompleted(row);
                        const progress = Math.max(0, Math.min(100, Number(row.progress_percent ?? 0)));
                        const action = assignmentActionLabel(row);

                        return (
                            <article
                                className="flex min-h-64 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
                                key={row.id}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-xs text-slate-500">
                                            {row.code} · v{row.version_number}
                                        </p>
                                        <h3 className="mt-1 text-lg font-bold text-slate-950">
                                            {row.title}
                                        </h3>
                                    </div>
                                    <StatusBadge value={completed ? "Completed" : row.display_status} />
                                </div>
                                <div className="mt-4">
                                    <ProgressBar value={progress} />
                                </div>
                                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <dt className="text-xs font-bold uppercase text-slate-500">Assignment</dt>
                                        <dd className="mt-1">{row.is_mandatory ? "Required" : "Optional"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-bold uppercase text-slate-500">Due</dt>
                                        <dd className="mt-1">{date(row.due_at)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-bold uppercase text-slate-500">Source</dt>
                                        <dd className="mt-1">{row.source}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-bold uppercase text-slate-500">Learning state</dt>
                                        <dd className="mt-1">
                                            {completed ? "Course completed" : progress > 0 ? "Continue saved progress" : "Ready to start"}
                                        </dd>
                                    </div>
                                </dl>
                                <button
                                    disabled={loading || ["Cancelled", "Expired"].includes(row.status)}
                                    className={`${completed ? btn : primary} mt-auto`}
                                    onClick={() => open(row.id)}
                                >
                                    {completed ? <Eye className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                                    {action}
                                </button>
                            </article>
                        );
                    })
                ) : (
                    <Empty
                        title="No active courses"
                        text="Completed courses are kept in Development → Learning History. New or unfinished learning will appear here."
                    />
                )}
            </div>
        </section>
    );
}

const assignmentDetailCache = new Map<string, any>();

function useAssignmentDetails(rows: any[]) {
    const ids = useMemo(
        () => rows.map((row: any) => String(row.id)).sort().join('|'),
        [rows],
    );
    const [details, setDetails] = useState<Record<string, any>>(() => {
        const seeded: Record<string, any> = {};
        rows.forEach((row: any) => {
            const cached = assignmentDetailCache.get(String(row.id));
            if (cached) seeded[String(row.id)] = cached;
        });
        return seeded;
    });

    useEffect(() => {
        let cancelled = false;
        const missing = rows.filter(
            (row: any) => !assignmentDetailCache.has(String(row.id)),
        );
        if (!missing.length) {
            const next: Record<string, any> = {};
            rows.forEach((row: any) => {
                const cached = assignmentDetailCache.get(String(row.id));
                if (cached) next[String(row.id)] = cached;
            });
            setDetails(next);
            return () => {
                cancelled = true;
            };
        }

        void Promise.allSettled(
            missing.map(async (row: any) => {
                const value = await learningClient.player(row.id);
                assignmentDetailCache.set(String(row.id), value);
                return [String(row.id), value] as const;
            }),
        ).then(() => {
            if (cancelled) return;
            const next: Record<string, any> = {};
            rows.forEach((row: any) => {
                const cached = assignmentDetailCache.get(String(row.id));
                if (cached) next[String(row.id)] = cached;
            });
            setDetails(next);
        });

        return () => {
            cancelled = true;
        };
    }, [ids]);

    return details;
}

function firstText(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function learnerVisibleAssessments(detail: any) {
    return (detail?.course?.assessments ?? []).filter((assessment: any) => {
        const searchable = `${assessment?.assessment_type ?? ''} ${assessment?.title ?? ''}`.toLowerCase();
        if (searchable.includes('post-test') || searchable.includes('post test') || searchable.includes('post_test')) {
            return false;
        }
        return assessment?.assessment_type === 'Knowledge Check';
    });
}

function moduleCompletion(detail: any, module: any) {
    const progress = detail?.progress ?? [];
    const required = (module?.lessons ?? []).filter((lesson: any) => lesson.is_required);
    const completed = required.filter((lesson: any) =>
        progress.some(
            (item: any) => item.lesson_id === lesson.id && item.status === 'Completed',
        ),
    ).length;
    return { completed, total: required.length };
}

function trainerLabel(row: any, detail: any) {
    return firstText(
        row?.trainer_name,
        row?.trainer,
        row?.facilitator_name,
        row?.facilitator,
        row?.instructor_name,
        detail?.assignment?.trainer_name,
        detail?.assignment?.facilitator_name,
        detail?.course?.trainer_name,
        detail?.course?.facilitator_name,
        detail?.course?.instructor_name,
    ) || 'Not assigned yet';
}

function assignedByLabel(row: any) {
    return firstText(
        row?.assigned_by_name,
        row?.assigned_by,
        row?.assignment_source,
        row?.source,
    ) || 'Authorized assignment';
}

function AssignedLearning({ rows, open, loading }: any) {
    const details = useAssignmentDetails(rows);

    if (!rows.length) {
        return (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 px-5 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Assigned Learning</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">Formal learning assignments</h2>
                    <p className="mt-1 text-sm text-slate-500">Mandatory or formally assigned learning stays separate from optional recommendations.</p>
                </header>
                <div className="p-5">
                    <Empty
                        title="No formal learning assignments"
                        text="Mandatory or formally assigned learning will appear here when it is assigned to your trainee account."
                    />
                </div>
            </section>
        );
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-5 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Assigned Learning
                </p>
                <h2 className="mt-2 text-xl font-extrabold text-slate-950">
                    Formal learning assignments
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Mandatory or formally assigned learning stays separate from optional recommendations.
                </p>
            </header>

            <div className="space-y-3 px-5 pb-5">
                {rows.map((row: any) => {
                    const detail = details[String(row.id)];

                    return (
                        <article
                            key={row.id}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300"
                        >
                            <div className="grid items-center gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(150px,0.55fr)_minmax(145px,0.55fr)_minmax(135px,0.5fr)_auto]">
                                <div className="min-w-0">
                                    <h3 className="truncate text-sm font-extrabold text-slate-950">
                                        {row.title}
                                    </h3>
                                    <p className="mt-1 truncate text-[11px] text-slate-500">
                                        {row.category ?? 'Required Learning'}
                                    </p>
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                        Trainer / Facilitator
                                    </p>
                                    <p className="mt-1.5 truncate text-xs font-medium text-slate-800">
                                        {trainerLabel(row, detail)}
                                    </p>
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                        Assigned By
                                    </p>
                                    <p className="mt-1.5 truncate text-xs font-medium text-slate-800">
                                        {assignedByLabel(row)}
                                    </p>
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                        Due Date
                                    </p>
                                    <p className="mt-1.5 text-xs font-medium text-slate-800">
                                        {date(row.due_at)}
                                    </p>
                                </div>

                                <div className="flex xl:justify-end">
                                    <button
                                        type="button"
                                        disabled={loading || ['Cancelled', 'Expired'].includes(row.status)}
                                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#111827] px-4 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                                        onClick={() => open(row.id)}
                                    >
                                        Open Course
                                    </button>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function RecommendedLearning({ rows }: any) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-5 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Recommended Learning
                </p>
                <h2 className="mt-2 text-xl font-extrabold text-slate-950">
                    Optional learning for your growth
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Recommendations do not become mandatory or enroll you automatically.
                </p>
            </header>

            {rows.length ? (
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                    {rows.map((row: any, index: number) => {
                        const status = firstText(row.status, row.display_status) || 'Not Started';
                        const title = firstText(row.title, row.course_title) || 'Recommended learning';
                        const category = firstText(row.category, row.course_category);
                        const duration = firstText(row.duration, row.duration_label);
                        const modality = firstText(row.modality, row.delivery_mode);
                        const description = firstText(row.description, row.summary, row.reason);
                        const competency = firstText(row.related_competency, row.competency, row.skill_gap);
                        const priority = firstText(row.priority);
                        const source = firstText(row.source, row.recommended_by);
                        const progress = Number(row.progress_percent ?? row.progress ?? 0);
                        const safeProgress = Number.isFinite(progress)
                            ? Math.max(0, Math.min(100, progress))
                            : 0;
                        const meta = [category, duration, modality].filter(Boolean).join(' · ');
                        const normalizedStatus = status.toLowerCase();
                        const statusClass = normalizedStatus.includes('progress')
                            ? 'bg-sky-50 text-sky-700'
                            : normalizedStatus.includes('complete')
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700';

                        return (
                            <article
                                key={row.id ?? `${title}-${index}`}
                                className="min-h-[166px] rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-base font-extrabold leading-6 text-slate-950">
                                            {title}
                                        </h3>
                                        {meta && (
                                            <p className="mt-1 text-xs text-slate-500">
                                                {meta}
                                            </p>
                                        )}
                                    </div>

                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>
                                        {status}
                                    </span>
                                </div>

                                {description && (
                                    <p className="mt-4 text-sm leading-6 text-slate-600">
                                        {description}
                                    </p>
                                )}

                                <div className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                                    <p className="text-slate-500">
                                        Related competency:{' '}
                                        <span className="font-bold text-slate-800">
                                            {competency || 'Not provided'}
                                        </span>
                                    </p>

                                    <p className="text-slate-500">
                                        Priority:{' '}
                                        <span className="font-bold text-slate-800">
                                            {priority || 'Not provided'}
                                        </span>
                                    </p>

                                    <p className="text-slate-500">
                                        Source:{' '}
                                        <span className="font-bold text-slate-800">
                                            {source || 'Not provided'}
                                        </span>
                                    </p>

                                    <p className="text-slate-500">
                                        Current progress:{' '}
                                        <span className="font-bold text-slate-800">
                                            {safeProgress}%
                                        </span>
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="p-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-lg font-extrabold text-slate-950">
                            No recommended learning available right now
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Learner-specific recommendations will appear here when recommendation data is available for your account.
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
}

function catalogEnrollmentState(row: any, assignments: any[], completions: any[]) {
    const publishedVersionId = String(row?.publishedVersionId ?? row?.published_version_id ?? "");
    const courseId = String(row?.id ?? row?.course_id ?? "");

    const sameVersionAssignment = assignments.find(
        (assignment: any) =>
            publishedVersionId &&
            String(assignment?.course_version_id ?? assignment?.courseVersionId ?? "") === publishedVersionId,
    );
    const sameVersionCompletion = completions.find(
        (completion: any) =>
            publishedVersionId &&
            String(completion?.course_version_id ?? completion?.courseVersionId ?? "") === publishedVersionId,
    );

    if (sameVersionCompletion || (sameVersionAssignment && assignmentIsCompleted(sameVersionAssignment))) {
        return { kind: "completed" as const, assignment: sameVersionAssignment };
    }

    const activeLineageAssignment = assignments.find((assignment: any) => {
        const sameVersion =
            publishedVersionId &&
            String(assignment?.course_version_id ?? assignment?.courseVersionId ?? "") === publishedVersionId;
        const sameCourse =
            courseId && String(assignment?.course_id ?? assignment?.courseId ?? "") === courseId;
        return (
            (sameVersion || sameCourse) &&
            !assignmentIsCompleted(assignment) &&
            !["Cancelled", "Expired"].includes(String(assignment?.status ?? ""))
        );
    });

    if (activeLineageAssignment) {
        return { kind: "enrolled" as const, assignment: activeLineageAssignment };
    }

    return { kind: "available" as const, assignment: null };
}

function Catalog({
    rows,
    assignments,
    completions,
    enroll,
    loading,
}: any) {
    const [selected, setSelected] = useState<any>(null);
    const selectedEnrollment = selected
        ? catalogEnrollmentState(selected, assignments, completions)
        : null;

    const catalogAction = (
        row: any,
        enrollment: ReturnType<typeof catalogEnrollmentState>,
    ) => {
        if (enrollment.kind !== "available") return;
        enroll(row.publishedVersionId);
    };

    const catalogActionLabel = () => "Self-enroll";

    return (
        <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 px-5 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Course Catalog</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">Explore available courses</h2>
                    <p className="mt-1 text-sm text-slate-500">Browse published courses available to your trainee profile. Self-enroll is available once per published version; after enrollment the same button remains visible but is disabled.</p>
                </header>

                <div className="grid items-stretch gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                    {rows.length ? (
                        rows.map((row: any) => {
                            const enrollment = catalogEnrollmentState(row, assignments, completions);
                            return (
                                <article className="flex min-h-64 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={row.id}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-mono text-xs text-slate-500">{row.code} · v{row.publishedVersion}</p>
                                            <h3 className="mt-1 text-lg font-bold text-slate-950">{row.title}</h3>
                                        </div>
                                        {enrollment.kind !== "available" && (
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${enrollment.kind === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
                                                {enrollment.kind === "completed" ? "Completed" : "Enrolled"}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 text-sm text-slate-600">{row.category} · {row.audience}</p>
                                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{firstText(row.description, row.summary, row.objective, row.short_description) || 'Course details will appear here when the published course description is available.'}</p>
                                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                                        <button type="button" className={btn} onClick={() => setSelected(row)}>
                                            <Eye className="h-4 w-4" /> View Details
                                        </button>
                                        <button
                                            type="button"
                                            className={enrollment.kind === "available" ? primary : btn}
                                            disabled={loading || enrollment.kind !== "available"}
                                            onClick={() => catalogAction(row, enrollment)}
                                        >
                                            <GraduationCap className="h-4 w-4" />
                                            {catalogActionLabel()}
                                        </button>
                                    </div>
                                </article>
                            );
                        })
                    ) : (
                        <Empty title="No eligible catalog courses" text="Eligibility comes from the Published course audience." />
                    )}
                </div>
            </section>
            <AppModal
                show={Boolean(selected)}
                title={selected?.title ?? 'Course details'}
                description={selected ? `${selected.code} · v${selected.publishedVersion}` : ''}
                onClose={() => setSelected(null)}
                maxWidth="xl"
                footer={selected && selectedEnrollment ? (
                    <button
                        type="button"
                        className={selectedEnrollment.kind === "available" ? primary : btn}
                        disabled={loading || selectedEnrollment.kind !== "available"}
                        onClick={() => {
                            setSelected(null);
                            catalogAction(selected, selectedEnrollment);
                        }}
                    >
                        <GraduationCap className="h-4 w-4" />
                        {catalogActionLabel()}
                    </button>
                ) : undefined}
            >
                {selected && (
                    <div className="space-y-4 text-sm text-slate-600">
                        <p className="leading-7">{firstText(selected.description, selected.summary, selected.objective, selected.short_description) || 'No published description is available for this course yet.'}</p>
                        {selectedEnrollment && selectedEnrollment.kind !== "available" && (
                            <div className={`rounded-xl border px-4 py-3 ${selectedEnrollment.kind === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
                                <p className="font-bold">{selectedEnrollment.kind === "completed" ? "This published version is already completed." : "You are already enrolled in this course."}</p>
                                <p className="mt-1 text-xs">{selectedEnrollment.kind === "completed" ? "Its permanent record is available in Development → Learning History." : "Continue the existing learning record from My Courses; a duplicate enrollment will not be created."}</p>
                            </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Category</p><p className="mt-1 font-semibold text-slate-800">{selected.category || '—'}</p></div>
                            <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Audience</p><p className="mt-1 font-semibold text-slate-800">{selected.audience || '—'}</p></div>
                        </div>
                    </div>
                )}
            </AppModal>
        </>
    );
}

function LearningProgress({ rows, open }: any) {
    const details = useAssignmentDetails(rows);
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Learning Progress</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">Your progress at a glance</h2>
                    <p className="mt-1 text-sm text-slate-500">Progress comes from your persisted learning records and configured course requirements.</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">Progress from configured requirements</span>
            </header>
            {rows.length ? (
                <div className="overflow-x-auto">
                <table className="min-w-[1120px] w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                            <th className="px-5 py-3">Course</th>
                            <th className="px-5 py-3">Progress</th>
                            <th className="px-5 py-3">Completed Modules</th>
                            <th className="px-5 py-3">Assessment Summary</th>
                            <th className="px-5 py-3">Activity</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((row: any) => {
                            const detail = details[String(row.id)];
                            const modules = detail?.modules ?? [];
                            const completeModules = modules.filter((module: any) => {
                                const value = moduleCompletion(detail, module);
                                return value.total > 0 && value.completed >= value.total;
                            }).length;
                            const assessments = learnerVisibleAssessments(detail);
                            const attempts = (detail?.attempts ?? []).filter((attempt: any) => assessments.some((assessment: any) => assessment.id === attempt.assessment_id));
                            const passed = attempts.some((attempt: any) => attempt.passed === true);
                            const assessmentSummary = assessments.length === 0
                                ? 'No assessments configured'
                                : passed
                                  ? 'Module Quiz: Passed'
                                  : attempts.length
                                    ? 'Module Quiz: In progress'
                                    : `${assessments.length} assessment${assessments.length === 1 ? '' : 's'} available`;
                            const progress = Math.max(0, Math.min(100, Number(row.progress_percent ?? 0)));
                            return (
                                <tr key={row.id} className="cursor-pointer transition hover:bg-slate-50/70" onClick={() => open(row.id)}>
                                    <td className="px-5 py-4">
                                        <p className="font-extrabold text-slate-900">{row.title}</p>
                                        <p className="mt-1 text-[11px] text-slate-500">{row.code} · v{row.version_number}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex min-w-48 items-center gap-3">
                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#F4B400]" style={{ width: `${progress}%` }} /></div>
                                            <span className="w-10 text-right font-extrabold text-amber-700">{progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-slate-700">{detail ? `${completeModules} / ${modules.length} modules` : 'Loading…'}</td>
                                    <td className="px-5 py-4 text-slate-700">{detail ? assessmentSummary : 'Loading…'}</td>
                                    <td className="px-5 py-4 text-slate-600">{row.status === 'Completed' || progress >= 100 ? 'Completed recently' : progress > 0 ? 'Active learning record' : 'Not started'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            ) : (
                <div className="p-5">
                    <Empty title="No learning progress yet" text="Progress appears after a governed course is assigned or you self-enroll in an eligible published course." />
                </div>
            )}
        </section>
    );
}

function AssessmentTable({ rows, open, loading }: any) {
    const available = rows.filter((row: any) => !['Cancelled', 'Expired'].includes(row.status));
    const details = useAssignmentDetails(available);
    const assessmentRows = available.flatMap((row: any) => {
        const detail = details[String(row.id)];
        if (!detail) return [];
        return learnerVisibleAssessments(detail).map((assessment: any) => {
            const attempts = (detail?.attempts ?? []).filter((attempt: any) => attempt.assessment_id === assessment.id);
            const latest = [...attempts].sort((a: any, b: any) => Number(b.attempt_number ?? 0) - Number(a.attempt_number ?? 0))[0];
            return { row, detail, assessment, attempts, latest };
        });
    });
    const pending = assessmentRows.filter(({ latest }: any) => !latest?.passed).length;

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">My Assessments</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">Assessments that need your attention</h2>
                    <p className="mt-1 text-sm text-slate-500">Review available module assessments linked to your courses. Open an assessment from here to continue inside the related Course Viewer.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{pending} pending</span>
            </header>
            <div className="overflow-x-auto">
                <table className="min-w-[1160px] w-full text-left text-xs">
                    <thead className="border-y border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                            <th className="px-5 py-3">Assessment</th>
                            <th className="px-5 py-3">Type</th>
                            <th className="px-5 py-3">Course / Module</th>
                            <th className="px-5 py-3">Attempts</th>
                            <th className="px-5 py-3">Passing Score</th>
                            <th className="px-5 py-3">Due Date</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {assessmentRows.map(({ row, detail, assessment, attempts, latest }: any) => {
                            const module = (detail?.modules ?? []).find((value: any) => value.id === assessment.module_id);
                            const passing = assessment.passing_score_percent ?? assessment.passing_score ?? assessment.required_score ?? '—';
                            const maxAttempts = assessment.max_attempts ?? assessment.attempt_limit ?? '—';
                            const status = latest?.passed === true ? 'Passed' : latest?.status === 'In Progress' ? 'In Progress' : attempts.length ? 'Retake available' : 'Available';
                            return (
                                <tr key={`${row.id}-${assessment.id}`} className="hover:bg-slate-50/70">
                                    <td className="px-5 py-4 font-extrabold text-slate-900">{assessment.title}</td>
                                    <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Module Quiz</span></td>
                                    <td className="px-5 py-4 text-slate-600"><p className="font-semibold text-slate-800">{row.title}</p><p className="mt-1 text-[11px]">{module?.title ?? 'Course assessment'}</p></td>
                                    <td className="px-5 py-4 text-slate-600">{attempts.length} / {maxAttempts}</td>
                                    <td className="px-5 py-4 text-slate-600">{passing === '—' ? '—' : `${passing}%`}</td>
                                    <td className="px-5 py-4 text-slate-600">{date(row.due_at)}</td>
                                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 font-bold ${status === 'Passed' ? 'bg-emerald-50 text-emerald-700' : status === 'In Progress' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{status}</span></td>
                                    <td className="px-5 py-4"><button type="button" className="font-bold text-slate-900 underline decoration-amber-400 underline-offset-4" disabled={loading} onClick={() => open(row.id)}>Open Assessment</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {!assessmentRows.length && (
                <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <ClipboardCheck className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-3 text-sm font-extrabold text-slate-900">No assessments need attention</p>
                    <p className="mt-1 text-xs text-slate-500">Completed assessment records remain available under Results.</p>
                </div>
            )}
        </section>
    );
}

function Achievements({ rows }: any) {
    const completed = rows.filter((row: any) => row.completed_at);

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Learning Milestones</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">Achievements</h2>
                    <p className="mt-1 max-w-3xl text-sm text-slate-500">Professional milestones based on your recorded learning, training, assessments, and development data.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                    {completed.length} verified milestone{completed.length === 1 ? '' : 's'}
                </span>
            </header>

            {completed.length ? (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {completed.map((row: any) => (
                        <article key={row.id} className="px-5 py-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start gap-3">
                                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                                            <Award className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-extrabold text-slate-950">Completed {row.title}</h3>
                                            <p className="mt-1 text-xs leading-5 text-slate-500">Completed the recorded learning requirement for this course.</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Type</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-700">Course milestone</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Related Record</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-700">{row.title}</p>
                                        </div>
                                    </div>
                                </div>

                                <p className="shrink-0 text-xs font-semibold text-slate-500">{date(row.completed_at)}</p>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="border-t border-slate-100 px-6 py-10 text-center">
                    <Award className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-extrabold text-slate-900">No learning achievements yet</p>
                    <p className="mt-1 text-xs text-slate-500">Verified learning milestones will appear here after governed completion records are available.</p>
                </div>
            )}
        </section>
    );
}

function Results({ assignments, completions, open }: any) {
    const [filter, setFilter] = useState<'All' | 'Module Quiz' | 'Passed' | 'Failed'>('All');
    const details = useAssignmentDetails(assignments);
    const rows = assignments.flatMap((row: any) => {
        const detail = details[String(row.id)];
        if (!detail) return [];
        return learnerVisibleAssessments(detail).flatMap((assessment: any) => {
            const attempts = (detail?.attempts ?? []).filter((attempt: any) => attempt.assessment_id === assessment.id && (attempt.submitted_at || attempt.status === 'Submitted' || attempt.passed !== null));
            return attempts.map((attempt: any) => ({ row, detail, assessment, attempt }));
        });
    });
    const fallbackRows = rows.length ? [] : (completions ?? []).filter((value: any) => value.assessment_score !== null && value.assessment_score !== undefined).map((value: any) => ({
        fallback: true,
        completion: value,
    }));
    const filtered = rows.filter(({ attempt }: any) => {
        if (filter === 'Passed') return attempt.passed === true;
        if (filter === 'Failed') return attempt.passed === false;
        return true;
    });

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Assessment Results</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">Your assessment attempt history</h2>
                    <p className="mt-1 text-sm text-slate-500">Review your recorded assessment attempts, scores, and results.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(['All', 'Module Quiz', 'Passed', 'Failed'] as const).map((value) => (
                        <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === value ? 'bg-[#111827] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value}</button>
                    ))}
                </div>
            </header>
            <div className="overflow-x-auto">
                <table className="min-w-[1060px] w-full text-left text-xs">
                    <thead className="border-y border-slate-200 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                            <th className="px-5 py-3">Assessment</th>
                            <th className="px-5 py-3">Type</th>
                            <th className="px-5 py-3">Course</th>
                            <th className="px-5 py-3">Attempt</th>
                            <th className="px-5 py-3">Score</th>
                            <th className="px-5 py-3">Result</th>
                            <th className="px-5 py-3">Recorded</th>
                            <th className="px-5 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(({ row, assessment, attempt }: any) => {
                            const passing = assessment.passing_score_percent ?? assessment.passing_score ?? assessment.required_score ?? null;
                            return (
                                <tr key={`${row.id}-${assessment.id}-${attempt.id}`} className="hover:bg-slate-50/70">
                                    <td className="px-5 py-4 font-extrabold text-slate-900">{assessment.title}</td>
                                    <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Module Quiz</span></td>
                                    <td className="px-5 py-4 text-slate-600">{row.title}</td>
                                    <td className="px-5 py-4 text-slate-600">{attempt.attempt_number ?? '—'} / {assessment.max_attempts ?? assessment.attempt_limit ?? '—'}</td>
                                    <td className="px-5 py-4 font-bold text-slate-900">{attempt.score_percent ?? attempt.score ?? '—'}{attempt.score_percent !== null && attempt.score_percent !== undefined ? '%' : ''}{passing !== null ? <span className="font-normal text-slate-400"> / {passing}%</span> : null}</td>
                                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 font-bold ${attempt.passed === true ? 'bg-emerald-50 text-emerald-700' : attempt.passed === false ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{attempt.passed === true ? 'Passed' : attempt.passed === false ? 'Failed' : attempt.status ?? 'Recorded'}</span></td>
                                    <td className="px-5 py-4 text-slate-600">{date(attempt.submitted_at ?? attempt.updated_at)}</td>
                                    <td className="px-5 py-4"><button type="button" className="font-bold text-slate-900 underline decoration-amber-400 underline-offset-4" onClick={() => open(row.id)}>View Details</button></td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && fallbackRows.map(({ completion }: any) => (
                            <tr key={completion.id}>
                                <td className="px-5 py-4 font-extrabold text-slate-900">Recorded assessment</td>
                                <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Assessment</span></td>
                                <td className="px-5 py-4 text-slate-600">{completion.title}</td>
                                <td className="px-5 py-4 text-slate-600">—</td>
                                <td className="px-5 py-4 font-bold text-slate-900">{completion.assessment_score}</td>
                                <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Recorded</span></td>
                                <td className="px-5 py-4 text-slate-600">{date(completion.completed_at)}</td>
                                <td className="px-5 py-4 text-slate-400">—</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {filtered.length === 0 && fallbackRows.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">No assessment attempt history is available yet.</div>
            )}
        </section>
    );
}
function Certificates({ rows }: any) {
    const [selected, setSelected] = useState<any>(null);
    const issued = rows.filter((row: any) => row.certificate_id);

    const previewUrl = (row: any) =>
        firstText(
            row.certificate_preview_url,
            row.certificate_image_url,
            row.preview_image_url,
            row.image_url,
        );

    return (
        <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 px-5 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">My Certificates</p>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-950">Certificates earned</h2>
                    <p className="mt-1 text-sm text-slate-500">Only certificates issued to your trainee account after verified completion are shown.</p>
                </header>

                {issued.length ? (
                    <div className="grid gap-5 border-t border-slate-100 p-5 md:grid-cols-2 xl:grid-cols-3">
                        {issued.map((row: any) => {
                            const image = previewUrl(row);
                            return (
                                <button
                                    key={row.id}
                                    type="button"
                                    onClick={() => setSelected(row)}
                                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-amber-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]"
                                >
                                    <div className="aspect-[1.414/1] overflow-hidden bg-slate-50">
                                        {image ? (
                                            <img
                                                src={image}
                                                alt={`Certificate preview for ${row.title}`}
                                                className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.01]"
                                            />
                                        ) : (
                                            <div className="flex h-full flex-col items-center justify-center border-b border-dashed border-slate-200 px-6 text-center">
                                                <Award className="h-10 w-10 text-amber-500" />
                                                <p className="mt-3 text-sm font-extrabold text-slate-900">Certificate preview</p>
                                                <p className="mt-1 text-xs leading-5 text-slate-500">The issued certificate image will appear here when its preview is available.</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-extrabold text-slate-950">{row.title}</h3>
                                                <p className="mt-1 text-xs text-slate-500">Issued {date(row.issued_on ?? row.completed_at)}</p>
                                            </div>
                                            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-amber-600" />
                                        </div>
                                        {row.certificate_number && (
                                            <p className="mt-3 text-[11px] font-semibold text-slate-500">Certificate {row.certificate_number}</p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mx-5 mb-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                        <Award className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-3 text-sm font-extrabold text-slate-900">No certificates available yet</p>
                        <p className="mt-1 text-xs text-slate-500">Certificates issued by HR/Admin for eligible completed learning or training will appear here.</p>
                    </div>
                )}
            </section>

            <AppModal
                show={Boolean(selected)}
                title={selected?.title ?? 'Certificate'}
                description={selected ? `Issued ${date(selected.issued_on ?? selected.completed_at)}` : ''}
                onClose={() => setSelected(null)}
                maxWidth="2xl"
            >
                {selected && (
                    <div className="space-y-4">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {previewUrl(selected) ? (
                                <img
                                    src={previewUrl(selected)}
                                    alt={`Certificate for ${selected.title}`}
                                    className="max-h-[70vh] w-full object-contain"
                                />
                            ) : (
                                <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
                                    <Award className="h-12 w-12 text-amber-500" />
                                    <p className="mt-4 text-base font-extrabold text-slate-950">Certificate preview is not available yet</p>
                                    <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">The certificate record is issued, but an image preview has not been provided by the connected certificate source.</p>
                                </div>
                            )}
                        </div>
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Certificate Number</p>
                                <p className="mt-1 font-semibold text-slate-800">{selected.certificate_number ?? '—'}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</p>
                                <p className="mt-1 font-semibold text-slate-800">{selected.certificate_status ?? 'Issued'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </AppModal>
        </>
    );
}

function Transcript({ rows }: any) {
    return (
        <Table
            eyebrow="Learning History"
            title="Your learning record"
            description="Review completed learning records, certificate status, and transcript evidence from your trainee account."
            heads={[
                "Course lineage/version",
                "Completion timestamp",
                "Online Learning certificate",
                "Transcript status",
                "Competency evidence",
            ]}
            rows={rows.map((r: any) => [
                `${r.title} · v${r.version_number}`,
                date(r.completed_at),
                r.certificate_number ?? "Not issued",
                r.transcript_id ? "Recorded" : "Pending",
                "Supporting evidence only; reassessment required",
            ])}
        />
    );
}

type CourseWorkspaceView =
    | { kind: "overview" }
    | { kind: "module"; moduleId: string }
    | { kind: "lesson"; lessonId: string }
    | { kind: "quiz"; assessmentId: string; moduleId: string };

function CoursePlayer({ data, close, changed }: any) {
    const [view, setView] = useState<CourseWorkspaceView>({ kind: "overview" });
    const [outline, setOutline] = useState(false);
    const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set());
    const [assessment, setAssessment] = useState<any>(null);
    const [attempt, setAttempt] = useState<any>(null);
    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");

    const modules = data?.modules ?? [];
    const progress = data?.progress ?? [];
    const attempts = data?.attempts ?? [];
    const moduleQuizRows = (data?.course?.assessments ?? []).filter(
        (value: any) => value.assessment_type === "Knowledge Check",
    );

    const lessons = useMemo(
        () =>
            modules.flatMap((module: any, moduleIndex: number) =>
                (module.lessons ?? []).map((lesson: any, lessonIndex: number) => ({
                    ...lesson,
                    moduleId: module.id,
                    moduleTitle: module.title,
                    moduleIndex,
                    lessonIndex,
                })),
            ),
        [modules],
    );

    const isDone = (lessonId: string) =>
        progress.some(
            (value: any) => value.lesson_id === lessonId && value.status === "Completed",
        );

    const quizzesForModule = (moduleId: string | null | undefined) =>
        moduleQuizRows.filter((value: any) => value.module_id === moduleId);

    const quizPassed = (quizId: string) =>
        attempts.some(
            (value: any) => value.assessment_id === quizId && value.passed === true,
        );

    const requiredLessonsForModule = (module: any) =>
        (module?.lessons ?? []).filter((lesson: any) => lesson.is_required !== false);

    const moduleRequiredLessonsComplete = (moduleId: string | null | undefined) => {
        const module = modules.find((value: any) => value.id === moduleId);
        if (!module) return false;
        const required = requiredLessonsForModule(module);
        return required.every((lesson: any) => isDone(lesson.id));
    };

    const moduleSummary = (module: any) => {
        const requiredLessons = requiredLessonsForModule(module);
        const completedLessons = requiredLessons.filter((lesson: any) => isDone(lesson.id)).length;
        const quizzes = quizzesForModule(module.id);
        const requiredQuizzes = quizzes.filter((quiz: any) => quiz.is_required !== false);
        const passedQuizzes = requiredQuizzes.filter((quiz: any) => quizPassed(quiz.id)).length;
        const requiredUnits = requiredLessons.length + requiredQuizzes.length;
        const completedUnits = completedLessons + passedQuizzes;
        const percent = requiredUnits > 0 ? Math.round((completedUnits / requiredUnits) * 100) : 100;

        return {
            requiredLessons: requiredLessons.length,
            completedLessons,
            quizzes,
            requiredQuizzes: requiredQuizzes.length,
            passedQuizzes,
            complete: completedUnits >= requiredUnits,
            percent,
        };
    };

    const courseCompleted =
        data?.assignment?.status === "Completed" ||
        Number(data?.assignment?.progress_percent ?? 0) >= 100;

    const resumeTarget = useMemo<CourseWorkspaceView>(() => {
        if (!data || courseCompleted) return { kind: "overview" };

        for (const module of modules) {
            const requiredLessons = requiredLessonsForModule(module);
            const unfinishedLesson = requiredLessons.find((lesson: any) => !isDone(lesson.id));
            if (unfinishedLesson) {
                return { kind: "lesson", lessonId: unfinishedLesson.id };
            }

            const pendingQuiz = quizzesForModule(module.id).find(
                (quiz: any) => quiz.is_required !== false && !quizPassed(quiz.id),
            );
            if (pendingQuiz) {
                return { kind: "module", moduleId: module.id };
            }
        }

        const unfinishedLesson = lessons.find((lesson: any) => !isDone(lesson.id));
        if (unfinishedLesson) return { kind: "lesson", lessonId: unfinishedLesson.id };

        return modules[0]?.id
            ? { kind: "module", moduleId: modules[0].id }
            : { kind: "overview" };
    }, [data, courseCompleted]);

    useEffect(() => {
        if (!data?.assignment?.id) return;
        setAssessment(null);
        setAttempt(null);
        setAnswers({});
        setResult(null);
        setError("");
        setView(resumeTarget);

        if (resumeTarget.kind === "lesson") {
            const lesson = lessons.find((value: any) => value.id === resumeTarget.lessonId);
            if (lesson?.moduleId) setExpandedModules(new Set([lesson.moduleId]));
        } else if (resumeTarget.kind === "module") {
            setExpandedModules(new Set([resumeTarget.moduleId]));
        } else if (modules[0]?.id) {
            setExpandedModules(new Set([modules[0].id]));
        }
    }, [data?.assignment?.id]);

    const currentLesson =
        view.kind === "lesson"
            ? lessons.find((lesson: any) => lesson.id === view.lessonId)
            : null;
    const currentModule =
        view.kind === "module"
            ? modules.find((module: any) => module.id === view.moduleId)
            : currentLesson
              ? modules.find((module: any) => module.id === currentLesson.moduleId)
              : view.kind === "quiz"
                ? modules.find((module: any) => module.id === view.moduleId)
                : null;
    const currentModuleQuizzes = currentModule ? quizzesForModule(currentModule.id) : [];

    useEffect(() => {
        const selectedQuiz = view.kind === 'quiz'
            ? moduleQuizRows.find((row: any) => row.id === view.assessmentId)
            : null;
        const lessonExcerpt = currentLesson
            ? firstText(currentLesson.text_content, currentLesson.description, currentLesson.objective).slice(0, 1800)
            : null;

        window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
            detail: {
                source: 'learner-course-player',
                context: {
                    view: view.kind,
                    course: {
                        id: data?.course?.id ?? data?.assignment?.course_id,
                        title: data?.course?.title,
                        versionNumber: data?.course?.version_number,
                        status: data?.assignment?.status,
                        progressPercent: Number(data?.assignment?.progress_percent ?? 0),
                        dueAt: data?.assignment?.due_at ?? null,
                    },
                    module: currentModule
                        ? { id: currentModule.id, title: currentModule.title }
                        : null,
                    lesson: currentLesson
                        ? {
                              id: currentLesson.id,
                              title: currentLesson.title,
                              completed: isDone(currentLesson.id),
                              excerpt: lessonExcerpt,
                          }
                        : null,
                    assessment: selectedQuiz
                        ? {
                              id: selectedQuiz.id,
                              title: selectedQuiz.title,
                              type: 'Knowledge Check',
                              passed: quizPassed(selectedQuiz.id),
                          }
                        : null,
                },
            },
        }));

        return () => {
            window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
                detail: { source: 'learner-course-player', context: null },
            }));
        };
    }, [view, currentModule?.id, currentLesson?.id, data?.assignment?.progress_percent, data?.assignment?.status, progress, attempts]);

    const toggleModule = (moduleId: string) => {
        setExpandedModules((current) => {
            const next = new Set(current);
            if (next.has(moduleId)) next.delete(moduleId);
            else next.add(moduleId);
            return next;
        });
    };

    const openOverview = () => {
        setView({ kind: "overview" });
        setAssessment(null);
        setAttempt(null);
        setResult(null);
    };

    const openModule = (moduleId: string) => {
        setExpandedModules((current) => new Set(current).add(moduleId));
        setView({ kind: "module", moduleId });
        setAssessment(null);
        setAttempt(null);
        setResult(null);
    };

    const openLesson = (lessonId: string) => {
        const lesson = lessons.find((value: any) => value.id === lessonId);
        if (lesson?.moduleId) setExpandedModules((current) => new Set(current).add(lesson.moduleId));
        setView({ kind: "lesson", lessonId });
        setAssessment(null);
        setAttempt(null);
        setResult(null);
    };

    const startQuiz = async (quiz: any) => {
        if (courseCompleted || !moduleRequiredLessonsComplete(quiz.module_id)) return;
        setError("");
        try {
            const value = await learningClient.startAttempt(data.assignment.id, quiz.id);
            setAssessment(quiz);
            setAttempt(value);
            setAnswers({});
            setResult(null);
            setView({ kind: "quiz", assessmentId: quiz.id, moduleId: quiz.module_id });
        } catch (e) {
            setError(learningError(e));
        }
    };

    const submitQuiz = async () => {
        if (!attempt) return;
        try {
            const responses = (attempt.question_snapshot ?? []).map((question: any) => ({
                questionId: question.id,
                optionIds: answers[question.id] ?? [],
            }));
            setResult(await learningClient.submitAttempt(attempt.id, responses));
            await changed();
        } catch (e) {
            setError(learningError(e));
        }
    };

    useEffect(() => {
        if (!attempt?.id || result || !Object.keys(answers).length) return;
        const timer = window.setTimeout(() => {
            const responses = (attempt.question_snapshot ?? []).map((question: any) => ({
                questionId: question.id,
                optionIds: answers[question.id] ?? [],
            }));
            void learningClient
                .saveResponses(attempt.id, responses)
                .catch((value) => setError(learningError(value)));
        }, 700);
        return () => window.clearTimeout(timer);
    }, [answers, attempt, result]);

    const completeLesson = async () => {
        if (!currentLesson || courseCompleted || isDone(currentLesson.id)) return;
        setError("");
        try {
            await learningClient.recordLesson(data.assignment.id, currentLesson.id, true);
            await changed();

            const module = modules.find((value: any) => value.id === currentLesson.moduleId);
            const moduleLessons = module?.lessons ?? [];
            const indexInModule = moduleLessons.findIndex((value: any) => value.id === currentLesson.id);
            const nextLesson = moduleLessons[indexInModule + 1];

            if (nextLesson) {
                openLesson(nextLesson.id);
                return;
            }

            if (quizzesForModule(currentLesson.moduleId).length) {
                openModule(currentLesson.moduleId);
                return;
            }

            const moduleIndex = modules.findIndex((value: any) => value.id === currentLesson.moduleId);
            const nextModule = modules[moduleIndex + 1];
            if (nextModule) openModule(nextModule.id);
            else openOverview();
        } catch (e) {
            setError(learningError(e));
        }
    };

    if (!data) return null;

    const overallProgress = Math.max(0, Math.min(100, Number(data.assignment.progress_percent ?? 0)));
    const requiredLessonCount = lessons.filter((lesson: any) => lesson.is_required !== false).length;
    const completedRequiredLessons = lessons.filter(
        (lesson: any) => lesson.is_required !== false && isDone(lesson.id),
    ).length;
    const passedQuizCount = moduleQuizRows.filter((quiz: any) => quizPassed(quiz.id)).length;
    const courseDescription = firstText(
        data.course.description,
        data.course.summary,
        data.course.objective,
        data.course.short_description,
    );

    const continueFromTarget = () => {
        if (resumeTarget.kind === "lesson") openLesson(resumeTarget.lessonId);
        else if (resumeTarget.kind === "module") openModule(resumeTarget.moduleId);
        else openOverview();
    };

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 bg-gradient-to-r from-white via-white to-amber-50/60 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Course Workspace</p>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${courseCompleted ? "bg-emerald-50 text-emerald-700" : overallProgress > 0 ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                                {courseCompleted ? "Completed" : overallProgress > 0 ? "In Progress" : "Not Started"}
                            </span>
                        </div>
                        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{data.course.title}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Official v{data.course.version_number} · {data.assignment.is_mandatory ? "Required" : "Optional"} · Due {date(data.assignment.due_at)}
                        </p>
                    </div>
                    <button className={btn} onClick={close}>
                        <ChevronLeft className="h-4 w-4" />
                        Back to My Courses
                    </button>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <div className="min-w-[220px] flex-1">
                        <ProgressBar value={overallProgress} />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">{overallProgress}%</span>
                    <span className="text-xs font-medium text-slate-500">
                        {courseCompleted ? "Learning requirements completed" : "Progress is saved automatically"}
                    </span>
                </div>
            </header>

            {error && (
                <p className="m-5 mb-0 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>
            )}

            <div className="grid min-h-[650px] lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="hidden border-r border-slate-200 bg-slate-50/60 lg:block">
                    <CourseOutline
                        modules={modules}
                        view={view}
                        expandedModules={expandedModules}
                        toggleModule={toggleModule}
                        openOverview={openOverview}
                        openModule={openModule}
                        openLesson={openLesson}
                        startQuiz={startQuiz}
                        isDone={isDone}
                        moduleSummary={moduleSummary}
                        moduleRequiredLessonsComplete={moduleRequiredLessonsComplete}
                        quizPassed={quizPassed}
                        courseCompleted={courseCompleted}
                    />
                </aside>

                <main className="min-w-0 p-5 md:p-7">
                    <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
                        <button className={btn} onClick={() => setOutline(true)}>
                            <Menu className="h-4 w-4" /> Course Content
                        </button>
                        <span className="text-xs font-bold text-slate-500">{overallProgress}% complete</span>
                    </div>

                    {view.kind === "overview" && (
                        <div className="space-y-6">
                            <section className="rounded-2xl border border-slate-200 bg-white p-6">
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Course Overview</p>
                                <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
                                    <div className="max-w-3xl">
                                        <h3 className="text-2xl font-extrabold text-slate-950">{data.course.title}</h3>
                                        <p className="mt-3 text-sm leading-7 text-slate-600">
                                            {courseDescription || "Review the course modules and continue through the learning content at your saved progress."}
                                        </p>
                                    </div>
                                    <button className={courseCompleted ? btn : primary} onClick={courseCompleted ? () => modules[0]?.id && openModule(modules[0].id) : continueFromTarget}>
                                        {courseCompleted ? <Eye className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                                        {courseCompleted ? "Review Course" : overallProgress > 0 ? "Resume Learning" : "Start Learning"}
                                    </button>
                                </div>
                            </section>

                            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <MetricCard label="Modules" value={modules.length} />
                                <MetricCard label="Required lessons" value={`${completedRequiredLessons} / ${requiredLessonCount}`} />
                                <MetricCard label="Module quizzes" value={moduleQuizRows.length} />
                                <MetricCard label="Quiz passed" value={`${passedQuizCount} / ${moduleQuizRows.length}`} />
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white">
                                <header className="border-b border-slate-100 px-5 py-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Learning Path</p>
                                    <h3 className="mt-1 text-lg font-extrabold text-slate-950">Course modules</h3>
                                </header>
                                <div className="divide-y divide-slate-100">
                                    {modules.map((module: any, index: number) => {
                                        const summary = moduleSummary(module);
                                        return (
                                            <button
                                                key={module.id}
                                                type="button"
                                                onClick={() => openModule(module.id)}
                                                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                                            >
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${summary.complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                                    {summary.complete ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-extrabold text-slate-900">{module.title}</p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {summary.completedLessons}/{summary.requiredLessons} required lessons
                                                        {summary.quizzes.length ? ` · ${summary.quizzes.length} module quiz${summary.quizzes.length === 1 ? "" : "zes"}` : ""}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold text-slate-500">{summary.percent}%</span>
                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    )}

                    {view.kind === "module" && currentModule && (() => {
                        const summary = moduleSummary(currentModule);
                        return (
                            <div className="space-y-6">
                                <section className="rounded-2xl border border-slate-200 bg-white p-6">
                                    <button type="button" onClick={openOverview} className="text-xs font-bold text-slate-500 hover:text-slate-900">Course Overview</button>
                                    <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
                                        <div className="max-w-3xl">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Module Overview</p>
                                            <h3 className="mt-2 text-2xl font-extrabold text-slate-950">{currentModule.title}</h3>
                                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                                {firstText(currentModule.description, currentModule.objective, currentModule.summary) || "Complete the learning content below. A module quiz appears only when one is configured for this module."}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${summary.complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                            {summary.complete ? "Module Completed" : `${summary.percent}% complete`}
                                        </span>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-slate-200 bg-white">
                                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Lessons</p>
                                            <h4 className="mt-1 text-lg font-extrabold text-slate-950">Module content</h4>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-500">{summary.completedLessons} of {summary.requiredLessons} required lessons completed</span>
                                    </header>
                                    <div className="divide-y divide-slate-100">
                                        {(currentModule.lessons ?? []).map((lesson: any, index: number) => (
                                            <button
                                                key={lesson.id}
                                                type="button"
                                                onClick={() => openLesson(lesson.id)}
                                                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                                            >
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isDone(lesson.id) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                                    {isDone(lesson.id) ? <CheckCircle2 className="h-5 w-5" /> : <BookOpen className="h-4 w-4" />}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-slate-900">{lesson.title}</p>
                                                    <p className="mt-1 text-xs text-slate-500">Lesson {index + 1}{lesson.is_required !== false ? " · Required" : " · Optional"}</p>
                                                </div>
                                                <span className="text-xs font-bold text-slate-500">{isDone(lesson.id) ? "Completed" : "Open lesson"}</span>
                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {currentModuleQuizzes.length > 0 && (
                                    <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                                                <ClipboardCheck className="h-5 w-5" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Module Quiz</p>
                                                <h4 className="mt-1 text-lg font-extrabold text-slate-950">Check your understanding</h4>
                                                <p className="mt-1 text-sm text-slate-600">The quiz unlocks after the required lessons in this module are completed.</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 space-y-3">
                                            {currentModuleQuizzes.map((quiz: any) => {
                                                const unlocked = moduleRequiredLessonsComplete(currentModule.id);
                                                const passed = quizPassed(quiz.id);
                                                return (
                                                    <div key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-4">
                                                        <div>
                                                            <p className="font-bold text-slate-900">{quiz.title}</p>
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {passed ? "Passed" : unlocked ? "Available now" : "Complete required lessons first"}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={passed || courseCompleted ? btn : primary}
                                                            disabled={!unlocked || courseCompleted || passed}
                                                            onClick={() => startQuiz(quiz)}
                                                        >
                                                            {passed ? <CheckCircle2 className="h-4 w-4" /> : unlocked ? <ClipboardCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                            {passed ? "Quiz Passed" : unlocked ? "Start Quiz" : "Locked"}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        );
                    })()}

                    {view.kind === "lesson" && currentLesson && currentModule && (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                                <button type="button" onClick={openOverview} className="hover:text-slate-900">Course Overview</button>
                                <ChevronRight className="h-3.5 w-3.5" />
                                <button type="button" onClick={() => openModule(currentModule.id)} className="hover:text-slate-900">{currentModule.title}</button>
                                <ChevronRight className="h-3.5 w-3.5" />
                                <span className="text-slate-900">{currentLesson.title}</span>
                            </div>

                            <section className="rounded-2xl border border-slate-200 bg-white p-6">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="max-w-3xl">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
                                            {currentLesson.is_required !== false ? "Required Lesson" : "Optional Lesson"}
                                        </p>
                                        <h3 className="mt-2 text-2xl font-extrabold text-slate-950">{currentLesson.title}</h3>
                                        {currentLesson.objective && <p className="mt-3 text-sm leading-6 text-slate-600">{currentLesson.objective}</p>}
                                    </div>
                                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isDone(currentLesson.id) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                        {isDone(currentLesson.id) ? "Completed" : "In progress"}
                                    </span>
                                </div>

                                <div className="mt-6 max-w-none whitespace-pre-wrap rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-800">
                                    {currentLesson.text_content || currentLesson.description || "Open the protected lesson material below."}
                                </div>

                                {currentLesson.external_url && (
                                    <a className={`${primary} mt-5`} href={currentLesson.external_url} target="_blank" rel="noopener noreferrer">
                                        Open secure external resource
                                    </a>
                                )}

                                {(currentLesson.materials ?? []).length > 0 && (
                                    <div className="mt-5 space-y-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Lesson Materials</p>
                                        {currentLesson.materials.map((material: any) => (
                                            <div key={material.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-sm">
                                                <div>
                                                    <b>{material.display_name}</b>
                                                    <p className="mt-1 text-xs text-slate-500">{material.mime_type} · {Math.ceil(material.size_bytes / 1024)} KB</p>
                                                </div>
                                                <a className={btn} href={material.download_url}>
                                                    <Download className="h-4 w-4" /> Open material
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <LessonNavigation
                                lesson={currentLesson}
                                lessons={lessons}
                                module={currentModule}
                                moduleQuizzes={currentModuleQuizzes}
                                courseCompleted={courseCompleted}
                                done={isDone(currentLesson.id)}
                                openLesson={openLesson}
                                openModule={openModule}
                                completeLesson={completeLesson}
                            />
                        </div>
                    )}

                    {view.kind === "quiz" && assessment && attempt && currentModule && (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                                <button type="button" onClick={openOverview} className="hover:text-slate-900">Course Overview</button>
                                <ChevronRight className="h-3.5 w-3.5" />
                                <button type="button" onClick={() => openModule(currentModule.id)} className="hover:text-slate-900">{currentModule.title}</button>
                                <ChevronRight className="h-3.5 w-3.5" />
                                <span className="text-slate-900">{assessment.title}</span>
                            </div>

                            <section className="rounded-2xl border border-slate-200 bg-white p-6">
                                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Module Quiz</p>
                                        <h3 className="mt-2 text-2xl font-extrabold text-slate-950">{assessment.title}</h3>
                                        <p className="mt-2 text-sm text-slate-500">Attempt {attempt.attempt_number} · Answers are saved while you work.</p>
                                    </div>
                                    <button className={btn} onClick={() => openModule(currentModule.id)}>
                                        <ChevronLeft className="h-4 w-4" /> Return to Module
                                    </button>
                                </div>

                                {result ? (
                                    <div className={`mt-6 rounded-2xl p-7 text-center ${result.passed ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
                                        <CheckCircle2 className="mx-auto h-11 w-11" />
                                        <p className="mt-3 text-4xl font-extrabold">{result.score}%</p>
                                        <p className="mt-2 text-sm font-bold">{result.passed ? "Passed" : "Not passed"} · Attempt {result.attemptNumber}</p>
                                        <button className={`${btn} mt-5`} onClick={() => openModule(currentModule.id)}>Return to Module Overview</button>
                                    </div>
                                ) : (
                                    <div className="mt-6 space-y-5">
                                        {(attempt.question_snapshot ?? []).map((question: any, index: number) => (
                                            <fieldset key={question.id} className="rounded-xl border border-slate-200 p-5">
                                                <legend className="px-2 text-sm font-extrabold text-slate-900">
                                                    {index + 1}. {question.text} ({question.points} point{question.points === 1 ? "" : "s"})
                                                </legend>
                                                <div className="mt-4 space-y-2">
                                                    {(question.options ?? []).map((option: any) => (
                                                        <label key={option.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm transition hover:bg-slate-50">
                                                            <input
                                                                type={question.type === "Multiple Response" ? "checkbox" : "radio"}
                                                                name={question.id}
                                                                checked={(answers[question.id] ?? []).includes(option.id)}
                                                                onChange={(event) =>
                                                                    setAnswers((current) => {
                                                                        const existing = current[question.id] ?? [];
                                                                        return {
                                                                            ...current,
                                                                            [question.id]:
                                                                                question.type === "Multiple Response"
                                                                                    ? event.target.checked
                                                                                        ? [...existing, option.id]
                                                                                        : existing.filter((id) => id !== option.id)
                                                                                    : [option.id],
                                                                        };
                                                                    })
                                                                }
                                                            />
                                                            {option.text}
                                                        </label>
                                                    ))}
                                                </div>
                                            </fieldset>
                                        ))}

                                        <div className="flex justify-end border-t border-slate-100 pt-5">
                                            <button className={primary} onClick={submitQuiz}>Submit Quiz</button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </main>
            </div>

            <AppDrawer
                show={outline}
                title="Course content"
                onClose={() => setOutline(false)}
                eyebrow="Learning path"
            >
                <CourseOutline
                    modules={modules}
                    view={view}
                    expandedModules={expandedModules}
                    toggleModule={toggleModule}
                    openOverview={() => {
                        openOverview();
                        setOutline(false);
                    }}
                    openModule={(moduleId: string) => {
                        openModule(moduleId);
                        setOutline(false);
                    }}
                    openLesson={(lessonId: string) => {
                        openLesson(lessonId);
                        setOutline(false);
                    }}
                    startQuiz={async (quiz: any) => {
                        await startQuiz(quiz);
                        setOutline(false);
                    }}
                    isDone={isDone}
                    moduleSummary={moduleSummary}
                    moduleRequiredLessonsComplete={moduleRequiredLessonsComplete}
                    quizPassed={quizPassed}
                    courseCompleted={courseCompleted}
                />
            </AppDrawer>
        </section>
    );
}

function MetricCard({ label, value }: any) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
        </div>
    );
}

function LessonNavigation({ lesson, lessons, module, moduleQuizzes, courseCompleted, done, openLesson, openModule, completeLesson }: any) {
    const index = lessons.findIndex((value: any) => value.id === lesson.id);
    const previous = lessons[index - 1];
    const next = lessons[index + 1];
    const lastInModule = (module?.lessons ?? []).at(-1)?.id === lesson.id;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <button className={btn} disabled={!previous} onClick={() => previous && openLesson(previous.id)}>
                <ChevronLeft className="h-4 w-4" /> Previous Lesson
            </button>

            <div className="flex flex-wrap items-center gap-2">
                <button className={btn} onClick={() => openModule(module.id)}>Module Overview</button>
                {!done && !courseCompleted && (
                    <button className={primary} onClick={completeLesson}>
                        Mark Lesson Complete <CheckCircle2 className="h-4 w-4" />
                    </button>
                )}
                {done && lastInModule && moduleQuizzes.length > 0 && (
                    <button className={primary} onClick={() => openModule(module.id)}>
                        Continue to Module Quiz <ChevronRight className="h-4 w-4" />
                    </button>
                )}
                {done && next && !(lastInModule && moduleQuizzes.length > 0) && (
                    <button className={primary} onClick={() => openLesson(next.id)}>
                        Next Lesson <ChevronRight className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

function CourseOutline({
    modules,
    view,
    expandedModules,
    toggleModule,
    openOverview,
    openModule,
    openLesson,
    startQuiz,
    isDone,
    moduleSummary,
    moduleRequiredLessonsComplete,
    quizPassed,
    courseCompleted,
}: any) {
    return (
        <div className="p-4">
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Course Content</p>
            <button
                type="button"
                onClick={openOverview}
                className={`mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${view.kind === "overview" ? "bg-amber-100 text-slate-950" : "text-slate-700 hover:bg-white"}`}
            >
                <List className="h-4 w-4" /> Overview
            </button>

            <div className="mt-3 space-y-2">
                {modules.map((module: any, moduleIndex: number) => {
                    const summary = moduleSummary(module);
                    const expanded = expandedModules.has(module.id);
                    const moduleSelected =
                        (view.kind === "module" && view.moduleId === module.id) ||
                        (view.kind === "quiz" && view.moduleId === module.id) ||
                        (view.kind === "lesson" && (module.lessons ?? []).some((lesson: any) => lesson.id === view.lessonId));
                    const quizzes = summary.quizzes;

                    return (
                        <div key={module.id} className={`overflow-hidden rounded-xl border ${moduleSelected ? "border-amber-300 bg-white" : "border-slate-200 bg-white/80"}`}>
                            <div className="flex items-stretch">
                                <button
                                    type="button"
                                    onClick={() => openModule(module.id)}
                                    className="min-w-0 flex-1 px-3 py-3 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${summary.complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                            {summary.complete ? <CheckCircle2 className="h-4 w-4" /> : moduleIndex + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-extrabold text-slate-900">{module.title}</p>
                                            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{summary.percent}% complete</p>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    aria-label={expanded ? `Collapse ${module.title}` : `Expand ${module.title}`}
                                    onClick={() => toggleModule(module.id)}
                                    className="px-3 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                                >
                                    <ChevronRight className={`h-4 w-4 transition ${expanded ? "rotate-90" : ""}`} />
                                </button>
                            </div>

                            {expanded && (
                                <div className="border-t border-slate-100 bg-slate-50/60 p-2">
                                    {(module.lessons ?? []).map((lesson: any, lessonIndex: number) => {
                                        const selected = view.kind === "lesson" && view.lessonId === lesson.id;
                                        return (
                                            <button
                                                key={lesson.id}
                                                type="button"
                                                onClick={() => openLesson(lesson.id)}
                                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs transition ${selected ? "bg-amber-100 font-bold text-slate-950" : "text-slate-600 hover:bg-white"}`}
                                            >
                                                {isDone(lesson.id) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <BookOpen className="h-4 w-4 shrink-0" />}
                                                <span className="min-w-0 flex-1 truncate">{lessonIndex + 1}. {lesson.title}</span>
                                                {lesson.is_required !== false && <span className="text-[9px] font-bold uppercase text-slate-400">Req</span>}
                                            </button>
                                        );
                                    })}

                                    {quizzes.map((quiz: any) => {
                                        const unlocked = moduleRequiredLessonsComplete(module.id);
                                        const passed = quizPassed(quiz.id);
                                        const selected = view.kind === "quiz" && view.assessmentId === quiz.id;
                                        return (
                                            <button
                                                key={quiz.id}
                                                type="button"
                                                disabled={!unlocked || courseCompleted || passed}
                                                onClick={() => startQuiz(quiz)}
                                                className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs transition ${selected ? "bg-amber-100 font-bold text-slate-950" : "text-slate-600 hover:bg-white"} disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                {passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : unlocked ? <ClipboardCheck className="h-4 w-4 shrink-0 text-amber-700" /> : <Lock className="h-4 w-4 shrink-0" />}
                                                <span className="min-w-0 flex-1 truncate">{quiz.title}</span>
                                                <span className="text-[9px] font-bold uppercase text-slate-400">Quiz</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Table({ heads, rows, eyebrow, title, description }: any) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-5 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
                <h2 className="mt-2 text-xl font-extrabold text-slate-950">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
            </header>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            {heads.map((h: string) => (
                                <th
                                    className="border-b border-slate-200 px-4 py-3 text-left text-xs uppercase text-slate-600"
                                    key={h}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {rows.map((row: any[], i: number) => (
                            <tr key={i}>
                                {row.map((cell: any, j: number) => (
                                    <td className="px-4 py-3" key={j}>
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!rows.length && (
                <div className="p-5">
                    <Empty
                        title="No records"
                        text="Records will appear when the workflow produces them."
                    />
                </div>
            )}
        </section>
    );
}

function Empty({ title, text }: any) {
    return (
        <div className="col-span-full flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <BookOpen className="h-8 w-8 text-slate-300" />
            <h2 className="mt-2 text-sm font-bold text-slate-700">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
        </div>
    );
}
function date(value: any) {
    return value
        ? new Intl.DateTimeFormat("en-PH", {
              dateStyle: "medium",
              timeZone: "Asia/Manila",
          }).format(new Date(value))
        : "—";
}
