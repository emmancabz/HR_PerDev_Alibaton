import {
    COMPETENCY_CATEGORIES,
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
        previous.reassessmentRule.trim() === next.reassessmentRule.trim()
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
    const matches = state.roleProfiles.filter(
        (profile) =>
            profile.status === "Active" &&
            profile.position === person.position &&
            profile.department === person.department &&
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
        const relationship = REPORTING_RELATIONSHIPS.find(
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
    if (!person || !profile) return false;
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
                    rating?.assessedAt ?? source?.finalizedAt ?? null;
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
            row.assessment.roleProfileSnapshot.department !== filters.department
        )
            return false;
        if (
            filters.position !== "All" &&
            row.assessment.roleProfileSnapshot.position !== filters.position
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
            const due = parseDate(detail.validUntil);
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
    const requirementResults =
        filters.cycleId !== "All"
            ? historicalRequirementResults
            : [...historicalRequirementResults]
                  .sort(
                      (a, b) =>
                          parseDate(b.finalizedSnapshot!.finalizedAt) -
                          parseDate(a.finalizedSnapshot!.finalizedAt),
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
            rows.map((row) => row.assessment.roleProfileSnapshot.department),
        ),
    ]
        .map((department) => ({
            department,
            gaps: gapResults.filter(
                (item) =>
                    item.row.assessment.roleProfileSnapshot.department ===
                    department,
            ).length,
        }))
        .sort((a, b) => b.gaps - a.gaps);

    const gapsByPosition = [
        ...new Set(
            rows.map((row) => row.assessment.roleProfileSnapshot.position),
        ),
    ]
        .map((position) => ({
            position,
            gaps: gapResults.filter(
                (item) =>
                    item.row.assessment.roleProfileSnapshot.position ===
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
    const profileCoverage = currentSlots.length
        ? Math.round((assessedSlots.length / currentSlots.length) * 100)
        : 0;
    const currentProfileCount = new Set(
        completionRows.map(
            (row) =>
                `${row.assessment.personId}::${roleProfileVersionKey(row.assessment)}`,
        ),
    ).size;
    const totalCurrentRequirements = currentSlots.length;
    const notAssessed = Math.max(currentSlots.length - assessedSlots.length, 0);
    const expiredSlots = assessedSlots.filter((slot) => {
        const lastAssessed =
            slot.rating?.assessedAt ??
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
        .filter((item) => item.sample > 0);

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
        currentProfileCount,
        totalCurrentRequirements,
        notAssessed,
        expired: expiredSlots.length,
        openCriticalGaps: gapResults.filter((item) => item.requirement.critical)
            .length,
        reassessmentsDue: expiredSlots.length,
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
