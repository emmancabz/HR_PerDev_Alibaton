import type {
  ReassignmentMetadata,
  RevisionMetadata,
} from "./evaluatorAssignments";

export type StoredEvaluationStatus = "Pending" | "In Progress" | "Completed";
export type EvaluationStatus = StoredEvaluationStatus | "Overdue";
export type EvidenceSource = "Training" | "Learning" | "Competency";

export type CompetencyScore = {
  name: string;
  score: number;
};

export type LinkedEvidence = {
  title: string;
  source: EvidenceSource;
  dateCompleted: string;
  note?: string;
};

export type SelfEvaluation = {
  accomplishments: string;
  goalProgress: string;
  challenges: string;
  comments: string;
  selfRating?: number;
  status: "Draft" | "Submitted";
  submittedAt?: string;
  updatedAt: string;
};

export type ReviewWorkflowState =
  | "Manager Review"
  | "Calibration Pending"
  | "Calibration In Review"
  | "Finalized"
  | "Revision In Progress";

export type CalibrationStatus =
  | "Not Required"
  | "Pending"
  | "In Review"
  | "Approved"
  | "Returned for Revision";

export type CalibrationHistoryRecord = {
  action: "Submitted" | "Review Started" | "Approved" | "Returned for Revision";
  actor: string;
  actorRole?: string | null;
  timestamp: string;
  notes?: string;
};

export type EmployeeAcknowledgment = {
  status: "Acknowledged";
  actorId: string;
  timestamp: string;
  statement: "Received / Viewed";
};

export type ReviewRevisionSnapshot = {
  rating: number | null;
  competencyScores: CompetencyScore[];
  comments?: string;
  developmentRecommendations: string[];
  managerSubmittedAt?: string;
  finalizedAt?: string;
  calibrationStatus?: CalibrationStatus;
};

export type CompletedReviewRevisionRecord = RevisionMetadata & {
  action: "Reopened" | "Revision Requested";
  version: number;
  snapshot: ReviewRevisionSnapshot;
};

export type PerformanceReviewAuditEvent = {
  actorRole?: string | null;
  type: string;
  actor: string;
  timestamp: string;
  reason?: string | null;
  notes?: string | null;
  fromEvaluatorId?: string | null;
  toEvaluatorId?: string | null;
};

export type PerformanceReview = {
  id: string;
  personId: string;
  evaluatorId: string;
  goalEvaluatorId?: string;
  periodId: string;
  reviewTemplateId?: string;
  rating: number | null;
  status: StoredEvaluationStatus;
  dateEvaluated?: string | null;
  dueDate?: string | null;
  competencyScores?: CompetencyScore[];
  comments?: string;
  developmentRecommendations?: string[];
  linkedEvidence?: LinkedEvidence[];
  selfEvaluation?: SelfEvaluation;
  managerSubmittedAt?: string;
  finalizedAt?: string;
  workflowState?: ReviewWorkflowState;
  calibrationStatus?: CalibrationStatus;
  calibrationHistory?: CalibrationHistoryRecord[];
  acknowledgment?: EmployeeAcknowledgment;
  assignmentHistory?: ReassignmentMetadata[];
  revisionHistory?: CompletedReviewRevisionRecord[];
  auditTrail?: PerformanceReviewAuditEvent[];
  reviewMethod?: "Manager Review" | "360° Leadership Review";
  pipOwner?: {
    id: string | null;
    name: string | null;
    authorityType: string | null;
    source: string | null;
    assignmentBasis: string | null;
  } | null;
};

export const DEVELOPMENT_RECOMMENDATION_OPTIONS = [
  "No immediate intervention",
  "Learning recommended",
  "Training recommended",
  "Competency reassessment recommended",
  "Further performance review recommended",
  "Other",
] as const;

export const INITIAL_PERFORMANCE_REVIEWS: PerformanceReview[] = [];
// Deprecated compatibility export only. The active Performance UI loads review records
// from /performance/api/state and never uses a second client-side review dataset.

export function isPastDue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const parsed = new Date(`${dueDate}T23:59:59`);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
}

export function getDisplayStatus(
  review: Pick<PerformanceReview, "status" | "dueDate">,
): EvaluationStatus {
  if (review.status !== "Completed" && isPastDue(review.dueDate)) {
    return "Overdue";
  }
  return review.status;
}

export function getReviewWorkflowState(
  review: PerformanceReview,
  calibrationRequired = false,
): ReviewWorkflowState {
  if (review.workflowState) return review.workflowState;
  if (review.status === "Completed") return "Finalized";
  if (review.managerSubmittedAt && calibrationRequired) {
    return review.calibrationStatus === "In Review"
      ? "Calibration In Review"
      : "Calibration Pending";
  }
  return "Manager Review";
}

export function createReviewRevisionSnapshot(
  review: PerformanceReview,
): ReviewRevisionSnapshot {
  return {
    rating: review.rating,
    competencyScores: [...(review.competencyScores ?? [])],
    comments: review.comments,
    developmentRecommendations: [...(review.developmentRecommendations ?? [])],
    managerSubmittedAt: review.managerSubmittedAt,
    finalizedAt: review.finalizedAt,
    calibrationStatus: review.calibrationStatus,
  };
}

export function calculateWeightedReviewRating(
  scores: CompetencyScore[],
  criteria: { name: string; weight: number }[],
): number | null {
  if (criteria.length === 0) return null;
  const values = criteria.map((criterion) => {
    const score = scores.find((candidate) => candidate.name === criterion.name);
    return score && score.score > 0
      ? { score: score.score, weight: criterion.weight }
      : null;
  });
  if (values.some((value) => value === null)) return null;
  const totalWeight = criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );
  if (totalWeight <= 0) return null;
  const weightedTotal = values.reduce(
    (total, value) => total + (value?.score ?? 0) * (value?.weight ?? 0),
    0,
  );
  return Number((weightedTotal / totalWeight).toFixed(2));
}



