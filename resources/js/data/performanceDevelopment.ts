import type { PersonnelIdentity } from "./personnel";

export type FeedbackRecordType =
  "1:1 Check-in" | "Feedback Note" | "Coaching Action";
export type FeedbackVisibility =
  "Employee & Manager" | "Manager & HR" | "HR Only";

export type FeedbackCoachingRecord = {
  id: string;
  personId: string;
  authorId: string;
  cycleId?: string;
  relatedReviewId?: string;
  recordType: FeedbackRecordType;
  note: string;
  coachingAction?: string;
  linkedGoalIds: string[];
  followUpDate?: string;
  visibility: FeedbackVisibility;
  createdAt: string;
  updatedAt: string;
};

export type DevelopmentActionSource = "Learning" | "Training" | "Competency";
export type DevelopmentActionStatus = "Planned" | "In Progress" | "Completed";

export type LinkedDevelopmentAction = {
  id: string;
  source: DevelopmentActionSource;
  title: string;
  referenceId?: string;
  status: DevelopmentActionStatus;
};

export type PipStatus =
  "Active" | "On Track" | "Extended" | "Completed" | "Escalated for HR Review";

export type PipMilestone = {
  id: string;
  title: string;
  dueDate: string;
  status: "Pending" | "Completed" | "Missed";
  completedAt?: string;
  note?: string;
};

export type PipProgressNote = {
  id: string;
  authorId: string;
  note: string;
  createdAt: string;
};

export type PerformanceImprovementPlan = {
  id: string;
  personId: string;
  relatedReviewId: string;
  performanceConcern: string;
  expectedImprovement: string;
  actionItems: string[];
  startDate: string;
  targetEndDate: string;
  assignedManagerId: string;
  status: PipStatus;
  milestones: PipMilestone[];
  progressNotes: PipProgressNote[];
  developmentActions: LinkedDevelopmentAction[];
  outcomeNotes?: string;
  hrReviewNotes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TraineeJourneyStageKey =
  | "New Trainee"
  | "Initial Evaluation"
  | "Development Plan"
  | "Learning / Training / Practical Development"
  | "Re-evaluation"
  | "Development Cycle Completed / Ready";

export type TraineeJourneyMilestone = {
  id: string;
  title: string;
  targetDate?: string;
  completedAt?: string;
  note?: string;
};

export type TraineeJourney = {
  id: string;
  traineeId: string;
  cycleId?: string;
  currentStage: TraineeJourneyStageKey;
  milestones: TraineeJourneyMilestone[];
  developmentActionIds: string[];
  updatedAt: string;
};

export const TRAINEE_JOURNEY_STAGES: TraineeJourneyStageKey[] = [
  "New Trainee",
  "Initial Evaluation",
  "Development Plan",
  "Learning / Training / Practical Development",
  "Re-evaluation",
  "Development Cycle Completed / Ready",
];

export type PerformanceDevelopmentStore = {
  feedbackRecords: FeedbackCoachingRecord[];
  pips: PerformanceImprovementPlan[];
  traineeJourneys: TraineeJourney[];
};

export const INITIAL_PERFORMANCE_DEVELOPMENT_STORE: PerformanceDevelopmentStore =
  {
    feedbackRecords: [
      {
        id: "feedback-elaine-checkin-1",
        personId: "user-6",
        authorId: "user-gen-10",
        cycleId: "period-q3-2026",
        relatedReviewId: "eval-1",
        recordType: "1:1 Check-in",
        note: "Reviewed trainee progress and practical-work confidence during the regular check-in.",
        coachingAction:
          "Continue supervised practical exercises and review progress at the next check-in.",
        linkedGoalIds: [],
        followUpDate: "2026-08-24",
        visibility: "Employee & Manager",
        createdAt: "2026-08-03T14:00:00+08:00",
        updatedAt: "2026-08-03T14:00:00+08:00",
      },
    ],
    pips: [],
    traineeJourneys: [
      {
        id: "trainee-journey-elaine-2026",
        traineeId: "user-6",
        cycleId: "cycle-probationary-2026",
        currentStage: "Learning / Training / Practical Development",
        milestones: [
          {
            id: "trainee-elaine-initial",
            title: "Initial performance discussion",
            completedAt: "2026-08-03T15:10:00+08:00",
            note: "Initial trainee review recorded.",
          },
          {
            id: "trainee-elaine-development",
            title: "Complete agreed practical-development activities",
            targetDate: "2026-11-15",
          },
          {
            id: "trainee-elaine-reevaluation",
            title: "Probationary re-evaluation",
            targetDate: "2026-12-05",
          },
        ],
        developmentActionIds: [],
        updatedAt: "2026-08-03T15:10:00+08:00",
      },
    ],
  };

export function canViewFeedbackRecord(
  record: FeedbackCoachingRecord,
  viewer: PersonnelIdentity,
  isAuthorizedEvaluator: boolean,
): boolean {
  if (viewer.accessRole === "Admin" || viewer.accessRole === "HR") return true;
  if (record.authorId === viewer.id) return true;
  if (isAuthorizedEvaluator) return record.visibility !== "HR Only";
  return (
    record.personId === viewer.id && record.visibility === "Employee & Manager"
  );
}

export function getOpenPipCount(pips: PerformanceImprovementPlan[]): number {
  return pips.filter((pip) => pip.status !== "Completed").length;
}

export function getTraineeJourneyProgress(journey: TraineeJourney): number {
  const index = TRAINEE_JOURNEY_STAGES.indexOf(journey.currentStage);
  if (index < 0) return 0;
  return Math.round(((index + 1) / TRAINEE_JOURNEY_STAGES.length) * 100);
}

