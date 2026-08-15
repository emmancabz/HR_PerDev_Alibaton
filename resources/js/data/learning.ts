export const LEARNING_WORKSPACES = [
    "Overview",
    "Courses",
    "Learning Requests",
    "Assignments",
    "Completions & Certificates",
    "Analytics",
] as const;
export const BUILDER_STAGES = [
    "Course Details",
    "Audience & Availability",
    "Competency Alignment",
    "Governance",
    "Curriculum",
    "Assessment & Completion",
    "Review & Publish",
] as const;
export type LearningWorkspace = (typeof LEARNING_WORKSPACES)[number];
export type BuilderStage = (typeof BUILDER_STAGES)[number];
export type CourseStatus =
    | "Draft"
    | "In Review"
    | "Changes Requested"
    | "Approved"
    | "Published"
    | "Archived";

export type Personnel = {
    id: number;
    personnel_key: string;
    name: string;
    email: string;
    role: string;
    person_type: string;
    department: string;
    position: string;
    evaluator_capable: boolean;
};
export type GovernanceActor = {
    id: number;
    personnel_key: string | null;
    name: string;
    email: string;
    role: string;
    person_type: string | null;
    department: string | null;
    position: string | null;
    evaluator_capable: boolean;
    hasPersonnelIdentity: boolean;
    canOwn: boolean;
    canAuthor: boolean;
    canReview: boolean;
    canPublish: boolean;
};
export type LessonDraft = {
    id?: string;
    title: string;
    objective: string;
    description?: string;
    contentType:
        | "Text/Reading"
        | "Video"
        | "PDF/Document"
        | "Downloadable File"
        | "External Resource";
    textContent?: string;
    externalUrl?: string | null;
    estimatedMinutes: number;
    required: boolean;
    materials?: {
        id: string;
        displayName: string;
        mimeType: string;
        sizeBytes: number;
        downloadUrl?: string;
    }[];
};
export type ModuleDraft = {
    clientId: string;
    title: string;
    description?: string;
    lessons: LessonDraft[];
};
export type OptionDraft = { id?: string; text: string; correct: boolean };
export type QuestionDraft = {
    id?: string;
    type: "Multiple Choice" | "Multiple Response" | "True/False";
    text: string;
    explanation?: string;
    points: number;
    options: OptionDraft[];
};
export type AssessmentDraft = {
    id?: string;
    type: "Knowledge Check" | "Final Assessment";
    title: string;
    required: boolean;
    passingScore: number;
    attemptsAllowed: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    feedbackPolicy: string;
    moduleClientId?: string | null;
    questions: QuestionDraft[];
};
export type CourseDraft = {
    id?: string;
    courseId?: string;
    code?: string;
    status?: CourseStatus;
    versionNumber?: number | null;
    title: string;
    description: string;
    category: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    language: string;
    learningObjectives: string[];
    subjectMatterExpertId: number | null;
    thumbnailUrl?: string | null;
    durationOverrideMinutes: number | null;
    estimatedDurationMinutes?: number;
    ownerId: number;
    authorIds: number[];
    reviewerIds: number[];
    publisherId: number | null;
    audience: {
        personTypes: string[];
        allDepartments: boolean;
        departments: string[];
        positions: string[];
        roleProfileIds: string[];
        catalogVisibility:
            | "Assigned only"
            | "Eligible users may self-enroll"
            | "Unlisted";
        defaultDueDays: number | null;
        mandatoryDefault: boolean;
        availableFrom?: string | null;
        availableUntil?: string | null;
        label?: string;
    };
    competencies: {
        id: string;
        version: number;
        code: string;
        name: string;
        targetLevel: number;
        purpose?: string;
        objectiveIndexes?: number[];
    }[];
    modules: ModuleDraft[];
    assessments: AssessmentDraft[];
    completion: {
        completeRequiredLessons: boolean;
        passRequiredKnowledgeChecks: boolean;
        passFinalAssessment: boolean;
        issueCertificate: boolean;
        certificateValidityMonths: number | null;
        renewalIntervalMonths: number | null;
    };
};
export type CourseSummary = {
    id: string;
    code: string;
    title: string;
    category: string;
    status: CourseStatus;
    owner: string;
    ownerId: number;
    audience: string;
    publishedVersion?: number | null;
    publishedVersionId?: string | null;
    draftVersionId?: string | null;
    activeAssignments: number;
    completionRate: number;
    lastUpdated: string;
    archived: boolean;
    competencies: string[];
    versionHistory?: {
        id: string;
        versionNumber: number | null;
        status: CourseStatus;
        title: string;
        basedOnVersionId?: string | null;
        submittedAt?: string | null;
        approvedAt?: string | null;
        publishedAt?: string | null;
        updatedAt?: string | null;
    }[];
    publishedDetail?: CourseDraft | null;
    draftDetail?: CourseDraft | null;
};
export type LearningState = {
    actor: { id: number; name: string; role: string };
    courses: CourseSummary[];
    catalog: CourseSummary[];
    personnel: Personnel[];
    governanceActors: GovernanceActor[];
    assignments: any[];
    completions: any[];
    requests: any[];
    reviews: any[];
    attempts: any[];
    analytics: Record<string, any>;
    competencyCatalog: {
        id: string;
        version: number;
        code: string;
        name: string;
        category: string;
    }[];
    roleProfiles: {
        id: string;
        version: number;
        name: string;
        department: string;
        position: string;
        personType: string;
    }[];
};

