import type { EvaluatorAssignment } from "./evaluatorAssignments";
import type { CanonicalWorkforcePersona } from "./performanceOverview";
import type { PerformanceDevelopmentStore, PerformanceImprovementPlan } from "./performanceDevelopment";
import type {
  GoalTemplate,
  PerformanceCycle,
  PerformanceGoal,
  ReviewTemplate,
} from "./performancePlanning";
import type { PerformanceReview } from "./performanceReviews";
import {
  replaceSharedPersonnel,
  type PersonnelIdentity,
} from "./personnel";
import axios, { AxiosError } from "axios";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export type PerformanceActor = {
  userId: number;
  personnelKey: string | null;
  name: string;
  email: string;
  role: "admin" | "hr" | "user";
  capabilities: {
    monitorOrganization: boolean;
    configurePerformance: boolean;
    operatePerformance: boolean;
    evaluateAssignedPeople: boolean;
  };
};

export type PerformanceGoalAuditEvent = {
  id: string;
  goalId: string;
  personId: string;
  cycleId: string;
  goalTitle: string;
  eventType: string;
  previousProgress: number | null;
  newProgress: number | null;
  previousStatus: PerformanceGoal["status"] | null;
  newStatus: PerformanceGoal["status"] | null;
  reason?: string | null;
  reference?: string | null;
  actorId?: string | null;
  actorName: string;
  actorRole?: string | null;
  createdAt: string;
};

export type PerformanceCalendarQuarter = {
  cycle_id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  status: "Finalized" | "Current" | "Upcoming";
  performance_start: string;
  performance_end: string;
  review_start: string;
  review_end: string;
  read_only: boolean;
  planning_only?: boolean;
};

export type PerformanceCalendarContext = {
  available_years: number[];
  default_year: number;
  historical_data_before_2026: boolean;
  historical_data_before_2026_note?: string;
  default_cycle_id: string;
  quarters: PerformanceCalendarQuarter[];
  selector_rule?: string;
};

export type PerformanceHistoryGoalMetric = {
  template_item_id: string;
  metric_type: "KRA" | "KPI" | "Goal";
  title: string;
  target: string;
  unit?: string;
  weight: number;
  final_progress: number;
  final_status: PerformanceGoal["status"];
  evidence_status?: string;
  locked?: boolean;
};

export type PerformanceHistoryPersonRecord = {
  personnel_key: string;
  employee_or_trainee_id: string;
  name: string;
  department: string;
  position: string;
  person_type: "Employee" | "Trainee";
  employment_presence?: string;
  cycle_id: string;
  goal_plan_id: string;
  goal_plan_name: string;
  evaluator?: { evaluator_name: string; authority_type: string; assignment_basis: string };
  review_summary?: { review_id: string; review_template: string; status: string; final_rating: number | null; rating_label: string; calibration_status: string; employee_acknowledgment: string; finalized_at: string; development_recommendation: string };
  evidence_summary?: { evidence_status: string; verified_goal_evidence_count: number };
  audit_events?: { event_type: string; actor: string; event_date: string; details: string }[];
  goal_metrics: PerformanceHistoryGoalMetric[];
  total_weight: number;
  weighted_progress: number;
  overall_goal_health: PerformanceGoal["status"];
};

export type PerformanceQuarterHistoryEntry = {
  cycle_id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  status: "Finalized" | "Current" | "Upcoming";
  read_only: boolean;
  headcount_snapshot?: number;
  workforce_notes?: string[];
  personnel_records?: PerformanceHistoryPersonRecord[];
};

