import { getDisplayStatus, type PerformanceReview } from "./performanceReviews";
import {
  DEFAULT_RATING_SCALE,
  type PerformanceCycle,
  type PerformanceGoal,
  type RatingScale,
} from "./performancePlanning";
import type {
  PerformanceDevelopmentStore,
  PerformanceImprovementPlan,
} from "./performanceDevelopment";
import type { PersonType, PersonnelIdentity } from "./personnel";

export const ALL_ANALYTICS_CYCLES = "All Cycles" as const;
export const ALL_ANALYTICS_DEPARTMENTS = "All Departments" as const;
export const ALL_ANALYTICS_PERSON_TYPES = "All Person Types" as const;
export const ALL_ANALYTICS_TEMPLATES = "All Templates" as const;
export const ALL_ANALYTICS_EVALUATORS = "All Evaluators" as const;

export type PerformanceAnalyticsFilters = {
  cycleId: string;
  department: string;
  personType: PersonType | typeof ALL_ANALYTICS_PERSON_TYPES;
  reviewTemplateId: string;
  evaluatorId: string;
};

export type ResolvedPerformanceReview = {
  review: PerformanceReview;
  person: PersonnelIdentity;
  evaluator?: PersonnelIdentity;
};

export type ReviewCompletionAnalytics = {
  assigned: number;
  finalized: number;
  calibrationPending: number;
  inProgress: number;
  pending: number;
  overdue: number;
  completionRate: number;
};

export type RatingDistributionPoint = {
  value: number;
  label: string;
  count: number;
  percentage: number;
  color: string;
};

export type ComparableTopResults = {
  rows: ResolvedPerformanceReview[];
  comparable: boolean;
  comparisonBasis: string;
  message?: string;
};

export type PerformanceSupportRow = {
  review: PerformanceReview;
  person: PersonnelIdentity;
  rating: number;
  identifiedDevelopmentNeed: string;
  activeIntervention: string;
  pipStatus: string;
  linkedAction: string;
};

export type GoalTrendPoint = {
  cycleId: string;
  cycleName: string;
  goalCount: number;
  averageProgress: number | null;
  completedRate: number;
  atRiskCount: number;
};

export type DepartmentTrendRow = {
  department: string;
  assigned: number;
  finalized: number;
  completionRate: number;
  normalizedAverageRating: number | null;
  averageGoalProgress: number | null;
  needsSupport: number;
  openPips: number;
  templateCount: number;
};

export type EvaluatorCalibrationRow = {
  evaluatorId: string;
  evaluatorName: string;
  team: string;
  assigned: number;
  finalized: number;
  averageRating: number | null;
  organizationAverage: number | null;
  deviation: number | null;
  ratingSpread: number | null;
  returnedForRevision: number;
  signal:
    | "Insufficient sample"
    | "Within expected range"
    | "Review high pattern"
    | "Review low pattern";
};

const RATING_COLORS = ["#dc2626", "#f97316", "#F4B400", "#3b82f6", "#16a34a"];

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isValidRating(rating: number | null): rating is number {
  return (
    typeof rating === "number" &&
    Number.isFinite(rating) &&
    rating >= 1 &&
    rating <= 5
  );
}

export function isFinalizedRatedReview(review: PerformanceReview): boolean {
  return isFinalizedReview(review) && isValidRating(review.rating);
}

export function isFinalizedReview(review: PerformanceReview): boolean {
  return (
    review.status === "Completed" &&
    (review.workflowState === undefined || review.workflowState === "Finalized")
  );
}

export function applyPerformanceAnalyticsFilters(
  rows: ResolvedPerformanceReview[],
  filters: PerformanceAnalyticsFilters,
): ResolvedPerformanceReview[] {
  return rows.filter(({ review, person }) => {
    return (
      (filters.cycleId === ALL_ANALYTICS_CYCLES ||
        review.periodId === filters.cycleId) &&
      (filters.department === ALL_ANALYTICS_DEPARTMENTS ||
        person.department === filters.department) &&
      (filters.personType === ALL_ANALYTICS_PERSON_TYPES ||
        person.personType === filters.personType) &&
      (filters.reviewTemplateId === ALL_ANALYTICS_TEMPLATES ||
        review.reviewTemplateId === filters.reviewTemplateId) &&
      (filters.evaluatorId === ALL_ANALYTICS_EVALUATORS ||
        review.evaluatorId === filters.evaluatorId)
    );
  });
}

