import axios from "axios";
import {
    normalizeLearningState,
    type CourseDraft,
    type LearningState,
} from "./learning";

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
let learningStateCache: LearningState | null = null;
let learningStateRequest: Promise<LearningState> | null = null;
const LEARNING_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const learningStorageKey = (actorId: number) => `pd:learning-state:v1:${actorId}`;

const readPersistedLearningState = (actorId: number): LearningState | null => {
    if (typeof window === "undefined" || !Number.isFinite(actorId) || actorId < 1) return null;
    try {
        const raw = window.sessionStorage.getItem(learningStorageKey(actorId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
        if (!parsed.savedAt || Date.now() - parsed.savedAt > LEARNING_CACHE_MAX_AGE_MS) {
            window.sessionStorage.removeItem(learningStorageKey(actorId));
            return null;
        }
        const state = normalizeLearningState(parsed.state);
        return Number(state.actor.id) === actorId ? state : null;
    } catch {
        window.sessionStorage.removeItem(learningStorageKey(actorId));
        return null;
    }
};

const rememberLearningState = (state: LearningState): LearningState => {
    learningStateCache = state;
    if (typeof window !== "undefined" && Number(state.actor.id) > 0) {
        try {
            window.sessionStorage.setItem(
                learningStorageKey(Number(state.actor.id)),
                JSON.stringify({ savedAt: Date.now(), state }),
            );
        } catch {
            // Browser storage is only a speed-up; API state remains authoritative.
        }
    }
    return state;
};

const stateResponse = (response: { data: { data: unknown } }): LearningState =>
    rememberLearningState(normalizeLearningState(unwrap<unknown>(response)));

async function fetchLearningState(): Promise<LearningState> {
    if (learningStateRequest) return learningStateRequest;
    learningStateRequest = axios.get("/learning/api/state", { timeout: 20_000 })
        .then(stateResponse)
        .finally(() => { learningStateRequest = null; });
    return learningStateRequest;
}
export const learningClient = {
    peekState: (actorId?: number) => {
        if (learningStateCache && (!actorId || Number(learningStateCache.actor.id) === actorId)) return learningStateCache;
        if (!actorId) return null;
        const persisted = readPersistedLearningState(actorId);
        if (persisted) learningStateCache = persisted;
        return persisted;
    },
    state: fetchLearningState,
    create: async (draft: CourseDraft) =>
        unwrap<{ versionId: string; courseId: string; code: string }>(
            await axios.post("/learning/api/courses", draft),
        ),
    save: async (versionId: string, draft: CourseDraft) =>
        unwrap<{
            versionId: string;
            courseId: string;
            status: string;
            workingStage: number;
        }>(
            await axios.put(`/learning/api/versions/${versionId}`, draft),
        ),
    submitReview: async (versionId: string) =>
        stateResponse(
            await axios.post(`/learning/api/versions/${versionId}/review`),
        ),
    decideReview: async (
        versionId: string,
        decision: "Approved" | "Changes Requested",
        comment: string,
    ) =>
        stateResponse(
            await axios.post(
                `/learning/api/versions/${versionId}/review-decision`,
                { decision, comment },
            ),
        ),
    publish: async (versionId: string) =>
        stateResponse(
            await axios.post(`/learning/api/versions/${versionId}/publish`),
        ),
    sourceReview: async (versionId: string) =>
        stateResponse(
            await axios.post(`/learning/api/versions/${versionId}/source-review`),
        ),
    retryPublication: async (versionId: string) =>
        stateResponse(
            await axios.post(`/learning/api/versions/${versionId}/publication-retry`),
        ),
    createWorkingDraft: async (versionId: string) =>
        unwrap<{ versionId: string; courseId: string }>(
            await axios.post(
                `/learning/api/versions/${versionId}/working-draft`,
            ),
        ),
    archive: async (courseId: string) =>
        stateResponse(
            await axios.post(`/learning/api/courses/${courseId}/archive`),
        ),
    deleteDraft: async (versionId: string) => {
        await axios.delete(`/learning/api/versions/${versionId}/draft`);
        return learningClient.state();
    },
    assignmentPreview: async (versionId: string, learnerIds: number[]) =>
        unwrap<any[]>(
            await axios.post(
                `/learning/api/versions/${versionId}/assignment-preview`,
                { learnerIds },
            ),
        ),
    assign: async (versionId: string, payload: Record<string, unknown>) =>
        unwrap<{ assignmentIds: string[] }>(
            await axios.post(
                `/learning/api/versions/${versionId}/assign`,
                payload,
            ),
        ),
    cancelAssignment: async (assignmentId: string, reason: string) =>
        stateResponse(
            await axios.post(
                `/learning/api/assignments/${assignmentId}/cancel`,
                { reason },
            ),
        ),
    migrateAssignment: async (
        assignmentId: string,
        targetVersionId: string,
        reason: string,
    ) =>
        unwrap<{ assignmentId: string }>(
            await axios.post(
                `/learning/api/assignments/${assignmentId}/migrate`,
                { targetVersionId, reason },
            ),
        ),
    actRequest: async (id: string, payload: Record<string, unknown>) =>
        stateResponse(
            await axios.post(
                `/learning/api/recommendations/${id}/action`,
                payload,
            ),
        ),
    selfEnroll: async (versionId: string) =>
        unwrap<{ assignmentId: string }>(
            await axios.post(`/learning/api/versions/${versionId}/self-enroll`),
        ),
    player: async (assignmentId: string) =>
        unwrap<any>(
            await axios.get(`/learning/api/assignments/${assignmentId}/player`),
        ),
    recordLesson: async (
        assignmentId: string,
        lessonId: string,
        completed: boolean,
    ) =>
        unwrap<any>(
            await axios.put(
                `/learning/api/assignments/${assignmentId}/lesson-progress`,
                { lessonId, completed, timeSpentSeconds: 0 },
            ),
        ),
    startAttempt: async (assignmentId: string, assessmentId: string) =>
        unwrap<any>(
            await axios.post(
                `/learning/api/assignments/${assignmentId}/assessments/${assessmentId}/attempts`,
            ),
        ),
    submitAttempt: async (attemptId: string, responses: any[]) =>
        unwrap<any>(
            await axios.post(`/learning/api/attempts/${attemptId}/submit`, {
                responses,
            }),
        ),
    saveResponses: async (attemptId: string, responses: any[]) =>
        unwrap<any>(
            await axios.put(`/learning/api/attempts/${attemptId}/responses`, {
                responses,
            }),
        ),
    aiGenerate: async (
        versionId: string,
        useCase: string,
        context: Record<string, unknown>,
    ) =>
        unwrap<any>(
            await axios.post(`/learning/api/versions/${versionId}/ai`, {
                useCase,
                context,
            }),
        ),
    aiDecide: async (
        eventId: string,
        decision: "Accepted" | "Rejected",
        acceptedOutput?: any,
    ) =>
        unwrap<any>(
            await axios.post(`/learning/api/ai/${eventId}/decision`, {
                decision,
                acceptedOutput,
            }),
        ),
    uploadMaterial: async (
        lessonId: string,
        file: File,
        onProgress?: (percent: number) => void,
    ) => {
        const body = new FormData();
        body.append("file", file);
        return unwrap<{
            id: string;
            displayName: string;
            mimeType: string;
            sizeBytes: number;
            downloadUrl?: string;
        }>(
            await axios.post(
                `/learning/api/lessons/${lessonId}/materials`,
                body,
                {
                    timeout: 120_000,
                    onUploadProgress: (event) => {
                        if (!onProgress || !event.total) return;
                        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
                    },
                },
            ),
        );
    },
    uploadThumbnail: async (
        versionId: string,
        file: File,
        onProgress?: (percent: number) => void,
    ) => {
        const body = new FormData();
        body.append("thumbnail", file);
        return unwrap<{ thumbnailUrl: string }>(
            await axios.post(
                `/learning/api/versions/${versionId}/thumbnail`,
                body,
                {
                    timeout: 120_000,
                    onUploadProgress: (event) => {
                        if (!onProgress || !event.total) return;
                        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
                    },
                },
            ),
        );
    },
    revokeMaterial: async (materialId: string) =>
        unwrap<any>(
            await axios.delete(`/learning/api/materials/${materialId}`),
        ),
    issueCertificate: async (completionId: string) => {
        await axios.post(`/learning/api/completions/${completionId}/certificate`);
        return learningClient.state();
    },
    revokeCertificate: async (certificateId: string, reason: string) =>
        stateResponse(
            await axios.post(
                `/learning/api/certificates/${certificateId}/revoke`,
                { reason },
            ),
        ),
    regradeAttempt: async (attemptId: string, reason: string) =>
        unwrap<{
            score: number;
            passed: boolean;
            attemptNumber: number;
            assignmentStatus: string;
            completionId: string | null;
        }>(
            await axios.post(`/learning/api/attempts/${attemptId}/regrade`, {
                reason,
            }),
        ),
};

export function learningError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
            return "Learning data took too long to load. Please retry.";
        }
        const errors = error.response?.data?.errors as
            | Record<string, string[]>
            | undefined;
        if (errors) return Object.values(errors).flat().join(" ");
        return error.response?.data?.message ?? "The Learning request failed.";
    }
    return error instanceof Error
        ? error.message
        : "The Learning request failed.";
}
