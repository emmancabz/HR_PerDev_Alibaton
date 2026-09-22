import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Reviews from '../PerformanceReviewsWorkspace';
import data from '../../../../../database/seeders/data/DEFENSE_WORKFORCE_PERSONAS_V1.json';
import type { PerformanceHistoryPersonRecord } from '@/data/performanceBackend';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const props = { rows: [], periods: [], reviewTemplates: [], currentActorId: 'user-1', serverDate: '2026-09-06', departmentFilter: 'All Departments', statusFilter: 'All', ratingFilter: 'All Rating Levels', backendSaving: false, onCloseDetails: vi.fn(), onOpen: vi.fn(), onEdit: vi.fn(), onTransition: vi.fn(), getTransitionEligibility: () => ({allowed: false, reason: ''}) };
it.each(['period-q1-2026', 'period-q2-2026'] as const)('renders every historical personnel snapshot for %s without edit actions', key => {
 const records = data.performance_quarter_history[key].personnel_records as PerformanceHistoryPersonRecord[];
 render(<Reviews {...props} activePeriodId={key} historicalRecords={records}/>);
 expect(screen.getAllByRole('row')).toHaveLength(11);
 fireEvent.click(screen.getAllByRole('row')[1]);
 const historicalDialog = screen.getByRole('dialog', {name: 'Historical review details'});
 expect(historicalDialog.getAttribute('class')).toContain('max-w-[1040px]');
 expect(historicalDialog.getAttribute('class')).toContain('max-h-[90vh]');
 expect(screen.getByText('Recorded audit history')).toBeTruthy();
 expect(screen.getAllByRole('button', {name: 'Close review details'})).toHaveLength(1);
 expect(screen.queryByText('Complete manager review')).toBeNull();
 expect(screen.queryByText('Board')).toBeNull();
 expect(screen.getAllByRole('row')).toHaveLength(11);
 fireEvent.click(screen.getByRole('button', {name: 'Next'}));
 expect(screen.queryByText('Recorded audit history')).toBeNull();
 expect(screen.getAllByRole('row')).toHaveLength(11);
 fireEvent.click(screen.getByRole('button', {name: '4'}));
 expect(screen.getAllByRole('row')).toHaveLength(5);
});


it('opens pre-review readiness details in the same centered Performance details modal', () => {
 const period = {id: 'q3', cycleName: 'Q3 2026', performanceStartDate: '2026-07-01', performanceEndDate: '2026-09-30', reviewOpenDate: '2026-10-01', reviewDueDate: '2026-10-15', status: 'Active', calibrationRequired: true} as any;
 const person = {id: 'p-ready', fullName: 'Readiness Person', department: 'Operations', position: 'Operations Coordinator', personType: 'Employee' as const, corePersonId: 'p-ready', employeeOrTraineeId: 'EMP-R', email: '', accessRole: 'User' as const, employmentStatus: 'Employee' as const};
 const preReviewRow = {person, evaluator: undefined, method: 'Manager Review' as const, authority: 'Department Leadership', basis: 'Current organization', status: 'Ready' as const, readiness: 'On Track' as const, readinessDetail: 'Goals and evidence remain on track for the upcoming formal review.', weightedProgress: 75, goalCount: 4, completedGoalCount: 2, atRiskGoalCount: 0};
 render(<Reviews {...props} periods={[period]} activePeriodId="q3" serverDate="2026-09-06" preReviewRows={[preReviewRow]}/>);
 fireEvent.click(screen.getAllByRole('row')[1]);
 const dialog = screen.getByRole('dialog', {name: 'Current quarter review details'});
 expect(dialog.getAttribute('class')).toContain('max-w-[1040px]');
 expect(dialog.getAttribute('class')).toContain('max-h-[90vh]');
 expect(within(dialog).getByText('Readiness Person')).toBeTruthy();
 expect(screen.getAllByRole('button', {name: 'Close review details'})).toHaveLength(1);
 fireEvent.click(screen.getByRole('button', {name: 'Close review details'}));
 expect(screen.queryByRole('dialog', {name: 'Current quarter review details'})).toBeNull();
});

it('keeps missing ratings unrated without a duplicate search field', () => {
 const source = data.performance_quarter_history['period-q1-2026'].personnel_records[0];
 const record = {...source, review_summary: {...source.review_summary, final_rating: null}} as PerformanceHistoryPersonRecord;
 render(<Reviews {...props} historicalRecords={[record]}/>);
 expect(screen.getByText('Unrated')).toBeTruthy();
 expect(screen.queryByRole('textbox')).toBeNull();
 fireEvent.click(screen.getAllByRole('row')[1].children[1]);
 expect(screen.getByText('Recorded audit history')).toBeTruthy();
});
it('opens current review details directly without inserting an expanded table row', () => {
 const row = {evaluation: {id: 'live-1', personId: 'user-1', evaluatorId: 'manager', periodId: 'q3', rating: null, status: 'Pending' as const}, person: {id: 'user-1', fullName: 'Test Person', department: 'Operations', position: 'Operator', personType: 'Employee' as const, corePersonId: '1', employeeOrTraineeId: 'EMP-1', email: '', accessRole: 'User' as const, employmentStatus: 'Employee' as const}, evaluator: undefined};
 render(<Reviews {...props} rows={[row]} activePeriodId="q3"/>);
 fireEvent.click(screen.getAllByRole('row')[1]);
 expect(props.onOpen).toHaveBeenCalledWith(row);
 expect(screen.getAllByRole('row')).toHaveLength(2);
 expect(screen.queryByText('View evidence and audit')).toBeNull();
});

