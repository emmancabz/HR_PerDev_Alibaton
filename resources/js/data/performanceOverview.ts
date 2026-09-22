import type { PerformanceDevelopmentStore } from './performanceDevelopment';
import type { PerformanceCycle, PerformanceGoal } from './performancePlanning';
import { getDisplayStatus } from './performanceReviews';
import {
  getAccurateRatingDistribution,
  isFinalizedRatedReview,
  type RatingDistributionPoint,
  type ResolvedPerformanceReview,
} from './performanceAnalytics';
import type { PersonnelIdentity } from './personnel';

export type CanonicalWorkforcePersona = {
  personnelKey: string;
  name: string;
  department: string;
  position: string;
  personClass: string;
  developmentStatus: string;
  promotionTrack: string;
  successionRole: string | null;
  readiness: string | null;
  performanceGoalContext?: {
    activeCycleId: string;
    goalPlanId: string | null;
    goalPlanName: string | null;
    assignmentStatus: string;
    formalProgressAuthority: string | null;
    formalProgressAuthorityStatus: string;
  } | null;
  performanceEvaluatorContext?: {
    defaultEvaluatorName: string | null;
    defaultEvaluatorPersonnelKey: string | null;
    assignmentStatus: string;
    assignmentBasis: string;
    requiresExplicitAssignment: boolean;
  } | null;
};

export type GoalStatusSummary = {
  total: number;
  weightedAverageProgress: number | null;
  completed: number;
  onTrack: number;
  atRisk: number;
  notStarted: number;
};

export type PerformanceAttentionRow = {
  person: PersonnelIdentity;
  latestReviewLabel: string;
  goalHealth: string;
  concern: string;
  intervention: string;
  status: 'Needs support' | 'Review overdue' | 'Evidence gap';
  destination: 'Reviews' | 'Performance Improvement';
};

function cycleRank(cycles: PerformanceCycle[]): Map<string, number> {
  return new Map(
    [...cycles]
      .sort((a, b) => a.performanceEndDate.localeCompare(b.performanceEndDate))
      .map((cycle, index) => [cycle.id, index]),
  );
}

export function latestFinalizedReviewRows(
  rows: ResolvedPerformanceReview[],
  cycles: PerformanceCycle[],
): ResolvedPerformanceReview[] {
  const ranks = cycleRank(cycles);
  const latest = new Map<string, ResolvedPerformanceReview>();
  rows
    .filter(({ review }) => isFinalizedRatedReview(review))
    .forEach((row) => {
      const existing = latest.get(row.person.id);
      if (!existing) {
        latest.set(row.person.id, row);
        return;
      }
      const currentRank = ranks.get(row.review.periodId) ?? -1;
      const existingRank = ranks.get(existing.review.periodId) ?? -1;
      if (currentRank > existingRank) {
        latest.set(row.person.id, row);
        return;
      }
      if (currentRank === existingRank) {
        const currentDate = row.review.finalizedAt ?? row.review.dateEvaluated ?? '';
        const existingDate = existing.review.finalizedAt ?? existing.review.dateEvaluated ?? '';
        if (currentDate.localeCompare(existingDate) > 0) latest.set(row.person.id, row);
      }
    });
  return Array.from(latest.values());
}

export function averageLatestFinalizedRating(
  rows: ResolvedPerformanceReview[],
  cycles: PerformanceCycle[],
): { average: number | null; count: number } {
  const latest = latestFinalizedReviewRows(rows, cycles);
  if (!latest.length) return { average: null, count: 0 };
  const average =
    latest.reduce((sum, row) => sum + (row.review.rating ?? 0), 0) /
    latest.length;
  return { average: Number(average.toFixed(2)), count: latest.length };
}

export function latestRatingDistribution(
  rows: ResolvedPerformanceReview[],
  cycles: PerformanceCycle[],
): { data: RatingDistributionPoint[]; total: number } {
  const latest = latestFinalizedReviewRows(rows, cycles);
  return { data: getAccurateRatingDistribution(latest), total: latest.length };
}

export function summarizeGoalHealth(goals: PerformanceGoal[]): GoalStatusSummary {
  const totalWeight = goals.reduce((sum, goal) => sum + Math.max(goal.weight, 0), 0);
  const weightedAverageProgress =
    goals.length && totalWeight > 0
      ? Math.round(
          goals.reduce(
            (sum, goal) => sum + goal.progress * Math.max(goal.weight, 0),
            0,
          ) / totalWeight,
        )
      : null;
  return {
    total: goals.length,
    weightedAverageProgress,
    completed: goals.filter((goal) => goal.status === 'Completed').length,
    onTrack: goals.filter((goal) => goal.status === 'On Track').length,
    atRisk: goals.filter((goal) => goal.status === 'At Risk').length,
    notStarted: goals.filter((goal) => goal.status === 'Not Started').length,
  };
}

function latestFinalizedByPerson(
  rows: ResolvedPerformanceReview[],
  cycles: PerformanceCycle[],
): Map<string, ResolvedPerformanceReview> {
  return new Map(
    latestFinalizedReviewRows(rows, cycles).map((row) => [row.person.id, row]),
  );
}

function activeReviewByPerson(
  rows: ResolvedPerformanceReview[],
  activeCycleId?: string,
): Map<string, ResolvedPerformanceReview> {
  const map = new Map<string, ResolvedPerformanceReview>();
  if (!activeCycleId) return map;
  rows
    .filter(({ review }) => review.periodId === activeCycleId)
    .forEach((row) => map.set(row.person.id, row));
  return map;
}

