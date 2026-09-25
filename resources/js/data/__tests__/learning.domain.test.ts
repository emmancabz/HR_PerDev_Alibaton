import { describe, expect, it } from "vitest";
import {
    applyAcceptedAiDraft,
    assessmentErrors,
    canonicalAudiencePersonTypes,
    completionRate,
    draftErrors,
    emptyDraft,
    normalizeAudiencePersonTypes,
    normalizeCourseDraft,
    normalizeLearningState,
    paginate,
    stepState,
    type AssessmentDraft,
    type CourseDraft,
} from "../learning";

const assessment = (type: AssessmentDraft["type"]): AssessmentDraft => ({
    type,
    title: type,
    required: type !== "Pre-Test",
    passingScore: 80,
    attemptsAllowed: type === "Pre-Test" ? 1 : 3,
    shuffleQuestions: false,
    shuffleOptions: false,
    feedbackPolicy: "After submission",
    moduleClientId: null,
    questions: [{
        type: "Multiple Choice",
        text: "Which documented action is correct?",
        explanation: "Follow the approved procedure.",
        points: 1,
        options: [
            { text: "Follow the procedure", correct: true },
            { text: "Ignore the procedure", correct: false },
        ],
    }],
});

const validDraft = (): CourseDraft => ({
    ...emptyDraft(4),
    title: "Persistent course",
    description: "A meaningful description for a governed online learning course.",
    learningObjectives: ["Apply the documented procedure correctly."],
    sourceDocumentIds: ["ALB-PND-SOP-002"],
    audience: {
        ...emptyDraft(4).audience,
        personTypes: ["Employee"],
        allDepartments: false,
        departments: ["Operations"],
    },
    modules: [{
        clientId: "m1",
        title: "Foundation",
        description: "Foundation module",
        lessons: [{
            title: "Procedure",
            objective: "Apply the procedure correctly.",
            description: "Read the governed procedure.",
            contentType: "Text/Reading",
            textContent: "Durable lesson content.",
            externalUrl: "",
            estimatedMinutes: 10,
            required: true,
        }],
    }],
    assessments: [{ ...assessment("Knowledge Check"), title: "Module check", moduleClientId: "m1" }],
});

describe("final Learning domain rules", () => {
    it("normalizes nullable persisted draft fields before validation", () => {
        const normalized = normalizeCourseDraft({
            id: "version-1",
            courseId: "course-1",
            code: "LRN-2026-001",
            status: "Draft",
            workingStage: 3,
            title: null,
            description: null,
            learningObjectives: [null],
            sourceDocumentIds: null,
            audience: null,
            modules: null,
            assessments: null,
            completion: null,
        }, 4);
        expect(normalized).toMatchObject({ title: "", description: "", sourceDocumentIds: [] });
        expect(normalized.learningObjectives).toEqual([""]);
        expect(() => draftErrors(normalized)).not.toThrow();
    });

    it("normalizes nested course drafts at the Learning state boundary", () => {
        const normalized = normalizeLearningState({
            actor: { id: 4, name: "HR", role: "hr" },
            courses: [{
                id: "course-1",
                code: "LRN-2026-001",
                status: "Draft",
                draftDetail: { id: "version-1", courseId: "course-1", code: "LRN-2026-001", title: "Persisted title", description: null },
            }],
        });
        expect(normalized.courses[0].draftDetail).toMatchObject({ title: "Persisted title", description: "", sourceDocumentIds: [] });
        expect(normalized.sourceLibrary).toEqual([]);
    });

    it("derives exact sorted unique person types from learner personnel", () => {
        expect(canonicalAudiencePersonTypes([
            { person_type: "Project Employee" },
            { person_type: "Trainee" },
            { person_type: "Project Employee" },
        ])).toEqual(["Project Employee", "Trainee"]);
    });

    it("normalizes only known legacy plural person types", () => {
        expect(normalizeAudiencePersonTypes([" employees ", "TRAINEES"], ["Employee", "Trainee"]))
            .toEqual({ values: ["Employee", "Trainee"], rejected: [] });
    });

    it("accepts a complete department-grounded draft", () => {
        expect(draftErrors(validDraft())).toEqual([]);
    });

    it("requires a target audience and at least one source document", () => {
        const d = validDraft();
        d.audience.personTypes = [];
        d.sourceDocumentIds = [];
        expect(draftErrors(d)).toContain("Select at least one person type.");
        expect(draftErrors(d)).toContain("Select at least one source document.");
    });

    it("does not require Pre-Test or Post-Test inside the LMS course draft", () => {
        const d = validDraft();
        d.assessments = [];
        expect(draftErrors(d)).not.toContain("Add one Pre-Test.");
        expect(draftErrors(d)).not.toContain("Add one Post-Test.");
    });

    it("links every Knowledge Check to a curriculum module", () => {
        const d = validDraft();
        d.assessments = [{ ...assessment("Knowledge Check"), title: "Module check" }];
        expect(draftErrors(d).some((error) => error.includes("must be linked"))).toBe(true);
        d.assessments[0].moduleClientId = "m1";
        expect(draftErrors(d).some((error) => error.includes("must be linked"))).toBe(false);
    });

    it("keeps legacy external assessments course-wide when older data is loaded", () => {
        const d = validDraft();
        d.assessments = [{ ...assessment("Pre-Test"), moduleClientId: "m1" }];
        expect(draftErrors(d)).toContain("Pre-Test must apply to the whole course.");
    });

    it("requires curriculum content and HTTPS external resources", () => {
        const d = validDraft();
        d.modules[0].lessons[0].textContent = "";
        expect(draftErrors(d).some((error) => error.includes("needs content"))).toBe(true);
        Object.assign(d.modules[0].lessons[0], { contentType: "External Resource", externalUrl: "http://unsafe.test" });
        expect(draftErrors(d).some((error) => error.includes("must use HTTPS"))).toBe(true);
    });

    it("validates objective assessment integrity", () => {
        const a = assessment("Knowledge Check");
        expect(assessmentErrors(a)).toEqual([]);
        a.questions[0].options.forEach((option) => { option.correct = false; });
        expect(assessmentErrors(a)).toContain("Question 1 has no correct answer.");
    });

    it("rejects duplicate choices case-insensitively", () => {
        const a = assessment("Knowledge Check");
        a.questions[0].options[1].text = " FOLLOW THE PROCEDURE ";
        expect(assessmentErrors(a)).toContain("Question 1 has duplicate choices.");
    });

    it("excludes cancelled assignments from completion-rate denominator", () => {
        expect(completionRate([{ status: "Completed" }, { status: "Not Started" }, { status: "Cancelled" }])).toBe(50);
        expect(completionRate([{ status: "Cancelled" }])).toBe(0);
    });

    it("paginates and marks builder step state deterministically", () => {
        expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
        expect([0, 1, 2].map((index) => stepState(index, 1))).toEqual(["completed", "current", "future"]);
    });

    it("starts a new HR course as unsaved draft data", () => {
        const d = emptyDraft(44);
        expect(d.ownerId).toBe(44);
        expect(d.status).toBeUndefined();
        expect(d.sourceDocumentIds).toEqual([]);
    });

    it("adds accepted Aevyn outline content without erasing human content", () => {
        const d = validDraft();
        const next = applyAcceptedAiDraft(d, "Course Outline", {
            items: [{ title: "Handover controls", lessons: ["Shift briefing", "Logbook validation"] }],
        });
        expect(next.modules.some((module) => module.title === "Handover controls")).toBe(true);
        expect(d.modules).toHaveLength(1);
    });
});
