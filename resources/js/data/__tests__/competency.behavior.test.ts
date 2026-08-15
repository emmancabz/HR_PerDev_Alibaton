import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    EMPTY_ANALYTICS_FILTERS,
    buildAssessmentRows,
    buildOverviewMetrics,
    cyclePopulationMatches,
    filterAssessmentRows,
    getDisplayAssessmentStatus,
    roleProfileVersionKey,
    validateAssessmentForSubmit,
} from "@/data/competencyCalculations";
import {
    acknowledgeFinalizedAssessmentVersion,
    calculateCycleCompletion,
    ensureCompetencyWorkingDraft,
    ensureRoleProfileWorkingDraft,
    findAssessmentAcknowledgmentEvent,
    publishCompetencyDraft,
    publishRoleProfileDraft,
    saveCompetencyRevision,
    saveRoleProfileRevision,
} from "@/data/competencyLifecycle";
import { migrateCompetencyState } from "@/data/competencyStorage";
import {
    createCompetencyInitialState,
    type AssessmentEvidence,
    type CompetencyAssessment,
    type CompetencyDefinition,
    type CompetencyState,
    type RoleProfile,
} from "@/data/competency";
import { SHARED_PERSONNEL } from "@/data/personnel";

const meta = { actor: "HR Test", changedAt: "2031-03-15T10:00:00+08:00" };
const fixedManilaDate = "2031-03-15";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-03-15T04:00:00.000Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

function state(): CompetencyState {
    return createCompetencyInitialState();
}

function competencyDraftInput(
    source: CompetencyDefinition,
    patch: Partial<CompetencyDefinition> = {},
) {
    return {
        name: patch.name ?? source.name,
        category: patch.category ?? source.category,
        definition: patch.definition ?? source.definition,
        behavioralIndicators:
            patch.behavioralIndicators ?? structuredClone(source.behavioralIndicators),
        assessmentMethods: patch.assessmentMethods ?? [...source.assessmentMethods],
        requiredEvidenceTypes:
            patch.requiredEvidenceTypes ?? [...source.requiredEvidenceTypes],
        reassessmentIntervalMonths:
            patch.reassessmentIntervalMonths ?? source.reassessmentIntervalMonths,
        status: "Draft" as const,
    };
}

function roleDraftInput(source: RoleProfile, patch: Partial<RoleProfile> = {}) {
    return {
        name: patch.name ?? source.name,
        position: patch.position ?? source.position,
        department: patch.department ?? source.department,
        appliesTo: patch.appliesTo ?? source.appliesTo,
        effectiveDate: patch.effectiveDate ?? source.effectiveDate,
        requirements: patch.requirements ?? source.requirements.map((item) => ({ ...item })),
        status: "Draft" as const,
    };
}

function finalizedAssessmentRequiringAcknowledgment(): CompetencyAssessment {
    const current = state();
    const found = current.assessments.find(
        (item) => item.status === "Finalized" && item.cycleSnapshot.requireAcknowledgment,
    );
    if (!found) throw new Error("Expected a finalized acknowledgment-required fixture.");
    return structuredClone(found);
}

function acknowledgmentMeta(assessment: CompetencyAssessment) {
    return {
        personId: assessment.personId,
        actorId: assessment.personId,
        actorName:
            SHARED_PERSONNEL.find((item) => item.id === assessment.personId)?.fullName ??
            "Assessment subject",
        acknowledgedAt: "2031-03-15T09:30:00+08:00",
        sourceContext: "Permanent lifecycle test",
    };
}

function makeSubmissionReady(assessment: CompetencyAssessment): CompetencyAssessment {
    const next = structuredClone(assessment);
    next.cycleSnapshot.requireSelfAssessment = false;
    next.cycleSnapshot.requireSupportingEvidence = false;
    next.ratings = next.roleProfileSnapshot.requirements.map((requirement) => {
        const allowed = requirement.competency.requiredEvidenceTypes[0];
        const evidenceRequired =
            requirement.critical || requirement.evidenceRequirement === "Required";
        const evidence: AssessmentEvidence[] =
            evidenceRequired && allowed
                ? [
                      {
                          id: `test-evidence-${requirement.competencyId}`,
                          type: allowed,
                          title: "Verified test evidence",
                          reference: "test-ref",
                          description: "Valid evidence fixture",
                          addedAt: meta.changedAt,
                          addedBy: "HR Test",
                          verificationState: "Reviewed",
                          sourceContext: "Metadata or link reference",
                      },
                  ]
                : [];
        return {
            competencyId: requirement.competencyId,
            selectedLevel: 3 as const,
            selfLevel: null,
            evidence,
            assessorComments: "Test rating",
            selfComments: "",
            assessedAt: "2026-08-10",
        };
    });
    return next;
}