export type PerformanceServerState = {
  meta: {
    sourceOfTruth: "PostgreSQL";
    identitySource: "Canonical users/personnel";
    serverNow: string;
    serverDate: string;
    actualServerDate?: string;
    demoMode?: boolean;
    demoScenario?: string | null;
  };
  actor: PerformanceActor;
  personnel: PersonnelIdentity[];
  cycles: PerformanceCycle[];
  reviewTemplates: ReviewTemplate[];
  goalTemplates: GoalTemplate[];
  goals: PerformanceGoal[];
  goalAuditEvents: PerformanceGoalAuditEvent[];
  assignments: EvaluatorAssignment[];
  reviews: PerformanceReview[];
  development: PerformanceDevelopmentStore;
  workforceContext: {
    source: "DEFENSE_WORKFORCE_PERSONAS_V1";
    asOfDate: string;
    people: CanonicalWorkforcePersona[];
  };
  performanceCalendar: PerformanceCalendarContext;
  performanceQuarterHistory: Record<string, PerformanceQuarterHistoryEntry>;
  anonymousUpwardFeedback: {
    enabled: boolean;
    subjectSafeOnly: boolean;
  };
};

type StateResponse = { data: PerformanceServerState };

export type PerformanceReviewBoardTarget =
  | "Manager Review"
  | "Submitted"
  | "Calibration Review"
  | "Finalized";

export type PerformanceBackendStatus = {
  loading: boolean;
  saving: boolean;
  ready: boolean;
  error: string;
  message: string;
  actor: PerformanceActor | null;
  serverDate: string;
  actualServerDate: string;
  demoMode: boolean;
  workforceContext: PerformanceServerState["workforceContext"];
  performanceCalendar: PerformanceCalendarContext;
  performanceQuarterHistory: Record<string, PerformanceQuarterHistoryEntry>;
  goalAuditEvents: PerformanceGoalAuditEvent[];
  reload: () => Promise<void>;
  transitionReview: (
    reviewId: string,
    target: PerformanceReviewBoardTarget,
  ) => Promise<void>;
  transitionCalibration: (
    reviewId: string,
    target: "In Review" | "Approved" | "Returned for Revision",
    notes?: string,
  ) => Promise<void>;
  updateGoalProgress: (
    goalId: string,
    updates: { progress?: number; status?: PerformanceGoal["status"]; administrativeCorrection?: boolean; reason?: string; reference?: string },
  ) => Promise<void>;
  savePip: (pip: PerformanceImprovementPlan) => Promise<void>;
  transitionPipGovernance: (
    pipId: string,
    payload:
      | { action: "close"; outcomeResult: "Expectations Met" | "Partially Met" | "Expectations Not Met"; hrOutcomeNote: string }
      | { action: "extend"; extensionReason: string; newTargetEndDate: string; nextCheckInDate: string; nextCheckInTitle: string },
  ) => Promise<void>;
};

type BridgeOptions = {
  reviews: PerformanceReview[];
  setReviews: Dispatch<SetStateAction<PerformanceReview[]>>;
  development: PerformanceDevelopmentStore;
  setDevelopment: Dispatch<SetStateAction<PerformanceDevelopmentStore>>;
  cycles: PerformanceCycle[];
  setCycles: Dispatch<SetStateAction<PerformanceCycle[]>>;
  assignments: EvaluatorAssignment[];
  setAssignments: Dispatch<SetStateAction<EvaluatorAssignment[]>>;
  goalTemplates: GoalTemplate[];
  setGoalTemplates: Dispatch<SetStateAction<GoalTemplate[]>>;
  goals: PerformanceGoal[];
  setGoals: Dispatch<SetStateAction<PerformanceGoal[]>>;
  reviewTemplates: ReviewTemplate[];
  setReviewTemplates?: Dispatch<SetStateAction<ReviewTemplate[]>>;
};

