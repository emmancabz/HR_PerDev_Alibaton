export const LEARNING_WORKSPACES = [
    "Overview",
    "Courses",
    "Assignments",
    "Learning Records",
    "Analytics",
] as const;
export const BUILDER_STAGES = [
    "Course Setup",
    "Source Documents",
    "Audience & Competency",
    "Curriculum",
    "Assessment & Completion",
    "Review",
    "Submit",
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
    description: string;
    contentType:
        | "Text/Reading"
        | "Video"
        | "PDF/Document"
        | "Downloadable File"
        | "External Resource";
    textContent: string;
    externalUrl: string;
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
    description: string;
    lessons: LessonDraft[];
};
export type OptionDraft = { id?: string; text: string; correct: boolean };
export type QuestionDraft = {
    id?: string;
    type: "Multiple Choice" | "Multiple Response" | "True/False";
    text: string;
    explanation: string;
    points: number;
    options: OptionDraft[];
};
export type AssessmentDraft = {
    id?: string;
    type: "Pre-Test" | "Knowledge Check" | "Post-Test" | "Final Assessment";
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
export type SourceDocument = {
    documentId: string;
    type: string;
    title: string;
    version: string;
    status?: string;
    owner: string;
    departments?: string[];
    filename?: string;
    relatedCourseCodes?: string[];
};
export type SourceReview = {
    id: string;
    status: "Ready" | "Attention" | "Blocked" | string;
    coveragePercent: number;
    summary: string;
    findings: string[];
    sources: SourceDocument[];
    aiUsed: boolean;
    model?: string | null;
    scannedAt?: string | null;
    current: boolean;
};
export type PublicationDelivery = {
    id: string;
    event?: string;
    status: "Queued" | "Delivered" | "Failed" | string;
    targetCount: number;
    attempts: number;
    lastError?: string | null;
    lastAttemptAt?: string | null;
    deliveredAt?: string | null;
};
export type CourseDraft = {
    id?: string;
    courseId?: string;
    code?: string;
    status?: CourseStatus;
    versionNumber?: number | null;
    workingStage?: number;
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
    sourceDocumentIds: string[];
    sourceDocuments?: SourceDocument[];
    sourceReview?: SourceReview | null;
    delivery?: PublicationDelivery | null;
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
    targetDepartment?: string;
    sourceReview?: SourceReview | null;
    delivery?: PublicationDelivery | null;
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
    sourceLibrary: SourceDocument[];
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
    employees: "Employee",
    trainees: "Trainee",
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
    const canonical = new Map(
        canonicalValues.map((value) => [value.trim().toLocaleLowerCase(), value]),
    );
    const rejected: string[] = [];
    const normalized = values
        .map((rawValue) => rawValue.trim())
        .filter(Boolean)
        .map((value) => {
            const normalized = value.toLocaleLowerCase();
            const candidate = legacyPersonTypeAliases[normalized] ?? value;
            const exact = canonical.get(candidate.toLocaleLowerCase());
            if (exact) return exact;
            rejected.push(value);
            return value;
        });

    return {
        values: [...new Set(normalized)],
        rejected: [...new Set(rejected)],
    };
}

type LearningStateRecord = Partial<Record<keyof LearningState, unknown>>;

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord =>
    value && typeof value === "object" && !Array.isArray(value)
        ? (value as UnknownRecord)
        : {};
const text = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;
const optionalText = (value: unknown): string | undefined => {
    const normalized = text(value);
    return normalized || undefined;
};
const nullableText = (value: unknown): string | null => {
    const normalized = text(value);
    return normalized || null;
};
const number = (value: unknown, fallback = 0): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
const nullableNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
const flag = (value: unknown, fallback = false): boolean =>
    typeof value === "boolean" ? value : fallback;
const records = (value: unknown): UnknownRecord[] =>
    Array.isArray(value) ? value.map(record) : [];
const texts = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((item) => text(item)) : [];
const numbers = (value: unknown): number[] =>
    Array.isArray(value)
        ? value.filter(
              (item): item is number =>
                  typeof item === "number" && Number.isFinite(item),
          )
        : [];

const courseStatuses: readonly CourseStatus[] = [
    "Draft",
    "In Review",
    "Changes Requested",
    "Approved",
    "Published",
    "Archived",
];

function normalizeSourceReview(value: unknown): SourceReview {
    const item = record(value);
    return {
        id: text(item.id),
        status: text(item.status),
        coveragePercent: number(item.coveragePercent),
        summary: text(item.summary),
        findings: texts(item.findings),
        sources: records(item.sources).map((source) => ({
            documentId: text(source.documentId),
            type: text(source.type),
            title: text(source.title),
            version: text(source.version),
            owner: text(source.owner),
        })),
        aiUsed: flag(item.aiUsed),
        model: nullableText(item.model),
        scannedAt: nullableText(item.scannedAt),
        current: flag(item.current),
    };
}
function normalizeDelivery(value: unknown): PublicationDelivery {
    const item = record(value);
    return {
        id: text(item.id),
        event: optionalText(item.event),
        status: text(item.status),
        targetCount: number(item.targetCount),
        attempts: number(item.attempts),
        lastError: nullableText(item.lastError),
        lastAttemptAt: nullableText(item.lastAttemptAt),
        deliveredAt: nullableText(item.deliveredAt),
    };
}

/**
 * Laravel legitimately transports nullable optional curriculum fields. This is
 * the single server-to-domain boundary that turns them into the canonical,
 * render-safe builder shape. Empty required values remain empty so validation
 * still blocks progression and publication.
 */
export function normalizeCourseDraft(
    value: unknown,
    _actorId: number,
): CourseDraft {
    const source = record(value);
    const audience = record(source.audience);
    const completion = record(source.completion);
    const learningObjectives = Array.isArray(source.learningObjectives)
        ? texts(source.learningObjectives)
        : [""];
    const statusValue = text(source.status);

    return {
        id: optionalText(source.id),
        courseId: optionalText(source.courseId),
        code: optionalText(source.code),
        status: courseStatuses.includes(statusValue as CourseStatus)
            ? (statusValue as CourseStatus)
            : undefined,
        versionNumber: nullableNumber(source.versionNumber),
        workingStage: Math.max(0, Math.trunc(number(source.workingStage, 0))),
        title: text(source.title),
        description: text(source.description),
        category: text(source.category, "General"),
        difficulty: ["Beginner", "Intermediate", "Advanced"].includes(
            text(source.difficulty),
        )
            ? (text(source.difficulty) as CourseDraft["difficulty"])
            : "Beginner",
        language: text(source.language, "English"),
        learningObjectives,
        subjectMatterExpertId: nullableNumber(source.subjectMatterExpertId),
        thumbnailUrl: nullableText(source.thumbnailUrl),
        durationOverrideMinutes: nullableNumber(source.durationOverrideMinutes),
        estimatedDurationMinutes: nullableNumber(
            source.estimatedDurationMinutes,
        ) ?? undefined,
        ownerId: number(source.ownerId),
        authorIds: numbers(source.authorIds),
        reviewerIds: numbers(source.reviewerIds),
        publisherId: nullableNumber(source.publisherId),
        sourceDocumentIds: texts(source.sourceDocumentIds),
        sourceDocuments: records(source.sourceDocuments).map((item) => ({
            documentId: text(item.documentId),
            type: text(item.type),
            title: text(item.title),
            version: text(item.version),
            status: optionalText(item.status),
            owner: text(item.owner),
            departments: texts(item.departments),
            filename: optionalText(item.filename),
            relatedCourseCodes: texts(item.relatedCourseCodes),
        })),
        sourceReview: source.sourceReview ? normalizeSourceReview(source.sourceReview) : null,
        delivery: source.delivery ? normalizeDelivery(source.delivery) : null,
        audience: {
            personTypes: texts(audience.personTypes),
            allDepartments: flag(audience.allDepartments, true),
            departments: texts(audience.departments),
            positions: texts(audience.positions),
            roleProfileIds: texts(audience.roleProfileIds),
            catalogVisibility: [
                "Assigned only",
                "Eligible users may self-enroll",
                "Unlisted",
            ].includes(text(audience.catalogVisibility))
                ? (text(
                      audience.catalogVisibility,
                  ) as CourseDraft["audience"]["catalogVisibility"])
                : "Assigned only",
            defaultDueDays: nullableNumber(audience.defaultDueDays),
            mandatoryDefault: flag(audience.mandatoryDefault, true),
            availableFrom: nullableText(audience.availableFrom),
            availableUntil: nullableText(audience.availableUntil),
            label: optionalText(audience.label),
        },
        competencies: records(source.competencies).map((competency) => ({
            id: text(competency.id),
            version: number(competency.version),
            code: text(competency.code),
            name: text(competency.name),
            targetLevel: number(competency.targetLevel),
            purpose: optionalText(competency.purpose),
            objectiveIndexes: numbers(competency.objectiveIndexes),
        })),
        modules: records(source.modules).map((module, moduleIndex) => ({
            clientId:
                text(module.clientId) || `transport-module-${moduleIndex + 1}`,
            title: text(module.title),
            description: text(module.description),
            lessons: records(module.lessons).map((lesson) => ({
                id: optionalText(lesson.id),
                title: text(lesson.title),
                objective: text(lesson.objective),
                description: text(lesson.description),
                contentType: [
                    "Text/Reading",
                    "Video",
                    "PDF/Document",
                    "Downloadable File",
                    "External Resource",
                ].includes(text(lesson.contentType))
                    ? (text(lesson.contentType) as LessonDraft["contentType"])
                    : "Text/Reading",
                textContent: text(lesson.textContent),
                externalUrl: text(lesson.externalUrl),
                estimatedMinutes: number(lesson.estimatedMinutes, 5),
                required: flag(lesson.required, true),
                materials: records(lesson.materials).map((material) => ({
                    id: text(material.id),
                    displayName: text(material.displayName),
                    mimeType: text(material.mimeType),
                    sizeBytes: number(material.sizeBytes),
                    downloadUrl: optionalText(material.downloadUrl),
                })),
            })),
        })),
        assessments: records(source.assessments).map((assessment) => ({
            id: optionalText(assessment.id),
            type: ["Pre-Test", "Knowledge Check", "Post-Test", "Final Assessment"].includes(text(assessment.type))
                ? (text(assessment.type) as AssessmentDraft["type"])
                : "Knowledge Check",
            title: text(assessment.title),
            required: flag(assessment.required, true),
            passingScore: number(assessment.passingScore),
            attemptsAllowed: number(assessment.attemptsAllowed),
            shuffleQuestions: flag(assessment.shuffleQuestions),
            shuffleOptions: flag(assessment.shuffleOptions),
            feedbackPolicy: text(
                assessment.feedbackPolicy,
                "After submission",
            ),
            moduleClientId: nullableText(assessment.moduleClientId),
            questions: records(assessment.questions).map((question) => ({
                id: optionalText(question.id),
                type: [
                    "Multiple Choice",
                    "Multiple Response",
                    "True/False",
                ].includes(text(question.type))
                    ? (text(question.type) as QuestionDraft["type"])
                    : "Multiple Choice",
                text: text(question.text),
                explanation: text(question.explanation),
                points: number(question.points, 1),
                options: records(question.options).map((option) => ({
                    id: optionalText(option.id),
                    text: text(option.text),
                    correct: flag(option.correct),
                })),
            })),
        })),
        completion: {
            completeRequiredLessons: flag(
                completion.completeRequiredLessons,
                true,
            ),
            passRequiredKnowledgeChecks: flag(
                completion.passRequiredKnowledgeChecks,
                true,
            ),
            passFinalAssessment: flag(completion.passFinalAssessment, true),
            issueCertificate: flag(completion.issueCertificate),
            certificateValidityMonths: nullableNumber(
                completion.certificateValidityMonths,
            ),
            renewalIntervalMonths: nullableNumber(
                completion.renewalIntervalMonths,
            ),
        },
    };
}

function normalizeCourseSummary(value: unknown, actorId: number): CourseSummary {
    const source = record(value);
    const statusValue = text(source.status, "Draft");
    const normalizeDetail = (detail: unknown): CourseDraft | null =>
        detail === undefined || detail === null
            ? null
            : normalizeCourseDraft(detail, actorId);

    return {
        id: text(source.id),
        code: text(source.code),
        title: text(source.title),
        category: text(source.category),
        status: courseStatuses.includes(statusValue as CourseStatus)
            ? (statusValue as CourseStatus)
            : "Draft",
        owner: text(source.owner),
        ownerId: number(source.ownerId),
        audience: text(source.audience),
        targetDepartment: optionalText(source.targetDepartment),
        sourceReview: source.sourceReview ? normalizeSourceReview(source.sourceReview) : null,
        delivery: source.delivery ? normalizeDelivery(source.delivery) : null,
        publishedVersion: nullableNumber(source.publishedVersion),
        publishedVersionId: nullableText(source.publishedVersionId),
        draftVersionId: nullableText(source.draftVersionId),
        activeAssignments: number(source.activeAssignments),
        completionRate: number(source.completionRate),
        lastUpdated: text(source.lastUpdated),
        archived: flag(source.archived),
        competencies: texts(source.competencies),
        versionHistory: records(source.versionHistory).map((version) => ({
            id: text(version.id),
            versionNumber: nullableNumber(version.versionNumber),
            status: courseStatuses.includes(text(version.status) as CourseStatus)
                ? (text(version.status) as CourseStatus)
                : "Draft",
            title: text(version.title),
            basedOnVersionId: nullableText(version.basedOnVersionId),
            submittedAt: nullableText(version.submittedAt),
            approvedAt: nullableText(version.approvedAt),
            publishedAt: nullableText(version.publishedAt),
            updatedAt: nullableText(version.updatedAt),
        })),
        publishedDetail: normalizeDetail(source.publishedDetail),
        draftDetail: normalizeDetail(source.draftDetail),
    };
}

const learningCollections = [
    "courses",
    "catalog",
    "personnel",
    "governanceActors",
    "sourceLibrary",
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
        courses: collection<unknown>(source, "courses").map((course) =>
            normalizeCourseSummary(course, actorRecord.id as number),
        ),
        catalog: collection<unknown>(source, "catalog").map((course) =>
            normalizeCourseSummary(course, actorRecord.id as number),
        ),
        personnel: collection<unknown>(source, "personnel").map((person) => {
            const item = record(person);
            return {
                id: number(item.id),
                personnel_key: text(item.personnel_key),
                name: text(item.name),
                email: text(item.email),
                role: text(item.role),
                person_type: text(item.person_type),
                department: text(item.department),
                position: text(item.position),
                evaluator_capable: flag(item.evaluator_capable),
            };
        }),
        governanceActors: collection<unknown>(
            source,
            "governanceActors",
        ).map((actor) => {
            const item = record(actor);
            return {
                id: number(item.id),
                personnel_key: nullableText(item.personnel_key),
                name: text(item.name),
                email: text(item.email),
                role: text(item.role),
                person_type: nullableText(item.person_type),
                department: nullableText(item.department),
                position: nullableText(item.position),
                evaluator_capable: flag(item.evaluator_capable),
                hasPersonnelIdentity: flag(item.hasPersonnelIdentity),
                canOwn: flag(item.canOwn),
                canAuthor: flag(item.canAuthor),
                canReview: flag(item.canReview),
                canPublish: flag(item.canPublish),
            };
        }),
        sourceLibrary: collection<unknown>(source, "sourceLibrary").map((document) => {
            const item = record(document);
            return {
                documentId: text(item.documentId),
                type: text(item.type),
                title: text(item.title),
                version: text(item.version),
                status: optionalText(item.status),
                owner: text(item.owner),
                departments: texts(item.departments),
                filename: optionalText(item.filename),
                relatedCourseCodes: texts(item.relatedCourseCodes),
            };
        }),
        assignments: collection<any>(source, "assignments"),
        completions: collection<any>(source, "completions"),
        requests: collection<any>(source, "requests"),
        reviews: collection<any>(source, "reviews"),
        attempts: collection<any>(source, "attempts"),
        analytics: (analytics ?? {}) as Record<string, any>,
        competencyCatalog: collection<unknown>(source, "competencyCatalog").map(
            (competency) => {
                const item = record(competency);
                return {
                    id: text(item.id),
                    version: number(item.version),
                    code: text(item.code),
                    name: text(item.name),
                    category: text(item.category),
                };
            },
        ),
        roleProfiles: collection<unknown>(source, "roleProfiles").map(
            (profile) => {
                const item = record(profile);
                return {
                    id: text(item.id),
                    version: number(item.version),
                    name: text(item.name),
                    department: text(item.department),
                    position: text(item.position),
                    personType: text(item.personType),
                };
            },
        ),
    };
}

export const emptyDraft = (actorId: number): CourseDraft => ({
    workingStage: 0,
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
    sourceDocumentIds: [],
    sourceDocuments: [],
    sourceReview: null,
    delivery: null,
    audience: {
        personTypes: [],
        allDepartments: false,
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
    if (!draft.sourceDocumentIds.length)
        errors.push("Select at least one source document.");
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
    if (draft.assessments.filter((assessment) => assessment.type === "Pre-Test").length !== 1)
        errors.push("Add one Pre-Test.");
    if (draft.assessments.filter((assessment) => assessment.type === "Post-Test").length !== 1)
        errors.push("Add one Post-Test.");
    draft.assessments.forEach((assessment) => {
        if (assessment.type === "Knowledge Check" && !assessment.moduleClientId)
            errors.push(`Knowledge Check “${assessment.title}” must be linked to a module.`);
        if (["Pre-Test", "Post-Test", "Final Assessment"].includes(assessment.type) && assessment.moduleClientId)
            errors.push(`${assessment.type} must apply to the whole course.`);
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