const legacyPersonTypeAliases: Readonly<Record<string, string>> = {
    Employees: "Employee",
    Trainees: "Trainee",
};

/** Person Types are owned by canonical active personnel, never Learning config. */
export function canonicalAudiencePersonTypes(
    personnel: ReadonlyArray<Pick<Personnel, "person_type">>,
): string[] {
    return [...new Set(personnel.map((person) => person.person_type?.trim()))]
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => left.localeCompare(right));
}

/**
 * Reopens known legacy plural values with their canonical equivalent. Unknown
 * values remain visible to validation so they are rejected instead of guessed.
 */
export function normalizeAudiencePersonTypes(
    values: readonly string[],
    canonicalValues: readonly string[],
): { values: string[]; rejected: string[] } {
    const canonical = new Set(canonicalValues);
    const rejected: string[] = [];
    const normalized = values
        .map((rawValue) => rawValue.trim())
        .filter(Boolean)
        .map((value) => {
            if (canonical.has(value)) return value;
            const alias = legacyPersonTypeAliases[value];
            if (alias && canonical.has(alias)) return alias;
            rejected.push(value);
            return value;
        });

    return {
        values: [...new Set(normalized)],
        rejected: [...new Set(rejected)],
    };
}

type LearningStateRecord = Partial<Record<keyof LearningState, unknown>>;

const learningCollections = [
    "courses",
    "catalog",
    "personnel",
    "governanceActors",
    "assignments",
    "completions",
    "requests",
    "reviews",
    "attempts",
    "competencyCatalog",
    "roleProfiles",
] as const;

function collection<T>(
    source: LearningStateRecord,
    key: (typeof learningCollections)[number],
): T[] {
    const value = source[key];
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw new Error(`Invalid Learning state: ${key} must be an array.`);
    }
    return value as T[];
}

/**
 * Converts both Inertia page props and Learning API responses to the one state
 * shape consumed by every Learning workspace. Missing collections represent an
 * empty result set; an invalid actor or a malformed supplied collection is a
 * contract error and must be shown to the user instead of rendered as fake data.
 */
export function normalizeLearningState(value: unknown): LearningState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid Learning state response.");
    }

    const source = value as LearningStateRecord;
    const actor = source.actor;
    if (!actor || typeof actor !== "object" || Array.isArray(actor)) {
        throw new Error("Invalid Learning state: actor is required.");
    }
    const actorRecord = actor as Record<string, unknown>;
    if (
        typeof actorRecord.id !== "number" ||
        typeof actorRecord.name !== "string" ||
        typeof actorRecord.role !== "string"
    ) {
        throw new Error("Invalid Learning state: actor is malformed.");
    }

    const analytics = source.analytics;
    if (
        analytics !== undefined &&
        analytics !== null &&
        (typeof analytics !== "object" || Array.isArray(analytics))
    ) {
        throw new Error("Invalid Learning state: analytics must be an object.");
    }

    return {
        actor: {
            id: actorRecord.id,
            name: actorRecord.name,
            role: actorRecord.role,
        },
        courses: collection<CourseSummary>(source, "courses"),
        catalog: collection<CourseSummary>(source, "catalog"),
        personnel: collection<Personnel>(source, "personnel"),
        governanceActors: collection<GovernanceActor>(
            source,
            "governanceActors",
        ),
        assignments: collection<any>(source, "assignments"),
        completions: collection<any>(source, "completions"),
        requests: collection<any>(source, "requests"),
        reviews: collection<any>(source, "reviews"),
        attempts: collection<any>(source, "attempts"),
        analytics: (analytics ?? {}) as Record<string, any>,
        competencyCatalog: collection<
            LearningState["competencyCatalog"][number]
        >(source, "competencyCatalog"),
        roleProfiles: collection<LearningState["roleProfiles"][number]>(
            source,
            "roleProfiles",
        ),
    };
}

