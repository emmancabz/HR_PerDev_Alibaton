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

export type PerformanceReview = {
  id: string;
  personId: string;
  evaluatorId: string;
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
};

export const DEVELOPMENT_RECOMMENDATION_OPTIONS = [
  "No immediate intervention",
  "Learning recommended",
  "Training recommended",
  "Competency reassessment recommended",
  "Further performance review recommended",
  "Other",
] as const;

export const INITIAL_PERFORMANCE_REVIEWS: PerformanceReview[] = [
  {
    id: "eval-1",
    personId: "user-6",
    evaluatorId: "user-gen-10",
    periodId: "period-q3-2026",
    reviewTemplateId: "review-template-trainee-standard",
    rating: 4.4,
    status: "Completed",
    dateEvaluated: "Aug 3, 2026",
    managerSubmittedAt: "2026-08-03T15:10:00+08:00",
    finalizedAt: "2026-08-03T15:10:00+08:00",
    workflowState: "Finalized",
    calibrationStatus: "Not Required",
    competencyScores: [
      { name: "Learning / Development Progress", score: 4.3 },
      { name: "Assessment Performance", score: 4.2 },
      { name: "Training Participation", score: 4.6 },
      { name: "Competency Readiness", score: 4.4 },
      { name: "Participation / Compliance", score: 4.7 },
      { name: "Practical Application", score: 4.2 },
    ],
    comments:
      "Adjusting well to the Operations training track and consistently meets attendance expectations.",
    developmentRecommendations: ["Training recommended"],
    linkedEvidence: [],
  },
  {
    id: "eval-2",
    personId: "user-5",
    evaluatorId: "user-gen-11",
    periodId: "period-q2-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: 4.2,
    status: "Completed",
    dateEvaluated: "Jul 2, 2026",
    managerSubmittedAt: "2026-07-02T14:30:00+08:00",
    finalizedAt: "2026-07-02T14:30:00+08:00",
    workflowState: "Finalized",
    calibrationStatus: "Not Required",
    competencyScores: [
      { name: "Quality of Work", score: 4.1 },
      { name: "Productivity", score: 4.3 },
      { name: "Role Competency", score: 4.2 },
      { name: "Communication / Collaboration", score: 4.4 },
      { name: "Reliability / Compliance", score: 4.0 },
      { name: "Problem Solving", score: 4.1 },
    ],
    comments:
      "Reliable performance in Finance with steady turnaround on monthly reconciliations.",
    developmentRecommendations: [],
    linkedEvidence: [],
  },
  {
    id: "eval-3",
    personId: "user-8",
    evaluatorId: "user-gen-13",
    periodId: "period-q3-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: null,
    status: "Pending",
    dueDate: "2026-08-20",
    linkedEvidence: [],
  },
  {
    id: "eval-4",
    personId: "user-gen-0",
    evaluatorId: "user-gen-8",
    periodId: "period-q2-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: 4.5,
    status: "Completed",
    dateEvaluated: "Jul 5, 2026",
    managerSubmittedAt: "2026-07-05T10:15:00+08:00",
    finalizedAt: "2026-07-05T10:15:00+08:00",
    workflowState: "Finalized",
    calibrationStatus: "Not Required",
    competencyScores: [
      { name: "Quality of Work", score: 4.3 },
      { name: "Productivity", score: 4.7 },
      { name: "Role Competency", score: 4.5 },
      { name: "Communication / Collaboration", score: 4.6 },
      { name: "Reliability / Compliance", score: 4.4 },
      { name: "Problem Solving", score: 4.5 },
    ],
    comments:
      "Strong technical execution on crane operations with a clean safety record this quarter.",
    developmentRecommendations: ["Learning recommended"],
    linkedEvidence: [],
  },
  {
    id: "eval-5",
    personId: "user-gen-1",
    evaluatorId: "user-gen-9",
    periodId: "period-q2-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: 4.0,
    status: "Completed",
    dateEvaluated: "Jul 6, 2026",
    managerSubmittedAt: "2026-07-06T16:20:00+08:00",
    finalizedAt: "2026-07-06T16:20:00+08:00",
    workflowState: "Finalized",
    calibrationStatus: "Not Required",
    competencyScores: [
      { name: "Quality of Work", score: 4.0 },
      { name: "Productivity", score: 3.9 },
      { name: "Role Competency", score: 4.1 },
      { name: "Communication / Collaboration", score: 4.0 },
      { name: "Reliability / Compliance", score: 4.2 },
      { name: "Problem Solving", score: 3.8 },
    ],
    comments:
      "Consistent contributor to the Logistics team with good coordination across shifts.",
    developmentRecommendations: [],
    linkedEvidence: [],
  },
  {
    id: "eval-6",
    personId: "user-gen-2",
    evaluatorId: "user-gen-10",
    periodId: "period-q3-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: null,
    status: "Pending",
    dueDate: "2026-08-25",
    linkedEvidence: [],
  },
  {
    id: "eval-7",
    personId: "user-gen-3",
    evaluatorId: "user-gen-11",
    periodId: "period-q2-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: 3.8,
    status: "Completed",
    dateEvaluated: "Jul 8, 2026",
    managerSubmittedAt: "2026-07-08T11:40:00+08:00",
    finalizedAt: "2026-07-08T11:40:00+08:00",
    workflowState: "Finalized",
    calibrationStatus: "Not Required",
    competencyScores: [
      { name: "Quality of Work", score: 3.7 },
      { name: "Productivity", score: 3.9 },
      { name: "Role Competency", score: 3.8 },
      { name: "Communication / Collaboration", score: 3.6 },
      { name: "Reliability / Compliance", score: 4.0 },
      { name: "Problem Solving", score: 3.7 },
    ],
    comments:
      "Meets expectations overall; would benefit from additional support on reporting turnaround time.",
    developmentRecommendations: ["Learning recommended"],
    linkedEvidence: [],
  },
  {
    id: "eval-q3-luis",
    personId: "user-gen-0",
    evaluatorId: "user-gen-8",
    periodId: "period-q3-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: null,
    status: "Pending",
    dueDate: "2026-10-15",
    linkedEvidence: [],
  },
  {
    id: "eval-q3-sofia",
    personId: "user-gen-1",
    evaluatorId: "user-gen-9",
    periodId: "period-q3-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: null,
    status: "Pending",
    dueDate: "2026-10-15",
    linkedEvidence: [],
  },
  {
    id: "eval-q3-nina",
    personId: "user-5",
    evaluatorId: "user-gen-11",
    periodId: "period-q3-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: null,
    status: "Pending",
    dueDate: "2026-10-15",
    linkedEvidence: [],
  },
  {
    id: "eval-q3-isabella",
    personId: "user-gen-3",
    evaluatorId: "user-gen-11",
    periodId: "period-q3-2026",
    reviewTemplateId: "review-template-employee-standard",
    rating: null,
    status: "Pending",
    dueDate: "2026-10-15",
    linkedEvidence: [],
  },
];

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



