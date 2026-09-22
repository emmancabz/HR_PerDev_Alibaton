import { SHARED_PERSONNEL, type PersonType } from "@/data/personnel";

export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5;

export const PROFICIENCY_LEVELS: { value: ProficiencyLevel; label: string }[] =
    [
        { value: 1, label: "Awareness" },
        { value: 2, label: "Basic" },
        { value: 3, label: "Intermediate" },
        { value: 4, label: "Advanced" },
        { value: 5, label: "Expert" },
    ];

export type CompetencyCategory =
    | "Core & Behavioral"
    | "Functional & Technical"
    | "Safety & Compliance"
    | "Leadership & Supervisory"
    | "Digital & Analytical";

export const COMPETENCY_CATEGORIES: CompetencyCategory[] = [
    "Core & Behavioral",
    "Functional & Technical",
    "Safety & Compliance",
    "Leadership & Supervisory",
    "Digital & Analytical",
];

export type AssessmentMethod =
    | "Behavioral Interview"
    | "Direct Observation"
    | "Document Review"
    | "Knowledge Check"
    | "Practical Demonstration"
    | "Simulation"
    | "Work Sample Review";

export const ASSESSMENT_METHODS: AssessmentMethod[] = [
    "Behavioral Interview",
    "Direct Observation",
    "Document Review",
    "Knowledge Check",
    "Practical Demonstration",
    "Simulation",
    "Work Sample Review",
];

export type EvidenceType =
    | "Assessor Observation"
    | "Certificate or License"
    | "Incident or Safety Record"
    | "Knowledge Check Result"
    | "Photo or Video Evidence"
    | "Supervisor Verification"
    | "Work Output";

export const EVIDENCE_TYPES: EvidenceType[] = [
    "Assessor Observation",
    "Certificate or License",
    "Incident or Safety Record",
    "Knowledge Check Result",
    "Photo or Video Evidence",
    "Supervisor Verification",
    "Work Output",
];

export type LibraryStatus = "Draft" | "Active" | "Archived";
export type ProfileStatus = "Draft" | "Active" | "Archived";
export type CycleStatus =
    | "Draft"
    | "Scheduled"
    | "Active"
    | "Closed"
    | "Cancelled";
export type AssessmentStatus =
    | "Pending"
    | "In Progress"
    | "Submitted"
    | "Pending Validation"
    | "Returned for Revision"
    | "Finalized"
    | "Overdue"
    | "Cancelled";

export type AssessmentScope = "Full Role Profile" | "Targeted Competencies";

export type AssessmentType =
    | "Periodic Assessment"
    | "Probationary/Trainee Assessment"
    | "Post-Training Reassessment"
    | "Certification Renewal"
    | "Ad Hoc Assessment";

export const ASSESSMENT_TYPES: AssessmentType[] = [
    "Periodic Assessment",
    "Probationary/Trainee Assessment",
    "Post-Training Reassessment",
    "Certification Renewal",
    "Ad Hoc Assessment",
];

export type AppliesTo = PersonType | "Both";
export type EvidenceRequirement = "None" | "Optional" | "Required";
export type AssignmentMethod =
    | "Reporting Relationship"
    | "Role-based Assessor"
    | "Manual Authorized Assignment";

export type CompetencyVersionEntry = {
    version: number;
    changedAt: string;
    changedBy: string;
    summary: string;
    status: LibraryStatus;
    definition: CompetencyDefinitionSnapshot;
};

export type CompetencyDefinition = {
    id: string;
    lineageId: string;
    code: string;
    name: string;
    category: CompetencyCategory;
    definition: string;
    behavioralIndicators: Record<ProficiencyLevel, string>;
    assessmentMethods: AssessmentMethod[];
    requiredEvidenceTypes: EvidenceType[];
    reassessmentIntervalMonths: number | null;
    status: LibraryStatus;
    version: number;
    versionHistory: CompetencyVersionEntry[];
    lastUpdated: string;
    updatedBy: string;
    draftSourceId?: string | null;
};

export type RoleRequirement = {
    id: string;
    competencyId: string;
    requiredLevel: ProficiencyLevel;
    critical: boolean;
    evidenceRequirement: EvidenceRequirement;
    reassessmentIntervalMonths: number | null;
    notes: string;
};

export type RoleProfileVersionEntry = {
    version: number;
    effectiveDate: string;
    changedAt: string;
    changedBy: string;
    summary: string;
    status: ProfileStatus;
    name: string;
    position: string;
    department: string;
    appliesTo: AppliesTo;
    requirements: RoleRequirement[];
    competencyDefinitions: CompetencyDefinitionSnapshot[];
};

export type RoleProfile = {
    id: string;
    lineageId: string;
    name: string;
    position: string;
    department: string;
    appliesTo: AppliesTo;
    requirements: RoleRequirement[];
    version: number;
    effectiveDate: string;
    status: ProfileStatus;
    versionHistory: RoleProfileVersionEntry[];
    lastUpdated: string;
    updatedBy: string;
    draftSourceId?: string | null;
};

export type AssessmentCycle = {
    id: string;
    name: string;
    type: AssessmentType;
    startDate: string;
    endDate: string;
    appliesTo: AppliesTo;
    departments: string[];
    positions: string[];
    roleProfileIds: string[];
    assignmentMethod: AssignmentMethod;
    roleBasedAssessorScope: Exclude<
        AssessorAuthorizationScope,
        "Specific Person"
    > | null;
    roleBasedAssessorPositions: string[];
    requireSelfAssessment: boolean;
    requireSupportingEvidence: boolean;
    requireHrValidation: boolean;
    requireAcknowledgment: boolean;
    dueDaysAfterAssignment: number;
    reassessmentRule: string;
    autoAssign?: boolean;
    status: CycleStatus;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    cancellationReason: string | null;
    cancelledAt: string | null;
};

export type AssessorAuthorizationScope =
    | "Department"
    | "Position"
    | "Role Profile"
    | "Specific Person";

export type AssessorAuthorization = {
    id: string;
    assessorId: string;
    scope: AssessorAuthorizationScope;
    scopeValue: string;
    active: boolean;
    reason: string;
    authorizedAt: string;
    authorizedBy: string;
};

export type AssessmentEvidence = {
    id: string;
    type: EvidenceType;
    title: string;
    reference: string;
    description: string;
    addedAt: string;
    addedBy: string;
    verificationState: "Unverified" | "Reviewed" | "Verified";
    sourceContext: "Metadata or link reference";
};

export type CompetencyRating = {
    competencyId: string;
    selectedLevel: ProficiencyLevel | null;
    selfLevel: ProficiencyLevel | null;
    evidence: AssessmentEvidence[];
    assessorComments: string;
    selfComments: string;
    assessedAt: string | null;
};

export type CompetencyDefinitionSnapshot = {
    id: string;
    code: string;
    name: string;
    category: CompetencyCategory;
    definition: string;
    behavioralIndicators: Record<ProficiencyLevel, string>;
    assessmentMethods: AssessmentMethod[];
    requiredEvidenceTypes: EvidenceType[];
    reassessmentIntervalMonths: number | null;
    version: number;
};