export const emptyDraft = (actorId: number): CourseDraft => ({
    title: "",
    description: "",
    category: "General",
    difficulty: "Beginner",
    language: "English",
    learningObjectives: [""],
    subjectMatterExpertId: null,
    durationOverrideMinutes: null,
    ownerId: actorId,
    authorIds: [actorId],
    reviewerIds: [],
    publisherId: null,
    audience: {
        personTypes: [],
        allDepartments: true,
        departments: [],
        positions: [],
        roleProfileIds: [],
        catalogVisibility: "Assigned only",
        defaultDueDays: 30,
        mandatoryDefault: true,
    },
    competencies: [],
    modules: [],
    assessments: [],
    completion: {
        completeRequiredLessons: true,
        passRequiredKnowledgeChecks: true,
        passFinalAssessment: true,
        issueCertificate: false,
        certificateValidityMonths: null,
        renewalIntervalMonths: null,
    },
});

export function assessmentErrors(assessment: AssessmentDraft): string[] {
    const errors: string[] = [];
    if (assessment.passingScore < 1 || assessment.passingScore > 100)
        errors.push("Passing score must be between 1 and 100.");
    if (
        !Number.isInteger(assessment.attemptsAllowed) ||
        assessment.attemptsAllowed < 1
    )
        errors.push("Attempts allowed must be at least 1.");
    if (!assessment.questions.length) errors.push("Add at least one question.");
    assessment.questions.forEach((question, index) => {
        const label = `Question ${index + 1}`;
        const texts = question.options.map((option) =>
            option.text.trim().toLowerCase(),
        );
        const correct = question.options.filter(
            (option) => option.correct,
        ).length;
        if (!question.text.trim()) errors.push(`${label} is blank.`);
        if (question.options.length < 2 || texts.some((text) => !text))
            errors.push(`${label} requires valid choices.`);
        if (new Set(texts).size !== texts.length)
            errors.push(`${label} has duplicate choices.`);
        if (correct < 1) errors.push(`${label} has no correct answer.`);
        if (
            (question.type === "Multiple Choice" ||
                question.type === "True/False") &&
            correct !== 1
        )
            errors.push(`${label} requires exactly one correct answer.`);
        if (
            question.type === "Multiple Response" &&
            question.options.length < 2
        )
            errors.push(`${label} requires at least two selectable options.`);
        if (question.type === "True/False" && question.options.length !== 2)
            errors.push(`${label} requires exactly two options.`);
    });
    return errors;
}

export type CourseDetailIssues = {
    title?: string;
    description?: string;
    learningObjectives?: string;
};

/** Step 1 readiness is shared by the summary count and visible field errors. */
export function courseDetailIssues(draft: CourseDraft): CourseDetailIssues {
    const issues: CourseDetailIssues = {};
    if (draft.title.trim().length < 3)
        issues.title = "Enter a course title of at least 3 characters.";
    if (draft.description.trim().length < 20)
        issues.description = "Enter a meaningful description of at least 20 characters.";
    if (!draft.learningObjectives.some((value) => value.trim().length >= 8))
        issues.learningObjectives =
            "Add at least one learning objective of 8 or more characters.";
    return issues;
}

