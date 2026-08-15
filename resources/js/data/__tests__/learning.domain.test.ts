import { describe, expect, it } from "vitest";
import {
    applyAcceptedAiDraft,
    assessmentErrors,
    canonicalAudiencePersonTypes,
    completionRate,
    draftErrors,
    emptyDraft,
    normalizeAudiencePersonTypes,
    paginate,
    stepState,
    type AssessmentDraft,
    type CourseDraft,
} from "../learning";

const validAssessment = (): AssessmentDraft => ({
    type: "Final Assessment",
    title: "Final",
    required: true,
    passingScore: 80,
    attemptsAllowed: 3,
    shuffleQuestions: false,
    shuffleOptions: false,
    feedbackPolicy: "After submission",
    questions: [
        {
            type: "Multiple Choice",
            text: "Which documented action is correct?",
            points: 1,
            options: [
                { text: "Follow the procedure", correct: true },
                { text: "Ignore the procedure", correct: false },
            ],
        },
    ],
});
const validDraft = (): CourseDraft => ({
    ...emptyDraft(1),
    title: "Persistent course",
    description:
        "A meaningful description for a governed online learning course.",
    learningObjectives: ["Apply the documented procedure correctly."],
    audience: {
        ...emptyDraft(1).audience,
        personTypes: ["Employee"],
    },
    reviewerIds: [2],
    publisherId: 3,
    modules: [
        {
            clientId: "m1",
            title: "Foundation",
            lessons: [
                {
                    title: "Procedure",
                    objective: "Apply the procedure correctly.",
                    contentType: "Text/Reading",
                    textContent: "Durable lesson content.",
                    estimatedMinutes: 10,
                    required: true,
                },
            ],
        },
    ],
    assessments: [validAssessment()],
});

