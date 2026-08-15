import { emptyDraft, type LearningState } from "@/data/learning";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseBuilder from "../../Pages/CourseBuilder";

const { create, stateCall, save } = vi.hoisted(() => ({
    create: vi.fn(),
    stateCall: vi.fn(),
    save: vi.fn(),
}));
vi.mock("@/data/learningClient", () => ({
    learningClient: {
        create,
        state: stateCall,
        save,
        submitReview: vi.fn(),
        decideReview: vi.fn(),
        publish: vi.fn(),
        aiGenerate: vi.fn(),
        aiDecide: vi.fn(),
    },
    learningError: (error: unknown) => String(error),
}));
const state: LearningState = {
    actor: { id: 1, name: "Admin User", role: "admin" },
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
    personnel: [
        {
            id: 2,
            personnel_key: "u2",
            name: "Reviewer",
            email: "r@test",
            role: "HR",
            person_type: "Employee",
            department: "HR",
            position: "Reviewer",
            evaluator_capable: true,
        },
    ],
    governanceActors: [
        {
            id: 1,
            personnel_key: null,
            name: "Admin User",
            email: "admin@alibaton.com",
            role: "Admin",
            person_type: null,
            department: null,
            position: null,
            evaluator_capable: false,
            hasPersonnelIdentity: false,
            canOwn: true,
            canAuthor: true,
            canReview: false,
            canPublish: true,
        },
        {
            id: 2,
            personnel_key: "u2",
            name: "Reviewer",
            email: "r@test",
            role: "HR",
            person_type: "Employee",
            department: "HR",
            position: "Reviewer",
            evaluator_capable: true,
            hasPersonnelIdentity: true,
            canOwn: true,
            canAuthor: true,
            canReview: true,
            canPublish: true,
        },
    ],
};

