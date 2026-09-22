import {
  SHARED_PERSONNEL,
  getPersonById,
  type PersonType,
  type PersonnelIdentity,
} from "./personnel";
import {
  PERFORMANCE_CYCLES,
  getActivePerformanceCycle,
  isCycleApplicableToPerson,
  type PerformanceCycle,
  type PerformanceCycleStatus,
} from "./performancePlanning";
export type EvaluationPeriod = PerformanceCycle;
export type EvaluationPeriodStatus = PerformanceCycleStatus;
export const EVALUATION_PERIODS: EvaluationPeriod[] = PERFORMANCE_CYCLES;
export type ReportingRelationship = {
  id: string;
  supervisorId: string;
  directReportId: string;
  source: "HR1" | "Manual";
  active: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  createdAt: string;
};
export const REPORTING_RELATIONSHIPS: ReportingRelationship[] = [
  {
    id: "report-crane-1",
    supervisorId: "user-gen-8",
    directReportId: "user-gen-0",
    source: "HR1",
    active: true,
    effectiveFrom: "2026-01-01",
    createdBy: "HR1 sync",
    createdAt: "2026-01-01T08:00:00+08:00",
  },
  {
    id: "report-logistics-1",
    supervisorId: "user-gen-9",
    directReportId: "user-gen-1",
    source: "HR1",
    active: true,
    effectiveFrom: "2026-01-01",
    createdBy: "HR1 sync",
    createdAt: "2026-01-01T08:00:00+08:00",
  },
  {
    id: "report-operations-1",
    supervisorId: "user-gen-10",
    directReportId: "user-gen-2",
    source: "HR1",
    active: true,
    effectiveFrom: "2026-01-01",
    createdBy: "HR1 sync",
    createdAt: "2026-01-01T08:00:00+08:00",
  },
  {
    id: "report-operations-trainee",
    supervisorId: "user-gen-10",
    directReportId: "user-6",
    source: "HR1",
    active: true,
    effectiveFrom: "2026-07-01",
    createdBy: "HR1 sync",
    createdAt: "2026-07-01T08:00:00+08:00",
  },
  {
    id: "report-finance-1",
    supervisorId: "user-gen-11",
    directReportId: "user-5",
    source: "HR1",
    active: true,
    effectiveFrom: "2026-01-01",
    createdBy: "HR1 sync",
    createdAt: "2026-01-01T08:00:00+08:00",
  },
  {
    id: "report-finance-2",
    supervisorId: "user-gen-11",
    directReportId: "user-gen-3",
    source: "HR1",
    active: true,
    effectiveFrom: "2026-01-01",
    createdBy: "HR1 sync",
    createdAt: "2026-01-01T08:00:00+08:00",
  },
  {
    id: "report-safety-1",
    supervisorId: "user-gen-13",
    directReportId: "user-8",
    source: "HR1",
    active: true,
    effectiveFrom: "2026-01-01",
    createdBy: "HR1 sync",
    createdAt: "2026-01-01T08:00:00+08:00",
  },
];

export type AssignmentScopeType =
  "Reporting Relationship" | "Specific Person" | "Department";
export type AssignmentBasis =
  "Reporting Relationship" | "Cycle Assignment" | "Exception";
export type EvaluatorAssignmentScope =
  "Entire Performance Cycle" | "Formal Review Only";

export type EvaluatorAssignment = {
  id: string;
  evaluatorId: string;
  reviewEvaluatorId?: string;
  goalEvaluatorId?: string;
  assignmentScope?: EvaluatorAssignmentScope;
  scopeType: AssignmentScopeType;
  department?: string;
  personId?: string;
  isPrimaryEvaluator: boolean;
  cycleIds?: string[];
  /** @deprecated */
  periodIds?: string[];
  basis?: AssignmentBasis;
  reportingRelationshipId?: string;
  createdBy: string;
  createdAt: string;
};
export const EVALUATOR_ASSIGNMENTS: EvaluatorAssignment[] =
  REPORTING_RELATIONSHIPS.map((relationship) => ({
    id: `assignment-${relationship.id}`,
    evaluatorId: relationship.supervisorId,
    scopeType: "Reporting Relationship" as const,
    personId: relationship.directReportId,
    isPrimaryEvaluator: true,
    basis: "Reporting Relationship" as const,
    reportingRelationshipId: relationship.id,
    createdBy: relationship.createdBy,
    createdAt: relationship.createdAt,
  }));