it('shows scheduled before the configured review-open date', () => {
 const period = {id: 'q3', cycleName: 'Q3 2026', performanceStartDate: '2026-07-01', performanceEndDate: '2026-09-30', reviewOpenDate: '2026-10-01', reviewDueDate: '2026-10-15', status: 'Active', calibrationRequired: true} as any;
 const row = {evaluation: {id: 'live-scheduled', personId: 'user-1', evaluatorId: 'manager', periodId: 'q3', rating: null, status: 'Pending' as const, dueDate: '2026-10-15'}, person: {id: 'user-1', fullName: 'Scheduled Person', department: 'Operations', position: 'Operator', personType: 'Employee' as const, corePersonId: '1', employeeOrTraineeId: 'EMP-1', email: '', accessRole: 'User' as const, employmentStatus: 'Employee' as const}, evaluator: undefined};
 render(<Reviews {...props} rows={[row]} periods={[period]} activePeriodId="q3"/>);
 expect(screen.getByText('Scheduled')).toBeTruthy();
 expect(screen.getByText('Ends Sep 30, 2026')).toBeTruthy();
});

it('keeps an already-started review in its real workflow even before the default review-open date', () => {
 const period = {id: 'q3', cycleName: 'Q3 2026', performanceStartDate: '2026-07-01', performanceEndDate: '2026-09-30', reviewOpenDate: '2026-10-01', reviewDueDate: '2026-10-15', status: 'Active', calibrationRequired: true} as any;
 const row = {evaluation: {id: 'live-calibration', personId: 'user-1', evaluatorId: 'manager', periodId: 'q3', rating: 4.2, status: 'In Progress' as const, dueDate: '2026-10-15', workflowState: 'Calibration Pending', managerSubmittedAt: '2026-08-28T10:00:00+08:00', competencyScores: [{name: 'Quality of Work', score: 4}]}, person: {id: 'user-1', fullName: 'Started Person', department: 'Operations', position: 'Operator', personType: 'Employee' as const, corePersonId: '1', employeeOrTraineeId: 'EMP-1', email: '', accessRole: 'User' as const, employmentStatus: 'Employee' as const}, evaluator: undefined};
 render(<Reviews {...props} rows={[row]} periods={[period]} activePeriodId="q3"/>);
 expect(screen.getByText('Calibration Pending')).toBeTruthy();
 expect(screen.getByText('4.20 / 5')).toBeTruthy();
 expect(screen.queryByText('Scheduled')).toBeNull();
});

it('renders mixed current-cycle workflow states and draft criterion activity in the Reviews register', () => {
 const period = {id: 'q3', cycleName: 'Q3 2026', performanceStartDate: '2026-07-01', performanceEndDate: '2026-09-30', reviewOpenDate: '2026-10-01', reviewDueDate: '2026-10-15', status: 'Active', calibrationRequired: true} as any;
 const person = (id: string, name: string) => ({id, fullName: name, department: 'Operations', position: 'Staff Professional', personType: 'Employee' as const, corePersonId: id, employeeOrTraineeId: id.toUpperCase(), email: '', accessRole: 'User' as const, employmentStatus: 'Employee' as const});
 const rows = [
  {evaluation: {id: 'scheduled', personId: 'p1', evaluatorId: 'manager', periodId: 'q3', rating: null, status: 'Pending' as const, workflowState: 'Scheduled', dueDate: '2026-10-15'}, person: person('p1','Alpha Person'), evaluator: undefined},
  {evaluation: {id: 'draft', personId: 'p2', evaluatorId: 'manager', periodId: 'q3', rating: null, status: 'In Progress' as const, workflowState: 'Manager Review', dueDate: '2026-10-15', competencyScores: [{name:'Quality of Work',score:4},{name:'Reliability',score:3}]}, person: person('p2','Beta Person'), evaluator: undefined},
  {evaluation: {id: 'calibration', personId: 'p3', evaluatorId: 'manager', periodId: 'q3', rating: 4.1, status: 'In Progress' as const, workflowState: 'Calibration Pending', managerSubmittedAt:'2026-08-28T10:00:00+08:00', dueDate: '2026-10-15', competencyScores:[{name:'Quality of Work',score:4}]}, person: person('p3','Gamma Person'), evaluator: undefined},
  {evaluation: {id: 'final', personId: 'p4', evaluatorId: 'manager', periodId: 'q3', rating: 4.5, status: 'Completed' as const, workflowState: 'Finalized', finalizedAt:'2026-10-08T15:00:00+08:00', dueDate:'2026-10-15', competencyScores:[{name:'Quality of Work',score:5}]}, person: person('p4','Delta Person'), evaluator: undefined},
 ];
 render(<Reviews {...props} rows={rows} periods={[period]} activePeriodId="q3"/>);
 expect(screen.getAllByText('Scheduled').length).toBeGreaterThan(0);
 expect(screen.getByText('Manager Review')).toBeTruthy();
 expect(screen.getByText('Calibration Pending')).toBeTruthy();
 expect(screen.getByText('Finalized')).toBeTruthy();
 expect(screen.getByText('Draft · 2 criteria rated')).toBeTruthy();
 expect(screen.getByText('4.10 / 5')).toBeTruthy();
 expect(screen.getByText('4.50 / 5')).toBeTruthy();
 expect(screen.getByText('Finalized Oct 8, 2026')).toBeTruthy();
 expect(screen.getAllByText('Due Oct 15, 2026').length).toBeGreaterThan(0);
});


