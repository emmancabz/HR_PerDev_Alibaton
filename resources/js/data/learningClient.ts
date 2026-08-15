import axios from "axios";
import {
    normalizeLearningState,
    type CourseDraft,
    type LearningState,
} from "./learning";

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
const stateResponse = (response: { data: { data: unknown } }): LearningState =>
    normalizeLearningState(unwrap<unknown>(response));
export const learningClient = {
    state: async () => stateResponse(await axios.get("/learning/api/state")),
    create: async (draft: CourseDraft) =>
        unwrap<{ versionId: string; courseId: string }>(
            await axios.post("/learning/api/courses", draft),
        ),
    save: async (versionId: string, draft: CourseDraft) =>
        stateResponse(
            await axios.put(`/learning/api/versions/${versionId}`, draft),
        ),
    submitReview: async (versionId: string, reviewerId: number) =>
        stateResponse(
            await axios.post(`/learning/api/versions/${versionId}/review`, {
                reviewerId,
            }),
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
    uploadMaterial: async (lessonId: string, file: File) => {
        const body = new FormData();
        body.append("file", file);
        return unwrap<any>(
            await axios.post(
                `/learning/api/lessons/${lessonId}/materials`,
                body,
            ),
        );
    },
    uploadThumbnail: async (versionId: string, file: File) => {
        const body = new FormData();
        body.append("thumbnail", file);
        return unwrap<{ thumbnailUrl: string }>(
            await axios.post(
                `/learning/api/versions/${versionId}/thumbnail`,
                body,
            ),
        );
    },
    revokeMaterial: async (materialId: string) =>
        unwrap<any>(
            await axios.delete(`/learning/api/materials/${materialId}`),
        ),
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
