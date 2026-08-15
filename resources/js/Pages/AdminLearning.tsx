import {
    AppDrawer,
    AppModal,
    Field,
    ProgressBar,
    StatusBadge,
} from "@/Components/Competency/CompetencyUI";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import {
    LEARNING_WORKSPACES,
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
import {
    AlertCircle,
    Archive,
    Award,
    BarChart3,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Download,
    Eye,
    FileCheck2,
    Filter,
    GraduationCap,
    Pencil,
    Plus,
    RefreshCcw,
    Search,
    Send,
    Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CourseBuilder from "./CourseBuilder";

const input =
    "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#F4B400] focus:ring-2 focus:ring-[#F4B400]/25";
const btn =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} border-[#F4B400] bg-[#F4B400] text-slate-950 hover:bg-amber-400`;
const panel =
    "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";
const headers = [
    "Course code",
    "Course title",
    "Category",
    "Published",
    "Working state",
    "Owner",
    "Audience",
    "Active assignments",
    "Completion",
    "Last updated",
    "Status",
    "Actions",
];
type Props = { initialLearningState?: unknown };

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
    const [workspace, setWorkspace] = useState<LearningWorkspace>("Overview");
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
            <AuthenticatedLayout>
                <Head title="Learning Management" />
                <div className="mx-auto w-full max-w-[1600px]">
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
                                            : "The governed Learning workspaces will appear when the current state is ready."}
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

    if (builder)
        return (
            <AuthenticatedLayout>
                <Head title="Course Builder" />
                <CourseBuilder
                    initialDraft={builder}
                    state={state}
                    onState={setState}
                    onExit={() => setBuilder(null)}
                />
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
    return (
        <AuthenticatedLayout>
            <Head title="Learning Management" />
            <div className="mx-auto w-full max-w-[1600px] space-y-4">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                            Learning Management
                        </p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
                            Governed online learning
                        </h1>
                        <p className="mt-1 max-w-3xl text-sm text-slate-600">
                            Versioned course governance, person-level delivery,
                            assessments, certificates, transcript records, and
                            human-reviewed Learning recommendations.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className={btn} onClick={refresh}>
                            <RefreshCcw className="h-4 w-4" />
                            Refresh
                        </button>
                        {workspace === "Courses" && (
                            <button
                                className={primary}
                                onClick={() =>
                                    setBuilder(emptyDraft(state.actor.id))
                                }
                            >
                                <Plus className="h-4 w-4" />
                                New Course
                            </button>
                        )}
                    </div>
                </header>
                {notice && (
                    <div
                        role="status"
                        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800"
                    >
                        <AlertCircle className="h-4 w-4" />
                        {notice}
                    </div>
                )}
                <nav
                    aria-label="Learning workspaces"
                    className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
                >
                    <div className="flex min-w-max gap-1">
                        {LEARNING_WORKSPACES.map((item) => (
                            <button
                                key={item}
                                onClick={() => setWorkspace(item)}
                                aria-current={
                                    workspace === item ? "page" : undefined
                                }
                                className={`min-h-10 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] ${workspace === item ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </nav>
                {workspace === "Overview" && (
                    <Overview state={state} navigate={setWorkspace} />
                )}{" "}
                {workspace === "Courses" && (
                    <Courses
                        state={state}
                        open={setSelected}
                        edit={(course: CourseSummary) =>
                            course.draftDetail && setBuilder(course.draftDetail)
                        }
                        newVersion={createWorkingDraft}
                        assign={(course: CourseSummary) => {
                            setRenewal(null);
                            setAssignCourse(course);
                        }}
                    />
                )}{" "}
                {workspace === "Learning Requests" && (
                    <Requests
                        state={state}
                        update={setState}
                        notice={setNotice}
                        createDraft={(row: any) => {
                            const value = emptyDraft(state.actor.id);
                            const competency = state.competencyCatalog.find(
                                (item) => item.id === row.competency_id,
                            );
                            value.title = row.recommendation_title;
                            value.description = row.recommendation_note;
                            value.learningObjectives = [
                                `Develop ${row.competency_name} toward required level ${row.required_level}.`,
                            ];
                            if (competency)
                                value.competencies = [
                                    {
                                        ...competency,
                                        targetLevel: row.required_level,
                                        purpose:
                                            "Competency recommendation development evidence",
                                    },
                                ];
                            setBuilder(value);
                        }}
                        continueDraft={(courseId: string) => {
                            const row = state.courses.find(
                                (item) => item.id === courseId,
                            );
                            if (row?.draftDetail) setBuilder(row.draftDetail);
                        }}
                    />
                )}{" "}
                {workspace === "Assignments" && (
                    <Assignments
                        state={state}
                        update={setState}
                        notice={setNotice}
                    />
                )}{" "}
                {workspace === "Completions & Certificates" && (
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
                    close={() => setSelected(null)}
                    edit={() => {
                        if (selected?.draftDetail) {
                            setBuilder(selected.draftDetail);
                            setSelected(null);
                        }
                    }}
                    newVersion={() => selected && createWorkingDraft(selected)}
                    assign={() => {
                        setRenewal(null);
                        setAssignCourse(selected);
                        setSelected(null);
                    }}
                    archive={() => {
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
                        This is a governed lifecycle action, not a deletion.
                    </p>
                </AppModal>
            </div>
        </AuthenticatedLayout>
    );
}

function Overview({
    state,
    navigate,
}: {
    state: LearningState;
    navigate: (value: LearningWorkspace) => void;
}) {
    const live = state.assignments.filter(
        (row) => !["Cancelled", "Completed", "Expired"].includes(row.status),
    );
    const eligible = state.assignments.filter(
        (row) => row.status !== "Cancelled",
    );
    const completed = eligible.filter((row) => row.status === "Completed");
    const overdue = state.assignments.filter(
        (row) => row.display_status === "Overdue",
    );
    const metrics = [
        [
            "Published Courses",
            state.courses.filter(
                (row) => row.publishedVersionId && !row.archived,
            ).length,
            "Courses",
        ],
        ["Active Learner Assignments", live.length, "Assignments"],
        [
            "Unique Active Learners",
            new Set(live.map((row) => row.learner_id)).size,
            "Assignments",
        ],
        [
            "Completion Rate",
            `${eligible.length ? Math.round((completed.length / eligible.length) * 100) : 0}%`,
            "Analytics",
        ],
        ["Overdue Assignments", overdue.length, "Assignments"],
        [
            "Courses Awaiting Review",
            state.reviews.filter((row) => row.status === "Pending").length,
            "Courses",
        ],
        [
            "Unprocessed Recommendations",
            state.requests.filter(
                (row) => !["Resolved", "Declined"].includes(row.status),
            ).length,
            "Learning Requests",
        ],
    ] as const;
    return (
        <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {metrics.map(([label, value, destination]) => (
                    <button
                        key={label}
                        onClick={() => navigate(destination)}
                        className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]"
                    >
                        <p className="text-2xl font-extrabold text-slate-950">
                            {value}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                            {label}
                        </p>
                    </button>
                ))}
            </div>
            <div className="grid items-stretch gap-4 lg:grid-cols-2">
                <ActionList
                    title="Pending course reviews"
                    rows={state.reviews
                        .filter((row) => row.status === "Pending")
                        .slice(0, 5)}
                    empty="No courses are awaiting review."
                    render={(row: any) => (
                        <>
                            <b>
                                {row.code} · {row.title}
                            </b>
                            <span>Reviewer: {row.reviewer_name}</span>
                        </>
                    )}
                />
                <ActionList
                    title="Learning recommendations awaiting action"
                    rows={state.requests
                        .filter(
                            (row) =>
                                !["Resolved", "Declined"].includes(row.status),
                        )
                        .slice(0, 5)}
                    empty="No pending Learning recommendations."
                    render={(row: any) => (
                        <>
                            <b>{row.recommendation_title}</b>
                            <span>
                                {row.competency_name} · Level{" "}
                                {row.validated_level} → {row.required_level}
                            </span>
                        </>
                    )}
                />
                <ActionList
                    title="Assignments approaching due dates"
                    rows={state.assignments
                        .filter(
                            (row) =>
                                row.due_at &&
                                !["Completed", "Cancelled"].includes(
                                    row.status,
                                ),
                        )
                        .slice(0, 5)}
                    empty="No upcoming due dates."
                    render={(row: any) => (
                        <>
                            <b>
                                {row.learner_name} · {row.title}
                            </b>
                            <span>
                                Due {date(row.due_at)} · {row.display_status}
                            </span>
                        </>
                    )}
                />
                <ActionList
                    title="Recent completions"
                    rows={state.completions.slice(0, 5)}
                    empty="No completion events yet."
                    render={(row: any) => (
                        <>
                            <b>
                                {row.learner_name} · {row.title}
                            </b>
                            <span>
                                v{row.version_number} · {date(row.completed_at)}
                            </span>
                        </>
                    )}
                />
            </div>
        </>
    );
}
function ActionList({ title, rows, empty, render }: any) {
    return (
        <section className={`${panel} flex h-full flex-col`}>
            <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            </div>
            <div className="divide-y divide-slate-100">
                {rows.length ? (
                    rows.map((row: any, index: number) => (
                        <div
                            key={row.id ?? index}
                            className="flex flex-col gap-1 px-4 py-3 text-sm text-slate-500"
                        >
                            {render(row)}
                        </div>
                    ))
                ) : (
                    <p className="p-4 text-sm text-slate-500">{empty}</p>
                )}
            </div>
        </section>
    );
}

function Courses({ state, open, edit, newVersion, assign }: any) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("All");
    const [category, setCategory] = useState("All");
    const [owner, setOwner] = useState("All");
    const [audience, setAudience] = useState("All");
    const [competency, setCompetency] = useState("All");
    const [sort, setSort] = useState<"title" | "updated">("updated");
    const [page, setPage] = useState(1);
    const categories = [...new Set(state.courses.map((r: any) => r.category))];
    const owners = [...new Set(state.courses.map((r: any) => r.owner))];
    const filtered = useMemo(
        () =>
            state.courses
                .filter(
                    (row: any) =>
                        (status === "All" || row.status === status) &&
                        (category === "All" || row.category === category) &&
                        (owner === "All" || row.owner === owner) &&
                        (audience === "All" ||
                            row.audience.includes(audience)) &&
                        (competency === "All" ||
                            row.competencies?.includes(competency)) &&
                        `${row.code} ${row.title}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                )
                .sort((a: any, b: any) =>
                    sort === "title"
                        ? a.title.localeCompare(b.title)
                        : String(b.lastUpdated).localeCompare(
                              String(a.lastUpdated),
                          ),
                ),
        [
            state.courses,
            search,
            status,
            category,
            owner,
            audience,
            competency,
            sort,
        ],
    );
    const reset = () => {
        setSearch("");
        setStatus("All");
        setCategory("All");
        setOwner("All");
        setAudience("All");
        setCompetency("All");
        setPage(1);
    };
    const rows = paginate(filtered, page, 10);
    return (
        <section className={panel}>
            <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(5,1fr)_auto]">
                <label className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                        className={`${input} pl-9`}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search courses"
                    />
                </label>
                <select
                    className={input}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    {[
                        "All",
                        "Draft",
                        "In Review",
                        "Changes Requested",
                        "Approved",
                        "Published",
                        "Archived",
                    ].map((v) => (
                        <option key={v}>{v}</option>
                    ))}
                </select>
                <select
                    className={input}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option>All</option>
                    {categories.map((v: any) => (
                        <option key={v}>{v}</option>
                    ))}
                </select>
                <select
                    className={input}
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                >
                    <option>All</option>
                    {owners.map((v: any) => (
                        <option key={v}>{v}</option>
                    ))}
                </select>
                <select
                    className={input}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                >
                    <option>All</option>
                    <option>Employee</option>
                    <option>Trainee</option>
                </select>
                <select
                    aria-label="Filter by competency"
                    className={input}
                    value={competency}
                    onChange={(e) => setCompetency(e.target.value)}
                >
                    <option>All</option>
                    {state.competencyCatalog.map((value: any) => (
                        <option key={value.id} value={value.name}>
                            {value.name}
                        </option>
                    ))}
                </select>
                <button className={btn} onClick={reset}>
                    <RefreshCcw className="h-4 w-4" />
                    Reset
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1380px] border-collapse text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                            {headers.map((h) => (
                                <th
                                    key={h}
                                    className="border-b border-slate-200 px-3 py-3"
                                >
                                    {h}
                                    {h === "Course title" && (
                                        <button
                                            aria-label="Sort by title"
                                            onClick={() => setSort("title")}
                                        >
                                            <ChevronUp className="ml-1 inline h-3 w-3" />
                                        </button>
                                    )}
                                    {h === "Last updated" && (
                                        <button
                                            aria-label="Sort by updated"
                                            onClick={() => setSort("updated")}
                                        >
                                            <ChevronDown className="ml-1 inline h-3 w-3" />
                                        </button>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {rows.map((row: any) => (
                            <tr key={row.id} className="hover:bg-amber-50/40">
                                <td className="px-3 py-3 font-mono text-xs">
                                    {row.code}
                                </td>
                                <td className="px-3 py-3 font-bold text-slate-900">
                                    {row.title}
                                </td>
                                <td className="px-3 py-3">{row.category}</td>
                                <td className="px-3 py-3">
                                    {row.publishedVersion
                                        ? `v${row.publishedVersion}`
                                        : "—"}
                                </td>
                                <td className="px-3 py-3">
                                    {row.draftDetail?.status ?? "—"}
                                </td>
                                <td className="px-3 py-3">{row.owner}</td>
                                <td className="max-w-48 truncate px-3 py-3">
                                    {row.audience}
                                </td>
                                <td className="px-3 py-3 text-center">
                                    {row.activeAssignments}
                                </td>
                                <td className="px-3 py-3">
                                    <ProgressBar value={row.completionRate} />
                                </td>
                                <td className="px-3 py-3">
                                    {date(row.lastUpdated)}
                                </td>
                                <td className="px-3 py-3">
                                    <StatusBadge
                                        value={
                                            row.archived
                                                ? "Archived"
                                                : row.status
                                        }
                                    />
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex gap-2">
                                        <button
                                            className={btn}
                                            onClick={() => open(row)}
                                        >
                                            <Eye className="h-4 w-4" />
                                            Details
                                        </button>
                                        {row.draftDetail && (
                                            <button
                                                className={btn}
                                                onClick={() => edit(row)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Edit Draft
                                            </button>
                                        )}
                                        {!row.draftDetail &&
                                            row.publishedVersionId &&
                                            !row.archived && (
                                                <button
                                                    className={btn}
                                                    onClick={() =>
                                                        newVersion(row)
                                                    }
                                                >
                                                    Create v
                                                    {Number(
                                                        row.publishedVersion,
                                                    ) + 1}{" "}
                                                    Draft
                                                </button>
                                            )}
                                        {row.publishedVersionId &&
                                            !row.archived && (
                                                <button
                                                    className={btn}
                                                    onClick={() => assign(row)}
                                                >
                                                    <Users className="h-4 w-4" />
                                                    Assign
                                                </button>
                                            )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination page={page} total={filtered.length} setPage={setPage} />
        </section>
    );
}

function CourseDrawer({
    course,
    close,
    edit,
    newVersion,
    assign,
    archive,
}: any) {
    const detail = course?.draftDetail ?? course?.publishedDetail;
    return (
        <AppDrawer
            show={Boolean(course)}
            title={course?.title ?? ""}
            description={`${course?.code ?? ""} · ${course?.category ?? ""}`}
            onClose={close}
            eyebrow="Learning Management"
            footer={
                <>
                    {course?.draftDetail && (
                        <button className={primary} onClick={edit}>
                            <Pencil className="h-4 w-4" />
                            Continue Draft
                        </button>
                    )}
                    {!course?.draftDetail &&
                        course?.publishedVersionId &&
                        !course?.archived && (
                            <button className={btn} onClick={newVersion}>
                                Create next Draft
                            </button>
                        )}
                    {course?.publishedVersionId && !course?.archived && (
                        <button className={btn} onClick={assign}>
                            <Users className="h-4 w-4" />
                            Assign Learners
                        </button>
                    )}
                    {!course?.archived && (
                        <button className={btn} onClick={archive}>
                            <Archive className="h-4 w-4" />
                            Archive
                        </button>
                    )}
                </>
            }
        >
            <div className="grid gap-4 md:grid-cols-2">
                {[
                    ["Status", course?.status],
                    [
                        "Current published",
                        course?.publishedVersion
                            ? `v${course.publishedVersion}`
                            : "None",
                    ],
                    ["Owner", course?.owner],
                    ["Audience", course?.audience],
                    ["Active assignments", course?.activeAssignments],
                    ["Completion rate", `${course?.completionRate}%`],
                ].map(([label, value]) => (
                    <div
                        key={String(label)}
                        className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            {label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                            {value}
                        </p>
                    </div>
                ))}
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold">Versioned curriculum</h3>
                <p className="mt-2 text-sm text-slate-600">
                    {detail?.modules?.length ?? 0} modules ·{" "}
                    {detail?.modules?.reduce(
                        (n: number, m: any) => n + m.lessons.length,
                        0,
                    ) ?? 0}{" "}
                    lessons · {detail?.assessments?.length ?? 0} assessments
                </p>
                <div className="mt-3 space-y-2">
                    {detail?.modules?.map((module: any) => (
                        <div
                            key={module.clientId}
                            className="rounded-md bg-slate-50 p-3 text-sm"
                        >
                            <b>{module.title}</b>
                            <p className="text-slate-500">
                                {module.lessons.length} lesson(s)
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold">Course-version history</h3>
                <p className="mt-1 text-sm text-slate-600">
                    Official and retired working versions remain visible for
                    audit and historical activity.
                </p>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {[
                                    "Version",
                                    "Status",
                                    "Title",
                                    "Submitted",
                                    "Approved",
                                    "Published",
                                    "Updated",
                                ].map((label) => (
                                    <th
                                        key={label}
                                        className="border-b border-slate-200 px-3 py-2 text-left text-xs uppercase text-slate-600"
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {(course?.versionHistory ?? []).map(
                                (version: any) => (
                                    <tr key={version.id}>
                                        <td className="px-3 py-2 font-semibold">
                                            {version.versionNumber
                                                ? `v${version.versionNumber}`
                                                : "Working"}
                                        </td>
                                        <td className="px-3 py-2">
                                            <StatusBadge
                                                value={version.status}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            {version.title}
                                        </td>
                                        <td className="px-3 py-2">
                                            {date(version.submittedAt)}
                                        </td>
                                        <td className="px-3 py-2">
                                            {date(version.approvedAt)}
                                        </td>
                                        <td className="px-3 py-2">
                                            {date(version.publishedAt)}
                                        </td>
                                        <td className="px-3 py-2">
                                            {date(version.updatedAt)}
                                        </td>
                                    </tr>
                                ),
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppDrawer>
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
                    <select
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
                    </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Assignment source">
                        <select
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
                        </select>
                    </Field>
                    <Field label="Priority">
                        <select
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
                        </select>
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

function Requests({ state, update, notice, createDraft, continueDraft }: any) {
    const [courses, setCourses] = useState<Record<string, string>>({});
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [reasonAction, setReasonAction] = useState<{
        row: any;
        action: "Defer" | "Decline" | "Manual Resolve";
    } | null>(null);
    const [reason, setReason] = useState("");
    const action = async (
        row: any,
        type: string,
        extra: Record<string, unknown> = {},
    ) => {
        try {
            const selected = state.courses.find(
                (course: any) => course.id === courses[row.id],
            );
            update(
                await learningClient.actRequest(row.id, {
                    action: type,
                    ...extra,
                    courseId:
                        extra.courseId ?? selected?.id ?? row.linked_course_id,
                    courseVersionId:
                        extra.courseVersionId ??
                        (type === "Link Draft"
                            ? selected?.draftVersionId
                            : selected?.publishedVersionId) ??
                        row.linked_course_version_id,
                }),
            );
            notice(
                `Learning Request moved through ${type}. The competency gap remains open pending reassessment.`,
            );
        } catch (e) {
            notice(learningError(e));
        }
    };
    return (
        <>
            <section className={panel}>
                <div className="border-b border-slate-200 p-4">
                    <p className="text-sm text-slate-600">
                        Recommendations enter as New requests. Every transition
                        is explicit and append-only. Linking never auto-enrolls,
                        changes a competency result, or closes a gap.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1320px] text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {[
                                    "Person",
                                    "Competency snapshot",
                                    "Recommendation",
                                    "Target reassessment",
                                    "Recommended by",
                                    "Requested",
                                    "Status",
                                    "Learning action",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="border-b border-slate-200 px-3 py-3 text-left text-xs uppercase text-slate-600"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {state.requests.map((row: any) => {
                                const selected = state.courses.find(
                                    (course: any) =>
                                        course.id === courses[row.id],
                                );
                                const matchingAssignments =
                                    state.assignments.filter(
                                        (assignment: any) =>
                                            assignment.personnel_key ===
                                                row.personnel_key &&
                                            assignment.course_id ===
                                                row.linked_course_id &&
                                            !["Cancelled", "Expired"].includes(
                                                assignment.status,
                                            ),
                                    );
                                return (
                                    <tr key={row.id}>
                                        <td className="px-3 py-3 font-mono text-xs">
                                            {row.personnel_key}
                                        </td>
                                        <td className="px-3 py-3">
                                            <b>{row.competency_name}</b>
                                            <p className="text-xs text-slate-500">
                                                assessment{" "}
                                                {row.source_assessment_id} · v
                                                {row.source_assessment_version}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                competency v
                                                {row.competency_version} ·{" "}
                                                {row.validated_level} →{" "}
                                                {row.required_level}
                                            </p>
                                        </td>
                                        <td className="max-w-sm px-3 py-3">
                                            <b>{row.recommendation_title}</b>
                                            <p className="text-xs text-slate-500">
                                                {row.recommendation_note}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {row.actions?.length ?? 0}{" "}
                                                recorded action(s)
                                            </p>
                                        </td>
                                        <td className="px-3 py-3">
                                            {date(row.target_reassessment_date)}
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.recommended_by_name}
                                        </td>
                                        <td className="px-3 py-3">
                                            {date(row.requested_at)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge value={row.status} />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex min-w-[360px] flex-wrap gap-2">
                                                {row.status === "New" && (
                                                    <button
                                                        className={primary}
                                                        onClick={() =>
                                                            action(
                                                                row,
                                                                "Triage",
                                                            )
                                                        }
                                                    >
                                                        Triage request
                                                    </button>
                                                )}
                                                {row.status === "Deferred" && (
                                                    <button
                                                        className={primary}
                                                        onClick={() =>
                                                            action(
                                                                row,
                                                                "Triage",
                                                            )
                                                        }
                                                    >
                                                        Resume triage
                                                    </button>
                                                )}
                                                {row.status === "Triaged" && (
                                                    <>
                                                        <select
                                                            className={`${input} w-64`}
                                                            value={
                                                                courses[
                                                                    row.id
                                                                ] ?? ""
                                                            }
                                                            onChange={(e) =>
                                                                setCourses(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        [row.id]:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    }),
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Choose course
                                                                lineage
                                                            </option>
                                                            {state.courses
                                                                .filter(
                                                                    (
                                                                        course: any,
                                                                    ) =>
                                                                        !course.archived,
                                                                )
                                                                .map(
                                                                    (
                                                                        course: any,
                                                                    ) => (
                                                                        <option
                                                                            value={
                                                                                course.id
                                                                            }
                                                                            key={
                                                                                course.id
                                                                            }
                                                                        >
                                                                            {
                                                                                course.code
                                                                            }{" "}
                                                                            ·{" "}
                                                                            {
                                                                                course.title
                                                                            }
                                                                        </option>
                                                                    ),
                                                                )}
                                                        </select>
                                                        <button
                                                            className={btn}
                                                            disabled={
                                                                !selected?.publishedVersionId
                                                            }
                                                            onClick={() =>
                                                                action(
                                                                    row,
                                                                    "Link Course",
                                                                )
                                                            }
                                                        >
                                                            Link Published
                                                        </button>
                                                        <button
                                                            className={btn}
                                                            disabled={
                                                                !selected?.draftVersionId
                                                            }
                                                            onClick={() =>
                                                                action(
                                                                    row,
                                                                    "Link Draft",
                                                                )
                                                            }
                                                        >
                                                            Link Draft
                                                        </button>
                                                        <button
                                                            className={btn}
                                                            onClick={() =>
                                                                createDraft(row)
                                                            }
                                                        >
                                                            Create prefilled
                                                            Draft
                                                        </button>
                                                    </>
                                                )}
                                                {row.status ===
                                                    "Draft Linked" && (
                                                    <>
                                                        <button
                                                            className={btn}
                                                            onClick={() =>
                                                                continueDraft(
                                                                    row.linked_course_id,
                                                                )
                                                            }
                                                        >
                                                            Continue linked
                                                            Draft
                                                        </button>
                                                        <button
                                                            className={primary}
                                                            disabled={
                                                                !state.courses.find(
                                                                    (
                                                                        course: any,
                                                                    ) =>
                                                                        course.id ===
                                                                        row.linked_course_id,
                                                                )
                                                                    ?.publishedVersionId
                                                            }
                                                            onClick={() => {
                                                                const course =
                                                                    state.courses.find(
                                                                        (
                                                                            value: any,
                                                                        ) =>
                                                                            value.id ===
                                                                            row.linked_course_id,
                                                                    );
                                                                setCourses(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        [row.id]:
                                                                            course?.id ??
                                                                            "",
                                                                    }),
                                                                );
                                                                void action(
                                                                    row,
                                                                    "Ready",
                                                                    {
                                                                        courseId:
                                                                            course?.id,
                                                                        courseVersionId:
                                                                            course?.publishedVersionId,
                                                                    },
                                                                );
                                                            }}
                                                        >
                                                            Ready for Assignment
                                                        </button>
                                                    </>
                                                )}
                                                {row.status ===
                                                    "Ready for Assignment" && (
                                                    <>
                                                        <select
                                                            className={`${input} w-64`}
                                                            value={
                                                                assignments[
                                                                    row.id
                                                                ] ?? ""
                                                            }
                                                            onChange={(e) =>
                                                                setAssignments(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        [row.id]:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    }),
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                Choose explicit
                                                                assignment
                                                            </option>
                                                            {matchingAssignments.map(
                                                                (
                                                                    assignment: any,
                                                                ) => (
                                                                    <option
                                                                        key={
                                                                            assignment.id
                                                                        }
                                                                        value={
                                                                            assignment.id
                                                                        }
                                                                    >
                                                                        {
                                                                            assignment.learner_name
                                                                        }{" "}
                                                                        ·{" "}
                                                                        {
                                                                            assignment.code
                                                                        }{" "}
                                                                        v
                                                                        {
                                                                            assignment.version_number
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                        <button
                                                            className={primary}
                                                            disabled={
                                                                !assignments[
                                                                    row.id
                                                                ]
                                                            }
                                                            onClick={() =>
                                                                action(
                                                                    row,
                                                                    "Assigned",
                                                                    {
                                                                        assignmentId:
                                                                            assignments[
                                                                                row
                                                                                    .id
                                                                            ],
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            Record assignment
                                                            action
                                                        </button>
                                                    </>
                                                )}
                                                {row.status === "Assigned" && (
                                                    <>
                                                        <button
                                                            className={primary}
                                                            disabled={
                                                                !state.completions.some(
                                                                    (
                                                                        completion: any,
                                                                    ) =>
                                                                        completion.assignment_id ===
                                                                        row.assignment_id,
                                                                )
                                                            }
                                                            title="Available after the exact assignment creates a completion outcome"
                                                            onClick={() =>
                                                                action(
                                                                    row,
                                                                    "Resolve",
                                                                )
                                                            }
                                                        >
                                                            Resolve from
                                                            completion
                                                        </button>
                                                        {state.actor.role ===
                                                            "admin" && (
                                                            <button
                                                                className={btn}
                                                                onClick={() => {
                                                                    setReason(
                                                                        "",
                                                                    );
                                                                    setReasonAction(
                                                                        {
                                                                            row,
                                                                            action: "Manual Resolve",
                                                                        },
                                                                    );
                                                                }}
                                                            >
                                                                Administrative
                                                                closure
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {![
                                                    "Resolved",
                                                    "Assigned",
                                                    "Declined",
                                                ].includes(row.status) && (
                                                    <>
                                                        <button
                                                            className={btn}
                                                            onClick={() => {
                                                                setReason("");
                                                                setReasonAction(
                                                                    {
                                                                        row,
                                                                        action: "Defer",
                                                                    },
                                                                );
                                                            }}
                                                        >
                                                            Defer
                                                        </button>
                                                        <button
                                                            className={btn}
                                                            onClick={() => {
                                                                setReason("");
                                                                setReasonAction(
                                                                    {
                                                                        row,
                                                                        action: "Decline",
                                                                    },
                                                                );
                                                            }}
                                                        >
                                                            Decline
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
            <AppModal
                show={Boolean(reasonAction)}
                title={`${reasonAction?.action ?? ""} Learning Request?`}
                description="A reason is required and becomes part of the append-only action history."
                onClose={() => setReasonAction(null)}
                footer={
                    <>
                        <button
                            className={btn}
                            onClick={() => setReasonAction(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className={primary}
                            disabled={!reason.trim()}
                            onClick={async () => {
                                if (!reasonAction) return;
                                await action(
                                    reasonAction.row,
                                    reasonAction.action,
                                    {
                                        reason,
                                        ...(reasonAction.action ===
                                        "Manual Resolve"
                                            ? {
                                                  resolutionPolicy:
                                                      "Administrative closure without competency outcome",
                                              }
                                            : {}),
                                    },
                                );
                                setReasonAction(null);
                            }}
                        >
                            {reasonAction?.action}
                        </button>
                    </>
                }
            >
                <Field label="Reason" required>
                    <textarea
                        className={`${input} h-28 py-2`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </Field>
            </AppModal>
        </>
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
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("All");
    const [sort, setSort] = useState("Assigned newest");
    const [page, setPage] = useState(1);
    const [action, setAction] = useState<{
        kind: "cancel" | "migrate";
        row: any;
        target?: string;
    } | null>(null);
    const [reason, setReason] = useState("");
    const rows = state.assignments
        .filter(
            (r) =>
                (status === "All" || r.display_status === status) &&
                `${r.learner_name} ${r.title} ${r.department}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
            sort === "Learner"
                ? a.learner_name.localeCompare(b.learner_name)
                : sort === "Due soon"
                  ? String(a.due_at ?? "9999").localeCompare(
                        String(b.due_at ?? "9999"),
                    )
                  : String(b.assigned_at).localeCompare(String(a.assigned_at)),
        );
    const exportRows = () => {
        const content = [
            "Learner,Course,Version,Source,Mandatory,Priority,Status,Progress,Available,Due",
            ...rows.map((r) =>
                [
                    r.learner_name,
                    r.title,
                    r.version_number,
                    r.source,
                    r.is_mandatory,
                    r.priority,
                    r.display_status,
                    r.progress_percent,
                    r.available_from,
                    r.due_at,
                ]
                    .map(csv)
                    .join(","),
            ),
        ].join("\n");
        const url = URL.createObjectURL(
            new Blob([content], { type: "text/csv" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "learning-assignments.csv";
        a.click();
        URL.revokeObjectURL(url);
    };
    const run = async () => {
        if (!action || !reason.trim()) return;
        try {
            if (action.kind === "cancel")
                update(
                    await learningClient.cancelAssignment(
                        action.row.id,
                        reason,
                    ),
                );
            else {
                const target = state.courses.find(
                    (course) => course.id === action.row.course_id,
                )?.publishedVersionId;
                if (!target) return;
                await learningClient.migrateAssignment(
                    action.row.id,
                    target,
                    reason,
                );
                update(await learningClient.state());
            }
            notice(
                action.kind === "cancel"
                    ? "Assignment cancelled with history retained."
                    : "Assignment migrated explicitly; the original assignment remains historical.",
            );
            setAction(null);
            setReason("");
        } catch (error) {
            notice(learningError(error));
        }
    };
    return (
        <>
            <section className={panel}>
                <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
                    <input
                        className={`${input} max-w-sm`}
                        placeholder="Search learner, course, department"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                    <select
                        className={`${input} w-56`}
                        value={status}
                        onChange={(e) => {
                            setStatus(e.target.value);
                            setPage(1);
                        }}
                    >
                        {[
                            "All",
                            "Not Started",
                            "In Progress",
                            "Completed",
                            "Failed/Attempts Exhausted",
                            "Cancelled",
                            "Expired",
                            "Overdue",
                        ].map((v) => (
                            <option key={v}>{v}</option>
                        ))}
                    </select>
                    <select
                        aria-label="Sort assignments"
                        className={`${input} w-48`}
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                    >
                        {["Assigned newest", "Learner", "Due soon"].map((v) => (
                            <option key={v}>{v}</option>
                        ))}
                    </select>
                    <button
                        className={btn}
                        onClick={() => {
                            setSearch("");
                            setStatus("All");
                            setSort("Assigned newest");
                            setPage(1);
                        }}
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Reset
                    </button>
                    <button className={btn} onClick={exportRows}>
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1780px] text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {[
                                    "Learner",
                                    "Person type",
                                    "Department",
                                    "Position",
                                    "Course & exact version",
                                    "Source",
                                    "Mandatory",
                                    "Priority",
                                    "Reason",
                                    "Assigned by",
                                    "Assigned",
                                    "Available",
                                    "Due",
                                    "Progress",
                                    "Status",
                                    "Completion",
                                    "Actions",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="border-b border-slate-200 px-3 py-3 text-left text-xs uppercase text-slate-600"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginate(rows, page, 12).map((r) => {
                                const current = state.courses.find(
                                    (course) => course.id === r.course_id,
                                )?.publishedVersionId;
                                const active = ![
                                    "Completed",
                                    "Cancelled",
                                    "Expired",
                                ].includes(r.status);
                                return (
                                    <tr key={r.id}>
                                        <td className="px-3 py-3 font-bold">
                                            {r.learner_name}
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.person_type}
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.department}
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.position}
                                        </td>
                                        <td className="px-3 py-3">
                                            <b>{r.title}</b>
                                            <p className="text-xs text-slate-500">
                                                {r.code} · v{r.version_number}
                                            </p>
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.source}
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.is_mandatory
                                                ? "Mandatory"
                                                : "Optional"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.priority}
                                        </td>
                                        <td className="max-w-56 px-3 py-3 text-slate-600">
                                            {r.reason ?? "—"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.assigned_by ?? "System"}
                                        </td>
                                        <td className="px-3 py-3">
                                            {date(r.assigned_at)}
                                        </td>
                                        <td className="px-3 py-3">
                                            {date(r.available_from)}
                                        </td>
                                        <td className="px-3 py-3">
                                            {date(r.due_at)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <ProgressBar
                                                value={r.progress_percent}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge
                                                value={r.display_status}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            {date(r.completed_at)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex gap-2">
                                                {active && (
                                                    <button
                                                        className={btn}
                                                        onClick={() => {
                                                            setReason("");
                                                            setAction({
                                                                kind: "cancel",
                                                                row: r,
                                                            });
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                                {active &&
                                                    current &&
                                                    current !==
                                                        r.course_version_id && (
                                                        <button
                                                            className={btn}
                                                            onClick={() => {
                                                                setReason("");
                                                                setAction({
                                                                    kind: "migrate",
                                                                    row: r,
                                                                    target: current,
                                                                });
                                                            }}
                                                        >
                                                            Migrate
                                                        </button>
                                                    )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination page={page} total={rows.length} setPage={setPage} />
            </section>
            <AppModal
                show={Boolean(action)}
                title={
                    action?.kind === "cancel"
                        ? "Cancel assignment?"
                        : "Migrate assignment to current Published version?"
                }
                description={
                    action?.kind === "migrate"
                        ? `Preview: ${action?.row.title} v${action?.row.version_number} → current Published version. Progress and attempts do not silently move; a new pinned assignment is created.`
                        : "The assignment remains in history and cannot create new attempts."
                }
                onClose={() => setAction(null)}
                footer={
                    <>
                        <button className={btn} onClick={() => setAction(null)}>
                            Keep assignment
                        </button>
                        <button
                            className={primary}
                            disabled={!reason.trim()}
                            onClick={() => void run()}
                        >
                            {action?.kind === "cancel"
                                ? "Cancel assignment"
                                : "Confirm migration"}
                        </button>
                    </>
                }
            >
                <Field label="Required reason" required>
                    <textarea
                        className={`${input} h-28 py-2`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
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
    const [certificate, setCertificate] = useState<any>(null);
    const [regrade, setRegrade] = useState<any>(null);
    const [reason, setReason] = useState("");
    const [regradeReason, setRegradeReason] = useState("");
    const [busy, setBusy] = useState(false);
    const revoke = async () => {
        if (!certificate || !reason.trim()) return;
        try {
            update(
                await learningClient.revokeCertificate(
                    certificate.certificate_id,
                    reason,
                ),
            );
            notice(
                "Certificate revoked; issue and revocation history remain preserved.",
            );
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
                regradeReason,
            );
            update(await learningClient.state());
            notice(
                `Attempt ${result.attemptNumber} regraded to ${result.score}% (${result.passed ? "passed" : "not passed"}); assignment is ${result.assignmentStatus}.`,
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
                <div className="border-b border-slate-200 p-4 text-sm text-slate-600">
                    Immutable online-learning completion events remain
                    reportable for Published and Archived versions. Certificate
                    downloads are printable HTML documents; Training
                    certificates are not duplicated here.
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1480px] text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {[
                                    "Learner",
                                    "Course & exact version",
                                    "Completed",
                                    "Completion basis",
                                    "Assessment result",
                                    "Certificate number",
                                    "Issue date",
                                    "Expiration",
                                    "Certificate status",
                                    "Competency evidence",
                                    "Transcript",
                                    "Actions",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="border-b border-slate-200 px-3 py-3 text-left text-xs uppercase text-slate-600"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {state.completions.map((r) => (
                                <tr key={r.id}>
                                    <td className="px-3 py-3 font-bold">
                                        {r.learner_name}
                                    </td>
                                    <td className="px-3 py-3">
                                        {r.title} · v{r.version_number}
                                    </td>
                                    <td className="px-3 py-3">
                                        {date(r.completed_at)}
                                    </td>
                                    <td className="px-3 py-3">
                                        {r.completion_basis}
                                    </td>
                                    <td className="px-3 py-3">
                                        {r.assessment_score ?? "Not required"}
                                    </td>
                                    <td className="px-3 py-3 font-mono text-xs">
                                        {r.certificate_number ?? "—"}
                                    </td>
                                    <td className="px-3 py-3">
                                        {date(r.issued_on)}
                                    </td>
                                    <td className="px-3 py-3">
                                        {date(r.expires_on)}
                                    </td>
                                    <td className="px-3 py-3">
                                        {r.certificate_status ? (
                                            <StatusBadge
                                                value={r.certificate_status}
                                            />
                                        ) : (
                                            "Not issued"
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {r.competency_evidence_count
                                            ? `${r.competency_evidence_count} versioned evidence record(s); gap remains open`
                                            : "Not competency-linked"}
                                    </td>
                                    <td className="px-3 py-3">
                                        {r.transcript_id
                                            ? "Recorded"
                                            : "Pending"}
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            {r.certificate_download_url && (
                                                <a
                                                    className={btn}
                                                    href={
                                                        r.certificate_download_url
                                                    }
                                                >
                                                    Printable HTML
                                                </a>
                                            )}
                                            {r.certificate_status ===
                                                "Valid" && (
                                                <button
                                                    className={btn}
                                                    onClick={() => {
                                                        setReason("");
                                                        setCertificate(r);
                                                    }}
                                                >
                                                    Revoke
                                                </button>
                                            )}
                                            {r.expires_on && (
                                                <button
                                                    className={btn}
                                                    onClick={() => renew(r)}
                                                >
                                                    Create renewal assignment
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <section className={panel}>
                <div className="border-b border-slate-200 p-4">
                    <h2 className="font-bold text-slate-950">
                        Submitted attempt administration
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Authorized objective regrading uses the saved attempt
                        snapshot, records a required reason, and reconciles
                        assignment and completion rules. Existing completions
                        cannot be rewritten.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {[
                                    "Learner",
                                    "Course version",
                                    "Assessment",
                                    "Attempt",
                                    "Submitted",
                                    "Score",
                                    "Result",
                                    "Action",
                                ].map((heading) => (
                                    <th
                                        key={heading}
                                        className="border-b border-slate-200 px-3 py-3 text-left text-xs uppercase text-slate-600"
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {(state.attempts ?? [])
                                .filter(
                                    (attempt: any) =>
                                        attempt.status === "Submitted",
                                )
                                .map((attempt: any) => (
                                    <tr key={attempt.id}>
                                        <td className="px-3 py-3 font-semibold">
                                            {attempt.learner_name}
                                        </td>
                                        <td className="px-3 py-3">
                                            {attempt.course_title} · v
                                            {attempt.version_number}
                                        </td>
                                        <td className="px-3 py-3">
                                            {attempt.assessment_title}
                                        </td>
                                        <td className="px-3 py-3">
                                            #{attempt.attempt_number}
                                        </td>
                                        <td className="px-3 py-3">
                                            {date(attempt.submitted_at)}
                                        </td>
                                        <td className="px-3 py-3">
                                            {attempt.score_percent ?? "—"}%
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge
                                                value={
                                                    attempt.passed
                                                        ? "Passed"
                                                        : "Not Passed"
                                                }
                                            />
                                        </td>
                                        <td className="px-3 py-3">
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
                            {!(state.attempts ?? []).some(
                                (attempt: any) =>
                                    attempt.status === "Submitted",
                            ) && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-4 py-8 text-center text-sm text-slate-500"
                                    >
                                        No submitted attempts are available for
                                        administration.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            <AppModal
                show={Boolean(certificate)}
                title="Revoke Learning certificate?"
                description="Revocation is append-only and does not remove the completion or transcript."
                onClose={() => setCertificate(null)}
                footer={
                    <>
                        <button
                            className={btn}
                            onClick={() => setCertificate(null)}
                        >
                            Keep valid
                        </button>
                        <button
                            className={primary}
                            disabled={!reason.trim()}
                            onClick={() => void revoke()}
                        >
                            Revoke certificate
                        </button>
                    </>
                }
            >
                <Field label="Required revocation reason" required>
                    <textarea
                        className={`${input} h-28 py-2`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </Field>
            </AppModal>
            <AppModal
                show={Boolean(regrade)}
                title="Regrade objective attempt?"
                description="The saved question snapshot and responses will be graded deterministically. The action is audited and cannot rewrite an existing completion."
                onClose={() => setRegrade(null)}
                footer={
                    <>
                        <button
                            className={btn}
                            onClick={() => setRegrade(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className={primary}
                            disabled={busy || !regradeReason.trim()}
                            onClick={() => void runRegrade()}
                        >
                            Regrade and reconcile
                        </button>
                    </>
                }
            >
                <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {regrade?.learner_name} · {regrade?.course_title} ·{" "}
                    {regrade?.assessment_title} · attempt #
                    {regrade?.attempt_number}
                </p>
                <Field label="Required regrade reason" required>
                    <textarea
                        className={`${input} h-28 py-2`}
                        value={regradeReason}
                        onChange={(event) =>
                            setRegradeReason(event.target.value)
                        }
                    />
                </Field>
            </AppModal>
        </>
    );
}

function Analytics({ state }: { state: LearningState }) {
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
        competency: "All",
    });
    const choices = (field: string) =>
        [
            ...new Set(
                state.assignments.map((row: any) => row[field]).filter(Boolean),
            ),
        ].sort();
    const filtered = state.assignments.filter((row: any) => {
        const course = state.courses.find(
            (value) => value.id === row.course_id,
        );
        const assigned = new Date(row.assigned_at).getTime();
        return (
            (!filters.from ||
                assigned >=
                    new Date(`${filters.from}T00:00:00+08:00`).getTime()) &&
            (!filters.to ||
                assigned <=
                    new Date(`${filters.to}T23:59:59+08:00`).getTime()) &&
            (filters.course === "All" || row.course_id === filters.course) &&
            (filters.version === "All" ||
                row.course_version_id === filters.version) &&
            (filters.department === "All" ||
                row.department === filters.department) &&
            (filters.position === "All" || row.position === filters.position) &&
            (filters.personType === "All" ||
                row.person_type === filters.personType) &&
            (filters.source === "All" || row.source === filters.source) &&
            (filters.status === "All" ||
                row.display_status === filters.status) &&
            (filters.competency === "All" ||
                course?.competencies?.includes(filters.competency))
        );
    });
    const eligible = filtered.filter((row: any) => row.status !== "Cancelled");
    const completed = eligible.filter((row: any) => row.status === "Completed");
    const assignmentIds = new Set(filtered.map((row: any) => row.id));
    const attempts = (state.analytics.attempts ?? []).filter((row: any) =>
        assignmentIds.has(row.assignmentId),
    );
    const completionRate = eligible.length
        ? Math.round((completed.length / eligible.length) * 1000) / 10
        : 0;
    const passRate = attempts.length
        ? Math.round(
              (attempts.filter((row: any) => row.passed).length /
                  attempts.length) *
                  1000,
          ) / 10
        : 0;
    const averageScore = attempts.length
        ? Math.round(
              (attempts.reduce(
                  (sum: number, row: any) => sum + Number(row.score ?? 0),
                  0,
              ) /
                  attempts.length) *
                  10,
          ) / 10
        : 0;
    const durations = completed
        .filter((row: any) => row.completed_at)
        .map(
            (row: any) =>
                (new Date(row.completed_at).getTime() -
                    new Date(row.assigned_at).getTime()) /
                60000,
        );
    const metrics = [
        ["Assigned learners", eligible.length],
        [
            "Unique learners",
            new Set(eligible.map((row: any) => row.learner_id)).size,
        ],
        [
            "Not Started",
            eligible.filter((row: any) => row.status === "Not Started").length,
        ],
        [
            "In Progress",
            eligible.filter((row: any) => row.status === "In Progress").length,
        ],
        ["Completed", completed.length],
        [
            "Overdue",
            eligible.filter((row: any) => row.display_status === "Overdue")
                .length,
        ],
        [
            "Failed / exhausted",
            eligible.filter(
                (row: any) => row.status === "Failed/Attempts Exhausted",
            ).length,
        ],
        [
            "Cancelled",
            filtered.filter((row: any) => row.status === "Cancelled").length,
        ],
        ["Completion rate", `${completionRate}%`],
        ["Pass rate", `${passRate}%`],
        ["Average score", `${averageScore}%`],
        [
            "Average time",
            durations.length
                ? `${Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)} min`
                : "—",
        ],
    ];
    const breakdown = (field: string) =>
        Object.entries(
            filtered.reduce(
                (result: Record<string, number>, row: any) => ({
                    ...result,
                    [row[field] || "Unspecified"]:
                        (result[row[field] || "Unspecified"] ?? 0) + 1,
                }),
                {},
            ),
        ).map(([label, count]) => ({ id: `${field}-${label}`, label, count }));
    const archivedIncluded = state.completions.some(
        (row: any) =>
            assignmentIds.has(row.assignment_id) &&
            row.course_version_status === "Archived",
    );
    const select = (
        label: string,
        key: keyof typeof filters,
        values: { value: string; label: string }[],
    ) => (
        <label className="text-xs font-bold text-slate-600">
            {label}
            <select
                className={`${input} mt-1`}
                value={filters[key]}
                onChange={(event) =>
                    setFilters((current) => ({
                        ...current,
                        [key]: event.target.value,
                    }))
                }
            >
                <option value="All">All</option>
                {values.map((value) => (
                    <option key={value.value} value={value.value}>
                        {value.label}
                    </option>
                ))}
            </select>
        </label>
    );
    return (
        <div className="space-y-4">
            <section
                className={`${panel} p-4`}
                aria-label="Learning analytics filters"
            >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    <Field label="From">
                        <input
                            type="date"
                            className={input}
                            value={filters.from}
                            onChange={(event) =>
                                setFilters((current) => ({
                                    ...current,
                                    from: event.target.value,
                                }))
                            }
                        />
                    </Field>
                    <Field label="To">
                        <input
                            type="date"
                            className={input}
                            value={filters.to}
                            onChange={(event) =>
                                setFilters((current) => ({
                                    ...current,
                                    to: event.target.value,
                                }))
                            }
                        />
                    </Field>
                    {select(
                        "Course",
                        "course",
                        state.courses.map((course) => ({
                            value: course.id,
                            label: `${course.code} · ${course.title}`,
                        })),
                    )}
                    {select("Course version", "version", [
                        ...new Map(
                            state.assignments
                                .filter(
                                    (row: any) =>
                                        filters.course === "All" ||
                                        row.course_id === filters.course,
                                )
                                .map((row: any) => [
                                    row.course_version_id,
                                    {
                                        value: row.course_version_id,
                                        label: `${row.code} · v${row.version_number}`,
                                    },
                                ]),
                        ).values(),
                    ] as any)}
                    {select(
                        "Department",
                        "department",
                        choices("department").map((value: any) => ({
                            value,
                            label: value,
                        })),
                    )}
                    {select(
                        "Position",
                        "position",
                        choices("position").map((value: any) => ({
                            value,
                            label: value,
                        })),
                    )}
                    {select(
                        "Person type",
                        "personType",
                        choices("person_type").map((value: any) => ({
                            value,
                            label: value,
                        })),
                    )}
                    {select(
                        "Assignment source",
                        "source",
                        choices("source").map((value: any) => ({
                            value,
                            label: value,
                        })),
                    )}
                    {select(
                        "Status",
                        "status",
                        choices("display_status").map((value: any) => ({
                            value,
                            label: value,
                        })),
                    )}
                    {select(
                        "Competency",
                        "competency",
                        state.competencyCatalog.map((value) => ({
                            value: value.name,
                            label: value.name,
                        })),
                    )}
                    <button
                        className={`${btn} self-end`}
                        onClick={() =>
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
                                competency: "All",
                            })
                        }
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Reset
                    </button>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                    {filtered.length} assignment record(s) in scope.{" "}
                    {archivedIncluded
                        ? "Archived course-version activity is included."
                        : "Archived course-version activity is not included in this result."}
                </p>
            </section>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {metrics.map(([label, value]) => (
                    <div
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        key={label}
                    >
                        <p className="text-2xl font-extrabold text-slate-950">
                            {value}
                        </p>
                        <p className="text-xs font-bold text-slate-500">
                            {label}
                        </p>
                    </div>
                ))}
            </div>
            <section className={panel}>
                <div className="border-b border-slate-200 p-4">
                    <h2 className="text-sm font-bold">Assignment outcomes</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Cancelled assignments are excluded from completion-rate
                        denominators. Archived history remains reportable when
                        included by filters.
                    </p>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                    {[
                        ["Department", breakdown("department")],
                        ["Position", breakdown("position")],
                        ["Person type", breakdown("person_type")],
                        ["Assignment source", breakdown("source")],
                    ].map(([title, rows]: any) => (
                        <div key={title}>
                            <h3 className="text-sm font-bold">{title}</h3>
                            <div className="mt-2 space-y-2">
                                {rows.length ? (
                                    rows.map((row: any) => (
                                        <div
                                            className="flex justify-between rounded bg-slate-50 px-3 py-2 text-sm"
                                            key={row.id}
                                        >
                                            <span>{row.label}</span>
                                            <b>{row.count}</b>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        No records
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <ActionList
                    title="Course-version comparison"
                    rows={state.courses
                        .filter((c) => c.publishedVersion)
                        .slice(0, 6)}
                    empty="No Published versions."
                    render={(row: any) => (
                        <>
                            <b>
                                {row.code} · {row.title} · v
                                {row.publishedVersion}
                            </b>
                            <span>
                                {row.activeAssignments} active ·{" "}
                                {row.completionRate}% completion
                            </span>
                        </>
                    )}
                />
                <ActionList
                    title="Competency-linked outcomes"
                    rows={state.requests
                        .filter((r) => r.linked_course_id)
                        .slice(0, 6)}
                    empty="No acted competency-linked outcomes."
                    render={(row: any) => (
                        <>
                            <b>{row.competency_name}</b>
                            <span>
                                {row.status} · supporting development only
                            </span>
                        </>
                    )}
                />
                <ActionList
                    title="Module performance"
                    rows={(state.analytics.modulePerformance ?? []).slice(0, 8)}
                    empty="No module progress events."
                    render={(row: any) => (
                        <>
                            <b>{row.module}</b>
                            <span>
                                {row.completedRate}% completed across{" "}
                                {row.lessonEvents} lesson event(s)
                            </span>
                        </>
                    )}
                />
                <ActionList
                    title="Question performance"
                    rows={(state.analytics.questionPerformance ?? []).slice(
                        0,
                        8,
                    )}
                    empty="No submitted objective responses."
                    render={(row: any) => (
                        <>
                            <b>{row.question}</b>
                            <span>
                                {row.correctRate}% correct across{" "}
                                {row.responses} response(s)
                            </span>
                        </>
                    )}
                />
            </div>
        </div>
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
