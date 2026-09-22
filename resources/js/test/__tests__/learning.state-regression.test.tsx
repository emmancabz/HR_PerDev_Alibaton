import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft } from "@/data/learning";
import { encodeWorkspaceHash } from "@/workspaceNavigation";
import AdminLearning from "../../Pages/AdminLearning";

const client = vi.hoisted(() => ({
    state: vi.fn(),
    create: vi.fn(),
    createWorkingDraft: vi.fn(),
    archive: vi.fn(),
    sourceReview: vi.fn(),
    decideReview: vi.fn(),
    publish: vi.fn(),
    retryPublication: vi.fn(),
    cancelAssignment: vi.fn(),
    migrateAssignment: vi.fn(),
    revokeCertificate: vi.fn(),
    regradeAttempt: vi.fn(),
}));

vi.mock("@/data/learningClient", () => ({
    learningClient: client,
    learningError: (error: unknown) =>
        error instanceof Error ? error.message : "The Learning request failed.",
}));
vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HeaderActions: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HeaderFilters: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@inertiajs/react", () => ({ Head: () => null }));
vi.mock("../../Pages/CourseBuilder", () => ({
    default: ({ initialDraft }: { initialDraft: { title: string } }) => {
        if (initialDraft.title === "Broken persisted draft")
            throw new Error("Initial builder render failed");
        return <div>Recovered Course Builder: {initialDraft.title}</div>;
    },
}));

const emptyState = {
    actor: { id: 1, name: "Learning Admin", role: "admin" },
    courses: [],
    catalog: [],
    personnel: [],
    governanceActors: [],
    sourceLibrary: [],
    assignments: [],
    completions: [],
    requests: [],
    reviews: [],
    attempts: [],
    analytics: {},
    competencyCatalog: [],
    roleProfiles: [],
};

const publishedCourse = {
    id: "course-1",
    code: "LRN-2026-001",
    title: "Safe operations",
    category: "Operations",
    targetDepartment: "Operations",
    status: "Published",
    owner: "Celso Ramirez",
    ownerId: 4,
    audience: "Employees · Operations",
    publishedVersion: 1,
    publishedVersionId: "version-1",
    draftVersionId: null,
    activeAssignments: 1,
    completionRate: 0,
    lastUpdated: "2026-09-15T08:00:00+08:00",
    archived: false,
    competencies: ["Operational Safety"],
    delivery: {
        id: "delivery-1",
        event: "course.published",
        status: "Queued",
        targetCount: 4,
        attempts: 1,
        lastError: "Learner LMS endpoint is not configured.",
        lastAttemptAt: "2026-09-15T08:00:00+08:00",
        deliveredAt: null,
    },
};

const reviewDraft = {
    ...emptyDraft(4),
    id: "version-review",
    courseId: "course-review",
    code: "LRN-2026-002",
    status: "In Review" as const,
    title: "Operations handover",
    description: "Department handover procedures for operations employees.",
    learningObjectives: ["Apply the approved handover procedure correctly."],
    sourceDocumentIds: ["ALB-PND-SOP-002"],
    sourceDocuments: [{
        documentId: "ALB-PND-SOP-002",
        type: "SOP",
        title: "Operational Handover Procedure",
        version: "1.0",
        owner: "Operations",
        departments: ["Operations"],
        filename: "ALB-PND-SOP-002.md",
        relatedCourseCodes: [],
    }],
    sourceReview: {
        id: "review-1",
        status: "Ready" as const,
        coveragePercent: 96,
        summary: "Course content is supported by the selected references.",
        findings: [],
        aiUsed: true,
        model: "test-model",
        scannedAt: "2026-09-15T08:00:00+08:00",
        current: true,
    },
};

