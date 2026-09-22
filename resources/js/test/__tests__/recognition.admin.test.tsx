import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminRecognition from '../../Pages/AdminRecognition';

const client = vi.hoisted(() => ({
    state: vi.fn(), create: vi.fn(), update: vi.fn(), submit: vi.fn(), decide: vi.fn(), revoke: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(),
}));

vi.mock('@/data/recognitionClient', () => ({ recognitionClient: client, recognitionError: (error: unknown) => error instanceof Error ? error.message : String(error) }));
vi.mock('@/Layouts/AuthenticatedLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    HeaderFilters: () => null,
    HeaderActions: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@inertiajs/react', () => ({ Head: () => null }));

const category = { id: 'cat-1', code: 'SAFETY_COMPLIANCE', name: 'Safety & Compliance', description: 'Safety contribution', color: 'rose', icon: 'shield', isActive: true, displayOrder: 1 };
const state: any = {
    actor: { id: 1, role: 'admin', name: 'Admin', personnelKey: 'admin-1', canReview: true, canManageCategories: true, canNominate: true },
    personnel: [
        { id: 1, personnelKey: 'admin-1', employeeId: 'EMP-001', name: 'Admin', position: 'System Administrator', department: 'Administration', personType: 'Employee' },
        { id: 8, personnelKey: 'user-8', employeeId: 'EMP-006', name: 'Miguel Santos', position: 'Safety Officer', department: 'Safety & Compliance', personType: 'Employee' },
    ],
    categories: [category], leaderboard: [], audit: [],
    metrics: { recognized: 1, thisMonth: 1, peopleRecognized: 1, pendingReview: 1 },
    analytics: { monthlyTrend: [], byDepartment: {}, byCategory: {} },
    governance: { nominators: ['Admin', 'HR', 'User'], finalizers: ['Admin', 'HR'], selfRecognitionAllowed: false, publishedRecordsImmutable: true, userVisibility: '', crossModuleImpact: '', certificates: '', ai: { enabled: false, reason: '' } },
    records: [
        { id: 'pending-1', recipient: { id: 8, personnelKey: 'user-8', employeeId: 'EMP-006', name: 'Miguel Santos', position: 'Safety Officer', department: 'Safety & Compliance' }, nominator: { id: 2, personnelKey: 'hr-1', employeeId: 'EMP-002', name: 'Mariana Aguilar', position: 'Safety Supervisor', department: 'Safety & Compliance' }, category, title: 'Peer Safety Coaching', achievementDetails: 'Provided practical peer coaching and reinforced safe work practices.', achievementDate: '2026-09-12', status: 'Pending Review', submittedAt: '2026-09-13T08:00:00Z', reviewedAt: null, recognizedAt: null, revokedAt: null, declineReason: null, revocationReason: null, replacesId: null, evidence: [{ id: 'ev-1', type: 'Supporting Note', sourceModule: null, sourceRecordId: null, sourceFinalizedAt: null, description: 'Supervisor verification note.' }], createdAt: '2026-09-13T08:00:00Z' },
        { id: 'recognized-1', recipient: { id: 8, personnelKey: 'user-8', employeeId: 'EMP-006', name: 'Miguel Santos', position: 'Safety Officer', department: 'Safety & Compliance' }, nominator: { id: 2, personnelKey: 'hr-1', employeeId: 'EMP-002', name: 'Mariana Aguilar', position: 'Safety Supervisor', department: 'Safety & Compliance' }, category, title: 'Safety Leadership Contribution', achievementDetails: 'Demonstrated consistent hazard-control coordination.', achievementDate: '2026-09-01', status: 'Recognized', submittedAt: '2026-09-02T08:00:00Z', reviewedAt: '2026-09-03T08:00:00Z', recognizedAt: '2026-09-03T08:00:00Z', revokedAt: null, declineReason: null, revocationReason: null, replacesId: null, evidence: [], createdAt: '2026-09-02T08:00:00Z' },
    ],
};

describe('Admin Social Recognition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hash = '#Overview';
        client.state.mockResolvedValue(state);
    });

    it('shows concise governance KPIs and opens recognition details in the standard modal', async () => {
        const user = userEvent.setup();
        render(<AdminRecognition initialRecognitionState={state} />);

        expect(screen.getByRole('button', { name: 'Open Pending Review' })).toBeVisible();
        expect(screen.getByRole('button', { name: 'Open Recognized This Quarter' })).toBeVisible();
        expect(screen.getByRole('button', { name: /Nominate Employee/i })).toBeVisible();
        expect(screen.getByRole('button', { name: /Manage Categories/i })).toBeVisible();

        await user.click(screen.getByRole('button', { name: /Open Miguel Santos recognition review/i }));
        expect(screen.getByRole('dialog', { name: 'Recognition Details' })).toBeVisible();
        expect(screen.getAllByText('Peer Safety Coaching').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Approve Recognition/i })).toBeVisible();
        expect(screen.getByRole('button', { name: /Decline/i })).toBeVisible();
    });
});
