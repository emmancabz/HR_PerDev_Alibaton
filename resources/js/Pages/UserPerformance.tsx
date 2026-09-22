import PageHeader from "@/Components/PageHeader";
import {
  EVALUATOR_ASSIGNMENTS,
  canEvaluate,
} from "@/data/evaluatorAssignments";
import {
  DEFAULT_RATING_SCALE,
  PERFORMANCE_CYCLES,
  PERFORMANCE_GOALS,
  REVIEW_TEMPLATES,
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
  type CompetencyScore,
  type EvaluationStatus,
  type PerformanceReview,
  type SelfEvaluation,
} from "@/data/performanceReviews";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, usePage } from "@inertiajs/react";
import axios from "axios";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  MessageSquareText,
  Save,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WorkspaceTab = "My Performance" | "My Team Reviews" | "Leadership Feedback";
type TeamStatusFilter = "All" | EvaluationStatus;

type AuthUserShape = {
  id?: string | number;
  name?: string;
  email?: string;
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

type Leadership360SourceRole = "Self" | "Direct Report" | "Peer Leader";
type Leadership360Criterion = { name: string; weight: number };
type Leadership360Task = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectPosition?: string;
  subjectDepartment?: string;
  cycleId: string;
  cycleName: string;
  sourceRole: Leadership360SourceRole;
  dueDate: string;
  criteria: Leadership360Criterion[];
  submitted: boolean;
  ratings: Record<string, number>;
  comment: string;
};

type Leadership360Draft = { ratings: Record<string, number>; comment: string };

function resolveCurrentPerson(user: AuthUserShape): PersonnelIdentity | undefined {
  const authId = user.id === undefined ? "" : String(user.id);
  const normalizedEmail = user.email?.trim().toLowerCase();
  const normalizedName = user.name?.trim().toLowerCase();
  return SHARED_PERSONNEL.find(
    (person) =>
      person.id === authId ||
      person.corePersonId === authId ||
      person.email.toLowerCase() === normalizedEmail ||
      person.fullName.toLowerCase() === normalizedName,
  );
}

function getCycle(review: PerformanceReview): PerformanceCycle | undefined {
  return PERFORMANCE_CYCLES.find((cycle) => cycle.id === review.periodId);
}

function manilaDateIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formalReviewReleased(review: PerformanceReview): boolean {
  const cycle = getCycle(review);
  return !cycle || manilaDateIso() >= cycle.reviewOpenDate;
}

