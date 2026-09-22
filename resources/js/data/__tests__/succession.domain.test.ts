import { describe, expect, it } from "vitest";
import { allCandidates, emptyPositionDraft, normalizeSuccessionState, readinessDistribution, type SuccessionState } from "../succession";

const state = {
    actor: { id: 1, role: "admin", canManage: true, canFinalize: true }, personnel: [],
    positions: [{ id: "p1", positionTitle: "Operations Manager", department: "Operations", criticality: "Critical", status: "Active", businessImpact: "Continuity", vacancyRisk: null, reviewCycleMonths: 6, nextReviewAt: null, incumbent: null, requirements: [], riskFlags: [], coverage: { accepted: 1, readyNow: 1 }, candidates: [{ id: "c1", positionId: "p1", person: { id: 2, personnelKey: "person", employeeId: "E-2", name: "Candidate", position: "Supervisor", department: "Operations", personType: "Employee", managerId: null }, status: "Accepted", nominationSource: "HR Nomination", rationale: "Verified", nominatedAt: null, decisionReason: "Approved", latestAssessment: { id: "a1", version: 1, status: "Finalized", readinessBand: "Ready Now", reviewerSummary: "Reviewed", developmentNeeds: [], riskFlags: [], performance: { records: [] }, competency: { records: [] }, learning: { records: [] }, training: { records: [] }, finalizedAt: null, finalizedBy: 1 }, assessments: [], plans: [] }] }],
    metrics: { criticalPositions: 1, coveredPositions: 1, readyNow: 1, positionsAtRisk: 0, activeDevelopmentPlans: 0 },
    governance: { finalizers: ["Admin", "HR"], userSuccessionWorkspace: false, userVisibility: "Hidden", decisionBoundary: "No automatic promotion", ai: { enabled: false, reason: "Deferred" }, certificates: "Sources own certificates" }, integration: {},
} satisfies SuccessionState;

describe("succession domain", () => {
    it("normalizes complete persistent state", () => expect(normalizeSuccessionState(state).positions).toHaveLength(1));
    it("flattens confidential candidates", () => expect(allCandidates(state)[0].person.name).toBe("Candidate"));
    it("derives readiness from finalized pipeline data", () => expect(readinessDistribution(state)["Ready Now"]).toBe(1));
    it("starts a critical position as a draft with a governed requirement row", () => expect(emptyPositionDraft().requirements).toHaveLength(1));
});