export const EVALUATOR_POOL: string[] = Array.from(
  new Set(EVALUATOR_ASSIGNMENTS.map((assignment) => assignment.evaluatorId)),
);
export type ReassignmentMetadata = {
  fromEvaluatorId: string;
  toEvaluatorId: string;
  reason: string;
  actor: string;
  timestamp: string;
};
export type RevisionMetadata = {
  reason: string;
  actor: string;
  timestamp: string;
  notes?: string;
};
export type HrOversightScope = {
  id: string;
  hrPersonId: string;
  department?: string;
  periodIds?: string[];
  active: boolean;
};
export const HR_OVERSIGHT_SCOPES: HrOversightScope[] = [];
export type AnonymousMultiRaterConfiguration = {
  subjectId: string;
  authorizedEvaluatorIds: string[];
  periodIds?: string[];
  active: boolean;
};
export const ANONYMOUS_MULTI_RATER_CONFIGURATIONS: AnonymousMultiRaterConfiguration[] =
  [];
export type OfficialReviewSpecialHandlingConfiguration = {
  id: string;
  subjectId: string;
  designation: "HR Head" | "Authorized HR Officer";
  primaryEvaluatorId: string;
  cycleIds?: string[];
  allowAnonymousUpwardFeedback: boolean;
  active: boolean;
  createdBy: string;
  createdAt: string;
};
export const OFFICIAL_REVIEW_SPECIAL_HANDLING_CONFIGURATIONS: OfficialReviewSpecialHandlingConfiguration[] =
  [];
