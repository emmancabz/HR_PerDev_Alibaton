import { render, screen, waitFor, within } from "@testing-library/react";
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
    learningError: (error: unknown) => error instanceof Error ? error.message : String(error),
}));
vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HeaderActions: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HeaderFilters: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@inertiajs/react", () => ({ Head: () => null }));
vi.mock("../../Pages/CourseBuilder", () => ({
    default: ({ initialDraft }: { initialDraft: { title: string } }) => <div>Course Builder: {initialDraft.title || "New course draft"}</div>,
}));

const base = {
    catalog: [], personnel: [], governanceActors: [], sourceLibrary: [], assignments: [], completions: [], requests: [], reviews: [], attempts: [], analytics: {}, competencyCatalog: [], roleProfiles: [],
};

const draft = {
    ...emptyDraft(4),
    id: "version-1",
    courseId: "course-1",
    code: "LRN-2026-001",
    status: "In Review" as const,
    title: "Operational handover",
    description: "A source-grounded operational handover course prepared by HR.",
    learningObjectives: ["Apply the approved handover procedure correctly."],
    sourceDocumentIds: ["ALB-PND-SOP-002"],
    sourceDocuments: [{
        documentId: "ALB-PND-SOP-002", type: "SOP", title: "Operational Handover Procedure", version: "1.0", owner: "Operations", departments: ["Operations"], filename: "ALB-PND-SOP-002.md", relatedCourseCodes: [],
    }],
    sourceReview: {
        id: "source-review-1", status: "Ready" as const, coveragePercent: 95,
        summary: "Course content is supported by the selected sources.", findings: [], aiUsed: true,
        model: "test", scannedAt: "2026-09-15T09:00:00+08:00", current: true,
    },
};

const reviewCourse = {
    id: "course-1", code: "LRN-2026-001", title: "Operational handover", category: "Operations", targetDepartment: "Operations",
    status: "In Review", owner: "Celso Ramirez", ownerId: 4, audience: "Employees · Operations",
    publishedVersion: null, publishedVersionId: null, draftVersionId: "version-1", activeAssignments: 0, completionRate: 0,
    lastUpdated: "2026-09-15T09:00:00+08:00", archived: false, competencies: [], draftDetail: draft, sourceReview: draft.sourceReview,
};

const adminState = { ...base, actor: { id: 1, name: "Learning Admin", role: "admin" }, courses: [reviewCourse] };
const hrDraft = { ...draft, status: "Draft" as const, sourceReview: null };
const hrState = {
    ...base,
    actor: { id: 4, name: "Celso Ramirez", role: "hr" },
    courses: [{ ...reviewCourse, status: "Draft", draftDetail: hrDraft, sourceReview: null }],
};

async function coursesWorkspace() {
    window.location.hash = encodeWorkspaceHash("Courses");
}

