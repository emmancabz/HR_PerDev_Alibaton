import axios from "axios";
import { normalizeRecognitionState, type RecognitionState } from "./recognition";

const responseData = (response: unknown): unknown => (response as { data?: { data?: unknown } })?.data?.data;
let recognitionStateCache: RecognitionState | null = null;
let recognitionStateRequest: Promise<RecognitionState> | null = null;
const RECOGNITION_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const recognitionStorageKey = (actorId: number) => `pd:recognition-state:v1:${actorId}`;

const readPersistedRecognitionState = (actorId: number): RecognitionState | null => {
    if (typeof window === "undefined" || !Number.isFinite(actorId) || actorId < 1) return null;
    try {
        const raw = window.sessionStorage.getItem(recognitionStorageKey(actorId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
        if (!parsed.savedAt || Date.now() - parsed.savedAt > RECOGNITION_CACHE_MAX_AGE_MS) {
            window.sessionStorage.removeItem(recognitionStorageKey(actorId));
            return null;
        }
        const state = normalizeRecognitionState(parsed.state);
        return Number(state.actor.id) === actorId ? state : null;
    } catch {
        window.sessionStorage.removeItem(recognitionStorageKey(actorId));
        return null;
    }
};

const rememberRecognitionState = (state: RecognitionState): RecognitionState => {
    recognitionStateCache = state;
    if (typeof window !== "undefined" && Number(state.actor.id) > 0) {
        try {
            window.sessionStorage.setItem(
                recognitionStorageKey(Number(state.actor.id)),
                JSON.stringify({ savedAt: Date.now(), state }),
            );
        } catch {}
    }
    return state;
};

async function fetchRecognitionState(): Promise<RecognitionState> {
    if (recognitionStateRequest) return recognitionStateRequest;
    recognitionStateRequest = axios.get("/recognition/api/state", { timeout: 20_000 })
        .then((response) => rememberRecognitionState(normalizeRecognitionState(responseData(response))))
        .finally(() => { recognitionStateRequest = null; });
    return recognitionStateRequest;
}

export const recognitionClient = {
    peekState: (actorId?: number) => {
        if (recognitionStateCache && (!actorId || Number(recognitionStateCache.actor.id) === actorId)) return recognitionStateCache;
        if (!actorId) return null;
        const persisted = readPersistedRecognitionState(actorId);
        if (persisted) recognitionStateCache = persisted;
        return persisted;
    },
    state: fetchRecognitionState,
    create: (payload: unknown) => axios.post("/recognition/api/records", payload),
    update: (id: string, payload: unknown) => axios.put(`/recognition/api/records/${id}`, payload),
    submit: (id: string) => axios.post(`/recognition/api/records/${id}/submit`),
    decide: (id: string, decision: "Recognized" | "Declined", reason?: string) => axios.post(`/recognition/api/records/${id}/decision`, { decision, reason }),
    revoke: (id: string, reason: string) => axios.post(`/recognition/api/records/${id}/revoke`, { reason }),
    createCategory: (payload: unknown) => axios.post("/recognition/api/categories", payload),
    updateCategory: (id: string, payload: unknown) => axios.put(`/recognition/api/categories/${id}`, payload),
};

export function recognitionError(error: unknown): string {
    const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
    const first = response?.errors ? Object.values(response.errors).flat()[0] : null;
    return first || response?.message || (error instanceof Error ? error.message : "The Recognition request failed.");
}
