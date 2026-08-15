import {
    cloneRoleProfileSnapshot,
    snapshotCompetencyDefinition,
    type AssessmentAcknowledgmentEvent,
    type AssessmentStatus,
    type CompetencyAssessment,
    type CompetencyDefinition,
    type FinalizedAssessmentSnapshot,
    type RoleProfile,
    type RoleRequirement,
    uniqueId,
} from "@/data/competency";

export type CompetencyRevisionInput = Pick<
    CompetencyDefinition,
    | "name"
    | "category"
    | "definition"
    | "behavioralIndicators"
    | "assessmentMethods"
    | "requiredEvidenceTypes"
    | "reassessmentIntervalMonths"
    | "status"
>;

function cloneCompetency(value: CompetencyDefinition): CompetencyDefinition {
    return {
        ...value,
        behavioralIndicators: { ...value.behavioralIndicators },
        assessmentMethods: [...value.assessmentMethods],
        requiredEvidenceTypes: [...value.requiredEvidenceTypes],
        versionHistory: value.versionHistory.map((entry) => ({
            ...entry,
            definition: {
                ...entry.definition,
                behavioralIndicators: { ...entry.definition.behavioralIndicators },
                assessmentMethods: [...entry.definition.assessmentMethods],
                requiredEvidenceTypes: [...entry.definition.requiredEvidenceTypes],
            },
        })),
    };
}

function cloneRoleProfile(value: RoleProfile): RoleProfile {
    return {
        ...value,
        requirements: value.requirements.map((item) => ({ ...item })),
        versionHistory: value.versionHistory.map((entry) => ({
            ...entry,
            requirements: entry.requirements.map((item) => ({ ...item })),
            competencyDefinitions: entry.competencyDefinitions.map((item) => ({
                ...item,
                behavioralIndicators: { ...item.behavioralIndicators },
                assessmentMethods: [...item.assessmentMethods],
                requiredEvidenceTypes: [...item.requiredEvidenceTypes],
            })),
        })),
    };
}

function requireDraftStatus(status: CompetencyDefinition["status"] | RoleProfile["status"]): void {
    if (status !== "Draft") {
        throw new Error(
            "Published records cannot be saved directly. Save a working Draft, then use the explicit Publish/Activate transition.",
        );
    }
}

export function saveCompetencyRevision(
    source: CompetencyDefinition | null,
    input: CompetencyRevisionInput,
    meta: { code: string; actor: string; changedAt: string; duplicate?: boolean },
): CompetencyDefinition {
    requireDraftStatus(input.status);

    const independentDraft = !source || Boolean(meta.duplicate);
    const publishedSource = Boolean(source && source.status !== "Draft" && !meta.duplicate);
    const id = independentDraft || publishedSource ? uniqueId("comp") : source!.id;
    const lineageId = independentDraft
        ? id
        : source!.lineageId ?? source!.id;
    const history = independentDraft ? [] : cloneCompetency(source!).versionHistory;

    return {
        ...(source ? cloneCompetency(source) : ({} as CompetencyDefinition)),
        ...input,
        id,
        lineageId,
        code: independentDraft ? meta.code : source!.code,
        status: "Draft",
        // Draft saves never advance an official version. New/duplicated entities are
        // tentatively displayed as v1 until their first explicit publication.
        version: independentDraft ? 1 : source!.version,
        versionHistory: history,
        lastUpdated: meta.changedAt,
        updatedBy: meta.actor,
        draftSourceId: publishedSource ? source!.id : source?.draftSourceId ?? null,
    };
}

export type RoleProfileRevisionInput = Pick<
    RoleProfile,
    "name" | "position" | "department" | "appliesTo" | "effectiveDate" | "status"
> & { requirements: RoleRequirement[] };

export function saveRoleProfileRevision(
    source: RoleProfile | null,
    input: RoleProfileRevisionInput,
    _competencies: CompetencyDefinition[],
    meta: { actor: string; changedAt: string },
): RoleProfile {
    requireDraftStatus(input.status);

    const publishedSource = Boolean(source && source.status !== "Draft");
    const id = !source || publishedSource ? uniqueId("profile") : source.id;
    const lineageId = source ? source.lineageId ?? source.id : id;
    const history = source ? cloneRoleProfile(source).versionHistory : [];

    return {
        ...(source ? cloneRoleProfile(source) : ({} as RoleProfile)),
        ...input,
        id,
        lineageId,
        requirements: input.requirements.map((item) => ({ ...item })),
        status: "Draft",
        version: source?.version ?? 1,
        versionHistory: history,
        lastUpdated: meta.changedAt,
        updatedBy: meta.actor,
        draftSourceId: publishedSource ? source!.id : source?.draftSourceId ?? null,
    };
}

export type WorkingDraftResult<T> = {
    records: T[];
    draft: T;
    created: boolean;
};

