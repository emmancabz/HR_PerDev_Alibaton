import { describe, expect, it } from "vitest";
import { denseRank, emptyRecognitionDraft, leaderboardForPeriod, normalizeRecognitionState, ownRecognitions, ownSubmissions, publicFeed, type RecognitionState } from "../recognition";

const state = {
    actor: { id: 7, role: "user", name: "Employee", personnelKey: "P-7", canReview: false, canManageCategories: false, canNominate: true },
    personnel: [], categories: [], leaderboard: [], audit: [],
    metrics: { recognized: 1, thisMonth: 1, peopleRecognized: 1, pendingReview: null },
    analytics: { monthlyTrend: [], byDepartment: {}, byCategory: {} },
    governance: { nominators: ["Admin", "HR", "User"], finalizers: ["Admin", "HR"], selfRecognitionAllowed: false, publishedRecordsImmutable: true, userVisibility: "", crossModuleImpact: "", certificates: "", ai: { enabled: false, reason: "" } },
    records: [
        { id: "r1", recipient: { id: 7, personnelKey: "P-7", employeeId: "E-7", name: "Employee", position: "Staff", department: "Operations" }, nominator: { id: 8, personnelKey: "P-8", employeeId: "E-8", name: "Colleague", position: "Staff", department: "Operations" }, category: null, title: "Recognized work", achievementDetails: "Verified details", achievementDate: "2026-08-20", status: "Recognized", submittedAt: null, reviewedAt: null, recognizedAt: "2026-08-21T00:00:00Z", revokedAt: null, declineReason: null, revocationReason: null, replacesId: null, evidence: [], createdAt: null },
        { id: "r2", recipient: { id: 8, personnelKey: "P-8", employeeId: "E-8", name: "Colleague", position: "Staff", department: "Operations" }, nominator: { id: 7, personnelKey: "P-7", employeeId: "E-7", name: "Employee", position: "Staff", department: "Operations" }, category: null, title: "Pending work", achievementDetails: "Verified details", achievementDate: "2026-08-20", status: "Pending Review", submittedAt: null, reviewedAt: null, recognizedAt: null, revokedAt: null, declineReason: null, revocationReason: null, replacesId: null, evidence: [], createdAt: null },
    ],
} as RecognitionState;

describe("recognition domain", () => {
    it("normalizes a complete persistent state", () => expect(normalizeRecognitionState(state).actor.role).toBe("user"));
    it("shows only published records in the public feed", () => expect(publicFeed(state).map((record) => record.id)).toEqual(["r1"]));
    it("derives personal recognition and submission views", () => {
        expect(ownRecognitions(state).map((record) => record.id)).toEqual(["r1"]);
        expect(ownSubmissions(state).map((record) => record.id)).toEqual(["r2"]);
    });
    it("starts a nomination without fabricated identity fields", () => {
        const draft = emptyRecognitionDraft("category-1");
        expect(draft.categoryId).toBe("category-1");
        expect(draft.recipientId).toBeNull();
        expect(draft).not.toHaveProperty("reviewerRole");
    });
    it("uses published counts and dense ranks without hidden points", () => {
        const rows = leaderboardForPeriod(state.records, "This Month", new Date("2026-08-21T00:00:00Z"));
        expect(rows[0].count).toBe(1);
        expect(denseRank(rows, rows[0])).toBe(1);
    });
});
