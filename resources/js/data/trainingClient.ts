import axios from "axios";
import { normalizeTrainingState, type TrainingProgramDraft, type TrainingState } from "./training";

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
let trainingStateCache: TrainingState | null = null;
let trainingStateRequest: Promise<TrainingState> | null = null;
const TRAINING_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const trainingStorageKey = (actorId: number) => `pd:training-state:v1:${actorId}`;

const readPersistedTrainingState = (actorId: number): TrainingState | null => {
    if (typeof window === "undefined" || !Number.isFinite(actorId) || actorId < 1) return null;
    try {
        const raw = window.sessionStorage.getItem(trainingStorageKey(actorId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
        if (!parsed.savedAt || Date.now() - parsed.savedAt > TRAINING_CACHE_MAX_AGE_MS) {
            window.sessionStorage.removeItem(trainingStorageKey(actorId));
            return null;
        }
        const state = normalizeTrainingState(parsed.state);
        return Number(state.actor.id) === actorId ? state : null;
    } catch {
        window.sessionStorage.removeItem(trainingStorageKey(actorId));
        return null;
    }
};

const rememberTrainingState = (state: TrainingState): TrainingState => {
    trainingStateCache = state;
    if (typeof window !== "undefined" && Number(state.actor.id) > 0) {
        try {
            window.sessionStorage.setItem(
                trainingStorageKey(Number(state.actor.id)),
                JSON.stringify({ savedAt: Date.now(), state }),
            );
        } catch {
            // Browser storage is only a speed-up; API state remains authoritative.
        }
    }
    return state;
};
const stateResponse = (response: { data: { data: unknown } }): TrainingState => rememberTrainingState(normalizeTrainingState(unwrap(response)));

async function fetchTrainingState(): Promise<TrainingState> {
    if (trainingStateRequest) return trainingStateRequest;
    trainingStateRequest = axios.get("/training/api/state", { timeout: 20_000 })
        .then(stateResponse)
        .finally(() => { trainingStateRequest = null; });
    return trainingStateRequest;
}

export const trainingClient = {
    peekState: (actorId?: number) => {
        if (trainingStateCache && (!actorId || Number(trainingStateCache.actor.id) === actorId)) return trainingStateCache;
        if (!actorId) return null;
        const persisted = readPersistedTrainingState(actorId);
        if (persisted) trainingStateCache = persisted;
        return persisted;
    },
    state: fetchTrainingState,
    scheduleLearningCourse: async (courseId: string, sessions: Record<string, unknown>[]) => stateResponse(await axios.post(`/training/api/learning-courses/${courseId}/schedule`, { sessions })),
    createProgram: async (payload: TrainingProgramDraft) => unwrap<{ programId: string; code: string }>(await axios.post("/training/api/programs", payload)),
    updateProgram: async (id: string, payload: TrainingProgramDraft) => stateResponse(await axios.put(`/training/api/programs/${id}`, payload)),
    transitionProgram: async (id: string, action: "activate" | "archive" | "cancel", reason?: string) => stateResponse(await axios.post(`/training/api/programs/${id}/transition`, { action, reason })),
    createSession: async (programId: string, payload: Record<string, unknown>) => unwrap<{ sessionId: string }>(await axios.post(`/training/api/programs/${programId}/sessions`, payload)),
    scheduleRequirements: async (payload: Record<string, unknown>) => stateResponse(await axios.post("/training/api/requirements/schedule", payload)),
    updateSession: async (programId: string, sessionId: string, payload: Record<string, unknown>) => stateResponse(await axios.put(`/training/api/programs/${programId}/sessions/${sessionId}`, payload)),
    transitionSession: async (sessionId: string, status: string, reason?: string) => stateResponse(await axios.post(`/training/api/sessions/${sessionId}/transition`, { status, reason })),
    enroll: async (programId: string, payload: Record<string, unknown>) => unwrap<{ enrollmentIds: string[] }>(await axios.post(`/training/api/programs/${programId}/enrollments`, payload)),
    transitionEnrollment: async (id: string, status: "Confirmed" | "Withdrawn" | "Cancelled", reason?: string) => stateResponse(await axios.post(`/training/api/enrollments/${id}/transition`, { status, reason })),
    syncWorkforce: async (sessionId: string) => stateResponse(await axios.post(`/training/api/sessions/${sessionId}/workforce-sync`)),
    markAttendance: async (id: string, status: string, note?: string) => stateResponse(await axios.put(`/training/api/attendance/${id}`, { status, note })),
    finalizeAttendance: async (sessionId: string) => stateResponse(await axios.post(`/training/api/sessions/${sessionId}/attendance/finalize`)),
    assess: async (enrollmentId: string, payload: Record<string, unknown>) => stateResponse(await axios.put(`/training/api/enrollments/${enrollmentId}/assessment`, payload)),
    finalizeCompletion: async (enrollmentId: string, status: string, note?: string) => stateResponse(await axios.post(`/training/api/enrollments/${enrollmentId}/completion`, { status, note })),
    finalizeReadyParticipants: async (sessionId: string) => stateResponse(await axios.post(`/training/api/sessions/${sessionId}/completion/finalize-ready`)),
    revokeCertificate: async (id: string, reason: string) => stateResponse(await axios.post(`/training/api/certificates/${id}/revoke`, { reason })),
    submitTrainerEvaluation: async (payload: Record<string, unknown>) => stateResponse(await axios.post("/training/api/trainer-evaluations", payload)),
    actRecommendation: async (id: string, payload: Record<string, unknown>) => stateResponse(await axios.post(`/training/api/recommendations/${id}/action`, payload)),
};

export function trainingError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
            return "Training data took too long to refresh. The last loaded records remain available.";
        }
        const errors = error.response?.data?.errors as Record<string, string[]> | undefined;
        if (errors) return Object.values(errors).flat().join(" ");
        return error.response?.data?.message ?? "The Training request failed.";
    }
    return error instanceof Error ? error.message : "The Training request failed.";
}
