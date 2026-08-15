import {
    COMPETENCY_STORAGE_KEY,
    cloneAssessmentCycleSnapshot,
    cloneRoleProfileSnapshot,
    createCompetencyInitialState,
    snapshotAssessmentCycle,
    snapshotCompetencyDefinition,
    type AssessmentAcknowledgmentEvent,
    type AssessmentCycle,
    type AssessmentCycleSnapshot,
    type AssessmentEvidence,
    type CompetencyAssessment,
    type CompetencyDefinition,
    type CompetencyState,
    type FinalizedAssessmentSnapshot,
    type RoleProfile,
    type RoleProfileSnapshot,
    type RoleRequirement,
    type RoleRequirementSnapshot,
} from "@/data/competency";
import { preserveFinalizedSnapshotAcknowledgments } from "@/data/competencyLifecycle";
import { useEffect, useState } from "react";

function looksLikeCompetencyState(value: unknown): value is CompetencyState {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<CompetencyState> & {
        schemaVersion?: number;
    };
    return (
        [1, 2, 3, 4].includes(candidate.schemaVersion ?? 0) &&
        Array.isArray(candidate.competencies) &&
        Array.isArray(candidate.roleProfiles) &&
        Array.isArray(candidate.cycles) &&
        Array.isArray(candidate.assessorAuthorizations) &&
        Array.isArray(candidate.assessments) &&
        Array.isArray(candidate.recommendations) &&
        Array.isArray(candidate.activities)
    );
}

function normalizeEvidence(
    evidence: AssessmentEvidence,
    fallbackActor: string,
): AssessmentEvidence {
    const stored = evidence as Partial<AssessmentEvidence> &
        Pick<AssessmentEvidence, "id" | "type" | "title" | "reference" | "addedAt">;
    return {
        id: stored.id,
        type: stored.type,
        title: stored.title,
        reference: stored.reference ?? "",
        description: stored.description ?? stored.reference ?? "",
        addedAt: stored.addedAt,
        addedBy: stored.addedBy ?? fallbackActor,
        verificationState: stored.verificationState ?? "Unverified",
        sourceContext: "Metadata or link reference",
    };
}

function normalizeCycle(cycle: AssessmentCycle): AssessmentCycle {
    const stored = cycle as Partial<AssessmentCycle> &
        Omit<
            AssessmentCycle,
            | "roleBasedAssessorScope"
            | "roleBasedAssessorPositions"
            | "updatedAt"
            | "updatedBy"
            | "cancellationReason"
            | "cancelledAt"
        >;
    return {
        ...stored,
        roleBasedAssessorScope:
            stored.roleBasedAssessorScope ??
            (stored.assignmentMethod === "Role-based Assessor" ? "Department" : null),
        roleBasedAssessorPositions: stored.roleBasedAssessorPositions ?? [],
        updatedAt: stored.updatedAt ?? stored.createdAt,
        updatedBy: stored.updatedBy ?? stored.createdBy,
        cancellationReason: stored.cancellationReason ?? null,
        cancelledAt: stored.cancelledAt ?? null,
    };
}

function normalizeCycleSnapshot(
    snapshot: AssessmentCycleSnapshot | undefined,
    cycle: AssessmentCycle,
    state: CompetencyState,
): AssessmentCycleSnapshot {
    const source = snapshot ?? snapshotAssessmentCycle(cycle, state.roleProfiles);
    return cloneAssessmentCycleSnapshot({
        ...source,
        roleProfileVersions:
            source.roleProfileVersions ??
            source.roleProfileIds.flatMap((profileId) => {
                const profile = state.roleProfiles.find((item) => item.id === profileId);
                return profile ? [{ profileId, version: profile.version }] : [];
            }),
        roleBasedAssessorScope:
            source.roleBasedAssessorScope ??
            (source.assignmentMethod === "Role-based Assessor" ? "Department" : null),
        roleBasedAssessorPositions: source.roleBasedAssessorPositions ?? [],
    });
}

function normalizeRoleProfileSnapshot(
    snapshot: RoleProfileSnapshot,
    state: CompetencyState,
): RoleProfileSnapshot {
    return {
        ...snapshot,
        requirements: snapshot.requirements.map((requirement) => {
            const stored = requirement as Partial<RoleRequirementSnapshot> & RoleRequirement;
            const storedSnapshot = (requirement as Partial<RoleRequirementSnapshot>).competency;
            const currentDefinition = state.competencies.find(
                (item) => item.id === stored.competencyId,
            );
            if (!storedSnapshot && !currentDefinition) {
                throw new Error(
                    `Missing competency definition for stored assessment: ${stored.competencyId}`,
                );
            }
            const competency = storedSnapshot
                ? {
                      ...storedSnapshot,
                      behavioralIndicators: { ...storedSnapshot.behavioralIndicators },
                      assessmentMethods: [...storedSnapshot.assessmentMethods],
                      requiredEvidenceTypes: [...storedSnapshot.requiredEvidenceTypes],
                  }
                : snapshotCompetencyDefinition(currentDefinition!);
            return { ...stored, competency } as RoleRequirementSnapshot;
        }),
    };
}

