import { AppModal, Field } from "@/Components/Competency/CompetencyUI";
import {
    BUILDER_STAGES,
    applyAcceptedAiDraft,
    assessmentErrors,
    canonicalAudiencePersonTypes,
    courseDetailIssues,
    draftErrors,
    normalizeAudiencePersonTypes,
    stepState,
    type AssessmentDraft,
    type CourseDraft,
    type LearningState,
    type ModuleDraft,
    type QuestionDraft,
} from "@/data/learning";
import { learningClient, learningError } from "@/data/learningClient";
import {
    AlertCircle,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Check,
    CheckCircle2,
    Plus,
    Save,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const input =
    "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#F4B400] focus:ring-2 focus:ring-[#F4B400]/25";
const textarea = `${input} h-auto min-h-24 py-2`;
const button =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} border-[#F4B400] bg-[#F4B400] text-slate-950 hover:bg-amber-400`;
const newModule = (): ModuleDraft => ({
    clientId: crypto.randomUUID(),
    title: "",
    description: "",
    lessons: [],
});
const newLesson = () => ({
    title: "",
    objective: "",
    description: "",
    contentType: "Text/Reading" as const,
    textContent: "",
    externalUrl: "",
    estimatedMinutes: 10,
    required: true,
});
const newQuestion = (): QuestionDraft => ({
    type: "Multiple Choice",
    text: "",
    explanation: "",
    points: 1,
    options: [
        { text: "", correct: true },
        { text: "", correct: false },
    ],
});
const newAssessment = (): AssessmentDraft => ({
    type: "Knowledge Check",
    title: "Knowledge Check",
    required: true,
    passingScore: 80,
    attemptsAllowed: 3,
    shuffleQuestions: false,
    shuffleOptions: false,
    feedbackPolicy: "After submission",
    questions: [newQuestion()],
});

type Props = {
    initialDraft: CourseDraft;
    state: LearningState;
    onExit: () => void;
    onState: (state: LearningState) => void;
};

export default function CourseBuilder({
    initialDraft,
    state,
    onExit,
    onState,
}: Props) {
    const availablePersonTypes = useMemo(
        () => canonicalAudiencePersonTypes(state.personnel),
        [state.personnel],
    );
    const [draft, setDraft] = useState<CourseDraft>(() => {
        const clone = structuredClone(initialDraft);
        clone.audience.personTypes = normalizeAudiencePersonTypes(
            clone.audience.personTypes,
            canonicalAudiencePersonTypes(state.personnel),
        ).values;
        return clone;
    });
    const [stage, setStage] = useState(0);
    const [stageDirection, setStageDirection] = useState<
        "forward" | "backward"
    >("forward");
    const [saveStatus, setSaveStatus] = useState<
        "Saved" | "Saving" | "Failed" | "Unsaved"
    >("Saved");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmExit, setConfirmExit] = useState(false);
    const [reviewComment, setReviewComment] = useState("");
    const [ai, setAi] = useState<any>(null);
    const dirty = useRef(false);
    const revision = useRef(0);
    const saving = useRef(false);
    const queuedSave = useRef(false);
    const activeSave = useRef<Promise<boolean> | null>(null);
    const draftRef = useRef(draft);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const errors = useMemo(() => draftErrors(draft), [draft]);
    const detailIssues = useMemo(() => courseDetailIssues(draft), [draft]);
    const invalidAudiencePersonTypes = useMemo(
        () =>
            draft.audience.personTypes.filter(
                (value) => !availablePersonTypes.includes(value),
            ),
        [availablePersonTypes, draft.audience.personTypes],
    );
    const stageIssues = useMemo(() => {
        const details = Object.values(detailIssues);
        const audience = [
            !availablePersonTypes.length
                ? "Canonical personnel Person Types are unavailable. Add or activate personnel in User Management, then refresh Learning."
                : "",
            availablePersonTypes.length && !draft.audience.personTypes.length
                ? "Select a canonical person type."
                : "",
            invalidAudiencePersonTypes.length
                ? `Unsupported Person Type: ${invalidAudiencePersonTypes.join(", ")}. Select values provided by canonical personnel.`
                : "",
            draft.audience.allDepartments && draft.audience.departments.length
                ? "All Departments cannot be combined with department selections."
                : "",
        ].filter(Boolean);
        const governance = [
            !draft.reviewerIds.length ? "Assign an authorized reviewer." : "",
            !draft.publisherId ? "Assign an authorized publisher." : "",
            draft.category === "Safety & Compliance" &&
            draft.reviewerIds.some(
                (id) =>
                    draft.authorIds.includes(id) ||
                    id === draft.ownerId ||
                    id === draft.publisherId,
            )
                ? "Select an independent Safety reviewer."
                : "",
        ].filter(Boolean);
        const curriculum = draft.modules.length
            ? draft.modules
                  .flatMap((module) => [
                      !module.title.trim() ? "Every module needs a title." : "",
                      !module.lessons.length
                          ? `Module “${module.title || "Untitled"}” needs at least one lesson.`
                          : "",
                      ...module.lessons.flatMap((lesson) => [
                          !lesson.title.trim()
                              ? "Every lesson needs a title."
                              : "",
                          lesson.objective.trim().length < 8
                              ? "Every lesson needs a meaningful objective."
                              : "",
                      ]),
                  ])
                  .filter(Boolean)
            : ["Add at least one module."];
        const assessment = [
            ...draft.assessments.flatMap((value) => assessmentErrors(value)),
            ...(draft.assessments.filter(
                (value) => value.type === "Final Assessment",
            ).length > 1
                ? ["Only one Final Assessment is allowed."]
                : []),
            ...draft.assessments
                .filter(
                    (value) =>
                        value.type === "Knowledge Check" &&
                        !value.moduleClientId,
                )
                .map(
                    (value) =>
                        `Knowledge Check “${value.title}” must be linked to a module.`,
                ),
        ];
        return [
            details,
            audience,
            [],
            governance,
            curriculum,
            assessment,
            errors,
        ];
    }, [
        availablePersonTypes,
        detailIssues,
        draft,
        errors,
        invalidAudiencePersonTypes,
    ]);
    const departments = useMemo(
        () =>
            [
                ...new Set(
                    state.personnel
                        .map((item) => item.department)
                        .filter(Boolean),
                ),
            ].sort(),
        [state.personnel],
    );
    const positions = useMemo(
        () =>
            [
                ...new Set(
                    state.personnel
                        .filter(
                            (item) =>
                                draft.audience.allDepartments ||
                                draft.audience.departments.includes(
                                    item.department,
                                ),
                        )
                        .map((item) => item.position)
                        .filter(Boolean),
                ),
            ].sort(),
        [state.personnel, draft.audience],
    );
    const goToStage = (nextStage: number) => {
        const boundedStage = Math.max(
            0,
            Math.min(BUILDER_STAGES.length - 1, nextStage),
        );
        if (boundedStage === stage) return;
        setStageDirection(boundedStage > stage ? "forward" : "backward");
        setStage(boundedStage);
    };
    const update = (patch: Partial<CourseDraft>) => {
        dirty.current = true;
        revision.current += 1;
        setSaveStatus("Unsaved");
        setDraft((current) => {
            const next = { ...current, ...patch };
            draftRef.current = next;
            return next;
        });
    };

    useEffect(() => {
        draftRef.current = draft;
    }, [draft]);

    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (dirty.current) event.preventDefault();
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, []);
    useEffect(() => {
        if (
            !dirty.current ||
            !["Draft", "Changes Requested", undefined].includes(draft.status)
        )
            return;
        const timer = window.setTimeout(() => void save(true), 1500);
        return () => window.clearTimeout(timer);
    }, [draft]);

    function save(silent = false): Promise<boolean> {
        if (activeSave.current) {
            queuedSave.current = true;
            return activeSave.current;
        }
        const operation = drainSave(silent).finally(() => {
            activeSave.current = null;
        });
        activeSave.current = operation;
        return operation;
    }

    async function drainSave(silent = false): Promise<boolean> {
        saving.current = true;
        if (!silent) setBusy(true);
        setSaveStatus("Saving");
        if (!silent) setMessage("");
        try {
            do {
                queuedSave.current = false;
                const savingRevision = revision.current;
                const payload = structuredClone(draftRef.current);
                let next: LearningState;
                let ids: { versionId: string; courseId: string } | null = null;
                if (payload.id)
                    next = await learningClient.save(payload.id, payload);
                else {
                    ids = await learningClient.create(payload);
                    next = await learningClient.state();
                }
                onState(next);
                const persisted = next.courses.find(
                    (row) => row.id === (ids?.courseId ?? payload.courseId),
                )?.draftDetail;
                if (ids) {
                    const current = draftRef.current;
                    const value = {
                        ...current,
                        ...(revision.current === savingRevision && persisted
                            ? structuredClone(persisted)
                            : {}),
                        id: ids!.versionId,
                        courseId: ids!.courseId,
                        status: "Draft" as const,
                    };
                    draftRef.current = value;
                    setDraft(value);
                }
                const stale =
                    revision.current !== savingRevision || queuedSave.current;
                if (stale) {
                    dirty.current = true;
                    setSaveStatus("Saving");
                    continue;
                }
                if (persisted) {
                    const clone = structuredClone(persisted);
                    draftRef.current = clone;
                    setDraft(clone);
                }
                dirty.current = false;
                setSaveStatus("Saved");
                setLastSavedAt(new Date());
                break;
            } while (true);
            if (!silent) setMessage("Draft saved to Laravel persistence.");
            return true;
        } catch (error) {
            setSaveStatus("Failed");
            setMessage(learningError(error));
            return false;
        } finally {
            saving.current = false;
            if (!silent) setBusy(false);
        }
    }
    async function workflow(
        action: "review" | "approve" | "changes" | "publish",
    ) {
        if ((!draft.id || dirty.current) && !(await save(false))) return;
        setBusy(true);
        setMessage("");
        try {
            const next =
                action === "review"
                    ? await learningClient.submitReview(
                          draft.id!,
                          draft.reviewerIds[0],
                      )
                    : action === "approve"
                      ? await learningClient.decideReview(
                            draft.id!,
                            "Approved",
                            reviewComment,
                        )
                      : action === "changes"
                        ? await learningClient.decideReview(
                              draft.id!,
                              "Changes Requested",
                              reviewComment,
                          )
                        : await learningClient.publish(draft.id!);
            onState(next);
            setDraft((current) => ({
                ...current,
                status:
                    action === "review"
                        ? "In Review"
                        : action === "approve"
                          ? "Approved"
                          : action === "changes"
                            ? "Changes Requested"
                            : "Published",
            }));
            setMessage("Course lifecycle updated.");
        } catch (error) {
            setMessage(learningError(error));
        } finally {
            setBusy(false);
        }
    }
    async function aiDraft() {
        if (!draft.id) {
            setMessage("Save the Draft before using Groq AI assistance.");
            return;
        }
        setBusy(true);
        setMessage("");
        try {
            setAi(
                await learningClient.aiGenerate(
                    draft.id,
                    stage === 4 ? "Course Outline" : "Learning Objectives",
                    {
                        title: draft.title,
                        objectives: draft.learningObjectives,
                        modules: draft.modules.map((item) => ({
                            title: item.title,
                            lessons: item.lessons.map((lesson) => lesson.title),
                        })),
                    },
                ),
            );
        } catch (error) {
            setMessage(learningError(error));
        } finally {
            setBusy(false);
        }
    }
    async function uploadThumbnail(file: File) {
        if (!draft.id) {
            setMessage("Save the Draft before uploading its thumbnail.");
            return;
        }
        setBusy(true);
        setMessage("");
        try {
            const result = await learningClient.uploadThumbnail(draft.id, file);
            setDraft((current) => {
                const next = { ...current, thumbnailUrl: result.thumbnailUrl };
                draftRef.current = next;
                return next;
            });
            setMessage("Thumbnail stored in protected Laravel storage.");
        } catch (error) {
            setMessage(learningError(error));
        } finally {
            setBusy(false);
        }
    }
    async function decideAi(decision: "Accepted" | "Rejected") {
        try {
            await learningClient.aiDecide(
                ai.eventId,
                decision,
                decision === "Accepted" ? ai.draft : undefined,
            );
            if (decision === "Accepted") {
                const useCase =
                    stage === 4 ? "Course Outline" : "Learning Objectives";
                const accepted = applyAcceptedAiDraft(
                    draftRef.current,
                    useCase,
                    ai.draft,
                );
                revision.current += 1;
                dirty.current = true;
                draftRef.current = accepted;
                setDraft(accepted);
                setSaveStatus("Unsaved");
            }
            setMessage(
                decision === "Accepted"
                    ? "AI Draft accepted into editable course fields. Review and save the changes."
                    : "AI Draft rejected. Existing human content was preserved.",
            );
            setAi(null);
        } catch (error) {
            setMessage(learningError(error));
        }
    }
    async function material(lessonId: string, file?: File, revokeId?: string) {
        setBusy(true);
        setMessage("");
        try {
            if (file) await learningClient.uploadMaterial(lessonId, file);
            if (revokeId) await learningClient.revokeMaterial(revokeId);
            const next = await learningClient.state();
            onState(next);
            const persisted = next.courses.find(
                (row) => row.id === draft.courseId,
            )?.draftDetail;
            if (persisted) setDraft(structuredClone(persisted));
            setMessage(
                file
                    ? "Protected material uploaded."
                    : "Material revoked; historical Published references remain unchanged.",
            );
        } catch (error) {
            setMessage(learningError(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="-m-4 min-h-[calc(100dvh-7rem)] min-w-0 overflow-x-hidden bg-[#f3f6fa] sm:-m-5">
            <div className="relative z-10 border-b border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
                                Course Builder
                            </p>
                            <h1 className="truncate text-lg font-extrabold text-slate-950">
                                {draft.title || "New course draft"}
                            </h1>
                            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                {draft.code && <span>{draft.code}</span>}
                                {draft.code && <span aria-hidden>·</span>}
                                <span>{draft.status ?? "Draft"}</span>
                                <span aria-hidden>·</span>
                                <span
                                    className={`font-semibold ${saveStatus === "Failed" ? "text-rose-700" : saveStatus === "Saved" ? "text-emerald-700" : "text-amber-700"}`}
                                >
                                    {saveStatus}
                                </span>
                                {lastSavedAt && saveStatus === "Saved" && (
                                    <span>
                                        at{" "}
                                        {lastSavedAt.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            className={button}
                            onClick={aiDraft}
                            disabled={busy}
                        >
                            <Sparkles className="h-4 w-4" />
                            Groq AI Draft
                        </button>
                        <button
                            className={button}
                            onClick={() => void save(false)}
                            disabled={busy}
                        >
                            <Save className="h-4 w-4" />
                            Save Draft
                        </button>
                        <button
                            className={button}
                            onClick={() =>
                                dirty.current ? setConfirmExit(true) : onExit()
                            }
                        >
                            <X className="h-4 w-4" />
                            Exit
                        </button>
                    </div>
                </div>
                <div
                    className="learning-stepper-scroll hidden overflow-x-auto border-t border-slate-100 px-4 pb-4 pt-3 md:block"
                    aria-label="Course builder progress"
                >
                    <ol className="mx-auto flex min-w-[940px] max-w-[1400px] items-start px-3">
                        {BUILDER_STAGES.map((label, index) => {
                            const status = stepState(index, stage);
                            return (
                                <li
                                    key={label}
                                    className="relative flex min-w-0 flex-1 flex-col items-center text-center"
                                >
                                    {index > 0 && (
                                        <span
                                            aria-hidden
                                            className="absolute right-1/2 top-[1.15rem] h-[3px] w-full overflow-hidden bg-slate-200"
                                        >
                                            <span
                                                className={`block h-full origin-left bg-gradient-to-r from-emerald-500 to-[#F4B400] transition-transform duration-500 ease-out ${index <= stage ? "scale-x-100" : "scale-x-0"}`}
                                            />
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            index <= stage && goToStage(index)
                                        }
                                        disabled={index > stage}
                                        aria-current={
                                            status === "current"
                                                ? "step"
                                                : undefined
                                        }
                                        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-extrabold shadow-sm transition-[transform,box-shadow,background-color,border-color] duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 ${status === "completed" ? "learning-step-complete border-emerald-600 bg-emerald-600 text-white hover:scale-105 hover:bg-emerald-700" : status === "current" ? "learning-step-active border-[#F4B400] bg-[#F4B400] text-slate-950 shadow-amber-200 ring-4 ring-amber-100" : "border-slate-300 bg-white text-slate-500"}`}
                                    >
                                        {status === "completed" ? (
                                            <>
                                                <span className="sr-only">
                                                    {index + 1}
                                                </span>
                                                <Check
                                                    aria-hidden
                                                    className="h-4 w-4"
                                                />
                                            </>
                                        ) : (
                                            index + 1
                                        )}
                                    </button>
                                    {stageIssues[index].length > 0 && (
                                        <span
                                            className="absolute left-[calc(50%+0.7rem)] top-0 z-20 h-2.5 w-2.5 rounded-full bg-rose-600 shadow-sm ring-2 ring-white"
                                            aria-label={`${stageIssues[index].length} validation issue(s)`}
                                        />
                                    )}
                                    <span
                                        className={`mt-2.5 px-2 text-xs font-semibold transition-colors duration-300 ${status === "current" ? "text-slate-950" : status === "completed" ? "text-emerald-700" : "text-slate-500"}`}
                                    >
                                        {label}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </div>
                <div className="border-t border-slate-100 px-4 pb-3 pt-3 md:hidden">
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-bold text-slate-900">
                            <span className="learning-step-active flex h-7 w-7 items-center justify-center rounded-full bg-[#F4B400] text-xs text-slate-950 ring-4 ring-amber-100">
                                {stage + 1}
                            </span>
                            {BUILDER_STAGES[stage]}
                        </span>
                        <span className="text-slate-500">{stage + 1} of 7</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#F4B400] transition-[width] duration-500 ease-out"
                            style={{ width: `${((stage + 1) / 7) * 100}%` }}
                        />
                    </div>
                    <label className="mt-2 block text-xs text-slate-600">
                        Completed stage picker
                        <select
                            className={`${input} mt-1`}
                            value={stage}
                            onChange={(e) => goToStage(Number(e.target.value))}
                        >
                            {BUILDER_STAGES.map((label, index) => (
                                <option
                                    key={label}
                                    value={index}
                                    disabled={index > stage}
                                >
                                    {index + 1}. {label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
            <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6">
                {message && (
                    <div
                        role="status"
                        className={`learning-status-enter relative z-10 mb-4 flex items-start gap-2 rounded-xl border p-3.5 text-sm shadow-sm ${saveStatus === "Failed" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-slate-800"}`}
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {message}
                        {saveStatus === "Failed" && (
                            <button
                                className="ml-auto font-bold underline"
                                onClick={() => void save(false)}
                            >
                                Retry save
                            </button>
                        )}
                    </div>
                )}
                <section
                    id="learning-builder-stage-panel"
                    className="scroll-mt-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.02]"
                >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-white via-white to-amber-50/60 px-5 py-4 sm:px-6">
                        <div>
                            <h2 className="text-base font-bold text-slate-950">
                                {BUILDER_STAGES[stage]}
                            </h2>
                            <p className="mt-0.5 text-sm text-slate-500">
                                Complete the required fields, then save and
                                continue.
                            </p>
                        </div>
                        {stageIssues[stage].length > 0 && stage !== 6 && (
                            <p
                                role="status"
                                className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200"
                            >
                                {stageIssues[stage].length} item(s) must be
                                completed before continuing.
                            </p>
                        )}
                    </div>
                    <div
                        key={`${stage}-${stageDirection}`}
                        data-testid="learning-stage-content"
                        className={`learning-stage-panel learning-stage-panel--${stageDirection} p-5 sm:p-6`}
                    >
                        {stage === 0 && (
                            <Details
                                draft={draft}
                                update={update}
                                personnel={state.personnel}
                                issues={detailIssues}
                                busy={busy}
                                uploadThumbnail={uploadThumbnail}
                            />
                        )}{" "}
                        {stage === 1 && (
                            <Audience
                                draft={draft}
                                update={update}
                                personTypes={availablePersonTypes}
                                invalidPersonTypes={
                                    invalidAudiencePersonTypes
                                }
                                departments={departments}
                                positions={positions}
                                roleProfiles={state.roleProfiles}
                            />
                        )}{" "}
                        {stage === 2 && (
                            <Competency
                                draft={draft}
                                update={update}
                                catalog={state.competencyCatalog}
                            />
                        )}{" "}
                        {stage === 3 && (
                            <Governance
                                draft={draft}
                                update={update}
                                governanceActors={state.governanceActors}
                            />
                        )}{" "}
                        {stage === 4 && (
                            <Curriculum
                                draft={draft}
                                update={update}
                                material={material}
                                busy={busy}
                            />
                        )}{" "}
                        {stage === 5 && (
                            <Assessment draft={draft} update={update} />
                        )}{" "}
                        {stage === 6 && (
                            <Review
                                draft={draft}
                                errors={errors}
                                state={state}
                                comment={reviewComment}
                                setComment={setReviewComment}
                                workflow={workflow}
                                busy={busy}
                            />
                        )}
                    </div>
                </section>
                {stage !== 6 && (
                    <div className="sticky bottom-3 z-10 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_12px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:px-4">
                        <button
                            className={button}
                            disabled={stage === 0}
                            onClick={() => goToStage(stage - 1)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Previous
                        </button>
                        <button
                            className={primary}
                            disabled={busy || stageIssues[stage].length > 0}
                            onClick={async () => {
                                if (await save(false))
                                    goToStage(stage + 1);
                            }}
                        >
                            Continue
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </main>
            <AppModal
                show={confirmExit}
                title="Exit Course Builder?"
                description="Unsaved changes will be lost."
                onClose={() => setConfirmExit(false)}
                footer={
                    <>
                        <button
                            className={button}
                            onClick={() => setConfirmExit(false)}
                        >
                            Keep editing
                        </button>
                        <button className={primary} onClick={onExit}>
                            Exit without saving
                        </button>
                    </>
                }
            >
                <p className="text-sm text-slate-600">
                    Save the Draft if you want the latest changes to survive a
                    reload.
                </p>
            </AppModal>
            <AppModal
                show={Boolean(ai)}
                title="AI Draft — human review required"
                description="Groq output is never applied, published, assigned, graded, or competency-changing automatically."
                onClose={() => setAi(null)}
                footer={
                    <>
                        <button
                            className={button}
                            onClick={() => decideAi("Rejected")}
                        >
                            Reject
                        </button>
                        <button
                            className={primary}
                            onClick={() => decideAi("Accepted")}
                        >
                            Accept as editable draft
                        </button>
                    </>
                }
            >
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm text-slate-100">
                    {ai ? JSON.stringify(ai.draft, null, 2) : ""}
                </pre>
            </AppModal>
        </div>
    );
}

function Details({
    draft,
    update,
    personnel,
    issues,
    busy,
    uploadThumbnail,
}: any) {
    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Course Code">
                <input
                    className={input}
                    readOnly
                    value={
                        draft.code
                            ? draft.code
                            : draft.courseId
                              ? "Generated and retained by Laravel"
                            : "Generated on first save"
                    }
                />
            </Field>
            <Field label="Course Title" required error={issues.title}>
                <input
                    className={input}
                    aria-invalid={Boolean(issues.title)}
                    value={draft.title}
                    onChange={(e) => update({ title: e.target.value })}
                />
            </Field>
            <div className="lg:col-span-2">
                <Field label="Description" required error={issues.description}>
                    <textarea
                        className={textarea}
                        aria-invalid={Boolean(issues.description)}
                        value={draft.description}
                        onChange={(e) =>
                            update({ description: e.target.value })
                        }
                    />
                </Field>
            </div>
            <Field label="Category" required>
                <select
                    className={input}
                    value={draft.category}
                    onChange={(e) => update({ category: e.target.value })}
                >
                    {[
                        "General",
                        "Operations",
                        "Finance",
                        "Leadership",
                        "Technical Skills",
                        "Behavioral Skills",
                        "Safety & Compliance",
                    ].map((v) => (
                        <option key={v}>{v}</option>
                    ))}
                </select>
            </Field>
            <Field label="Difficulty" required>
                <select
                    className={input}
                    value={draft.difficulty}
                    onChange={(e) => update({ difficulty: e.target.value })}
                >
                    {["Beginner", "Intermediate", "Advanced"].map((v) => (
                        <option key={v}>{v}</option>
                    ))}
                </select>
            </Field>
            <Field label="Language" required>
                <input
                    className={input}
                    value={draft.language}
                    onChange={(e) => update({ language: e.target.value })}
                />
            </Field>
            <Field
                label="Instructor / Subject Matter Expert"
                hint="Optional. Select an eligible active employee when one is designated."
            >
                <select
                    className={input}
                    value={draft.subjectMatterExpertId ?? ""}
                    onChange={(e) =>
                        update({
                            subjectMatterExpertId:
                                Number(e.target.value) || null,
                        })
                    }
                >
                    <option value="">Not selected</option>
                    {personnel.map((person: any) => (
                        <option key={person.id} value={person.id}>
                            {person.name} · {person.position} · {person.department}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Course thumbnail">
                <div className="flex min-h-24 items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3">
                    {draft.thumbnailUrl ? (
                        <img
                            src={draft.thumbnailUrl}
                            alt="Current course thumbnail"
                            className="h-20 w-32 rounded-md object-cover"
                        />
                    ) : (
                        <div className="flex h-20 w-32 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">
                            No thumbnail
                        </div>
                    )}
                    <label className={`${button} cursor-pointer`}>
                        {draft.thumbnailUrl ? "Replace image" : "Upload image"}
                        <input
                            className="sr-only"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={busy}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadThumbnail(file);
                                event.currentTarget.value = "";
                            }}
                        />
                    </label>
                </div>
            </Field>
            <Field label="Authorized duration override (minutes)">
                <input
                    type="number"
                    className={input}
                    value={draft.durationOverrideMinutes ?? ""}
                    onChange={(e) =>
                        update({
                            durationOverrideMinutes: e.target.value
                                ? Number(e.target.value)
                                : null,
                        })
                    }
                />
            </Field>
            <div className="lg:col-span-2">
                <Field
                    label="Learning Objectives"
                    required
                    error={issues.learningObjectives}
                >
                    <div className="space-y-2">
                        {draft.learningObjectives.map(
                            (value: string, index: number) => (
                                <div className="flex gap-2" key={index}>
                                    <input
                                        className={input}
                                        aria-invalid={Boolean(
                                            issues.learningObjectives,
                                        )}
                                        value={value}
                                        onChange={(e) => {
                                            const values = [
                                                ...draft.learningObjectives,
                                            ];
                                            values[index] = e.target.value;
                                            update({
                                                learningObjectives: values,
                                            });
                                        }}
                                    />
                                    <button
                                        aria-label="Remove objective"
                                        className={button}
                                        onClick={() =>
                                            update({
                                                learningObjectives:
                                                    draft.learningObjectives.filter(
                                                        (_: any, i: number) =>
                                                            i !== index,
                                                    ),
                                            })
                                        }
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ),
                        )}
                        <button
                            className={button}
                            onClick={() =>
                                update({
                                    learningObjectives: [
                                        ...draft.learningObjectives,
                                        "",
                                    ],
                                })
                            }
                        >
                            <Plus className="h-4 w-4" />
                            Add objective
                        </button>
                    </div>
                </Field>
            </div>
        </div>
    );
}

function Audience({
    draft,
    update,
    personTypes,
    invalidPersonTypes,
    departments,
    positions,
    roleProfiles,
}: any) {
    const audience = draft.audience;
    const set = (patch: any) => update({ audience: { ...audience, ...patch } });
    return (
        <div className="space-y-6">
            <fieldset>
                <legend className="text-sm font-bold text-slate-800">
                    Person types
                </legend>
                {personTypes.length ? (
                    <div className="mt-2 flex flex-wrap gap-3">
                        {personTypes.map((value: string) => (
                        <label
                            key={value}
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm"
                        >
                            <input
                                type="checkbox"
                                checked={audience.personTypes.includes(value)}
                                onChange={(e) =>
                                    set({
                                        personTypes: e.target.checked
                                            ? [...audience.personTypes, value]
                                            : audience.personTypes.filter(
                                                  (v: string) => v !== value,
                                              ),
                                    })
                                }
                            />
                            {value}
                        </label>
                        ))}
                    </div>
                ) : (
                    <div
                        role="alert"
                        className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                    >
                        Canonical personnel data is unavailable. Add or activate
                        personnel with a Person Type in User Management, then
                        refresh Learning.
                    </div>
                )}
                {invalidPersonTypes.length > 0 && (
                    <div
                        role="alert"
                        className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                    >
                        <span>
                            This Draft contains unsupported Person Type values:{" "}
                            {invalidPersonTypes.join(", ")}.
                        </span>
                        <button
                            type="button"
                            className="font-bold underline"
                            onClick={() =>
                                set({
                                    personTypes: audience.personTypes.filter(
                                        (value: string) =>
                                            personTypes.includes(value),
                                    ),
                                })
                            }
                        >
                            Remove unsupported values
                        </button>
                    </div>
                )}
            </fieldset>
            <div className="grid gap-5 lg:grid-cols-2">
                <Field label="Departments">
                    <label className="mb-2 flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={audience.allDepartments}
                            onChange={(e) =>
                                set({
                                    allDepartments: e.target.checked,
                                    departments: e.target.checked
                                        ? []
                                        : audience.departments,
                                })
                            }
                        />
                        All Departments
                    </label>
                    <select
                        multiple
                        disabled={audience.allDepartments}
                        className={`${input} h-36 py-2`}
                        value={audience.departments}
                        onChange={(e) =>
                            set({
                                departments: Array.from(
                                    e.target.selectedOptions,
                                ).map((o: any) => o.value),
                            })
                        }
                    >
                        {departments.map((value: string) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Positions">
                    <select
                        multiple
                        className={`${input} h-36 py-2`}
                        value={audience.positions}
                        onChange={(e) =>
                            set({
                                positions: Array.from(
                                    e.target.selectedOptions,
                                ).map((o: any) => o.value),
                            })
                        }
                    >
                        {positions.map((value: string) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Role Profiles">
                    <select
                        multiple
                        className={`${input} h-36 py-2`}
                        value={audience.roleProfileIds}
                        onChange={(e) =>
                            set({
                                roleProfileIds: Array.from(
                                    e.target.selectedOptions,
                                ).map((option: any) => option.value),
                            })
                        }
                    >
                        {roleProfiles
                            .filter(
                                (profile: any) =>
                                    audience.personTypes.includes(
                                        profile.personType,
                                    ) &&
                                    (audience.allDepartments ||
                                        audience.departments.includes(
                                            profile.department,
                                        )),
                            )
                            .map((profile: any) => (
                                <option key={profile.id} value={profile.id}>
                                    {profile.name} · canonical v
                                    {profile.version}
                                </option>
                            ))}
                    </select>
                </Field>
                <Field label="Catalog visibility">
                    <select
                        className={input}
                        value={audience.catalogVisibility}
                        onChange={(e) =>
                            set({ catalogVisibility: e.target.value })
                        }
                    >
                        {[
                            "Assigned only",
                            "Eligible users may self-enroll",
                            "Unlisted",
                        ].map((v) => (
                            <option key={v}>{v}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Default due window (days)">
                    <input
                        type="number"
                        className={input}
                        value={audience.defaultDueDays ?? ""}
                        onChange={(e) =>
                            set({
                                defaultDueDays: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                            })
                        }
                    />
                </Field>
                <Field label="Available from">
                    <input
                        type="datetime-local"
                        className={input}
                        value={audience.availableFrom ?? ""}
                        onChange={(e) =>
                            set({ availableFrom: e.target.value || null })
                        }
                    />
                </Field>
                <Field label="Available until">
                    <input
                        type="datetime-local"
                        className={input}
                        value={audience.availableUntil ?? ""}
                        onChange={(e) =>
                            set({ availableUntil: e.target.value || null })
                        }
                    />
                </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={audience.mandatoryDefault}
                    onChange={(e) =>
                        set({ mandatoryDefault: e.target.checked })
                    }
                />
                Mandatory by default
            </label>
        </div>
    );
}

function Competency({ draft, update, catalog }: any) {
    return (
        <div>
            <p className="mb-4 text-sm text-slate-600">
                General informational courses may remain unmapped.
                Recommendation-created courses retain the exact competency
                snapshot.
            </p>
            <div className="space-y-3">
                {draft.competencies.map((item: any, index: number) => (
                    <div
                        key={item.id}
                        className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_110px_1fr_auto]"
                    >
                        <select
                            className={input}
                            value={item.id}
                            aria-label="Canonical competency"
                            onChange={(e) => {
                                const selected = catalog.find(
                                    (value: any) => value.id === e.target.value,
                                );
                                if (!selected) return;
                                const list = structuredClone(
                                    draft.competencies,
                                );
                                list[index] = {
                                    ...list[index],
                                    id: selected.id,
                                    version: selected.version,
                                    code: selected.code,
                                    name: selected.name,
                                };
                                update({ competencies: list });
                            }}
                        >
                            {catalog.map((value: any) => (
                                <option key={value.id} value={value.id}>
                                    {value.code} · {value.name} · v
                                    {value.version}
                                </option>
                            ))}
                        </select>
                        <input
                            className={input}
                            type="number"
                            min={1}
                            max={5}
                            value={item.targetLevel}
                            onChange={(e) => {
                                const list = structuredClone(
                                    draft.competencies,
                                );
                                list[index].targetLevel = Number(
                                    e.target.value,
                                );
                                update({ competencies: list });
                            }}
                        />
                        <input
                            className={input}
                            value={item.purpose ?? ""}
                            placeholder="Development purpose"
                            onChange={(e) => {
                                const list = structuredClone(
                                    draft.competencies,
                                );
                                list[index].purpose = e.target.value;
                                update({ competencies: list });
                            }}
                        />
                        <button
                            className={button}
                            onClick={() =>
                                update({
                                    competencies: draft.competencies.filter(
                                        (_: any, i: number) => i !== index,
                                    ),
                                })
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                            Remove
                        </button>
                    </div>
                ))}
                <button
                    className={button}
                    disabled={
                        !catalog.length ||
                        draft.competencies.length >= catalog.length
                    }
                    onClick={() => {
                        const selected = catalog.find(
                            (value: any) =>
                                !draft.competencies.some(
                                    (item: any) => item.id === value.id,
                                ),
                        );
                        if (!selected) return;
                        update({
                            competencies: [
                                ...draft.competencies,
                                {
                                    id: selected.id,
                                    version: selected.version,
                                    code: selected.code,
                                    name: selected.name,
                                    targetLevel: 1,
                                    purpose: "Development evidence",
                                },
                            ],
                        });
                    }}
                >
                    <Plus className="h-4 w-4" />
                    Add mapping
                </button>
            </div>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <b>Boundary:</b> course completion creates supporting evidence
                only. It never changes an official competency level or closes a
                gap.
            </div>
        </div>
    );
}

function Governance({ draft, update, governanceActors }: any) {
    const owners = governanceActors.filter((person: any) => person.canOwn);
    const publishers = governanceActors.filter(
        (person: any) => person.canPublish,
    );
    const authors = governanceActors.filter((person: any) => person.canAuthor);
    const reviewers = governanceActors.filter(
        (person: any) =>
            person.canReview &&
            (draft.category !== "Safety & Compliance" ||
                (!draft.authorIds.includes(person.id) &&
                    person.id !== draft.ownerId &&
                    person.id !== draft.publisherId)),
    );
    const options = (
        ids: number[],
        label: string,
        setter: (ids: number[]) => void,
    ) => (
        <Field label={label}>
            <select
                multiple
                className={`${input} h-36 py-2`}
                value={ids.map(String)}
                onChange={(e) =>
                    setter(
                        Array.from(e.target.selectedOptions).map((o: any) =>
                            Number(o.value),
                        ),
                    )
                }
            >
                {(label === "Reviewers" ? reviewers : authors).map(
                    (person: any) => (
                        <option key={person.id} value={person.id}>
                            {person.name} — {person.position ?? person.role}
                        </option>
                    ),
                )}
            </select>
        </Field>
    );
    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Course Owner">
                <select
                    className={input}
                    value={draft.ownerId}
                    onChange={(e) =>
                        update({ ownerId: Number(e.target.value) })
                    }
                >
                    {owners.map((p: any) => (
                        <option key={p.id} value={p.id}>
                            {p.name} — {p.role}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Publisher">
                <select
                    className={input}
                    value={draft.publisherId ?? ""}
                    onChange={(e) =>
                        update({ publisherId: Number(e.target.value) || null })
                    }
                >
                    <option value="">Select publisher</option>
                    {publishers.map((p: any) => (
                        <option key={p.id} value={p.id}>
                            {p.name} — {p.role}
                        </option>
                    ))}
                </select>
            </Field>
            {options(draft.authorIds, "Authors", (ids) =>
                update({ authorIds: ids }),
            )}
            {options(draft.reviewerIds, "Reviewers", (ids) =>
                update({ reviewerIds: ids }),
            )}
            <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Admin access does not grant course authorship, review, or
                publication. Every action is enforced by course-specific Laravel
                authorization.
            </div>
        </div>
    );
}

function Curriculum({ draft, update, material, busy }: any) {
    const modules = draft.modules;
    const [pendingRemoval, setPendingRemoval] = useState<null | {
        kind: "module" | "lesson" | "material";
        moduleIndex: number;
        lessonIndex?: number;
        materialId?: string;
        lessonId?: string;
    }>(null);
    const setModules = (v: any) => update({ modules: v });
    const move = (i: number, d: number) => {
        const list = [...modules];
        const [row] = list.splice(i, 1);
        list.splice(i + d, 0, row);
        setModules(list);
    };
    const removeConfirmed = async () => {
        if (!pendingRemoval) return;
        if (pendingRemoval.kind === "material") {
            await material(
                pendingRemoval.lessonId,
                undefined,
                pendingRemoval.materialId,
            );
            setPendingRemoval(null);
            return;
        }
        const list = structuredClone(modules);
        if (pendingRemoval.kind === "module")
            list.splice(pendingRemoval.moduleIndex, 1);
        else
            list[pendingRemoval.moduleIndex].lessons.splice(
                pendingRemoval.lessonIndex!,
                1,
            );
        setModules(list);
        setPendingRemoval(null);
    };
    return (
        <div className="space-y-4">
            {modules.map((module: any, mi: number) => (
                <article
                    key={module.clientId}
                    className="rounded-xl border border-slate-200"
                >
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-4">
                        <input
                            aria-label={`Module ${mi + 1} title`}
                            className={`${input} min-w-60 flex-1`}
                            value={module.title}
                            placeholder={`Module ${mi + 1} title`}
                            onChange={(e) => {
                                const list = structuredClone(modules);
                                list[mi].title = e.target.value;
                                setModules(list);
                            }}
                        />
                        <button
                            className={button}
                            disabled={mi === 0}
                            onClick={() => move(mi, -1)}
                            aria-label="Move module up"
                        >
                            <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                            className={button}
                            disabled={mi === modules.length - 1}
                            onClick={() => move(mi, 1)}
                            aria-label="Move module down"
                        >
                            <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                            className={button}
                            onClick={() =>
                                module.lessons.length
                                    ? setPendingRemoval({
                                          kind: "module",
                                          moduleIndex: mi,
                                      })
                                    : setModules(
                                          modules.filter(
                                              (_: any, i: number) => i !== mi,
                                          ),
                                      )
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                            Remove
                        </button>
                    </div>
                    <div className="space-y-3 p-4">
                        <textarea
                            className={textarea}
                            value={module.description ?? ""}
                            placeholder="Module description"
                            onChange={(e) => {
                                const list = structuredClone(modules);
                                list[mi].description = e.target.value;
                                setModules(list);
                            }}
                        />
                        {module.lessons.map((lesson: any, li: number) => (
                            <div
                                key={lesson.id ?? li}
                                className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-2"
                            >
                                <input
                                    className={input}
                                    value={lesson.title}
                                    placeholder="Lesson title"
                                    onChange={(e) => {
                                        const list = structuredClone(modules);
                                        list[mi].lessons[li].title =
                                            e.target.value;
                                        setModules(list);
                                    }}
                                />
                                <input
                                    className={input}
                                    value={lesson.objective}
                                    placeholder="Learning objective"
                                    onChange={(e) => {
                                        const list = structuredClone(modules);
                                        list[mi].lessons[li].objective =
                                            e.target.value;
                                        setModules(list);
                                    }}
                                />
                                <select
                                    className={input}
                                    value={lesson.contentType}
                                    onChange={(e) => {
                                        const list = structuredClone(modules);
                                        list[mi].lessons[li].contentType =
                                            e.target.value;
                                        setModules(list);
                                    }}
                                >
                                    {[
                                        "Text/Reading",
                                        "Video",
                                        "PDF/Document",
                                        "Downloadable File",
                                        "External Resource",
                                    ].map((v) => (
                                        <option key={v}>{v}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    className={input}
                                    value={lesson.estimatedMinutes}
                                    onChange={(e) => {
                                        const list = structuredClone(modules);
                                        list[mi].lessons[li].estimatedMinutes =
                                            Number(e.target.value);
                                        setModules(list);
                                    }}
                                />
                                {lesson.contentType === "External Resource" ? (
                                    <input
                                        className={`${input} lg:col-span-2`}
                                        value={lesson.externalUrl ?? ""}
                                        placeholder="https://..."
                                        onChange={(e) => {
                                            const list =
                                                structuredClone(modules);
                                            list[mi].lessons[li].externalUrl =
                                                e.target.value;
                                            setModules(list);
                                        }}
                                    />
                                ) : (
                                    <textarea
                                        className={`${textarea} lg:col-span-2`}
                                        value={lesson.textContent ?? ""}
                                        placeholder="Lesson content. Protected files can be attached after the lesson is first saved."
                                        onChange={(e) => {
                                            const list =
                                                structuredClone(modules);
                                            list[mi].lessons[li].textContent =
                                                e.target.value;
                                            setModules(list);
                                        }}
                                    />
                                )}
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={lesson.required}
                                        onChange={(e) => {
                                            const list =
                                                structuredClone(modules);
                                            list[mi].lessons[li].required =
                                                e.target.checked;
                                            setModules(list);
                                        }}
                                    />
                                    Required lesson
                                </label>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                        className={button}
                                        aria-label="Move lesson up"
                                        disabled={li === 0}
                                        onClick={() => {
                                            const list =
                                                structuredClone(modules);
                                            const [row] = list[
                                                mi
                                            ].lessons.splice(li, 1);
                                            list[mi].lessons.splice(
                                                li - 1,
                                                0,
                                                row,
                                            );
                                            setModules(list);
                                        }}
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button
                                        className={button}
                                        aria-label="Move lesson down"
                                        disabled={
                                            li === module.lessons.length - 1
                                        }
                                        onClick={() => {
                                            const list =
                                                structuredClone(modules);
                                            const [row] = list[
                                                mi
                                            ].lessons.splice(li, 1);
                                            list[mi].lessons.splice(
                                                li + 1,
                                                0,
                                                row,
                                            );
                                            setModules(list);
                                        }}
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                                        Protected materials
                                    </p>
                                    <div className="mt-2 space-y-2">
                                        {lesson.materials?.map((file: any) => (
                                            <div
                                                key={file.id}
                                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm"
                                            >
                                                <span>
                                                    <b>{file.displayName}</b> ·{" "}
                                                    {Math.ceil(
                                                        file.sizeBytes / 1024,
                                                    )}{" "}
                                                    KB
                                                </span>
                                                <div className="flex gap-2">
                                                    {file.downloadUrl && (
                                                        <a
                                                            className={button}
                                                            href={
                                                                file.downloadUrl
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Preview
                                                        </a>
                                                    )}
                                                    <button
                                                        className={button}
                                                        disabled={busy}
                                                        onClick={() =>
                                                            setPendingRemoval({
                                                                kind: "material",
                                                                moduleIndex: mi,
                                                                lessonIndex: li,
                                                                materialId:
                                                                    file.id,
                                                                lessonId:
                                                                    lesson.id,
                                                            })
                                                        }
                                                    >
                                                        Revoke
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {lesson.id ? (
                                        <label
                                            className={`${button} mt-3 cursor-pointer`}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Upload material
                                            <input
                                                className="sr-only"
                                                type="file"
                                                accept=".pdf,.mp4,.webm,.txt,.csv,.docx,.pptx,.xlsx"
                                                disabled={busy}
                                                onChange={(event) => {
                                                    const file =
                                                        event.target.files?.[0];
                                                    if (file)
                                                        material(
                                                            lesson.id,
                                                            file,
                                                        );
                                                }}
                                            />
                                        </label>
                                    ) : (
                                        <p className="mt-2 text-sm text-slate-500">
                                            Save the Draft once to create this
                                            lesson before uploading a file.
                                        </p>
                                    )}
                                </div>
                                <button
                                    className={button}
                                    onClick={() => {
                                        const populated = Boolean(
                                            lesson.title ||
                                            lesson.objective ||
                                            lesson.textContent ||
                                            lesson.externalUrl ||
                                            lesson.materials?.length,
                                        );
                                        if (populated)
                                            setPendingRemoval({
                                                kind: "lesson",
                                                moduleIndex: mi,
                                                lessonIndex: li,
                                            });
                                        else {
                                            const list =
                                                structuredClone(modules);
                                            list[mi].lessons.splice(li, 1);
                                            setModules(list);
                                        }
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Remove lesson
                                </button>
                            </div>
                        ))}
                        <button
                            className={button}
                            onClick={() => {
                                const list = structuredClone(modules);
                                list[mi].lessons.push(newLesson());
                                setModules(list);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            Add lesson
                        </button>
                    </div>
                </article>
            ))}
            <button
                className={primary}
                onClick={() => setModules([...modules, newModule()])}
            >
                <Plus className="h-4 w-4" />
                Add module
            </button>
            <AppModal
                show={Boolean(pendingRemoval)}
                title={
                    pendingRemoval?.kind === "material"
                        ? "Revoke protected material?"
                        : pendingRemoval?.kind === "module"
                          ? "Remove populated module?"
                          : "Remove populated lesson?"
                }
                description="This change applies to the working Draft only. Published historical versions remain immutable."
                onClose={() => setPendingRemoval(null)}
                footer={
                    <>
                        <button
                            className={button}
                            onClick={() => setPendingRemoval(null)}
                        >
                            Keep content
                        </button>
                        <button
                            className={primary}
                            disabled={busy}
                            onClick={() => void removeConfirmed()}
                        >
                            {pendingRemoval?.kind === "material"
                                ? "Revoke material"
                                : "Remove from Draft"}
                        </button>
                    </>
                }
            >
                <p className="text-sm text-slate-600">
                    Confirm this deliberate content change. The action is
                    recorded when persisted.
                </p>
            </AppModal>
        </div>
    );
}

function Assessment({ draft, update }: any) {
    const set = (v: any) => update({ assessments: v });
    return (
        <div className="space-y-5">
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={draft.completion.completeRequiredLessons}
                        onChange={(e) =>
                            update({
                                completion: {
                                    ...draft.completion,
                                    completeRequiredLessons: e.target.checked,
                                },
                            })
                        }
                    />
                    Complete required lessons
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={draft.completion.issueCertificate}
                        onChange={(e) =>
                            update({
                                completion: {
                                    ...draft.completion,
                                    issueCertificate: e.target.checked,
                                },
                            })
                        }
                    />
                    Issue certificate
                </label>
                <Field label="Validity months">
                    <input
                        type="number"
                        className={input}
                        disabled={!draft.completion.issueCertificate}
                        value={draft.completion.certificateValidityMonths ?? ""}
                        onChange={(e) =>
                            update({
                                completion: {
                                    ...draft.completion,
                                    certificateValidityMonths: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                },
                            })
                        }
                    />
                </Field>
                <Field label="Renewal months">
                    <input
                        type="number"
                        className={input}
                        disabled={!draft.completion.issueCertificate}
                        value={draft.completion.renewalIntervalMonths ?? ""}
                        onChange={(e) =>
                            update({
                                completion: {
                                    ...draft.completion,
                                    renewalIntervalMonths: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                },
                            })
                        }
                    />
                </Field>
            </div>
            {draft.assessments.map((assessment: any, ai: number) => (
                <article
                    key={assessment.id ?? ai}
                    className="rounded-xl border border-slate-200"
                >
                    <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[1fr_180px_210px_130px_130px_auto]">
                        <input
                            className={input}
                            value={assessment.title}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].title = e.target.value;
                                set(list);
                            }}
                        />
                        <select
                            className={input}
                            value={assessment.type}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].type = e.target.value;
                                if (e.target.value === "Final Assessment")
                                    list[ai].moduleClientId = null;
                                set(list);
                            }}
                        >
                            <option>Knowledge Check</option>
                            <option>Final Assessment</option>
                        </select>
                        <select
                            aria-label="Knowledge Check module"
                            className={input}
                            disabled={assessment.type === "Final Assessment"}
                            value={assessment.moduleClientId ?? ""}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].moduleClientId =
                                    e.target.value || null;
                                set(list);
                            }}
                        >
                            <option value="">
                                {assessment.type === "Final Assessment"
                                    ? "Whole course"
                                    : "Select module"}
                            </option>
                            {draft.modules.map((module: any, index: number) => (
                                <option
                                    key={module.clientId}
                                    value={module.clientId}
                                >
                                    {module.title || `Module ${index + 1}`}
                                </option>
                            ))}
                        </select>
                        <input
                            aria-label="Passing score"
                            type="number"
                            className={input}
                            value={assessment.passingScore}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].passingScore = Number(e.target.value);
                                set(list);
                            }}
                        />
                        <input
                            aria-label="Attempts allowed"
                            type="number"
                            className={input}
                            value={assessment.attemptsAllowed}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].attemptsAllowed = Number(
                                    e.target.value,
                                );
                                set(list);
                            }}
                        />
                        <button
                            className={button}
                            onClick={() =>
                                set(
                                    draft.assessments.filter(
                                        (_: any, i: number) => i !== ai,
                                    ),
                                )
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-4 p-4">
                        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={assessment.required}
                                    onChange={(e) => {
                                        const list = structuredClone(
                                            draft.assessments,
                                        );
                                        list[ai].required = e.target.checked;
                                        set(list);
                                    }}
                                />
                                Required for completion
                            </label>
                            <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={assessment.shuffleQuestions}
                                    onChange={(e) => {
                                        const list = structuredClone(
                                            draft.assessments,
                                        );
                                        list[ai].shuffleQuestions =
                                            e.target.checked;
                                        set(list);
                                    }}
                                />
                                Shuffle questions
                            </label>
                            <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={assessment.shuffleOptions}
                                    onChange={(e) => {
                                        const list = structuredClone(
                                            draft.assessments,
                                        );
                                        list[ai].shuffleOptions =
                                            e.target.checked;
                                        set(list);
                                    }}
                                />
                                Shuffle options
                            </label>
                            <select
                                aria-label="Result feedback policy"
                                className={input}
                                value={assessment.feedbackPolicy}
                                onChange={(e) => {
                                    const list = structuredClone(
                                        draft.assessments,
                                    );
                                    list[ai].feedbackPolicy = e.target.value;
                                    set(list);
                                }}
                            >
                                <option>After submission</option>
                                <option>After final attempt</option>
                                <option>Score only</option>
                                <option>No feedback</option>
                            </select>
                        </div>
                        {assessment.questions.map(
                            (question: any, qi: number) => (
                                <div
                                    key={question.id ?? qi}
                                    className="rounded-lg border border-slate-200 p-4"
                                >
                                    <div className="grid gap-3 lg:grid-cols-[180px_1fr_100px_auto]">
                                        <select
                                            className={input}
                                            value={question.type}
                                            onChange={(e) => {
                                                const list = structuredClone(
                                                    draft.assessments,
                                                );
                                                list[ai].questions[qi].type =
                                                    e.target.value;
                                                set(list);
                                            }}
                                        >
                                            {[
                                                "Multiple Choice",
                                                "Multiple Response",
                                                "True/False",
                                            ].map((v) => (
                                                <option key={v}>{v}</option>
                                            ))}
                                        </select>
                                        <input
                                            className={input}
                                            value={question.text}
                                            placeholder="Question text"
                                            onChange={(e) => {
                                                const list = structuredClone(
                                                    draft.assessments,
                                                );
                                                list[ai].questions[qi].text =
                                                    e.target.value;
                                                set(list);
                                            }}
                                        />
                                        <input
                                            className={input}
                                            type="number"
                                            value={question.points}
                                            onChange={(e) => {
                                                const list = structuredClone(
                                                    draft.assessments,
                                                );
                                                list[ai].questions[qi].points =
                                                    Number(e.target.value);
                                                set(list);
                                            }}
                                        />
                                        <button
                                            className={button}
                                            onClick={() => {
                                                const list = structuredClone(
                                                    draft.assessments,
                                                );
                                                list[ai].questions.splice(
                                                    qi,
                                                    1,
                                                );
                                                set(list);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <input
                                            className={input}
                                            value={question.explanation ?? ""}
                                            placeholder="Optional answer explanation"
                                            onChange={(e) => {
                                                const list = structuredClone(
                                                    draft.assessments,
                                                );
                                                list[ai].questions[
                                                    qi
                                                ].explanation = e.target.value;
                                                set(list);
                                            }}
                                        />
                                        {question.options.map(
                                            (option: any, oi: number) => (
                                                <div
                                                    className="flex gap-2"
                                                    key={option.id ?? oi}
                                                >
                                                    <input
                                                        type={
                                                            question.type ===
                                                            "Multiple Response"
                                                                ? "checkbox"
                                                                : "radio"
                                                        }
                                                        name={`correct-${ai}-${qi}`}
                                                        checked={option.correct}
                                                        onChange={(e) => {
                                                            const list =
                                                                structuredClone(
                                                                    draft.assessments,
                                                                );
                                                            if (
                                                                question.type !==
                                                                "Multiple Response"
                                                            )
                                                                list[
                                                                    ai
                                                                ].questions[
                                                                    qi
                                                                ].options.forEach(
                                                                    (o: any) =>
                                                                        (o.correct = false),
                                                                );
                                                            list[ai].questions[
                                                                qi
                                                            ].options[
                                                                oi
                                                            ].correct =
                                                                e.target.checked;
                                                            set(list);
                                                        }}
                                                    />
                                                    <input
                                                        className={input}
                                                        value={option.text}
                                                        placeholder={`Option ${oi + 1}`}
                                                        onChange={(e) => {
                                                            const list =
                                                                structuredClone(
                                                                    draft.assessments,
                                                                );
                                                            list[ai].questions[
                                                                qi
                                                            ].options[oi].text =
                                                                e.target.value;
                                                            set(list);
                                                        }}
                                                    />
                                                    <button
                                                        className={button}
                                                        onClick={() => {
                                                            const list =
                                                                structuredClone(
                                                                    draft.assessments,
                                                                );
                                                            list[ai].questions[
                                                                qi
                                                            ].options.splice(
                                                                oi,
                                                                1,
                                                            );
                                                            set(list);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ),
                                        )}
                                        <button
                                            className={button}
                                            onClick={() => {
                                                const list = structuredClone(
                                                    draft.assessments,
                                                );
                                                list[ai].questions[
                                                    qi
                                                ].options.push({
                                                    text: "",
                                                    correct: false,
                                                });
                                                set(list);
                                            }}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add option
                                        </button>
                                    </div>
                                </div>
                            ),
                        )}
                        <button
                            className={button}
                            onClick={() => {
                                const list = structuredClone(draft.assessments);
                                list[ai].questions.push(newQuestion());
                                set(list);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            Add question
                        </button>
                    </div>
                </article>
            ))}
            <button
                className={primary}
                onClick={() => set([...draft.assessments, newAssessment()])}
            >
                <Plus className="h-4 w-4" />
                Add assessment
            </button>
        </div>
    );
}

function Review({
    draft,
    errors,
    state,
    comment,
    setComment,
    workflow,
    busy,
}: any) {
    const reviewer = state.governanceActors.find((p: any) =>
        draft.reviewerIds.includes(p.id),
    );
    const isReviewer = draft.reviewerIds.includes(state.actor.id);
    const isPublisher = draft.publisherId === state.actor.id;
    return (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
                {[
                    [
                        "Course details",
                        `${draft.title} · ${draft.category} · ${draft.difficulty}`,
                    ],
                    [
                        "Audience",
                        `${draft.audience.personTypes.join(", ")} · ${draft.audience.catalogVisibility}`,
                    ],
                    [
                        "Competency mappings",
                        `${draft.competencies.length} mapping(s); completion does not change official competency`,
                    ],
                    [
                        "Governance",
                        `${draft.authorIds.length} author(s) · ${draft.reviewerIds.length} reviewer(s) · ${draft.publisherId ? "Publisher assigned" : "No publisher"}`,
                    ],
                    [
                        "Curriculum",
                        `${draft.modules.length} module(s) · ${draft.modules.reduce((n: number, m: any) => n + m.lessons.length, 0)} lesson(s)`,
                    ],
                    [
                        "Assessments",
                        `${draft.assessments.length} assessment(s) · ${draft.assessments.reduce((n: number, a: any) => n + a.questions.length, 0)} question(s)`,
                    ],
                    [
                        "Certificate",
                        draft.completion.issueCertificate
                            ? "Enabled"
                            : "Disabled",
                    ],
                    [
                        "Version impact",
                        draft.versionNumber
                            ? `Published v${draft.versionNumber}; edits require a separate working Draft`
                            : "Draft saves do not increment official versions",
                    ],
                ].map(([label, value]) => (
                    <div
                        key={label}
                        className="rounded-lg border border-slate-200 p-4"
                    >
                        <h3 className="text-sm font-bold text-slate-900">
                            {label}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">{value}</p>
                    </div>
                ))}
            </div>
            <aside>
                <div
                    className={`rounded-xl border p-4 ${errors.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}
                >
                    {errors.length ? (
                        <>
                            <h3 className="flex items-center gap-2 text-sm font-bold text-rose-900">
                                <AlertCircle className="h-4 w-4" />
                                Missing requirements
                            </h3>
                            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-800">
                                {errors.map((error: string) => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                            <CheckCircle2 className="h-4 w-4" />
                            Publication validation passed
                        </p>
                    )}
                </div>
                <Field label="Review comment">
                    <textarea
                        className={`${textarea} mt-4`}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Required when requesting changes"
                    />
                </Field>
                <div className="mt-4 grid gap-2">
                    {(draft.status === "Draft" ||
                        draft.status === "Changes Requested") && (
                        <button
                            className={primary}
                            disabled={busy || errors.length > 0 || !reviewer}
                            onClick={() => workflow("review")}
                        >
                            Submit for Review
                        </button>
                    )}
                    {draft.status === "In Review" && isReviewer && (
                        <>
                            <button
                                className={primary}
                                disabled={busy}
                                onClick={() => workflow("approve")}
                            >
                                Approve
                            </button>
                            <button
                                className={button}
                                disabled={busy || !comment.trim()}
                                onClick={() => workflow("changes")}
                            >
                                Request Changes
                            </button>
                        </>
                    )}
                    {draft.status === "Approved" && (
                        <button
                            className={primary}
                            disabled={busy || !isPublisher || errors.length > 0}
                            onClick={() => workflow("publish")}
                        >
                            {isPublisher
                                ? "Publish official version"
                                : "Assigned Publisher only"}
                        </button>
                    )}
                    {draft.status === "Published" && (
                        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                            This official version is immutable.
                        </p>
                    )}
                </div>
            </aside>
        </div>
    );
}