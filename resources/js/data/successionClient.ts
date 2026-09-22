import axios from "axios";
import { normalizeSuccessionState, type SuccessionState } from "./succession";

const data = (response: unknown): unknown => (response as { data?: { data?: unknown } })?.data?.data;
export const successionClient = {
    state: async (): Promise<SuccessionState> => normalizeSuccessionState(data(await axios.get("/succession/api/state"))),
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