describe("Competency publication lifecycle", () => {
    it("publishes a brand-new Competency Draft first as v1", () => {
        const template = state().competencies[0];
        const draft = saveCompetencyRevision(
            null,
            competencyDraftInput(template, { name: "Brand New Competency" }),
            { ...meta, code: "CMP-999" },
        );
        const transition = publishCompetencyDraft([draft], draft.id, meta);
        expect(transition.published.version).toBe(1);
        expect(transition.published.versionHistory.map((item) => item.version)).toEqual([1]);
    });

    it("repeated saves of a new Competency Draft do not increment its intended official version", () => {
        const template = state().competencies[0];
        const first = saveCompetencyRevision(
            null,
            competencyDraftInput(template, { name: "Repeated Draft" }),
            { ...meta, code: "CMP-998" },
        );
        const second = saveCompetencyRevision(
            first,
            competencyDraftInput(first, { definition: "Second draft save" }),
            { ...meta, code: first.code },
        );
        const third = saveCompetencyRevision(
            second,
            competencyDraftInput(second, { definition: "Third draft save" }),
            { ...meta, code: second.code },
        );
        expect([first.version, second.version, third.version]).toEqual([1, 1, 1]);
        expect(third.versionHistory).toHaveLength(0);
        expect(publishCompetencyDraft([third], third.id, meta).published.version).toBe(1);
    });

    it("editing an Active Competency creates a separate working Draft", () => {
        const current = state();
        const source = current.competencies.find((item) => item.status === "Active")!;
        const transition = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        expect(transition.draft.id).not.toBe(source.id);
        expect(transition.draft.status).toBe("Draft");
        expect(transition.draft.draftSourceId).toBe(source.id);
        expect(transition.draft.lineageId).toBe(source.lineageId);
    });

    it("leaves the original Active Competency deeply unchanged while its Draft is edited", () => {
        const current = state();
        const source = current.competencies.find((item) => item.status === "Active")!;
        const before = structuredClone(source);
        const opened = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        saveCompetencyRevision(
            opened.draft,
            competencyDraftInput(opened.draft, { definition: "Working change only" }),
            { ...meta, code: opened.draft.code },
        );
        expect(source).toEqual(before);
    });

    it("reuses an existing working Competency Draft for the same exact source", () => {
        const current = state();
        const source = current.competencies.find((item) => item.status === "Active")!;
        const first = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        const second = ensureCompetencyWorkingDraft(first.records, source.id, meta);
        expect(second.created).toBe(false);
        expect(second.draft.id).toBe(first.draft.id);
        expect(second.records.filter((item) => item.status === "Draft" && item.lineageId === source.lineageId)).toHaveLength(1);
    });

    it("publishing a Competency Draft based on v1 creates v2", () => {
        const current = state();
        const source = current.competencies.find((item) => item.status === "Active" && item.version === 1)!;
        const opened = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        const transition = publishCompetencyDraft(opened.records, opened.draft.id, meta);
        expect(transition.published.version).toBe(2);
    });

    it("archives the exact Competency source identified by draftSourceId", () => {
        const current = state();
        const source = current.competencies.find((item) => item.status === "Active")!;
        const opened = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        const sourceLinkBeforePublish = opened.draft.draftSourceId;
        const transition = publishCompetencyDraft(opened.records, opened.draft.id, meta);
        expect(sourceLinkBeforePublish).toBe(source.id);
        expect(transition.archivedSourceId).toBe(source.id);
        expect(transition.records.find((item) => item.id === source.id)?.status).toBe("Archived");
        expect(transition.published.draftSourceId).toBeNull();
    });

    it("leaves exactly one Active Competency version in the lineage after publication", () => {
        const current = state();
        const source = current.competencies.find((item) => item.status === "Active")!;
        const opened = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        const transition = publishCompetencyDraft(opened.records, opened.draft.id, meta);
        const active = transition.records.filter(
            (item) => item.lineageId === source.lineageId && item.status === "Active",
        );
        expect(active.map((item) => item.id)).toEqual([transition.published.id]);
    });

    it("blocks publication atomically when a lineage already contains an unexpected second Active version", () => {
        const current = state();
        const source = current.competencies.find((item) => item.status === "Active")!;
        const opened = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        const duplicateActive: CompetencyDefinition = {
            ...structuredClone(source),
            id: "unexpected-active-version",
            version: source.version + 1,
        };
        const conflicted = [...opened.records, duplicateActive];
        const before = structuredClone(conflicted);
        expect(() => publishCompetencyDraft(conflicted, opened.draft.id, meta)).toThrow(/single Active source|another Active/i);
        expect(conflicted).toEqual(before);
    });

    it("preserves an old assessment's Competency definition version and indicators after a later publication", () => {
        const current = state();
        const assessment = current.assessments.find((item) => item.finalizedSnapshots.length)!;
        const captured = structuredClone(assessment.roleProfileSnapshot.requirements[0].competency);
        const source = current.competencies.find((item) => item.id === captured.id)!;
        const opened = ensureCompetencyWorkingDraft(current.competencies, source.id, meta);
        const edited = saveCompetencyRevision(
            opened.draft,
            competencyDraftInput(opened.draft, {
                behavioralIndicators: {
                    ...opened.draft.behavioralIndicators,
                    5: "Later published expert behavior",
                },
            }),
            { ...meta, code: opened.draft.code },
        );
        const records = opened.records.map((item) => (item.id === edited.id ? edited : item));
        publishCompetencyDraft(records, edited.id, meta);
        expect(assessment.roleProfileSnapshot.requirements[0].competency).toEqual(captured);
    });
});

