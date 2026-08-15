import PageHeader from "@/Components/PageHeader";
import {
  canEvaluate,
  type EvaluatorAssignment,
} from "@/data/evaluatorAssignments";
import {
  canViewFeedbackRecord,
  getTraineeJourneyProgress,
  TRAINEE_JOURNEY_STAGES,
  type FeedbackRecordType,
  type FeedbackVisibility,
  type PerformanceDevelopmentStore,
} from "@/data/performanceDevelopment";
import { usePerformanceBackendBridge } from "@/data/performanceBackend";
import {
  DEFAULT_RATING_SCALE,
  type GoalTemplate,
  type PerformanceCycle,
  type PerformanceGoal,
  type ReviewTemplate,
} from "@/data/performancePlanning";
import {
  SHARED_PERSONNEL,
  colorForId,
  getPersonById,
  initialsFor,
  type PersonnelIdentity,
} from "@/data/personnel";
import {
  DEVELOPMENT_RECOMMENDATION_OPTIONS,
  calculateWeightedReviewRating,
  getDisplayStatus,
  getReviewWorkflowState,
  type CompetencyScore,
  type EvaluationStatus,
  type PerformanceReview,
  type SelfEvaluation,
} from "@/data/performanceReviews";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage } from "@inertiajs/react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  MessageSquareText,
  Eye,
  Save,
  Target,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type WorkspaceTab = "My Performance" | "My Team Reviews";
type TeamStatusFilter = "All" | EvaluationStatus;

type AuthUserShape = {
  id?: string | number;
  name?: string;
  email?: string;
  personnel_key?: string | null;
};

type ManagerReviewDraft = {
  scores: Record<string, number>;
  comments: string;
  recommendations: string[];
  otherRecommendation: string;
};

type SelfEvaluationDraft = {
  accomplishments: string;
  goalProgress: string;
  challenges: string;
  comments: string;
  selfRating: number | "";
};

function resolveCurrentPerson(
  user: AuthUserShape,
): PersonnelIdentity | undefined {
  const authId = user.id === undefined ? "" : String(user.id);
  const normalizedEmail = user.email?.trim().toLowerCase();
  const normalizedName = user.name?.trim().toLowerCase();
  return SHARED_PERSONNEL.find(
    (person) =>
      person.id === user.personnel_key ||
      person.id === authId ||
      person.corePersonId === authId ||
      person.email.toLowerCase() === normalizedEmail ||
      person.fullName.toLowerCase() === normalizedName,
  );
}

function getCycle(
  review: PerformanceReview,
  cycles: PerformanceCycle[],
): PerformanceCycle | undefined {
  return cycles.find((cycle) => cycle.id === review.periodId);
}

