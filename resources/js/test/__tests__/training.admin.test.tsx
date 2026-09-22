import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminTraining from "../../Pages/AdminTraining";

const client = vi.hoisted(() => ({
    state: vi.fn(), scheduleRequirements: vi.fn(), updateSession: vi.fn(), transitionSession: vi.fn(),
    syncWorkforce: vi.fn(), finalizeAttendance: vi.fn(), finalizeReadyParticipants: vi.fn(),
}));

vi.mock("@/data/trainingClient", () => ({ trainingClient: client, trainingError: (error: unknown) => error instanceof Error ? error.message : String(error) }));
vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HeaderFilters: () => null,
}));
vi.mock("@inertiajs/react", () => ({ Head: () => null }));

const state: any = {
    actor: { id: 1, role: "admin", canManage: true, canFinalize: true, canFacilitate: false },
    integration: { workforceAttendance: { status: "Not Connected", sourceSystem: "Workforce Management", contractVersion: "1.0", ownership: "Supporting evidence" }, ai: { enabled: false, reason: "Outside scope" } },
    personnel: [
        { id: 9, personnelKey: "person-9", employeeId: "EMP-009", name: "Alex Reyes", email: "alex@example.test", personType: "Employee", department: "Crane Operations", position: "Crane Operator", role: "user" },
    ],
    catalog: { competencies: [], roleProfiles: [], learningCourses: [] },
    programs: [{
        id: "program-1", code: "TRN-PRACT-CRANE-001", title: "Crane Operations Practical", description: "Practical verification", category: "Technical Skills", deliveryType: "Practical", status: "Active", objectives: [],
        audienceRules: { personTypes: ["Employee"], departments: ["Crane Operations"], positions: ["Crane Operator"], roleProfileIds: [] },
        completionRules: { attendanceThreshold: 100, assessmentRequired: true, passingScore: 80, issueCertificate: true, certificateValidityMonths: 12 },
        relatedLearningCourseId: null, owner: "Training Officer", competencies: [], sessions: [], updatedAt: "2026-09-16T08:00:00+08:00",
    }],
    enrollments: [], facilitation: [], feedback: [],
    recommendations: [{
        id: "rec-1", sourceRecommendationId: "competency-rec-1", sourceModule: "Competency", sourceLabel: "Competency Gap", personnelKey: "person-9", participantId: 9, participant: "Alex Reyes", employeeId: "EMP-009", department: "Crane Operations", position: "Crane Operator", developmentNeed: "Crane Operations Practical", reason: "Validated practical gap", status: "Pending", readiness: "Ready", prerequisiteStatus: "Completed", prerequisiteTitle: "Crane Operations Fundamentals", recommendedProgramId: "program-1", recommendedProgramTitle: "Crane Operations Practical", linkedProgramId: null, linkedSessionId: null, linkedEnrollmentId: null, actionReason: null, sourceSnapshot: {}, createdAt: "2026-09-16T08:00:00+08:00",
    }],
};

describe("Admin Training Management", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hash = "#Overview";
        client.state.mockResolvedValue(state);
    });

    it("opens Training requirement details in the standard modal", async () => {
        const user = userEvent.setup();
        render(<AdminTraining initialTrainingState={state} />);

        expect(screen.getByRole("button", { name: "Open Ready to Schedule" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Open Upcoming Training" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Open Ongoing" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Open Pending Finalization" })).toBeVisible();

        await user.click(screen.getByRole("button", { name: "Open Crane Operations Practical training requirements" }));
        expect(screen.getByRole("dialog", { name: "Training Requirement" })).toBeVisible();
        expect(screen.getByText("Alex Reyes")).toBeVisible();
        expect(screen.getAllByText("Competency Gap").length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: /Schedule Training/i })).toBeVisible();
    });
});
