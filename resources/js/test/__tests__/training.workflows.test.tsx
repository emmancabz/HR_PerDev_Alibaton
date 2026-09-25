import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnerTraining from "../../Pages/LearnerTraining";

const client = vi.hoisted(() => ({
    state: vi.fn(),
    transitionEnrollment: vi.fn(),
    submitTrainerEvaluation: vi.fn(),
}));

const page = vi.hoisted(() => ({
    persona: "employee",
    name: "Learner",
}));

vi.mock("@/data/trainingClient", () => ({
    trainingClient: client,
    trainingError: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@inertiajs/react", () => ({
    Head: () => null,
    usePage: () => ({
        props: {
            auth: {
                user: {
                    persona: page.persona,
                    name: page.name,
                },
            },
        },
    }),
}));

const baseState: any = {
    actor: {
        id: 9,
        role: "user",
        canManage: false,
        canFinalize: false,
        canFacilitate: false,
    },
    integration: {
        workforceAttendance: {
            status: "Not Connected",
            sourceSystem: "HR2 Workforce Management",
            contractVersion: "1.0",
            ownership: "Supporting evidence",
        },
        ai: {
            enabled: false,
            reason: "Outside scope",
        },
    },
    personnel: [],
    catalog: {
        competencies: [],
        roleProfiles: [],
        learningCourses: [],
    },
    feedback: [],
    trainerEvaluationQuarter: {
        key: "2026-Q3",
        label: "Q3 2026",
        startDate: "2026-07-01",
        endDate: "2026-09-30",
        opensAt: "2026-10-01T00:00:00+08:00",
        isOpen: false,
    },
    trainerEvaluationTasks: [],
    recommendations: [],
    facilitation: [],
    programs: [{
        id: "program-1",
        code: "TRN-1",
        title: "Safety Practical",
        description: "Safety practical training",
        category: "Compliance",
        deliveryType: "Practical",
        status: "Active",
        objectives: [],
        audienceRules: {
            personTypes: ["Trainee"],
            departments: [],
            positions: [],
            roleProfileIds: [],
        },
        completionRules: {
            attendanceThreshold: 100,
            assessmentRequired: false,
            passingScore: null,
            issueCertificate: false,
            certificateValidityMonths: null,
        },
        relatedLearningCourseId: null,
        owner: "Training Officer",
        competencies: [],
        sessions: [],
        updatedAt: "2026-09-25T08:00:00+08:00",
    }],
    enrollments: [{
        id: "enrollment-1",
        programId: "program-1",
        participantId: 9,
        participant: "Learner",
        employeeId: "E-9",
        personnelKey: "p-9",
        personType: "Employee",
        department: "Operations",
        position: "Staff",
        source: "Assigned",
        status: "Assigned",
        assignedAt: "2026-09-20T08:00:00+08:00",
        sessions: [],
        assessment: null,
        completion: null,
    }],
};

const pendingTask = {
    quarterKey: "2026-Q3",
    quarterLabel: "Q3 2026",
    quarterStart: "2026-07-01",
    quarterEnd: "2026-09-30",
    opensAt: "2026-10-01T00:00:00+08:00",
    isOpen: true,
    trainerKey: "user:22",
    trainerId: 22,
    trainerName: "Trainer One",
    sessionCount: 2,
    trainingTitles: ["Safety Practical", "Emergency Response Drill"],
    sessions: [
        { sessionId: "session-1", label: "Session 1", programTitle: "Safety Practical", endedAt: "2026-08-31T17:00:00+08:00" },
        { sessionId: "session-2", label: "Session 1", programTitle: "Emergency Response Drill", endedAt: "2026-09-21T17:00:00+08:00" },
    ],
    status: "Pending",
};

const trainerEvaluationState: any = {
    ...baseState,
    trainerEvaluationQuarter: {
        ...baseState.trainerEvaluationQuarter,
        isOpen: true,
    },
    trainerEvaluationTasks: [pendingTask],
    enrollments: [{
        ...baseState.enrollments[0],
        personType: "Trainee",
        status: "Completed",
    }],
};

describe("My Training workflow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        page.persona = "employee";
        page.name = "Learner";
        window.history.replaceState(null, "", "#Schedule");

        client.state.mockResolvedValue(baseState);
        client.transitionEnrollment.mockResolvedValue({
            ...baseState,
            enrollments: [{
                ...baseState.enrollments[0],
                status: "Confirmed",
            }],
        });
        client.submitTrainerEvaluation.mockResolvedValue({
            ...trainerEvaluationState,
            trainerEvaluationTasks: [{ ...pendingTask, status: "Done" }],
        });
    });

    it("confirms a persisted Training assignment for a regular learner", async () => {
        const user = userEvent.setup();

        render(<LearnerTraining initialTrainingState={baseState} />);

        await user.click(screen.getByRole("button", { name: "Confirm Assignment" }));

        await waitFor(() =>
            expect(client.transitionEnrollment).toHaveBeenCalledWith(
                "enrollment-1",
                "Confirmed",
                undefined,
            ),
        );

        expect(
            await screen.findByText("Your Training assignment is confirmed."),
        ).toBeVisible();
    });

    it("submits one quarterly trainer evaluation and then shows DONE without a view action", async () => {
        page.persona = "trainee";
        page.name = "Learner";
        window.history.replaceState(null, "", "#Trainer%20Evaluations");

        const user = userEvent.setup();

        render(<LearnerTraining initialTrainingState={trainerEvaluationState} />);

        await user.click(screen.getByRole("button", { name: "Evaluate" }));

        expect(screen.getByText("Trainer / Instructor Evaluation")).toBeVisible();

        const closeEvaluationButton = screen.getByRole("button", {
            name: "Close trainer evaluation",
        });
        const evaluationModal = closeEvaluationButton.closest("section");

        expect(evaluationModal).not.toBeNull();

        const evaluationModalQueries = within(evaluationModal as HTMLElement);

        expect(evaluationModalQueries.getByText("Trainer One")).toBeVisible();
        expect(evaluationModalQueries.getByText(/Q3 2026/)).toBeVisible();

        const requiredRatings = [
            "Knowledge of the subject",
            "Clarity of explanation",
            "Communication",
            "Engagement with trainees",
            "Professionalism",
            "Practical relevance",
            "Time management",
            "Content quality",
            "Training relevance",
            "Organization",
            "Overall satisfaction",
        ];

        for (const label of requiredRatings) {
            await user.click(screen.getByRole("button", { name: `${label} 5` }));
        }

        await user.click(screen.getByRole("button", { name: "Submit Evaluation" }));

        await waitFor(() =>
            expect(client.submitTrainerEvaluation).toHaveBeenCalledWith(
                expect.objectContaining({
                    quarterKey: "2026-Q3",
                    trainerKey: "user:22",
                    knowledge_rating: 5,
                    clarity_rating: 5,
                    communication_rating: 5,
                    engagement_rating: 5,
                    professionalism_rating: 5,
                    practical_relevance_rating: 5,
                    time_management_rating: 5,
                    safety_emphasis_rating: null,
                    content_rating: 5,
                    relevance_rating: 5,
                    organization_rating: 5,
                    overall_satisfaction: 5,
                }),
            ),
        );

        expect(await screen.findByText("DONE")).toBeVisible();
        expect(screen.queryByRole("button", { name: "Evaluate" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /View Evaluation/i })).not.toBeInTheDocument();
    });
});