describe("Role Profile publication lifecycle", () => {
    it("publishes a brand-new Role Profile Draft first as v1", () => {
        const current = state();
        const template = current.roleProfiles[0];
        const draft = saveRoleProfileRevision(
            null,
            roleDraftInput(template, { name: "Brand New Role Profile" }),
            current.competencies,
            meta,
        );
        const transition = publishRoleProfileDraft([draft], draft.id, current.competencies, meta);
        expect(transition.published.version).toBe(1);
        expect(transition.published.versionHistory.map((item) => item.version)).toEqual([1]);
    });

    it("repeated saves of a new Role Profile Draft remain intended for v1", () => {
        const current = state();
        const template = current.roleProfiles[0];
        const first = saveRoleProfileRevision(null, roleDraftInput(template, { name: "New Draft Role" }), current.competencies, meta);
        const second = saveRoleProfileRevision(first, roleDraftInput(first, { name: "New Draft Role Edited" }), current.competencies, meta);
        expect([first.version, second.version]).toEqual([1, 1]);
        expect(publishRoleProfileDraft([second], second.id, current.competencies, meta).published.version).toBe(1);
    });

    it("editing an Active Role Profile creates a separate working Draft", () => {
        const current = state();
        const source = current.roleProfiles.find((item) => item.status === "Active")!;
        const transition = ensureRoleProfileWorkingDraft(current.roleProfiles, source.id, current.competencies, meta);
        expect(transition.draft.id).not.toBe(source.id);
        expect(transition.draft.status).toBe("Draft");
        expect(transition.draft.draftSourceId).toBe(source.id);
    });

    it("leaves the original Active Role Profile deeply unchanged during Draft editing", () => {
        const current = state();
        const source = current.roleProfiles.find((item) => item.status === "Active")!;
        const before = structuredClone(source);
        const opened = ensureRoleProfileWorkingDraft(current.roleProfiles, source.id, current.competencies, meta);
        saveRoleProfileRevision(opened.draft, roleDraftInput(opened.draft, { name: "Working profile edit" }), current.competencies, meta);
        expect(source).toEqual(before);
    });

    it("reuses an existing Role Profile working Draft instead of creating a duplicate", () => {
        const current = state();
        const source = current.roleProfiles.find((item) => item.status === "Active")!;
        const first = ensureRoleProfileWorkingDraft(current.roleProfiles, source.id, current.competencies, meta);
        const second = ensureRoleProfileWorkingDraft(first.records, source.id, current.competencies, meta);
        expect(second.created).toBe(false);
        expect(second.draft.id).toBe(first.draft.id);
    });

    it("publishing a Role Profile Draft based on v1 creates v2 and archives the exact source", () => {
        const current = state();
        const source = current.roleProfiles.find((item) => item.status === "Active" && item.version === 1)!;
        const opened = ensureRoleProfileWorkingDraft(current.roleProfiles, source.id, current.competencies, meta);
        const transition = publishRoleProfileDraft(opened.records, opened.draft.id, current.competencies, meta);
        expect(transition.published.version).toBe(2);
        expect(transition.archivedSourceId).toBe(opened.draft.draftSourceId);
        expect(transition.records.find((item) => item.id === source.id)?.status).toBe("Archived");
        expect(transition.records.filter((item) => item.lineageId === source.lineageId && item.status === "Active")).toHaveLength(1);
    });

    it("preserves old assessment Role Profile snapshots after a later Role Profile publication", () => {
        const current = state();
        const assessment = current.assessments.find((item) => item.finalizedSnapshots.length)!;
        const before = structuredClone(assessment.roleProfileSnapshot);
        const source = current.roleProfiles.find((item) => item.id === assessment.roleProfileId)!;
        const opened = ensureRoleProfileWorkingDraft(current.roleProfiles, source.id, current.competencies, meta);
        const edited = saveRoleProfileRevision(opened.draft, roleDraftInput(opened.draft, { name: "Later Role Profile" }), current.competencies, meta);
        const records = opened.records.map((item) => (item.id === edited.id ? edited : item));
        publishRoleProfileDraft(records, edited.id, current.competencies, meta);
        expect(assessment.roleProfileSnapshot).toEqual(before);
    });
});

