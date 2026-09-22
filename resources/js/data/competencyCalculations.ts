import {
    COMPETENCY_CATEGORIES,
    snapshotCompetencyDefinition,
    type AssessmentCycle,
    type AssessmentCycleSnapshot,
    type AssessmentStatus,
    type AssessorAuthorization,
    type CompetencyAssessment,
    type CompetencyCategory,
    type CompetencyDefinition,
    type CompetencyState,
    type DevelopmentRecommendation,
    type FinalizedAssessmentSnapshot,
    type ProficiencyLevel,
    type RoleProfile,
    type RoleRequirement,
    localDateValue,
} from "@/data/competency";
import {
    calculateCycleCompletion,
    effectiveAssessmentStatus,
    findAssessmentAcknowledgmentEvent,
} from "@/data/competencyLifecycle";
import { REPORTING_RELATIONSHIPS } from "@/data/evaluatorAssignments";
import {
    SHARED_PERSONNEL,
    type PersonType,
    type PersonnelIdentity,
} from "@/data/personnel";

export type RequirementResult =
    | "Exceeds Requirement"
    | "Meets Requirement"
    | "Below Requirement"
    | "Not Assessed";

export type RequirementDetail = {
    requirement: RoleRequirement;
    competency: CompetencyDefinition | null;
    currentLevel: ProficiencyLevel | null;
    result: RequirementResult;
    gap: number | null;
    sourceAssessment: CompetencyAssessment | null;
    sourceFinalizedSnapshot: FinalizedAssessmentSnapshot | null;
    evidenceCount: number;
    lastAssessed: string | null;
    validUntil: string | null;
    nextReassessment?: string | null;
    reassessmentDue: boolean;
    recommendations: DevelopmentRecommendation[];
};

export type CompetencyProfileStatus =
    | "Requirements Met"
    | "Has Competency Gaps"
    | "Assessment Incomplete"
    | "Profile Not Assigned"
    | "Reassessment Due";

export type CompetencyProfileRow = {
    resolutionReason?: string;
    person: PersonnelIdentity;
    profile: RoleProfile | null;
    requirements: RequirementDetail[];
    coverage: number;
    meetsOrExceeds: number;
    openGaps: number;
    notAssessed: number;
    lastAssessed: string | null;
    nextReassessment: string | null;
    status: CompetencyProfileStatus;
};

export type CompetencyGapRow = RequirementDetail & {
    id: string;
    person: PersonnelIdentity;
    profile: RoleProfile;
    recommendationStatus: string;
};

export type AssessmentTableRow = {
    assessment: CompetencyAssessment;
    person: PersonnelIdentity;
    profile: RoleProfile | null;
    cycle: AssessmentCycle | null;
    assessor: PersonnelIdentity | null;
    progress: number;
    displayStatus: AssessmentStatus;
    contextChanged: boolean;
};

export type CompetencyAnalyticsFilters = {
    cycleId: string;
    department: string;
    position: string;
    personType: "All" | PersonType;
    roleProfileVersion: string;
    competencyId: string;
    category: "All" | CompetencyCategory;
    status: "All" | AssessmentStatus;
};

export const EMPTY_ANALYTICS_FILTERS: CompetencyAnalyticsFilters = {
    cycleId: "All",
    department: "All",
    position: "All",
    personType: "All",
    roleProfileVersion: "All",
    competencyId: "All",
    category: "All",
    status: "All",
};