describe("production Learning validation and calculations", () => {
    it("derives exact, sorted, unique non-blank Person Types from canonical personnel", () => {
        expect(
            canonicalAudiencePersonTypes([
                { person_type: "Project Employee" },
                { person_type: "" },
                { person_type: "Trainee" },
                { person_type: "Project Employee" },
                { person_type: "   " },
            ]),
        ).toEqual(["Project Employee", "Trainee"]);
    });
    it("normalizes only known legacy plural Person Types", () => {
        expect(
            normalizeAudiencePersonTypes(
                ["Employees", "Trainees", "Employee"],
                ["Employee", "Trainee"],
            ),
        ).toEqual({
            values: ["Employee", "Trainee"],
            rejected: [],
        });
    });
    it("preserves exact canonical values and rejects unknown Person Types", () => {
        expect(
            normalizeAudiencePersonTypes(
                ["Project Employee", "Invented Type"],
                ["Project Employee"],
            ),
        ).toEqual({
            values: ["Project Employee", "Invented Type"],
            rejected: ["Invented Type"],
        });
    });
    it("accepts a complete publishable draft", () =>
        expect(draftErrors(validDraft())).toEqual([]));
    it("rejects a blank course title", () => {
        const d = validDraft();
        d.title = "";
        expect(draftErrors(d)).toContain("Course title is required.");
    });
    it("rejects a placeholder description", () => {
        const d = validDraft();
        d.description = "short";
        expect(draftErrors(d)).toContain("Provide a meaningful description.");
    });
    it("requires a meaningful learning objective", () => {
        const d = validDraft();
        d.learningObjectives = [""];
        expect(draftErrors(d)).toContain(
            "Add a meaningful learning objective.",
        );
    });
    it("requires canonical person types", () => {
        const d = validDraft();
        d.audience.personTypes = [];
        expect(draftErrors(d)).toContain("Select at least one person type.");
    });
    it("enforces mutually exclusive All Departments", () => {
        const d = validDraft();
        d.audience.allDepartments = true;
        d.audience.departments = ["Finance"];
        expect(draftErrors(d)).toContain(
            "All Departments cannot be combined with individual departments.",
        );
    });
    it("requires a reviewer", () => {
        const d = validDraft();
        d.reviewerIds = [];
        expect(draftErrors(d)).toContain("Assign a reviewer.");
    });
    it("requires a publisher", () => {
        const d = validDraft();
        d.publisherId = null;
        expect(draftErrors(d)).toContain("Assign a publisher.");
    });
    it("requires independent safety review", () => {
        const d = validDraft();
        d.category = "Safety & Compliance";
        d.authorIds = [2];
        d.reviewerIds = [2];
        expect(draftErrors(d)).toContain(
            "Safety & Compliance requires an independent reviewer.",
        );
    });
    it("allows independent safety review", () => {
        const d = validDraft();
        d.category = "Safety & Compliance";
        d.authorIds = [1];
        d.reviewerIds = [2];
        expect(draftErrors(d)).not.toContain(
            "Safety & Compliance requires an independent reviewer.",
        );
    });
    it("requires a curriculum module", () => {
        const d = validDraft();
        d.modules = [];
        expect(draftErrors(d)).toContain("Add at least one curriculum module.");
    });
    it("rejects an empty curriculum module", () => {
        const d = validDraft();
        d.modules[0].lessons = [];
        expect(
            draftErrors(d).some((error) => error.includes("one lesson")),
        ).toBe(true);
    });
    it("requires content in required lessons", () => {
        const d = validDraft();
        d.modules[0].lessons[0].textContent = "";
        expect(draftErrors(d)[0]).toMatch(/needs content/);
    });
    it("allows an optional empty lesson", () => {
        const d = validDraft();
        d.modules[0].lessons[0].required = false;
        d.modules[0].lessons[0].textContent = "";
        expect(draftErrors(d).some((e) => e.includes("needs content"))).toBe(
            false,
        );
    });
    it("requires safe HTTPS external links", () => {
        const d = validDraft();
        Object.assign(d.modules[0].lessons[0], {
            contentType: "External Resource",
            textContent: "",
            externalUrl: "http://unsafe.test",
        });
        expect(draftErrors(d).some((e) => e.includes("must use HTTPS"))).toBe(
            true,
        );
    });
    it("allows a protected material to satisfy required content", () => {
        const d = validDraft();
        Object.assign(d.modules[0].lessons[0], {
            textContent: "",
            materials: [
                {
                    id: "x",
                    displayName: "file.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 100,
                },
            ],
        });
        expect(draftErrors(d).some((e) => e.includes("needs content"))).toBe(
            false,
        );
    });
    it("accepts a valid objective assessment", () =>
        expect(assessmentErrors(validAssessment())).toEqual([]));
    it("allows only one course Final Assessment", () => {
        const d = validDraft();
        d.assessments = [validAssessment(), validAssessment()];
        expect(draftErrors(d)).toContain(
            "Only one Final Assessment is allowed.",
        );
    });
    it("links each Knowledge Check to a curriculum module", () => {
        const d = validDraft();
        d.assessments = [
            {
                ...validAssessment(),
                type: "Knowledge Check",
                title: "Module check",
            },
        ];
        expect(
            draftErrors(d).some((error) => error.includes("must be linked")),
        ).toBe(true);
        d.assessments[0].moduleClientId = "m1";
        expect(
            draftErrors(d).some((error) => error.includes("must be linked")),
        ).toBe(false);
    });
    it("rejects passing scores outside the range", () => {
        const a = validAssessment();
        a.passingScore = 101;
        expect(assessmentErrors(a)).toContain(
            "Passing score must be between 1 and 100.",
        );
    });
    it("rejects invalid attempt limits", () => {
        const a = validAssessment();
        a.attemptsAllowed = 0;
        expect(assessmentErrors(a)).toContain(
            "Attempts allowed must be at least 1.",
        );
    });
    it("rejects empty assessments", () => {
        const a = validAssessment();
        a.questions = [];
        expect(assessmentErrors(a)).toContain("Add at least one question.");
    });
    it("rejects blank question text", () => {
        const a = validAssessment();
        a.questions[0].text = "";
        expect(assessmentErrors(a)).toContain("Question 1 is blank.");
    });
    it("rejects blank answer options", () => {
        const a = validAssessment();
        a.questions[0].options[1].text = "";
        expect(assessmentErrors(a)).toContain(
            "Question 1 requires valid choices.",
        );
    });
    it("rejects duplicate options case-insensitively", () => {
        const a = validAssessment();
        a.questions[0].options[1].text = " FOLLOW THE PROCEDURE ";
        expect(assessmentErrors(a)).toContain(
            "Question 1 has duplicate choices.",
        );
    });
    it("requires a correct answer", () => {
        const a = validAssessment();
        a.questions[0].options.forEach((o) => (o.correct = false));
        expect(assessmentErrors(a)).toContain(
            "Question 1 has no correct answer.",
        );
    });
    it("enforces one correct Multiple Choice option", () => {
        const a = validAssessment();
        a.questions[0].options.forEach((o) => (o.correct = true));
        expect(assessmentErrors(a)).toContain(
            "Question 1 requires exactly one correct answer.",
        );
    });
    it("excludes cancelled assignments from completion rate", () =>
        expect(
            completionRate([
                { status: "Completed" },
                { status: "Not Started" },
                { status: "Cancelled" },
            ]),
        ).toBe(50));
    it("returns zero for no rate denominator", () =>
        expect(completionRate([{ status: "Cancelled" }])).toBe(0));
    it("marks connected step states correctly", () =>
        expect([0, 1, 2].map((i) => stepState(i, 1))).toEqual([
            "completed",
            "current",
            "future",
        ]));
    it("paginates without duplicating rows", () =>
        expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]));
    it("starts new courses as unsaved Draft data", () => {
        const d = emptyDraft(44);
        expect(d.ownerId).toBe(44);
        expect(d.status).toBeUndefined();
        expect(d.versionNumber).toBeUndefined();
    });
    it("applies accepted AI objectives without replacing human objectives", () => {
        const d = validDraft();
        const next = applyAcceptedAiDraft(d, "Learning Objectives", {
            items: ["Explain the approved workflow."],
        });
        expect(next.learningObjectives).toContain(
            "Apply the documented procedure correctly.",
        );
        expect(next.learningObjectives).toContain(
            "Explain the approved workflow.",
        );
    });
    it("does not mutate the source draft when accepting AI output", () => {
        const d = validDraft();
        applyAcceptedAiDraft(d, "Learning Objectives", {
            items: ["Explain the approved workflow."],
        });
        expect(d.learningObjectives).toHaveLength(1);
    });
    it("ignores malformed AI items instead of erasing content", () => {
        const d = validDraft();
        const next = applyAcceptedAiDraft(d, "Learning Objectives", {
            items: [null, 42],
        });
        expect(next.learningObjectives).toEqual(d.learningObjectives);
    });
});