export type RoleRequirementSnapshot = RoleRequirement & {
    competency: CompetencyDefinitionSnapshot;
};

export type RoleProfileSnapshot = {
    profileId: string;
    name: string;
    position: string;
    department: string;
    appliesTo: AppliesTo;
    version: number;
    requirements: RoleRequirementSnapshot[];
};

export type AssessmentCycleSnapshot = {
    cycleId: string;
    name: string;
    type: AssessmentType;
    startDate: string;
    endDate: string;
    appliesTo: AppliesTo;
    departments: string[];
    positions: string[];
    roleProfileIds: string[];
    roleProfileVersions: { profileId: string; version: number }[];
    assignmentMethod: AssignmentMethod;
    roleBasedAssessorScope: Exclude<
        AssessorAuthorizationScope,
        "Specific Person"
    > | null;
    roleBasedAssessorPositions: string[];
    requireSelfAssessment: boolean;
    requireSupportingEvidence: boolean;
    requireHrValidation: boolean;
    requireAcknowledgment: boolean;
    dueDaysAfterAssignment: number;
    reassessmentRule: string;
    autoAssign?: boolean;
};

export type AssessmentRevisionEntry = {
    version: number;
    action: "Returned for Revision" | "Reopened";
    reason: string;
    notes: string;
    actorId: string;
    actorName: string;
    createdAt: string;
    previousStatus: AssessmentStatus;
    previousRatings: CompetencyRating[];
    previousHrValidationNotes: string;
};

export type AssessmentReassignmentEntry = {
    fromAssessorId: string;
    toAssessorId: string;
    reason: string;
    actorId: string;
    actorName: string;
    createdAt: string;
};

export type CompetencyAuditEntry = {
    id: string;
    action: string;
    detail: string;
    actorId: string;
    actorName: string;
    createdAt: string;
    entityType?:
        | "Competency"
        | "Role Profile"
        | "Cycle"
        | "Assessor Authorization"
        | "Assessment"
        | "Development";
    entityId?: string;
    metadata?: Record<string, string | number | boolean | null>;
};

export type FinalizedAssessmentSnapshot = {
    version: number;
    profile: RoleProfileSnapshot;
    cycle: AssessmentCycleSnapshot;
    ratings: CompetencyRating[];
    assessorId: string;
    hrValidationNotes: string;
    submittedAt: string | null;
    employeeAcknowledgedAt: string | null;
    finalizedAt: string;
    finalizedBy: string;
};


export type AssessmentAcknowledgmentEvent = {
    id: string;
    assessmentId: string;
    finalizedVersion: number;
    personId: string;
    acknowledgedAt: string;
    actorId: string;
    actorName: string;
    sourceContext: string;
    eventType: "Assessment Receipt Acknowledged";
};

export type CompetencyAssessment = {
    id: string;
    personId: string;
    personType: PersonType;
    roleProfileId: string;
    roleProfileSnapshot: RoleProfileSnapshot;
    cycleId: string;
    cycleSnapshot: AssessmentCycleSnapshot;
    assessorId: string;
    assignedAt: string;
    dueDate: string;
    status: AssessmentStatus;
    ratings: CompetencyRating[];
    hrValidationNotes: string;
    employeeAcknowledgedAt: string | null;
    submittedAt: string | null;
    finalizedAt: string | null;
    finalizedSnapshot: FinalizedAssessmentSnapshot | null;
    finalizedSnapshots: FinalizedAssessmentSnapshot[];
    revisionSourceAssessmentId: string | null;
    scope?: AssessmentScope;
    targetCompetencyIds?: string[];
    sourceRecommendationIds?: string[];
    revisionHistory: AssessmentRevisionEntry[];
    reassignmentHistory: AssessmentReassignmentEntry[];
    auditHistory: CompetencyAuditEntry[];
    lastUpdated: string;
};

export type RecommendationType = "Learning" | "Training";
export type DevelopmentStatus =
    | "Recommended"
    | "Reviewed"
    | "Reassessment Requested"
    | "Reassessed";

export type DevelopmentRecommendation = {
    sourceAssessmentVersion?: number;
    sourceRequiredLevel?: number;
    sourceValidatedLevel?: number;
    integration?: { recordId: string | null; status: string; completedAt: string | null };
    outcome?: string;
    id: string;
    personId: string;
    competencyId: string;
    sourceAssessmentId: string;
    type: RecommendationType;
    title: string;
    note: string;
    status: DevelopmentStatus;
    createdAt: string;
    createdBy: string;
    reviewedAt: string | null;
    reassessmentDue: string | null;
    reassessedAt: string | null;
    reassessmentAssessmentId: string | null;
};

export type CompetencyActivity = {
    id: string;
    type: "Library" | "Profile" | "Cycle" | "Assessment" | "Development";
    title: string;
    detail: string;
    personId: string | null;
    createdAt: string;
};

export type CompetencyState = {
    governanceAllowed?: boolean;
    profileRows?: import("./competencyCalculations").CompetencyProfileRow[];
    metrics?: Record<string, number | string>;
    learningReferences?: { competencyId: string; targetLevel: number; courseId: string; versionId: string; title: string }[];
    trainingReferences?: { competencyId: string; targetLevel: number; programId: string; title: string }[];
    developmentEvidence?: { id: string; personId: string; competencyId: string; type: 'Learning' | 'Training'; title: string; completedAt: string; reference: string }[];
    schemaVersion: 4;
    competencies: CompetencyDefinition[];
    roleProfiles: RoleProfile[];
    cycles: AssessmentCycle[];
    assessorAuthorizations: AssessorAuthorization[];
    assessments: CompetencyAssessment[];
    acknowledgmentEvents: AssessmentAcknowledgmentEvent[];
    recommendations: DevelopmentRecommendation[];
    activities: CompetencyActivity[];
    auditLog: CompetencyAuditEntry[];
};

export const COMPETENCY_STORAGE_KEY = "alibaton.competency.frontend.v1";

export function proficiencyLabel(
    level: ProficiencyLevel | null | undefined,
): string {
    return (
        PROFICIENCY_LEVELS.find((item) => item.value === level)?.label ??
        "Not Assessed"
    );
}

export function uniqueId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function philippineDateTimeParts(date: Date): Record<string, string> {
    return Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(date)
            .map((part) => [part.type, part.value]),
    );
}

export function localDateValue(date = new Date()): string {
    const { year, month, day } = philippineDateTimeParts(date);
    return `${year}-${month}-${day}`;
}

