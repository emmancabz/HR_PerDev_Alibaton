import SystemSelect from '@/Components/SystemSelect';
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
    Send,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const input =
    "app-control";
const textarea = `${input} h-auto min-h-24 py-2`;
const button =
    "app-button";
const primary = `${button} app-button-primary`;
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
const newAssessment = (type: AssessmentDraft["type"] = "Knowledge Check"): AssessmentDraft => ({
    type,
    title: type === "Pre-Test" ? "Pre-Test" : type === "Post-Test" ? "Post-Test" : type === "Final Assessment" ? "Final Assessment" : "Knowledge Check",
    required: type !== "Pre-Test",
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
    const [stage, setStage] = useState(() =>
        Math.max(
            0,
            Math.min(
                BUILDER_STAGES.length - 1,
                Number(initialDraft.workingStage ?? 0),
            ),
        ),
    );
    const [stageDirection, setStageDirection] = useState<
        "forward" | "backward"
    >("forward");
    const [saveStatus, setSaveStatus] = useState<
        "Saved" | "Saving" | "Failed" | "Unsaved"
    >("Saved");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmExit, setConfirmExit] = useState(false);
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
        const details = [
            ...Object.values(detailIssues),
            !draft.audience.allDepartments && !draft.audience.departments.length
                ? "Select a target department or choose Company-wide."
                : "",
        ].filter(Boolean);
        const sources = !draft.sourceDocumentIds.length
            ? ["Select at least one source document."]
            : [];
        const audience = [
            !availablePersonTypes.length
                ? "No active learner person types are available."
                : "",
            availablePersonTypes.length && !draft.audience.personTypes.length
                ? "Select at least one learner type."
                : "",
            invalidAudiencePersonTypes.length
                ? `Unsupported learner type: ${invalidAudiencePersonTypes.join(", ")}.`
                : "",
            draft.audience.allDepartments && draft.audience.departments.length
                ? "Company-wide cannot be combined with individual departments."
                : "",
        ].filter(Boolean);
        const curriculum = draft.modules.length
            ? draft.modules.flatMap((module) => [
                  !module.title.trim() ? "Every module needs a title." : "",
                  !module.lessons.length
                      ? `Module “${module.title || "Untitled"}” needs at least one lesson.`
                      : "",
                  ...module.lessons.flatMap((lesson) => [
                      !lesson.title.trim() ? "Every lesson needs a title." : "",
                      lesson.objective.trim().length < 8
                          ? "Every lesson needs a meaningful objective."
                          : "",
                  ]),
              ]).filter(Boolean)
            : ["Add at least one module."];
        const assessment = [
            ...draft.assessments.flatMap((value) => assessmentErrors(value)),
            ...(draft.assessments.filter((value) => value.type === "Pre-Test").length !== 1
                ? ["Add one Pre-Test."]
                : []),
            ...(draft.assessments.filter((value) => value.type === "Post-Test").length !== 1
                ? ["Add one Post-Test."]
                : []),
            ...draft.assessments
                .filter((value) => value.type === "Knowledge Check" && !value.moduleClientId)
                .map((value) => `Knowledge Check “${value.title}” must be linked to a module.`),
        ];
        return [details, sources, audience, curriculum, assessment, [], errors];
    }, [availablePersonTypes, detailIssues, draft, errors, invalidAudiencePersonTypes]);
    const maxReachableStage = useMemo(() => {
        const firstBlockingStage = stageIssues
            .slice(0, BUILDER_STAGES.length - 1)
            .findIndex((issues) => issues.length > 0);

        return firstBlockingStage === -1
            ? BUILDER_STAGES.length - 1
            : firstBlockingStage;
    }, [stageIssues]);
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
    const goToStage = (nextStage: number) => {
        const boundedStage = Math.max(
            0,
            Math.min(BUILDER_STAGES.length - 1, nextStage),
        );
        if (boundedStage === stage) return;
        if (boundedStage > stage) {
            void advanceToStage(boundedStage);
            return;
        }
        setStageDirection(boundedStage > stage ? "forward" : "backward");
        setStage(boundedStage);
        if (draftRef.current.workingStage !== boundedStage) {
            const next = {
                ...draftRef.current,
                workingStage: boundedStage,
            };
            draftRef.current = next;
            dirty.current = true;
            revision.current += 1;
            setSaveStatus("Unsaved");
            setDraft(next);
        }
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

    async function advanceToStage(destination: number): Promise<void> {
        if (busy || destination <= stage || destination > maxReachableStage)
            return;
        if (activeSave.current) await activeSave.current;
        const current = draftRef.current;
        const destinationDraft = {
            ...structuredClone(current),
            workingStage: destination,
        };
        draftRef.current = destinationDraft;
        dirty.current = true;
        revision.current += 1;
        const persisted = await save(false);
        if (!persisted) {
            const restored = { ...draftRef.current, workingStage: stage };
            draftRef.current = restored;
            setDraft(restored);
            dirty.current = true;
            return;
        }
        setStageDirection("forward");
        setStage(destination);
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
            if (!silent) setMessage("Draft saved.");
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
    async function workflow(action: "review") {
        if ((!draft.id || dirty.current) && !(await save(false))) return;
        setBusy(true);
        setMessage("");
        try {
            const next = await learningClient.submitReview(draft.id!);
            onState(next);
            const persisted = next.courses.find((course) => course.id === draft.courseId)?.draftDetail;
            if (persisted) {
                const clone = structuredClone(persisted);
                draftRef.current = clone;
                setDraft(clone);
            } else {
                setDraft((current) => ({ ...current, status: "In Review" }));
            }
            setMessage("Course submitted to Admin for publication review.");
        } catch (error) {
            setMessage(learningError(error));
        } finally {
            setBusy(false);
        }
    }
    async function aiDraft() {
        if (!draft.id) {
            setMessage("Save the Draft before using Aevyn Assist.");
            return;
        }
        const useCase = "Course Outline";
        setBusy(true);
        setMessage("");
        try {
            setAi(
                await learningClient.aiGenerate(
                    draft.id,
                    useCase,
                    {
                        title: draft.title,
                        objectives: draft.learningObjectives,
                        targetDepartments: draft.audience.allDepartments
                            ? ["Company-wide"]
                            : draft.audience.departments,
                        sourceDocumentIds: draft.sourceDocumentIds,
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
            setMessage("Thumbnail uploaded.");
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
                const useCase = "Course Outline";
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
                    ? "Aevyn suggestion added to the course. Review the content before continuing."
                    : "Suggestion discarded. Existing course content was preserved.",
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
        <div className="-m-4 min-h-[calc(100dvh-7rem)] min-w-0 overflow-x-hidden bg-[#f4f4f3] sm:-m-5 xl:-m-6">
            <div className="relative z-10 border-b border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
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
                        {stage === 3 && (
                            <button
                                className={button}
                                onClick={aiDraft}
                                disabled={busy}
                            >
                                <Sparkles className="h-4 w-4" />
                                Aevyn Assist
                            </button>
                        )}
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
                    <ol className="mx-auto flex min-w-[940px] max-w-[1500px] items-start px-3">
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
                                            data-testid="learning-step-connector"
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
                                            index <= maxReachableStage &&
                                            goToStage(index)
                                        }
                                        disabled={index > maxReachableStage}
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
                        Course Builder stage
                        <SystemSelect
                            className={`${input} mt-1`}
                            value={stage}
                            onChange={(e) => goToStage(Number(e.target.value))}
                        >
                            {BUILDER_STAGES.map((label, index) => (
                                <option
                                    key={label}
                                    value={index}
                                    disabled={index > maxReachableStage}
                                >
                                    {index + 1}. {label}
                                </option>
                            ))}
                        </SystemSelect>
                    </label>
                </div>
            </div>
            <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
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
                    className="app-card scroll-mt-52"
                >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-white via-white to-amber-50/60 px-5 py-4 sm:px-6">
                        <div>
                            <h2 className="text-base font-bold text-slate-950">
                                {BUILDER_STAGES[stage]}
                            </h2>
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
                            <div className="space-y-6">
                                <Details
                                    draft={draft}
                                    update={update}
                                    personnel={state.personnel}
                                    issues={detailIssues}
                                    busy={busy}
                                    uploadThumbnail={uploadThumbnail}
                                />
                                <DepartmentScope
                                    draft={draft}
                                    update={update}
                                    departments={departments}
                                    personnel={state.personnel}
                                />
                            </div>
                        )}{" "}
                        {stage === 1 && (
                            <SourceDocuments draft={draft} update={update} documents={state.sourceLibrary} />
                        )}{" "}
                        {stage === 2 && (
                            <div className="space-y-7">
                                <Audience
                                    draft={draft}
                                    update={update}
                                    personnel={state.personnel}
                                    invalidPersonTypes={invalidAudiencePersonTypes}
                                />
                                <div className="border-t border-slate-200 pt-6">
                                    <Competency draft={draft} update={update} catalog={state.competencyCatalog} />
                                </div>
                            </div>
                        )}{" "}
                        {stage === 3 && (
                            <Curriculum draft={draft} update={update} material={material} busy={busy} />
                        )}{" "}
                        {stage === 4 && (
                            <Assessment draft={draft} update={update} />
                        )}{" "}
                        {stage === 5 && (
                            <Review draft={draft} errors={errors} />
                        )}{" "}
                        {stage === 6 && (
                            <SubmitCourse draft={draft} errors={errors} workflow={workflow} busy={busy} />
                        )}
                    </div>
                </section>
                {stage !== 6 && (
                    <div className="sticky bottom-3 z-10 mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-xl sm:px-4">
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
                            onClick={() => void advanceToStage(stage + 1)}
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
                title="Aevyn Draft"
                description="Review the suggested course content before adding it to the Draft."
                onClose={() => setAi(null)}
                footer={
                    <>
                        <button
                            className={button}
                            onClick={() => decideAi("Rejected")}
                        >
                            Discard
                        </button>
                        <button
                            className={primary}
                            onClick={() => decideAi("Accepted")}
                        >
                            Use suggestion
                        </button>
                    </>
                }
            >
                {ai && <AevynDraftPreview value={ai.draft} />}
            </AppModal>
        </div>
    );
}

function AevynDraftPreview({ value }: { value: any }) {
    const items = Array.isArray(value?.items) ? value.items : [];
    return (
        <div className="space-y-4">
            {(value?.title || value?.rationale) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    {value?.title && (
                        <p className="text-sm font-bold text-slate-950">{String(value.title)}</p>
                    )}
                    {value?.rationale && (
                        <p className="mt-1 text-sm text-slate-700">{String(value.rationale)}</p>
                    )}
                </div>
            )}
            <div className="space-y-3">
                {items.map((item: any, index: number) => {
                    const title = typeof item === "string"
                        ? item
                        : String(item?.title ?? item?.objective ?? item?.text ?? `Suggestion ${index + 1}`);
                    const lessons = Array.isArray(item?.lessons) ? item.lessons : [];
                    return (
                        <div key={`${title}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-bold text-slate-900">{title}</p>
                            {lessons.length > 0 && (
                                <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                                    {lessons.map((lesson: any, lessonIndex: number) => (
                                        <li key={`${lessonIndex}-${String(lesson?.title ?? lesson)}`} className="flex items-start gap-2">
                                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                            <span>{String(lesson?.title ?? lesson?.text ?? lesson)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
                {!items.length && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        No suggested content was returned.
                    </p>
                )}
            </div>
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
                              ? "Generated automatically"
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
                <SystemSelect
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
                </SystemSelect>
            </Field>
            <Field label="Difficulty" required>
                <SystemSelect
                    className={input}
                    value={draft.difficulty}
                    onChange={(e) => update({ difficulty: e.target.value })}
                >
                    {["Beginner", "Intermediate", "Advanced"].map((v) => (
                        <option key={v}>{v}</option>
                    ))}
                </SystemSelect>
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
                <SystemSelect
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
                </SystemSelect>
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

function DepartmentScope({ draft, update, departments, personnel }: any) {
    const value = draft.audience.allDepartments
        ? "__all__"
        : (draft.audience.departments[0] ?? "");
    const audiencePersonTypes = (target: string): string[] => {
        const rows = target === "__all__"
            ? personnel
            : personnel.filter((person: any) => person.department === target);
        return [...new Set(rows.map((person: any) => String(person.person_type ?? "").trim()).filter(Boolean))] as string[];
    };
    return (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-[260px_1fr] md:items-end">
                <Field
                    label="Target Department"
                    required
                >
                    <SystemSelect
                        aria-label="Target Department"
                        menuLabel="Target Department"
                        className={input}
                        value={value}
                        onChange={(event) => {
                            const next = event.target.value;
                            update({
                                audience: {
                                    ...draft.audience,
                                    allDepartments: next === "__all__",
                                    departments: next === "__all__" || next === "" ? [] : [next],
                                    positions: [],
                                    personTypes: next === "" ? [] : audiencePersonTypes(next),
                                },
                                sourceDocumentIds: [],
                            });
                        }}
                    >
                        <option value="">Select department</option>
                        <option value="__all__">Company-wide</option>
                        {departments.map((department: string) => (
                            <option key={department} value={department}>{department}</option>
                        ))}
                    </SystemSelect>
                    {!draft.audience.allDepartments && !draft.audience.departments.length ? (
                        <span className="mt-1 block text-xs font-medium text-rose-600">
                            Select a target department or choose Company-wide.
                        </span>
                    ) : null}
                </Field>
                <div className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                    {value === "__all__" ? "Company-wide course" : value || "Select a department"}
                </div>
            </div>
        </section>
    );
}

function SourceDocuments({ draft, update, documents }: any) {
    const targetDepartments = draft.audience.allDepartments
        ? []
        : draft.audience.departments;
    const recommended = new Set(
        documents
            .filter((document: any) =>
                draft.audience.allDepartments
                    ? (document.departments ?? []).includes("Human Resources")
                    : (document.departments ?? []).some((department: string) => targetDepartments.includes(department)),
            )
            .map((document: any) => document.documentId),
    );
    useEffect(() => {
        if (draft.sourceDocumentIds.length || recommended.size === 0) return;
        update({ sourceDocumentIds: [...recommended].slice(0, 6) });
    }, [draft.sourceDocumentIds.length, recommended.size]);

    const rows = [...documents].sort((left: any, right: any) => {
        const leftSelected = draft.sourceDocumentIds.includes(left.documentId) ? 1 : 0;
        const rightSelected = draft.sourceDocumentIds.includes(right.documentId) ? 1 : 0;
        if (leftSelected !== rightSelected) return rightSelected - leftSelected;
        const leftRecommended = recommended.has(left.documentId) ? 1 : 0;
        const rightRecommended = recommended.has(right.documentId) ? 1 : 0;
        if (leftRecommended !== rightRecommended) return rightRecommended - leftRecommended;
        return left.title.localeCompare(right.title);
    });

    const toggle = (id: string, checked: boolean) => {
        const current = new Set(draft.sourceDocumentIds);
        if (checked) current.add(id);
        else current.delete(id);
        update({ sourceDocumentIds: [...current] });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-slate-950">Source Documents</h3>

                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                    {draft.sourceDocumentIds.length} selected
                </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                    {rows.map((document: any) => {
                        const selected = draft.sourceDocumentIds.includes(document.documentId);
                        return (
                            <label key={document.documentId} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-amber-50/40">
                                <input
                                    className="mt-1"
                                    type="checkbox"
                                    checked={selected}
                                    onChange={(event) => toggle(document.documentId, event.target.checked)}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-slate-900">{document.title}</span>
                                        {recommended.has(document.documentId) && (
                                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">Recommended</span>
                                        )}
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-500">
                                        {document.type} · v{document.version} · {document.owner}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                    {!rows.length && (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">No source documents are available.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Audience({
    draft,
    update,
    personnel,
    invalidPersonTypes,
}: any) {
    const audience = draft.audience;
    const set = (patch: any) => update({ audience: { ...audience, ...patch } });
    const targetLabel = audience.allDepartments
        ? "Company-wide"
        : audience.departments.join(", ") || "Not set";
    const targetedPersonnel = personnel.filter(
        (person: any) =>
            audience.allDepartments ||
            audience.departments.includes(person.department),
    );
    const targetedPersonTypes = [
        ...new Set(
            targetedPersonnel
                .map((person: any) => String(person.person_type ?? "").trim())
                .filter(Boolean),
        ),
    ] as string[];
    const targetedPositions = [
        ...new Set(
            targetedPersonnel
                .map((person: any) => String(person.position ?? "").trim())
                .filter(Boolean),
        ),
    ] as string[];

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">Target</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{targetLabel}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">Eligible learners</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{targetedPersonnel.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">Learner types</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                        {targetedPersonTypes.join(", ") || "None"}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">Positions in scope</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{targetedPositions.length}</p>
                </div>
            </div>

            {invalidPersonTypes.length > 0 && (
                <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
                >
                    <span>Some saved learner types are no longer available.</span>
                    <button
                        type="button"
                        className="font-bold underline"
                        onClick={() =>
                            set({
                                personTypes: audience.personTypes.filter(
                                    (value: string) => targetedPersonTypes.includes(value),
                                ),
                            })
                        }
                    >
                        Update target
                    </button>
                </div>
            )}

            <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-900">
                    Delivery settings
                </summary>
                <div className="grid gap-5 border-t border-slate-200 p-4 lg:grid-cols-2">
                    <Field label="Catalog visibility">
                        <SystemSelect
                            className={input}
                            value={audience.catalogVisibility}
                            onChange={(e) => set({ catalogVisibility: e.target.value })}
                        >
                            {[
                                "Assigned only",
                                "Eligible users may self-enroll",
                                "Unlisted",
                            ].map((value) => (
                                <option key={value}>{value}</option>
                            ))}
                        </SystemSelect>
                    </Field>
                    <Field label="Default due window (days)">
                        <input
                            type="number"
                            min={1}
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
                            onChange={(e) => set({ availableFrom: e.target.value || null })}
                        />
                    </Field>
                    <Field label="Available until">
                        <input
                            type="datetime-local"
                            className={input}
                            value={audience.availableUntil ?? ""}
                            onChange={(e) => set({ availableUntil: e.target.value || null })}
                        />
                    </Field>
                    <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-800 lg:col-span-2">
                        <input
                            type="checkbox"
                            checked={audience.mandatoryDefault}
                            onChange={(e) => set({ mandatoryDefault: e.target.checked })}
                        />
                        Mandatory by default
                    </label>
                </div>
            </details>
        </div>
    );
}

function Competency({ draft, update, catalog }: any) {
    return (
        <div>
            <p className="mb-4 text-sm text-slate-600">
                Map a competency only when the course is intended to address a defined skill requirement.
            </p>
            <div className="space-y-3">
                {draft.competencies.map((item: any, index: number) => (
                    <div
                        key={item.id}
                        className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_110px_1fr_auto]"
                    >
                        <SystemSelect
                            className={input}
                            value={item.id}
                            aria-label="Competency"
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
                        </SystemSelect>
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
                Course completion can support competency reassessment, but it does not change an official competency level by itself.
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
                            aria-label={`Move module ${module.title || mi + 1} up`}
                        >
                            <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                            className={button}
                            disabled={mi === modules.length - 1}
                            onClick={() => move(mi, 1)}
                            aria-label={`Move module ${module.title || mi + 1} down`}
                        >
                            <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                            className={button}
                            aria-label={`Remove module ${module.title || mi + 1}`}
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
                            aria-label={`Module ${module.title || mi + 1} description`}
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
                                    aria-label={`Lesson ${li + 1} title in ${module.title || `module ${mi + 1}`}`}
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
                                    aria-label={`Lesson ${li + 1} objective in ${module.title || `module ${mi + 1}`}`}
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
                                <SystemSelect
                                    aria-label={`Lesson ${lesson.title || li + 1} content type`}
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
                                </SystemSelect>
                                <input
                                    aria-label={`Lesson ${lesson.title || li + 1} estimated minutes`}
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
                                        aria-label={`Lesson ${lesson.title || li + 1} external URL`}
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
                                        aria-label={`Lesson ${lesson.title || li + 1} content`}
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
                                        aria-label={`Require lesson ${lesson.title || li + 1}`}
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
                                        aria-label={`Move lesson ${lesson.title || li + 1} up in ${module.title || `module ${mi + 1}`}`}
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
                                        aria-label={`Move lesson ${lesson.title || li + 1} down in ${module.title || `module ${mi + 1}`}`}
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
                                                        aria-label={`Revoke material ${file.displayName} from lesson ${lesson.title || li + 1}`}
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
                                    aria-label={`Remove lesson ${lesson.title || li + 1} from ${module.title || `module ${mi + 1}`}`}
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
                    Confirm this content change before continuing.
                </p>
            </AppModal>
        </div>
    );
}

function Assessment({ draft, update }: any) {
    const set = (v: any) => update({ assessments: v });
    const pendingFocus = useRef<string | null>(null);
    useEffect(() => {
        if (!pendingFocus.current) return;
        const target = document.querySelector<HTMLElement>(
            `[data-learning-focus="${pendingFocus.current}"]`,
        );
        pendingFocus.current = null;
        target?.focus();
    }, [draft.assessments]);
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
                            aria-label={`Assessment ${ai + 1} title`}
                            className={input}
                            value={assessment.title}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].title = e.target.value;
                                set(list);
                            }}
                        />
                        <SystemSelect
                            aria-label={`Assessment ${assessment.title || ai + 1} type`}
                            className={input}
                            value={assessment.type}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].type = e.target.value;
                                if (e.target.value !== "Knowledge Check")
                                    list[ai].moduleClientId = null;
                                if (e.target.value === "Pre-Test")
                                    list[ai].required = false;
                                set(list);
                            }}
                        >
                            <option>Pre-Test</option>
                            <option>Knowledge Check</option>
                            <option>Post-Test</option>
                            {assessment.type === "Final Assessment" && (
                                <option>Final Assessment</option>
                            )}
                        </SystemSelect>
                        <SystemSelect
                            aria-label={`Module for assessment ${assessment.title || ai + 1}`}
                            className={input}
                            disabled={assessment.type !== "Knowledge Check"}
                            value={assessment.moduleClientId ?? ""}
                            onChange={(e) => {
                                const list = structuredClone(draft.assessments);
                                list[ai].moduleClientId =
                                    e.target.value || null;
                                set(list);
                            }}
                        >
                            <option value="">
                                {assessment.type === "Knowledge Check"
                                    ? "Select module"
                                    : "Whole course"}
                            </option>
                            {draft.modules.map((module: any, index: number) => (
                                <option
                                    key={module.clientId}
                                    value={module.clientId}
                                >
                                    {module.title || `Module ${index + 1}`}
                                </option>
                            ))}
                        </SystemSelect>
                        <input
                            aria-label={`Passing score for assessment ${assessment.title || ai + 1}`}
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
                            aria-label={`Attempts allowed for assessment ${assessment.title || ai + 1}`}
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
                            aria-label={`Remove assessment ${assessment.title || ai + 1}`}
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
                                        aria-label={`Require assessment ${assessment.title || ai + 1} for completion`}
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
                                        aria-label={`Shuffle questions for assessment ${assessment.title || ai + 1}`}
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
                                        aria-label={`Shuffle options for assessment ${assessment.title || ai + 1}`}
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
                            <SystemSelect
                                aria-label={`Feedback policy for assessment ${assessment.title || ai + 1}`}
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
                            </SystemSelect>
                        </div>
                        {assessment.questions.map(
                            (question: any, qi: number) => (
                                <div
                                    key={question.id ?? qi}
                                    className="rounded-lg border border-slate-200 p-4"
                                >
                                    <div className="grid gap-3 lg:grid-cols-[180px_1fr_100px_auto]">
                                        <SystemSelect
                                            aria-label={`Question ${qi + 1} type in ${assessment.title || `assessment ${ai + 1}`}`}
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
                                        </SystemSelect>
                                        <input
                                            aria-label={`Question ${qi + 1} text in ${assessment.title || `assessment ${ai + 1}`}`}
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
                                            aria-label={`Question ${qi + 1} points in ${assessment.title || `assessment ${ai + 1}`}`}
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
                                        <div className="flex gap-2">
                                            <button className={button} data-learning-focus={`question-${ai}-${qi}-up`} disabled={qi === 0} aria-label={`Move question ${qi + 1} up in ${assessment.title || `assessment ${ai + 1}`}`} onClick={() => {
                                                pendingFocus.current = `question-${ai}-${qi - 1}-remove`;
                                                const list = structuredClone(draft.assessments); const [row] = list[ai].questions.splice(qi, 1); list[ai].questions.splice(qi - 1, 0, row); set(list);
                                            }}><ArrowUp className="h-4 w-4" /></button>
                                            <button className={button} data-learning-focus={`question-${ai}-${qi}-down`} disabled={qi === assessment.questions.length - 1} aria-label={`Move question ${qi + 1} down in ${assessment.title || `assessment ${ai + 1}`}`} onClick={() => {
                                                pendingFocus.current = `question-${ai}-${qi + 1}-remove`;
                                                const list = structuredClone(draft.assessments); const [row] = list[ai].questions.splice(qi, 1); list[ai].questions.splice(qi + 1, 0, row); set(list);
                                            }}><ArrowDown className="h-4 w-4" /></button>
                                            <button className={button} data-learning-focus={`question-${ai}-${qi}-remove`} aria-label={`Remove question ${qi + 1} from ${assessment.title || `assessment ${ai + 1}`}`} onClick={() => {
                                                pendingFocus.current = assessment.questions.length > 1 ? `question-${ai}-${Math.min(qi, assessment.questions.length - 2)}-remove` : `assessment-${ai}-add-question`;
                                                const list = structuredClone(draft.assessments); list[ai].questions.splice(qi, 1); set(list);
                                            }}><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <input
                                            aria-label={`Explanation for question ${qi + 1} in ${assessment.title || `assessment ${ai + 1}`}`}
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
                                        <fieldset className="space-y-2">
                                            <legend className="text-sm font-semibold text-slate-700">
                                                Answers for question {qi + 1}: {question.text || "Untitled question"}
                                            </legend>
                                        {question.options.map(
                                            (option: any, oi: number) => (
                                                <div
                                                    className="flex gap-2"
                                                    key={option.id ?? oi}
                                                >
                                                    <input
                                                        aria-label={`Mark option ${oi + 1} correct for question ${qi + 1} in ${assessment.title || `assessment ${ai + 1}`}`}
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
                                                        aria-label={`Option ${oi + 1} text for question ${qi + 1} in ${assessment.title || `assessment ${ai + 1}`}`}
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
                                                    <button className={button} data-learning-focus={`option-${ai}-${qi}-${oi}-up`} disabled={oi === 0} aria-label={`Move option ${oi + 1} up for question ${qi + 1} in ${assessment.title || `assessment ${ai + 1}`}`} onClick={() => {
                                                        pendingFocus.current = `option-${ai}-${qi}-${oi - 1}-remove`;
                                                        const list = structuredClone(draft.assessments); const [row] = list[ai].questions[qi].options.splice(oi, 1); list[ai].questions[qi].options.splice(oi - 1, 0, row); set(list);
                                                    }}><ArrowUp className="h-4 w-4" /></button>
                                                    <button className={button} data-learning-focus={`option-${ai}-${qi}-${oi}-down`} disabled={oi === question.options.length - 1} aria-label={`Move option ${oi + 1} down for question ${qi + 1} in ${assessment.title || `assessment ${ai + 1}`}`} onClick={() => {
                                                        pendingFocus.current = `option-${ai}-${qi}-${oi + 1}-remove`;
                                                        const list = structuredClone(draft.assessments); const [row] = list[ai].questions[qi].options.splice(oi, 1); list[ai].questions[qi].options.splice(oi + 1, 0, row); set(list);
                                                    }}><ArrowDown className="h-4 w-4" /></button>
                                                    <button
                                                        className={button}
                                                        data-learning-focus={`option-${ai}-${qi}-${oi}-remove`}
                                                        aria-label={`Remove option ${oi + 1} from question ${qi + 1} in ${assessment.title || `assessment ${ai + 1}`}`}
                                                        onClick={() => {
                                                            pendingFocus.current = question.options.length > 1 ? `option-${ai}-${qi}-${Math.min(oi, question.options.length - 2)}-remove` : `question-${ai}-${qi}-add-option`;
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
                                            data-learning-focus={`question-${ai}-${qi}-add-option`}
                                            aria-label={`Add option to question ${qi + 1} in ${assessment.title || `assessment ${ai + 1}`}`}
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
                                        </fieldset>
                                    </div>
                                </div>
                            ),
                        )}
                        <button
                            className={button}
                            data-learning-focus={`assessment-${ai}-add-question`}
                            aria-label={`Add question to ${assessment.title || `assessment ${ai + 1}`}`}
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
            <div className="flex flex-wrap gap-2">
                {!draft.assessments.some((item: AssessmentDraft) => item.type === "Pre-Test") && (
                    <button
                        className={primary}
                        onClick={() =>
                            set([...draft.assessments, newAssessment("Pre-Test")])
                        }
                    >
                        <Plus className="h-4 w-4" />
                        Add Pre-Test
                    </button>
                )}
                <button
                    className={button}
                    onClick={() =>
                        set([...draft.assessments, newAssessment("Knowledge Check")])
                    }
                >
                    <Plus className="h-4 w-4" />
                    Add Knowledge Check
                </button>
                {!draft.assessments.some((item: AssessmentDraft) => item.type === "Post-Test") && (
                    <button
                        className={primary}
                        onClick={() =>
                            set([...draft.assessments, newAssessment("Post-Test")])
                        }
                    >
                        <Plus className="h-4 w-4" />
                        Add Post-Test
                    </button>
                )}
            </div>
        </div>
    );
}

function Review({ draft, errors }: any) {
    const lessonCount = draft.modules.reduce(
        (count: number, module: any) => count + module.lessons.length,
        0,
    );
    const target = draft.audience.allDepartments
        ? "Company-wide"
        : draft.audience.departments.join(", ") || "Not set";
    const preTest = draft.assessments.find((item: AssessmentDraft) => item.type === "Pre-Test");
    const postTest = draft.assessments.find((item: AssessmentDraft) => item.type === "Post-Test");
    const knowledgeChecks = draft.assessments.filter(
        (item: AssessmentDraft) => item.type === "Knowledge Check",
    );

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    ["Target", target],
                    ["Source documents", `${draft.sourceDocumentIds.length} selected`],
                    ["Curriculum", `${draft.modules.length} modules · ${lessonCount} lessons`],
                    ["Assessment", `${preTest ? "Pre-Test" : "No Pre-Test"} · ${postTest ? "Post-Test" : "No Post-Test"}`],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
                    </div>
                ))}
            </div>

            <section className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-bold text-slate-900">Course summary</h3>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                    <ReviewLine label="Course" value={draft.title || "Untitled course"} />
                    <ReviewLine label="Category" value={`${draft.category} · ${draft.difficulty}`} />
                    <ReviewLine label="Learners" value={draft.audience.personTypes.join(", ") || "Not set"} />
                    <ReviewLine label="Availability" value={draft.audience.catalogVisibility} />
                    <ReviewLine label="Competencies" value={`${draft.competencies.length} mapped`} />
                    <ReviewLine label="Knowledge checks" value={`${knowledgeChecks.length}`} />
                    <ReviewLine label="Certificate" value={draft.completion.issueCertificate ? "Issued on completion" : "Not issued"} />
                    <ReviewLine label="Default due" value={draft.audience.defaultDueDays ? `${draft.audience.defaultDueDays} days` : "No default due date"} />
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-bold text-slate-900">Source documents</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    {(draft.sourceDocuments ?? []).length ? (
                        draft.sourceDocuments.map((source: any) => (
                            <div key={`${source.documentId}-${source.version}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{source.title}</p>
                                    <p className="text-xs text-slate-500">{source.type} · v{source.version}</p>
                                </div>
                                <span className="text-xs font-semibold text-slate-600">{source.owner}</span>
                            </div>
                        ))
                    ) : (
                        <p className="px-4 py-4 text-sm text-slate-500">Selected source documents will appear here after saving.</p>
                    )}
                </div>
            </section>

            {errors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-rose-900">
                        <AlertCircle className="h-4 w-4" />
                        Complete before submission
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-800">
                        {errors.map((error: string) => (
                            <li key={error}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
        </div>
    );
}

function SubmitCourse({ draft, errors, workflow, busy }: any) {
    const submitted = draft.status === "In Review" || draft.status === "Approved";
    return (
        <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                {submitted ? (
                    <>
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                        <h3 className="mt-3 text-lg font-extrabold text-slate-950">Submitted to Admin</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            The course is locked for publication review. Source checking runs on the submitted version.
                        </p>
                    </>
                ) : errors.length ? (
                    <>
                        <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
                        <h3 className="mt-3 text-lg font-extrabold text-slate-950">Course is not ready</h3>
                        <ul className="mx-auto mt-3 max-w-xl list-disc space-y-1 pl-5 text-left text-sm text-rose-800">
                            {errors.map((error: string) => (
                                <li key={error}>{error}</li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                        <h3 className="mt-3 text-lg font-extrabold text-slate-950">Ready for Admin review</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Submit the completed course for source review and publication approval.
                        </p>
                        <button
                            className={`${primary} mt-5`}
                            disabled={busy}
                            onClick={() => workflow("review")}
                        >
                            <Send className="h-4 w-4" />
                            {busy ? "Submitting…" : "Submit to Admin"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
