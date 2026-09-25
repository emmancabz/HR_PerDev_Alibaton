import SystemSelect from '@/Components/SystemSelect';
import { ChartDateRangeControl, DEFAULT_CHART_DATE_RANGE, resolveChartDateRange, type ChartDateRangeValue } from "@/Components/ChartDateRange";
import DataTable from "@/Components/DataTable";
import StatCard from "@/Components/StatCard";
import {
    AppDrawer,
    AppModal,
    Field,
    ProgressBar,
    StatusBadge,
} from "@/Components/Competency/CompetencyUI";
import AuthenticatedLayout, { HeaderActions, HeaderFilters } from "@/Layouts/AuthenticatedLayout";
import {
    LEARNING_WORKSPACES,
    canonicalAudiencePersonTypes,
    emptyDraft,
    normalizeLearningState,
    paginate,
    type CourseDraft,
    type CourseSummary,
    type LearningState,
    type LearningWorkspace,
} from "@/data/learning";
import { learningClient, learningError } from "@/data/learningClient";
import { Head } from "@inertiajs/react";
import { useHashWorkspace } from "@/workspaceNavigation";
import {
    AlertCircle,
    Archive,
    Award,
    BarChart3,
    BookOpen,
    CheckCircle2,
    ClipboardList,
    Download,
    Pencil,
    Plus,
    RefreshCcw,
    Search,
    Send,
    Users,
} from "lucide-react";
import {
    Component,
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import CourseBuilder from "./CourseBuilder";

const input =
    "app-control";
const btn =
    "app-button";
const primary = `${btn} app-button-primary`;
const panel =
    "app-card";
const headers = [
    "Course code",
    "Course title",
    "Department",
    "Prepared by",
    "Status",
    "Version",
    "LMS delivery",
    "Last updated",
];
type Props = { initialLearningState?: unknown };

class CourseBuilderRecoveryBoundary extends Component<
    { children: ReactNode; onExit: () => void; onRetry: () => Promise<void> },
    { failed: boolean; retrying: boolean; error: string }
> {
    state = { failed: false, retrying: false, error: "" };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    retry = async () => {
        this.setState({ retrying: true, error: "" });
        try {
            await this.props.onRetry();
        } catch (error) {
            this.setState({ retrying: false, error: learningError(error) });
        }
    };

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="app-page app-page-enter">
                <section
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-950">
                                Course Builder could not be displayed
                            </h1>
                            <p className="mt-1 text-sm text-slate-600">
                                Reload the Draft or return to Courses.
                                Your saved course draft is still available.
                            </p>
                            {this.state.error && (
                                <p className="mt-3 text-sm font-semibold text-rose-700">
                                    {this.state.error}
                                </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    className={primary}
                                    onClick={() => void this.retry()}
                                    disabled={this.state.retrying}
                                >
                                    <RefreshCcw className="h-4 w-4" />
                                    {this.state.retrying ? "Reloading Draft…" : "Retry Builder"}
                                </button>
                                <button className={btn} onClick={this.props.onExit}>
                                    Return to Courses
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        );
    }
}

function initialState(value: unknown): LearningState | null {
    if (value === undefined || value === null) return null;
    try {
        return normalizeLearningState(value);
    } catch {
        return null;
    }
}

export default function AdminLearning({ initialLearningState }: Props) {
    const [state, setState] = useState<LearningState | null>(() =>
        initialState(initialLearningState),
    );
    const [loadStatus, setLoadStatus] = useState<
        "loading" | "ready" | "error"
    >(() => (initialState(initialLearningState) ? "ready" : "loading"));
    const [loadError, setLoadError] = useState("");
    const [workspace, setWorkspace] = useHashWorkspace<LearningWorkspace>(
        LEARNING_WORKSPACES,
        "Overview",
    );
    const [builder, setBuilder] = useState<CourseDraft | null>(null);
    const [selected, setSelected] = useState<CourseSummary | null>(null);
    const [assignCourse, setAssignCourse] = useState<CourseSummary | null>(
        null,
    );
    const [renewal, setRenewal] = useState<any>(null);
    const [archiveCourse, setArchiveCourse] = useState<CourseSummary | null>(
        null,
    );
    const [notice, setNotice] = useState("");
    const [creatingDraft, setCreatingDraft] = useState(false);
    const [draftFailure, setDraftFailure] = useState<{
        message: string;
        initial?: CourseDraft;
    } | null>(null);
    const [builderRecovery, setBuilderRecovery] = useState(0);

    const loadLearningState = useCallback(async () => {
        setLoadStatus("loading");
        setLoadError("");
        try {
            const next = await learningClient.state();
            setState(next);
            setLoadStatus("ready");
        } catch (error) {
            setState(null);
            setLoadError(learningError(error));
            setLoadStatus("error");
        }
    }, []);

    useEffect(() => {
        if (!state) void loadLearningState();
        // The initial Inertia prop is authoritative when present. A missing or
        // invalid prop uses the state endpoint once and exposes any failure.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!state) {
        return (
            <AuthenticatedLayout
                header={
                    <h1 className="truncate text-sm font-bold text-slate-900">
                        Learning Management
                    </h1>
                }
            >
                <Head title="Learning Management" />
                <div className="app-page app-page-enter">
                    <section
                        role={loadStatus === "error" ? "alert" : "status"}
                        aria-live="polite"
                        className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
                    >
                        <div className="flex items-start gap-3">
                            {loadStatus === "error" ? (
                                <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                            ) : (
                                <RefreshCcw className="mt-0.5 h-5 w-5 animate-spin text-amber-600" />
                            )}
                            <div className="space-y-3">
                                <div>
                                    <h1 className="text-lg font-extrabold text-slate-950">
                                        {loadStatus === "error"
                                            ? "Learning data could not be loaded"
                                            : "Loading Learning data…"}
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {loadStatus === "error"
                                            ? loadError
                                            : "Learning workspaces will appear when the current data is ready."}
                                    </p>
                                </div>
                                {loadStatus === "error" && (
                                    <button
                                        className={btn}
                                        onClick={loadLearningState}
                                    >
                                        <RefreshCcw className="h-4 w-4" />
                                        Retry
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </AuthenticatedLayout>
        );
    }

    const actorRole = String(state.actor.role ?? "").toLowerCase();
    const isHr = actorRole === "hr";
    const isAdmin = actorRole === "admin";

    if (builder)
        return (
            <AuthenticatedLayout
                header={
                    <h1 className="truncate text-sm font-bold text-slate-900">
                        Learning Management
                    </h1>
                }
                breadcrumbDetails={[{ label: builder.title.trim() || "New Course" }]}
            >
                <Head title="Course Builder" />
                <CourseBuilderRecoveryBoundary
                    key={`${builder.id ?? builder.courseId ?? "new-course"}:${builderRecovery}`}
                    onExit={() => setBuilder(null)}
                    onRetry={async () => {
                        const next = await learningClient.state();
                        const persisted = next.courses
                            .flatMap((course) => [course.draftDetail, course.publishedDetail])
                            .find((draft) => draft?.id === builder.id);
                        if (!persisted)
                            throw new Error("The course version could not be found. Return to Courses and reopen it.");
                        setState(next);
                        setBuilder(structuredClone(persisted));
                        setBuilderRecovery((value) => value + 1);
                    }}
                >
                    <CourseBuilder
                        initialDraft={builder}
                        state={state}
                        onState={setState}
                        onExit={() => setBuilder(null)}
                    />
                </CourseBuilderRecoveryBoundary>
            </AuthenticatedLayout>
        );
    const refresh = async () => {
        try {
            setState(await learningClient.state());
            setNotice("Learning data refreshed.");
        } catch (error) {
            setNotice(learningError(error));
        }
    };
    const createWorkingDraft = async (course: CourseSummary) => {
        if (!course.publishedVersionId) return;
        try {
            const ids = await learningClient.createWorkingDraft(
                course.publishedVersionId,
            );
            const fresh = await learningClient.state();
            setState(fresh);
            const row = fresh.courses.find((item) => item.id === ids.courseId);
            if (row?.draftDetail) setBuilder(row.draftDetail);
        } catch (error) {
            setNotice(learningError(error));
        }
    };
    const createPersistentDraft = async (initial?: CourseDraft) => {
        if (creatingDraft) return;
        setCreatingDraft(true);
        setNotice("");
        setDraftFailure(null);
        try {
            const payload = initial ?? emptyDraft(state.actor.id);
            const ids = await learningClient.create(payload);
            const fresh = await learningClient.state();
            setState(fresh);
            const persisted = fresh.courses.find(
                (course) => course.id === ids.courseId,
            )?.draftDetail;
            if (!persisted)
                throw new Error(
                    "The course draft was created but could not be reopened. Refresh Courses and open the draft again.",
                );
            setBuilder(persisted);
        } catch (error) {
            setDraftFailure({ message: learningError(error), initial });
        } finally {
            setCreatingDraft(false);
        }
    };
    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-sm font-bold text-slate-900">
                    Learning Management
                </h1>
            }
        >
            <Head title="Learning Management" />
            <HeaderActions>
                {workspace === "Courses" && isHr && (
                    <button
                        className={primary}
                        onClick={() => void createPersistentDraft()}
                        disabled={creatingDraft}
                    >
                        <Plus className="h-4 w-4" />
                        {creatingDraft ? "Creating Draft…" : "New Course"}
                    </button>
                )}
            </HeaderActions>
            <div className="app-page app-page-enter space-y-4">
                {notice && (
                    <div
                        role="status"
                        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800"
                    >
                        <AlertCircle className="h-4 w-4" />
                        {notice}
                    </div>
                )}
                {draftFailure && (
                    <div
                        role="alert"
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                    >
                        <span className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {draftFailure.message}
                        </span>
                        <button
                            className={btn}
                            disabled={creatingDraft}
                            onClick={() =>
                                void createPersistentDraft(draftFailure.initial)
                            }
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Retry New Course
                        </button>
                    </div>
                )}
                {workspace === "Overview" && (
                    <Overview
                        state={state}
                        navigate={setWorkspace}
                        openCourse={setSelected}
                        isHr={isHr}
                        isAdmin={isAdmin}
                        createCourse={(request: any) => {
                            if (!isHr) return;
                            const value = emptyDraft(state.actor.id);
                            const competency = state.competencyCatalog.find(
                                (item) => item.id === request.competency_id,
                            );
                            value.title = request.recommendation_title;
                            value.description = request.recommendation_note ||
                                `Learning need for ${request.competency_name}.`;
                            value.learningObjectives = [
                                `Develop ${request.competency_name} toward required level ${request.required_level}.`,
                            ];
                            if (competency)
                                value.competencies = [
                                    {
                                        ...competency,
                                        targetLevel: request.required_level,
                                        purpose: "Learning need",
                                    },
                                ];
                            const person = state.personnel.find(
                                (item) => item.personnel_key === request.personnel_key,
                            );
                            if (person?.department) {
                                value.audience.allDepartments = false;
                                value.audience.departments = [person.department];
                            }
                            void createPersistentDraft(value);
                        }}
                    />
                )}
                {workspace === "Courses" && (
                    <Courses state={state} open={setSelected} />
                )}{" "}
                {workspace === "Assignments" && (
                    <Assignments
                        state={state}
                        update={setState}
                        notice={setNotice}
                    />
                )}{" "}
                {workspace === "Learning Records" && (
                    <Completions
                        state={state}
                        update={setState}
                        notice={setNotice}
                        renew={(row: any) => {
                            const course = state.courses.find(
                                (item) => item.id === row.course_id,
                            );
                            if (course) {
                                setRenewal(row);
                                setAssignCourse(course);
                            }
                        }}
                    />
                )}{" "}
                {workspace === "Analytics" && <Analytics state={state} />}
                <CourseDrawer
                    course={selected}
                    state={state}
                    isHr={isHr}
                    isAdmin={isAdmin}
                    close={() => setSelected(null)}
                    edit={() => {
                        if (selected?.draftDetail && isHr) {
                            setBuilder(selected.draftDetail);
                            setSelected(null);
                        }
                    }}
                    newVersion={() => selected && isHr && createWorkingDraft(selected)}
                    updateState={(next: LearningState) => {
                        setState(next);
                        if (selected) {
                            setSelected(next.courses.find((row) => row.id === selected.id) ?? null);
                        }
                    }}
                    notice={setNotice}
                    archive={() => {
                        if (!isAdmin) return;
                        setArchiveCourse(selected);
                        setSelected(null);
                    }}
                />
                <AssignModal
                    course={assignCourse}
                    renewal={renewal}
                    state={state}
                    close={() => setAssignCourse(null)}
                    done={async () => {
                        setState(await learningClient.state());
                        setAssignCourse(null);
                        setRenewal(null);
                        setWorkspace("Assignments");
                    }}
                />
                <AppModal
                    show={Boolean(archiveCourse)}
                    title="Archive course lineage?"
                    description="New assignments will be rejected. Published history, attempts, completions, certificates, transcripts, and analytics remain reportable."
                    onClose={() => setArchiveCourse(null)}
                    footer={
                        <>
                            <button
                                className={btn}
                                onClick={() => setArchiveCourse(null)}
                            >
                                Keep active
                            </button>
                            <button
                                className={primary}
                                onClick={async () => {
                                    if (!archiveCourse) return;
                                    try {
                                        setState(
                                            await learningClient.archive(
                                                archiveCourse.id,
                                            ),
                                        );
                                        setArchiveCourse(null);
                                        setNotice(
                                            "Course archived with historical records preserved.",
                                        );
                                    } catch (error) {
                                        setNotice(learningError(error));
                                    }
                                }}
                            >
                                <Archive className="h-4 w-4" />
                                Archive course
                            </button>
                        </>
                    }
                >
                    <p className="text-sm text-slate-600">
                        Course history and completed learning records will remain available.
                    </p>
                </AppModal>
            </div>
        </AuthenticatedLayout>
    );
}

function Overview({
    state,
    navigate,
    openCourse,
    createCourse,
    isHr,
    isAdmin,
}: {
    state: LearningState;
    navigate: (value: LearningWorkspace) => void;
    openCourse: (course: CourseSummary) => void;
    createCourse: (request: any) => void;
    isHr: boolean;
    isAdmin: boolean;
}) {
    const activeLearning = state.assignments.filter((row: any) =>
        ["Not Started", "In Progress"].includes(row.status),
    );
    const learningNeeds = state.requests.filter(
        (row: any) => !["Resolved", "Declined"].includes(row.status),
    );
    const awaitingPublication = state.courses.filter((course) =>
        ["In Review", "Approved"].includes(course.draftDetail?.status ?? ""),
    );
    const hrDrafts = state.courses.filter((course) =>
        ["Draft", "Changes Requested"].includes(course.draftDetail?.status ?? ""),
    );
    const personnelByKey = new Map(
        state.personnel.map((person) => [person.personnel_key, person]),
    );

    const suggestedCourseFor = (request: any): CourseSummary | undefined => {
        if (request.linked_course_id) {
            const linked = state.courses.find(
                (course) => course.id === request.linked_course_id,
            );
            if (linked) return linked;
        }
        return state.courses.find((course) => {
            if (course.archived || !course.publishedVersionId) return false;
            const mappings = course.publishedDetail?.competencies ?? [];
            return (
                mappings.some((mapping: any) => mapping.id === request.competency_id) ||
                course.competencies?.includes(request.competency_name)
            );
        });
    };

    const metrics = [
        {
            label: "Total Courses",
            value: state.courses.length,
            icon: BookOpen,
            action: () => navigate("Courses"),
        },
        {
            label: isAdmin ? "Awaiting Publication" : "My Draft Courses",
            value: isAdmin ? awaitingPublication.length : hrDrafts.length,
            icon: Send,
            action: () => navigate("Courses"),
        },
        {
            label: "Active Learning",
            value: activeLearning.length,
            icon: ClipboardList,
            action: () => navigate("Assignments"),
        },
        {
            label: "Learning Needs",
            value: learningNeeds.length,
            icon: AlertCircle,
            action: () =>
                document
                    .getElementById("learning-needs")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        },
    ];

    const currentRows = [...activeLearning]
        .sort((left: any, right: any) => {
            const leftDue = left.due_at ? new Date(left.due_at).getTime() : Number.MAX_SAFE_INTEGER;
            const rightDue = right.due_at ? new Date(right.due_at).getTime() : Number.MAX_SAFE_INTEGER;
            return leftDue - rightDue;
        })
        .slice(0, 10);

    const needRows = [...learningNeeds]
        .sort(
            (left: any, right: any) =>
                new Date(right.requested_at ?? 0).getTime() -
                new Date(left.requested_at ?? 0).getTime(),
        )
        .slice(0, 10);

    const publicationRows = (isAdmin ? awaitingPublication : hrDrafts)
        .slice()
        .sort((left, right) =>
            String(right.lastUpdated ?? "").localeCompare(
                String(left.lastUpdated ?? ""),
            ),
        )
        .slice(0, 10);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {metrics.map(({ label, value, icon: MetricIcon, action }) => (
                    <button
                        key={label}
                        type="button"
                        onClick={action}
                        aria-label={`Open ${label}`}
                        className="app-kpi-card group w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2"
                    >
                        <div className="flex min-h-14 items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-500">
                                    {label}
                                </p>
                                <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-slate-950">
                                    {value}
                                </p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
                                <MetricIcon className="h-5 w-5" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <section className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-bold text-slate-900">
                        {isAdmin ? "Courses Awaiting Publication" : "Course Drafts"}
                    </h2>
                    <button className={btn} onClick={() => navigate("Courses")}>
                        Open Courses
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                            <tr>
                                <th className="border-b border-slate-200 px-4 py-3">Course</th>
                                <th className="border-b border-slate-200 px-4 py-3">Department</th>
                                <th className="border-b border-slate-200 px-4 py-3">Prepared by</th>
                                <th className="border-b border-slate-200 px-4 py-3">Status</th>
                                {isAdmin && (
                                    <th className="border-b border-slate-200 px-4 py-3">Source review</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {publicationRows.map((course) => {
                                const review = course.draftDetail?.sourceReview ?? course.sourceReview;
                                return (
                                    <tr
                                        key={course.id}
                                        tabIndex={0}
                                        role="button"
                                        onClick={() => openCourse(course)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                openCourse(course);
                                            }
                                        }}
                                        className="cursor-pointer hover:bg-amber-50/40 focus-visible:bg-amber-50/60 focus-visible:outline-none"
                                    >
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">{course.title}</p>
                                            <p className="text-xs text-slate-500">{course.code}</p>
                                        </td>
                                        <td className="px-4 py-3">{course.targetDepartment || "—"}</td>
                                        <td className="px-4 py-3">{course.owner || "—"}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge value={course.draftDetail?.status ?? course.status} />
                                        </td>
                                        {isAdmin && (
                                            <td className="px-4 py-3">
                                                {review ? (
                                                    <div>
                                                        <p className="font-semibold text-slate-900">
                                                            {review.status} · {review.coveragePercent}%
                                                        </p>
                                                        {!review.current && (
                                                            <p className="text-xs text-amber-700">Needs a fresh scan</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500">Pending scan</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {!publicationRows.length && (
                                <tr>
                                    <td
                                        colSpan={isAdmin ? 5 : 4}
                                        className="px-4 py-8 text-center text-sm text-slate-500"
                                    >
                                        {isAdmin
                                            ? "No courses are waiting for publication."
                                            : "No course drafts are waiting for work."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section id="learning-needs" className={panel}>
                <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-bold text-slate-900">Learning Needs</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                            <tr>
                                <th className="border-b border-slate-200 px-4 py-3">Employee</th>
                                <th className="border-b border-slate-200 px-4 py-3">Knowledge / competency</th>
                                <th className="border-b border-slate-200 px-4 py-3">Need</th>
                                <th className="border-b border-slate-200 px-4 py-3">Course</th>
                                <th className="border-b border-slate-200 px-4 py-3">Status</th>
                                <th className="border-b border-slate-200 px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {needRows.map((request: any) => {
                                const person = personnelByKey.get(request.personnel_key);
                                const suggested = suggestedCourseFor(request);
                                return (
                                    <tr key={request.id}>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">
                                                {person?.name ?? request.personnel_name ?? "Employee record unavailable"}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {[person?.position, person?.department].filter(Boolean).join(" · ") || "—"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">{request.competency_name}</p>
                                            <p className="text-xs text-slate-500">
                                                Level {request.validated_level} → {request.required_level}
                                            </p>
                                        </td>
                                        <td className="max-w-sm px-4 py-3">
                                            <p className="font-medium text-slate-800">{request.recommendation_title}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            {suggested ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openCourse(suggested)}
                                                    className="text-left font-semibold text-slate-900 hover:text-amber-700"
                                                >
                                                    {suggested.code} · {suggested.title}
                                                </button>
                                            ) : (
                                                <span className="font-semibold text-amber-700">Course needed</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge value={request.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            {suggested ? (
                                                <button className={btn} onClick={() => openCourse(suggested)}>
                                                    Open Course
                                                </button>
                                            ) : isHr ? (
                                                <button className={primary} onClick={() => createCourse(request)}>
                                                    <Plus className="h-4 w-4" />
                                                    Create Course
                                                </button>
                                            ) : (
                                                <span className="text-xs font-semibold text-slate-500">Awaiting HR course</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!needRows.length && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                        No open learning needs.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-bold text-slate-900">Currently Learning</h2>
                    <button className={btn} onClick={() => navigate("Assignments")}>
                        Open Assignments
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                            <tr>
                                <th className="border-b border-slate-200 px-4 py-3">Employee</th>
                                <th className="border-b border-slate-200 px-4 py-3">Course</th>
                                <th className="border-b border-slate-200 px-4 py-3">Progress</th>
                                <th className="border-b border-slate-200 px-4 py-3">Status</th>
                                <th className="border-b border-slate-200 px-4 py-3">Due</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {currentRows.map((row: any) => (
                                <tr
                                    key={row.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate("Assignments")}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            navigate("Assignments");
                                        }
                                    }}
                                    className="cursor-pointer hover:bg-amber-50/40 focus-visible:bg-amber-50/60 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3 font-semibold text-slate-900">{row.learner_name}</td>
                                    <td className="px-4 py-3">{row.title}</td>
                                    <td className="px-4 py-3 min-w-40">
                                        <ProgressBar value={Number(row.progress_percent ?? 0)} />
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge value={row.display_status ?? row.status} /></td>
                                    <td className="px-4 py-3">{date(row.due_at)}</td>
                                </tr>
                            ))}
                            {!currentRows.length && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                        No active learning assignments.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-bold text-slate-900">Recent Completions</h2>
                    <button className={btn} onClick={() => navigate("Learning Records")}>
                        Open Learning Records
                    </button>
                </div>
                <div className="divide-y divide-slate-100">
                    {[...state.completions]
                        .sort(
                            (left: any, right: any) =>
                                new Date(right.completed_at ?? 0).getTime() -
                                new Date(left.completed_at ?? 0).getTime(),
                        )
                        .slice(0, 5)
                        .map((row: any) => (
                            <button
                                key={row.id}
                                type="button"
                                onClick={() => navigate("Learning Records")}
                                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-slate-900">
                                        {row.learner_name} · {row.title}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-slate-500">
                                        Completed {date(row.completed_at)}
                                    </span>
                                </span>
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            </button>
                        ))}
                    {!state.completions.length && (
                        <p className="p-4 text-sm text-slate-500">No recent completions.</p>
                    )}
                </div>
            </section>
        </div>
    );
}

function Courses({ state, open }: any) {
    const [status, setStatus] = useState("All");
    const [department, setDepartment] = useState("All");
    const [owner, setOwner] = useState("All");
    const [category, setCategory] = useState("All");
    const [page, setPage] = useState(1);

    const statuses = [
        "All",
        "Draft",
        "In Review",
        "Changes Requested",
        "Approved",
        "Published",
        "Archived",
    ];
    const departments = [
        ...new Set(
            state.courses
                .map((course: any) => course.targetDepartment)
                .filter(Boolean),
        ),
    ].sort();
    const owners = [
        ...new Set(state.courses.map((course: any) => course.owner).filter(Boolean)),
    ].sort();
    const categories = [
        ...new Set(
            state.courses.map((course: any) => course.category).filter(Boolean),
        ),
    ].sort();

    const filtered = useMemo(
        () =>
            state.courses
                .filter(
                    (course: any) =>
                        (status === "All" || course.status === status) &&
                        (department === "All" ||
                            course.targetDepartment === department) &&
                        (owner === "All" || course.owner === owner) &&
                        (category === "All" || course.category === category),
                )
                .sort((left: any, right: any) =>
                    String(right.lastUpdated ?? "").localeCompare(
                        String(left.lastUpdated ?? ""),
                    ),
                ),
        [state.courses, status, department, owner, category],
    );
    const rows = paginate(filtered, page, 10);

    useEffect(() => {
        const pages = Math.max(1, Math.ceil(filtered.length / 10));
        if (page > pages) setPage(pages);
    }, [filtered.length, page]);

    return (
        <>
            <HeaderFilters>
                <SystemSelect
                    menuLabel="Status"
                    aria-label="Course status"
                    className={input}
                    value={status}
                    onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                    }}
                >
                    {statuses.map((value) => (
                        <option key={value}>{value}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    menuLabel="Department"
                    aria-label="Course department"
                    className={input}
                    value={department}
                    onChange={(event) => {
                        setDepartment(event.target.value);
                        setPage(1);
                    }}
                >
                    <option>All</option>
                    {departments.map((value: any) => (
                        <option key={value}>{value}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    menuLabel="Prepared by"
                    aria-label="Course owner"
                    className={input}
                    value={owner}
                    onChange={(event) => {
                        setOwner(event.target.value);
                        setPage(1);
                    }}
                >
                    <option value="All">All Preparers</option>
                    {owners.map((value: any) => (
                        <option key={value}>{value}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    menuLabel="Category"
                    aria-label="Course category"
                    className={input}
                    value={category}
                    onChange={(event) => {
                        setCategory(event.target.value);
                        setPage(1);
                    }}
                >
                    <option>All</option>
                    {categories.map((value: any) => (
                        <option key={value}>{value}</option>
                    ))}
                </SystemSelect>
            </HeaderFilters>

            <section className={panel}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px] border-collapse text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                            <tr>
                                {headers.map((header) => (
                                    <th
                                        key={header}
                                        className="border-b border-slate-200 px-3 py-3"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {rows.map((course: any) => {
                                const workingStatus =
                                    course.draftDetail?.status ?? course.status;
                                const delivery = course.delivery;
                                return (
                                    <tr
                                        key={course.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Open ${course.title}`}
                                        onClick={() => open(course)}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" ||
                                                event.key === " "
                                            ) {
                                                event.preventDefault();
                                                open(course);
                                            }
                                        }}
                                        className="cursor-pointer hover:bg-amber-50/40 focus-visible:bg-amber-50/60 focus-visible:outline-none"
                                    >
                                        <td className="px-3 py-3 font-mono text-xs">{course.code}</td>
                                        <td className="px-3 py-3 font-bold text-slate-900">{course.title}</td>
                                        <td className="px-3 py-3">{course.targetDepartment || "—"}</td>
                                        <td className="px-3 py-3">{course.owner || "—"}</td>
                                        <td className="px-3 py-3"><StatusBadge value={workingStatus} /></td>
                                        <td className="px-3 py-3">{course.publishedVersion ? `v${course.publishedVersion}` : "—"}</td>
                                        <td className="px-3 py-3">
                                            {delivery ? (
                                                <StatusBadge value={delivery.status} />
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">{date(course.lastUpdated)}</td>
                                    </tr>
                                );
                            })}
                            {!rows.length && (
                                <tr>
                                    <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-slate-500">
                                        No courses match the selected filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination page={page} total={filtered.length} setPage={setPage} />
            </section>
        </>
    );
}

function CourseDrawer({
    course,
    state,
    isHr,
    isAdmin,
    close,
    edit,
    newVersion,
    updateState,
    notice,
    archive,
}: any) {
    const [busyAction, setBusyAction] = useState<"scan" | "publish" | "changes" | "retry" | null>(null);
    const [requestChanges, setRequestChanges] = useState(false);
    const [comment, setComment] = useState("");

    useEffect(() => {
        setBusyAction(null);
        setRequestChanges(false);
        setComment("");
    }, [course?.id, course?.draftVersionId]);

    const draft = course?.draftDetail;
    const published = course?.publishedDetail;
    const detail = draft ?? published;
    const review = draft?.sourceReview ?? course?.sourceReview ?? null;
    const delivery = course?.delivery ?? published?.delivery ?? null;
    const aevynConfigured = Boolean(state.analytics?.overview?.aevynConfigured);
    const awaitingPublication = Boolean(
        isAdmin &&
            draft?.id &&
            ["In Review", "Approved"].includes(draft.status ?? ""),
    );
    const publishReady = Boolean(
        awaitingPublication &&
            review?.current &&
            review?.status !== "Blocked",
    );

    const refreshCourse = (next: LearningState) => {
        updateState(next);
    };

    const runSourceReview = async () => {
        if (!draft?.id) return;
        setBusyAction("scan");
        try {
            const next = await learningClient.sourceReview(draft.id);
            refreshCourse(next);
            notice("Source review updated.");
        } catch (error) {
            notice(learningError(error));
        } finally {
            setBusyAction(null);
        }
    };

    const publishCourse = async () => {
        if (!draft?.id || !publishReady) return;
        setBusyAction("publish");
        try {
            const next = await learningClient.publish(draft.id);
            refreshCourse(next);
            const refreshed = next.courses.find((row) => row.id === course.id);
            const status = refreshed?.delivery?.status;
            notice(
                status === "Delivered"
                    ? "Course published and delivered to the LMS."
                    : status === "Failed"
                      ? "Course published, but LMS delivery failed. Retry from the course details."
                      : "Course published. LMS delivery is queued.",
            );
        } catch (error) {
            notice(learningError(error));
        } finally {
            setBusyAction(null);
        }
    };

    const returnToHr = async () => {
        if (!draft?.id || !comment.trim()) return;
        setBusyAction("changes");
        try {
            const next = await learningClient.decideReview(
                draft.id,
                "Changes Requested",
                comment.trim(),
            );
            refreshCourse(next);
            setRequestChanges(false);
            setComment("");
            notice("Course returned to HR for changes.");
        } catch (error) {
            notice(learningError(error));
        } finally {
            setBusyAction(null);
        }
    };

    const retryDelivery = async () => {
        const versionId = course?.publishedVersionId;
        if (!versionId) return;
        setBusyAction("retry");
        try {
            const next = await learningClient.retryPublication(versionId);
            refreshCourse(next);
            const refreshed = next.courses.find((row) => row.id === course.id);
            notice(
                refreshed?.delivery?.status === "Delivered"
                    ? "LMS delivery completed."
                    : "LMS delivery retry recorded.",
            );
        } catch (error) {
            notice(learningError(error));
        } finally {
            setBusyAction(null);
        }
    };

    const footer = (
        <>
            {isHr && draft && ["Draft", "Changes Requested"].includes(draft.status ?? "") && (
                <button className={primary} onClick={edit}>
                    <Pencil className="h-4 w-4" />
                    Continue Draft
                </button>
            )}
            {isHr &&
                !draft &&
                course?.publishedVersionId &&
                !course?.archived && (
                    <button className={btn} onClick={newVersion}>
                        <Plus className="h-4 w-4" />
                        Create Revision
                    </button>
                )}
            {awaitingPublication && (
                <>
                    {(!review || !review.current || (aevynConfigured && !review.aiUsed)) && (
                        <button
                            className={btn}
                            onClick={() => void runSourceReview()}
                            disabled={busyAction !== null}
                        >
                            <RefreshCcw className={`h-4 w-4 ${busyAction === "scan" ? "animate-spin" : ""}`} />
                            {busyAction === "scan"
                                ? "Scanning…"
                                : aevynConfigured && review?.current && !review?.aiUsed
                                  ? "Run Aevyn Review"
                                  : review
                                    ? "Refresh Source Review"
                                    : "Retry Source Review"}
                        </button>
                    )}
                    <button
                        className={btn}
                        onClick={() => setRequestChanges(true)}
                        disabled={busyAction !== null}
                    >
                        Request Changes
                    </button>
                    <button
                        className={primary}
                        onClick={() => void publishCourse()}
                        disabled={!publishReady || busyAction !== null}
                        title={
                            !review?.current
                                ? "Run a fresh source review before publishing."
                                : review?.status === "Blocked"
                                  ? "Resolve the blocking source issue before publishing."
                                  : undefined
                        }
                    >
                        {busyAction === "publish" ? (
                            <RefreshCcw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        {busyAction === "publish" ? "Publishing to LMS…" : "Publish to LMS"}
                    </button>
                </>
            )}
            {isAdmin && delivery?.status === "Failed" && (
                <button
                    className={btn}
                    onClick={() => void retryDelivery()}
                    disabled={busyAction !== null}
                >
                    <RefreshCcw className={`h-4 w-4 ${busyAction === "retry" ? "animate-spin" : ""}`} />
                    Retry LMS Delivery
                </button>
            )}
            {isAdmin && !course?.archived && (
                <button className={btn} onClick={archive} disabled={busyAction !== null}>
                    <Archive className="h-4 w-4" />
                    Archive
                </button>
            )}
        </>
    );

    return (
        <>
            <AppDrawer
                show={Boolean(course)}
                title={course?.title ?? ""}
                description={`${course?.code ?? ""} · ${course?.targetDepartment ?? course?.category ?? ""}`}
                onClose={close}
                eyebrow="Learning Management"
                footer={footer}
                presentation="modal"
                maxWidthClassName="!max-w-[1040px]"
            >
                <div className="grid gap-3 md:grid-cols-2">
                    {[
                        ["Status", draft?.status ?? course?.status ?? "—"],
                        ["Target department", course?.targetDepartment ?? "—"],
                        ["Prepared by", course?.owner ?? "—"],
                        ["Published version", course?.publishedVersion ? `v${course.publishedVersion}` : "Not published"],
                        ["LMS delivery", delivery?.status ?? "—"],
                        ["Learners sent", delivery ? String(delivery.targetCount ?? 0) : "—"],
                    ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                        </div>
                    ))}
                </div>

                {busyAction === "publish" && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-800"
                    >
                        <RefreshCcw className="h-4 w-4 animate-spin text-amber-700" />
                        Publishing the course and sending it to the LMS…
                    </div>
                )}

                {awaitingPublication && (
                    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                            <h3 className="text-sm font-bold text-slate-900">
                                {review?.aiUsed ? "Aevyn Source Review" : "Source Review"}
                            </h3>
                            {review && <StatusBadge value={review.status} />}
                        </div>
                        <div className="space-y-4 p-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs font-semibold text-slate-500">Source coverage</p>
                                    <p className="mt-1 text-xl font-extrabold text-slate-900">
                                        {review ? `${review.coveragePercent}%` : "Pending"}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs font-semibold text-slate-500">Documents used</p>
                                    <p className="mt-1 text-xl font-extrabold text-slate-900">
                                        {draft?.sourceDocuments?.length ?? 0}
                                    </p>
                                </div>
                            </div>

                            {draft?.sourceDocuments?.length ? (
                                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                                    {draft.sourceDocuments.map((source: any) => (
                                        <div key={`${source.documentId}-${source.version}`} className="px-3 py-2.5">
                                            <p className="text-sm font-semibold text-slate-900">{source.title}</p>
                                            <p className="text-xs text-slate-500">{source.type} · v{source.version} · {source.owner}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-rose-700">No source documents are linked to this course.</p>
                            )}

                            {review?.summary && (
                                <p className="text-sm text-slate-700">{review.summary}</p>
                            )}
                            {review?.findings?.length ? (
                                <div className="space-y-2">
                                    {review.findings.map((finding: string) => (
                                        <div key={finding} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-800">
                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                            <span>{finding}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : review ? (
                                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                                    <CheckCircle2 className="h-4 w-4" />
                                    No source issues found.
                                </div>
                            ) : null}
                        </div>
                    </section>
                )}

                {delivery && (
                    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-slate-900">LMS Delivery</h3>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-xs text-slate-500">Learners</p>
                                <p className="mt-1 font-semibold text-slate-900">{delivery.targetCount ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Delivered</p>
                                <p className="mt-1 font-semibold text-slate-900">{date(delivery.deliveredAt)}</p>
                            </div>
                        </div>
                        {delivery.status === "Queued" && (
                            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                                Waiting for LMS delivery.
                            </p>
                        )}
                        {delivery.status === "Failed" && (
                            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                                LMS delivery failed. Retry when the LMS service is available.
                            </p>
                        )}
                    </section>
                )}

                <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-bold text-slate-900">Course Content</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                            <p className="text-xs text-slate-500">Modules</p>
                            <p className="mt-1 font-semibold text-slate-900">{detail?.modules?.length ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Lessons</p>
                            <p className="mt-1 font-semibold text-slate-900">
                                {detail?.modules?.reduce((count: number, module: any) => count + module.lessons.length, 0) ?? 0}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Assessments</p>
                            <p className="mt-1 font-semibold text-slate-900">{detail?.assessments?.length ?? 0}</p>
                        </div>
                    </div>
                </section>

                <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-bold text-slate-900">Version History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    {["Version", "Status", "Title", "Submitted", "Published", "Updated"].map((label) => (
                                        <th key={label} className="border-b border-slate-200 px-3 py-2 text-left text-xs uppercase text-slate-600">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {(course?.versionHistory ?? []).map((version: any) => (
                                    <tr key={version.id}>
                                        <td className="px-3 py-2 font-semibold">{version.versionNumber ? `v${version.versionNumber}` : "Working"}</td>
                                        <td className="px-3 py-2"><StatusBadge value={version.status} /></td>
                                        <td className="px-3 py-2">{version.title}</td>
                                        <td className="px-3 py-2">{date(version.submittedAt)}</td>
                                        <td className="px-3 py-2">{date(version.publishedAt)}</td>
                                        <td className="px-3 py-2">{date(version.updatedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </AppDrawer>

            <AppModal
                show={requestChanges}
                title="Return course to HR?"
                description="The course will reopen for HR revision."
                onClose={() => setRequestChanges(false)}
                footer={
                    <>
                        <button className={btn} onClick={() => setRequestChanges(false)} disabled={busyAction !== null}>
                            Cancel
                        </button>
                        <button className={primary} onClick={() => void returnToHr()} disabled={!comment.trim() || busyAction !== null}>
                            {busyAction === "changes" ? "Returning…" : "Return to HR"}
                        </button>
                    </>
                }
            >
                <Field label="What should HR change?" required>
                    <textarea
                        aria-label="What should HR change?"
                        className={`${input} h-28 py-2`}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                    />
                </Field>
            </AppModal>
        </>
    );
}

function AssignModal({ course, state, renewal, close, done }: any) {
    const [ids, setIds] = useState<number[]>([]);
    const [source, setSource] = useState("Manual Assignment");
    const [availableFrom, setAvailableFrom] = useState("");
    const [dueAt, setDueAt] = useState("");
    const [mandatory, setMandatory] = useState(true);
    const [priority, setPriority] = useState("Normal");
    const [reason, setReason] = useState("");
    const [preview, setPreview] = useState<any[] | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const versionId = course?.publishedVersionId;
    useEffect(() => {
        if (!course) return;
        const audience = course.publishedDetail?.audience;
        setIds(renewal ? [Number(renewal.learner_id)] : []);
        setSource(renewal ? "Reassignment/Renewal" : "Manual Assignment");
        setMandatory(Boolean(audience?.mandatoryDefault ?? true));
        setAvailableFrom("");
        setDueAt("");
        setReason(renewal ? `Renewal from completion ${renewal.id}` : "");
        setPreview(null);
        setError("");
    }, [course?.id, renewal?.id]);
    const changed = () => setPreview(null);
    const runPreview = async () => {
        if (!versionId) return;
        setBusy(true);
        setError("");
        try {
            setPreview(await learningClient.assignmentPreview(versionId, ids));
        } catch (e) {
            setError(learningError(e));
        } finally {
            setBusy(false);
        }
    };
    const confirm = async () => {
        if (!versionId) return;
        setBusy(true);
        setError("");
        try {
            await learningClient.assign(versionId, {
                learnerIds:
                    preview
                        ?.filter((row) => row.result === "Eligible")
                        .map((row) => row.id) ?? ids,
                source,
                availableFrom: availableFrom || null,
                dueAt: dueAt || null,
                mandatory,
                priority,
                reason,
                sourceCompletionId: renewal?.id ?? null,
                sourceCertificateId: renewal?.certificate_id ?? null,
            });
            await done();
        } catch (e) {
            setError(learningError(e));
        } finally {
            setBusy(false);
        }
    };
    return (
        <AppModal
            show={Boolean(course)}
            title="Assign Learners"
            description={`${course?.code ?? ""} · exact Published v${course?.publishedVersion ?? ""}. Each person receives a separate, version-pinned assignment.`}
            onClose={close}
            maxWidth="2xl"
            footer={
                <>
                    {preview ? (
                        <button
                            className={primary}
                            disabled={
                                busy ||
                                !preview.some((r) => r.result === "Eligible")
                            }
                            onClick={confirm}
                        >
                            Confirm{" "}
                            {
                                preview.filter((r) => r.result === "Eligible")
                                    .length
                            }{" "}
                            assignment(s)
                        </button>
                    ) : (
                        <button
                            className={primary}
                            disabled={busy || !ids.length}
                            onClick={runPreview}
                        >
                            Preview exact impact
                        </button>
                    )}
                </>
            }
        >
            <div className="space-y-4">
                {error && (
                    <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                        {error}
                    </p>
                )}
                {renewal && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
                        Renewal for <b>{renewal.learner_name}</b> from
                        completion {renewal.id}
                        {renewal.certificate_number
                            ? ` and certificate ${renewal.certificate_number}`
                            : ""}
                        . The source linkage and configured renewal interval are
                        enforced by Laravel.
                    </div>
                )}
                <Field label="Learners">
                    <SystemSelect
                        multiple
                        disabled={Boolean(renewal)}
                        className={`${input} h-48 py-2`}
                        value={ids.map(String)}
                        onChange={(e) => {
                            setIds(
                                Array.from(e.target.selectedOptions).map((o) =>
                                    Number(o.value),
                                ),
                            );
                            changed();
                        }}
                    >
                        {state.personnel.map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {p.name} — {p.person_type} · {p.department} ·{" "}
                                {p.position}
                            </option>
                        ))}
                    </SystemSelect>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Assignment source">
                        <SystemSelect
                            className={input}
                            disabled={Boolean(renewal)}
                            value={source}
                            onChange={(e) => {
                                setSource(e.target.value);
                                changed();
                            }}
                        >
                            {[
                                "Manual Assignment",
                                "Role/Position Requirement",
                                "Competency Recommendation",
                                "Reassignment/Renewal",
                            ].map((v) => (
                                <option key={v}>{v}</option>
                            ))}
                        </SystemSelect>
                    </Field>
                    <Field label="Priority">
                        <SystemSelect
                            className={input}
                            value={priority}
                            onChange={(e) => {
                                setPriority(e.target.value);
                                changed();
                            }}
                        >
                            {["Low", "Normal", "High", "Critical"].map((v) => (
                                <option key={v}>{v}</option>
                            ))}
                        </SystemSelect>
                    </Field>
                    <Field label="Available from">
                        <input
                            type="datetime-local"
                            className={input}
                            value={availableFrom}
                            onChange={(e) => {
                                setAvailableFrom(e.target.value);
                                changed();
                            }}
                        />
                    </Field>
                    <Field label="Due date">
                        <input
                            type="datetime-local"
                            className={input}
                            value={dueAt}
                            min={availableFrom}
                            onChange={(e) => {
                                setDueAt(e.target.value);
                                changed();
                            }}
                        />
                    </Field>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={mandatory}
                        onChange={(e) => {
                            setMandatory(e.target.checked);
                            changed();
                        }}
                    />
                    Mandatory assignment
                </label>
                <Field label="Assignment reason">
                    <textarea
                        className={`${input} h-24 py-2`}
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            changed();
                        }}
                    />
                </Field>
                {preview && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[560px] text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left">
                                        Person
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                        Result
                                    </th>
                                    <th className="px-3 py-2 text-left">
                                        Reason
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {preview.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-3 py-2 font-semibold">
                                            {row.name}
                                        </td>
                                        <td className="px-3 py-2">
                                            <StatusBadge value={row.result} />
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">
                                            {row.reason ??
                                                "Eligible under published audience"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppModal>
    );
}

function Assignments({
    state,
    update,
    notice,
}: {
    state: LearningState;
    update: (value: LearningState) => void;
    notice: (value: string) => void;
}) {
    const [status, setStatus] = useState("All");
    const [sort, setSort] = useState("Due soon");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<any>(null);
    const [action, setAction] = useState<{
        kind: "cancel" | "migrate";
        row: any;
    } | null>(null);
    const [reason, setReason] = useState("");

    const rows = state.assignments
        .filter((row: any) => status === "All" || row.display_status === status)
        .sort((left: any, right: any) =>
            sort === "Employee"
                ? String(left.learner_name).localeCompare(String(right.learner_name))
                : sort === "Assigned newest"
                  ? String(right.assigned_at ?? "").localeCompare(String(left.assigned_at ?? ""))
                  : String(left.due_at ?? "9999").localeCompare(String(right.due_at ?? "9999")),
        );
    const visible = paginate(rows, page, 10);

    useEffect(() => {
        const pages = Math.max(1, Math.ceil(rows.length / 10));
        if (page > pages) setPage(pages);
    }, [rows.length, page]);

    const exportRows = () => {
        const content = [
            "Employee,Course,Version,Source,Status,Progress,Available,Due",
            ...rows.map((row: any) =>
                [
                    row.learner_name,
                    row.title,
                    row.version_number,
                    row.source,
                    row.display_status,
                    row.progress_percent,
                    row.available_from,
                    row.due_at,
                ]
                    .map(csv)
                    .join(","),
            ),
        ].join("\n");
        const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "learning-assignments.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const currentPublishedVersion = selected
        ? state.courses.find((course) => course.id === selected.course_id)?.publishedVersionId
        : null;
    const selectedActive = Boolean(
        selected && !["Completed", "Cancelled", "Expired"].includes(selected.status),
    );

    const run = async () => {
        if (!action || !reason.trim()) return;
        try {
            if (action.kind === "cancel") {
                update(await learningClient.cancelAssignment(action.row.id, reason.trim()));
                notice("Assignment cancelled.");
            } else {
                const target = state.courses.find(
                    (course) => course.id === action.row.course_id,
                )?.publishedVersionId;
                if (!target) return;
                await learningClient.migrateAssignment(action.row.id, target, reason.trim());
                update(await learningClient.state());
                notice("Assignment moved to the current published course version.");
            }
            setSelected(null);
            setAction(null);
            setReason("");
        } catch (error) {
            notice(learningError(error));
        }
    };

    return (
        <>
            <HeaderFilters>
                <SystemSelect
                    aria-label="Assignment status"
                    menuLabel="Status"
                    className={`${input} w-56`}
                    value={status}
                    onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                    }}
                >
                    {["All", "Not Started", "In Progress", "Completed", "Failed/Attempts Exhausted", "Cancelled", "Expired", "Overdue"].map((value) => (
                        <option key={value}>{value}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Sort assignments"
                    menuLabel="Sort"
                    className={`${input} w-48`}
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                >
                    {["Due soon", "Assigned newest", "Employee"].map((value) => (
                        <option key={value}>{value}</option>
                    ))}
                </SystemSelect>
            </HeaderFilters>
            <HeaderActions>
                <button className={btn} onClick={exportRows}>
                    <Download className="h-4 w-4" />
                    Export CSV
                </button>
            </HeaderActions>

            <section className={panel}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                            <tr>
                                <th className="border-b border-slate-200 px-4 py-3">Employee</th>
                                <th className="border-b border-slate-200 px-4 py-3">Course</th>
                                <th className="border-b border-slate-200 px-4 py-3">Progress</th>
                                <th className="border-b border-slate-200 px-4 py-3">Status</th>
                                <th className="border-b border-slate-200 px-4 py-3">Due</th>
                                <th className="border-b border-slate-200 px-4 py-3">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {visible.map((row: any) => (
                                <tr
                                    key={row.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Open assignment for ${row.learner_name}`}
                                    onClick={() => setSelected(row)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelected(row);
                                        }
                                    }}
                                    className="cursor-pointer hover:bg-amber-50/40 focus-visible:bg-amber-50/60 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{row.learner_name}</p>
                                        <p className="text-xs text-slate-500">
                                            {[row.position, row.department].filter(Boolean).join(" · ") || "—"}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{row.title}</p>
                                        <p className="text-xs text-slate-500">{row.code} · v{row.version_number}</p>
                                    </td>
                                    <td className="min-w-44 px-4 py-3">
                                        <ProgressBar value={Number(row.progress_percent ?? 0)} />
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge value={row.display_status ?? row.status} /></td>
                                    <td className="px-4 py-3">{date(row.due_at)}</td>
                                    <td className="px-4 py-3">{row.source || "—"}</td>
                                </tr>
                            ))}
                            {!visible.length && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                                        No assignments match the selected status.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination page={page} total={rows.length} setPage={setPage} />
            </section>

            <AppDrawer
                show={Boolean(selected)}
                title={selected?.learner_name ?? ""}
                description={selected ? `${selected.title} · v${selected.version_number}` : ""}
                eyebrow="Assignment Details"
                onClose={() => setSelected(null)}
                presentation="modal"
                maxWidthClassName="!max-w-[1040px]"
                footer={
                    <>
                        {selectedActive && (
                            <button
                                className={btn}
                                onClick={() => {
                                    setReason("");
                                    setAction({ kind: "cancel", row: selected });
                                }}
                            >
                                Cancel Assignment
                            </button>
                        )}
                        {selectedActive &&
                            currentPublishedVersion &&
                            currentPublishedVersion !== selected?.course_version_id && (
                                <button
                                    className={primary}
                                    onClick={() => {
                                        setReason("");
                                        setAction({ kind: "migrate", row: selected });
                                    }}
                                >
                                    Move to Latest Version
                                </button>
                            )}
                    </>
                }
            >
                {selected && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-slate-500">Progress</p>
                                    <p className="mt-1 text-2xl font-extrabold text-slate-950">{Number(selected.progress_percent ?? 0)}%</p>
                                </div>
                                <StatusBadge value={selected.display_status ?? selected.status} />
                            </div>
                            <div className="mt-3"><ProgressBar value={Number(selected.progress_percent ?? 0)} /></div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                ["Person type", selected.person_type || "—"],
                                ["Department", selected.department || "—"],
                                ["Position", selected.position || "—"],
                                ["Course version", `${selected.code} · v${selected.version_number}`],
                                ["Source", selected.source || "—"],
                                ["Priority", selected.priority || "—"],
                                ["Assignment", selected.is_mandatory ? "Mandatory" : "Optional"],
                                ["Assigned by", selected.assigned_by || "System"],
                                ["Assigned", date(selected.assigned_at)],
                                ["Available", date(selected.available_from)],
                                ["Due", date(selected.due_at)],
                                ["Completed", date(selected.completed_at)],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
                                    <p className="text-xs font-semibold text-slate-500">{label}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                                </div>
                            ))}
                        </div>
                        {selected.reason && (
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold text-slate-500">Assignment reason</p>
                                <p className="mt-1 text-sm text-slate-800">{selected.reason}</p>
                            </div>
                        )}
                    </div>
                )}
            </AppDrawer>

            <AppModal
                show={Boolean(action)}
                title={action?.kind === "cancel" ? "Cancel assignment?" : "Move assignment to latest version?"}
                description={
                    action?.kind === "migrate"
                        ? "A new assignment will use the current published course version. Existing learning history stays unchanged."
                        : "The assignment will stay in the employee's learning history."
                }
                onClose={() => setAction(null)}
                footer={
                    <>
                        <button className={btn} onClick={() => setAction(null)}>Keep Assignment</button>
                        <button className={primary} disabled={!reason.trim()} onClick={() => void run()}>
                            {action?.kind === "cancel" ? "Cancel Assignment" : "Move Assignment"}
                        </button>
                    </>
                }
            >
                <Field label="Reason" required>
                    <textarea
                        className={`${input} h-28 py-2`}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                    />
                </Field>
            </AppModal>
        </>
    );
}

function Completions({
    state,
    update,
    notice,
    renew,
}: {
    state: LearningState;
    update: (value: LearningState) => void;
    notice: (value: string) => void;
    renew: (row: any) => void;
}) {
    const [selected, setSelected] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [attemptPage, setAttemptPage] = useState(1);
    const [certificate, setCertificate] = useState<any>(null);
    const [regrade, setRegrade] = useState<any>(null);
    const [reason, setReason] = useState("");
    const [regradeReason, setRegradeReason] = useState("");
    const [busy, setBusy] = useState(false);

    const completionRows = [...state.completions].sort(
        (left: any, right: any) =>
            new Date(right.completed_at ?? 0).getTime() -
            new Date(left.completed_at ?? 0).getTime(),
    );
    const submittedAttempts = (state.attempts ?? [])
        .filter((attempt: any) => attempt.status === "Submitted")
        .sort(
            (left: any, right: any) =>
                new Date(right.submitted_at ?? 0).getTime() -
                new Date(left.submitted_at ?? 0).getTime(),
        );

    useEffect(() => {
        const pages = Math.max(1, Math.ceil(completionRows.length / 10));
        if (page > pages) setPage(pages);
    }, [completionRows.length, page]);
    useEffect(() => {
        const pages = Math.max(1, Math.ceil(submittedAttempts.length / 10));
        if (attemptPage > pages) setAttemptPage(pages);
    }, [submittedAttempts.length, attemptPage]);

    const issue = async () => {
        if (!selected?.id) return;
        setBusy(true);
        try {
            update(await learningClient.issueCertificate(selected.id));
            notice("Certificate issued by HR/Admin.");
            setSelected(null);
        } catch (error) {
            notice(learningError(error));
        } finally {
            setBusy(false);
        }
    };

    const revoke = async () => {
        if (!certificate || !reason.trim()) return;
        try {
            update(
                await learningClient.revokeCertificate(
                    certificate.certificate_id,
                    reason.trim(),
                ),
            );
            notice("Certificate revoked.");
            setSelected(null);
            setCertificate(null);
            setReason("");
        } catch (error) {
            notice(learningError(error));
        }
    };

    const runRegrade = async () => {
        if (!regrade || !regradeReason.trim()) return;
        setBusy(true);
        try {
            const result = await learningClient.regradeAttempt(
                regrade.id,
                regradeReason.trim(),
            );
            update(await learningClient.state());
            notice(
                `Attempt #${result.attemptNumber} updated to ${result.score}% · ${result.passed ? "Passed" : "Not Passed"}.`,
            );
            setRegrade(null);
            setRegradeReason("");
        } catch (error) {
            notice(learningError(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <section className={panel}>
                <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-bold text-slate-900">Learning Records</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                            <tr>
                                <th className="border-b border-slate-200 px-4 py-3">Employee</th>
                                <th className="border-b border-slate-200 px-4 py-3">Course</th>
                                <th className="border-b border-slate-200 px-4 py-3">Completed</th>
                                <th className="border-b border-slate-200 px-4 py-3">Score</th>
                                <th className="border-b border-slate-200 px-4 py-3">Certificate</th>
                                <th className="border-b border-slate-200 px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginate(completionRows, page, 10).map((row: any) => (
                                <tr
                                    key={row.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Open learning record for ${row.learner_name}`}
                                    onClick={() => setSelected(row)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelected(row);
                                        }
                                    }}
                                    className="cursor-pointer hover:bg-amber-50/40 focus-visible:bg-amber-50/60 focus-visible:outline-none"
                                >
                                    <td className="px-4 py-3 font-semibold text-slate-900">{row.learner_name}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{row.title}</p>
                                        <p className="text-xs text-slate-500">v{row.version_number}</p>
                                    </td>
                                    <td className="px-4 py-3">{date(row.completed_at)}</td>
                                    <td className="px-4 py-3">
                                        {row.assessment_score === null || row.assessment_score === undefined
                                            ? "Not required"
                                            : `${row.assessment_score}%`}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{row.certificate_number ?? "—"}</td>
                                    <td className="px-4 py-3">
                                        {row.certificate_status ? <StatusBadge value={row.certificate_status} /> : <span className="text-slate-500">Completed</span>}
                                    </td>
                                </tr>
                            ))}
                            {!completionRows.length && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                                        No learning records yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination page={page} total={completionRows.length} setPage={setPage} />
            </section>

            <details className={panel}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <span className="text-sm font-bold text-slate-900">Assessment Corrections</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {submittedAttempts.length}
                    </span>
                </summary>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                            <tr>
                                <th className="border-b border-slate-200 px-4 py-3">Employee</th>
                                <th className="border-b border-slate-200 px-4 py-3">Course</th>
                                <th className="border-b border-slate-200 px-4 py-3">Assessment</th>
                                <th className="border-b border-slate-200 px-4 py-3">Submitted</th>
                                <th className="border-b border-slate-200 px-4 py-3">Score</th>
                                <th className="border-b border-slate-200 px-4 py-3">Result</th>
                                <th className="border-b border-slate-200 px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginate(submittedAttempts, attemptPage, 10).map((attempt: any) => (
                                <tr key={attempt.id}>
                                    <td className="px-4 py-3 font-semibold text-slate-900">{attempt.learner_name}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{attempt.course_title}</p>
                                        <p className="text-xs text-slate-500">v{attempt.version_number}</p>
                                    </td>
                                    <td className="px-4 py-3">{attempt.assessment_title}</td>
                                    <td className="px-4 py-3">{date(attempt.submitted_at)}</td>
                                    <td className="px-4 py-3">{attempt.score_percent ?? "—"}{attempt.score_percent === null || attempt.score_percent === undefined ? "" : "%"}</td>
                                    <td className="px-4 py-3"><StatusBadge value={attempt.passed ? "Passed" : "Not Passed"} /></td>
                                    <td className="px-4 py-3">
                                        <button
                                            className={btn}
                                            onClick={() => {
                                                setRegrade(attempt);
                                                setRegradeReason("");
                                            }}
                                        >
                                            Regrade
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!submittedAttempts.length && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                                        No submitted attempts need correction.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination page={attemptPage} total={submittedAttempts.length} setPage={setAttemptPage} />
            </details>

            <AppDrawer
                show={Boolean(selected)}
                title={selected?.learner_name ?? ""}
                description={selected ? `${selected.title} · v${selected.version_number}` : ""}
                eyebrow="Learning Record"
                onClose={() => setSelected(null)}
                presentation="modal"
                maxWidthClassName="!max-w-[1040px]"
                footer={
                    <>
                        {!selected?.certificate_id && selected?.certificate_eligible && (
                            <button className={primary} disabled={busy} onClick={() => void issue()}>
                                Issue Certificate
                            </button>
                        )}
                        {selected?.certificate_download_url && (
                            <a className={btn} href={selected.certificate_download_url}>
                                Printable Certificate
                            </a>
                        )}
                        {selected?.certificate_status === "Valid" && (
                            <button
                                className={btn}
                                onClick={() => {
                                    setReason("");
                                    setCertificate(selected);
                                }}
                            >
                                Revoke Certificate
                            </button>
                        )}
                        {selected?.expires_on && (
                            <button className={primary} onClick={() => renew(selected)}>
                                Create Renewal Assignment
                            </button>
                        )}
                    </>
                }
            >
                {selected && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {[
                            ["Completed", date(selected.completed_at)],
                            ["Completion basis", selected.completion_basis || "—"],
                            ["Assessment score", selected.assessment_score === null || selected.assessment_score === undefined ? "Not required" : `${selected.assessment_score}%`],
                            ["Certificate number", selected.certificate_number || "Not issued"],
                            ["Issued", date(selected.issued_on)],
                            ["Expires", date(selected.expires_on)],
                            ["Certificate status", selected.certificate_status || "Not issued"],
                            ["Learning transcript", selected.transcript_id ? "Recorded" : "Pending"],
                            ["Competency evidence", selected.competency_evidence_count ? `${selected.competency_evidence_count} evidence record${selected.competency_evidence_count === 1 ? "" : "s"}` : "Not competency-linked"],
                        ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold text-slate-500">{label}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </AppDrawer>

            <AppModal
                show={Boolean(certificate)}
                title="Revoke certificate?"
                description="The learning record will remain available."
                onClose={() => setCertificate(null)}
                footer={
                    <>
                        <button className={btn} onClick={() => setCertificate(null)}>Keep Certificate</button>
                        <button className={primary} disabled={!reason.trim()} onClick={() => void revoke()}>
                            Revoke Certificate
                        </button>
                    </>
                }
            >
                <Field label="Reason" required>
                    <textarea className={`${input} h-28 py-2`} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
            </AppModal>

            <AppModal
                show={Boolean(regrade)}
                title="Regrade assessment?"
                description="The saved responses will be recalculated and the change will be recorded."
                onClose={() => setRegrade(null)}
                footer={
                    <>
                        <button className={btn} onClick={() => setRegrade(null)}>Cancel</button>
                        <button className={primary} disabled={busy || !regradeReason.trim()} onClick={() => void runRegrade()}>
                            {busy ? "Regrading…" : "Regrade Assessment"}
                        </button>
                    </>
                }
            >
                <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {regrade?.learner_name} · {regrade?.course_title} · {regrade?.assessment_title} · attempt #{regrade?.attempt_number}
                </p>
                <Field label="Reason" required>
                    <textarea className={`${input} h-28 py-2`} value={regradeReason} onChange={(event) => setRegradeReason(event.target.value)} />
                </Field>
            </AppModal>
        </>
    );
}

function Analytics({ state }: { state: LearningState }) {
    type BreakdownDimension = "department" | "position" | "person_type" | "source";

    const [filters, setFilters] = useState({
        from: "",
        to: "",
        course: "All",
        version: "All",
        department: "All",
        position: "All",
        personType: "All",
        source: "All",
        status: "All",
    });
    const [analyticsDateRange, setAnalyticsDateRange] = useState<ChartDateRangeValue>({
        ...DEFAULT_CHART_DATE_RANGE,
        preset: "all",
    });
    const [breakdownDimension, setBreakdownDimension] = useState<BreakdownDimension>("department");

    const updateAnalyticsDateRange = (value: ChartDateRangeValue) => {
        setAnalyticsDateRange(value);
        const resolved = resolveChartDateRange(value);
        setFilters((current) => ({
            ...current,
            from: resolved.from ?? "",
            to: resolved.to ?? "",
        }));
    };

    const setFilter = (key: keyof typeof filters, value: string) => {
        setFilters((current) => ({
            ...current,
            [key]: value,
            ...(key === "course" ? { version: "All" } : {}),
        }));
    };

    const resetFilters = () => {
        setAnalyticsDateRange({ ...DEFAULT_CHART_DATE_RANGE, preset: "all" });
        setFilters({
            from: "",
            to: "",
            course: "All",
            version: "All",
            department: "All",
            position: "All",
            personType: "All",
            source: "All",
            status: "All",
        });
    };

    const choices = (field: string) =>
        [
            ...new Set(
                state.assignments.map((row: any) => row[field]).filter(Boolean),
            ),
        ].sort();

    const filtered = state.assignments.filter((row: any) => {
        const assigned = new Date(row.assigned_at).getTime();
        return (
            (!filters.from || assigned >= new Date(`${filters.from}T00:00:00+08:00`).getTime()) &&
            (!filters.to || assigned <= new Date(`${filters.to}T23:59:59+08:00`).getTime()) &&
            (filters.course === "All" || row.course_id === filters.course) &&
            (filters.version === "All" || row.course_version_id === filters.version) &&
            (filters.department === "All" || row.department === filters.department) &&
            (filters.position === "All" || row.position === filters.position) &&
            (filters.personType === "All" || row.person_type === filters.personType) &&
            (filters.source === "All" || row.source === filters.source) &&
            (filters.status === "All" || row.display_status === filters.status)
        );
    });

    const eligible = filtered.filter((row: any) => row.status !== "Cancelled");
    const completed = eligible.filter((row: any) => row.status === "Completed");
    const active = eligible.filter((row: any) => ["Not Started", "In Progress"].includes(row.status));
    const assignmentIds = new Set(filtered.map((row: any) => row.id));
    const attempts = (state.analytics.attempts ?? []).filter((row: any) => assignmentIds.has(row.assignmentId));
    const completionRate = eligible.length ? Math.round((completed.length / eligible.length) * 1000) / 10 : 0;
    const passRate = attempts.length
        ? Math.round((attempts.filter((row: any) => row.passed).length / attempts.length) * 1000) / 10
        : 0;
    const averageScore = attempts.length
        ? Math.round((attempts.reduce((sum: number, row: any) => sum + Number(row.score ?? 0), 0) / attempts.length) * 10) / 10
        : 0;
    const durations = completed
        .filter((row: any) => row.completed_at && row.assigned_at)
        .map((row: any) => (new Date(row.completed_at).getTime() - new Date(row.assigned_at).getTime()) / 60000)
        .filter((value: number) => Number.isFinite(value) && value >= 0);
    const averageLeadMinutes = durations.length
        ? Math.round(durations.reduce((sum: number, value: number) => sum + value, 0) / durations.length)
        : null;

    const formatDuration = (minutes: number | null) => {
        if (minutes === null) return "—";
        if (minutes < 60) return `${minutes}m`;
        if (minutes < 1440) return `${Math.round((minutes / 60) * 10) / 10}h`;
        return `${Math.round((minutes / 1440) * 10) / 10}d`;
    };

    const scrollToAnalyticsSection = (sectionId: string) => {
        window.requestAnimationFrame(() => {
            document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const summaryMetrics = [
        {
            label: "Assignments",
            value: filtered.length,
            icon: ClipboardList,
            onClick: () => scrollToAnalyticsSection("learning-analytics-course-performance"),
        },
        {
            label: "Learners",
            value: new Set(filtered.map((row: any) => row.learner_id)).size,
            icon: Users,
            onClick: () => scrollToAnalyticsSection("learning-analytics-workforce-breakdown"),
        },
        {
            label: "Completion",
            value: `${completionRate}%`,
            icon: CheckCircle2,
            onClick: () => {
                setFilter("status", "Completed");
                scrollToAnalyticsSection("learning-analytics-course-performance");
            },
        },
        {
            label: "Overdue",
            value: eligible.filter((row: any) => row.display_status === "Overdue").length,
            icon: AlertCircle,
            onClick: () => {
                setFilter("status", "Overdue");
                scrollToAnalyticsSection("learning-analytics-course-performance");
            },
        },
        {
            label: "Pass rate",
            value: attempts.length ? `${passRate}%` : "—",
            icon: Award,
            onClick: () => scrollToAnalyticsSection("learning-analytics-course-performance"),
        },
        {
            label: "Avg. score",
            value: attempts.length ? `${averageScore}%` : "—",
            icon: BarChart3,
            onClick: () => scrollToAnalyticsSection("learning-analytics-course-performance"),
        },
    ];

    const statusMix = [
        ["Not Started", eligible.filter((row: any) => row.status === "Not Started").length],
        ["In Progress", eligible.filter((row: any) => row.status === "In Progress").length],
        ["Completed", completed.length],
        ["Failed / exhausted", eligible.filter((row: any) => row.status === "Failed/Attempts Exhausted").length],
        ["Expired", eligible.filter((row: any) => row.status === "Expired").length],
        ["Cancelled", filtered.filter((row: any) => row.status === "Cancelled").length],
    ];

    const courseGroups = new Map<string, any[]>();
    filtered.forEach((row: any) => {
        const key = `${row.course_id}:${row.course_version_id}`;
        courseGroups.set(key, [...(courseGroups.get(key) ?? []), row]);
    });
    const coursePerformanceRows = [...courseGroups.entries()]
        .map(([key, rows]) => {
            const scopedEligible = rows.filter((row: any) => row.status !== "Cancelled");
            const scopedCompleted = scopedEligible.filter((row: any) => row.status === "Completed");
            const scopedActive = scopedEligible.filter((row: any) => ["Not Started", "In Progress"].includes(row.status));
            const scopedIds = new Set(rows.map((row: any) => row.id));
            const scopedAttempts = attempts.filter((row: any) => scopedIds.has(row.assignmentId));
            const leadMinutes = scopedCompleted
                .filter((row: any) => row.completed_at && row.assigned_at)
                .map((row: any) => (new Date(row.completed_at).getTime() - new Date(row.assigned_at).getTime()) / 60000)
                .filter((value: number) => Number.isFinite(value) && value >= 0);
            return {
                id: key,
                code: rows[0]?.code ?? "—",
                title: rows[0]?.title ?? "Untitled course",
                version: rows[0]?.version_number ?? "—",
                learners: new Set(scopedEligible.map((row: any) => row.learner_id)).size,
                assignments: scopedEligible.length,
                active: scopedActive.length,
                completed: scopedCompleted.length,
                completionRate: scopedEligible.length ? Math.round((scopedCompleted.length / scopedEligible.length) * 1000) / 10 : 0,
                overdue: scopedEligible.filter((row: any) => row.display_status === "Overdue").length,
                attempts: scopedAttempts.length,
                passRate: scopedAttempts.length
                    ? Math.round((scopedAttempts.filter((row: any) => row.passed).length / scopedAttempts.length) * 1000) / 10
                    : null,
                averageScore: scopedAttempts.length
                    ? Math.round((scopedAttempts.reduce((sum: number, row: any) => sum + Number(row.score ?? 0), 0) / scopedAttempts.length) * 10) / 10
                    : null,
                leadMinutes: leadMinutes.length
                    ? Math.round(leadMinutes.reduce((sum: number, value: number) => sum + value, 0) / leadMinutes.length)
                    : null,
            };
        })
        .sort((a, b) => b.assignments - a.assignments || a.code.localeCompare(b.code));

    const dimensionLabels: Record<BreakdownDimension, string> = {
        department: "Department",
        position: "Position",
        person_type: "Person type",
        source: "Assignment source",
    };
    const workforceGroups = new Map<string, any[]>();
    eligible.forEach((row: any) => {
        const value = String(row[breakdownDimension] || "Unspecified");
        workforceGroups.set(value, [...(workforceGroups.get(value) ?? []), row]);
    });
    const workforceRows = [...workforceGroups.entries()]
        .map(([label, rows]) => ({
            id: `${breakdownDimension}:${label}`,
            label,
            assignments: rows.length,
            learners: new Set(rows.map((row: any) => row.learner_id)).size,
            completionRate: rows.length
                ? Math.round((rows.filter((row: any) => row.status === "Completed").length / rows.length) * 1000) / 10
                : 0,
            overdue: rows.filter((row: any) => row.display_status === "Overdue").length,
        }))
        .sort((a, b) => b.assignments - a.assignments || a.label.localeCompare(b.label));

    const moduleEvents = (state.analytics.moduleEvents ?? []).filter((row: any) => assignmentIds.has(row.assignmentId));
    const moduleGroups = new Map<string, any[]>();
    moduleEvents.forEach((row: any) => {
        const key = String(row.moduleId);
        moduleGroups.set(key, [...(moduleGroups.get(key) ?? []), row]);
    });
    const modulePerformanceRows = [...moduleGroups.entries()]
        .map(([id, rows]) => ({
            id,
            course: rows[0]?.courseTitle ?? "—",
            version: rows[0]?.versionNumber ?? "—",
            module: rows[0]?.module ?? "Untitled module",
            events: rows.length,
            completedRate: rows.length
                ? Math.round((rows.filter((row: any) => row.status === "Completed").length / rows.length) * 1000) / 10
                : 0,
        }))
        .sort((a, b) => a.completedRate - b.completedRate || b.events - a.events);

    const questionEvents = (state.analytics.questionEvents ?? []).filter((row: any) => assignmentIds.has(row.assignmentId));
    const questionGroups = new Map<string, any[]>();
    questionEvents.forEach((row: any) => {
        const key = String(row.questionId);
        questionGroups.set(key, [...(questionGroups.get(key) ?? []), row]);
    });
    const questionPerformanceRows = [...questionGroups.entries()]
        .map(([id, rows]) => ({
            id,
            course: rows[0]?.courseTitle ?? "—",
            version: rows[0]?.versionNumber ?? "—",
            question: rows[0]?.question ?? "Untitled question",
            responses: rows.length,
            correctRate: rows.length
                ? Math.round((rows.filter((row: any) => Boolean(row.isCorrect)).length / rows.length) * 1000) / 10
                : 0,
        }))
        .sort((a, b) => a.correctRate - b.correctRate || b.responses - a.responses);

    const personnelByKey = new Map(state.personnel.map((person) => [person.personnel_key, person]));
    const courseById = new Map(state.courses.map((course) => [course.id, course]));
    const developmentLinks = state.requests
        .filter((row: any) => row.linked_course_id)
        .filter((row: any) => {
            const requested = new Date(row.requested_at).getTime();
            const person = personnelByKey.get(row.personnel_key);
            return (
                (!filters.from || requested >= new Date(`${filters.from}T00:00:00+08:00`).getTime()) &&
                (!filters.to || requested <= new Date(`${filters.to}T23:59:59+08:00`).getTime()) &&
                (filters.course === "All" || row.linked_course_id === filters.course) &&
                (filters.version === "All" || row.linked_course_version_id === filters.version) &&
                (filters.department === "All" || person?.department === filters.department) &&
                (filters.position === "All" || person?.position === filters.position) &&
                (filters.personType === "All" || person?.person_type === filters.personType)
            );
        })
        .map((row: any) => ({
            id: row.id,
            person: personnelByKey.get(row.personnel_key)?.name ?? "Employee record unavailable",
            competency: row.competency_name,
            recommendation: row.recommendation_title,
            course: courseById.get(row.linked_course_id)?.title ?? "Linked course",
            status: row.status,
            requestedAt: row.requested_at,
        }));

    return (
        <>
            <HeaderFilters onReset={resetFilters}>
                <ChartDateRangeControl
                    compact
                    label="Assignment date"
                    value={analyticsDateRange}
                    onChange={updateAnalyticsDateRange}
                />
                <SystemSelect menuLabel="Course" className={input} value={filters.course} onChange={(event) => setFilter("course", event.target.value)}>
                    <option value="All">All</option>
                    {state.courses.map((course) => (
                        <option key={course.id} value={course.id}>{course.code} · {course.title}</option>
                    ))}
                </SystemSelect>
                <SystemSelect menuLabel="Course version" className={input} value={filters.version} onChange={(event) => setFilter("version", event.target.value)}>
                    <option value="All">All</option>
                    {[...new Map(
                        state.assignments
                            .filter((row: any) => filters.course === "All" || row.course_id === filters.course)
                            .map((row: any) => [row.course_version_id, { value: row.course_version_id, label: `${row.code} · v${row.version_number}` }]),
                    ).values()].map((version: any) => (
                        <option key={version.value} value={version.value}>{version.label}</option>
                    ))}
                </SystemSelect>
                <SystemSelect menuLabel="Department" className={input} value={filters.department} onChange={(event) => setFilter("department", event.target.value)}>
                    <option value="All">All</option>
                    {choices("department").map((value: any) => <option key={value} value={value}>{value}</option>)}
                </SystemSelect>
                <SystemSelect menuLabel="Position" className={input} value={filters.position} onChange={(event) => setFilter("position", event.target.value)}>
                    <option value="All">All</option>
                    {choices("position").map((value: any) => <option key={value} value={value}>{value}</option>)}
                </SystemSelect>
                <SystemSelect menuLabel="Person type" className={input} value={filters.personType} onChange={(event) => setFilter("personType", event.target.value)}>
                    <option value="All">All</option>
                    {choices("person_type").map((value: any) => <option key={value} value={value}>{value}</option>)}
                </SystemSelect>
                <SystemSelect menuLabel="Assignment source" className={input} value={filters.source} onChange={(event) => setFilter("source", event.target.value)}>
                    <option value="All">All</option>
                    {choices("source").map((value: any) => <option key={value} value={value}>{value}</option>)}
                </SystemSelect>
                <SystemSelect menuLabel="Status" className={input} value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
                    <option value="All">All</option>
                    {choices("display_status").map((value: any) => <option key={value} value={value}>{value}</option>)}
                </SystemSelect>
            </HeaderFilters>

            <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {summaryMetrics.map((metric) => (
                    <StatCard
                        key={metric.label}
                        label={metric.label}
                        value={metric.value}
                        icon={metric.icon}
                        onClick={metric.onClick}
                    />
                ))}
            </div>

            <section className={`${panel} px-4 py-3`}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                    <span className="font-bold uppercase tracking-wide text-slate-400">Status mix</span>
                    <span className="text-slate-500">Scope <b className="text-slate-800">{filtered.length}</b></span>
                    {statusMix.map(([label, value]) => (
                        <span key={label} className="text-slate-600">
                            {label} <b className="text-slate-950">{value}</b>
                        </span>
                    ))}
                    <span className="ml-auto text-slate-500">
                        Avg. assignment-to-completion: <b className="text-slate-800">{formatDuration(averageLeadMinutes)}</b>
                    </span>
                </div>
            </section>

            <div id="learning-analytics-course-performance" className="scroll-mt-28">
            <DataTable
                title="Course & Version Performance"
                data={coursePerformanceRows}
                rowKey={(row) => row.id}
                pageSize={8}
                columns={[
                    {
                        key: "course",
                        header: "Course & version",
                        render: (row) => (
                            <div className="min-w-[230px]">
                                <p className="font-semibold text-slate-900">{row.code} · {row.title}</p>
                                <p className="text-xs text-slate-500">Version {row.version}</p>
                            </div>
                        ),
                    },
                    { key: "learners", header: "Learners", render: (row) => row.learners },
                    { key: "assigned", header: "Assigned", render: (row) => row.assignments },
                    { key: "active", header: "Active", render: (row) => row.active },
                    { key: "completed", header: "Completed", render: (row) => row.completed },
                    {
                        key: "completion",
                        header: "Completion",
                        render: (row) => <span className="font-semibold text-slate-900">{row.completionRate}%</span>,
                    },
                    {
                        key: "overdue",
                        header: "Overdue",
                        render: (row) => <span className={row.overdue ? "font-semibold text-rose-600" : "text-slate-500"}>{row.overdue}</span>,
                    },
                    {
                        key: "assessment",
                        header: "Assessment",
                        render: (row) => row.attempts ? (
                            <div className="min-w-[130px]">
                                <p className="font-semibold text-slate-900">{row.passRate}% pass</p>
                                <p className="text-xs text-slate-500">{row.averageScore}% avg · {row.attempts} attempt(s)</p>
                            </div>
                        ) : <span className="text-slate-400">No submitted attempts</span>,
                    },
                    {
                        key: "lead",
                        header: "Avg. completion time",
                        render: (row) => <span title="Elapsed calendar time from assignment to completion; not active time-on-task.">{formatDuration(row.leadMinutes)}</span>,
                    },
                ]}
                footer={
                    <p className="text-xs text-slate-500">
                        Completion = completed ÷ non-cancelled assignments. Assessment pass rate is based on submitted attempts. Completion time is elapsed calendar time, not time-on-task.
                    </p>
                }
            />
            </div>

            <div id="learning-analytics-workforce-breakdown" className="scroll-mt-28">
            <DataTable
                title="Workforce Breakdown"
                data={workforceRows}
                rowKey={(row) => row.id}
                pageSize={8}
                headerExtra={
                    <div className="flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                        {(Object.keys(dimensionLabels) as BreakdownDimension[]).map((dimension) => (
                            <button
                                key={dimension}
                                type="button"
                                onClick={() => setBreakdownDimension(dimension)}
                                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                                    breakdownDimension === dimension
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                                {dimensionLabels[dimension]}
                            </button>
                        ))}
                    </div>
                }
                columns={[
                    { key: "group", header: dimensionLabels[breakdownDimension], render: (row) => <span className="font-semibold text-slate-900">{row.label}</span> },
                    { key: "assignments", header: "Assignments", render: (row) => row.assignments },
                    { key: "learners", header: "Learners", render: (row) => row.learners },
                    { key: "completion", header: "Completion", render: (row) => `${row.completionRate}%` },
                    { key: "overdue", header: "Overdue", render: (row) => <span className={row.overdue ? "font-semibold text-rose-600" : "text-slate-500"}>{row.overdue}</span> },
                ]}
            />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <DataTable
                    title="Module Performance"
                    data={modulePerformanceRows}
                    rowKey={(row) => row.id}
                    pageSize={6}
                    columns={[
                        {
                            key: "module",
                            header: "Module",
                            render: (row) => (
                                <div className="min-w-[220px]">
                                    <p className="font-semibold text-slate-900">{row.module}</p>
                                    <p className="text-xs text-slate-500">{row.course} · v{row.version}</p>
                                </div>
                            ),
                        },
                        { key: "events", header: "Lesson events", render: (row) => row.events },
                        { key: "completion", header: "Completed", render: (row) => `${row.completedRate}%` },
                    ]}
                    footer={<p className="text-xs text-slate-500">Shows lesson-progress events only for assignments in the current filter scope.</p>}
                />

                <DataTable
                    title="Question Performance"
                    data={questionPerformanceRows}
                    rowKey={(row) => row.id}
                    pageSize={6}
                    columns={[
                        {
                            key: "question",
                            header: "Question",
                            render: (row) => (
                                <div className="min-w-[260px]">
                                    <p className="font-semibold text-slate-900">{row.question}</p>
                                    <p className="text-xs text-slate-500">{row.course} · v{row.version}</p>
                                </div>
                            ),
                        },
                        { key: "responses", header: "Responses", render: (row) => row.responses },
                        {
                            key: "correct",
                            header: "Correct rate",
                            render: (row) => <span className={row.correctRate < 60 ? "font-semibold text-rose-600" : "font-semibold text-slate-900"}>{row.correctRate}%</span>,
                        },
                    ]}
                    footer={<p className="text-xs text-slate-500">Low correct-rate questions are diagnostic signals for content or assessment review; they do not change saved grades.</p>}
                />
            </div>

            <DataTable
                title="Competency Development Linkage"
                data={developmentLinks}
                rowKey={(row) => row.id}
                pageSize={6}
                columns={[
                    { key: "person", header: "Person", render: (row) => <span className="font-semibold text-slate-900">{row.person}</span> },
                    { key: "competency", header: "Competency", render: (row) => row.competency },
                    { key: "recommendation", header: "Recommendation", render: (row) => row.recommendation },
                    { key: "course", header: "Linked course", render: (row) => row.course },
                    { key: "status", header: "Request status", render: (row) => <StatusBadge value={row.status} /> },
                    { key: "requested", header: "Requested", render: (row) => new Date(row.requestedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) },
                ]}
                footer={
                    <p className="text-xs text-slate-500">
                        This table tracks development handoffs from Competency into Learning. The selected date range uses request date here. A linked course or completion does not automatically close the original competency gap.
                    </p>
                }
            />
        </div>
        </>
    );
}

function Pagination({ page, total, setPage }: any) {
    const pages = Math.max(1, Math.ceil(total / 10));
    return (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span>{total} record(s)</span>
            <div className="flex gap-2">
                <button
                    className={btn}
                    disabled={page <= 1}
                    onClick={() => setPage((p: number) => p - 1)}
                >
                    Previous
                </button>
                <span className="flex items-center px-2">
                    Page {page} of {pages}
                </span>
                <button
                    className={btn}
                    disabled={page >= pages}
                    onClick={() => setPage((p: number) => p + 1)}
                >
                    Next
                </button>
            </div>
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
function csv(value: any) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