export type EvaluationAuthorityContext = {
  cycleId?: string;
  /** @deprecated */
  periodId?: string;
  assignments?: EvaluatorAssignment[];
  periods?: EvaluationPeriod[];
  personnel?: PersonnelIdentity[];
  specialHandlingConfigurations?: OfficialReviewSpecialHandlingConfiguration[];
  requireActivePeriod?: boolean;
};
export function getOfficialReviewSpecialHandling(
  subjectId: string,
  cycleId?: string,
  configurations: OfficialReviewSpecialHandlingConfiguration[] = OFFICIAL_REVIEW_SPECIAL_HANDLING_CONFIGURATIONS,
): OfficialReviewSpecialHandlingConfiguration | undefined {
  return configurations.find(
    (configuration) =>
      configuration.active &&
      configuration.subjectId === subjectId &&
      (!cycleId ||
        !configuration.cycleIds?.length ||
        configuration.cycleIds.includes(cycleId)),
  );
}
function assignmentAppliesToPeriod(
  assignment: EvaluatorAssignment,
  periodId?: string,
): boolean {
  const cycleIds = assignment.cycleIds ?? assignment.periodIds;
  if (!periodId || !cycleIds?.length) return true;
  return cycleIds.includes(periodId);
}
export function isPeriodApplicableToPerson(
  period: EvaluationPeriod,
  person: PersonnelIdentity,
): boolean {
  return isCycleApplicableToPerson(period, person);
}
export function getActiveEvaluationPeriod(
  periods: EvaluationPeriod[] = EVALUATION_PERIODS,
): EvaluationPeriod | undefined {
  return getActivePerformanceCycle(periods);
}
export function getMatchingPrimaryAssignment(
  evaluatorId: string,
  personId: string,
  context: EvaluationAuthorityContext = {},
): EvaluatorAssignment | undefined {
  const assignments = context.assignments ?? EVALUATOR_ASSIGNMENTS;
  const personnel = context.personnel ?? SHARED_PERSONNEL;
  const evaluator = personnel.find((person) => person.id === evaluatorId);
  const person = personnel.find((candidate) => candidate.id === personId);
  if (
    !evaluator ||
    !person ||
    evaluator.id === person.id ||
    person.employmentStatus === "Inactive"
  ) {
    return undefined;
  }
  const cycleId = context.cycleId ?? context.periodId;
  if (cycleId) {
    const period = (context.periods ?? EVALUATION_PERIODS).find(
      (candidate) => candidate.id === cycleId,
    );
    if (
      !period ||
      (context.requireActivePeriod !== false && period.status !== "Active") ||
      !isPeriodApplicableToPerson(period, person)
    ) {
      return undefined;
    }
  }
  const specialHandling = getOfficialReviewSpecialHandling(
    person.id,
    cycleId,
    context.specialHandlingConfigurations,
  );
  if (specialHandling) {
    if (specialHandling.primaryEvaluatorId !== evaluator.id) return undefined;
    return {
      id: `special-official-${specialHandling.id}`,
      evaluatorId: evaluator.id,
      scopeType: "Specific Person",
      personId: person.id,
      isPrimaryEvaluator: true,
      cycleIds: specialHandling.cycleIds,
      basis: "Exception",
      createdBy: specialHandling.createdBy,
      createdAt: specialHandling.createdAt,
    };
  }
  const applicable = assignments.filter(
    (assignment) =>
      assignment.isPrimaryEvaluator &&
      assignmentAppliesToPeriod(assignment, cycleId),
  );
  const personAssignments = applicable.filter(
    (assignment) =>
      (assignment.scopeType === "Specific Person" ||
        assignment.scopeType === "Reporting Relationship") &&
      assignment.personId === person.id,
  );
  if (personAssignments.length > 0) {
    return personAssignments.find(
      (assignment) => assignment.evaluatorId === evaluator.id,
    );
  }
  return applicable.find(
    (assignment) =>
      assignment.scopeType === "Department" &&
      assignment.evaluatorId === evaluator.id &&
      assignment.department === person.department,
  );
}

export function canEvaluate(
  evaluatorId: string,
  personId: string,
  context: EvaluationAuthorityContext = {},
): boolean {
  return !!getMatchingPrimaryAssignment(evaluatorId, personId, context);
}

export function getEligiblePeopleForEvaluator(
  evaluatorId: string,
  context: EvaluationAuthorityContext = {},
): PersonnelIdentity[] {
  const personnel = context.personnel ?? SHARED_PERSONNEL;
  return personnel.filter((person) =>
    canEvaluate(evaluatorId, person.id, { ...context, personnel }),
  );
}

export function getEvaluatorScopeLabels(
  evaluatorId: string,
  assignments: EvaluatorAssignment[] = EVALUATOR_ASSIGNMENTS,
  personnel: PersonnelIdentity[] = SHARED_PERSONNEL,
): string[] {
  return assignments
    .filter(
      (assignment) =>
        assignment.evaluatorId === evaluatorId && assignment.isPrimaryEvaluator,
    )
    .map((assignment) => {
      if (assignment.scopeType === "Department") {
        return `Department exception: ${assignment.department ?? "Unspecified"}`;
      }
      const person = personnel.find(
        (candidate) => candidate.id === assignment.personId,
      );
      return `${assignment.scopeType === "Reporting Relationship" ? "Direct report" : "Exception"}: ${person?.fullName ?? "Unknown person"}`;
    });
}

