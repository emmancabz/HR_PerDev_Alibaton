import SystemSelect from '@/Components/SystemSelect';
import PerformanceGoalsWorkspace from '@/Components/Performance/PerformanceGoalsWorkspace';
import PerformanceReviewsWorkspace, {
  type PerformanceReviewWorkspaceRow,
  type PerformancePreReviewRow,
  type ReviewTransitionEligibility,
} from '@/Components/Performance/PerformanceReviewsWorkspace';
import PerformanceDetailsModal from '@/Components/Performance/PerformanceDetailsModal';
import {
    ChartDateRangeControl,
    DEFAULT_CHART_DATE_RANGE,
    dateFallsInChartRange,
    resolveChartDateRange,
    type ChartDateRangeValue,
} from "@/Components/ChartDateRange";
import {
    canEvaluate,
    getActiveEvaluationPeriod,
    getEligiblePeopleForEvaluator,
    getEvaluatorScopeLabels,
    hasPrimaryAssignmentConflict,
    type AssignmentScopeType,
    type EvaluationPeriod,
    type EvaluatorAssignment,
} from "@/data/evaluatorAssignments";
import {
    ALL_ANALYTICS_CYCLES,
    ALL_ANALYTICS_DEPARTMENTS,
    ALL_ANALYTICS_EVALUATORS,
    ALL_ANALYTICS_PERSON_TYPES,
    ALL_ANALYTICS_TEMPLATES,
    applyPerformanceAnalyticsFilters,
    getAccurateRatingDistribution,
    getDepartmentTrendAnalytics,
    getEvaluatorCalibrationAnalytics,
    getGoalTrendAnalytics,
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
    type PerformanceDevelopmentStore,
    type PerformanceImprovementPlan,
} from "@/data/performanceDevelopment";
import {
    GROQ_PERFORMANCE_USE_CASES,
    prepareGroqPerformanceContext,
    type GroqPerformanceUseCase,
    type PreparedGroqPerformanceContext,
} from "@/data/performanceIntelligence";
import {
    totalTemplateWeight,
    type GoalTemplate,
    type PerformanceGoal,
    type ReviewTemplate,
    type ReviewTemplateCriterion,
} from "@/data/performancePlanning";
import {
    resolvePerformanceReviewBoardStage,
    type PerformanceReviewBoardStage,
} from "@/data/performanceReviewBoard";
import {
    averageLatestFinalizedRating,
    buildPerformanceAttentionQueue,
    countEmployeesNeedingSupport,
    latestRatingDistribution,
    summarizeGoalHealth,
} from "@/data/performanceOverview";
import {
    DEVELOPMENT_RECOMMENDATION_OPTIONS,
    getDisplayStatus,
    getReviewWorkflowState,
    type CalibrationHistoryRecord,
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
import AuthenticatedLayout, { HeaderActions, HeaderFilters } from "@/Layouts/AuthenticatedLayout";
import { Head, router, usePage } from "@inertiajs/react";
import { encodeWorkspaceHash, useHashWorkspace } from "@/workspaceNavigation";
import {
    AlertTriangle,
    BarChart3,
    Briefcase,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronUp,
    ClipboardList,
    Cpu,
    Eye,
    GraduationCap,
    GripVertical,
    Hash,
    Maximize2,
    Plus,
    RotateCcw,
    Search,
    Settings2,
    Star,
    Target,
    Trash2,
    TrendingUp,
    UserRound,
    Users,
    X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type DragEvent, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ---------------------------------------------------------------------- */
/* Review presentation criteria. Official review data is server-owned.    */
/* Identity always resolves from the canonical Users/personnel directory. */
/* ---------------------------------------------------------------------- */

// Review criteria are loaded from the persisted Review Template for the selected cycle.
// The client does not maintain a second Performance-only scoring definition.

type PerformanceLevelKey =
  "exceptional" | "exceeds" | "meets" | "needsImprovement" | "critical";
type PipLifecycleLabel = "Active" | "Extended" | "Outcome Review Due" | "Closed";
type PipOutcomeResult = "Expectations Met" | "Partially Met" | "Expectations Not Met";
type PerformanceAnalyticsChartId =
  | "review-workflow"
  | "rating-distribution"
  | "rating-trend"
  | "goal-trend"
  | "department-performance"
  | "pip-activity"
  | "finalization-quality"
  | "evaluator-consistency";

const DEFAULT_PERFORMANCE_ANALYTICS_CHART_ORDER: PerformanceAnalyticsChartId[] = [
  "review-workflow",
  "rating-distribution",
  "rating-trend",
  "goal-trend",
  "department-performance",
  "pip-activity",
  "finalization-quality",
  "evaluator-consistency",
];

const PERFORMANCE_ANALYTICS_LAYOUT_KEY = "alibaton.performance.analytics.chart-order.v1";

function PerformanceSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
  selected = false,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`app-kpi-card group relative min-h-[108px] w-full p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-xl font-extrabold tabular-nums tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-amber-600 transition-colors ${selected ? "bg-amber-100 ring-1 ring-amber-300" : "bg-amber-50 group-hover:bg-amber-100"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">{detail}</p>
    </button>
  );
}

function pipLifecycleForAnalytics(pip: PerformanceImprovementPlan, today: string): PipLifecycleLabel {
  if (pip.status === "Completed") return "Closed";
  if (pip.targetEndDate <= today) return "Outcome Review Due";
  if (pip.status === "Extended") return "Extended";
  return "Active";
}

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

type StatusFilter =
  | "All"
  | "Performance Period Ongoing"
  | "Not Started"
  | "In Progress"
  | "Manager Review"
  | "360 Feedback Collection"
  | "Calibration"
  | "Calibration Pending"
  | "Calibration In Review"
  | "Revision In Progress"
  | "Finalized"
  | "Overdue";
type FormMode = "create" | "edit";
type OverviewCardKey =
  | "averageRating"
  | "goalHealth"
  | "completion"
  | "support";
type PerformanceWorkspaceTab =
  | "Overview"
  | "Review Governance"
  | "Reviews"
  | "Performance Improvement"
  | "Analytics";

const PERFORMANCE_WORKSPACE_TABS: {
  label: PerformanceWorkspaceTab;
  icon: ComponentType<{ className?: string }>;
  phase: number;
}[] = [
  { label: "Overview", icon: ClipboardList, phase: 1 },
  { label: "Review Governance", icon: Settings2, phase: 2 },
  { label: "Reviews", icon: Star, phase: 2 },
  { label: "Performance Improvement", icon: TrendingUp, phase: 4 },
  { label: "Analytics", icon: BarChart3, phase: 5 },
];

const PERFORMANCE_WORKSPACES = PERFORMANCE_WORKSPACE_TABS.map(
  (tab) => tab.label,
) as PerformanceWorkspaceTab[];

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


function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatReviewDate(value?: string | null): string {
  if (!value) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addDaysToIsoDate(value: string, days: number): string {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
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

function weightedReviewScore(
  criteria: readonly ReviewTemplateCriterion[],
  scores: Record<string, number>,
) {
  if (criteria.length === 0) return null;
  const complete = criteria.every((criterion) => (scores[criterion.name] ?? 0) > 0);
  if (!complete) return null;
  const totalWeight = criteria.reduce((total, criterion) => total + criterion.weight, 0);
  if (totalWeight <= 0) return null;
  const weighted = criteria.reduce(
    (total, criterion) => total + (scores[criterion.name] ?? 0) * criterion.weight,
    0,
  );
  return Number((weighted / totalWeight).toFixed(2));
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

function hasFormalReviewActivity(evaluation: Evaluation): boolean {
  return (
    evaluation.status !== "Pending" ||
    evaluation.rating !== null ||
    !!evaluation.managerSubmittedAt ||
    !!evaluation.finalizedAt ||
    (evaluation.competencyScores?.length ?? 0) > 0 ||
    (() => {
      const workflowState = String(evaluation.workflowState ?? "");
      return workflowState !== "" &&
        !["Scheduled", "Manager Review", "Not Started"].includes(workflowState);
    })()
  );
}

function isReviewScheduled(
  evaluation: Evaluation,
  period: EvaluationPeriod | undefined,
  serverDate: string,
): boolean {
  if (String(evaluation.workflowState ?? "") === "Scheduled") return true;
  return !!period &&
    !!serverDate &&
    serverDate < period.reviewOpenDate &&
    !hasFormalReviewActivity(evaluation);
}

function StaticStarRating({
  score,
  size = "h-3.5 w-3.5",
}: {
  score: number;
  size?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${score.toFixed(1)} out of 5 stars`}
      title={`${score.toFixed(1)} / 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${score >= star ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300"}`}
        />
      ))}
    </span>
  );
}

type Leadership360ReviewMeta = {
  responseCount: number;
  selfResponses: number;
  directReportResponses: number;
  peerLeaderResponses: number;
  requiredSelfResponses: number;
  requiredDirectReportResponses: number;
  requiredPeerLeaderResponses: number;
  coverageReady: boolean;
  criteria: { name: string; weight: number }[];
  scores: { name: string; score: number; weight?: number }[];
  submittedRating: number | null;
};

type ReviewRuntimeMeta = {
  reviewMethod?: "Manager Review" | "360° Leadership Review";
  leadership360?: Leadership360ReviewMeta | null;
  workflowState?: string;
};

/* ---------------------------------------------------------------------- */
/* Review Details Modal                                                  */
/* ---------------------------------------------------------------------- */

