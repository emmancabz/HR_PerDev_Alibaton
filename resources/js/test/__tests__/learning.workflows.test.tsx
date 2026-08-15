import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLearning from "../../Pages/AdminLearning";
import LearnerLearning from "../../Pages/LearnerLearning";

const client = vi.hoisted(() => ({
    state: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    player: vi.fn(),
    recordLesson: vi.fn(),
    startAttempt: vi.fn(),
    saveResponses: vi.fn(),
    submitAttempt: vi.fn(),
    selfEnroll: vi.fn(),
    assignmentPreview: vi.fn(),
    assign: vi.fn(),
    regradeAttempt: vi.fn(),
    revokeCertificate: vi.fn(),
}));

vi.mock("@/data/learningClient", () => ({
    learningClient: client,
    learningError: (error: unknown) =>
        error instanceof Error ? error.message : String(error),
}));
vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@inertiajs/react", () => ({ Head: () => null }));

const course = {
    id: "course-1",
    code: "LRN-2026-001",
    title: "Safe operations",
    category: "Operations",
    status: "Published",
    owner: "Owner",
    ownerId: 1,
    audience: "Employees · Operations",
    publishedVersion: 1,
    publishedVersionId: "version-1",
    draftVersionId: null,
    activeAssignments: 1,
    completionRate: 0,
    lastUpdated: "2026-08-13T08:00:00+08:00",
    archived: false,
    competencies: [],
    versionHistory: [
        {
            id: "version-1",
            versionNumber: 1,
            status: "Published",
            title: "Safe operations",
            publishedAt: "2026-08-13T08:00:00+08:00",
            updatedAt: "2026-08-13T08:00:00+08:00",
        },
    ],
    publishedDetail: {
        audience: { mandatoryDefault: true, defaultDueDays: 30 },
    },
};

const baseState: any = {
    actor: { id: 1, name: "Learning Admin", role: "admin" },
    courses: [course],
    catalog: [],
    personnel: [
        {
            id: 7,
            personnel_key: "P-7",
            name: "Alex Learner",
            email: "alex@example.test",
            role: "User",
            person_type: "Employee",
            department: "Operations",
            position: "Staff Professional",
            evaluator_capable: false,
        },
    ],
    governanceActors: [
        {
            id: 1,
            personnel_key: null,
            name: "Learning Admin",
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
    ],
    assignments: [],
    completions: [],
    requests: [],
    reviews: [],
    attempts: [],
    analytics: {},
    competencyCatalog: [],
    roleProfiles: [],
};

describe("Admin Learning production handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        client.state.mockResolvedValue(baseState);
    });

    it("creates and reopens a persistent working Draft from New Course", async () => {
        const user = userEvent.setup();
        const draft = {
            title: "",
            description: "",
            category: "General",
            difficulty: "Beginner",
            language: "English",
            learningObjectives: [""],
            subjectMatterExpertId: null,
            durationOverrideMinutes: null,
            ownerId: 1,
            authorIds: [1],
            reviewerIds: [],
            publisherId: null,
            audience: {
                personTypes: ["Employee"],
                allDepartments: true,
                departments: [],
                positions: [],
                roleProfileIds: [],
                catalogVisibility: "Assigned only",
                defaultDueDays: 30,
                mandatoryDefault: true,
            },
            competencies: [],
            modules: [],
            assessments: [],
            completion: {
                completeRequiredLessons: true,
                passRequiredKnowledgeChecks: true,
                passFinalAssessment: true,
                issueCertificate: false,
                certificateValidityMonths: null,
                renewalIntervalMonths: null,
            },
            id: "version-draft",
            courseId: "course-draft",
            code: "LRN-2026-101",
            status: "Draft",
        };
        client.create.mockResolvedValue({
            versionId: "version-draft",
            courseId: "course-draft",
            code: "LRN-2026-101",
        });
        client.state.mockResolvedValue({
            ...baseState,
            courses: [
                ...baseState.courses,
                {
                    ...course,
                    id: "course-draft",
                    code: "LRN-2026-101",
                    status: "Draft",
                    publishedVersionId: null,
                    draftVersionId: "version-draft",
                    draftDetail: draft,
                },
            ],
        });
        render(<AdminLearning initialLearningState={baseState} />);

        await user.click(screen.getByRole("button", { name: "Courses" }));
        await user.click(screen.getByRole("button", { name: "New Course" }));
        await waitFor(() => expect(client.create).toHaveBeenCalledTimes(1));
        expect(await screen.findByDisplayValue("LRN-2026-101")).toBeVisible();
    });

    it("runs the authorized regrade handler with a mandatory reason", async () => {
        const user = userEvent.setup();
        const state = {
            ...baseState,
            attempts: [
                {
                    id: "attempt-1",
                    status: "Submitted",
                    learner_name: "Alex Learner",
                    course_title: "Safe operations",
                    version_number: 1,
                    assessment_title: "Knowledge Check",
                    attempt_number: 1,
                    submitted_at: "2026-08-13T09:00:00+08:00",
                    score_percent: 70,
                    passed: false,
                },
            ],
        };
        client.regradeAttempt.mockResolvedValue({
            score: 100,
            passed: true,
            attemptNumber: 1,
            assignmentStatus: "Completed",
            completionId: "completion-1",
        });
        client.state.mockResolvedValue({ ...state, attempts: [] });
        render(<AdminLearning initialLearningState={state} />);

        await user.click(
            screen.getByRole("button", {
                name: "Completions & Certificates",
            }),
        );
        await user.click(screen.getByRole("button", { name: "Regrade" }));
        const submit = screen.getByRole("button", {
            name: "Regrade and reconcile",
        });
        expect(submit).toBeDisabled();
        await user.type(
            screen.getByRole("textbox", {
                name: /Required regrade reason/,
            }),
            "Correct deterministic scoring defect",
        );
        await user.click(submit);

        await waitFor(() =>
            expect(client.regradeAttempt).toHaveBeenCalledWith(
                "attempt-1",
                "Correct deterministic scoring defect",
            ),
        );
        expect(client.state).toHaveBeenCalled();
    });

    it("keeps the selected learner and source completion in renewal assignment payloads", async () => {
        const user = userEvent.setup();
        const completion = {
            id: "completion-1",
            learner_id: 7,
            learner_name: "Alex Learner",
            course_id: "course-1",
            title: "Safe operations",
            version_number: 1,
            completed_at: "2026-08-13T09:00:00+08:00",
            completion_basis: "Published online course rules",
            assessment_score: 100,
            certificate_id: "certificate-1",
            certificate_number: "ALB-LRN-001",
            certificate_status: "Valid",
            expires_on: "2027-08-13",
            transcript_id: "transcript-1",
        };
        const state = { ...baseState, completions: [completion] };
        client.assignmentPreview.mockResolvedValue([
            { id: 7, name: "Alex Learner", result: "Eligible" },
        ]);
        client.assign.mockResolvedValue({ assignmentIds: ["assignment-2"] });
        client.state.mockResolvedValue(state);
        render(<AdminLearning initialLearningState={state} />);

        await user.click(
            screen.getByRole("button", {
                name: "Completions & Certificates",
            }),
        );
        await user.click(
            screen.getByRole("button", {
                name: "Create renewal assignment",
            }),
        );
        expect(screen.getByText(/Renewal for/)).toHaveTextContent(
            "Alex Learner",
        );
        await user.click(
            screen.getByRole("button", { name: "Preview exact impact" }),
        );
        await user.click(
            await screen.findByRole("button", {
                name: "Confirm 1 assignment(s)",
            }),
        );

        await waitFor(() => expect(client.assign).toHaveBeenCalledTimes(1));
        expect(client.assign.mock.calls[0][0]).toBe("version-1");
        expect(client.assign.mock.calls[0][1]).toMatchObject({
            learnerIds: [7],
            source: "Reassignment/Renewal",
            sourceCompletionId: "completion-1",
            sourceCertificateId: "certificate-1",
        });
    });
});