function parseDate(value: string | null): number {
    if (!value) return 0;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00`)
        : new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeIdentifier(value: string): string {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return ["all", "global", "unassigned", "not-assigned", ""].includes(
        normalized,
    )
        ? "*"
        : normalized;
}

export function todayIso(): string {
    return localDateValue();
}

export function effectiveCycleStatus(
    cycle: AssessmentCycle,
    referenceManilaDate: string = todayIso(),
): AssessmentCycle["status"] | "Expired" {
    if (["Draft", "Closed", "Cancelled"].includes(cycle.status))
        return cycle.status;
    if (referenceManilaDate < cycle.startDate) return "Scheduled";
    if (referenceManilaDate > cycle.endDate) return "Expired";
    return "Active";
}

export function assignmentDueDate(
    cycle: AssessmentCycle,
    assignedDate: string = todayIso(),
): string {
    const base = new Date(`${assignedDate.slice(0, 10)}T12:00:00`);
    base.setDate(base.getDate() + cycle.dueDaysAfterAssignment);
    const calculated = localDateValue(base);
    const earliest = assignedDate < cycle.startDate ? cycle.startDate : assignedDate;
    const bounded = calculated > cycle.endDate ? cycle.endDate : calculated;
    return bounded < earliest ? earliest : bounded;
}

export function assessmentRequiresGovernanceValidation(
    assessment: CompetencyAssessment,
    cycle: AssessmentCycle | null = null,
): boolean {
    const rules = assessment.cycleSnapshot ?? cycle;
    return Boolean(
        rules?.requireHrValidation ||
            assessment.roleProfileSnapshot.requirements.some(
                (requirement) => requirement.critical,
            ),
    );
}

export function assessmentContextChanged(
    state: CompetencyState,
    assessment: CompetencyAssessment,
): boolean {
    if (["Finalized", "Cancelled"].includes(assessment.status)) return false;
    const person = SHARED_PERSONNEL.find(
        (item) => item.id === assessment.personId,
    );
    if (!person) return true;
    const current = findActiveProfileForPerson(state, person);
    return (
        !current ||
        current.id !== assessment.roleProfileId ||
        normalizeIdentifier(person.position) !==
            normalizeIdentifier(assessment.roleProfileSnapshot.position) ||
        normalizeIdentifier(person.department) !==
            normalizeIdentifier(assessment.roleProfileSnapshot.department)
    );
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function addMonths(value: string, months: number): string {
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    date.setMonth(date.getMonth() + months);
    return localDateValue(date);
}

export function roleProfileVersionKey(
    assessment: CompetencyAssessment,
): string {
    return `${assessment.roleProfileSnapshot.profileId}::${assessment.roleProfileSnapshot.version}`;
}

export function roleProfileIdentityKey(
    profile: Pick<RoleProfile, "department" | "position" | "appliesTo">,
): string {
    return [
        normalizeIdentifier(profile.department),
        normalizeIdentifier(profile.position),
        normalizeIdentifier(profile.appliesTo),
    ].join("::");
}

export function cycleConfigurationMatches(
    previous: AssessmentCycle,
    next: AssessmentCycle,
): boolean {
    const normalized = (values: string[]) =>
        [...values].map(normalizeIdentifier).sort().join("|");
    return (
        previous.appliesTo === next.appliesTo &&
        normalized(previous.departments) === normalized(next.departments) &&
        normalized(previous.positions) === normalized(next.positions) &&
        [...previous.roleProfileIds].sort().join("|") ===
            [...next.roleProfileIds].sort().join("|") &&
        previous.assignmentMethod === next.assignmentMethod &&
        previous.roleBasedAssessorScope === next.roleBasedAssessorScope &&
        normalized(previous.roleBasedAssessorPositions) ===
            normalized(next.roleBasedAssessorPositions) &&
        previous.requireSelfAssessment === next.requireSelfAssessment &&
        previous.requireSupportingEvidence === next.requireSupportingEvidence &&
        previous.requireHrValidation === next.requireHrValidation &&
        previous.requireAcknowledgment === next.requireAcknowledgment &&
        previous.dueDaysAfterAssignment === next.dueDaysAfterAssignment &&
        previous.reassessmentRule.trim() === next.reassessmentRule.trim() &&
        (previous.autoAssign !== false) === (next.autoAssign !== false)
    );
}

export function cyclePopulationMatches(
    cycle: AssessmentCycle,
    person: PersonnelIdentity,
    profile: RoleProfile,
): boolean {
    return (
        person.employmentStatus !== "Inactive" &&
        profile.status === "Active" &&
        cycle.roleProfileIds.includes(profile.id) &&
        profile.position === person.position &&
        profile.department === person.department &&
        (profile.appliesTo === "Both" ||
            profile.appliesTo === person.personType) &&
        (cycle.appliesTo === "Both" || cycle.appliesTo === person.personType) &&
        (!cycle.departments.length ||
            cycle.departments.includes(person.department)) &&
        (!cycle.positions.length || cycle.positions.includes(person.position))
    );
}

export function getRequirementResult(
    currentLevel: ProficiencyLevel | null,
    requiredLevel: ProficiencyLevel,
): RequirementResult {
    if (currentLevel === null) return "Not Assessed";
    if (currentLevel > requiredLevel) return "Exceeds Requirement";
    if (currentLevel === requiredLevel) return "Meets Requirement";
    return "Below Requirement";
}

export function calculateGap(
    currentLevel: ProficiencyLevel | null,
    requiredLevel: ProficiencyLevel,
): number | null {
    if (currentLevel === null) return null;
    return Math.max(requiredLevel - currentLevel, 0);
}

export function getDisplayAssessmentStatus(
    assessment: CompetencyAssessment,
    referenceManilaDate: string = todayIso(),
): AssessmentStatus {
    return effectiveAssessmentStatus(assessment, referenceManilaDate);
}

export function assessmentProgress(assessment: CompetencyAssessment): number {
    const total = assessment.roleProfileSnapshot.requirements.length;
    if (!total) return 0;
    const rated = assessment.ratings.filter(
        (rating) => rating.selectedLevel !== null,
    ).length;
    return Math.round((rated / total) * 100);
}

export function findActiveProfileForPerson(
    state: CompetencyState,
    person: PersonnelIdentity,
): RoleProfile | null {
    if (state.profileRows) return state.profileRows.find((row) => row.person.id === person.id)?.profile ?? null;
    const matches = state.roleProfiles.filter(
        (profile) =>
            profile.status === "Active" &&
            profile.effectiveDate <= todayIso() &&
            normalizeIdentifier(profile.position) === normalizeIdentifier(person.position) &&
            normalizeIdentifier(profile.department) === normalizeIdentifier(person.department) &&
            (profile.appliesTo === "Both" ||
                profile.appliesTo === person.personType),
    );
    return matches.sort((a, b) => b.version - a.version)[0] ?? null;
}

export function authorizationMatches(
    authorization: AssessorAuthorization,
    person: PersonnelIdentity,
    profile: RoleProfile,
): boolean {
    if (!authorization.active || authorization.assessorId === person.id)
        return false;
    switch (authorization.scope) {
        case "Department":
            return authorization.scopeValue === person.department;
        case "Position":
            return authorization.scopeValue === person.position;
        case "Role Profile":
            return authorization.scopeValue === profile.id;
        case "Specific Person":
            return authorization.scopeValue === person.id;
    }
}

export function getAuthorizedAssessors(
    state: CompetencyState,
    person: PersonnelIdentity,
    profile: RoleProfile,
): PersonnelIdentity[] {
    const ids = new Set(
        state.assessorAuthorizations
            .filter((authorization) =>
                authorizationMatches(authorization, person, profile),
            )
            .map((authorization) => authorization.assessorId),
    );
    const manager = SHARED_PERSONNEL.find((candidate) => candidate.id === person.managerPersonnelKey && candidate.evaluatorCapable);
    if (manager) ids.add(manager.id);
    return SHARED_PERSONNEL.filter(
        (candidate) => ids.has(candidate.id) && candidate.id !== person.id,
    );
}

export type AssessorResolution = {
    assessor: PersonnelIdentity | null;
    error: string | null;
};

export function resolveAssessmentAssessor(
    state: CompetencyState,
    cycle: AssessmentCycle,
    person: PersonnelIdentity,
    profile: RoleProfile,
    manualAssessorId = "",
): AssessorResolution {
    const authorized = getAuthorizedAssessors(state, person, profile);
    if (cycle.assignmentMethod === "Manual Authorized Assignment") {
        if (!manualAssessorId)
            return {
                assessor: null,
                error: "Select an authorized assessor for this manual assignment.",
            };
        const assessor =
            authorized.find((item) => item.id === manualAssessorId) ?? null;
        return assessor
            ? { assessor, error: null }
            : {
                  assessor: null,
                  error: "The selected assessor does not have active authority for this person and role profile.",
              };
    }

    if (cycle.assignmentMethod === "Reporting Relationship") {
        const today = parseDate(todayIso());
        const relationship = person.managerPersonnelKey !== undefined
            ? (person.managerPersonnelKey ? { supervisorId: person.managerPersonnelKey } : undefined)
            : REPORTING_RELATIONSHIPS.find(
            (item) =>
                item.active &&
                item.directReportId === person.id &&
                parseDate(item.effectiveFrom) <= today &&
                (!item.effectiveTo || parseDate(item.effectiveTo) >= today),
        );
        if (!relationship)
            return {
                assessor: null,
                error: `No active reporting relationship is recorded for ${person.fullName}.`,
            };
        const assessor =
            authorized.find((item) => item.id === relationship.supervisorId) ??
            null;
        return assessor
            ? { assessor, error: null }
            : {
                  assessor: null,
                  error: `${getPersonName(relationship.supervisorId)} is the recorded supervisor but lacks active Competency assessor authority for this scope.`,
              };
    }

    if (
        !cycle.roleBasedAssessorScope ||
        !cycle.roleBasedAssessorPositions.length
    ) {
        return {
            assessor: null,
            error: "Configure both the authorization scope and allowed assessor positions for this role-based cycle.",
        };
    }
    const candidates = authorized.filter(
        (candidate) =>
            cycle.roleBasedAssessorPositions.includes(candidate.position) &&
            state.assessorAuthorizations.some(
                (authorization) =>
                    authorization.assessorId === candidate.id &&
                    authorization.scope === cycle.roleBasedAssessorScope &&
                    authorizationMatches(authorization, person, profile),
            ),
    );
    if (!candidates.length) {
        return {
            assessor: null,
            error: `No ${cycle.roleBasedAssessorPositions.join(" / ")} has an active ${cycle.roleBasedAssessorScope} authorization for ${person.fullName}.`,
        };
    }
    const workload = new Map<string, number>();
    state.assessments
        .filter((item) => !["Finalized", "Cancelled"].includes(item.status))
        .forEach((item) =>
            workload.set(
                item.assessorId,
                (workload.get(item.assessorId) ?? 0) + 1,
            ),
        );
    const assessor =
        candidates.sort(
            (a, b) =>
                (workload.get(a.id) ?? 0) - (workload.get(b.id) ?? 0) ||
                a.fullName.localeCompare(b.fullName),
        )[0] ?? null;
    return assessor
        ? { assessor, error: null }
        : {
              assessor: null,
              error: "No matching authorized assessor could be resolved.",
          };
}

export type AssessmentAutomationException = {
    id: string;
    kind: "Initial Assignment" | "Reassessment";
    person: PersonnelIdentity;
    profile: RoleProfile | null;
    cycle: AssessmentCycle | null;
    competencyIds: string[];
    reason: string;
};

export function buildAssessmentAutomationExceptions(
    state: CompetencyState,
    referenceManilaDate: string = todayIso(),
): AssessmentAutomationException[] {
    const exceptions: AssessmentAutomationException[] = [];
    const existingKeys = new Set(
        state.assessments
            .filter((assessment) => assessment.status !== "Cancelled")
            .map((assessment) => `${assessment.personId}::${assessment.cycleId}`),
    );

    for (const cycle of state.cycles) {
        if (
            effectiveCycleStatus(cycle, referenceManilaDate) !== "Active" ||
            cycle.autoAssign === false ||
            cycle.assignmentMethod === "Manual Authorized Assignment" ||
            cycle.type === "Post-Training Reassessment"
        )
            continue;
        for (const profileId of cycle.roleProfileIds) {
            const profile = state.roleProfiles.find(
                (item) => item.id === profileId && item.status === "Active",
            );
            if (!profile) continue;
            for (const person of SHARED_PERSONNEL) {
                if (!cyclePopulationMatches(cycle, person, profile)) continue;
                if (existingKeys.has(`${person.id}::${cycle.id}`)) continue;
                const resolution = resolveAssessmentAssessor(
                    state,
                    cycle,
                    person,
                    profile,
                );
                if (resolution.assessor) continue;
                exceptions.push({
                    id: `assignment-${cycle.id}-${person.id}`,
                    kind: "Initial Assignment",
                    person,
                    profile,
                    cycle,
                    competencyIds: profile.requirements.map(
                        (requirement) => requirement.competencyId,
                    ),
                    reason:
                        resolution.error ??
                        "No authorized assessor could be resolved automatically.",
                });
            }
        }
    }

    for (const recommendation of state.recommendations) {
        if (
            recommendation.status === "Reassessed" ||
            !recommendation.integration?.completedAt ||
            !recommendation.reassessmentDue ||
            recommendation.reassessmentDue > referenceManilaDate ||
            recommendation.reassessmentAssessmentId
        )
            continue;
        const person = SHARED_PERSONNEL.find(
            (item) => item.id === recommendation.personId,
        );
        if (!person) continue;
        const profile = findActiveProfileForPerson(state, person);
        if (!profile) {
            exceptions.push({
                id: `reassessment-${recommendation.id}`,
                kind: "Reassessment",
                person,
                profile: null,
                cycle: null,
                competencyIds: [recommendation.competencyId],
                reason:
                    "No active Role Profile matches the employee’s current organizational context.",
            });
            continue;
        }
        const existingTarget = state.assessments.find(
            (assessment) =>
                assessment.status !== "Cancelled" &&
                assessment.personId === person.id &&
                (assessment.targetCompetencyIds ??
                    assessment.roleProfileSnapshot.requirements.map(
                        (requirement) => requirement.competencyId,
                    )
                ).includes(recommendation.competencyId) &&
                state.cycles.find((cycle) => cycle.id === assessment.cycleId)
                    ?.type === "Post-Training Reassessment",
        );
        if (existingTarget) continue;
        const cycles = state.cycles.filter(
            (cycle) =>
                cycle.type === "Post-Training Reassessment" &&
                effectiveCycleStatus(cycle, referenceManilaDate) === "Active" &&
                cyclePopulationMatches(cycle, person, profile),
        );
        if (!cycles.length) {
            exceptions.push({
                id: `reassessment-${recommendation.id}`,
                kind: "Reassessment",
                person,
                profile,
                cycle: null,
                competencyIds: [recommendation.competencyId],
                reason:
                    "No active Post-Training Reassessment cycle covers the employee’s current Role Profile.",
            });
            continue;
        }
        const available = cycles.find(
            (cycle) => !existingKeys.has(`${person.id}::${cycle.id}`),
        );
        if (!available) {
            exceptions.push({
                id: `reassessment-${recommendation.id}`,
                kind: "Reassessment",
                person,
                profile,
                cycle: cycles[0] ?? null,
                competencyIds: [recommendation.competencyId],
                reason:
                    "The matching reassessment cycle already has another official assignment for this person; use another governed reassessment cycle.",
            });
            continue;
        }
        const resolution = resolveAssessmentAssessor(
            state,
            available,
            person,
            profile,
        );
        if (!resolution.assessor) {
            exceptions.push({
                id: `reassessment-${recommendation.id}`,
                kind: "Reassessment",
                person,
                profile,
                cycle: available,
                competencyIds: [recommendation.competencyId],
                reason:
                    resolution.error ??
                    "No authorized assessor could be resolved for the targeted reassessment.",
            });
        }
    }

    return exceptions;
}

function getPersonName(personId: string): string {
    return (
        SHARED_PERSONNEL.find((item) => item.id === personId)?.fullName ??
        personId
    );
}

function cycleRulesForAssessment(
    assessment: CompetencyAssessment,
    cycle: AssessmentCycle | null,
): AssessmentCycleSnapshot | AssessmentCycle | null {
    return assessment.cycleSnapshot ?? cycle;
}

export function canAssess(
    state: CompetencyState,
    assessment: CompetencyAssessment,
    actorId: string,
): boolean {
    if (
        !actorId ||
        assessment.assessorId !== actorId ||
        assessment.personId === actorId
    )
        return false;
    const person = SHARED_PERSONNEL.find(
        (item) => item.id === assessment.personId,
    );
    const profile = state.roleProfiles.find(
        (item) => item.id === assessment.roleProfileId,
    );
    if (!person || !profile || assessmentContextChanged(state, assessment)) return false;
    return state.assessorAuthorizations.some(
        (authorization) =>
            authorization.assessorId === actorId &&
            authorizationMatches(authorization, person, profile),
    );
}

export function validateAssessmentForSubmit(
    assessment: CompetencyAssessment,
    cycle: AssessmentCycle | null,
): string[] {
    const errors: string[] = [];
    const rules = cycleRulesForAssessment(assessment, cycle);
    for (const requirement of assessment.roleProfileSnapshot.requirements) {
        const rating = assessment.ratings.find(
            (item) => item.competencyId === requirement.competencyId,
        );
        if (!rating || rating.selectedLevel === null) {
            errors.push(
                `${requirement.competency.name}: an official proficiency level is required.`,
            );
            continue;
        }
        const evidenceRequired =
            requirement.critical ||
            requirement.evidenceRequirement === "Required" ||
            Boolean(rules?.requireSupportingEvidence);
        if (evidenceRequired && rating.evidence.length === 0) {
            errors.push(
                `${requirement.competency.name}: supporting evidence is required.`,
            );
        }
        if (
            requirement.critical &&
            rating.evidence.some((item) => item.verificationState !== "Verified")
        ) {
            errors.push(
                `${requirement.competency.name}: critical competency evidence must be Verified before submission.`,
            );
        }
        if (
            rating.evidence.some(
                (item) =>
                    !requirement.competency.requiredEvidenceTypes.includes(
                        item.type,
                    ),
            )
        ) {
            errors.push(
                `${requirement.competency.name}: every evidence item must use an accepted snapshot evidence type.`,
            );
        }
        if (
            evidenceRequired &&
            requirement.competency.requiredEvidenceTypes.length === 0
        ) {
            errors.push(
                `${requirement.competency.name}: the snapshot has no accepted evidence type configured.`,
            );
        }
        if (rules?.requireSelfAssessment && rating.selfLevel === null) {
            errors.push(
                `${requirement.competency.name}: the required self-assessment is missing.`,
            );
        }
    }
    return errors;
}

export function buildAssessmentRows(
    state: CompetencyState,
    referenceManilaDate: string = todayIso(),
): AssessmentTableRow[] {
    return state.assessments.flatMap((assessment) => {
        const person = SHARED_PERSONNEL.find(
            (item) => item.id === assessment.personId,
        );
        if (!person) return [];
        return [
            {
                assessment,
                person,
                profile:
                    state.roleProfiles.find(
                        (item) => item.id === assessment.roleProfileId,
                    ) ?? null,
                cycle:
                    state.cycles.find(
                        (item) => item.id === assessment.cycleId,
                    ) ?? null,
                assessor:
                    SHARED_PERSONNEL.find(
                        (item) => item.id === assessment.assessorId,
                    ) ?? null,
                progress: assessmentProgress(assessment),
                displayStatus: getDisplayAssessmentStatus(assessment, referenceManilaDate),
                contextChanged: assessmentContextChanged(state, assessment),
            },
        ];
    });
}

export function latestFinalizedSnapshot(
    assessment: CompetencyAssessment,
): FinalizedAssessmentSnapshot | null {
    return (
        assessment.finalizedSnapshots
            .slice()
            .sort((a, b) => b.version - a.version)[0] ??
        assessment.finalizedSnapshot ??
        null
    );
}

function latestFinalizedResultForRequirement(
    state: CompetencyState,
    personId: string,
    competencyId: string,
): {
    assessment: CompetencyAssessment;
    snapshot: FinalizedAssessmentSnapshot;
} | null {
    return (
        state.assessments
            .flatMap((assessment) => {
                if (
                    assessment.personId !== personId ||
                    assessment.status === "Cancelled"
                )
                    return [];
                return assessment.finalizedSnapshots
                    .filter((snapshot) =>
                        snapshot.ratings.some(
                            (rating) =>
                                rating.competencyId === competencyId &&
                                rating.selectedLevel !== null,
                        ),
                    )
                    .map((snapshot) => ({ assessment, snapshot }));
            })
            .sort(
                (a, b) =>
                    parseDate(b.snapshot.finalizedAt) -
                    parseDate(a.snapshot.finalizedAt),
            )[0] ?? null
    );
}

export function buildCompetencyProfiles(
    state: CompetencyState,
): CompetencyProfileRow[] {
    if (state.profileRows) return state.profileRows;
    return SHARED_PERSONNEL.filter(
        (person) => person.employmentStatus !== "Inactive",
    ).map((person) => {
        const roleProfile = findActiveProfileForPerson(state, person);
        if (!roleProfile) {
            return {
                person,
                profile: null,
                requirements: [],
                coverage: 0,
                meetsOrExceeds: 0,
                openGaps: 0,
                notAssessed: 0,
                lastAssessed: null,
                nextReassessment: null,
                status: "Profile Not Assigned" as const,
            };
        }

        const requirementDetails: RequirementDetail[] =
            roleProfile.requirements.map((requirement) => {
                const sourceResult = latestFinalizedResultForRequirement(
                    state,
                    person.id,
                    requirement.competencyId,
                );
                const source = sourceResult?.assessment ?? null;
                const sourceSnapshot = sourceResult?.snapshot ?? null;
                const rating = sourceSnapshot?.ratings.find(
                    (item) => item.competencyId === requirement.competencyId,
                );
                const currentLevel = rating?.selectedLevel ?? null;
                const competency =
                    state.competencies.find(
                        (item) => item.id === requirement.competencyId,
                    ) ?? null;
                const lastAssessed =
                    sourceSnapshot?.finalizedAt ?? null;
                const interval =
                    requirement.reassessmentIntervalMonths ??
                    competency?.reassessmentIntervalMonths ??
                    null;
                const validUntil =
                    lastAssessed && interval
                        ? addMonths(lastAssessed, interval)
                        : null;
                return {
                    requirement,
                    competency,
                    currentLevel,
                    result: getRequirementResult(
                        currentLevel,
                        requirement.requiredLevel,
                    ),
                    gap: calculateGap(currentLevel, requirement.requiredLevel),
                    sourceAssessment: source,
                    sourceFinalizedSnapshot: sourceSnapshot,
                    evidenceCount: rating?.evidence.length ?? 0,
                    lastAssessed,
                    validUntil,
                    reassessmentDue: Boolean(
                        validUntil &&
                            parseDate(validUntil) <= parseDate(todayIso()),
                    ),
                    recommendations: state.recommendations.filter(
                        (recommendation) =>
                            recommendation.personId === person.id &&
                            recommendation.competencyId ===
                                requirement.competencyId,
                    ),
                };
            });

        const assessed = requirementDetails.filter(
            (detail) => detail.currentLevel !== null,
        ).length;
        const meets = requirementDetails.filter(
            (detail) =>
                detail.result === "Meets Requirement" ||
                detail.result === "Exceeds Requirement",
        ).length;
        const gaps = requirementDetails.filter(
            (detail) => detail.result === "Below Requirement",
        ).length;
        const notAssessed = requirementDetails.length - assessed;
        const lastDates = requirementDetails
            .map((detail) => detail.lastAssessed)
            .filter((value): value is string => Boolean(value));
        const nextDates = requirementDetails
            .map((detail) => detail.validUntil)
            .filter((value): value is string => Boolean(value));
        const reassessmentDue = requirementDetails.some(
            (detail) => detail.reassessmentDue,
        );

        let status: CompetencyProfileStatus = "Requirements Met";
        if (reassessmentDue) status = "Reassessment Due";
        else if (notAssessed > 0) status = "Assessment Incomplete";
        else if (gaps > 0) status = "Has Competency Gaps";

        return {
            person,
            profile: roleProfile,
            requirements: requirementDetails,
            coverage: requirementDetails.length
                ? Math.round((assessed / requirementDetails.length) * 100)
                : 0,
            meetsOrExceeds: meets,
            openGaps: gaps,
            notAssessed,
            lastAssessed:
                lastDates.sort((a, b) => parseDate(b) - parseDate(a))[0] ??
                null,
            nextReassessment:
                nextDates.sort((a, b) => parseDate(a) - parseDate(b))[0] ??
                null,
            status,
        };
    });
}

export function buildGapRows(state: CompetencyState): CompetencyGapRow[] {
    return buildCompetencyProfiles(state).flatMap((profileRow) => {
        if (!profileRow.profile) return [];
        return profileRow.requirements
            .filter((detail) => detail.result === "Below Requirement")
            .map((detail) => ({
                ...detail,
                id: `${profileRow.person.id}-${detail.requirement.competencyId}`,
                person: profileRow.person,
                profile: profileRow.profile!,
                recommendationStatus:
                    detail.recommendations[0]?.status ?? "No Recommendation",
            }));
    });
}

export function buildDevelopmentRows(state: CompetencyState): CompetencyGapRow[] {
    return buildCompetencyProfiles(state).flatMap(row => row.profile ? row.requirements
        .filter(detail => (detail.gap !== null && detail.gap > 0) || detail.recommendations.length > 0)
        .map(detail => ({ ...detail, id: `${row.person.id}-${detail.requirement.competencyId}`, person: row.person, profile: row.profile!, recommendationStatus: detail.recommendations[0]?.outcome ?? detail.recommendations[0]?.status ?? "No Recommendation" })) : []);
}

export function filterAssessmentRows(
    rows: AssessmentTableRow[],
    filters: CompetencyAnalyticsFilters,
    _state: CompetencyState,
): AssessmentTableRow[] {
    return rows.filter((row) => {
        if (
            filters.cycleId !== "All" &&
            row.assessment.cycleId !== filters.cycleId
        )
            return false;
        if (
            filters.department !== "All" &&
            (filters.cycleId === "All" ? row.person.department : row.assessment.roleProfileSnapshot.department) !== filters.department
        )
            return false;
        if (
            filters.position !== "All" &&
            (filters.cycleId === "All" ? row.person.position : row.assessment.roleProfileSnapshot.position) !== filters.position
        )
            return false;
        if (
            filters.personType !== "All" &&
            row.assessment.personType !== filters.personType
        )
            return false;
        if (
            filters.roleProfileVersion !== "All" &&
            roleProfileVersionKey(row.assessment) !== filters.roleProfileVersion
        )
            return false;
        if (filters.status !== "All" && row.displayStatus !== filters.status)
            return false;
        if (
            filters.competencyId !== "All" &&
            !row.assessment.roleProfileSnapshot.requirements.some(
                (requirement) =>
                    requirement.competencyId === filters.competencyId,
            )
        )
            return false;
        if (filters.category !== "All") {
            if (
                !row.assessment.roleProfileSnapshot.requirements.some(
                    (requirement) =>
                        requirement.competency.category === filters.category,
                )
            )
                return false;
        }
        return true;
    });
}

export function buildAssessorWorkload(
    state: CompetencyState,
    cycleIds?: string | string[],
) {
    const scopedIds = cycleIds
        ? new Set(Array.isArray(cycleIds) ? cycleIds : [cycleIds])
        : null;
    const rows = buildAssessmentRows(state).filter(
        (row) =>
            row.displayStatus !== "Cancelled" &&
            (!scopedIds || scopedIds.has(row.assessment.cycleId)),
    );
    const groups = new Map<string, AssessmentTableRow[]>();
    rows.forEach((row) =>
        groups.set(row.assessment.assessorId, [
            ...(groups.get(row.assessment.assessorId) ?? []),
            row,
        ]),
    );
    return [...groups.entries()]
        .map(([assessorId, items]) => ({
            assessor:
                SHARED_PERSONNEL.find((person) => person.id === assessorId) ??
                null,
            assigned: items.length,
            finalized: items.filter(
                (item) => item.displayStatus === "Finalized",
            ).length,
            inProgress: items.filter(
                (item) => item.displayStatus === "In Progress",
            ).length,
            pending: items.filter((item) =>
                ["Pending", "Submitted", "Pending Validation"].includes(
                    item.displayStatus,
                ),
            ).length,
            overdue: items.filter((item) => item.displayStatus === "Overdue")
                .length,
            progress: items.length
                ? Math.round(
                      (items.filter(
                          (item) => item.displayStatus === "Finalized",
                      ).length /
                          items.length) *
                          100,
                  )
                : 0,
        }))
        .sort((a, b) => b.assigned - a.assigned);
}

export function buildOverviewMetrics(state: CompetencyState) {
    const activeCycles = state.cycles.filter(
        (cycle) => cycle.status === "Active",
    );
    const activeCycleIds = new Set(activeCycles.map((cycle) => cycle.id));
    const activeRows = buildAssessmentRows(state).filter(
        (row) =>
            activeCycleIds.has(row.assessment.cycleId) &&
            row.displayStatus !== "Cancelled",
    );
    const profiles = buildCompetencyProfiles(state).filter(
        (row) => row.profile,
    );
    const gaps = buildGapRows(state);
    const reassessments = profiles
        .flatMap((row) => row.requirements.map((detail) => ({ row, detail })))
        .filter(({ detail }) => detail.reassessmentDue);
    const today = parseDate(todayIso());
    const upcomingLimit = new Date(`${todayIso()}T12:00:00`);
    upcomingLimit.setDate(upcomingLimit.getDate() + 30);
    const upcomingReassessments = profiles
        .flatMap((row) => row.requirements.map((detail) => ({ row, detail })))
        .filter(({ detail }) => {
            const due = parseDate(detail.nextReassessment ?? detail.validUntil);
            return due > today && due <= upcomingLimit.getTime();
        });
    const completion = calculateCycleCompletion(
        state.assessments.filter((item) => activeCycleIds.has(item.cycleId)),
    );
    const finalized = completion.finalized;
    const completionRate = completion.rate;
    return {
        activeCycles,
        activeCycleIds: [...activeCycleIds],
        activeRows,
        completionRate,
        finalized,
        assigned: completion.eligible,
        cancelled: completion.cancelled,
        gaps,
        criticalGaps: gaps.filter((gap) => gap.requirement.critical),
        reassessments,
        upcomingReassessments,
        pendingValidation: activeRows.filter((row) =>
            ["Submitted", "Pending Validation"].includes(row.displayStatus),
        ),
        overdue: activeRows.filter((row) => row.displayStatus === "Overdue"),
    };
}

export function buildCompetencyAnalytics(
    state: CompetencyState,
    filters: CompetencyAnalyticsFilters,
) {
    const rows = filterAssessmentRows(
        buildAssessmentRows(state),
        filters,
        state,
    );
    const completionRows = rows.filter(
        (row) => row.displayStatus !== "Cancelled",
    );
    const completion = calculateCycleCompletion(rows.map((row) => row.assessment));
    const assigned = completion.eligible;
    const finalizedRows = completionRows.filter(
        (row) => row.displayStatus === "Finalized",
    );
    const completionRate = completion.rate;

    const scopedSlots = completionRows.flatMap((row) => {
        const finalizedSnapshot = latestFinalizedSnapshot(row.assessment);
        const ratingSource =
            finalizedSnapshot?.ratings ?? row.assessment.ratings;
        const profileSource =
            finalizedSnapshot?.profile ?? row.assessment.roleProfileSnapshot;
        return profileSource.requirements.flatMap((requirement) => {
            if (
                filters.competencyId !== "All" &&
                requirement.competencyId !== filters.competencyId
            )
                return [];
            if (
                filters.category !== "All" &&
                requirement.competency.category !== filters.category
            )
                return [];
            return [
                {
                    row,
                    requirement,
                    competency: requirement.competency,
                    rating:
                        ratingSource.find(
                            (rating) =>
                                rating.competencyId ===
                                requirement.competencyId,
                        ) ?? null,
                    finalizedSnapshot,
                },
            ];
        });
    });

    const historicalRequirementResults = scopedSlots.flatMap((slot) => {
        if (
            !slot.finalizedSnapshot ||
            slot.rating?.selectedLevel === null ||
            !slot.rating
        )
            return [];
        return [
            {
                ...slot,
                rating: slot.rating,
                result: getRequirementResult(
                    slot.rating.selectedLevel,
                    slot.requirement.requiredLevel,
                ),
            },
        ];
    });
    const currentProfiles = buildCompetencyProfiles(state).filter(row =>
        (filters.department === "All" || row.person.department === filters.department) &&
        (filters.position === "All" || row.person.position === filters.position) &&
        (filters.personType === "All" || row.person.personType === filters.personType) &&
        (filters.roleProfileVersion === "All" || (row.profile && `${row.profile.id}::${row.profile.version}` === filters.roleProfileVersion)));
    const currentRequirements = currentProfiles.flatMap(profile => profile.requirements
        .filter(detail => (filters.competencyId === "All" || detail.requirement.competencyId === filters.competencyId) &&
            (filters.category === "All" || detail.competency?.category === filters.category) &&
            (filters.status === "All" || (detail.sourceAssessment && getDisplayAssessmentStatus(detail.sourceAssessment) === filters.status)))
        .map(detail => ({ profile, detail })));
    const currentValidatedResults: typeof historicalRequirementResults = currentRequirements.flatMap(({profile, detail}) => {
        if (!detail.sourceAssessment || !detail.sourceFinalizedSnapshot || !detail.competency || detail.currentLevel === null) return [];
        const row = buildAssessmentRows(state).find(row => row.assessment.id === detail.sourceAssessment!.id);
        const rating = detail.sourceFinalizedSnapshot.ratings.find(rating => rating.competencyId === detail.requirement.competencyId) ?? detail.sourceFinalizedSnapshot.ratings.find(rating => {
            const definition = state.competencies.find(c => c.id === rating.competencyId);
            return definition?.lineageId === detail.competency!.lineageId;
        });
        if (!row || !rating) return [];
        return [{ row, requirement: {...detail.requirement, competency: snapshotCompetencyDefinition(detail.competency)}, competency: snapshotCompetencyDefinition(detail.competency), rating, finalizedSnapshot: detail.sourceFinalizedSnapshot, result: detail.result }];
    });
    const requirementResults = filters.cycleId !== "All" ? historicalRequirementResults : currentValidatedResults;

    const resultLabels: RequirementResult[] = [
        "Exceeds Requirement",
        "Meets Requirement",
        "Below Requirement",
        "Not Assessed",
    ];
    const attainment = resultLabels.map((name) => ({
        name,
        value: requirementResults.filter((item) => item.result === name).length,
    }));

    const proficiency = [1, 2, 3, 4, 5].map((level) => ({
        level: level as ProficiencyLevel,
        count: requirementResults.filter(
            (item) => item.rating.selectedLevel === level,
        ).length,
    }));

    const gapResults = requirementResults.filter(
        (item) => item.result === "Below Requirement",
    );
    const gapsByCompetency = [
        ...new Set(gapResults.map((item) => item.competency.id)),
    ]
        .map((id) => ({
            name:
                gapResults.find((item) => item.competency.id === id)?.competency
                    .name ?? id,
            count: gapResults.filter((item) => item.competency.id === id)
                .length,
        }))
        .sort((a, b) => b.count - a.count);

    const gapsByCategory = COMPETENCY_CATEGORIES.map((category) => ({
        category,
        count: gapResults.filter(
            (result) => result.competency.category === category,
        ).length,
    }));

    const gapsByDepartment = [
        ...new Set(
            rows.map((row) => (filters.cycleId === "All" ? row.person.department : row.assessment.roleProfileSnapshot.department)),
        ),
    ]
        .map((department) => ({
            department,
            gaps: gapResults.filter(
                (item) =>
                    (filters.cycleId === "All" ? item.row.person.department : item.row.assessment.roleProfileSnapshot.department) ===
                    department,
            ).length,
        }))
        .sort((a, b) => b.gaps - a.gaps);

    const gapsByPosition = [
        ...new Set(
            rows.map((row) => (filters.cycleId === "All" ? row.person.position : row.assessment.roleProfileSnapshot.position)),
        ),
    ]
        .map((position) => ({
            position,
            gaps: gapResults.filter(
                (item) =>
                    (filters.cycleId === "All" ? item.row.person.position : item.row.assessment.roleProfileSnapshot.position) ===
                    position,
            ).length,
        }))
        .sort((a, b) => b.gaps - a.gaps);

    const assessedSlots = requirementResults;
    const currentSlots =
        filters.cycleId !== "All"
            ? scopedSlots
            : [...scopedSlots]
                  .sort(
                      (a, b) =>
                          parseDate(
                              b.finalizedSnapshot?.finalizedAt ??
                                  b.row.assessment.lastUpdated,
                          ) -
                          parseDate(
                              a.finalizedSnapshot?.finalizedAt ??
                                  a.row.assessment.lastUpdated,
                          ),
                  )
                  .filter(
                      (item, index, items) =>
                          items.findIndex(
                              (candidate) =>
                                  candidate.row.assessment.personId ===
                                      item.row.assessment.personId &&
                                  candidate.requirement.competencyId ===
                                      item.requirement.competencyId,
                          ) === index,
                  );
    const denominator = filters.cycleId === "All" ? currentRequirements.length : currentSlots.length;
    const assessmentCoverage = denominator ? Math.round((assessedSlots.length / denominator) * 100) : 0;
    const currentProfileCount = currentProfiles.filter(row => row.profile).length;
    const profileCoverage = currentProfiles.length ? Math.round(currentProfileCount / currentProfiles.length * 100) : 0;
    const totalCurrentRequirements = denominator;
    const notAssessed = Math.max(denominator - assessedSlots.length, 0);
    attainment.find(item => item.name === "Not Assessed")!.value = notAssessed;
    const expiredSlots = assessedSlots.filter((slot) => {
        const lastAssessed =
            slot.finalizedSnapshot?.finalizedAt ??
            null;
        const interval =
            slot.requirement.reassessmentIntervalMonths ??
            slot.competency.reassessmentIntervalMonths;
        return Boolean(
            lastAssessed &&
                interval &&
                parseDate(addMonths(lastAssessed, interval)) <=
                    parseDate(todayIso()),
        );
    });

    const comparableCycles = state.cycles
        .map((cycle) => {
            const cycleResults = historicalRequirementResults.filter(
                (item) => item.row.assessment.cycleId === cycle.id,
            );
            const cycleRows = new Set(
                cycleResults.map((item) => item.row.assessment.id),
            );
            return {
                cycle: cycle.name,
                cycleStart: cycle.startDate,
                attainment: cycleResults.length
                    ? Math.round(
                          (cycleResults.filter(
                              (item) => item.result !== "Below Requirement",
                          ).length /
                              cycleResults.length) *
                              100,
                      )
                    : null,
                sample: cycleRows.size,
            };
        })
        .filter((item) => item.sample > 0)
        .sort((a, b) => a.cycleStart.localeCompare(b.cycleStart))
        .map(({ cycleStart: _cycleStart, ...item }) => item);

    const scopedAssessmentIds = new Set(
        completionRows.map((row) => row.assessment.id),
    );
    const scopedCompetencyIds = new Set(
        scopedSlots.map((slot) => slot.requirement.competencyId),
    );
    const scopedRecommendations = state.recommendations.filter(
        (item) =>
            scopedAssessmentIds.has(item.sourceAssessmentId) &&
            scopedCompetencyIds.has(item.competencyId),
    );
    const recommendationOutcomes = [
        "Recommended",
        "Reviewed",
        "Reassessment Requested",
        "Reassessed",
    ].map((status) => ({
        status,
        count: scopedRecommendations.filter((item) => item.status === status)
            .length,
    }));

    const evidenceRequired = assessedSlots.filter((slot) => {
        return Boolean(
            slot.row.assessment.cycleSnapshot.requireSupportingEvidence ||
                slot.requirement.critical ||
                slot.requirement.evidenceRequirement === "Required",
        );
    });
    const evidenceComplete = evidenceRequired.filter(
        (slot) => (slot.rating?.evidence.length ?? 0) > 0,
    ).length;
    const acknowledgmentRequired = finalizedRows.filter(
        (row) => row.assessment.cycleSnapshot.requireAcknowledgment,
    );

    return {
        rows,
        assigned,
        finalized: finalizedRows.length,
        completionRate,
        requirementResults,
        attainment,
        proficiency,
        gapsByCompetency,
        gapsByCategory,
        gapsByDepartment,
        gapsByPosition,
        profileCoverage,
        assessmentCoverage,
        currentProfileCount,
        totalCurrentRequirements,
        notAssessed,
        expired: expiredSlots.length,
        openCriticalGaps: gapResults.filter((item) => item.requirement.critical)
            .length,
        reassessmentsDue: filters.cycleId === "All"
            ? new Set(currentRequirements.filter(({detail}) => detail.reassessmentDue).map(({profile}) => profile.person.id)).size
            : new Set(expiredSlots.map(slot => slot.row.assessment.personId)).size,
        comparableCycles,
        recommendationOutcomes,
        validationQuality: {
            pendingValidation: rows.filter((row) =>
                ["Submitted", "Pending Validation"].includes(row.displayStatus),
            ).length,
            returnedForRevision: rows.filter(
                (row) => row.displayStatus === "Returned for Revision",
            ).length,
            evidenceCoverage: evidenceRequired.length
                ? Math.round((evidenceComplete / evidenceRequired.length) * 100)
                : 0,
            acknowledged: acknowledgmentRequired.filter((row) => {
                const snapshot = latestFinalizedSnapshot(row.assessment);
                return Boolean(
                    snapshot &&
                        findAssessmentAcknowledgmentEvent(
                            state.acknowledgmentEvents,
                            row.assessment.id,
                            snapshot.version,
                        ),
                );
            }).length,
            acknowledgmentRequired: acknowledgmentRequired.length,
        },
    };
}