describe("Version-linked append-only acknowledgment", () => {
    it("acknowledging finalized v1 creates an event linked only to v1", () => {
        const assessment = finalizedAssessmentRequiringAcknowledgment();
        const v1 = assessment.finalizedSnapshots[0];
        const result = acknowledgeFinalizedAssessmentVersion([], assessment, v1.version, acknowledgmentMeta(assessment));
        expect(result.created).toBe(true);
        expect(result.event).toMatchObject({
            assessmentId: assessment.id,
            finalizedVersion: v1.version,
            personId: assessment.personId,
            eventType: "Assessment Receipt Acknowledged",
        });
    });

    it("acknowledging finalized v1 does not mutate the finalized v1 snapshot", () => {
        const assessment = finalizedAssessmentRequiringAcknowledgment();
        const before = structuredClone(assessment.finalizedSnapshots[0]);
        acknowledgeFinalizedAssessmentVersion([], assessment, before.version, acknowledgmentMeta(assessment));
        expect(assessment.finalizedSnapshots[0]).toEqual(before);
    });

    it("acknowledging v1 does not acknowledge a later finalized v2", () => {
        const assessment = finalizedAssessmentRequiringAcknowledgment();
        const v1 = structuredClone(assessment.finalizedSnapshots[0]);
        const v2 = { ...structuredClone(v1), version: v1.version + 1, finalizedAt: "2026-08-12T09:00:00+08:00" };
        assessment.finalizedSnapshots = [v1, v2];
        assessment.finalizedSnapshot = v2;
        const result = acknowledgeFinalizedAssessmentVersion([], assessment, v1.version, acknowledgmentMeta(assessment));
        expect(findAssessmentAcknowledgmentEvent(result.events, assessment.id, v1.version)).not.toBeNull();
        expect(findAssessmentAcknowledgmentEvent(result.events, assessment.id, v2.version)).toBeNull();
    });

    it("acknowledging v2 does not alter the existing v1 acknowledgment event", () => {
        const assessment = finalizedAssessmentRequiringAcknowledgment();
        const v1 = structuredClone(assessment.finalizedSnapshots[0]);
        const v2 = { ...structuredClone(v1), version: v1.version + 1, finalizedAt: "2026-08-12T09:00:00+08:00" };
        assessment.finalizedSnapshots = [v1, v2];
        assessment.finalizedSnapshot = v2;
        const first = acknowledgeFinalizedAssessmentVersion([], assessment, v1.version, acknowledgmentMeta(assessment));
        const v1EventBefore = structuredClone(first.event);
        const second = acknowledgeFinalizedAssessmentVersion(
            first.events,
            assessment,
            v2.version,
            { ...acknowledgmentMeta(assessment), acknowledgedAt: "2026-08-12T10:00:00+08:00" },
        );
        expect(findAssessmentAcknowledgmentEvent(second.events, assessment.id, v1.version)).toEqual(v1EventBefore);
        expect(findAssessmentAcknowledgmentEvent(second.events, assessment.id, v2.version)?.acknowledgedAt).toBe("2026-08-12T10:00:00+08:00");
    });

    it("handles duplicate acknowledgment for one finalized version idempotently", () => {
        const assessment = finalizedAssessmentRequiringAcknowledgment();
        const version = assessment.finalizedSnapshots[0].version;
        const first = acknowledgeFinalizedAssessmentVersion([], assessment, version, acknowledgmentMeta(assessment));
        const second = acknowledgeFinalizedAssessmentVersion(first.events, assessment, version, { ...acknowledgmentMeta(assessment), acknowledgedAt: "2026-08-13T12:00:00+08:00" });
        expect(second.created).toBe(false);
        expect(second.events).toHaveLength(1);
        expect(second.event.id).toBe(first.event.id);
        expect(second.event.acknowledgedAt).toBe(first.event.acknowledgedAt);
    });

    it("rejects acknowledgment for Cancelled and non-finalized assessments", () => {
        const assessment = finalizedAssessmentRequiringAcknowledgment();
        const version = assessment.finalizedSnapshots[0].version;
        expect(() => acknowledgeFinalizedAssessmentVersion([], { ...assessment, status: "Cancelled" }, version, acknowledgmentMeta(assessment))).toThrow(/finalized, non-cancelled/i);
        expect(() => acknowledgeFinalizedAssessmentVersion([], { ...assessment, status: "In Progress" }, version, acknowledgmentMeta(assessment))).toThrow(/finalized, non-cancelled/i);
    });

    it("reloading/migrating current state preserves finalized snapshots deeply unchanged", () => {
        const current = state();
        const before = structuredClone(current.assessments.map((item) => item.finalizedSnapshots));
        const migrated = migrateCompetencyState(current);
        expect(migrated.assessments.map((item) => item.finalizedSnapshots)).toEqual(before);
    });

    it("legacy version-linked acknowledgment migration is idempotent", () => {
        const legacy = structuredClone(state()) as CompetencyState;
        legacy.acknowledgmentEvents = [];
        const assessment = legacy.assessments.find((item) => item.finalizedSnapshots.length)!;
        assessment.finalizedSnapshots[0].employeeAcknowledgedAt = "2026-07-01T08:00:00+08:00";
        const once = migrateCompetencyState(legacy);
        const twice = migrateCompetencyState(once);
        const matching = twice.acknowledgmentEvents.filter(
            (event) => event.assessmentId === assessment.id && event.finalizedVersion === assessment.finalizedSnapshots[0].version,
        );
        expect(matching).toHaveLength(1);
        expect(twice.acknowledgmentEvents).toEqual(once.acknowledgmentEvents);
    });

    it("does not fabricate a legacy version relationship from a live-only acknowledgment", () => {
        const legacy = structuredClone(state()) as CompetencyState;
        legacy.acknowledgmentEvents = [];
        const assessment = legacy.assessments.find((item) => item.finalizedSnapshots.length)!;
        const v1 = structuredClone(assessment.finalizedSnapshots[0]);
        const v2 = { ...structuredClone(v1), version: v1.version + 1 };
        v1.employeeAcknowledgedAt = null;
        v2.employeeAcknowledgedAt = null;
        assessment.finalizedSnapshots = [v1, v2];
        assessment.finalizedSnapshot = v2;
        assessment.employeeAcknowledgedAt = "2026-08-10T12:00:00+08:00";
        const migrated = migrateCompetencyState(legacy);
        expect(migrated.acknowledgmentEvents.filter((event) => event.assessmentId === assessment.id)).toHaveLength(0);
    });
});

