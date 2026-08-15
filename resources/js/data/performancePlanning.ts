import type { PersonType, PersonnelIdentity } from "./personnel";

export type PerformanceCycleType =
  | "Quarterly"
  | "Semi-Annual"
  | "Annual"
  | "Probationary"
  | "Custom";

export type PerformanceCycleStatus = "Draft" | "Active" | "Closed";
export type EmployeeAcknowledgmentMode =
  | "Required"
  | "Optional"
  | "Not Required";

export type PerformanceCycle = {
  id: string;
  cycleName: string;
  cycleType: PerformanceCycleType;
  performanceStartDate: string;
  performanceEndDate: string;
  reviewOpenDate: string;
  reviewDueDate: string;
  applicablePersonTypes: PersonType[];
  departmentScopes: string[];
  reviewTemplateIds: Partial<Record<PersonType, string>>;
  selfEvaluationEnabled: boolean;
  selfRatingEnabled: boolean;
  calibrationRequired: boolean;
  employeeAcknowledgment: EmployeeAcknowledgmentMode;
  probationaryMilestoneMonths?: number;
  status: PerformanceCycleStatus;
  description?: string;
  instructions?: string;
};

export type RatingScaleLevel = {
  value: number;
  label: string;
  description: string;
};

export type RatingScale = {
  id: string;
  name: string;
  levels: RatingScaleLevel[];
};

export const DEFAULT_RATING_SCALE: RatingScale = {
  id: "rating-scale-five-point",
  name: "Five-point performance scale",
  levels: [
    { value: 1, label: "Does Not Meet Expectations", description: "Performance is materially below the agreed requirement." },
    { value: 2, label: "Needs Improvement", description: "Performance is inconsistent and requires focused support." },
    { value: 3, label: "Meets Expectations", description: "Performance consistently meets the agreed requirement." },
    { value: 4, label: "Exceeds Expectations", description: "Performance frequently exceeds the agreed requirement." },
    { value: 5, label: "Exceptional", description: "Performance consistently demonstrates exceptional impact." },
  ],
};

export type ReviewTemplateCriterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
};

export type ReviewTemplate = {
  id: string;
  name: string;
  personType: PersonType;
  ratingScaleId: string;
  criteria: ReviewTemplateCriterion[];
  active: boolean;
};

export const REVIEW_TEMPLATES: ReviewTemplate[] = [
  {
    id: "review-template-employee-standard",
    name: "Standard Employee Review",
    personType: "Employee",
    ratingScaleId: DEFAULT_RATING_SCALE.id,
    active: true,
    criteria: [
      { id: "employee-goal-achievement", name: "Goal / KPI Achievement", description: "Results against agreed goals, KPIs, and KRAs.", weight: 25 },
      { id: "employee-quality", name: "Quality of Work", description: "Accuracy, completeness, and standard of work delivered.", weight: 20 },
      { id: "employee-productivity", name: "Productivity", description: "Consistent and timely delivery of role responsibilities.", weight: 15 },
      { id: "employee-competency", name: "Role Competency", description: "Application of the knowledge and skills required for the role.", weight: 15 },
      { id: "employee-collaboration", name: "Communication / Collaboration", description: "Clear communication and constructive teamwork.", weight: 10 },
      { id: "employee-reliability", name: "Reliability / Compliance", description: "Dependability and adherence to organizational requirements.", weight: 10 },
      { id: "employee-problem-solving", name: "Problem Solving", description: "Sound judgment when analyzing and resolving work issues.", weight: 5 },
    ],
  },
  {
    id: "review-template-trainee-standard",
    name: "Standard Trainee Review",
    personType: "Trainee",
    ratingScaleId: DEFAULT_RATING_SCALE.id,
    active: true,
    criteria: [
      { id: "trainee-learning", name: "Learning / Development Progress", description: "Growth against the agreed trainee development plan.", weight: 25 },
      { id: "trainee-assessment", name: "Assessment Performance", description: "Demonstrated understanding in assigned assessments.", weight: 20 },
      { id: "trainee-participation", name: "Training Participation", description: "Engagement with required development activities.", weight: 15 },
      { id: "trainee-readiness", name: "Competency Readiness", description: "Readiness to apply role competencies with appropriate support.", weight: 20 },
      { id: "trainee-compliance", name: "Participation / Compliance", description: "Participation and adherence to trainee requirements.", weight: 10 },
      { id: "trainee-practical", name: "Practical Application", description: "Ability to apply learning in practical work situations.", weight: 10 },
    ],
  },
];

