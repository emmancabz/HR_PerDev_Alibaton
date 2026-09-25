import SystemSelect from '@/Components/SystemSelect';
import { AlertCircle, AlertTriangle, Briefcase, Building2, CalendarDays, Check, CheckCircle2, ClipboardList, Clock3, ExternalLink, FileText, GraduationCap, Lock, Mail, MapPin, MessageSquare, MoreVertical, Phone, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, UserCircle2, UserPlus, Users, X, type LucideIcon
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { createPortal } from 'react-dom';

import DataTable from '@/Components/DataTable';
import { ChartDateRangeControl, DEFAULT_CHART_DATE_RANGE, dateFallsInChartRange, type ChartDateRangeValue } from '@/Components/ChartDateRange';
import AuthenticatedLayout, { HeaderFilters } from '@/Layouts/AuthenticatedLayout';
import { useHashWorkspace } from '@/workspaceNavigation';

type AccessRole = 'Admin' | 'HR' | 'User';
type AccessRoleFilter = 'All' | 'Admin & HR' | AccessRole;
type PersonType = 'Employee' | 'Trainee';
type EmploymentStatus = string;
type AccountStatus = 'Not Provisioned' | 'Provisioning' | 'Pending Activation' | 'Active' | 'Suspended' | 'Inactive' | 'Archived';
type SourceSystem = 'HR1' | 'Manual';
type SyncStatus =
    | 'Received'
    | 'Validating'
    | 'Synced'
    | 'Needs Review'
    | 'Failed'
    | 'Duplicate Detected';
type ActivationStatus = 'Not Sent' | 'Invitation Pending' | 'Invitation Sent' | 'Activated';
type IssuePriority = 'High' | 'Medium' | 'Low';
type IssueStatus = 'Open' | 'In Progress' | 'Resolved';
type MajorTab = 'All Users' | 'Incoming Trainees' | 'Account Issues';
const USER_MANAGEMENT_WORKSPACES: MajorTab[] = ['All Users', 'Incoming Trainees', 'Account Issues'];
type WorkspaceTab = 'Overview' | 'Account & Access' | 'Development Profile' | 'Activity & Audit';
type RecommendationStatus = 'Recommended' | 'Under Review' | 'Dismissed';
type ToastTone = 'success' | 'info' | 'warning';
type BadgeType = 'role' | 'person' | 'account' | 'source' | 'sync' | 'priority' | 'issue' | 'communication' | 'verification';

/** Normal (non-privileged) roles that can be assigned through Invite Existing Personnel. Admin is intentionally excluded from ordinary invitation flows; privileged roles are provisioned only from authorized personnel data. */
type InvitableRole = Exclude<AccessRole, 'Admin'>;

/** Status of a manually-submitted account request awaiting confirmation that the claimed person legitimately exists in HR1/Core HR. */
type VerificationStatus = 'Pending HR1 Verification' | 'Needs Review' | 'Verified' | 'Verification Failed';
/** Reason categories used when a manual account request cannot be verified as-is. */
type VerificationFailureReason =
    | 'Employee ID not found'
    | 'Identity mismatch'
    | 'Duplicate personnel record'
    | 'Missing HR1 information'
    | 'Verification unavailable';

/** Suspension is a temporary access restriction. It must always cite an authorized basis, never an arbitrary Admin decision. */
type SuspensionBasis =
    | 'Authorized HR directive'
    | 'Management directive'
    | 'Security incident / suspected compromise'
    | 'Access-policy violation'
    | 'Temporary investigation hold'
    | 'Other authorized reason';

/** Deactivation ends P&D access based on a valid lifecycle/authorization basis. It never changes official HR1 employment status. */
type DeactivationBasis =
    | 'HR1/Core HR indicates inactive/resigned/terminated status'
    | 'Approved HR/management directive'
    | 'Approved end of access requirement'
    | 'Other legitimate organizational reason';

type ActivityEvent = { id: string; label: string; detail: string; occurredAt: string };
type CommunicationType = 'In-App' | 'Email' | 'Call Note' | 'Internal Note' | 'Support Case';
type CommunicationEvent = {
    id: string;
    type: CommunicationType;
    subject: string;
    body: string;
    outcome?: string;
    occurredAt: string;
};
type AIRecommendation = {
    id: string;
    title: string;
    reason: string;
    targetModule: 'learning' | 'training' | 'competency';
    status: RecommendationStatus;
};
type LearningCourseProgress = {
    courseCode: string;
    title: string;
    progressPercent: number;
    stage: string;
    status: string;
    assignedAt?: string | null;
    dueAt?: string | null;
    completedAt?: string | null;
    preTest: {
        status: string;
        scorePercent?: number | null;
        attemptNumber: number;
        submittedAt?: string | null;
    };
    postTest: {
        status: string;
        scorePercent?: number | null;
        attemptsUsed: number;
        attemptsAllowed: number;
        submittedAt?: string | null;
    };
    modules: { order: number; title: string }[];
    certificateEnabled: boolean;
    certificate?: {
        certificate_number?: string;
        status?: string;
        issued_on?: string;
        expires_on?: string | null;
    } | null;
};
type DevelopmentModuleSummary = {
    headline: string;
    detail: string;
    metric?: string | null;
};
type DevelopmentOverview = {
    performance: DevelopmentModuleSummary;
    competencies: DevelopmentModuleSummary;
    learning: DevelopmentModuleSummary & { currentCourse?: LearningCourseProgress | null };
    training: DevelopmentModuleSummary;
    recognition: DevelopmentModuleSummary;
    succession: DevelopmentModuleSummary;
    recommendations: AIRecommendation[];
};
type CareerSummary = {
    personClass?: string | null;
    developmentStatus?: string | null;
    promotionTrack?: string | null;
    successionRole?: string | null;
    readiness?: string | null;
    careerNote?: string | null;
};
type UserRecord = {
    id: string;
    databaseId?: number;
    corePersonId: string;
    employeeOrTraineeId: string;
    fullName: string;
    email: string;
    position: string;
    department: string;
    accessRole: AccessRole;
    personType: PersonType;
    employmentStatus: EmploymentStatus;
    accountStatus: AccountStatus;
    activationStatus: ActivationStatus;
    authenticationStatus: 'Enabled' | 'Restricted' | 'Pending Setup';
    createdAt: string;
    lastLogin: string;
    failedSignInCount: number;
    locked?: boolean;
    mfaStatus: 'Enabled' | 'Not Enrolled';
    mfaMethod: string;
    directManagerName: string;
    directManagerPosition?: string | null;
    evaluatorCapable: boolean;
    accessChangedAt?: string | null;
    accessReason?: string | null;
    accessReference?: string | null;
    accessAuthorizedBy?: string | null;
    career: CareerSummary;
    development: DevelopmentOverview;
    activity: ActivityEvent[];
    communications: CommunicationEvent[];
    // Legacy/local-only fields remain optional while Incoming/verification flows are finalized later.
    sourceSystem?: SourceSystem;
    syncStatus?: SyncStatus;
    startDate?: string;
    phone?: string;
    location?: string;
    archivedAt?: string;
    archiveReason?: string;
    archiveNotes?: string;
};
type IncomingRecord = {
    id: string;
    corePersonId: string;
    employeeOrTraineeId: string;
    fullName: string;
    position: string;
    department: string;
    startDate: string;
    receivedOn: string;
    syncStatus: SyncStatus;
    accountStatus: AccountStatus;
    sourceSystem: SourceSystem;
    officialEmail: string;
    linkedUserId?: string;
    duplicateWithUserId?: string;
    note?: string;
};
type AccountIssue = {
    id: string;
    issue: string;
    source: 'HR1' | 'Manual' | 'System';
    detectedOn: string;
    priority: IssuePriority;
    status: IssueStatus;
    userId?: string;
    incomingRecordId?: string;
    subjectName?: string;
    subjectId?: string;
};
type PersonnelOption = {
    id: string;
    corePersonId: string;
    employeeOrTraineeId: string;
    fullName: string;
    email: string;
    position: string;
    department: string;
    /** Whether trusted HR1/Core HR information indicates legitimate Human Resources membership or approved HR responsibility. Never inferred from Performance, Competency, Succession, or AI signals. */
    hrEligible: boolean;
};
/** A manually-entered account request awaiting confirmation that the claimed person legitimately exists in HR1/Core HR. Never counted as a provisioned account until verified. */
type PendingVerificationRecord = {
    id: string;
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    department: string;
    requestedRole: AccessRole;
    personType: PersonType;
    requestedBy: string;
    reason: string;
    notes?: string;
    submittedAt: string;
    status: VerificationStatus;
    failureReason?: VerificationFailureReason;
};
type DirectoryState = {
    users: UserRecord[];
    incomingRecords: IncomingRecord[];
    issues: AccountIssue[];
    pendingVerifications: PendingVerificationRecord[];
};
type ToastMessage = { tone: ToastTone; message: string };
type InviteMode = 'choice' | 'existing' | 'manual';
type PendingAction =
    | {
          entity: 'user';
          entityId: string;
          action: 'resendActivation' | 'sendPasswordReset' | 'unlock' | 'activate' | 'archive' | 'restore';
          title: string;
          description: string;
          payload?: string;
      }
    | {
          entity: 'incoming';
          entityId: string;
          action: 'retryProvisioning' | 'resolveDuplicate' | 'resendActivation' | 'reviewError' | 'requestCorrection';
          title: string;
          description: string;
      }
    | {
          entity: 'issue';
          entityId: string;
          action:
              | 'markResolved'
              | 'resendActivation'
              | 'sendPasswordReset'
              | 'unlock'
              | 'retrySync'
              | 'resolveDuplicate'
              | 'correctAccessRole'
              | 'requestCorrection';
          title: string;
          description: string;
      };
/** Structured, audit-ready justification captured whenever an account is suspended. */
type SuspendFormState = {
    basis: SuspensionBasis;
    justification: string;
    referenceNumber: string;
    supportingNotes: string;
    authorizedBy: string;
    isSecurityEmergency: boolean;
    confirmed: boolean;
};
/** Structured, audit-ready justification captured whenever P&D access is deactivated. */
type DeactivateFormState = {
    basis: DeactivationBasis;
    reason: string;
    referenceNumber: string;
    notes: string;
    confirmed: boolean;
};
type ManualForm = {
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    department: string;
    accessRole: AccessRole;
    personType: PersonType;
    reason: string;
    notes: string;
};
type InviteExistingStep = 'role' | 'personnel' | 'confirm';

const ITEMS_PER_PAGE = 10;
const ACCESS_ROLE_OPTIONS: AccessRole[] = ['Admin', 'HR', 'User'];
// Admin is never a normal invitation role. Privileged P&D roles must come from authorized personnel/governance data.
const INVITE_ROLE_OPTIONS: InvitableRole[] = ['User', 'HR'];
const ACCOUNT_STATUS_OPTIONS: AccountStatus[] = ['Pending Activation', 'Active', 'Suspended', 'Inactive'];
const PERSON_TYPE_OPTIONS: PersonType[] = ['Employee', 'Trainee'];
const ISSUE_CATEGORIES = [
    'Login Issue',
    'Activation Issue',
    'Password Issue',
    'Locked Account',
    'Incorrect Email',
    'Role/Access Issue',
    'HR1 Sync Issue',
    'Duplicate Record',
    'Other',
];
const VERIFICATION_FAILURE_REASONS: VerificationFailureReason[] = [
    'Employee ID not found',
    'Identity mismatch',
    'Duplicate personnel record',
    'Missing HR1 information',
    'Verification unavailable',
];
const SUSPENSION_BASIS_OPTIONS: SuspensionBasis[] = [
    'Authorized HR directive',
    'Management directive',
    'Security incident / suspected compromise',
    'Access-policy violation',
    'Temporary investigation hold',
    'Other authorized reason',
];
const DEACTIVATION_BASIS_OPTIONS: DeactivationBasis[] = [
    'HR1/Core HR indicates inactive/resigned/terminated status',
    'Approved HR/management directive',
    'Approved end of access requirement',
    'Other legitimate organizational reason',
];
const VERIFICATION_WINDOW_LABEL = 'Up to 48 hours';

function buildHref(routeName: string, params?: Record<string, string | number | undefined>): string {
    if (typeof route === 'undefined') return '#';
    if (!route().has(routeName)) return '#';
    return params ? route(routeName, params) : route(routeName);
}
function makeId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowLabel(): string {
    return new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
function dateLabel(value?: string | null): string {
    if (!value) return 'Not set';
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function initials(name: string): string {
    return name.split(' ').map((v) => v[0]).slice(0, 2).join('').toUpperCase();
}
function avatarTone(seed: string): string {
    const colors = ['bg-amber-500', 'bg-sky-500', 'bg-emerald-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-violet-500'];
    const i = seed.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % colors.length;
    return colors[i];
}
function badgeClass(type: BadgeType, value: string): string {
    const maps: Record<string, Record<string, string>> = {
        role: { Admin: 'bg-slate-900 text-white', HR: 'bg-amber-100 text-amber-800', User: 'bg-sky-100 text-sky-700' },
        person: { Employee: 'bg-violet-100 text-violet-700', Trainee: 'bg-emerald-100 text-emerald-700', 'System Account': 'bg-slate-900 text-white' },
        account: {
            'Not Provisioned': 'bg-slate-100 text-slate-700',
            Provisioning: 'bg-sky-100 text-sky-700',
            'Pending Activation': 'bg-amber-100 text-amber-800',
            Active: 'bg-emerald-100 text-emerald-700',
            Suspended: 'bg-rose-100 text-rose-700',
            Inactive: 'bg-zinc-100 text-zinc-700',
            Archived: 'bg-slate-200 text-slate-700',
        },
        source: { HR1: 'bg-slate-100 text-slate-700', Manual: 'bg-orange-100 text-orange-700' },
        sync: {
            Received: 'bg-slate-100 text-slate-700',
            Validating: 'bg-sky-100 text-sky-700',
            Synced: 'bg-emerald-100 text-emerald-700',
            'Needs Review': 'bg-amber-100 text-amber-800',
            Failed: 'bg-rose-100 text-rose-700',
            'Duplicate Detected': 'bg-orange-100 text-orange-700',
        },
        priority: { High: 'bg-rose-100 text-rose-700', Medium: 'bg-amber-100 text-amber-800', Low: 'bg-sky-100 text-sky-700' },
        verification: {
            'Pending HR1 Verification': 'bg-amber-100 text-amber-800',
            'Needs Review': 'bg-rose-100 text-rose-700',
            Verified: 'bg-emerald-100 text-emerald-700',
            'Verification Failed': 'bg-rose-100 text-rose-700',
        },
        issue: { Open: 'bg-rose-100 text-rose-700', 'In Progress': 'bg-amber-100 text-amber-800', Resolved: 'bg-emerald-100 text-emerald-700' },
        communication: {
            'In-App': 'bg-sky-100 text-sky-700',
            Email: 'bg-indigo-100 text-indigo-700',
            'Call Note': 'bg-emerald-100 text-emerald-700',
            'Internal Note': 'bg-amber-100 text-amber-800',
            'Support Case': 'bg-rose-100 text-rose-700',
        },
    };
    return maps[type][value] ?? 'bg-slate-100 text-slate-600';
}
function toastClass(tone: ToastTone): string {
    return {
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        info: 'border-sky-200 bg-sky-50 text-sky-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
    }[tone];
}
function activity(label: string, detail: string, occurredAt: string): ActivityEvent {
    return { id: makeId('act'), label, detail, occurredAt };
}
function recommendation(title: string, reason: string, targetModule: AIRecommendation['targetModule']): AIRecommendation {
    return { id: makeId('rec'), title, reason, targetModule, status: 'Recommended' };
}
function development(_personType: PersonType, _department: string, _accessRole: AccessRole): DevelopmentOverview {
    return {
        performance: { headline: 'No finalized review', detail: 'No finalized performance evidence.', metric: '0 active goals' },
        competencies: { headline: 'Competency profile', detail: 'Open Competency for governed proficiency evidence.', metric: null },
        learning: { headline: '0 completed · 0 in progress', detail: '0 not started', metric: '0 certificates' },
        training: { headline: 'No training record', detail: 'No persisted training enrollment.', metric: '0 certificates' },
        recognition: { headline: '0 recognized records', detail: 'No approved recognition recorded.', metric: null },
        succession: { headline: 'Not in succession pipeline', detail: 'No active succession role', metric: null },
        recommendations: [],
    };
}

function appendActivity(user: UserRecord, label: string, detail: string, occurredAt: string): UserRecord {
    return { ...user, activity: [activity(label, detail, occurredAt), ...user.activity] };
}
function makeUser(input: Omit<UserRecord, 'development' | 'activity' | 'communications' | 'authenticationStatus' | 'mfaStatus' | 'mfaMethod' | 'directManagerName' | 'evaluatorCapable' | 'career'>): UserRecord {
    const items = [
        activity('Account provisioned', `${input.sourceSystem} account setup completed.`, input.createdAt),
        input.activationStatus === 'Activated'
            ? activity('Account activated', 'Activation completed by the user.', input.createdAt)
            : activity('Activation invitation sent', 'Activation flow is ready for completion.', input.createdAt),
    ];
    if (input.accountStatus === 'Archived') {
        items.unshift(activity('Account archived', input.archiveReason ?? 'Archived for lifecycle management.', input.archivedAt ?? input.createdAt));
    }
    if (input.locked) {
        items.unshift(activity('Account access restricted', 'Access restriction recorded for this account.', input.createdAt));
    }
    return {
        ...input,
        authenticationStatus: input.accountStatus === 'Pending Activation' ? 'Pending Setup' : 'Enabled',
        mfaStatus: 'Not Enrolled',
        mfaMethod: 'Not configured',
        directManagerName: 'No direct supervisor recorded',
        evaluatorCapable: false,
        career: {},
        communications: [],
        development: development(input.personType, input.department, input.accessRole),
        activity: items,
    };
}

// Styled to match the "CONTACT INFORMATION" cards in the reference image
function infoTile(icon: LucideIcon, label: string, value: ReactNode) {
    const Icon = icon;
    return (
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
                <div className="mt-0.5 text-sm font-bold text-slate-900 truncate">{value}</div>
            </div>
        </div>
    );
}

function moduleRoute(key: 'performance' | 'competency' | 'learning' | 'training' | 'recognition' | 'succession'): string {
    const prefix = route().current('hr.*') ? 'hr' : 'admin';
    return `${prefix}.${key}.index`;
}

// User Management is hydrated from the persistent users/security/module records supplied by Laravel.
// No frontend personnel directory or generated employee list is used as a source of truth.
const initialState: DirectoryState = {
    users: [],
    incomingRecords: [],
    issues: [],
    pendingVerifications: [],
};

type UserManagementPageProps = {
    initialUserDirectoryState?: DirectoryState;
    availablePersonnel?: PersonnelOption[];
    userDirectorySource?: {
        label: string;
        personnelSource: string;
        incomingSourceConnected: boolean;
    };
};

function normalizeDirectoryState(value?: DirectoryState): DirectoryState {
    if (!value) return initialState;
    return {
        users: Array.isArray(value.users) ? value.users : [],
        incomingRecords: Array.isArray(value.incomingRecords) ? value.incomingRecords : [],
        issues: Array.isArray(value.issues) ? value.issues : [],
        pendingVerifications: Array.isArray(value.pendingVerifications) ? value.pendingVerifications : [],
    };
}

/* ---------------------------------------------------------------------- */
/* Small shared UI pieces                                                 */
/* ---------------------------------------------------------------------- */

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mql.matches);
        const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
        mql.addEventListener?.('change', listener);
        return () => mql.removeEventListener?.('change', listener);
    }, []);
    return reduced;
}