function getTemplate(
  review: PerformanceReview,
  person: PersonnelIdentity,
  cycles: PerformanceCycle[],
  templates: ReviewTemplate[],
): ReviewTemplate | undefined {
  const cycle = getCycle(review, cycles);
  const templateId =
    review.reviewTemplateId ?? cycle?.reviewTemplateIds[person.personType];
  return templates.find(
    (template) =>
      template.id === templateId && template.personType === person.personType,
  );
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(status: EvaluationStatus): string {
  if (status === "Completed") return "bg-emerald-50 text-emerald-700";
  if (status === "In Progress") return "bg-sky-50 text-sky-700";
  if (status === "Overdue") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

function StatusBadge({ review }: { review: PerformanceReview }) {
  const status = getDisplayStatus(review);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(status)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: typeof ClipboardCheck;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: PerformanceGoal }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {goal.metricType}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              {goal.weight}% weight
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold text-slate-900">
            {goal.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Target: {goal.target}
            {goal.unit ? ` ${goal.unit}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
          {goal.status}
        </span>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <span>Progress</span>
          <span>{goal.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#F4B400]"
            style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SupportingEvidence({ review }: { review: PerformanceReview }) {
  const grouped = {
    Competency:
      review.linkedEvidence?.filter((item) => item.source === "Competency") ??
      [],
    Learning:
      review.linkedEvidence?.filter((item) => item.source === "Learning") ?? [],
    Training:
      review.linkedEvidence?.filter((item) => item.source === "Training") ?? [],
  };
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {Object.entries(grouped).map(([source, items]) => (
        <div
          key={source}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex items-center gap-2">
            {source === "Competency" ? (
              <ClipboardCheck className="h-4 w-4 text-violet-600" />
            ) : source === "Learning" ? (
              <BookOpen className="h-4 w-4 text-sky-600" />
            ) : (
              <GraduationCap className="h-4 w-4 text-emerald-600" />
            )}
            <p className="text-xs font-bold text-slate-800">{source}</p>
          </div>
          {items.length > 0 ? (
            <div className="mt-3 space-y-2">
              {items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="text-[11px]">
                  <p className="font-semibold text-slate-700">{item.title}</p>
                  <p className="text-slate-400">
                    {formatDate(item.dateCompleted)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              No linked {source.toLowerCase()} evidence is available. This does
              not block or reduce the review score.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function SelfEvaluationModal({
  review,
  cycle,
  onClose,
  onSave,
}: {
  review: PerformanceReview;
  cycle: PerformanceCycle;
  onClose: () => void;
  onSave: (draft: SelfEvaluationDraft, submit: boolean) => void;
}) {
  const existing = review.selfEvaluation;
  const [draft, setDraft] = useState<SelfEvaluationDraft>({
    accomplishments: existing?.accomplishments ?? "",
    goalProgress: existing?.goalProgress ?? "",
    challenges: existing?.challenges ?? "",
    comments: existing?.comments ?? "",
    selfRating: existing?.selfRating ?? "",
  });
  const [error, setError] = useState("");

  function submitSelfEvaluation() {
    if (!draft.accomplishments.trim() && !draft.comments.trim()) {
      setError(
        "Add at least your accomplishments or reflection comments before submitting.",
      );
      return;
    }
    onSave(draft, true);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              Optional Self-Evaluation
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {cycle.cycleName}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              This reflection provides context. It is separate from the
              manager's official rating.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close self-evaluation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {[
            [
              "accomplishments",
              "Accomplishments",
              "Describe meaningful results or contributions during the cycle.",
            ],
            [
              "goalProgress",
              "Goal Progress",
              "Reflect on your goals, KPIs, or KRAs.",
            ],
            [
              "challenges",
              "Challenges / Context",
              "Share relevant challenges and context for your manager.",
            ],
            [
              "comments",
              "Additional Comments",
              "Add anything else that supports a fair discussion.",
            ],
          ].map(([key, label, placeholder]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                {label}
              </span>
              <textarea
                value={
                  draft[
                    key as keyof Omit<SelfEvaluationDraft, "selfRating">
                  ] as string
                }
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    [key]: event.target.value,
                  }))
                }
                rows={3}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </label>
          ))}
          {cycle.selfRatingEnabled && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                Optional Self-Rating
              </span>
              <select
                value={draft.selfRating}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    selfRating: event.target.value
                      ? Number(event.target.value)
                      : "",
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                <option value="">No self-rating selected</option>
                {DEFAULT_RATING_SCALE.levels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.value} — {level.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft, false)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800"
          >
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button
            type="button"
            onClick={submitSelfEvaluation}
            className="rounded-xl bg-[#121212] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Submit Reflection
          </button>
        </div>
      </div>
    </div>
  );
}

function ManagerReviewModal({
  review,
  person,
  cycle,
  template,
  goals,
  feedbackRecords,
  relatedPips,
  onClose,
  onSave,
  onAddFeedback,
}: {
  review: PerformanceReview;
  person: PersonnelIdentity;
  cycle: PerformanceCycle;
  template: ReviewTemplate;
  goals: PerformanceGoal[];
  feedbackRecords: PerformanceDevelopmentStore["feedbackRecords"];
  relatedPips: PerformanceDevelopmentStore["pips"];
  onClose: () => void;
  onSave: (draft: ManagerReviewDraft, submit: boolean) => void;
  onAddFeedback: (draft: {
    recordType: FeedbackRecordType;
    note: string;
    coachingAction: string;
    followUpDate: string;
    visibility: FeedbackVisibility;
  }) => void;
}) {
  const existingScores = Object.fromEntries(
    (review.competencyScores ?? []).map((score) => [score.name, score.score]),
  );
  const knownRecommendations =
    review.developmentRecommendations?.filter((item) =>
      DEVELOPMENT_RECOMMENDATION_OPTIONS.includes(
        item as (typeof DEVELOPMENT_RECOMMENDATION_OPTIONS)[number],
      ),
    ) ?? [];
  const customRecommendation = review.developmentRecommendations?.find(
    (item) =>
      !DEVELOPMENT_RECOMMENDATION_OPTIONS.includes(
        item as (typeof DEVELOPMENT_RECOMMENDATION_OPTIONS)[number],
      ),
  );
  const [draft, setDraft] = useState<ManagerReviewDraft>({
    scores: existingScores,
    comments: review.comments ?? "",
    recommendations: knownRecommendations,
    otherRecommendation: customRecommendation ?? "",
  });
  const [error, setError] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState<{
    recordType: FeedbackRecordType;
    note: string;
    coachingAction: string;
    followUpDate: string;
    visibility: FeedbackVisibility;
  }>({
    recordType: "1:1 Check-in",
    note: "",
    coachingAction: "",
    followUpDate: "",
    visibility: "Employee & Manager",
  });
  const workflowState = getReviewWorkflowState(
    review,
    cycle.calibrationRequired,
  );
  const isReadOnly =
    review.status === "Completed" ||
    workflowState === "Calibration Pending" ||
    workflowState === "Calibration In Review";
  const previewScores: CompetencyScore[] = template.criteria
    .map((criterion) => ({
      name: criterion.name,
      score: draft.scores[criterion.name] ?? 0,
    }))
    .filter((score) => score.score > 0);
  const previewRating = calculateWeightedReviewRating(
    previewScores,
    template.criteria,
  );

  function toggleRecommendation(recommendation: string) {
    setDraft((previous) => ({
      ...previous,
      recommendations: previous.recommendations.includes(recommendation)
        ? previous.recommendations.filter((item) => item !== recommendation)
        : [...previous.recommendations, recommendation],
    }));
  }

  function submitManagerReview() {
    if (template.criteria.some((criterion) => !draft.scores[criterion.name])) {
      setError(
        "Rate every applicable criterion before submitting the formal review.",
      );
      return;
    }
    onSave(draft, true);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[#121212] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: colorForId(person.id) }}
              >
                {initialsFor(person.fullName)}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#F4B400]">
                  Assigned Formal Review
                </p>
                <h2 className="mt-0.5 text-lg font-bold">{person.fullName}</h2>
                <p className="text-xs text-white/60">
                  {person.position} · {person.department} · {person.personType}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close manager review"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Cycle
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-800">
                {cycle.cycleName}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Template
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-800">
                {template.name}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Due
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-800">
                {formatDate(review.dueDate ?? cycle.reviewDueDate)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge review={review} />
              </div>
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Goals / KPIs / KRAs
              </h3>
            </div>
            {goals.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
                No cycle goals are linked to this person. The manager review can
                continue without inventing goal results.
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Feedback &amp; Coaching Context
              </h3>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
              <div className="space-y-2">
                {feedbackRecords.length ? (
                  feedbackRecords.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-800">
                          {record.recordType}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(record.createdAt)}
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
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
                    No documented check-in or coaching record is linked yet.
                  </p>
                )}
                {relatedPips.map((pip) => (
                  <div
                    key={pip.id}
                    className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs"
                  >
                    <p className="font-bold text-amber-900">
                      Performance Improvement Plan · {pip.status}
                    </p>
                    <p className="mt-1 text-amber-800">
                      {pip.expectedImprovement}
                    </p>
                  </div>
                ))}
              </div>
              {!isReadOnly && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold text-slate-800">
                    Document a Check-in
                  </p>
                  <select
                    value={feedbackDraft.recordType}
                    onChange={(event) =>
                      setFeedbackDraft({
                        ...feedbackDraft,
                        recordType: event.target.value as FeedbackRecordType,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                  >
                    <option>1:1 Check-in</option>
                    <option>Feedback Note</option>
                    <option>Coaching Action</option>
                  </select>
                  <textarea
                    rows={3}
                    value={feedbackDraft.note}
                    onChange={(event) =>
                      setFeedbackDraft({
                        ...feedbackDraft,
                        note: event.target.value,
                      })
                    }
                    placeholder="Work-related note"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                  />
                  <input
                    value={feedbackDraft.coachingAction}
                    onChange={(event) =>
                      setFeedbackDraft({
                        ...feedbackDraft,
                        coachingAction: event.target.value,
                      })
                    }
                    placeholder="Coaching action (optional)"
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={feedbackDraft.followUpDate}
                      onChange={(event) =>
                        setFeedbackDraft({
                          ...feedbackDraft,
                          followUpDate: event.target.value,
                        })
                      }
                      className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                    />
                    <select
                      value={feedbackDraft.visibility}
                      onChange={(event) =>
                        setFeedbackDraft({
                          ...feedbackDraft,
                          visibility: event.target.value as FeedbackVisibility,
                        })
                      }
                      className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                    >
                      <option>Employee &amp; Manager</option>
                      <option>Manager &amp; HR</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!feedbackDraft.note.trim()}
                    onClick={() => {
                      onAddFeedback(feedbackDraft);
                      setFeedbackDraft({
                        recordType: "1:1 Check-in",
                        note: "",
                        coachingAction: "",
                        followUpDate: "",
                        visibility: "Employee & Manager",
                      });
                    }}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Save Check-in
                  </button>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Optional Self-Evaluation
              </h3>
            </div>
            {review.selfEvaluation?.status === "Submitted" ? (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs md:grid-cols-2">
                <div>
                  <p className="font-bold text-slate-700">Accomplishments</p>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    {review.selfEvaluation.accomplishments || "Not provided."}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">Goal Progress</p>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    {review.selfEvaluation.goalProgress || "Not provided."}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">
                    Challenges / Context
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    {review.selfEvaluation.challenges || "Not provided."}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-700">
                    Additional Comments
                  </p>
                  <p className="mt-1 leading-relaxed text-slate-500">
                    {review.selfEvaluation.comments || "Not provided."}
                  </p>
                </div>
                <div className="md:col-span-2 text-slate-400">
                  Status: {review.selfEvaluation.status}
                  {review.selfEvaluation.selfRating !== undefined
                    ? ` · Self-rating: ${review.selfEvaluation.selfRating} / 5`
                    : ""}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
                {cycle.selfEvaluationEnabled
                  ? "The employee has not submitted a self-evaluation. Draft reflections remain private and do not block the manager review."
                  : "Self-evaluation is disabled for this cycle."}
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Formal Rating Criteria
                </h3>
              </div>
              <p className="text-xs font-bold text-slate-700">
                Weighted result:{" "}
                {previewRating === null
                  ? "Complete all ratings"
                  : `${previewRating.toFixed(2)} / 5`}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {template.criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className="grid gap-3 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[1fr_15rem] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">
                        {criterion.name}
                      </p>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                        {criterion.weight}%
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {criterion.description}
                    </p>
                  </div>
                  <select
                    disabled={isReadOnly}
                    value={draft.scores[criterion.name] ?? ""}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        scores: {
                          ...previous.scores,
                          [criterion.name]: Number(event.target.value),
                        },
                      }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
                  >
                    <option value="">Select rating</option>
                    {DEFAULT_RATING_SCALE.levels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.value} — {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Authorized Supporting Evidence
              </h3>
            </div>
            <SupportingEvidence review={review} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                Evaluator Comments
              </span>
              <textarea
                disabled={isReadOnly}
                rows={5}
                value={draft.comments}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    comments: event.target.value,
                  }))
                }
                placeholder="Document balanced, work-related observations and context."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100"
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-700">
                Development Recommendations
              </p>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                {DEVELOPMENT_RECOMMENDATION_OPTIONS.map((recommendation) => (
                  <label
                    key={recommendation}
                    className="flex items-center gap-2 text-xs text-slate-700"
                  >
                    <input
                      disabled={isReadOnly}
                      type="checkbox"
                      checked={draft.recommendations.includes(recommendation)}
                      onChange={() => toggleRecommendation(recommendation)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                    {recommendation}
                  </label>
                ))}
                {draft.recommendations.includes("Other") && (
                  <input
                    disabled={isReadOnly}
                    value={draft.otherRecommendation}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        otherRecommendation: event.target.value,
                      }))
                    }
                    placeholder="Describe the other development action"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-400"
                  />
                )}
              </div>
            </div>
          </section>
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Close
          </button>
          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => onSave(draft, false)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
              >
                <Save className="h-4 w-4" /> Save Draft
              </button>
              <button
                type="button"
                onClick={submitManagerReview}
                className="rounded-xl bg-[#121212] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Submit Formal Review
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonalReviewCard({
  review,
  cycle,
  onSelfEvaluate,
  onAcknowledge,
}: {
  review: PerformanceReview;
  cycle?: PerformanceCycle;
  onSelfEvaluate: () => void;
  onAcknowledge: () => void;
}) {
  const evaluator = getPersonById(review.evaluatorId);
  const selfAvailable =
    cycle?.selfEvaluationEnabled && review.status !== "Completed";
  const workflowState = getReviewWorkflowState(
    review,
    cycle?.calibrationRequired,
  );
  const acknowledgmentAvailable =
    review.status === "Completed" &&
    cycle?.employeeAcknowledgment !== "Not Required" &&
    !review.acknowledgment;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {cycle?.cycleType ?? "Performance"} Review
          </p>
          <h3 className="mt-1 text-sm font-bold text-slate-900">
            {cycle?.cycleName ?? "Unknown cycle"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Evaluator: {evaluator?.fullName ?? "Assigned evaluator"} ·{" "}
            {workflowState}
          </p>
        </div>
        <StatusBadge review={review} />
      </div>
      {review.status === "Completed" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Final Rating
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {review.rating?.toFixed(2) ?? "—"} / 5
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Manager Comments
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {review.comments || "No comments recorded."}
            </p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Development Recommendations
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {review.developmentRecommendations?.length
                ? review.developmentRecommendations.join(" · ")
                : "No immediate development action recorded."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:col-span-3">
            <p className="text-[11px] text-slate-500">
              {review.acknowledgment
                ? `Received / Viewed on ${formatDate(review.acknowledgment.timestamp)}. This does not mean agreement with every rating.`
                : cycle?.employeeAcknowledgment === "Required"
                  ? "Acknowledgment is required to record that you received/viewed the finalized review."
                  : "Acknowledgment is optional and records receipt/viewing only."}
            </p>
            {acknowledgmentAvailable && (
              <button
                type="button"
                onClick={onAcknowledge}
                className="rounded-xl bg-[#121212] px-4 py-2.5 text-xs font-semibold text-white"
              >
                Acknowledge Received / Viewed
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Due {formatDate(review.dueDate ?? cycle?.reviewDueDate)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Your manager's formal review remains separate from your
              reflection.
            </p>
          </div>
          {selfAvailable && (
            <button
              type="button"
              onClick={onSelfEvaluate}
              className="rounded-xl bg-[#121212] px-4 py-2.5 text-xs font-semibold text-white"
            >
              {review.selfEvaluation
                ? "Update Self-Evaluation"
                : "Start Self-Evaluation"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserPerformance() {
  const authUser = usePage().props.auth.user as AuthUserShape;
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [developmentStore, setDevelopmentStore] =
    useState<PerformanceDevelopmentStore>(
      { feedbackRecords: [], pips: [], traineeJourneys: [] },
    );
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [assignments, setAssignments] = useState<EvaluatorAssignment[]>([]);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [reviewTemplates, setReviewTemplates] = useState<ReviewTemplate[]>([]);
  const [workspaceTab, setWorkspaceTab] =
    useState<WorkspaceTab>("My Performance");
  const [teamStatusFilter, setTeamStatusFilter] =
    useState<TeamStatusFilter>("All");
  const [selectedTeamReviewId, setSelectedTeamReviewId] = useState<
    string | null
  >(null);
  const [selectedSelfReviewId, setSelectedSelfReviewId] = useState<
    string | null
  >(null);
  const [actionMessage, setActionMessage] = useState("");
  const backend = usePerformanceBackendBridge({
    reviews,
    setReviews,
    development: developmentStore,
    setDevelopment: setDevelopmentStore,
    cycles,
    setCycles,
    assignments,
    setAssignments,
    goalTemplates,
    setGoalTemplates,
    goals,
    setGoals,
    reviewTemplates,
    setReviewTemplates,
  });
  const currentPerson = useMemo(
    () =>
      resolveCurrentPerson({
        ...authUser,
        personnel_key:
          backend.actor?.personnelKey ?? authUser.personnel_key ?? null,
      }),
    [authUser, backend.actor?.personnelKey, backend.ready],
  );

  const myReviews = useMemo(
    () =>
      currentPerson
        ? reviews.filter((review) => review.personId === currentPerson.id)
        : [],
    [currentPerson, reviews],
  );

  const myGoals = useMemo(
    () =>
      currentPerson
        ? goals.filter((goal) => goal.personId === currentPerson.id)
        : [],
    [currentPerson, goals],
  );

  const myFeedback = useMemo(
    () =>
      currentPerson
        ? developmentStore.feedbackRecords.filter((record) =>
            canViewFeedbackRecord(record, currentPerson, false),
          )
        : [],
    [currentPerson, developmentStore.feedbackRecords],
  );

  const myPips = useMemo(
    () =>
      currentPerson
        ? developmentStore.pips.filter(
            (pip) => pip.personId === currentPerson.id,
          )
        : [],
    [currentPerson, developmentStore.pips],
  );

  const myTraineeJourney = useMemo(
    () =>
      currentPerson?.personType === "Trainee"
        ? developmentStore.traineeJourneys.find(
            (journey) => journey.traineeId === currentPerson.id,
          )
        : undefined,
    [currentPerson, developmentStore.traineeJourneys],
  );

  const teamReviews = useMemo(() => {
    if (!currentPerson) return [];
    return reviews.filter(
      (review) =>
        review.evaluatorId === currentPerson.id &&
        canEvaluate(currentPerson.id, review.personId, {
          periodId: review.periodId,
          periods: cycles,
          assignments,
          requireActivePeriod: false,
        }),
    );
  }, [assignments, currentPerson, cycles, reviews]);

  const hasEvaluatorCapability = useMemo(
    () =>
      !!currentPerson &&
      assignments.some(
        (assignment) =>
          assignment.evaluatorId === currentPerson.id &&
          assignment.isPrimaryEvaluator,
      ),
    [assignments, currentPerson],
  );

  const filteredTeamReviews = useMemo(
    () =>
      teamReviews.filter(
        (review) =>
          teamStatusFilter === "All" ||
          getDisplayStatus(review) === teamStatusFilter,
      ),
    [teamReviews, teamStatusFilter],
  );

  const teamCounts = useMemo(
    () => ({
      assigned: teamReviews.length,
      pending: teamReviews.filter(
        (review) => getDisplayStatus(review) === "Pending",
      ).length,
      inProgress: teamReviews.filter(
        (review) => getDisplayStatus(review) === "In Progress",
      ).length,
      completed: teamReviews.filter(
        (review) => getDisplayStatus(review) === "Completed",
      ).length,
      overdue: teamReviews.filter(
        (review) => getDisplayStatus(review) === "Overdue",
      ).length,
    }),
    [teamReviews],
  );

  const selectedTeamReview = selectedTeamReviewId
    ? teamReviews.find((review) => review.id === selectedTeamReviewId)
    : undefined;
  const selectedTeamPerson = selectedTeamReview
    ? getPersonById(selectedTeamReview.personId)
    : undefined;
  const selectedTeamCycle = selectedTeamReview
    ? getCycle(selectedTeamReview, cycles)
    : undefined;
  const selectedTeamTemplate =
    selectedTeamReview && selectedTeamPerson
      ? getTemplate(
          selectedTeamReview,
          selectedTeamPerson,
          cycles,
          reviewTemplates,
        )
      : undefined;
  const selectedTeamGoals = selectedTeamReview
    ? goals.filter(
        (goal) =>
          goal.personId === selectedTeamReview.personId &&
          goal.cycleId === selectedTeamReview.periodId,
      )
    : [];
  const selectedTeamFeedback =
    selectedTeamReview && currentPerson
      ? developmentStore.feedbackRecords.filter(
          (record) =>
            record.personId === selectedTeamReview.personId &&
            (record.relatedReviewId === selectedTeamReview.id ||
              record.cycleId === selectedTeamReview.periodId) &&
            canViewFeedbackRecord(record, currentPerson, true),
        )
      : [];
  const selectedTeamPips = selectedTeamReview
    ? developmentStore.pips.filter(
        (pip) =>
          pip.personId === selectedTeamReview.personId &&
          (pip.relatedReviewId === selectedTeamReview.id ||
            pip.assignedManagerId === currentPerson?.id),
      )
    : [];

  const selectedSelfReview = selectedSelfReviewId
    ? myReviews.find((review) => review.id === selectedSelfReviewId)
    : undefined;
  const selectedSelfCycle = selectedSelfReview
    ? getCycle(selectedSelfReview, cycles)
    : undefined;

  function openTeamReview(review: PerformanceReview) {
    if (
      !currentPerson ||
      review.evaluatorId !== currentPerson.id ||
      !canEvaluate(currentPerson.id, review.personId, {
        periodId: review.periodId,
        periods: cycles,
        assignments,
        requireActivePeriod: false,
      })
    ) {
      setActionMessage(
        "This review is outside your authorized evaluator scope.",
      );
      return;
    }
    setActionMessage("");
    setSelectedTeamReviewId(review.id);
  }

  function saveManagerReview(draft: ManagerReviewDraft, submit: boolean) {
    if (
      !currentPerson ||
      !selectedTeamReview ||
      !selectedTeamPerson ||
      !selectedTeamTemplate
    )
      return;
    if (
      selectedTeamReview.status === "Completed" ||
      selectedTeamReview.calibrationStatus === "Pending" ||
      selectedTeamReview.calibrationStatus === "In Review" ||
      selectedTeamReview.evaluatorId !== currentPerson.id ||
      !canEvaluate(currentPerson.id, selectedTeamPerson.id, {
        periodId: selectedTeamReview.periodId,
        periods: cycles,
        assignments,
        requireActivePeriod: false,
      })
    ) {
      setSelectedTeamReviewId(null);
      setActionMessage(
        "The review could not be updated because your evaluator authority or its state changed.",
      );
      return;
    }
    const scores = selectedTeamTemplate.criteria
      .map((criterion) => ({
        name: criterion.name,
        score: draft.scores[criterion.name] ?? 0,
      }))
      .filter((score) => score.score > 0);
    const weightedRating = submit
      ? calculateWeightedReviewRating(scores, selectedTeamTemplate.criteria)
      : null;
    if (submit && weightedRating === null) return;
    const recommendations = [
      ...draft.recommendations.filter((item) => item !== "Other"),
      ...(draft.recommendations.includes("Other") &&
      draft.otherRecommendation.trim()
        ? [draft.otherRecommendation.trim()]
        : []),
    ];
    const timestamp = new Date().toISOString();
    const cycle = getCycle(selectedTeamReview, cycles);
    const requiresCalibration = submit && !!cycle?.calibrationRequired;
    setReviews((previous) =>
      previous.map((review) =>
        review.id === selectedTeamReview.id
          ? {
              ...review,
              reviewTemplateId: selectedTeamTemplate.id,
              competencyScores: scores,
              comments: draft.comments.trim() || undefined,
              developmentRecommendations: recommendations,
              rating: submit ? weightedRating : review.rating,
              status:
                submit && !requiresCalibration ? "Completed" : "In Progress",
              dateEvaluated:
                submit && !requiresCalibration
                  ? todayLabel()
                  : review.dateEvaluated,
              managerSubmittedAt: submit
                ? timestamp
                : review.managerSubmittedAt,
              finalizedAt:
                submit && !requiresCalibration ? timestamp : undefined,
              workflowState: submit
                ? requiresCalibration
                  ? "Calibration Pending"
                  : "Finalized"
                : review.workflowState === "Revision In Progress"
                  ? "Revision In Progress"
                  : "Manager Review",
              calibrationStatus: submit
                ? requiresCalibration
                  ? "Pending"
                  : "Not Required"
                : review.calibrationStatus,
              calibrationHistory: requiresCalibration
                ? [
                    ...(review.calibrationHistory ?? []),
                    {
                      action: "Submitted" as const,
                      actor: currentPerson.fullName,
                      timestamp,
                      notes:
                        "Manager review submitted for required calibration.",
                    },
                  ]
                : review.calibrationHistory,
            }
          : review,
      ),
    );
    setSelectedTeamReviewId(null);
    setActionMessage(
      submit
        ? requiresCalibration
          ? "Formal review submitted for required calibration. It is not finalized yet."
          : "Formal review submitted and finalized successfully."
        : "Review draft saved.",
    );
  }

  function saveSelfEvaluation(draft: SelfEvaluationDraft, submit: boolean) {
    if (!currentPerson || !selectedSelfReview || !selectedSelfCycle) return;
    if (
      selectedSelfReview.personId !== currentPerson.id ||
      selectedSelfReview.status === "Completed" ||
      !selectedSelfCycle.selfEvaluationEnabled
    ) {
      setSelectedSelfReviewId(null);
      setActionMessage("This self-evaluation task is no longer available.");
      return;
    }
    const timestamp = new Date().toISOString();
    const selfEvaluation: SelfEvaluation = {
      accomplishments: draft.accomplishments.trim(),
      goalProgress: draft.goalProgress.trim(),
      challenges: draft.challenges.trim(),
      comments: draft.comments.trim(),
      ...(selectedSelfCycle.selfRatingEnabled && draft.selfRating !== ""
        ? { selfRating: draft.selfRating }
        : {}),
      status: submit ? "Submitted" : "Draft",
      submittedAt: submit
        ? timestamp
        : selectedSelfReview.selfEvaluation?.submittedAt,
      updatedAt: timestamp,
    };
    setReviews((previous) =>
      previous.map((review) =>
        review.id === selectedSelfReview.id
          ? { ...review, selfEvaluation }
          : review,
      ),
    );
    setSelectedSelfReviewId(null);
    setActionMessage(
      submit
        ? "Self-evaluation submitted as supporting context."
        : "Self-evaluation draft saved.",
    );
  }

  function acknowledgeReview(reviewId: string) {
    if (!currentPerson) return;
    const target = reviews.find((review) => review.id === reviewId);
    const cycle = target ? getCycle(target, cycles) : undefined;
    if (
      !target ||
      target.personId !== currentPerson.id ||
      target.status !== "Completed" ||
      cycle?.employeeAcknowledgment === "Not Required" ||
      target.acknowledgment
    ) {
      setActionMessage(
        "This finalized review is not currently available for acknowledgment.",
      );
      return;
    }
    setReviews((previous) =>
      previous.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              acknowledgment: {
                status: "Acknowledged" as const,
                actorId: currentPerson.id,
                timestamp: new Date().toISOString(),
                statement: "Received / Viewed" as const,
              },
            }
          : review,
      ),
    );
    setActionMessage(
      "Review acknowledged as received/viewed. This does not record agreement with every rating.",
    );
  }

  function addTeamFeedback(draft: {
    recordType: FeedbackRecordType;
    note: string;
    coachingAction: string;
    followUpDate: string;
    visibility: FeedbackVisibility;
  }) {
    if (!currentPerson || !selectedTeamReview || !draft.note.trim()) return;
    if (
      selectedTeamReview.evaluatorId !== currentPerson.id ||
      !canEvaluate(currentPerson.id, selectedTeamReview.personId, {
        periodId: selectedTeamReview.periodId,
        periods: cycles,
        assignments,
        requireActivePeriod: false,
      })
    ) {
      setSelectedTeamReviewId(null);
      setActionMessage(
        "The coaching note was not saved because evaluator authority changed.",
      );
      return;
    }
    const timestamp = new Date().toISOString();
    setDevelopmentStore((previous) => ({
      ...previous,
      feedbackRecords: [
        {
          id: `feedback-${Date.now()}`,
          personId: selectedTeamReview.personId,
          authorId: currentPerson.id,
          cycleId: selectedTeamReview.periodId,
          relatedReviewId: selectedTeamReview.id,
          recordType: draft.recordType,
          note: draft.note.trim(),
          coachingAction: draft.coachingAction.trim() || undefined,
          linkedGoalIds: selectedTeamGoals.map((goal) => goal.id),
          followUpDate: draft.followUpDate || undefined,
          visibility: draft.visibility,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...previous.feedbackRecords,
      ],
    }));
    setActionMessage(
      "Feedback / coaching record saved with author, visibility, and timestamp.",
    );
  }

  return (
    <AuthenticatedLayout
      header={
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          My Performance
        </h2>
      }
    >
      <Head title="My Performance" />
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          title="My Performance"
          description="Track goals, complete optional self-evaluations, and manage only the team reviews assigned to you"
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
                ? "Loading your authorized Performance workspace…"
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

        {!currentPerson ? (
          <EmptyState
            icon={AlertCircle}
            title="Performance profile not linked"
            description="Your signed-in account could not be matched to the shared personnel source. Ask an authorized administrator to verify the HR1/Core HR identity link."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {(
                [
                  "My Performance",
                  ...(hasEvaluatorCapability ? ["My Team Reviews"] : []),
                ] as WorkspaceTab[]
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setWorkspaceTab(tab);
                    setActionMessage("");
                  }}
                  className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${workspaceTab === tab ? "bg-[#121212] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {tab}
                  {tab === "My Team Reviews" && (
                    <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                      {teamReviews.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {actionMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {actionMessage}
              </div>
            )}

            {workspaceTab === "My Performance" && (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-4">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white"
                        style={{
                          backgroundColor: colorForId(currentPerson.id),
                        }}
                      >
                        {initialsFor(currentPerson.fullName)}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                          Personal Performance Workspace
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                          {currentPerson.fullName}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {currentPerson.position} · {currentPerson.department}{" "}
                          · {currentPerson.personType}
                        </p>
                      </div>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Active Cycle
                    </p>
                    <h2 className="mt-2 text-sm font-bold text-slate-900">
                      {cycles.find(
                        (cycle) => cycle.status === "Active",
                      )?.cycleName ?? "No active cycle"}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Your information is limited to your own authorized
                      performance records.
                    </p>
                  </section>
                </div>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Current Goals / KPIs / KRAs
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Expectations assigned to your personnel identity and
                        cycle.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {myGoals.length} items
                    </span>
                  </div>
                  {myGoals.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {myGoals.map((goal) => (
                        <GoalCard key={goal.id} goal={goal} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Target}
                      title="No assigned goals"
                      description="No Goal, KPI, or KRA records are currently assigned to your personnel identity. This is an honest empty state and does not imply poor performance."
                    />
                  )}
                </section>

                {myTraineeJourney && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                          Trainee Development Journey
                        </p>
                        <h2 className="mt-1 text-sm font-bold text-slate-900">
                          {myTraineeJourney.currentStage}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Development readiness does not automatically change
                          your official HR1 employment status.
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {getTraineeJourneyProgress(myTraineeJourney)}%
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-6">
                      {TRAINEE_JOURNEY_STAGES.map((stage, index) => {
                        const activeIndex = TRAINEE_JOURNEY_STAGES.indexOf(
                          myTraineeJourney.currentStage,
                        );
                        return (
                          <div
                            key={stage}
                            title={stage}
                            className={`h-2 rounded-full ${index <= activeIndex ? "bg-emerald-500" : "bg-slate-100"}`}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                      {myTraineeJourney.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="rounded-xl bg-slate-50 p-3 text-xs"
                        >
                          <p className="font-bold text-slate-700">
                            {milestone.title}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {milestone.completedAt
                              ? `Completed ${formatDate(milestone.completedAt)}`
                              : milestone.targetDate
                                ? `Target ${formatDate(milestone.targetDate)}`
                                : "No target date"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {(myFeedback.length > 0 || myPips.length > 0) && (
                  <section className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4 text-amber-600" />
                        <h2 className="text-sm font-bold text-slate-900">
                          Visible Feedback &amp; Coaching
                        </h2>
                      </div>
                      <div className="mt-3 space-y-2">
                        {myFeedback.length ? (
                          myFeedback.map((record) => (
                            <div
                              key={record.id}
                              className="rounded-xl bg-slate-50 p-3 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-slate-700">
                                  {record.recordType}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                  <Eye className="h-3 w-3" />
                                  {record.visibility}
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
                          ))
                        ) : (
                          <p className="text-xs text-slate-400">
                            No employee-visible feedback records.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-sky-600" />
                        <h2 className="text-sm font-bold text-slate-900">
                          Performance Improvement Support
                        </h2>
                      </div>
                      <div className="mt-3 space-y-2">
                        {myPips.length ? (
                          myPips.map((pip) => (
                            <div
                              key={pip.id}
                              className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-amber-900">
                                  {pip.status}
                                </p>
                                <span className="text-[10px] text-amber-700">
                                  {formatDate(pip.targetEndDate)}
                                </span>
                              </div>
                              <p className="mt-1 text-amber-800">
                                {pip.expectedImprovement}
                              </p>
                              <p className="mt-2 text-[10px] text-amber-700">
                                {
                                  pip.milestones.filter(
                                    (milestone) =>
                                      milestone.status === "Completed",
                                  ).length
                                }{" "}
                                of {pip.milestones.length} milestones completed
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400">
                            No active improvement plan is linked to your
                            profile.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <section>
                  <div className="mb-3">
                    <h2 className="text-sm font-bold text-slate-900">
                      My Review History & Tasks
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Self-evaluation is shown only when enabled by the
                      applicable cycle.
                    </p>
                  </div>
                  {myReviews.length > 0 ? (
                    <div className="space-y-3">
                      {myReviews.map((review) => (
                        <PersonalReviewCard
                          key={review.id}
                          review={review}
                          cycle={getCycle(review, cycles)}
                          onSelfEvaluate={() =>
                            setSelectedSelfReviewId(review.id)
                          }
                          onAcknowledge={() => acknowledgeReview(review.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={ClipboardCheck}
                      title="No performance reviews yet"
                      description="No formal review record is currently linked to your personnel identity."
                    />
                  )}
                </section>
              </div>
            )}

            {workspaceTab === "My Team Reviews" && hasEvaluatorCapability && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <SummaryCard
                    label="Assigned"
                    value={teamCounts.assigned}
                    icon={Users}
                    accent="bg-slate-100 text-slate-700"
                  />
                  <SummaryCard
                    label="Pending"
                    value={teamCounts.pending}
                    icon={Clock3}
                    accent="bg-amber-50 text-amber-700"
                  />
                  <SummaryCard
                    label="In Progress"
                    value={teamCounts.inProgress}
                    icon={ClipboardCheck}
                    accent="bg-sky-50 text-sky-700"
                  />
                  <SummaryCard
                    label="Completed"
                    value={teamCounts.completed}
                    icon={CheckCircle2}
                    accent="bg-emerald-50 text-emerald-700"
                  />
                  <SummaryCard
                    label="Overdue"
                    value={teamCounts.overdue}
                    icon={AlertCircle}
                    accent="bg-rose-50 text-rose-700"
                  />
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Assigned Reviews
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Only direct-report or explicitly assigned reviews are
                        visible.
                      </p>
                    </div>
                    <select
                      value={teamStatusFilter}
                      onChange={(event) =>
                        setTeamStatusFilter(
                          event.target.value as TeamStatusFilter,
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-amber-400"
                    >
                      <option value="All">All statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                  {filteredTeamReviews.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        icon={Users}
                        title="No assigned reviews in this view"
                        description="No authorized direct-report reviews match the selected status."
                      />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            {[
                              "Person",
                              "Type",
                              "Performance Cycle",
                              "Due",
                              "Status",
                              "",
                            ].map((header) => (
                              <th
                                key={header || "arrow"}
                                className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredTeamReviews.map((review) => {
                            const person = getPersonById(review.personId);
                            const cycle = getCycle(review, cycles);
                            if (!person) return null;
                            return (
                              <tr
                                key={review.id}
                                tabIndex={0}
                                role="button"
                                onClick={() => openTeamReview(review)}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    openTeamReview(review);
                                  }
                                }}
                                className="cursor-pointer transition hover:bg-amber-50/40 focus:bg-amber-50/40 focus:outline-none"
                              >
                                <td className="whitespace-nowrap px-5 py-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                                      style={{
                                        backgroundColor: colorForId(person.id),
                                      }}
                                    >
                                      {initialsFor(person.fullName)}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-800">
                                        {person.fullName}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        {person.position} · {person.department}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-xs font-semibold text-slate-600">
                                  {person.personType}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-600">
                                  {cycle?.cycleName ?? "Unknown cycle"}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-600">
                                  {formatDate(
                                    review.dueDate ?? cycle?.reviewDueDate,
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  <StatusBadge review={review} />
                                </td>
                                <td className="px-5 py-3">
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>

      {selectedSelfReview && selectedSelfCycle && (
        <SelfEvaluationModal
          review={selectedSelfReview}
          cycle={selectedSelfCycle}
          onClose={() => setSelectedSelfReviewId(null)}
          onSave={saveSelfEvaluation}
        />
      )}

      {selectedTeamReview &&
        selectedTeamPerson &&
        selectedTeamCycle &&
        selectedTeamTemplate && (
          <ManagerReviewModal
            review={selectedTeamReview}
            person={selectedTeamPerson}
            cycle={selectedTeamCycle}
            template={selectedTeamTemplate}
            goals={selectedTeamGoals}
            feedbackRecords={selectedTeamFeedback}
            relatedPips={selectedTeamPips}
            onClose={() => setSelectedTeamReviewId(null)}
            onSave={saveManagerReview}
            onAddFeedback={addTeamFeedback}
          />
        )}
    </AuthenticatedLayout>
  );
}