function goalHealthForPerson(goals: PerformanceGoal[], personId: string): string {
  const own = goals.filter((goal) => goal.personId === personId);
  if (!own.length) return 'No active goals';
  const atRisk = own.filter((goal) => goal.status === 'At Risk').length;
  const onTrack = own.filter((goal) => goal.status === 'On Track').length;
  const completed = own.filter((goal) => goal.status === 'Completed').length;
  if (atRisk) return `${atRisk} at risk${onTrack ? ` · ${onTrack} on track` : ''}`;
  if (onTrack) return `${onTrack} on track${completed ? ` · ${completed} completed` : ''}`;
  if (completed) return `${completed} completed`;
  return `${own.length} not started`;
}

function reviewLabel(
  row: ResolvedPerformanceReview | undefined,
  cycles: PerformanceCycle[],
): string {
  if (!row) return 'No active review';
  const cycle = cycles.find((candidate) => candidate.id === row.review.periodId);
  const status = getDisplayStatus(row.review);
  return `${cycle?.cycleName ?? 'Performance review'} · ${status}`;
}

export function buildPerformanceAttentionQueue(options: {
  rows: ResolvedPerformanceReview[];
  goals: PerformanceGoal[];
  development: PerformanceDevelopmentStore;
  cycles: PerformanceCycle[];
  activeCycleId?: string;
  personnel: PersonnelIdentity[];
  workforcePersonas: CanonicalWorkforcePersona[];
}): PerformanceAttentionRow[] {
  const {
    rows,
    goals,
    development,
    cycles,
    activeCycleId,
    personnel,
    workforcePersonas,
  } = options;
  const activeGoals = activeCycleId
    ? goals.filter((goal) => goal.cycleId === activeCycleId)
    : goals;
  const latestFinalized = latestFinalizedByPerson(rows, cycles);
  const activeReviews = activeReviewByPerson(rows, activeCycleId);
  const personaByKey = new Map(
    workforcePersonas.map((persona) => [persona.personnelKey, persona]),
  );
  const result = new Map<string, PerformanceAttentionRow & { priority: number }>();

  const upsert = (
    person: PersonnelIdentity,
    row: Omit<PerformanceAttentionRow, 'person' | 'latestReviewLabel' | 'goalHealth'>,
    priority: number,
  ) => {
    const current = result.get(person.id);
    if (current && current.priority >= priority) return;
    result.set(person.id, {
      person,
      latestReviewLabel: reviewLabel(activeReviews.get(person.id), cycles),
      goalHealth: goalHealthForPerson(activeGoals, person.id),
      ...row,
      priority,
    });
  };

  development.pips
    .filter((pip) => pip.status !== 'Completed')
    .forEach((pip) => {
      const person = personnel.find((candidate) => candidate.id === pip.personId);
      if (!person) return;
      const action = pip.developmentActions.find((item) => item.status !== 'Completed');
      upsert(
        person,
        {
          concern: pip.performanceConcern,
          intervention: action
            ? `${action.source}: ${action.title}`
            : pip.expectedImprovement,
          status: 'Needs support',
          destination: 'Performance Improvement',
        },
        100,
      );
    });

  activeGoals
    .filter((goal) => goal.status === 'At Risk')
    .forEach((goal) => {
      const person = personnel.find((candidate) => candidate.id === goal.personId);
      if (!person) return;
      upsert(
        person,
        {
          concern: `${goal.title} is at risk`,
          intervention: 'Supervisor review and documented development follow-through',
          status: 'Needs support',
          destination: 'Reviews',
        },
        90,
      );
    });

  latestFinalized.forEach((row, personId) => {
    const recommendation = row.review.developmentRecommendations?.find(
      (item) => item !== 'No immediate intervention',
    );
    if ((row.review.rating ?? 5) >= 3 && !recommendation) return;
    upsert(
      row.person,
      {
        concern:
          (row.review.rating ?? 5) < 3
            ? `Latest finalized rating: ${(row.review.rating ?? 0).toFixed(2)} / 5`
            : recommendation ?? 'Finalized review requires follow-through',
        intervention: recommendation ?? 'Human-managed performance support required',
        status: 'Needs support',
        destination: 'Reviews',
      },
      80,
    );
  });

  activeReviews.forEach((row) => {
    if (getDisplayStatus(row.review) !== 'Overdue') return;
    upsert(
      row.person,
      {
        concern: 'Active-cycle review is overdue',
        intervention: 'Complete the governed review workflow; do not infer a rating from missing evidence',
        status: 'Review overdue',
        destination: 'Reviews',
      },
      50,
    );
  });

  personnel.forEach((person) => {
    const persona = personaByKey.get(person.id);
    if (!persona) return;
    const activePipeline =
      persona.readiness === 'Ready Now' || persona.readiness === 'Ready Soon';
    if (!activePipeline || latestFinalized.has(person.id)) return;
    upsert(
      person,
      {
        concern: `No finalized Performance evidence for ${persona.readiness} succession context`,
        intervention: 'Finalize a governed Performance review before the readiness evidence is relied on',
        status: 'Evidence gap',
        destination: 'Reviews',
      },
      60,
    );
  });

  return Array.from(result.values())
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.person.fullName.localeCompare(b.person.fullName),
    )
    .map(({ priority: _priority, ...row }) => row);
}

export function countEmployeesNeedingSupport(rows: PerformanceAttentionRow[]): number {
  return rows.filter((row) => row.status === 'Needs support').length;
}
