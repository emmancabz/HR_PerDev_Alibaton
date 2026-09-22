import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminSuccession from "../../Pages/AdminSuccession";

const client = vi.hoisted(() => ({
    state: vi.fn(), createPosition: vi.fn(), transitionPosition: vi.fn(), nominate: vi.fn(), transitionCandidate: vi.fn(),
    createAssessment: vi.fn(), updateAssessment: vi.fn(), finalizeAssessment: vi.fn(), reopenAssessment: vi.fn(),
    createPlan: vi.fn(), transitionPlan: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(),
}));

vi.mock("@/data/successionClient", () => ({ successionClient: client, successionError: (error: unknown) => error instanceof Error ? error.message : String(error) }));
vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HeaderFilters: () => null,
    HeaderActions: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@inertiajs/react", () => ({ Head: () => null }));

const person = { id: 2, personnelKey: "p-2", employeeId: "EMP-002", name: "Alex Reyes", position: "Operations Supervisor", department: "Operations", personType: "Employee", managerId: null };
const state: any = {
    actor: { id: 1, role: "admin", canManage: true, canFinalize: true },
    personnel: [person],
    positions: [{
        id: "pos-1", positionTitle: "Operations Manager", department: "Operations", criticality: "Critical", status: "Active",
        businessImpact: "Maintains accountable operational continuity.", vacancyRisk: "Single-incumbent dependency.", reviewCycleMonths: 6,
        nextReviewAt: "2026-09-01", incumbent: { ...person, id: 3, personnelKey: "p-3", employeeId: "EMP-003", name: "Jordan Cruz", position: "Operations Manager" },
        requirements: [{ id: 1, type: "Competency", label: "Operational Leadership", targetLevel: 4, required: true, sourceKey: null, sourceVersion: null }],
        coverage: { accepted: 0, readyNow: 0 }, riskFlags: ["No accepted successor", "Review overdue"],
        candidates: [{
            id: "cand-1", positionId: "pos-1", person, status: "Proposed", nominationSource: "Talent Review", rationale: "Verified role exposure.",
            nominatedAt: "2026-09-10", decisionReason: null, latestAssessment: null, assessments: [], plans: [],
        }],
    }],
    metrics: { criticalPositions: 1, coveredPositions: 0, readyNow: 0, positionsAtRisk: 1, activeDevelopmentPlans: 0 },
    governance: { finalizers: ["Admin", "HR"], userSuccessionWorkspace: false, userVisibility: "Hidden", decisionBoundary: "No automatic promotion", ai: { enabled: false, reason: "Deferred" }, certificates: "Source owned" },
    integration: {},
};

describe("Admin Succession Planning", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hash = "#Overview";
        client.state.mockResolvedValue(state);
    });

    it("opens succession position details in the standard modal", async () => {
        const user = userEvent.setup();
        render(<AdminSuccession initialSuccessionState={state} />);

        expect(screen.getByRole("button", { name: /Positions At Risk/i })).toBeVisible();
        expect(screen.getByRole("button", { name: /Needs Admin Review/i })).toBeVisible();
        await user.click(screen.getByRole("button", { name: /Open Operations Manager succession details/i }));
        expect(screen.getByRole("dialog", { name: "Succession Position Details" })).toBeVisible();
        expect(screen.getByText("Position continuity context")).toBeVisible();
        expect(screen.getByText("Successor pipeline")).toBeVisible();
        expect(screen.getByText("Alex Reyes")).toBeVisible();
        expect(screen.getByRole("button", { name: /Review Readiness/i })).toBeVisible();
    });
});
