export type TrainingWorkspace =
    | "Overview"
    | "Training Register"
    | "Training Records";

export const TRAINING_WORKSPACES: TrainingWorkspace[] = [
    "Overview",
    "Training Register",
    "Training Records",
];

export type ProgramStatus = "Draft" | "Active" | "Archived" | "Cancelled";
export type SessionStatus = "Draft" | "Scheduled" | "Ongoing" | "Completed" | "Cancelled";
export type AttendanceStatus = "Pending" | "Present" | "Late" | "Partial" | "Absent" | "Excused";
export type CompletionStatus = "Pending" | "Passed" | "Failed" | "Incomplete" | "Waived";
export type RequirementReadiness = "Ready" | "Waiting" | "Needs Mapping" | "Scheduled" | "Closed";

export type TrainingPerson = {
    id: number;
    personnelKey: string;
    employeeId: string | null;
    name: string;
    email: string;
    personType: string;
    department: string;
    position: string;
    role: string;
};

export type TrainingSession = {
    id: string;
    programId: string;
    label: string;
    startsAt: string;
    endsAt: string;
    venue: string;
    capacity: number;
    facilitatorId: number | null;
    facilitator: string | null;
    externalFacilitatorName: string | null;
    enrollmentClosesAt: string | null;
    status: SessionStatus;
    attendanceFinalizedAt: string | null;
    participantCount: number;
    cancellationReason: string | null;
};

export type TrainingProgram = {
    id: string;
    code: string;
    title: string;
    description: string;
    category: string;
    deliveryType: "Instructor-led" | "Onsite" | "Workshop" | "Practical" | "Simulation" | "Blended";
    status: ProgramStatus;
    objectives: string[];
    audienceRules: {
        personTypes: string[];
        departments: string[];
        positions: string[];
        roleProfileIds: string[];
    };
    completionRules: {
        attendanceThreshold: number;
        assessmentRequired: boolean;
        passingScore: number | null;
        issueCertificate: boolean;
        certificateValidityMonths: number | null;
    };
    relatedLearningCourseId: string | null;
    owner: string;
    competencies: Array<{
        id: string;
        version: number;
        code: string;
        name: string;
        targetLevel: number;
        purpose: string | null;
    }>;
    sessions: TrainingSession[];
    updatedAt: string;
};

export type EnrollmentSession = {
    id: string;
    sessionId: string;
    label: string;
    startsAt: string;
    endsAt: string;
    venue: string;
    facilitator: string | null;
    sessionStatus: SessionStatus;
    participationStatus: string;
    attendance: null | {
        id: string;
        trainingStatus: AttendanceStatus;
        recordingSource: string;
        note: string | null;
        finalizedAt: string | null;
        workforceSyncStatus: string;
        workforceSnapshot: Record<string, unknown>;
        workforceSyncError: string | null;
    };
};

export type TrainingEnrollment = {
    id: string;
    programId: string;
    participantId: number;
    participant: string;
    personnelKey: string;
    employeeId: string | null;
    personType: string;
    department: string;
    position: string;
    source: string;
    status: string;
    assignedAt: string;
    sessions: EnrollmentSession[];
    assessment: null | {
        id: string;
        result: string;
        score: string | null;
        maximumScore: string | null;
        checklist: Array<{ criterion: string; met: boolean }>;
        notes: string | null;
        finalizedAt: string | null;
    };
    completion: null | {
        id: string;
        status: Exclude<CompletionStatus, "Pending">;
        attendanceRate: string;
        finalizedAt: string;
        certificate: null | {
            id: string;
            number: string;
            status: string;
            issuedAt: string;
            expiresAt: string | null;
        };
    };
};

