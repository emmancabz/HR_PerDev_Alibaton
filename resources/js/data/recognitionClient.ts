import axios from "axios";
import { normalizeRecognitionState, type RecognitionState } from "./recognition";

const responseData = (response: unknown): unknown => (response as { data?: { data?: unknown } })?.data?.data;
let recognitionStateCache: RecognitionState | null = null;
let recognitionStateRequest: Promise<RecognitionState> | null = null;

const rememberRecognitionState = (state: RecognitionState): RecognitionState => {
    recognitionStateCache = state;
    return state;
};

async function fetchRecognitionState(): Promise<RecognitionState> {
    if (recognitionStateRequest) return recognitionStateRequest;
    recognitionStateRequest = axios.get("/recognition/api/state")
        .then((response) => rememberRecognitionState(normalizeRecognitionState(responseData(response))))
        .finally(() => { recognitionStateRequest = null; });
    return recognitionStateRequest;
}

export const recognitionClient = {
    peekState: () => recognitionStateCache,
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