export function getReviewCompletionAnalytics(
  rows: ResolvedPerformanceReview[],
): ReviewCompletionAnalytics {
  const finalized = rows.filter(({ review }) =>
    isFinalizedReview(review),
  ).length;
  const calibrationPending = rows.filter(
    ({ review }) =>
      review.status !== "Completed" &&
      !!review.managerSubmittedAt &&
      (review.workflowState === "Calibration Pending" ||
        review.workflowState === "Calibration In Review"),
  ).length;
  const inProgress = rows.filter(
    ({ review }) =>
      review.status === "In Progress" && !review.managerSubmittedAt,
  ).length;
  const pending = rows.filter(
    ({ review }) =>
      review.status === "Pending" && getDisplayStatus(review) !== "Overdue",
  ).length;
  const overdue = rows.filter(
    ({ review }) => getDisplayStatus(review) === "Overdue",
  ).length;
  return {
    assigned: rows.length,
    finalized,
    calibrationPending,
    inProgress,
    pending,
    overdue,
    completionRate: rows.length ? round((finalized / rows.length) * 100, 0) : 0,
  };
}

function nearestScaleValue(rating: number, scale: RatingScale): number {
  return scale.levels.reduce(
    (nearest, level) =>
      Math.abs(level.value - rating) <= Math.abs(nearest - rating)
        ? level.value
        : nearest,
    scale.levels[0]?.value ?? 1,
  );
}

export function getAccurateRatingDistribution(
  rows: ResolvedPerformanceReview[],
  scale: RatingScale = DEFAULT_RATING_SCALE,
): RatingDistributionPoint[] {
  const finalized = rows.filter(({ review }) => isFinalizedRatedReview(review));
  return [...scale.levels]
    .sort((a, b) => b.value - a.value)
    .map((level) => {
      const count = finalized.filter(
        ({ review }) =>
          nearestScaleValue(review.rating as number, scale) === level.value,
      ).length;
      return {
        value: level.value,
        label: `${level.value} — ${level.label}`,
        count,
        percentage: finalized.length
          ? round((count / finalized.length) * 100, 0)
          : 0,
        color: RATING_COLORS[level.value - 1] ?? "#64748b",
      };
    });
}
export function getComparableTopPerformanceResults(
  rows: ResolvedPerformanceReview[],
  filters: PerformanceAnalyticsFilters,
  cycles: PerformanceCycle[],
  limit = 5,
): ComparableTopResults {
  const finalized = rows.filter(({ review }) => isFinalizedRatedReview(review));
  if (filters.cycleId === ALL_ANALYTICS_CYCLES) {
    return {
      rows: [],
      comparable: false,
      comparisonBasis: "No single cycle selected",
      message:
        "Select one Performance Cycle before comparing Top Performance Results.",
    };
  }
  const templateIds = new Set(
    finalized.map(
      ({ review, person }) =>
        review.reviewTemplateId ?? `legacy-${person.personType}`,
    ),
  );
  if (
    filters.reviewTemplateId === ALL_ANALYTICS_TEMPLATES &&
    templateIds.size > 1
  ) {
    return {
      rows: [],
      comparable: false,
      comparisonBasis: "Multiple review templates",
      message:
        "Select one review template so ranked results remain comparable.",
    };
  }
  const cycle = cycles.find((candidate) => candidate.id === filters.cycleId);
  const comparisonBasis = [
    cycle?.cycleName ?? filters.cycleId,
    filters.department,
    filters.reviewTemplateId,
  ]
    .filter(
      (value) =>
        value !== ALL_ANALYTICS_DEPARTMENTS &&
        value !== ALL_ANALYTICS_TEMPLATES,
    )
    .join(" · ");
  return {
    rows: [...finalized]
      .sort((a, b) => (b.review.rating as number) - (a.review.rating as number))
      .slice(0, limit),
    comparable: true,
    comparisonBasis: comparisonBasis || "Selected comparable scope",
  };
}

function latestReviewPerPerson(
  rows: ResolvedPerformanceReview[],
  cycles: PerformanceCycle[],
): ResolvedPerformanceReview[] {
  const cycleOrder = new Map(
    [...cycles]
      .sort((a, b) => a.performanceEndDate.localeCompare(b.performanceEndDate))
      .map((cycle, index) => [cycle.id, index]),
  );
  const latest = new Map<string, ResolvedPerformanceReview>();
  rows.forEach((row) => {
    const existing = latest.get(row.person.id);
    const currentOrder = cycleOrder.get(row.review.periodId) ?? -1;
    const existingOrder = existing
      ? (cycleOrder.get(existing.review.periodId) ?? -1)
      : -2;
    if (!existing || currentOrder >= existingOrder)
      latest.set(row.person.id, row);
  });
  return Array.from(latest.values());
}