describe("Future-proof Manila overdue and completion calculations", () => {
    it("uses an explicit Manila reference date for overdue boundaries", () => {
        expect(
            getDisplayAssessmentStatus(
                { status: "Pending", dueDate: "2031-03-14" } as CompetencyAssessment,
                fixedManilaDate,
            ),
        ).toBe("Overdue");
        expect(
            getDisplayAssessmentStatus(
                { status: "Pending", dueDate: "2031-03-15" } as CompetencyAssessment,
                fixedManilaDate,
            ),
        ).toBe("Pending");
        expect(
            getDisplayAssessmentStatus(
                { status: "Pending", dueDate: "2031-03-16" } as CompetencyAssessment,
                fixedManilaDate,
            ),
        ).toBe("Pending");
    });

    it("does not relabel terminal or submitted statuses as Overdue", () => {
        for (const status of ["Submitted", "Pending Validation", "Finalized", "Cancelled"] as const) {
            expect(
                getDisplayAssessmentStatus(
                    { status, dueDate: "2020-01-01" } as CompetencyAssessment,
                    fixedManilaDate,
                ),
            ).toBe(status);
        }
    });

    it("filters the same controlled-time Overdue rows shown by production row building", () => {
        const current = state();
        current.assessments[0] = {
            ...current.assessments[0],
            status: "Pending",
            dueDate: "2031-03-14",
        };
        const rows = buildAssessmentRows(current, fixedManilaDate);
        const filtered = filterAssessmentRows(
            rows,
            { ...EMPTY_ANALYTICS_FILTERS, status: "Overdue" },
            current,
        );
        expect(filtered.map((row) => row.assessment.id)).toContain(current.assessments[0].id);
        expect(filtered.every((row) => row.displayStatus === "Overdue")).toBe(true);
    });

    it("excludes Cancelled assessments from both completion numerator and denominator", () => {
        const completion = calculateCycleCompletion([
            { status: "Finalized" },
            { status: "Pending" },
            { status: "Cancelled" },
        ]);
        expect(completion).toEqual({ eligible: 2, finalized: 1, cancelled: 1, rate: 50 });
    });
});

