import type {
  FeedbackCoachingRecord,
  PerformanceImprovementPlan,
} from "./performanceDevelopment";
import type { PerformanceGoal } from "./performancePlanning";
import type { PersonnelIdentity } from "./personnel";
import type { PerformanceReview } from "./performanceReviews";

export type PerformanceOwnedModule =
  | "Performance"
  | "Competency"
  | "Learning / LMS"
  | "Training"
  | "Recognition"
  | "Succession"
  | "HR2 / Workforce";

export type PerformanceIntegrationBoundary = {
  module: PerformanceOwnedModule;
  owns: string;
  performanceUse: string;
  prohibitedPerformanceAction: string;
};

export const PERFORMANCE_INTEGRATION_BOUNDARIES: PerformanceIntegrationBoundary[] =
  [
    {
      module: "Performance",
      owns: "Goals/KPIs/KRAs, cycles, reviews, feedback/coaching, PIPs, analytics, and calibration",
      performanceUse: "Authoritative source for the Performance workflow",
      prohibitedPerformanceAction:
        "Must not become the master record for another P&D module",
    },
    {
      module: "Competency",
      owns: "Competency framework, proficiency requirements, formal profiles, gaps, and reassessment",
      performanceUse:
        "Consume authorized competency evidence and suggest a reassessment for human review",
      prohibitedPerformanceAction:
        "Do not create or certify formal competency gaps inside Performance",
    },
    {
      module: "Learning / LMS",
      owns: "Course delivery, lessons, quizzes, progress, completion, certificates, and transcripts",
      performanceUse:
        "Link verified learning evidence or recommend a learning intervention",
      prohibitedPerformanceAction:
        "Do not calculate performance rank from course counts or recreate LMS delivery",
    },
    {
      module: "Training",
      owns: "Scheduled, instructor-led, on-site, and practical training records",
      performanceUse:
        "Link verified training evidence or recommend a training intervention",
      prohibitedPerformanceAction:
        "Do not schedule or certify training completion inside Performance",
    },
    {
      module: "Recognition",
      owns: "Kudos, badges, awards, and recognition issuance",
      performanceUse:
        "Display authorized recognition evidence as optional context",
      prohibitedPerformanceAction:
        "Do not issue awards or treat recognition counts as a performance score",
    },
    {
      module: "Succession",
      owns: "Critical roles, successor pools, readiness, potential, and succession decisions",
      performanceUse:
        "Provide authorized finalized performance evidence to a separate human-led readiness process",
      prohibitedPerformanceAction:
        "Do not appoint, promote, or rank successors from Performance",
    },
    {
      module: "HR2 / Workforce",
      owns: "Time and attendance, schedules, timesheets, leave, and related workforce records",
      performanceUse:
        "Consume only authorized supporting metrics when an integration exists",
      prohibitedPerformanceAction:
        "Do not rebuild attendance or convert missing workforce evidence into a zero",
    },
  ];

export type GroqPerformanceUseCase =
  | "Evidence Summary"
  | "Feedback Theme Summary"
  | "Development Recommendation Draft"
  | "Development Intervention Suggestions";

export const GROQ_PERFORMANCE_USE_CASES: GroqPerformanceUseCase[] = [
  "Evidence Summary",
  "Feedback Theme Summary",
  "Development Recommendation Draft",
  "Development Intervention Suggestions",
];

export const GROQ_PERFORMANCE_GUARDRAILS = [
  "The output is a draft for an authorized human reviewer.",
  "Do not calculate, change, or determine the final performance rating.",
  "Do not recommend or decide promotion, termination, discipline, employment status, access role, or succession appointment.",
  "Do not treat missing evidence as failure or score zero.",
  "Explain which supplied evidence supports each suggestion and state when evidence is insufficient.",
] as const;

export type PreparedGroqPerformanceContext = {
  useCase: GroqPerformanceUseCase;
  reviewId: string;
  cycleId: string;
  subjectReference: {
    personId: string;
    personType: PersonnelIdentity["personType"];
    department: string;
    position: string;
  };
  finalizedHumanRating: number | null;
  criteria: { name: string; score: number }[];
  evaluatorComments?: string;
  goals: { title: string; progress: number; status: string }[];
  feedback: { type: string; note: string; coachingAction?: string }[];
  currentDevelopmentRecommendations: string[];
  activeInterventions: {
    pipStatus: string;
    expectedImprovement: string;
    linkedActions: string[];
  }[];
  integrationEvidence: {
    source: string;
    title: string;
    completedAt: string;
    note?: string;
  }[];
  guardrails: readonly string[];
  missingContext: string[];
};

/**
 * Phase 5 prepares a bounded, review-specific payload only. It intentionally
 * does not call Groq from the browser or fabricate an AI response. Phase 6 can
 * send this payload through an authorized Laravel endpoint with audit logging.
 */
export const GROQ_PERFORMANCE_BROWSER_CALL_ENABLED = false;

export function prepareGroqPerformanceContext(args: {
  useCase: GroqPerformanceUseCase;
  review: PerformanceReview;
  person: PersonnelIdentity;
  goals: PerformanceGoal[];
  feedback: FeedbackCoachingRecord[];
  pips: PerformanceImprovementPlan[];
}): PreparedGroqPerformanceContext {
  const { useCase, review, person } = args;
  const goals = args.goals.filter(
    (goal) => goal.personId === person.id && goal.cycleId === review.periodId,
  );
  const feedback = args.feedback.filter(
    (record) =>
      record.personId === person.id &&
      (!record.cycleId || record.cycleId === review.periodId),
  );
  const pips = args.pips.filter(
    (pip) =>
      pip.personId === person.id &&
      (pip.relatedReviewId === review.id || pip.status !== "Completed"),
  );
  const missingContext: string[] = [];
  if (!(review.competencyScores?.length ?? 0))
    missingContext.push("No completed criterion scores are available.");
  if (!review.comments?.trim())
    missingContext.push("No evaluator comments are available.");
  if (!goals.length)
    missingContext.push("No goals/KPIs are linked to this cycle.");
  if (!feedback.length)
    missingContext.push(
      "No feedback/coaching records are linked to this cycle.",
    );
  if (!(review.linkedEvidence?.length ?? 0))
    missingContext.push("No verified cross-module evidence is linked.");

  return {
    useCase,
    reviewId: review.id,
    cycleId: review.periodId,
    subjectReference: {
      personId: person.id,
      personType: person.personType,
      department: person.department,
      position: person.position,
    },
    finalizedHumanRating: review.status === "Completed" ? review.rating : null,
    criteria: (review.competencyScores ?? []).map((score) => ({ ...score })),
    evaluatorComments: review.comments?.trim() || undefined,
    goals: goals.map((goal) => ({
      title: goal.title,
      progress: goal.progress,
      status: goal.status,
    })),
    feedback: feedback.map((record) => ({
      type: record.recordType,
      note: record.note,
      coachingAction: record.coachingAction,
    })),
    currentDevelopmentRecommendations: [
      ...(review.developmentRecommendations ?? []),
    ],
    activeInterventions: pips.map((pip) => ({
      pipStatus: pip.status,
      expectedImprovement: pip.expectedImprovement,
      linkedActions: pip.developmentActions.map(
        (action) => `${action.source}: ${action.title} (${action.status})`,
      ),
    })),
    integrationEvidence: (review.linkedEvidence ?? []).map((evidence) => ({
      source: evidence.source,
      title: evidence.title,
      completedAt: evidence.dateCompleted,
      note: evidence.note,
    })),
    guardrails: GROQ_PERFORMANCE_GUARDRAILS,
    missingContext,
  };
}