describe("Course Builder production interactions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        create.mockResolvedValue({ versionId: "v1", courseId: "c1" });
        stateCall.mockResolvedValue({ ...state, courses: [] });
        save.mockResolvedValue({ ...state, courses: [] });
    });
    it("renders a horizontal seven-stage procedure", () => {
        render(
            <CourseBuilder
                initialDraft={emptyDraft(1)}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );
        [
            "Course Details",
            "Audience & Availability",
            "Competency Alignment",
            "Governance",
            "Curriculum",
            "Assessment & Completion",
            "Review & Publish",
        ].forEach((label) =>
            expect(screen.getAllByText(label).length).toBeGreaterThan(0),
        );
    });
    it("marks the current stage semantically", () => {
        render(
            <CourseBuilder
                initialDraft={emptyDraft(1)}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: "1" })).toHaveAttribute(
            "aria-current",
            "step",
        );
        expect(screen.getByRole("button", { name: "1" })).toHaveClass(
            "learning-step-active",
        );
    });
    it("animates forward and backward stage changes without exposing future stages", async () => {
        const user = userEvent.setup();
        const draft = emptyDraft(1);
        draft.title = "Governed course";
        draft.description = "A meaningful governed online course description.";
        draft.learningObjectives = ["Apply the documented process correctly."];
        render(
            <CourseBuilder
                initialDraft={draft}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Continue/ }));
        expect(screen.getByRole("button", { name: "1" })).toHaveClass(
            "learning-step-complete",
        );
        expect(screen.getByRole("button", { name: "2" })).toHaveClass(
            "learning-step-active",
        );
        expect(screen.getByTestId("learning-stage-content")).toHaveClass(
            "learning-stage-panel--forward",
        );
        expect(screen.getByRole("button", { name: "3" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: /Previous/ }));
        expect(screen.getByTestId("learning-stage-content")).toHaveClass(
            "learning-stage-panel--backward",
        );
        expect(screen.getByRole("button", { name: "1" })).toHaveAttribute(
            "aria-current",
            "step",
        );
    });
    it("shows only one active stage form at a time", async () => {
        const user = userEvent.setup();
        const draft = emptyDraft(1);
        draft.title = "Governed course";
        draft.description = "A meaningful governed online course description.";
        draft.learningObjectives = ["Apply the documented process correctly."];
        render(
            <CourseBuilder
                initialDraft={draft}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );
        expect(screen.getByLabelText(/Course Title/)).toBeVisible();
        expect(
            screen.queryByLabelText(/Catalog visibility/),
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Continue/ }));
        expect(screen.getByLabelText(/Catalog visibility/)).toBeVisible();
        expect(screen.queryByLabelText(/Course Title/)).not.toBeInTheDocument();
    });
    it("blocks stage progression while the active stage is incomplete", () => {
        render(
            <CourseBuilder
                initialDraft={emptyDraft(1)}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
        expect(
            screen.getByText("3 item(s) must be completed before continuing."),
        ).toBeVisible();
        expect(
            screen.getByText(/course title of at least 3 characters/i),
        ).toBeVisible();
        expect(
            screen.getByText(/description of at least 20 characters/i),
        ).toBeVisible();
        expect(
            screen.getByText(/learning objective of 8 or more characters/i),
        ).toBeVisible();
        expect(screen.getByLabelText(/Course Title/)).toHaveAttribute(
            "aria-invalid",
            "true",
        );
    });
    it("opens a clickable unsaved-changes modal outside the builder content", async () => {
        const user = userEvent.setup();
        render(
            <CourseBuilder
                initialDraft={emptyDraft(1)}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );
        await user.type(screen.getByLabelText(/Course Title/), "Changed");
        await user.click(screen.getByRole("button", { name: /Exit/ }));
        expect(
            screen.getByRole("dialog", { name: "Exit Course Builder?" }),
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Keep editing" }),
        ).toBeEnabled();
        await user.click(screen.getByRole("button", { name: "Keep editing" }));
        await waitFor(() =>
            expect(
                screen.queryByRole("dialog", { name: "Exit Course Builder?" }),
            ).not.toBeInTheDocument(),
        );
    });
    it("calls the real save handler for a new Draft", async () => {
        const user = userEvent.setup();
        render(
            <CourseBuilder
                initialDraft={emptyDraft(1)}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );
        await user.click(screen.getByRole("button", { name: /Save Draft/ }));
        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create.mock.calls[0][0].ownerId).toBe(1);
    });
    it("saves valid Step 1 before moving to Step 2", async () => {
        const user = userEvent.setup();
        const draft = emptyDraft(1);
        draft.title = "Operational readiness";
        draft.description =
            "A complete description for the governed online course.";
        draft.learningObjectives = ["Apply the documented process correctly."];
        render(
            <CourseBuilder
                initialDraft={draft}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Continue/ }));
        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create.mock.calls[0][0].audience.personTypes).toEqual([]);
        expect(screen.getByLabelText(/Catalog visibility/)).toBeVisible();
        expect(screen.queryByText(/canonical personnel values/i)).not.toBeInTheDocument();
    });
    it("renders Audience Person Types only from canonical learner personnel", async () => {
        const user = userEvent.setup();
        const draft = emptyDraft(1);
        draft.title = "Canonical audience";
        draft.description = "A complete description for the governed online course.";
        draft.learningObjectives = ["Apply the documented process correctly."];
        const canonicalState: LearningState = {
            ...state,
            personnel: [
                { ...state.personnel[0], id: 2, person_type: "Project Employee" },
                { ...state.personnel[0], id: 3, person_type: "Trainee" },
                { ...state.personnel[0], id: 4, person_type: "Project Employee" },
                { ...state.personnel[0], id: 5, person_type: "" },
            ],
            governanceActors: [
                { ...state.governanceActors[0], person_type: "System Administrator" },
            ],
        };
        render(
            <CourseBuilder
                initialDraft={draft}
                state={canonicalState}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Continue/ }));
        expect(screen.getByRole("checkbox", { name: "Project Employee" })).toBeVisible();
        expect(screen.getByRole("checkbox", { name: "Trainee" })).toBeVisible();
        expect(screen.queryByRole("checkbox", { name: "Employee" })).not.toBeInTheDocument();
        expect(screen.queryByText("System Administrator")).not.toBeInTheDocument();
        expect(screen.getAllByRole("checkbox", { name: "Project Employee" })).toHaveLength(1);
    });
    it("reopens known legacy Audience values as selected canonical values", async () => {
        const user = userEvent.setup();
        const draft = emptyDraft(1);
        Object.assign(draft, {
            title: "Legacy audience",
            description: "A complete description for the governed online course.",
            learningObjectives: ["Apply the documented process correctly."],
        });
        draft.audience.personTypes = ["Employees"];
        render(
            <CourseBuilder
                initialDraft={draft}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Continue/ }));
        expect(create.mock.calls[0][0].audience.personTypes).toEqual(["Employee"]);
        expect(screen.getByRole("checkbox", { name: "Employee" })).toBeChecked();
    });
    it("shows an actionable state when canonical Person Types are unavailable", async () => {
        const user = userEvent.setup();
        const draft = emptyDraft(1);
        Object.assign(draft, {
            title: "Unavailable audience",
            description: "A complete description for the governed online course.",
            learningObjectives: ["Apply the documented process correctly."],
        });
        render(
            <CourseBuilder
                initialDraft={draft}
                state={{ ...state, personnel: [] }}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Continue/ }));
        expect(
            screen.getByText(/add or activate personnel with a person type/i),
        ).toBeVisible();
        expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
    });
    it("keeps the system Admin owner selected from governance actors without making it learner personnel", async () => {
        const user = userEvent.setup();
        const draft = emptyDraft(1);
        draft.title = "Operational readiness";
        draft.description =
            "A complete description for the governed online course.";
        draft.learningObjectives = ["Apply the documented process correctly."];
        draft.audience.personTypes = ["Employee"];
        render(
            <CourseBuilder
                initialDraft={draft}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );

        await user.click(screen.getByRole("button", { name: /Continue/ }));
        await user.click(screen.getByRole("button", { name: /Continue/ }));
        await user.click(screen.getByRole("button", { name: /Continue/ }));

        const owner = screen.getByLabelText("Course Owner");
        expect(owner).toHaveValue("1");
        expect(
            within(owner).getByRole("option", { name: "Admin User — Admin" }),
        ).toBeVisible();
        expect(state.personnel.some((person) => person.id === 1)).toBe(false);
    });
    it("does not make future desktop stage controls actionable", () => {
        render(
            <CourseBuilder
                initialDraft={emptyDraft(1)}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: "7" })).toBeDisabled();
    });
    it("queues edits made during an active autosave and immediately flushes the newest revision", async () => {
        vi.useFakeTimers();
        const first = Promise.withResolvers<LearningState>();
        const second = Promise.withResolvers<LearningState>();
        const draft = emptyDraft(1);
        Object.assign(draft, {
            id: "v1",
            courseId: "c1",
            status: "Draft",
            title: "Initial title",
        });
        const response = (title: string): LearningState => ({
            ...state,
            courses: [
                {
                    id: "c1",
                    code: "LRN-2026-001",
                    title,
                    category: "General",
                    status: "Draft",
                    owner: "Author",
                    ownerId: 1,
                    audience: "Employees",
                    activeAssignments: 0,
                    completionRate: 0,
                    lastUpdated: "2026-08-13T00:00:00+08:00",
                    archived: false,
                    competencies: [],
                    draftVersionId: "v1",
                    draftDetail: { ...draft, title },
                },
            ],
        });
        save.mockImplementationOnce(() => first.promise);
        save.mockImplementationOnce(() => second.promise);
        render(
            <CourseBuilder
                initialDraft={draft}
                state={state}
                onExit={vi.fn()}
                onState={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByLabelText(/Course Title/), {
            target: { value: "First revision" },
        });
        await vi.advanceTimersByTimeAsync(1500);
        expect(save).toHaveBeenCalledTimes(1);

        fireEvent.change(screen.getByLabelText(/Course Title/), {
            target: { value: "Newest queued revision" },
        });
        first.resolve(response("First revision"));
        await Promise.resolve();
        await Promise.resolve();

        expect(save).toHaveBeenCalledTimes(2);
        expect(save.mock.calls[1][1].title).toBe("Newest queued revision");
        second.resolve(response("Newest queued revision"));
        await Promise.resolve();
        await Promise.resolve();
        expect(
            screen.getByDisplayValue("Newest queued revision"),
        ).toBeVisible();
        vi.useRealTimers();
    });
});