describe("final HR to Admin to LMS Learning workflow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hash = encodeWorkspaceHash("Courses");
    });

    it("allows HR to create a persistent course draft", async () => {
        const user = userEvent.setup();
        const created = { ...hrDraft, id: "version-new", courseId: "course-new", code: "LRN-2026-010", title: "" };
        const fresh = {
            ...hrState,
            courses: [{ ...reviewCourse, id: "course-new", code: "LRN-2026-010", title: "", status: "Draft", draftVersionId: "version-new", draftDetail: created, sourceReview: null }],
        };
        client.create.mockResolvedValue({ versionId: "version-new", courseId: "course-new", code: "LRN-2026-010" });
        client.state.mockResolvedValue(fresh);
        render(<AdminLearning initialLearningState={hrState} />);
        await user.click(screen.getByRole("button", { name: "New Course" }));
        await waitFor(() => expect(client.create).toHaveBeenCalledTimes(1));
        expect(await screen.findByText("Course Builder: New course draft")).toBeVisible();
    });

    it("keeps course authoring unavailable to Admin", () => {
        render(<AdminLearning initialLearningState={adminState} />);
        expect(screen.queryByRole("button", { name: "New Course" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Open Operational handover" })).toBeVisible();
    });

    it("shows the source-grounding result before Admin publication", async () => {
        const user = userEvent.setup();
        render(<AdminLearning initialLearningState={adminState} />);
        await user.click(screen.getByRole("button", { name: "Open Operational handover" }));
        expect(screen.getByText("Aevyn Source Review")).toBeVisible();
        expect(screen.getByText("95%")).toBeVisible();
        expect(screen.getByText("Operational Handover Procedure")).toBeVisible();
        expect(screen.getByRole("button", { name: "Publish to LMS" })).toBeEnabled();
    });

    it("publishes the reviewed course and records LMS delivery state", async () => {
        const user = userEvent.setup();
        const publishedState = {
            ...adminState,
            courses: [{
                ...reviewCourse,
                status: "Published",
                draftVersionId: null,
                draftDetail: null,
                publishedVersion: 1,
                publishedVersionId: "version-1",
                delivery: { id: "delivery-1", event: "course.published", status: "Queued", targetCount: 12, attempts: 1, lastError: "Learner LMS endpoint is not configured.", lastAttemptAt: "2026-09-15T10:00:00+08:00", deliveredAt: null },
            }],
        };
        client.publish.mockResolvedValue(publishedState);
        render(<AdminLearning initialLearningState={adminState} />);
        await user.click(screen.getByRole("button", { name: "Open Operational handover" }));
        await user.click(screen.getByRole("button", { name: "Publish to LMS" }));
        await waitFor(() => expect(client.publish).toHaveBeenCalledWith("version-1"));
        expect(await screen.findByText("Course published. LMS delivery is queued.")).toBeVisible();
        const courseDetails = screen.getByRole("dialog");
        expect(within(courseDetails).getByText("Queued")).toBeVisible();
        expect(within(courseDetails).getByText("Waiting for LMS delivery.")).toBeVisible();
        expect(document.body.textContent).not.toMatch(/endpoint is not configured/i);
    });

    it("returns a course to HR only after Admin provides a change reason", async () => {
        const user = userEvent.setup();
        const returnedState = { ...adminState, courses: [{ ...reviewCourse, status: "Changes Requested", draftDetail: { ...draft, status: "Changes Requested" } }] };
        client.decideReview.mockResolvedValue(returnedState);
        render(<AdminLearning initialLearningState={adminState} />);
        await user.click(screen.getByRole("button", { name: "Open Operational handover" }));
        await user.click(screen.getByRole("button", { name: "Request Changes" }));
        const confirm = screen.getByRole("button", { name: "Return to HR" });
        expect(confirm).toBeDisabled();
        await user.type(screen.getByLabelText("What should HR change?"), "Align the final lesson with the selected operations procedure.");
        expect(confirm).toBeEnabled();
        await user.click(confirm);
        await waitFor(() => expect(client.decideReview).toHaveBeenCalledWith("version-1", "Changes Requested", expect.stringContaining("Align the final lesson")));
    });

    it("keeps source review automatic and only offers a refresh when the saved scan is stale", async () => {
        const user = userEvent.setup();
        const staleState = {
            ...adminState,
            courses: [{
                ...reviewCourse,
                sourceReview: { ...draft.sourceReview, current: false },
                draftDetail: {
                    ...draft,
                    sourceReview: { ...draft.sourceReview, current: false },
                },
            }],
        };
        client.sourceReview.mockResolvedValue(adminState);
        render(<AdminLearning initialLearningState={staleState} />);
        await user.click(screen.getByRole("button", { name: "Open Operational handover" }));
        await user.click(screen.getByRole("button", { name: "Refresh Source Review" }));
        await waitFor(() => expect(client.sourceReview).toHaveBeenCalledWith("version-1"));
    });
});
