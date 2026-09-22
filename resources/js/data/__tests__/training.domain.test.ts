import { describe, expect, it } from "vitest";
import { canonicalTrainingPersonTypes, normalizeTrainingState, trainingMetrics } from "../training";

const state = () => normalizeTrainingState({
    actor: { id: 1, role: "hr", canManage: true, canFinalize: true },
    integration: {
        workforceAttendance: { status: "Not Connected", sourceSystem: "HR2 Workforce Management", contractVersion: "1.0", ownership: "Supporting evidence" },
        ai: { enabled: false, reason: "Outside Training scope" },
    },
    catalog: { competencies: [], roleProfiles: [], learningCourses: [] },
    personnel: [
        { id: 2, personnelKey: "p-2", employeeId: "E-2", name: "Employee", email: "e@example.test", personType: "Employee", department: "Operations", position: "Operator", role: "user" },
        { id: 3, personnelKey: "p-3", employeeId: "T-3", name: "Trainee", email: "t@example.test", personType: "Trainee", department: "Operations", position: "Graduate Trainee", role: "user" },
    ],
    programs: [{ id: "program-1", code: "TRN-1", title: "Safety", description: "Safety practical", category: "Compliance", deliveryType: "Practical", status: "Active", objectives: ["Apply the procedure"], audienceRules: { personTypes: ["Employee"], departments: [], positions: [], roleProfileIds: [] }, completionRules: { attendanceThreshold: 100, assessmentRequired: true, passingScore: 80, issueCertificate: true, certificateValidityMonths: 12 }, relatedLearningCourseId: null, owner: "HR", competencies: [], sessions: [{ id: "session-1", programId: "program-1", label: "Session 1", startsAt: "2026-08-30T09:00:00+08:00", endsAt: "2026-08-30T16:00:00+08:00", venue: "Training Room", capacity: 20, facilitatorId: 2, facilitator: "Employee", externalFacilitatorName: null, enrollmentClosesAt: null, status: "Scheduled", attendanceFinalizedAt: null, participantCount: 1, cancellationReason: null }], updatedAt: "2026-08-21T12:00:00+08:00" }],
    enrollments: [{ id: "enrollment-1", programId: "program-1", participantId: 2, participant: "Employee", personnelKey: "p-2", employeeId: "E-2", personType: "Employee", department: "Operations", position: "Operator", source: "HR Assignment", status: "Confirmed", assignedAt: "2026-08-21T12:00:00+08:00", sessions: [], assessment: null, completion: null }],
    feedback: [], recommendations: [],
});

describe("Training domain boundary", () => {
    it("keeps HR2 evidence separate and disables Training AI", () => {
        const normalized = state();
        expect(normalized.integration.workforceAttendance.status).toBe("Not Connected");
        expect(normalized.integration.ai.enabled).toBe(false);
    });

    it("derives exact canonical person types", () => {
        expect(canonicalTrainingPersonTypes(state())).toEqual(["Employee", "Trainee"]);
    });

    it("derives metrics from persisted records instead of fixed demo values", () => {
        expect(trainingMetrics(state())).toEqual({ activePrograms: 1, upcomingSessions: 1, enrolled: 1, completionRate: 0 });
    });
});
