import { emptyDraft, type LearningState } from "@/data/learning";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseBuilder from "../../Pages/CourseBuilder";

const api = vi.hoisted(() => ({
    create: vi.fn(),
    state: vi.fn(),
    save: vi.fn(),
    submitReview: vi.fn(),
    aiGenerate: vi.fn(),
    aiDecide: vi.fn(),
    uploadThumbnail: vi.fn(),
    uploadMaterial: vi.fn(),
    revokeMaterial: vi.fn(),
}));

vi.mock("@/data/learningClient", () => ({
    learningClient: api,
    learningError: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

const sourceDocument = {
    documentId: "ALB-PND-SOP-002",
    type: "SOP",
    title: "Operational Handover Procedure",
    version: "1.0",
    status: "Active",
    owner: "Operations",
    departments: ["Operations"],
    filename: "ALB-PND-SOP-002.md",
    relatedCourseCodes: [],
};

const state: LearningState = {
    actor: { id: 4, name: "Celso Ramirez", role: "hr" },
    courses: [],
    catalog: [],
    assignments: [],
    completions: [],
    requests: [],
    reviews: [],
    attempts: [],
    analytics: {},
    competencyCatalog: [],
    roleProfiles: [],
    sourceLibrary: [sourceDocument],
    personnel: [
        { id: 20, personnel_key: "person-20", name: "Ops Employee", email: "ops@test", role: "User", person_type: "Employee", department: "Operations", position: "Operator", evaluator_capable: false },
        { id: 21, personnel_key: "person-21", name: "Ops Trainee", email: "trainee@test", role: "User", person_type: "Trainee", department: "Operations", position: "Trainee", evaluator_capable: false },
        { id: 22, personnel_key: "person-22", name: "Finance Employee", email: "fin@test", role: "User", person_type: "Employee", department: "Finance", position: "Finance Staff", evaluator_capable: false },
    ],
    governanceActors: [
        { id: 4, personnel_key: "hr-4", name: "Celso Ramirez", email: "hr@test", role: "HR", person_type: "Employee", department: "Human Resources", position: "HR Business Partner", evaluator_capable: true, hasPersonnelIdentity: true, canOwn: true, canAuthor: true, canReview: false, canPublish: false },
        { id: 1, personnel_key: null, name: "Learning Admin", email: "admin@test", role: "Admin", person_type: null, department: null, position: null, evaluator_capable: false, hasPersonnelIdentity: false, canOwn: false, canAuthor: false, canReview: true, canPublish: true },
    ],
};

const validCourse = () => {
    const draft = emptyDraft(4);
    draft.title = "Operational handover";
    draft.description = "A governed course for operational handover procedures and records.";
    draft.learningObjectives = ["Apply the approved operational handover procedure correctly."];
    draft.audience.allDepartments = false;
    draft.audience.departments = ["Operations"];
    draft.audience.personTypes = ["Employee", "Trainee"];
    draft.sourceDocumentIds = [sourceDocument.documentId];
    draft.modules = [{
        clientId: "module-1",
        title: "Handover foundation",
        description: "Foundation",
        lessons: [{
            title: "Shift handover",
            objective: "Apply the handover process correctly.",
            description: "Read the procedure.",
            contentType: "Text/Reading",
            textContent: "Use the approved handover procedure and complete the required logbook.",
            externalUrl: "",
            estimatedMinutes: 10,
            required: true,
            materials: [],
        }],
    }];
    const question = {
        type: "Multiple Choice" as const,
        text: "Which handover action is required?",
        explanation: "Follow the approved handover procedure.",
        points: 1,
        options: [
            { text: "Complete the documented handover", correct: true },
            { text: "Skip the handover", correct: false },
        ],
    };
    draft.assessments = [
        { type: "Pre-Test", title: "Pre-Test", required: false, passingScore: 80, attemptsAllowed: 1, shuffleQuestions: false, shuffleOptions: false, feedbackPolicy: "After submission", moduleClientId: null, questions: [question] },
        { type: "Post-Test", title: "Post-Test", required: true, passingScore: 80, attemptsAllowed: 3, shuffleQuestions: false, shuffleOptions: false, feedbackPolicy: "After submission", moduleClientId: null, questions: [structuredClone(question)] },
    ];
    return draft;
};

const renderBuilder = (draft = emptyDraft(4)) => render(
    <CourseBuilder initialDraft={draft} state={state} onExit={vi.fn()} onState={vi.fn()} />,
);

describe("final HR Course Builder", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.create.mockResolvedValue({ versionId: "version-1", courseId: "course-1", code: "LRN-2026-001" });
        api.state.mockResolvedValue(state);
        api.save.mockResolvedValue(state);
        api.submitReview.mockResolvedValue(state);
    });

    it("uses the final seven-stage department-first flow", () => {
        renderBuilder();
        ["Course Setup", "Source Documents", "Audience & Competency", "Curriculum", "Assessment & Completion", "Review", "Submit"]
            .forEach((label) => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
        expect(screen.queryByText("Governance")).not.toBeInTheDocument();
        expect(screen.getAllByTestId("learning-step-connector")).toHaveLength(6);
    });

    it("requires a target department in Course Setup", () => {
        renderBuilder();
        expect(screen.getByRole("button", { name: "Target Department dropdown" })).toBeVisible();
        expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
        expect(screen.getByText(/Select a target department or choose Company-wide/i)).toBeVisible();
    });

    it("automatically derives learner types when HR chooses a department", async () => {
        const user = userEvent.setup();
        const draft = validCourse();
        draft.id = undefined;
        draft.courseId = undefined;
        draft.audience.personTypes = [];
        draft.sourceDocumentIds = [];
        draft.modules = [];
        draft.assessments = [];
        renderBuilder(draft);
        await user.selectOptions(screen.getByLabelText("Target Department"), "Operations");
        await user.click(screen.getByRole("button", { name: "Save Draft" }));
        await waitFor(() => expect(api.create).toHaveBeenCalled());
        expect(api.create.mock.calls.at(-1)?.[0].audience.personTypes).toEqual(["Employee", "Trainee"]);
    });

    it("auto-selects relevant source documents after department selection", async () => {
        const user = userEvent.setup();
        const draft = validCourse();
        draft.workingStage = 1;
        draft.sourceDocumentIds = [];
        renderBuilder(draft);
        expect(screen.getByText("Operational Handover Procedure")).toBeVisible();
        expect(screen.getByText("Recommended")).toBeVisible();
        await waitFor(() => expect(screen.getByText("1 selected")).toBeVisible());
        await user.click(screen.getByRole("button", { name: "Save Draft" }));
        await waitFor(() => expect(api.create).toHaveBeenCalled());
        expect(api.create.mock.calls.at(-1)?.[0].sourceDocumentIds).toEqual(["ALB-PND-SOP-002"]);
    });

    it("does not offer Aevyn before source documents have been selected", () => {
        renderBuilder(validCourse());
        expect(screen.queryByRole("button", { name: "Aevyn Assist" })).not.toBeInTheDocument();
    });

    it("offers Aevyn while building curriculum after source selection", () => {
        const draft = validCourse();
        draft.workingStage = 3;
        renderBuilder(draft);
        expect(screen.getByRole("button", { name: "Aevyn Assist" })).toBeVisible();
    });

    it("keeps Pre-Test, Knowledge Check, and Post-Test authoring in Assessment & Completion", () => {
        const draft = validCourse();
        draft.workingStage = 4;
        renderBuilder(draft);
        expect(screen.getByRole("button", { name: "Assessment Pre-Test type dropdown" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Assessment Post-Test type dropdown" })).toBeVisible();
        expect(screen.getByRole("button", { name: /Add Knowledge Check/i })).toBeVisible();
    });

    it("does not expose manual reviewer or publisher selection to HR", () => {
        const draft = validCourse();
        draft.workingStage = 5;
        renderBuilder(draft);
        expect(screen.queryByLabelText(/Course Owner/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Reviewer/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Publisher/i)).not.toBeInTheDocument();
    });

    it("submits a complete HR-authored course to Admin", async () => {
        const user = userEvent.setup();
        const draft = validCourse();
        draft.id = "version-1";
        draft.courseId = "course-1";
        draft.status = "Draft";
        draft.workingStage = 6;
        api.save.mockResolvedValue({ ...state, courses: [{
            id: "course-1", code: "LRN-2026-001", title: draft.title, category: draft.category,
            status: "Draft", owner: "Celso Ramirez", ownerId: 4, audience: "Employees · Operations",
            activeAssignments: 0, completionRate: 0, lastUpdated: "2026-09-15T10:00:00+08:00", archived: false,
            competencies: [], draftVersionId: "version-1", draftDetail: draft,
        }] });
        renderBuilder(draft);
        const submit = screen.getByRole("button", { name: /Submit to Admin/i });
        expect(submit).toBeEnabled();
        await user.click(submit);
        await waitFor(() => expect(api.submitReview).toHaveBeenCalledWith("version-1"));
        expect(await screen.findByText("Course submitted to Admin for publication review.")).toBeVisible();
    });

    it("opens an exit confirmation when HR has unsaved changes", async () => {
        const user = userEvent.setup();
        renderBuilder();
        await user.type(screen.getByLabelText(/Course Title/), "Changed");
        await user.click(screen.getByRole("button", { name: "Exit" }));
        expect(screen.getByRole("dialog", { name: "Exit Course Builder?" })).toBeVisible();
    });
});