export type TrainingRecommendation = {
    id: string;
    sourceRecommendationId: string;
    sourceModule: string;
    sourceLabel: string;
    personnelKey: string;
    participantId: number | null;
    participant: string;
    employeeId: string | null;
    department: string;
    position: string;
    developmentNeed: string;
    reason: string;
    status: string;
    readiness: RequirementReadiness;
    prerequisiteStatus: string;
    prerequisiteTitle: string | null;
    recommendedProgramId: string | null;
    recommendedProgramTitle: string | null;
    linkedProgramId: string | null;
    linkedSessionId: string | null;
    linkedEnrollmentId: string | null;
    actionReason: string | null;
    sourceSnapshot: Record<string, unknown>;
    createdAt: string;
};

export type TrainingState = {
    actor: { id: number; role: string; canManage: boolean; canFinalize: boolean; canFacilitate: boolean };
    integration: {
        workforceAttendance: { status: string; sourceSystem: string; contractVersion: string; ownership: string };
        ai: { enabled: false; reason: string };
    };
    personnel: TrainingPerson[];
    catalog: {
        competencies: Array<Record<string, any>>;
        roleProfiles: Array<Record<string, any>>;
        learningCourses: Array<{ id: string; versionId: string; code: string; title: string }>;
    };
    programs: TrainingProgram[];
    enrollments: TrainingEnrollment[];
    facilitation: TrainingEnrollment[];
    feedback: Array<Record<string, any>>;
    recommendations: TrainingRecommendation[];
};

export type TrainingProgramDraft = {
    code: string;
    title: string;
    description: string;
    category: string;
    deliveryType: TrainingProgram["deliveryType"];
    objectives: string[];
    audienceRules: TrainingProgram["audienceRules"];
    completionRules: TrainingProgram["completionRules"];
    relatedLearningCourseId: string | null;
    ownerId: number | null;
    competencies: TrainingProgram["competencies"];
};

export const emptyTrainingProgram = (): TrainingProgramDraft => ({
    code: "",
    title: "",
    description: "",
    category: "",
    deliveryType: "Instructor-led",
    objectives: [""],
    audienceRules: { personTypes: [], departments: [], positions: [], roleProfileIds: [] },
    completionRules: {
        attendanceThreshold: 100,
        assessmentRequired: true,
        passingScore: 80,
        issueCertificate: true,
        certificateValidityMonths: null,
    },
    relatedLearningCourseId: null,
    ownerId: null,
    competencies: [],
});

export function normalizeTrainingState(value: unknown): TrainingState {
    if (!value || typeof value !== "object") throw new Error("Training state is unavailable.");
    const source = value as Partial<TrainingState>;
    if (!source.actor || !source.integration || !source.catalog) throw new Error("Training state is incomplete.");
    return {
        actor: source.actor,
        integration: source.integration,
        catalog: source.catalog,
        personnel: Array.isArray(source.personnel) ? source.personnel : [],
        programs: Array.isArray(source.programs) ? source.programs : [],
        enrollments: Array.isArray(source.enrollments) ? source.enrollments : [],
        facilitation: Array.isArray(source.facilitation) ? source.facilitation : [],
        feedback: Array.isArray(source.feedback) ? source.feedback : [],
        recommendations: Array.isArray(source.recommendations) ? source.recommendations : [],
    };
}

export const canonicalTrainingPersonTypes = (state: TrainingState) =>
    Array.from(new Set(state.personnel.map((person) => person.personType.trim()).filter(Boolean))).sort();

export const trainingMetrics = (state: TrainingState) => {
    const sessions = state.programs.flatMap((program) => program.sessions);
    const completions = state.enrollments.map((row) => row.completion).filter(Boolean);
    const passed = completions.filter((row) => row?.status === "Passed").length;
    return {
        activePrograms: state.programs.filter((program) => program.status === "Active").length,
        upcomingSessions: sessions.filter((session) => ["Scheduled", "Ongoing"].includes(session.status)).length,
        enrolled: state.enrollments.length,
        completionRate: state.enrollments.length ? Math.round((passed / state.enrollments.length) * 100) : null,
    };
};