const populatedState = {
    ...emptyState,
    personnel: [{
        id: 7,
        personnel_key: "person-7",
        name: "Alex Learner",
        email: "alex@example.test",
        role: "User",
        person_type: "Employee",
        department: "Operations",
        position: "Operator",
        evaluator_capable: false,
    }],
    courses: [
        publishedCourse,
        {
            id: "course-review",
            code: "LRN-2026-002",
            title: "Operations handover",
            category: "Operations",
            targetDepartment: "Operations",
            status: "In Review",
            owner: "Celso Ramirez",
            ownerId: 4,
            audience: "Employees · Operations",
            publishedVersion: null,
            publishedVersionId: null,
            draftVersionId: "version-review",
            activeAssignments: 0,
            completionRate: 0,
            lastUpdated: "2026-09-15T09:00:00+08:00",
            archived: false,
            competencies: [],
            draftDetail: reviewDraft,
            sourceReview: reviewDraft.sourceReview,
        },
    ],
    assignments: [{
        id: "assignment-1",
        learner_id: 7,
        learner_name: "Alex Learner",
        personnel_key: "person-7",
        course_id: "course-1",
        course_version_id: "version-1",
        code: "LRN-2026-001",
        title: "Safe operations",
        version_number: 1,
        status: "In Progress",
        display_status: "In Progress",
        assigned_at: "2026-09-14T08:00:00+08:00",
        due_at: "2026-09-20T08:00:00+08:00",
        progress_percent: 25,
        source: "LMS Publication",
        department: "Operations",
        position: "Operator",
        person_type: "Employee",
    }],
    requests: [{
        id: "need-1",
        personnel_key: "person-7",
        personnel_name: "Alex Learner",
        competency_id: "comp-1",
        competency_name: "Operational Safety",
        validated_level: 1,
        required_level: 2,
        recommendation_title: "Operational safety refresher",
        recommendation_note: "Refresher needed before reassessment.",
        status: "New",
        requested_at: "2026-09-15T07:00:00+08:00",
    }],
    completions: [{
        id: "completion-1",
        course_id: "course-1",
        learner_name: "Alex Learner",
        title: "Safe operations",
        completed_at: "2026-09-14T12:00:00+08:00",
    }],
};