export function ensureCompetencyWorkingDraft(
    records: CompetencyDefinition[],
    sourceId: string,
    meta: { actor: string; changedAt: string },
): WorkingDraftResult<CompetencyDefinition> {
    const source = records.find((item) => item.id === sourceId);
    if (!source) throw new Error("Competency source record was not found.");
    if (source.status === "Draft") {
        return { records, draft: source, created: false };
    }

    const lineageId = source.lineageId ?? source.id;
    const exactDraft = records.find(
        (item) =>
            item.status === "Draft" &&
            (item.lineageId ?? item.id) === lineageId &&
            item.draftSourceId === source.id,
    );
    if (exactDraft) return { records, draft: exactDraft, created: false };

    const conflictingDraft = records.find(
        (item) =>
            item.status === "Draft" &&
            (item.lineageId ?? item.id) === lineageId &&
            item.draftSourceId !== source.id,
    );
    if (conflictingDraft) {
        throw new Error(
            "A working Draft already exists for this lineage but is based on a different published source version.",
        );
    }

    const draft = saveCompetencyRevision(
        source,
        { ...source, status: "Draft" },
        { code: source.code, actor: meta.actor, changedAt: meta.changedAt },
    );
    return { records: [...records, draft], draft, created: true };
}

export function ensureRoleProfileWorkingDraft(
    records: RoleProfile[],
    sourceId: string,
    competencies: CompetencyDefinition[],
    meta: { actor: string; changedAt: string },
): WorkingDraftResult<RoleProfile> {
    const source = records.find((item) => item.id === sourceId);
    if (!source) throw new Error("Role Profile source record was not found.");
    if (source.status === "Draft") {
        return { records, draft: source, created: false };
    }

    const lineageId = source.lineageId ?? source.id;
    const exactDraft = records.find(
        (item) =>
            item.status === "Draft" &&
            (item.lineageId ?? item.id) === lineageId &&
            item.draftSourceId === source.id,
    );
    if (exactDraft) return { records, draft: exactDraft, created: false };

    const conflictingDraft = records.find(
        (item) =>
            item.status === "Draft" &&
            (item.lineageId ?? item.id) === lineageId &&
            item.draftSourceId !== source.id,
    );
    if (conflictingDraft) {
        throw new Error(
            "A working Draft already exists for this Role Profile lineage but is based on a different published source version.",
        );
    }

    const draft = saveRoleProfileRevision(
        source,
        { ...source, status: "Draft" },
        competencies,
        meta,
    );
    return { records: [...records, draft], draft, created: true };
}

function nextPublishedVersion(
    historyVersions: number[],
    lineageVersions: number[],
): number {
    const published = [...historyVersions, ...lineageVersions].filter(
        (value) => Number.isFinite(value) && value > 0,
    );
    return published.length ? Math.max(...published) + 1 : 1;
}

export type PublicationTransition<T> = {
    records: T[];
    published: T;
    archivedSourceId: string | null;
};

export function publishCompetencyDraft(
    records: CompetencyDefinition[],
    draftId: string,
    meta: { actor: string; changedAt: string },
): PublicationTransition<CompetencyDefinition> {
    const draft = records.find((item) => item.id === draftId);
    if (!draft || draft.status !== "Draft") {
        throw new Error("Only a working Competency Draft can be published.");
    }

    // Preserve this exact identifier until every source validation and archival
    // decision has completed. It is deliberately cleared only on the final
    // published record created below.
    const sourceId = draft.draftSourceId ?? null;
    const source = sourceId ? records.find((item) => item.id === sourceId) : null;
    if (sourceId && !source) {
        throw new Error("The exact published Competency source for this Draft is missing.");
    }

    const lineageId = draft.lineageId ?? source?.lineageId ?? source?.id ?? draft.id;
    if (source && (source.lineageId ?? source.id) !== lineageId) {
        throw new Error("The Competency Draft source does not belong to the same lineage.");
    }

    const activeLineage = records.filter(
        (item) =>
            item.status === "Active" && (item.lineageId ?? item.id) === lineageId,
    );
    if (source && source.status === "Active") {
        if (activeLineage.length !== 1 || activeLineage[0].id !== source.id) {
            throw new Error(
                "Competency publication was blocked because the lineage does not have the exact single Active source expected by this Draft.",
            );
        }
    } else if (activeLineage.length) {
        throw new Error(
            "Competency publication was blocked because another Active version already exists in this lineage.",
        );
    }

    const lineagePublishedVersions = records
        .filter(
            (item) =>
                item.status !== "Draft" &&
                (item.lineageId ?? item.id) === lineageId,
        )
        .map((item) => item.version);
    const nextVersion = nextPublishedVersion(
        draft.versionHistory.map((entry) => entry.version),
        lineagePublishedVersions,
    );

    // Archive the exact source first in the immutable next collection. The
    // original input collection remains untouched if any validation fails.
    const archivedRecords = records.map((item) =>
        source && item.id === source.id && item.status === "Active"
            ? { ...cloneCompetency(item), status: "Archived" as const }
            : cloneCompetency(item),
    );

    const publishedBase: CompetencyDefinition = {
        ...cloneCompetency(draft),
        lineageId,
        status: "Active",
        version: nextVersion,
        lastUpdated: meta.changedAt,
        updatedBy: meta.actor,
        draftSourceId: null,
    };
    const published: CompetencyDefinition = {
        ...publishedBase,
        versionHistory: [
            ...publishedBase.versionHistory.filter(
                (entry) => entry.version !== nextVersion,
            ),
            {
                version: nextVersion,
                changedAt: meta.changedAt,
                changedBy: meta.actor,
                summary: nextVersion === 1
                    ? "Initial competency definition published"
                    : "Published material competency revision",
                status: "Active",
                definition: snapshotCompetencyDefinition(publishedBase),
            },
        ],
    };

    const nextRecords = archivedRecords.map((item) =>
        item.id === draft.id ? published : item,
    );
    const activeAfter = nextRecords.filter(
        (item) =>
            item.status === "Active" && (item.lineageId ?? item.id) === lineageId,
    );
    if (activeAfter.length !== 1 || activeAfter[0].id !== published.id) {
        throw new Error("Competency publication failed the single-Active lineage invariant.");
    }

    return { records: nextRecords, published, archivedSourceId: sourceId };
}