export function hasPrimaryAssignmentConflict(
  candidate: EvaluatorAssignment,
  assignments: EvaluatorAssignment[] = EVALUATOR_ASSIGNMENTS,
): boolean {
  return assignments.some((assignment) => {
    if (!assignment.isPrimaryEvaluator || assignment.id === candidate.id)
      return false;
    const existingCycleIds = assignment.cycleIds ?? assignment.periodIds;
    const candidateCycleIds = candidate.cycleIds ?? candidate.periodIds;
    const periodsOverlap =
      !existingCycleIds?.length ||
      !candidateCycleIds?.length ||
      existingCycleIds.some((cycleId) => candidateCycleIds.includes(cycleId));
    if (!periodsOverlap) return false;

    const candidateIsPerson = candidate.scopeType !== "Department";
    const assignmentIsPerson = assignment.scopeType !== "Department";
    if (candidateIsPerson) {
      return assignmentIsPerson && assignment.personId === candidate.personId;
    }
    return (
      assignment.scopeType === "Department" &&
      assignment.department === candidate.department
    );
  });
}

export type PreparedCycleReviewAssignment = {
  cycleId: string;
  personId: string;
  evaluatorId: string;
  personType: PersonType;
  sourceAssignmentId: string;
  basis: AssignmentBasis;
};

/**
 * Creates a deterministic frontend preview of the one-primary-evaluator
 * assignments that a cycle can derive. It does not persist reviews and does
 * not grant authority beyond the reporting/exception assignments supplied.
 */
export function prepareCycleReviewAssignments(
  cycle: EvaluationPeriod,
  assignments: EvaluatorAssignment[] = EVALUATOR_ASSIGNMENTS,
  personnel: PersonnelIdentity[] = SHARED_PERSONNEL,
): PreparedCycleReviewAssignment[] {
  const evaluatorIds = Array.from(
    new Set(
      assignments
        .filter((assignment) => assignment.isPrimaryEvaluator)
        .map((assignment) => assignment.evaluatorId),
    ),
  );

  return personnel
    .filter(
      (person) =>
        person.employmentStatus !== "Inactive" &&
        isCycleApplicableToPerson(cycle, person),
    )
    .map((person) => {
      const matches = evaluatorIds
        .map((evaluatorId) =>
          getMatchingPrimaryAssignment(evaluatorId, person.id, {
            cycleId: cycle.id,
            periods: [cycle],
            assignments,
            personnel,
            requireActivePeriod: false,
          }),
        )
        .filter(
          (assignment): assignment is EvaluatorAssignment => !!assignment,
        );
      const source = matches[0];
      if (!source) return null;
      return {
        cycleId: cycle.id,
        personId: person.id,
        evaluatorId: source.evaluatorId,
        personType: person.personType,
        sourceAssignmentId: source.id,
        basis: source.basis ?? "Cycle Assignment",
      };
    })
    .filter(
      (assignment): assignment is PreparedCycleReviewAssignment =>
        assignment !== null,
    );
}

export function isAnonymousMultiRaterSubject(
  subjectId: string,
  periodId?: string,
  configurations: AnonymousMultiRaterConfiguration[] = ANONYMOUS_MULTI_RATER_CONFIGURATIONS,
): boolean {
  return configurations.some(
    (configuration) =>
      configuration.active &&
      configuration.subjectId === subjectId &&
      (!periodId ||
        !configuration.periodIds?.length ||
        configuration.periodIds.includes(periodId)),
  );
}

export function canSubmitAnonymousEvaluation(
  evaluatorId: string,
  subjectId: string,
  periodId?: string,
  configurations: AnonymousMultiRaterConfiguration[] = ANONYMOUS_MULTI_RATER_CONFIGURATIONS,
): boolean {
  if (
    evaluatorId === subjectId ||
    !getPersonById(evaluatorId) ||
    !getPersonById(subjectId)
  )
    return false;
  return configurations.some(
    (configuration) =>
      configuration.active &&
      configuration.subjectId === subjectId &&
      configuration.authorizedEvaluatorIds.includes(evaluatorId) &&
      (!periodId ||
        !configuration.periodIds?.length ||
        configuration.periodIds.includes(periodId)),
  );
}