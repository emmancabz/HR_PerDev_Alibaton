import axios from "axios";
import { normalizeSuccessionState, type SuccessionState } from "./succession";

const data = (response: unknown): unknown => (response as { data?: { data?: unknown } })?.data?.data;
let successionStateCache: SuccessionState | null = null;
let successionStateRequest: Promise<SuccessionState> | null = null;
const SUCCESSION_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const successionStorageKey = (actorId: number) => `pd:succession-state:v1:${actorId}`;

const readPersistedSuccessionState = (actorId: number): SuccessionState | null => {
    if (typeof window === "undefined" || !Number.isFinite(actorId) || actorId < 1) return null;
    try {
        const raw = window.sessionStorage.getItem(successionStorageKey(actorId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
        if (!parsed.savedAt || Date.now() - parsed.savedAt > SUCCESSION_CACHE_MAX_AGE_MS) {
            window.sessionStorage.removeItem(successionStorageKey(actorId));
            return null;
        }
        const state = normalizeSuccessionState(parsed.state);
        return Number(state.actor.id) === actorId ? state : null;
    } catch {
        window.sessionStorage.removeItem(successionStorageKey(actorId));
        return null;
    }
};

const rememberSuccessionState = (state: SuccessionState): SuccessionState => {
    successionStateCache = state;
    if (typeof window !== "undefined" && Number(state.actor.id) > 0) {
        try {
            window.sessionStorage.setItem(
                successionStorageKey(Number(state.actor.id)),
                JSON.stringify({ savedAt: Date.now(), state }),
            );
        } catch {}
    }
    return state;
};

async function fetchSuccessionState(): Promise<SuccessionState> {
    if (successionStateRequest) return successionStateRequest;
    successionStateRequest = axios.get("/succession/api/state", { timeout: 20_000 })
        .then((response) => rememberSuccessionState(normalizeSuccessionState(data(response))))
        .finally(() => { successionStateRequest = null; });
    return successionStateRequest;
}
export const successionClient = {
    peekState: (actorId?: number) => {
        if (successionStateCache && (!actorId || Number(successionStateCache.actor.id) === actorId)) return successionStateCache;
        if (!actorId) return null;
        const persisted = readPersistedSuccessionState(actorId);
        if (persisted) successionStateCache = persisted;
        return persisted;
    },
    state: fetchSuccessionState,
    createPosition: (payload: unknown) => axios.post("/succession/api/positions", payload),
    updatePosition: (id: string, payload: unknown) => axios.put(`/succession/api/positions/${id}`, payload),
    transitionPosition: (id: string, status: string, reason?: string) => axios.post(`/succession/api/positions/${id}/transition`, { status, reason }),
    nominate: (positionId: string, payload: unknown) => axios.post(`/succession/api/positions/${positionId}/candidates`, payload),
    transitionCandidate: (id: string, status: string, reason?: string) => axios.post(`/succession/api/candidates/${id}/transition`, { status, reason }),
    createAssessment: (candidateId: string, payload: unknown) => axios.post(`/succession/api/candidates/${candidateId}/assessments`, payload),
    updateAssessment: (id: string, payload: unknown) => axios.put(`/succession/api/assessments/${id}`, payload),
    finalizeAssessment: (id: string) => axios.post(`/succession/api/assessments/${id}/finalize`),
    reopenAssessment: (id: string, reason: string) => axios.post(`/succession/api/assessments/${id}/reopen`, { reason }),
    createPlan: (candidateId: string, payload: unknown) => axios.post(`/succession/api/candidates/${candidateId}/plans`, payload),
    transitionPlan: (id: string, status: string, reason?: string) => axios.post(`/succession/api/plans/${id}/transition`, { status, reason }),
    createAction: (planId: string, payload: unknown) => axios.post(`/succession/api/plans/${planId}/actions`, payload),
    updateAction: (planId: string, actionId: string, payload: unknown) => axios.put(`/succession/api/plans/${planId}/actions/${actionId}`, payload),
};

export function successionError(error: unknown): string {
    const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
    const first = response?.errors ? Object.values(response.errors).flat()[0] : null;
    return first || response?.message || (error instanceof Error ? error.message : "The Succession request failed.");
}
