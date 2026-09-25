import axios from "axios";
import { normalizeTrainingState, type TrainingProgramDraft, type TrainingState } from "./training";

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
const stateResponse = (response: { data: { data: unknown } }): TrainingState => normalizeTrainingState(unwrap(response));

export const trainingClient = {
    state: async () => stateResponse(await axios.get("/training/api/state")),
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
        const errors = error.response?.data?.errors as Record<string, string[]> | undefined;
        if (errors) return Object.values(errors).flat().join(" ");
        return error.response?.data?.message ?? "The Training request failed.";
    }
    return error instanceof Error ? error.message : "The Training request failed.";
}