export function publishRoleProfileDraft(
    records: RoleProfile[],
    draftId: string,
    competencies: CompetencyDefinition[],
    meta: { actor: string; changedAt: string },
): PublicationTransition<RoleProfile> {
    const draft = records.find((item) => item.id === draftId);
    if (!draft || draft.status !== "Draft") {
        throw new Error("Only a working Role Profile Draft can be published.");
    }

    const sourceId = draft.draftSourceId ?? null;
    const source = sourceId ? records.find((item) => item.id === sourceId) : null;
    if (sourceId && !source) {
        throw new Error("The exact published Role Profile source for this Draft is missing.");
    }

    const lineageId = draft.lineageId ?? source?.lineageId ?? source?.id ?? draft.id;
    if (source && (source.lineageId ?? source.id) !== lineageId) {
        throw new Error("The Role Profile Draft source does not belong to the same lineage.");
    }

    const activeLineage = records.filter(
        (item) =>
            item.status === "Active" && (item.lineageId ?? item.id) === lineageId,
    );
    if (source && source.status === "Active") {
        if (activeLineage.length !== 1 || activeLineage[0].id !== source.id) {
            throw new Error(
                "Role Profile publication was blocked because the lineage does not have the exact single Active source expected by this Draft.",
            );
        }
    } else if (activeLineage.length) {
        throw new Error(
            "Role Profile publication was blocked because another Active version already exists in this lineage.",
        );
    }

    const lineagePublishedVersions = records
        .filter(
            (item) =>
                item.status !== "Draft" &&
                (item.lineageId ?? item.id) === lineageId,
        )
        .map((item) => item.version);
    const nextVersion = nextPublishedVersion(
        draft.versionHistory.map((entry) => entry.version),
        lineagePublishedVersions,
    );

    const archivedRecords = records.map((item) =>
        source && item.id === source.id && item.status === "Active"
            ? { ...cloneRoleProfile(item), status: "Archived" as const }
            : cloneRoleProfile(item),
    );

    const history = cloneRoleProfile(draft).versionHistory;
    const publishedBase: RoleProfile = {
        ...cloneRoleProfile(draft),
        lineageId,
        status: "Active",
        version: nextVersion,
        lastUpdated: meta.changedAt,
        updatedBy: meta.actor,
        draftSourceId: null,
    };
    const published: RoleProfile = {
        ...publishedBase,
        versionHistory: [
            ...history.filter((entry) => entry.version !== nextVersion),
            {
                version: nextVersion,
                effectiveDate: publishedBase.effectiveDate,
                changedAt: meta.changedAt,
                changedBy: meta.actor,
                summary: nextVersion === 1
                    ? "Initial role profile published"
                    : "Published material role-profile revision",
                status: "Active",
                name: publishedBase.name,
                position: publishedBase.position,
                department: publishedBase.department,
                appliesTo: publishedBase.appliesTo,
                requirements: publishedBase.requirements.map((item) => ({ ...item })),
                competencyDefinitions: publishedBase.requirements.flatMap((requirement) => {
                    const competency = competencies.find(
                        (item) => item.id === requirement.competencyId && item.status === "Active",
                    ) ?? competencies.find((item) => item.id === requirement.competencyId);
                    return competency ? [snapshotCompetencyDefinition(competency)] : [];
                }),
            },
        ],
    };

    const nextRecords = archivedRecords.map((item) =>
        item.id === draft.id ? published : item,
    );
    const activeAfter = nextRecords.filter(
        (item) =>
            item.status === "Active" && (item.lineageId ?? item.id) === lineageId,
    );
    if (activeAfter.length !== 1 || activeAfter[0].id !== published.id) {
        throw new Error("Role Profile publication failed the single-Active lineage invariant.");
    }

    return { records: nextRecords, published, archivedSourceId: sourceId };
}