function EvaluationDetailsModal({
  onEditReview,
  evaluation,
  person,
  evaluator,
  period,
  canManage,
  onClose,
  onApproveCalibration,
  onReturnCalibration,
  feedbackRecords,
  relatedPips,
  goals,
  goalTemplates,
  reviewTemplates,
  serverDate,
}: {
  onEditReview?: () => void;
  evaluation: Evaluation;
  person: PersonnelIdentity;
  evaluator: PersonnelIdentity | undefined;
  period: EvaluationPeriod | undefined;
  canManage: boolean;
  onClose: () => void;
  onApproveCalibration: () => void;
  onReturnCalibration: (notes: string) => void;
  feedbackRecords: PerformanceDevelopmentStore["feedbackRecords"];
  relatedPips: PerformanceDevelopmentStore["pips"];
  goals: PerformanceGoal[];
  goalTemplates: GoalTemplate[];
  reviewTemplates: ReviewTemplate[];
  serverDate: string;
}) {
  const displayStatus = getDisplayStatus(evaluation);
  const runtimeMeta = evaluation as unknown as ReviewRuntimeMeta;
  const isLeadership360 = runtimeMeta.reviewMethod === "360° Leadership Review";
  const leadership360 = runtimeMeta.leadership360 ?? null;
  const workflowState = runtimeMeta.workflowState === "360 Feedback Collection"
    ? "360 Feedback Collection"
    : getReviewWorkflowState(evaluation, period?.calibrationRequired);
  const scheduled = isReviewScheduled(evaluation, period, serverDate);
  const workflowDisplay = scheduled ? "Scheduled" : workflowState;
  const effectiveDisplayStatus = scheduled ? "Scheduled" : displayStatus;
  const reviewGoals = goals.filter(
    (goal) => goal.personId === person.id && goal.cycleId === evaluation.periodId,
  );
  const goalWeight = reviewGoals.reduce((sum, goal) => sum + goal.weight, 0);
  const weightedGoalProgress = goalWeight > 0
    ? Math.round(
        reviewGoals.reduce((sum, goal) => sum + goal.progress * goal.weight, 0) /
          goalWeight,
      )
    : null;
  const goalPlanName =
    goalTemplates.find((template) => template.id === reviewGoals[0]?.templateId)?.name ??
    (reviewGoals.length ? "Assigned Goal Plan" : "No Goal Plan linked");
  const activeReviewTemplate = reviewTemplates.find(
    (template) => template.id === evaluation.reviewTemplateId,
  );
  const reviewTemplateName = isLeadership360
    ? "360° Leadership Review"
    : (activeReviewTemplate?.name ?? "Governed Review Template");
  const goalHealth = reviewGoals.some((goal) => goal.status === "At Risk")
    ? "Needs attention"
    : reviewGoals.length && reviewGoals.every((goal) => goal.status === "Completed")
      ? "Completed"
      : reviewGoals.length
        ? "Healthy"
        : "No context";
  const configuredCriteria = isLeadership360
    ? (leadership360?.criteria ?? [])
    : (activeReviewTemplate?.criteria ?? []);
  const scoredCriteria = evaluation.competencyScores ?? [];
  const scoreByCriterion = new Map(scoredCriteria.map((score) => [score.name, score.score]));
  const criteriaComplete =
    configuredCriteria.length > 0 &&
    configuredCriteria.every((criterion) => {
      const score = scoreByCriterion.get(criterion.name) ?? 0;
      return score >= 1 && score <= 5;
    });
  const calibrationStartedRecord = [...(evaluation.calibrationHistory ?? [])]
    .reverse()
    .find((record) => record.action === "Review Started");
  const calibrationApprovedRecord = [...(evaluation.calibrationHistory ?? [])]
    .reverse()
    .find((record) => record.action === "Approved");
  const calibrationChecks = [
    {
      label: "Configured criterion ratings",
      ready: criteriaComplete,
      detail: configuredCriteria.length
        ? `${scoredCriteria.length} of ${configuredCriteria.length} criteria rated on the 1–5 scale`
        : "No governed template criteria are available",
    },
    {
      label: "Goals & KPI context",
      ready: reviewGoals.length > 0 && goalWeight === 100,
      detail: reviewGoals.length
        ? `${reviewGoals.length} goals linked · ${goalWeight}% total weight`
        : "No cycle-specific goal context is linked",
    },
    {
      label: isLeadership360 ? "Multi-source coverage" : "Evaluator authority",
      ready: isLeadership360 ? !!leadership360?.coverageReady : !!evaluator,
      detail: isLeadership360
        ? leadership360
          ? `Self ${leadership360.selfResponses}/${leadership360.requiredSelfResponses} · Direct reports ${leadership360.directReportResponses}/${leadership360.requiredDirectReportResponses} · Peer leaders ${leadership360.peerLeaderResponses}/${leadership360.requiredPeerLeaderResponses}`
          : "360° coverage summary is unavailable"
        : evaluator
          ? `${evaluator.fullName} is the recorded evaluator for this review`
          : "Evaluator identity is unavailable",
    },
    {
      label: isLeadership360 ? "Governed consolidation" : "Evaluator rationale",
      ready: isLeadership360 ? !!leadership360?.coverageReady : !!evaluation.comments?.trim(),
      detail: isLeadership360
        ? leadership360?.coverageReady
          ? `${leadership360.responseCount} valid multi-source responses were consolidated without assigning unilateral authority to any contributor`
          : "Required 360° feedback coverage is still incomplete"
        : evaluation.comments?.trim()
          ? "Evaluator comments are recorded"
          : "No evaluator comments are recorded",
    },
  ];
  const [calibrationRevisionComment, setCalibrationRevisionComment] = useState("");
  const calibrationChecksRef = useRef<HTMLDivElement | null>(null);
  const [calibrationChecksVisible, setCalibrationChecksVisible] = useState(false);
  useEffect(() => {
    setCalibrationRevisionComment("");
  }, [evaluation.id, workflowState]);
  useEffect(() => {
    setCalibrationChecksVisible(false);
    if (workflowState !== "Calibration In Review") return;
    const node = calibrationChecksRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setCalibrationChecksVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCalibrationChecksVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [evaluation.id, workflowState]);
  return (
    <PerformanceDetailsModal
      ariaLabel={`${person.fullName} · Review Details`}
      eyebrow="Review Details"
      title={person.fullName}
      subtitle={`${person.position} · ${person.department}`}
      onClose={onClose}
      leading={
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm"
          style={{ backgroundColor: "#F4B400" }}
        >
          {initialsFor(person.fullName)}
        </div>
      }
      headerMeta={
        <>
          <PersonTypeBadge personType={person.personType} />
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${effectiveDisplayStatus === "Completed" ? "bg-emerald-50 text-emerald-700" : effectiveDisplayStatus === "Overdue" ? "bg-rose-50 text-rose-700" : effectiveDisplayStatus === "Scheduled" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${effectiveDisplayStatus === "Completed" ? "bg-emerald-400" : effectiveDisplayStatus === "Overdue" ? "bg-rose-400" : effectiveDisplayStatus === "Scheduled" ? "bg-slate-400" : "bg-amber-400"}`}
            />
            {effectiveDisplayStatus}
          </span>
          {evaluation.rating !== null ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
              <StaticStarRating score={evaluation.rating} size="h-3 w-3" />
              {evaluation.rating.toFixed(2)} / 5 {workflowState === "Finalized" ? "Final Rating" : ["Calibration Pending", "Calibration In Review"].includes(workflowState) ? "Submitted Rating" : "Current Rating"}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
              Formal Rating Pending
            </span>
          )}
        </>
      }
      headerActions={
        <>
          {onEditReview && (
            <button
              type="button"
              onClick={onEditReview}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 transition hover:bg-amber-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete manager review
            </button>
          )}
          {canManage && workflowState === "Calibration In Review" && (
            <>
              <button
                type="button"
                onClick={() => onReturnCalibration(calibrationRevisionComment.trim())}
                disabled={!calibrationRevisionComment.trim()}
                title={!calibrationRevisionComment.trim() ? "Add a revision comment in Calibration Review before returning this review." : "Return this review to the evaluator with the recorded revision comment."}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Return for Revision
              </button>
              <button
                type="button"
                onClick={onApproveCalibration}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve &amp; Finalize
              </button>
            </>
          )}
        </>
      }
      contentClassName="space-y-3 bg-slate-50/50 px-4 py-4 sm:px-6"
    >

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
              Review Information
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-400">Performance Cycle</p>
                <p className="font-semibold text-slate-800">
                  {period?.cycleName ?? "Unknown cycle"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Review Template</p>
                <p className="font-semibold text-slate-800">{reviewTemplateName}</p>
              </div>
              <div>
                <p className="text-slate-400">Evaluator</p>
                <p className="font-semibold text-slate-800">
                  {isLeadership360
                    ? "Multi-source · Self + Direct Reports + Peer Leaders"
                    : evaluator
                      ? `${evaluator.fullName} (${evaluator.position})`
                      : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">
                  {evaluation.status === "Completed"
                    ? "Finalized"
                    : scheduled
                      ? "Review Opens"
                      : "Due Date"}
                </p>
                <p className="font-semibold text-slate-800">
                  {formatReviewDate(
                    evaluation.status === "Completed"
                      ? (evaluation.finalizedAt ?? evaluation.dateEvaluated)
                      : scheduled
                        ? period?.reviewOpenDate
                        : (evaluation.dueDate ?? period?.reviewDueDate),
                  )}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Workflow State</p>
                <p className="font-semibold text-slate-800">{workflowDisplay}</p>
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
          {workflowState === "Calibration Pending" && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Calibration Status
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-900">Awaiting Calibration</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">
                      {isLeadership360
                        ? "Required 360° feedback coverage is complete and the system has consolidated the multi-source leadership result. Opening this submitted record starts the Admin/HR calibration review automatically; contributor identities remain protected and the record is not finalized until an authorized decision is made."
                        : "The evaluator has submitted the formal review. Opening the record starts the Admin/HR calibration review automatically. The submitted rating remains unchanged until you either return the review for revision or approve and finalize it."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                      <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-slate-700">
                        Submitted rating: {evaluation.rating == null ? "Pending" : `${evaluation.rating.toFixed(2)} / 5`}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-slate-700">
                        Next step: Open review and decide
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {workflowState === "Calibration In Review" && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Calibration Review
              </p>
              <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/45 p-4 shadow-sm">
                <div ref={calibrationChecksRef} className="grid gap-2 sm:grid-cols-2">
                  {calibrationChecks.map((check, index) => (
                    <div
                      key={check.label}
                      className={`rounded-lg border bg-white p-3 transition-all duration-500 ${check.ready ? "border-emerald-100" : "border-amber-200"} ${calibrationChecksVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-40"}`}
                      style={{ transitionDelay: `${index * 90}ms` }}
                    >
                      <div className="flex items-start gap-2">
                        {check.ready ? (
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 text-emerald-600 transition-transform duration-500 ${calibrationChecksVisible ? "scale-100" : "scale-75"}`} />
                        ) : (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        )}
                        <div>
                          <p className="text-[11px] font-bold text-slate-800">{check.label}</p>
                          <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{check.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] leading-5 text-slate-600">
                  <span className="font-bold text-slate-800">Supporting evidence:</span>{" "}
                  {(evaluation.linkedEvidence?.length ?? 0) > 0
                    ? `${evaluation.linkedEvidence?.length ?? 0} linked evidence record${(evaluation.linkedEvidence?.length ?? 0) === 1 ? "" : "s"} available for context.`
                    : "No cross-module evidence is linked. Missing evidence is not automatically treated as a zero or automatic failure."}
                  {calibrationStartedRecord && (
                    <span className="ml-1 text-slate-500">
                      Calibration started by {calibrationStartedRecord.actor}.
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label htmlFor={`calibration-revision-comment-${evaluation.id}`} className="text-[11px] font-bold text-slate-800">
                        Calibration comment
                      </label>
                      <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                        Required only when returning the review. State exactly what the evaluator must correct, clarify, or support before resubmission.
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${calibrationRevisionComment.trim() ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {calibrationRevisionComment.trim() ? "Revision comment ready" : "Required for return"}
                    </span>
                  </div>
                  <textarea
                    id={`calibration-revision-comment-${evaluation.id}`}
                    value={calibrationRevisionComment}
                    onChange={(event) => setCalibrationRevisionComment(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Example: Clarify the rating rationale for Goal/KPI Achievement and cite the verified Q3 evidence used for the score."
                    className="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                  />
                  <div className="mt-1 flex justify-between text-[9px] text-slate-400">
                    <span>The comment is recorded with the governed return action.</span>
                    <span>{calibrationRevisionComment.length}/1000</span>
                  </div>
                </div>
                <div className="rounded-lg border border-violet-200 bg-violet-100/55 px-3 py-2.5 text-[10px] leading-5 text-violet-950">
                  <span className="font-bold">Decision:</span> use <span className="font-semibold">Return for Revision</span> only after recording a clear calibration comment. Use <span className="font-semibold">Approve &amp; Finalize</span> when the submitted review is acceptable as the official result. Finalized records are locked as the official result for the completed workflow.
                </div>
              </div>
            </div>
          )}
          {workflowState === "Finalized" && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Finalized Result
              </p>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/55 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-900">Official performance review</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">
                      This result is finalized and read-only for the completed workflow. The evaluator rating below is now the official recorded rating for this review.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-emerald-100 bg-white p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Official rating</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{evaluation.rating == null ? "—" : `${evaluation.rating.toFixed(2)} / 5`}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-white p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Finalized</p>
                    <p className="mt-1 text-xs font-bold text-slate-800">{formatReviewDate(evaluation.finalizedAt ?? evaluation.dateEvaluated)}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-white p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Calibration</p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">{period?.calibrationRequired ? "Approved" : "Not required"}</p>
                    {calibrationApprovedRecord?.actor && (
                      <p className="mt-0.5 text-[10px] text-slate-500">by {calibrationApprovedRecord.actor}</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-white p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Acknowledgment</p>
                    <p className="mt-1 text-xs font-bold text-slate-800">
                      {evaluation.acknowledgment ? "Received / Viewed" : period?.employeeAcknowledgment === "Not Required" ? "Not required" : "Awaiting employee"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Formal Evaluation
            </p>
            <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
              {evaluation.competencyScores && evaluation.competencyScores.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Evaluator criterion ratings</p>
                      <p className="mt-1 text-xs text-slate-500">{isLeadership360 ? "Aggregated from governed self, direct-report, and peer-leadership inputs. Individual contributor identities are not part of the formal score record." : person.personType === "Employee" ? `Loaded from ${reviewTemplateName}: shared core criteria plus applicable function criteria, all rated on the governed 1–5 star scale.` : `Loaded from ${reviewTemplateName}: trainee-specific development criteria rated on the governed 1–5 star scale.`}</p>
                    </div>
                    {evaluation.rating !== null && (
                      <div className="text-right">
                        <StaticStarRating score={evaluation.rating} />
                        <p className="mt-1 text-xs font-extrabold text-slate-900">{evaluation.rating.toFixed(2)} / 5</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {evaluation.competencyScores.map((c) => (
                      <div
                        key={c.name}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs"
                      >
                        <span className="min-w-0 flex-1 font-semibold text-slate-700">{c.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <StaticStarRating score={c.score} />
                          <span className="w-12 text-right font-bold tabular-nums text-slate-900">{c.score.toFixed(1)} / 5</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {evaluation.rating === null && (
                    <p className="border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-500">
                      {isLeadership360
                        ? "Leadership criterion aggregation is still in progress. The submitted result remains pending until the required multi-source coverage is complete."
                        : "Criterion ratings are in progress. The formal weighted rating remains pending until the evaluator completes the required criteria and submits the review."}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs leading-5 text-slate-500">
                  {isLeadership360 && workflowState === "360 Feedback Collection"
                    ? "360° Leadership Feedback is being collected from authorized sources. The formal criterion result appears only after the required coverage threshold is reached."
                    : scheduled
                      ? "This review is still scheduled. No evaluator star ratings have been recorded yet."
                      : evaluation.status === "Pending"
                        ? "Formal evaluation has not started yet. The assigned evaluator will rate each governed criterion using the 1–5 star scale."
                        : "No submitted formal criterion ratings are available yet."}
                </p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Goals &amp; KPI Performance
            </p>
            <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Goal Plan</p>
                  <p className="mt-1 text-xs font-bold text-slate-800">{goalPlanName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weighted Progress</p>
                  <p className="mt-1 text-xs font-bold text-slate-800">{weightedGoalProgress == null ? "—" : `${weightedGoalProgress}%`}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Weight</p>
                  <p className={`mt-1 text-xs font-bold ${goalWeight === 100 ? "text-emerald-700" : "text-rose-700"}`}>{goalWeight}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Goal Health</p>
                  <p className="mt-1 text-xs font-bold text-slate-800">{goalHealth}</p>
                </div>
              </div>
              {reviewGoals.length ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {reviewGoals.map((goal) => (
                    <div key={goal.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">{goal.metricType}</span>
                            <p className="font-semibold text-slate-800">{goal.title}</p>
                          </div>
                          <p className="mt-1 leading-5 text-slate-500">Target: {goal.target}{goal.unit ? ` · ${goal.unit}` : ""} · Weight {goal.weight}%</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900">{goal.progress}%</p>
                          <p className={`mt-0.5 text-[10px] font-semibold ${goal.status === "At Risk" ? "text-rose-700" : goal.status === "Completed" ? "text-emerald-700" : "text-slate-500"}`}>{goal.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">No cycle-specific Goals/KPIs are linked to this review. Missing context does not become a zero rating.</p>
              )}
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-[11px] leading-5 text-amber-900">
                {scheduled
                  ? `Formal evaluation is scheduled to open ${period?.reviewOpenDate ?? "on the configured review date"}. The evaluator will use this same verified Goal/KPI context when the review opens.`
                  : "Goal progress is workplace-performance context. It supports evaluator judgment but is never automatically converted into the formal 1–5 Performance rating."}
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
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isLeadership360 ? "Governance Summary" : "Evaluator Comments"}
            </p>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm text-xs leading-relaxed text-slate-700">
              {evaluation.comments ||
                (isLeadership360 ? "No consolidated 360° governance summary is available yet." : "No evaluator comments recorded for this review.")}
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
                "No development recommendations have been added for this review."
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
                  cross-module evidence is linked to this review. Missing
                  evidence does not block the review or become a zero score.
                </p>
              )}
            </div>
          </div>
          {(evaluation.auditTrail?.length ?? 0) > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Audit Trail
              </p>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
                {[...(evaluation.auditTrail ?? [])].reverse().map((record, index) => {
                  const correction = record.type === 'Administrative Goal Correction';
                  return (
                    <div key={`${record.type}-${record.timestamp}-${index}`} className={`rounded-lg border p-3 text-xs ${correction ? 'border-amber-100 bg-amber-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`font-semibold ${correction ? 'text-amber-900' : 'text-slate-800'}`}>{record.type}</p>
                        <span className="text-[10px] text-slate-400">{new Date(record.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">Actor: {record.actor}{record.actorRole ? ` · ${record.actorRole}` : ''}</p>
                      {(record.fromEvaluatorId || record.toEvaluatorId) && (
                        <p className="mt-1 text-slate-600">{record.fromEvaluatorId ? (getPersonById(record.fromEvaluatorId)?.fullName ?? record.fromEvaluatorId) : '—'} → {record.toEvaluatorId ? (getPersonById(record.toEvaluatorId)?.fullName ?? record.toEvaluatorId) : '—'}</p>
                      )}
                      {record.reason && <p className="mt-1 text-slate-600">Reason: {record.reason}</p>}
                      {record.notes && <p className="mt-1 text-slate-500">{record.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
    </PerformanceDetailsModal>
  );
}

/* ---------------------------------------------------------------------- */
/* Performance Distribution                                                */
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

type ReviewSelection = { evaluation: Evaluation; person: PersonnelIdentity };

/* ---------------------------------------------------------------------- */
/* Main Component                                                         */
/* ---------------------------------------------------------------------- */

export default function PerformanceManagement({ performanceView = "workspace" }: { performanceView?: "workspace" | "manage-evaluators" }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [developmentStore, setDevelopmentStore] =
    useState<PerformanceDevelopmentStore>(
      { feedbackRecords: [], pips: [], traineeJourneys: [] },
    );
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [goalsCycleId, setGoalsCycleId] = useState(() => {
    if (typeof window === "undefined") return "period-q3-2026";
    return new URLSearchParams(window.location.search).get("performance_cycle") ?? "period-q3-2026";
  });
  const [assignments, setAssignments] = useState<EvaluatorAssignment[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [periodFilter, setPeriodFilter] = useState("All Periods");
  const [levelFilter, setLevelFilter] = useState("All Rating Levels");
  const [activeCard, setActiveCard] = useState<OverviewCardKey>("averageRating");
  const [workspaceTab, setWorkspaceTab] = useHashWorkspace<PerformanceWorkspaceTab>(
    PERFORMANCE_WORKSPACES,
    "Overview",
  );
  const [evaluatorFilter, setEvaluatorFilter] = useState("");
  const [selected, setSelected] = useState<ReviewSelection | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<FormState | null>(null);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [reviewGovernancePage, setReviewGovernancePage] = useState(1);
  const [reviewGovernanceDepartmentFilter, setReviewGovernanceDepartmentFilter] = useState("All Departments");
  const [reviewGovernanceRoutingFilter, setReviewGovernanceRoutingFilter] = useState("All Routing");
  const [formError, setFormError] = useState("");
  const [finalizeTarget, setFinalizeTarget] = useState<Evaluation | null>(null);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [reviewTemplates, setReviewTemplates] = useState<ReviewTemplate[]>([]);
  const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoal[]>([]);
  const [assignmentDraft, setAssignmentDraft] = useState<{
    evaluatorId: string;
    scopeType: AssignmentScopeType;
    department: string;
    personId: string;
  }>({
    evaluatorId: "",
    scopeType: "Specific Person",
    department: "",
    personId: "",
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
  const [pipGovernanceMode, setPipGovernanceMode] = useState<"close" | "extend" | null>(null);
  const [pipOutcomeResult, setPipOutcomeResult] = useState<PipOutcomeResult>("Expectations Met");
  const [pipOutcomeNote, setPipOutcomeNote] = useState("");
  const [pipExtensionReason, setPipExtensionReason] = useState("");
  const [pipExtensionTargetDate, setPipExtensionTargetDate] = useState("");
  const [pipExtensionCheckInDate, setPipExtensionCheckInDate] = useState("");
  const [pipExtensionCheckInTitle, setPipExtensionCheckInTitle] = useState("Extension progress check-in");
  const [phase4Message, setPhase4Message] = useState("");
  const [pipCreateOpen, setPipCreateOpen] = useState(false);
  const [pipSourcePickerOpen, setPipSourcePickerOpen] = useState(false);
  const [selectedPipId, setSelectedPipId] = useState<string | null>(null);
  const [pipStatusFilter, setPipStatusFilter] = useState("All Statuses");
  const [pipDepartmentFilter, setPipDepartmentFilter] = useState("All Departments");
  const [pipPage, setPipPage] = useState(1);
  const [analyticsFilters, setAnalyticsFilters] =
    useState<PerformanceAnalyticsFilters>({
      cycleId: ALL_ANALYTICS_CYCLES,
      department: ALL_ANALYTICS_DEPARTMENTS,
      personType: ALL_ANALYTICS_PERSON_TYPES,
      reviewTemplateId: ALL_ANALYTICS_TEMPLATES,
      evaluatorId: ALL_ANALYTICS_EVALUATORS,
    });
  const [analyticsDateRange, setAnalyticsDateRange] =
    useState<ChartDateRangeValue>({ ...DEFAULT_CHART_DATE_RANGE, preset: "all" });
  const [analyticsChartOrder, setAnalyticsChartOrder] = useState<PerformanceAnalyticsChartId[]>(() => {
    if (typeof window === "undefined") return DEFAULT_PERFORMANCE_ANALYTICS_CHART_ORDER;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_ANALYTICS_LAYOUT_KEY) ?? "null");
      if (
        Array.isArray(parsed) &&
        parsed.length === DEFAULT_PERFORMANCE_ANALYTICS_CHART_ORDER.length &&
        DEFAULT_PERFORMANCE_ANALYTICS_CHART_ORDER.every((id) => parsed.includes(id))
      ) {
        return parsed as PerformanceAnalyticsChartId[];
      }
    } catch {
      // Invalid saved layout falls back to the governed default order.
    }
    return DEFAULT_PERFORMANCE_ANALYTICS_CHART_ORDER;
  });
  const [draggedAnalyticsChart, setDraggedAnalyticsChart] = useState<PerformanceAnalyticsChartId | null>(null);
  const [analyticsDropTarget, setAnalyticsDropTarget] = useState<PerformanceAnalyticsChartId | null>(null);
  const draggedAnalyticsChartRef = useRef<PerformanceAnalyticsChartId | null>(null);
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
    (authUser.role === "admin" || authUser.role === "hr");


  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PERFORMANCE_ANALYTICS_LAYOUT_KEY, JSON.stringify(analyticsChartOrder));
  }, [analyticsChartOrder]);

  const movePerformanceAnalyticsChart = (targetId: PerformanceAnalyticsChartId) => {
    const sourceId = draggedAnalyticsChartRef.current;
    if (!sourceId || sourceId === targetId) return;
    setAnalyticsChartOrder((current) => {
      const sourceIndex = current.indexOf(sourceId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
    setAnalyticsDropTarget(targetId);
  };

  const finishPerformanceAnalyticsDrag = () => {
    draggedAnalyticsChartRef.current = null;
    setDraggedAnalyticsChart(null);
    setAnalyticsDropTarget(null);
  };

  const performanceAnalyticsReorder = (id: PerformanceAnalyticsChartId) => ({
    id,
    order: analyticsChartOrder.indexOf(id),
    isDragging: draggedAnalyticsChart === id,
    isTarget: analyticsDropTarget === id && draggedAnalyticsChart !== id,
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      draggedAnalyticsChartRef.current = id;
      setDraggedAnalyticsChart(id);
      setAnalyticsDropTarget(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      const card = event.currentTarget.closest<HTMLElement>("[data-performance-analytics-card]");
      if (card) {
        const rect = card.getBoundingClientRect();
        event.dataTransfer.setDragImage(card, Math.max(20, Math.min(rect.width * 0.08, 48)), 24);
      }
    },
    onDragEnter: () => movePerformanceAnalyticsChart(id),
    onDrop: finishPerformanceAnalyticsDrag,
    onDragEnd: finishPerformanceAnalyticsDrag,
  });

  function performanceWorkspaceHref(workspace: PerformanceWorkspaceTab = workspaceTab) {
    const routeName = authUser.role === "hr" ? "hr.performance.index" : "admin.performance.index";
    const params = new URLSearchParams();
    if (goalsCycleId) params.set("performance_cycle", goalsCycleId);
    const query = params.toString();
    return `${route(routeName)}${query ? `?${query}` : ""}${encodeWorkspaceHash(workspace)}`;
  }

  function openEvaluatorManagementPage(target?: { evaluatorId?: string; personId?: string; cycleId?: string }) {
    const routeName = authUser.role === "hr" ? "hr.performance.evaluators" : "admin.performance.evaluators";
    if (!route().has(routeName)) return;
    const params = new URLSearchParams();
    if (goalsCycleId) params.set("performance_cycle", goalsCycleId);
    if (target?.evaluatorId) params.set("evaluator", target.evaluatorId);
    if (target?.personId) params.set("person", target.personId);
    if (target?.cycleId) params.set("cycle", target.cycleId);
    const query = params.toString();
    router.visit(`${route(routeName)}${query ? `?${query}` : ""}${encodeWorkspaceHash(workspaceTab)}`);
  }

  // Departments come from the shared personnel source, not from Performance's own records.
  const departments = useMemo(
    () => Array.from(new Set(SHARED_PERSONNEL.map((p) => p.department))).sort(),
    [periods],
  );
  const positions = useMemo(
    () => Array.from(new Set(SHARED_PERSONNEL.map((p) => p.position))).sort(),
    [periods],
  );

  const reviewGovernance = useMemo(() => {
    const activePeople = SHARED_PERSONNEL
      .filter((person) => person.employmentStatus !== "Inactive")
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const reportingAssignments = assignments.filter(
      (assignment) =>
        assignment.basis === "Reporting Relationship" ||
        assignment.scopeType === "Reporting Relationship",
    );
    const selectedCycleAssignments = assignments.filter(
      (assignment) =>
        assignment.scopeType === "Specific Person" &&
        assignment.personId &&
        (!assignment.cycleIds?.length || assignment.cycleIds.includes(goalsCycleId)),
    );

    const reportingByPerson = new Map<string, EvaluatorAssignment>();
    reportingAssignments.forEach((assignment) => {
      if (assignment.personId && !reportingByPerson.has(assignment.personId)) {
        reportingByPerson.set(assignment.personId, assignment);
      }
    });

    const cycleAssignmentByPerson = new Map<string, EvaluatorAssignment>();
    selectedCycleAssignments.forEach((assignment) => {
      if (assignment.personId && !cycleAssignmentByPerson.has(assignment.personId)) {
        cycleAssignmentByPerson.set(assignment.personId, assignment);
      }
    });

    const directReportsByLeader = new Map<string, string[]>();
    reportingAssignments.forEach((assignment) => {
      if (!assignment.evaluatorId || !assignment.personId) return;
      const current = directReportsByLeader.get(assignment.evaluatorId) ?? [];
      if (!current.includes(assignment.personId)) current.push(assignment.personId);
      directReportsByLeader.set(assignment.evaluatorId, current);
    });

    const topScopeLeaderIds = new Set(
      activePeople
        .filter(
          (person) =>
            !reportingByPerson.has(person.id) &&
            (directReportsByLeader.get(person.id)?.length ?? 0) > 0,
        )
        .map((person) => person.id),
    );

    const topScopeLeaders = activePeople.filter((person) => topScopeLeaderIds.has(person.id));

    const rows = activePeople.map((person) => {
      const reporting = reportingByPerson.get(person.id);
      const cycleAssignment = cycleAssignmentByPerson.get(person.id);
      const recordedAssignment = reporting ?? cycleAssignment;
      const recordedEvaluator = recordedAssignment?.evaluatorId
        ? getPersonById(recordedAssignment.evaluatorId)
        : undefined;

      if (reporting && recordedEvaluator) {
        return {
          person,
          method: "Manager Review" as const,
          authority: `${recordedEvaluator.fullName} · ${recordedEvaluator.position}`,
          basis: "Direct reporting relationship",
          status: "Ready" as const,
          sourceDetail: "Automatically derived from the recorded organizational reporting relationship.",
          evaluator: recordedEvaluator,
          directReportIds: [] as string[],
          peerLeaderIds: [] as string[],
        };
      }

      if (String(cycleAssignment?.basis ?? "") === "Smart Department Leadership" && recordedEvaluator) {
        return {
          person,
          method: "Manager Review" as const,
          authority: `${recordedEvaluator.fullName} · ${recordedEvaluator.position}`,
          basis: "Smart department leadership routing",
          status: "Ready" as const,
          sourceDetail: "No direct manager was recorded, so the system routed the review to the unique in-scope department leader without changing the organizational manager record.",
          evaluator: recordedEvaluator,
          directReportIds: [] as string[],
          peerLeaderIds: [] as string[],
        };
      }

      if (topScopeLeaderIds.has(person.id)) {
        const directReportIds = directReportsByLeader.get(person.id) ?? [];
        const peerLeaderIds = topScopeLeaders
          .filter((leader) => leader.id !== person.id)
          .map((leader) => leader.id);
        return {
          person,
          method: "360° Leadership Review" as const,
          authority: `Multi-source · self + ${directReportIds.length} direct report${directReportIds.length === 1 ? "" : "s"} + peer leaders`,
          basis: "Top-of-scope leadership routing",
          status: "Ready" as const,
          sourceDetail: "No higher in-scope manager is recorded. The system routes this leader to a governed multi-source leadership review instead of inventing a superior or assigning an unrelated manager.",
          evaluator: undefined,
          directReportIds,
          peerLeaderIds,
        };
      }

      // Smart fallback for a non-leader with no recorded direct manager. This is
      // only accepted when the department has one unambiguous top-of-scope leader.
      const departmentLeaders = topScopeLeaders.filter(
        (leader) => leader.department === person.department && leader.id !== person.id,
      );
      if (departmentLeaders.length === 1) {
        const evaluator = departmentLeaders[0];
        return {
          person,
          method: "Manager Review" as const,
          authority: `${evaluator.fullName} · ${evaluator.position}`,
          basis: "Smart department leadership routing",
          status: "Ready" as const,
          sourceDetail: "The system found one unambiguous department leader and routed the review automatically. This does not rewrite the organizational direct-manager source.",
          evaluator,
          directReportIds: [] as string[],
          peerLeaderIds: [] as string[],
        };
      }

      return {
        person,
        method: "Routing Issue" as const,
        authority: "No safe automatic route",
        basis: "Organizational data requires correction",
        status: "Needs Source Data" as const,
        sourceDetail: "The system cannot safely infer review authority. Correct the upstream reporting structure instead of manually assigning a different evaluator.",
        evaluator: undefined,
        directReportIds: [] as string[],
        peerLeaderIds: [] as string[],
      };
    });

    const managerRows = rows.filter((row) => row.method === "Manager Review");
    const leadershipRows = rows.filter((row) => row.method === "360° Leadership Review");
    const issueRows = rows.filter((row) => row.method === "Routing Issue");

    return {
      rows,
      coveredCount: rows.length - issueRows.length,
      managerCount: managerRows.length,
      leadershipCount: leadershipRows.length,
      issueCount: issueRows.length,
    };
  }, [assignments, backend.ready, goalsCycleId]);

  const preReviewRegisterRows = useMemo<PerformancePreReviewRow[]>(() => {
    return reviewGovernance.rows.map((row) => {
      const personGoals = performanceGoals.filter(
        (goal) => goal.personId === row.person.id && goal.cycleId === goalsCycleId,
      );
      const totalWeight = personGoals.reduce((sum, goal) => sum + goal.weight, 0);
      const weightedProgress = totalWeight > 0
        ? Math.round(
            personGoals.reduce((sum, goal) => sum + goal.progress * goal.weight, 0) /
              totalWeight,
          )
        : null;
      const completedGoalCount = personGoals.filter((goal) => goal.status === "Completed").length;
      const atRiskGoalCount = personGoals.filter((goal) => goal.status === "At Risk").length;

      let readiness: PerformancePreReviewRow["readiness"];
      let readinessDetail: string;

      if (row.status !== "Ready") {
        readiness = "Routing Issue";
        readinessDetail = "Review routing requires correction in the authoritative organizational source.";
      } else if (personGoals.length === 0 || totalWeight !== 100) {
        readiness = "Goal Plan Required";
        readinessDetail = "A complete governed Goal/KPI plan is required before the formal review window.";
      } else if (row.person.personType === "Trainee" && goalsCycleId === "period-q3-2026") {
        readiness = "New Joiner Monitoring";
        readinessDetail = "Trainee joined during Q3; continue evidence collection and supervisor check-ins before period end.";
      } else if (atRiskGoalCount > 0) {
        readiness = "Manager Follow-up";
        readinessDetail = `${atRiskGoalCount} Goal/KPI item${atRiskGoalCount === 1 ? "" : "s"} currently needs manager follow-up before period end.`;
      } else if ((weightedProgress ?? 0) >= 92) {
        readiness = "Evidence Ready";
        readinessDetail = "Goal/KPI evidence is substantially prepared for period-end review, but the Q3 result is not final yet.";
      } else if ((weightedProgress ?? 0) >= 88) {
        readiness = "On Track";
        readinessDetail = "Goal/KPI progress is on track; continue normal evidence verification through the end of Q3.";
      } else {
        readiness = "Evidence In Progress";
        readinessDetail = "Workplace evidence and Goal/KPI progress are still being completed and verified.";
      }

      return {
        person: row.person,
        evaluator: row.evaluator,
        method: row.method,
        authority: row.authority,
        basis: row.basis,
        status: row.status,
        readiness,
        readinessDetail,
        weightedProgress,
        goalCount: personGoals.length,
        completedGoalCount,
        atRiskGoalCount,
      };
    });
  }, [goalsCycleId, performanceGoals, reviewGovernance.rows]);


  // Every evaluation is resolved against the shared personnel source. If a referenced person can no
  // longer be found there, the evaluation is dropped rather than shown with fabricated identity data.
  const resolvedEvaluations = useMemo(() => {
    const effectiveDate = backend.serverDate || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Manila" });

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
      )
      .filter(({ evaluation }) => {
        const cycle = periods.find((candidate) => candidate.id === evaluation.periodId);
        return !cycle || effectiveDate >= cycle.reviewOpenDate;
      });
  }, [backend.serverDate, evaluations, periods]);

  useEffect(() => {
    if (!selected) return;
    const refreshedEvaluation = evaluations.find(
      (evaluation) => evaluation.id === selected.evaluation.id,
    );
    if (!refreshedEvaluation || refreshedEvaluation === selected.evaluation) return;
    const refreshedPerson = getPersonById(refreshedEvaluation.personId);
    if (!refreshedPerson) return;
    setSelected({ evaluation: refreshedEvaluation, person: refreshedPerson });
  }, [evaluations, selected]);

  const filtersActive =
    statusFilter !== "All" ||
    departmentFilter !== "All Departments" ||
    levelFilter !== "All Rating Levels" ||
    evaluatorFilter !== "";

  const filteredRows = useMemo(() => {
    return resolvedEvaluations.filter(({ evaluation, person }) => {
      const cycle = periods.find((candidate) => candidate.id === evaluation.periodId);
      const formalReviewReleased = !cycle || !backend.serverDate || backend.serverDate >= cycle.reviewOpenDate;
      if (!formalReviewReleased) return false;
      const rawWorkflow = String((evaluation as Evaluation & { workflowState?: string }).workflowState ?? "");
      const workflow = rawWorkflow === "360 Feedback Collection"
        ? "360 Feedback Collection"
        : getReviewWorkflowState(evaluation, !!cycle?.calibrationRequired);
      const overdue =
        !!cycle &&
        !!backend.serverDate &&
        backend.serverDate > cycle.reviewDueDate &&
        workflow !== "Finalized";
      const workflowLabel = overdue ? "Overdue" : workflow;
      const matchesStatus =
        statusFilter === "All" ||
        workflowLabel === statusFilter ||
        (statusFilter === "In Progress" &&
          ["Manager Review", "360 Feedback Collection"].includes(workflowLabel)) ||
        (statusFilter === "Calibration" &&
          ["Calibration Pending", "Calibration In Review"].includes(workflowLabel));
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
    periods,
    backend.serverDate,
  ]);

  const analyticsResolvedRows = useMemo<ResolvedPerformanceReview[]>(
    () =>
      resolvedEvaluations.map(({ evaluation, person, evaluator }) => ({
        review: evaluation,
        person,
        evaluator,
      })),
    [resolvedEvaluations],
  );
  const analyticsRowsBeforeDate = useMemo(
    () =>
      applyPerformanceAnalyticsFilters(analyticsResolvedRows, analyticsFilters),
    [analyticsFilters, analyticsResolvedRows],
  );
  const analyticsRows = useMemo(
    () =>
      analyticsRowsBeforeDate.filter(({ review }) => {
        if (analyticsDateRange.preset === "all") return true;
        const activityDate = review.finalizedAt ?? review.managerSubmittedAt ?? review.dateEvaluated ?? review.dueDate;
        return dateFallsInChartRange(activityDate, analyticsDateRange);
      }),
    [analyticsDateRange, analyticsRowsBeforeDate],
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
  const analyticsRange = useMemo(
    () => resolveChartDateRange(analyticsDateRange),
    [analyticsDateRange],
  );
  const analyticsToday = (backend.actualServerDate || backend.serverDate || new Date().toISOString()).slice(0, 10);
  const analyticsUsesReviewScopedPopulation =
    analyticsFilters.reviewTemplateId !== ALL_ANALYTICS_TEMPLATES ||
    analyticsFilters.evaluatorId !== ALL_ANALYTICS_EVALUATORS;
  const analyticsReviewScopedPersonIds = useMemo(
    () => new Set(analyticsRowsBeforeDate.map((row) => row.person.id)),
    [analyticsRowsBeforeDate],
  );
  const analyticsGoals = useMemo(() => {
    const eligiblePersonIds = new Set(
      SHARED_PERSONNEL.filter((person) =>
        (analyticsFilters.department === ALL_ANALYTICS_DEPARTMENTS || person.department === analyticsFilters.department) &&
        (analyticsFilters.personType === ALL_ANALYTICS_PERSON_TYPES || person.personType === analyticsFilters.personType) &&
        (!analyticsUsesReviewScopedPopulation || analyticsReviewScopedPersonIds.has(person.id)),
      ).map((person) => person.id),
    );
    return performanceGoals.filter((goal) => {
      if (!eligiblePersonIds.has(goal.personId)) return false;
      if (analyticsDateRange.preset === "all") return true;
      const startsBeforeRangeEnds = !analyticsRange.to || goal.startDate <= analyticsRange.to;
      const endsAfterRangeStarts = !analyticsRange.from || goal.endDate >= analyticsRange.from;
      return startsBeforeRangeEnds && endsAfterRangeStarts;
    });
  }, [
    analyticsDateRange.preset,
    analyticsFilters.department,
    analyticsFilters.personType,
    analyticsRange.from,
    analyticsRange.to,
    analyticsReviewScopedPersonIds,
    analyticsUsesReviewScopedPopulation,
    performanceGoals,
  ]);
  const analyticsResolvedRowsInDate = useMemo(
    () =>
      analyticsResolvedRows.filter(({ review }) => {
        if (analyticsDateRange.preset === "all") return true;
        const activityDate = review.finalizedAt ?? review.managerSubmittedAt ?? review.dateEvaluated ?? review.dueDate;
        return dateFallsInChartRange(activityDate, analyticsDateRange);
      }),
    [analyticsDateRange, analyticsResolvedRows],
  );
  const goalTrendAnalytics = useMemo(
    () =>
      getGoalTrendAnalytics(
        analyticsGoals,
        SHARED_PERSONNEL,
        periods,
        analyticsFilters,
      ),
    [analyticsFilters, analyticsGoals, periods],
  );
  const departmentTrendAnalytics = useMemo(
    () =>
      getDepartmentTrendAnalytics(
        analyticsResolvedRowsInDate,
        analyticsGoals,
        SHARED_PERSONNEL,
        developmentStore,
        periods,
        analyticsFilters,
      ),
    [
      analyticsFilters,
      analyticsGoals,
      analyticsResolvedRowsInDate,
      developmentStore,
      periods,
    ],
  );
  const evaluatorCalibrationAnalytics = useMemo(
    () => getEvaluatorCalibrationAnalytics(analyticsRows),
    [analyticsRows],
  );
  const finalizationQuality = useMemo(() => {
    const finalized = finalizedAnalyticsRows;
    const requiredAcknowledgment = finalized.filter(({ review }) =>
      periods.find((cycle) => cycle.id === review.periodId)?.employeeAcknowledgment === "Required",
    );
    const calibrationRequired = finalized.filter(({ review }) =>
      periods.find((cycle) => cycle.id === review.periodId)?.calibrationRequired,
    );
    const acknowledged = requiredAcknowledgment.filter(({ review }) => !!review.acknowledgment).length;
    const calibrated = calibrationRequired.filter(
      ({ review }) => review.calibrationStatus === "Approved",
    ).length;
    const evidenceLinked = finalized.filter(
      ({ review }) => (review.linkedEvidence?.length ?? 0) > 0,
    ).length;
    return {
      finalized: finalized.length,
      requiredAcknowledgment: requiredAcknowledgment.length,
      acknowledged,
      calibrationRequired: calibrationRequired.length,
      calibrated,
      evidenceLinked,
    };
  }, [finalizedAnalyticsRows, periods]);
  const analyticsReviewIdScope = useMemo(
    () => new Set(analyticsRowsBeforeDate.map(({ review }) => review.id)),
    [analyticsRowsBeforeDate],
  );
  const analyticsPips = useMemo(
    () =>
      developmentStore.pips.filter((pip) => {
        if (!analyticsReviewIdScope.has(pip.relatedReviewId)) return false;
        if (analyticsDateRange.preset === "all") return true;
        const storedEnd = pip.status === "Completed"
          ? (pip.updatedAt?.slice(0, 10) || pip.targetEndDate)
          : pip.targetEndDate;
        const startsBeforeRangeEnds = !analyticsRange.to || pip.startDate <= analyticsRange.to;
        const endsAfterRangeStarts = !analyticsRange.from || storedEnd >= analyticsRange.from;
        return startsBeforeRangeEnds && endsAfterRangeStarts;
      }),
    [analyticsDateRange.preset, analyticsRange.from, analyticsRange.to, analyticsReviewIdScope, developmentStore.pips],
  );
  const analyticsOpenPips = analyticsPips.filter((pip) => pip.status !== "Completed");
  const analyticsReviewWorkflow = useMemo(() => {
    const buckets = new Map<string, number>([
      ["Finalized", 0],
      ["Calibration", 0],
      ["In Progress", 0],
      ["Pending", 0],
      ["Overdue", 0],
    ]);
    analyticsRows.forEach(({ review }) => {
      const display = getDisplayStatus(review);
      let label = "Pending";
      if (review.status === "Completed") label = "Finalized";
      else if (display === "Overdue") label = "Overdue";
      else if (review.managerSubmittedAt) label = "Calibration";
      else if (review.status === "In Progress" || String(review.workflowState ?? "") === "360 Feedback Collection") label = "In Progress";
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    });
    const colors: Record<string, string> = {
      Finalized: "#10b981",
      Calibration: "#8b5cf6",
      "In Progress": "#3b82f6",
      Pending: "#94a3b8",
      Overdue: "#ef4444",
    };
    return Array.from(buckets.entries())
      .map(([name, value]) => ({ name, value, color: colors[name] }))
      .filter((item) => item.value > 0);
  }, [analyticsRows]);
  const analyticsRatingTrend = useMemo(
    () =>
      periods
        .slice()
        .sort((a, b) => a.performanceEndDate.localeCompare(b.performanceEndDate))
        .map((cycle) => {
          const cycleRows = finalizedAnalyticsRows.filter(({ review }) => review.periodId === cycle.id);
          const average = cycleRows.length
            ? cycleRows.reduce((sum, row) => sum + (row.review.rating ?? 0), 0) / cycleRows.length
            : null;
          return {
            cycle: cycle.cycleName.replace(" Performance Cycle", ""),
            averageRating: average === null ? null : Number(average.toFixed(2)),
            finalized: cycleRows.length,
          };
        })
        .filter((point) => point.finalized > 0),
    [finalizedAnalyticsRows, periods],
  );
  const analyticsDepartmentChart = useMemo(
    () =>
      departmentTrendAnalytics.map((row) => ({
        department: row.department,
        completion: row.completionRate,
        goalProgress: row.averageGoalProgress,
        normalizedRating: row.templateCount <= 1 ? row.normalizedAverageRating : null,
      })),
    [departmentTrendAnalytics],
  );
  const analyticsPipActivity = useMemo(() => {
    const inRange = (date?: string | null) =>
      analyticsDateRange.preset === "all" || dateFallsInChartRange(date, analyticsDateRange);
    return [
      { name: "Plans started", count: analyticsPips.filter((pip) => inRange(pip.startDate)).length },
      { name: "Check-ins due", count: analyticsPips.reduce((sum, pip) => sum + pip.milestones.filter((milestone) => inRange(milestone.dueDate)).length, 0) },
      { name: "Check-ins completed", count: analyticsPips.reduce((sum, pip) => sum + pip.milestones.filter((milestone) => milestone.completedAt && inRange(milestone.completedAt)).length, 0) },
      { name: "Plans closed", count: analyticsPips.filter((pip) => pip.status === "Completed" && inRange(pip.updatedAt)).length },
    ];
  }, [analyticsDateRange, analyticsPips]);
  const analyticsFinalizationQuality = useMemo(() => [
    {
      name: "Review completion",
      percentage: completionAnalytics.assigned ? Math.round((completionAnalytics.finalized / completionAnalytics.assigned) * 100) : 0,
    },
    {
      name: "Calibration",
      percentage: finalizationQuality.calibrationRequired ? Math.round((finalizationQuality.calibrated / finalizationQuality.calibrationRequired) * 100) : 0,
    },
    {
      name: "Evidence linked",
      percentage: finalizationQuality.finalized ? Math.round((finalizationQuality.evidenceLinked / finalizationQuality.finalized) * 100) : 0,
    },
    {
      name: "Acknowledgment",
      percentage: finalizationQuality.requiredAcknowledgment ? Math.round((finalizationQuality.acknowledged / finalizationQuality.requiredAcknowledgment) * 100) : 0,
    },
  ], [completionAnalytics, finalizationQuality]);
  const analyticsEvaluatorChart = useMemo(
    () =>
      evaluatorCalibrationAnalytics
        .filter((row) => row.averageRating !== null && row.organizationAverage !== null && row.templateCount <= 1)
        .map((row) => ({
          evaluator: row.evaluatorName,
          evaluatorAverage: row.averageRating,
          organizationAverage: row.organizationAverage,
          finalized: row.finalized,
        })),
    [evaluatorCalibrationAnalytics],
  );
  const analyticsFilterActive =
    analyticsFilters.cycleId !== ALL_ANALYTICS_CYCLES ||
    analyticsFilters.department !== ALL_ANALYTICS_DEPARTMENTS ||
    analyticsFilters.personType !== ALL_ANALYTICS_PERSON_TYPES ||
    analyticsFilters.reviewTemplateId !== ALL_ANALYTICS_TEMPLATES ||
    analyticsFilters.evaluatorId !== ALL_ANALYTICS_EVALUATORS ||
    analyticsDateRange.preset !== "all";

  const activePeriod = useMemo(
    () => getActiveEvaluationPeriod(periods),
    [periods],
  );

  const performanceCalendarQuarters = useMemo(() => {
    const merged = [...backend.performanceCalendar.quarters];
    const knownCycleIds = new Set(merged.map((quarter) => quarter.cycle_id));

    periods
      .filter((period) => period.cycleType === "Quarterly" && !knownCycleIds.has(period.id))
      .forEach((period) => {
        const searchable = `${period.id} ${period.cycleName}`;
        const quarterMatch = searchable.match(/\bQ([1-4])\b/i);
        const yearMatch = searchable.match(/\b(20\d{2})\b/);
        if (!quarterMatch || !yearMatch) return;

        const quarter = `Q${quarterMatch[1]}` as "Q1" | "Q2" | "Q3" | "Q4";
        merged.push({
          cycle_id: period.id,
          year: Number(yearMatch[1]),
          quarter,
          status: period.status === "Closed" ? "Finalized" : period.status === "Active" ? "Current" : "Upcoming",
          performance_start: period.performanceStartDate,
          performance_end: period.performanceEndDate,
          review_start: period.reviewOpenDate,
          review_end: period.reviewDueDate,
          read_only: period.status === "Closed",
          governing_policy_id: "ALB-PND-POL-014",
          lifecycle_source: "Automatic calendar lifecycle",
        } as (typeof backend.performanceCalendar.quarters)[number]);
      });

    return merged.sort((a, b) =>
      a.year === b.year
        ? a.performance_start.localeCompare(b.performance_start)
        : a.year - b.year,
    );
  }, [backend.performanceCalendar.quarters, periods]);

  const selectedGoalsQuarter = useMemo(
    () => performanceCalendarQuarters.find((quarter) => quarter.cycle_id === goalsCycleId),
    [performanceCalendarQuarters, goalsCycleId],
  );

  const quarterRuntimeStatus = (quarter: (typeof performanceCalendarQuarters)[number]) => {
    const serverDate = backend.serverDate || new Date().toISOString().slice(0, 10);
    if (serverDate < quarter.performance_start) return "Upcoming" as const;
    if (serverDate <= quarter.review_end) return "Current" as const;
    if (quarter.status === "Current" && !quarter.read_only) return "Current" as const;
    return "Finalized" as const;
  };

  const quarterIsAvailable = (quarter: (typeof performanceCalendarQuarters)[number]) =>
    quarterRuntimeStatus(quarter) !== "Upcoming";

  const performanceCycleFilterOptions = useMemo(() => {
    const available = performanceCalendarQuarters
      .filter((quarter) => quarterIsAvailable(quarter))
      .sort((a, b) => b.performance_start.localeCompare(a.performance_start));

    const configuredDefault = available.find(
      (quarter) => quarter.cycle_id === backend.performanceCalendar.default_cycle_id,
    );
    const defaultQuarter = configuredDefault ?? available[0];

    if (!defaultQuarter) return available;

    return [
      defaultQuarter,
      ...available.filter((quarter) => quarter.cycle_id !== defaultQuarter.cycle_id),
    ];
  }, [backend.performanceCalendar.default_cycle_id, backend.serverDate, performanceCalendarQuarters]);

  useEffect(() => {
    if (!backend.ready || performanceCalendarQuarters.length === 0) return;

    const selected = performanceCalendarQuarters.find(
      (quarter) => quarter.cycle_id === goalsCycleId && quarterIsAvailable(quarter),
    );
    if (selected) return;

    const configuredDefault = performanceCalendarQuarters.find(
      (quarter) => quarter.cycle_id === backend.performanceCalendar.default_cycle_id && quarterIsAvailable(quarter),
    );
    const fallback = [...performanceCalendarQuarters]
      .filter((quarter) => quarterIsAvailable(quarter))
      .sort((a, b) => b.performance_start.localeCompare(a.performance_start))[0];
    setGoalsCycleId(configuredDefault?.cycle_id ?? fallback?.cycle_id ?? goalsCycleId);
  }, [
    backend.ready,
    backend.performanceCalendar.default_cycle_id,
    performanceCalendarQuarters,
    backend.serverDate,
    goalsCycleId,
  ]);

  const selectedGoalsCycle = useMemo<EvaluationPeriod | undefined>(() => {
    if (!selectedGoalsQuarter) return activePeriod;
    const existing = periods.find((period) => period.id === selectedGoalsQuarter.cycle_id);
    return {
      ...(existing ?? {
        id: selectedGoalsQuarter.cycle_id,
        cycleName: `${selectedGoalsQuarter.quarter} ${selectedGoalsQuarter.year} Performance Cycle`,
        cycleType: "Quarterly" as const,
        applicablePersonTypes: ["Employee", "Trainee"] as PersonnelIdentity["personType"][],
        departmentScopes: [],
        reviewTemplateIds: {
          Employee: "review-template-employee-standard",
          Trainee: "review-template-trainee-standard",
        },
        selfEvaluationEnabled: false,
        selfRatingEnabled: false,
        calibrationRequired: true,
        employeeAcknowledgment: "Required" as const,
      }),
      id: selectedGoalsQuarter.cycle_id,
      cycleName: `${selectedGoalsQuarter.quarter} ${selectedGoalsQuarter.year} Performance Cycle`,
      cycleType: "Quarterly",
      performanceStartDate: selectedGoalsQuarter.performance_start,
      performanceEndDate: selectedGoalsQuarter.performance_end,
      reviewOpenDate: selectedGoalsQuarter.review_start,
      reviewDueDate: selectedGoalsQuarter.review_end,
      status: quarterRuntimeStatus(selectedGoalsQuarter) === "Current" ? "Active" : quarterRuntimeStatus(selectedGoalsQuarter) === "Finalized" ? "Closed" : "Draft",
    };
  }, [activePeriod, backend.serverDate, periods, selectedGoalsQuarter]);

  const selectedGoalsRuntimeStatus = selectedGoalsQuarter ? quarterRuntimeStatus(selectedGoalsQuarter) : undefined;
  const selectedGoalsReadOnly = selectedGoalsRuntimeStatus === "Finalized";
  const selectedReviewsPreReview =
    !!selectedGoalsCycle &&
    !selectedGoalsReadOnly &&
    !!backend.serverDate &&
    backend.serverDate < selectedGoalsCycle.reviewOpenDate;

  useEffect(() => {
    if (!selectedGoalsReadOnly) return;
    setShowForm(false);
  }, [selectedGoalsReadOnly]);

  useEffect(() => {
    setSelectedPipId(null);
    setPipPage(1);
  }, [goalsCycleId]);

  useEffect(() => {
    setPipGovernanceMode(null);
    setPipOutcomeResult("Expectations Met");
    setPipOutcomeNote("");
    setPipExtensionReason("");
    setPipExtensionTargetDate("");
    setPipExtensionCheckInDate("");
    setPipExtensionCheckInTitle("Extension progress check-in");
  }, [selectedPipId]);

  const renderPerformanceCycleFilter = () => (
    <SystemSelect
      aria-label="Performance Cycle"
      value={goalsCycleId}
      onChange={(event) => setGoalsCycleId(event.target.value)}
    >
      {performanceCycleFilterOptions.map((quarter) => (
        <option key={quarter.cycle_id} value={quarter.cycle_id}>
          {quarter.year} · {quarter.quarter}
        </option>
      ))}
    </SystemSelect>
  );

  useEffect(() => {
    if (!goalsCycleId) return;
    setPeriodFilter((current) => (current === goalsCycleId ? current : goalsCycleId));
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("performance_cycle") !== goalsCycleId) {
        url.searchParams.set("performance_cycle", goalsCycleId);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
  }, [goalsCycleId]);


  const selectedHistoricalGoals = selectedGoalsRuntimeStatus === "Finalized" && selectedGoalsQuarter
    ? backend.performanceQuarterHistory[selectedGoalsQuarter.cycle_id]
    : undefined;

  const goalsWorkspaceTemplates = useMemo(() => {
    if (!selectedHistoricalGoals || !selectedGoalsCycle) return goalTemplates;
    const usedPlanIds = new Set((selectedHistoricalGoals.personnel_records ?? []).map((record) => record.goal_plan_id));
    return goalTemplates.map((template) =>
      usedPlanIds.has(template.id) && !template.cycleIds.includes(selectedGoalsCycle.id)
        ? { ...template, cycleIds: [...template.cycleIds, selectedGoalsCycle.id] }
        : template,
    );
  }, [goalTemplates, selectedGoalsCycle, selectedHistoricalGoals]);
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
  const activeCycleAnalyticsRows = useMemo<ResolvedPerformanceReview[]>(
    () =>
      activeCycleRows.map(({ evaluation, person, evaluator }) => ({
        review: evaluation,
        person,
        evaluator,
      })),
    [activeCycleRows],
  );
  const activeCycleCompletion = useMemo(
    () => getReviewCompletionAnalytics(activeCycleAnalyticsRows),
    [activeCycleAnalyticsRows],
  );
  const overviewLatestRating = useMemo(
    () => averageLatestFinalizedRating(analyticsResolvedRows, periods),
    [analyticsResolvedRows, periods],
  );
  const overviewRatingDistribution = useMemo(
    () => latestRatingDistribution(analyticsResolvedRows, periods),
    [analyticsResolvedRows, periods],
  );
  const overviewCanonicalPersonnelCount = backend.workforceContext.people.length;
  const overviewRatingCoverage =
    overviewCanonicalPersonnelCount > 0
      ? Math.round(
          (overviewRatingDistribution.total / overviewCanonicalPersonnelCount) *
            100,
        )
      : 0;
  const overviewGoalPersonnelCount = useMemo(
    () => new Set(activeGoalRows.map((goal) => goal.personId)).size,
    [activeGoalRows],
  );
  const overviewGoalHealth = useMemo(
    () => summarizeGoalHealth(activeGoalRows),
    [activeGoalRows],
  );
  const performanceAttentionQueue = useMemo(
    () =>
      buildPerformanceAttentionQueue({
        rows: analyticsResolvedRows,
        goals: performanceGoals,
        development: developmentStore,
        cycles: periods,
        activeCycleId: activePeriod?.id,
        personnel: SHARED_PERSONNEL,
        workforcePersonas: backend.workforceContext.people,
      }),
    [
      activePeriod?.id,
      analyticsResolvedRows,
      backend.workforceContext.people,
      developmentStore,
      performanceGoals,
      periods,
    ],
  );
  const employeesNeedingSupport = useMemo(
    () => countEmployeesNeedingSupport(performanceAttentionQueue),
    [performanceAttentionQueue],
  );
  const overviewStats = useMemo(
    () => [
      {
        key: "averageRating" as OverviewCardKey,
        label: "Average Finalized Rating",
        value:
          overviewLatestRating.average === null
            ? "—"
            : `${overviewLatestRating.average.toFixed(2)} / 5`,
        meta: `${overviewLatestRating.count} of ${overviewCanonicalPersonnelCount} personnel have finalized ratings`,
        icon: Star,
      },
      {
        key: "goalHealth" as OverviewCardKey,
        label: "Goal & KPI Health",
        value:
          overviewGoalHealth.weightedAverageProgress === null
            ? "—"
            : `${overviewGoalHealth.weightedAverageProgress}%`,
        meta: `${overviewGoalHealth.total} active goals across ${overviewGoalPersonnelCount} personnel · weighted by goal weights`,
        icon: Target,
      },
      {
        key: "completion" as OverviewCardKey,
        label: "Review Completion",
        value: `${activeCycleCompletion.completionRate}%`,
        meta: `${activeCycleCompletion.finalized} of ${activeCycleCompletion.assigned} finalized`,
        icon: CheckCircle2,
      },
      {
        key: "support" as OverviewCardKey,
        label: "Employees Needing Support",
        value: employeesNeedingSupport,
        meta: "At-risk goals, finalized support needs, or active improvement plans",
        icon: AlertTriangle,
      },
    ],
    [
      activeCycleCompletion,
      employeesNeedingSupport,
      overviewCanonicalPersonnelCount,
      overviewGoalHealth,
      overviewGoalPersonnelCount,
      overviewLatestRating,
    ],
  );
  const goalStatusOverviewRows = useMemo(
    () => [
      { label: "Completed", count: overviewGoalHealth.completed, bar: "bg-emerald-500" },
      { label: "On Track", count: overviewGoalHealth.onTrack, bar: "bg-sky-500" },
      { label: "At Risk", count: overviewGoalHealth.atRisk, bar: "bg-amber-500" },
      { label: "Not Started", count: overviewGoalHealth.notStarted, bar: "bg-slate-300" },
    ],
    [overviewGoalHealth],
  );
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
  const selectedFormEvaluation = form?.id
    ? evaluations.find((evaluation) => evaluation.id === form.id)
    : undefined;
  const selectedFormCycle = form
    ? periods.find((period) => period.id === form.periodId)
    : undefined;
  const selectedFormTemplateId =
    selectedFormEvaluation?.reviewTemplateId ??
    (selectedFormPerson
      ? selectedFormCycle?.reviewTemplateIds[selectedFormPerson.personType]
      : undefined);
  const selectedFormTemplate = reviewTemplates.find(
    (template) => template.id === selectedFormTemplateId,
  );
  const formCriteria = selectedFormTemplate?.criteria ?? [];
  const selectedFormGoals = form
    ? performanceGoals.filter(
        (goal) => goal.personId === form.personId && goal.cycleId === form.periodId,
      )
    : [];
  const selectedFormGoalWeight = selectedFormGoals.reduce(
    (sum, goal) => sum + goal.weight,
    0,
  );
  const selectedFormWeightedGoalProgress = selectedFormGoalWeight > 0
    ? Math.round(
        selectedFormGoals.reduce(
          (sum, goal) => sum + goal.progress * goal.weight,
          0,
        ) / selectedFormGoalWeight,
      )
    : null;
  const selectedFormGoalPlanName =
    goalTemplates.find((template) => template.id === selectedFormGoals[0]?.templateId)?.name ??
    "No Goal Plan linked";
  const currentFormAvg = form
    ? weightedReviewScore(formCriteria, form.scores)
    : null;

  function resetFilters() {
    setStatusFilter("All");
    setDepartmentFilter("All Departments");
    setPeriodFilter(goalsCycleId);
    setLevelFilter("All Rating Levels");
    setEvaluatorFilter("");
  }

  function handleCardClick(key: OverviewCardKey) {
    setActiveCard(key);
    if (key === "averageRating") {
      setWorkspaceTab("Analytics");
    } else if (key === "goalHealth") {
      setWorkspaceTab("Reviews");
    } else if (key === "completion") {
      setStatusFilter("All");
      setPeriodFilter(goalsCycleId);
      setWorkspaceTab("Reviews");
    } else if (key === "support") {
      setWorkspaceTab("Analytics");
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

  function openEditForm(row: PerformanceReviewWorkspaceRow) {
    const { evaluation, person } = row;
    const cycle = periods.find((period) => period.id === evaluation.periodId);
    if (evaluation.evaluatorId !== currentActorId) {
      setFormError("Only the assigned evaluator can edit this review.");
      return;
    }
    const workflow = getReviewWorkflowState(evaluation as Evaluation, !!cycle?.calibrationRequired);
    if (evaluation.status === "Completed" || workflow === "Calibration Pending" || workflow === "Calibration In Review") {
      setFormError("This review is locked in its current workflow stage.");
      return;
    }
    const knownRecommendations = new Set<string>(DEVELOPMENT_RECOMMENDATION_OPTIONS);
    const savedRecommendations = evaluation.developmentRecommendations ?? [];
    const standardRecommendations = savedRecommendations.filter((recommendation) =>
      DEVELOPMENT_RECOMMENDATION_OPTIONS.includes(
        recommendation as (typeof DEVELOPMENT_RECOMMENDATION_OPTIONS)[number],
      ),
    );
    const otherRecommendations = savedRecommendations.filter(
      (recommendation) => !knownRecommendations.has(recommendation),
    );
    setFormMode("edit");
    setForm({
      id: evaluation.id,
      personId: person.id,
      evaluatorId: evaluation.evaluatorId,
      periodId: evaluation.periodId,
      dateEvaluated: evaluation.dateEvaluated ?? todayLabel(),
      comments: evaluation.comments ?? "",
      scores: Object.fromEntries(
        (evaluation.competencyScores ?? []).map((score) => [score.name, score.score]),
      ),
      developmentRecommendations: standardRecommendations,
      otherRecommendation: otherRecommendations.join("; "),
    });
    setPersonSearchQuery(person.fullName);
    setFormError("");
    setShowForm(true);
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
          (reviewTemplates.find(
            (template) => template.id === activePeriod.reviewTemplateIds[person.personType],
          )?.criteria ?? []).map((criterion) => [criterion.name, 0]),
        ),
      });
      setFormError("");
      return;
    }
    closeForm();
  }

  function persistEvaluation(complete: boolean) {
    if (!form || !form.id || !selectedFormPerson) return;
    const criteria = formCriteria;
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
    const rating = weightedReviewScore(criteria, form.scores);
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

  function reviewTransitionEligibility(
    row: PerformanceReviewWorkspaceRow,
    target: PerformanceReviewBoardStage,
  ): ReviewTransitionEligibility {
    const cycle = periods.find((period) => period.id === row.evaluation.periodId);
    if (!cycle) return { allowed: false, reason: "The review cycle is unavailable." };
    const current = resolvePerformanceReviewBoardStage(
      row.evaluation as Evaluation,
      !!cycle.calibrationRequired,
    );
    if (target === current) {
      return { allowed: false, reason: `This review is already in ${target}.` };
    }
    if (current === "Finalized") {
      return {
        allowed: false,
        reason: "Finalized reviews are locked and cannot move backward through the normal review workflow.",
      };
    }
    if (target === "Not Started") {
      return {
        allowed: false,
        reason: "Reviews cannot be dragged backward to Not Started.",
      };
    }

    const assignedEvaluator = row.evaluation.evaluatorId === currentActorId;
    const template = reviewTemplates.find(
      (candidate) => candidate.id === row.evaluation.reviewTemplateId,
    );
    const scores = row.evaluation.competencyScores ?? [];
    const scoreByName = new Map(scores.map((score) => [score.name, score.score]));
    const reviewComplete =
      !!template &&
      template.criteria.length > 0 &&
      template.criteria.every((criterion) => {
        const score = scoreByName.get(criterion.name) ?? 0;
        return score >= 1 && score <= 5;
      });

    if (target === "Manager Review") {
      if (current !== "Not Started") {
        return { allowed: false, reason: "Only a not-started review can enter Manager Review." };
      }
      if (!assignedEvaluator) {
        return { allowed: false, reason: "Only the assigned evaluator can start this review." };
      }
      if (cycle.status !== "Active") {
        return { allowed: false, reason: "Manager review is available only in the active cycle." };
      }
      return { allowed: true, reason: "Start manager review." };
    }

    if (target === "Submitted") {
      if (current !== "Manager Review") {
        return { allowed: false, reason: "Only an active manager review can be submitted." };
      }
      if (!cycle.calibrationRequired) {
        return { allowed: false, reason: "This cycle does not require calibration." };
      }
      if (!assignedEvaluator) {
        return { allowed: false, reason: "Only the assigned evaluator can submit this review." };
      }
      if (!reviewComplete) {
        return {
          allowed: false,
          reason: "Complete every configured review criterion before submitting. Open the review card to finish the draft.",
        };
      }
      return { allowed: true, reason: "Submit for calibration." };
    }

    if (target === "Calibration Review") {
      if (current !== "Submitted") {
        return { allowed: false, reason: "Only a submitted review can enter calibration review." };
      }
      if (!canManagePerformance) {
        return { allowed: false, reason: "Calibration requires authorized Admin/HR access." };
      }
      return { allowed: true, reason: "Start calibration review." };
    }

    if (target === "Finalized") {
      if (cycle.calibrationRequired) {
        if (current !== "Calibration Review") {
          return {
            allowed: false,
            reason: "Required calibration must be actively reviewed before finalization.",
          };
        }
        if (!canManagePerformance) {
          return { allowed: false, reason: "Only authorized Admin/HR can approve calibration." };
        }
        return { allowed: true, reason: "Approve calibration and finalize." };
      }
      if (current !== "Manager Review" || !assignedEvaluator) {
        return { allowed: false, reason: "Only the assigned evaluator can finalize this non-calibrated review." };
      }
      if (!reviewComplete) {
        return { allowed: false, reason: "Complete every configured review criterion before finalizing." };
      }
      return { allowed: true, reason: "Submit and finalize review." };
    }

    return { allowed: false, reason: "This workflow transition is not supported." };
  }

  async function transitionReviewFromWorkspace(
    row: PerformanceReviewWorkspaceRow,
    target: PerformanceReviewBoardStage,
  ) {
    const eligibility = reviewTransitionEligibility(row, target);
    if (!eligibility.allowed || target === "Not Started") {
      throw new Error(eligibility.reason);
    }
    await backend.transitionReview(row.evaluation.id, target);
  }

  async function openReviewFromWorkspace(row: PerformanceReviewWorkspaceRow) {
    const evaluation = row.evaluation as Evaluation;

    if (canManagePerformance && evaluation.workflowState === "Calibration Pending") {
      try {
        await backend.transitionReview(evaluation.id, "Calibration Review");
        setSelected({
          evaluation: {
            ...evaluation,
            workflowState: "Calibration In Review",
            calibrationStatus: "In Review",
          },
          person: row.person,
        });
        return;
      } catch {
        // The backend bridge exposes the governed transition error. Keep the
        // submitted record visible so Admin/HR can inspect the source context.
      }
    }

    setSelected({
      evaluation,
      person: row.person,
    });
  }

  async function approveCalibration(evaluationId: string) {
    const row = resolvedEvaluations.find(
      ({ evaluation }) => evaluation.id === evaluationId,
    );
    if (!row) return;
    try {
      await backend.transitionReview(evaluationId, "Finalized");
    } catch {
      // The shared backend bridge exposes the server error in the page status banner.
    }
  }

  async function confirmApproveCalibration() {
    if (!finalizeTarget) return;
    const evaluationId = finalizeTarget.id;
    setFinalizeTarget(null);
    await approveCalibration(evaluationId);
  }

  async function returnCalibrationForRevision(evaluationId: string, notes: string) {
    const revisionComment = notes.trim();
    if (!revisionComment) return;
    try {
      await backend.transitionCalibration(
        evaluationId,
        "Returned for Revision",
        revisionComment,
      );
    } catch {
      // The backend bridge exposes the governed action error in the page status banner.
    }
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

  function getPipReviewSignals(review: Evaluation): string[] {
    const signals: string[] = [];
    if (typeof review.rating === "number" && review.rating < 3) {
      signals.push(`Final rating ${review.rating.toFixed(2)} / 5`);
    }
    const atRiskGoals = performanceGoals.filter(
      (goal) =>
        goal.personId === review.personId &&
        goal.cycleId === review.periodId &&
        goal.status === "At Risk",
    );
    atRiskGoals.slice(0, 2).forEach((goal) =>
      signals.push(`At-risk goal: ${goal.title}`),
    );
    (review.developmentRecommendations ?? [])
      .filter((recommendation) => recommendation !== "No immediate intervention")
      .slice(0, 2)
      .forEach((recommendation) =>
        signals.push(`Development: ${recommendation}`),
      );
    return signals;
  }

  function resolvePipOwnerContext(review: Evaluation): {
    person: PersonnelIdentity;
    authorityType: string;
    assignmentBasis: string;
    source: string;
  } | null {
    if (review.pipOwner?.id) {
      const serverOwner = getPersonById(review.pipOwner.id);
      if (serverOwner && serverOwner.id !== review.personId) {
        return {
          person: serverOwner,
          authorityType: review.pipOwner.authorityType || "Governance Owner",
          assignmentBasis: review.pipOwner.assignmentBasis || "Server-resolved PIP governance owner",
          source: review.pipOwner.source || "Performance Governance",
        };
      }
    }

    const authorized = SHARED_PERSONNEL.filter((candidate) =>
      canEvaluate(candidate.id, review.personId, {
        periodId: review.periodId,
        periods,
        assignments,
        requireActivePeriod: false,
      }),
    );
    const evaluator =
      authorized.find((candidate) => candidate.id === review.evaluatorId) ??
      authorized[0] ??
      null;
    if (evaluator) {
      return {
        person: evaluator,
        authorityType: "Evaluator",
        assignmentBasis: "Review Governance evaluator authority",
        source: "Review Governance",
      };
    }

    // Defensive UI fallback for leadership 360 records. The backend remains the
    // final authority and applies the same Admin/HR non-self governance rule.
    if (review.reviewMethod === "360° Leadership Review") {
      const subject = getPersonById(review.personId);
      const preferredRoles =
        subject?.accessRole === "HR"
          ? ["Admin"]
          : subject?.accessRole === "Admin"
            ? ["HR"]
            : ["HR", "Admin"];
      for (const role of preferredRoles) {
        const sponsor = SHARED_PERSONNEL.find(
          (candidate) => candidate.id !== review.personId && candidate.accessRole === role,
        );
        if (sponsor) {
          return {
            person: sponsor,
            authorityType: "Governance Sponsor",
            assignmentBasis: "Leadership 360 review has no single evaluator; Admin/HR governance owns PIP follow-through.",
            source: "Admin/HR Governance",
          };
        }
      }
    }

    return null;
  }

  function resolvePipManager(review: Evaluation): PersonnelIdentity | null {
    return resolvePipOwnerContext(review)?.person ?? null;
  }

  function suggestedPipConcern(review: Evaluation): string {
    const atRiskGoal = performanceGoals.find(
      (goal) =>
        goal.personId === review.personId &&
        goal.cycleId === review.periodId &&
        goal.status === "At Risk",
    );
    if (atRiskGoal) {
      return `${atRiskGoal.title} requires focused improvement based on the finalized review and verified goal context.`;
    }
    if (typeof review.rating === "number" && review.rating < 3) {
      return "The finalized review indicates performance below the expected level for the cycle and requires a structured improvement discussion.";
    }
    const recommendation = (review.developmentRecommendations ?? []).find(
      (item) => item !== "No immediate intervention",
    );
    if (recommendation) {
      return `The finalized review identified a documented development need requiring structured follow-through: ${recommendation}.`;
    }
    return "";
  }

  function openPipDraftForReview(reviewId: string) {
    const review = evaluations.find((candidate) => candidate.id === reviewId);
    if (
      !review ||
      review.status !== "Completed" ||
      (!!selectedGoalsCycle && review.periodId !== selectedGoalsCycle.id)
    ) {
      setPhase4Message("Select a finalized review from the current Performance cycle.");
      return;
    }
    const existingPip = developmentStore.pips.find(
      (pip) => pip.relatedReviewId === review.id,
    );
    if (existingPip) {
      setPhase4Message("A Performance Improvement Plan already exists for this finalized review.");
      setSelectedPipId(existingPip.id);
      setPipSourcePickerOpen(false);
      return;
    }
    const manager = resolvePipManager(review);
    const recommendation = (review.developmentRecommendations ?? []).find(
      (item) => item !== "No immediate intervention",
    );
    const developmentActionSource = recommendation?.startsWith("Training")
      ? "Training"
      : recommendation?.startsWith("Competency")
        ? "Competency"
        : "Learning";
    const baseDate = (backend.actualServerDate || backend.serverDate || new Date().toISOString()).slice(0, 10);
    setPipDraft({
      personId: review.personId,
      relatedReviewId: review.id,
      performanceConcern: suggestedPipConcern(review),
      expectedImprovement: "",
      actionItem: "",
      startDate: baseDate,
      targetEndDate: addDaysToIsoDate(baseDate, 30),
      assignedManagerId: manager?.id ?? "",
      firstMilestone: "Initial progress check-in",
      firstMilestoneDate: addDaysToIsoDate(baseDate, 14),
      developmentActionSource,
      developmentActionTitle: "",
    });
    setPhase4Message("");
    setPipSourcePickerOpen(false);
    setPipCreateOpen(true);
  }

  async function addPip() {
    const person = getPersonById(pipDraft.personId);
    const review = evaluations.find(
      (evaluation) => evaluation.id === pipDraft.relatedReviewId,
    );
    if (!person || !review || review.personId !== person.id || review.status !== "Completed") {
      setPhase4Message("Choose a finalized review as the Performance Improvement Plan basis.");
      return;
    }
    if (!!selectedGoalsCycle && review.periodId !== selectedGoalsCycle.id) {
      setPhase4Message("The selected review does not belong to the current Performance cycle.");
      return;
    }
    if (!pipDraft.assignedManagerId) {
      setPhase4Message(
        "No authorized PIP owner is recorded for this employee. Resolve the reporting/evaluator authority in Review Governance first.",
      );
      return;
    }
    if (!pipDraft.performanceConcern.trim()) {
      setPhase4Message("Document the validated performance concern before starting the PIP.");
      return;
    }
    if (!pipDraft.expectedImprovement.trim()) {
      setPhase4Message("Define the observable improvement expected from the employee.");
      return;
    }
    if (!pipDraft.actionItem.trim()) {
      setPhase4Message("Add at least one specific action item for the employee and PIP owner to follow.");
      return;
    }
    const actualStartDate = (backend.actualServerDate || backend.serverDate || new Date().toISOString()).slice(0, 10);
    const minimumTargetEndDate = addDaysToIsoDate(actualStartDate, 30);
    const maximumTargetEndDate = addDaysToIsoDate(actualStartDate, 90);
    const minimumCheckInDate = addDaysToIsoDate(actualStartDate, 7);
    const maximumCheckInDate = addDaysToIsoDate(actualStartDate, 14);
    if (!pipDraft.targetEndDate) {
      setPhase4Message("Choose a target end date for the Performance Improvement Plan.");
      return;
    }
    if (pipDraft.targetEndDate < minimumTargetEndDate || pipDraft.targetEndDate > maximumTargetEndDate) {
      setPhase4Message("Target End must be 30 to 90 calendar days after the PIP starts.");
      return;
    }
    if (!pipDraft.firstMilestone.trim()) {
      setPhase4Message("Define the first required PIP check-in.");
      return;
    }
    if (!pipDraft.firstMilestoneDate) {
      setPhase4Message("Choose the first check-in date.");
      return;
    }
    if (
      pipDraft.firstMilestoneDate < minimumCheckInDate ||
      pipDraft.firstMilestoneDate > maximumCheckInDate ||
      pipDraft.firstMilestoneDate >= pipDraft.targetEndDate
    ) {
      setPhase4Message("The first check-in must be scheduled 7 to 14 calendar days after the PIP starts and before Target End.");
      return;
    }
    const existingPip = developmentStore.pips.find(
      (pip) => pip.relatedReviewId === review.id,
    );
    if (existingPip) {
      setPhase4Message("A Performance Improvement Plan already exists for this finalized review.");
      setSelectedPipId(existingPip.id);
      setPipCreateOpen(false);
      return;
    }
    const resolvedOwnerContext = resolvePipOwnerContext(review);
    if (
      !resolvedOwnerContext ||
      resolvedOwnerContext.person.id !== pipDraft.assignedManagerId
    ) {
      setPhase4Message(
        "The selected PIP owner no longer matches the server-resolved owner for this finalized review. Close this form and reopen the review to refresh the owner before starting the plan.",
      );
      return;
    }

    const timestamp = new Date().toISOString();
    const pipId = `pip-${Date.now()}`;
    const newPip: PerformanceImprovementPlan = {
      id: pipId,
      personId: person.id,
      relatedReviewId: review.id,
      performanceConcern: pipDraft.performanceConcern.trim(),
      expectedImprovement: pipDraft.expectedImprovement.trim(),
      actionItems: [pipDraft.actionItem.trim()],
      startDate: actualStartDate,
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
              status: "Planned",
            },
          ]
        : [],
      createdBy: currentActorId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setPhase4Message("Saving Performance Improvement Plan...");
    try {
      await backend.savePip(newPip);
      setSelectedPipId(pipId);
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
        "Performance Improvement Plan started and saved. The resolved PIP owner now owns the follow-through while Admin/HR retains governance oversight.",
      );
      setPipCreateOpen(false);
    } catch (error) {
      setPhase4Message(
        error instanceof Error
          ? `PIP was not started: ${error.message}`
          : "PIP was not started because the server rejected the request.",
      );
    }
  }

  async function closePipWithOutcome(pipId: string) {
    const existing = developmentStore.pips.find((pip) => pip.id === pipId);
    if (!existing || existing.status === "Completed") return;
    if (!pipOutcomeNote.trim()) {
      setPhase4Message("Add the required HR governance outcome note before closing the PIP.");
      return;
    }

    setPhase4Message("Saving governed PIP outcome...");
    try {
      await backend.transitionPipGovernance(pipId, {
        action: "close",
        outcomeResult: pipOutcomeResult,
        hrOutcomeNote: pipOutcomeNote.trim(),
      });
      setPipGovernanceMode(null);
      setPhase4Message("PIP closed with a recorded HR/Admin outcome and audit history.");
    } catch (error) {
      setPhase4Message(
        error instanceof Error
          ? `PIP was not closed: ${error.message}`
          : "PIP was not closed because the server rejected the outcome action.",
      );
    }
  }

  async function extendPipWithGovernance(pipId: string) {
    const existing = developmentStore.pips.find((pip) => pip.id === pipId);
    if (!existing || existing.status === "Completed") return;
    const extensionDecisionDate = (backend.actualServerDate || backend.serverDate || new Date().toISOString()).slice(0, 10);
    const minTarget = addDaysToIsoDate(extensionDecisionDate, 14);
    const maxTarget = addDaysToIsoDate(extensionDecisionDate, 60);
    const minCheckIn = addDaysToIsoDate(extensionDecisionDate, 7);
    const maxCheckIn = addDaysToIsoDate(extensionDecisionDate, 14);

    if (!pipExtensionReason.trim()) {
      setPhase4Message("Document the reason before extending the PIP.");
      return;
    }
    if (!pipExtensionTargetDate || pipExtensionTargetDate < minTarget || pipExtensionTargetDate > maxTarget || pipExtensionTargetDate <= existing.targetEndDate) {
      setPhase4Message("The new Target End must be later than the current target and 14 to 60 calendar days after the extension decision.");
      return;
    }
    if (!pipExtensionCheckInTitle.trim()) {
      setPhase4Message("Define the next required check-in for the extension period.");
      return;
    }
    if (!pipExtensionCheckInDate || pipExtensionCheckInDate < minCheckIn || pipExtensionCheckInDate > maxCheckIn || pipExtensionCheckInDate >= pipExtensionTargetDate) {
      setPhase4Message("The next check-in must be 7 to 14 calendar days after the extension decision and before the new Target End.");
      return;
    }

    setPhase4Message("Saving governed PIP extension...");
    try {
      await backend.transitionPipGovernance(pipId, {
        action: "extend",
        extensionReason: pipExtensionReason.trim(),
        newTargetEndDate: pipExtensionTargetDate,
        nextCheckInDate: pipExtensionCheckInDate,
        nextCheckInTitle: pipExtensionCheckInTitle.trim(),
      });
      setPipGovernanceMode(null);
      setPhase4Message("PIP extension saved. The original target remains preserved in governance history.");
    } catch (error) {
      setPhase4Message(
        error instanceof Error
          ? `PIP was not extended: ${error.message}`
          : "PIP was not extended because the server rejected the extension action.",
      );
    }
  }

  const pipActualStartDate = (backend.actualServerDate || backend.serverDate || new Date().toISOString()).slice(0, 10);
  const pipToday = pipActualStartDate;
  const getPipLifecycleLabel = (pip: PerformanceImprovementPlan): PipLifecycleLabel => {
    if (pip.status === "Completed") return "Closed";
    if (pip.targetEndDate <= pipToday) return "Outcome Review Due";
    if (pip.status === "Extended") return "Extended";
    return "Active";
  };
  const pipCycleRows = developmentStore.pips.filter((pip) => {
    const relatedReview = evaluations.find((evaluation) => evaluation.id === pip.relatedReviewId);
    return !selectedGoalsCycle || relatedReview?.periodId === selectedGoalsCycle.id;
  });
  const pipHasDueCheckIn = (pip: PerformanceImprovementPlan) =>
    pip.status !== "Completed" &&
    pip.milestones.some((milestone) => milestone.status !== "Completed" && milestone.dueDate <= pipToday);
  const filteredPips = pipCycleRows.filter((pip) => {
    const person = getPersonById(pip.personId);
    const departmentMatches =
      pipDepartmentFilter === "All Departments" || person?.department === pipDepartmentFilter;
    const lifecycle = getPipLifecycleLabel(pip);
    const statusMatches =
      pipStatusFilter === "All Statuses" ||
      (pipStatusFilter === "Open" && lifecycle !== "Closed") ||
      (pipStatusFilter === "Due for Check-in" && pipHasDueCheckIn(pip)) ||
      lifecycle === pipStatusFilter;
    return departmentMatches && statusMatches;
  });
  const pipPageSize = 10;
  const pipPageCount = Math.max(1, Math.ceil(filteredPips.length / pipPageSize));
  const safePipPage = Math.min(pipPage, pipPageCount);
  const pagedPips = filteredPips.slice((safePipPage - 1) * pipPageSize, safePipPage * pipPageSize);
  const selectedPip = developmentStore.pips.find((pip) => pip.id === selectedPipId) ?? null;
  const selectedPipPerson = selectedPip ? getPersonById(selectedPip.personId) : null;
  const selectedPipManager = selectedPip ? getPersonById(selectedPip.assignedManagerId) : null;
  const selectedPipReview = selectedPip
    ? evaluations.find((evaluation) => evaluation.id === selectedPip.relatedReviewId) ?? null
    : null;
  const selectedPipLifecycle = selectedPip ? getPipLifecycleLabel(selectedPip) : null;
  const selectedPipClosed = selectedPipLifecycle === "Closed";
  const selectedPipOutcomeDue = selectedPipLifecycle === "Outcome Review Due";
  const selectedPipCheckInsComplete = selectedPip
    ? selectedPip.milestones.length > 0 && selectedPip.milestones.every((milestone) => milestone.status === "Completed")
    : false;
  const selectedPipClosureRecord = selectedPip
    ? [...selectedPip.progressNotes].reverse().find((note) => note.note.startsWith("PIP closed.")) ?? null
    : null;
  const selectedPipClosedBy = selectedPipClosureRecord ? getPersonById(selectedPipClosureRecord.authorId) : null;
  const availableFinalizedPipReviews = evaluations
    .filter((review) => {
      const person = getPersonById(review.personId);
      return (
        review.status === "Completed" &&
        (!selectedGoalsCycle || review.periodId === selectedGoalsCycle.id) &&
        (pipDepartmentFilter === "All Departments" || person?.department === pipDepartmentFilter) &&
        !developmentStore.pips.some((pip) => pip.relatedReviewId === review.id)
      );
    })
    .sort((left, right) =>
      (right.finalizedAt ?? right.dateEvaluated ?? "").localeCompare(
        left.finalizedAt ?? left.dateEvaluated ?? "",
      ),
    );
  const pipConsiderations = availableFinalizedPipReviews
    .map((review) => {
      const person = getPersonById(review.personId);
      if (!person) return null;
      const signals = getPipReviewSignals(review);
      if (signals.length === 0) return null;
      return { review, person, signals, manager: resolvePipManager(review) };
    })
    .filter(
      (row): row is {
        review: Evaluation;
        person: PersonnelIdentity;
        signals: string[];
        manager: PersonnelIdentity | null;
      } => row !== null,
    );
  const pipMinimumTargetEndDate = addDaysToIsoDate(pipActualStartDate, 30);
  const pipMaximumTargetEndDate = addDaysToIsoDate(pipActualStartDate, 90);
  const pipMinimumCheckInDate = addDaysToIsoDate(pipActualStartDate, 7);
  const pipMaximumCheckInDate = addDaysToIsoDate(pipActualStartDate, 14);
  const pipSummary = {
    considerations: pipConsiderations.length,
    active: pipCycleRows.filter((pip) => pip.status !== "Completed").length,
    dueForCheckIn: pipCycleRows.filter(pipHasDueCheckIn).length,
    closed: pipCycleRows.filter((pip) => pip.status === "Completed").length,
  };
  const pipDraftReview = evaluations.find((review) => review.id === pipDraft.relatedReviewId) ?? null;
  const pipDraftPerson = pipDraftReview ? getPersonById(pipDraftReview.personId) ?? null : null;
  const pipDraftManager = pipDraft.assignedManagerId
    ? getPersonById(pipDraft.assignedManagerId) ?? null
    : null;
  const pipDraftSignals = pipDraftReview ? getPipReviewSignals(pipDraftReview) : [];
  const pipDraftReady = Boolean(
    pipDraftReview &&
      pipDraftPerson &&
      pipDraft.assignedManagerId &&
      pipDraft.performanceConcern.trim() &&
      pipDraft.expectedImprovement.trim() &&
      pipDraft.actionItem.trim() &&
      pipDraft.targetEndDate &&
      pipDraft.targetEndDate >= pipMinimumTargetEndDate &&
      pipDraft.targetEndDate <= pipMaximumTargetEndDate &&
      pipDraft.firstMilestone.trim() &&
      pipDraft.firstMilestoneDate &&
      pipDraft.firstMilestoneDate >= pipMinimumCheckInDate &&
      pipDraft.firstMilestoneDate <= pipMaximumCheckInDate &&
      pipDraft.firstMilestoneDate < pipDraft.targetEndDate,
  );

  if (performanceView === "manage-evaluators" || workspaceTab === "Review Governance") {
    const pageSize = 10;
    const filteredGovernanceRows = reviewGovernance.rows.filter((row) => {
      const departmentMatches =
        reviewGovernanceDepartmentFilter === "All Departments" ||
        row.person.department === reviewGovernanceDepartmentFilter;
      const routingMatches =
        reviewGovernanceRoutingFilter === "All Routing" ||
        row.method === reviewGovernanceRoutingFilter;
      return departmentMatches && routingMatches;
    });
    const governancePageCount = Math.max(1, Math.ceil(filteredGovernanceRows.length / pageSize));
    const safeGovernancePage = Math.min(reviewGovernancePage, governancePageCount);
    const governanceRows = filteredGovernanceRows.slice(
      (safeGovernancePage - 1) * pageSize,
      safeGovernancePage * pageSize,
    );
    const blankGovernanceRows = Math.max(0, pageSize - governanceRows.length);
    const governanceFiltersActive =
      reviewGovernanceDepartmentFilter !== "All Departments" ||
      reviewGovernanceRoutingFilter !== "All Routing";
    return (
      <AuthenticatedLayout
        header={
          <h1 className="truncate text-sm font-bold text-slate-900">
            Performance Management
          </h1>
        }
      >
        <Head title="Review Governance - Performance Management" />

        <HeaderFilters>
          {renderPerformanceCycleFilter()}
          <SystemSelect
            aria-label="Review Governance department"
            value={reviewGovernanceDepartmentFilter}
            onChange={(event) => {
              setReviewGovernanceDepartmentFilter(event.target.value);
              setReviewGovernancePage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
          >
            <option>All Departments</option>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </SystemSelect>
          <SystemSelect
            aria-label="Review Governance routing"
            value={reviewGovernanceRoutingFilter}
            onChange={(event) => {
              setReviewGovernanceRoutingFilter(event.target.value);
              setReviewGovernancePage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
          >
            <option value="All Routing">All Routing</option>
            <option value="Manager Review">Manager Review</option>
            <option value="360° Leadership Review">360° Leadership Review</option>
            <option value="Routing Issue">Routing Issues</option>
          </SystemSelect>
          {governanceFiltersActive && (
            <button
              type="button"
              onClick={() => {
                setReviewGovernanceDepartmentFilter("All Departments");
                setReviewGovernanceRoutingFilter("All Routing");
                setReviewGovernancePage(1);
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </HeaderFilters>

        <HeaderActions>
          {selectedGoalsReadOnly && (
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-500">
              Finalized · Read Only
            </span>
          )}
          {performanceView === "manage-evaluators" && (
            <button
              type="button"
              onClick={() => router.visit(performanceWorkspaceHref())}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to {workspaceTab}
            </button>
          )}
        </HeaderActions>

        <div className="app-page app-page-enter flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Review Coverage", value: `${reviewGovernance.coveredCount} / ${reviewGovernance.rows.length}`, detail: "Eligible personnel with a safe automatic review route", icon: CheckCircle2, filter: "All Routing" },
              { label: "Manager Reviews", value: reviewGovernance.managerCount, detail: "Automatically routed to the recorded or unambiguous department leader", icon: UserRound, filter: "Manager Review" },
              { label: "360° Leadership Reviews", value: reviewGovernance.leadershipCount, detail: "Top-of-scope leaders routed to governed multi-source feedback", icon: Users, filter: "360° Leadership Review" },
              { label: "Routing Issues", value: reviewGovernance.issueCount, detail: "Requires upstream reporting-data correction; never manual evaluator substitution", icon: AlertTriangle, filter: "Routing Issue" },
            ].map((card) => (
              <PerformanceSummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                detail={card.detail}
                icon={card.icon}
                selected={reviewGovernanceRoutingFilter === card.filter}
                onClick={() => {
                  setReviewGovernanceRoutingFilter(card.filter);
                  setReviewGovernancePage(1);
                  window.requestAnimationFrame(() =>
                    document.getElementById("review-governance-register")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
              />
            ))}
          </div>

          <section id="review-governance-register" className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Review Routing</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">One row per active personnel showing the system-derived review method, authority, routing basis, and readiness status.</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">{reviewGovernance.coveredCount} automatically covered</span>
                {reviewGovernance.issueCount > 0 && (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-bold text-rose-700">{reviewGovernance.issueCount} source-data issue{reviewGovernance.issueCount === 1 ? "" : "s"}</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] table-fixed divide-y divide-slate-100">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[17%]" />
                  <col className="w-[16%]" />
                  <col className="w-[23%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr>
                    {["Personnel", "Position", "Review Method", "Review Authority / Sources", "Routing Basis", "Status"].map((header) => (
                      <th key={header} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {governanceRows.map((row) => (
                    <tr key={row.person.id} className="h-[58px] transition hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="truncate text-xs font-bold text-slate-800">{row.person.fullName}</p>
                        <p className="mt-0.5 truncate text-[9px] text-slate-400">{row.person.department} · {row.person.personType}</p>
                      </td>
                      <td className="px-4 py-3 text-[10px] font-semibold text-slate-600">{row.person.position}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold ${row.method === "360° Leadership Review" ? "bg-violet-50 text-violet-700" : row.method === "Manager Review" ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-700"}`}>{row.method}</span>
                      </td>
                      <td className="px-4 py-3 text-[10px] leading-4 text-slate-600">{row.authority}</td>
                      <td className="px-4 py-3 text-[10px] leading-4 text-slate-500">{row.basis}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold ${row.status === "Ready" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: blankGovernanceRows }).map((_, index) => (
                    <tr key={`governance-blank-${index}`} className="h-[58px] bg-white" aria-hidden="true">
                      <td colSpan={6} className="px-4 py-3">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] text-slate-500">
                Showing {filteredGovernanceRows.length === 0 ? 0 : (safeGovernancePage - 1) * pageSize + 1}–{Math.min(safeGovernancePage * pageSize, filteredGovernanceRows.length)} of {filteredGovernanceRows.length} personnel{governanceFiltersActive ? ` · ${reviewGovernance.rows.length} total` : ""}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={safeGovernancePage <= 1} onClick={() => setReviewGovernancePage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="min-w-16 text-center text-[10px] font-semibold text-slate-500">Page {safeGovernancePage} of {governancePageCount}</span>
                <button type="button" disabled={safeGovernancePage >= governancePageCount} onClick={() => setReviewGovernancePage((page) => Math.min(governancePageCount, page + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
          </section>

        </div>
      </AuthenticatedLayout>
    );
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

      <HeaderActions>
        {selectedGoalsReadOnly && workspaceTab !== "Performance Improvement" && workspaceTab !== "Analytics" && (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-500">
            Finalized · Read Only
          </span>
        )}

      </HeaderActions>

      {workspaceTab === "Overview" && (
        <HeaderFilters>
          {renderPerformanceCycleFilter()}
        </HeaderFilters>
      )}

      {workspaceTab === "Reviews" && (
        <HeaderFilters>
          {renderPerformanceCycleFilter()}
          <SystemSelect aria-label="Department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
            <option>All Departments</option>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </SystemSelect>
          <SystemSelect aria-label="Review Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
            <option value="All">All Workflows</option>
            <option value="Performance Period Ongoing">Performance Period Ongoing</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Manager Review">Manager Review</option>
            <option value="360 Feedback Collection">360 Feedback Collection</option>
            <option value="Calibration">Calibration</option>
            <option value="Calibration Pending">Calibration Pending</option>
            <option value="Calibration In Review">Calibration In Review</option>
            <option value="Revision In Progress">Revision In Progress</option>
            <option value="Finalized">Finalized</option>
            <option value="Overdue">Overdue</option>
          </SystemSelect>
          <SystemSelect
            aria-label="Rating Level"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            disabled={selectedReviewsPreReview}
            title={selectedReviewsPreReview ? "Formal rating filters become available when the review window opens." : undefined}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
          >
            {LEVEL_FILTER_OPTIONS.map((level) => <option key={level}>{level}</option>)}
          </SystemSelect>
          {evaluatorFilter && (
            <button type="button" onClick={() => setEvaluatorFilter("")} className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
              Evaluator: {getPersonById(evaluatorFilter)?.fullName ?? "Unknown"} <X className="h-3 w-3" />
            </button>
          )}
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </HeaderFilters>
      )}

      {workspaceTab === "Performance Improvement" && (
        <HeaderFilters>
          {renderPerformanceCycleFilter()}
          <SystemSelect
            aria-label="PIP department"
            value={pipDepartmentFilter}
            onChange={(event) => {
              setPipDepartmentFilter(event.target.value);
              setPipPage(1);
              setSelectedPipId(null);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
          >
            <option>All Departments</option>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </SystemSelect>
          <SystemSelect
            aria-label="PIP status"
            value={pipStatusFilter}
            onChange={(event) => {
              setPipStatusFilter(event.target.value);
              setPipPage(1);
              setSelectedPipId(null);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
          >
            <option>All Statuses</option>
            <option>Open</option>
            <option>Active</option>
            <option>Extended</option>
            <option>Due for Check-in</option>
            <option>Outcome Review Due</option>
            <option>Closed</option>
          </SystemSelect>
          {(pipDepartmentFilter !== "All Departments" || pipStatusFilter !== "All Statuses") && (
            <button
              type="button"
              onClick={() => {
                setPipDepartmentFilter("All Departments");
                setPipStatusFilter("All Statuses");
                setPipPage(1);
                setSelectedPipId(null);
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </HeaderFilters>
      )}

      {workspaceTab === "Analytics" && (
        <HeaderFilters>
          <SystemSelect
            aria-label="Analytics cycle"
            value={analyticsFilters.cycleId}
            onChange={(event) => setAnalyticsFilters((current) => ({ ...current, cycleId: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value={ALL_ANALYTICS_CYCLES}>All Cycles</option>
            {periods.slice().sort((a, b) => b.performanceEndDate.localeCompare(a.performanceEndDate)).map((period) => (
              <option key={period.id} value={period.id}>{period.cycleName}</option>
            ))}
          </SystemSelect>
          <SystemSelect aria-label="Analytics department" value={analyticsFilters.department} onChange={(event) => setAnalyticsFilters((current) => ({ ...current, department: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value={ALL_ANALYTICS_DEPARTMENTS}>All Departments</option>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </SystemSelect>
          <SystemSelect aria-label="Analytics person type" value={analyticsFilters.personType} onChange={(event) => setAnalyticsFilters((current) => ({ ...current, personType: event.target.value as PerformanceAnalyticsFilters["personType"] }))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value={ALL_ANALYTICS_PERSON_TYPES}>All Person Types</option>
            <option>Employee</option>
            <option>Trainee</option>
          </SystemSelect>
          <SystemSelect aria-label="Analytics template" value={analyticsFilters.reviewTemplateId} onChange={(event) => setAnalyticsFilters((current) => ({ ...current, reviewTemplateId: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value={ALL_ANALYTICS_TEMPLATES}>All Templates</option>
            {reviewTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </SystemSelect>
          <SystemSelect aria-label="Analytics evaluator" value={analyticsFilters.evaluatorId} onChange={(event) => setAnalyticsFilters((current) => ({ ...current, evaluatorId: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value={ALL_ANALYTICS_EVALUATORS}>All Evaluators</option>
            {Array.from(new Set(analyticsResolvedRows.map(({ review }) => review.evaluatorId).filter(Boolean))).map((evaluatorId) => (
              <option key={evaluatorId} value={evaluatorId}>{getPersonById(evaluatorId)?.fullName ?? evaluatorId}</option>
            ))}
          </SystemSelect>
          <ChartDateRangeControl compact label="Performance analytics date" value={analyticsDateRange} onChange={setAnalyticsDateRange} />
          {analyticsFilterActive && (
            <button
              type="button"
              onClick={() => {
                setAnalyticsFilters({
                  cycleId: ALL_ANALYTICS_CYCLES,
                  department: ALL_ANALYTICS_DEPARTMENTS,
                  personType: ALL_ANALYTICS_PERSON_TYPES,
                  reviewTemplateId: ALL_ANALYTICS_TEMPLATES,
                  evaluatorId: ALL_ANALYTICS_EVALUATORS,
                });
                setAnalyticsDateRange({ ...DEFAULT_CHART_DATE_RANGE, preset: "all" });
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </HeaderFilters>
      )}

      {selected && (
        <EvaluationDetailsModal
          onEditReview={selected.evaluation.evaluatorId === currentActorId && ['Pending', 'In Progress'].includes(selected.evaluation.status) && !!selectedGoalsCycle && backend.serverDate >= selectedGoalsCycle.reviewOpenDate && backend.serverDate <= selectedGoalsCycle.reviewDueDate ? () => openEditForm({...selected, evaluator: getPersonById(selected.evaluation.evaluatorId)}) : undefined}
          evaluation={selected.evaluation}
          person={selected.person}
          evaluator={getPersonById(selected.evaluation.evaluatorId)}
          period={periods.find(
            (period) => period.id === selected.evaluation.periodId,
          )}
          canManage={canManagePerformance}
          onClose={() => setSelected(null)}
          onApproveCalibration={() =>
            setFinalizeTarget(selected.evaluation)
          }
          onReturnCalibration={(notes) =>
            returnCalibrationForRevision(selected.evaluation.id, notes)
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
          goals={performanceGoals}
          goalTemplates={goalTemplates}
          reviewTemplates={reviewTemplates}
          serverDate={backend.serverDate}
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
                  ? `Review ${selectedFormPerson?.fullName ?? selectedFormPerson?.personType ?? "Person"}`
                  : "Start Assigned Review"}
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
                    Active Review Cycle
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
                      : "No review assignments are currently assigned to you."}
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
                          ? "No active review cycle is currently available."
                          : currentActorScopes.length === 0
                            ? "No review assignments are currently assigned to you."
                            : "No eligible assigned personnel remain for the active period."}
                      </p>
                      {canConfigurePerformance && (
                        <button
                          type="button"
                          onClick={() => {
                            closeForm();
                            openEvaluatorManagementPage();
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
              {formMode === "edit" && selectedFormPerson && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Goals &amp; KPI Performance Context</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{selectedFormGoalPlanName} · same person + same Performance cycle</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weighted Goal Progress</p>
                      <p className="text-sm font-extrabold text-slate-900">{selectedFormWeightedGoalProgress == null ? "—" : `${selectedFormWeightedGoalProgress}%`}</p>
                    </div>
                  </div>
                  {selectedFormGoals.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selectedFormGoals.map((goal) => (
                        <div key={goal.id} className="rounded-lg border border-white bg-white/90 p-2.5 text-[11px]">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-700">{goal.title}</p>
                              <p className="mt-0.5 leading-4 text-slate-500">{goal.metricType} · weight {goal.weight}% · {goal.status}</p>
                            </div>
                            <span className="font-extrabold text-slate-900">{goal.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-slate-500">No cycle-specific Goals/KPIs are linked. Do not invent or convert missing evidence into a score.</p>
                  )}
                  <p className="mt-3 border-t border-amber-100 pt-2 text-[11px] leading-5 text-amber-900">Use this verified work context when rating the formal criteria below. Goal percentages are not automatically converted to the 1–5 Performance rating.</p>
                </div>
              )}
              {formMode === "edit" && (
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">
                    Review Criteria
                  </label>
                  <div className="space-y-2.5 rounded-lg bg-slate-50 p-3">
                    {formCriteria.map((c) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className="w-44 shrink-0">
                          <p className="text-xs font-semibold text-slate-700">
                            {c.name}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                            {c.weight}% · {c.description}
                          </p>
                        </div>
                        <div className="flex flex-1 items-center gap-1" role="group" aria-label={`Rate ${c.name}`}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const currentScore = form.scores[c.name] ?? 0;
                            return (
                              <button
                                key={star}
                                type="button"
                                aria-label={`${c.name}: ${star} star${star === 1 ? "" : "s"}`}
                                aria-pressed={currentScore === star}
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    scores: {
                                      ...form.scores,
                                      [c.name]: star,
                                    },
                                  })
                                }
                                className="rounded-md p-0.5 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-300"
                              >
                                <Star
                                  className={`h-5 w-5 ${currentScore >= star ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300"}`}
                                />
                              </button>
                            );
                          })}
                        </div>
                        <span className="w-14 shrink-0 text-right text-xs font-bold text-slate-800">
                          {(form.scores[c.name] ?? 0) > 0 ? `${(form.scores[c.name] ?? 0).toFixed(0)} / 5` : "— / 5"}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                      <span className="font-semibold text-slate-500">
                        Weighted formal rating
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
                    placeholder="Observations for this review cycle..."
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
                    Save as Not Started
                  </button>
                  <button
                    type="button"
                    disabled={!form.personId}
                    onClick={() => createEvaluation(true)}
                    className="rounded-lg bg-[#F4B400] px-4 py-2 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Start Review
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
                    Submit Review
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {finalizeTarget && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
          onClick={() => setFinalizeTarget(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Approve &amp; Finalize Review</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Confirm that the evaluator-submitted result has passed calibration and is ready to become the official read-only result.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{getPersonById(finalizeTarget.personId)?.fullName ?? 'Selected personnel'}</p>
              <p className="mt-1">Submitted rating: {finalizeTarget.rating == null ? 'Pending' : `${finalizeTarget.rating.toFixed(2)} / 5`}</p>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 leading-5 text-slate-500">
                Finalization locks the official review as the read-only result for this completed workflow.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <button type="button" onClick={() => setFinalizeTarget(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={confirmApproveCalibration} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700">Approve &amp; Finalize</button>
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

      <div className="app-page app-page-enter flex flex-col gap-4">
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

        {workspaceTab === "Overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((card) => (
                <PerformanceSummaryCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  detail={card.meta}
                  icon={card.icon}
                  selected={activeCard === card.key}
                  onClick={() => handleCardClick(card.key)}
                />
              ))}
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Performance Snapshot
                  </h2>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                    Finalized review evidence and active Goal/KPI progress are shown separately so missing evidence is never treated as poor performance.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                  {overviewCanonicalPersonnelCount} workforce personnel
                </span>
              </div>

              <div className="grid items-start lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Workforce Performance Distribution
                      </p>
                      <h3 className="mt-1 text-sm font-extrabold text-slate-900">
                        Latest finalized ratings
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {overviewRatingDistribution.total} of {overviewCanonicalPersonnelCount} rated
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[auto_1fr] items-end gap-x-5 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:grid-cols-[auto_auto_1fr]">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Average
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-950">
                        {overviewLatestRating.average === null
                          ? "—"
                          : `${overviewLatestRating.average.toFixed(2)} / 5`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Evidence Coverage
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-950">
                        {overviewRatingCoverage}%
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="mb-1 flex items-center justify-between gap-3 text-[9px] font-semibold text-slate-400">
                        <span>Finalized review coverage</span>
                        <span>{Math.max(overviewCanonicalPersonnelCount - overviewRatingDistribution.total, 0)} awaiting finalized evidence</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${overviewRatingCoverage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {overviewRatingDistribution.data.map((point) => {
                      const pct =
                        overviewRatingDistribution.total > 0
                          ? Math.round(
                              (point.count / overviewRatingDistribution.total) *
                                100,
                            )
                          : 0;
                      return (
                        <div
                          key={String(point.value)}
                          className="grid grid-cols-[minmax(150px,auto)_1fr_auto] items-center gap-2"
                        >
                          <span className="truncate text-[10px] font-medium text-slate-600">
                            {point.label}
                          </span>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: point.color,
                              }}
                            />
                          </div>
                          <span className="min-w-12 text-right text-[10px] font-bold tabular-nums text-slate-700">
                            {point.count} <span className="font-normal text-slate-400">({pct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-3 text-[10px] leading-4 text-slate-400">
                    One latest finalized rating per person. Pending, incomplete, or missing reviews are excluded rather than scored as zero.
                  </p>
                </div>

                <div className="border-t border-slate-100 p-4 lg:border-t-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Goal &amp; KPI Progress
                      </p>
                      <h3 className="mt-1 text-sm font-extrabold text-slate-900">
                        Active-cycle work progress
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {overviewGoalHealth.total} goals · {overviewGoalPersonnelCount} personnel
                    </span>
                  </div>

                  {overviewGoalHealth.total === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <Target className="h-6 w-6 text-slate-300" />
                      <p className="text-xs text-slate-400">
                        No active-cycle goals are available yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-end justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Weighted Average Progress
                          </p>
                          <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-950">
                            {overviewGoalHealth.weightedAverageProgress ?? 0}%
                          </p>
                        </div>
                        <p className="max-w-60 text-right text-[9px] leading-4 text-slate-400">
                          Calculated as Σ(progress × configured weight) ÷ Σ(goal weights).
                        </p>
                      </div>

                      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label="Goal status distribution">
                        {goalStatusOverviewRows.map((row) => {
                          const pct =
                            overviewGoalHealth.total > 0
                              ? (row.count / overviewGoalHealth.total) * 100
                              : 0;
                          return row.count > 0 ? (
                            <div
                              key={row.label}
                              className={`${row.bar} h-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                              title={`${row.label}: ${row.count}`}
                            />
                          ) : null;
                        })}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {goalStatusOverviewRows.map((row) => (
                          <div
                            key={row.label}
                            className="rounded-lg border border-slate-100 px-2.5 py-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${row.bar}`} />
                              <span className="text-[9px] font-semibold text-slate-500">
                                {row.label}
                              </span>
                            </div>
                            <p className="mt-1 text-base font-extrabold tabular-nums text-slate-900">
                              {row.count}
                            </p>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setWorkspaceTab("Reviews")}
                        className="mt-3 text-[10px] font-bold text-amber-700 hover:text-amber-800"
                      >
                        Open Reviews →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Active Review Cycle
                    </p>
                    <h2 className="mt-1 text-base font-extrabold text-slate-900">
                      {activePeriod?.cycleName ?? "No active review cycle"}
                    </h2>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      {activePeriod
                        ? `Performance: ${activePeriod.performanceStartDate} → ${activePeriod.performanceEndDate} · Review: ${activePeriod.reviewOpenDate} → ${activePeriod.reviewDueDate}`
                        : "Create or activate a governed review cycle before review work can proceed."}
                    </p>
                  </div>
                  {activePeriod && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                      {activePeriod.status}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("All");
                      setPeriodFilter(activePeriod?.id ?? goalsCycleId);
                      setWorkspaceTab("Reviews");
                    }}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-slate-800"
                  >
                    Open Active Reviews
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("All");
                      setWorkspaceTab("Reviews");
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/40"
                  >
                    Open Reviews
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: "Assigned", value: activeCycleCompletion.assigned, color: "text-slate-900", filter: "All" as StatusFilter },
                  { label: "Finalized", value: activeCycleCompletion.finalized, color: "text-emerald-600", filter: "Finalized" as StatusFilter },
                  { label: "Overdue", value: activeCycleCompletion.overdue, color: "text-rose-600", filter: "Overdue" as StatusFilter },
                  { label: "In Progress", value: activeCycleCompletion.inProgress, color: "text-sky-600", filter: "In Progress" as StatusFilter },
                  { label: "Calibration", value: activeCycleCompletion.calibrationPending, color: "text-violet-600", filter: "Calibration" as StatusFilter },
                  { label: "Not Started", value: activeCycleCompletion.pending, color: "text-amber-600", filter: "Not Started" as StatusFilter },
                ].map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setStatusFilter(item.filter);
                      setPeriodFilter(activePeriod?.id ?? goalsCycleId);
                      setWorkspaceTab("Reviews");
                    }}
                    className={`group min-h-[76px] px-3 py-3 text-left transition hover:bg-amber-50/40 focus:outline-none focus-visible:bg-amber-50/60 ${index > 0 ? "border-l border-slate-100" : ""} ${index >= 2 ? "border-t border-slate-100 sm:border-t-0" : ""}`}
                    title={`Open ${item.label} reviews for the active cycle`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 transition group-hover:text-slate-600">
                        {item.label}
                      </p>
                      <span className="text-[10px] font-bold text-slate-300 opacity-0 transition group-hover:text-amber-600 group-hover:opacity-100">→</span>
                    </div>
                    <p className={`mt-1 text-lg font-extrabold tabular-nums ${item.color}`}>
                      {item.value}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Performance Attention Queue
                  </h2>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                    Actionable support needs, overdue review work, and finalized-evidence gaps. Succession and readiness context may flag missing Performance evidence but never creates or changes a rating.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                  {performanceAttentionQueue.length} requiring attention
                </span>
              </div>
              {performanceAttentionQueue.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400" />
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    No current Performance attention items.
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Finalized reviews, active goals, and improvement records do not currently indicate follow-through.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="w-[20%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Employee</th>
                        <th className="w-[18%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Latest Review</th>
                        <th className="w-[13%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Goal Health</th>
                        <th className="w-[20%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Concern</th>
                        <th className="w-[20%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Next Action</th>
                        <th className="w-[9%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {performanceAttentionQueue.slice(0, 10).map((row) => (
                        <tr
                          key={row.person.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setWorkspaceTab(row.destination)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setWorkspaceTab(row.destination);
                            }
                          }}
                          className="cursor-pointer transition hover:bg-amber-50/50 focus:bg-amber-50 focus:outline-none"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                style={{ backgroundColor: colorForId(row.person.id) }}
                              >
                                {initialsFor(row.person.fullName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-slate-800">{row.person.fullName}</p>
                                <p className="truncate text-[9px] text-slate-400">{row.person.department}</p>
                              </div>
                            </div>
                          </td>
                          <td className="truncate px-4 py-2.5 text-[10px] text-slate-600" title={row.latestReviewLabel}>{row.latestReviewLabel}</td>
                          <td className="truncate px-4 py-2.5 text-[10px] font-semibold text-slate-600" title={row.goalHealth}>{row.goalHealth}</td>
                          <td className="truncate px-4 py-2.5 text-[10px] text-slate-700" title={row.concern}>{row.concern}</td>
                          <td className="truncate px-4 py-2.5 text-[10px] text-slate-500" title={row.intervention}>{row.intervention}</td>
                          <td className="px-4 py-2.5">
                            <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold ${
                              row.status === "Needs support"
                                ? "bg-amber-100 text-amber-800"
                                : row.status === "Evidence gap"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-rose-100 text-rose-700"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <PerformanceGoalsWorkspace
              goalTemplates={goalsWorkspaceTemplates}
              activeCycle={selectedGoalsCycle}
              embedded
            />

            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[10px] leading-4 text-slate-600">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <p>
                <span className="font-bold text-slate-800">Performance evidence rule:</span>{" "}
                only finalized, valid Performance reviews contribute to rating summaries. Missing or incomplete evidence remains missing; the system never converts it to a zero rating or uses succession readiness as a Performance score.
              </p>
            </div>
          </div>
        )}

        {workspaceTab === "Reviews" && (
          <PerformanceReviewsWorkspace
            onCloseDetails={() => setSelected(null)}
            rows={filteredRows}
            periods={periods}
            reviewTemplates={reviewTemplates}
            activePeriodId={selectedGoalsCycle?.id}
            currentActorId={currentActorId}
            historicalRecords={selectedHistoricalGoals?.personnel_records}
            preReviewRows={preReviewRegisterRows}
            serverDate={backend.serverDate}
            actualServerDate={backend.actualServerDate}
            demoMode={backend.demoMode}
            departmentFilter={departmentFilter}
            statusFilter={statusFilter}
            ratingFilter={levelFilter}
            backendSaving={backend.saving}
            canManage={canManagePerformance}
            onOpen={openReviewFromWorkspace}
            onEdit={openEditForm}
            getTransitionEligibility={reviewTransitionEligibility}
            onTransition={transitionReviewFromWorkspace}
          />
        )}

        {workspaceTab === "Analytics" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Review Completion",
                  value: `${completionAnalytics.completionRate}%`,
                  detail: `${completionAnalytics.finalized} of ${completionAnalytics.assigned} finalized`,
                  icon: CheckCircle2,
                },
                {
                  label: "Average Final Rating",
                  value: analyticsAverageRating === null ? "—" : `${analyticsAverageRating.toFixed(2)} / 5`,
                  detail: `${finalizedAnalyticsRows.length} valid finalized rating${finalizedAnalyticsRows.length === 1 ? "" : "s"}`,
                  icon: Star,
                },
                {
                  label: "Review Attention",
                  value: completionAnalytics.calibrationPending + completionAnalytics.overdue,
                  detail: `${completionAnalytics.calibrationPending} calibration · ${completionAnalytics.overdue} overdue`,
                  icon: AlertTriangle,
                },
                {
                  label: "Open PIPs",
                  value: analyticsOpenPips.length,
                  detail: `${analyticsOpenPips.filter((pip) => pipLifecycleForAnalytics(pip, analyticsToday) === "Outcome Review Due").length} outcome review due`,
                  icon: TrendingUp,
                },
              ].map((card) => {
                const target: Record<string, PerformanceAnalyticsChartId> = {
                  "Review Completion": "finalization-quality",
                  "Average Final Rating": "rating-distribution",
                  "Review Attention": "review-workflow",
                  "Open PIPs": "pip-activity",
                };
                return (
                  <PerformanceSummaryCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    detail={card.detail}
                    icon={card.icon}
                    onClick={() => {
                      const chartId = target[card.label];
                      document
                        .querySelector(`[data-performance-analytics-card="${chartId}"]`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <GripVertical className="h-3.5 w-3.5" />
              Drag any chart by its grip to reorder the dashboard. The eight-chart order is saved on this device.
            </div>

            {(() => {
              const analyticsExpandedControls = (
                <div className="flex flex-wrap items-center gap-2">
                  <SystemSelect
                    aria-label="Expanded analytics cycle"
                    value={analyticsFilters.cycleId}
                    onChange={(event) => setAnalyticsFilters((current) => ({ ...current, cycleId: event.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value={ALL_ANALYTICS_CYCLES}>All Cycles</option>
                    {periods.slice().sort((a, b) => b.performanceEndDate.localeCompare(a.performanceEndDate)).map((period) => (
                      <option key={period.id} value={period.id}>{period.cycleName}</option>
                    ))}
                  </SystemSelect>
                  <SystemSelect
                    aria-label="Expanded analytics department"
                    value={analyticsFilters.department}
                    onChange={(event) => setAnalyticsFilters((current) => ({ ...current, department: event.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value={ALL_ANALYTICS_DEPARTMENTS}>All Departments</option>
                    {departments.map((department) => <option key={department}>{department}</option>)}
                  </SystemSelect>
                  <SystemSelect
                    aria-label="Expanded analytics person type"
                    value={analyticsFilters.personType}
                    onChange={(event) => setAnalyticsFilters((current) => ({ ...current, personType: event.target.value as PerformanceAnalyticsFilters["personType"] }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value={ALL_ANALYTICS_PERSON_TYPES}>All Person Types</option>
                    <option>Employee</option>
                    <option>Trainee</option>
                  </SystemSelect>
                  <SystemSelect
                    aria-label="Expanded analytics template"
                    value={analyticsFilters.reviewTemplateId}
                    onChange={(event) => setAnalyticsFilters((current) => ({ ...current, reviewTemplateId: event.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value={ALL_ANALYTICS_TEMPLATES}>All Templates</option>
                    {reviewTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </SystemSelect>
                  <SystemSelect
                    aria-label="Expanded analytics evaluator"
                    value={analyticsFilters.evaluatorId}
                    onChange={(event) => setAnalyticsFilters((current) => ({ ...current, evaluatorId: event.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value={ALL_ANALYTICS_EVALUATORS}>All Evaluators</option>
                    {Array.from(new Set(analyticsResolvedRows.map(({ review }) => review.evaluatorId).filter(Boolean))).map((evaluatorId) => (
                      <option key={evaluatorId} value={evaluatorId}>{getPersonById(evaluatorId)?.fullName ?? evaluatorId}</option>
                    ))}
                  </SystemSelect>
                  <ChartDateRangeControl compact label="Expanded performance analytics date" value={analyticsDateRange} onChange={setAnalyticsDateRange} />
                  {analyticsFilterActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnalyticsFilters({
                          cycleId: ALL_ANALYTICS_CYCLES,
                          department: ALL_ANALYTICS_DEPARTMENTS,
                          personType: ALL_ANALYTICS_PERSON_TYPES,
                          reviewTemplateId: ALL_ANALYTICS_TEMPLATES,
                          evaluatorId: ALL_ANALYTICS_EVALUATORS,
                        });
                        setAnalyticsDateRange({ ...DEFAULT_CHART_DATE_RANGE, preset: "all" });
                      }}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset filters
                    </button>
                  )}
                </div>
              );
              return (
                <div className="grid items-start gap-3 xl:grid-cols-2">
              <PerformanceAnalyticsChartCard
                title="Review workflow status"
                description="Exclusive workflow buckets for reviews inside the selected population and date range."
                reorder={performanceAnalyticsReorder("review-workflow")}
                chartHeight={300}
                expandedControls={analyticsExpandedControls}
              >
                {analyticsReviewWorkflow.length === 0 ? (
                  <PerformanceAnalyticsEmpty message="No review workflow records match the selected scope." />
                ) : (
                  <PerformanceAnalyticsDonut data={analyticsReviewWorkflow} totalLabel="Reviews in scope" />
                )}
              </PerformanceAnalyticsChartCard>

              <PerformanceAnalyticsChartCard
                title="Rating distribution"
                description="Finalized valid ratings only, grouped to the nearest configured five-point rating level."
                reorder={performanceAnalyticsReorder("rating-distribution")}
                expandedControls={analyticsExpandedControls}
              >
                {finalizedAnalyticsRows.length === 0 ? (
                  <PerformanceAnalyticsEmpty message="No finalized ratings match the selected scope." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingDistribution.slice().reverse()} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => [value, "Reviews"]} />
                      <Bar dataKey="count" fill="#F4B400" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </PerformanceAnalyticsChartCard>

              <PerformanceAnalyticsChartCard
                title="Average final rating trend"
                description="Cycle-by-cycle average from finalized valid ratings in the current analytics scope."
                reorder={performanceAnalyticsReorder("rating-trend")}
                expandedControls={analyticsExpandedControls}
              >
                {analyticsRatingTrend.length === 0 ? (
                  <PerformanceAnalyticsEmpty message="No comparable finalized rating history matches this date range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsRatingTrend} margin={{ top: 10, right: 18, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cycle" tick={{ fontSize: 11 }} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                      <Tooltip formatter={(value) => [value, "Average rating"]} />
                      <Line type="monotone" dataKey="averageRating" stroke="#F4B400" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </PerformanceAnalyticsChartCard>

              <PerformanceAnalyticsChartCard
                title="Goal & KPI trend"
                description="Performance-owned goals only; weighted progress and completed rate use the same personnel/date scope."
                reorder={performanceAnalyticsReorder("goal-trend")}
                expandedControls={analyticsExpandedControls}
              >
                {goalTrendAnalytics.length === 0 ? (
                  <PerformanceAnalyticsEmpty message="No Goal/KPI history overlaps the selected analytics range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={goalTrendAnalytics.map((point) => ({
                        cycle: point.cycleName.replace(" Performance Cycle", ""),
                        progress: point.averageProgress,
                        completed: point.completedRate,
                      }))}
                      margin={{ top: 10, right: 18, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cycle" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                      <Line type="monotone" dataKey="progress" name="Weighted progress" stroke="#F4B400" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="completed" name="Completed goals" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </PerformanceAnalyticsChartCard>

              <PerformanceAnalyticsChartCard
                title="Department performance"
                description="Review completion and weighted Goal/KPI progress by department; mixed review templates are not blended into one rating comparison."
                reorder={performanceAnalyticsReorder("department-performance")}
                chartHeight={Math.min(360, Math.max(230, analyticsDepartmentChart.length * 34 + 60))}
                expandedControls={analyticsExpandedControls}
              >
                {analyticsDepartmentChart.length === 0 ? (
                  <PerformanceAnalyticsEmpty message="No department-level Performance records match the selected scope." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsDepartmentChart} layout="vertical" margin={{ top: 6, right: 16, bottom: 6, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <YAxis type="category" dataKey="department" width={128} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value, name) => [value == null ? "—" : `${value}%`, name]} />
                      <Bar dataKey="completion" name="Review completion" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="goalProgress" name="Goal progress" fill="#F4B400" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </PerformanceAnalyticsChartCard>

              <PerformanceAnalyticsChartCard
                title="PIP activity"
                description="Event counts inside the selected date range; plans remain human-governed and are not employee rankings."
                reorder={performanceAnalyticsReorder("pip-activity")}
                chartHeight={308}
                expandedControls={analyticsExpandedControls}
                chartContainerClassName="pt-2"
              >
                {analyticsPipActivity.every((item) => item.count === 0) ? (
                  <PerformanceAnalyticsEmpty message="No PIP events fall inside the selected analytics range." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsPipActivity} margin={{ top: 28, right: 18, bottom: 6, left: 4 }} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} width={28} axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.2))]} />
                      <Tooltip formatter={(value) => [value, "Events"]} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={82} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </PerformanceAnalyticsChartCard>

              <PerformanceAnalyticsChartCard
                title="Finalization quality"
                description="Process-quality coverage only: completion, required calibration, linked evidence, and required acknowledgment."
                reorder={performanceAnalyticsReorder("finalization-quality")}
                expandedControls={analyticsExpandedControls}
              >
                {completionAnalytics.assigned === 0 ? (
                  <PerformanceAnalyticsEmpty message="No review records are available for finalization-quality analysis." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsFinalizationQuality} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value) => [`${value}%`, "Coverage"]} />
                      <Bar dataKey="percentage" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </PerformanceAnalyticsChartCard>

              <PerformanceAnalyticsChartCard
                title="Evaluator consistency"
                description="Single-evaluator reviews only. 360° leadership reviews are excluded; mixed-template comparisons are not forced."
                reorder={performanceAnalyticsReorder("evaluator-consistency")}
                chartHeight={Math.min(340, Math.max(230, analyticsEvaluatorChart.length * 38 + 60))}
                expandedControls={analyticsExpandedControls}
              >
                {analyticsEvaluatorChart.length === 0 ? (
                  <PerformanceAnalyticsEmpty message="No comparable single-evaluator finalized sample is available in this scope." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsEvaluatorChart} layout="vertical" margin={{ top: 6, right: 16, bottom: 6, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                      <YAxis type="category" dataKey="evaluator" width={128} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value, name) => [Number(value).toFixed(2), name]} />
                      <Bar dataKey="evaluatorAverage" name="Evaluator average" fill="#F4B400" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="organizationAverage" name="Organization average" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </PerformanceAnalyticsChartCard>
            </div>
              );
            })()}

          </div>
        )}

        {workspaceTab === "Performance Improvement" && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-bold text-slate-900">Performance Improvement Plans</h2>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Formal, human-led improvement plans tied to a documented performance basis. PIPs never automate disciplinary or employment decisions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhase4Message("");
                    setPipSourcePickerOpen(true);
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#121212] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-black"
                >
                  <Plus className="h-3.5 w-3.5" /> Start from Finalized Review
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 bg-slate-50/40 p-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Considerations", value: pipSummary.considerations, icon: AlertTriangle, detail: "Finalized cases surfaced for human review", filter: "All Statuses", target: "pip-considerations" },
                  { label: "Active", value: pipSummary.active, icon: TrendingUp, detail: "Open improvement plans across active lifecycle states", filter: "Open", target: "pip-register" },
                  { label: "Due for Check-in", value: pipSummary.dueForCheckIn, icon: CalendarDays, detail: "Pending PIP owner milestone due", filter: "Due for Check-in", target: "pip-register" },
                  { label: "Closed", value: pipSummary.closed, icon: CheckCircle2, detail: "Completed plans", filter: "Closed", target: "pip-register" },
                ].map((card) => (
                  <PerformanceSummaryCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    detail={card.detail}
                    icon={card.icon}
                    selected={
                      card.label === "Considerations"
                        ? false
                        : pipStatusFilter === card.filter
                    }
                    onClick={() => {
                      setPipStatusFilter(card.filter);
                      setPipPage(1);
                      setSelectedPipId(null);
                      window.requestAnimationFrame(() =>
                        document.getElementById(card.target)?.scrollIntoView({ behavior: "smooth", block: "start" }),
                      );
                    }}
                  />
                ))}
              </div>
            </section>


            <section id="pip-considerations" className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">PIP Considerations</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Finalized reviews with a documented support signal are surfaced here for Admin/HR review. A consideration never creates a PIP automatically.
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                  {pipConsiderations.length} {pipConsiderations.length === 1 ? "case" : "cases"}
                </span>
              </div>

              {pipConsiderations.length === 0 ? (
                <div className="px-4 py-8 text-center sm:px-5">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-600">No PIP consideration is currently surfaced</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    Admin/HR can still start from any finalized review when a separately documented performance concern warrants human review.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-2.5">Personnel</th>
                        <th className="border-b border-slate-200 px-4 py-2.5">Finalized Review</th>
                        <th className="border-b border-slate-200 px-4 py-2.5">Consideration Signals</th>
                        <th className="border-b border-slate-200 px-4 py-2.5">PIP Owner</th>
                        <th className="border-b border-slate-200 px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipConsiderations.slice(0, 10).map(({ review, person, signals, manager }) => (
                        <tr key={review.id} className="border-b border-slate-100 bg-white align-top">
                          <td className="px-4 py-3">
                            <p className="text-xs font-semibold text-slate-800">{person.fullName}</p>
                            <p className="mt-0.5 text-[9px] text-slate-400">{person.position} · {person.department}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[11px] font-semibold text-slate-700">
                              {periods.find((period) => period.id === review.periodId)?.cycleName ?? review.periodId}
                            </p>
                            <p className="mt-0.5 text-[9px] text-slate-400">
                              {typeof review.rating === "number" ? `${review.rating.toFixed(2)} / 5 final rating` : "Finalized review"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex max-w-md flex-wrap gap-1.5">
                              {signals.map((signal) => (
                                <span key={signal} className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700">
                                  {signal}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-[11px] font-semibold ${manager ? "text-slate-700" : "text-rose-700"}`}>
                              {manager?.fullName ?? "Routing setup required"}
                            </p>
                            <p className="mt-0.5 text-[9px] text-slate-400">
                              {manager ? "Derived from Review Governance / reporting authority" : "No authorized manager is currently resolved"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openPipDraftForReview(review.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                            >
                              Review Case
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>


            {phase4Message && (
              <p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800">
                {phase4Message}
              </p>
            )}

            <section id="pip-register" className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">PIP Register</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Select a row to open the governed, read-only PIP record and its outcome workflow.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  {filteredPips.length} {filteredPips.length === 1 ? "plan" : "plans"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-2.5">Personnel</th>
                      <th className="border-b border-slate-200 px-4 py-2.5">PIP Owner</th>
                      <th className="border-b border-slate-200 px-4 py-2.5">Target End</th>
                      <th className="border-b border-slate-200 px-4 py-2.5">Check-ins</th>
                      <th className="border-b border-slate-200 px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPips.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <TrendingUp className="mx-auto h-6 w-6 text-slate-300" />
                          <p className="mt-2 text-xs font-semibold text-slate-600">No Performance Improvement Plans found</p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {pipCycleRows.length === 0
                              ? "No PIP has been started for this cycle. Use a surfaced consideration or start from a finalized review when human review determines a formal plan is appropriate."
                              : "No PIP matches the selected filters."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      pagedPips.map((pip) => {
                        const person = getPersonById(pip.personId);
                        const manager = getPersonById(pip.assignedManagerId);
                        const completedMilestones = pip.milestones.filter((milestone) => milestone.status === "Completed").length;
                        const lifecycle = getPipLifecycleLabel(pip);
                        const statusClass = lifecycle === "Closed"
                          ? "bg-emerald-50 text-emerald-700"
                          : lifecycle === "Outcome Review Due"
                            ? "bg-violet-50 text-violet-700"
                            : lifecycle === "Extended"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-sky-50 text-sky-700";
                        return (
                          <tr
                            key={pip.id}
                            onClick={() => setSelectedPipId(pip.id)}
                            className="cursor-pointer border-b border-slate-100 bg-white transition hover:bg-amber-50/30"
                          >
                            <td className="px-4 py-3">
                              <p className="text-xs font-semibold text-slate-800">{person?.fullName ?? "Unknown person"}</p>
                              <p className="mt-0.5 text-[9px] text-slate-400">{person?.position ?? "—"} · {person?.department ?? "—"}</p>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-600">{manager?.fullName ?? "—"}</td>
                            <td className="px-4 py-3 text-[11px] text-slate-600">{formatReviewDate(pip.targetEndDate)}</td>
                            <td className="px-4 py-3 text-[11px] text-slate-600">
                              {pip.milestones.length ? `${completedMilestones}/${pip.milestones.length}` : "No milestone"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${statusClass}`}>{lifecycle}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-slate-500">
                  Showing {filteredPips.length === 0 ? 0 : (safePipPage - 1) * pipPageSize + 1}–{Math.min(safePipPage * pipPageSize, filteredPips.length)} of {filteredPips.length} plans
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={safePipPage <= 1} onClick={() => setPipPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                  <span className="min-w-14 text-center text-[10px] font-semibold text-slate-500">{safePipPage} / {pipPageCount}</span>
                  <button type="button" disabled={safePipPage >= pipPageCount} onClick={() => setPipPage((page) => Math.min(pipPageCount, page + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                </div>
              </div>
            </section>

            {selectedPip && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={() => setSelectedPipId(null)}>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`PIP Details for ${selectedPipPerson?.fullName ?? "personnel"}`}
                  onMouseDown={(event) => event.stopPropagation()}
                  className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Performance Improvement Plan</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-950">{selectedPipPerson?.fullName ?? "Unknown person"}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${selectedPipLifecycle === "Closed" ? "bg-emerald-50 text-emerald-700" : selectedPipLifecycle === "Outcome Review Due" ? "bg-violet-50 text-violet-700" : selectedPipLifecycle === "Extended" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
                          {selectedPipLifecycle}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{selectedPipPerson?.position ?? "—"} · {selectedPipPerson?.department ?? "—"}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedPipId(null)} className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700" aria-label="Close PIP details">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="space-y-5">
                      <section>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">PIP Summary</h4>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500">Read-only governed record</span>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <table className="w-full border-collapse text-left text-[11px]">
                            <tbody>
                              <tr className="border-b border-slate-100">
                                <th className="w-1/5 bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Personnel</th>
                                <td className="w-[30%] px-3 py-2.5 font-semibold text-slate-700">{selectedPipPerson?.fullName ?? "—"}</td>
                                <th className="w-1/5 bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">PIP Owner</th>
                                <td className="w-[30%] px-3 py-2.5 font-semibold text-slate-700">{selectedPipManager?.fullName ?? "—"}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Performance Basis</th>
                                <td className="px-3 py-2.5 font-semibold text-slate-700">{selectedPipReview ? periods.find((period) => period.id === selectedPipReview.periodId)?.cycleName ?? selectedPipReview.id : "Related finalized review"}</td>
                                <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Plan Status</th>
                                <td className="px-3 py-2.5 font-semibold text-slate-700">{selectedPipLifecycle}</td>
                              </tr>
                              <tr>
                                <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Start Date</th>
                                <td className="px-3 py-2.5 font-semibold text-slate-700">{formatReviewDate(selectedPip.startDate)}</td>
                                <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Current Target End</th>
                                <td className="px-3 py-2.5 font-semibold text-slate-700">{formatReviewDate(selectedPip.targetEndDate)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section>
                        <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Improvement Plan</h4>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-400"><tr><th className="w-1/2 px-3 py-2.5">Performance Concern</th><th className="w-1/2 border-l border-slate-200 px-3 py-2.5">Expected Improvement</th></tr></thead>
                            <tbody><tr><td className="align-top px-3 py-3 leading-5 text-slate-600">{selectedPip.performanceConcern}</td><td className="border-l border-slate-200 px-3 py-3 align-top leading-5 text-slate-600">{selectedPip.expectedImprovement}</td></tr></tbody>
                          </table>
                        </div>
                      </section>

                      <section>
                        <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Action Plan</h4>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-400"><tr><th className="w-12 px-3 py-2.5">#</th><th className="px-3 py-2.5">Required Action</th><th className="w-[34%] px-3 py-2.5">Development Support</th></tr></thead>
                            <tbody>
                              {selectedPip.actionItems.map((action, index) => (
                                <tr key={`${selectedPip.id}-action-${index}`} className="border-t border-slate-100 first:border-t-0">
                                  <td className="px-3 py-3 font-bold text-amber-600">{index + 1}</td>
                                  <td className="px-3 py-3 text-slate-600">{action}</td>
                                  <td className="px-3 py-3 text-slate-600">{index === 0 && selectedPip.developmentActions.length ? selectedPip.developmentActions.map((item) => `${item.source}: ${item.title} · ${item.status}`).join("; ") : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Check-in History</h4>
                          <span className="text-[9px] font-semibold text-slate-400">{selectedPip.milestones.filter((milestone) => milestone.status === "Completed").length}/{selectedPip.milestones.length} complete</span>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                          <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-400"><tr><th className="w-36 px-3 py-2.5">Due Date</th><th className="px-3 py-2.5">Check-in</th><th className="w-28 px-3 py-2.5">Status</th><th className="w-[28%] px-3 py-2.5">Recorded Note</th></tr></thead>
                            <tbody>
                              {selectedPip.milestones.length ? selectedPip.milestones.map((milestone) => (
                                <tr key={milestone.id} className="border-t border-slate-100 first:border-t-0">
                                  <td className="px-3 py-3 text-slate-600">{formatReviewDate(milestone.dueDate)}</td>
                                  <td className="px-3 py-3 font-semibold text-slate-700">{milestone.title}</td>
                                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${milestone.status === "Completed" ? "bg-emerald-50 text-emerald-700" : milestone.status === "Missed" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{milestone.status}</span></td>
                                  <td className="px-3 py-3 text-slate-500">{milestone.note ?? (milestone.completedAt ? `Completed ${formatReviewDate(milestone.completedAt)}` : "—")}</td>
                                </tr>
                              )) : <tr><td colSpan={4} className="px-3 py-6 text-center text-[10px] text-slate-400">No required check-in recorded.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      {selectedPip.progressNotes.length > 0 && (
                        <section>
                          <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Governance & Progress History</h4>
                          <div className="overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full border-collapse text-left text-[11px]">
                              <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-400"><tr><th className="w-44 px-3 py-2.5">Recorded</th><th className="w-48 px-3 py-2.5">Actor</th><th className="px-3 py-2.5">Record</th></tr></thead>
                              <tbody>{selectedPip.progressNotes.map((note) => <tr key={note.id} className="border-t border-slate-100 first:border-t-0"><td className="px-3 py-3 text-slate-500">{new Date(note.createdAt).toLocaleString()}</td><td className="px-3 py-3 font-semibold text-slate-700">{getPersonById(note.authorId)?.fullName ?? "Authorized actor"}</td><td className="px-3 py-3 leading-5 text-slate-600">{note.note}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">HR Governance & Outcome</h4>
                            <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">Plan Status is workflow-controlled. Admin/HR cannot casually change it; outcome actions unlock only after the current Target End is reached and all required PIP-owner check-ins are complete.</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${selectedPipLifecycle === "Closed" ? "bg-emerald-100 text-emerald-700" : selectedPipLifecycle === "Outcome Review Due" ? "bg-violet-100 text-violet-700" : selectedPipLifecycle === "Extended" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{selectedPipLifecycle}</span>
                        </div>

                        {selectedPipClosed ? (
                          <div className="mt-4 overflow-hidden rounded-xl border border-emerald-100 bg-white">
                            <table className="w-full border-collapse text-left text-[11px]"><tbody>
                              <tr className="border-b border-slate-100"><th className="w-40 bg-emerald-50/60 px-3 py-2.5 text-[9px] font-bold uppercase text-emerald-700">Outcome</th><td className="px-3 py-2.5 font-semibold text-slate-700">{selectedPip.outcomeNotes ?? "Recorded"}</td></tr>
                              <tr className="border-b border-slate-100"><th className="bg-emerald-50/60 px-3 py-2.5 text-[9px] font-bold uppercase text-emerald-700">HR Governance Note</th><td className="px-3 py-2.5 leading-5 text-slate-600">{selectedPip.hrReviewNotes ?? "—"}</td></tr>
                              <tr><th className="bg-emerald-50/60 px-3 py-2.5 text-[9px] font-bold uppercase text-emerald-700">Closed Audit</th><td className="px-3 py-2.5 text-slate-600">{selectedPipClosureRecord ? `${selectedPipClosedBy?.fullName ?? "Authorized Admin/HR"} · ${new Date(selectedPipClosureRecord.createdAt).toLocaleString()}` : "Recorded in PIP history"}</td></tr>
                            </tbody></table>
                          </div>
                        ) : !selectedPipOutcomeDue ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-bold text-slate-700">Outcome review is not due yet.</p>
                            <p className="mt-1 text-[10px] leading-4 text-slate-500">Current Target End: <span className="font-semibold text-slate-700">{formatReviewDate(selectedPip.targetEndDate)}</span>. Until then, the PIP owner records check-ins and progress while Admin/HR monitors governance.</p>
                          </div>
                        ) : !selectedPipCheckInsComplete ? (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-[10px] font-bold text-amber-800">Outcome review is due, but required check-ins are incomplete.</p>
                            <p className="mt-1 text-[10px] leading-4 text-amber-700">The PIP owner must complete the remaining check-in records before Admin/HR can close or extend the plan.</p>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {pipGovernanceMode === null && (
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => { setPipGovernanceMode("close"); setPipOutcomeResult("Expectations Met"); setPipOutcomeNote(""); }} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[10px] font-bold text-white hover:bg-emerald-700">Close PIP</button>
                                <button type="button" onClick={() => { setPipGovernanceMode("extend"); setPipExtensionReason(""); setPipExtensionTargetDate(addDaysToIsoDate(pipToday, 30)); setPipExtensionCheckInDate(addDaysToIsoDate(pipToday, 14)); setPipExtensionCheckInTitle("Extension progress check-in"); }} className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-[10px] font-bold text-amber-800 hover:bg-amber-50">Extend Plan</button>
                              </div>
                            )}

                            {pipGovernanceMode === "close" && (
                              <div className="rounded-xl border border-emerald-200 bg-white p-4">
                                <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                                  <label className="text-[10px] font-semibold text-slate-600">Outcome *<SystemSelect value={pipOutcomeResult} onChange={(event) => setPipOutcomeResult(event.target.value as PipOutcomeResult)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"><option>Expectations Met</option><option>Partially Met</option><option>Expectations Not Met</option></SystemSelect></label>
                                  <label className="text-[10px] font-semibold text-slate-600">HR Governance Note *<textarea value={pipOutcomeNote} onChange={(event) => setPipOutcomeNote(event.target.value)} rows={3} placeholder="Document the evidence-based outcome and closure rationale" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" /></label>
                                </div>
                                <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setPipGovernanceMode(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600">Cancel</button><button type="button" disabled={backend.saving || !pipOutcomeNote.trim()} onClick={() => closePipWithOutcome(selectedPip.id)} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[10px] font-bold text-white disabled:opacity-50">{backend.saving ? "Saving..." : "Confirm Closure"}</button></div>
                              </div>
                            )}

                            {pipGovernanceMode === "extend" && (
                              <div className="rounded-xl border border-amber-200 bg-white p-4">
                                <label className="block text-[10px] font-semibold text-slate-600">Extension Reason *<textarea value={pipExtensionReason} onChange={(event) => setPipExtensionReason(event.target.value)} rows={2} placeholder="Explain why additional observation time is required" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" /></label>
                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                  <label className="text-[10px] font-semibold text-slate-600">New Target End *<input type="date" min={addDaysToIsoDate(pipToday, 14)} max={addDaysToIsoDate(pipToday, 60)} value={pipExtensionTargetDate} onChange={(event) => setPipExtensionTargetDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /><span className="mt-1 block text-[8px] font-normal text-slate-400">14–60 days after the extension decision and later than the current target.</span></label>
                                  <label className="text-[10px] font-semibold text-slate-600">Next Check-in *<input type="date" min={addDaysToIsoDate(pipToday, 7)} max={addDaysToIsoDate(pipToday, 14)} value={pipExtensionCheckInDate} onChange={(event) => setPipExtensionCheckInDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /><span className="mt-1 block text-[8px] font-normal text-slate-400">7–14 days after the extension decision.</span></label>
                                  <label className="text-[10px] font-semibold text-slate-600">Check-in Focus *<input value={pipExtensionCheckInTitle} onChange={(event) => setPipExtensionCheckInTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /></label>
                                </div>
                                <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setPipGovernanceMode(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600">Cancel</button><button type="button" disabled={backend.saving || !pipExtensionReason.trim() || !pipExtensionTargetDate || !pipExtensionCheckInDate || !pipExtensionCheckInTitle.trim()} onClick={() => extendPipWithGovernance(selectedPip.id)} className="rounded-lg bg-amber-500 px-3.5 py-2 text-[10px] font-bold text-slate-950 disabled:opacity-50">{backend.saving ? "Saving..." : "Confirm Extension"}</button></div>
                              </div>
                            )}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {pipSourcePickerOpen && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={() => setPipSourcePickerOpen(false)}>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Select finalized review for Performance Improvement Plan"
                  onMouseDown={(event) => event.stopPropagation()}
                  className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
                >
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Performance Improvement</p>
                      <h3 className="mt-1 text-base font-bold text-slate-900">Start from a Finalized Review</h3>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">
                        Choose the documented review basis first. Personnel, cycle, and the authorized PIP owner are resolved automatically.
                      </p>
                    </div>
                    <button type="button" onClick={() => setPipSourcePickerOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700" aria-label="Close finalized review selector">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-5">
                    {availableFinalizedPipReviews.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
                        <ClipboardList className="mx-auto h-7 w-7 text-slate-300" />
                        <p className="mt-2 text-xs font-semibold text-slate-600">No available finalized review</p>
                        <p className="mt-1 text-[10px] leading-4 text-slate-400">
                          Every finalized review in this cycle either already has a PIP or no finalized review is available yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableFinalizedPipReviews.slice(0, 10).map((review) => {
                          const person = getPersonById(review.personId);
                          const manager = resolvePipManager(review);
                          const signals = getPipReviewSignals(review);
                          return (
                            <div key={review.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-bold text-slate-800">{person?.fullName ?? "Unknown person"}</p>
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Finalized</span>
                                  {typeof review.rating === "number" && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">{review.rating.toFixed(2)} / 5</span>
                                  )}
                                </div>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  {person?.position ?? "—"} · {person?.department ?? "—"} · {periods.find((period) => period.id === review.periodId)?.cycleName ?? review.periodId}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {signals.length > 0 ? (
                                    signals.map((signal) => (
                                      <span key={signal} className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">{signal}</span>
                                    ))
                                  ) : (
                                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[9px] font-semibold text-slate-500">No automatic support signal · human-documented concern required</span>
                                  )}
                                </div>
                                <p className={`mt-2 text-[10px] font-semibold ${manager ? "text-slate-600" : "text-rose-700"}`}>
                                  PIP owner: {manager?.fullName ?? "No authorized manager resolved"}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={!manager}
                                onClick={() => openPipDraftForReview(review.id)}
                                className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3.5 py-2 text-[10px] font-bold transition ${manager ? "bg-[#121212] text-white hover:bg-black" : "cursor-not-allowed border border-rose-100 bg-rose-50 text-rose-400"}`}
                              >
                                {manager ? "Continue" : "Routing required"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {pipCreateOpen && pipDraftReview && pipDraftPerson && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4" onMouseDown={() => setPipCreateOpen(false)}>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Start Performance Improvement Plan"
                  onMouseDown={(event) => event.stopPropagation()}
                  className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
                >
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Performance Improvement</p>
                      <h3 className="mt-1 text-base font-bold text-slate-900">Start PIP</h3>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">
                        The performance basis and governance owner are already resolved. Define only the improvement, action, and timeline.
                      </p>
                    </div>
                    <button type="button" onClick={() => setPipCreateOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700" aria-label="Close PIP form">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4 p-5">
                    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Finalized Performance Basis</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{pipDraftPerson.fullName}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{pipDraftPerson.position} · {pipDraftPerson.department}</p>
                        </div>
                        <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:min-w-[520px]">
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[9px] font-bold uppercase text-slate-400">Review</p>
                            <p className="mt-1 text-[10px] font-semibold text-slate-700">{periods.find((period) => period.id === pipDraftReview.periodId)?.cycleName ?? pipDraftReview.periodId}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[9px] font-bold uppercase text-slate-400">Final Rating</p>
                            <p className="mt-1 text-[10px] font-semibold text-slate-700">{typeof pipDraftReview.rating === "number" ? `${pipDraftReview.rating.toFixed(2)} / 5` : "Not rated"}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[9px] font-bold uppercase text-slate-400">PIP Owner</p>
                            <p className={`mt-1 text-[10px] font-semibold ${pipDraftManager ? "text-slate-700" : "text-rose-700"}`}>{pipDraftManager?.fullName ?? "Routing required"}</p>
                          </div>
                        </div>
                      </div>
                      {pipDraftSignals.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-200 pt-3">
                          {pipDraftSignals.map((signal) => (
                            <span key={signal} className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700">{signal}</span>
                          ))}
                        </div>
                      )}
                    </section>

                    {!pipDraftManager && (
                      <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[10px] font-semibold leading-4 text-rose-700">
                        No authorized PIP owner is resolved from Data B / Review Governance. Correct the reporting or evaluator authority before starting this plan.
                      </div>
                    )}
                    {phase4Message && (
                      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-[10px] font-semibold leading-4 text-sky-800">
                        {phase4Message}
                      </div>
                    )}

                    <section className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-[10px] font-extrabold text-amber-700">1</span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Improvement</p>
                          <p className="text-[9px] text-slate-400">Validate the concern and define the observable result expected.</p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-[10px] font-bold text-slate-500">
                          Performance Concern <span className="text-rose-500">*</span>
                          <textarea rows={4} value={pipDraft.performanceConcern} onChange={(event) => setPipDraft({ ...pipDraft, performanceConcern: event.target.value })} placeholder="Document the validated performance concern" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal leading-5 text-slate-700" />
                        </label>
                        <label className="text-[10px] font-bold text-slate-500">
                          Expected Improvement <span className="text-rose-500">*</span>
                          <textarea rows={4} value={pipDraft.expectedImprovement} onChange={(event) => setPipDraft({ ...pipDraft, expectedImprovement: event.target.value })} placeholder="Define a specific and observable improvement" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal leading-5 text-slate-700" />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-[10px] font-extrabold text-amber-700">2</span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Action Plan</p>
                          <p className="text-[9px] text-slate-400">Set the first concrete action and optionally link development support.</p>
                        </div>
                      </div>
                      <label className="block text-[10px] font-bold text-slate-500">
                        Initial Action Item <span className="text-rose-500">*</span>
                        <input value={pipDraft.actionItem} onChange={(event) => setPipDraft({ ...pipDraft, actionItem: event.target.value })} placeholder="Specific action the employee and PIP owner will follow" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" />
                      </label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                        <label className="text-[10px] font-bold text-slate-500">
                          Development Source <span className="font-normal text-slate-400">(optional)</span>
                          <SystemSelect value={pipDraft.developmentActionSource} onChange={(event) => setPipDraft({ ...pipDraft, developmentActionSource: event.target.value as "Learning" | "Training" | "Competency" })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700">
                            <option>Learning</option><option>Training</option><option>Competency</option>
                          </SystemSelect>
                        </label>
                        <label className="text-[10px] font-bold text-slate-500">
                          Linked Development Action <span className="font-normal text-slate-400">(optional)</span>
                          <input value={pipDraft.developmentActionTitle} onChange={(event) => setPipDraft({ ...pipDraft, developmentActionTitle: event.target.value })} placeholder="Course, training, or competency action" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-[10px] font-extrabold text-amber-700">3</span>
                          <div>
                            <p className="text-xs font-bold text-slate-800">Timeline & Check-in</p>
                            <p className="text-[9px] text-slate-400">The PIP starts automatically when you confirm it. Target End must be 30–90 days later; the first check-in must be within 7–14 days.</p>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Starts automatically</p>
                          <p className="mt-0.5 text-[10px] font-semibold text-slate-700">{formatReviewDate(pipActualStartDate)}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="text-[10px] font-bold text-slate-500">
                          Target End <span className="text-rose-500">*</span>
                          <input type="date" min={pipMinimumTargetEndDate} max={pipMaximumTargetEndDate} value={pipDraft.targetEndDate} onChange={(event) => setPipDraft({ ...pipDraft, startDate: pipActualStartDate, targetEndDate: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" />
                          {pipDraft.targetEndDate && (pipDraft.targetEndDate < pipMinimumTargetEndDate || pipDraft.targetEndDate > pipMaximumTargetEndDate) ? (
                            <span className="mt-1 block text-[8px] font-semibold leading-3 text-rose-600">Target End must be 30–90 calendar days after the PIP starts.</span>
                          ) : (
                            <span className="mt-1 block text-[8px] font-normal leading-3 text-slate-400">Allowed: {formatReviewDate(pipMinimumTargetEndDate)} to {formatReviewDate(pipMaximumTargetEndDate)}.</span>
                          )}
                        </label>
                        <label className="text-[10px] font-bold text-slate-500">
                          First Check-in <span className="text-rose-500">*</span>
                          <input value={pipDraft.firstMilestone} onChange={(event) => setPipDraft({ ...pipDraft, firstMilestone: event.target.value })} placeholder="Initial progress check-in" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" />
                          <span className="mt-1 block text-[8px] font-normal leading-3 text-slate-400">State what the PIP owner will verify during the first progress review.</span>
                        </label>
                        <label className="text-[10px] font-bold text-slate-500">
                          Check-in Date <span className="text-rose-500">*</span>
                          <input type="date" min={pipMinimumCheckInDate} max={pipMaximumCheckInDate} value={pipDraft.firstMilestoneDate} onChange={(event) => setPipDraft({ ...pipDraft, startDate: pipActualStartDate, firstMilestoneDate: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" />
                          {pipDraft.firstMilestoneDate && (pipDraft.firstMilestoneDate < pipMinimumCheckInDate || pipDraft.firstMilestoneDate > pipMaximumCheckInDate || pipDraft.firstMilestoneDate >= pipDraft.targetEndDate) ? (
                            <span className="mt-1 block text-[8px] font-semibold leading-3 text-rose-600">First check-in must be 7–14 days after start and before Target End.</span>
                          ) : (
                            <span className="mt-1 block text-[8px] font-normal leading-3 text-slate-400">Allowed: {formatReviewDate(pipMinimumCheckInDate)} to {formatReviewDate(pipMaximumCheckInDate)}.</span>
                          )}
                        </label>
                      </div>
                      <p className="mt-3 text-[8px] leading-3 text-slate-400"><span className="font-bold text-rose-500">*</span> Required field</p>
                    </section>
                  </div>

                  <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-100 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[9px] leading-4 text-slate-400">
                      Starting a PIP records a formal improvement plan; it does not automate disciplinary or employment decisions.
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setPipCreateOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                      <button
                        type="button"
                        disabled={!pipDraftReady || !pipDraftManager || backend.saving}
                        onClick={() => void addPip()}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${pipDraftReady && pipDraftManager && !backend.saving ? "bg-[#121212] text-white hover:bg-black" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}
                      >
                        {backend.saving ? "Saving..." : "Start PIP"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}

function PerformanceAnalyticsChartCard({
  title,
  description,
  children,
  chartHeight = 240,
  reorder,
  expandedControls,
  chartContainerClassName,
}: {
  title: string;
  description: string;
  children: ReactNode;
  chartHeight?: number;
  reorder: {
    id: PerformanceAnalyticsChartId;
    order: number;
    isDragging: boolean;
    isTarget: boolean;
    onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
    onDragEnter: () => void;
    onDrop: () => void;
    onDragEnd: () => void;
  };
  expandedControls?: ReactNode;
  chartContainerClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  return (
    <>
      <section
        data-performance-analytics-card={reorder.id}
        className={`flex h-full min-w-0 flex-col rounded-xl border bg-white p-4 shadow-sm transition ${
          reorder.isDragging
            ? "scale-[0.99] border-amber-300 opacity-55"
            : reorder.isTarget
              ? "border-amber-400 ring-2 ring-amber-200/70"
              : "border-slate-200"
        }`}
        style={{ order: reorder.order }}
        onDragEnter={(event) => {
          event.preventDefault();
          reorder.onDragEnter();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          reorder.onDrop();
        }}
      >
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            draggable
            aria-label={`Move ${title}`}
            title="Drag this analytics chart"
            onClick={(event) => event.stopPropagation()}
            onDragStart={reorder.onDragStart}
            onDragEnd={reorder.onDragEnd}
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-300 transition hover:bg-amber-50 hover:text-amber-600 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
            aria-label={`Expand ${title}`}
            title="View chart full size"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 block min-w-0 cursor-zoom-in rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          style={{ height: chartHeight }}
          aria-label={`View ${title} full size`}
        >
          <div className={`h-full w-full ${chartContainerClassName ?? ""}`.trim()}>{children}</div>
        </button>
      </section>

      {expanded && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExpanded(false);
          }}
        >
          <section className="flex h-[min(88vh,860px)] w-[min(95vw,1360px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close full chart"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {expandedControls && (
              <div className="border-b border-slate-100 px-5 py-3">
                {expandedControls}
              </div>
            )}
            <div className="min-h-0 flex-1 p-5">
              <div className={`h-full min-h-[420px] w-full ${chartContainerClassName ?? ""}`.trim()}>{children}</div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function PerformanceAnalyticsEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg bg-slate-50/70 px-5 text-center">
      <div>
        <BarChart3 className="mx-auto h-5 w-5 text-slate-300" />
        <p className="mt-2 text-xs font-semibold text-slate-500">{message}</p>
        <p className="mt-1 text-[10px] leading-4 text-slate-400">Adjust the shared filters or choose a different date range.</p>
      </div>
    </div>
  );
}

function PerformanceAnalyticsDonut({
  data,
  totalLabel,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  totalLabel: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[minmax(220px,0.92fr)_minmax(0,1.08fr)] lg:items-center">
      <div className="relative min-h-[190px] min-w-0 lg:h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="76%"
              paddingAngle={2}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [value, "Reviews"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-extrabold tabular-nums text-slate-900">{total}</p>
            <p className="max-w-[96px] text-[10px] font-semibold leading-4 text-slate-400">{totalLabel}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-2 pr-1">
        {data.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.name} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1 text-xs font-semibold text-slate-600">{item.name}</span>
              <span className="shrink-0 text-right">
                <span className="block text-xs font-extrabold tabular-nums text-slate-800">{item.value}</span>
                <span className="block text-[10px] font-semibold tabular-nums text-slate-400">{percentage}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