function normalizeFinalizedSnapshot(
    snapshot: FinalizedAssessmentSnapshot,
    assessment: CompetencyAssessment,
    state: CompetencyState,
    index: number,
): FinalizedAssessmentSnapshot {
    const stored = snapshot as Partial<FinalizedAssessmentSnapshot>;
    return {
        version: stored.version ?? index + 1,
        profile: cloneRoleProfileSnapshot(
            normalizeRoleProfileSnapshot(
                stored.profile ?? assessment.roleProfileSnapshot,
                state,
            ),
        ),
        cycle: normalizeCycleSnapshot(
            stored.cycle,
            state.cycles.find((item) => item.id === assessment.cycleId)!,
            state,
        ),
        ratings: (stored.ratings ?? assessment.ratings).map((rating) => ({
            ...rating,
            evidence: rating.evidence.map((item) =>
                normalizeEvidence(item, stored.finalizedBy ?? assessment.assessorId),
            ),
        })),
        assessorId: stored.assessorId ?? assessment.assessorId,
        hrValidationNotes: stored.hrValidationNotes ?? assessment.hrValidationNotes,
        submittedAt: stored.submittedAt ?? assessment.submittedAt,
        // Legacy snapshot-linked acknowledgment is preserved as historical data,
        // but the v4 UI derives acknowledgment only from append-only events.
        employeeAcknowledgedAt: stored.employeeAcknowledgedAt ?? null,
        finalizedAt: stored.finalizedAt ?? assessment.finalizedAt ?? assessment.lastUpdated,
        finalizedBy: stored.finalizedBy ?? "Migrated historical record",
    };
}

function lineageForCompetency(
    competency: CompetencyDefinition & { lineageId?: string },
    all: Array<CompetencyDefinition & { lineageId?: string }>,
): string {
    if (competency.lineageId) return competency.lineageId;
    const source = competency.draftSourceId
        ? all.find((item) => item.id === competency.draftSourceId)
        : null;
    return source?.lineageId ?? source?.id ?? competency.id;
}

function lineageForRoleProfile(
    profile: RoleProfile & { lineageId?: string },
    all: Array<RoleProfile & { lineageId?: string }>,
): string {
    if (profile.lineageId) return profile.lineageId;
    const source = profile.draftSourceId
        ? all.find((item) => item.id === profile.draftSourceId)
        : null;
    return source?.lineageId ?? source?.id ?? profile.id;
}

function normalizeExistingAcknowledgmentEvents(
    state: CompetencyState,
): AssessmentAcknowledgmentEvent[] {
    const stored = (state as Partial<CompetencyState>).acknowledgmentEvents ?? [];
    const deduped = new Map<string, AssessmentAcknowledgmentEvent>();
    for (const event of stored) {
        const key = `${event.assessmentId}::${event.finalizedVersion}`;
        if (!deduped.has(key)) {
            deduped.set(key, {
                ...event,
                eventType: "Assessment Receipt Acknowledged",
                sourceContext: event.sourceContext ?? "Stored acknowledgment event",
            });
        }
    }
    return [...deduped.values()];
}