export function findAssessmentAcknowledgmentEvent(
    events: AssessmentAcknowledgmentEvent[],
    assessmentId: string,
    finalizedVersion: number,
): AssessmentAcknowledgmentEvent | null {
    return (
        events.find(
            (event) =>
                event.assessmentId === assessmentId &&
                event.finalizedVersion === finalizedVersion &&
                event.eventType === "Assessment Receipt Acknowledged",
        ) ?? null
    );
}

export function acknowledgeFinalizedAssessmentVersion(
    events: AssessmentAcknowledgmentEvent[],
    assessment: CompetencyAssessment,
    finalizedVersion: number,
    meta: {
        personId: string;
        actorId: string;
        actorName: string;
        acknowledgedAt: string;
        sourceContext: string;
    },
): { events: AssessmentAcknowledgmentEvent[]; event: AssessmentAcknowledgmentEvent; created: boolean } {
    if (assessment.status === "Cancelled" || assessment.status !== "Finalized") {
        throw new Error("Only a finalized, non-cancelled assessment can be acknowledged.");
    }
    if (!assessment.cycleSnapshot.requireAcknowledgment) {
        throw new Error("This finalized assessment does not require employee acknowledgment.");
    }
    if (meta.personId !== assessment.personId || meta.actorId !== assessment.personId) {
        throw new Error("Only the assessment subject can acknowledge receipt.");
    }
    const snapshot = assessment.finalizedSnapshots.find(
        (item) => item.version === finalizedVersion,
    );
    if (!snapshot) {
        throw new Error("The finalized assessment version to acknowledge does not exist.");
    }

    const existing = findAssessmentAcknowledgmentEvent(
        events,
        assessment.id,
        finalizedVersion,
    );
    if (existing) return { events, event: existing, created: false };

    const event: AssessmentAcknowledgmentEvent = {
        id: uniqueId("ack"),
        assessmentId: assessment.id,
        finalizedVersion,
        personId: assessment.personId,
        acknowledgedAt: meta.acknowledgedAt,
        actorId: meta.actorId,
        actorName: meta.actorName,
        sourceContext: meta.sourceContext,
        eventType: "Assessment Receipt Acknowledged",
    };
    return { events: [...events, event], event, created: true };
}

export function effectiveAssessmentStatus(
    assessment: Pick<CompetencyAssessment, "status" | "dueDate">,
    manilaDate: string,
): AssessmentStatus {
    const open: AssessmentStatus[] = ["Pending", "In Progress", "Returned for Revision"];
    return open.includes(assessment.status) && assessment.dueDate < manilaDate
        ? "Overdue"
        : assessment.status;
}

export function calculateCycleCompletion(
    assessments: Array<Pick<CompetencyAssessment, "status">>,
): { eligible: number; finalized: number; cancelled: number; rate: number } {
    const cancelled = assessments.filter((item) => item.status === "Cancelled").length;
    const eligibleRows = assessments.filter((item) => item.status !== "Cancelled");
    const finalized = eligibleRows.filter((item) => item.status === "Finalized").length;
    return {
        eligible: eligibleRows.length,
        finalized,
        cancelled,
        rate: eligibleRows.length ? Math.round((finalized / eligibleRows.length) * 100) : 0,
    };
}

export function preserveFinalizedSnapshotAcknowledgments(
    snapshots: FinalizedAssessmentSnapshot[],
): FinalizedAssessmentSnapshot[] {
    return snapshots.map((snapshot) => ({
        ...snapshot,
        profile: cloneRoleProfileSnapshot(snapshot.profile),
        cycle: {
            ...snapshot.cycle,
            departments: [...snapshot.cycle.departments],
            positions: [...snapshot.cycle.positions],
            roleProfileIds: [...snapshot.cycle.roleProfileIds],
            roleProfileVersions: snapshot.cycle.roleProfileVersions.map((item) => ({ ...item })),
            roleBasedAssessorPositions: [...snapshot.cycle.roleBasedAssessorPositions],
        },
        ratings: snapshot.ratings.map((rating) => ({
            ...rating,
            evidence: rating.evidence.map((item) => ({ ...item })),
        })),
        employeeAcknowledgedAt: snapshot.employeeAcknowledgedAt ?? null,
    }));
}