const ENDPOINTS = {
  state: "/performance/api/state",
  reviews: "/performance/api/reviews",
  development: "/performance/api/development",
  pips: "/performance/api/pips",
  pipGovernance: (pipId: string) => `/performance/api/pips/${encodeURIComponent(pipId)}/governance`,
  configuration: "/performance/api/configuration",
  intelligence: "/performance/api/intelligence/draft",
} as const;

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function configurationHash(configuration: {
  assignments: EvaluatorAssignment[];
  goalTemplates: GoalTemplate[];
  goals: PerformanceGoal[];
  reviewTemplates: ReviewTemplate[];
}): string {
  return stableJson({
    ...configuration,
    goals: configuration.goals.map(({ progress: _progress, status: _status, ...goal }) => goal),
  });
}

function apiErrorMessage(error: unknown): string {
  if (!(error instanceof AxiosError)) {
    return error instanceof Error ? error.message : "Unexpected server error.";
  }
  const response = error.response;
  if (!response) return "The Performance server could not be reached.";
  if (response.status === 401) return "Your session expired. Sign in again.";
  if (response.status === 403)
    return String(
      (response.data as { message?: string })?.message ??
        "You are not authorized to perform this action.",
    );
  if (response.status === 419)
    return "The security token expired. Refresh the page and try again.";
  const data = response.data as {
    message?: string;
    errors?: Record<string, string[]>;
  };
  const validation = data.errors
    ? Object.values(data.errors).flat().filter(Boolean)[0]
    : undefined;
  return validation ?? data.message ?? `Server request failed (${response.status}).`;
}

async function getState(): Promise<PerformanceServerState> {
  const response = await axios.get<StateResponse>(ENDPOINTS.state, {
    headers: { Accept: "application/json" },
  });
  return response.data.data;
}

async function putState(
  endpoint: string,
  payload: object,
): Promise<PerformanceServerState> {
  const response = await axios.put<StateResponse>(endpoint, payload, {
    headers: { Accept: "application/json" },
  });
  return response.data.data;
}