async function navigateWorkspace(workspace: string) {
    await act(async () => {
        window.location.hash = encodeWorkspaceHash(workspace);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
}

describe("Learning state and final Admin overview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hash = encodeWorkspaceHash("Overview");
    });

    it("shows loading before authoritative Learning data arrives", async () => {
        let resolveState!: (value: typeof emptyState) => void;
        client.state.mockReturnValue(new Promise((resolve) => { resolveState = resolve; }));
        render(<AdminLearning />);
        expect(screen.getByText("Loading Learning data…")).toBeVisible();
        await act(async () => resolveState(emptyState));
        expect(await screen.findByRole("button", { name: "Open Total Courses" })).toBeVisible();
    });

    it("keeps the Admin overview limited to the four operational priorities", () => {
        render(<AdminLearning initialLearningState={populatedState} />);
        expect(screen.getByRole("button", { name: "Open Total Courses" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Open Awaiting Publication" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Open Active Learning" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Open Learning Needs" })).toBeVisible();
        expect(screen.getByText("Courses Awaiting Publication")).toBeVisible();
        expect(screen.getByRole("heading", { name: "Learning Needs" })).toBeVisible();
        expect(screen.getByText("Currently Learning")).toBeVisible();
        expect(screen.getByText("Recent Completions")).toBeVisible();
        expect(screen.queryByText("Learning Operations Snapshot")).not.toBeInTheDocument();
        expect(screen.queryByText("Learning Attention Queue")).not.toBeInTheDocument();
        expect(screen.queryByText("Competency Recommendation Governance")).not.toBeInTheDocument();
        expect(screen.queryByText(/Automation & Aevyn Assist/i)).not.toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/Data A|Data B|total attention item|Maximum 10/i);
    });

    it("shows employee names instead of raw personnel identifiers", () => {
        render(<AdminLearning initialLearningState={populatedState} />);
        expect(screen.getAllByText(/Alex Learner/).length).toBeGreaterThan(0);
        expect(document.body.textContent).not.toContain("person-7");
    });

    it("shows an Admin publication queue with the source-review result", () => {
        render(<AdminLearning initialLearningState={populatedState} />);
        expect(screen.getByText("Operations handover")).toBeVisible();
        expect(screen.getByText("Ready · 96%")).toBeVisible();
    });

    it("renders an honest empty Admin overview", () => {
        render(<AdminLearning initialLearningState={emptyState} />);
        expect(screen.getByText("No courses are waiting for publication.")).toBeVisible();
        expect(screen.getByText("No open learning needs.")).toBeVisible();
        expect(screen.getByText("No active learning assignments.")).toBeVisible();
        expect(screen.getByText("No recent completions.")).toBeVisible();
    });

    it("recovers from a failed state request", async () => {
        const user = userEvent.setup();
        client.state.mockRejectedValueOnce(new Error("Learning service unavailable")).mockResolvedValueOnce(emptyState);
        render(<AdminLearning />);
        expect(await screen.findByText("Learning data could not be loaded")).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByRole("button", { name: "Open Total Courses" })).toBeVisible();
        expect(client.state).toHaveBeenCalledTimes(2);
    });

    it("renders all five Learning workspaces without runtime errors", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        render(<AdminLearning initialLearningState={populatedState} />);
        for (const workspace of ["Courses", "Assignments", "Learning Records", "Analytics", "Overview"]) {
            await navigateWorkspace(workspace);
        }
        await waitFor(() => expect(consoleError).not.toHaveBeenCalled());
        consoleError.mockRestore();
    });

    it("keeps course creation out of the Admin Courses workspace", async () => {
        render(<AdminLearning initialLearningState={populatedState} />);
        await navigateWorkspace("Courses");
        expect(screen.queryByRole("button", { name: /New Course/i })).not.toBeInTheDocument();
    });

    it("opens Learning details in centered modals instead of side drawers", async () => {
        const user = userEvent.setup();
        render(<AdminLearning initialLearningState={populatedState} />);

        await navigateWorkspace("Courses");
        await user.click(screen.getByRole("button", { name: "Open Safe operations" }));
        let dialog = screen.getByRole("dialog", { name: "Safe operations" });
        expect(dialog).toHaveAttribute("data-overlay-root", "modal");
        expect(dialog.querySelector('[data-overlay-part="panel"]')).toBeTruthy();
        expect(dialog.querySelector('[data-overlay-part="drawer-panel"]')).toBeNull();
        await user.click(screen.getByRole("button", { name: "Close details" }));

        await navigateWorkspace("Assignments");
        await user.click(screen.getByRole("button", { name: "Open assignment for Alex Learner" }));
        dialog = screen.getByRole("dialog", { name: "Alex Learner" });
        expect(dialog).toHaveAttribute("data-overlay-root", "modal");
        expect(dialog.querySelector('[data-overlay-part="drawer-panel"]')).toBeNull();
        await user.click(screen.getByRole("button", { name: "Close details" }));

        await navigateWorkspace("Learning Records");
        await user.click(screen.getByRole("button", { name: "Open learning record for Alex Learner" }));
        dialog = screen.getByRole("dialog", { name: "Alex Learner" });
        expect(dialog).toHaveAttribute("data-overlay-root", "modal");
        expect(dialog.querySelector('[data-overlay-part="drawer-panel"]')).toBeNull();
    });

    it("lets HR reopen a persisted draft and recover the builder from authoritative state", async () => {
        const user = userEvent.setup();
        const brokenDraft = emptyDraft(4);
        Object.assign(brokenDraft, { id: "version-recovery", courseId: "course-hr", status: "Draft", title: "Broken persisted draft" });
        const correctedDraft = { ...structuredClone(brokenDraft), title: "Corrected persisted draft" };
        const hrState = {
            ...populatedState,
            actor: { id: 4, name: "Celso Ramirez", role: "hr" },
            courses: [{
                ...publishedCourse,
                id: "course-hr",
                code: "LRN-2026-010",
                title: "Broken persisted draft",
                status: "Draft",
                owner: "Celso Ramirez",
                ownerId: 4,
                publishedVersion: null,
                publishedVersionId: null,
                draftVersionId: "version-recovery",
                draftDetail: brokenDraft,
                delivery: null,
            }],
        };
        const correctedState = {
            ...hrState,
            courses: [{ ...hrState.courses[0], draftDetail: correctedDraft }],
        };
        client.state.mockResolvedValueOnce(correctedState);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        render(<AdminLearning initialLearningState={hrState} />);
        await navigateWorkspace("Courses");
        await user.click(screen.getByRole("button", { name: "Open Broken persisted draft" }));
        await user.click(screen.getByRole("button", { name: "Continue Draft" }));
        expect(await screen.findByText("Course Builder could not be displayed")).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Retry Builder" }));
        expect(await screen.findByText("Recovered Course Builder: Corrected persisted draft")).toBeVisible();
        consoleError.mockRestore();
    });
});