describe("Evidence and self-assessment submission validation", () => {
    it("accepts a configured evidence type and rejects an unaccepted evidence type", () => {
        const current = state();
        const source = current.assessments.find((item) =>
            item.roleProfileSnapshot.requirements.some(
                (requirement) => requirement.competency.requiredEvidenceTypes.length > 0,
            ),
        )!;
        const ready = makeSubmissionReady(source);
        const requirement = ready.roleProfileSnapshot.requirements.find(
            (item) => item.competency.requiredEvidenceTypes.length > 0,
        )!;
        const rating = ready.ratings.find((item) => item.competencyId === requirement.competencyId)!;
        const accepted = requirement.competency.requiredEvidenceTypes[0];
        rating.evidence = [
            {
                id: "accepted-evidence",
                type: accepted,
                title: "Accepted",
                reference: "accepted",
                description: "Accepted type",
                addedAt: meta.changedAt,
                addedBy: "HR Test",
                verificationState: "Reviewed",
                sourceContext: "Metadata or link reference",
            },
        ];
        expect(validateAssessmentForSubmit(ready, null).some((error) => error.includes(`${requirement.competency.name}: every evidence item`))).toBe(false);

        rating.evidence[0] = { ...rating.evidence[0], type: "Not Accepted" as AssessmentEvidence["type"] };
        expect(validateAssessmentForSubmit(ready, null)).toContain(
            `${requirement.competency.name}: every evidence item must use an accepted snapshot evidence type.`,
        );
    });

    it("requires valid evidence for a critical competency", () => {
        const source = state().assessments.find((item) =>
            item.roleProfileSnapshot.requirements.some((requirement) => requirement.critical),
        )!;
        const ready = makeSubmissionReady(source);
        const requirement = ready.roleProfileSnapshot.requirements.find((item) => item.critical)!;
        const rating = ready.ratings.find((item) => item.competencyId === requirement.competencyId)!;
        rating.evidence = [];
        expect(validateAssessmentForSubmit(ready, null)).toContain(
            `${requirement.competency.name}: supporting evidence is required.`,
        );
    });

    it("applies the cycle-wide evidence rule to an otherwise optional non-critical competency", () => {
        const source = state().assessments.find((item) =>
            item.roleProfileSnapshot.requirements.some(
                (requirement) => !requirement.critical && requirement.evidenceRequirement !== "Required",
            ),
        )!;
        const ready = makeSubmissionReady(source);
        ready.cycleSnapshot.requireSupportingEvidence = true;
        const requirement = ready.roleProfileSnapshot.requirements.find(
            (item) => !item.critical && item.evidenceRequirement !== "Required",
        )!;
        const rating = ready.ratings.find((item) => item.competencyId === requirement.competencyId)!;
        rating.evidence = [];
        expect(validateAssessmentForSubmit(ready, null)).toContain(
            `${requirement.competency.name}: supporting evidence is required.`,
        );
    });

    it("enforces required self-assessment separately from the official selected level", () => {
        const source = makeSubmissionReady(state().assessments[0]);
        source.cycleSnapshot.requireSelfAssessment = true;
        source.ratings.forEach((rating) => {
            rating.selectedLevel = 3;
            rating.selfLevel = null;
        });
        const firstRequirement = source.roleProfileSnapshot.requirements[0];
        expect(validateAssessmentForSubmit(source, null)).toContain(
            `${firstRequirement.competency.name}: the required self-assessment is missing.`,
        );
        expect(source.ratings[0].selectedLevel).toBe(3);
        expect(source.ratings[0].selfLevel).toBeNull();
    });
});