function firstOpenPip(
  personId: string,
  pips: PerformanceImprovementPlan[],
): PerformanceImprovementPlan | undefined {
  return pips.find(
    (pip) => pip.personId === personId && pip.status !== "Completed",
  );
}

export function getNeedsPerformanceSupport(
  rows: ResolvedPerformanceReview[],
  goals: PerformanceGoal[],
  developmentStore: PerformanceDevelopmentStore,
  cycles: PerformanceCycle[],
): PerformanceSupportRow[] {
  const finalized = latestReviewPerPerson(
    rows.filter(({ review }) => isFinalizedRatedReview(review)),
    cycles,
  );
  return finalized
    .map(({ review, person }) => {
      const pip = firstOpenPip(person.id, developmentStore.pips);
      const atRiskGoal = goals.find(
        (goal) =>
          goal.personId === person.id &&
          goal.cycleId === review.periodId &&
          goal.status === "At Risk",
      );
      const recommendation = review.developmentRecommendations?.find(
        (item) => item !== "No immediate intervention",
      );
      const needsSupport =
        (review.rating as number) < 3 ||
        !!pip ||
        !!atRiskGoal ||
        !!recommendation;
      if (!needsSupport) return null;
      const linkedDevelopmentAction = pip?.developmentActions.find(
        (action) => action.status !== "Completed",
      );
      return {
        review,
        person,
        rating: review.rating as number,
        identifiedDevelopmentNeed:
          pip?.performanceConcern ??
          (atRiskGoal ? `${atRiskGoal.title} is at risk` : undefined) ??
          recommendation ??
          "Final rating requires focused development discussion",
        activeIntervention:
          pip?.expectedImprovement ?? recommendation ?? "Human review required",
        pipStatus: pip?.status ?? "No active PIP",
        linkedAction: linkedDevelopmentAction
          ? `${linkedDevelopmentAction.source}: ${linkedDevelopmentAction.title}`
          : (recommendation ?? "No linked action yet"),
      };
    })
    .filter((row): row is PerformanceSupportRow => row !== null)
    .sort((a, b) => a.rating - b.rating);
}

function filteredGoals(
  goals: PerformanceGoal[],
  personnel: PersonnelIdentity[],
  filters: PerformanceAnalyticsFilters,
): PerformanceGoal[] {
  return goals.filter((goal) => {
    const person = personnel.find(
      (candidate) => candidate.id === goal.personId,
    );
    return (
      !!person &&
      (filters.cycleId === ALL_ANALYTICS_CYCLES ||
        goal.cycleId === filters.cycleId) &&
      (filters.department === ALL_ANALYTICS_DEPARTMENTS ||
        person.department === filters.department) &&
      (filters.personType === ALL_ANALYTICS_PERSON_TYPES ||
        person.personType === filters.personType)
    );
  });
}

function weightedGoalProgress(goals: PerformanceGoal[]): number | null {
  const totalWeight = goals.reduce((sum, goal) => sum + goal.weight, 0);
  if (!goals.length || totalWeight <= 0) return null;
  return round(
    goals.reduce((sum, goal) => sum + goal.progress * goal.weight, 0) /
      totalWeight,
    0,
  );
}

export function getGoalTrendAnalytics(
  goals: PerformanceGoal[],
  personnel: PersonnelIdentity[],
  cycles: PerformanceCycle[],
  filters: PerformanceAnalyticsFilters,
): GoalTrendPoint[] {
  const scopedGoals = filteredGoals(goals, personnel, {
    ...filters,
    cycleId: ALL_ANALYTICS_CYCLES,
  });
  return [...cycles]
    .sort((a, b) => a.performanceEndDate.localeCompare(b.performanceEndDate))
    .map((cycle) => {
      const cycleGoals = scopedGoals.filter(
        (goal) => goal.cycleId === cycle.id,
      );
      return {
        cycleId: cycle.id,
        cycleName: cycle.cycleName,
        goalCount: cycleGoals.length,
        averageProgress: weightedGoalProgress(cycleGoals),
        completedRate: cycleGoals.length
          ? round(
              (cycleGoals.filter((goal) => goal.status === "Completed").length /
                cycleGoals.length) *
                100,
              0,
            )
          : 0,
        atRiskCount: cycleGoals.filter((goal) => goal.status === "At Risk")
          .length,
      };
    })
    .filter((point) => point.goalCount > 0);
}

