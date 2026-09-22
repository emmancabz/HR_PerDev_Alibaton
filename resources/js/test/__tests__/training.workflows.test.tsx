import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnerTraining from "../../Pages/LearnerTraining";

const client = vi.hoisted(() => ({ state: vi.fn(), transitionEnrollment: vi.fn(), feedback: vi.fn() }));
vi.mock("@/data/trainingClient", () => ({ trainingClient: client, trainingError: (error: unknown) => error instanceof Error ? error.message : String(error) }));
vi.mock("@/Layouts/AuthenticatedLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@inertiajs/react", () => ({ Head: () => null }));

const baseState: any = {
    actor: { id: 9, role: "user", canManage: false, canFinalize: false },
    integration: { workforceAttendance: { status: "Not Connected", sourceSystem: "HR2 Workforce Management", contractVersion: "1.0", ownership: "Supporting evidence" }, ai: { enabled: false, reason: "Outside scope" } },
    personnel: [], catalog: { competencies: [], roleProfiles: [], learningCourses: [] }, feedback: [], recommendations: [],
    programs: [{ id: "program-1", code: "TRN-1", title: "Safety Practical", category: "Compliance", deliveryType: "Practical", status: "Active", sessions: [] }],
    enrollments: [{ id: "enrollment-1", programId: "program-1", participantId: 9, participant: "Learner", employeeId: "E-9", personnelKey: "p-9", status: "Assigned", sessions: [], completion: null }],
};

describe("My Training workflow", () => {
    beforeEach(() => { vi.clearAllMocks(); client.state.mockResolvedValue(baseState); client.transitionEnrollment.mockResolvedValue({ ...baseState, enrollments: [{ ...baseState.enrollments[0], status: "Confirmed" }] }); });

    it("confirms a persisted Training assignment", async () => {
        const user = userEvent.setup();
        render(<LearnerTraining initialTrainingState={baseState} />);
        await user.click(screen.getByRole("button", { name: "Confirm Assignment" }));
        await waitFor(() => expect(client.transitionEnrollment).toHaveBeenCalledWith("enrollment-1", "Confirmed", undefined));
        expect(await screen.findByText("Your Training assignment is confirmed.")).toBeVisible();
    });
});
