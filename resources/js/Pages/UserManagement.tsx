import {
    AlertCircle,
    AlertTriangle,
    Briefcase,
    Building2,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    Clock3,
    ExternalLink,
    FileText,
    GraduationCap,
    Lock,
    Mail,
    MapPin,
    MessageSquare,
    MoreVertical,
    Phone,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    UserCircle2,
    UserPlus,
    Users,
    X,
    type LucideIcon
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

type AccessRole = 'Admin' | 'HR' | 'User';
type PersonType = 'Employee' | 'Trainee';
type EmploymentStatus = 'Incoming' | 'Trainee' | 'Employee' | 'Inactive';
type AccountStatus =
    | 'Not Provisioned'
    | 'Provisioning'
    | 'Pending Activation'
    | 'Active'
    | 'Suspended'
    | 'Inactive'
    | 'Archived';
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
type WorkspaceTab = 'Overview' | 'Account & Access' | 'Development Overview' | 'Communication & Support' | 'Activity';
type RecommendationStatus = 'Recommended' | 'Under Review' | 'Dismissed';
type ToastTone = 'success' | 'info' | 'warning';
type BadgeType = 'role' | 'person' | 'account' | 'source' | 'sync' | 'priority' | 'issue' | 'communication' | 'verification';

/** Normal (non-privileged) roles that can be assigned through Invite Existing Personnel. Admin is intentionally excluded and only reachable via Manage Access / Create Internal Account. */
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
type DevelopmentOverview = {
    performance: string;
    competencies: string;
    learning: string;
    training: string;
    recognition: string;
    succession: string;
    mandatoryCoursesAssigned: number;
    recommendedCoursesAvailable: number;
    assignedCourses: number;
    recommendations: AIRecommendation[];
};
type UserRecord = {
    id: string;
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
    sourceSystem: SourceSystem;
    syncStatus?: SyncStatus;
    activationStatus: ActivationStatus;
    createdAt: string;
    lastLogin: string;
    archivedAt?: string;
    archiveReason?: string;
    archiveNotes?: string;
    startDate: string;
    phone: string;
    location: string;
    failedSignInCount: number;
    locked: boolean;
    development: DevelopmentOverview;
    activity: ActivityEvent[];
    communications: CommunicationEvent[];
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
    sourceSystem: 'HR1';
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
          action: 'resendActivation' | 'sendPasswordReset' | 'unlock' | 'activate' | 'archive' | 'restore' | 'changeRole';
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
type ManageAccessStep = 'select' | 'confirmHR' | 'confirmAdmin';
type InviteExistingStep = 'role' | 'personnel' | 'confirm';

const ITEMS_PER_PAGE = 10;
const ACCESS_ROLE_OPTIONS: AccessRole[] = ['Admin', 'HR', 'User'];
// Admin is never a normal invitation role — it is only reachable through the separate Manage Access / Privileged Access Assignment workflow.
const INVITE_ROLE_OPTIONS: InvitableRole[] = ['User', 'HR'];
const ACCOUNT_STATUS_OPTIONS: AccountStatus[] = [
    'Not Provisioned',
    'Provisioning',
    'Pending Activation',
    'Active',
    'Suspended',
    'Inactive',
    'Archived',
];
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
// Placeholder for the signed-in Admin performing sensitive actions in this frontend-only phase.
const CURRENT_ADMIN_NAME = 'Current Admin';

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
        person: { Employee: 'bg-violet-100 text-violet-700', Trainee: 'bg-emerald-100 text-emerald-700' },
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
function development(personType: PersonType, department: string, accessRole: AccessRole): DevelopmentOverview {
    const trainee = personType === 'Trainee';
    return {
        performance: trainee ? 'Awaiting baseline' : '4.3 / 5',
        competencies: trainee ? '2 of 10 planned' : '8 of 10 achieved',
        learning: trainee ? '0 of 2 courses completed' : '4 of 5 courses completed',
        training: trainee ? '0 completed' : '2 completed',
        recognition: trainee ? '0 records' : '3 records',
        succession: trainee ? 'Not authorized' : accessRole === 'Admin' || accessRole === 'HR' ? 'Authorized review' : 'Role-based review',
        mandatoryCoursesAssigned: trainee ? (department === 'Operations' ? 2 : 1) : 0,
        recommendedCoursesAvailable: trainee ? 2 : 1,
        assignedCourses: trainee ? (department === 'Operations' ? 2 : 1) : 2,
        recommendations: trainee
            ? [
                  recommendation('Company orientation', 'Supports the trainee onboarding path.', 'learning'),
                  recommendation(`${department} readiness`, 'Helps the trainee start with the right role context.', 'training'),
              ]
            : [
                  recommendation(`${department} refresher`, 'Supports stronger day-to-day execution for the current role.', 'learning'),
                  recommendation('Competency review', 'Keeps development aligned to the current role profile.', 'competency'),
              ],
    };
}
function appendActivity(user: UserRecord, label: string, detail: string, occurredAt: string): UserRecord {
    return { ...user, activity: [activity(label, detail, occurredAt), ...user.activity] };
}
function makeUser(input: Omit<UserRecord, 'development' | 'activity' | 'communications'>): UserRecord {
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
        items.unshift(activity('Account suspended', 'Suspended after repeated failed sign-in attempts.', 'Aug 2, 2026 7:02 PM'));
    }
    return {
        ...input,
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
    return {
        performance: 'admin.performance.index',
        competency: 'admin.competency.index',
        learning: 'admin.learning.index',
        training: 'admin.training.index',
        recognition: 'admin.recognition.index',
        succession: 'admin.succession.index',
    }[key];
}

// hrEligible reflects trusted HR1/Core HR information only — never inferred from Performance, Competency,
// Succession, AI recommendations, or manual guessing. Non-HR personnel must never be assignable HR access.
const personnelDirectory: PersonnelOption[] = [
    { id: 'person-1', corePersonId: 'CORE-171', employeeOrTraineeId: 'EMP-171', fullName: 'Grace Mercado', email: 'grace.mercado@alibaton.com', position: 'Contracts Analyst', department: 'Contracts', hrEligible: false },
    { id: 'person-2', corePersonId: 'CORE-173', employeeOrTraineeId: 'EMP-173', fullName: 'Noel Sarmiento', email: 'noel.sarmiento@alibaton.com', position: 'Warehouse Supervisor', department: 'Logistics', hrEligible: false },
    { id: 'person-3', corePersonId: 'CORE-177', employeeOrTraineeId: 'EMP-177', fullName: 'Camille Paredes', email: 'camille.paredes@alibaton.com', position: 'Payroll Specialist', department: 'Finance', hrEligible: false },
    { id: 'person-4', corePersonId: 'CORE-183', employeeOrTraineeId: 'EMP-183', fullName: 'Vince Javier', email: 'vince.javier@alibaton.com', position: 'IT Support Analyst', department: 'Information Technology', hrEligible: false },
    { id: 'person-5', corePersonId: 'CORE-191', employeeOrTraineeId: 'EMP-191', fullName: 'Ainah Sta. Maria', email: 'ainah.stamaria@alibaton.com', position: 'HR Officer', department: 'Human Resources', hrEligible: true },
    { id: 'person-6', corePersonId: 'CORE-196', employeeOrTraineeId: 'EMP-196', fullName: 'Kaye Caagusan', email: 'kaye.caagusan@alibaton.com', position: 'HR Coordinator', department: 'Human Resources', hrEligible: true },
    { id: 'person-7', corePersonId: 'CORE-199', employeeOrTraineeId: 'EMP-199', fullName: 'Lisa Montero', email: 'lisa.montero@alibaton.com', position: 'Recruitment Supervisor', department: 'Human Resources', hrEligible: true },
];

const BASE_8_USERS = [
    makeUser({ id: 'user-1', corePersonId: 'CORE-001', employeeOrTraineeId: 'EMP-001', fullName: 'Mara Villanueva', email: 'mara.villanueva@alibaton.com', position: 'System Administrator', department: 'Administration', accessRole: 'Admin', personType: 'Employee', employmentStatus: 'Employee', accountStatus: 'Active', sourceSystem: 'Manual', activationStatus: 'Activated', createdAt: 'Jan 15, 2024', lastLogin: 'Aug 7, 2026 8:18 AM', startDate: 'Jan 8, 2024', phone: '+63 917 111 1021', location: 'Head Office', failedSignInCount: 0, locked: false }),
    makeUser({ id: 'user-2', corePersonId: 'CORE-002', employeeOrTraineeId: 'EMP-002', fullName: 'Alvin Custodio', email: 'alvin.custodio@alibaton.com', position: 'System Administrator', department: 'Information Technology', accessRole: 'Admin', personType: 'Employee', employmentStatus: 'Employee', accountStatus: 'Active', sourceSystem: 'Manual', activationStatus: 'Activated', createdAt: 'Feb 3, 2024', lastLogin: 'Aug 7, 2026 7:55 AM', startDate: 'Jan 29, 2024', phone: '+63 917 111 1022', location: 'Head Office', failedSignInCount: 0, locked: false }),
    makeUser({ id: 'user-4', corePersonId: 'CORE-014', employeeOrTraineeId: 'EMP-004', fullName: 'Celso Ramirez', email: 'celso.ramirez@alibaton.com', position: 'HR Business Partner', department: 'Human Resources', accessRole: 'HR', personType: 'Employee', employmentStatus: 'Employee', accountStatus: 'Active', sourceSystem: 'HR1', syncStatus: 'Synced', activationStatus: 'Activated', createdAt: 'Feb 20, 2024', lastLogin: 'Aug 7, 2026 7:42 AM', startDate: 'Feb 1, 2024', phone: '+63 917 111 1035', location: 'Head Office', failedSignInCount: 0, locked: false }),
    makeUser({ id: 'user-5', corePersonId: 'CORE-112', employeeOrTraineeId: 'EMP-005', fullName: 'Nina Soriano', email: 'nina.soriano@alibaton.com', position: 'Finance Staff', department: 'Finance', accessRole: 'User', personType: 'Employee', employmentStatus: 'Employee', accountStatus: 'Active', sourceSystem: 'HR1', syncStatus: 'Synced', activationStatus: 'Activated', createdAt: 'Jun 11, 2024', lastLogin: 'Aug 5, 2026 9:19 AM', startDate: 'Jun 3, 2024', phone: '+63 917 111 1112', location: 'Head Office', failedSignInCount: 0, locked: false }),
    makeUser({ id: 'user-6', corePersonId: 'CORE-204', employeeOrTraineeId: 'TRN-001', fullName: 'Elaine Bautista', email: 'elaine.bautista@alibaton.com', position: 'Graduate Trainee', department: 'Operations', accessRole: 'User', personType: 'Trainee', employmentStatus: 'Trainee', accountStatus: 'Active', sourceSystem: 'HR1', syncStatus: 'Synced', activationStatus: 'Activated', createdAt: 'Jul 4, 2026', lastLogin: 'Aug 6, 2026 1:23 PM', startDate: 'Jul 1, 2026', phone: 'On file with HR1', location: 'Operations Training Hub', failedSignInCount: 0, locked: false }),
    makeUser({ id: 'user-8', corePersonId: 'CORE-154', employeeOrTraineeId: 'EMP-006', fullName: 'Miguel Santos', email: 'miguel.santos@alibaton.com', position: 'Safety Officer', department: 'Safety & Compliance', accessRole: 'User', personType: 'Employee', employmentStatus: 'Employee', accountStatus: 'Suspended', sourceSystem: 'Manual', activationStatus: 'Activated', createdAt: 'Nov 12, 2024', lastLogin: 'Jul 29, 2026 6:14 PM', startDate: 'Nov 4, 2024', phone: '+63 917 111 1154', location: 'South Project Site', failedSignInCount: 5, locked: true }),
    makeUser({ id: 'user-10', corePersonId: 'CORE-027', employeeOrTraineeId: 'EMP-008', fullName: 'Grace Fernandez', email: 'grace.fernandez@alibaton.com', position: 'Training Officer', department: 'Human Resources', accessRole: 'HR', personType: 'Employee', employmentStatus: 'Employee', accountStatus: 'Active', sourceSystem: 'HR1', syncStatus: 'Synced', activationStatus: 'Activated', createdAt: 'May 6, 2024', lastLogin: 'Aug 5, 2026 3:12 PM', startDate: 'Apr 29, 2024', phone: '+63 917 111 1042', location: 'Head Office', failedSignInCount: 0, locked: false }),
    makeUser({ id: 'user-12', corePersonId: 'CORE-238', employeeOrTraineeId: 'EMP-010', fullName: 'Katrina Buenaventura', email: 'katrina.buenaventura@alibaton.com', position: 'HR Business Partner', department: 'Human Resources', accessRole: 'HR', personType: 'Employee', employmentStatus: 'Employee', accountStatus: 'Pending Activation', sourceSystem: 'Manual', activationStatus: 'Invitation Sent', createdAt: 'Aug 5, 2026', lastLogin: 'No login yet', startDate: 'Aug 10, 2026', phone: '+63 917 111 1044', location: 'Head Office', failedSignInCount: 0, locked: false }),
];

const GEN_NAMES = ["Luis Gomez", "Sofia Reyes", "Mateo Cruz", "Isabella Torres", "Lucas Flores", "Mia Ramos", "Gabriel Morales", "Camila Ortiz", "Jose Castillo", "Elena Chavez", "Antonio Ruiz", "Valeria Herrera", "Carlos Medina", "Mariana Aguilar", "Jorge Vargas", "Lucia Castro", "Pedro Salazar", "Valentina Guzman", "Juan Pena", "Ximena Rojas", "Diego Mendez", "Mariana Silva", "Alejandro Rios", "Daniela Navarro", "Fernando Delgado", "Victoria Nunez", "Ricardo Padilla"];
const GEN_DEPARTMENTS = ["Crane Operations", "Logistics", "Operations", "Finance", "Contracts", "Safety & Compliance", "Administration", "Information Technology", "Crane Operations", "Logistics", "Operations", "Finance", "Contracts", "Safety & Compliance", "Administration", "Information Technology", "Crane Operations", "Logistics", "Operations", "Finance", "Contracts", "Safety & Compliance", "Administration", "Information Technology", "Crane Operations", "Operations", "Logistics"];
const GEN_POSITIONS = GEN_NAMES.map(() => 'Staff Professional');
GEN_POSITIONS[8] = 'Crane Operations Supervisor';
GEN_POSITIONS[9] = 'Logistics Supervisor';
GEN_POSITIONS[10] = 'Operations Supervisor';
GEN_POSITIONS[11] = 'Finance Manager';
GEN_POSITIONS[13] = 'Safety Supervisor';

const GENERATED_USERS = GEN_NAMES.map((name, i) => makeUser({
    id: `user-gen-${i}`,
    corePersonId: `CORE-GEN-${i}`,
    employeeOrTraineeId: `EMP-1${i.toString().padStart(2, '0')}`,
    fullName: name,
    email: `${name.toLowerCase().replace(' ', '.')}@alibaton.com`,
    position: GEN_POSITIONS[i],
    department: GEN_DEPARTMENTS[i],
    accessRole: 'User',
    personType: 'Employee',
    employmentStatus: 'Employee',
    accountStatus: 'Active',
    sourceSystem: 'HR1',
    syncStatus: 'Synced',
    activationStatus: 'Activated',
    createdAt: 'Mar 10, 2024',
    lastLogin: 'Aug 6, 2026 10:15 AM',
    startDate: 'Mar 1, 2024',
    phone: '+63 917 000 0000',
    location: 'Project Site',
    failedSignInCount: 0,
    locked: false
}));

const initialState: DirectoryState = {
    users: [...BASE_8_USERS, ...GENERATED_USERS], // Exactly 35 active users
    incomingRecords: [
        { id: 'incoming-1', corePersonId: 'CORE-231', employeeOrTraineeId: 'TRN-231', fullName: 'Sophia Mendoza', position: 'Operations Intern', department: 'Operations', startDate: 'Sep 1, 2026', receivedOn: 'Aug 6, 2026', syncStatus: 'Received', accountStatus: 'Not Provisioned', sourceSystem: 'HR1', officialEmail: 'sophia.mendoza@alibaton.com', note: 'Waiting for validation and duplicate checks.' },
    ],
    issues: [
        { id: 'issue-2', issue: 'Account locked', source: 'System', detectedOn: 'Aug 7, 2026', priority: 'High', status: 'Open', userId: 'user-8' },
        { id: 'issue-6', issue: 'Forgotten password', source: 'System', detectedOn: 'Aug 4, 2026', priority: 'Low', status: 'Open', userId: 'user-5' },
    ],
    pendingVerifications: [],
};

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

function SummaryCard({ icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) {
    const Icon = icon;
    return (
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-[#F4B400]/40 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F4B400]/10 text-[#F4B400]">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4B400]/10 text-[#F4B400]">
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4B400]/10 text-[#F4B400]">
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
                    <select
                        value={form.basis}
                        onChange={(e) => setForm({ ...form, basis: e.target.value as SuspensionBasis })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                    >
                        {SUSPENSION_BASIS_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>
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
                    <select
                        value={form.basis}
                        onChange={(e) => setForm({ ...form, basis: e.target.value as DeactivationBasis })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                    >
                        {DEACTIVATION_BASIS_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>
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
                        <select
                            value={failureReason}
                            onChange={(e) => setFailureReason(e.target.value as VerificationFailureReason)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-rose-400 focus:ring-1 focus:ring-rose-400 focus:outline-none"
                        >
                            {VERIFICATION_FAILURE_REASONS.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
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

function ManageAccessModal({
    user,
    onClose,
    onGrantHR,
    onGrantAdmin,
}: {
    user: UserRecord;
    onClose: () => void;
    onGrantHR: () => void;
    onGrantAdmin: (justification: string) => void;
}) {
    const [step, setStep] = useState<ManageAccessStep>('select');
    const [justification, setJustification] = useState('');
    const hrRoleFitsRecord = user.department === 'Human Resources';

    return (
        <Modal title="Manage Access" onClose={onClose} wide={step !== 'select'}>
            {step === 'select' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {infoTile(UserCircle2, 'User', user.fullName)}
                        {infoTile(ShieldCheck, 'Current Access Role', <Badge type="role" value={user.accessRole} />)}
                        {infoTile(Briefcase, 'Position', user.position)}
                        {infoTile(Building2, 'Department', user.department)}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Privileged access changes require a deliberate confirmation step.</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-4">
                        {user.accessRole === 'User' && (
                            <button
                                type="button"
                                onClick={() => setStep('confirmHR')}
                                className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#F4B400]/40 hover:bg-[#F4B400]/5 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                            >
                                <p className="text-sm font-bold text-slate-900">Grant HR Access</p>
                                <p className="mt-1 text-xs text-slate-500">Give this person HR-level access to personnel records.</p>
                            </button>
                        )}
                        {user.accessRole !== 'Admin' && (
                            <button
                                type="button"
                                onClick={() => setStep('confirmAdmin')}
                                className="rounded-xl border border-rose-200 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50/40 focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none"
                            >
                                <p className="text-sm font-bold text-slate-900">Grant Administrator Access</p>
                                <p className="mt-1 text-xs text-slate-500">Full system privilege. Requires explicit justification.</p>
                            </button>
                        )}
                        {user.accessRole === 'Admin' && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:col-span-2">
                                <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" />
                                    Highest Privilege Level
                                </p>
                                <p className="mt-1 text-xs text-emerald-700">This user already has full Administrator access.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'confirmHR' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {infoTile(Building2, 'Department', user.department)}
                        {infoTile(Briefcase, 'Position', user.position)}
                        {infoTile(ShieldCheck, 'Current Access Role', <Badge type="role" value={user.accessRole} />)}
                    </div>
                    {!hrRoleFitsRecord && (
                        <div className="flex items-start gap-2 rounded-xl border border-[#F4B400]/30 bg-[#F4B400]/10 p-3 text-xs text-amber-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F4B400]" />
                            <p>
                                This person&apos;s department and position don&apos;t obviously correspond to HR responsibilities. Double-check
                                before granting HR access.
                            </p>
                        </div>
                    )}
                    <div className="flex justify-between pt-2">
                        <button type="button" onClick={() => setStep('select')} className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none rounded-md px-2 py-1">
                            Back
                        </button>
                        <button type="button" onClick={onGrantHR} className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e0a600] focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none">
                            Confirm Grant HR Access
                        </button>
                    </div>
                </div>
            )}

            {step === 'confirmAdmin' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {infoTile(UserCircle2, 'User', user.fullName)}
                        {infoTile(Briefcase, 'Position', user.position)}
                        {infoTile(Building2, 'Department', user.department)}
                        {infoTile(ShieldCheck, 'Requested Access', <Badge type="role" value="Admin" />)}
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Privilege Summary</p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-rose-800">
                            <li>Full system configuration access</li>
                            <li>Ability to manage all user accounts, including other Admins</li>
                            <li>Access to security, audit, and compliance settings</li>
                        </ul>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Justification (required)</label>
                        <textarea
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            rows={3}
                            placeholder="Explain why this person needs Administrator access."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none"
                        />
                    </div>
                    <div className="flex justify-between pt-2">
                        <button type="button" onClick={() => setStep('select')} className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none rounded-md px-2 py-1">
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={!justification.trim()}
                            onClick={() => onGrantAdmin(justification.trim())}
                            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 focus:outline-none"
                        >
                            Confirm Grant Administrator Access
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

// ✨ UPDATE: Custom ActionMenu Component to match "image_4f5131.png"
function ActionMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
    const [open, setOpen] = useState(false);
    if (items.length === 0) return null;
    return (
        <div className="relative">
            <button type="button" aria-label="Open action menu" onClick={() => setOpen((v) => !v)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                <MoreVertical className="h-4 w-4" />
            </button>
            {open && (
                <>
                    {/* Fixed z-40 para sumalo ng clicks sa likod nang walang tinatakpan */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    {/* Fixed z-50 at shadow-xl para angat na angat, pinalitan ang animaton sa mas smooth na slide in */}
                    <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-xl animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-200">
                        {items.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    item.onClick();
                                }}
                                // Ginawang bold, may maayos na gap/borders, at tamang text-rose color para sa mapanganib na actions
                                className={`block w-full border-b border-slate-100 last:border-none px-4 py-2.5 text-left text-[13px] font-semibold transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${item.danger ? 'text-rose-600 hover:text-rose-700' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/* Analytics Chart                                                        */
/* ---------------------------------------------------------------------- */

function DepartmentAnalytics({ users, currentFilter, onSelect, onClear }: { users: UserRecord[]; currentFilter: string; onSelect: (d: string) => void; onClear: () => void }) {
    const counts = useMemo(() => {
        const map = new Map<string, number>();
        users.forEach(u => map.set(u.department, (map.get(u.department) || 0) + 1));
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [users]);

    const max = Math.max(...counts.map(c => c[1]), 1);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#F4B400]" /> Users by Department
                </h3>
                {currentFilter !== 'All' && (
                    <button type="button" onClick={onClear} className="text-xs font-semibold text-[#F4B400] hover:underline focus-visible:ring-2 focus-visible:ring-[#F4B400] rounded-md px-1 focus:outline-none transition-colors">
                        Clear Filter
                    </button>
                )}
            </div>
            <div className="space-y-4">
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
/* ✨ User Details Drawer (STYLED TO MATCH REFERENCE IMAGE)              */
/* ---------------------------------------------------------------------- */

const CLOSE_ANIMATION_MS = 280;

function UserDetailsDrawer({
    user,
    tab,
    onTabChange,
    onClose,
    onRequestAction,
    onManageAccess,
    onAddCommunication,
    onCreateIssue,
    onRequestSuspend,
    onRequestDeactivate,
}: {
    user: UserRecord;
    tab: WorkspaceTab;
    onTabChange: (t: WorkspaceTab) => void;
    onClose: () => void;
    onRequestAction: (action: PendingAction) => void;
    onManageAccess: (userId: string) => void;
    onAddCommunication: (userId: string, data: Omit<CommunicationEvent, 'id' | 'occurredAt'>) => void;
    onCreateIssue: (userId: string, category: string, notes: string) => void;
    onRequestSuspend: (userId: string) => void;
    onRequestDeactivate: (userId: string) => void;
}) {
    const tabs: WorkspaceTab[] = ['Overview', 'Account & Access', 'Development Overview', 'Communication & Support', 'Activity'];
    const prefersReducedMotion = usePrefersReducedMotion();
    const [isClosing, setIsClosing] = useState(false);
    const closeTimer = useRef<number | null>(null);

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

    function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }

    // Forms state for Communication & Support
    const [commView, setCommView] = useState<'feed' | 'message' | 'note' | 'issue'>('feed');
    const [msgChannel, setMsgChannel] = useState<'In-App' | 'Email' | 'Call Note'>('In-App');
    const [msgSubject, setMsgSubject] = useState('');
    const [msgBody, setMsgBody] = useState('');
    const [msgOutcome, setMsgOutcome] = useState('Reached User');
    const [noteBody, setNoteBody] = useState('');
    const [issueCategory, setIssueCategory] = useState(ISSUE_CATEGORIES[0]);
    const [issueNotes, setIssueNotes] = useState('');

    function handleSendMessage() {
        if (!msgBody.trim() || (msgChannel !== 'Call Note' && !msgSubject.trim())) return;
        onAddCommunication(user.id, {
            type: msgChannel,
            subject: msgChannel === 'Call Note' ? 'Call Log' : msgSubject,
            body: msgBody,
            outcome: msgChannel === 'Call Note' ? msgOutcome : undefined
        });
        setCommView('feed');
        setMsgSubject(''); setMsgBody('');
    }

    function handleAddNote() {
        if (!noteBody.trim()) return;
        onAddCommunication(user.id, {
            type: 'Internal Note',
            subject: 'Internal Note',
            body: noteBody
        });
        setCommView('feed');
        setNoteBody('');
    }

    function handleCreateAccountIssue() {
        if (!issueCategory) return;
        onCreateIssue(user.id, issueCategory, issueNotes);
        setCommView('feed');
        setIssueCategory(ISSUE_CATEGORIES[0]);
        setIssueNotes('');
    }

    return (
        <div
            onClick={handleBackdropClick}
            className={`fixed inset-0 z-40 flex justify-end bg-slate-900/60 backdrop-blur-sm transition-opacity ease-out ${
                prefersReducedMotion ? '' : 'duration-300'
            } ${isClosing ? 'opacity-0' : 'opacity-100'} ${!isClosing && !prefersReducedMotion ? 'animate-in fade-in' : ''}`}
        >
            <div
                className={`flex h-full w-full max-w-full sm:max-w-[800px] flex-col bg-slate-50 shadow-2xl transition-all ease-out ${
                    prefersReducedMotion ? '' : 'duration-300'
                } ${isClosing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'} ${
                    !isClosing && !prefersReducedMotion ? 'animate-in slide-in-from-right-full' : ''
                }`}
            >
                {/* ✨ DARK HEADER MATCHING THE IMAGE ✨ */}
                <div className="relative z-20 bg-[#1a1d21] px-6 pt-6 shadow-sm flex-shrink-0">
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#F4B400]">User Record Details</p>
                        <button
                            type="button"
                            onClick={handleClose}
                            aria-label="Close user details"
                            className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:text-white focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex items-start gap-4">
                        <Avatar name={user.fullName} size="lg" />
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-xl font-extrabold text-white">{user.fullName}</h3>
                            <p className="mt-1 truncate text-sm font-semibold text-slate-400">
                                {user.position} &middot; {user.department}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Badge type="role" value={user.accessRole} />
                                <Badge type="person" value={user.personType} />
                                <Badge type="account" value={user.accountStatus} />
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation (Integrated cleanly in dark area) */}
                    <div className="mt-8 flex gap-2 border-b border-slate-700/60 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {tabs.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => onTabChange(t)}
                                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:text-white ${
                                    tab === t ? 'border-[#F4B400] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ✨ LIGHT BODY MATCHING THE IMAGE ✨ */}
                <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar bg-slate-50">
                    {tab === 'Overview' && (
                        <div key="overview" className="animate-in fade-in duration-200">
                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact Information</h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-8">
                                {infoTile(ClipboardList, 'Employee ID', user.employeeOrTraineeId)}
                                {infoTile(Mail, 'Email', user.email)}
                                {infoTile(Phone, 'Phone', user.phone)}
                                {infoTile(MapPin, 'Location', user.location)}
                            </div>

                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Employment Details</h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {infoTile(UserCircle2, 'Full Name', user.fullName)}
                                {infoTile(Briefcase, 'Position', user.position)}
                                {infoTile(Building2, 'Department', user.department)}
                                {infoTile(Clock3, 'Employment Status', user.employmentStatus)}
                                {infoTile(CalendarDays, 'Start Date', user.startDate)}
                                {infoTile(RefreshCw, 'Source', <Badge type="source" value={user.sourceSystem} />)}
                            </div>
                        </div>
                    )}

                    {tab === 'Account & Access' && (
                        <div key="account-access" className="animate-in fade-in duration-200">
                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Access Information</h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-8">
                                {infoTile(ShieldCheck, 'Access Role', <Badge type="role" value={user.accessRole} />)}
                                {infoTile(Check, 'Account Status', <Badge type="account" value={user.accountStatus} />)}
                                {infoTile(Mail, 'Activation Status', user.activationStatus)}
                                {infoTile(CalendarDays, 'Date Created', user.createdAt)}
                                {infoTile(Clock3, 'Last Login', user.lastLogin)}
                                {infoTile(Lock, 'Sign-in Status', user.locked ? <span className="text-rose-600 font-bold">Locked ({user.failedSignInCount} failed)</span> : 'Not locked')}
                            </div>

                            {user.accountStatus === 'Archived' && (
                                <>
                                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Archive Details</h4>
                                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-8">
                                        <p className="text-sm font-semibold text-slate-800">{user.archiveReason ?? 'No reason on file.'}</p>
                                        {user.archiveNotes && <p className="mt-1 text-xs text-slate-500">{user.archiveNotes}</p>}
                                        {user.archivedAt && <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Archived on {user.archivedAt}</p>}
                                    </div>
                                </>
                            )}

                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Management Actions</h4>
                            <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                {user.accountStatus === 'Pending Activation' && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRequestAction({
                                                entity: 'user',
                                                entityId: user.id,
                                                action: 'resendActivation',
                                                title: 'Resend Activation',
                                                description: `Resend the activation invitation to ${user.fullName}?`,
                                            })
                                        }
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none"
                                    >
                                        Resend Activation
                                    </button>
                                )}
                                {(user.accountStatus === 'Active' || user.accountStatus === 'Suspended') && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRequestAction({
                                                entity: 'user',
                                                entityId: user.id,
                                                action: 'sendPasswordReset',
                                                title: 'Send Password Reset',
                                                description: `Send a password reset link to ${user.fullName}?`,
                                            })
                                        }
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none"
                                    >
                                        Send Password Reset
                                    </button>
                                )}
                                {user.locked && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRequestAction({
                                                entity: 'user',
                                                entityId: user.id,
                                                action: 'unlock',
                                                title: 'Unlock Account',
                                                description: `Unlock ${user.fullName}'s account?`,
                                            })
                                        }
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none"
                                    >
                                        Unlock Account
                                    </button>
                                )}
                                {(user.accountStatus === 'Suspended' || user.accountStatus === 'Inactive') && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRequestAction({
                                                entity: 'user',
                                                entityId: user.id,
                                                action: 'activate',
                                                title: 'Activate Account',
                                                description: `Activate ${user.fullName}'s account?`,
                                            })
                                        }
                                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none"
                                    >
                                        Activate Account
                                    </button>
                                )}
                                {user.accountStatus === 'Active' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onRequestSuspend(user.id)}
                                            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-400 focus:outline-none"
                                        >
                                            Suspend Account
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRequestDeactivate(user.id)}
                                            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none"
                                        >
                                            Deactivate P&amp;D Access
                                        </button>
                                    </>
                                )}
                                {user.accountStatus !== 'Archived' && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onRequestAction({
                                                entity: 'user',
                                                entityId: user.id,
                                                action: 'archive',
                                                title: 'Archive User Account',
                                                description: 'The account will lose normal system access, but historical records will be retained.',
                                            })
                                        }
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none"
                                    >
                                        Archive Account
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onManageAccess(user.id)}
                                    className="rounded-lg border border-slate-900 bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 ml-auto focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus:outline-none"
                                >
                                    Manage Access
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'Development Overview' && (
                        <div key="development" className="animate-in fade-in duration-200">
                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Development Modules</h4>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-8">
                                {[
                                    { key: 'performance', label: 'Performance', val: user.development.performance },
                                    { key: 'competency', label: 'Competency', val: user.development.competencies },
                                    { key: 'learning', label: 'Learning', val: user.development.learning },
                                    { key: 'training', label: 'Training', val: user.development.training },
                                    { key: 'recognition', label: 'Recognition', val: user.development.recognition },
                                    { key: 'succession', label: 'Succession', val: user.development.succession },
                                ].map(mod => (
                                    <a
                                        key={mod.key}
                                        href={buildHref(moduleRoute(mod.key as any), { user: user.id })}
                                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#F4B400]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none outline-none group"
                                    >
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-500">{mod.label}</p>
                                            <p className="mt-1.5 text-sm font-bold text-slate-900 leading-tight">{mod.val}</p>
                                        </div>
                                        <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-[#F4B400] uppercase opacity-80 group-hover:opacity-100">
                                            Open <ExternalLink className="h-3 w-3" />
                                        </div>
                                    </a>
                                ))}
                            </div>

                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">AI Recommendations</h4>
                            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
                                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-800">
                                    <Sparkles className="h-4 w-4 text-sky-600" />
                                    AI Development Recommendations
                                </div>
                                <p className="text-xs text-sky-700 mb-4">AI-assisted recommendations mapped to the current role and competency gaps.</p>
                                <div className="space-y-3">
                                    {user.development.recommendations.map((rec) => (
                                        <div key={rec.id} className="rounded-lg border border-sky-100 bg-white p-4 shadow-sm transition hover:border-sky-200">
                                            <div className="flex items-start justify-between">
                                                <p className="text-sm font-bold text-slate-900">{rec.title}</p>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                    rec.status === 'Recommended' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {rec.status}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{rec.reason}</p>
                                            <div className="mt-3 flex items-center gap-4">
                                                <a href={buildHref(moduleRoute(rec.targetModule), { user: user.id })} className="text-[11px] font-bold text-sky-600 transition hover:text-sky-700 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded">
                                                    Review in {rec.targetModule.charAt(0).toUpperCase() + rec.targetModule.slice(1)}
                                                </a>
                                                <button type="button" className="text-[11px] font-bold text-slate-400 transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-slate-400 rounded focus:outline-none">
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'Communication & Support' && (
                        <div key="communication" className="animate-in fade-in duration-200">
                            {commView === 'feed' && (
                                <div>
                                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">New Action</h4>
                                    <div className="grid grid-cols-1 gap-3 mb-8 sm:grid-cols-3">
                                        <button type="button" onClick={() => setCommView('message')} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#F4B400]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                                            <MessageSquare className="h-5 w-5 text-[#F4B400]" />
                                            <span className="text-xs font-bold text-slate-800">Send Message</span>
                                        </button>
                                        <button type="button" onClick={() => setCommView('note')} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#F4B400]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                                            <FileText className="h-5 w-5 text-[#F4B400]" />
                                            <span className="text-xs font-bold text-slate-800">Add Internal Note</span>
                                        </button>
                                        <button type="button" onClick={() => setCommView('issue')} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-rose-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-rose-400 focus:outline-none">
                                            <AlertCircle className="h-5 w-5 text-rose-500" />
                                            <span className="text-xs font-bold text-slate-800">Create Account Issue</span>
                                        </button>
                                    </div>

                                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Communication History</h4>
                                    <div className="space-y-3">
                                        {user.communications.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-400">
                                                No communication or support history.
                                            </div>
                                        ) : (
                                            user.communications.map(comm => (
                                                <div key={comm.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#F4B400]/40">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <Badge type="communication" value={comm.type} />
                                                        <span className="text-[10px] font-semibold text-slate-400">{comm.occurredAt}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-900">{comm.subject}</p>
                                                    {comm.outcome && <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5"><Phone className="h-3 w-3" /> Outcome: {comm.outcome}</p>}
                                                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{comm.body}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {commView === 'message' && (
                                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
                                    <h4 className="mb-4 text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-[#F4B400]" /> Send User Message
                                    </h4>
                                    <div className="mb-4 flex gap-4 border-b border-slate-100 pb-4">
                                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 cursor-pointer hover:text-[#F4B400]">
                                            <input type="radio" checked={msgChannel === 'In-App'} onChange={() => setMsgChannel('In-App')} className="accent-[#F4B400] focus:ring-[#F4B400]" /> In-App
                                        </label>
                                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 cursor-pointer hover:text-[#F4B400]">
                                            <input type="radio" checked={msgChannel === 'Email'} onChange={() => setMsgChannel('Email')} className="accent-[#F4B400] focus:ring-[#F4B400]" /> Email
                                        </label>
                                        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 cursor-pointer hover:text-[#F4B400]">
                                            <input type="radio" checked={msgChannel === 'Call Note'} onChange={() => setMsgChannel('Call Note')} className="accent-[#F4B400] focus:ring-[#F4B400]" /> Call Note
                                        </label>
                                    </div>

                                    {msgChannel === 'Email' && (
                                        <div className="mb-4">
                                            <label className="mb-1 block text-xs font-semibold text-slate-500">To</label>
                                            <input readOnly value={user.email} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 focus:outline-none" />
                                        </div>
                                    )}

                                    {msgChannel === 'Call Note' ? (
                                        <>
                                            <div className="mb-4">
                                                <label className="mb-1 block text-xs font-semibold text-slate-500">Contact Date/Time</label>
                                                <input type="text" readOnly value={nowLabel()} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 focus:outline-none" />
                                            </div>
                                            <div className="mb-4">
                                                <label className="mb-1 block text-xs font-semibold text-slate-500">Outcome</label>
                                                <select value={msgOutcome} onChange={(e) => setMsgOutcome(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none">
                                                    <option>Reached User</option>
                                                    <option>No Answer</option>
                                                    <option>Follow-up Required</option>
                                                    <option>Resolved</option>
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="mb-4">
                                            <label className="mb-1 block text-xs font-semibold text-slate-500">Subject</label>
                                            <input type="text" value={msgSubject} onChange={e => setMsgSubject(e.target.value)} placeholder="Message subject..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none" />
                                        </div>
                                    )}

                                    <div className="mb-5">
                                        <label className="mb-1 block text-xs font-semibold text-slate-500">Message / Notes</label>
                                        <textarea rows={4} value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder="Type here..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none custom-scrollbar" />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                        <button type="button" onClick={() => setCommView('feed')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-slate-300 focus:outline-none">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={handleSendMessage} disabled={!msgBody.trim()} className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e0a600] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none">
                                            {msgChannel === 'Call Note' ? 'Log Note' : 'Send Message'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {commView === 'note' && (
                                <div className="rounded-xl border border-[#F4B400]/40 bg-[#F4B400]/5 p-5 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
                                    <h4 className="mb-2 text-sm font-bold text-amber-800 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" /> Add Internal Note
                                    </h4>
                                    <p className="mb-4 text-xs font-medium text-amber-700">This note is NOT sent to the employee. It is only visible to Admin/HR staff.</p>

                                    <div className="mb-5">
                                        <textarea rows={5} value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Internal remarks..." className="w-full rounded-lg border border-[#F4B400]/40 px-3 py-2 text-sm bg-white transition focus:border-[#F4B400] focus:outline-none focus:ring-1 focus:ring-[#F4B400] custom-scrollbar" />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setCommView('feed')} className="rounded-lg px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={handleAddNote} disabled={!noteBody.trim()} className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e0a600] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none">
                                            Save Internal Note
                                        </button>
                                    </div>
                                </div>
                            )}

                            {commView === 'issue' && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
                                    <h4 className="mb-2 text-sm font-bold text-rose-800 flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" /> Create Account Issue
                                    </h4>
                                    <p className="mb-4 text-xs font-medium text-rose-700">Open a trackable support case for this account.</p>

                                    <div className="mb-4">
                                        <label className="mb-1 block text-xs font-semibold text-rose-800">Issue Category</label>
                                        <select value={issueCategory} onChange={e => setIssueCategory(e.target.value)} className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm bg-white transition focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400">
                                            {ISSUE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>

                                    <div className="mb-5">
                                        <label className="mb-1 block text-xs font-semibold text-rose-800">Additional Notes</label>
                                        <textarea rows={4} value={issueNotes} onChange={e => setIssueNotes(e.target.value)} placeholder="Context regarding the issue..." className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm bg-white transition focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 custom-scrollbar" />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="button" onClick={() => setCommView('feed')} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors focus-visible:ring-2 focus-visible:ring-rose-400 focus:outline-none">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={handleCreateAccountIssue} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 focus:outline-none">
                                            Create Support Case
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'Activity' && (
                        <div key="activity" className="animate-in fade-in duration-200">
                            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Activity Log</h4>
                            <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
                                <ul className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-slate-100">
                                    {user.activity.map((ev) => (
                                        <li key={ev.id} className="relative flex gap-4 group">
                                            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 ring-4 ring-white border border-[#F4B400]/40">
                                                <div className="h-2 w-2 rounded-full bg-[#F4B400]" />
                                            </div>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <p className="text-sm font-bold text-slate-900">{ev.label}</p>
                                                <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">{ev.detail}</p>
                                                <p className="mt-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{ev.occurredAt}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------------- */
/* Add / Invite User modal                                                */
/* ---------------------------------------------------------------------- */

/**
 * Invite Existing Personnel is role-aware: the requested access role is chosen first, and the personnel list is
 * then filtered to only people eligible for that specific role. HR eligibility comes strictly from trusted
 * HR1/Core HR information (the `hrEligible` flag) — never inferred from Performance, Competency, Succession, AI
 * recommendations, or manual guessing. Admin is never offered here; it only exists via Manage Access.
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
                    <p className="text-[11px] text-slate-400">Administrator access is not offered here. It is granted separately through Manage Access with an explicit justification.</p>
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
                            className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e0a600] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none"
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
                            <button type="button" onClick={onSubmitExisting} className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e0a600] focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none">
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
                            <select value={manualForm.accessRole} onChange={(e) => onManualFormChange({ ...manualForm, accessRole: e.target.value as AccessRole })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none">
                                {ACCESS_ROLE_OPTIONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Person Type</label>
                            <select value={manualForm.personType} onChange={(e) => onManualFormChange({ ...manualForm, personType: e.target.value as PersonType })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none">
                                {PERSON_TYPE_OPTIONS.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
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
                            className="rounded-lg bg-[#F4B400] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e0a600] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-1 focus:outline-none"
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
    const [state, setState] = useState<DirectoryState>(initialState);
    const [activeMajorTab, setActiveMajorTab] = useState<MajorTab>('All Users');
    
    // Filters
    const [roleFilter, setRoleFilter] = useState<'All' | AccessRole>('All');
    const [statusFilter, setStatusFilter] = useState<'All' | AccountStatus>('All');
    const [personTypeFilter, setPersonTypeFilter] = useState<'All' | PersonType>('All');
    const [departmentFilter, setDepartmentFilter] = useState<string>('All');
    const [sourceFilter, setSourceFilter] = useState<'All' | SourceSystem>('All');
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    
    const [page, setPage] = useState(1);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [detailsTab, setDetailsTab] = useState<WorkspaceTab>('Overview');
    
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
    const [manageAccessUserId, setManageAccessUserId] = useState<string | null>(null);
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
    const openIssues = useMemo(() => state.issues.filter((i) => i.status !== 'Resolved'), [state.issues]);

    const summary = useMemo(
        () => ({
            total: nonArchivedUsers.length,
            hrAdmin: nonArchivedUsers.filter((u) => u.accessRole === 'Admin' || u.accessRole === 'HR').length,
            trainees: nonArchivedUsers.filter((u) => u.personType === 'Trainee').length,
            active: nonArchivedUsers.filter((u) => u.accountStatus === 'Active').length,
        }),
        [nonArchivedUsers],
    );

    const filteredUsers = useMemo(() => {
        return nonArchivedUsers.filter((u) => {
            if (roleFilter !== 'All' && u.accessRole !== roleFilter) return false;
            if (statusFilter !== 'All' && u.accountStatus !== statusFilter) return false;
            if (personTypeFilter !== 'All' && u.personType !== personTypeFilter) return false;
            if (departmentFilter !== 'All' && u.department !== departmentFilter) return false;
            if (sourceFilter !== 'All' && u.sourceSystem !== sourceFilter) return false;
            return true;
        });
    }, [nonArchivedUsers, roleFilter, statusFilter, personTypeFilter, departmentFilter, sourceFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(page, totalPages);
    const pagedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const selectedUser = state.users.find((u) => u.id === selectedUserId) ?? null;
    const manageAccessUser = state.users.find((u) => u.id === manageAccessUserId) ?? null;
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

    function confirmSuspend(form: SuspendFormState) {
        if (!suspendTargetUser) return;
        const ts = nowLabel();
        const detailParts = [
            `Basis: ${form.basis}`,
            form.isSecurityEmergency ? 'Emergency security action.' : undefined,
            form.referenceNumber ? `Reference: ${form.referenceNumber}` : undefined,
            `Performed by: ${form.authorizedBy || CURRENT_ADMIN_NAME}`,
        ]
            .filter(Boolean)
            .join(' · ');
        updateUser(suspendTargetUser.id, (u) =>
            appendActivity({ ...u, accountStatus: 'Suspended' }, 'Account suspended', `${form.justification} (${detailParts})`, ts),
        );
        pushToast('warning', `${suspendTargetUser.fullName}'s account was suspended. Notification prepared (email delivery pending integration).`);
        setSuspendTargetUserId(null);
    }

    function confirmDeactivate(form: DeactivateFormState) {
        if (!deactivateTargetUser) return;
        const ts = nowLabel();
        const detail = `Basis: ${form.basis} · ${form.reason}${form.referenceNumber ? ` · Reference: ${form.referenceNumber}` : ''} · Performed by: ${CURRENT_ADMIN_NAME}`;
        updateUser(deactivateTargetUser.id, (u) => appendActivity({ ...u, accountStatus: 'Inactive' }, 'P&D access deactivated', detail, ts));
        pushToast('info', `${deactivateTargetUser.fullName}'s P&D access was deactivated. Notification prepared (email delivery pending integration).`);
        setDeactivateTargetUserId(null);
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

    function performArchive(userId: string, reason: string, notes: string) {
        const ts = nowLabel();
        updateUser(userId, (u) =>
            appendActivity(
                { ...u, accountStatus: 'Archived', archivedAt: ts, archiveReason: reason, archiveNotes: notes || undefined },
                'Account archived',
                reason,
                ts,
            ),
        );
        pushToast('info', 'Account archived.');
        setPendingAction(null);
    }

    function confirmPendingAction() {
        if (!pendingAction) return;
        const ts = nowLabel();

        if (pendingAction.entity === 'user') {
            const { entityId, action } = pendingAction;
            switch (action) {
                case 'resendActivation':
                    updateUser(entityId, (u) => appendActivity({ ...u, activationStatus: 'Invitation Sent' }, 'Activation invitation resent', 'Admin resent the activation invitation.', ts));
                    pushToast('success', 'Activation invitation resent.');
                    break;
                case 'sendPasswordReset':
                    updateUser(entityId, (u) => appendActivity(u, 'Password reset sent', 'Admin sent a password reset link.', ts));
                    pushToast('success', 'Password reset link sent.');
                    break;
                case 'unlock':
                    updateUser(entityId, (u) => appendActivity({ ...u, locked: false, failedSignInCount: 0 }, 'Account unlocked', 'Admin unlocked the account.', ts));
                    pushToast('success', 'Account unlocked.');
                    break;
                case 'activate':
                    updateUser(entityId, (u) => appendActivity({ ...u, accountStatus: 'Active', activationStatus: 'Activated' }, 'Account activated', 'Admin activated the account.', ts));
                    pushToast('success', 'Account activated.');
                    break;
                case 'archive':
                    // Handled by the dedicated ArchiveConfirmDialog / performArchive flow.
                    break;
                case 'restore':
                    updateUser(entityId, (u) => appendActivity({ ...u, accountStatus: 'Active', archivedAt: undefined, archiveReason: undefined, archiveNotes: undefined }, 'Account restored', 'Admin restored the account from archive.', ts));
                    pushToast('success', 'Account restored.');
                    break;
                case 'changeRole':
                    updateUser(entityId, (u) =>
                        appendActivity({ ...u, accessRole: (pendingAction.payload as AccessRole) ?? u.accessRole }, 'Access role changed', `Access role changed to ${pendingAction.payload}.`, ts),
                    );
                    pushToast('success', 'Access role updated.');
                    break;
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

    function userMenuItems(user: UserRecord) {
        const items: { label: string; onClick: () => void; danger?: boolean }[] = [
            {
                label: 'View Profile',
                onClick: () => {
                    setSelectedUserId(user.id);
                    setDetailsTab('Overview');
                },
            },
            {
                label: 'Edit Account',
                onClick: () => {
                    setSelectedUserId(user.id);
                    setDetailsTab('Account & Access');
                },
            },
        ];
        if (user.accountStatus === 'Pending Activation') {
            items.push({
                label: 'Resend Activation',
                onClick: () => requestAction({ entity: 'user', entityId: user.id, action: 'resendActivation', title: 'Resend Activation', description: `Resend the activation invitation to ${user.fullName}?` }),
            });
        }
        if (user.accountStatus === 'Active' || user.accountStatus === 'Suspended') {
            items.push({
                label: 'Send Password Reset',
                onClick: () => requestAction({ entity: 'user', entityId: user.id, action: 'sendPasswordReset', title: 'Send Password Reset', description: `Send a password reset link to ${user.fullName}?` }),
            });
        }
        if (user.locked) {
            items.push({
                label: 'Unlock Account',
                onClick: () => requestAction({ entity: 'user', entityId: user.id, action: 'unlock', title: 'Unlock Account', description: `Unlock ${user.fullName}'s account?` }),
            });
        }
        if (user.accountStatus === 'Suspended' || user.accountStatus === 'Inactive') {
            items.push({
                label: 'Activate Account',
                onClick: () => requestAction({ entity: 'user', entityId: user.id, action: 'activate', title: 'Activate Account', description: `Activate ${user.fullName}'s account?` }),
            });
        }
        if (user.accountStatus === 'Active') {
            items.push({
                label: 'Suspend Account',
                onClick: () => setSuspendTargetUserId(user.id),
            });
            items.push({
                label: 'Deactivate P&D Access',
                onClick: () => setDeactivateTargetUserId(user.id),
            });
        }
        items.push({
            label: 'Manage Access',
            onClick: () => setManageAccessUserId(user.id),
        });
        if (user.accountStatus !== 'Archived') {
            items.push({
                label: 'Archive Account',
                danger: true,
                onClick: () =>
                    requestAction({
                        entity: 'user',
                        entityId: user.id,
                        action: 'archive',
                        title: 'Archive User Account',
                        description: 'The account will lose normal system access, but historical records will be retained.',
                    }),
            });
        }
        return items;
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
                label: 'Resend Activation',
                onClick: () => requestAction({ entity: 'incoming', entityId: record.id, action: 'resendActivation', title: 'Resend Activation', description: `Resend the activation invitation to ${record.fullName}?` }),
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
                    label: 'Resend Activation',
                    onClick: () => requestAction({ entity: 'issue', entityId: issue.id, action: 'resendActivation', title: 'Resend Activation', description: `Resend activation invitation for ${subject}?` }),
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
        const person = personnelDirectory.find((p) => p.id === invitePersonId);
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
            requestedBy: CURRENT_ADMIN_NAME,
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
            key: 'user',
            header: 'User',
            render: (u: UserRecord) => (
                <div className="flex items-center gap-3">
                    <Avatar name={u.fullName} />
                    <div className="min-w-0">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedUserId(u.id);
                                setDetailsTab('Overview');
                            }}
                            className="block truncate text-sm font-semibold text-slate-900 transition hover:text-[#F4B400] focus-visible:outline-none focus-visible:underline rounded-sm"
                        >
                            {u.fullName}
                        </button>
                        <p className="truncate text-xs text-slate-400">{u.position}</p>
                    </div>
                </div>
            ),
        },
        { key: 'id', header: 'ID', render: (u: UserRecord) => <span className="font-mono text-xs font-medium text-slate-500">{u.employeeOrTraineeId}</span> },
        { key: 'email', header: 'Email', render: (u: UserRecord) => <span className="text-xs text-slate-500">{u.email}</span> },
        { key: 'role', header: 'Access Role', render: (u: UserRecord) => <Badge type="role" value={u.accessRole} /> },
        { key: 'personType', header: 'Person Type', render: (u: UserRecord) => <Badge type="person" value={u.personType} /> },
        { key: 'department', header: 'Department', render: (u: UserRecord) => <span className="text-xs text-slate-500">{u.department}</span> },
        { key: 'source', header: 'Source', render: (u: UserRecord) => <Badge type="source" value={u.sourceSystem} /> },
        { key: 'status', header: 'Account Status', render: (u: UserRecord) => <Badge type="account" value={u.accountStatus} /> },
        { key: 'lastLogin', header: 'Last Login', render: (u: UserRecord) => <span className="text-xs text-slate-500">{u.lastLogin}</span> },
        { key: 'actions', header: '', className: 'text-right', render: (u: UserRecord) => <div className="flex justify-end"><ActionMenu items={userMenuItems(u)} /></div> },
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
                of <span className="font-semibold text-slate-700">{filteredUsers.length}</span> users
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
                            p === currentPage ? 'border-[#F4B400] bg-[#F4B400] text-white shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
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
        <div className="w-full min-w-0 max-w-full space-y-6 p-4 transition-[margin,width] duration-300 ease-in-out sm:p-6 animate-in fade-in duration-500">
            <PageHeader
                title="User Management"
                description="Manage user accounts, access roles, HR1 provisioning, and account status."
                actions={
                    <button
                        type="button"
                        onClick={openInvite}
                        className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F4B400] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e0a600] focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2 focus:outline-none"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add / Invite User
                    </button>
                }
            />

            {/* FILTERS SECTION */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <select
                        aria-label="Filter by Access Role"
                        value={roleFilter}
                        onChange={(e) => {
                            setRoleFilter(e.target.value as 'All' | AccessRole);
                            setPage(1);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none sm:w-auto"
                    >
                        <option value="All">Access Role</option>
                        {ACCESS_ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter by Account Status"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as 'All' | AccountStatus);
                            setPage(1);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none sm:w-auto"
                    >
                        <option value="All">Account Status</option>
                        {ACCOUNT_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                    
                    <select
                        aria-label="Filter by Person Type"
                        value={personTypeFilter}
                        onChange={(e) => {
                            setPersonTypeFilter(e.target.value as 'All' | PersonType);
                            setPage(1);
                        }}
                        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none sm:w-auto ${showMoreFilters ? 'block' : 'hidden sm:block'}`}
                    >
                        <option value="All">Person Type</option>
                        {PERSON_TYPE_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter by Department"
                        value={departmentFilter}
                        onChange={(e) => {
                            setDepartmentFilter(e.target.value);
                            setPage(1);
                        }}
                        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none sm:w-auto ${showMoreFilters ? 'block' : 'hidden sm:block'}`}
                    >
                        <option value="All">Department</option>
                        {departments.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter by Source"
                        value={sourceFilter}
                        onChange={(e) => {
                            setSourceFilter(e.target.value as 'All' | SourceSystem);
                            setPage(1);
                        }}
                        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition focus:border-[#F4B400] focus:ring-1 focus:ring-[#F4B400] focus:outline-none sm:w-auto ${showMoreFilters ? 'block' : 'hidden sm:block'}`}
                    >
                        <option value="All">Source</option>
                        <option value="HR1">HR1</option>
                        <option value="Manual">Manual</option>
                    </select>

                    <button
                        type="button"
                        onClick={() => setShowMoreFilters((v) => !v)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:hidden focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none"
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {showMoreFilters ? 'Less Filters' : 'More Filters'}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
                    </button>

                    {(roleFilter !== 'All' || statusFilter !== 'All' || personTypeFilter !== 'All' || departmentFilter !== 'All' || sourceFilter !== 'All') && (
                        <button
                            type="button"
                            onClick={() => {
                                setRoleFilter('All');
                                setStatusFilter('All');
                                setPersonTypeFilter('All');
                                setDepartmentFilter('All');
                                setSourceFilter('All');
                            }}
                            className="text-xs font-semibold text-[#F4B400] transition hover:underline focus-visible:ring-2 focus-visible:ring-[#F4B400] focus:outline-none rounded-md px-2 py-1 ml-auto"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <SummaryCard icon={Users} label="Total Users" value={summary.total} />
                <SummaryCard icon={ShieldCheck} label="HR & Admin Accounts" value={summary.hrAdmin} />
                <SummaryCard icon={GraduationCap} label="Trainee Accounts" value={summary.trainees} />
                <SummaryCard icon={CheckCircle2} label="Active Accounts" value={summary.active} />
            </div>

            {/* MAJOR TABS */}
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 custom-scrollbar">
                <div className="flex min-w-max gap-1 border-b border-slate-200">
                    {(['All Users', 'Incoming Trainees', 'Account Issues'] as MajorTab[]).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => {
                                setActiveMajorTab(tab);
                                setPage(1);
                            }}
                            className={`relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:text-slate-900 ${
                                activeMajorTab === tab ? 'border-[#F4B400] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            {tab}
                            {tabCounts[tab] > 0 && (
                                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${activeMajorTab === tab ? 'bg-[#F4B400]/10 text-[#F4B400]' : 'bg-slate-100 text-slate-500'}`}>
                                    {tabCounts[tab]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB CONTENT / TABLES */}
            <div className="animate-in fade-in duration-300">
                {activeMajorTab === 'All Users' && <DataTable title="All Users" columns={userColumns} data={pagedUsers} rowKey={(u) => u.id} footer={usersFooter} />}
                {activeMajorTab === 'Incoming Trainees' && <DataTable title="Incoming Trainees" columns={incomingColumns} data={state.incomingRecords} rowKey={(r) => r.id} />}
                {activeMajorTab === 'Account Issues' && <DataTable title="Account Issues" columns={issueColumns} data={state.issues} rowKey={(i) => i.id} />}
            </div>

            {/* ANALYTICS SECTION (Visible on All Users tab to provide context) */}
            {activeMajorTab === 'All Users' && (
                <DepartmentAnalytics 
                    users={nonArchivedUsers} 
                    currentFilter={departmentFilter} 
                    onSelect={(d) => { setDepartmentFilter(d); setPage(1); }} 
                    onClear={() => { setDepartmentFilter('All'); setPage(1); }} 
                />
            )}

            {/* WORKSPACES & MODALS */}
            {selectedUser && (
                <UserDetailsDrawer 
                    user={selectedUser} 
                    tab={detailsTab} 
                    onTabChange={setDetailsTab} 
                    onClose={() => setSelectedUserId(null)} 
                    onRequestAction={requestAction}
                    onManageAccess={setManageAccessUserId}
                    onAddCommunication={handleAddCommunication}
                    onCreateIssue={handleCreateIssue}
                    onRequestSuspend={setSuspendTargetUserId}
                    onRequestDeactivate={setDeactivateTargetUserId}
                />
            )}

            {manageAccessUser && (
                <ManageAccessModal
                    user={manageAccessUser}
                    onClose={() => setManageAccessUserId(null)}
                    onGrantHR={() => {
                        requestAction({ entity: 'user', entityId: manageAccessUser.id, action: 'changeRole', title: 'Change Role', description: `Change ${manageAccessUser.fullName}'s role to HR?`, payload: 'HR' });
                        setManageAccessUserId(null);
                    }}
                    onGrantAdmin={(justification) => {
                        requestAction({ entity: 'user', entityId: manageAccessUser.id, action: 'changeRole', title: 'Change Role', description: `Change ${manageAccessUser.fullName}'s role to Admin? (Justification: ${justification})`, payload: 'Admin' });
                        setManageAccessUserId(null);
                    }}
                />
            )}

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
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
);

export default UserManagement;