function getTemplate(
  review: PerformanceReview,
  person: PersonnelIdentity,
): ReviewTemplate | undefined {
  const cycle = getCycle(review);
  const templateId =
    review.reviewTemplateId ?? cycle?.reviewTemplateIds[person.personType];
  return REVIEW_TEMPLATES.find(
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
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
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
          <h3 className="mt-2 text-sm font-bold text-slate-900">{goal.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Target: {goal.target}{goal.unit ? ` ${goal.unit}` : ""}
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
    Competency: review.linkedEvidence?.filter((item) => item.source === "Competency") ?? [],
    Learning: review.linkedEvidence?.filter((item) => item.source === "Learning") ?? [],
    Training: review.linkedEvidence?.filter((item) => item.source === "Training") ?? [],
  };
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {Object.entries(grouped).map(([source, items]) => (
        <div key={source} className="rounded-xl border border-slate-200 bg-white p-4">
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
                  <p className="text-slate-400">{formatDate(item.dateCompleted)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              No linked {source.toLowerCase()} evidence is available. This does not block or reduce the review score.
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
      setError("Add at least your accomplishments or reflection comments before submitting.");
      return;
    }
    onSave(draft, true);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Optional Self-Evaluation</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{cycle.cycleName}</h2>
            <p className="mt-1 text-xs text-slate-500">This reflection provides context. It is separate from the manager's official rating.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close self-evaluation">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {[
            ["accomplishments", "Accomplishments", "Describe meaningful results or contributions during the cycle."],
            ["goalProgress", "Goal Progress", "Reflect on your goals, KPIs, or KRAs."],
            ["challenges", "Challenges / Context", "Share relevant challenges and context for your manager."],
            ["comments", "Additional Comments", "Add anything else that supports a fair discussion."],
          ].map(([key, label, placeholder]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">{label}</span>
              <textarea
                value={draft[key as keyof Omit<SelfEvaluationDraft, "selfRating">] as string}
                onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))}
                rows={3}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </label>
          ))}
          {cycle.selfRatingEnabled && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Optional Self-Rating</span>
              <select
                value={draft.selfRating}
                onChange={(event) => setDraft((previous) => ({ ...previous, selfRating: event.target.value ? Number(event.target.value) : "" }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                <option value="">No self-rating selected</option>
                {DEFAULT_RATING_SCALE.levels.map((level) => (
                  <option key={level.value} value={level.value}>{level.value} — {level.label}</option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="button" onClick={() => onSave(draft, false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button type="button" onClick={submitSelfEvaluation} className="rounded-xl bg-[#121212] px-5 py-2.5 text-sm font-semibold text-white">Submit Reflection</button>
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
  onClose,
  onSave,
}: {
  review: PerformanceReview;
  person: PersonnelIdentity;
  cycle: PerformanceCycle;
  template: ReviewTemplate;
  goals: PerformanceGoal[];
  onClose: () => void;
  onSave: (draft: ManagerReviewDraft, submit: boolean) => void;
}) {
  const existingScores = Object.fromEntries(
    (review.competencyScores ?? []).map((score) => [score.name, score.score]),
  );
  const knownRecommendations = review.developmentRecommendations?.filter((item) =>
    DEVELOPMENT_RECOMMENDATION_OPTIONS.includes(
      item as (typeof DEVELOPMENT_RECOMMENDATION_OPTIONS)[number],
    ),
  ) ?? [];
  const customRecommendation = review.developmentRecommendations?.find(
    (item) => !DEVELOPMENT_RECOMMENDATION_OPTIONS.includes(
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
  const isCompleted = review.status === "Completed";
  const previewScores: CompetencyScore[] = template.criteria
    .map((criterion) => ({ name: criterion.name, score: draft.scores[criterion.name] ?? 0 }))
    .filter((score) => score.score > 0);
  const previewRating = calculateWeightedReviewRating(previewScores, template.criteria);

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
      setError("Rate every applicable criterion before submitting the formal review.");
      return;
    }
    onSave(draft, true);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="bg-[#121212] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: colorForId(person.id) }}>
                {initialsFor(person.fullName)}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#F4B400]">Assigned Formal Review</p>
                <h2 className="mt-0.5 text-lg font-bold">{person.fullName}</h2>
                <p className="text-xs text-white/60">{person.position} · {person.department} · {person.personType}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close manager review">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase text-slate-400">Cycle</p><p className="mt-1 text-xs font-semibold text-slate-800">{cycle.cycleName}</p></div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase text-slate-400">Template</p><p className="mt-1 text-xs font-semibold text-slate-800">{template.name}</p></div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase text-slate-400">Due</p><p className="mt-1 text-xs font-semibold text-slate-800">{formatDate(review.dueDate ?? cycle.reviewDueDate)}</p></div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase text-slate-400">Status</p><div className="mt-1"><StatusBadge review={review} /></div></div>
          </div>

          <section>
            <div className="mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-bold text-slate-900">Goals / KPIs / KRAs</h3></div>
            {goals.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div> : <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">No cycle goals are linked to this person. The manager review can continue without inventing goal results.</p>}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-sky-600" /><h3 className="text-sm font-bold text-slate-900">Optional Self-Evaluation</h3></div>
            {review.selfEvaluation?.status === "Submitted" ? (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs md:grid-cols-2">
                <div><p className="font-bold text-slate-700">Accomplishments</p><p className="mt-1 leading-relaxed text-slate-500">{review.selfEvaluation.accomplishments || "Not provided."}</p></div>
                <div><p className="font-bold text-slate-700">Goal Progress</p><p className="mt-1 leading-relaxed text-slate-500">{review.selfEvaluation.goalProgress || "Not provided."}</p></div>
                <div><p className="font-bold text-slate-700">Challenges / Context</p><p className="mt-1 leading-relaxed text-slate-500">{review.selfEvaluation.challenges || "Not provided."}</p></div>
                <div><p className="font-bold text-slate-700">Additional Comments</p><p className="mt-1 leading-relaxed text-slate-500">{review.selfEvaluation.comments || "Not provided."}</p></div>
                <div className="md:col-span-2 text-slate-400">Status: {review.selfEvaluation.status}{review.selfEvaluation.selfRating !== undefined ? ` · Self-rating: ${review.selfEvaluation.selfRating} / 5` : ""}</div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">{cycle.selfEvaluationEnabled ? "The employee has not submitted a self-evaluation. Draft reflections remain private and do not block the manager review." : "Self-evaluation is disabled for this cycle."}</p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Formal Rating Criteria</h3></div>
              <p className="text-xs font-bold text-slate-700">Weighted result: {previewRating === null ? "Complete all ratings" : `${previewRating.toFixed(2)} / 5`}</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {template.criteria.map((criterion) => (
                <div key={criterion.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[1fr_15rem] md:items-center">
                  <div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-800">{criterion.name}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{criterion.weight}%</span></div><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{criterion.description}</p></div>
                  <select disabled={isCompleted} value={draft.scores[criterion.name] ?? ""} onChange={(event) => setDraft((previous) => ({ ...previous, scores: { ...previous.scores, [criterion.name]: Number(event.target.value) } }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100">
                    <option value="">Select rating</option>
                    {DEFAULT_RATING_SCALE.levels.map((level) => <option key={level.value} value={level.value}>{level.value} — {level.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-bold text-slate-900">Authorized Supporting Evidence</h3></div>
            <SupportingEvidence review={review} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Evaluator Comments</span><textarea disabled={isCompleted} rows={5} value={draft.comments} onChange={(event) => setDraft((previous) => ({ ...previous, comments: event.target.value }))} placeholder="Document balanced, work-related observations and context." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100" /></label>
            <div><p className="mb-1.5 text-xs font-bold text-slate-700">Development Recommendations</p><div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">{DEVELOPMENT_RECOMMENDATION_OPTIONS.map((recommendation) => <label key={recommendation} className="flex items-center gap-2 text-xs text-slate-700"><input disabled={isCompleted} type="checkbox" checked={draft.recommendations.includes(recommendation)} onChange={() => toggleRecommendation(recommendation)} className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />{recommendation}</label>)}{draft.recommendations.includes("Other") && <input disabled={isCompleted} value={draft.otherRecommendation} onChange={(event) => setDraft((previous) => ({ ...previous, otherRecommendation: event.target.value }))} placeholder="Describe the other development action" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-400" />}</div></div>
          </section>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Close</button>
          {!isCompleted && <><button type="button" onClick={() => onSave(draft, false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"><Save className="h-4 w-4" /> Save Draft</button><button type="button" onClick={submitManagerReview} className="rounded-xl bg-[#121212] px-5 py-2.5 text-sm font-semibold text-white">Submit Formal Review</button></>}
        </div>
      </div>
    </div>
  );
}

function PersonalReviewCard({
  review,
  onSelfEvaluate,
}: {
  review: PerformanceReview;
  onSelfEvaluate: () => void;
}) {
  const cycle = getCycle(review);
  const isLeadership360 = review.reviewMethod === "360° Leadership Review";
  const evaluator = review.evaluatorId ? getPersonById(review.evaluatorId) : undefined;
  const selfAvailable =
    !isLeadership360 && cycle?.selfEvaluationEnabled && review.status !== "Completed";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{cycle?.cycleType ?? "Performance"} Review</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900">{cycle?.cycleName ?? "Unknown cycle"}</h3>
          <p className="mt-1 text-xs text-slate-500">{isLeadership360 ? "Review method: Governed multi-source leadership feedback" : `Evaluator: ${evaluator?.fullName ?? "Assigned evaluator"}`}</p>
        </div>
        <StatusBadge review={review} />
      </div>
      {review.status === "Completed" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Final Rating</p><p className="mt-1 text-lg font-bold text-slate-900">{review.rating?.toFixed(2) ?? "—"} / 5</p></div>
          <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><p className="text-[10px] font-bold uppercase text-slate-400">Manager Comments</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{review.comments || "No comments recorded."}</p></div>
          <div className="sm:col-span-3"><p className="text-[10px] font-bold uppercase text-slate-400">Development Recommendations</p><p className="mt-1 text-xs text-slate-600">{review.developmentRecommendations?.length ? review.developmentRecommendations.join(" · ") : "No immediate development action recorded."}</p></div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div><p className="text-xs font-semibold text-slate-700">Due {formatDate(review.dueDate ?? cycle?.reviewDueDate)}</p><p className="mt-0.5 text-[11px] text-slate-500">{isLeadership360 ? "Your self input belongs in Leadership Feedback and is consolidated with authorized direct-report and peer-leader input." : "Your manager's formal review remains separate from your reflection."}</p></div>
          {selfAvailable && <button type="button" onClick={onSelfEvaluate} className="rounded-xl bg-[#121212] px-4 py-2.5 text-xs font-semibold text-white">{review.selfEvaluation ? "Update Self-Evaluation" : "Start Self-Evaluation"}</button>}
        </div>
      )}
    </div>
  );
}

function Leadership360FeedbackModal({
  task,
  onClose,
  onSave,
  saving,
}: {
  task: Leadership360Task;
  onClose: () => void;
  onSave: (draft: Leadership360Draft) => void;
  saving: boolean;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>(() => ({ ...task.ratings }));
  const [comment, setComment] = useState(task.comment ?? "");
  const complete = task.criteria.every((criterion) => {
    const score = ratings[criterion.name] ?? 0;
    return score >= 1 && score <= 5;
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button type="button" aria-label="Close leadership feedback" className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">360° Leadership Review</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">{task.subjectName}</h2>
            <p className="mt-1 text-xs text-slate-500">{task.subjectPosition} · {task.subjectDepartment} · {task.sourceRole} input</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-xs leading-5 text-slate-600">
            Rate only leadership behavior you can reasonably observe. Direct-report and peer inputs are consolidated into a governed multi-source result; no contributor has unilateral authority over the leader's official review.
          </div>
          <div className="space-y-3">
            {task.criteria.map((criterion) => (
              <div key={criterion.name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{criterion.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{criterion.weight}% of the consolidated leadership result</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setRatings((current) => ({ ...current, [criterion.name]: score }))}
                        className={`h-9 w-9 rounded-lg border text-xs font-bold transition ${ratings[criterion.name] === score ? "border-violet-500 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"}`}
                        aria-label={`${criterion.name}: ${score} out of 5`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <label className="mt-4 block text-xs font-bold text-slate-700">
            Supporting comment <span className="font-medium text-slate-400">(optional)</span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={3000} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-violet-400" placeholder="Add concise, work-related leadership feedback." />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={!complete || saving} onClick={() => onSave({ ratings, comment })} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? "Saving..." : task.submitted ? "Update Feedback" : "Submit Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserPerformance() {
  const authUser = usePage().props.auth.user as AuthUserShape;
  const currentPerson = useMemo(() => resolveCurrentPerson(authUser), [authUser]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("My Performance");
  const [teamStatusFilter, setTeamStatusFilter] = useState<TeamStatusFilter>("All");
  const [selectedTeamReviewId, setSelectedTeamReviewId] = useState<string | null>(null);
  const [selectedSelfReviewId, setSelectedSelfReviewId] = useState<string | null>(null);
  const [leadershipTasks, setLeadershipTasks] = useState<Leadership360Task[]>([]);
  const [leadershipLoading, setLeadershipLoading] = useState(true);
  const [leadershipSaving, setLeadershipSaving] = useState(false);
  const [leadershipError, setLeadershipError] = useState("");
  const [selectedLeadershipTaskId, setSelectedLeadershipTaskId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;
    setReviewsLoading(true);
    setReviewsError("");
    axios
      .get<{ data: PerformanceReview[] }>("/api/performance/user-reviews", { headers: { Accept: "application/json" } })
      .then((response) => {
        if (active) setReviews(response.data.data ?? []);
      })
      .catch(() => {
        if (active) {
          setReviews([]);
          setReviewsError("Performance reviews could not be loaded right now.");
        }
      })
      .finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, []);

  async function persistReview(review: PerformanceReview, successMessage: string): Promise<boolean> {
    setReviewSaving(true);
    setReviewsError("");
    try {
      const response = await axios.post<{ data: PerformanceReview[] }>(
        "/api/performance/user-reviews",
        { review },
        { headers: { Accept: "application/json" } },
      );
      setReviews(response.data.data ?? []);
      setActionMessage(successMessage);
      return true;
    } catch (error) {
      let message = "The performance review update could not be saved.";
      if (axios.isAxiosError(error)) {
        const payload = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
        message = payload?.message ?? Object.values(payload?.errors ?? {}).flat()[0] ?? message;
      }
      setReviewsError(message);
      return false;
    } finally {
      setReviewSaving(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLeadershipLoading(true);
    setLeadershipError("");
    axios
      .get<{ data: Leadership360Task[] }>("/api/performance/360/tasks", { headers: { Accept: "application/json" } })
      .then((response) => {
        if (active) setLeadershipTasks(response.data.data ?? []);
      })
      .catch(() => {
        if (active) {
          setLeadershipTasks([]);
          setLeadershipError("Leadership feedback tasks could not be loaded right now.");
        }
      })
      .finally(() => { if (active) setLeadershipLoading(false); });
    return () => { active = false; };
  }, []);

  const myReviews = useMemo(
    () =>
      currentPerson
        ? reviews.filter((review) => review.personId === currentPerson.id && formalReviewReleased(review))
        : [],
    [currentPerson, reviews],
  );

  const myGoals = useMemo(
    () =>
      currentPerson
        ? PERFORMANCE_GOALS.filter((goal) => goal.personId === currentPerson.id)
        : [],
    [currentPerson],
  );

  const teamReviews = useMemo(() => {
    if (!currentPerson) return [];
    return reviews.filter(
      (review) =>
        formalReviewReleased(review) &&
        review.evaluatorId === currentPerson.id &&
        canEvaluate(currentPerson.id, review.personId, {
          periodId: review.periodId,
          periods: PERFORMANCE_CYCLES,
          assignments: EVALUATOR_ASSIGNMENTS,
          requireActivePeriod: false,
        }),
    );
  }, [currentPerson, reviews]);

  const hasEvaluatorCapability = useMemo(
    () =>
      !!currentPerson &&
      EVALUATOR_ASSIGNMENTS.some(
        (assignment) =>
          assignment.evaluatorId === currentPerson.id &&
          assignment.isPrimaryEvaluator,
      ),
    [currentPerson],
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
      pending: teamReviews.filter((review) => getDisplayStatus(review) === "Pending").length,
      inProgress: teamReviews.filter((review) => getDisplayStatus(review) === "In Progress").length,
      completed: teamReviews.filter((review) => getDisplayStatus(review) === "Completed").length,
      overdue: teamReviews.filter((review) => getDisplayStatus(review) === "Overdue").length,
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
    ? getCycle(selectedTeamReview)
    : undefined;
  const selectedTeamTemplate =
    selectedTeamReview && selectedTeamPerson
      ? getTemplate(selectedTeamReview, selectedTeamPerson)
      : undefined;
  const selectedTeamGoals = selectedTeamReview
    ? PERFORMANCE_GOALS.filter(
        (goal) =>
          goal.personId === selectedTeamReview.personId &&
          goal.cycleId === selectedTeamReview.periodId,
      )
    : [];

  const selectedSelfReview = selectedSelfReviewId
    ? myReviews.find((review) => review.id === selectedSelfReviewId)
    : undefined;
  const selectedSelfCycle = selectedSelfReview
    ? getCycle(selectedSelfReview)
    : undefined;

  function openTeamReview(review: PerformanceReview) {
    if (
      !currentPerson ||
      review.evaluatorId !== currentPerson.id ||
      !canEvaluate(currentPerson.id, review.personId, {
        periodId: review.periodId,
        periods: PERFORMANCE_CYCLES,
        assignments: EVALUATOR_ASSIGNMENTS,
        requireActivePeriod: false,
      })
    ) {
      setActionMessage("This review is outside your authorized evaluator scope.");
      return;
    }
    setActionMessage("");
    setSelectedTeamReviewId(review.id);
  }

  async function saveManagerReview(draft: ManagerReviewDraft, submit: boolean) {
    if (!currentPerson || !selectedTeamReview || !selectedTeamPerson || !selectedTeamTemplate) return;
    if (
      selectedTeamReview.status === "Completed" ||
      selectedTeamReview.evaluatorId !== currentPerson.id ||
      !canEvaluate(currentPerson.id, selectedTeamPerson.id, {
        periodId: selectedTeamReview.periodId,
        periods: PERFORMANCE_CYCLES,
        assignments: EVALUATOR_ASSIGNMENTS,
        requireActivePeriod: false,
      })
    ) {
      setSelectedTeamReviewId(null);
      setActionMessage("The review could not be updated because your evaluator authority or its state changed.");
      return;
    }
    const scores = selectedTeamTemplate.criteria
      .map((criterion) => ({ name: criterion.name, score: draft.scores[criterion.name] ?? 0 }))
      .filter((score) => score.score > 0);
    const weightedRating = submit
      ? calculateWeightedReviewRating(scores, selectedTeamTemplate.criteria)
      : null;
    if (submit && weightedRating === null) return;
    const recommendations = [
      ...draft.recommendations.filter((item) => item !== "Other"),
      ...(draft.recommendations.includes("Other") && draft.otherRecommendation.trim()
        ? [draft.otherRecommendation.trim()]
        : []),
    ];
    const timestamp = new Date().toISOString();
    const requiresCalibration = !!selectedTeamCycle?.calibrationRequired;
    const updatedReview: PerformanceReview = {
      ...selectedTeamReview,
      reviewTemplateId: selectedTeamTemplate.id,
      competencyScores: scores,
      comments: draft.comments.trim() || undefined,
      developmentRecommendations: recommendations,
      // The server recalculates the official weighted rating and owns the final state.
      rating: submit ? weightedRating : selectedTeamReview.rating,
      status: "In Progress",
      workflowState: submit
        ? (requiresCalibration ? "Calibration Pending" : "Finalized")
        : (selectedTeamReview.workflowState === "Revision In Progress" ? "Revision In Progress" : "Manager Review"),
      managerSubmittedAt: submit ? timestamp : selectedTeamReview.managerSubmittedAt,
      finalizedAt: undefined,
    };
    const saved = await persistReview(
      updatedReview,
      submit
        ? (requiresCalibration ? "Formal review submitted for calibration." : "Formal review submitted successfully.")
        : "Review draft saved.",
    );
    if (saved) setSelectedTeamReviewId(null);
  }

  async function saveSelfEvaluation(draft: SelfEvaluationDraft, submit: boolean) {
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
      submittedAt: submit ? timestamp : selectedSelfReview.selfEvaluation?.submittedAt,
      updatedAt: timestamp,
    };
    const saved = await persistReview(
      { ...selectedSelfReview, selfEvaluation },
      submit ? "Self-evaluation submitted as supporting context." : "Self-evaluation draft saved.",
    );
    if (saved) setSelectedSelfReviewId(null);
  }

  const selectedLeadershipTask = selectedLeadershipTaskId
    ? leadershipTasks.find((task) => task.id === selectedLeadershipTaskId)
    : undefined;

  async function saveLeadershipFeedback(draft: Leadership360Draft) {
    if (!selectedLeadershipTask) return;
    setLeadershipSaving(true);
    setLeadershipError("");
    try {
      const response = await axios.post<{ data: Leadership360Task[] }>(
        "/api/performance/360/feedback",
        {
          subjectId: selectedLeadershipTask.subjectId,
          cycleId: selectedLeadershipTask.cycleId,
          ratings: draft.ratings,
          comment: draft.comment,
        },
        { headers: { Accept: "application/json" } },
      );
      setLeadershipTasks(response.data.data ?? []);
      setSelectedLeadershipTaskId(null);
      setActionMessage("Leadership feedback saved. The formal 360° result remains governed and is released only through the Review workflow.");
    } catch (error) {
      let message = "Leadership feedback could not be saved.";
      if (axios.isAxiosError(error)) {
        const payload = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
        message = payload?.message ?? Object.values(payload?.errors ?? {}).flat()[0] ?? message;
      }
      setLeadershipError(message);
    } finally {
      setLeadershipSaving(false);
    }
  }

  return (
    <AuthenticatedLayout
      header={<h2 className="text-xl font-semibold leading-tight text-gray-800">My Performance</h2>}
    >
      <Head title="My Performance" />
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          title="My Performance"
          description="Track goals, complete optional self-evaluations, and manage only the team reviews assigned to you"
        />

        {!currentPerson ? (
          <EmptyState
            icon={AlertCircle}
            title="Performance profile not linked"
            description="Your signed-in account could not be matched to the shared personnel source. Ask an authorized administrator to verify the HR1/Core HR identity link."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {(["My Performance", ...(hasEvaluatorCapability ? ["My Team Reviews"] : []), ...(leadershipTasks.length > 0 ? ["Leadership Feedback"] : [])] as WorkspaceTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setWorkspaceTab(tab); setActionMessage(""); }}
                  className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${workspaceTab === tab ? "bg-[#121212] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {tab}
                  {tab === "My Team Reviews" && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">{teamReviews.length}</span>}
                  {tab === "Leadership Feedback" && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">{leadershipTasks.filter((task) => !task.submitted).length}</span>}
                </button>
              ))}
            </div>

            {actionMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {actionMessage}
              </div>
            )}

            {(reviewsLoading || reviewSaving) && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500">
                {reviewSaving ? "Saving performance review..." : "Loading performance reviews..."}
              </div>
            )}
            {reviewsError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                <AlertCircle className="h-4 w-4" /> {reviewsError}
              </div>
            )}

            {leadershipError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                <AlertCircle className="h-4 w-4" /> {leadershipError}
              </div>
            )}

            {workspaceTab === "My Performance" && (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: colorForId(currentPerson.id) }}>{initialsFor(currentPerson.fullName)}</div>
                      <div><p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Personal Performance Workspace</p><h2 className="mt-1 text-lg font-bold text-slate-900">{currentPerson.fullName}</h2><p className="text-xs text-slate-500">{currentPerson.position} · {currentPerson.department} · {currentPerson.personType}</p></div>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Cycle</p><h2 className="mt-2 text-sm font-bold text-slate-900">{PERFORMANCE_CYCLES.find((cycle) => cycle.status === "Active")?.cycleName ?? "No active cycle"}</h2><p className="mt-1 text-xs text-slate-500">Your information is limited to your own authorized performance records.</p></section>
                </div>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Current Goals / KPIs / KRAs</h2><p className="mt-0.5 text-xs text-slate-500">Expectations assigned to your personnel identity and cycle.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{myGoals.length} items</span></div>
                  {myGoals.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{myGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div> : <EmptyState icon={Target} title="No assigned goals" description="No Goal, KPI, or KRA records are currently assigned to your personnel identity. This is an honest empty state and does not imply poor performance." />}
                </section>

                <section>
                  <div className="mb-3"><h2 className="text-sm font-bold text-slate-900">My Review History & Tasks</h2><p className="mt-0.5 text-xs text-slate-500">Self-evaluation is shown only when enabled by the applicable cycle.</p></div>
                  {myReviews.length > 0 ? <div className="space-y-3">{myReviews.map((review) => <PersonalReviewCard key={review.id} review={review} onSelfEvaluate={() => setSelectedSelfReviewId(review.id)} />)}</div> : <EmptyState icon={ClipboardCheck} title="No performance reviews yet" description="No formal review record is currently linked to your personnel identity." />}
                </section>
              </div>
            )}

            {workspaceTab === "My Team Reviews" && hasEvaluatorCapability && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <SummaryCard label="Assigned" value={teamCounts.assigned} icon={Users} accent="bg-slate-100 text-slate-700" />
                  <SummaryCard label="Pending" value={teamCounts.pending} icon={Clock3} accent="bg-amber-50 text-amber-700" />
                  <SummaryCard label="In Progress" value={teamCounts.inProgress} icon={ClipboardCheck} accent="bg-sky-50 text-sky-700" />
                  <SummaryCard label="Completed" value={teamCounts.completed} icon={CheckCircle2} accent="bg-emerald-50 text-emerald-700" />
                  <SummaryCard label="Overdue" value={teamCounts.overdue} icon={AlertCircle} accent="bg-rose-50 text-rose-700" />
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="text-sm font-bold text-slate-900">Assigned Reviews</h2><p className="mt-0.5 text-xs text-slate-500">Only direct-report or explicitly assigned reviews are visible.</p></div><select value={teamStatusFilter} onChange={(event) => setTeamStatusFilter(event.target.value as TeamStatusFilter)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-amber-400"><option value="All">All statuses</option><option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option><option value="Overdue">Overdue</option></select></div>
                  {filteredTeamReviews.length === 0 ? <div className="p-5"><EmptyState icon={Users} title="No assigned reviews in this view" description="No authorized direct-report reviews match the selected status." /></div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100"><thead className="bg-slate-50"><tr>{["Person", "Type", "Performance Cycle", "Due", "Status", ""].map((header) => <th key={header || "arrow"} className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredTeamReviews.map((review) => { const person = getPersonById(review.personId); const cycle = getCycle(review); if (!person) return null; return <tr key={review.id} tabIndex={0} role="button" onClick={() => openTeamReview(review)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openTeamReview(review); } }} className="cursor-pointer transition hover:bg-amber-50/40 focus:bg-amber-50/40 focus:outline-none"><td className="whitespace-nowrap px-5 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white" style={{ backgroundColor: colorForId(person.id) }}>{initialsFor(person.fullName)}</div><div><p className="text-xs font-bold text-slate-800">{person.fullName}</p><p className="text-[10px] text-slate-400">{person.position} · {person.department}</p></div></div></td><td className="px-5 py-3 text-xs font-semibold text-slate-600">{person.personType}</td><td className="whitespace-nowrap px-5 py-3 text-xs text-slate-600">{cycle?.cycleName ?? "Unknown cycle"}</td><td className="whitespace-nowrap px-5 py-3 text-xs text-slate-600">{formatDate(review.dueDate ?? cycle?.reviewDueDate)}</td><td className="px-5 py-3"><StatusBadge review={review} /></td><td className="px-5 py-3"><ChevronRight className="h-4 w-4 text-slate-400" /></td></tr>; })}</tbody></table></div>}
                </section>
              </div>
            )}

            {workspaceTab === "Leadership Feedback" && (
              <div className="space-y-4">
                <section className="rounded-2xl border border-violet-200 bg-violet-50/35 p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">360° Leadership Review</p>
                  <h2 className="mt-1 text-sm font-bold text-slate-900">Leadership Feedback Tasks</h2>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">These tasks appear only after the formal review window opens. Self, direct-report, and peer-leader inputs are consolidated by the Performance system and sent to calibration; they do not make any contributor the leader's official evaluator.</p>
                </section>
                {leadershipLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-xs font-semibold text-slate-500">Loading leadership feedback tasks...</div>
                ) : leadershipTasks.length === 0 ? (
                  <EmptyState icon={MessageSquareText} title="No leadership feedback tasks" description="No 360° Leadership Review input is currently open for your account." />
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {leadershipTasks.map((task) => (
                      <button key={task.id} type="button" onClick={() => { setSelectedLeadershipTaskId(task.id); setActionMessage(""); }} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-violet-200 hover:bg-violet-50/20">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">{task.sourceRole} input</p>
                            <h3 className="mt-1 text-sm font-bold text-slate-900">{task.subjectName}</h3>
                            <p className="mt-1 text-xs text-slate-500">{task.subjectPosition} · {task.subjectDepartment}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${task.submitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{task.submitted ? "Submitted" : "Open"}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                          <span>{task.cycleName} · Due {formatDate(task.dueDate)}</span>
                          <span className="font-semibold text-violet-700">{task.submitted ? "Review / Update" : "Start"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedSelfReview && selectedSelfCycle && (
        <SelfEvaluationModal review={selectedSelfReview} cycle={selectedSelfCycle} onClose={() => setSelectedSelfReviewId(null)} onSave={saveSelfEvaluation} />
      )}

      {selectedTeamReview && selectedTeamPerson && selectedTeamCycle && selectedTeamTemplate && (
        <ManagerReviewModal review={selectedTeamReview} person={selectedTeamPerson} cycle={selectedTeamCycle} template={selectedTeamTemplate} goals={selectedTeamGoals} onClose={() => setSelectedTeamReviewId(null)} onSave={saveManagerReview} />
      )}

      {selectedLeadershipTask && (
        <Leadership360FeedbackModal task={selectedLeadershipTask} onClose={() => setSelectedLeadershipTaskId(null)} onSave={saveLeadershipFeedback} saving={leadershipSaving} />
      )}
    </AuthenticatedLayout>
  );
}
