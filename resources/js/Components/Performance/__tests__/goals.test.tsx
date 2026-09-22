import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Goals from '../PerformanceGoalsWorkspace';
import type { EvaluationPeriod } from '@/data/evaluatorAssignments';
import type { GoalTemplate } from '@/data/performancePlanning';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const cycle: EvaluationPeriod = {
  id: 'period-q3-2026',
  cycleName: 'Q3 2026 Performance Cycle',
  cycleType: 'Quarterly',
  performanceStartDate: '2026-07-01',
  performanceEndDate: '2026-09-30',
  reviewOpenDate: '2026-10-01',
  reviewDueDate: '2026-10-15',
  applicablePersonTypes: ['Employee'],
  departmentScopes: [],
  reviewTemplateIds: {},
  selfEvaluationEnabled: true,
  selfRatingEnabled: true,
  calibrationRequired: true,
  employeeAcknowledgment: 'Required',
  status: 'Active',
};

const template: GoalTemplate = {
  id: 'goal-template-operations',
  name: 'Operations Delivery Plan',
  applicablePersonTypes: ['Employee'],
  departmentScopes: ['Operations'],
  positionScopes: [],
  cycleIds: [cycle.id],
  description: 'Source-governed Operations outcomes.',
  allowIndividualOverrides: false,
  active: true,
  items: [
    {
      id: 'ops-kpi',
      metricType: 'KPI',
      title: 'Delivery Accuracy',
      target: 'Meet agreed delivery accuracy',
      unit: '% compliant work',
      weight: 100,
    },
  ],
};

it('renders embedded goal frameworks for Overview without standalone summary cards or routine plan actions', () => {
  render(
    <Goals
      goalTemplates={[template]}
      activeCycle={cycle}
      embedded
    />,
  );

  expect(screen.getByText('Goal & KPI Frameworks')).toBeTruthy();
  expect(screen.getByText('Source-governed')).toBeTruthy();
  expect(screen.queryByText('Governed Goal Plans')).toBeNull();
  expect(screen.getByText('Operations Delivery Plan')).toBeTruthy();
  expect(screen.getByText('Delivery Accuracy')).toBeTruthy();
  expect(screen.getByText(/Meet agreed delivery accuracy/)).toBeTruthy();
  expect(screen.getByText('Operations')).toBeTruthy();

  expect(screen.queryByText('Assigned · Locked')).toBeNull();
  expect(screen.queryByRole('button', { name: 'View Plan' })).toBeNull();
  expect(screen.queryByText('Goal Coverage & Progress')).toBeNull();
  expect(screen.queryByText('Administrative correction')).toBeNull();
  expect(screen.queryByText('Covered Person')).toBeNull();
  expect(screen.queryByRole('button', { name: /View Goals|Hide Goals/ })).toBeNull();
  expect(screen.queryByText('Review Details')).toBeNull();
});