describe("Learner LMS player production handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("opens the version-pinned player and records real lesson progress", async () => {
        const user = userEvent.setup();
        const state = {
            ...baseState,
            actor: { id: 7, name: "Alex Learner", role: "user" },
            courses: [],
            assignments: [
                {
                    id: "assignment-1",
                    code: "LRN-2026-001",
                    title: "Safe operations",
                    version_number: 1,
                    status: "Not Started",
                    display_status: "Not Started",
                    progress_percent: 0,
                    is_mandatory: true,
                    source: "Manual Assignment",
                    due_at: "2026-12-31T17:00:00+08:00",
                },
            ],
        };
        const player = {
            assignment: state.assignments[0],
            course: {
                title: "Safe operations",
                status: "Published",
                version_number: 1,
                assessments: [],
            },
            modules: [
                {
                    id: "module-1",
                    title: "Foundation",
                    lessons: [
                        {
                            id: "lesson-1",
                            title: "Required reading",
                            objective: "Apply the safe procedure.",
                            description: "Read the governed lesson.",
                            text_content: "Version-pinned lesson content",
                            is_required: true,
                            materials: [],
                        },
                    ],
                },
            ],
            progress: [],
            attempts: [],
        };
        client.player.mockResolvedValue(player);
        client.recordLesson.mockResolvedValue({
            progress: 100,
            status: "Completed",
        });
        client.state.mockResolvedValue(state);
        render(<LearnerLearning initialLearningState={state} />);

        await user.click(screen.getByRole("button", { name: "Start course" }));
        expect((await screen.findAllByText("Required reading")).length).toBe(2);
        expect(screen.getByText("Version-pinned lesson content")).toBeVisible();
        await user.click(screen.getByRole("button", { name: /Mark Complete/ }));

        await waitFor(() =>
            expect(client.recordLesson).toHaveBeenCalledWith(
                "assignment-1",
                "lesson-1",
                true,
            ),
        );
        expect(client.player).toHaveBeenCalledWith("assignment-1");
    });
});
