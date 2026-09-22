export const RECOGNITION_ADMIN_WORKSPACES = [
    "Overview", "Review Queue", "Recognition Register",
] as const;
export const RECOGNITION_USER_WORKSPACES = [
    "Recognition Feed", "Company Leaderboard", "My Recognitions", "Nominate a Colleague", "My Submissions",
] as const;

export type RecognitionAdminWorkspace = (typeof RECOGNITION_ADMIN_WORKSPACES)[number];
export type RecognitionUserWorkspace = (typeof RECOGNITION_USER_WORKSPACES)[number];
export type RecognitionStatus = "Draft" | "Pending Review" | "Recognized" | "Declined" | "Revoked";

export type RecognitionPerson = {
    id: number; personnelKey: string; employeeId: string | null; name: string; position: string | null;
    department: string | null; personType?: string | null; role?: string;
};
export type RecognitionCategory = {
    id: string; code: string; name: string; description: string | null; color: string; icon: string;
    isActive: boolean; displayOrder: number;
};
export type RecognitionEvidence = {
    id?: string; type: string; sourceModule: string | null; sourceRecordId: string | null;
    sourceFinalizedAt: string | null; description: string | null;
};
export type RecognitionRecord = {
    id: string; recipient: RecognitionPerson; nominator: RecognitionPerson; category: RecognitionCategory | null;
    title: string; achievementDetails: string; achievementDate: string; status: RecognitionStatus;
    submittedAt: string | null; reviewedAt: string | null; recognizedAt: string | null; revokedAt: string | null;
    declineReason: string | null; revocationReason: string | null; replacesId: string | null;
    evidence: RecognitionEvidence[]; createdAt: string | null;
};
export type RecognitionLeaderboardRow = {
    personnelKey: string; name: string; position: string; department: string; count: number; latestRecognizedAt: string | null;
};
export type RecognitionPeriod = "All Time" | "This Month" | "This Quarter" | "This Year";
export type RecognitionAudit = {
    id: string; eventType: string; actor: string | null; subjectType: string; subjectId: string;
    metadata: Record<string, unknown>; occurredAt: string;
};
export type RecognitionState = {
    actor: { id: number; role: "admin" | "hr" | "user"; name: string; personnelKey: string | null; canReview: boolean; canManageCategories: boolean; canNominate: boolean };
    personnel: RecognitionPerson[]; categories: RecognitionCategory[]; records: RecognitionRecord[];
    leaderboard: RecognitionLeaderboardRow[];
    metrics: { recognized: number; thisMonth: number; peopleRecognized: number; pendingReview: number | null };
    analytics: { monthlyTrend: Array<{ key: string; label: string; count: number }>; byDepartment: Record<string, number>; byCategory: Record<string, number> };
    audit: RecognitionAudit[];
    governance: { nominators: string[]; finalizers: string[]; selfRecognitionAllowed: false; publishedRecordsImmutable: true; userVisibility: string; crossModuleImpact: string; certificates: string; ai: { enabled: false; reason: string } };
};

export type RecognitionDraft = {
    recipientId: number | null; categoryId: string; title: string; achievementDetails: string;
    achievementDate: string; saveAsDraft: boolean; replacesId?: string | null;
    evidence: Array<{ type: string; sourceModule: string | null; sourceRecordId: string | null; sourceFinalizedAt: string | null; description: string }>;
};

export function emptyRecognitionDraft(categoryId = ""): RecognitionDraft {
    return { recipientId: null, categoryId, title: "", achievementDetails: "", achievementDate: new Date().toISOString().slice(0, 10), saveAsDraft: false, evidence: [] };
}

export function recognitionDraftFromRecord(record: RecognitionRecord, replacement = false): RecognitionDraft {
    return {
        recipientId: record.recipient.id,
        categoryId: record.category?.id ?? "",
        title: record.title,
        achievementDetails: record.achievementDetails,
        achievementDate: record.achievementDate,
        saveAsDraft: record.status === "Draft",
        replacesId: replacement ? record.id : null,
        evidence: record.evidence
            .filter((item) => !item.sourceModule)
            .map((item) => ({
                type: item.type || "Supporting Note",
                sourceModule: null,
                sourceRecordId: null,
                sourceFinalizedAt: null,
                description: item.description ?? "",
            })),
    };
}

export function normalizeRecognitionState(value: unknown): RecognitionState {
    if (!value || typeof value !== "object") throw new Error("Recognition state is unavailable.");
    const state = value as RecognitionState;
    if (!state.actor || !Array.isArray(state.personnel) || !Array.isArray(state.categories) || !Array.isArray(state.records) || !Array.isArray(state.leaderboard) || !state.metrics || !state.analytics || !state.governance) {
        throw new Error("Recognition state is incomplete.");
    }
    return state;
}

export function publicFeed(state: RecognitionState): RecognitionRecord[] {
    return state.records.filter((record) => record.status === "Recognized").sort((a, b) => (b.recognizedAt ?? "").localeCompare(a.recognizedAt ?? ""));
}

export function ownRecognitions(state: RecognitionState): RecognitionRecord[] {
    if (!state.actor.personnelKey) return [];
    return state.records.filter((record) => record.recipient.personnelKey === state.actor.personnelKey && record.status === "Recognized");
}

export function ownSubmissions(state: RecognitionState): RecognitionRecord[] {
    return state.records.filter((record) => record.nominator.id === state.actor.id);
}

export function leaderboardForPeriod(records: RecognitionRecord[], period: RecognitionPeriod, now = new Date()): RecognitionLeaderboardRow[] {
    const approved = records.filter((record) => {
        if (record.status !== "Recognized" || !record.recognizedAt) return false;
        if (period === "All Time") return true;
        const date = new Date(record.recognizedAt);
        if (date.getFullYear() !== now.getFullYear()) return false;
        if (period === "This Year") return true;
        if (period === "This Month") return date.getMonth() === now.getMonth();
        return Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
    });
    const grouped = new Map<string, RecognitionLeaderboardRow>();
    approved.forEach((record) => {
        const key = record.recipient.personnelKey;
        const existing = grouped.get(key);
        grouped.set(key, {
            personnelKey: key, name: record.recipient.name, position: record.recipient.position ?? "",
            department: record.recipient.department ?? "", count: (existing?.count ?? 0) + 1,
            latestRecognizedAt: !existing?.latestRecognizedAt || record.recognizedAt! > existing.latestRecognizedAt ? record.recognizedAt : existing.latestRecognizedAt,
        });
    });
    return [...grouped.values()].sort((left, right) => right.count - left.count || (right.latestRecognizedAt ?? "").localeCompare(left.latestRecognizedAt ?? "") || left.name.localeCompare(right.name));
}

export function denseRank(rows: RecognitionLeaderboardRow[], row: RecognitionLeaderboardRow): number {
    return [...new Set(rows.filter((candidate) => candidate.count > row.count).map((candidate) => candidate.count))].length + 1;
}