describe("Cycle population and snapshot-specific analytics", () => {
    it("validates person type, department, position, Role Profile ID, and cycle scope combinations", () => {
        const current = state();
        const assessment = current.assessments.find((item) => {
            const cycle = current.cycles.find((candidate) => candidate.id === item.cycleId);
            const person = SHARED_PERSONNEL.find((candidate) => candidate.id === item.personId);
            const profile = current.roleProfiles.find((candidate) => candidate.id === item.roleProfileId);
            return Boolean(cycle && person && profile && cyclePopulationMatches(cycle, person, profile));
        })!;
        const cycle = current.cycles.find((item) => item.id === assessment.cycleId)!;
        const person = SHARED_PERSONNEL.find((item) => item.id === assessment.personId)!;
        const profile = current.roleProfiles.find((item) => item.id === assessment.roleProfileId)!;

        expect(cyclePopulationMatches(cycle, person, profile)).toBe(true);
        expect(cyclePopulationMatches({ ...cycle, appliesTo: person.personType === "Employee" ? "Trainee" : "Employee" }, person, profile)).toBe(false);
        expect(cyclePopulationMatches({ ...cycle, departments: ["Different Department"] }, person, profile)).toBe(false);
        expect(cyclePopulationMatches({ ...cycle, positions: ["Different Position"] }, person, profile)).toBe(false);
        expect(cyclePopulationMatches({ ...cycle, roleProfileIds: [] }, person, profile)).toBe(false);
        expect(cyclePopulationMatches(cycle, person, { ...profile, appliesTo: person.personType === "Employee" ? "Trainee" : "Employee" })).toBe(false);
    });

    it("filters two distinct Role Profile snapshot versions to only the requested version", () => {
        const current = state();
        const first = structuredClone(current.assessments[0]);
        const second = structuredClone(first);
        second.id = `${first.id}-profile-v2`;
        second.roleProfileSnapshot.version = first.roleProfileSnapshot.version + 1;
        current.assessments = [first, second];
        const rows = buildAssessmentRows(current, fixedManilaDate);
        const key = roleProfileVersionKey(second);
        const filtered = filterAssessmentRows(
            rows,
            { ...EMPTY_ANALYTICS_FILTERS, roleProfileVersion: key },
            current,
        );
        expect(filtered.map((row) => row.assessment.id)).toEqual([second.id]);
        expect(filtered[0].assessment.roleProfileSnapshot.version).toBe(second.roleProfileSnapshot.version);
    });

    it("keeps multiple simultaneous active-cycle metrics aggregated correctly", () => {
        const current = state();
        const chosen = current.cycles.slice(0, 2).map((item) => item.id);
        current.cycles = current.cycles.map((cycle) =>
            chosen.includes(cycle.id) ? { ...cycle, status: "Active" as const } : cycle,
        );
        const expected = calculateCycleCompletion(
            current.assessments.filter((item) => chosen.includes(item.cycleId)),
        );
        const metrics = buildOverviewMetrics(current);
        expect(new Set(metrics.activeCycleIds)).toEqual(new Set(chosen));
        expect({ assigned: metrics.assigned, finalized: metrics.finalized, cancelled: metrics.cancelled, completionRate: metrics.completionRate }).toEqual({
            assigned: expected.eligible,
            finalized: expected.finalized,
            cancelled: expected.cancelled,
            completionRate: expected.rate,
        });
    });
});
