import PageHeader from "@/Components/PageHeader";
import {
    canEvaluate,
    getActiveEvaluationPeriod,
    getEligiblePeopleForEvaluator,
    getEvaluatorScopeLabels,
    hasPrimaryAssignmentConflict,
    prepareCycleReviewAssignments,
    type AssignmentScopeType,
    type EvaluationPeriod,
    type EvaluationPeriodStatus,
    type EvaluatorAssignment,
    type ReassignmentMetadata,
} from "@/data/evaluatorAssignments";
import {
    ALL_ANALYTICS_CYCLES,
    ALL_ANALYTICS_DEPARTMENTS,
    ALL_ANALYTICS_EVALUATORS,
    ALL_ANALYTICS_PERSON_TYPES,
    ALL_ANALYTICS_TEMPLATES,
    applyPerformanceAnalyticsFilters,
    getAccurateRatingDistribution,
    getComparableTopPerformanceResults,
    getDepartmentTrendAnalytics,
    getEvaluatorCalibrationAnalytics,
    getGoalTrendAnalytics,
    getNeedsPerformanceSupport,
    getReviewCompletionAnalytics,
    isFinalizedRatedReview,
    type PerformanceAnalyticsFilters,
    type ResolvedPerformanceReview,
} from "@/data/performanceAnalytics";
import {
    requestPerformanceGroqDraft,
    usePerformanceBackendBridge,
} from "@/data/performanceBackend";
import {
    TRAINEE_JOURNEY_STAGES,
    getOpenPipCount,
    type FeedbackRecordType,
    type FeedbackVisibility,
    type PerformanceDevelopmentStore,
    type PipStatus,
} from "@/data/performanceDevelopment";
import {
    GROQ_PERFORMANCE_USE_CASES,
    PERFORMANCE_INTEGRATION_BOUNDARIES,
    prepareGroqPerformanceContext,
    type GroqPerformanceUseCase,
    type PreparedGroqPerformanceContext,
} from "@/data/performanceIntelligence";
import {
    DEFAULT_RATING_SCALE,
    totalTemplateWeight,
    validateGoalTemplate,
    type EmployeeAcknowledgmentMode,
    type GoalMetricType,
    type GoalStatus,
    type GoalTemplate,
    type GoalTemplateItem,
    type PerformanceCycleType,
    type PerformanceGoal,
    type ReviewTemplate,
} from "@/data/performancePlanning";
import {
    DEVELOPMENT_RECOMMENDATION_OPTIONS,
    createReviewRevisionSnapshot,
    getDisplayStatus,
    getReviewWorkflowState,
    type CalibrationHistoryRecord,
    type CompletedReviewRevisionRecord,
    type PerformanceReview as Evaluation,
    type EvaluationStatus,
} from "@/data/performanceReviews";
import {
    SHARED_PERSONNEL,
    colorForId,
    getPersonById,
    initialsFor,
    type PersonnelIdentity,
} from "@/data/personnel";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage } from "@inertiajs/react";
import {
    AlertTriangle,
    BarChart3,
    Briefcase,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Cpu,
    Eye,
    GraduationCap,
    Hash,
    MessageSquare,
    Plus,
    RotateCcw,
    Search,
    Settings2,
    Star,
    Target,
    Trash2,
    TrendingUp,
    Trophy,
    UserRound,
    Users,
    X,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";

/** A required-reason log entry, written whenever an evaluation's evaluator is reassigned. */
type ReassignmentRecord = ReassignmentMetadata;

/* ---------------------------------------------------------------------- */
/* Mock evaluation data — REFERENCES the shared personnel source only.    */
/* No employee identity is duplicated here; only evaluation-specific data.*/
/* ---------------------------------------------------------------------- */

const EMPLOYEE_EVALUATION_CRITERIA = [
  {
    name: "Quality of Work",
    description: "Accuracy, completeness, and standard of work delivered",
  },
  {
    name: "Productivity / Goal Achievement",
    description: "Progress against agreed responsibilities and goals",
  },
  {
    name: "Role Competency",
    description:
      "Application of the knowledge and skills required for the role",
  },
  {
    name: "Communication / Collaboration",
    description: "Clear communication and constructive teamwork",
  },
  {
    name: "Reliability / Compliance",
    description: "Dependability and adherence to organizational requirements",
  },
  {
    name: "Problem Solving",
    description: "Sound judgment when analyzing and resolving work issues",
  },
] as const;

const TRAINEE_EVALUATION_CRITERIA = [
  {
    name: "Learning Progress",
    description: "Growth against the agreed trainee development plan",
  },
  {
    name: "Assessment Performance",
    description: "Demonstrated understanding in assigned assessments",
  },
  {
    name: "Training Participation / Completion",
    description: "Engagement with required development activities",
  },
  {
    name: "Competency Readiness",
    description:
      "Readiness to apply role competencies with appropriate support",
  },
  {
    name: "Participation / Compliance",
    description: "Participation and adherence to trainee requirements",
  },
  {
    name: "Practical Application",
    description: "Ability to apply learning in practical work situations",
  },
] as const;

type EvaluationCriterion = { name: string; description: string };

function criteriaForPerson(
  person?: PersonnelIdentity,
): readonly EvaluationCriterion[] {
  return person?.personType === "Trainee"
    ? TRAINEE_EVALUATION_CRITERIA
    : EMPLOYEE_EVALUATION_CRITERIA;
}

type PerformanceLevelKey =
  "exceptional" | "exceeds" | "meets" | "needsImprovement" | "critical";
const PERFORMANCE_LEVELS: {
  key: PerformanceLevelKey;
  label: string;
  min: number;
  color: string;
  textColor: string;
  bgColor: string;
}[] = [
  {
    key: "exceptional",
    label: "Exceptional",
    min: 4.7,
    color: "#16a34a",
    textColor: "text-green-700",
    bgColor: "bg-green-100",
  },
  {
    key: "exceeds",
    label: "Exceeds Expectations",
    min: 4.3,
    color: "#3b82f6",
    textColor: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  {
    key: "meets",
    label: "Meets Expectations",
    min: 3.7,
    color: "#F4B400",
    textColor: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  {
    key: "needsImprovement",
    label: "Needs Improvement",
    min: 3.0,
    color: "#f97316",
    textColor: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  {
    key: "critical",
    label: "Critical Improvement",
    min: 0,
    color: "#dc2626",
    textColor: "text-rose-700",
    bgColor: "bg-rose-100",
  },
];
function getPerformanceLevel(rating: number | null | undefined) {
  if (rating === null || rating === undefined) return null;
  return (
    PERFORMANCE_LEVELS.find((l) => rating >= l.min) ??
    PERFORMANCE_LEVELS[PERFORMANCE_LEVELS.length - 1]
  );
}
const LEVEL_FILTER_OPTIONS = [
  "All Rating Levels",
  ...PERFORMANCE_LEVELS.map((l) => l.label),
];

type StatusFilter = "All" | EvaluationStatus;
type FormMode = "create" | "edit";
type OverviewCardKey =
  "activeCycle" | "completion" | "actionNeeded" | "openPips";
type PerformanceWorkspaceTab =
  | "Overview"
  | "Goals & KPIs"
  | "Review Cycles"
  | "Evaluations"
  | "Feedback & Coaching"
  | "Performance Improvement"
  | "Analytics";

const PERFORMANCE_WORKSPACE_TABS: {
  label: PerformanceWorkspaceTab;
  icon: ComponentType<{ className?: string }>;
  phase: number;
}[] = [
  { label: "Overview", icon: ClipboardList, phase: 1 },
  { label: "Goals & KPIs", icon: Target, phase: 2 },
  { label: "Review Cycles", icon: CalendarDays, phase: 2 },
  { label: "Evaluations", icon: Star, phase: 1 },
  { label: "Feedback & Coaching", icon: MessageSquare, phase: 4 },
  { label: "Performance Improvement", icon: TrendingUp, phase: 4 },
  { label: "Analytics", icon: BarChart3, phase: 5 },
];

type FormState = {
  id: string | null;
  personId: string;
  evaluatorId: string;
  periodId: string;
  dateEvaluated: string;
  comments: string;
  scores: Record<string, number>;
  developmentRecommendations: string[];
  otherRecommendation: string;
};

type GoalTemplateDraft = {
  name: string;
  applicable: "Both" | PersonnelIdentity["personType"];
  department: string;
  position: string;
  cycleId: string;
  description: string;
  items: GoalTemplateItem[];
};

function newGoalTemplateItem(index: number): GoalTemplateItem {
  return {
    id: `goal-item-${Date.now()}-${index}`,
    metricType: "KPI",
    title: "",
    target: "",
    unit: "",
    weight: 0,
    description: "",
  };
}

const DEFAULT_ANALYTICS_CYCLE_ID = ALL_ANALYTICS_CYCLES;

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function emptyForm(periodId: string, evaluatorId: string): FormState {
  return {
    id: null,
    personId: "",
    evaluatorId,
    periodId,
    dateEvaluated: todayLabel(),
    comments: "",
    scores: {},
    developmentRecommendations: [],
    otherRecommendation: "",
  };
}

function averageScore(scores: Record<string, number>) {
  const values = Object.values(scores).filter((v) => v > 0);
  if (values.length === 0) return null;
  return (
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  );
}

/* ---------------------------------------------------------------------- */
/* Small shared UI pieces                                                 */
/* ---------------------------------------------------------------------- */

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-100">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function LevelBadge({
  level,
}: {
  level: (typeof PERFORMANCE_LEVELS)[number] | null;
}) {
  if (!level) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        Not yet rated
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${level.bgColor} ${level.textColor}`}
    >
      {level.label}
    </span>
  );
}

function PersonTypeBadge({
  personType,
}: {
  personType: PersonnelIdentity["personType"];
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        personType === "Trainee"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-violet-100 text-violet-700"
      }`}
    >
      {personType}
    </span>
  );
}

