import type { EvaluationPeriod } from '@/data/evaluatorAssignments';
import type { ReviewTemplate } from '@/data/performancePlanning';
import type { PerformanceHistoryPersonRecord } from '@/data/performanceBackend';
import { resolvePerformanceReviewBoardStage, type PerformanceReviewBoardStage } from '@/data/performanceReviewBoard';
import type { PerformanceReview } from '@/data/performanceReviews';
import type { PersonnelIdentity } from '@/data/personnel';
import PerformanceDetailsModal from '@/Components/Performance/PerformanceDetailsModal';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Star } from 'lucide-react';

export type WorkspacePerformanceReview = Omit<PerformanceReview, 'workflowState'> & { workflowState?: string };
export type PerformanceReviewWorkspaceRow = {
  evaluation: WorkspacePerformanceReview;
  person: PersonnelIdentity;
  evaluator: PersonnelIdentity | undefined;
};

export type PerformancePreReviewRow = {
  person: PersonnelIdentity;
  evaluator: PersonnelIdentity | undefined;
  method: 'Manager Review' | '360° Leadership Review' | 'Routing Issue';
  authority: string;
  basis: string;
  status: 'Ready' | 'Needs Source Data';
  readiness:
    | 'Evidence Ready'
    | 'On Track'
    | 'Evidence In Progress'
    | 'Manager Follow-up'
    | 'New Joiner Monitoring'
    | 'Goal Plan Required'
    | 'Routing Issue';
  readinessDetail: string;
  weightedProgress: number | null;
  goalCount: number;
  completedGoalCount: number;
  atRiskGoalCount: number;
};

export type ReviewTransitionEligibility = { allowed: boolean; reason: string };

type Props = {
  onCloseDetails: () => void;
  rows: PerformanceReviewWorkspaceRow[];
  periods: EvaluationPeriod[];
  reviewTemplates: ReviewTemplate[];
  activePeriodId?: string;
  currentActorId: string;
  serverDate: string;
  actualServerDate?: string;
  demoMode?: boolean;
  departmentFilter: string;
  statusFilter: string;
  ratingFilter: string;
  historicalRecords?: PerformanceHistoryPersonRecord[];
  preReviewRows?: PerformancePreReviewRow[];
  backendSaving: boolean;
  canManage?: boolean;
  onOpen: (row: PerformanceReviewWorkspaceRow) => void;
  onEdit: (row: PerformanceReviewWorkspaceRow) => void;
  getTransitionEligibility: (row: PerformanceReviewWorkspaceRow, target: PerformanceReviewBoardStage) => ReviewTransitionEligibility;
  onTransition: (row: PerformanceReviewWorkspaceRow, target: PerformanceReviewBoardStage) => Promise<void>;
};

const button = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 disabled:opacity-40';

type ExtendedReview = PerformanceReview & {
  reviewMethod?: 'Manager Review' | '360° Leadership Review';
  leadership360?: { coverageReady?: boolean } | null;
};

function isLeadership360(review: WorkspacePerformanceReview): boolean {
  return (review as unknown as ExtendedReview).reviewMethod === '360° Leadership Review';
}

function reviewStage(review: WorkspacePerformanceReview, cycle: EvaluationPeriod | undefined): PerformanceReviewBoardStage | '360 Feedback Collection' {
  const raw = String((review as unknown as { workflowState?: string }).workflowState ?? '');
  if (isLeadership360(review) && raw === '360 Feedback Collection') return '360 Feedback Collection';
  return resolvePerformanceReviewBoardStage(review as unknown as PerformanceReview, !!cycle?.calibrationRequired);
}