it('prefers persisted historical reviews so the parent can show the full Formal Evaluation', () => {
 const period = {id: 'period-q2-2026', cycleName: 'Q2 2026 Performance Cycle', performanceStartDate: '2026-04-01', performanceEndDate: '2026-06-30', reviewOpenDate: '2026-07-01', reviewDueDate: '2026-07-15', status: 'Closed', calibrationRequired: true} as any;
 const person = {id: 'p-history', fullName: 'Historical Person', department: 'Finance', position: 'Finance Analyst', personType: 'Employee' as const, corePersonId: 'p-history', employeeOrTraineeId: 'EMP-H', email: '', accessRole: 'User' as const, employmentStatus: 'Employee' as const};
 const row = {evaluation: {id: 'review-q2-history', personId: 'p-history', evaluatorId: 'manager', periodId: 'period-q2-2026', reviewTemplateId: 'review-template-employee-finance', rating: 4.25, status: 'Completed' as const, workflowState: 'Finalized', finalizedAt: '2026-07-08T15:00:00+08:00', dueDate: '2026-07-15', competencyScores: [{name: 'Goal / KPI Achievement', score: 4},{name: 'Financial Record Accuracy', score: 5}]}, person, evaluator: undefined};
 const fallback = data.performance_quarter_history['period-q2-2026'].personnel_records as PerformanceHistoryPersonRecord[];
 render(<Reviews {...props} rows={[row]} periods={[period]} activePeriodId="period-q2-2026" historicalRecords={fallback}/>);
 expect(screen.getByText('Finalized historical reviews · read-only')).toBeTruthy();
 expect(screen.getByText('4.25 / 5')).toBeTruthy();
 fireEvent.click(screen.getAllByRole('row')[1]);
 expect(props.onOpen).toHaveBeenCalledWith(row);
 expect(screen.queryByText('Recorded audit history')).toBeNull();
});


it('keeps calibration work in the register without rendering a duplicate Admin Action Queue', () => {
 const period = {id: 'q3', cycleName: 'Q3 2026', performanceStartDate: '2026-07-01', performanceEndDate: '2026-09-30', reviewOpenDate: '2026-10-01', reviewDueDate: '2026-10-15', status: 'Active', calibrationRequired: true} as any;
 const person = (id: string, name: string) => ({id, fullName: name, department: 'Operations', position: 'Staff Professional', personType: 'Employee' as const, corePersonId: id, employeeOrTraineeId: id.toUpperCase(), email: '', accessRole: 'User' as const, employmentStatus: 'Employee' as const});
 const pending = {evaluation: {id: 'pending-calibration', personId: 'p1', evaluatorId: 'manager', periodId: 'q3', rating: 4.1, status: 'In Progress' as const, workflowState: 'Calibration Pending', dueDate: '2026-10-15', competencyScores:[{name:'Quality of Work',score:4}]}, person: person('p1','Zulu Pending'), evaluator: undefined};
 const inReview = {evaluation: {id: 'calibration-review', personId: 'p2', evaluatorId: 'manager', periodId: 'q3', rating: 4.4, status: 'In Progress' as const, workflowState: 'Calibration In Review', dueDate: '2026-10-15', competencyScores:[{name:'Quality of Work',score:5}]}, person: person('p2','Alpha Finalize'), evaluator: undefined};
 const routine = {evaluation: {id: 'manager-draft', personId: 'p3', evaluatorId: 'manager', periodId: 'q3', rating: null, status: 'In Progress' as const, workflowState: 'Manager Review', dueDate: '2026-10-15'}, person: person('p3','Beta Draft'), evaluator: undefined};
 render(<Reviews {...props} canManage rows={[routine, pending, inReview]} periods={[period]} activePeriodId="q3" serverDate="2026-10-05"/>);
 expect(screen.queryByText('Admin Action Queue')).toBeNull();
 expect(screen.queryByText('Admin review required')).toBeNull();
 expect(screen.getByText('Calibration In Review')).toBeTruthy();
 expect(screen.getByText('Calibration Pending')).toBeTruthy();
 const bodyRows = screen.getAllByRole('row').slice(1);
 expect(bodyRows[0].textContent).toContain('Alpha Finalize');
 expect(bodyRows[1].textContent).toContain('Zulu Pending');
});