export function usePerformanceBackendBridge(
  options: BridgeOptions,
): PerformanceBackendStatus {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actor, setActor] = useState<PerformanceActor | null>(null);
  const [serverDate, setServerDate] = useState("");
  const [actualServerDate, setActualServerDate] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [workforceContext, setWorkforceContext] = useState<PerformanceServerState["workforceContext"]>({
    source: "DEFENSE_WORKFORCE_PERSONAS_V1",
    asOfDate: "",
    people: [],
  });
  const [performanceCalendar, setPerformanceCalendar] = useState<PerformanceCalendarContext>({
    available_years: [2026],
    default_year: 2026,
    historical_data_before_2026: false,
    default_cycle_id: "period-q3-2026",
    quarters: [],
  });
  const [performanceQuarterHistory, setPerformanceQuarterHistory] = useState<Record<string, PerformanceQuarterHistoryEntry>>({});
  const [goalAuditEvents, setGoalAuditEvents] = useState<PerformanceGoalAuditEvent[]>([]);
  const mountedRef = useRef(true);
  const configurationAllowedRef = useRef(false);
  const lastReviewsRef = useRef("");
  const lastDevelopmentRef = useRef("");
  const lastConfigurationRef = useRef("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyState = useCallback(
    (state: PerformanceServerState) => {
      const configuration = {
        assignments: state.assignments,
        goalTemplates: state.goalTemplates,
        goals: state.goals,
        reviewTemplates: state.reviewTemplates,
      };
      lastReviewsRef.current = stableJson(state.reviews);
      lastDevelopmentRef.current = stableJson(state.development);
      lastConfigurationRef.current = configurationHash(configuration);
      configurationAllowedRef.current = state.actor.capabilities.configurePerformance;
      replaceSharedPersonnel(state.personnel);
      options.setReviews(state.reviews);
      options.setDevelopment(state.development);
      options.setCycles(state.cycles);
      options.setAssignments(state.assignments);
      options.setGoalTemplates(state.goalTemplates);
      options.setGoals(state.goals);
      setGoalAuditEvents(state.goalAuditEvents ?? []);
      options.setReviewTemplates?.(state.reviewTemplates);
      setActor(state.actor);
      setServerDate(state.meta?.serverDate ?? "");
      setActualServerDate(state.meta?.actualServerDate ?? state.meta?.serverDate ?? "");
      setDemoMode(Boolean(state.meta?.demoMode));
      setWorkforceContext(state.workforceContext ?? {
        source: "DEFENSE_WORKFORCE_PERSONAS_V1",
        asOfDate: "",
        people: [],
      });
      setPerformanceCalendar(state.performanceCalendar ?? {
        available_years: [2026],
        default_year: 2026,
        historical_data_before_2026: false,
        default_cycle_id: "period-q3-2026",
        quarters: [],
      });
      setPerformanceQuarterHistory(state.performanceQuarterHistory ?? {});
    },
    [
      options.setAssignments,
      options.setCycles,
      options.setDevelopment,
      options.setGoalTemplates,
      options.setGoals,
      options.setReviewTemplates,
      options.setReviews,
    ],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const state = await getState();
      if (!mountedRef.current) return;
      applyState(state);
      setReady(true);
      setMessage("Performance data loaded from the server.");
    } catch (loadError) {
      if (!mountedRef.current) return;
      setReady(false);
      setError(apiErrorMessage(loadError));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [applyState]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!ready) return;
    const hash = stableJson(options.reviews);
    if (hash === lastReviewsRef.current) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      setError("");
      try {
        const state = await putState(ENDPOINTS.reviews, {
          reviews: options.reviews,
        });
        if (!mountedRef.current) return;
        applyState(state);
        setMessage("Review changes saved to PostgreSQL.");
      } catch (saveError) {
        if (!mountedRef.current) return;
        setError(apiErrorMessage(saveError));
        await reload();
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [applyState, options.reviews, ready, reload]);

  useEffect(() => {
    if (!ready) return;
    const hash = stableJson(options.development);
    if (hash === lastDevelopmentRef.current) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      setError("");
      try {
        const state = await putState(ENDPOINTS.development, {
          development: options.development,
        });
        if (!mountedRef.current) return;
        applyState(state);
        setMessage("Feedback and development changes saved to PostgreSQL.");
      } catch (saveError) {
        if (!mountedRef.current) return;
        setError(apiErrorMessage(saveError));
        await reload();
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [applyState, options.development, ready, reload]);

  useEffect(() => {
    if (!ready || !configurationAllowedRef.current) return;
    const configuration = {
      assignments: options.assignments,
      goalTemplates: options.goalTemplates,
      goals: options.goals,
      reviewTemplates: options.reviewTemplates,
    };
    const hash = configurationHash(configuration);
    if (hash === lastConfigurationRef.current) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      setError("");
      try {
        const state = await putState(ENDPOINTS.configuration, configuration);
        if (!mountedRef.current) return;
        applyState(state);
        setMessage("Performance configuration saved to PostgreSQL.");
      } catch (saveError) {
        if (!mountedRef.current) return;
        setError(apiErrorMessage(saveError));
        await reload();
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    applyState,
    options.assignments,
    options.goalTemplates,
    options.goals,
    options.reviewTemplates,
    ready,
    reload,
  ]);

  const transitionReview = useCallback(
    async (reviewId: string, target: PerformanceReviewBoardTarget) => {
      setSaving(true);
      setError("");
      try {
        const response = await axios.patch<StateResponse>(
          `${ENDPOINTS.reviews}/${encodeURIComponent(reviewId)}/transition`,
          { target },
          { headers: { Accept: "application/json" } },
        );
        if (!mountedRef.current) return;
        applyState(response.data.data);
        setReady(true);
        setMessage(`Review moved to ${target}.`);
      } catch (transitionError) {
        if (!mountedRef.current) return;
        setError(apiErrorMessage(transitionError));
        throw transitionError;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [applyState],
  );

  const transitionCalibration = useCallback(
    async (
      reviewId: string,
      target: "In Review" | "Approved" | "Returned for Revision",
      notes?: string,
    ) => {
      setSaving(true);
      setError("");
      try {
        const response = await axios.patch<StateResponse>(
          `${ENDPOINTS.reviews}/${encodeURIComponent(reviewId)}/calibration`,
          { target, notes },
          { headers: { Accept: "application/json" } },
        );
        if (!mountedRef.current) return;
        applyState(response.data.data);
        setMessage(`Calibration moved to ${target}.`);
      } catch (actionError) {
        if (!mountedRef.current) return;
        setError(apiErrorMessage(actionError));
        throw actionError;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [applyState],
  );

  const updateGoalProgress = useCallback(
    async (
      goalId: string,
      updates: { progress?: number; status?: PerformanceGoal["status"]; administrativeCorrection?: boolean; reason?: string; reference?: string },
    ) => {
      setSaving(true);
      setError("");
      try {
        const response = await axios.patch<StateResponse>(
          `/performance/api/goals/${encodeURIComponent(goalId)}/progress`,
          updates,
          { headers: { Accept: "application/json" } },
        );
        if (!mountedRef.current) return;
        applyState(response.data.data);
        setMessage(updates.administrativeCorrection
          ? "Administrative goal correction saved with audit context."
          : "Goal progress saved through the assigned evaluator workflow.");
      } catch (actionError) {
        if (!mountedRef.current) return;
        setError(apiErrorMessage(actionError));
        throw actionError;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [applyState],
  );

  const savePip = useCallback(
    async (pip: PerformanceImprovementPlan) => {
      setSaving(true);
      setError("");
      try {
        const state = await putState(ENDPOINTS.pips, { pip });
        if (!mountedRef.current) return;
        applyState(state);
        setMessage("Performance Improvement Plan saved to PostgreSQL.");
      } catch (actionError) {
        if (!mountedRef.current) return;
        const detail = apiErrorMessage(actionError);
        setError(detail);
        throw new Error(detail);
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [applyState],
  );

  const transitionPipGovernance = useCallback(
    async (
      pipId: string,
      payload:
        | { action: "close"; outcomeResult: "Expectations Met" | "Partially Met" | "Expectations Not Met"; hrOutcomeNote: string }
        | { action: "extend"; extensionReason: string; newTargetEndDate: string; nextCheckInDate: string; nextCheckInTitle: string },
    ) => {
      setSaving(true);
      setError("");
      try {
        const response = await axios.patch<StateResponse>(
          ENDPOINTS.pipGovernance(pipId),
          payload,
          { headers: { Accept: "application/json" } },
        );
        if (!mountedRef.current) return;
        applyState(response.data.data);
        setMessage(payload.action === "close" ? "PIP closed with a governed outcome." : "PIP extension saved with audit context.");
      } catch (actionError) {
        if (!mountedRef.current) return;
        const detail = apiErrorMessage(actionError);
        setError(detail);
        throw new Error(detail);
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [applyState],
  );

  return {
    loading,
    saving,
    ready,
    error,
    message,
    actor,
    serverDate,
    actualServerDate,
    demoMode,
    workforceContext,
    performanceCalendar,
    performanceQuarterHistory,
    goalAuditEvents,
    reload,
    transitionReview,
    transitionCalibration,
    updateGoalProgress,
    savePip,
    transitionPipGovernance,
  };
}

export type GroqDraftResponse = {
  reviewId: string;
  useCase: string;
  draft: string;
  model: string;
  generatedAt: string;
  humanReviewRequired: true;
};

export async function requestPerformanceGroqDraft(
  reviewId: string,
  useCase: string,
): Promise<GroqDraftResponse> {
  try {
    const response = await axios.post<{ data: GroqDraftResponse }>(
      ENDPOINTS.intelligence,
      { reviewId, useCase },
      { headers: { Accept: "application/json" } },
    );
    return response.data.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error));
  }
}