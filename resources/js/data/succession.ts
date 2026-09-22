export const SUCCESSION_WORKSPACES = ["Overview", "Succession Register", "Readiness Reviews"] as const;
export type SuccessionWorkspace = (typeof SUCCESSION_WORKSPACES)[number];
export type Criticality = "Critical" | "High" | "Moderate";
export type ReadinessBand = "Ready Now" | "Ready Soon" | "Developing" | "Needs Significant Development";

export type SuccessionPerson = { id: number; personnelKey: string; employeeId: string; name: string; position: string; department: string; personType: string; managerId: number | null };
export type SuccessRequirement = { id?: number; type: string; label: string; targetLevel: number | null; required: boolean; sourceKey?: string | null; sourceVersion?: string | null };
export type ReadinessAssessment = {
    id: string; version: number; status: "Draft" | "Finalized"; readinessBand: ReadinessBand | null;
    reviewerSummary: string | null; developmentNeeds: string[]; riskFlags: string[];
    performance: { records?: unknown[] }; competency: { records?: unknown[]; contractStatus?: string };
    learning: { records?: unknown[] }; training: { records?: unknown[] }; finalizedAt: string | null; finalizedBy: number | null;
};
export type DevelopmentAction = { id: string; actionType: string; title: string; description: string | null; sourceModule: string | null; sourceRecordId: string | null; status: string; dueOn: string | null; evidence: Record<string, unknown> };
export type DevelopmentPlan = { id: string; status: string; title: string; objective: string; startsOn: string | null; targetDate: string | null; owner: string | null; actions: DevelopmentAction[] };
export type SuccessionCandidate = {
    id: string; positionId: string; person: SuccessionPerson; status: string; nominationSource: string; rationale: string;
    nominatedAt: string | null; decisionReason: string | null; latestAssessment: ReadinessAssessment | null;
    assessments: ReadinessAssessment[]; plans: DevelopmentPlan[];
};
export type CriticalPosition = {
    id: string; positionTitle: string; department: string; criticality: Criticality; status: string;
    businessImpact: string; vacancyRisk: string | null; reviewCycleMonths: number; nextReviewAt: string | null;
    incumbent: SuccessionPerson | null; requirements: SuccessRequirement[]; candidates: SuccessionCandidate[];
    coverage: { accepted: number; readyNow: number }; riskFlags: string[];
};
export type SuccessionState = {
    actor: { id: number; role: "admin" | "hr"; canManage: boolean; canFinalize: boolean };
    personnel: SuccessionPerson[]; positions: CriticalPosition[];
    metrics: { criticalPositions: number; coveredPositions: number; readyNow: number; positionsAtRisk: number; activeDevelopmentPlans: number };
    governance: { finalizers: string[]; userSuccessionWorkspace: false; userVisibility: string; decisionBoundary: string; ai: { enabled: false; reason: string }; certificates: string };
    integration: Record<string, string>;
};

export type PositionDraft = {
    positionTitle: string; department: string; criticality: Criticality; incumbentId: number | null;
    businessImpact: string; vacancyRisk: string; reviewCycleMonths: number; nextReviewAt: string;
    requirements: Array<{ type: string; label: string; targetLevel: number | null; required: boolean; sourceKey: string | null; sourceVersion: string | null }>;
};

export const emptyPositionDraft = (): PositionDraft => ({
    positionTitle: "", department: "", criticality: "High", incumbentId: null, businessImpact: "", vacancyRisk: "",
    reviewCycleMonths: 6, nextReviewAt: "", requirements: [{ type: "Competency", label: "", targetLevel: 3, required: true, sourceKey: null, sourceVersion: null }],
});

export function normalizeSuccessionState(value: unknown): SuccessionState {
    if (!value || typeof value !== "object") throw new Error("Succession state is unavailable.");
    const state = value as SuccessionState;
    if (!Array.isArray(state.positions) || !Array.isArray(state.personnel) || !state.metrics || !state.governance) throw new Error("Succession state is incomplete.");
    return state;
}

export function allCandidates(state: SuccessionState): SuccessionCandidate[] {
    return state.positions.flatMap((position) => position.candidates);
}

export function readinessDistribution(state: SuccessionState): Record<string, number> {
    const output: Record<string, number> = { "Ready Now": 0, "Ready Soon": 0, Developing: 0, "Needs Significant Development": 0, "Not Assessed": 0 };
    allCandidates(state).filter((candidate) => candidate.status === "Accepted").forEach((candidate) => {
        output[candidate.latestAssessment?.readinessBand ?? "Not Assessed"] += 1;
    });
    return output;
}