export function getDepartmentTrendAnalytics(
  allRows: ResolvedPerformanceReview[],
  goals: PerformanceGoal[],
  personnel: PersonnelIdentity[],
  developmentStore: PerformanceDevelopmentStore,
  cycles: PerformanceCycle[],
  filters: PerformanceAnalyticsFilters,
): DepartmentTrendRow[] {
  const departmentNames = Array.from(
    new Set(
      personnel
        .filter(
          (person) =>
            filters.personType === ALL_ANALYTICS_PERSON_TYPES ||
            person.personType === filters.personType,
        )
        .map((person) => person.department),
    ),
  ).sort();

  return departmentNames
    .map((department) => {
      const departmentFilters = { ...filters, department };
      const rows = applyPerformanceAnalyticsFilters(allRows, departmentFilters);
      const finalizedReviews = rows.filter(({ review }) =>
        isFinalizedReview(review),
      );
      const finalized = rows.filter(({ review }) =>
        isFinalizedRatedReview(review),
      );
      const departmentGoals = filteredGoals(
        goals,
        personnel,
        departmentFilters,
      );
      const support = getNeedsPerformanceSupport(
        rows,
        departmentGoals,
        developmentStore,
        cycles,
      );
      const averageRating = finalized.length
        ? finalized.reduce(
            (sum, row) => sum + (row.review.rating as number),
            0,
          ) / finalized.length
        : null;
      return {
        department,
        assigned: rows.length,
        finalized: finalizedReviews.length,
        completionRate: rows.length
          ? round((finalizedReviews.length / rows.length) * 100, 0)
          : 0,
        normalizedAverageRating:
          averageRating === null ? null : round((averageRating / 5) * 100, 0),
        averageGoalProgress: weightedGoalProgress(departmentGoals),
        needsSupport: support.length,
        openPips: developmentStore.pips.filter(
          (pip) =>
            pip.status !== "Completed" &&
            personnel.find((person) => person.id === pip.personId)
              ?.department === department,
        ).length,
        templateCount: new Set(
          finalized.map(
            ({ review, person }) =>
              review.reviewTemplateId ?? `legacy-${person.personType}`,
          ),
        ).size,
      };
    })
    .filter(
      (row) =>
        row.assigned > 0 ||
        row.averageGoalProgress !== null ||
        row.openPips > 0,
    );
}

export function getEvaluatorCalibrationAnalytics(
  rows: ResolvedPerformanceReview[],
): EvaluatorCalibrationRow[] {
  const organizationRatings = rows
    .filter(({ review }) => isFinalizedRatedReview(review))
    .map(({ review }) => review.rating as number);
  const organizationAverage = organizationRatings.length
    ? round(
        organizationRatings.reduce((sum, rating) => sum + rating, 0) /
          organizationRatings.length,
        2,
      )
    : null;
  const evaluatorIds = Array.from(
    new Set(rows.map(({ review }) => review.evaluatorId)),
  );
  return evaluatorIds
    .map((evaluatorId) => {
      const evaluatorRows = rows.filter(
        ({ review }) => review.evaluatorId === evaluatorId,
      );
      const ratings = evaluatorRows
        .filter(({ review }) => isFinalizedRatedReview(review))
        .map(({ review }) => review.rating as number);
      const averageRating = ratings.length
        ? round(
            ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
            2,
          )
        : null;
      const deviation =
        averageRating === null || organizationAverage === null
          ? null
          : round(averageRating - organizationAverage, 2);
      let signal: EvaluatorCalibrationRow["signal"] = "Insufficient sample";
      if (ratings.length >= 2 && deviation !== null) {
        signal =
          deviation >= 0.5
            ? "Review high pattern"
            : deviation <= -0.5
              ? "Review low pattern"
              : "Within expected range";
      }
      const evaluator = evaluatorRows[0]?.evaluator;
      return {
        evaluatorId,
        evaluatorName: evaluator?.fullName ?? "Unknown evaluator",
        team: evaluator
          ? `${evaluator.position} · ${evaluator.department}`
          : "Assignment identity unavailable",
        assigned: evaluatorRows.length,
        finalized: ratings.length,
        averageRating,
        organizationAverage,
        deviation,
        ratingSpread:
          ratings.length > 1
            ? round(Math.max(...ratings) - Math.min(...ratings), 2)
            : null,
        returnedForRevision: evaluatorRows.filter(({ review }) =>
          review.calibrationHistory?.some(
            (record) => record.action === "Returned for Revision",
          ),
        ).length,
        signal,
      };
    })
    .sort((a, b) => b.assigned - a.assigned);
}