export function draftErrors(draft: CourseDraft): string[] {
    const errors: string[] = [];
    if (draft.title.trim().length < 3) errors.push("Course title is required.");
    if (draft.description.trim().length < 20)
        errors.push("Provide a meaningful description.");
    if (!draft.learningObjectives.some((value) => value.trim().length >= 8))
        errors.push("Add a meaningful learning objective.");
    if (!draft.audience.personTypes.length)
        errors.push("Select at least one person type.");
    if (draft.audience.allDepartments && draft.audience.departments.length)
        errors.push(
            "All Departments cannot be combined with individual departments.",
        );
    if (!draft.reviewerIds.length) errors.push("Assign a reviewer.");
    if (!draft.publisherId) errors.push("Assign a publisher.");
    if (
        draft.category === "Safety & Compliance" &&
        draft.reviewerIds.some((id) => draft.authorIds.includes(id))
    )
        errors.push("Safety & Compliance requires an independent reviewer.");
    if (!draft.modules.length)
        errors.push("Add at least one curriculum module.");
    draft.modules.forEach((module) => {
        if (!module.title.trim()) errors.push("Every module needs a title.");
        if (!module.lessons.length)
            errors.push(
                `Module “${module.title || "Untitled"}” needs at least one lesson.`,
            );
        module.lessons.forEach((lesson) => {
            if (!lesson.title.trim())
                errors.push("Every lesson needs a title.");
            if (lesson.objective.trim().length < 8)
                errors.push("Every lesson needs a meaningful objective.");
            if (
                lesson.required &&
                !lesson.textContent?.trim() &&
                !lesson.externalUrl?.trim() &&
                !lesson.materials?.length
            )
                errors.push(
                    `Required lesson “${lesson.title || "Untitled"}” needs content.`,
                );
            if (
                lesson.externalUrl &&
                !lesson.externalUrl.startsWith("https://")
            )
                errors.push(
                    `External resource “${lesson.title}” must use HTTPS.`,
                );
        });
    });
    if (
        draft.assessments.filter(
            (assessment) => assessment.type === "Final Assessment",
        ).length > 1
    )
        errors.push("Only one Final Assessment is allowed.");
    draft.assessments.forEach((assessment) => {
        if (assessment.type === "Knowledge Check" && !assessment.moduleClientId)
            errors.push(
                `Knowledge Check “${assessment.title}” must be linked to a module.`,
            );
    });
    draft.assessments.forEach((assessment) =>
        errors.push(...assessmentErrors(assessment)),
    );
    return [...new Set(errors)];
}

export function stepState(
    index: number,
    active: number,
): "completed" | "current" | "future" {
    return index < active
        ? "completed"
        : index === active
          ? "current"
          : "future";
}
export function completionRate(assignments: { status: string }[]): number {
    const denominator = assignments.filter(
        (item) => item.status !== "Cancelled",
    );
    return denominator.length
        ? Math.round(
              (denominator.filter((item) => item.status === "Completed")
                  .length /
                  denominator.length) *
                  100,
          )
        : 0;
}
export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
    return rows.slice((page - 1) * pageSize, page * pageSize);
}

export function applyAcceptedAiDraft(
    draft: CourseDraft,
    useCase: string,
    output: { items?: unknown[] },
): CourseDraft {
    const next = structuredClone(draft);
    const items = Array.isArray(output.items) ? output.items : [];
    const text = (item: unknown): string => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        const value = item as Record<string, unknown>;
        return String(
            value.objective ?? value.text ?? value.title ?? "",
        ).trim();
    };

    if (
        useCase === "Learning Objectives" ||
        useCase === "Competency-aligned Objectives"
    ) {
        const suggestions = items.map(text).filter(Boolean);
        next.learningObjectives = [
            ...next.learningObjectives.filter((value) => value.trim()),
            ...suggestions.filter(
                (value) =>
                    !next.learningObjectives.some(
                        (existing) =>
                            existing.trim().toLowerCase() ===
                            value.toLowerCase(),
                    ),
            ),
        ];
    }

    if (
        useCase === "Course Outline" ||
        useCase === "Module and Lesson Titles"
    ) {
        const modules = items.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const value = item as Record<string, unknown>;
            const title = text(value);
            if (!title) return [];
            const lessons = Array.isArray(value.lessons)
                ? value.lessons
                      .map(text)
                      .filter(Boolean)
                      .map((lessonTitle) => ({
                          title: lessonTitle,
                          objective:
                              "Review and apply the concepts in this lesson.",
                          description:
                              "AI Draft — edit and verify before review.",
                          contentType: "Text/Reading" as const,
                          textContent: "",
                          externalUrl: "",
                          estimatedMinutes: 10,
                          required: true,
                      }))
                : [];
            return [
                {
                    clientId: crypto.randomUUID(),
                    title,
                    description: "AI Draft — edit and verify before review.",
                    lessons,
                },
            ];
        });
        next.modules = [...next.modules, ...modules];
    }

    return next;
}