export function localDateTimeValue(date = new Date()): string {
    const { year, month, day, hour, minute, second } =
        philippineDateTimeParts(date);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function dateFromToday(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateValue(date);
}

function indicators(
    values: [string, string, string, string, string],
): Record<ProficiencyLevel, string> {
    return {
        1: values[0],
        2: values[1],
        3: values[2],
        4: values[3],
        5: values[4],
    };
}

function competency(
    id: string,
    code: string,
    name: string,
    category: CompetencyCategory,
    definition: string,
    behavioralIndicators: Record<ProficiencyLevel, string>,
    assessmentMethods: AssessmentMethod[],
    requiredEvidenceTypes: EvidenceType[],
    reassessmentIntervalMonths: number | null,
    status: LibraryStatus = "Active",
): CompetencyDefinition {
    const updated = dateFromToday(-14);
    const definitionRecord: CompetencyDefinition = {
        id,
        lineageId: id,
        code,
        name,
        category,
        definition,
        behavioralIndicators,
        assessmentMethods,
        requiredEvidenceTypes,
        reassessmentIntervalMonths,
        status,
        version: 1,
        versionHistory: [],
        lastUpdated: updated,
        updatedBy: "Celso Ramirez",
    };
    definitionRecord.versionHistory = [
        {
            version: 1,
            changedAt: updated,
            changedBy: "Celso Ramirez",
            summary: "Initial competency definition",
            status,
            definition: snapshotCompetencyDefinition(definitionRecord),
        },
    ];
    return definitionRecord;
}

function requirement(
    competencyId: string,
    requiredLevel: ProficiencyLevel,
    critical: boolean,
    evidenceRequirement: EvidenceRequirement,
    reassessmentIntervalMonths: number | null,
    notes = "",
): RoleRequirement {
    return {
        id: `req-${competencyId}-${requiredLevel}`,
        competencyId,
        requiredLevel,
        critical,
        evidenceRequirement,
        reassessmentIntervalMonths,
        notes,
    };
}

function profile(
    id: string,
    name: string,
    position: string,
    department: string,
    appliesTo: AppliesTo,
    requirements: RoleRequirement[],
    competencies: CompetencyDefinition[],
    version = 1,
): RoleProfile {
    const effectiveDate = dateFromToday(-45);
    return {
        id,
        lineageId: id,
        name,
        position,
        department,
        appliesTo,
        requirements,
        version,
        effectiveDate,
        status: "Active",
        versionHistory: [
            {
                version,
                effectiveDate,
                changedAt: effectiveDate,
                changedBy: "Grace Fernandez",
                summary: "Initial active role profile",
                status: "Active",
                name,
                position,
                department,
                appliesTo,
                requirements: requirements.map((item) => ({ ...item })),
                competencyDefinitions: requirements.flatMap((item) => {
                    const definitionRecord = competencies.find(
                        (competencyItem) =>
                            competencyItem.id === item.competencyId,
                    );
                    return definitionRecord
                        ? [snapshotCompetencyDefinition(definitionRecord)]
                        : [];
                }),
            },
        ],
        lastUpdated: effectiveDate,
        updatedBy: "Grace Fernandez",
    };
}

export function snapshotCompetencyDefinition(
    competencyDefinition: CompetencyDefinition,
): CompetencyDefinitionSnapshot {
    return {
        id: competencyDefinition.id,
        code: competencyDefinition.code,
        name: competencyDefinition.name,
        category: competencyDefinition.category,
        definition: competencyDefinition.definition,
        behavioralIndicators: { ...competencyDefinition.behavioralIndicators },
        assessmentMethods: [...competencyDefinition.assessmentMethods],
        requiredEvidenceTypes: [...competencyDefinition.requiredEvidenceTypes],
        reassessmentIntervalMonths:
            competencyDefinition.reassessmentIntervalMonths,
        version: competencyDefinition.version,
    };
}

export function snapshotRoleProfile(
    roleProfile: RoleProfile,
    competencies: CompetencyDefinition[],
): RoleProfileSnapshot {
    return {
        profileId: roleProfile.id,
        name: roleProfile.name,
        position: roleProfile.position,
        department: roleProfile.department,
        appliesTo: roleProfile.appliesTo,
        version: roleProfile.version,
        requirements: roleProfile.requirements.map((item) => {
            const competencyDefinition = competencies.find(
                (competencyItem) => competencyItem.id === item.competencyId,
            );
            if (!competencyDefinition) {
                throw new Error(
                    `Cannot snapshot missing competency definition: ${item.competencyId}`,
                );
            }
            return {
                ...item,
                competency: snapshotCompetencyDefinition(competencyDefinition),
            };
        }),
    };
}

export function cloneRoleProfileSnapshot(
    snapshot: RoleProfileSnapshot,
): RoleProfileSnapshot {
    return {
        ...snapshot,
        requirements: snapshot.requirements.map((requirementItem) => ({
            ...requirementItem,
            competency: {
                ...requirementItem.competency,
                behavioralIndicators: {
                    ...requirementItem.competency.behavioralIndicators,
                },
                assessmentMethods: [
                    ...requirementItem.competency.assessmentMethods,
                ],
                requiredEvidenceTypes: [
                    ...requirementItem.competency.requiredEvidenceTypes,
                ],
            },
        })),
    };
}

export function snapshotAssessmentCycle(
    cycle: AssessmentCycle,
    roleProfiles: RoleProfile[],
): AssessmentCycleSnapshot {
    return {
        cycleId: cycle.id,
        name: cycle.name,
        type: cycle.type,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        appliesTo: cycle.appliesTo,
        departments: [...cycle.departments],
        positions: [...cycle.positions],
        roleProfileIds: [...cycle.roleProfileIds],
        roleProfileVersions: cycle.roleProfileIds.flatMap((profileId) => {
            const profileRecord = roleProfiles.find(
                (item) => item.id === profileId,
            );
            return profileRecord
                ? [{ profileId, version: profileRecord.version }]
                : [];
        }),
        assignmentMethod: cycle.assignmentMethod,
        roleBasedAssessorScope: cycle.roleBasedAssessorScope,
        roleBasedAssessorPositions: [...cycle.roleBasedAssessorPositions],
        requireSelfAssessment: cycle.requireSelfAssessment,
        requireSupportingEvidence: cycle.requireSupportingEvidence,
        requireHrValidation: cycle.requireHrValidation,
        requireAcknowledgment: cycle.requireAcknowledgment,
        dueDaysAfterAssignment: cycle.dueDaysAfterAssignment,
        reassessmentRule: cycle.reassessmentRule,
        autoAssign: cycle.autoAssign !== false,
    };
}

export function cloneAssessmentCycleSnapshot(
    snapshot: AssessmentCycleSnapshot,
): AssessmentCycleSnapshot {
    return {
        ...snapshot,
        departments: [...snapshot.departments],
        positions: [...snapshot.positions],
        roleProfileIds: [...snapshot.roleProfileIds],
        roleProfileVersions: snapshot.roleProfileVersions.map((item) => ({
            ...item,
        })),
        roleBasedAssessorPositions: [...snapshot.roleBasedAssessorPositions],
    };
}

function evidence(
    competencyId: string,
    title: string,
    type: EvidenceType = "Assessor Observation",
): AssessmentEvidence {
    return {
        id: `evidence-${competencyId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        type,
        title,
        reference: "Retained evidence metadata reference",
        description: "Evidence context retained with the assessment record.",
        addedAt: dateFromToday(-8),
        addedBy: "Assigned assessor",
        verificationState: "Reviewed",
        sourceContext: "Metadata or link reference",
    };
}

function buildRatings(
    roleProfile: RoleProfile,
    levels: Partial<Record<string, ProficiencyLevel | null>>,
    includeEvidence = true,
    requireAllEvidence = false,
    requireSelfAssessment = false,
): CompetencyRating[] {
    return roleProfile.requirements.map((item) => {
        const selectedLevel = levels[item.competencyId] ?? null;
        return {
            competencyId: item.competencyId,
            selectedLevel,
            selfLevel:
                requireSelfAssessment && selectedLevel
                    ? (Math.max(1, selectedLevel - 1) as ProficiencyLevel)
                    : null,
            evidence:
                includeEvidence &&
                selectedLevel &&
                (requireAllEvidence ||
                    item.critical ||
                    item.evidenceRequirement === "Required")
                    ? [
                          evidence(
                              item.competencyId,
                              "Supervisor-observed work demonstration",
                          ),
                      ]
                    : [],
            assessorComments: selectedLevel
                ? "Level selected against the documented behavioral indicators and available evidence."
                : "",
            selfComments:
                requireSelfAssessment && selectedLevel
                    ? "Self-reflection submitted for assessor context only."
                    : "",
            assessedAt: selectedLevel ? dateFromToday(-8) : null,
        };
    });
}

function assessment(
    id: string,
    personId: string,
    personType: PersonType,
    roleProfile: RoleProfile,
    competencies: CompetencyDefinition[],
    cycle: AssessmentCycle,
    assessorId: string,
    status: AssessmentStatus,
    dueInDays: number,
    levels: Partial<Record<string, ProficiencyLevel | null>>,
    includeEvidence = true,
    completedDaysAgo = 5,
): CompetencyAssessment {
    const assignedAt = dateFromToday(-(completedDaysAgo + 20));
    const ratings = buildRatings(
        roleProfile,
        levels,
        includeEvidence,
        cycle.requireSupportingEvidence,
        cycle.requireSelfAssessment,
    ).map((rating) => ({
        ...rating,
        assessedAt: rating.selectedLevel
            ? dateFromToday(-completedDaysAgo)
            : null,
    }));
    const submittedAt = [
        "Submitted",
        "Pending Validation",
        "Finalized",
    ].includes(status)
        ? dateFromToday(-(completedDaysAgo + 2))
        : null;
    const finalizedAt =
        status === "Finalized" ? dateFromToday(-completedDaysAgo) : null;
    const snapshot = snapshotRoleProfile(roleProfile, competencies);
    const cycleSnapshot = snapshotAssessmentCycle(cycle, [roleProfile]);
    const finalizedSnapshot: FinalizedAssessmentSnapshot | null = finalizedAt
        ? {
              version: 1,
              profile: cloneRoleProfileSnapshot(snapshot),
              cycle: cloneAssessmentCycleSnapshot(cycleSnapshot),
              ratings: ratings.map((rating) => ({
                  ...rating,
                  evidence: rating.evidence.map((item) => ({ ...item })),
              })),
              assessorId,
              hrValidationNotes:
                  "Validated against the active role-profile snapshot and supporting evidence.",
              submittedAt,
              employeeAcknowledgedAt: null,
              finalizedAt,
              finalizedBy: "Celso Ramirez",
          }
        : null;
    return {
        id,
        personId,
        personType,
        roleProfileId: roleProfile.id,
        roleProfileSnapshot: snapshot,
        cycleId: cycle.id,
        cycleSnapshot,
        assessorId,
        assignedAt,
        dueDate: dateFromToday(dueInDays),
        status,
        ratings,
        hrValidationNotes:
            status === "Finalized"
                ? "Validated against the active role-profile snapshot and supporting evidence."
                : "",
        employeeAcknowledgedAt: null,
        submittedAt,
        finalizedAt,
        finalizedSnapshot,
        finalizedSnapshots: finalizedSnapshot ? [finalizedSnapshot] : [],
        revisionSourceAssessmentId: null,
        scope: "Full Role Profile",
        targetCompetencyIds: snapshot.requirements.map((item) => item.competencyId),
        sourceRecommendationIds: [],
        revisionHistory: [],
        reassignmentHistory: [],
        auditHistory: [
            {
                id: `audit-${id}-assigned`,
                action: "Assessment assigned",
                detail: `Authorized assessor assigned for ${roleProfile.name}.`,
                actorId: "user-4",
                actorName: "Celso Ramirez",
                createdAt: assignedAt,
            },
        ],
        lastUpdated: finalizedAt ?? submittedAt ?? dateFromToday(-2),
    };
}

export function createCompetencyInitialState(): CompetencyState {
    const competencies: CompetencyDefinition[] = [
        competency(
            "comp-communication",
            "CMP-001",
            "Communication",
            "Core & Behavioral",
            "Conveys information clearly, listens actively, and adapts messages to workplace audiences.",
            indicators([
                "Recognizes the need for clear and respectful workplace communication.",
                "Shares routine information clearly and asks clarifying questions when needed.",
                "Adapts messages to the audience and confirms shared understanding.",
                "Facilitates complex discussions and resolves communication barriers.",
                "Sets communication standards and coaches others in high-stakes situations.",
            ]),
            ["Behavioral Interview", "Direct Observation"],
            ["Assessor Observation"],
            24,
        ),
        competency(
            "comp-teamwork",
            "CMP-002",
            "Teamwork",
            "Core & Behavioral",
            "Collaborates constructively, shares responsibility, and supports team goals.",
            indicators([
                "Recognizes how individual work contributes to team outcomes.",
                "Participates reliably in assigned team tasks.",
                "Coordinates work, shares information, and supports colleagues proactively.",
                "Resolves team friction and improves cross-functional collaboration.",
                "Builds collaborative practices across teams and mentors team facilitators.",
            ]),
            ["Behavioral Interview", "Direct Observation"],
            ["Supervisor Verification"],
            24,
        ),
        competency(
            "comp-accountability",
            "CMP-003",
            "Accountability",
            "Core & Behavioral",
            "Takes ownership of commitments, quality, safety, and corrective action.",
            indicators([
                "Understands assigned responsibilities and escalation paths.",
                "Completes routine commitments with guidance and reports issues promptly.",
                "Owns results, corrects errors, and follows through without repeated prompting.",
                "Anticipates risks and establishes reliable accountability within the team.",
                "Shapes organization-wide ownership standards and addresses systemic gaps.",
            ]),
            ["Behavioral Interview", "Direct Observation"],
            ["Supervisor Verification"],
            24,
        ),
        competency(
            "comp-problem-solving",
            "CMP-004",
            "Problem Solving",
            "Digital & Analytical",
            "Defines problems, evaluates evidence, and implements practical solutions.",
            indicators([
                "Recognizes common workplace problems and knows when to escalate.",
                "Uses established steps to resolve routine issues.",
                "Analyzes causes, compares options, and implements a supported solution.",
                "Solves ambiguous or cross-functional problems using structured analysis.",
                "Creates problem-solving standards and guides resolution of strategic issues.",
            ]),
            ["Behavioral Interview", "Work Sample Review"],
            ["Work Output"],
            24,
        ),
        competency(
            "comp-crane-operation",
            "CMP-005",
            "Crane Operation",
            "Functional & Technical",
            "Operates cranes safely within equipment, load, site, and regulatory limits.",
            indicators([
                "Identifies major crane components, controls, hazards, and operator responsibilities.",
                "Performs basic controlled movements under direct supervision.",
                "Conducts standard lifts safely and responds correctly to normal site conditions.",
                "Plans and executes complex lifts while coordinating the lifting team.",
                "Handles exceptional lift conditions and coaches other qualified operators.",
            ]),
            ["Practical Demonstration", "Simulation"],
            ["Assessor Observation", "Certificate or License"],
            12,
        ),
        competency(
            "comp-heavy-equipment",
            "CMP-006",
            "Heavy Equipment Operation",
            "Functional & Technical",
            "Operates assigned heavy equipment safely, efficiently, and within operating limits.",
            indicators([
                "Identifies equipment controls, hazards, and basic operating limits.",
                "Performs basic maneuvers under direct supervision.",
                "Completes routine operations safely in standard site conditions.",
                "Handles complex conditions, optimizes operation, and guides junior operators.",
                "Defines advanced operating practices and troubleshoots exceptional conditions.",
            ]),
            ["Practical Demonstration", "Direct Observation"],
            ["Assessor Observation", "Certificate or License"],
            12,
        ),
        competency(
            "comp-defensive-driving",
            "CMP-007",
            "Defensive Driving",
            "Safety & Compliance",
            "Applies defensive driving practices to anticipate hazards and protect people, cargo, and equipment.",
            indicators([
                "Identifies basic road hazards and company driving rules.",
                "Applies routine defensive practices with supervision.",
                "Consistently anticipates hazards and maintains safe margins.",
                "Manages high-risk conditions and coaches peers using observed evidence.",
                "Develops defensive-driving standards and analyzes fleet-wide risk patterns.",
            ]),
            ["Practical Demonstration", "Simulation"],
            ["Assessor Observation", "Incident or Safety Record"],
            12,
        ),
        competency(
            "comp-equipment-inspection",
            "CMP-008",
            "Equipment Inspection",
            "Functional & Technical",
            "Performs systematic pre-use and condition inspections and documents findings accurately.",
            indicators([
                "Recognizes major inspection points and defect categories.",
                "Completes a checklist with guidance and reports obvious defects.",
                "Independently performs complete routine inspections and accurate documentation.",
                "Diagnoses complex inspection findings and prioritizes corrective action.",
                "Improves inspection standards and validates the work of other inspectors.",
            ]),
            ["Practical Demonstration", "Document Review"],
            ["Work Output", "Assessor Observation"],
            12,
        ),
        competency(
            "comp-preventive-maintenance",
            "CMP-009",
            "Preventive Maintenance",
            "Functional & Technical",
            "Carries out scheduled care that preserves equipment reliability and safe operation.",
            indicators([
                "Identifies the purpose and basic schedule of preventive maintenance.",
                "Completes basic maintenance tasks with supervision.",
                "Performs scheduled maintenance correctly and records work accurately.",
                "Diagnoses recurring issues and improves maintenance planning.",
                "Defines maintenance strategy and mentors others on complex equipment needs.",
            ]),
            ["Practical Demonstration", "Work Sample Review"],
            ["Work Output", "Supervisor Verification"],
            12,
        ),
        competency(
            "comp-hazard-identification",
            "CMP-010",
            "Hazard Identification",
            "Safety & Compliance",
            "Recognizes, evaluates, communicates, and helps control workplace hazards.",
            indicators([
                "Recognizes common hazards and basic reporting channels.",
                "Identifies routine hazards using established checklists.",
                "Evaluates risk and recommends appropriate controls for standard work.",
                "Leads complex hazard assessments and validates control effectiveness.",
                "Designs hazard-identification practices and coaches organization-wide application.",
            ]),
            ["Direct Observation", "Simulation"],
            ["Incident or Safety Record", "Assessor Observation"],
            12,
        ),
        competency(
            "comp-safety-compliance",
            "CMP-011",
            "Safety Procedure Compliance",
            "Safety & Compliance",
            "Applies required safety procedures, permits, controls, and escalation practices.",
            indicators([
                "Identifies core safety procedures and why they are required.",
                "Follows routine procedures with guidance and uses required protective controls.",
                "Consistently applies procedures and corrects routine deviations.",
                "Interprets complex requirements and leads procedural compliance in the team.",
                "Establishes compliance standards and resolves systemic safety-control gaps.",
            ]),
            ["Direct Observation", "Knowledge Check"],
            ["Assessor Observation", "Knowledge Check Result"],
            12,
        ),
        competency(
            "comp-incident-reporting",
            "CMP-012",
            "Incident Reporting",
            "Safety & Compliance",
            "Records and communicates incidents accurately, promptly, and through approved channels.",
            indicators([
                "Recognizes reportable events and required reporting channels.",
                "Completes basic incident reports with guidance.",
                "Produces accurate, timely reports with relevant facts and supporting records.",
                "Reviews report quality and guides teams through complex reporting situations.",
                "Improves reporting governance and analyzes recurring quality weaknesses.",
            ]),
            ["Document Review", "Simulation"],
            ["Incident or Safety Record", "Work Output"],
            12,
        ),
        competency(
            "comp-site-coordination",
            "CMP-013",
            "Construction Site Coordination",
            "Functional & Technical",
            "Coordinates people, equipment, access, sequencing, and communication at construction sites.",
            indicators([
                "Identifies key site roles, work zones, and coordination channels.",
                "Coordinates routine tasks using an established site plan.",
                "Aligns resources and resolves normal sequencing or access conflicts.",
                "Leads multi-team coordination for complex or changing site conditions.",
                "Establishes coordination systems for major projects and mentors site leaders.",
            ]),
            ["Direct Observation", "Work Sample Review"],
            ["Supervisor Verification", "Work Output"],
            18,
        ),
        competency(
            "comp-team-leadership",
            "CMP-014",
            "Team Leadership",
            "Leadership & Supervisory",
            "Sets direction, coordinates work, makes accountable decisions, and supports team performance.",
            indicators([
                "Recognizes the responsibilities and boundaries of a team leader.",
                "Coordinates routine work with guidance and communicates priorities.",
                "Sets clear expectations, monitors work, and addresses normal team issues.",
                "Leads through complex conditions and develops team capability.",
                "Shapes leadership practices and mentors leaders across functions.",
            ]),
            ["Behavioral Interview", "Direct Observation"],
            ["Supervisor Verification"],
            18,
        ),
        competency(
            "comp-coaching",
            "CMP-015",
            "Coaching and Mentoring",
            "Leadership & Supervisory",
            "Provides structured guidance and feedback that develops another person’s capability.",
            indicators([
                "Recognizes when guidance or feedback is needed.",
                "Provides basic task guidance using established materials.",
                "Sets development goals, observes practice, and gives actionable feedback.",
                "Coaches across complex skill gaps and evaluates development progress.",
                "Builds mentoring capability and coaching standards across the organization.",
            ]),
            ["Behavioral Interview", "Direct Observation"],
            ["Supervisor Verification"],
            18,
        ),
        competency(
            "comp-data-interpretation",
            "CMP-016",
            "Data Interpretation",
            "Digital & Analytical",
            "Reads operational data, identifies patterns, and communicates evidence-based implications.",
            indicators([
                "Recognizes common operational measures and basic data-quality concerns.",
                "Reads standard reports and identifies straightforward differences.",
                "Interprets trends, checks context, and explains supported conclusions.",
                "Integrates multiple sources and challenges weak or misleading interpretations.",
                "Defines analytical standards and guides high-impact evidence-based decisions.",
            ]),
            ["Knowledge Check", "Work Sample Review"],
            ["Knowledge Check Result", "Work Output"],
            24,
        ),
    ];

    const profiles: RoleProfile[] = [
        profile(
            "profile-safety-officer",
            "Safety Officer Competency Profile",
            "Safety Officer",
            "Safety & Compliance",
            "Employee",
            [
                requirement(
                    "comp-hazard-identification",
                    4,
                    true,
                    "Required",
                    12,
                    "Must lead site hazard reviews.",
                ),
                requirement("comp-safety-compliance", 4, true, "Required", 12),
                requirement("comp-incident-reporting", 4, true, "Required", 12),
                requirement("comp-communication", 3, false, "Optional", 24),
                requirement(
                    "comp-data-interpretation",
                    3,
                    false,
                    "Optional",
                    24,
                ),
            ],
            competencies,
        ),
        profile(
            "profile-crane-supervisor",
            "Crane Operations Supervisor Profile",
            "Crane Operations Supervisor",
            "Crane Operations",
            "Employee",
            [
                requirement("comp-crane-operation", 5, true, "Required", 12),
                requirement(
                    "comp-equipment-inspection",
                    4,
                    true,
                    "Required",
                    12,
                ),
                requirement(
                    "comp-hazard-identification",
                    4,
                    true,
                    "Required",
                    12,
                ),
                requirement("comp-team-leadership", 4, true, "Required", 18),
                requirement("comp-coaching", 3, false, "Optional", 18),
            ],
            competencies,
        ),
        profile(
            "profile-operations-supervisor",
            "Operations Supervisor Profile",
            "Operations Supervisor",
            "Operations",
            "Employee",
            [
                requirement("comp-site-coordination", 4, true, "Required", 18),
                requirement("comp-team-leadership", 4, true, "Required", 18),
                requirement("comp-problem-solving", 4, false, "Optional", 24),
                requirement("comp-accountability", 4, false, "Optional", 24),
                requirement(
                    "comp-hazard-identification",
                    3,
                    true,
                    "Required",
                    12,
                ),
            ],
            competencies,
        ),
        profile(
            "profile-finance-staff",
            "Finance Staff Competency Profile",
            "Finance Staff",
            "Finance",
            "Employee",
            [
                requirement(
                    "comp-data-interpretation",
                    3,
                    true,
                    "Required",
                    24,
                ),
                requirement("comp-accountability", 3, true, "Optional", 24),
                requirement("comp-problem-solving", 3, false, "Optional", 24),
                requirement("comp-communication", 3, false, "Optional", 24),
            ],
            competencies,
        ),
        profile(
            "profile-training-officer",
            "Training Officer Competency Profile",
            "Training Officer",
            "Human Resources",
            "Employee",
            [
                requirement("comp-communication", 4, true, "Required", 24),
                requirement("comp-coaching", 4, true, "Required", 18),
                requirement("comp-teamwork", 3, false, "Optional", 24),
                requirement(
                    "comp-data-interpretation",
                    3,
                    false,
                    "Optional",
                    24,
                ),
            ],
            competencies,
        ),
        profile(
            "profile-graduate-trainee",
            "Operations Graduate Trainee Profile",
            "Graduate Trainee",
            "Operations",
            "Trainee",
            [
                requirement("comp-safety-compliance", 2, true, "Required", 6),
                requirement(
                    "comp-hazard-identification",
                    2,
                    true,
                    "Required",
                    6,
                ),
                requirement("comp-teamwork", 2, false, "Optional", 12),
                requirement("comp-communication", 2, false, "Optional", 12),
                requirement("comp-accountability", 2, false, "Optional", 12),
            ],
            competencies,
        ),
    ];

    const cycles: AssessmentCycle[] = [
        {
            id: "cycle-active-periodic",
            name: "2026 Q3 Competency Validation",
            type: "Periodic Assessment",
            startDate: dateFromToday(-25),
            endDate: dateFromToday(20),
            appliesTo: "Both",
            departments: [],
            positions: [],
            roleProfileIds: profiles.map((item) => item.id),
            assignmentMethod: "Role-based Assessor",
            requireSelfAssessment: true,
            roleBasedAssessorScope: "Department",
            roleBasedAssessorPositions: [
                "Crane Operations Supervisor",
                "Operations Supervisor",
                "Finance Manager",
                "Safety Supervisor",
                "HR Business Partner",
            ],
            requireSupportingEvidence: true,
            requireHrValidation: true,
            requireAcknowledgment: true,
            dueDaysAfterAssignment: 30,
            reassessmentRule:
                "Reassess open gaps within 90 days after a development recommendation is reviewed.",
            status: "Active",
            createdAt: dateFromToday(-40),
            createdBy: "Celso Ramirez",
            updatedAt: dateFromToday(-25),
            updatedBy: "Celso Ramirez",
            cancellationReason: null,
            cancelledAt: null,
        },
        {
            id: "cycle-prior-periodic",
            name: "2025 Annual Competency Validation",
            type: "Periodic Assessment",
            startDate: dateFromToday(-420),
            endDate: dateFromToday(-360),
            appliesTo: "Employee",
            departments: [],
            positions: [],
            roleProfileIds: profiles
                .filter((item) => item.appliesTo === "Employee")
                .map((item) => item.id),
            assignmentMethod: "Role-based Assessor",
            requireSelfAssessment: false,
            roleBasedAssessorScope: "Department",
            roleBasedAssessorPositions: [
                "Crane Operations Supervisor",
                "Operations Supervisor",
                "Finance Manager",
                "Safety Supervisor",
                "HR Business Partner",
            ],
            requireSupportingEvidence: true,
            requireHrValidation: true,
            requireAcknowledgment: false,
            dueDaysAfterAssignment: 30,
            reassessmentRule: "Follow profile-level reassessment intervals.",
            status: "Closed",
            createdAt: dateFromToday(-440),
            createdBy: "Celso Ramirez",
            updatedAt: dateFromToday(-360),
            updatedBy: "Celso Ramirez",
            cancellationReason: null,
            cancelledAt: null,
        },
        {
            id: "cycle-trainee",
            name: "Graduate Trainee 90-Day Validation",
            type: "Probationary/Trainee Assessment",
            startDate: dateFromToday(-10),
            endDate: dateFromToday(35),
            appliesTo: "Trainee",
            departments: ["Operations"],
            positions: ["Graduate Trainee"],
            roleProfileIds: ["profile-graduate-trainee"],
            assignmentMethod: "Manual Authorized Assignment",
            requireSelfAssessment: true,
            roleBasedAssessorScope: null,
            roleBasedAssessorPositions: [],
            requireSupportingEvidence: true,
            requireHrValidation: true,
            requireAcknowledgment: true,
            dueDaysAfterAssignment: 21,
            reassessmentRule:
                "Repeat at the next approved trainee milestone when required.",
            status: "Scheduled",
            createdAt: dateFromToday(-20),
            createdBy: "Grace Fernandez",
            updatedAt: dateFromToday(-20),
            updatedBy: "Grace Fernandez",
            cancellationReason: null,
            cancelledAt: null,
        },
        {
            id: "cycle-renewal",
            name: "Operator Certification Renewal 2026",
            type: "Certification Renewal",
            startDate: dateFromToday(45),
            endDate: dateFromToday(75),
            appliesTo: "Employee",
            departments: ["Crane Operations"],
            positions: ["Crane Operations Supervisor"],
            roleProfileIds: ["profile-crane-supervisor"],
            assignmentMethod: "Role-based Assessor",
            requireSelfAssessment: false,
            roleBasedAssessorScope: "Department",
            roleBasedAssessorPositions: ["Crane Operations Supervisor"],
            requireSupportingEvidence: true,
            requireHrValidation: true,
            requireAcknowledgment: true,
            dueDaysAfterAssignment: 14,
            reassessmentRule:
                "Follow license and role-profile validity requirements.",
            status: "Draft",
            createdAt: dateFromToday(-2),
            createdBy: "Celso Ramirez",
            updatedAt: dateFromToday(-2),
            updatedBy: "Celso Ramirez",
            cancellationReason: null,
            cancelledAt: null,
        },
        {
            id: "cycle-post-training",
            name: "Post-Safety Training Reassessment",
            type: "Post-Training Reassessment",
            startDate: dateFromToday(30),
            endDate: dateFromToday(60),
            appliesTo: "Both",
            departments: ["Safety & Compliance", "Operations"],
            positions: [],
            roleProfileIds: [
                "profile-safety-officer",
                "profile-graduate-trainee",
            ],
            assignmentMethod: "Manual Authorized Assignment",
            requireSelfAssessment: false,
            roleBasedAssessorScope: null,
            roleBasedAssessorPositions: [],
            requireSupportingEvidence: true,
            requireHrValidation: true,
            requireAcknowledgment: false,
            dueDaysAfterAssignment: 14,
            reassessmentRule:
                "Training completion does not close a gap; a finalized reassessment is required.",
            status: "Draft",
            createdAt: dateFromToday(-1),
            createdBy: "Grace Fernandez",
            updatedAt: dateFromToday(-1),
            updatedBy: "Grace Fernandez",
            cancellationReason: null,
            cancelledAt: null,
        },
    ];

    const authorizations: AssessorAuthorization[] = [
        {
            id: "auth-safety",
            assessorId: "user-gen-13",
            scope: "Department",
            scopeValue: "Safety & Compliance",
            active: true,
            reason: "Safety Supervisor validates department competency evidence.",
            authorizedAt: dateFromToday(-90),
            authorizedBy: "Celso Ramirez",
        },
        {
            id: "auth-crane",
            assessorId: "user-gen-8",
            scope: "Department",
            scopeValue: "Crane Operations",
            active: true,
            reason: "Crane Operations Supervisor is authorized for the operating unit.",
            authorizedAt: dateFromToday(-90),
            authorizedBy: "Celso Ramirez",
        },
        {
            id: "auth-operations",
            assessorId: "user-gen-10",
            scope: "Department",
            scopeValue: "Operations",
            active: true,
            reason: "Operations Supervisor assessment scope.",
            authorizedAt: dateFromToday(-90),
            authorizedBy: "Celso Ramirez",
        },
        {
            id: "auth-finance",
            assessorId: "user-gen-11",
            scope: "Department",
            scopeValue: "Finance",
            active: true,
            reason: "Finance Manager assessment scope.",
            authorizedAt: dateFromToday(-90),
            authorizedBy: "Celso Ramirez",
        },
        {
            id: "auth-training",
            assessorId: "user-4",
            scope: "Specific Person",
            scopeValue: "user-10",
            active: true,
            reason: "Explicit HR assessor assignment for the Training Officer.",
            authorizedAt: dateFromToday(-75),
            authorizedBy: "Katrina Buenaventura",
        },
        {
            id: "auth-admin-safety",
            assessorId: "user-1",
            scope: "Specific Person",
            scopeValue: "user-8",
            active: true,
            reason: "Explicit temporary assessor authorization for the Safety Officer assessment; Admin role alone grants no authority.",
            authorizedAt: dateFromToday(-30),
            authorizedBy: "Celso Ramirez",
        },
        {
            id: "auth-cross-crane",
            assessorId: "user-gen-13",
            scope: "Specific Person",
            scopeValue: "user-gen-8",
            active: true,
            reason: "Explicit cross-functional validation assignment for the Crane Operations Supervisor.",
            authorizedAt: dateFromToday(-30),
            authorizedBy: "Celso Ramirez",
        },
        {
            id: "auth-cross-operations",
            assessorId: "user-gen-13",
            scope: "Specific Person",
            scopeValue: "user-gen-10",
            active: true,
            reason: "Explicit cross-functional validation assignment for the Operations Supervisor.",
            authorizedAt: dateFromToday(-30),
            authorizedBy: "Celso Ramirez",
        },
    ];

    const byId = (id: string) => profiles.find((item) => item.id === id)!;
    const assessments: CompetencyAssessment[] = [
        assessment(
            "assessment-active-1",
            "user-8",
            "Employee",
            byId("profile-safety-officer"),
            competencies,
            cycles.find((item) => item.id === "cycle-active-periodic")!,
            "user-1",
            "In Progress",
            5,
            {
                "comp-hazard-identification": 3,
                "comp-safety-compliance": 4,
                "comp-incident-reporting": null,
                "comp-communication": 3,
                "comp-data-interpretation": 3,
            },
        ),
        assessment(
            "assessment-active-2",
            "user-gen-8",
            "Employee",
            byId("profile-crane-supervisor"),
            competencies,
            cycles.find((item) => item.id === "cycle-active-periodic")!,
            "user-gen-13",
            "Pending Validation",
            -1,
            {
                "comp-crane-operation": 5,
                "comp-equipment-inspection": 4,
                "comp-hazard-identification": 4,
                "comp-team-leadership": 4,
                "comp-coaching": 3,
            },
        ),
        assessment(
            "assessment-active-3",
            "user-gen-10",
            "Employee",
            byId("profile-operations-supervisor"),
            competencies,
            cycles.find((item) => item.id === "cycle-active-periodic")!,
            "user-gen-13",
            "Finalized",
            -2,
            {
                "comp-site-coordination": 4,
                "comp-team-leadership": 3,
                "comp-problem-solving": 4,
                "comp-accountability": 4,
                "comp-hazard-identification": 3,
            },
        ),
        assessment(
            "assessment-active-4",
            "user-5",
            "Employee",
            byId("profile-finance-staff"),
            competencies,
            cycles.find((item) => item.id === "cycle-active-periodic")!,
            "user-gen-11",
            "Overdue",
            -4,
            {
                "comp-data-interpretation": 2,
                "comp-accountability": 3,
                "comp-problem-solving": null,
                "comp-communication": null,
            },
            false,
        ),
        assessment(
            "assessment-active-5",
            "user-10",
            "Employee",
            byId("profile-training-officer"),
            competencies,
            cycles.find((item) => item.id === "cycle-active-periodic")!,
            "user-4",
            "Submitted",
            3,
            {
                "comp-communication": 4,
                "comp-coaching": 3,
                "comp-teamwork": 4,
                "comp-data-interpretation": 3,
            },
        ),
        assessment(
            "assessment-active-6",
            "user-6",
            "Trainee",
            byId("profile-graduate-trainee"),
            competencies,
            cycles.find((item) => item.id === "cycle-active-periodic")!,
            "user-gen-10",
            "Finalized",
            4,
            {
                "comp-safety-compliance": 2,
                "comp-hazard-identification": 1,
                "comp-teamwork": 2,
                "comp-communication": 2,
                "comp-accountability": 2,
            },
        ),
        assessment(
            "assessment-prior-1",
            "user-8",
            "Employee",
            byId("profile-safety-officer"),
            competencies,
            cycles.find((item) => item.id === "cycle-prior-periodic")!,
            "user-gen-13",
            "Finalized",
            -360,
            {
                "comp-hazard-identification": 3,
                "comp-safety-compliance": 3,
                "comp-incident-reporting": 3,
                "comp-communication": 3,
                "comp-data-interpretation": 2,
            },
            true,
            380,
        ),
        assessment(
            "assessment-prior-2",
            "user-gen-10",
            "Employee",
            byId("profile-operations-supervisor"),
            competencies,
            cycles.find((item) => item.id === "cycle-prior-periodic")!,
            "user-gen-13",
            "Finalized",
            -360,
            {
                "comp-site-coordination": 3,
                "comp-team-leadership": 3,
                "comp-problem-solving": 3,
                "comp-accountability": 4,
                "comp-hazard-identification": 3,
            },
            true,
            380,
        ),
    ];

    const acknowledgmentEvents: AssessmentAcknowledgmentEvent[] = assessments.flatMap((item) => {
        const snapshot = item.finalizedSnapshots.at(-1);
        if (
            item.id !== "assessment-prior-1" ||
            item.status !== "Finalized" ||
            !item.cycleSnapshot.requireAcknowledgment ||
            !snapshot
        ) {
            return [];
        }
        const actor = SHARED_PERSONNEL.find((person) => person.id === item.personId);
        return [
            {
                id: `ack-${item.id}-v${snapshot.version}`,
                assessmentId: item.id,
                finalizedVersion: snapshot.version,
                personId: item.personId,
                acknowledgedAt: dateFromToday(-3),
                actorId: item.personId,
                actorName: actor?.fullName ?? "Assessment subject",
                sourceContext: "Seeded finalized assessment history",
                eventType: "Assessment Receipt Acknowledged" as const,
            },
        ];
    });

    const recommendations: DevelopmentRecommendation[] = [
        {
            id: "recommendation-1",
            personId: "user-gen-10",
            competencyId: "comp-team-leadership",
            sourceAssessmentId: "assessment-active-3",
            type: "Learning",
            title: "Supervisory Communication Learning Path",
            note: "Recommended for consideration by Learning Management; this does not create enrollment.",
            status: "Reviewed",
            createdAt: dateFromToday(-4),
            createdBy: "Celso Ramirez",
            reviewedAt: dateFromToday(-2),
            reassessmentDue: dateFromToday(60),
            reassessedAt: null,
            reassessmentAssessmentId: null,
        },
        {
            id: "recommendation-2",
            personId: "user-6",
            competencyId: "comp-hazard-identification",
            sourceAssessmentId: "assessment-active-6",
            type: "Training",
            title: "Site Hazard Identification Practical Session",
            note: "Recommendation only; Training Management owns scheduling and completion.",
            status: "Recommended",
            createdAt: dateFromToday(-3),
            createdBy: "Grace Fernandez",
            reviewedAt: null,
            reassessmentDue: dateFromToday(45),
            reassessedAt: null,
            reassessmentAssessmentId: null,
        },
    ];

    return {
        schemaVersion: 4,
        competencies,
        roleProfiles: profiles,
        cycles,
        assessorAuthorizations: authorizations,
        assessments,
        acknowledgmentEvents,
        recommendations,
        activities: [
            {
                id: "activity-1",
                type: "Assessment",
                title: "Assessment finalized",
                detail: "Operations Supervisor competency assessment was validated.",
                personId: "user-gen-10",
                createdAt: dateFromToday(-2),
            },
            {
                id: "activity-2",
                type: "Development",
                title: "Development recommendation reviewed",
                detail: "A Learning recommendation was marked reviewed without creating enrollment.",
                personId: "user-gen-10",
                createdAt: dateFromToday(-2),
            },
            {
                id: "activity-3",
                type: "Assessment",
                title: "Assessment submitted",
                detail: "Training Officer assessment is ready for HR validation.",
                personId: "user-10",
                createdAt: dateFromToday(-1),
            },
            {
                id: "activity-4",
                type: "Profile",
                title: "Role profile published",
                detail: "Graduate Trainee profile became active.",
                personId: null,
                createdAt: dateFromToday(-6),
            },
            {
                id: "activity-5",
                type: "Library",
                title: "Competency definition updated",
                detail: "Hazard Identification indicators were reviewed.",
                personId: null,
                createdAt: dateFromToday(-9),
            },
        ],
        auditLog: [
            {
                id: "audit-initial-cycle-active",
                action: "Assessment cycle activated",
                detail: "2026 Q3 Competency Validation entered the active assessment window.",
                actorId: "user-4",
                actorName: "Celso Ramirez",
                createdAt: dateFromToday(-25),
                entityType: "Cycle",
                entityId: "cycle-active-periodic",
                metadata: {
                    status: "Active",
                    source: "Initial configurable records",
                },
            },
            {
                id: "audit-initial-authorization",
                action: "Assessor authorization created",
                detail: "Safety Supervisor received an explicit department assessment scope.",
                actorId: "user-4",
                actorName: "Celso Ramirez",
                createdAt: dateFromToday(-90),
                entityType: "Assessor Authorization",
                entityId: "auth-safety",
                metadata: {
                    scope: "Department",
                    scopeValue: "Safety & Compliance",
                    active: true,
                },
            },
        ],
    };
}