// Updated Avatar to support the rounded-square dark mode design from the image
function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
    const isLg = size === 'lg';
    return (
        <div className={`flex shrink-0 items-center justify-center font-extrabold text-white ${
            isLg ? 'h-16 w-16 rounded-2xl text-2xl bg-[#F4B400] shadow-sm' : `h-9 w-9 rounded-full text-xs shadow-inner ring-2 ring-white ${avatarTone(name)}`
        }`}>
            {initials(name)}
        </div>
    );
}

function Badge({ type, value }: { type: BadgeType; value: string }) {
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(type, value)}`}>{value}</span>;
}

function SummaryCard({ icon, label, value, onClick }: { icon: LucideIcon; label: string; value: number | string; onClick: () => void }) {
    const Icon = icon;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Open ${label}`}
            className="app-kpi-card group w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-slate-950">{value}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </button>
    );
}

function ToastBanner({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-bottom-4 duration-300 ${toastClass(toast.tone)}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={onClose} className="text-current hover:opacity-70 transition-opacity">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 transition-opacity animate-in fade-in duration-200">
            <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-white shadow-xl transition-transform duration-300 ease-out animate-in zoom-in-95`}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h3 className="text-base font-bold text-slate-900">{title}</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[75vh] overflow-y-auto px-5 py-4 custom-scrollbar">{children}</div>
            </div>
        </div>
    );
}

function ConfirmDialog({ action, onCancel, onConfirm }: { action: PendingAction; onCancel: () => void; onConfirm: () => void }) {
    return (
        <Modal title={action.title} onClose={onCancel}>
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-sm text-slate-600 mt-1">{action.description}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                    Cancel
                </button>
                <button type="button" onClick={onConfirm} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                    Confirm
                </button>
            </div>
        </Modal>
    );
}

function ArchiveConfirmDialog({
    userName,
    onCancel,
    onConfirm,
}: {
    userName: string;
    onCancel: () => void;
    onConfirm: (reason: string, notes: string) => void;
}) {
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    return (
        <Modal title="Archive User Account" onClose={onCancel}>
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-sm text-slate-600 mt-1">
                    <span className="font-semibold text-slate-800">{userName}</span> will lose normal system access while historical records remain retained.
                </p>
            </div>

            <div className="mt-4 space-y-4">
                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                        Archive Reason <span className="text-rose-500">*</span>
                    </label>
                    <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Resigned, End of engagement, Duplicate account"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Notes (optional)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Additional context for this archive action..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none custom-scrollbar"
                    />
                </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!reason.trim()}
                    onClick={() => onConfirm(reason.trim(), notes.trim())}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none"
                >
                    Confirm Archive
                </button>
            </div>
        </Modal>
    );
}

function SuspendAccountDialog({
    user,
    onCancel,
    onConfirm,
}: {
    user: UserRecord;
    onCancel: () => void;
    onConfirm: (form: SuspendFormState) => void;
}) {
    const [form, setForm] = useState<SuspendFormState>({
        basis: 'Authorized HR directive',
        justification: '',
        referenceNumber: '',
        supportingNotes: '',
        authorizedBy: '',
        isSecurityEmergency: false,
        confirmed: false,
    });

    const canSubmit = form.basis && form.justification.trim().length > 0 && form.confirmed;

    function toggleEmergency() {
        setForm((f) => ({
            ...f,
            isSecurityEmergency: !f.isSecurityEmergency,
            basis: !f.isSecurityEmergency ? 'Security incident / suspected compromise' : f.basis,
        }));
    }

    return (
        <Modal title="Suspend Account" onClose={onCancel} wide>
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {infoTile(UserCircle2, 'Employee/User', user.fullName)}
                    {infoTile(ClipboardList, 'Employee ID', user.employeeOrTraineeId)}
                    {infoTile(Building2, 'Department', user.department)}
                    {infoTile(Check, 'Current Account Status', <Badge type="account" value={user.accountStatus} />)}
                </div>

                <button
                    type="button"
                    onClick={toggleEmergency}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none ${
                        form.isSecurityEmergency ? 'border-rose-300 bg-rose-50/70' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${form.isSecurityEmergency ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span>
                        <span className="block text-sm font-bold text-slate-900">Security emergency — restrict access immediately</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                            Use only when the account appears compromised or presents an immediate security risk. This is a temporary access
                            security action, not an employment disciplinary decision — it still requires a reason and is fully logged.
                        </span>
                    </span>
                </button>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                        Suspension Basis <span className="text-rose-500">*</span>
                    </label>
                    <SystemSelect
                        value={form.basis}
                        onChange={(e) => setForm({ ...form, basis: e.target.value as SuspensionBasis })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                    >
                        {SUSPENSION_BASIS_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </SystemSelect>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                        Reason / Justification <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                        value={form.justification}
                        onChange={(e) => setForm({ ...form, justification: e.target.value })}
                        rows={3}
                        placeholder="Explain the operational, HR, management, or security basis for this restriction."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none custom-scrollbar"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Case / Reference Number (optional)</label>
                        <input
                            value={form.referenceNumber}
                            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                            placeholder="e.g. HR-CASE-2026-014"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Requested/Authorized By (where applicable)</label>
                        <input
                            value={form.authorizedBy}
                            onChange={(e) => setForm({ ...form, authorizedBy: e.target.value })}
                            placeholder="e.g. HR Director name"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Supporting Notes (optional)</label>
                    <textarea
                        value={form.supportingNotes}
                        onChange={(e) => setForm({ ...form, supportingNotes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none custom-scrollbar"
                    />
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700">
                    <input
                        type="checkbox"
                        checked={form.confirmed}
                        onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
                        className="mt-0.5 h-4 w-4 accent-[#F4B400]"
                    />
                    I confirm that this account restriction is based on an authorized operational, HR, management, or security requirement.
                </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => onConfirm(form)}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none"
                >
                    Suspend Account
                </button>
            </div>
        </Modal>
    );
}

function DeactivateAccessDialog({
    user,
    onCancel,
    onConfirm,
}: {
    user: UserRecord;
    onCancel: () => void;
    onConfirm: (form: DeactivateFormState) => void;
}) {
    const [form, setForm] = useState<DeactivateFormState>({
        basis: 'Approved HR/management directive',
        reason: '',
        referenceNumber: '',
        notes: '',
        confirmed: false,
    });

    const canSubmit = form.reason.trim().length > 0 && form.confirmed;

    return (
        <Modal title="Deactivate P&D Access" onClose={onCancel} wide>
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {infoTile(UserCircle2, 'Employee/User', user.fullName)}
                    {infoTile(ClipboardList, 'Employee ID', user.employeeOrTraineeId)}
                    {infoTile(Building2, 'Department', user.department)}
                    {infoTile(Check, 'Current Account Status', <Badge type="account" value={user.accountStatus} />)}
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-[#F4B400]/30 bg-[#F4B400]/10 p-3 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F4B400]" />
                    <p>This only removes access to the P&amp;D service. It does not change {user.fullName}&apos;s official employment status in HR1.</p>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                        Authorization / Source <span className="text-rose-500">*</span>
                    </label>
                    <SystemSelect
                        value={form.basis}
                        onChange={(e) => setForm({ ...form, basis: e.target.value as DeactivationBasis })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                    >
                        {DEACTIVATION_BASIS_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </SystemSelect>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                        Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        rows={3}
                        placeholder="Explain the valid lifecycle or authorized basis for ending P&D access."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none custom-scrollbar"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Reference Number (optional)</label>
                    <input
                        value={form.referenceNumber}
                        onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Notes (optional)</label>
                    <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none custom-scrollbar"
                    />
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700">
                    <input
                        type="checkbox"
                        checked={form.confirmed}
                        onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
                        className="mt-0.5 h-4 w-4 accent-[#F4B400]"
                    />
                    I confirm this is based on a valid lifecycle event or an authorized HR/management directive, not an arbitrary decision.
                </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => onConfirm(form)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus:outline-none"
                >
                    Deactivate P&D Access
                </button>
            </div>
        </Modal>
    );
}

function VerificationOutcomeDialog({
    record,
    onCancel,
    onConfirm,
}: {
    record: PendingVerificationRecord;
    onCancel: () => void;
    onConfirm: (outcome: 'Verified' | 'Needs Review', failureReason?: VerificationFailureReason) => void;
}) {
    const [outcome, setOutcome] = useState<'Verified' | 'Needs Review'>('Verified');
    const [failureReason, setFailureReason] = useState<VerificationFailureReason>(VERIFICATION_FAILURE_REASONS[0]);

    return (
        <Modal title="Record HR1 Verification Outcome" onClose={onCancel} wide>
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {infoTile(UserCircle2, 'Requested Person', record.fullName)}
                    {infoTile(ClipboardList, 'Employee ID', record.employeeId)}
                    {infoTile(Briefcase, 'Position', record.position)}
                    {infoTile(Building2, 'Department', record.department)}
                    {infoTile(ShieldCheck, 'Requested Role', <Badge type="role" value={record.requestedRole} />)}
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p>
                        This frontend is not yet connected to a real HR1 verification API. Use this only to record the outcome of a
                        verification that was actually performed (e.g. manually with HR1/Core HR), not to fabricate a result.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setOutcome('Verified')}
                        className={`rounded-xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none ${
                            outcome === 'Verified' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Verified
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Identity confirmed in HR1/Core HR. Provision the account and move to Pending Activation.</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setOutcome('Needs Review')}
                        className={`rounded-xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none ${
                            outcome === 'Needs Review' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                            <AlertCircle className="h-4 w-4 text-rose-600" /> Needs Review
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Identity could not be confirmed as-is. Do not provision an account.</p>
                    </button>
                </div>

                {outcome === 'Needs Review' && (
                    <div className="animate-in fade-in duration-200">
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Reason</label>
                        <SystemSelect
                            value={failureReason}
                            onChange={(e) => setFailureReason(e.target.value as VerificationFailureReason)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-rose-400 focus:ring-1 focus:ring-rose-400 focus:outline-none"
                        >
                            {VERIFICATION_FAILURE_REASONS.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </SystemSelect>
                    </div>
                )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => onConfirm(outcome, outcome === 'Needs Review' ? failureReason : undefined)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-1 focus:outline-none ${
                        outcome === 'Verified' ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500' : 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
                    }`}
                >
                    {outcome === 'Verified' ? 'Confirm Verified & Provision' : 'Move to Needs Review'}
                </button>
            </div>
        </Modal>
    );
}

function ActionMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ right: 12, top: 12, bottom: undefined as number | undefined });
    const [scrollState, setScrollState] = useState({ canUp: false, canDown: items.length > 8 });
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const update = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const menuHeight = Math.min(items.length, 8) * 40 + 12;
            const below = window.innerHeight - rect.bottom - 12;
            const above = rect.top - 12;
            const openAbove = below < Math.min(menuHeight, 180) && above > below;
            setPosition(openAbove
                ? { right: Math.max(12, window.innerWidth - rect.right), top: 12, bottom: window.innerHeight - rect.top + 6 }
                : { right: Math.max(12, window.innerWidth - rect.right), top: rect.bottom + 6, bottom: undefined });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open, items.length]);

    const updateScrollState = () => {
        const node = scrollRef.current;
        if (!node) return;
        setScrollState({
            canUp: node.scrollTop > 2,
            canDown: node.scrollTop + node.clientHeight < node.scrollHeight - 2,
        });
    };

    if (items.length === 0) return null;
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label="Open action menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
            >
                <MoreVertical className="h-4 w-4" />
            </button>
            {open && typeof document !== 'undefined' && createPortal(
                <>
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        className="fixed inset-0 cursor-default bg-transparent"
                        style={{ zIndex: 2147482999 }}
                        onMouseDown={() => setOpen(false)}
                    />
                    <div
                        className="pd-theme-portal fixed w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-950/20"
                        style={{ zIndex: 2147483000, right: position.right, top: position.bottom ? undefined : position.top, bottom: position.bottom }}
                    >
                        <div className="relative overflow-hidden rounded-lg">
                            {scrollState.canUp && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-white via-white/85 to-transparent backdrop-blur-[1.5px]" />}
                            <div ref={scrollRef} onScroll={updateScrollState} className="system-dropdown-scroll max-h-[20rem] overflow-y-auto overscroll-contain">
                                {items.map((item) => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => {
                                            setOpen(false);
                                            item.onClick();
                                        }}
                                        className={`block min-h-10 w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-colors focus:outline-none ${item.danger ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            {scrollState.canDown && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9 bg-gradient-to-t from-white via-white/80 to-transparent backdrop-blur-[2px]" />}
                        </div>
                    </div>
                </>,
                document.body,
            )}
        </>
    );
}

/* ---------------------------------------------------------------------- */
/* Analytics Chart                                                        */
/* ---------------------------------------------------------------------- */

function DepartmentAnalytics({ users, currentFilter, onSelect, onClear }: { users: UserRecord[]; currentFilter: string; onSelect: (d: string) => void; onClear: () => void }) {
    const [dateRange, setDateRange] = useState<ChartDateRangeValue>({ ...DEFAULT_CHART_DATE_RANGE, preset: 'all' });
    const scopedUsers = useMemo(() => users.filter((user) => {
        if (dateRange.preset === 'all') return true;
        const parsed = new Date(user.createdAt);
        if (Number.isNaN(parsed.getTime())) return false;
        const iso = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        return dateFallsInChartRange(iso, dateRange);
    }), [users, dateRange]);
    const counts = useMemo(() => {
        const map = new Map<string, number>();
        scopedUsers.forEach(u => map.set(u.department, (map.get(u.department) || 0) + 1));
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [scopedUsers]);

    const max = Math.max(...counts.map(c => c[1]), 1);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#F4B400]" /> Users by Department
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-400">Account creation date scope</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ChartDateRangeControl compact label="User account creation date" value={dateRange} onChange={setDateRange} />
                    {currentFilter !== 'All' && (
                        <button type="button" onClick={onClear} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none transition-colors">
                            Clear Filter
                        </button>
                    )}
                </div>
            </div>
            <div className="space-y-4">
                {!counts.length && <p className="py-8 text-center text-xs text-slate-400">No user accounts were created in this date range.</p>}
                {counts.map(([dept, count]) => {
                    const isActive = currentFilter === dept;
                    return (
                        <button
                            key={dept}
                            type="button"
                            onClick={() => onSelect(dept)}
                            className="group flex w-full items-center gap-4 text-left focus:outline-none"
                            aria-label={`Filter by ${dept}`}
                        >
                            <div className={`w-36 sm:w-48 truncate text-xs font-semibold transition-colors ${isActive ? 'text-slate-900 font-bold' : 'text-slate-600 group-hover:text-slate-900 group-focus-visible:text-slate-900'}`}>
                                {dept}
                            </div>
                            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-50 ring-1 ring-inset ring-slate-100 group-focus-visible:ring-2 group-focus-visible:ring-[#F4B400]">
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-md transition-all duration-500 ease-out ${isActive ? 'bg-[#F4B400]' : 'bg-[#F4B400]/60 group-hover:bg-[#F4B400]/80'}`}
                                    style={{ width: `${(count / max) * 100}%` }}
                                />
                            </div>
                            <div className={`w-8 text-right text-xs transition-colors ${isActive ? 'font-bold text-slate-900' : 'font-semibold text-slate-500 group-hover:text-slate-900'}`}>
                                {count}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/* User Record Details — integrated table morph panel                     */
/* ---------------------------------------------------------------------- */

const CLOSE_ANIMATION_MS = 360;

function UserDetailsDrawer({
    user,
    tab,
    onTabChange,
    onClose,
    onRequestAction,
    onRequestSuspend,
    onRequestDeactivate,
}: {
    user: UserRecord;
    tab: WorkspaceTab;
    onTabChange: (t: WorkspaceTab) => void;
    onClose: () => void;
    onRequestAction: (action: PendingAction) => void;
    onRequestSuspend: (userId: string) => void;
    onRequestDeactivate: (userId: string) => void;
}) {
    const tabs: WorkspaceTab[] = ['Overview', 'Account & Access', 'Development Profile', 'Activity & Audit'];
    const prefersReducedMotion = usePrefersReducedMotion();
    const [isClosing, setIsClosing] = useState(false);
    const closeTimer = useRef<number | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentScrollState, setContentScrollState] = useState({ canUp: false, canDown: false });

    function updateContentScrollState() {
        const node = contentRef.current;
        if (!node) return;
        setContentScrollState({
            canUp: node.scrollTop > 3,
            canDown: node.scrollTop + node.clientHeight < node.scrollHeight - 3,
        });
    }

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const node = contentRef.current;
            if (node) node.scrollTop = 0;
            updateContentScrollState();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [tab, user.id]);

    useEffect(() => {
        const node = contentRef.current;
        if (!node) return;
        const resizeObserver = new ResizeObserver(updateContentScrollState);
        resizeObserver.observe(node);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        return () => {
            if (closeTimer.current) window.clearTimeout(closeTimer.current);
        };
    }, []);

    function handleClose() {
        if (prefersReducedMotion) {
            onClose();
            return;
        }
        setIsClosing(true);
        closeTimer.current = window.setTimeout(onClose, CLOSE_ANIMATION_MS);
    }

    const moduleCards: { key: 'performance' | 'competency' | 'learning' | 'training' | 'succession' | 'recognition'; label: string; summary: DevelopmentModuleSummary }[] = [
        { key: 'performance', label: 'Performance', summary: user.development.performance },
        { key: 'competency', label: 'Competency', summary: user.development.competencies },
        { key: 'learning', label: 'Learning', summary: user.development.learning },
        { key: 'training', label: 'Training', summary: user.development.training },
        { key: 'succession', label: 'Succession', summary: user.development.succession },
        { key: 'recognition', label: 'Recognition', summary: user.development.recognition },
    ];

    return (
        <aside
            aria-label={`${user.fullName} user record details`}
            className={`absolute left-0 right-0 top-0 bottom-0 z-30 flex flex-col overflow-hidden bg-white/97 backdrop-blur-[8px] lg:left-[49%] lg:bottom-[53px] lg:border-l lg:border-slate-200 transition-[opacity,filter,transform] ease-out ${
                prefersReducedMotion ? '' : 'duration-[360ms]'
            } ${isClosing ? 'translate-x-2 opacity-0 blur-sm' : 'translate-x-0 opacity-100 blur-0'} ${
                !isClosing && !prefersReducedMotion ? 'animate-in fade-in duration-300' : ''
            }`}
        >
                <div className="relative z-20 flex-shrink-0 border-b border-slate-200 bg-white">
                    <div className="flex min-h-14 items-center justify-between border-b border-slate-200 px-4">
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#F4B400]" aria-hidden="true" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">User Record Details</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            aria-label="Close user details"
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                        >
                            <X className="h-4.5 w-4.5" />
                        </button>
                    </div>

                    <div className="flex items-start justify-between gap-4 px-4 py-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <Avatar name={user.fullName} size="lg" />
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-lg font-extrabold text-slate-950">{user.fullName}</h3>
                                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                                    {user.position} &middot; {user.department}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                                    <span className="font-mono text-[10px] font-semibold text-slate-400">{user.employeeOrTraineeId}</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        <Badge type="role" value={user.accessRole} />
                                        <Badge type="person" value={user.personType} />
                                        <Badge type="account" value={user.accountStatus} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="hidden min-w-[280px] max-w-[360px] shrink-0 items-center justify-end xl:flex">
                            <div className="min-w-0 text-right">
                                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Career Context</p>
                                <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
                                    {user.career.promotionTrack && (
                                        <span className="max-w-[245px] truncate rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                                            {user.career.promotionTrack}
                                        </span>
                                    )}
                                    {user.career.readiness && (
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                                                user.career.readiness === 'Ready Now'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : user.career.readiness === 'Ready Soon'
                                                      ? 'bg-amber-100 text-amber-700'
                                                      : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {user.career.readiness}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-2 truncate text-[12px] font-extrabold text-slate-900">
                                    {user.career.successionRole ?? user.career.developmentStatus ?? user.position}
                                </p>
                                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                                    {user.career.successionRole ? 'Target role' : 'Current development focus'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {tabs.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => onTabChange(item)}
                                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-[11px] font-bold transition-colors focus-visible:outline-none ${
                                    tab === item ? 'border-[#F4B400] text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
                    {contentScrollState.canUp && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-white via-white/80 to-transparent backdrop-blur-[2px]"
                        />
                    )}
                    <div
                        ref={contentRef}
                        onScroll={updateContentScrollState}
                        className="h-full overflow-y-auto overscroll-contain bg-white px-4 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                    {tab === 'Overview' && (
                        <div key="overview" className="animate-in fade-in duration-200">
                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Personnel Identity</h4>
                            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {infoTile(ClipboardList, 'Employee / Trainee ID', user.employeeOrTraineeId)}
                                {infoTile(Mail, 'Email', user.email)}
                                {infoTile(UserCircle2, 'Person Type', <Badge type="person" value={user.personType} />)}
                                {infoTile(Clock3, 'Employment Status', user.employmentStatus)}
                            </div>

                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Organization</h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {infoTile(Briefcase, 'Position', user.position)}
                                {infoTile(Building2, 'Department', user.department)}
                                {infoTile(UserCircle2, 'Direct Supervisor', (
                                    <span>
                                        {user.directManagerName}
                                        {user.directManagerPosition && <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{user.directManagerPosition}</span>}
                                    </span>
                                ))}
                                {infoTile(ShieldCheck, 'Evaluator Capability', user.evaluatorCapable ? 'Authorized evaluator' : 'Not an evaluator')}
                            </div>

                            <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Core Person Reference</span>
                                    <span className="font-mono text-xs font-semibold text-slate-600">{user.corePersonId}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'Account & Access' && (
                        <div key="account-access" className="animate-in fade-in duration-200">
                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Account Information</h4>
                            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {infoTile(ShieldCheck, 'P&D Role', <Badge type="role" value={user.accessRole} />)}
                                {infoTile(Check, 'P&D Access Status', <Badge type="account" value={user.accountStatus} />)}
                                {infoTile(Lock, 'Authentication Status', user.authenticationStatus)}
                                {infoTile(ShieldCheck, 'MFA Status', user.mfaStatus)}
                                {infoTile(Mail, 'MFA Method', user.mfaMethod)}
                                {infoTile(Clock3, 'Last Sign-In', user.lastLogin)}
                                {infoTile(CalendarDays, 'Account Created', user.createdAt)}
                                {user.failedSignInCount > 0 && infoTile(AlertCircle, 'Failed Sign-Ins · 30 Days', String(user.failedSignInCount))}
                            </div>

                            {user.accessChangedAt && (
                                <>
                                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Access Governance</h4>
                                    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Access Change</p>
                                                <p className="mt-1 text-sm font-bold text-slate-900">{user.accessChangedAt}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authorized By</p>
                                                <p className="mt-1 text-sm font-bold text-slate-900">{user.accessAuthorizedBy || 'Not recorded'}</p>
                                            </div>
                                            {user.accessReason && (
                                                <div className="sm:col-span-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason</p>
                                                    <p className="mt-1 text-sm text-slate-700">{user.accessReason}</p>
                                                </div>
                                            )}
                                            {user.accessReference && (
                                                <div className="sm:col-span-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reference</p>
                                                    <p className="mt-1 font-mono text-xs font-semibold text-slate-700">{user.accessReference}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Account Management</h4>
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">Credentials &amp; account setup</p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500">Send only the account link appropriate to the current account state.</p>
                                    </div>
                                    <div className="shrink-0">
                                        {user.accountStatus === 'Pending Activation' ? (
                                            <button
                                                type="button"
                                                onClick={() => onRequestAction({
                                                    entity: 'user', entityId: user.id, action: 'resendActivation', title: 'Resend Account Setup',
                                                    description: `Resend the account setup link to ${user.fullName}?`,
                                                })}
                                                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                                            >
                                                Resend Account Setup
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onRequestAction({
                                                    entity: 'user', entityId: user.id, action: 'sendPasswordReset', title: 'Send Password Reset',
                                                    description: `Send a password reset link to ${user.fullName}?`,
                                                })}
                                                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                                            >
                                                Send Password Reset
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 px-4 py-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-bold text-slate-900">P&amp;D access status</p>
                                                <Badge type="account" value={user.accountStatus} />
                                            </div>
                                            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">Suspend access temporarily, deactivate P&amp;D access when authorized, or restore access after the governing condition is resolved.</p>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            {user.accountStatus === 'Active' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRequestSuspend(user.id)}
                                                        className="rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-400 focus:outline-none"
                                                    >
                                                        Suspend
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRequestDeactivate(user.id)}
                                                        className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                                                    >
                                                        Deactivate P&amp;D
                                                    </button>
                                                </>
                                            )}
                                            {(user.accountStatus === 'Suspended' || user.accountStatus === 'Inactive') && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRequestAction({
                                                        entity: 'user', entityId: user.id, action: 'activate', title: 'Restore P&D Access',
                                                        description: `Restore active P&D access for ${user.fullName}?`,
                                                    })}
                                                    className="rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none"
                                                >
                                                    Restore P&amp;D Access
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 px-4 py-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Personnel account lifecycle</p>
                                            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">Archive only when the active personnel record should leave the directory. Historical P&amp;D evidence remains retained.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onRequestAction({
                                                entity: 'user', entityId: user.id, action: 'archive', title: 'Archive User Account',
                                                description: 'Move this personnel account into governed retention. Historical P&D records remain preserved.',
                                            })}
                                            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-300 focus:outline-none"
                                        >
                                            Archive Account
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                                <p className="text-xs leading-relaxed text-slate-600">
                                    <span className="font-bold text-slate-700">Role governance:</span> P&amp;D roles are read-only in this directory and come from authorized personnel/governance records. An ordinary employee is not elevated to HR or Administrator access from User Management.
                                </p>
                            </div>
                        </div>
                    )}

                    {tab === 'Development Profile' && (
                        <div key="development-profile" className="animate-in fade-in duration-200">
                            {(user.career.developmentStatus || user.career.promotionTrack || user.career.successionRole || user.career.careerNote || user.development.learning.currentCourse) && (
                                <>
                                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Career & Development Context</h4>
                                    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Development Status</p>
                                                <p className="mt-1 text-sm font-bold text-slate-900">{user.career.developmentStatus || 'No development status recorded'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Career / Promotion Track</p>
                                                <p className="mt-1 text-sm font-bold text-slate-900">{user.career.promotionTrack || 'No active promotion track'}</p>
                                            </div>
                                            {user.career.successionRole && (
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Succession Target</p>
                                                    <p className="mt-1 text-sm font-bold text-slate-900">{user.career.successionRole}</p>
                                                </div>
                                            )}
                                            {user.career.readiness && (
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Readiness</p>
                                                    <p className="mt-1 text-sm font-bold text-slate-900">{user.career.readiness}</p>
                                                </div>
                                            )}
                                            {user.career.careerNote && (
                                                <div className="sm:col-span-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Development Note</p>
                                                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{user.career.careerNote}</p>
                                                </div>
                                            )}
                                        </div>

                                        {user.development.learning.currentCourse && (() => {
                                            const course = user.development.learning.currentCourse;
                                            const preComplete = course.preTest.status === 'Submitted';
                                            const contentComplete = course.stage === 'Post-Test Retake' || course.progressPercent >= 100;
                                            const contentActive = !contentComplete && course.status === 'In Progress';
                                            const postComplete = course.postTest.status === 'Passed';
                                            const postActive = course.postTest.status === 'Retake Required';
                                            const completionComplete = course.status === 'Completed';
                                            const steps = [
                                                {
                                                    key: 'pre',
                                                    label: 'Pre-Test',
                                                    detail: preComplete
                                                        ? `Submitted${course.preTest.scorePercent != null ? ` · ${course.preTest.scorePercent}%` : ''}`
                                                        : 'Not started',
                                                    state: preComplete ? 'complete' : 'pending',
                                                    icon: ClipboardList,
                                                },
                                                {
                                                    key: 'content',
                                                    label: 'Course Content',
                                                    detail: contentComplete ? 'Required content completed' : `${course.progressPercent}% in progress`,
                                                    state: contentComplete ? 'complete' : (contentActive ? 'active' : 'pending'),
                                                    icon: GraduationCap,
                                                },
                                                {
                                                    key: 'post',
                                                    label: 'Post-Test',
                                                    detail: postComplete
                                                        ? `Passed${course.postTest.scorePercent != null ? ` · ${course.postTest.scorePercent}%` : ''}`
                                                        : postActive
                                                            ? `Retake required · ${course.postTest.attemptsUsed}/${course.postTest.attemptsAllowed} attempts used`
                                                            : course.postTest.status,
                                                    state: postComplete ? 'complete' : (postActive ? 'active' : 'pending'),
                                                    icon: FileText,
                                                },
                                                {
                                                    key: 'completion',
                                                    label: 'Completion',
                                                    detail: completionComplete ? 'Course completed' : 'Pending Post-Test completion',
                                                    state: completionComplete ? 'complete' : 'pending',
                                                    icon: CheckCircle2,
                                                },
                                                ...(course.certificateEnabled ? [{
                                                    key: 'certificate',
                                                    label: 'Certificate',
                                                    detail: course.certificate ? (course.certificate.status || 'Issued') : 'Issued after completion',
                                                    state: course.certificate ? 'complete' : 'pending',
                                                    icon: ShieldCheck,
                                                }] : []),
                                            ] as const;

                                            return (
                                                <div className="mt-5 border-t border-slate-100 pt-5">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Learning Path</p>
                                                            <p className="mt-1 text-sm font-extrabold text-slate-900">{course.title}</p>
                                                            <p className="mt-1 text-[11px] font-semibold text-slate-500">{course.courseCode} · Due {dateLabel(course.dueAt)}</p>
                                                        </div>
                                                        <div className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-700">
                                                            {course.progressPercent}% course progress
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                        <div className="flex min-w-[620px] items-start">
                                                            {steps.map((step, index) => {
                                                                const Icon = step.icon;
                                                                const completed = step.state === 'complete';
                                                                const active = step.state === 'active';
                                                                return (
                                                                    <div key={step.key} className="relative flex flex-1 flex-col items-center px-1 text-center">
                                                                        {index > 0 && (
                                                                            <div className={`absolute right-1/2 top-4 h-0.5 w-full ${completed || active ? 'bg-amber-300' : 'bg-slate-200'}`} />
                                                                        )}
                                                                        <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                                                                            completed
                                                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                                                                                : active
                                                                                    ? 'border-[#F4B400] bg-amber-50 text-amber-700'
                                                                                    : 'border-slate-200 bg-white text-slate-400'
                                                                        }`}>
                                                                            {completed ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Icon className="h-4 w-4" />}
                                                                        </div>
                                                                        <p className={`mt-2 text-[10px] font-extrabold ${active ? 'text-amber-700' : 'text-slate-700'}`}>{step.label}</p>
                                                                        <p className="mt-1 max-w-36 text-[9px] leading-snug text-slate-500">{step.detail}</p>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {course.modules.length > 0 && (
                                                        <div className="mt-4 rounded-lg bg-slate-50/80 px-3.5 py-3">
                                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Course Outline</p>
                                                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                                {course.modules.map((module) => (
                                                                    <div key={`${course.courseCode}-${module.order}`} className="flex items-start gap-2 text-[10px] leading-snug text-slate-600">
                                                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-slate-500 ring-1 ring-slate-200">{module.order}</span>
                                                                        <span className="pt-0.5 font-semibold">{module.title}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}

                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Development Modules</h4>
                            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {moduleCards.map((module) => (
                                    <a
                                        key={module.key}
                                        href={buildHref(moduleRoute(module.key), { user: user.id })}
                                        className="group flex min-h-40 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm outline-none transition-all hover:border-[#F4B400]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#F4B400]"
                                    >
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500">{module.label}</p>
                                            <p className="mt-2 text-sm font-extrabold leading-snug text-slate-900">{module.summary.headline}</p>
                                            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{module.summary.detail}</p>
                                            {module.summary.metric && <p className="mt-2 text-[11px] font-bold text-slate-700">{module.summary.metric}</p>}
                                        </div>
                                        <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase text-[#F4B400]">
                                            Open <ExternalLink className="h-3 w-3" />
                                        </div>
                                    </a>
                                ))}
                            </div>

                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Development Actions</h4>
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                {user.development.recommendations.length === 0 ? (
                                    <p className="text-sm font-medium text-slate-500">No persisted Learning or Training development action is currently linked to this person.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {user.development.recommendations.map((rec) => (
                                            <div key={rec.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">{rec.title}</p>
                                                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{rec.reason}</p>
                                                    </div>
                                                    <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">{rec.status}</span>
                                                </div>
                                                <a
                                                    href={buildHref(moduleRoute(rec.targetModule), { user: user.id })}
                                                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#C88F00] hover:underline focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                                                >
                                                    Open {rec.targetModule.charAt(0).toUpperCase() + rec.targetModule.slice(1)} <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'Activity & Audit' && (
                        <div key="activity-audit" className="animate-in fade-in duration-200">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Account Lifecycle & Administrative Activity</h4>
                                    <p className="mt-1 text-xs text-slate-500">Only personnel/account governance events are summarized here.</p>
                                </div>
                                {route().current('admin.*') && (
                                    <a
                                        href={`${buildHref('admin.settings.index')}#Security%20Logs`}
                                        className="text-xs font-bold text-[#C88F00] hover:underline focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                                    >
                                        View Full Security Logs
                                    </a>
                                )}
                            </div>

                            <div className="space-y-3">
                                {user.activity.map((event) => (
                                    <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="flex gap-4">
                                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <p className="text-sm font-bold text-slate-900">{event.label}</p>
                                                    <span className="text-[10px] font-semibold text-slate-400">{event.occurredAt}</span>
                                                </div>
                                                {event.detail && <p className="mt-1 text-xs leading-relaxed text-slate-600">{event.detail}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    </div>
                    {contentScrollState.canDown && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-white via-white/82 to-transparent backdrop-blur-[2px]"
                        />
                    )}
                </div>
        </aside>
    );
}


/* Add / Invite User modal                                                */
/* ---------------------------------------------------------------------- */

/**
 * Invite Existing Personnel is role-aware: the requested access role is chosen first, and the personnel list is
 * then filtered to only people eligible for that specific role. HR eligibility comes strictly from trusted
 * HR1/Core HR information (the `hrEligible` flag) — never inferred from Performance, Competency, Succession, AI
 * recommendations, or manual guessing. Administrator access is never offered through ordinary invitation or User Management elevation.
 */
function InviteUserModal({
    mode,
    onModeChange,
    onClose,
    query,
    onQueryChange,
    selectedPersonId,
    onSelectPerson,
    role,
    onRoleChange,
    onSubmitExisting,
    manualForm,
    onManualFormChange,
    onSubmitManual,
    existingUsers = [],
    personnelDirectory = [],
}: {
    mode: InviteMode;
    onModeChange: (m: InviteMode) => void;
    onClose: () => void;
    query: string;
    onQueryChange: (v: string) => void;
    selectedPersonId: string | null;
    onSelectPerson: (id: string) => void;
    role: InvitableRole;
    onRoleChange: (r: InvitableRole) => void;
    onSubmitExisting: () => void;
    manualForm: ManualForm;
    onManualFormChange: (f: ManualForm) => void;
    onSubmitManual: () => void;
    existingUsers: UserRecord[];
    personnelDirectory: PersonnelOption[];
}) {
    const [existingStep, setExistingStep] = useState<InviteExistingStep>('role');

    function personHasAccount(p: PersonnelOption): boolean {
    return (existingUsers ?? []).some((u) => u.corePersonId === p.corePersonId && u.accountStatus !== 'Archived');
}

    const eligibleResults = personnelDirectory.filter((p) => {
        if (role === 'HR' && !p.hrEligible) return false;
        if (personHasAccount(p)) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return p.fullName.toLowerCase().includes(q) || p.employeeOrTraineeId.toLowerCase().includes(q);
    });

    const selectedPerson = personnelDirectory.find((p) => p.id === selectedPersonId) ?? null;
    const selectedPersonValid = !!selectedPerson && !personHasAccount(selectedPerson) && (role !== 'HR' || selectedPerson.hrEligible);

    function handleChooseRole(r: InvitableRole) {
        onRoleChange(r);
        onSelectPerson('');
        onQueryChange('');
        setExistingStep('personnel');
    }

    const manualReasonValid = manualForm.reason.trim().length > 0;
    const manualRequiredValid = !!manualForm.fullName && !!manualForm.employeeId && !!manualForm.email && manualReasonValid;

    return (
        <Modal title="Add / Invite User" onClose={onClose} wide={mode !== 'choice'}>
            {mode === 'choice' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-in fade-in duration-300">
                    <button
                        type="button"
                        onClick={() => {
                            setExistingStep('role');
                            onModeChange('existing');
                        }}
                        className="rounded-xl border border-slate-200 p-5 text-left transition hover:border-[#F4B400]/50 hover:bg-[#F4B400]/5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                    >
                        <UserPlus className="h-6 w-6 text-[#F4B400]" />
                        <p className="mt-3 text-sm font-bold text-slate-900">Invite Existing Personnel</p>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">Find an HR1/Core HR person who needs access but doesn&apos;t have a P&amp;D account yet.</p>
                    </button>
                    <button type="button" onClick={() => onModeChange('manual')} className="rounded-xl border border-slate-200 p-5 text-left transition hover:border-[#F4B400]/50 hover:bg-[#F4B400]/5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                        <ShieldCheck className="h-6 w-6 text-[#F4B400]" />
                        <p className="mt-3 text-sm font-bold text-slate-900">Create Internal Account</p>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">Exceptional manual account request, subject to HR1 verification before it is provisioned.</p>
                    </button>
                </div>
            )}

            {mode === 'existing' && existingStep === 'role' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <p className="text-xs text-slate-500">Choose the access role first. The personnel list will then only show people eligible for that specific role.</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => handleChooseRole('User')}
                            className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#F4B400]/50 hover:bg-[#F4B400]/5 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                        >
                            <Badge type="role" value="User" />
                            <p className="mt-2 text-sm font-bold text-slate-900">Normal User Access</p>
                            <p className="mt-1 text-xs text-slate-500">Any HR1/Core HR employee or trainee without a P&amp;D account yet.</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleChooseRole('HR')}
                            className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#F4B400]/50 hover:bg-[#F4B400]/5 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                        >
                            <Badge type="role" value="HR" />
                            <p className="mt-2 text-sm font-bold text-slate-900">HR Access</p>
                            <p className="mt-1 text-xs text-slate-500">Only personnel whose trusted HR1/Core HR record confirms HR membership or approved HR responsibility.</p>
                        </button>
                    </div>
                    <p className="text-[11px] text-slate-400">Administrator access is not offered here. Privileged roles must be provisioned from authorized personnel and governance records.</p>
                </div>
            )}

            {mode === 'existing' && existingStep === 'personnel' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-xs font-semibold text-slate-500">
                            Requested Access Role: <Badge type="role" value={role} />
                        </span>
                        <button type="button" onClick={() => setExistingStep('role')} className="text-xs font-semibold text-[#F4B400] hover:underline focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none rounded-md px-1">
                            Change Role
                        </button>
                    </div>

                    {role === 'HR' && (
                        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <p>HR eligibility verified from HR1/Core HR. Only personnel with confirmed HR membership or approved HR responsibility are listed below.</p>
                        </div>
                    )}

                    <input
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder="Search Employee ID / Name..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                    />
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                        {eligibleResults.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelectPerson(p.id)}
                                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none ${
                                    selectedPersonId === p.id ? 'border-[#F4B400] bg-[#F4B400]/10 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                                }`}
                            >
                                <span className="min-w-0 pr-3">
                                    <span className="font-bold text-slate-800 block truncate">{p.fullName}</span>
                                    <span className="text-xs text-slate-400 block truncate">
                                        {p.position} &middot; {p.department}
                                    </span>
                                </span>
                                <span className="font-mono text-xs font-semibold text-slate-400 shrink-0">{p.employeeOrTraineeId}</span>
                            </button>
                        ))}
                        {eligibleResults.length === 0 && (
                            <p className="py-6 text-center text-sm font-medium text-slate-400 border border-dashed rounded-lg">
                                {role === 'HR' ? 'No HR1/Core HR-eligible HR personnel found.' : 'No matching personnel found.'}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-between pt-2">
                        <button type="button" onClick={() => setExistingStep('role')} className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none rounded-md px-2 py-1">
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={!selectedPersonValid}
                            onClick={() => setExistingStep('confirm')}
                            className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-[#e0a600] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}

            {mode === 'existing' && existingStep === 'confirm' && selectedPerson && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <p className="text-sm font-bold text-slate-900">Send Activation Invitation?</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {infoTile(UserCircle2, 'Name', selectedPerson.fullName)}
                        {infoTile(ClipboardList, 'Employee ID', selectedPerson.employeeOrTraineeId)}
                        {infoTile(Briefcase, 'Position', selectedPerson.position)}
                        {infoTile(Building2, 'Department', selectedPerson.department)}
                        {infoTile(ShieldCheck, 'Requested Access Role', <Badge type="role" value={role} />)}
                        {infoTile(RefreshCw, 'Source', <Badge type="source" value="HR1" />)}
                    </div>
                    <p className="text-xs text-slate-500">An activation invitation will be prepared for this personnel record with the access shown above.</p>
                    <div className="flex justify-between pt-2">
                        <button type="button" onClick={() => setExistingStep('personnel')} className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none rounded-md px-2 py-1">
                            Back
                        </button>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                                Cancel
                            </button>
                            <button type="button" onClick={onSubmitExisting} className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-[#e0a600] focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none">
                                Confirm Invitation
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'manual' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-start gap-2 rounded-xl border border-[#F4B400]/30 bg-[#F4B400]/10 p-3 text-xs text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F4B400]" />
                        <p>This does not create an account immediately. It submits a request for HR1 verification (up to 48 hours) before any account is provisioned.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Full Name</label>
                            <input value={manualForm.fullName} onChange={(e) => onManualFormChange({ ...manualForm, fullName: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Employee ID</label>
                            <input value={manualForm.employeeId} onChange={(e) => onManualFormChange({ ...manualForm, employeeId: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Work Email</label>
                            <input value={manualForm.email} onChange={(e) => onManualFormChange({ ...manualForm, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Position</label>
                            <input value={manualForm.position} onChange={(e) => onManualFormChange({ ...manualForm, position: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Department</label>
                            <input value={manualForm.department} onChange={(e) => onManualFormChange({ ...manualForm, department: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Requested Access Role</label>
                            <SystemSelect value={manualForm.accessRole} onChange={(e) => onManualFormChange({ ...manualForm, accessRole: e.target.value as AccessRole })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none">
                                {ACCESS_ROLE_OPTIONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </SystemSelect>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Person Type</label>
                            <SystemSelect value={manualForm.personType} onChange={(e) => onManualFormChange({ ...manualForm, personType: e.target.value as PersonType })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none">
                                {PERSON_TYPE_OPTIONS.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </SystemSelect>
                        </div>
                    </div>

                    {manualForm.accessRole === 'Admin' && (
                        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>Administrator access is a sensitive request. It still goes through HR1 verification and should be treated as an exceptional case.</p>
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">
                            Reason for Manual Account Creation <span className="text-rose-500">*</span>
                        </label>
                        <input
                            value={manualForm.reason}
                            onChange={(e) => onManualFormChange({ ...manualForm, reason: e.target.value })}
                            placeholder="e.g. Emergency onboarding ahead of HR1 sync"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Optional Notes</label>
                        <textarea
                            value={manualForm.notes}
                            onChange={(e) => onManualFormChange({ ...manualForm, notes: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none custom-scrollbar"
                        />
                    </div>
                    <div className="flex justify-between pt-2">
                        <button type="button" onClick={() => onModeChange('choice')} className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none rounded-md px-2 py-1">
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={!manualRequiredValid}
                            onClick={onSubmitManual}
                            className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-[#e0a600] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none"
                        >
                            Submit for Verification
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

/* ---------------------------------------------------------------------- */
/* Main page                                                              */
/* ---------------------------------------------------------------------- */

function UserManagement() {
    const inertiaPage = usePage();
    const props = inertiaPage.props as typeof inertiaPage.props & UserManagementPageProps;
    const availablePersonnel = props.availablePersonnel ?? [];
    const currentOperatorName = (inertiaPage.props.auth.user as { name?: string }).name ?? 'Current P&D Operator';
    const [state, setState] = useState<DirectoryState>(() => normalizeDirectoryState(props.initialUserDirectoryState));
    useEffect(() => {
        setState(normalizeDirectoryState(props.initialUserDirectoryState));
    }, [props.initialUserDirectoryState]);
    const [activeMajorTab, setActiveMajorTab] = useHashWorkspace<MajorTab>(USER_MANAGEMENT_WORKSPACES, 'All Users');
    
    // Filters
    const [roleFilter, setRoleFilter] = useState<AccessRoleFilter>('All');
    const [statusFilter, setStatusFilter] = useState<'All' | AccountStatus>('All');
    const [personTypeFilter, setPersonTypeFilter] = useState<'All' | PersonType>('All');
    const [departmentFilter, setDepartmentFilter] = useState<string>('All');
    const [positionFilter, setPositionFilter] = useState<string>('All');
    
    const [page, setPage] = useState(1);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [detailsTab, setDetailsTab] = useState<WorkspaceTab>('Overview');

    useEffect(() => {
        setSelectedUserId(null);
        setDetailsTab('Overview');
    }, [activeMajorTab]);
    
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteMode, setInviteMode] = useState<InviteMode>('choice');
    const [invitePersonQuery, setInvitePersonQuery] = useState('');
    const [invitePersonId, setInvitePersonId] = useState<string | null>(null);
    const [inviteRole, setInviteRole] = useState<InvitableRole>('User');
    const [manualForm, setManualForm] = useState<ManualForm>({
        fullName: '',
        employeeId: '',
        email: '',
        position: '',
        department: '',
        accessRole: 'User',
        personType: 'Employee',
        reason: '',
        notes: '',
    });

    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [suspendTargetUserId, setSuspendTargetUserId] = useState<string | null>(null);
    const [deactivateTargetUserId, setDeactivateTargetUserId] = useState<string | null>(null);
    const [verificationTargetId, setVerificationTargetId] = useState<string | null>(null);
    const [toast, setToast] = useState<ToastMessage | null>(null);

    function pushToast(tone: ToastTone, message: string) {
        setToast({ tone, message });
        window.setTimeout(() => setToast(null), 3500);
    }

    const nonArchivedUsers = useMemo(() => state.users.filter((u) => u.accountStatus !== 'Archived'), [state.users]);
    const departments = useMemo(() => Array.from(new Set(nonArchivedUsers.map((u) => u.department))).sort(), [nonArchivedUsers]);
    const positions = useMemo(() => Array.from(new Set(nonArchivedUsers.map((u) => u.position))).sort(), [nonArchivedUsers]);
    const openIssues = useMemo(() => state.issues.filter((i) => i.status !== 'Resolved'), [state.issues]);

    const summary = useMemo(
        () => ({
            total: nonArchivedUsers.length,
            privileged: nonArchivedUsers.filter((u) => u.accessRole === 'Admin' || u.accessRole === 'HR').length,
            employees: nonArchivedUsers.filter((u) => u.personType === 'Employee').length,
            trainees: nonArchivedUsers.filter((u) => u.personType === 'Trainee').length,
        }),
        [nonArchivedUsers],
    );

    const aevynUsersEntrySentRef = useRef(false);

    useEffect(() => {
        if (aevynUsersEntrySentRef.current) return;

        const timer = window.setTimeout(() => {
            if (aevynUsersEntrySentRef.current) return;

            const message =
                openIssues.length > 0
                    ? `${openIssues.length} account ${openIssues.length === 1 ? 'issue needs' : 'issues need'} attention · ${summary.total} governed accounts`
                    : `${summary.total} accounts · ${summary.employees} employees · ${summary.trainees} trainees · ${summary.privileged} privileged`;

            window.dispatchEvent(
                new CustomEvent('aevyn:module-whisper', {
                    detail: {
                        module: 'Users',
                        message,
                        tone: openIssues.length > 0 ? 'warning' : 'info',
                    },
                }),
            );

            aevynUsersEntrySentRef.current = true;
        }, 450);

        return () => window.clearTimeout(timer);
    }, [
        openIssues.length,
        summary.total,
        summary.employees,
        summary.trainees,
        summary.privileged,
    ]);

    const filteredUsers = useMemo(() => {
        return nonArchivedUsers
            .filter((u) => {
                if (roleFilter === 'Admin & HR' && !['Admin', 'HR'].includes(u.accessRole)) return false;
                if (roleFilter !== 'All' && roleFilter !== 'Admin & HR' && u.accessRole !== roleFilter) return false;
                if (statusFilter !== 'All' && u.accountStatus !== statusFilter) return false;
                if (personTypeFilter !== 'All' && u.personType !== personTypeFilter) return false;
                if (departmentFilter !== 'All' && u.department !== departmentFilter) return false;
                if (positionFilter !== 'All' && u.position !== positionFilter) return false;
                return true;
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }, [nonArchivedUsers, roleFilter, statusFilter, personTypeFilter, departmentFilter, positionFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(page, totalPages);
    const pagedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const searchLocation = typeof window === 'undefined'
        ? ''
        : `${window.location.search}${window.location.hash}`;

    useEffect(() => {
        if (typeof window === 'undefined' || activeMajorTab !== 'All Users') return;

        const params = new URLSearchParams(window.location.search);
        const targetTable = (params.get('gs_table') ?? '').trim().toLowerCase();
        const targetRecord = (params.get('gs_record') ?? '').trim();
        const targetMatch = (params.get('gs_match') ?? '').trim().toLowerCase();

        if (targetTable && targetTable !== 'all users') return;
        if (!targetRecord && !targetMatch) return;

        // Global Search must be able to reveal a person even when an old directory
        // filter would otherwise hide that person.
        const filtersAreDefault =
            roleFilter === 'All'
            && statusFilter === 'All'
            && personTypeFilter === 'All'
            && departmentFilter === 'All'
            && positionFilter === 'All';

        if (!filtersAreDefault) {
            setRoleFilter('All');
            setStatusFilter('All');
            setPersonTypeFilter('All');
            setDepartmentFilter('All');
            setPositionFilter('All');
            return;
        }

        const orderedUsers = [...nonArchivedUsers].sort((a, b) =>
            a.fullName.localeCompare(b.fullName),
        );

        const targetIndex = orderedUsers.findIndex((user) =>
            (targetRecord !== '' && (
                user.id === targetRecord
                || String(user.databaseId ?? '') === targetRecord
            ))
            || (targetMatch !== '' && user.fullName.toLowerCase().includes(targetMatch)),
        );

        if (targetIndex < 0) return;

        const targetPage = Math.floor(targetIndex / ITEMS_PER_PAGE) + 1;
        if (page !== targetPage) setPage(targetPage);
    }, [
        activeMajorTab,
        departmentFilter,
        nonArchivedUsers,
        page,
        personTypeFilter,
        positionFilter,
        roleFilter,
        searchLocation,
        statusFilter,
    ]);

    const selectedUser = state.users.find((u) => u.id === selectedUserId) ?? null;
    const suspendTargetUser = state.users.find((u) => u.id === suspendTargetUserId) ?? null;
    const deactivateTargetUser = state.users.find((u) => u.id === deactivateTargetUserId) ?? null;
    const verificationTargetRecord = state.pendingVerifications.find((r) => r.id === verificationTargetId) ?? null;

    function updateUser(id: string, updater: (u: UserRecord) => UserRecord) {
        setState((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === id ? updater(u) : u)) }));
    }
    function updateIncoming(id: string, updater: (r: IncomingRecord) => IncomingRecord) {
        setState((prev) => ({ ...prev, incomingRecords: prev.incomingRecords.map((r) => (r.id === id ? updater(r) : r)) }));
    }
    function updateIssue(id: string, updater: (i: AccountIssue) => AccountIssue) {
        setState((prev) => ({ ...prev, issues: prev.issues.map((i) => (i.id === id ? updater(i) : i)) }));
    }
    function requestAction(action: PendingAction) {
        setPendingAction(action);
    }

    function directoryApiError(error: unknown): string {
        if (axios.isAxiosError(error)) {
            const errors = error.response?.data?.errors as Record<string, string[]> | undefined;
            const first = errors ? Object.values(errors).flat()[0] : undefined;
            return first ?? error.response?.data?.message ?? 'The account change could not be saved.';
        }
        return 'The account change could not be saved.';
    }

    function reloadDirectory(): void {
        router.reload({ only: ['initialUserDirectoryState', 'availablePersonnel', 'userDirectorySource'] });
    }

    async function confirmSuspend(form: SuspendFormState) {
        if (!suspendTargetUser?.databaseId) return;
        try {
            await axios.patch(`/admin/users/${suspendTargetUser.databaseId}/access`, {
                status: 'Suspended',
                reason: `${form.basis}: ${form.justification}${form.supportingNotes ? ` · ${form.supportingNotes}` : ''}`,
                reference: form.referenceNumber || null,
                authorizedBy: form.authorizedBy || currentOperatorName,
                securityEmergency: form.isSecurityEmergency,
            });
            setSuspendTargetUserId(null);
            pushToast('warning', `${suspendTargetUser.fullName}'s P&D access was suspended and active sessions were revoked.`);
            reloadDirectory();
        } catch (error) {
            pushToast('warning', directoryApiError(error));
        }
    }

    async function confirmDeactivate(form: DeactivateFormState) {
        if (!deactivateTargetUser?.databaseId) return;
        try {
            await axios.patch(`/admin/users/${deactivateTargetUser.databaseId}/access`, {
                status: 'Inactive',
                reason: `${form.basis}: ${form.reason}${form.notes ? ` · ${form.notes}` : ''}`,
                reference: form.referenceNumber || null,
                authorizedBy: currentOperatorName,
            });
            setDeactivateTargetUserId(null);
            pushToast('info', `${deactivateTargetUser.fullName}'s P&D access was deactivated and active sessions were revoked.`);
            reloadDirectory();
        } catch (error) {
            pushToast('warning', directoryApiError(error));
        }
    }

    function handleVerificationOutcome(outcome: 'Verified' | 'Needs Review', failureReason?: VerificationFailureReason) {
        if (!verificationTargetRecord) return;
        const record = verificationTargetRecord;
        const ts = nowLabel();

        if (outcome === 'Verified') {
            const newUser = makeUser({
                id: makeId('user'),
                corePersonId: makeId('CORE'),
                employeeOrTraineeId: record.employeeId,
                fullName: record.fullName,
                email: record.email,
                position: record.position || 'Not specified',
                department: record.department || 'Unassigned',
                accessRole: record.requestedRole,
                personType: record.personType,
                employmentStatus: record.personType === 'Trainee' ? 'Trainee' : 'Employee',
                accountStatus: 'Pending Activation',
                sourceSystem: 'Manual',
                activationStatus: 'Not Sent',
                createdAt: ts,
                lastLogin: 'No login yet',
                startDate: ts,
                phone: 'Not on file',
                location: 'Head Office',
                failedSignInCount: 0,
                locked: false,
            });
            setState((prev) => ({
                ...prev,
                users: [appendActivity(newUser, 'HR1 verification completed', `Verified against HR1/Core HR. Requested by ${record.requestedBy}.`, ts), ...prev.users],
                pendingVerifications: prev.pendingVerifications.filter((r) => r.id !== record.id),
            }));
            pushToast('success', `${record.fullName} verified. Account provisioned and set to Pending Activation.`);
        } else {
            const reason = failureReason ?? 'Verification unavailable';
            setState((prev) => ({
                ...prev,
                pendingVerifications: prev.pendingVerifications.map((r) => (r.id === record.id ? { ...r, status: 'Needs Review', failureReason: reason } : r)),
                issues: [
                    {
                        id: makeId('issue'),
                        issue: `Manual account verification needs review: ${reason}`,
                        source: 'Manual',
                        detectedOn: ts,
                        priority: 'Medium',
                        status: 'Open',
                        subjectName: record.fullName,
                        subjectId: record.employeeId,
                    },
                    ...prev.issues,
                ],
            }));
            pushToast('warning', `${record.fullName}'s request needs review: ${reason}.`);
        }
        setVerificationTargetId(null);
    }

    function handleAddCommunication(userId: string, data: Omit<CommunicationEvent, 'id' | 'occurredAt'>) {
        const ts = nowLabel();
        const newComm: CommunicationEvent = { ...data, id: makeId('comm'), occurredAt: ts };

        let actLabel = '';
        let actDetail = '';
        if (data.type === 'In-App' || data.type === 'Email') {
            actLabel = 'Message sent';
            actDetail = `Sent via ${data.type}. Subject: ${data.subject}`;
        } else if (data.type === 'Call Note') {
            actLabel = 'Call note logged';
            actDetail = `Outcome: ${data.outcome}`;
        } else if (data.type === 'Internal Note') {
            actLabel = 'Internal note added';
            actDetail = 'An internal support note was added.';
        }

        setState(prev => ({
            ...prev,
            users: prev.users.map(u => {
                if (u.id === userId) {
                    return {
                        ...u,
                        communications: [newComm, ...u.communications],
                        activity: actLabel ? [activity(actLabel, actDetail, ts), ...u.activity] : u.activity
                    };
                }
                return u;
            })
        }));
        pushToast('success', `${data.type} recorded successfully.`);
    }

    function handleCreateIssue(userId: string, category: string, notes: string) {
        const ts = nowLabel();
        const newIssue: AccountIssue = {
            id: makeId('issue'),
            issue: category,
            source: 'System',
            detectedOn: ts,
            priority: 'Medium',
            status: 'Open',
            userId: userId,
            subjectName: state.users.find(u => u.id === userId)?.fullName
        };

        const newComm: CommunicationEvent = {
            id: makeId('comm'),
            type: 'Support Case',
            subject: category,
            body: notes || 'No additional notes provided.',
            occurredAt: ts
        };

        setState(prev => {
            const updatedUsers = prev.users.map(u => {
                if (u.id === userId) {
                    return {
                        ...u,
                        communications: [newComm, ...u.communications],
                        activity: [activity('Support case created', `Category: ${category}`, ts), ...u.activity]
                    };
                }
                return u;
            });
            return {
                ...prev,
                users: updatedUsers,
                issues: [newIssue, ...prev.issues]
            };
        });
        pushToast('success', 'Account issue created successfully.');
    }

    async function performArchive(userId: string, reason: string, notes: string) {
        const user = state.users.find((candidate) => candidate.id === userId);
        if (!user?.databaseId) return;
        try {
            const fullReason = notes.trim() ? `${reason}. ${notes.trim()}` : reason;
            await axios.post(`/governance/api/settings/accounts/${user.databaseId}/archive`, { reason: fullReason });
            setPendingAction(null);
            pushToast('info', `${user.fullName}'s account was archived with retention governance preserved.`);
            reloadDirectory();
        } catch (error) {
            pushToast('warning', directoryApiError(error));
        }
    }

    async function confirmPendingAction() {
        if (!pendingAction) return;
        const ts = nowLabel();

        if (pendingAction.entity === 'user') {
            const { entityId, action } = pendingAction;
            switch (action) {
                case 'resendActivation': {
                    const user = state.users.find((candidate) => candidate.id === entityId);
                    if (!user?.databaseId) break;
                    try {
                        await axios.post(`/admin/users/${user.databaseId}/access-link`, { purpose: 'account_setup' });
                        pushToast('success', 'Account setup link sent through the configured mail channel.');
                    } catch (error) {
                        pushToast('warning', directoryApiError(error));
                    }
                    break;
                }
                case 'sendPasswordReset': {
                    const user = state.users.find((candidate) => candidate.id === entityId);
                    if (!user?.databaseId) break;
                    try {
                        await axios.post(`/admin/users/${user.databaseId}/access-link`, { purpose: 'password_reset' });
                        pushToast('success', 'Password reset link sent through the configured mail channel.');
                    } catch (error) {
                        pushToast('warning', directoryApiError(error));
                    }
                    break;
                }
                case 'unlock':
                    updateUser(entityId, (u) => appendActivity({ ...u, locked: false, failedSignInCount: 0 }, 'Account unlocked', 'Authorized P&D operator unlocked the account.', ts));
                    pushToast('success', 'Account unlocked.');
                    break;
                case 'activate': {
                    const user = state.users.find((candidate) => candidate.id === entityId);
                    if (!user?.databaseId) break;
                    try {
                        await axios.patch(`/admin/users/${user.databaseId}/access`, {
                            status: 'Active',
                            reason: 'Authorized P&D operator restored P&D access from User Management.',
                            authorizedBy: currentOperatorName,
                        });
                        pushToast('success', 'P&D access restored.');
                        reloadDirectory();
                    } catch (error) {
                        pushToast('warning', directoryApiError(error));
                    }
                    break;
                }
                case 'archive':
                    // Handled by the dedicated ArchiveConfirmDialog / performArchive flow.
                    break;
                case 'restore': {
                    const user = state.users.find((candidate) => candidate.id === entityId);
                    if (!user?.databaseId) break;
                    try {
                        await axios.post(`/governance/api/settings/accounts/${user.databaseId}/restore`, {
                            reason: 'Authorized P&D operator restored this retained account from User Management.',
                        });
                        pushToast('success', 'Account restored.');
                        reloadDirectory();
                    } catch (error) {
                        pushToast('warning', directoryApiError(error));
                    }
                    break;
                }

            }
        }

        if (pendingAction.entity === 'incoming') {
            const { entityId, action } = pendingAction;
            switch (action) {
                case 'retryProvisioning':
                    updateIncoming(entityId, (r) => ({ ...r, syncStatus: 'Synced', accountStatus: 'Pending Activation' }));
                    pushToast('success', 'Provisioning retried.');
                    break;
                case 'resolveDuplicate':
                    updateIncoming(entityId, (r) => ({ ...r, syncStatus: 'Synced' }));
                    pushToast('success', 'Duplicate marked as resolved.');
                    break;
                case 'resendActivation':
                    pushToast('success', 'Activation invitation resent.');
                    break;
                case 'reviewError':
                    pushToast('info', 'Marked for review.');
                    break;
                case 'requestCorrection':
                    updateIncoming(entityId, (r) => ({ ...r, syncStatus: 'Needs Review' }));
                    pushToast('info', 'Correction requested from HR1.');
                    break;
            }
        }

        if (pendingAction.entity === 'issue') {
            const { entityId, action } = pendingAction;
            const issue = state.issues.find((i) => i.id === entityId);
            switch (action) {
                case 'markResolved':
                    updateIssue(entityId, (i) => ({ ...i, status: 'Resolved' }));
                    pushToast('success', 'Issue marked as resolved.');
                    break;
                case 'resendActivation':
                    updateIssue(entityId, (i) => ({ ...i, status: 'In Progress' }));
                    pushToast('success', 'Activation invitation resent.');
                    break;
                case 'sendPasswordReset':
                    updateIssue(entityId, (i) => ({ ...i, status: 'In Progress' }));
                    pushToast('success', 'Password reset link sent.');
                    break;
                case 'unlock':
                    if (issue?.userId) updateUser(issue.userId, (u) => ({ ...u, locked: false, failedSignInCount: 0 }));
                    updateIssue(entityId, (i) => ({ ...i, status: 'Resolved' }));
                    pushToast('success', 'Account unlocked.');
                    break;
                case 'retrySync':
                    updateIssue(entityId, (i) => ({ ...i, status: 'In Progress' }));
                    pushToast('info', 'Sync retried.');
                    break;
                case 'resolveDuplicate':
                    updateIssue(entityId, (i) => ({ ...i, status: 'Resolved' }));
                    pushToast('success', 'Duplicate resolved.');
                    break;
                case 'correctAccessRole':
                    updateIssue(entityId, (i) => ({ ...i, status: 'In Progress' }));
                    pushToast('info', 'Access role correction requested.');
                    break;
                case 'requestCorrection':
                    updateIssue(entityId, (i) => ({ ...i, status: 'In Progress' }));
                    pushToast('info', 'Correction requested from HR1.');
                    break;
            }
        }

        setPendingAction(null);
    }

    function incomingMenuItems(record: IncomingRecord) {
        const items: { label: string; onClick: () => void; danger?: boolean }[] = [
            { label: 'View Incoming Record', onClick: () => pushToast('info', `Viewing ${record.fullName}'s incoming record.`) },
        ];
        if (record.syncStatus === 'Failed' || record.syncStatus === 'Needs Review') {
            items.push({
                label: 'Retry Provisioning',
                onClick: () => requestAction({ entity: 'incoming', entityId: record.id, action: 'retryProvisioning', title: 'Retry Provisioning', description: `Retry provisioning for ${record.fullName}?` }),
            });
            items.push({
                label: 'Request HR1 Correction',
                onClick: () => requestAction({ entity: 'incoming', entityId: record.id, action: 'requestCorrection', title: 'Request HR1 Correction', description: `Ask HR1 to correct ${record.fullName}'s record?` }),
            });
        }
        if (record.syncStatus === 'Duplicate Detected') {
            items.push({
                label: 'Resolve Duplicate',
                onClick: () => requestAction({ entity: 'incoming', entityId: record.id, action: 'resolveDuplicate', title: 'Resolve Duplicate', description: `Mark the duplicate record for ${record.fullName} as resolved?` }),
            });
        }
        if (record.accountStatus === 'Pending Activation') {
            items.push({
                label: 'Resend Account Setup',
                onClick: () => requestAction({ entity: 'incoming', entityId: record.id, action: 'resendActivation', title: 'Resend Account Setup', description: `Resend the account setup link to ${record.fullName}?` }),
            });
        }
        if (record.syncStatus === 'Failed') {
            items.push({
                label: 'Review Error',
                onClick: () => requestAction({ entity: 'incoming', entityId: record.id, action: 'reviewError', title: 'Review Error', description: `Mark ${record.fullName}'s sync error as reviewed?` }),
            });
        }
        return items;
    }

    function issueMenuItems(issue: AccountIssue) {
        const items: { label: string; onClick: () => void; danger?: boolean }[] = [
            {
                label: 'View Details',
                onClick: () => {
                    if (issue.userId) {
                        setSelectedUserId(issue.userId);
                        setDetailsTab('Overview');
                    } else {
                        pushToast('info', 'Viewing issue details.');
                    }
                },
            },
        ];
        const subject = issue.subjectName ?? state.users.find((u) => u.id === issue.userId)?.fullName ?? issue.issue;
        if (issue.status !== 'Resolved') {
            const lowered = issue.issue.toLowerCase();
            if (lowered.includes('activation')) {
                items.push({
                    label: 'Resend Account Setup',
                    onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'resendActivation', title: 'Resend Account Setup', description: `Resend activation invitation for ${subject}?` }),
                });
            }
            if (lowered.includes('password')) {
                items.push({
                    label: 'Send Password Reset',
                    onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'sendPasswordReset', title: 'Send Password Reset', description: `Send a password reset link for ${subject}?` }),
                });
            }
            if (lowered.includes('locked')) {
                items.push({
                    label: 'Unlock Account',
                    onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'unlock', title: 'Unlock Account', description: `Unlock the account for ${subject}?` }),
                });
            }
            if (lowered.includes('sync')) {
                items.push({
                    label: 'Retry Sync',
                    onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'retrySync', title: 'Retry Sync', description: `Retry the HR1 sync for ${subject}?` }),
                });
            }
            if (lowered.includes('duplicate')) {
                items.push({
                    label: 'Resolve Duplicate',
                    onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'resolveDuplicate', title: 'Resolve Duplicate', description: `Resolve the duplicate record for ${subject}?` }),
                });
            }
            if (lowered.includes('mismatch')) {
                items.push({
                    label: 'Request HR1 Correction',
                    onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'requestCorrection', title: 'Request HR1 Correction', description: `Request a correction from HR1 for ${subject}?` }),
                });
            }
            items.push({
                label: 'Mark Resolved',
                onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'markResolved', title: 'Mark Resolved', description: `Mark this issue for ${subject} as resolved?` }),
            });
        }
        return items;
    }

    function openInvite() {
        setInviteOpen(true);
        setInviteMode('choice');
        setInvitePersonQuery('');
        setInvitePersonId(null);
        setInviteRole('User');
        setManualForm({ fullName: '', employeeId: '', email: '', position: '', department: '', accessRole: 'User', personType: 'Employee', reason: '', notes: '' });
    }

    function submitExistingInvite() {
        const person = availablePersonnel.find((p) => p.id === invitePersonId);
        if (!person) {
            pushToast('warning', 'Select a person to invite first.');
            return;
        }
        const alreadyHasAccount = state.users.some((u) => u.corePersonId === person.corePersonId && u.accountStatus !== 'Archived');
        if (alreadyHasAccount) {
            pushToast('warning', `${person.fullName} already has a P&D account. Invitation cannot be sent.`);
            return;
        }
        if (inviteRole === 'HR' && !person.hrEligible) {
            pushToast('warning', `${person.fullName} is not eligible for HR access based on HR1/Core HR records.`);
            return;
        }
        const newUser = makeUser({
            id: makeId('user'),
            corePersonId: person.corePersonId,
            employeeOrTraineeId: person.employeeOrTraineeId,
            fullName: person.fullName,
            email: person.email,
            position: person.position,
            department: person.department,
            accessRole: inviteRole,
            personType: 'Employee',
            employmentStatus: 'Employee',
            accountStatus: 'Pending Activation',
            sourceSystem: 'Manual',
            activationStatus: 'Invitation Sent',
            createdAt: nowLabel(),
            lastLogin: 'No login yet',
            startDate: nowLabel(),
            phone: 'On file with HR1',
            location: 'Head Office',
            failedSignInCount: 0,
            locked: false,
        });
        setState((prev) => ({ ...prev, users: [newUser, ...prev.users] }));
        pushToast('success', `Activation invitation prepared for ${person.fullName}.`);
        setInviteOpen(false);
    }

    function submitManualCreate() {
        if (!manualForm.fullName || !manualForm.email || !manualForm.employeeId) {
            pushToast('warning', 'Fill in name, employee ID, and email first.');
            return;
        }
        if (!manualForm.reason.trim()) {
            pushToast('warning', 'A reason for manual account creation is required.');
            return;
        }
        const ts = nowLabel();
        const newRecord: PendingVerificationRecord = {
            id: makeId('pv'),
            fullName: manualForm.fullName,
            employeeId: manualForm.employeeId,
            email: manualForm.email,
            position: manualForm.position || 'Not specified',
            department: manualForm.department || 'Unassigned',
            requestedRole: manualForm.accessRole,
            personType: manualForm.personType,
            requestedBy: currentOperatorName,
            reason: manualForm.reason,
            notes: manualForm.notes || undefined,
            submittedAt: ts,
            status: 'Pending HR1 Verification',
        };
        setState((prev) => ({ ...prev, pendingVerifications: [newRecord, ...prev.pendingVerifications] }));
        pushToast('info', `${manualForm.fullName}'s request was submitted for HR1 verification (up to 48 hours).`);
        setInviteOpen(false);
    }

    const tabCounts: Record<MajorTab, number> = {
        'All Users': filteredUsers.length,
        'Incoming Trainees': state.incomingRecords.length,
        'Account Issues': openIssues.length,
    };

    const userColumns = [
        {
            key: 'employee',
            header: 'Employee',
            className: 'w-[24%]',
            render: (u: UserRecord) => (
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.fullName} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{u.fullName}</p>
                        <p className="truncate text-xs text-slate-400">{u.position}</p>
                    </div>
                </div>
            ),
        },
        { key: 'id', header: 'Personnel ID', className: 'w-[11%]', render: (u: UserRecord) => <span className="font-mono text-xs font-medium text-slate-500">{u.employeeOrTraineeId}</span> },
        { key: 'department', header: 'Department', className: 'w-[14%]', render: (u: UserRecord) => <span className="block truncate text-xs text-slate-600">{u.department}</span> },
        { key: 'personType', header: 'Person Type', className: 'w-[10%] text-center', render: (u: UserRecord) => <div className="flex justify-center"><Badge type="person" value={u.personType} /></div> },
        { key: 'role', header: 'P&D Role', className: 'w-[8%] text-center', render: (u: UserRecord) => <div className="flex justify-center"><Badge type="role" value={u.accessRole} /></div> },
        { key: 'status', header: 'Account Status', className: 'w-[10%] text-center', render: (u: UserRecord) => <div className="flex justify-center"><Badge type="account" value={u.accountStatus} /></div> },
        { key: 'lastLogin', header: 'Last Sign-In', className: 'w-[23%]', render: (u: UserRecord) => <span className="block truncate text-xs text-slate-500">{u.lastLogin}</span> },
    ];

    const incomingColumns = [
        {
            key: 'trainee',
            header: 'Trainee',
            render: (r: IncomingRecord) => (
                <div className="flex items-center gap-3">
                    <Avatar name={r.fullName} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{r.fullName}</p>
                        <p className="truncate text-xs text-slate-400">{r.position}</p>
                    </div>
                </div>
            ),
        },
        { key: 'id', header: 'HR1 ID', render: (r: IncomingRecord) => <span className="font-mono text-xs font-medium text-slate-500">{r.employeeOrTraineeId}</span> },
        { key: 'department', header: 'Department', render: (r: IncomingRecord) => <span className="text-xs text-slate-500">{r.department}</span> },
        { key: 'startDate', header: 'Start Date', render: (r: IncomingRecord) => <span className="text-xs text-slate-500">{r.startDate}</span> },
        { key: 'receivedOn', header: 'Received On', render: (r: IncomingRecord) => <span className="text-xs text-slate-500">{r.receivedOn}</span> },
        { key: 'syncStatus', header: 'Sync Status', render: (r: IncomingRecord) => <Badge type="sync" value={r.syncStatus} /> },
        { key: 'accountStatus', header: 'Account Status', render: (r: IncomingRecord) => <Badge type="account" value={r.accountStatus} /> },
        { key: 'actions', header: '', className: 'text-right', render: (r: IncomingRecord) => <div className="flex justify-end"><ActionMenu items={incomingMenuItems(r)} /></div> },
    ];

    const issueColumns = [
        {
            key: 'user',
            header: 'User',
            render: (i: AccountIssue) => (
                <span className="text-sm font-semibold text-slate-900">{i.subjectName ?? state.users.find((u) => u.id === i.userId)?.fullName ?? '—'}</span>
            ),
        },
        { key: 'issue', header: 'Issue', render: (i: AccountIssue) => <span className="text-xs font-medium text-slate-700">{i.issue}</span> },
        { key: 'source', header: 'Source', render: (i: AccountIssue) => <span className="text-xs text-slate-500">{i.source}</span> },
        { key: 'detectedOn', header: 'Detected On', render: (i: AccountIssue) => <span className="text-xs text-slate-500">{i.detectedOn}</span> },
        { key: 'priority', header: 'Priority', render: (i: AccountIssue) => <Badge type="priority" value={i.priority} /> },
        { key: 'status', header: 'Status', render: (i: AccountIssue) => <Badge type="issue" value={i.status} /> },
        { key: 'actions', header: '', className: 'text-right', render: (i: AccountIssue) => <div className="flex justify-end"><ActionMenu items={issueMenuItems(i)} /></div> },
    ];

    const usersFooter = (
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
                Showing{' '}
                <span className="font-semibold text-slate-700">
                    {filteredUsers.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)}
                </span>{' '}
                of <span className="font-semibold text-slate-700">{filteredUsers.length}</span> personnel
            </span>
            <div className="flex items-center justify-center gap-1 sm:justify-end">
                <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none"
                >
                    Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-[28px] rounded-md border px-2 py-1.5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#F4B400] ${
                            p === currentPage ? 'border-[#F4B400] bg-[#F4B400] text-black shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {p}
                    </button>
                ))}
                <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none"
                >
                    Next
                </button>
            </div>
        </div>
    );

    return (
        <div className="app-page app-page-enter space-y-5">
            <HeaderFilters>
                {activeMajorTab === 'All Users' && (
                    <>
                        <SystemSelect
                            aria-label="Filter by Department"
                            value={departmentFilter}
                            onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                        >
                            <option value="All">All Departments</option>
                            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                        </SystemSelect>
                        <SystemSelect
                            aria-label="Filter by Position"
                            value={positionFilter}
                            onChange={(e) => { setPositionFilter(e.target.value); setPage(1); }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                        >
                            <option value="All">All Positions</option>
                            {positions.map((position) => <option key={position} value={position}>{position}</option>)}
                        </SystemSelect>
                        <SystemSelect
                            aria-label="Filter by P&D Role"
                            value={roleFilter}
                            onChange={(e) => { setRoleFilter(e.target.value as AccessRoleFilter); setPage(1); }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                        >
                            <option value="All">All P&amp;D Roles</option>
                            <option value="Admin & HR">Admin &amp; HR</option>
                            {ACCESS_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                        </SystemSelect>
                        <SystemSelect
                            aria-label="Filter by Person Type"
                            value={personTypeFilter}
                            onChange={(e) => { setPersonTypeFilter(e.target.value as 'All' | PersonType); setPage(1); }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                        >
                            <option value="All">All Person Types</option>
                            {PERSON_TYPE_OPTIONS.map((personType) => <option key={personType} value={personType}>{personType}</option>)}
                        </SystemSelect>
                        <SystemSelect
                            aria-label="Filter by Account Status"
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value as 'All' | AccountStatus); setPage(1); }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                        >
                            <option value="All">All Account Statuses</option>
                            {ACCOUNT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                        </SystemSelect>
                        {(roleFilter !== 'All' || statusFilter !== 'All' || personTypeFilter !== 'All' || departmentFilter !== 'All' || positionFilter !== 'All') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setRoleFilter('All');
                                    setStatusFilter('All');
                                    setPersonTypeFilter('All');
                                    setDepartmentFilter('All');
                                    setPositionFilter('All');
                                    setPage(1);
                                }}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Clear Filters
                            </button>
                        )}
                    </>
                )}
            </HeaderFilters>

            {activeMajorTab === 'All Users' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <SummaryCard icon={Users} label="Total Personnel" value={summary.total} onClick={() => {
                        setRoleFilter('All'); setStatusFilter('All'); setPersonTypeFilter('All'); setDepartmentFilter('All'); setPositionFilter('All'); setPage(1);
                    }} />
                    <SummaryCard icon={ShieldCheck} label="Privileged Accounts" value={summary.privileged} onClick={() => {
                        setRoleFilter('Admin & HR'); setStatusFilter('All'); setPersonTypeFilter('All'); setDepartmentFilter('All'); setPositionFilter('All'); setPage(1);
                    }} />
                    <SummaryCard icon={UserCircle2} label="Employee Accounts" value={summary.employees} onClick={() => {
                        setRoleFilter('All'); setStatusFilter('All'); setPersonTypeFilter('Employee'); setDepartmentFilter('All'); setPositionFilter('All'); setPage(1);
                    }} />
                    <SummaryCard icon={GraduationCap} label="Trainee Accounts" value={summary.trainees} onClick={() => {
                        setRoleFilter('All'); setStatusFilter('All'); setPersonTypeFilter('Trainee'); setDepartmentFilter('All'); setPositionFilter('All'); setPage(1);
                    }} />
                </div>
            )}

            <div className="relative animate-in fade-in duration-300">
                {activeMajorTab === 'All Users' && (
                    <DataTable
                        title="All Users"
                        columns={userColumns}
                        data={pagedUsers}
                        rowKey={(user) => user.id}
                        footer={usersFooter}
                        onRowClick={(user) => { setSelectedUserId(user.id); setDetailsTab('Overview'); }}
                        getRowLabel={(user) => `Open ${user.fullName} record`}
                        getRowClassName={(user) => user.id === selectedUserId ? 'bg-amber-50/70 ring-1 ring-inset ring-[#F4B400]/50' : ''}
                        tableLayout="fixed"
                        overlay={selectedUser ? (
                            <>
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute right-0 top-0 bottom-[53px] z-20 hidden bg-white/35 backdrop-blur-[7px] lg:left-[49%] lg:block animate-in fade-in duration-300"
                                />
                                <UserDetailsDrawer
                                    user={selectedUser}
                                    tab={detailsTab}
                                    onTabChange={setDetailsTab}
                                    onClose={() => setSelectedUserId(null)}
                                    onRequestAction={requestAction}
                                    onRequestSuspend={setSuspendTargetUserId}
                                    onRequestDeactivate={setDeactivateTargetUserId}
                                />
                            </>
                        ) : null}
                    />
                )}
                {activeMajorTab === 'Incoming Trainees' && (
                    <DataTable
                        title="Incoming Trainees"
                        columns={incomingColumns}
                        data={state.incomingRecords}
                        rowKey={(r) => r.id}
                        onRowClick={(record) => { const user = state.users.find((candidate) => candidate.employeeOrTraineeId === record.employeeOrTraineeId); if (user) { setSelectedUserId(user.id); setDetailsTab('Overview'); } }}
                        getRowLabel={(record) => `Open ${record.fullName} record`}
                        emptyTitle="No incoming trainees"
                        emptyDescription="There are currently no trainee records awaiting P&D onboarding or account activation."
                    />
                )}
                {activeMajorTab === 'Account Issues' && (
                    <DataTable
                        title="Account Issues"
                        columns={issueColumns}
                        data={state.issues}
                        rowKey={(i) => i.id}
                        onRowClick={(issue) => { if (issue.userId) { setSelectedUserId(issue.userId); setDetailsTab('Account & Access'); } }}
                        getRowLabel={(issue) => `Open ${issue.subjectName ?? issue.issue} issue`}
                        emptyTitle="No open account issues"
                        emptyDescription="There are currently no unresolved P&D access, sign-in, MFA, or account-related issues."
                    />
                )}

            </div>
            {inviteOpen && (
                <InviteUserModal
                    mode={inviteMode}
                    onModeChange={setInviteMode}
                    onClose={() => setInviteOpen(false)}
                    query={invitePersonQuery}
                    onQueryChange={setInvitePersonQuery}
                    selectedPersonId={invitePersonId}
                    onSelectPerson={setInvitePersonId}
                    role={inviteRole}
                    onRoleChange={setInviteRole}
                    onSubmitExisting={submitExistingInvite}
                    manualForm={manualForm}
                    onManualFormChange={setManualForm}
                    onSubmitManual={submitManualCreate}
                    existingUsers={state.users}
                    personnelDirectory={availablePersonnel}
                />
            )}
            {pendingAction && pendingAction.entity === 'user' && pendingAction.action === 'archive' && (
                <ArchiveConfirmDialog
                    userName={state.users.find((u) => u.id === pendingAction.entityId)?.fullName ?? 'this user'}
                    onCancel={() => setPendingAction(null)}
                    onConfirm={(reason, notes) => performArchive(pendingAction.entityId, reason, notes)}
                />
            )}
            {pendingAction && !(pendingAction.entity === 'user' && pendingAction.action === 'archive') && (
                <ConfirmDialog action={pendingAction} onCancel={() => setPendingAction(null)} onConfirm={confirmPendingAction} />
            )}
            {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
        </div>
    );
}
UserManagement.layout = (page: ReactNode) => (
    <AuthenticatedLayout
        header={
            <h1 className="truncate text-sm font-bold text-slate-900">
                User Management
            </h1>
        }
    >
        {page}
    </AuthenticatedLayout>
);

export default UserManagement;
