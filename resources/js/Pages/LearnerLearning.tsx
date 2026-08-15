import {
    AppDrawer,
    AppModal,
    ProgressBar,
    StatusBadge,
} from "@/Components/Competency/CompetencyUI";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { LearningState } from "@/data/learning";
import { learningClient, learningError } from "@/data/learningClient";
import { Head } from "@inertiajs/react";
import {
    Award,
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Download,
    FileText,
    GraduationCap,
    List,
    Lock,
    Menu,
    PlayCircle,
    RefreshCcw,
    RotateCcw,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const btn =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} border-[#F4B400] bg-[#F4B400] text-slate-950 hover:bg-amber-400`;
const tabs = [
    "My Learning",
    "Required Assignments",
    "Eligible Course Catalog",
    "Results",
    "Certificates",
    "Learning Transcript",
] as const;
type Tab = (typeof tabs)[number];
export default function LearnerLearning({
    initialLearningState,
}: {
    initialLearningState: LearningState;
}) {
    const [state, setState] = useState(initialLearningState);
    const [tab, setTab] = useState<Tab>("My Learning");
    const [player, setPlayer] = useState<any>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const openPlayer = async (id: string) => {
        setLoading(true);
        setError("");
        try {
            setPlayer(await learningClient.player(id));
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
    const selfEnroll = async (versionId: string) => {
        setLoading(true);
        setError("");
        try {
            const value = await learningClient.selfEnroll(versionId);
            await refresh();
            await openPlayer(value.assignmentId);
        } catch (e) {
            setError(learningError(e));
        } finally {
            setLoading(false);
        }
    };
    return (
        <AuthenticatedLayout>
            <Head title="My Learning" />
            <div className="mx-auto w-full max-w-[1600px] space-y-4">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                            Learner LMS
                        </p>
                        <h1 className="mt-1 text-2xl font-extrabold text-slate-950">
                            My Learning
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Version-pinned online courses, saved progress,
                            assessments, results, certificates, and transcript
                            records.
                        </p>
                    </div>
                    <button className={btn} onClick={refresh}>
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                    </button>
                </header>
                {error && (
                    <p
                        role="alert"
                        className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                    >
                        {error}
                    </p>
                )}
                <nav
                    aria-label="Learner LMS areas"
                    className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
                >
                    <div className="flex min-w-max gap-1">
                        {tabs.map((value) => (
                            <button
                                className={`min-h-10 rounded-lg px-4 text-sm font-bold ${tab === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                                key={value}
                                onClick={() => setTab(value)}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                </nav>
                {(tab === "My Learning" || tab === "Required Assignments") && (
                    <AssignmentCards
                        rows={state.assignments.filter(
                            (r) => tab === "My Learning" || r.is_mandatory,
                        )}
                        open={openPlayer}
                        loading={loading}
                    />
                )}{" "}
                {tab === "Eligible Course Catalog" && (
                    <Catalog
                        rows={state.catalog}
                        enroll={selfEnroll}
                        loading={loading}
                    />
                )}{" "}
                {tab === "Results" && <Results rows={state.completions} />}{" "}
                {tab === "Certificates" && (
                    <Certificates rows={state.completions} />
                )}{" "}
                {tab === "Learning Transcript" && (
                    <Transcript rows={state.completions} />
                )}
                <CoursePlayer
                    data={player}
                    close={() => setPlayer(null)}
                    changed={async () => {
                        if (player) {
                            const next = await learningClient.player(
                                player.assignment.id,
                            );
                            setPlayer(next);
                            await refresh();
                        }
                    }}
                />
            </div>
        </AuthenticatedLayout>
    );
}

function AssignmentCards({ rows, open, loading }: any) {
    return (
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.length ? (
                rows.map((row: any) => (
                    <article
                        className="flex min-h-64 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                        key={row.id}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-mono text-xs text-slate-500">
                                    {row.code} · v{row.version_number}
                                </p>
                                <h2 className="mt-1 text-lg font-bold text-slate-950">
                                    {row.title}
                                </h2>
                            </div>
                            <StatusBadge value={row.display_status} />
                        </div>
                        <div className="mt-4">
                            <ProgressBar value={row.progress_percent} />
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <dt className="text-xs font-bold uppercase text-slate-500">
                                    Assignment
                                </dt>
                                <dd className="mt-1">
                                    {row.is_mandatory ? "Required" : "Optional"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase text-slate-500">
                                    Due
                                </dt>
                                <dd className="mt-1">{date(row.due_at)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase text-slate-500">
                                    Source
                                </dt>
                                <dd className="mt-1">{row.source}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase text-slate-500">
                                    Resume
                                </dt>
                                <dd className="mt-1">
                                    {row.progress_percent
                                        ? "Last activity"
                                        : "Start course"}
                                </dd>
                            </div>
                        </dl>
                        <button
                            disabled={
                                loading ||
                                ["Cancelled", "Expired"].includes(row.status)
                            }
                            className={`${primary} mt-auto`}
                            onClick={() => open(row.id)}
                        >
                            <PlayCircle className="h-4 w-4" />
                            {row.progress_percent
                                ? "Resume course"
                                : "Start course"}
                        </button>
                    </article>
                ))
            ) : (
                <Empty
                    title="No learning assignments"
                    text="Assigned or self-enrolled online courses will appear here."
                />
            )}
        </div>
    );
}
function Catalog({ rows, enroll, loading }: any) {
    return (
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.length ? (
                rows.map((row: any) => (
                    <article
                        className="flex min-h-56 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                        key={row.id}
                    >
                        <p className="font-mono text-xs text-slate-500">
                            {row.code} · v{row.publishedVersion}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-slate-950">
                            {row.title}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            {row.category} · {row.audience}
                        </p>
                        <button
                            className={`${primary} mt-auto`}
                            disabled={loading}
                            onClick={() => enroll(row.publishedVersionId)}
                        >
                            <GraduationCap className="h-4 w-4" />
                            Self-enroll
                        </button>
                    </article>
                ))
            ) : (
                <Empty
                    title="No eligible catalog courses"
                    text="Eligibility comes from the Published course audience."
                />
            )}
        </div>
    );
}
function Results({ rows }: any) {
    return (
        <Table
            heads={[
                "Course & exact version",
                "Completed",
                "Assessment result",
                "Basis",
            ]}
            rows={rows.map((r: any) => [
                `${r.title} · v${r.version_number}`,
                date(r.completed_at),
                r.assessment_score ?? "Not required",
                r.completion_basis,
            ])}
        />
    );
}
function Certificates({ rows }: any) {
    const data = rows.filter((r: any) => r.certificate_id);
    return (
        <Table
            heads={[
                "Certificate",
                "Course",
                "Issued",
                "Expires",
                "Status",
                "Download",
            ]}
            rows={data.map((r: any) => [
                r.certificate_number,
                `${r.title} · v${r.version_number}`,
                date(r.issued_on),
                date(r.expires_on),
                r.certificate_status,
                r.certificate_download_url ? (
                    <a className={btn} href={r.certificate_download_url}>
                        <Download className="h-4 w-4" />
                        Printable HTML
                    </a>
                ) : (
                    <span className="text-sm text-slate-500">Unavailable</span>
                ),
            ])}
        />
    );
}
function Transcript({ rows }: any) {
    return (
        <Table
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

function CoursePlayer({ data, close, changed }: any) {
    const [lessonId, setLessonId] = useState<string | null>(null);
    const [outline, setOutline] = useState(false);
    const [assessment, setAssessment] = useState<any>(null);
    const [attempt, setAttempt] = useState<any>(null);
    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");
    const lessons = useMemo(
        () =>
            data?.modules?.flatMap((m: any) =>
                m.lessons.map((l: any) => ({ ...l, moduleTitle: m.title })),
            ) ?? [],
        [data],
    );
    const progress = data?.progress ?? [];
    const resumeLessonId = useMemo(() => {
        if (!lessons.length) return null;
        const recent = [...progress].sort((a: any, b: any) =>
            String(b.last_activity_at ?? "").localeCompare(
                String(a.last_activity_at ?? ""),
            ),
        )[0];
        if (!recent) return lessons[0].id;
        if (recent.status !== "Completed") return recent.lesson_id;
        const index = lessons.findIndex(
            (lesson: any) => lesson.id === recent.lesson_id,
        );
        return lessons[index + 1]?.id ?? recent.lesson_id;
    }, [lessons, progress]);
    const current = lessons.find(
        (lesson: any) => lesson.id === (lessonId ?? resumeLessonId),
    );
    const isDone = (id: string) =>
        progress.some(
            (p: any) => p.lesson_id === id && p.status === "Completed",
        );
    const complete = async () => {
        if (!current) return;
        setError("");
        try {
            await learningClient.recordLesson(
                data.assignment.id,
                current.id,
                true,
            );
            await changed();
            const i = lessons.findIndex((l: any) => l.id === current.id);
            setLessonId(lessons[i + 1]?.id ?? current.id);
        } catch (e) {
            setError(learningError(e));
        }
    };
    const start = async (a: any) => {
        setError("");
        try {
            const value = await learningClient.startAttempt(
                data.assignment.id,
                a.id,
            );
            setAssessment(a);
            setAttempt(value);
            setAnswers({});
            setResult(null);
        } catch (e) {
            setError(learningError(e));
        }
    };
    const submit = async () => {
        try {
            const responses = (attempt.question_snapshot ?? []).map(
                (q: any) => ({
                    questionId: q.id,
                    optionIds: answers[q.id] ?? [],
                }),
            );
            setResult(
                await learningClient.submitAttempt(attempt.id, responses),
            );
            await changed();
        } catch (e) {
            setError(learningError(e));
        }
    };
    useEffect(() => {
        if (!attempt?.id || result || !Object.keys(answers).length) return;
        const timer = window.setTimeout(() => {
            const responses = (attempt.question_snapshot ?? []).map(
                (question: any) => ({
                    questionId: question.id,
                    optionIds: answers[question.id] ?? [],
                }),
            );
            void learningClient
                .saveResponses(attempt.id, responses)
                .catch((value) => setError(learningError(value)));
        }, 700);
        return () => window.clearTimeout(timer);
    }, [answers, attempt, result]);
    const requiredLessonsComplete = lessons
        .filter((lesson: any) => lesson.is_required)
        .every((lesson: any) => isDone(lesson.id));
    return (
        <AppDrawer
            show={Boolean(data)}
            title={data?.course?.title ?? "Course Player"}
            description={
                data
                    ? `${data.course.status} · official v${data.course.version_number} · ${data.assignment.is_mandatory ? "Required" : "Optional"} · due ${date(data.assignment.due_at)}`
                    : ""
            }
            onClose={close}
            eyebrow="Learner LMS Course Player"
            blocked={Boolean(attempt)}
            footer={
                <div className="flex w-full items-center justify-between gap-2">
                    <button
                        className={btn}
                        disabled={!current || lessons.indexOf(current) === 0}
                        onClick={() =>
                            setLessonId(
                                lessons[lessons.indexOf(current) - 1]?.id,
                            )
                        }
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </button>
                    <button
                        className={primary}
                        disabled={
                            !current ||
                            isDone(current?.id) ||
                            data?.assignment?.status === "Completed"
                        }
                        onClick={complete}
                    >
                        {isDone(current?.id) ? "Completed" : "Mark Complete"}
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            }
        >
            <div className="mb-4 flex items-center gap-3">
                <button
                    className={`${btn} md:hidden`}
                    onClick={() => setOutline(true)}
                >
                    <Menu className="h-4 w-4" />
                    Curriculum
                </button>
                <div className="flex-1">
                    <ProgressBar
                        value={data?.assignment?.progress_percent ?? 0}
                    />
                </div>
            </div>
            {error && (
                <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                    {error}
                </p>
            )}
            <div className="grid min-h-[520px] gap-4 md:grid-cols-[260px_1fr]">
                <aside className="hidden rounded-lg border border-slate-200 bg-white md:block">
                    <Outline
                        modules={data?.modules ?? []}
                        selected={current?.id}
                        choose={setLessonId}
                        done={isDone}
                    />
                </aside>
                <main className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
                    {current ? (
                        <>
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                {current.moduleTitle} ·{" "}
                                {current.is_required ? "Required" : "Optional"}
                            </p>
                            <h3 className="mt-2 text-xl font-extrabold text-slate-950">
                                {current.title}
                            </h3>
                            <p className="mt-2 text-sm text-slate-600">
                                {current.objective}
                            </p>
                            <div className="mt-5 max-w-none whitespace-pre-wrap text-sm leading-7 text-slate-800">
                                {current.text_content ||
                                    current.description ||
                                    "Open the protected lesson material below."}
                            </div>
                            {current.external_url && (
                                <a
                                    className={`${primary} mt-5`}
                                    href={current.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open secure external resource
                                </a>
                            )}
                            {current.materials?.map((m: any) => (
                                <div
                                    key={m.id}
                                    className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 text-sm"
                                >
                                    <div>
                                        <b>{m.display_name}</b>
                                        <p className="text-slate-500">
                                            {m.mime_type} ·{" "}
                                            {Math.ceil(m.size_bytes / 1024)} KB
                                        </p>
                                    </div>
                                    <a className={btn} href={m.download_url}>
                                        <Download className="h-4 w-4" />
                                        Open material
                                    </a>
                                </div>
                            ))}
                        </>
                    ) : (
                        <Empty
                            title="Choose a lesson"
                            text="Select a lesson from the curriculum."
                        />
                    )}
                    <div className="mt-8 border-t border-slate-200 pt-5">
                        <h4 className="text-sm font-bold">Assessments</h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {data?.course?.assessments?.map((a: any) => (
                                <button
                                    className={btn}
                                    key={a.id}
                                    disabled={
                                        data?.assignment?.status ===
                                            "Completed" ||
                                        (a.assessment_type ===
                                            "Final Assessment" &&
                                            !requiredLessonsComplete)
                                    }
                                    onClick={() => start(a)}
                                    title={
                                        a.assessment_type ===
                                            "Final Assessment" &&
                                        !requiredLessonsComplete
                                            ? "Complete required lessons first"
                                            : undefined
                                    }
                                >
                                    <ClipboardCheck className="h-4 w-4" />
                                    {a.title}
                                </button>
                            ))}
                        </div>
                        {data?.attempts?.length > 0 && (
                            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full min-w-[520px] text-sm">
                                    <thead className="bg-slate-50 text-left">
                                        <tr>
                                            <th className="px-3 py-2">
                                                Attempt
                                            </th>
                                            <th className="px-3 py-2">
                                                Status
                                            </th>
                                            <th className="px-3 py-2">Score</th>
                                            <th className="px-3 py-2">
                                                Result
                                            </th>
                                            <th className="px-3 py-2">
                                                Submitted
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {data.attempts.map((value: any) => (
                                            <tr key={value.id}>
                                                <td className="px-3 py-2">
                                                    {value.attempt_number}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {value.status}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {value.score_percent ?? "—"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {value.passed === null
                                                        ? "Pending"
                                                        : value.passed
                                                          ? "Passed"
                                                          : "Not passed"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {date(value.submitted_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            <AppDrawer
                show={outline}
                title="Course curriculum"
                onClose={() => setOutline(false)}
                eyebrow="Course outline"
            >
                <Outline
                    modules={data?.modules ?? []}
                    selected={current?.id}
                    choose={(id: string) => {
                        setLessonId(id);
                        setOutline(false);
                    }}
                    done={isDone}
                />
            </AppDrawer>
            <AppModal
                show={Boolean(attempt)}
                title={assessment?.title ?? "Assessment"}
                description={`Attempt ${attempt?.attempt_number ?? ""} · submitted attempts become immutable`}
                onClose={() => {
                    setAttempt(null);
                    setAssessment(null);
                }}
                maxWidth="2xl"
                footer={
                    result ? (
                        <button
                            className={primary}
                            onClick={() => {
                                setAttempt(null);
                                setAssessment(null);
                                setResult(null);
                            }}
                        >
                            Return to course
                        </button>
                    ) : (
                        <button className={primary} onClick={submit}>
                            Submit immutable attempt
                        </button>
                    )
                }
            >
                {result ? (
                    <div
                        className={`rounded-xl p-6 text-center ${result.passed ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
                    >
                        <CheckCircle2 className="mx-auto h-10 w-10" />
                        <p className="mt-3 text-3xl font-extrabold">
                            {result.score}%
                        </p>
                        <p className="mt-1 text-sm font-bold">
                            {result.passed ? "Passed" : "Not passed"} · Attempt{" "}
                            {result.attemptNumber}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {attempt?.question_snapshot?.map(
                            (q: any, index: number) => (
                                <fieldset
                                    key={q.id}
                                    className="rounded-lg border border-slate-200 p-4"
                                >
                                    <legend className="px-2 text-sm font-bold">
                                        {index + 1}. {q.text} ({q.points} point
                                        {q.points === 1 ? "" : "s"})
                                    </legend>
                                    <div className="mt-3 space-y-2">
                                        {q.options.map((o: any) => (
                                            <label
                                                key={o.id}
                                                className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm"
                                            >
                                                <input
                                                    type={
                                                        q.type ===
                                                        "Multiple Response"
                                                            ? "checkbox"
                                                            : "radio"
                                                    }
                                                    name={q.id}
                                                    checked={(
                                                        answers[q.id] ?? []
                                                    ).includes(o.id)}
                                                    onChange={(e) =>
                                                        setAnswers(
                                                            (current) => {
                                                                const existing =
                                                                    current[
                                                                        q.id
                                                                    ] ?? [];
                                                                return {
                                                                    ...current,
                                                                    [q.id]:
                                                                        q.type ===
                                                                        "Multiple Response"
                                                                            ? e
                                                                                  .target
                                                                                  .checked
                                                                                ? [
                                                                                      ...existing,
                                                                                      o.id,
                                                                                  ]
                                                                                : existing.filter(
                                                                                      (
                                                                                          id,
                                                                                      ) =>
                                                                                          id !==
                                                                                          o.id,
                                                                                  )
                                                                            : [
                                                                                  o.id,
                                                                              ],
                                                                };
                                                            },
                                                        )
                                                    }
                                                />
                                                {o.text}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            ),
                        )}
                    </div>
                )}
            </AppModal>
        </AppDrawer>
    );
}
function Outline({ modules, selected, choose, done }: any) {
    return (
        <div className="divide-y divide-slate-200">
            {modules.map((m: any) => (
                <section key={m.id}>
                    <h3 className="bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                        {m.title}
                    </h3>
                    {m.lessons.map((l: any) => (
                        <button
                            key={l.id}
                            onClick={() => choose(l.id)}
                            aria-current={selected === l.id}
                            className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm ${selected === l.id ? "bg-amber-50 font-bold text-slate-950" : "text-slate-600 hover:bg-slate-50"}`}
                        >
                            {done(l.id) ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                                <BookOpen className="h-4 w-4" />
                            )}
                            <span className="flex-1">{l.title}</span>
                            {l.is_required && <Lock className="h-3 w-3" />}
                        </button>
                    ))}
                </section>
            ))}
        </div>
    );
}
function Table({ heads, rows }: any) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
                <Empty
                    title="No records"
                    text="Records will appear when the workflow produces them."
                />
            )}
        </div>
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