export const PERFORMANCE_CYCLES: PerformanceCycle[] = [
  {
    id: "period-q2-2026",
    cycleName: "Q2 2026 Performance Cycle",
    cycleType: "Quarterly",
    performanceStartDate: "2026-04-01",
    performanceEndDate: "2026-06-30",
    reviewOpenDate: "2026-07-01",
    reviewDueDate: "2026-07-15",
    applicablePersonTypes: ["Employee", "Trainee"],
    departmentScopes: [],
    reviewTemplateIds: {
      Employee: "review-template-employee-standard",
      Trainee: "review-template-trainee-standard",
    },
    selfEvaluationEnabled: false,
    selfRatingEnabled: false,
    calibrationRequired: false,
    employeeAcknowledgment: "Optional",
    status: "Closed",
    description: "Historical quarterly performance cycle.",
  },
  {
    id: "period-q3-2026",
    cycleName: "Q3 2026 Performance Cycle",
    cycleType: "Quarterly",
    performanceStartDate: "2026-07-01",
    performanceEndDate: "2026-09-30",
    reviewOpenDate: "2026-10-01",
    reviewDueDate: "2026-10-15",
    applicablePersonTypes: ["Employee", "Trainee"],
    departmentScopes: [],
    reviewTemplateIds: {
      Employee: "review-template-employee-standard",
      Trainee: "review-template-trainee-standard",
    },
    selfEvaluationEnabled: true,
    selfRatingEnabled: true,
    calibrationRequired: true,
    employeeAcknowledgment: "Required",
    status: "Active",
    description: "Active organization-wide quarterly performance cycle.",
    instructions: "Use agreed goals and documented workplace evidence. Missing supporting evidence does not become a zero score.",
  },
  {
    id: "cycle-probationary-2026",
    cycleName: "2026 Probationary Review",
    cycleType: "Probationary",
    performanceStartDate: "2026-08-01",
    performanceEndDate: "2026-11-30",
    reviewOpenDate: "2026-12-01",
    reviewDueDate: "2026-12-05",
    applicablePersonTypes: ["Trainee"],
    departmentScopes: [],
    reviewTemplateIds: { Trainee: "review-template-trainee-standard" },
    selfEvaluationEnabled: false,
    selfRatingEnabled: false,
    calibrationRequired: false,
    employeeAcknowledgment: "Optional",
    probationaryMilestoneMonths: 4,
    status: "Draft",
    description: "Configurable milestone review for eligible trainees; it does not change HR1 employment status.",
  },
];

export type GoalMetricType = "KRA" | "KPI" | "Goal";
export type GoalStatus = "Not Started" | "On Track" | "At Risk" | "Completed";

export type GoalTemplateItem = {
  id: string;
  metricType: GoalMetricType;
  title: string;
  target: string;
  unit?: string;
  weight: number;
  description?: string;
};

export type GoalTemplate = {
  id: string;
  name: string;
  applicablePersonTypes: PersonType[];
  departmentScopes: string[];
  positionScopes: string[];
  cycleIds: string[];
  description?: string;
  allowIndividualOverrides: boolean;
  items: GoalTemplateItem[];
  active: boolean;
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "goal-template-operations",
    name: "Operations Delivery & Safety",
    applicablePersonTypes: ["Employee"],
    departmentScopes: ["Operations", "Crane Operations", "Logistics"],
    positionScopes: [],
    cycleIds: ["period-q3-2026"],
    description: "Shared operational expectations that can be refined for an individual's actual assignment.",
    allowIndividualOverrides: true,
    active: true,
    items: [
      { id: "ops-kra-delivery", metricType: "KRA", title: "Operational Delivery", target: "Meet the agreed work plan", unit: "% work plan", weight: 35 },
      { id: "ops-kpi-quality", metricType: "KPI", title: "Work Quality", target: "At least 95", unit: "% accepted output", weight: 30 },
      { id: "ops-kpi-compliance", metricType: "KPI", title: "Safety and Process Compliance", target: "Meet documented requirements", unit: "% compliance", weight: 25 },
      { id: "ops-goal-development", metricType: "Goal", title: "Role Development Goal", target: "Complete agreed development action", unit: "milestone", weight: 10 },
    ],
  },
  {
    id: "goal-template-finance",
    name: "Finance Accuracy & Timeliness",
    applicablePersonTypes: ["Employee"],
    departmentScopes: ["Finance"],
    positionScopes: [],
    cycleIds: ["period-q3-2026"],
    allowIndividualOverrides: true,
    active: true,
    items: [
      { id: "finance-kra-accuracy", metricType: "KRA", title: "Financial Record Accuracy", target: "At least 98", unit: "% accurate", weight: 40 },
      { id: "finance-kpi-timeliness", metricType: "KPI", title: "Reporting Timeliness", target: "Meet all agreed reporting dates", unit: "% on time", weight: 35 },
      { id: "finance-goal-improvement", metricType: "Goal", title: "Process Improvement", target: "Deliver one approved improvement", unit: "milestone", weight: 25 },
    ],
  },
  {
    id: "goal-template-trainee",
    name: "Trainee Development Plan",
    applicablePersonTypes: ["Trainee"],
    departmentScopes: [],
    positionScopes: [],
    cycleIds: ["period-q3-2026", "cycle-probationary-2026"],
    description: "Development expectations only; completion does not automatically change employment status.",
    allowIndividualOverrides: true,
    active: true,
    items: [
      { id: "trainee-kra-progress", metricType: "KRA", title: "Development Progress", target: "Complete agreed milestones", unit: "% milestones", weight: 35 },
      { id: "trainee-kpi-application", metricType: "KPI", title: "Practical Application", target: "Demonstrate supervised task readiness", unit: "milestone", weight: 35 },
      { id: "trainee-goal-feedback", metricType: "Goal", title: "Apply Coaching Feedback", target: "Close agreed coaching actions", unit: "% actions", weight: 30 },
    ],
  },
];