function formatReviewDate(value?: string | null): string {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatReviewDateRange(start?: string | null, end?: string | null): string {
  if (!start || !end) return '—';
  const parse = (value: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  const startDate = parse(start);
  const endDate = parse(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return `${start} – ${end}`;
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return `${formatReviewDate(start)} – ${formatReviewDate(end)}`;
}

function hasReviewActivity(review: WorkspacePerformanceReview): boolean {
  return (
    review.status !== 'Pending' ||
    review.rating !== null ||
    !!review.managerSubmittedAt ||
    !!review.finalizedAt ||
    (review.competencyScores?.length ?? 0) > 0 ||
    (() => {
      const workflowState = String(review.workflowState ?? '');
      return workflowState !== '' && !['Scheduled', 'Manager Review', 'Not Started'].includes(workflowState);
    })()
  );
}

function reviewIsScheduled(review: WorkspacePerformanceReview, cycle: EvaluationPeriod | undefined, serverDate: string): boolean {
  if (String(review.workflowState ?? '') === 'Scheduled') return true;
  return !!cycle && !!serverDate && serverDate < cycle.reviewOpenDate && !hasReviewActivity(review);
}

function displayReviewStageLabel(stage: PerformanceReviewBoardStage | 'Scheduled'): string {
  if (stage === 'Submitted') return 'Calibration Pending';
  if (stage === 'Calibration Review') return 'Calibration In Review';
  return stage;
}

function adminActionPriority(review: WorkspacePerformanceReview): number {
  if (review.workflowState === 'Calibration In Review') return 2;
  if (review.workflowState === 'Calibration Pending') return 1;
  return 0;
}

function workflowTone(stage: string): string {
  if (stage === 'Finalized') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (stage === 'Calibration In Review') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (stage === 'Calibration Pending') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (stage === 'Revision In Progress') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (stage === 'Manager Review') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (stage === '360 Feedback Collection') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function readinessTone(readiness: PerformancePreReviewRow['readiness']): string {
  if (readiness === 'Evidence Ready') return 'bg-emerald-50 text-emerald-700';
  if (readiness === 'On Track') return 'bg-sky-50 text-sky-700';
  if (readiness === 'New Joiner Monitoring') return 'bg-violet-50 text-violet-700';
  if (readiness === 'Manager Follow-up' || readiness === 'Routing Issue') return 'bg-rose-50 text-rose-700';
  if (readiness === 'Goal Plan Required') return 'bg-orange-50 text-orange-700';
  return 'bg-amber-50 text-amber-700';
}

function ReviewStars({ score, empty = false }: { score: number | null | undefined; empty?: boolean }) {
  const resolved = typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.min(5, score)) : 0;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={empty || score == null ? 'No formal rating yet' : `${resolved.toFixed(2)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = !empty && resolved >= index + 0.5;
        return <Star key={index} className={`h-3.5 w-3.5 ${filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />;
      })}
    </span>
  );
}

export default function PerformanceReviewsWorkspace(props: Props) {
  const {
    rows,
    periods,
    activePeriodId,
    serverDate,
    historicalRecords,
    preReviewRows = [],
    departmentFilter,
    statusFilter,
    ratingFilter,
  } = props;
  const [page, setPage] = useState(1);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [preReviewPersonId, setPreReviewPersonId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const cycle = periods.find((p) => p.id === activePeriodId);
  const historicalCycle = cycle?.status === 'Closed';

  const matches = (_name: string, department: string) =>
    departmentFilter === 'All Departments' || department === departmentFilter;

  // Persisted review rows are the authoritative formal-review record whenever they
  // exist for the selected cycle. Readiness and Data B history are fallbacks only.
  // This keeps scheduled/in-progress/calibration work visible before the default
  // review-open date and lets finalized historical rows open the full Formal Evaluation.
  const live = rows
    .filter((r) => r.evaluation.periodId === activePeriodId && matches(r.person.fullName, r.person.department))
    .sort((a, b) => {
      if (props.canManage) {
        const priorityDifference = adminActionPriority(b.evaluation) - adminActionPriority(a.evaluation);
        if (priorityDifference !== 0) return priorityDifference;
      }
      return a.person.fullName.localeCompare(b.person.fullName);
    });

  const historical = historicalRecords !== undefined && live.length === 0 && (historicalCycle || !cycle);
  const preReview = !historical && live.length === 0 && !!cycle && !!serverDate && serverDate < cycle.reviewOpenDate;
  const windowOpen = !!cycle && !!serverDate && serverDate >= cycle.reviewOpenDate && serverDate <= cycle.reviewDueDate;

  const history = (historicalRecords ?? [])
    .filter((r) => matches(r.name, r.department))
    .filter((r) => statusFilter === 'All' || (statusFilter === 'Completed' && r.review_summary?.status === 'Finalized') || r.review_summary?.status === statusFilter)
    .filter((r) => ratingFilter === 'All Rating Levels' || r.review_summary?.rating_label === ratingFilter);
  const readinessRows = preReviewRows
    .filter((r) => matches(r.person.fullName, r.person.department))
    .filter((r) => statusFilter === 'All' || statusFilter === 'Performance Period Ongoing')
    .slice()
    .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));

  const liveWorkflowCounts = live.reduce<Record<string, number>>((counts, row) => {
    const c = periods.find((period) => period.id === row.evaluation.periodId);
    const resolved = reviewStage(row.evaluation, c);
    const display = reviewIsScheduled(row.evaluation, c, serverDate) ? 'Scheduled' : resolved;
    const label = display === '360 Feedback Collection' ? '360 Feedback Collection' : displayReviewStageLabel(display);
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});

  const readinessCounts = useMemo(
    () => readinessRows.reduce<Record<string, number>>((counts, row) => {
      counts[row.readiness] = (counts[row.readiness] ?? 0) + 1;
      return counts;
    }, {}),
    [readinessRows],
  );

  const count = preReview ? readinessRows.length : historical ? history.length : live.length;
  const pageCount = Math.max(1, Math.ceil(count / 10));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * 10;
  const visiblePageRowCount = preReview
    ? readinessRows.slice(start, start + 10).length
    : historical
      ? history.slice(start, start + 10).length
      : live.slice(start, start + 10).length;
  const blankRowCount = count > 0 ? Math.max(0, 10 - visiblePageRowCount) : 0;
  const historySelection = history.find((r) => `${r.cycle_id}-${r.personnel_key}` === historyId);
  const preReviewSelection = readinessRows.find((r) => r.person.id === preReviewPersonId);
  const searchLocation = typeof window === 'undefined'
    ? ''
    : `${window.location.search}${window.location.hash}`;

  useEffect(() => {
    setPage(1);
    setHistoryId(null);
    setPreReviewPersonId(null);
    props.onCloseDetails();
  }, [activePeriodId, departmentFilter, statusFilter, ratingFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const table = (params.get('gs_table') ?? '').toLowerCase();

    if (!table.includes('review')) return;

    const targetRecord = params.get('gs_record') ?? '';
    const targetPerson = params.get('gs_person') ?? '';
    const targetMatch = (params.get('gs_match') ?? '').trim().toLowerCase();
    const shouldOpen = params.get('gs_open') === '1';

    const clearSearchFocusParams = () => {
      const url = new URL(window.location.href);

      [
        'gs_table',
        'gs_record',
        'gs_match',
        'gs_context',
        'gs_open',
        'gs_person',
      ].forEach((key) => url.searchParams.delete(key));

      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    };

    // Table-name search: only reveal the Reviews register.
    if (!targetRecord && !targetPerson && !targetMatch) {
      const timer = window.setTimeout(() => {
        const section = document.querySelector<HTMLElement>(
          '[data-global-search-table="Reviews"]',
        );

        if (!section) return;

        section.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        section.animate(
          [
            { boxShadow: '0 0 0 3px rgba(244, 180, 0, 0.75)' },
            { boxShadow: '0 0 0 1px rgba(244, 180, 0, 0.20)' },
            { boxShadow: '0 0 0 0 rgba(244, 180, 0, 0)' },
          ],
          { duration: 1100, easing: 'ease-out' },
        );

        window.setTimeout(clearSearchFocusParams, 1150);
      }, 100);

      return () => window.clearTimeout(timer);
    }

    let targetIndex = -1;
    let targetDomKey = '';
    let openTarget: (() => void) | null = null;

    if (preReview) {
      targetIndex = readinessRows.findIndex((row) =>
        (targetPerson && row.person.id === targetPerson)
        || (
          targetMatch
          && row.person.fullName.toLowerCase().includes(targetMatch)
        ),
      );

      if (targetIndex >= 0) {
        const row = readinessRows[targetIndex];
        targetDomKey = `readiness-${activePeriodId}-${row.person.id}`;

        openTarget = () => {
          setHistoryId(null);
          props.onCloseDetails();
          setPreReviewPersonId(row.person.id);
        };
      }
    } else if (historical) {
      targetIndex = history.findIndex((row) =>
        (
          targetPerson
          && row.personnel_key === targetPerson
        )
        || (
          targetMatch
          && row.name.toLowerCase().includes(targetMatch)
        ),
      );

      if (targetIndex >= 0) {
        const row = history[targetIndex];
        targetDomKey = `${row.cycle_id}-${row.personnel_key}`;

        openTarget = () => {
          setPreReviewPersonId(null);
          props.onCloseDetails();
          setHistoryId(targetDomKey);
        };
      }
    } else {
      targetIndex = live.findIndex((row) =>
        (
          targetRecord
          && row.evaluation.id === targetRecord
        )
        || (
          targetPerson
          && row.person.id === targetPerson
        )
        || (
          targetMatch
          && row.person.fullName.toLowerCase().includes(targetMatch)
        ),
      );

      if (targetIndex >= 0) {
        const row = live[targetIndex];
        targetDomKey = row.evaluation.id;

        openTarget = () => {
          void props.onOpen(row);
        };
      }
    }

    // Data may still be loading or the requested quarter is changing.
    if (targetIndex < 0) return;

    const targetPage = Math.floor(targetIndex / 10) + 1;

    if (targetPage !== currentPage) {
      setPage(targetPage);
    }

    const timer = window.setTimeout(() => {
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-global-search-review-row]',
        ),
      );

      const element = rows.find(
        (row) =>
          row.getAttribute('data-global-search-review-row')
          === targetDomKey,
      );

      if (!element) return;

      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      element.animate(
        [
          {
            backgroundColor: 'rgba(244, 180, 0, 0.34)',
            boxShadow: 'inset 0 0 0 2px rgba(244, 180, 0, 0.90)',
          },
          {
            backgroundColor: 'rgba(254, 243, 199, 0.55)',
            boxShadow: 'inset 0 0 0 1px rgba(244, 180, 0, 0.40)',
          },
          {
            backgroundColor: 'transparent',
            boxShadow: 'inset 0 0 0 0 rgba(244, 180, 0, 0)',
          },
        ],
        {
          duration: 1100,
          easing: 'ease-out',
        },
      );

      if (shouldOpen && openTarget) {
        window.setTimeout(openTarget, 750);
      }

      window.setTimeout(clearSearchFocusParams, 1150);
    }, targetPage !== currentPage ? 200 : 100);

    return () => window.clearTimeout(timer);
  }, [
    activePeriodId,
    currentPage,
    historical,
    history.length,
    live.length,
    preReview,
    readinessRows.length,
    searchLocation,
  ]);

  function changePage(next: number) {
    setPage(next);
    setHistoryId(null);
    setPreReviewPersonId(null);
    props.onCloseDetails();
  }

  async function transition(row: PerformanceReviewWorkspaceRow, target: PerformanceReviewBoardStage) {
    setBusy(true);
    setMessage('');
    try {
      await props.onTransition(row, target);
      setMessage(`Review updated: ${target}.`);
    } catch {
      setMessage('The update was rejected. Reload the record and check its workflow requirements.');
    } finally {
      setBusy(false);
    }
  }

  const summary = historical || historicalCycle
    ? `Performance ${formatReviewDateRange(cycle?.performanceStartDate, cycle?.performanceEndDate)} · finalized historical reviews`
    : !cycle
      ? 'Select a Performance quarter.'
      : !serverDate
        ? 'Loading review schedule…'
        : serverDate < cycle.reviewOpenDate
          ? `Performance ${formatReviewDateRange(cycle.performanceStartDate, cycle.performanceEndDate)} · readiness monitoring`
          : serverDate > cycle.reviewDueDate
            ? 'Formal review window ended · unfinished reviews remain visible and require governed follow-up'
            : `Formal review window open · due ${formatReviewDate(cycle.reviewDueDate)}`;

  const countLabel = preReview ? 'personnel' : 'reviews';

  return (
    <section
      data-global-search-table="Reviews"
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >

      {preReviewSelection && cycle && (
        <PerformanceDetailsModal
          ariaLabel="Current quarter review details"
          eyebrow="Review Details"
          title={preReviewSelection.person.fullName}
          subtitle={`${preReviewSelection.person.position} · ${preReviewSelection.person.department}`}
          onClose={() => setPreReviewPersonId(null)}
          headerMeta={
            <>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${readinessTone(preReviewSelection.readiness)}`}>
                {preReviewSelection.readiness}
              </span>
              <span className="text-[10px] text-slate-500">Performance period ongoing · formal evaluation has not opened yet</span>
            </>
          }
          contentClassName="space-y-4 bg-slate-50/50 p-4 text-xs text-slate-700 sm:p-6"
        >

            <section>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Review Information</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Performance Period</p>
                  <p className="mt-1 font-semibold text-slate-800">{formatReviewDateRange(cycle.performanceStartDate, cycle.performanceEndDate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Formal Review Window</p>
                  <p className="mt-1 font-semibold text-slate-800">{formatReviewDateRange(cycle.reviewOpenDate, cycle.reviewDueDate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Review Method</p>
                  <p className="mt-1 font-semibold text-slate-800">{preReviewSelection.method}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Evaluator / Source</p>
                  <p className="mt-1 font-semibold text-slate-800">{preReviewSelection.method === '360° Leadership Review' ? 'Multi-source leadership feedback' : (preReviewSelection.evaluator?.fullName ?? 'Source data required')}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Formal Evaluation</h3>
                  <p className="mt-1 text-[10px] text-slate-500">The evaluator's criterion ratings are released only when the formal review window opens.</p>
                </div>
                <div className="flex items-center gap-2">
                  <ReviewStars score={null} empty />
                  <span className="font-semibold text-slate-400">Not yet rated</span>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">
                Nothing has been removed from the workflow: criterion stars, official rating, evaluator comments, calibration, and acknowledgment populate here after the review actually opens and progresses through the LMS.
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900">Goals & KPI Performance</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><p className="text-[9px] uppercase text-slate-400">Weighted Progress</p><p className="mt-1 font-bold">{preReviewSelection.weightedProgress === null ? '—' : `${preReviewSelection.weightedProgress}%`}</p></div>
                <div><p className="text-[9px] uppercase text-slate-400">Goals Completed</p><p className="mt-1 font-bold">{preReviewSelection.completedGoalCount} / {preReviewSelection.goalCount}</p></div>
                <div><p className="text-[9px] uppercase text-slate-400">At-Risk Goals</p><p className="mt-1 font-bold">{preReviewSelection.atRiskGoalCount}</p></div>
              </div>
              <p className="mt-3 leading-5 text-slate-600">{preReviewSelection.readinessDetail}</p>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900">Evaluator Comments</h3>
              <p className="mt-2 leading-5 text-slate-500">Not yet submitted. Comments become part of the controlled review record when the assigned evaluator or governed 360° workflow submits the formal evaluation.</p>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900">Calibration & Final Result</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <p><span className="text-slate-400">Calibration:</span> Not started</p>
                <p><span className="text-slate-400">Acknowledgment:</span> Not available</p>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">These remain empty during the performance period. They are populated after evaluator submission, Admin/HR calibration, finalization, and employee acknowledgment.</p>
            </section>
        </PerformanceDetailsModal>
      )}

      {historySelection && (() => {
        const r = historySelection;
        const review = r.review_summary;
        const liveDetail = rows.find((row) => row.evaluation.periodId === activePeriodId && row.person.id === r.personnel_key);
        const detailedEvaluation = liveDetail?.evaluation;
        const officialRating = review?.final_rating ?? detailedEvaluation?.rating ?? null;
        const criterionScores = detailedEvaluation?.competencyScores ?? [];
        const evaluatorComments = detailedEvaluation?.comments?.trim();
        const recommendations = detailedEvaluation?.developmentRecommendations?.length
          ? detailedEvaluation.developmentRecommendations
          : review?.development_recommendation
            ? [review.development_recommendation]
            : [];
        return (
          <PerformanceDetailsModal
            ariaLabel="Historical review details"
            eyebrow="Review Details"
            title={r.name}
            subtitle={`${r.position} · ${r.department}`}
            onClose={() => setHistoryId(null)}
            headerMeta={
              <>
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Finalized · Read-only</span>
                <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-slate-700">
                  <ReviewStars score={officialRating} />
                  {officialRating == null ? 'Unrated' : `${officialRating.toFixed(2)} / 5`}
                  {review?.rating_label ? ` · ${review.rating_label}` : ''}
                </span>
              </>
            }
            contentClassName="space-y-4 bg-slate-50/50 p-4 text-xs text-slate-700 sm:p-6"
          >

              <section>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Review Information</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-[9px] uppercase text-slate-400">Performance Period</p><p className="mt-1 font-semibold">{formatReviewDateRange(cycle?.performanceStartDate, cycle?.performanceEndDate)}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-[9px] uppercase text-slate-400">Review Template</p><p className="mt-1 font-semibold">{review?.review_template ?? 'Historical review'}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-[9px] uppercase text-slate-400">Evaluator</p><p className="mt-1 font-semibold">{r.evaluator?.evaluator_name ?? liveDetail?.evaluator?.fullName ?? 'Not recorded'}</p><p className="mt-0.5 text-[9px] text-slate-400">{r.evaluator?.assignment_basis ?? 'Historical authority record'}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-[9px] uppercase text-slate-400">Finalized</p><p className="mt-1 font-semibold">{formatReviewDate(review?.finalized_at ?? detailedEvaluation?.finalizedAt)}</p></div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Formal Evaluation</h3>
                    <p className="mt-1 text-[10px] text-slate-500">Human evaluator result for the selected quarter.</p>
                  </div>
                  <div className="flex items-center gap-2"><ReviewStars score={officialRating} /><span className="font-bold">{officialRating == null ? 'Unrated' : `${officialRating.toFixed(2)} / 5`}</span></div>
                </div>
                {criterionScores.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {criterionScores.map((criterion) => (
                      <div key={criterion.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                        <span className="min-w-0 flex-1 font-medium text-slate-700">{criterion.name}</span>
                        <div className="flex shrink-0 items-center gap-2"><ReviewStars score={criterion.score} /><span className="w-8 text-right font-semibold">{criterion.score.toFixed(1)}</span></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">
                    The authoritative historical snapshot contains the official final rating but does not contain criterion-by-criterion scores for this record. The system does not invent missing historical star ratings.
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Goals & KPI Performance</h3>
                <div className="mt-3 space-y-2">
                  {r.goal_metrics.map((g) => (
                    <div key={g.template_item_id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3"><span className="font-medium">{g.title}</span><span className="font-bold">{g.final_progress}%</span></div>
                      <p className="mt-1 text-[9px] text-slate-400">Weight {g.weight}%</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">{r.evidence_summary?.evidence_status ?? 'Historical evidence status not recorded'}</p>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Evaluator Comments</h3>
                <p className="mt-2 leading-5 text-slate-600">{evaluatorComments || 'No evaluator narrative is present in the authoritative historical snapshot for this record. Missing comments are not fabricated.'}</p>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Development Recommendations</h3>
                {recommendations.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {recommendations.map((item, index) => <li key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{item}</li>)}
                  </ul>
                ) : <p className="mt-2 text-slate-500">No recommendation recorded.</p>}
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Calibration & Acknowledgment</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p><span className="text-slate-400">Calibration:</span> <span className="font-semibold">{detailedEvaluation?.calibrationStatus ?? review?.calibration_status ?? 'Not recorded'}</span></p>
                  <p><span className="text-slate-400">Acknowledgment:</span> <span className="font-semibold">{detailedEvaluation?.acknowledgment ? 'Received / Viewed' : (review?.employee_acknowledgment ?? 'Not recorded')}</span></p>
                </div>
              </section>

              <details className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-semibold text-slate-800">Recorded audit history</summary>
                {r.audit_events?.map((e, i) => <p key={i} className="mt-2 text-[10px] leading-4 text-slate-600">{e.event_date} · {e.actor} · {e.event_type}: {e.details}</p>)}
              </details>
          </PerformanceDetailsModal>
        );
      })()}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Review Register</h2>
          <p className="mt-1 text-xs text-slate-500">{cycle?.cycleName ? `${cycle.cycleName} · ${summary}` : summary}</p>
          {historicalCycle && (
            <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold text-slate-600">
              Finalized historical reviews · read-only
            </span>
          )}
          {props.demoMode && (
            <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-800">
              Controlled workflow scenario · simulated {formatReviewDate(serverDate)}{props.actualServerDate ? ` · actual ${formatReviewDate(props.actualServerDate)}` : ""}
            </span>
          )}
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>{count} {countLabel}</span>
        {preReview ? (
          <>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">Performance Period Ongoing: {count}</span>
            <span className="text-[10px] text-slate-400">Readiness details remain available inside each Review Details record.</span>
          </>
        ) : (
          <>
            <span>Rating scale: 1–5</span>
            {!historical && Object.entries(liveWorkflowCounts).map(([stage, stageCount]) => (
              <span key={stage} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${workflowTone(stage)}`}>{stage}: {stageCount}</span>
            ))}
          </>
        )}
        {props.backendSaving && <span>Saving…</span>}
      </div>

      {message && <p role="status" className="px-4 py-3 text-xs text-slate-700">{message}</p>}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
            <tr>
              {(preReview
                ? ['Personnel', 'Department', 'Evaluator / Source', 'Workflow', 'Rating', 'Period / Due / Finalized']
                : historical
                  ? ['Personnel', 'Department', 'Evaluator', 'Workflow', 'Rating', 'Period / Due / Finalized']
                  : ['Personnel', 'Department', 'Evaluator', 'Workflow', 'Rating', 'Period / Due / Finalized']
              ).map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preReview ? readinessRows.slice(start, start + 10).map((row) => (
              <tr
                key={`readiness-${activePeriodId}-${row.person.id}`}
                data-global-search-review-row={`readiness-${activePeriodId}-${row.person.id}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setHistoryId(null);
                    props.onCloseDetails();
                    setPreReviewPersonId(row.person.id);
                  }
                }}
                onClick={() => {
                  setHistoryId(null);
                  props.onCloseDetails();
                  setPreReviewPersonId(row.person.id);
                }}
                className="cursor-pointer bg-white transition-colors hover:bg-slate-50/90"
              >
                <td className="px-4 py-3">
                  <span className="block font-semibold text-slate-800">{row.person.fullName}</span>
                  <span className="block text-[10px] font-normal text-slate-500">{row.person.position} · {row.person.personType}</span>
                </td>
                <td className="px-4 py-3">{row.person.department}</td>
                <td className="px-4 py-3">
                  <span className="block font-semibold text-slate-700">{row.method === '360° Leadership Review' ? 'Multi-source' : (row.evaluator?.fullName ?? 'Source data required')}</span>
                  <span className="mt-0.5 block text-[9px] text-slate-400">{row.method}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-sky-50 px-2 py-1 text-[9px] font-bold text-sky-700">Performance Period Ongoing</span>
                  <span title={row.readinessDetail} className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[9px] font-semibold ${readinessTone(row.readiness)}`}>Readiness: {row.readiness}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-400">Unrated</span>
                  <span className="mt-0.5 block text-[9px] text-slate-400">Formal rating not released</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-700">Ends {formatReviewDate(cycle?.performanceEndDate)}</span>
                  <span className="mt-0.5 block text-[9px] text-slate-400">Formal review {formatReviewDateRange(cycle?.reviewOpenDate, cycle?.reviewDueDate)}</span>
                </td>
              </tr>
            )) : historical ? history.slice(start, start + 10).map((r) => {
              const review = r.review_summary;
              const id = `${r.cycle_id}-${r.personnel_key}`;
              return (
                <tr
                  key={id}
                  data-global-search-review-row={id}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPreReviewPersonId(null);
                      props.onCloseDetails();
                      setHistoryId(id);
                    }
                  }}
                  onClick={() => {
                    setPreReviewPersonId(null);
                    props.onCloseDetails();
                    setHistoryId(id);
                  }}
                  className="cursor-pointer transition-colors hover:bg-slate-50/90"
                >
                  <td className="px-4 py-3"><span className="block font-semibold">{r.name}<span className="block text-[10px] font-normal text-slate-500">{r.position} · {r.person_type}</span></span></td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3">{r.evaluator?.evaluator_name ?? 'Not recorded'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${workflowTone(review?.status ?? 'Not recorded')}`}>{review?.status ?? 'Not recorded'}</span></td>
                  <td className="px-4 py-3 font-semibold">{review?.final_rating == null ? 'Unrated' : `${review.final_rating.toFixed(2)} / 5`}</td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-slate-700">{formatReviewDateRange(cycle?.performanceStartDate, cycle?.performanceEndDate)}</span>
                    <span className="mt-0.5 block text-[9px] text-slate-400">{review?.finalized_at ? `Finalized ${formatReviewDate(review.finalized_at)}` : 'Finalization date not recorded'}</span>
                  </td>
                </tr>
              );
            }) : live.slice(start, start + 10).map((row) => {
              const r = row.evaluation;
              const c = periods.find((p) => p.id === r.periodId);
              const stage = reviewStage(r, c);
              const displayStage: PerformanceReviewBoardStage | 'Scheduled' | '360 Feedback Collection' = reviewIsScheduled(r, c, serverDate) ? 'Scheduled' : stage;
              return (
                <tr
                  key={r.id}
                  data-global-search-review-row={r.id}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      props.onOpen(row);
                    }
                  }}
                  onClick={() => props.onOpen(row)}
                  className="cursor-pointer bg-white transition-colors hover:bg-slate-50/90 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300"
                >
                  <td className="px-4 py-3"><span className="block font-semibold">{row.person.fullName}<span className="block text-[10px] font-normal text-slate-500">{row.person.position} · {row.person.personType}</span></span></td>
                  <td className="px-4 py-3">{row.person.department}</td>
                  <td className="px-4 py-3">{isLeadership360(r) ? 'Multi-source' : (row.evaluator?.fullName ?? 'Unavailable')}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const label = displayStage === '360 Feedback Collection' ? '360 Feedback Collection' : displayReviewStageLabel(displayStage);
                      return (
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${workflowTone(label)}`}>{label}</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate-800">
                    {r.rating != null ? `${r.rating.toFixed(2)} / 5` : (r.competencyScores?.length ?? 0) > 0 ? `Draft · ${r.competencyScores?.length ?? 0} criteria rated` : 'Unrated'}
                  </td>
                  <td className="px-4 py-3">
                    {displayStage === 'Scheduled'
                      ? `Ends ${formatReviewDate(c?.performanceEndDate)}`
                      : stage === 'Finalized'
                        ? `Finalized ${formatReviewDate(r.finalizedAt ?? r.dateEvaluated)}`
                        : `Due ${formatReviewDate(r.dueDate ?? c?.reviewDueDate)}`}
                  </td>
                </tr>
              );
            })}

            {blankRowCount > 0 && (
              <tr aria-hidden="true">
                <td colSpan={6} className="border-t border-slate-100 bg-white p-0" style={{ height: `${blankRowCount * 56}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {count === 0 && (
        <div className="p-10 text-center text-xs text-slate-500">
          <ClipboardList className="mx-auto mb-2 h-6 w-6" />
          {preReview
            ? 'No personnel readiness records match this scope.'
            : windowOpen
              ? 'No formal reviews match this scope.'
              : 'No formal review records are available for this quarter.'}
        </div>
      )}

      <div className="relative z-40 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <span>Showing {count ? start + 1 : 0}–{Math.min(start + 10, count)} of {count} {countLabel}</span>
        <nav aria-label="Review pages" className="flex gap-1">
          <button className={button} disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Prev</button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button key={n} aria-current={n === currentPage ? 'page' : undefined} className={`${button} ${n === currentPage ? '!border-amber-400 !bg-amber-400 !text-slate-900' : ''}`} onClick={() => changePage(n)}>{n}</button>
          ))}
          <button className={button} disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Next</button>
        </nav>
      </div>

      <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
        {preReview
          ? 'Workflow remains in Performance Period Ongoing until the formal review window opens. Readiness indicators stay supporting context inside Review Details and never replace the formal workflow or rating.'
          : 'Review Governance determines the review method. Direct reports follow Manager Review, top-of-scope leaders follow governed 360° Leadership Review, and required calibration remains part of formal finalization.'}
      </p>
    </section>
  );
}
