import type { EvaluatorAssignment } from "./evaluatorAssignments";
import type { PerformanceDevelopmentStore } from "./performanceDevelopment";
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

export type PerformanceServerState = {
  actor: PerformanceActor;
  personnel: PersonnelIdentity[];
  cycles: PerformanceCycle[];
  reviewTemplates: ReviewTemplate[];
  goalTemplates: GoalTemplate[];
  goals: PerformanceGoal[];
  assignments: EvaluatorAssignment[];
  reviews: PerformanceReview[];
  development: PerformanceDevelopmentStore;
  anonymousUpwardFeedback: {
    enabled: boolean;
    subjectSafeOnly: boolean;
  };
};

type StateResponse = { data: PerformanceServerState };

export type PerformanceBackendStatus = {
  loading: boolean;
  saving: boolean;
  ready: boolean;
  error: string;
  message: string;
  actor: PerformanceActor | null;
  reload: () => Promise<void>;
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
  configuration: "/performance/api/configuration",
  intelligence: "/performance/api/intelligence/draft",
} as const;

function stableJson(value: unknown): string {
  return JSON.stringify(value);
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
        cycles: state.cycles,
        assignments: state.assignments,
        goalTemplates: state.goalTemplates,
        goals: state.goals,
        reviewTemplates: state.reviewTemplates,
      };
      lastReviewsRef.current = stableJson(state.reviews);
      lastDevelopmentRef.current = stableJson(state.development);
      lastConfigurationRef.current = stableJson(configuration);
      configurationAllowedRef.current = state.actor.capabilities.configurePerformance;
      replaceSharedPersonnel(state.personnel);
      options.setReviews(state.reviews);
      options.setDevelopment(state.development);
      options.setCycles(state.cycles);
      options.setAssignments(state.assignments);
      options.setGoalTemplates(state.goalTemplates);
      options.setGoals(state.goals);
      options.setReviewTemplates?.(state.reviewTemplates);
      setActor(state.actor);
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
      cycles: options.cycles,
      assignments: options.assignments,
      goalTemplates: options.goalTemplates,
      goals: options.goals,
      reviewTemplates: options.reviewTemplates,
    };
    const hash = stableJson(configuration);
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
    options.cycles,
    options.goalTemplates,
    options.goals,
    options.reviewTemplates,
    ready,
    reload,
  ]);

  return { loading, saving, ready, error, message, actor, reload };
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