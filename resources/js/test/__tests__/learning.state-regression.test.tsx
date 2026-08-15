import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLearning from "../../Pages/AdminLearning";

const client = vi.hoisted(() => ({
    state: vi.fn(),
}));

vi.mock("@/data/learningClient", () => ({
    learningClient: client,
    learningError: (error: unknown) =>
        error instanceof Error ? error.message : "The Learning request failed.",
}));
vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@inertiajs/react", () => ({ Head: () => null }));

const emptyState = {
    actor: { id: 1, name: "Learning Admin", role: "admin" },
    courses: [],
    catalog: [],
    personnel: [],
    governanceActors: [],
    assignments: [],
    completions: [],
    requests: [],
    reviews: [],
    attempts: [],
    analytics: {},
    competencyCatalog: [],
    roleProfiles: [],
};

const populatedState = {
    ...emptyState,
    courses: [
        {
            id: "course-1",
            code: "LRN-2026-001",
            title: "Safe operations",
            category: "Operations",
            status: "Published",
            owner: "Learning Admin",
            ownerId: 1,
            audience: "Employees · Operations",
            publishedVersion: 1,
            publishedVersionId: "version-1",
            draftVersionId: null,
            activeAssignments: 1,
            completionRate: 0,
            lastUpdated: "2026-08-14T08:00:00+08:00",
            archived: false,
            competencies: [],
        },
    ],
    assignments: [
        {
            id: "assignment-1",
            learner_id: 7,
            learner_name: "Alex Learner",
            course_id: "course-1",
            course_version_id: "version-1",
            code: "LRN-2026-001",
            title: "Safe operations",
            version_number: 1,
            status: "In Progress",
            display_status: "In Progress",
            assigned_at: "2026-08-14T08:00:00+08:00",
            due_at: "2026-09-14T08:00:00+08:00",
            progress_percent: 25,
            source: "Manual Assignment",
            department: "Operations",
            position: "Staff Professional",
            person_type: "Employee",
        },
    ],
};

describe("Admin Learning state contract regression", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows loading before Learning data finishes loading", async () => {
        let resolveState!: (value: typeof emptyState) => void;
        client.state.mockReturnValue(
            new Promise<typeof emptyState>((resolve) => {
                resolveState = resolve;
            }),
        );

        render(<AdminLearning />);
        expect(screen.getByText("Loading Learning data…")).toBeVisible();
        expect(screen.queryByText("Published Courses")).not.toBeInTheDocument();

        await act(async () => resolveState(emptyState));
        expect(await screen.findByText("Published Courses")).toBeVisible();
    });

    it("renders an honest empty Learning state", () => {
        render(<AdminLearning initialLearningState={emptyState} />);
        expect(
            screen.getByRole("button", { name: /0 Published Courses/ }),
        ).toBeVisible();
        expect(screen.getByText("No courses are awaiting review.")).toBeVisible();
        expect(screen.getByText("No completion events yet.")).toBeVisible();
    });

    it("normalizes partially missing optional collections", () => {
        render(
            <AdminLearning
                initialLearningState={{
                    actor: emptyState.actor,
                    assignments: [],
                }}
            />,
        );
        expect(screen.getByText("Published Courses")).toBeVisible();
        expect(screen.getByText("No pending Learning recommendations.")).toBeVisible();
    });

    it("renders a valid populated state", () => {
        render(<AdminLearning initialLearningState={populatedState} />);
        expect(
            screen.getByRole("button", {
                name: /1 Active Learner Assignments/,
            }),
        ).toBeVisible();
        expect(screen.getByText("Alex Learner · Safe operations")).toBeVisible();
    });

    it("shows a visible recoverable error after a failed state request", async () => {
        const user = userEvent.setup();
        client.state
            .mockRejectedValueOnce(new Error("Learning service unavailable"))
            .mockResolvedValueOnce(emptyState);

        render(<AdminLearning />);
        expect(
            await screen.findByText("Learning data could not be loaded"),
        ).toBeVisible();
        expect(screen.getByText("Learning service unavailable")).toBeVisible();

        await user.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("Published Courses")).toBeVisible();
        expect(client.state).toHaveBeenCalledTimes(2);
    });

    it("renders Overview and every Learning workspace without runtime errors", async () => {
        const user = userEvent.setup();
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        render(<AdminLearning initialLearningState={populatedState} />);

        expect(screen.getByText("Published Courses")).toBeVisible();
        for (const workspace of [
            "Courses",
            "Learning Requests",
            "Assignments",
            "Completions & Certificates",
            "Analytics",
            "Overview",
        ]) {
            await user.click(screen.getByRole("button", { name: workspace }));
        }

        await waitFor(() => expect(consoleError).not.toHaveBeenCalled());
        consoleError.mockRestore();
    });
});