export type PerformanceGoal = {
  id: string;
  personId: string;
  cycleId: string;
  templateId: string;
  templateItemId: string;
  title: string;
  metricType: GoalMetricType;
  target: string;
  unit?: string;
  weight: number;
  progress: number;
  status: GoalStatus;
  startDate: string;
  endDate: string;
  individualOverride: boolean;
  description?: string;
};

export const PERFORMANCE_GOALS: PerformanceGoal[] = [
  { id: "goal-mateo-delivery", personId: "user-gen-2", cycleId: "period-q3-2026", templateId: "goal-template-operations", templateItemId: "ops-kra-delivery", title: "Operational Delivery", metricType: "KRA", target: "Meet the agreed work plan", unit: "% work plan", weight: 35, progress: 62, status: "On Track", startDate: "2026-07-01", endDate: "2026-09-30", individualOverride: false },
  { id: "goal-mateo-quality", personId: "user-gen-2", cycleId: "period-q3-2026", templateId: "goal-template-operations", templateItemId: "ops-kpi-quality", title: "Work Quality", metricType: "KPI", target: "At least 95", unit: "% accepted output", weight: 30, progress: 54, status: "At Risk", startDate: "2026-07-01", endDate: "2026-09-30", individualOverride: false },
  { id: "goal-elaine-progress", personId: "user-6", cycleId: "period-q3-2026", templateId: "goal-template-trainee", templateItemId: "trainee-kra-progress", title: "Development Progress", metricType: "KRA", target: "Complete agreed milestones", unit: "% milestones", weight: 35, progress: 70, status: "On Track", startDate: "2026-07-01", endDate: "2026-09-30", individualOverride: false },
  { id: "goal-nina-accuracy", personId: "user-5", cycleId: "period-q3-2026", templateId: "goal-template-finance", templateItemId: "finance-kra-accuracy", title: "Financial Record Accuracy", metricType: "KRA", target: "At least 98", unit: "% accurate", weight: 40, progress: 100, status: "Completed", startDate: "2026-07-01", endDate: "2026-09-30", individualOverride: false },
];

export function getActivePerformanceCycle(
  cycles: PerformanceCycle[] = PERFORMANCE_CYCLES,
): PerformanceCycle | undefined {
  return cycles.find((cycle) => cycle.status === "Active");
}

export function isCycleApplicableToPerson(
  cycle: PerformanceCycle,
  person: PersonnelIdentity,
): boolean {
  return (
    cycle.applicablePersonTypes.includes(person.personType) &&
    (cycle.departmentScopes.length === 0 ||
      cycle.departmentScopes.includes(person.department))
  );
}

export function totalTemplateWeight(
  template: Pick<GoalTemplate, "items"> | Pick<ReviewTemplate, "criteria">,
): number {
  const weightedItems = "items" in template ? template.items : template.criteria;
  return weightedItems.reduce((total, item) => total + item.weight, 0);
}

export function validateGoalTemplate(template: GoalTemplate): string[] {
  const errors: string[] = [];
  if (!template.name.trim()) errors.push("Template name is required.");
  if (template.applicablePersonTypes.length === 0) errors.push("Select at least one Person Type.");
  if (template.items.length === 0) errors.push("Add at least one KRA, KPI, or Goal.");
  if (template.items.some((item) => !item.title.trim() || !item.target.trim())) {
    errors.push("Every item needs a title and target.");
  }
  if (template.items.some((item) => item.weight <= 0 || item.weight > 100)) {
    errors.push("Every item weight must be between 1 and 100.");
  }
  if (totalTemplateWeight(template) !== 100) errors.push("Configured weights must total 100%.");
  return errors;
}

export function getApplicableGoalTemplates(
  person: PersonnelIdentity,
  cycleId: string,
  templates: GoalTemplate[] = GOAL_TEMPLATES,
): GoalTemplate[] {
  return templates.filter(
    (template) =>
      template.active &&
      template.applicablePersonTypes.includes(person.personType) &&
      (template.cycleIds.length === 0 || template.cycleIds.includes(cycleId)) &&
      (template.departmentScopes.length === 0 || template.departmentScopes.includes(person.department)) &&
      (template.positionScopes.length === 0 || template.positionScopes.includes(person.position)),
  );
}