function EvaluationStatusBadge({ evaluation }: { evaluation: Evaluation }) {
  const status = getDisplayStatus(evaluation);
  const tone =
    status === "Completed"
      ? "bg-green-100 text-green-700"
      : status === "Overdue"
        ? "bg-rose-100 text-rose-700"
        : status === "In Progress"
          ? "bg-sky-100 text-sky-700"
          : "bg-amber-100 text-amber-700";
  const dot =
    status === "Completed"
      ? "bg-green-500"
      : status === "Overdue"
        ? "bg-rose-500"
        : status === "In Progress"
          ? "bg-sky-500"
          : "bg-amber-500";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <span className={`h-1 w-1 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Evaluation Details Modal                                               */
/* ---------------------------------------------------------------------- */

function EvaluationDetailsModal({
  evaluation,
  person,
  evaluator,
  period,
  canManage,
  onClose,
  onReopen,
  onReassign,
  onApproveCalibration,
  onReturnCalibration,
  feedbackRecords,
  relatedPips,
}: {
  evaluation: Evaluation;
  person: PersonnelIdentity;
  evaluator: PersonnelIdentity | undefined;
  period: EvaluationPeriod | undefined;
  canManage: boolean;
  onClose: () => void;
  onReopen: () => void;
  onReassign: () => void;
  onApproveCalibration: () => void;
  onReturnCalibration: () => void;
  feedbackRecords: PerformanceDevelopmentStore["feedbackRecords"];
  relatedPips: PerformanceDevelopmentStore["pips"];
}) {
  const displayStatus = getDisplayStatus(evaluation);
  const workflowState = getReviewWorkflowState(
    evaluation,
    period?.calibrationRequired,
  );
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-slate-900/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-[#121212] to-[#2a2a2a] px-6 pb-8 pt-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F4B400]">
            Evaluation Details
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
              style={{ backgroundColor: colorForId(person.id) }}
            >
              {initialsFor(person.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-white">
                {person.fullName}
              </h2>
              <p className="mt-0.5 text-sm text-white/60">
                {person.position} · {person.department}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PersonTypeBadge personType={person.personType} />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${displayStatus === "Completed" ? "bg-emerald-500/20 text-emerald-300" : displayStatus === "Overdue" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${displayStatus === "Completed" ? "bg-emerald-400" : displayStatus === "Overdue" ? "bg-rose-400" : "bg-amber-400"}`}
                  />
                  {displayStatus}
                </span>
                {evaluation.rating ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F4B400]/20 px-3 py-1 text-xs font-semibold text-[#F4B400]">
                    <Star className="h-3 w-3 fill-[#F4B400]" />
                    {evaluation.rating} / 5 Performance Score
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/60">
                    Pending Rating
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Person &amp; Role
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField
                icon={Hash}
                label="Employee / Trainee ID"
                value={person.employeeOrTraineeId}
              />
              <DetailField
                icon={Building2}
                label="Department"
                value={person.department}
              />
              <DetailField
                icon={Briefcase}
                label="Position"
                value={person.position}
              />
              <DetailField
                icon={UserRound}
                label="Person Type"
                value={person.personType}
              />
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Evaluation Info
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-400">Evaluation Period</p>
                <p className="font-semibold text-slate-800">
                  {period?.cycleName ?? "Unknown cycle"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Evaluator</p>
                <p className="font-semibold text-slate-800">
                  {evaluator
                    ? `${evaluator.fullName} (${evaluator.position})`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">
                  {evaluation.status === "Completed"
                    ? "Date Evaluated"
                    : "Due Date"}
                </p>
                <p className="font-semibold text-slate-800">
                  {(evaluation.status === "Completed"
                    ? evaluation.dateEvaluated
                    : (evaluation.dueDate ?? period?.reviewDueDate)) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Workflow State</p>
                <p className="font-semibold text-slate-800">{workflowState}</p>
              </div>
              <div>
                <p className="text-slate-400">Acknowledgment</p>
                <p className="font-semibold text-slate-800">
                  {evaluation.acknowledgment
                    ? `Received / Viewed · ${new Date(evaluation.acknowledgment.timestamp).toLocaleString()}`
                    : period?.employeeAcknowledgment === "Not Required"
                      ? "Not required"
                      : "Awaiting employee"}
                </p>
              </div>
            </div>
          </div>
          {evaluation.selfEvaluation?.status === "Submitted" && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Employee Self-Evaluation
              </p>
              <div className="space-y-3 rounded-xl bg-white p-4 text-xs ring-1 ring-slate-100 shadow-sm">
                <div>
                  <p className="font-semibold text-slate-800">
                    Accomplishments
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    {evaluation.selfEvaluation.accomplishments ||
                      "Not provided."}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Goal Progress</p>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    {evaluation.selfEvaluation.goalProgress || "Not provided."}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    Challenges / Context
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    {evaluation.selfEvaluation.challenges || "Not provided."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                    {evaluation.selfEvaluation.status}
                  </span>
                  {evaluation.selfEvaluation.selfRating !== undefined && (
                    <span>
                      Self-rating: {evaluation.selfEvaluation.selfRating} / 5
                    </span>
                  )}
                  <span>
                    Updated{" "}
                    {new Date(
                      evaluation.selfEvaluation.updatedAt,
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
          {evaluation.competencyScores &&
            evaluation.competencyScores.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Criteria Scores
                </p>
                <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
                  {evaluation.competencyScores.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="font-medium text-slate-700">
                        {c.name}
                      </span>
                      <span className="flex items-center gap-1 font-bold text-slate-900">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{" "}
                        {c.score.toFixed(1)} / 5
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Evaluator Comments
            </p>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm text-xs leading-relaxed text-slate-700">
              {evaluation.comments ||
                "No evaluator comments recorded for this evaluation."}
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Feedback, Coaching &amp; Improvement Context
            </p>
            <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
              {feedbackRecords.length === 0 && relatedPips.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No linked feedback, coaching, or PIP record is available. This
                  does not reduce the score.
                </p>
              ) : (
                <>
                  {feedbackRecords.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-lg bg-slate-50 p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-slate-800">
                          {record.recordType}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {new Date(record.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        {record.note}
                      </p>
                      {record.coachingAction && (
                        <p className="mt-1 text-slate-500">
                          Action: {record.coachingAction}
                        </p>
                      )}
                    </div>
                  ))}
                  {relatedPips.map((pip) => (
                    <div
                      key={pip.id}
                      className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs"
                    >
                      <p className="font-bold text-amber-900">
                        PIP · {pip.status}
                      </p>
                      <p className="mt-1 text-amber-800">
                        {pip.expectedImprovement}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Development Recommendations
            </p>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm text-xs leading-relaxed text-slate-700">
              {evaluation.developmentRecommendations &&
              evaluation.developmentRecommendations.length > 0 ? (
                <ul className="space-y-1.5">
                  {evaluation.developmentRecommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#F4B400]" />{" "}
                      {rec}
                    </li>
                  ))}
                </ul>
              ) : (
                "No development recommendations have been added for this evaluation."
              )}
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Supporting P&amp;D Evidence
            </p>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
              {evaluation.linkedEvidence &&
              evaluation.linkedEvidence.length > 0 ? (
                <div className="space-y-2.5">
                  {evaluation.linkedEvidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                          <GraduationCap className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">
                            {ev.title}
                          </span>
                          <span className="ml-1.5 text-[10px] font-medium text-slate-400">
                            ({ev.source})
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">
                        {ev.dateCompleted}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-slate-500">
                  No authorized Competency, Learning, Training, or other
                  cross-module evidence is linked to this evaluation. Missing
                  evidence does not block the review or become a zero score.
                </p>
              )}
            </div>
          </div>
          {((evaluation.assignmentHistory?.length ?? 0) > 0 ||
            (evaluation.revisionHistory?.length ?? 0) > 0) && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Audit History
              </p>
              <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
                {evaluation.assignmentHistory?.map((record, index) => (
                  <div
                    key={`assignment-${index}`}
                    className="border-b border-slate-100 pb-2 text-xs last:border-0 last:pb-0"
                  >
                    <p className="font-semibold text-slate-800">
                      Evaluator reassigned by {record.actor}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {getPersonById(record.fromEvaluatorId)?.fullName ??
                        record.fromEvaluatorId}{" "}
                      →{" "}
                      {getPersonById(record.toEvaluatorId)?.fullName ??
                        record.toEvaluatorId}{" "}
                      · {new Date(record.timestamp).toLocaleString()}
                    </p>
                    <p className="mt-1 text-slate-600">
                      Reason: {record.reason}
                    </p>
                  </div>
                ))}
                {evaluation.revisionHistory?.map((record, index) => (
                  <div
                    key={`revision-${index}`}
                    className="border-b border-slate-100 pb-2 text-xs last:border-0 last:pb-0"
                  >
                    <p className="font-semibold text-slate-800">
                      Evaluation reopened by {record.actor}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {new Date(record.timestamp).toLocaleString()}
                    </p>
                    <p className="mt-1 text-slate-600">
                      Reason: {record.reason}
                      {record.notes ? ` · ${record.notes}` : ""}
                    </p>
                    {record.snapshot && (
                      <p className="mt-1 text-slate-500">
                        Preserved version {record.version}:{" "}
                        {record.snapshot.rating ?? "Unrated"} / 5 ·{" "}
                        {record.snapshot.competencyScores.length} criteria
                      </p>
                    )}
                  </div>
                ))}
                {evaluation.calibrationHistory?.map((record, index) => (
                  <div
                    key={`calibration-${index}`}
                    className="border-b border-slate-100 pb-2 text-xs last:border-0 last:pb-0"
                  >
                    <p className="font-semibold text-slate-800">
                      Calibration: {record.action}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {record.actor} ·{" "}
                      {new Date(record.timestamp).toLocaleString()}
                    </p>
                    {record.notes && (
                      <p className="mt-1 text-slate-600">{record.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          {canManage && workflowState === "Calibration Pending" && (
            <>
              <button
                onClick={onReturnCalibration}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
              >
                Return for Revision
              </button>
              <button
                onClick={onApproveCalibration}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"
              >
                Approve &amp; Finalize
              </button>
            </>
          )}
          {canManage && (
            <button
              onClick={onReassign}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reassign Evaluator
            </button>
          )}
          {canManage && evaluation.status === "Completed" && (
            <button
              onClick={onReopen}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              Reopen / Request Revision
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl bg-[#121212] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a2a2a]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Performance Distribution & Top Performers                              */
/* ---------------------------------------------------------------------- */

function PerformanceDistributionChart({
  data,
  total,
}: {
  data: {
    key: string;
    label: string;
    count: number;
    color: string;
  }[];
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <BarChart3 className="h-6 w-6 text-slate-300" />
        <p className="text-xs text-slate-400">
          No performance records match the selected filters.
        </p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        const widthPct = Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0);
        return (
          <div key={d.key} className="group">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600">{d.label}</span>
              <span className="font-semibold text-slate-800">
                {d.count}{" "}
                <span className="font-normal text-slate-400">({pct}%)</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${widthPct}%`, backgroundColor: d.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Ranked = { evaluation: Evaluation; person: PersonnelIdentity };

function TopPerformerPortraits({
  performers,
  onSelect,
}: {
  performers: Ranked[];
  onSelect: (row: Ranked) => void;
}) {
  if (performers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Trophy className="h-6 w-6 text-slate-300" />
        <p className="text-xs text-slate-400">
          No performance records match the selected filters.
        </p>
      </div>
    );
  }
  const displayList = performers.slice(0, 3);
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {displayList.map(({ evaluation, person }, idx) => (
        <button
          key={evaluation.id}
          type="button"
          onClick={() => onSelect({ evaluation, person })}
          className="group relative flex flex-col items-center rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-3 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
        >
          <span className="absolute -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F4B400] text-[10px] font-extrabold text-black shadow-sm">
            #{idx + 1}
          </span>
          <div
            className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner"
            style={{ backgroundColor: colorForId(person.id) }}
          >
            {initialsFor(person.fullName)}
          </div>
          <div className="mt-2.5 w-full min-w-0">
            <p className="truncate text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
              {person.fullName}
            </p>
            <p className="truncate text-[10px] text-slate-400 mt-0.5">
              {person.department}
            </p>
            <div className="mt-2 flex items-center justify-center gap-1 bg-amber-50/80 rounded-md py-1 px-1.5 border border-amber-100/50">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-800">
                {evaluation.rating?.toFixed(1)}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

type ResolvedEvaluationRow = {
  evaluation: Evaluation;
  person: PersonnelIdentity;
  evaluator: PersonnelIdentity | undefined;
};

function EvaluationRecordsTable({
  title,
  rows,
  periods,
  onSelect,
}: {
  title: string;
  rows: ResolvedEvaluationRow[];
  periods: EvaluationPeriod[];
  onSelect: (row: ResolvedEvaluationRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Select any row to open the complete review record.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-slate-500">
          No {title.toLowerCase()} match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Person",
                  "Department",
                  "Performance Cycle",
                  "Evaluator",
                  "Rating",
                  "Status",
                  "Due Date",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr
                  key={row.evaluation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(row);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none"
                  aria-label={`Open evaluation for ${row.person.fullName}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: colorForId(row.person.id) }}
                      >
                        {initialsFor(row.person.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="whitespace-nowrap text-xs font-semibold text-slate-800">
                          {row.person.fullName}
                        </p>
                        <p className="whitespace-nowrap text-[11px] text-slate-400">
                          {row.person.position} ·{" "}
                          {row.person.employeeOrTraineeId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {row.person.department}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {periods.find(
                      (period) => period.id === row.evaluation.periodId,
                    )?.cycleName ?? "Unknown cycle"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                    <p className="font-semibold">
                      {row.evaluator?.fullName ?? "Unassigned"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {row.evaluator?.position ?? "Needs assignment"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-700">
                    {row.evaluation.rating !== null
                      ? `${row.evaluation.rating.toFixed(1)} / 5`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <EvaluationStatusBadge evaluation={row.evaluation} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {row.evaluation.status === "Completed"
                      ? "—"
                      : (row.evaluation.dueDate ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Main Component                                                         */
/* ---------------------------------------------------------------------- */

export default function PerformanceManagement() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [developmentStore, setDevelopmentStore] =
    useState<PerformanceDevelopmentStore>(
      { feedbackRecords: [], pips: [], traineeJourneys: [] },
    );
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [assignments, setAssignments] = useState<EvaluatorAssignment[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [periodFilter, setPeriodFilter] = useState("All Periods");
  const [levelFilter, setLevelFilter] = useState("All Rating Levels");
  const [activeCard, setActiveCard] = useState<OverviewCardKey>("activeCycle");
  const [workspaceTab, setWorkspaceTab] =
    useState<PerformanceWorkspaceTab>("Overview");
  const [evaluatorFilter, setEvaluatorFilter] = useState("");
  const [selected, setSelected] = useState<Ranked | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<FormState | null>(null);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [showAllPerformers, setShowAllPerformers] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [managementTab, setManagementTab] = useState<"assignments" | "cycles">(
    "assignments",
  );
  const [formError, setFormError] = useState("");
  const [reassignTarget, setReassignTarget] = useState<Evaluation | null>(null);
  const [reassignEvaluatorId, setReassignEvaluatorId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [revisionTarget, setRevisionTarget] = useState<Evaluation | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [reviewTemplates, setReviewTemplates] = useState<ReviewTemplate[]>([]);
  const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoal[]>([]);
  const [showGoalBuilder, setShowGoalBuilder] = useState(false);
  const [goalDraftError, setGoalDraftError] = useState("");
  const [goalTemplateDraft, setGoalTemplateDraft] = useState<GoalTemplateDraft>(
    {
      name: "",
      applicable: "Employee",
      department: "",
      position: "",
      cycleId: "period-q3-2026",
      description: "",
      items: [newGoalTemplateItem(0)],
    },
  );
  const [assignmentDraft, setAssignmentDraft] = useState<{
    evaluatorId: string;
    scopeType: AssignmentScopeType;
    department: string;
    personId: string;
  }>({
    evaluatorId: "user-gen-10",
    scopeType: "Specific Person",
    department: "Finance",
    personId: "",
  });
  const [periodDraft, setPeriodDraft] = useState<{
    cycleName: string;
    cycleType: PerformanceCycleType;
    performanceStartDate: string;
    performanceEndDate: string;
    reviewOpenDate: string;
    reviewDueDate: string;
    applicable: "Both" | PersonnelIdentity["personType"];
    department: string;
    employeeReviewTemplateId: string;
    traineeReviewTemplateId: string;
    selfEvaluationEnabled: boolean;
    selfRatingEnabled: boolean;
    calibrationRequired: boolean;
    employeeAcknowledgment: EmployeeAcknowledgmentMode;
    probationaryMilestoneMonths: number;
    status: EvaluationPeriodStatus;
    description: string;
    instructions: string;
  }>({
    cycleName: "",
    cycleType: "Quarterly",
    performanceStartDate: "",
    performanceEndDate: "",
    reviewOpenDate: "",
    reviewDueDate: "",
    applicable: "Both",
    department: "",
    employeeReviewTemplateId: "review-template-employee-standard",
    traineeReviewTemplateId: "review-template-trainee-standard",
    selfEvaluationEnabled: false,
    selfRatingEnabled: false,
    calibrationRequired: false,
    employeeAcknowledgment: "Optional",
    probationaryMilestoneMonths: 3,
    status: "Draft",
    description: "",
    instructions: "",
  });
  const [cycleDraftError, setCycleDraftError] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState<{
    personId: string;
    recordType: FeedbackRecordType;
    note: string;
    coachingAction: string;
    followUpDate: string;
    visibility: FeedbackVisibility;
  }>({
    personId: "",
    recordType: "1:1 Check-in",
    note: "",
    coachingAction: "",
    followUpDate: "",
    visibility: "Employee & Manager",
  });
  const [pipDraft, setPipDraft] = useState({
    personId: "",
    relatedReviewId: "",
    performanceConcern: "",
    expectedImprovement: "",
    actionItem: "",
    startDate: "",
    targetEndDate: "",
    assignedManagerId: "",
    firstMilestone: "",
    firstMilestoneDate: "",
    developmentActionSource: "Learning" as
      "Learning" | "Training" | "Competency",
    developmentActionTitle: "",
  });
  const [pipProgressDrafts, setPipProgressDrafts] = useState<
    Record<string, string>
  >({});
  const [pipHrNoteDrafts, setPipHrNoteDrafts] = useState<
    Record<string, string>
  >({});
  const [phase4Message, setPhase4Message] = useState("");
  const [analyticsFilters, setAnalyticsFilters] =
    useState<PerformanceAnalyticsFilters>({
      cycleId: DEFAULT_ANALYTICS_CYCLE_ID,
      department: ALL_ANALYTICS_DEPARTMENTS,
      personType: "Employee",
      reviewTemplateId: "review-template-employee-standard",
      evaluatorId: ALL_ANALYTICS_EVALUATORS,
    });
  const [groqUseCase, setGroqUseCase] = useState<GroqPerformanceUseCase>(
    "Development Recommendation Draft",
  );
  const [preparedGroqContext, setPreparedGroqContext] =
    useState<PreparedGroqPerformanceContext | null>(null);
  const [groqDraft, setGroqDraft] = useState("");
  const [groqDraftLoading, setGroqDraftLoading] = useState(false);
  const [groqDraftError, setGroqDraftError] = useState("");
  const authUser = usePage().props.auth.user as {
    name?: string;
    role?: "admin" | "hr" | "user";
    personnel_key?: string | null;
  };
  const backend = usePerformanceBackendBridge({
    reviews: evaluations,
    setReviews: setEvaluations,
    development: developmentStore,
    setDevelopment: setDevelopmentStore,
    cycles: periods,
    setCycles: setPeriods,
    assignments,
    setAssignments,
    goalTemplates,
    setGoalTemplates,
    goals: performanceGoals,
    setGoals: setPerformanceGoals,
    reviewTemplates,
    setReviewTemplates,
  });
  const currentActorId =
    backend.actor?.personnelKey ?? authUser.personnel_key ?? "";
  const currentActor = currentActorId
    ? getPersonById(currentActorId)
    : undefined;
  const currentActorLabel =
    backend.actor?.name ??
    authUser.name ??
    currentActor?.fullName ??
    "Current user";
  const canManagePerformance =
    backend.actor?.capabilities.operatePerformance ??
    (authUser.role === "admin" || authUser.role === "hr");
  const canConfigurePerformance =
    backend.actor?.capabilities.configurePerformance ??
    authUser.role === "admin";

  // Departments come from the shared personnel source, not from Performance's own records.
  const departments = useMemo(
    () => Array.from(new Set(SHARED_PERSONNEL.map((p) => p.department))).sort(),
    [periods],
  );
  const positions = useMemo(
    () => Array.from(new Set(SHARED_PERSONNEL.map((p) => p.position))).sort(),
    [periods],
  );

  // Every evaluation is resolved against the shared personnel source. If a referenced person can no
  // longer be found there, the evaluation is dropped rather than shown with fabricated identity data.
  const resolvedEvaluations = useMemo(() => {
    return evaluations
      .map((evaluation) => ({
        evaluation,
        person: getPersonById(evaluation.personId),
        evaluator: getPersonById(evaluation.evaluatorId),
      }))
      .filter(
        (
          row,
        ): row is {
          evaluation: Evaluation;
          person: PersonnelIdentity;
          evaluator: PersonnelIdentity | undefined;
        } => !!row.person,
      );
  }, [evaluations]);

  const filtersActive =
    statusFilter !== "All" ||
    departmentFilter !== "All Departments" ||
    periodFilter !== "All Periods" ||
    levelFilter !== "All Rating Levels" ||
    evaluatorFilter !== "";

  const filteredRows = useMemo(() => {
    return resolvedEvaluations.filter(({ evaluation, person }) => {
      const displayStatus = getDisplayStatus(evaluation);
      const matchesStatus =
        statusFilter === "All" || displayStatus === statusFilter;
      const matchesDepartment =
        departmentFilter === "All Departments" ||
        person.department === departmentFilter;
      const matchesPeriod =
        periodFilter === "All Periods" || evaluation.periodId === periodFilter;
      const rowLevel = getPerformanceLevel(evaluation.rating);
      const matchesLevel =
        levelFilter === "All Rating Levels" || rowLevel?.label === levelFilter;
      const matchesEvaluator =
        evaluatorFilter === "" || evaluation.evaluatorId === evaluatorFilter;
      return (
        matchesStatus &&
        matchesDepartment &&
        matchesPeriod &&
        matchesLevel &&
        matchesEvaluator
      );
    });
  }, [
    resolvedEvaluations,
    statusFilter,
    departmentFilter,
    periodFilter,
    levelFilter,
    evaluatorFilter,
  ]);

  const traineeRows = useMemo(
    () => filteredRows.filter((r) => r.person.personType === "Trainee"),
    [filteredRows],
  );
  const employeeRows = useMemo(
    () => filteredRows.filter((r) => r.person.personType === "Employee"),
    [filteredRows],
  );

  const analyticsResolvedRows = useMemo<ResolvedPerformanceReview[]>(
    () =>
      resolvedEvaluations.map(({ evaluation, person, evaluator }) => ({
        review: evaluation,
        person,
        evaluator,
      })),
    [resolvedEvaluations],
  );
  const analyticsRows = useMemo(
    () =>
      applyPerformanceAnalyticsFilters(analyticsResolvedRows, analyticsFilters),
    [analyticsFilters, analyticsResolvedRows],
  );
  const completionAnalytics = useMemo(
    () => getReviewCompletionAnalytics(analyticsRows),
    [analyticsRows],
  );
  const ratingDistribution = useMemo(
    () => getAccurateRatingDistribution(analyticsRows),
    [analyticsRows],
  );
  const finalizedAnalyticsRows = useMemo(
    () => analyticsRows.filter(({ review }) => isFinalizedRatedReview(review)),
    [analyticsRows],
  );
  const topPerformanceResults = useMemo(
    () =>
      getComparableTopPerformanceResults(
        analyticsRows,
        analyticsFilters,
        periods,
        50,
      ),
    [analyticsFilters, analyticsRows, periods],
  );
  const topPerformers = useMemo<Ranked[]>(
    () =>
      topPerformanceResults.rows.map(({ review, person }) => ({
        evaluation: review,
        person,
      })),
    [topPerformanceResults],
  );
  const needsPerformanceSupport = useMemo(
    () =>
      getNeedsPerformanceSupport(
        analyticsRows,
        performanceGoals,
        developmentStore,
        periods,
      ),
    [analyticsRows, developmentStore, performanceGoals, periods],
  );
  const goalTrendAnalytics = useMemo(
    () =>
      getGoalTrendAnalytics(
        performanceGoals,
        SHARED_PERSONNEL,
        periods,
        analyticsFilters,
      ),
    [analyticsFilters, performanceGoals, periods],
  );
  const departmentTrendAnalytics = useMemo(
    () =>
      getDepartmentTrendAnalytics(
        analyticsResolvedRows,
        performanceGoals,
        SHARED_PERSONNEL,
        developmentStore,
        periods,
        analyticsFilters,
      ),
    [
      analyticsFilters,
      analyticsResolvedRows,
      developmentStore,
      performanceGoals,
      periods,
    ],
  );
  const evaluatorCalibrationAnalytics = useMemo(
    () => getEvaluatorCalibrationAnalytics(analyticsRows),
    [analyticsRows],
  );
  const analyticsAverageRating = useMemo(
    () =>
      finalizedAnalyticsRows.length
        ? finalizedAnalyticsRows.reduce(
            (total, row) => total + (row.review.rating ?? 0),
            0,
          ) / finalizedAnalyticsRows.length
        : null,
    [finalizedAnalyticsRows],
  );

  const activePeriod = useMemo(
    () => getActiveEvaluationPeriod(periods),
    [periods],
  );
  const cycleAssignmentPreviews = useMemo(
    () =>
      new Map(
        periods.map((cycle) => [
          cycle.id,
          prepareCycleReviewAssignments(cycle, assignments),
        ]),
      ),
    [assignments, periods],
  );
  const activeGoalRows = useMemo(
    () =>
      performanceGoals.filter(
        (goal) => !activePeriod || goal.cycleId === activePeriod.id,
      ),
    [activePeriod, performanceGoals],
  );
  const activeCycleRows = useMemo(
    () =>
      activePeriod
        ? resolvedEvaluations.filter(
            ({ evaluation }) => evaluation.periodId === activePeriod.id,
          )
        : [],
    [activePeriod, resolvedEvaluations],
  );
  const overviewStats = useMemo(() => {
    const completed = activeCycleRows.filter(
      ({ evaluation }) => evaluation.status === "Completed",
    ).length;
    const overdue = activeCycleRows.filter(
      ({ evaluation }) => getDisplayStatus(evaluation) === "Overdue",
    ).length;
    const pending = activeCycleRows.filter(
      ({ evaluation }) => evaluation.status === "Pending",
    ).length;
    const completion = activeCycleRows.length
      ? Math.round((completed / activeCycleRows.length) * 100)
      : 0;
    return [
      {
        key: "activeCycle" as OverviewCardKey,
        label: "Active Review Cycle",
        value: activePeriod?.cycleName ?? "No active cycle",
        meta: activePeriod
          ? `Due ${activePeriod.reviewDueDate}`
          : "Configuration required",
        icon: CalendarDays,
      },
      {
        key: "completion" as OverviewCardKey,
        label: "Review Completion",
        value: `${completion}%`,
        meta: `${completed} of ${activeCycleRows.length} completed`,
        icon: CheckCircle2,
      },
      {
        key: "actionNeeded" as OverviewCardKey,
        label: "Action Needed",
        value: overdue + pending,
        meta: `${overdue} overdue · ${pending} pending`,
        icon: AlertTriangle,
      },
      {
        key: "openPips" as OverviewCardKey,
        label: "Open PIPs",
        value: getOpenPipCount(developmentStore.pips),
        meta: "Human-managed improvement plans requiring follow-through",
        icon: TrendingUp,
      },
    ];
  }, [activeCycleRows, activePeriod, developmentStore.pips]);

  const evaluatorProgress = useMemo(() => {
    const evaluatorIds = Array.from(
      new Set([
        ...assignments.map((assignment) => assignment.evaluatorId),
        ...activeCycleRows.map(({ evaluation }) => evaluation.evaluatorId),
      ]),
    );
    return evaluatorIds
      .map((evaluatorId) => {
        const evaluator = getPersonById(evaluatorId);
        if (!evaluator) return null;
        const workload = activeCycleRows.filter(
          ({ evaluation }) => evaluation.evaluatorId === evaluatorId,
        );
        const completed = workload.filter(
          ({ evaluation }) => evaluation.status === "Completed",
        ).length;
        const inProgress = workload.filter(
          ({ evaluation }) => evaluation.status === "In Progress",
        ).length;
        const overdue = workload.filter(
          ({ evaluation }) => getDisplayStatus(evaluation) === "Overdue",
        ).length;
        const pending = workload.filter(
          ({ evaluation }) => evaluation.status === "Pending",
        ).length;
        return {
          evaluator,
          assigned: workload.length,
          completed,
          inProgress,
          pending,
          overdue,
          progress: workload.length
            ? Math.round((completed / workload.length) * 100)
            : 0,
          scope:
            getEvaluatorScopeLabels(evaluatorId, assignments).join(" · ") ||
            "No active assignment",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort(
        (a, b) =>
          b.assigned - a.assigned ||
          a.evaluator.fullName.localeCompare(b.evaluator.fullName),
      );
  }, [activeCycleRows, assignments]);
  const currentActorScopes = useMemo(
    () => getEvaluatorScopeLabels(currentActorId, assignments),
    [assignments],
  );
  const assignedEligiblePeople = useMemo(() => {
    if (!activePeriod) return [];
    return getEligiblePeopleForEvaluator(currentActorId, {
      periodId: activePeriod.id,
      periods,
      assignments,
    }).filter(
      (person) =>
        !evaluations.some(
          (evaluation) =>
            evaluation.personId === person.id &&
            evaluation.periodId === activePeriod.id &&
            getPersonById(evaluation.personId)?.personType ===
              person.personType,
        ),
    );
  }, [activePeriod, assignments, evaluations, periods]);

  const searchedPeople = useMemo(() => {
    const q = personSearchQuery.trim().toLowerCase();
    if (!q) return assignedEligiblePeople;
    return assignedEligiblePeople.filter(
      (person) =>
        person.fullName.toLowerCase().includes(q) ||
        person.department.toLowerCase().includes(q) ||
        person.employeeOrTraineeId.toLowerCase().includes(q),
    );
  }, [assignedEligiblePeople, personSearchQuery]);

  const selectedFormPerson = form?.personId
    ? getPersonById(form.personId)
    : undefined;
  const formCriteria = useMemo(
    () => criteriaForPerson(selectedFormPerson),
    [selectedFormPerson],
  );
  const currentFormAvg = form ? averageScore(form.scores) : null;

  function resetFilters() {
    setStatusFilter("All");
    setDepartmentFilter("All Departments");
    setPeriodFilter("All Periods");
    setLevelFilter("All Rating Levels");
    setEvaluatorFilter("");
  }

  function handleCardClick(key: OverviewCardKey) {
    setActiveCard(key);
    if (key === "activeCycle") {
      setWorkspaceTab("Review Cycles");
    } else if (key === "completion") {
      setWorkspaceTab("Overview");
    } else if (key === "actionNeeded") {
      setStatusFilter(
        activeCycleRows.some(
          ({ evaluation }) => getDisplayStatus(evaluation) === "Overdue",
        )
          ? "Overdue"
          : "Pending",
      );
      setPeriodFilter(activePeriod?.id ?? "All Periods");
      setWorkspaceTab("Evaluations");
    } else if (key === "openPips") {
      setWorkspaceTab("Performance Improvement");
    }
  }

  function openCreateForm() {
    const period = getActiveEvaluationPeriod(periods);
    setFormMode("create");
    setForm(emptyForm(period?.id ?? "", currentActorId));
    setPersonSearchQuery("");
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(null);
    setFormError("");
  }

  function createEvaluation(startNow: boolean) {
    if (
      !form ||
      !form.personId ||
      !activePeriod ||
      form.periodId !== activePeriod.id
    ) {
      setFormError(
        "Select an eligible assigned person in the active evaluation period.",
      );
      return;
    }
    const person = getPersonById(form.personId);
    if (
      !person ||
      !canEvaluate(currentActorId, person.id, {
        periodId: activePeriod.id,
        periods,
        assignments,
      })
    ) {
      setFormError("This person is outside your current evaluator assignment.");
      return;
    }
    const duplicate = evaluations.some(
      (evaluation) =>
        evaluation.personId === person.id &&
        evaluation.periodId === activePeriod.id &&
        getPersonById(evaluation.personId)?.personType === person.personType,
    );
    if (duplicate) {
      setFormError(
        "A primary evaluation already exists for this person, period, and person type.",
      );
      return;
    }
    const id = `eval-${Date.now()}`;
    const newEvaluation: Evaluation = {
      id,
      personId: person.id,
      evaluatorId: currentActorId,
      periodId: activePeriod.id,
      reviewTemplateId: activePeriod.reviewTemplateIds[person.personType],
      rating: null,
      status: startNow ? "In Progress" : "Pending",
      dueDate: activePeriod.reviewDueDate,
      linkedEvidence: [],
    };
    setEvaluations((previous) => [newEvaluation, ...previous]);
    if (startNow) {
      setFormMode("edit");
      setForm({
        ...form,
        id,
        scores: Object.fromEntries(
          criteriaForPerson(person).map((criterion) => [criterion.name, 0]),
        ),
      });
      setFormError("");
      return;
    }
    closeForm();
  }

  function persistEvaluation(complete: boolean) {
    if (!form || !form.id || !selectedFormPerson) return;
    const criteria = criteriaForPerson(selectedFormPerson);
    const scores = criteria.map((criterion) => ({
      name: criterion.name,
      score: form.scores[criterion.name] ?? 0,
    }));
    if (complete && scores.some((score) => score.score <= 0)) {
      setFormError("Rate every criterion before submitting the evaluation.");
      return;
    }
    const recommendations = [
      ...form.developmentRecommendations.filter(
        (recommendation) => recommendation !== "Other",
      ),
      ...(form.otherRecommendation.trim()
        ? [form.otherRecommendation.trim()]
        : []),
    ];
    const rating = averageScore(form.scores);
    const cycle = periods.find((period) => period.id === form.periodId);
    const requiresCalibration = complete && !!cycle?.calibrationRequired;
    const timestamp = new Date().toISOString();
    setEvaluations((previous) =>
      previous.map((evaluation) =>
        evaluation.id === form.id
          ? {
              ...evaluation,
              status:
                complete && !requiresCalibration ? "Completed" : "In Progress",
              dateEvaluated:
                complete && !requiresCalibration
                  ? todayLabel()
                  : evaluation.dateEvaluated,
              managerSubmittedAt: complete
                ? timestamp
                : evaluation.managerSubmittedAt,
              finalizedAt:
                complete && !requiresCalibration ? timestamp : undefined,
              workflowState: complete
                ? requiresCalibration
                  ? "Calibration Pending"
                  : "Finalized"
                : "Manager Review",
              calibrationStatus: complete
                ? requiresCalibration
                  ? "Pending"
                  : "Not Required"
                : evaluation.calibrationStatus,
              calibrationHistory: requiresCalibration
                ? [
                    ...(evaluation.calibrationHistory ?? []),
                    {
                      action: "Submitted" as const,
                      actor: currentActorLabel,
                      timestamp,
                      notes:
                        "Manager review submitted for required calibration.",
                    },
                  ]
                : evaluation.calibrationHistory,
              rating: complete ? rating : evaluation.rating,
              competencyScores: scores.filter((score) => score.score > 0),
              comments: form.comments.trim() || undefined,
              developmentRecommendations: recommendations,
            }
          : evaluation,
      ),
    );
    closeForm();
  }

  function openReassignment(evaluation: Evaluation) {
    setSelected(null);
    setReassignTarget(evaluation);
    setReassignEvaluatorId("");
    setReassignReason("");
  }

  function confirmReassignment() {
    if (!reassignTarget || !reassignEvaluatorId || !reassignReason.trim())
      return;
    const authorized = canEvaluate(
      reassignEvaluatorId,
      reassignTarget.personId,
      {
        periodId: reassignTarget.periodId,
        periods,
        assignments,
        requireActivePeriod: false,
      },
    );
    if (!authorized || reassignEvaluatorId === reassignTarget.personId) return;
    const record: ReassignmentRecord = {
      fromEvaluatorId: reassignTarget.evaluatorId,
      toEvaluatorId: reassignEvaluatorId,
      reason: reassignReason.trim(),
      actor: currentActorLabel,
      timestamp: new Date().toISOString(),
    };
    setEvaluations((previous) =>
      previous.map((evaluation) =>
        evaluation.id === reassignTarget.id
          ? {
              ...evaluation,
              evaluatorId: reassignEvaluatorId,
              assignmentHistory: [
                ...(evaluation.assignmentHistory ?? []),
                record,
              ],
            }
          : evaluation,
      ),
    );
    setReassignTarget(null);
  }

  function confirmRevision() {
    if (!revisionTarget || !revisionReason.trim()) return;
    const record: CompletedReviewRevisionRecord = {
      action: "Reopened",
      version: (revisionTarget.revisionHistory?.length ?? 0) + 1,
      reason: revisionReason.trim(),
      notes: revisionNotes.trim() || undefined,
      actor: currentActorLabel,
      timestamp: new Date().toISOString(),
      snapshot: createReviewRevisionSnapshot(revisionTarget),
    };
    setEvaluations((previous) =>
      previous.map((evaluation) =>
        evaluation.id === revisionTarget.id
          ? {
              ...evaluation,
              status: "In Progress",
              workflowState: "Revision In Progress",
              calibrationStatus:
                evaluation.calibrationStatus === "Not Required"
                  ? "Not Required"
                  : "Returned for Revision",
              finalizedAt: undefined,
              acknowledgment: undefined,
              revisionHistory: [...(evaluation.revisionHistory ?? []), record],
            }
          : evaluation,
      ),
    );
    setRevisionTarget(null);
    setSelected(null);
  }

  function approveCalibration(evaluationId: string) {
    const timestamp = new Date().toISOString();
    const record: CalibrationHistoryRecord = {
      action: "Approved",
      actor: currentActorLabel,
      timestamp,
      notes: "Required calibration review completed; formal result finalized.",
    };
    setEvaluations((previous) =>
      previous.map((evaluation) =>
        evaluation.id === evaluationId &&
        getReviewWorkflowState(
          evaluation,
          periods.find((period) => period.id === evaluation.periodId)
            ?.calibrationRequired,
        ) === "Calibration Pending"
          ? {
              ...evaluation,
              status: "Completed",
              workflowState: "Finalized",
              calibrationStatus: "Approved",
              dateEvaluated: todayLabel(),
              finalizedAt: timestamp,
              calibrationHistory: [
                ...(evaluation.calibrationHistory ?? []),
                record,
              ],
            }
          : evaluation,
      ),
    );
    setSelected(null);
  }

  function returnCalibrationForRevision(evaluationId: string) {
    const target = evaluations.find(
      (evaluation) => evaluation.id === evaluationId,
    );
    if (!target) return;
    const timestamp = new Date().toISOString();
    const revision: CompletedReviewRevisionRecord = {
      action: "Revision Requested",
      version: (target.revisionHistory?.length ?? 0) + 1,
      reason: "Returned during required calibration review.",
      actor: currentActorLabel,
      timestamp,
      snapshot: createReviewRevisionSnapshot(target),
    };
    const calibration: CalibrationHistoryRecord = {
      action: "Returned for Revision",
      actor: currentActorLabel,
      timestamp,
      notes: "Evaluator must revise and resubmit before finalization.",
    };
    setEvaluations((previous) =>
      previous.map((evaluation) =>
        evaluation.id === evaluationId
          ? {
              ...evaluation,
              status: "In Progress",
              workflowState: "Revision In Progress",
              calibrationStatus: "Returned for Revision",
              finalizedAt: undefined,
              revisionHistory: [
                ...(evaluation.revisionHistory ?? []),
                revision,
              ],
              calibrationHistory: [
                ...(evaluation.calibrationHistory ?? []),
                calibration,
              ],
            }
          : evaluation,
      ),
    );
    setSelected(null);
  }

  function addAssignment() {
    const evaluator = getPersonById(assignmentDraft.evaluatorId);
    if (!evaluator) return;
    const candidate: EvaluatorAssignment = {
      id: `assignment-${Date.now()}`,
      evaluatorId: evaluator.id,
      scopeType: assignmentDraft.scopeType,
      department:
        assignmentDraft.scopeType === "Department"
          ? assignmentDraft.department
          : undefined,
      personId:
        assignmentDraft.scopeType === "Specific Person"
          ? assignmentDraft.personId
          : undefined,
      isPrimaryEvaluator: true,
      createdBy: currentActorLabel,
      createdAt: new Date().toISOString(),
    };
    if (
      (candidate.scopeType === "Department" && !candidate.department) ||
      (candidate.scopeType === "Specific Person" && !candidate.personId)
    )
      return;
    if (
      candidate.personId === candidate.evaluatorId ||
      hasPrimaryAssignmentConflict(candidate, assignments)
    )
      return;
    setAssignments((previous) => [...previous, candidate]);
  }

  function addPeriod() {
    setCycleDraftError("");
    if (
      !periodDraft.cycleName.trim() ||
      !periodDraft.performanceStartDate ||
      !periodDraft.performanceEndDate ||
      !periodDraft.reviewOpenDate ||
      !periodDraft.reviewDueDate
    ) {
      setCycleDraftError(
        "Cycle name and all performance/review dates are required.",
      );
      return;
    }
    if (
      periodDraft.performanceEndDate < periodDraft.performanceStartDate ||
      periodDraft.reviewOpenDate < periodDraft.performanceEndDate ||
      periodDraft.reviewDueDate < periodDraft.reviewOpenDate
    ) {
      setCycleDraftError(
        "Use a valid sequence: performance start/end, review open, then review due.",
      );
      return;
    }
    if (
      periodDraft.cycleType === "Probationary" &&
      periodDraft.probationaryMilestoneMonths < 1
    ) {
      setCycleDraftError(
        "Probationary cycles need a milestone of at least one month.",
      );
      return;
    }
    const newPeriod: EvaluationPeriod = {
      id: `cycle-${Date.now()}`,
      cycleName: periodDraft.cycleName.trim(),
      cycleType: periodDraft.cycleType,
      performanceStartDate: periodDraft.performanceStartDate,
      performanceEndDate: periodDraft.performanceEndDate,
      reviewOpenDate: periodDraft.reviewOpenDate,
      reviewDueDate: periodDraft.reviewDueDate,
      applicablePersonTypes:
        periodDraft.applicable === "Both"
          ? ["Employee", "Trainee"]
          : [periodDraft.applicable],
      departmentScopes: periodDraft.department ? [periodDraft.department] : [],
      reviewTemplateIds: {
        ...(periodDraft.applicable !== "Trainee"
          ? { Employee: periodDraft.employeeReviewTemplateId }
          : {}),
        ...(periodDraft.applicable !== "Employee"
          ? { Trainee: periodDraft.traineeReviewTemplateId }
          : {}),
      },
      selfEvaluationEnabled: periodDraft.selfEvaluationEnabled,
      selfRatingEnabled:
        periodDraft.selfEvaluationEnabled && periodDraft.selfRatingEnabled,
      calibrationRequired: periodDraft.calibrationRequired,
      employeeAcknowledgment: periodDraft.employeeAcknowledgment,
      probationaryMilestoneMonths:
        periodDraft.cycleType === "Probationary"
          ? periodDraft.probationaryMilestoneMonths
          : undefined,
      status: periodDraft.status,
      description: periodDraft.description.trim() || undefined,
      instructions: periodDraft.instructions.trim() || undefined,
    };
    setPeriods((previous) => [
      ...previous.map((period) =>
        newPeriod.status === "Active" && period.status === "Active"
          ? { ...period, status: "Draft" as const }
          : period,
      ),
      newPeriod,
    ]);
    setPeriodDraft({
      cycleName: "",
      cycleType: "Quarterly",
      performanceStartDate: "",
      performanceEndDate: "",
      reviewOpenDate: "",
      reviewDueDate: "",
      applicable: "Both",
      department: "",
      employeeReviewTemplateId: "review-template-employee-standard",
      traineeReviewTemplateId: "review-template-trainee-standard",
      selfEvaluationEnabled: false,
      selfRatingEnabled: false,
      calibrationRequired: false,
      employeeAcknowledgment: "Optional",
      probationaryMilestoneMonths: 3,
      status: "Draft",
      description: "",
      instructions: "",
    });
  }

  function addGoalTemplate() {
    setGoalDraftError("");
    const candidate: GoalTemplate = {
      id: `goal-template-${Date.now()}`,
      name: goalTemplateDraft.name.trim(),
      applicablePersonTypes:
        goalTemplateDraft.applicable === "Both"
          ? ["Employee", "Trainee"]
          : [goalTemplateDraft.applicable],
      departmentScopes: goalTemplateDraft.department
        ? [goalTemplateDraft.department]
        : [],
      positionScopes: goalTemplateDraft.position
        ? [goalTemplateDraft.position]
        : [],
      cycleIds: goalTemplateDraft.cycleId ? [goalTemplateDraft.cycleId] : [],
      description: goalTemplateDraft.description.trim() || undefined,
      allowIndividualOverrides: true,
      active: true,
      items: goalTemplateDraft.items.map((item, index) => ({
        ...item,
        id: `${item.id}-${index}`,
        title: item.title.trim(),
        target: item.target.trim(),
        unit: item.unit?.trim() || undefined,
        description: item.description?.trim() || undefined,
      })),
    };
    const errors = validateGoalTemplate(candidate);
    if (errors.length > 0) {
      setGoalDraftError(errors.join(" "));
      return;
    }
    setGoalTemplates((previous) => [candidate, ...previous]);
    setGoalTemplateDraft({
      name: "",
      applicable: "Employee",
      department: "",
      position: "",
      cycleId: activePeriod?.id ?? "",
      description: "",
      items: [newGoalTemplateItem(0)],
    });
    setShowGoalBuilder(false);
  }

  function updatePerformanceGoal(
    goalId: string,
    updates: Partial<Pick<PerformanceGoal, "progress" | "status">>,
  ) {
    setPerformanceGoals((previous) =>
      previous.map((goal) =>
        goal.id === goalId
          ? {
              ...goal,
              ...updates,
              progress:
                updates.progress === undefined
                  ? goal.progress
                  : Math.max(0, Math.min(100, updates.progress)),
            }
          : goal,
      ),
    );
  }

  function prepareContextualGroqDraft(reviewId: string) {
    const row = resolvedEvaluations.find(
      ({ evaluation }) => evaluation.id === reviewId,
    );
    if (!row) return;
    setGroqDraft("");
    setGroqDraftError("");
    setPreparedGroqContext(
      prepareGroqPerformanceContext({
        useCase: groqUseCase,
        review: row.evaluation,
        person: row.person,
        goals: performanceGoals,
        feedback: developmentStore.feedbackRecords,
        pips: developmentStore.pips,
      }),
    );
  }

  async function generatePreparedGroqDraft() {
    if (!preparedGroqContext) return;
    setGroqDraftLoading(true);
    setGroqDraftError("");
    try {
      const response = await requestPerformanceGroqDraft(
        preparedGroqContext.reviewId,
        preparedGroqContext.useCase,
      );
      setGroqDraft(response.draft);
    } catch (error) {
      setGroqDraftError(
        error instanceof Error ? error.message : "Groq draft request failed.",
      );
    } finally {
      setGroqDraftLoading(false);
    }
  }

  function addFeedbackRecord() {
    if (!feedbackDraft.personId || !feedbackDraft.note.trim()) {
      setPhase4Message(
        "Select a person and enter a work-related feedback or coaching note.",
      );
      return;
    }
    const timestamp = new Date().toISOString();
    const relatedReview = evaluations.find(
      (evaluation) =>
        evaluation.personId === feedbackDraft.personId &&
        (!activePeriod || evaluation.periodId === activePeriod.id),
    );
    const linkedGoalIds = performanceGoals
      .filter(
        (goal) =>
          goal.personId === feedbackDraft.personId &&
          (!activePeriod || goal.cycleId === activePeriod.id),
      )
      .map((goal) => goal.id);
    setDevelopmentStore((previous) => ({
      ...previous,
      feedbackRecords: [
        {
          id: `feedback-${Date.now()}`,
          personId: feedbackDraft.personId,
          authorId: currentActorId,
          cycleId: activePeriod?.id,
          relatedReviewId: relatedReview?.id,
          recordType: feedbackDraft.recordType,
          note: feedbackDraft.note.trim(),
          coachingAction: feedbackDraft.coachingAction.trim() || undefined,
          linkedGoalIds,
          followUpDate: feedbackDraft.followUpDate || undefined,
          visibility: feedbackDraft.visibility,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous.feedbackRecords,
      ],
    }));
    setFeedbackDraft({
      personId: "",
      recordType: "1:1 Check-in",
      note: "",
      coachingAction: "",
      followUpDate: "",
      visibility: "Employee & Manager",
    });
    setPhase4Message(
      "Feedback / coaching record saved with author and timestamp.",
    );
  }

  function addPip() {
    const person = getPersonById(pipDraft.personId);
    const review = evaluations.find(
      (evaluation) => evaluation.id === pipDraft.relatedReviewId,
    );
    if (
      !person ||
      !review ||
      review.personId !== person.id ||
      review.status !== "Completed" ||
      !pipDraft.performanceConcern.trim() ||
      !pipDraft.expectedImprovement.trim() ||
      !pipDraft.actionItem.trim() ||
      !pipDraft.startDate ||
      !pipDraft.targetEndDate ||
      !pipDraft.assignedManagerId ||
      pipDraft.targetEndDate < pipDraft.startDate
    ) {
      setPhase4Message(
        "Complete the PIP fields using a finalized review and a valid date range.",
      );
      return;
    }
    const managerAuthorized = canEvaluate(
      pipDraft.assignedManagerId,
      person.id,
      {
        periodId: review.periodId,
        periods,
        assignments,
        requireActivePeriod: false,
      },
    );
    if (!managerAuthorized) {
      setPhase4Message(
        "The assigned manager must have legitimate evaluator authority for this person.",
      );
      return;
    }
    const timestamp = new Date().toISOString();
    setDevelopmentStore((previous) => ({
      ...previous,
      pips: [
        {
          id: `pip-${Date.now()}`,
          personId: person.id,
          relatedReviewId: review.id,
          performanceConcern: pipDraft.performanceConcern.trim(),
          expectedImprovement: pipDraft.expectedImprovement.trim(),
          actionItems: [pipDraft.actionItem.trim()],
          startDate: pipDraft.startDate,
          targetEndDate: pipDraft.targetEndDate,
          assignedManagerId: pipDraft.assignedManagerId,
          status: "Active",
          milestones:
            pipDraft.firstMilestone.trim() && pipDraft.firstMilestoneDate
              ? [
                  {
                    id: `pip-milestone-${Date.now()}`,
                    title: pipDraft.firstMilestone.trim(),
                    dueDate: pipDraft.firstMilestoneDate,
                    status: "Pending",
                  },
                ]
              : [],
          progressNotes: [],
          developmentActions: pipDraft.developmentActionTitle.trim()
            ? [
                {
                  id: `pip-development-${Date.now()}`,
                  source: pipDraft.developmentActionSource,
                  title: pipDraft.developmentActionTitle.trim(),
                  status: "Planned" as const,
                },
              ]
            : [],
          createdBy: currentActorId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous.pips,
      ],
    }));
    setPipDraft({
      personId: "",
      relatedReviewId: "",
      performanceConcern: "",
      expectedImprovement: "",
      actionItem: "",
      startDate: "",
      targetEndDate: "",
      assignedManagerId: "",
      firstMilestone: "",
      firstMilestoneDate: "",
      developmentActionSource: "Learning",
      developmentActionTitle: "",
    });
    setPhase4Message(
      "Performance Improvement Plan created for human manager/HR follow-through.",
    );
  }

  function updatePipStatus(pipId: string, status: PipStatus) {
    const timestamp = new Date().toISOString();
    setDevelopmentStore((previous) => ({
      ...previous,
      pips: previous.pips.map((pip) =>
        pip.id === pipId ? { ...pip, status, updatedAt: timestamp } : pip,
      ),
    }));
  }

  function togglePipMilestone(pipId: string, milestoneId: string) {
    const timestamp = new Date().toISOString();
    setDevelopmentStore((previous) => ({
      ...previous,
      pips: previous.pips.map((pip) =>
        pip.id === pipId
          ? {
              ...pip,
              updatedAt: timestamp,
              milestones: pip.milestones.map((milestone) =>
                milestone.id === milestoneId
                  ? milestone.status === "Completed"
                    ? {
                        ...milestone,
                        status: "Pending" as const,
                        completedAt: undefined,
                      }
                    : {
                        ...milestone,
                        status: "Completed" as const,
                        completedAt: timestamp,
                      }
                  : milestone,
              ),
            }
          : pip,
      ),
    }));
  }

  function addPipProgressNote(pipId: string) {
    const note = pipProgressDrafts[pipId]?.trim();
    if (!note) return;
    const timestamp = new Date().toISOString();
    setDevelopmentStore((previous) => ({
      ...previous,
      pips: previous.pips.map((pip) =>
        pip.id === pipId
          ? {
              ...pip,
              updatedAt: timestamp,
              progressNotes: [
                ...pip.progressNotes,
                {
                  id: `pip-note-${Date.now()}`,
                  authorId: currentActorId,
                  note,
                  createdAt: timestamp,
                },
              ],
            }
          : pip,
      ),
    }));
    setPipProgressDrafts((previous) => ({ ...previous, [pipId]: "" }));
  }

  function savePipHrReviewNote(pipId: string) {
    const note = pipHrNoteDrafts[pipId]?.trim();
    if (!note) return;
    const timestamp = new Date().toISOString();
    setDevelopmentStore((previous) => ({
      ...previous,
      pips: previous.pips.map((pip) =>
        pip.id === pipId
          ? { ...pip, hrReviewNotes: note, updatedAt: timestamp }
          : pip,
      ),
    }));
    setPipHrNoteDrafts((previous) => ({ ...previous, [pipId]: "" }));
  }

  function updateTraineeJourneyStage(
    journeyId: string,
    currentStage: (typeof TRAINEE_JOURNEY_STAGES)[number],
  ) {
    setDevelopmentStore((previous) => ({
      ...previous,
      traineeJourneys: previous.traineeJourneys.map((journey) =>
        journey.id === journeyId
          ? { ...journey, currentStage, updatedAt: new Date().toISOString() }
          : journey,
      ),
    }));
  }

  return (
    <AuthenticatedLayout
      header={
        <h1 className="truncate text-sm font-bold text-slate-900">
          Performance Management
        </h1>
      }
    >
      <Head title="Performance Management" />

      {selected && (
        <EvaluationDetailsModal
          evaluation={selected.evaluation}
          person={selected.person}
          evaluator={getPersonById(selected.evaluation.evaluatorId)}
          period={periods.find(
            (period) => period.id === selected.evaluation.periodId,
          )}
          canManage={canManagePerformance}
          onClose={() => setSelected(null)}
          onReassign={() => openReassignment(selected.evaluation)}
          onReopen={() => {
            setRevisionTarget(selected.evaluation);
            setRevisionReason("");
            setRevisionNotes("");
          }}
          onApproveCalibration={() =>
            approveCalibration(selected.evaluation.id)
          }
          onReturnCalibration={() =>
            returnCalibrationForRevision(selected.evaluation.id)
          }
          feedbackRecords={developmentStore.feedbackRecords.filter(
            (record) =>
              record.personId === selected.evaluation.personId &&
              (record.relatedReviewId === selected.evaluation.id ||
                record.cycleId === selected.evaluation.periodId),
          )}
          relatedPips={developmentStore.pips.filter(
            (pip) => pip.relatedReviewId === selected.evaluation.id,
          )}
        />
      )}

      {showForm && form && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={closeForm}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                {formMode === "edit"
                  ? `Evaluate ${selectedFormPerson?.personType ?? "Person"}`
                  : "Create Evaluation"}
              </h3>
              <button
                onClick={closeForm}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Active Period
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {periods.find((period) => period.id === form.periodId)
                      ?.cycleName ?? "No active cycle"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Due Date
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {periods.find((period) => period.id === form.periodId)
                      ?.reviewDueDate ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Evaluator
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {getPersonById(form.evaluatorId)?.fullName ?? "—"}
                  </p>
                </div>
              </div>
              {formMode === "create" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-bold">Your evaluator scope</p>
                  <p className="mt-1">
                    {currentActorScopes.length > 0
                      ? currentActorScopes.join(" · ")
                      : "No evaluation assignments are currently assigned to you."}
                  </p>
                </div>
              )}
              <div className="relative">
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Eligible Assigned Personnel *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={personSearchQuery}
                    onChange={(e) => {
                      setPersonSearchQuery(e.target.value);
                    }}
                    disabled={formMode === "edit"}
                    placeholder="Search within your assigned personnel..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 focus:border-[#F4B400] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 disabled:opacity-60"
                  />
                </div>
                {formMode === "create" &&
                  searchedPeople.length > 0 &&
                  !form.personId && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                      {searchedPeople.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, personId: p.id });
                            setPersonSearchQuery(p.fullName);
                            setFormError("");
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-amber-50"
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: colorForId(p.id) }}
                          >
                            {initialsFor(p.fullName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800">
                              {p.fullName}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              {p.position} · {p.department}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                {formMode === "create" &&
                  assignedEligiblePeople.length === 0 && (
                    <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
                      <ClipboardList className="mx-auto h-6 w-6 text-slate-300" />
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        {!activePeriod
                          ? "No active evaluation period is currently available."
                          : currentActorScopes.length === 0
                            ? "No evaluation assignments are currently assigned to you."
                            : "No eligible assigned personnel remain for the active period."}
                      </p>
                      {canConfigurePerformance && (
                        <button
                          type="button"
                          onClick={() => {
                            closeForm();
                            setShowManagement(true);
                            setManagementTab("assignments");
                          }}
                          className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Manage Assignments
                        </button>
                      )}
                    </div>
                  )}
              </div>
              {selectedFormPerson && (
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-[11px] sm:grid-cols-4">
                  <div>
                    <p className="text-slate-400">ID</p>
                    <p className="font-semibold text-slate-700">
                      {selectedFormPerson.employeeOrTraineeId}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Department</p>
                    <p className="font-semibold text-slate-700">
                      {selectedFormPerson.department}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Position</p>
                    <p className="font-semibold text-slate-700">
                      {selectedFormPerson.position}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Person Type</p>
                    <p className="font-semibold text-slate-700">
                      {selectedFormPerson.personType}
                    </p>
                  </div>
                </div>
              )}
              {formMode === "edit" && (
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">
                    Criteria Scores
                  </label>
                  <div className="space-y-2.5 rounded-lg bg-slate-50 p-3">
                    {formCriteria.map((c) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className="w-32 shrink-0">
                          <p className="text-xs font-semibold text-slate-700">
                            {c.name}
                          </p>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          step={0.1}
                          value={form.scores[c.name] ?? 0}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              scores: {
                                ...form.scores,
                                [c.name]: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="flex-1 accent-[#F4B400]"
                        />
                        <span className="w-10 shrink-0 text-right text-xs font-bold text-slate-800">
                          {(form.scores[c.name] ?? 0).toFixed(1)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                      <span className="font-semibold text-slate-500">
                        Average
                      </span>
                      <span className="font-bold text-slate-900">
                        {currentFormAvg ?? "—"} / 5
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {formMode === "edit" && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Evaluator Comments
                  </label>
                  <textarea
                    value={form.comments}
                    onChange={(e) =>
                      setForm({ ...form, comments: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#F4B400] focus:outline-none"
                    placeholder="Observations for this evaluation period..."
                  />
                </div>
              )}
              {formMode === "edit" && (
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">
                    Development Recommendations
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {DEVELOPMENT_RECOMMENDATION_OPTIONS.map(
                      (recommendation) => (
                        <label
                          key={recommendation}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={
                              recommendation === "Other"
                                ? !!form.otherRecommendation
                                : form.developmentRecommendations.includes(
                                    recommendation,
                                  )
                            }
                            onChange={(event) => {
                              if (recommendation === "Other") {
                                setForm({
                                  ...form,
                                  otherRecommendation: event.target.checked
                                    ? form.otherRecommendation ||
                                      "Other development recommendation"
                                    : "",
                                });
                                return;
                              }
                              setForm({
                                ...form,
                                developmentRecommendations: event.target.checked
                                  ? [
                                      ...form.developmentRecommendations,
                                      recommendation,
                                    ]
                                  : form.developmentRecommendations.filter(
                                      (item) => item !== recommendation,
                                    ),
                              });
                            }}
                            className="accent-[#F4B400]"
                          />
                          {recommendation}
                        </label>
                      ),
                    )}
                  </div>
                  {!!form.otherRecommendation && (
                    <input
                      value={form.otherRecommendation}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          otherRecommendation: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      placeholder="Specify the other development recommendation"
                    />
                  )}
                </div>
              )}
              {formError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {formError}
                </p>
              )}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              {formMode === "create" ? (
                <>
                  <button
                    type="button"
                    disabled={!form.personId}
                    onClick={() => createEvaluation(false)}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save as Pending
                  </button>
                  <button
                    type="button"
                    disabled={!form.personId}
                    onClick={() => createEvaluation(true)}
                    className="rounded-lg bg-[#F4B400] px-4 py-2 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Start Evaluation
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => persistEvaluation(false)}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Save Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => persistEvaluation(true)}
                    className="rounded-lg bg-[#F4B400] px-4 py-2 text-xs font-semibold text-black hover:bg-[#dba300]"
                  >
                    Submit Evaluation
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {reassignTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setReassignTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reassign Evaluation
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Current evaluator:{" "}
                  {getPersonById(reassignTarget.evaluatorId)?.fullName ??
                    "Unknown"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  New Evaluator *
                </label>
                <select
                  value={reassignEvaluatorId}
                  onChange={(event) =>
                    setReassignEvaluatorId(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">
                    Select an evaluator with matching scope
                  </option>
                  {SHARED_PERSONNEL.filter(
                    (candidate) =>
                      candidate.id !== reassignTarget.evaluatorId &&
                      canEvaluate(candidate.id, reassignTarget.personId, {
                        periodId: reassignTarget.periodId,
                        periods,
                        assignments,
                        requireActivePeriod: false,
                      }),
                  ).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} ({candidate.position})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Reason *
                </label>
                <textarea
                  value={reassignReason}
                  onChange={(event) => setReassignReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Explain why this evaluation is being reassigned."
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Actor and timestamp are recorded automatically in the
                reassignment history.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reassignEvaluatorId || !reassignReason.trim()}
                onClick={confirmReassignment}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {revisionTarget && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setRevisionTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reopen / Request Revision
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Completed results remain preserved in the revision audit
                  history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevisionTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Reason *
                </label>
                <textarea
                  value={revisionReason}
                  onChange={(event) => setRevisionReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="State why this completed evaluation must be revised."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Notes (optional)
                </label>
                <textarea
                  value={revisionNotes}
                  onChange={(event) => setRevisionNotes(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setRevisionTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!revisionReason.trim()}
                onClick={confirmRevision}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40"
              >
                Reopen Evaluation
              </button>
            </div>
          </div>
        </div>
      )}

      {showManagement && canConfigurePerformance && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setShowManagement(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Performance Administration
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  System access permits management; personal evaluation
                  authority still requires an explicit assignment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManagement(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex border-b border-slate-100 px-6">
              <button
                type="button"
                onClick={() => setManagementTab("assignments")}
                className={`border-b-2 px-4 py-3 text-xs font-bold ${managementTab === "assignments" ? "border-[#F4B400] text-slate-900" : "border-transparent text-slate-400"}`}
              >
                Evaluator Assignments
              </button>
              <button
                type="button"
                onClick={() => setManagementTab("cycles")}
                className={`border-b-2 px-4 py-3 text-xs font-bold ${managementTab === "cycles" ? "border-[#F4B400] text-slate-900" : "border-transparent text-slate-400"}`}
              >
                Performance Cycles
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
              {managementTab === "assignments" ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
                  <div className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-900">
                      Add Primary Assignment
                    </h4>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        Evaluator
                      </label>
                      <select
                        value={assignmentDraft.evaluatorId}
                        onChange={(event) =>
                          setAssignmentDraft({
                            ...assignmentDraft,
                            evaluatorId: event.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      >
                        {SHARED_PERSONNEL.filter(
                          (person) =>
                            person.personType === "Employee" &&
                            person.employmentStatus === "Employee",
                        ).map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        Scope Type
                      </label>
                      <select
                        value={assignmentDraft.scopeType}
                        onChange={(event) =>
                          setAssignmentDraft({
                            ...assignmentDraft,
                            scopeType: event.target
                              .value as AssignmentScopeType,
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      >
                        <option>Department</option>
                        <option>Specific Person</option>
                      </select>
                    </div>
                    {assignmentDraft.scopeType === "Department" ? (
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">
                          Department
                        </label>
                        <select
                          value={assignmentDraft.department}
                          onChange={(event) =>
                            setAssignmentDraft({
                              ...assignmentDraft,
                              department: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        >
                          {departments.map((department) => (
                            <option key={department}>{department}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">
                          Specific Person
                        </label>
                        <select
                          value={assignmentDraft.personId}
                          onChange={(event) =>
                            setAssignmentDraft({
                              ...assignmentDraft,
                              personId: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        >
                          <option value="">Select person</option>
                          {SHARED_PERSONNEL.filter(
                            (person) =>
                              person.employmentStatus !== "Inactive" &&
                              person.id !== assignmentDraft.evaluatorId,
                          ).map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.fullName} — {person.department}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      A specific-person assignment overrides the person&apos;s
                      normal department assignment. Duplicate primary scopes and
                      self-evaluation assignments are blocked.
                    </p>
                    <button
                      type="button"
                      onClick={addAssignment}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-2 text-xs font-bold text-black"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Assignment
                    </button>
                  </div>
                  <div className="space-y-2">
                    {assignments.map((assignment) => {
                      const evaluator = getPersonById(assignment.evaluatorId);
                      const person = assignment.personId
                        ? getPersonById(assignment.personId)
                        : undefined;
                      return (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900">
                              {evaluator?.fullName ?? "Unknown evaluator"}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">
                              {assignment.scopeType}:{" "}
                              {assignment.department ??
                                person?.fullName ??
                                "Unknown"}{" "}
                              · Primary Evaluator
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAssignments((previous) =>
                                previous.filter(
                                  (item) => item.id !== assignment.id,
                                ),
                              )
                            }
                            className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                            aria-label="Remove assignment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
                  <div className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-900">
                      Create Performance Cycle
                    </h4>
                    <input
                      value={periodDraft.cycleName}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          cycleName: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      placeholder="Cycle name"
                    />
                    <select
                      value={periodDraft.cycleType}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          cycleType: event.target.value as PerformanceCycleType,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      {(
                        [
                          "Quarterly",
                          "Semi-Annual",
                          "Annual",
                          "Probationary",
                          "Custom",
                        ] as PerformanceCycleType[]
                      ).map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500">
                          Performance Start
                        </label>
                        <input
                          type="date"
                          value={periodDraft.performanceStartDate}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              performanceStartDate: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500">
                          Performance End
                        </label>
                        <input
                          type="date"
                          value={periodDraft.performanceEndDate}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              performanceEndDate: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500">
                          Review Opens
                        </label>
                        <input
                          type="date"
                          value={periodDraft.reviewOpenDate}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              reviewOpenDate: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-slate-500">
                          Review Due
                        </label>
                        <input
                          type="date"
                          value={periodDraft.reviewDueDate}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              reviewDueDate: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <select
                      value={periodDraft.applicable}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          applicable: event.target
                            .value as typeof periodDraft.applicable,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option>Both</option>
                      <option>Employee</option>
                      <option>Trainee</option>
                    </select>
                    {periodDraft.applicable !== "Trainee" && (
                      <select
                        value={periodDraft.employeeReviewTemplateId}
                        onChange={(event) =>
                          setPeriodDraft({
                            ...periodDraft,
                            employeeReviewTemplateId: event.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      >
                        {reviewTemplates.filter(
                          (template) =>
                            template.personType === "Employee" &&
                            template.active,
                        ).map((template) => (
                          <option key={template.id} value={template.id}>
                            Employee: {template.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {periodDraft.applicable !== "Employee" && (
                      <select
                        value={periodDraft.traineeReviewTemplateId}
                        onChange={(event) =>
                          setPeriodDraft({
                            ...periodDraft,
                            traineeReviewTemplateId: event.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      >
                        {reviewTemplates.filter(
                          (template) =>
                            template.personType === "Trainee" &&
                            template.active,
                        ).map((template) => (
                          <option key={template.id} value={template.id}>
                            Trainee: {template.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {periodDraft.cycleType === "Probationary" && (
                      <label className="block text-[10px] font-bold text-slate-500">
                        Review after X months
                        <input
                          type="number"
                          min={1}
                          value={periodDraft.probationaryMilestoneMonths}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              probationaryMilestoneMonths: Number(
                                event.target.value,
                              ),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        />
                      </label>
                    )}
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={periodDraft.selfEvaluationEnabled}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              selfEvaluationEnabled: event.target.checked,
                              selfRatingEnabled: event.target.checked
                                ? periodDraft.selfRatingEnabled
                                : false,
                            })
                          }
                        />{" "}
                        Optional self-evaluation
                      </label>
                      <label
                        className={`flex items-center gap-2 text-[11px] font-semibold ${periodDraft.selfEvaluationEnabled ? "text-slate-700" : "text-slate-400"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!periodDraft.selfEvaluationEnabled}
                          checked={periodDraft.selfRatingEnabled}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              selfRatingEnabled: event.target.checked,
                            })
                          }
                        />{" "}
                        Include self-rating
                      </label>
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={periodDraft.calibrationRequired}
                          onChange={(event) =>
                            setPeriodDraft({
                              ...periodDraft,
                              calibrationRequired: event.target.checked,
                            })
                          }
                        />{" "}
                        HR/management calibration required
                      </label>
                    </div>
                    <select
                      value={periodDraft.employeeAcknowledgment}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          employeeAcknowledgment: event.target
                            .value as EmployeeAcknowledgmentMode,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="Required">Acknowledgment Required</option>
                      <option value="Optional">Acknowledgment Optional</option>
                      <option value="Not Required">
                        Acknowledgment Not Required
                      </option>
                    </select>
                    <select
                      value={periodDraft.department}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          department: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="">All Departments</option>
                      {departments.map((department) => (
                        <option key={department}>{department}</option>
                      ))}
                    </select>
                    <select
                      value={periodDraft.status}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          status: event.target.value as EvaluationPeriodStatus,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option>Draft</option>
                      <option>Active</option>
                      <option>Closed</option>
                    </select>
                    <textarea
                      value={periodDraft.description}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          description: event.target.value,
                        })
                      }
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      placeholder="Optional description"
                    />
                    <textarea
                      value={periodDraft.instructions}
                      onChange={(event) =>
                        setPeriodDraft({
                          ...periodDraft,
                          instructions: event.target.value,
                        })
                      }
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      placeholder="Optional evaluator instructions"
                    />
                    {cycleDraftError && (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
                        {cycleDraftError}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={addPeriod}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-2 text-xs font-bold text-black"
                    >
                      <CalendarDays className="h-3.5 w-3.5" /> Create Cycle
                    </button>
                  </div>
                  <div className="space-y-2">
                    {periods.map((period) => (
                      <div
                        key={period.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {period.cycleName}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {period.cycleType} · Performance{" "}
                              {period.performanceStartDate} →{" "}
                              {period.performanceEndDate}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Review {period.reviewOpenDate} →{" "}
                              {period.reviewDueDate}
                            </p>
                          </div>
                          <select
                            value={period.status}
                            onChange={(event) => {
                              const nextStatus = event.target
                                .value as EvaluationPeriodStatus;
                              setPeriods((previous) =>
                                previous.map((item) =>
                                  item.id === period.id
                                    ? { ...item, status: nextStatus }
                                    : nextStatus === "Active" &&
                                        item.status === "Active"
                                      ? { ...item, status: "Draft" }
                                      : item,
                                ),
                              );
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                          >
                            <option>Draft</option>
                            <option>Active</option>
                            <option>Closed</option>
                          </select>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Applies to {period.applicablePersonTypes.join(" & ")}{" "}
                          ·{" "}
                          {period.departmentScopes.length
                            ? period.departmentScopes.join(", ")
                            : "All Departments"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {period.selfEvaluationEnabled
                            ? `Self-evaluation enabled${period.selfRatingEnabled ? " with self-rating" : ""}`
                            : "Self-evaluation disabled"}{" "}
                          ·{" "}
                          {period.calibrationRequired
                            ? "Calibration required"
                            : "No required calibration"}{" "}
                          · Acknowledgment{" "}
                          {period.employeeAcknowledgment.toLowerCase()}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                          {cycleAssignmentPreviews.get(period.id)?.length ?? 0}{" "}
                          review assignments can be prepared from current
                          reporting relationships.
                        </p>
                        {period.description && (
                          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                            {period.description}
                          </p>
                        )}
                        {period.instructions && (
                          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                            <span className="font-semibold text-slate-700">
                              Instructions:
                            </span>{" "}
                            {period.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAllPerformers && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAllPerformers(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100/50 p-2">
                  <Trophy className="h-5 w-5 text-[#F4B400]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Top Performance Results
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    {topPerformanceResults.comparisonBasis} ·{" "}
                    {topPerformers.length} comparable finalized results
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllPerformers(false)}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto bg-slate-50/30 p-6">
              {topPerformers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Trophy className="h-6 w-6 text-slate-300" />
                  <p className="text-xs text-slate-400">
                    {topPerformanceResults.message ??
                      "No finalized comparable reviews match the analytics filters."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {topPerformers.map(({ evaluation, person }, i) => {
                    const level = getPerformanceLevel(evaluation.rating);
                    return (
                      <button
                        key={evaluation.id}
                        type="button"
                        onClick={() => {
                          setSelected({ evaluation, person });
                          setShowAllPerformers(false);
                        }}
                        className="group relative flex flex-col items-center rounded-xl border border-slate-200/80 bg-white p-4 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[#F4B400] hover:shadow-md"
                      >
                        <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 transition-colors group-hover:bg-[#F4B400] group-hover:text-black">
                          #{i + 1}
                        </span>
                        <div
                          className="mt-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
                          style={{ backgroundColor: colorForId(person.id) }}
                        >
                          {initialsFor(person.fullName)}
                        </div>
                        <div className="mt-4 w-full min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-amber-600">
                            {person.fullName}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-400">
                            {person.position}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                            {person.department}
                          </p>
                          <div className="mt-3 flex flex-col items-center gap-1.5">
                            <span className="flex items-center gap-1.5 rounded-md border border-amber-100/50 bg-amber-50 px-2.5 py-1 text-xs font-bold text-slate-800">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{" "}
                              {evaluation.rating?.toFixed(1)} / 5
                            </span>
                            <LevelBadge level={level} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {preparedGroqContext && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setPreparedGroqContext(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Contextual Groq Preparation
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {preparedGroqContext.useCase} · review{" "}
                    {preparedGroqContext.reviewId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreparedGroqContext(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close Groq context preparation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-6">
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs leading-relaxed text-violet-900">
                This is a bounded context preview. Generation runs only through
                the authenticated Laravel endpoint; the Groq key is never sent
                to the browser, and every generated draft is audit-recorded for
                human review.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Subject Context
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    {preparedGroqContext.subjectReference.position} ·{" "}
                    {preparedGroqContext.subjectReference.department}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {preparedGroqContext.subjectReference.personType} · Cycle{" "}
                    {preparedGroqContext.cycleId}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Supplied Context Counts
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    {preparedGroqContext.criteria.length} criteria ·{" "}
                    {preparedGroqContext.goals.length} goals ·{" "}
                    {preparedGroqContext.feedback.length} feedback records ·{" "}
                    {preparedGroqContext.integrationEvidence.length} verified
                    evidence links
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold text-slate-800">
                  Human Decision Guardrails
                </p>
                <ul className="mt-2 space-y-1.5">
                  {preparedGroqContext.guardrails.map((guardrail) => (
                    <li
                      key={guardrail}
                      className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                      {guardrail}
                    </li>
                  ))}
                </ul>
              </div>
              {(groqDraft || groqDraftError) && (
                <div
                  className={`rounded-xl border p-4 ${
                    groqDraftError
                      ? "border-rose-200 bg-rose-50"
                      : "border-violet-200 bg-white"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-800">
                    {groqDraftError
                      ? "Groq draft unavailable"
                      : "Server-generated draft · human review required"}
                  </p>
                  <p
                    className={`mt-2 whitespace-pre-wrap text-xs leading-relaxed ${
                      groqDraftError ? "text-rose-700" : "text-slate-700"
                    }`}
                  >
                    {groqDraftError || groqDraft}
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold text-slate-800">
                  Missing / Insufficient Context
                </p>
                {preparedGroqContext.missingContext.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {preparedGroqContext.missingContext.map((item) => (
                      <li
                        key={item}
                        className="text-[11px] leading-relaxed text-slate-600"
                      >
                        • {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-emerald-700">
                    No required context gap was detected in the prepared
                    payload.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => void generatePreparedGroqDraft()}
                disabled={groqDraftLoading || !backend.ready}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {groqDraftLoading ? "Generating…" : "Generate secure draft"}
              </button>
              <button
                type="button"
                onClick={() => setPreparedGroqContext(null)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <PageHeader
          title="Performance Management"
          description="Govern review cycles, evaluator progress, performance records, and development actions"
          actions={
            canConfigurePerformance ? (
              <button
                type="button"
                onClick={() => setShowManagement(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Settings2 className="h-3.5 w-3.5" /> Performance Settings
              </button>
            ) : undefined
          }
        />

        {(backend.loading || backend.saving || backend.error) && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs ${
              backend.error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-sky-200 bg-sky-50 text-sky-700"
            }`}
            role={backend.error ? "alert" : "status"}
          >
            {backend.error ||
              (backend.loading
                ? "Loading authoritative Performance data…"
                : "Saving Performance changes…")}
            {backend.error && (
              <button
                type="button"
                onClick={() => void backend.reload()}
                className="ml-2 font-bold underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <nav
          aria-label="Performance Management workspaces"
          className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 shadow-sm"
        >
          <div className="flex min-w-max">
            {PERFORMANCE_WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              const selectedTab = workspaceTab === tab.label;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setWorkspaceTab(tab.label)}
                  className={`relative flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition ${
                    selectedTab
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  aria-current={selectedTab ? "page" : undefined}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${selectedTab ? "text-amber-500" : "text-slate-400"}`}
                  />
                  {tab.label}
                  {selectedTab && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#F4B400]" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {workspaceTab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((card) => {
                const Icon = card.icon;
                const selectedCard = activeCard === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => handleCardClick(card.key)}
                    className={`relative rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      selectedCard
                        ? "border-slate-300 bg-slate-50/70"
                        : "border-slate-200"
                    }`}
                  >
                    {selectedCard && (
                      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#F4B400]" />
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {card.label}
                        </p>
                        <p className="mt-1 truncate text-lg font-bold text-slate-900">
                          {card.value}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500">
                      {card.meta}
                    </p>
                  </button>
                );
              })}
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Evaluator Progress
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Active-cycle workload for authorized managers, supervisors,
                    and designated evaluators
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                  {activePeriod?.cycleName ?? "No active cycle"}
                </span>
              </div>
              {evaluatorProgress.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Users className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    No evaluator assignments are available for the active cycle.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Configure a legitimate reporting relationship or explicit
                    exception.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Evaluator",
                          "Role / Team / Scope",
                          "Assigned",
                          "Completed",
                          "In Progress",
                          "Pending",
                          "Overdue",
                          "Progress",
                        ].map((header) => (
                          <th
                            key={header}
                            className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {evaluatorProgress.map((row) => (
                        <tr
                          key={row.evaluator.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setEvaluatorFilter(row.evaluator.id);
                            setPeriodFilter(activePeriod?.id ?? "All Periods");
                            setWorkspaceTab("Evaluations");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setEvaluatorFilter(row.evaluator.id);
                              setPeriodFilter(
                                activePeriod?.id ?? "All Periods",
                              );
                              setWorkspaceTab("Evaluations");
                            }
                          }}
                          className="cursor-pointer transition hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none"
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{
                                  backgroundColor: colorForId(row.evaluator.id),
                                }}
                              >
                                {initialsFor(row.evaluator.fullName)}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">
                                  {row.evaluator.fullName}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  Access Role: {row.evaluator.accessRole}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            <p className="text-xs font-semibold text-slate-700">
                              {row.evaluator.position}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">
                              {row.scope}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">
                            {row.assigned}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-emerald-600">
                            {row.completed}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-sky-600">
                            {row.inProgress}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-amber-600">
                            {row.pending}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-rose-600">
                            {row.overdue}
                          </td>
                          <td className="min-w-32 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-[#F4B400]"
                                  style={{ width: `${row.progress}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-[10px] font-bold text-slate-600">
                                {row.progress}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs text-sky-800">
              <span className="font-bold">Authority model:</span> access role
              and evaluator capability are separate. Admin and HR can govern
              this process, but only a legitimate supervisor or explicitly
              assigned evaluator can submit a formal review.
            </div>
          </div>
        )}

        {workspaceTab === "Evaluations" && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Department"
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                >
                  <option>All Departments</option>
                  {departments.map((department) => (
                    <option key={department}>{department}</option>
                  ))}
                </select>
                <select
                  aria-label="Performance Cycle"
                  value={periodFilter}
                  onChange={(event) => setPeriodFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                >
                  <option value="All Periods">All Performance Cycles</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.cycleName}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Review Status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <select
                  aria-label="Rating Level"
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                >
                  {LEVEL_FILTER_OPTIONS.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
                {evaluatorFilter && (
                  <button
                    type="button"
                    onClick={() => setEvaluatorFilter("")}
                    className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800"
                  >
                    Evaluator:{" "}
                    {getPersonById(evaluatorFilter)?.fullName ?? "Unknown"}{" "}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {filtersActive && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>
            </section>

            {traineeRows.length > 0 && (
              <EvaluationRecordsTable
                title="Trainee Reviews"
                rows={traineeRows}
                periods={periods}
                onSelect={(row) =>
                  setSelected({
                    evaluation: row.evaluation,
                    person: row.person,
                  })
                }
              />
            )}
            {employeeRows.length > 0 && (
              <EvaluationRecordsTable
                title="Employee Reviews"
                rows={employeeRows}
                periods={periods}
                onSelect={(row) =>
                  setSelected({
                    evaluation: row.evaluation,
                    person: row.person,
                  })
                }
              />
            )}
            {filteredRows.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
                <ClipboardList className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  No review records match the current filters.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  Reset filters
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-lg bg-[#F4B400] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#dba300]"
              >
                + Create Assigned Evaluation
              </button>
              {canConfigurePerformance && (
                <button
                  type="button"
                  onClick={() => {
                    setShowManagement(true);
                    setManagementTab("assignments");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Manage Evaluator
                  Assignments
                </button>
              )}
            </div>
          </div>
        )}

        {workspaceTab === "Review Cycles" && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Performance Cycles
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs text-slate-500">
                    Configure performance windows, review dates, population,
                    templates, self-evaluation, calibration, acknowledgment, and
                    assignment preparation.
                  </p>
                </div>
                {canConfigurePerformance && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowManagement(true);
                      setManagementTab("cycles");
                    }}
                    className="rounded-lg bg-[#F4B400] px-3 py-2 text-xs font-semibold text-black hover:bg-[#dba300]"
                  >
                    + Create / Manage Cycle
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {periods.map((period) => {
                  const employeeTemplate = period.reviewTemplateIds.Employee
                    ? reviewTemplates.find(
                        (template) =>
                          template.id === period.reviewTemplateIds.Employee,
                      )
                    : undefined;
                  const traineeTemplate = period.reviewTemplateIds.Trainee
                    ? reviewTemplates.find(
                        (template) =>
                          template.id === period.reviewTemplateIds.Trainee,
                      )
                    : undefined;
                  return (
                    <div
                      key={period.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">
                              {period.cycleName}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {period.cycleType}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Performance: {period.performanceStartDate} →{" "}
                            {period.performanceEndDate}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Review: {period.reviewOpenDate} →{" "}
                            {period.reviewDueDate}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${period.status === "Active" ? "bg-emerald-100 text-emerald-700" : period.status === "Closed" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}
                        >
                          {period.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                        <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                          <span className="block font-bold text-slate-800">
                            Population
                          </span>
                          {period.applicablePersonTypes.join(" & ")} ·{" "}
                          {period.departmentScopes.length
                            ? period.departmentScopes.join(", ")
                            : "All departments"}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                          <span className="block font-bold text-slate-800">
                            Prepared assignments
                          </span>
                          {cycleAssignmentPreviews.get(period.id)?.length ?? 0}{" "}
                          from valid relationships
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                          <span className="block font-bold text-slate-800">
                            Review workflow
                          </span>
                          {period.selfEvaluationEnabled
                            ? "Self-evaluation on"
                            : "Self-evaluation off"}{" "}
                          ·{" "}
                          {period.calibrationRequired
                            ? "Calibration required"
                            : "Direct finalize"}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                          <span className="block font-bold text-slate-800">
                            Acknowledgment
                          </span>
                          {period.employeeAcknowledgment}
                        </div>
                      </div>
                      <p className="mt-3 text-[10px] text-slate-500">
                        Templates:{" "}
                        {employeeTemplate?.name ?? "No employee template"} ·{" "}
                        {traineeTemplate?.name ?? "No trainee template"}
                      </p>
                      {period.cycleType === "Probationary" && (
                        <p className="mt-1 text-[10px] font-semibold text-amber-700">
                          Configurable milestone: after{" "}
                          {period.probationaryMilestoneMonths} month(s)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Default Rating Scale
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {DEFAULT_RATING_SCALE.name}. Descriptive labels remain the
                    formal HR language.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  Configurable model
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {DEFAULT_RATING_SCALE.levels.map((level) => (
                  <div
                    key={level.value}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="text-xs font-bold text-slate-900">
                      {level.value} — {level.label}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      {level.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {workspaceTab === "Goals & KPIs" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Goal Templates
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {goalTemplates.length}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Role/department-aware plans
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Goals
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {activeGoalRows.length}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {activePeriod?.cycleName ?? "Across configured cycles"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  At Risk
                </p>
                <p className="mt-1 text-xl font-bold text-amber-700">
                  {
                    activeGoalRows.filter((goal) => goal.status === "At Risk")
                      .length
                  }
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Needs coaching context
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Valid Weights
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-700">
                  {
                    goalTemplates.filter(
                      (template) => totalTemplateWeight(template) === 100,
                    ).length
                  }
                  /{goalTemplates.length}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Templates totaling 100%
                </p>
              </div>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Goal / KPI / KRA Templates
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Set expectations by cycle, Person Type, department, or
                    position. Individual overrides stay explicitly identified.
                  </p>
                </div>
                {canConfigurePerformance && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowGoalBuilder((value) => !value);
                      setGoalDraftError("");
                    }}
                    className="rounded-lg bg-[#F4B400] px-3 py-2 text-xs font-semibold text-black"
                  >
                    {showGoalBuilder ? "Close Builder" : "+ Create Template"}
                  </button>
                )}
              </div>

              {showGoalBuilder && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <input
                      value={goalTemplateDraft.name}
                      onChange={(event) =>
                        setGoalTemplateDraft({
                          ...goalTemplateDraft,
                          name: event.target.value,
                        })
                      }
                      placeholder="Template name"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    />
                    <select
                      value={goalTemplateDraft.applicable}
                      onChange={(event) =>
                        setGoalTemplateDraft({
                          ...goalTemplateDraft,
                          applicable: event.target
                            .value as GoalTemplateDraft["applicable"],
                        })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option>Employee</option>
                      <option>Trainee</option>
                      <option>Both</option>
                    </select>
                    <select
                      value={goalTemplateDraft.cycleId}
                      onChange={(event) =>
                        setGoalTemplateDraft({
                          ...goalTemplateDraft,
                          cycleId: event.target.value,
                        })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="">Any cycle</option>
                      {periods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.cycleName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={goalTemplateDraft.department}
                      onChange={(event) =>
                        setGoalTemplateDraft({
                          ...goalTemplateDraft,
                          department: event.target.value,
                        })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="">All departments</option>
                      {departments.map((department) => (
                        <option key={department}>{department}</option>
                      ))}
                    </select>
                    <select
                      value={goalTemplateDraft.position}
                      onChange={(event) =>
                        setGoalTemplateDraft({
                          ...goalTemplateDraft,
                          position: event.target.value,
                        })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="">All positions</option>
                      {positions.map((position) => (
                        <option key={position}>{position}</option>
                      ))}
                    </select>
                    <input
                      value={goalTemplateDraft.description}
                      onChange={(event) =>
                        setGoalTemplateDraft({
                          ...goalTemplateDraft,
                          description: event.target.value,
                        })
                      }
                      placeholder="Optional description"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    {goalTemplateDraft.items.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[90px_1fr_1fr_100px_90px_36px]"
                      >
                        <select
                          value={item.metricType}
                          onChange={(event) =>
                            setGoalTemplateDraft({
                              ...goalTemplateDraft,
                              items: goalTemplateDraft.items.map(
                                (candidate, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...candidate,
                                        metricType: event.target
                                          .value as GoalMetricType,
                                      }
                                    : candidate,
                              ),
                            })
                          }
                          className="rounded-md border border-slate-200 px-2 py-2 text-xs"
                        >
                          <option>KRA</option>
                          <option>KPI</option>
                          <option>Goal</option>
                        </select>
                        <input
                          value={item.title}
                          onChange={(event) =>
                            setGoalTemplateDraft({
                              ...goalTemplateDraft,
                              items: goalTemplateDraft.items.map(
                                (candidate, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...candidate,
                                        title: event.target.value,
                                      }
                                    : candidate,
                              ),
                            })
                          }
                          placeholder="Title"
                          className="rounded-md border border-slate-200 px-2 py-2 text-xs"
                        />
                        <input
                          value={item.target}
                          onChange={(event) =>
                            setGoalTemplateDraft({
                              ...goalTemplateDraft,
                              items: goalTemplateDraft.items.map(
                                (candidate, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...candidate,
                                        target: event.target.value,
                                      }
                                    : candidate,
                              ),
                            })
                          }
                          placeholder="Target"
                          className="rounded-md border border-slate-200 px-2 py-2 text-xs"
                        />
                        <input
                          value={item.unit ?? ""}
                          onChange={(event) =>
                            setGoalTemplateDraft({
                              ...goalTemplateDraft,
                              items: goalTemplateDraft.items.map(
                                (candidate, itemIndex) =>
                                  itemIndex === index
                                    ? { ...candidate, unit: event.target.value }
                                    : candidate,
                              ),
                            })
                          }
                          placeholder="Unit"
                          className="rounded-md border border-slate-200 px-2 py-2 text-xs"
                        />
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={item.weight || ""}
                          onChange={(event) =>
                            setGoalTemplateDraft({
                              ...goalTemplateDraft,
                              items: goalTemplateDraft.items.map(
                                (candidate, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...candidate,
                                        weight: Number(event.target.value),
                                      }
                                    : candidate,
                              ),
                            })
                          }
                          placeholder="Weight %"
                          className="rounded-md border border-slate-200 px-2 py-2 text-xs"
                        />
                        <button
                          type="button"
                          disabled={goalTemplateDraft.items.length === 1}
                          onClick={() =>
                            setGoalTemplateDraft({
                              ...goalTemplateDraft,
                              items: goalTemplateDraft.items.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            })
                          }
                          className="rounded-md text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                          aria-label="Remove goal item"
                        >
                          <Trash2 className="mx-auto h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setGoalTemplateDraft({
                          ...goalTemplateDraft,
                          items: [
                            ...goalTemplateDraft.items,
                            newGoalTemplateItem(goalTemplateDraft.items.length),
                          ],
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      + Add item
                    </button>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold ${goalTemplateDraft.items.reduce((total, item) => total + item.weight, 0) === 100 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        Total weight:{" "}
                        {goalTemplateDraft.items.reduce(
                          (total, item) => total + item.weight,
                          0,
                        )}
                        %
                      </span>
                      <button
                        type="button"
                        onClick={addGoalTemplate}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                      >
                        Save Template
                      </button>
                    </div>
                  </div>
                  {goalDraftError && (
                    <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {goalDraftError}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {goalTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {template.name}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {template.applicablePersonTypes.join(" & ")} ·{" "}
                          {template.departmentScopes.length
                            ? template.departmentScopes.join(", ")
                            : "All departments"}{" "}
                          ·{" "}
                          {template.positionScopes.length
                            ? template.positionScopes.join(", ")
                            : "All positions"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${totalTemplateWeight(template) === 100 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                      >
                        {totalTemplateWeight(template)}%
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {template.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <div>
                            <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                              {item.metricType}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">
                              {item.title}
                            </span>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              Target: {item.target}
                              {item.unit ? ` ${item.unit}` : ""}
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-slate-700">
                            {item.weight}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-slate-400">
                      Individual overrides{" "}
                      {template.allowIndividualOverrides
                        ? "allowed with explicit tracking"
                        : "disabled"}
                      .
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">
                  Assigned Goal Progress
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Progress is maintained separately from review ratings; missing
                  progress is not an automatic zero.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Person",
                        "Type",
                        "Goal / KPI / KRA",
                        "Target",
                        "Weight",
                        "Progress",
                        "Status",
                      ].map((header) => (
                        <th
                          key={header}
                          className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeGoalRows.map((goal) => {
                      const person = getPersonById(goal.personId);
                      return (
                        <tr key={goal.id}>
                          <td className="whitespace-nowrap px-4 py-3">
                            <p className="text-xs font-semibold text-slate-800">
                              {person?.fullName ?? "Unknown person"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {person?.department}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[11px] font-bold text-slate-600">
                            {goal.metricType}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-semibold text-slate-700">
                              {goal.title}
                            </p>
                            {goal.individualOverride && (
                              <span className="text-[9px] font-bold text-amber-700">
                                Individual override
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-600">
                            {goal.target}
                            {goal.unit ? ` ${goal.unit}` : ""}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-700">
                            {goal.weight}%
                          </td>
                          <td className="min-w-44 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={goal.progress}
                                onChange={(event) =>
                                  updatePerformanceGoal(goal.id, {
                                    progress: Number(event.target.value),
                                  })
                                }
                                className="w-24 accent-amber-500"
                              />
                              <span className="w-9 text-right text-[11px] font-bold text-slate-700">
                                {goal.progress}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={goal.status}
                              onChange={(event) =>
                                updatePerformanceGoal(goal.id, {
                                  status: event.target.value as GoalStatus,
                                })
                              }
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold"
                            >
                              <option>Not Started</option>
                              <option>On Track</option>
                              <option>At Risk</option>
                              <option>Completed</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {workspaceTab === "Analytics" && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Performance Analytics Scope
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    All panels below use this same population. Rating analytics
                    include finalized, valid ratings only.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
                  {analyticsRows.length} assigned reviews in scope
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <select
                  value={analyticsFilters.cycleId}
                  onChange={(event) =>
                    setAnalyticsFilters((current) => ({
                      ...current,
                      cycleId: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value={ALL_ANALYTICS_CYCLES}>All Cycles</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.cycleName}
                    </option>
                  ))}
                </select>
                <select
                  value={analyticsFilters.department}
                  onChange={(event) =>
                    setAnalyticsFilters((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value={ALL_ANALYTICS_DEPARTMENTS}>
                    All Departments
                  </option>
                  {departments.map((department) => (
                    <option key={department}>{department}</option>
                  ))}
                </select>
                <select
                  value={analyticsFilters.personType}
                  onChange={(event) =>
                    setAnalyticsFilters((current) => ({
                      ...current,
                      personType: event.target
                        .value as PerformanceAnalyticsFilters["personType"],
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value={ALL_ANALYTICS_PERSON_TYPES}>
                    All Person Types
                  </option>
                  <option>Employee</option>
                  <option>Trainee</option>
                </select>
                <select
                  value={analyticsFilters.reviewTemplateId}
                  onChange={(event) =>
                    setAnalyticsFilters((current) => ({
                      ...current,
                      reviewTemplateId: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value={ALL_ANALYTICS_TEMPLATES}>All Templates</option>
                  {reviewTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <select
                  value={analyticsFilters.evaluatorId}
                  onChange={(event) =>
                    setAnalyticsFilters((current) => ({
                      ...current,
                      evaluatorId: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value={ALL_ANALYTICS_EVALUATORS}>
                    All Evaluators
                  </option>
                  {Array.from(
                    new Set(
                      analyticsResolvedRows.map(
                        ({ review }) => review.evaluatorId,
                      ),
                    ),
                  ).map((evaluatorId) => (
                    <option key={evaluatorId} value={evaluatorId}>
                      {getPersonById(evaluatorId)?.fullName ?? evaluatorId}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Review Completion",
                  value: `${completionAnalytics.completionRate}%`,
                  detail: `${completionAnalytics.finalized} of ${completionAnalytics.assigned} finalized`,
                },
                {
                  label: "Awaiting Calibration",
                  value: completionAnalytics.calibrationPending,
                  detail: "Submitted reviews not yet finalized",
                },
                {
                  label: "Overdue Reviews",
                  value: completionAnalytics.overdue,
                  detail: `${completionAnalytics.pending} pending · ${completionAnalytics.inProgress} in progress`,
                },
                {
                  label: "Average Final Rating",
                  value:
                    analyticsAverageRating === null
                      ? "—"
                      : `${analyticsAverageRating.toFixed(2)} / 5`,
                  detail: `${finalizedAnalyticsRows.length} valid finalized ratings`,
                },
              ].map((card) => (
                <section
                  key={card.label}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {card.detail}
                  </p>
                </section>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Rating Distribution
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Decimal results are placed into the nearest configured
                      five-point rating level.
                    </p>
                  </div>
                  <BarChart3 className="h-4 w-4 text-slate-300" />
                </div>
                <div className="mt-4">
                  <PerformanceDistributionChart
                    data={ratingDistribution.map((point) => ({
                      key: String(point.value),
                      label: point.label,
                      count: point.count,
                      color: point.color,
                    }))}
                    total={finalizedAnalyticsRows.length}
                  />
                </div>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Top Performance Results
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {topPerformanceResults.comparisonBasis}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    Finalized only
                  </span>
                </div>
                {topPerformanceResults.comparable ? (
                  <TopPerformerPortraits
                    performers={topPerformers}
                    onSelect={(row) => setSelected(row)}
                  />
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                    {topPerformanceResults.message}
                  </div>
                )}
                {topPerformers.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAllPerformers(true)}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View all comparable results{" "}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                      A high result does not automatically determine promotion,
                      bonus, recognition, or succession decisions.
                    </p>
                  </>
                )}
              </section>
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Needs Performance Support
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Finalized results with a development recommendation, at-risk
                    goal, or active PIP. This is not an automatic disciplinary
                    decision.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={groqUseCase}
                    onChange={(event) =>
                      setGroqUseCase(
                        event.target.value as GroqPerformanceUseCase,
                      )
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    aria-label="Groq assistance use case"
                  >
                    {GROQ_PERFORMANCE_USE_CASES.map((useCase) => (
                      <option key={useCase}>{useCase}</option>
                    ))}
                  </select>
                  <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
                    Groq preparation · human review required
                  </span>
                </div>
              </div>
              {needsPerformanceSupport.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-slate-500">
                  No finalized review in this scope currently meets the support
                  criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Person",
                          "Result",
                          "Development Need",
                          "Active Intervention",
                          "PIP Status",
                          "Linked Action",
                          "Contextual AI",
                        ].map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {needsPerformanceSupport.map((row) => (
                        <tr key={row.review.id} className="align-top">
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setSelected({
                                  evaluation: row.review,
                                  person: row.person,
                                })
                              }
                              className="text-left"
                            >
                              <p className="text-xs font-bold text-slate-800 hover:text-amber-700">
                                {row.person.fullName}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {row.person.department}
                              </p>
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-800">
                            {row.rating.toFixed(2)} / 5
                          </td>
                          <td className="max-w-56 px-4 py-3 text-xs leading-relaxed text-slate-600">
                            {row.identifiedDevelopmentNeed}
                          </td>
                          <td className="max-w-56 px-4 py-3 text-xs leading-relaxed text-slate-600">
                            {row.activeIntervention}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-700">
                            {row.pipStatus}
                          </td>
                          <td className="max-w-52 px-4 py-3 text-xs text-slate-600">
                            {row.linkedAction}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                prepareContextualGroqDraft(row.review.id)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-bold text-violet-700 hover:bg-violet-100"
                            >
                              <Cpu className="h-3 w-3" /> Prepare context
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Goal / KPI Trends
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Weighted progress from Performance-owned goals only.
                    </p>
                  </div>
                  <Target className="h-4 w-4 text-slate-300" />
                </div>
                {goalTrendAnalytics.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-500">
                    No goal history is available for this person/team scope.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {goalTrendAnalytics.map((trend) => (
                      <div key={trend.cycleId}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                          <span className="truncate font-semibold text-slate-700">
                            {trend.cycleName}
                          </span>
                          <span className="whitespace-nowrap text-slate-500">
                            {trend.averageProgress ?? 0}% progress ·{" "}
                            {trend.completedRate}% completed ·{" "}
                            {trend.atRiskCount} at risk
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{
                              width: `${Math.max(trend.averageProgress ?? 0, trend.averageProgress ? 3 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    Department / Team Trends
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Completion, normalized final rating, goal progress, and
                    support indicators. Multiple templates are disclosed.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Department",
                          "Completion",
                          "Normalized Rating",
                          "Goal Progress",
                          "Support / PIP",
                        ].map((header) => (
                          <th
                            key={header}
                            className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departmentTrendAnalytics.map((row) => (
                        <tr key={row.department}>
                          <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">
                            {row.department}
                            {row.templateCount > 1 && (
                              <p className="text-[9px] font-normal text-amber-700">
                                {row.templateCount} templates in scope
                              </p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                            {row.completionRate}% ({row.finalized}/
                            {row.assigned})
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                            {row.normalizedAverageRating === null
                              ? "—"
                              : `${row.normalizedAverageRating}%`}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                            {row.averageGoalProgress === null
                              ? "—"
                              : `${row.averageGoalProgress}%`}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                            {row.needsSupport} support · {row.openPips} PIP
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Evaluator Calibration Analytics
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Descriptive signals for human review—not a forced curve,
                  quota, or automatic adjustment.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Evaluator",
                        "Assigned",
                        "Finalized",
                        "Average",
                        "Organization Avg.",
                        "Deviation",
                        "Spread",
                        "Returned",
                        "Signal",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evaluatorCalibrationAnalytics.map((row) => (
                      <tr key={row.evaluatorId}>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <p className="text-xs font-semibold text-slate-800">
                            {row.evaluatorName}
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {row.team}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {row.assigned}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {row.finalized}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {row.averageRating?.toFixed(2) ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {row.organizationAverage?.toFixed(2) ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {row.deviation === null
                            ? "—"
                            : `${row.deviation > 0 ? "+" : ""}${row.deviation.toFixed(2)}`}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {row.ratingSpread?.toFixed(2) ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {row.returnedForRevision}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-semibold ${
                              row.signal === "Within expected range"
                                ? "bg-emerald-50 text-emerald-700"
                                : row.signal === "Insufficient sample"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {row.signal}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  P&amp;D Integration Boundaries
                </h2>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Performance consumes authorized evidence by reference. It does
                not duplicate the source module or turn missing evidence into a
                score.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {PERFORMANCE_INTEGRATION_BOUNDARIES.map((boundary) => (
                  <div
                    key={boundary.module}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <p className="text-xs font-bold text-slate-800">
                      {boundary.module}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      <span className="font-semibold text-slate-700">
                        Owns:
                      </span>{" "}
                      {boundary.owns}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-emerald-700">
                      {boundary.performanceUse}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-rose-700">
                      {boundary.prohibitedPerformanceAction}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {workspaceTab === "Feedback & Coaching" && (
          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <section className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Document Feedback / Coaching
                </h2>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Records work-related context throughout the cycle. This is not
                Recognition or disciplinary case management.
              </p>
              <div className="mt-4 space-y-3">
                <select
                  value={feedbackDraft.personId}
                  onChange={(event) =>
                    setFeedbackDraft({
                      ...feedbackDraft,
                      personId: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">Select employee / trainee</option>
                  {SHARED_PERSONNEL.filter(
                    (person) => person.employmentStatus !== "Inactive",
                  ).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName} · {person.department}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={feedbackDraft.recordType}
                    onChange={(event) =>
                      setFeedbackDraft({
                        ...feedbackDraft,
                        recordType: event.target.value as FeedbackRecordType,
                      })
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <option>1:1 Check-in</option>
                    <option>Feedback Note</option>
                    <option>Coaching Action</option>
                  </select>
                  <select
                    value={feedbackDraft.visibility}
                    onChange={(event) =>
                      setFeedbackDraft({
                        ...feedbackDraft,
                        visibility: event.target.value as FeedbackVisibility,
                      })
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <option>Employee &amp; Manager</option>
                    <option>Manager &amp; HR</option>
                    <option>HR Only</option>
                  </select>
                </div>
                <textarea
                  rows={4}
                  value={feedbackDraft.note}
                  onChange={(event) =>
                    setFeedbackDraft({
                      ...feedbackDraft,
                      note: event.target.value,
                    })
                  }
                  placeholder="Work-related observation or discussion note"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <textarea
                  rows={2}
                  value={feedbackDraft.coachingAction}
                  onChange={(event) =>
                    setFeedbackDraft({
                      ...feedbackDraft,
                      coachingAction: event.target.value,
                    })
                  }
                  placeholder="Coaching action (optional)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Follow-up date
                  <input
                    type="date"
                    value={feedbackDraft.followUpDate}
                    onChange={(event) =>
                      setFeedbackDraft({
                        ...feedbackDraft,
                        followUpDate: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={addFeedbackRecord}
                  className="w-full rounded-lg bg-[#121212] px-3 py-2.5 text-xs font-semibold text-white"
                >
                  Save Record
                </button>
              </div>
            </section>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Continuous Performance Context
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Author, visibility, related goals, and follow-up timing remain
                  explicit.
                </p>
              </div>
              {developmentStore.feedbackRecords.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No feedback or coaching records yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {developmentStore.feedbackRecords.map((record) => {
                    const person = getPersonById(record.personId);
                    const author = getPersonById(record.authorId);
                    return (
                      <article key={record.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                                {record.recordType}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                <Eye className="h-3 w-3" />
                                {record.visibility}
                              </span>
                            </div>
                            <h3 className="mt-2 text-xs font-bold text-slate-900">
                              {person?.fullName ?? "Unknown person"}
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                              {record.note}
                            </p>
                            {record.coachingAction && (
                              <p className="mt-1 text-[11px] text-slate-500">
                                <span className="font-bold">Action:</span>{" "}
                                {record.coachingAction}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-[10px] text-slate-400">
                            <p>{author?.fullName ?? record.authorId}</p>
                            <p>{new Date(record.createdAt).toLocaleString()}</p>
                            {record.followUpDate && (
                              <p className="mt-1 font-semibold text-amber-700">
                                Follow up {record.followUpDate}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {workspaceTab === "Performance Improvement" && (
          <div className="space-y-4">
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-2">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Create Performance Improvement Plan
                  </h2>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  A PIP supports human-led improvement. It never automates
                  disciplinary or employment decisions.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={pipDraft.personId}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      personId: event.target.value,
                      relatedReviewId: "",
                      assignedManagerId: "",
                    })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">Select person</option>
                  {SHARED_PERSONNEL.filter(
                    (person) => person.employmentStatus !== "Inactive",
                  ).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>
                <select
                  value={pipDraft.relatedReviewId}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      relatedReviewId: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">Finalized related review</option>
                  {evaluations
                    .filter(
                      (evaluation) =>
                        evaluation.personId === pipDraft.personId &&
                        evaluation.status === "Completed",
                    )
                    .map((evaluation) => (
                      <option key={evaluation.id} value={evaluation.id}>
                        {periods.find(
                          (period) => period.id === evaluation.periodId,
                        )?.cycleName ?? evaluation.id}
                      </option>
                    ))}
                </select>
                <textarea
                  rows={2}
                  value={pipDraft.performanceConcern}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      performanceConcern: event.target.value,
                    })
                  }
                  placeholder="Performance concern"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <textarea
                  rows={2}
                  value={pipDraft.expectedImprovement}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      expectedImprovement: event.target.value,
                    })
                  }
                  placeholder="Expected improvement"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <input
                  value={pipDraft.actionItem}
                  onChange={(event) =>
                    setPipDraft({ ...pipDraft, actionItem: event.target.value })
                  }
                  placeholder="Specific action item"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <select
                  value={pipDraft.assignedManagerId}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      assignedManagerId: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">Assigned manager</option>
                  {SHARED_PERSONNEL.filter(
                    (candidate) =>
                      pipDraft.personId &&
                      canEvaluate(candidate.id, pipDraft.personId, {
                        periodId: evaluations.find(
                          (evaluation) =>
                            evaluation.id === pipDraft.relatedReviewId,
                        )?.periodId,
                        periods,
                        assignments,
                        requireActivePeriod: false,
                      }),
                  ).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName}
                    </option>
                  ))}
                </select>
                <label className="text-[10px] font-bold text-slate-400">
                  Start
                  <input
                    type="date"
                    value={pipDraft.startDate}
                    onChange={(event) =>
                      setPipDraft({
                        ...pipDraft,
                        startDate: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700"
                  />
                </label>
                <label className="text-[10px] font-bold text-slate-400">
                  Target end
                  <input
                    type="date"
                    value={pipDraft.targetEndDate}
                    onChange={(event) =>
                      setPipDraft({
                        ...pipDraft,
                        targetEndDate: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700"
                  />
                </label>
                <input
                  value={pipDraft.firstMilestone}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      firstMilestone: event.target.value,
                    })
                  }
                  placeholder="First check-in milestone (optional)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <input
                  type="date"
                  value={pipDraft.firstMilestoneDate}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      firstMilestoneDate: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <select
                  value={pipDraft.developmentActionSource}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      developmentActionSource: event.target.value as
                        "Learning" | "Training" | "Competency",
                    })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option>Learning</option>
                  <option>Training</option>
                  <option>Competency</option>
                </select>
                <input
                  value={pipDraft.developmentActionTitle}
                  onChange={(event) =>
                    setPipDraft({
                      ...pipDraft,
                      developmentActionTitle: event.target.value,
                    })
                  }
                  placeholder="Linked development action (optional)"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={addPip}
                  className="rounded-lg bg-[#121212] px-3 py-2.5 text-xs font-semibold text-white sm:col-span-2"
                >
                  Create PIP
                </button>
              </div>
            </section>
            {phase4Message && (
              <p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800">
                {phase4Message}
              </p>
            )}
            <section className="grid gap-4 lg:grid-cols-2">
              {developmentStore.pips.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-500 lg:col-span-2">
                  No Performance Improvement Plans are currently open.
                </div>
              ) : (
                developmentStore.pips.map((pip) => {
                  const person = getPersonById(pip.personId);
                  const manager = getPersonById(pip.assignedManagerId);
                  return (
                    <article
                      key={pip.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            {person?.fullName ?? "Unknown person"}
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Manager: {manager?.fullName ?? "Unknown"} ·{" "}
                            {pip.startDate} → {pip.targetEndDate}
                          </p>
                        </div>
                        <select
                          value={pip.status}
                          onChange={(event) =>
                            updatePipStatus(
                              pip.id,
                              event.target.value as PipStatus,
                            )
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold"
                        >
                          <option>Active</option>
                          <option>On Track</option>
                          <option>Extended</option>
                          <option>Completed</option>
                          <option>Escalated for HR Review</option>
                        </select>
                      </div>
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                        <p className="font-bold text-slate-700">
                          Expected improvement
                        </p>
                        <p className="mt-1 text-slate-600">
                          {pip.expectedImprovement}
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Milestones / check-ins
                        </p>
                        {pip.milestones.length ? (
                          pip.milestones.map((milestone) => (
                            <label
                              key={milestone.id}
                              className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={milestone.status === "Completed"}
                                onChange={() =>
                                  togglePipMilestone(pip.id, milestone.id)
                                }
                                className="mt-0.5 accent-amber-500"
                              />
                              <span>
                                <span className="font-semibold text-slate-700">
                                  {milestone.title}
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                  Due {milestone.dueDate}
                                </span>
                              </span>
                            </label>
                          ))
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            No check-in milestone recorded.
                          </p>
                        )}
                      </div>
                      {pip.developmentActions.length > 0 && (
                        <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs">
                          <p className="text-[10px] font-bold uppercase text-sky-700">
                            Linked development actions
                          </p>
                          {pip.developmentActions.map((action) => (
                            <p key={action.id} className="mt-1 text-sky-800">
                              {action.source}: {action.title} · {action.status}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          value={pipProgressDrafts[pip.id] ?? ""}
                          onChange={(event) =>
                            setPipProgressDrafts((previous) => ({
                              ...previous,
                              [pip.id]: event.target.value,
                            }))
                          }
                          placeholder="Progress / check-in note"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => addPipProgressNote(pip.id)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          Add Note
                        </button>
                      </div>
                      {pip.progressNotes.length > 0 && (
                        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                          {pip.progressNotes.map((note) => (
                            <p key={note.id}>
                              {new Date(note.createdAt).toLocaleString()} ·{" "}
                              {note.note}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          value={pipHrNoteDrafts[pip.id] ?? ""}
                          onChange={(event) =>
                            setPipHrNoteDrafts((previous) => ({
                              ...previous,
                              [pip.id]: event.target.value,
                            }))
                          }
                          placeholder="HR review / outcome note"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => savePipHrReviewNote(pip.id)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          Save HR Note
                        </button>
                      </div>
                      {pip.hrReviewNotes && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          <span className="font-bold">HR review:</span>{" "}
                          {pip.hrReviewNotes}
                        </p>
                      )}
                    </article>
                  );
                })
              )}
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Trainee Journey
                </h2>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                P&amp;D readiness never changes official HR1 employment status.
              </p>
              <div className="mt-4 space-y-3">
                {developmentStore.traineeJourneys.map((journey) => {
                  const trainee = getPersonById(journey.traineeId);
                  const stageIndex = TRAINEE_JOURNEY_STAGES.indexOf(
                    journey.currentStage,
                  );
                  return (
                    <div
                      key={journey.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {trainee?.fullName ?? "Unknown trainee"}
                          </p>
                          <select
                            value={journey.currentStage}
                            onChange={(event) =>
                              updateTraineeJourneyStage(
                                journey.id,
                                event.target
                                  .value as (typeof TRAINEE_JOURNEY_STAGES)[number],
                              )
                            }
                            className="mt-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-600"
                          >
                            {TRAINEE_JOURNEY_STAGES.map((stage) => (
                              <option key={stage}>{stage}</option>
                            ))}
                          </select>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          {stageIndex + 1} / {TRAINEE_JOURNEY_STAGES.length}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-6">
                        {TRAINEE_JOURNEY_STAGES.map((stage, index) => (
                          <div
                            key={stage}
                            title={stage}
                            className={`h-2 rounded-full ${index <= stageIndex ? "bg-emerald-500" : "bg-slate-100"}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}