export function migrateCompetencyState(state: CompetencyState): CompetencyState {
    const rawCompetencies = state.competencies as Array<
        CompetencyDefinition & { lineageId?: string }
    >;
    const normalizedCompetencies = rawCompetencies.map((competency) => ({
        ...competency,
        lineageId: lineageForCompetency(competency, rawCompetencies),
        draftSourceId: competency.draftSourceId ?? null,
        versionHistory: competency.versionHistory.map((entry) => ({
            ...entry,
            status: entry.status ?? competency.status,
            definition: entry.definition ?? snapshotCompetencyDefinition(competency),
        })),
    }));

    const rawRoleProfiles = state.roleProfiles as Array<RoleProfile & { lineageId?: string }>;
    const normalizedRoleProfiles = rawRoleProfiles.map((profile) => ({
        ...profile,
        lineageId: lineageForRoleProfile(profile, rawRoleProfiles),
        draftSourceId: profile.draftSourceId ?? null,
        versionHistory: profile.versionHistory.map((entry) => ({
            ...entry,
            status: entry.status ?? profile.status,
            name: entry.name ?? profile.name,
            position: entry.position ?? profile.position,
            department: entry.department ?? profile.department,
            appliesTo: entry.appliesTo ?? profile.appliesTo,
            competencyDefinitions:
                entry.competencyDefinitions ??
                entry.requirements.flatMap((requirement) => {
                    const competency = normalizedCompetencies.find(
                        (item) => item.id === requirement.competencyId,
                    );
                    return competency ? [snapshotCompetencyDefinition(competency)] : [];
                }),
        })),
    }));

    const normalizedCycles = state.cycles.map(normalizeCycle);
    const existingAcknowledgmentEvents = normalizeExistingAcknowledgmentEvents(state);
    const normalizedBase: CompetencyState = {
        ...state,
        schemaVersion: 4,
        competencies: normalizedCompetencies,
        roleProfiles: normalizedRoleProfiles,
        cycles: normalizedCycles,
        acknowledgmentEvents: existingAcknowledgmentEvents,
    };

    const migratedAcknowledgmentEvents = new Map(
        existingAcknowledgmentEvents.map((event) => [
            `${event.assessmentId}::${event.finalizedVersion}`,
            event,
        ]),
    );

    const normalizedAssessments = state.assessments.map((assessment) => {
        const stored = assessment as CompetencyAssessment & {
            finalizedSnapshots?: FinalizedAssessmentSnapshot[];
            revisionSourceAssessmentId?: string | null;
            employeeAcknowledgedAt?: string | null;
        };
        const roleProfileSnapshot = normalizeRoleProfileSnapshot(
            stored.roleProfileSnapshot,
            normalizedBase,
        );
        const cycle = normalizedCycles.find((item) => item.id === stored.cycleId);
        if (!cycle) {
            throw new Error(`Missing assessment cycle for stored assessment: ${stored.cycleId}`);
        }
        const cycleSnapshot = normalizeCycleSnapshot(
            (stored as Partial<CompetencyAssessment>).cycleSnapshot,
            cycle,
            normalizedBase,
        );
        const sourceSnapshots = stored.finalizedSnapshots?.length
            ? stored.finalizedSnapshots
            : stored.finalizedSnapshot
              ? [stored.finalizedSnapshot]
              : [];

        // Only a timestamp stored on a specific finalized snapshot is migrated.
        // A live-record-only acknowledgment is intentionally not guessed onto a
        // version because its exact historical relationship may be unknowable.
        sourceSnapshots.forEach((snapshot) => {
            const legacy = snapshot as Partial<FinalizedAssessmentSnapshot> & {
                employeeAcknowledgedAt?: string | null;
            };
            if (
                typeof legacy.version !== "number" ||
                !legacy.employeeAcknowledgedAt
            ) {
                return;
            }
            const key = `${stored.id}::${legacy.version}`;
            if (migratedAcknowledgmentEvents.has(key)) return;
            migratedAcknowledgmentEvents.set(key, {
                id: `legacy-ack-${stored.id}-v${legacy.version}`,
                assessmentId: stored.id,
                finalizedVersion: legacy.version,
                personId: stored.personId,
                acknowledgedAt: legacy.employeeAcknowledgedAt,
                actorId: stored.personId,
                actorName: "Assessment subject",
                sourceContext: "Migrated from version-linked finalized snapshot",
                eventType: "Assessment Receipt Acknowledged",
            });
        });

        const assessmentWithNormalizedProfile = {
            ...stored,
            roleProfileSnapshot,
            cycleSnapshot,
        };
        const finalizedSnapshots = preserveFinalizedSnapshotAcknowledgments(
            sourceSnapshots.map((snapshot, index) =>
                normalizeFinalizedSnapshot(
                    snapshot,
                    assessmentWithNormalizedProfile,
                    normalizedBase,
                    index,
                ),
            ),
        );
        return {
            ...stored,
            roleProfileSnapshot,
            cycleSnapshot,
            ratings: stored.ratings.map((rating) => ({
                ...rating,
                evidence: rating.evidence.map((item) =>
                    normalizeEvidence(item, stored.assessorId),
                ),
            })),
            finalizedSnapshots,
            finalizedSnapshot: finalizedSnapshots.at(-1) ?? null,
            revisionSourceAssessmentId: stored.revisionSourceAssessmentId ?? null,
            auditHistory: stored.auditHistory ?? [],
            revisionHistory: stored.revisionHistory ?? [],
            reassignmentHistory: stored.reassignmentHistory ?? [],
        };
    });

    return {
        ...normalizedBase,
        assessments: normalizedAssessments,
        acknowledgmentEvents: [...migratedAcknowledgmentEvents.values()],
        recommendations: state.recommendations.map((recommendation) => ({
            ...recommendation,
            reassessedAt: recommendation.reassessedAt ?? null,
            reassessmentAssessmentId: recommendation.reassessmentAssessmentId ?? null,
        })),
        auditLog: state.auditLog ?? [],
    };
}

export function loadCompetencyState(): CompetencyState {
    if (typeof window === "undefined") return createCompetencyInitialState();
    try {
        const raw = window.localStorage.getItem(COMPETENCY_STORAGE_KEY);
        if (!raw) return createCompetencyInitialState();
        const parsed: unknown = JSON.parse(raw);
        return looksLikeCompetencyState(parsed)
            ? migrateCompetencyState(parsed)
            : createCompetencyInitialState();
    } catch {
        return createCompetencyInitialState();
    }
}

export function useCompetencyStore() {
    const [state, setState] = useState<CompetencyState>(loadCompetencyState);
    const [storageError, setStorageError] = useState("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(COMPETENCY_STORAGE_KEY, JSON.stringify(state));
            setStorageError("");
        } catch {
            setStorageError("Competency changes could not be saved in this browser.");
        }
    }, [state]);

    return { state, setState, storageError };
}
