import SystemSelect from '@/Components/SystemSelect';
import DataTable from '@/Components/DataTable';
import { AppModal } from '@/Components/Competency/CompetencyUI';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
    Archive,
    BookOpen,
    Building2,
    CheckCircle2,
    ChevronRight,
    Clock3,
    ExternalLink,
    FileKey2,
    HelpCircle,
    KeyRound,
    Library,
    LockKeyhole,
    Pencil,
    BellRing,
    Save,
    ScrollText,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    Upload,
    UserRound,
    UsersRound,
    X,
    type LucideIcon,
} from 'lucide-react';
import {
    FormEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
} from 'react';

type Workspace =
    | 'My Profile'
    | 'Organization & Reporting'
    | 'Access & Controls'
    | 'Notifications & Alerts'
    | 'Sign-in Protection'
    | 'Security Logs'
    | 'Audit Trail'
    | 'Archive'
    | 'Privacy Policy'
    | 'Terms of Service'
    | 'FAQ'
    | 'Software License';

type SensitiveSection =
    | 'organization_reporting'
    | 'sign_in_protection'
    | 'security_logs';

type Profile = {
    id: string;
    name: string;
    email: string;
    role: string;
    employee_id: string;
    position: string;
    department: string;
    person_type: string;
    employment_status: string;
    profile_photo_url: string | null;
    member_since: string | null;
};

type SecurityLog = {
    id: string;
    actor: string;
    email: string | null;
    employee_id: string | null;
    role: string;
    event_type: string;
    outcome: string;
    severity: string;
    flagged: boolean;
    ip_address: string | null;
    device: string;
    user_agent: string | null;
    route_name: string | null;
    metadata: Record<string, unknown>;
    occurred_at: string | null;
};

type Account = {
    id: string;
    name: string;
    email: string;
    role: string;
    employee_id: string;
    position: string;
    department: string;
    archived_at: string | null;
    retention_expires_at: string | null;
    archive_reason: string | null;
    anonymized_at: string | null;
};

type Audit = {
    id: string;
    setting_key: string;
    reason: string;
    old_value: unknown;
    new_value: unknown;
    actor: string;
    occurred_at: string;
};

type ArchiveState = {
    retention_years: number;
    expiry_action: string;
    historical_analytics_preserved: boolean;
    retained_accounts: Account[];
    deletion_eligible_accounts: Account[];
    anonymized_count: number;
};

type SettingsState = {
    role: 'admin' | 'hr' | 'user';
    display_timezone: string;
    profile: Profile;
    can_manage_organization: boolean;
    can_manage_reporting: boolean;
    sensitive_access: Record<SensitiveSection, boolean>;
    sensitive_access_ttl_minutes: number;
    sensitive_access_remaining_seconds: Record<SensitiveSection, number>;
    sensitive_access_expires_at: Record<SensitiveSection, number>;
    recent_mfa_available: boolean;
    settings: Record<string, string | number>;
    notification_preferences: {
        performance_actions: boolean;
        competency_actions: boolean;
        learning_actions: boolean;
        training_actions: boolean;
        succession_actions: boolean;
        recognition_actions: boolean;
        security_alerts: boolean;
    };
    security: {
        mfa_enabled: boolean;
        mfa_method: string;
        trusted_devices: number;
        recent_events: {
            id: string;
            event: string;
            outcome: string;
            occurred_at: string;
        }[];
        session_timeout_minutes: number;
    };
    security_metrics: Record<string, number>;
    security_logs: SecurityLog[];
    access_matrix: {
        area: string;
        admin: string;
        hr: string;
        user: string;
    }[];
    audits: Audit[];
    archive: ArchiveState | [];
};

type AccountAction = {
    account: Account;
    mode: 'restore' | 'delete';
};

const sensitiveWorkspace: Partial<Record<Workspace, SensitiveSection>> = {
    'Organization & Reporting': 'organization_reporting',
    'Sign-in Protection': 'sign_in_protection',
    'Security Logs': 'security_logs',
};

const navigation: {
    label: Workspace;
    icon: LucideIcon;
    adminOnly?: boolean;
    staffOnly?: boolean;
    protected?: boolean;
}[] = [
    { label: 'My Profile', icon: UserRound },
    {
        label: 'Organization & Reporting',
        icon: Building2,
        staffOnly: true,
        protected: true,
    },
    { label: 'Sign-in Protection', icon: KeyRound, protected: true },
    {
        label: 'Security Logs',
        icon: ShieldAlert,
        adminOnly: true,
        protected: true,
    },
    { label: 'Audit Trail', icon: ScrollText, staffOnly: true },
    { label: 'Archive', icon: Archive, adminOnly: true },
];

export default function Settings({
    initialSettingsState,
    initialWorkspace,
}: {
    initialSettingsState: SettingsState;
    initialWorkspace?: Workspace;
}) {
    const [state, setState] = useState(initialSettingsState);
    const allowedNavigation = useMemo(
        () =>
            navigation.filter(
                (item) =>
                    (!item.adminOnly || state.role === 'admin') &&
                    (!item.staffOnly || state.role !== 'user'),
            ),
        [state.role],
    );
    const [workspace, setWorkspace] = useState<Workspace>(() => {
        if (!initialWorkspace) return 'My Profile';
        const isKnown =
            allowedNavigation.some((item) => item.label === initialWorkspace) ||
            ['Access & Controls', 'Notifications & Alerts'].includes(initialWorkspace);
        const sensitive = sensitiveWorkspace[initialWorkspace];
        if (!isKnown || (sensitive && !initialSettingsState.sensitive_access[sensitive])) {
            return 'My Profile';
        }
        return initialWorkspace;
    });
    const [values, setValues] = useState<Record<string, string | number>>(
        state.settings,
    );
    const [profileForm, setProfileForm] = useState({
        name: state.profile.name,
        email: state.profile.email,
    });
    const [notificationForm, setNotificationForm] = useState(
        state.notification_preferences,
    );
    const [reason, setReason] = useState('');
    const [flash, setFlash] = useState<{ text: string; tone: 'success' | 'error' | 'warning' } | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [accountAction, setAccountAction] = useState<AccountAction | null>(
        null,
    );
    const [accountReason, setAccountReason] = useState('');
    const [unlockTarget, setUnlockTarget] = useState<Workspace | null>(null);
    const [unlockPassword, setUnlockPassword] = useState('');
    const [unlockError, setUnlockError] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const photoInput = useRef<HTMLInputElement>(null);
    const sensitiveSection = sensitiveWorkspace[workspace];
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (!flash) return;
        const timer = window.setTimeout(() => setFlash(null), 3000);
        return () => window.clearTimeout(timer);
    }, [flash]);

    useEffect(() => {
        if (!sensitiveSection) {
            setCountdown(0);
            return;
        }

        const expiresAt = state.sensitive_access_expires_at?.[sensitiveSection] ?? 0;
        if (expiresAt <= 0) {
            setCountdown(0);
            return;
        }

        let expiredHandled = false;
        const updateCountdown = () => {
            const remaining = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
            setCountdown(remaining);

            if (remaining === 0 && !expiredHandled) {
                expiredHandled = true;
                setState((previous) => ({
                    ...previous,
                    sensitive_access: {
                        ...previous.sensitive_access,
                        [sensitiveSection]: false,
                    },
                    sensitive_access_remaining_seconds: {
                        ...previous.sensitive_access_remaining_seconds,
                        [sensitiveSection]: 0,
                    },
                    sensitive_access_expires_at: {
                        ...previous.sensitive_access_expires_at,
                        [sensitiveSection]: 0,
                    },
                }));
                setWorkspace('My Profile');
                setFlash({
                    text: 'Sensitive access expired. Re-verify your identity to open the protected workspace again.',
                    tone: 'warning',
                });
            }
        };

        updateCountdown();
        const timer = window.setInterval(updateCountdown, 1000);
        return () => window.clearInterval(timer);
    }, [sensitiveSection, state.sensitive_access_expires_at]);

    const breadcrumbs = useMemo(() => {
        const categories: Partial<
            Record<Workspace, { label: string; target: Workspace }>
        > = {
            'Access & Controls': { label: 'My Profile', target: 'My Profile' },
            'Notifications & Alerts': { label: 'My Profile', target: 'My Profile' },
            'Privacy Policy': { label: 'My Profile', target: 'My Profile' },
            'Terms of Service': { label: 'My Profile', target: 'My Profile' },
            FAQ: { label: 'My Profile', target: 'My Profile' },
            'Software License': { label: 'My Profile', target: 'My Profile' },
            'Organization & Reporting': {
                label: 'Administration',
                target: 'Organization & Reporting',
            },
            'Sign-in Protection': {
                label: 'Account & Security',
                target: 'Sign-in Protection',
            },
            'Security Logs': {
                label: 'Security Activity',
                target: 'Security Logs',
            },
            'Audit Trail': { label: 'Organization & Reporting', target: 'Organization & Reporting' },
            Archive: { label: 'Archive & Retention', target: 'Archive' },
        };

        return categories[workspace]
            ? { middle: categories[workspace]!, current: workspace }
            : null;
    }, [workspace]);

    function showFlash(text: string, tone: 'success' | 'error' | 'warning' = 'success') {
        setFlash({ text, tone });
    }

    function applyState(next: SettingsState) {
        setState(next);
        setValues(next.settings);
        setProfileForm({ name: next.profile.name, email: next.profile.email });
        setNotificationForm(next.notification_preferences);
    }

    function openWorkspace(target: Workspace) {
        const section = sensitiveWorkspace[target];
        if (section && !state.sensitive_access[section]) {
            setUnlockTarget(target);
            setUnlockPassword('');
            setUnlockError('');
            return;
        }
        setWorkspace(target);
    }

    async function unlockSensitive(mode: 'password' | 'mfa') {
        if (!unlockTarget) return;
        const section = sensitiveWorkspace[unlockTarget];
        if (!section) return;

        setUnlocking(true);
        setUnlockError('');
        try {
            const response = await axios.post(
                route('governance.api.settings.unlock'),
                {
                    section,
                    mode,
                    password: mode === 'password' ? unlockPassword : undefined,
                },
            );
            applyState(response.data.data);
            setWorkspace(unlockTarget);
            setUnlockTarget(null);
            setUnlockPassword('');
            showFlash(
                `Identity verified. Sensitive access is available for ${response.data.data.sensitive_access_ttl_minutes} minutes.`,
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errors = error.response?.data?.errors;
                setUnlockError(
                    errors?.verification?.[0] ??
                        error.response?.data?.message ??
                        'Verification failed.',
                );
            }
        } finally {
            setUnlocking(false);
        }
    }

    async function save(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setFlash(null);
        try {
            const submitted =
                state.role === 'hr'
                    ? {
                          'reporting.default_period_days':
                              values['reporting.default_period_days'],
                          'reporting.filename_prefix':
                              values['reporting.filename_prefix'],
                      }
                    : values;
            const response = await axios.put(
                route('governance.api.settings.update'),
                { values: submitted, reason },
            );
            applyState(response.data.data);
            setReason('');
            showFlash(
                'Governed settings saved and added to the immutable audit trail.',
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                showFlash(
                    error.response?.data?.message ??
                        'Settings could not be saved.',
                    'error',
                );
            }
        } finally {
            setSaving(false);
        }
    }

    async function saveProfile(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setFlash(null);
        try {
            const response = await axios.patch(
                route('governance.api.settings.profile'),
                {
                    name: profileForm.name.trim(),
                    email: profileForm.email.trim().toLowerCase(),
                },
            );
            applyState(response.data.data);
            router.reload({ only: ['auth'] });
            showFlash('Profile details updated successfully.');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errors = error.response?.data?.errors;
                showFlash(
                    errors?.email?.[0] ??
                        errors?.name?.[0] ??
                        error.response?.data?.message ??
                        'Profile could not be updated.',
                    'error',
                );
            }
        } finally {
            setSaving(false);
        }
    }

    async function saveNotificationPreferences(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setFlash(null);
        try {
            const response = await axios.put(
                route('governance.api.settings.notifications'),
                { preferences: notificationForm },
            );
            applyState(response.data.data);
            window.dispatchEvent(new Event('header-notifications:refresh'));
            showFlash('Notification preferences updated.');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                showFlash(
                    error.response?.data?.message ??
                        'Notification preferences could not be updated.',
                    'error',
                );
            }
        } finally {
            setSaving(false);
        }
    }

    async function uploadPhoto(file?: File) {
        if (!file) return;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showFlash('Use a JPG, PNG, or WEBP image.', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showFlash('Profile photo must be 5 MB or smaller.', 'error');
            return;
        }
        const form = new FormData();
        form.append('photo', file);
        setSaving(true);
        setFlash(null);
        try {
            const response = await axios.post(
                route('governance.api.settings.profile-photo'),
                form,
            );
            applyState(response.data.data);
            router.reload({ only: ['auth'] });
            showFlash('Profile photo updated.');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errors = error.response?.data?.errors;
                showFlash(
                    errors?.photo?.[0] ??
                        error.response?.data?.message ??
                        'Profile photo could not be updated.',
                    'error',
                );
            }
        } finally {
            setSaving(false);
        }
    }

    async function removePhoto() {
        setSaving(true);
        try {
            const response = await axios.delete(
                route('governance.api.settings.profile-photo.remove'),
            );
            applyState(response.data.data);
            router.reload({ only: ['auth'] });
            showFlash('Profile photo removed.');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                showFlash(
                    error.response?.data?.message ??
                        'Profile photo could not be removed.',
                    'error',
                );
            }
        } finally {
            setSaving(false);
        }
    }

    async function submitAccountAction() {
        if (!accountAction || accountReason.trim().length < 8) return;
        setSaving(true);
        setFlash(null);
        try {
            const response =
                accountAction.mode === 'restore'
                    ? await axios.post(
                          route(
                              'governance.api.settings.accounts.restore',
                              accountAction.account.id,
                          ),
                          { reason: accountReason },
                      )
                    : await axios.delete(
                          route(
                              'governance.api.settings.accounts.delete-identity',
                              accountAction.account.id,
                          ),
                          { data: { reason: accountReason } },
                      );
            applyState(response.data.data);
            setAccountAction(null);
            setAccountReason('');
            showFlash(
                accountAction.mode === 'restore'
                    ? 'Archived account restored successfully.'
                    : 'Retained personal identity permanently deleted; de-identified historical references were preserved.',
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                showFlash(
                    error.response?.data?.message ??
                        'Account action could not be completed.',
                    'error',
                );
            }
        } finally {
            setSaving(false);
        }
    }

    const archiveState = Array.isArray(state.archive) ? null : state.archive;

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="truncate text-lg font-bold text-slate-950">
                        Settings
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-500">
                        Account, security, governance, and application controls
                    </p>
                </div>
            }
        >
            <Head title="Settings" />

            {breadcrumbs && (
                <nav
                    aria-label="Breadcrumb"
                    className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"
                >
                    <button
                        type="button"
                        onClick={() => setWorkspace('My Profile')}
                        className="hover:text-amber-700"
                    >
                        Settings
                    </button>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <button
                        type="button"
                        onClick={() => openWorkspace(breadcrumbs.middle.target)}
                        className="hover:text-amber-700"
                    >
                        {breadcrumbs.middle.label}
                    </button>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-slate-950">
                        {breadcrumbs.current}
                    </span>
                </nav>
            )}

            <div className="min-h-[680px] space-y-4">
                {flash && (
                    <div
                        role="status"
                        className={`fixed right-6 top-[88px] z-[95] max-w-md rounded-xl border px-4 py-3 text-xs font-semibold shadow-xl shadow-slate-900/10 ${
                            flash.tone === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : flash.tone === 'error'
                                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                                  : 'border-amber-200 bg-amber-50 text-amber-950'
                        }`}
                    >
                        {flash.text}
                    </div>
                )}

                {sensitiveSection && state.sensitive_access[sensitiveSection] && countdown > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="font-bold">
                                    Identity verified. Sensitive access is available for {state.sensitive_access_ttl_minutes} minutes.
                                </p>
                                <p className="mt-1 text-[11px] text-amber-700">
                                    Temporary access expires automatically. Re-verification is required after expiry.
                                </p>
                            </div>
                            <span className="rounded-full border border-amber-300 bg-white px-3 py-1.5 font-mono text-xs font-bold text-amber-900">
                                Time remaining: {formatCountdown(countdown)}
                            </span>
                        </div>
                    </div>
                )}

                    {workspace === 'My Profile' && (
                        <ProfilePanel
                            state={state}
                            profileForm={profileForm}
                            setProfileForm={setProfileForm}
                            saveProfile={saveProfile}
                            saving={saving}
                            photoInput={photoInput}
                            uploadPhoto={uploadPhoto}
                            removePhoto={removePhoto}
                            openWorkspace={openWorkspace}
                        />
                    )}

                    {workspace === 'Organization & Reporting' && (
                        <OrganizationPanel
                            state={state}
                            values={values}
                            setValues={setValues}
                            reason={reason}
                            setReason={setReason}
                            save={save}
                            saving={saving}
                        />
                    )}

                    {workspace === 'Access & Controls' && (
                        <AccessControlsPanel state={state} />
                    )}

                    {workspace === 'Notifications & Alerts' && (
                        <NotificationsPanel
                            state={state}
                            preferences={notificationForm}
                            setPreferences={setNotificationForm}
                            save={saveNotificationPreferences}
                            saving={saving}
                        />
                    )}

                    {workspace === 'Sign-in Protection' && (
                        <SecurityPanel state={state} />
                    )}

                    {workspace === 'Security Logs' && (
                        <SecurityLogs
                            state={state}
                            onSelect={setSelectedLog}
                        />
                    )}

                    {workspace === 'Audit Trail' && (
                        <DataTable
                            title="Immutable Settings Audit Trail"
                            columns={[
                                {
                                    key: 'setting',
                                    header: 'Setting',
                                    render: (row) => (
                                        <span className="font-semibold text-slate-900">
                                            {row.setting_key}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'actor',
                                    header: 'Changed By',
                                    render: (row) => row.actor,
                                },
                                {
                                    key: 'reason',
                                    header: 'Required Reason',
                                    render: (row) => row.reason,
                                },
                                {
                                    key: 'date',
                                    header: 'Timestamp',
                                    render: (row) =>
                                        formatDate(
                                            row.occurred_at,
                                            state.display_timezone,
                                        ),
                                },
                            ]}
                            data={state.audits}
                            rowKey={(row) => row.id}
                            onRowClick={setSelectedAudit}
                            getRowLabel={(row) =>
                                `Open audit for ${row.setting_key}`
                            }
                        />
                    )}

                    {workspace === 'Archive' && archiveState && (
                        <ArchivePanel
                            archive={archiveState}
                            timezone={state.display_timezone}
                            onAction={setAccountAction}
                        />
                    )}

                    {workspace === 'Privacy Policy' && (
                        <LegalDocumentPanel kind="privacy" />
                    )}
                    {workspace === 'Terms of Service' && (
                        <LegalDocumentPanel kind="terms" />
                    )}
                    {workspace === 'FAQ' && <FaqPanel />}
                    {workspace === 'Software License' && (
                        <SoftwareLicensePanel />
                    )}
            </div>

            <AppModal
                show={Boolean(selectedLog)}
                title={selectedLog?.event_type ?? 'Security Event'}
                description={selectedLog ? formatDate(selectedLog.occurred_at, state.display_timezone) : ''}
                onClose={() => setSelectedLog(null)}
                maxWidth="2xl"
            >
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <Status value={selectedLog.flagged ? 'Flagged' : selectedLog.severity} danger={selectedLog.flagged} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Info label="User" value={selectedLog.actor} />
                            <Info label="Email" value={selectedLog.email ?? 'Unavailable'} />
                            <Info label="Role" value={selectedLog.role} />
                            <Info label="Outcome" value={selectedLog.outcome} />
                            <Info label="IP Address" value={selectedLog.ip_address ?? '—'} />
                            <Info label="Device" value={selectedLog.device} />
                            <Info label="Route" value={selectedLog.route_name ?? '—'} />
                            <Info label="Event ID" value={selectedLog.id} />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                            This ledger entry is immutable and available only for authorized investigation and audit review.
                        </div>
                    </div>
                )}
            </AppModal>

            <AppModal
                show={Boolean(selectedAudit)}
                title={selectedAudit?.setting_key ?? 'Settings Audit'}
                description={selectedAudit ? formatDate(selectedAudit.occurred_at, state.display_timezone) : ''}
                onClose={() => setSelectedAudit(null)}
                maxWidth="lg"
            >
                {selectedAudit && (
                    <div className="space-y-3">
                        <Info label="Changed by" value={selectedAudit.actor} />
                        <Info label="Previous value" value={String(selectedAudit.old_value ?? '—')} />
                        <Info label="New value" value={String(selectedAudit.new_value ?? '—')} />
                        <Info label="Required reason" value={selectedAudit.reason} />
                    </div>
                )}
            </AppModal>

            {accountAction && (
                <AccountActionDrawer
                    action={accountAction}
                    reason={accountReason}
                    setReason={setAccountReason}
                    saving={saving}
                    submit={submitAccountAction}
                    close={() => {
                        setAccountAction(null);
                        setAccountReason('');
                    }}
                    timezone={state.display_timezone}
                />
            )}

            {unlockTarget && (
                <StepUpVerificationModal
                    target={unlockTarget}
                    password={unlockPassword}
                    setPassword={setUnlockPassword}
                    error={unlockError}
                    unlocking={unlocking}
                    recentMfaAvailable={state.recent_mfa_available}
                    onPassword={() => unlockSensitive('password')}
                    onMfa={() => unlockSensitive('mfa')}
                    close={() => {
                        setUnlockTarget(null);
                        setUnlockPassword('');
                        setUnlockError('');
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}

function ProfilePanel({
    state,
    profileForm,
    setProfileForm,
    saveProfile,
    saving,
    photoInput,
    uploadPhoto,
    removePhoto,
    openWorkspace,
}: {
    state: SettingsState;
    profileForm: { name: string; email: string };
    setProfileForm: (value: { name: string; email: string }) => void;
    saveProfile: (event: FormEvent) => void;
    saving: boolean;
    photoInput: RefObject<HTMLInputElement | null>;
    uploadPhoto: (file?: File) => void;
    removePhoto: () => void;
    openWorkspace: (workspace: Workspace) => void;
}) {
    const utilityCards: {
        label: string;
        target: Workspace;
        description: string;
        icon: LucideIcon;
        adminOnly?: boolean;
        staffOnly?: boolean;
        protected?: boolean;
    }[] = [
        {
            label: 'Account & Security',
            target: 'Sign-in Protection',
            description: 'Review MFA, trusted devices, session protection, and your role authority.',
            icon: ShieldCheck,
            protected: true,
        },
        {
            label: 'Security Activity',
            target: 'Security Logs',
            description: 'Review sign-ins, failed attempts, active-session activity, and security events.',
            icon: ShieldAlert,
            adminOnly: true,
            protected: true,
        },
        {
            label: 'Notifications & Alerts',
            target: 'Notifications & Alerts',
            description: 'Choose which live workflow alerts appear in the header notification center.',
            icon: BellRing,
        },
        {
            label: 'Organization & Reporting',
            target: 'Organization & Reporting',
            description: 'Manage controlled organization-wide display and reporting defaults.',
            icon: Building2,
            staffOnly: true,
            protected: true,
        },
        {
            label: 'Archive & Retention',
            target: 'Archive',
            description: 'Review retained former accounts and retention-completed identity records.',
            icon: Archive,
            adminOnly: true,
        },
    ];

    const profileDirty =
        profileForm.name.trim() !== state.profile.name ||
        profileForm.email.trim().toLowerCase() !== state.profile.email.toLowerCase();

    return (
        <div className="space-y-4">
            <section className="app-card overflow-hidden border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                                <UserRound className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                    Signed-in account
                                </p>
                                <h2 className="mt-0.5 text-lg font-extrabold text-slate-950">
                                    My Profile
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Update your display name, email address, and profile photo.
                                </p>
                            </div>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-600">
                            Member since{' '}
                            {formatDate(
                                state.profile.member_since,
                                state.display_timezone,
                                true,
                            )}
                        </span>
                    </div>
                </div>

                <div className="grid gap-0 xl:grid-cols-[250px_minmax(0,1fr)]">
                    <div className="flex flex-col items-center border-b border-slate-200 bg-white p-6 text-center xl:border-b-0 xl:border-r">
                        <Avatar profile={state.profile} large />
                        <h3 className="mt-4 text-base font-extrabold text-slate-950">
                            {state.profile.name}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                            {state.profile.position}
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                                {state.profile.role}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                                {state.profile.employment_status}
                            </span>
                        </div>

                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => photoInput.current?.click()}
                            className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Upload className="h-4 w-4" /> Change photo
                        </button>
                        {state.profile.profile_photo_url && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={removePhoto}
                                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Trash2 className="h-4 w-4" /> Remove photo
                            </button>
                        )}
                        <input
                            ref={photoInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = '';
                                void uploadPhoto(file);
                            }}
                        />
                        <p className="mt-2 text-[10px] leading-4 text-slate-400">
                            JPG, PNG or WEBP · maximum 5 MB
                        </p>
                    </div>

                    <form onSubmit={saveProfile} className="min-w-0 p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-950">
                                    Profile information
                                </h3>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                                    Your name and email are account fields you can update here. Employment identity remains read-only so organizational records stay consistent.
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                                <Pencil className="h-3 w-3" /> Editable account fields
                            </span>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <Field
                                label="Full name"
                                value={profileForm.name}
                                disabled={saving}
                                onChange={(value) =>
                                    setProfileForm({
                                        ...profileForm,
                                        name: value,
                                    })
                                }
                            />
                            <Field
                                label="Email address"
                                type="email"
                                value={profileForm.email}
                                disabled={saving}
                                onChange={(value) =>
                                    setProfileForm({
                                        ...profileForm,
                                        email: value,
                                    })
                                }
                            />
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold text-slate-800">Organization identity</p>
                                    <p className="mt-0.5 text-[10px] text-slate-500">Read-only information synchronized with workforce records.</p>
                                </div>
                                <LockKeyhole className="h-4 w-4 text-slate-400" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <Info
                                    label="Employee / account ID"
                                    value={state.profile.employee_id}
                                />
                                <Info
                                    label="Department"
                                    value={state.profile.department}
                                />
                                <Info
                                    label="Position"
                                    value={state.profile.position}
                                />
                                <Info
                                    label="Person type"
                                    value={state.profile.person_type}
                                />
                                <Info
                                    label="Access role"
                                    value={state.profile.role}
                                />
                                <Info
                                    label="Account status"
                                    value={state.profile.employment_status}
                                />
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                            <p className="text-[10px] leading-4 text-slate-400">
                                Profile changes are saved to your account and reflected in the application header.
                            </p>
                            <div className="flex items-center gap-2">
                                {profileDirty && (
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() =>
                                            setProfileForm({
                                                name: state.profile.name,
                                                email: state.profile.email,
                                            })
                                        }
                                        className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Reset
                                    </button>
                                )}
                                <button
                                    disabled={saving || !profileDirty}
                                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#F4B400] px-4 text-xs font-bold text-slate-950 shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    <Save className="h-4 w-4" />
                                    {saving ? 'Saving...' : 'Save profile'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </section>

            <section className="app-card p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-slate-950">
                            Account & system settings
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Keep account security, integrations, organization controls, and retention governance in focused workspaces.
                        </p>
                    </div>
                    {state.role !== 'user' && (
                        <button
                            type="button"
                            onClick={() => openWorkspace('Audit Trail')}
                            className="text-xs font-bold text-slate-500 transition hover:text-amber-700"
                        >
                            Settings audit
                        </button>
                    )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {utilityCards
                        .filter(
                            (card) =>
                                (!card.staffOnly || state.role !== 'user') &&
                                (!card.adminOnly || state.role === 'admin'),
                        )
                        .map(({ label, target, description, icon: Icon, protected: protectedCard }) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => openWorkspace(target)}
                                className="group min-h-32 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-amber-50 group-hover:text-amber-700">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-950">
                                    {label}
                                    {protectedCard && <LockKeyhole className="h-3 w-3 text-slate-400" />}
                                </span>
                                <span className="mt-1.5 block text-[11px] leading-5 text-slate-500">
                                    {description}
                                </span>
                            </button>
                        ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-xs">
                    <span className="font-bold text-slate-500">Help & Legal</span>
                    <button type="button" onClick={() => openWorkspace('FAQ')} className="font-semibold text-slate-500 hover:text-amber-700">FAQ</button>
                    <button type="button" onClick={() => openWorkspace('Privacy Policy')} className="font-semibold text-slate-500 hover:text-amber-700">Privacy Policy</button>
                    <button type="button" onClick={() => openWorkspace('Terms of Service')} className="font-semibold text-slate-500 hover:text-amber-700">Terms of Service</button>
                    <button type="button" onClick={() => openWorkspace('Software License')} className="font-semibold text-slate-500 hover:text-amber-700">Open-source licenses</button>
                </div>
            </section>
        </div>
    );
}

function OrganizationPanel({
    state,
    values,
    setValues,
    reason,
    setReason,
    save,
    saving,
}: {
    state: SettingsState;
    values: Record<string, string | number>;
    setValues: (values: Record<string, string | number>) => void;
    reason: string;
    setReason: (value: string) => void;
    save: (event: FormEvent) => void;
    saving: boolean;
}) {
    return (
        <form onSubmit={save} className="app-card overflow-hidden">
            <div className="app-card-header">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-950">
                            Organization & Reporting
                        </h2>
                        <Pill icon={LockKeyhole} text="Re-verified" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        Govern organization-wide display and reporting defaults.
                        Every change requires a reason and is audited.
                    </p>
                </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
                <Field
                    label="Organization name"
                    value={values['organization.name'] ?? ''}
                    disabled={!state.can_manage_organization}
                    onChange={(value) =>
                        setValues({ ...values, 'organization.name': value })
                    }
                />
                <Field
                    label="Timezone"
                    value={values['organization.timezone'] ?? ''}
                    disabled={!state.can_manage_organization}
                    onChange={(value) =>
                        setValues({ ...values, 'organization.timezone': value })
                    }
                />
                <Field
                    label="Date format"
                    value={values['organization.date_format'] ?? ''}
                    disabled={!state.can_manage_organization}
                    onChange={(value) =>
                        setValues({ ...values, 'organization.date_format': value })
                    }
                />
                <Field
                    label="Default report period (days)"
                    type="number"
                    value={values['reporting.default_period_days'] ?? 90}
                    disabled={!state.can_manage_reporting}
                    onChange={(value) =>
                        setValues({
                            ...values,
                            'reporting.default_period_days': Number(value),
                        })
                    }
                />
                <Field
                    label="Export filename prefix"
                    value={values['reporting.filename_prefix'] ?? ''}
                    disabled={!state.can_manage_reporting}
                    onChange={(value) =>
                        setValues({
                            ...values,
                            'reporting.filename_prefix': value,
                        })
                    }
                />
                <label className="md:col-span-2">
                    <span className="text-xs font-bold text-slate-600">
                        Required change reason
                    </span>
                    <textarea
                        className="app-control mt-1 min-h-24 w-full"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        minLength={8}
                        required
                        placeholder="Explain the business reason for this settings change."
                    />
                </label>
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                    disabled={saving || reason.trim().length < 8}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#F4B400] px-4 text-xs font-bold text-black disabled:opacity-50"
                >
                    <Save className="h-4 w-4" /> Save governed settings
                </button>
            </div>
        </form>
    );
}

function AccessControlsPanel({ state }: { state: SettingsState }) {
    return (
        <div className="space-y-4">
            <section className="app-card p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                        <UsersRound className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-sm font-bold text-slate-950">
                            Access & Controls
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                            Role boundaries are enforced on the server, not only
                            hidden in the interface. Sensitive administrative
                            workspaces add step-up verification on top of role
                            access.
                        </p>
                    </div>
                </div>
            </section>
            <DataTable
                title="Role Authority Matrix"
                columns={[
                    {
                        key: 'area',
                        header: 'Governed Area',
                        render: (row) => (
                            <span className="font-semibold text-slate-900">
                                {row.area}
                            </span>
                        ),
                    },
                    { key: 'admin', header: 'Admin', render: (row) => row.admin },
                    { key: 'hr', header: 'HR', render: (row) => row.hr },
                    { key: 'user', header: 'User', render: (row) => row.user },
                ]}
                data={state.access_matrix}
                rowKey={(row) => row.area}
            />
        </div>
    );
}

function NotificationsPanel({
    state,
    preferences,
    setPreferences,
    save,
    saving,
}: {
    state: SettingsState;
    preferences: SettingsState['notification_preferences'];
    setPreferences: (value: SettingsState['notification_preferences']) => void;
    save: (event: FormEvent) => void;
    saving: boolean;
}) {
    const rows: {
        key: keyof SettingsState['notification_preferences'];
        title: string;
        description: string;
        adminOnly?: boolean;
        operatorOnly?: boolean;
        requiredForAdmin?: boolean;
    }[] = [
        {
            key: 'performance_actions',
            title: 'Performance actions',
            description: 'Calibration and review-governance items that require action.',
            operatorOnly: true,
        },
        {
            key: 'competency_actions',
            title: 'Competency validations',
            description: 'Submitted assessments waiting for validation or finalization.',
            operatorOnly: true,
        },
        {
            key: 'learning_actions',
            title: 'Learning governance & deadlines',
            description: 'Course governance, overdue assignments, and due learning alerts.',
        },
        {
            key: 'training_actions',
            title: 'Training coordination',
            description: 'Open requirements, upcoming sessions, and sessions that need finalization.',
        },
        {
            key: 'succession_actions',
            title: 'Succession reviews',
            description: 'Critical-position reviews and candidate readiness decisions that are due.',
            operatorOnly: true,
        },
        {
            key: 'recognition_actions',
            title: 'Recognition activity',
            description: 'Recognition nominations waiting for review and recent published recognition.',
        },
        {
            key: 'security_alerts',
            title: 'Security alerts',
            description: 'Flagged authentication and security activity from the live audit ledger.',
            adminOnly: true,
            requiredForAdmin: true,
        },
    ];

    const visibleRows = rows.filter((row) => {
        if (row.adminOnly && state.role !== 'admin') return false;
        if (row.operatorOnly && state.role === 'user') return false;
        return true;
    });

    const dirty = JSON.stringify(preferences) !== JSON.stringify(state.notification_preferences);

    return (
        <form onSubmit={save} className="space-y-4">
            <section className="app-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <BellRing className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-slate-950">
                                Notifications & Alerts
                            </h2>
                            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                                These preferences directly control the live notification center in the header. Alert counts come from current system records and refresh automatically.
                            </p>
                        </div>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">
                        Live system data
                    </span>
                </div>
            </section>

            <section className="app-card divide-y divide-slate-100 overflow-hidden">
                {visibleRows.map((row) => {
                    const locked = Boolean(row.requiredForAdmin && state.role === 'admin');
                    const enabled = locked ? true : Boolean(preferences[row.key]);
                    return (
                        <div key={row.key} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-900">{row.title}</h3>
                                    {locked && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                            Required for Admin
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{row.description}</p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={`${enabled ? 'Disable' : 'Enable'} ${row.title}`}
                                disabled={locked || saving}
                                onClick={() =>
                                    setPreferences({
                                        ...preferences,
                                        [row.key]: !enabled,
                                    })
                                }
                                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${enabled
                                    ? 'border-amber-400 bg-[#F4B400]'
                                    : 'border-slate-300 bg-slate-200'
                                } ${locked || saving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                            >
                                <span
                                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>
                    );
                })}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4 sm:px-6">
                    <p className="text-[11px] leading-5 text-slate-500">
                        The bell also refreshes whenever you open it, return to the browser tab, or save these preferences.
                    </p>
                    <button
                        type="submit"
                        disabled={!dirty || saving}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#F4B400] px-4 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-[#E5A900] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving…' : 'Save preferences'}
                    </button>
                </div>
            </section>
        </form>
    );
}

function SecurityPanel({ state }: { state: SettingsState }) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
                <section className="app-card p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <LockKeyhole className="h-5 w-5" />
                        </span>
                        <Pill icon={ShieldCheck} text="Identity verified" />
                    </div>
                    <h2 className="mt-4 text-sm font-bold text-slate-950">
                        Account & Security
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        Review your account verification posture, trusted sign-in methods, and protected access boundaries.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Info
                            label="MFA status"
                            value={
                                state.security.mfa_enabled
                                    ? 'Enabled'
                                    : 'Not enabled'
                            }
                        />
                        <Info
                            label="Default method"
                            value={state.security.mfa_method}
                        />
                        <Info
                            label="Trusted devices"
                            value={state.security.trusted_devices}
                        />
                        <Info
                            label="Inactivity timeout"
                            value={`${state.security.session_timeout_minutes} minutes`}
                        />
                    </div>
                    <a
                        href={route('security.mfa')}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-700"
                    >
                        Manage MFA methods{' '}
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </section>

                <section className="app-card p-5 sm:p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <ShieldCheck className="h-5 w-5" />
                    </span>
                    <h2 className="mt-4 text-sm font-bold text-slate-950">
                        Security controls
                    </h2>
                    <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
                        <li>
                            Failed sign-ins are rate-limited and high-risk
                            attempts are flagged in the immutable ledger.
                        </li>
                        <li>
                            Inactive sessions expire after{' '}
                            <strong>
                                {state.security.session_timeout_minutes} minutes
                            </strong>{' '}
                            and record the calculated expiry timestamp.
                        </li>
                        <li>
                            Sensitive Settings pages require password or recent
                            MFA re-verification.
                        </li>
                    </ul>
                </section>
            </div>

            {state.security.recent_events.length > 0 && (
                <section className="app-card p-5 sm:p-6">
                    <h3 className="text-sm font-bold text-slate-950">
                        Recent MFA activity
                    </h3>
                    <div className="mt-4 divide-y divide-slate-100">
                        {state.security.recent_events.map((event) => (
                            <div
                                key={event.id}
                                className="flex items-center justify-between gap-3 py-3 text-xs"
                            >
                                <div>
                                    <p className="font-semibold text-slate-800">
                                        {event.event}
                                    </p>
                                    <p className="mt-0.5 text-slate-400">
                                        {formatDate(
                                            event.occurred_at,
                                            state.display_timezone,
                                        )}
                                    </p>
                                </div>
                                <Status
                                    value={event.outcome}
                                    danger={event.outcome !== 'success'}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <DataTable
                title="Role Authority Matrix"
                columns={[
                    {
                        key: 'area',
                        header: 'Governed Area',
                        render: (row) => (
                            <span className="font-semibold text-slate-900">{row.area}</span>
                        ),
                    },
                    { key: 'admin', header: 'Admin', render: (row) => row.admin },
                    { key: 'hr', header: 'HR', render: (row) => row.hr },
                    { key: 'user', header: 'User', render: (row) => row.user },
                ]}
                data={state.access_matrix}
                rowKey={(row) => row.area}
                pageSize={10}
                footer={<span className="text-xs text-slate-500">Authority is enforced by server-side role and governance rules.</span>}
            />
        </div>
    );
}

function SecurityLogs({
    state,
    onSelect,
}: {
    state: SettingsState;
    onSelect: (log: SecurityLog) => void;
}) {
    const [restrictionMessage, setRestrictionMessage] = useState('');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All Roles');
    const [eventFilter, setEventFilter] = useState('All Events');
    const [dateRange, setDateRange] = useState('Today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    useEffect(() => {
        const blockContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            setRestrictionMessage('Right-click is disabled in Security Logs.');
        };
        const blockPrint = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
                event.preventDefault();
                setRestrictionMessage('Printing is disabled in Security Logs. Use the governed PDF export when a documented copy is required.');
            }
            if (event.key === 'PrintScreen') {
                setRestrictionMessage(
                    'Screen capture is restricted by policy. Browser code cannot guarantee blocking operating-system screenshots.',
                );
            }
        };

        document.body.classList.add('security-logs-protected');
        document.addEventListener('contextmenu', blockContextMenu);
        document.addEventListener('keydown', blockPrint);
        return () => {
            document.body.classList.remove('security-logs-protected');
            document.removeEventListener('contextmenu', blockContextMenu);
            document.removeEventListener('keydown', blockPrint);
        };
    }, []);

    const roleOptions = useMemo(
        () => ['All Roles', ...Array.from(new Set(state.security_logs.map((log) => log.role))).sort()],
        [state.security_logs],
    );

    const filteredLogs = useMemo(() => {
        const today = dateKeyInTimezone(new Date(), state.display_timezone);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const lastSevenStart = dateKeyInTimezone(sevenDaysAgo, state.display_timezone);

        return state.security_logs.filter((log) => {
            const canonicalEvent = securityEventLabel(log.event_type);
            const query = search.trim().toLowerCase();
            const searchable = [
                log.actor,
                log.employee_id ?? '',
                log.email ?? '',
                log.role,
                canonicalEvent,
                log.event_type,
                log.ip_address ?? '',
                log.device,
            ]
                .join(' ')
                .toLowerCase();

            if (query && !searchable.includes(query)) return false;
            if (roleFilter !== 'All Roles' && log.role !== roleFilter) return false;
            if (eventFilter !== 'All Events' && canonicalEvent !== eventFilter) return false;

            if (!log.occurred_at) return false;
            const occurred = new Date(log.occurred_at);
            if (Number.isNaN(occurred.getTime())) return false;
            const occurredDay = dateKeyInTimezone(occurred, state.display_timezone);

            if (dateRange === 'Today' && occurredDay !== today) return false;
            if (dateRange === 'Last 7 Days' && (occurredDay < lastSevenStart || occurredDay > today)) return false;
            if (dateRange === 'Custom') {
                if (customFrom && occurredDay < customFrom) return false;
                if (customTo && occurredDay > customTo) return false;
            }

            return true;
        });
    }, [state.security_logs, state.display_timezone, search, roleFilter, eventFilter, dateRange, customFrom, customTo]);

    function exportCsv() {
        const headers = [
            'User',
            'Employee ID',
            'Email',
            'Role',
            'Event Type',
            'Outcome',
            'Timestamp',
            'IP Address',
            'Device',
        ];
        const rows = filteredLogs.map((log) => [
            log.actor,
            log.employee_id ?? '',
            log.email ?? '',
            log.role,
            securityEventLabel(log.event_type),
            log.outcome,
            formatDate(log.occurred_at, state.display_timezone),
            log.ip_address ?? '',
            log.device,
        ]);
        const csv = [headers, ...rows]
            .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        downloadBlob(
            new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
            `security-logs-${dateKeyInTimezone(new Date(), state.display_timezone)}.csv`,
        );
    }

    function exportPdf() {
        const lines = filteredLogs.flatMap((log, index) => [
            `${index + 1}. ${log.actor} | ${log.employee_id ?? 'No ID'} | ${log.role}`,
            `   ${securityEventLabel(log.event_type)} | ${log.outcome} | ${formatDate(log.occurred_at, state.display_timezone)}`,
            `   IP: ${log.ip_address ?? 'N/A'} | Device: ${log.device}`,
            '',
        ]);
        downloadTextPdf(
            `security-logs-${dateKeyInTimezone(new Date(), state.display_timezone)}.pdf`,
            'Security Logs Export',
            [
                `Timezone: ${state.display_timezone}`,
                `Filters: role=${roleFilter}; event=${eventFilter}; range=${dateRange}; search=${search || 'none'}`,
                `Records: ${filteredLogs.length}`,
                '',
                ...lines,
            ],
        );
    }

    return (
        <div
            className="security-sensitive-view space-y-4"
            onContextMenu={(event) => event.preventDefault()}
        >
            <style>{`
                @media print {
                    body.security-logs-protected * { visibility: hidden !important; }
                    body.security-logs-protected::before {
                        content: 'Printing Security Logs is disabled by application policy. Use the governed PDF export.';
                        visibility: visible !important;
                        position: fixed;
                        inset: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 48px;
                        font: 700 16px/1.5 sans-serif;
                    }
                }
            `}</style>

            <section className="app-card overflow-hidden border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-slate-700" />
                            <h2 className="text-sm font-bold text-slate-950">Security Activity</h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            Admin-only immutable authentication, session, and security activity ledger.
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Protected display
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                            Right-click & browser printing disabled
                        </p>
                    </div>
                </div>
                {restrictionMessage && (
                    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-900">
                        {restrictionMessage}
                    </div>
                )}
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                    label="Total Logins Today"
                    value={state.security_metrics.total_logins_today ?? 0}
                    icon={CheckCircle2}
                />
                <Metric
                    label="Active Sessions Now"
                    value={`${state.security_metrics.active_sessions_now ?? 0} user(s) online`}
                    icon={Clock3}
                />
                <Metric
                    label="Failed Login Attempts"
                    value={`${state.security_metrics.failed_login_attempts_today ?? 0} warning(s)`}
                    icon={ShieldAlert}
                />
                <Metric
                    label="Session Timeouts Today"
                    value={state.security_metrics.session_timeouts_today ?? 0}
                    icon={Clock3}
                />
            </div>

            <section className="app-card p-4 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.5fr)_minmax(150px,0.7fr)_minmax(170px,0.8fr)_minmax(160px,0.7fr)_auto]">
                    <label>
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Search user
                        </span>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="app-control w-full"
                            placeholder="Employee name or Employee ID"
                        />
                    </label>
                    <label>
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Role
                        </span>
                        <SystemSelect
                            className="app-control w-full"
                            value={roleFilter}
                            onChange={(event) => setRoleFilter(event.target.value)}
                        >
                            {roleOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </SystemSelect>
                    </label>
                    <label>
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Event type
                        </span>
                        <SystemSelect
                            className="app-control w-full"
                            value={eventFilter}
                            onChange={(event) => setEventFilter(event.target.value)}
                        >
                            <option>All Events</option>
                            <option>LOG_IN</option>
                            <option>LOG_OUT</option>
                            <option>FAILED_LOGIN</option>
                            <option>SESSION_TIMEOUT</option>
                        </SystemSelect>
                    </label>
                    <label>
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Date range
                        </span>
                        <SystemSelect
                            className="app-control w-full"
                            value={dateRange}
                            onChange={(event) => setDateRange(event.target.value)}
                        >
                            <option>Today</option>
                            <option>Last 7 Days</option>
                            <option>Custom</option>
                        </SystemSelect>
                    </label>
                    <div className="flex items-end gap-2">
                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={filteredLogs.length === 0}
                            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                            CSV
                        </button>
                        <button
                            type="button"
                            onClick={exportPdf}
                            disabled={filteredLogs.length === 0}
                            className="h-10 rounded-xl bg-[#F4B400] px-3 text-xs font-bold text-slate-950 transition hover:brightness-95 disabled:opacity-40"
                        >
                            PDF
                        </button>
                    </div>
                </div>

                {dateRange === 'Custom' && (
                    <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                        <label>
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">From</span>
                            <input
                                type="date"
                                className="app-control w-full"
                                value={customFrom}
                                onChange={(event) => setCustomFrom(event.target.value)}
                            />
                        </label>
                        <label>
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">To</span>
                            <input
                                type="date"
                                className="app-control w-full"
                                value={customTo}
                                min={customFrom || undefined}
                                onChange={(event) => setCustomTo(event.target.value)}
                            />
                        </label>
                    </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
                    <span>{filteredLogs.length} of {state.security_logs.length} record(s) shown</span>
                    <button
                        type="button"
                        onClick={() => {
                            setSearch('');
                            setRoleFilter('All Roles');
                            setEventFilter('All Events');
                            setDateRange('Today');
                            setCustomFrom('');
                            setCustomTo('');
                        }}
                        className="font-bold text-amber-700 hover:text-amber-800"
                    >
                        Reset filters
                    </button>
                </div>
            </section>

            <DataTable
                title="Security Activity Ledger"
                columns={[
                    {
                        key: 'user',
                        header: 'User Details',
                        render: (row) => (
                            <div className="min-w-48">
                                <p className="font-semibold text-slate-950">{row.actor}</p>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                    {row.employee_id ?? 'No employee ID'} · {row.email ?? 'Unrecognized account'} · {row.role}
                                </p>
                            </div>
                        ),
                    },
                    {
                        key: 'event',
                        header: 'Event Type',
                        render: (row) => (
                            <div>
                                <p className="font-mono text-xs font-bold text-slate-800">
                                    {securityEventLabel(row.event_type)}
                                </p>
                                <div className="mt-1">
                                    <Status value={row.outcome} danger={row.flagged || row.outcome === 'Failed'} />
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: 'timestamp',
                        header: 'Timestamp',
                        render: (row) => (
                            <span className="whitespace-nowrap text-xs font-medium text-slate-700">
                                {formatDate(row.occurred_at, state.display_timezone)}
                            </span>
                        ),
                    },
                    {
                        key: 'ip',
                        header: 'IP Address',
                        render: (row) => row.ip_address ?? '—',
                    },
                    {
                        key: 'device',
                        header: 'Device',
                        render: (row) => <span className="text-xs text-slate-700">{row.device}</span>,
                    },
                ]}
                data={filteredLogs}
                rowKey={(row) => row.id}
                onRowClick={onSelect}
                getRowLabel={(row) => `Open ${securityEventLabel(row.event_type)} security log`}
            />

            <p className="px-1 text-[10px] leading-4 text-slate-400">
                Timestamps and date filters use {state.display_timezone}. CSV and PDF exports contain only the currently filtered records.
                The application blocks right-click and browser printing in this protected view; operating-system or external-camera screenshots cannot be guaranteed to be blocked by browser code.
            </p>
        </div>
    );
}

function ArchivePanel({
    archive,
    timezone,
    onAction,
}: {
    archive: ArchiveState;
    timezone: string;
    onAction: (action: AccountAction) => void;
}) {
    return (
        <div className="space-y-4">
            <section className="app-card overflow-hidden">
                <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                                <Archive className="h-5 w-5" />
                            </span>
                            <div>
                                <h2 className="text-sm font-bold text-slate-950">
                                    Archive & Retention
                                </h2>
                                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                                    Former accounts remain retained for{' '}
                                    {archive.retention_years} years. When the
                                    retention period ends, personal identity can
                                    be permanently removed while de-identified
                                    historical analytics remain intact.
                                </p>
                            </div>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-600">
                            Governed retention policy
                        </span>
                    </div>
                </div>
                <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
                    <ArchiveStat
                        label="Retention active"
                        value={archive.retained_accounts.length}
                        note="Former accounts still inside 5 years"
                    />
                    <ArchiveStat
                        label="Deletion eligible"
                        value={archive.deletion_eligible_accounts.length}
                        note="Retention period completed"
                    />
                    <ArchiveStat
                        label="Identity deleted"
                        value={archive.anonymized_count}
                        note="De-identified historical references"
                    />
                </div>
            </section>

            <DataTable
                title="Archived Accounts · Retention Active"
                columns={[
                    {
                        key: 'account',
                        header: 'Former Account',
                        render: (row) => (
                            <div>
                                <p className="font-semibold text-slate-950">
                                    {row.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {row.email}
                                </p>
                            </div>
                        ),
                    },
                    {
                        key: 'reason',
                        header: 'Separation / Archive Reason',
                        render: (row) => (
                            <span className="text-xs text-slate-600">
                                {row.archive_reason ?? 'Archived account'}
                            </span>
                        ),
                    },
                    {
                        key: 'archived',
                        header: 'Archived',
                        render: (row) =>
                            formatDate(row.archived_at, timezone, true),
                    },
                    {
                        key: 'retention',
                        header: 'Retention Ends',
                        render: (row) =>
                            formatDate(row.retention_expires_at, timezone, true),
                    },
                    {
                        key: 'status',
                        header: 'Status',
                        render: () => <Status value="Retained" />,
                    },
                ]}
                data={archive.retained_accounts}
                rowKey={(row) => row.id}
                onRowClick={(account) =>
                    onAction({ account, mode: 'restore' })
                }
                getRowLabel={(row) => `Open archived account ${row.name}`}
            />

            <DataTable
                title="Retention Completed · Eligible for Permanent Identity Deletion"
                columns={[
                    {
                        key: 'account',
                        header: 'Former Account',
                        render: (row) => (
                            <div>
                                <p className="font-semibold text-slate-950">
                                    {row.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {row.employee_id} · {row.department}
                                </p>
                            </div>
                        ),
                    },
                    {
                        key: 'archived',
                        header: 'Archived',
                        render: (row) =>
                            formatDate(row.archived_at, timezone, true),
                    },
                    {
                        key: 'retention',
                        header: 'Retention Completed',
                        render: (row) =>
                            formatDate(row.retention_expires_at, timezone, true),
                    },
                    {
                        key: 'status',
                        header: 'Status',
                        render: () => (
                            <Status value="Eligible for deletion" danger />
                        ),
                    },
                ]}
                data={archive.deletion_eligible_accounts}
                rowKey={(row) => row.id}
                onRowClick={(account) =>
                    onAction({ account, mode: 'delete' })
                }
                getRowLabel={(row) =>
                    `Open permanent identity deletion for ${row.name}`
                }
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-500">
                New employment separation should come from the governed personnel
                lifecycle. This Settings workspace focuses only on records that
                are already archived and their retention outcome.
            </div>
        </div>
    );
}

function AccountActionDrawer({
    action,
    reason,
    setReason,
    saving,
    submit,
    close,
    timezone,
}: {
    action: AccountAction;
    reason: string;
    setReason: (reason: string) => void;
    saving: boolean;
    submit: () => void;
    close: () => void;
    timezone: string;
}) {
    const deleting = action.mode === 'delete';
    return (
        <AppModal
            show
            title={action.account.name}
            description={`${action.account.position} · ${action.account.department}`}
            onClose={close}
            maxWidth="2xl"
        >
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Email" value={action.account.email} />
                    <Info label="Employee ID" value={action.account.employee_id} />
                    <Info label="Role" value={action.account.role} />
                    <Info label="Archived" value={formatDate(action.account.archived_at, timezone, true)} />
                    <Info label="Retention ends" value={formatDate(action.account.retention_expires_at, timezone, true)} />
                    <Info label="Archive reason" value={action.account.archive_reason ?? '—'} />
                </div>

                {deleting && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
                        This permanently removes the former employee’s personal identity fields from the operational account while preserving de-identified historical references required for record integrity.
                    </div>
                )}

                <label className="block">
                    <span className="text-xs font-bold text-slate-600">Required reason</span>
                    <textarea
                        className="app-control mt-1 min-h-24 w-full"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        minLength={8}
                        placeholder={deleting ? 'Document why retention-completed identity deletion is being executed.' : 'Document the approved reason for restoring this former account.'}
                    />
                </label>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                    <button type="button" onClick={close} className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button
                        type="button"
                        disabled={saving || reason.trim().length < 8}
                        onClick={submit}
                        className={`h-9 rounded-xl px-4 text-xs font-bold disabled:opacity-50 ${deleting ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-[#F4B400] text-black'}`}
                    >
                        {deleting ? 'Delete retained identity' : 'Restore account'}
                    </button>
                </div>
            </div>
        </AppModal>
    );
}

function StepUpVerificationModal({
    target,
    password,
    setPassword,
    error,
    unlocking,
    recentMfaAvailable,
    onPassword,
    onMfa,
    close,
}: {
    target: Workspace;
    password: string;
    setPassword: (value: string) => void;
    error: string;
    unlocking: boolean;
    recentMfaAvailable: boolean;
    onPassword: () => void;
    onMfa: () => void;
    close: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={`Verify identity for ${target}`}
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                    <div className="flex gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <LockKeyhole className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                Sensitive settings
                            </p>
                            <h2 className="mt-0.5 text-sm font-bold text-slate-950">
                                Verify it’s you
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                Re-verify before opening{' '}
                                <strong>{target}</strong>.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close verification"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <label className="block">
                        <span className="text-xs font-bold text-slate-600">
                            Account password
                        </span>
                        <input
                            type="password"
                            autoComplete="current-password"
                            className="app-control mt-1 w-full"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && password) onPassword();
                            }}
                            placeholder="Enter your current password"
                        />
                    </label>

                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800">
                            {error}
                        </div>
                    )}

                    <button
                        type="button"
                        disabled={unlocking || !password}
                        onClick={onPassword}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50"
                    >
                        <KeyRound className="h-4 w-4" /> Verify with password
                    </button>

                    {recentMfaAvailable && (
                        <>
                            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                <span className="h-px flex-1 bg-slate-200" /> or{' '}
                                <span className="h-px flex-1 bg-slate-200" />
                            </div>
                            <button
                                type="button"
                                disabled={unlocking}
                                onClick={onMfa}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-xs font-bold text-amber-900 disabled:opacity-50"
                            >
                                <ShieldCheck className="h-4 w-4" /> Use recent
                                MFA verification
                            </button>
                        </>
                    )}

                    <p className="text-[10px] leading-4 text-slate-400">
                        Successful verification is logged and grants temporary
                        access only to the selected sensitive workspace.
                    </p>
                </div>
            </div>
        </div>
    );
}

function LegalDocumentPanel({ kind }: { kind: 'privacy' | 'terms' }) {
    const privacy = [
        {
            id: 'data-collection',
            title: '1. Data Collection',
            body: 'The Performance & Development application processes information required to identify authorized users and operate workforce-development activities. This may include account identity, employee or trainee identifiers, department, position, person type, employment status, learning records, competency information, performance records, training activity, recognition records, succession-planning references, reports, and governance records. The system also records technical access information such as timestamps, IP addresses, browser or device details, authentication results, session events, and protected-workspace verification events.',
        },
        {
            id: 'processing-purpose',
            title: '2. Purpose of Processing',
            body: 'Information is processed for legitimate organizational purposes connected to administration, workforce development, learning delivery, performance management, competency assessment, reporting, recognition, succession planning, account security, auditability, incident review, and system governance. The application is designed to use information only where it supports an authorized operational purpose and the responsibilities assigned to the signed-in user.',
        },
        {
            id: 'data-sources',
            title: '3. Authoritative Data Sources',
            body: 'Certain profile fields are controlled by canonical personnel records rather than by the Settings page. Department, position, person type, employment status, and other authoritative workforce attributes should be corrected through the approved personnel source so that dependent modules remain synchronized. User-editable profile fields are limited to the fields the application explicitly allows the account holder to maintain.',
        },
        {
            id: 'role-access',
            title: '4. Role-Based Access and Least Privilege',
            body: 'Access is restricted according to assigned roles and server-side authorization rules. Administrators, HR personnel, supervisors, and general users may have different capabilities. Sensitive administrative workspaces require step-up identity verification in addition to the normal authenticated session. Protected information is withheld when the required role or temporary verification state is not present.',
        },
        {
            id: 'account-security',
            title: '5. Account and Authentication Security',
            body: 'The application may use passwords, multi-factor authentication, trusted-device controls, session expiration, and re-verification for sensitive actions. Users are responsible for protecting their credentials and must not intentionally share authenticated access. Authentication failures and security-relevant activity may be retained for investigation, monitoring, and accountability.',
        },
        {
            id: 'security-logging',
            title: '6. Security Logging and Monitoring',
            body: 'Security Logs may include successful logins, failed login attempts, logouts, inactivity timeouts, protected-settings unlocks, and other events required to understand account activity. Authorized administrators may review the associated user details, event type, timestamp, IP address, and device information. These records are read-only within the application and are maintained to support security review and audit requirements.',
        },
        {
            id: 'data-sharing',
            title: '7. Internal Sharing and Reporting',
            body: 'Information may be presented to authorized organizational users through dashboards, reports, tables, exports, and module workflows. Access to reports does not create permission to use the data for unrelated purposes. Exported information must be handled with the same care as information viewed directly in the application and should be shared only with recipients who are authorized to receive it.',
        },
        {
            id: 'archiving',
            title: '8. Data Archiving',
            body: 'When an account becomes inactive because of resignation, termination, or another approved workforce lifecycle event, the account may be archived. Archived accounts are blocked from normal authentication while the retained record remains available to authorized administrators for the configured retention period. Archiving is separate from immediate deletion so that historical records can remain consistent and auditable.',
        },
        {
            id: 'retention',
            title: '9. Retention and Identity Deletion',
            body: 'Archived personal identity data is retained according to the configured organizational retention period. When that period is completed, the record may become eligible for permanent identity deletion. The deletion process removes identifying account data from normal operational use while de-identified historical references may remain where necessary to preserve report integrity, analytics, foreign-key relationships, and historical business records.',
        },
        {
            id: 'data-quality',
            title: '10. Data Accuracy and Correction',
            body: 'Users should report inaccurate or outdated information through the appropriate administrator or HR process. Where a field is derived from an authoritative personnel source, correction must occur at that source rather than by creating a conflicting local value. Administrators should document material governance changes when the application requires a reason or audit record.',
        },
        {
            id: 'availability',
            title: '11. Availability, Backups, and Integrity',
            body: 'The system is intended to preserve the confidentiality, integrity, and availability of operational records through controlled access and standard application safeguards. Authorized maintenance, backups, migrations, or recovery procedures may process copies of application data as necessary to protect continuity. Access to those copies remains subject to organizational controls.',
        },
        {
            id: 'user-rights',
            title: '12. User Requests and Questions',
            body: 'Questions about account information, access, retention, correction, or permitted use should be directed through the organization’s approved administrative or HR process. Requests may require identity verification before account-specific information is disclosed or changed. The system records only the operational state and workflows configured for the organization.',
        },
    ];

    const terms = [
        {
            id: 'authorized-use',
            title: '1. Authorized Use',
            body: 'The application is intended for authorized organizational users and approved workforce-development activities. Users may access only the functions, information, and records permitted by their assigned role. Use of another person’s account, unauthorized disclosure of information, or use of the application for unrelated personal or fraudulent purposes is prohibited.',
        },
        {
            id: 'account-responsibility',
            title: '2. Account Responsibility',
            body: 'Each user is responsible for reasonable protection of passwords, MFA methods, trusted devices, and authenticated sessions. Credentials must not be intentionally shared. A user who believes that an account, device, or verification method has been compromised should report the issue through the approved organizational process and follow any required security steps.',
        },
        {
            id: 'acceptable-behavior',
            title: '3. Acceptable Behavior',
            body: 'Users must interact with the system in a professional, lawful, and authorized manner. They must not intentionally bypass role restrictions, manipulate records without authority, interfere with application availability, misuse exports, attempt to conceal unauthorized activity, or use information obtained from the application for purposes outside approved organizational responsibilities.',
        },
        {
            id: 'record-integrity',
            title: '4. Record Integrity',
            body: 'Users who create, review, approve, evaluate, or administer records are expected to provide accurate information and use the correct workflow. Audit trails, security logs, completion records, evaluations, reports, and other governed records must not be intentionally falsified. Where the application marks a record as immutable or historical, it may be reviewed but not edited through normal application functions.',
        },
        {
            id: 'monitoring',
            title: '5. Monitoring and Audit',
            body: 'Use of the application may generate security, authentication, session, access, and governance logs. Authorized administrators may review these records to investigate incidents, verify system use, support internal controls, or prepare audit evidence. Users should not expect security-relevant actions within the application to be anonymous from authorized system administrators.',
        },
        {
            id: 'reverification',
            title: '6. Sensitive Workspaces and Re-Verification',
            body: 'Certain administrative workspaces require password or recent MFA verification before they can be opened. Successful re-verification grants temporary access for the configured period and the remaining time is displayed in the interface. When the temporary verification expires, the protected workspace is closed and the user must verify identity again before returning.',
        },
        {
            id: 'session-management',
            title: '7. Session Management',
            body: 'Authenticated sessions may expire after inactivity or other configured security conditions. The application may record the calculated timeout event and require a new login before access resumes. Users should sign out when using a shared device and should not rely on an unattended session remaining available indefinitely.',
        },
        {
            id: 'exports',
            title: '8. Reports and Exports',
            body: 'Authorized users may export information where the application provides an export function. Exported CSV or PDF files may contain organizational or workforce information and remain subject to the same confidentiality and authorized-use expectations as the source system. Users are responsible for storing, sharing, and disposing of exports appropriately.',
        },
        {
            id: 'archive-retention',
            title: '9. Account Archive and Retention',
            body: 'Accounts may be archived after resignation, termination, or another approved separation event. Archived accounts cannot be used for normal authentication. Retained identity data remains subject to the configured retention period and may become eligible for permanent identity deletion after retention requirements have been completed.',
        },
        {
            id: 'security-controls',
            title: '10. Security Controls and Limitations',
            body: 'Protected views may use browser-level controls such as disabling right-click or browser print shortcuts. These controls support policy enforcement inside the application but cannot technically guarantee prevention of operating-system screenshots, external cameras, or every form of screen capture. Users remain responsible for complying with organizational confidentiality requirements regardless of technical controls.',
        },
        {
            id: 'administrative-action',
            title: '11. Administrative Action',
            body: 'The organization may restrict, suspend, archive, restore, or otherwise govern access when required by employment status, security risk, retention rules, operational requirements, or authorized management decisions. Actions that materially affect governed settings or retained identity records may require a documented reason and may be written to an audit trail.',
        },
        {
            id: 'changes',
            title: '12. Changes to Application Rules',
            body: 'Application behavior, settings, security requirements, and administrative workflows may change as organizational requirements evolve. Users are expected to follow the controls and policies presented by the current deployed version. Material system changes should be managed through approved development, testing, deployment, and governance processes.',
        },
    ];

    const sections = kind === 'privacy' ? privacy : terms;
    const title = kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
    const subtitle = kind === 'privacy'
        ? 'How account, workforce, security, and historical data are handled inside Performance & Development.'
        : 'Authorized-use rules, account responsibilities, monitoring, exports, and administrative controls.';

    return (
        <article className="app-card overflow-hidden">
            <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
                    Application governance
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
                <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
                    {subtitle}
                </p>
            </div>

            <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 bg-slate-50 p-5 lg:sticky lg:top-4 lg:self-start lg:border-b-0 lg:border-r">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Table of Contents
                    </p>
                    <nav className="mt-3 space-y-1" aria-label={`${title} table of contents`}>
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() =>
                                    document.getElementById(section.id)?.scrollIntoView({
                                        behavior: 'smooth',
                                        block: 'start',
                                    })
                                }
                                className="block w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold leading-4 text-slate-600 transition hover:bg-white hover:text-amber-800 hover:shadow-sm"
                            >
                                {section.title}
                            </button>
                        ))}
                    </nav>
                </aside>

                <div className="space-y-6 p-5 sm:p-7">
                    {sections.map((section) => (
                        <section key={section.id} id={section.id} className="scroll-mt-24">
                            <h3 className="text-sm font-bold text-slate-950">
                                {section.title}
                            </h3>
                            <p className="mt-2 max-w-5xl text-xs leading-6 text-slate-600">
                                {section.body}
                            </p>
                        </section>
                    ))}
                </div>
            </div>
        </article>
    );
}

function FaqPanel() {
    const items = [
        [
            'Why can I edit my name and email but not my department or position?',
            'Department, position, person type, and employment status are canonical workforce fields. They should be changed from the authoritative personnel source rather than locally in Settings.',
        ],
        [
            'Why do some Settings pages ask for my password or MFA again?',
            'Organization & Reporting, Sign-in Protection, and Security Logs use step-up verification because they expose or change sensitive administrative information.',
        ],
        [
            'What happens after 15 minutes of inactivity?',
            'The session expires, the user is signed out, and a SESSION_TIMEOUT event is recorded using the calculated inactivity expiry timestamp.',
        ],
        [
            'Can archived employees still sign in?',
            'No. Archived accounts are blocked from authentication while their retained record remains governed by the retention policy.',
        ],
        [
            'What happens after the five-year retention period?',
            'The record becomes eligible for permanent identity deletion. Personally identifying account fields are removed while de-identified historical references can remain for report and record integrity.',
        ],
        [
            'Can Security Logs be edited or deleted?',
            'No. Security audit events are immutable in the application and are exposed as read-only records to authorized Admin users.',
        ],
        [
            'Are the header notifications based on real system data?',
            'Yes. The notification center reads current workflow and security records from the application. This page only controls which eligible alert categories appear for your account; required Admin security alerts cannot be disabled.',
        ],
    ];

    return (
        <section className="app-card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                        <HelpCircle className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-sm font-bold text-slate-950">
                            Frequently Asked Questions
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Quick answers for account, security, and governance
                            behavior.
                        </p>
                    </div>
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {items.map(([question, answer]) => (
                    <details key={question} className="group px-5 py-4 sm:px-6">
                        <summary className="cursor-pointer list-none text-xs font-bold text-slate-900">
                            <span className="flex items-center justify-between gap-3">
                                {question}
                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                            </span>
                        </summary>
                        <p className="mt-3 max-w-4xl text-xs leading-6 text-slate-600">
                            {answer}
                        </p>
                    </details>
                ))}
            </div>
        </section>
    );
}

function SoftwareLicensePanel() {
    const dependencies = [
        ['Laravel', 'MIT License', 'Backend framework'],
        ['React', 'MIT License', 'User interface library'],
        ['Inertia.js', 'MIT License', 'Server-driven SPA bridge'],
        ['Tailwind CSS', 'MIT License', 'Utility-first styling'],
        ['Vite', 'MIT License', 'Frontend build tooling'],
        ['Axios', 'MIT License', 'HTTP client'],
        ['Lucide', 'ISC License', 'Interface icons'],
    ];

    return (
        <div className="space-y-4">
            <section className="app-card p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <FileKey2 className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-sm font-bold text-slate-950">
                            Software License
                        </h2>
                        <p className="mt-2 text-xs leading-6 text-slate-600">
                            The Alibaton Performance & Development application
                            is intended for authorized organizational use. Any
                            distribution, modification, deployment, or reuse must
                            follow the project ownership rules and the license
                            obligations of the included third-party components.
                        </p>
                    </div>
                </div>
            </section>

            <section className="app-card overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-2">
                        <Library className="h-5 w-5 text-amber-700" />
                        <h3 className="text-sm font-bold text-slate-950">
                            Open Source Licenses
                        </h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        High-level notices for major application dependencies.
                        Production release packaging should preserve the complete
                        notices generated from the project lockfiles.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-5 py-3">Component</th>
                                <th className="px-5 py-3">License</th>
                                <th className="px-5 py-3">Use in system</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {dependencies.map(([name, license, use]) => (
                                <tr key={name}>
                                    <td className="px-5 py-3 font-semibold text-slate-900">
                                        {name}
                                    </td>
                                    <td className="px-5 py-3 text-slate-600">
                                        {license}
                                    </td>
                                    <td className="px-5 py-3 text-slate-500">
                                        {use}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function Avatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
    const initials = profile.name
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return profile.profile_photo_url ? (
        <img
            src={profile.profile_photo_url}
            alt={`${profile.name} profile`}
            className={`${large ? 'h-32 w-32' : 'h-12 w-12'} shrink-0 rounded-full object-cover ring-4 ring-amber-400/80`}
        />
    ) : (
        <div
            aria-label={`${profile.name} initials`}
            className={`${large ? 'h-32 w-32 text-3xl' : 'h-12 w-12 text-sm'} flex shrink-0 items-center justify-center rounded-full bg-[#F4B400] font-extrabold text-slate-950 ring-4 ring-amber-300/60`}
        >
            {initials}
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    disabled,
    type = 'text',
}: {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    disabled: boolean;
    type?: string;
}) {
    return (
        <label>
            <span className="text-xs font-bold text-slate-600">{label}</span>
            <input
                type={type}
                className="app-control mt-1 w-full"
                value={value ?? ''}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
}

function Info({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {label}
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                {value}
            </p>
        </div>
    );
}

function Metric({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: number | string;
    icon: LucideIcon;
}) {
    return (
        <div className="app-kpi-card flex items-center justify-between gap-3 p-4">
            <div>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-950">
                    {value}
                </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Icon className="h-5 w-5" />
            </div>
        </div>
    );
}

function ArchiveStat({
    label,
    value,
    note,
}: {
    label: string;
    value: number;
    note: string;
}) {
    return (
        <div className="bg-white p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">{note}</p>
        </div>
    );
}

function Pill({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
            <Icon className="h-3 w-3" /> {text}
        </span>
    );
}

function Status({ value, danger = false }: { value: string; danger?: boolean }) {
    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                danger
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
            }`}
        >
            {value}
        </span>
    );
}

function formatCountdown(totalSeconds: number) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function securityEventLabel(eventType: string) {
    if (eventType === 'LOGIN_SUCCESS') return 'LOG_IN';
    if (eventType === 'LOGOUT') return 'LOG_OUT';
    if (['LOGIN_FAILED', 'LOGIN_RATE_LIMITED', 'LOGIN_BLOCKED_ARCHIVED'].includes(eventType)) return 'FAILED_LOGIN';
    if (eventType === 'SESSION_TIMEOUT') return 'SESSION_TIMEOUT';
    return eventType;
}

function dateKeyInTimezone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '00';
    const day = parts.find((part) => part.type === 'day')?.value ?? '00';
    return `${year}-${month}-${day}`;
}

function downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 500);
}

function downloadTextPdf(filename: string, title: string, inputLines: string[]) {
    const ascii = (value: string) =>
        value
            .normalize('NFKD')
            .replace(/[^\x20-\x7E]/g, '?')
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');

    const wrap = (value: string, width = 92) => {
        const words = ascii(value).split(/\s+/);
        const lines: string[] = [];
        let current = '';
        words.forEach((word) => {
            if (!word) return;
            const next = current ? `${current} ${word}` : word;
            if (next.length > width && current) {
                lines.push(current);
                current = word;
            } else {
                current = next;
            }
        });
        if (current) lines.push(current);
        return lines.length ? lines : [''];
    };

    const lines = [title, '', ...inputLines].flatMap((line) => wrap(line));
    const linesPerPage = 48;
    const pages: string[][] = [];
    for (let index = 0; index < lines.length; index += linesPerPage) {
        pages.push(lines.slice(index, index + linesPerPage));
    }
    if (pages.length === 0) pages.push([title]);

    const objects: string[] = [];
    const pageObjectNumbers: number[] = [];
    const contentObjectNumbers: number[] = [];
    for (let index = 0; index < pages.length; index += 1) {
        pageObjectNumbers.push(4 + index * 2);
        contentObjectNumbers.push(5 + index * 2);
    }

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    pages.forEach((pageLines, index) => {
        const pageNumber = pageObjectNumbers[index];
        const contentNumber = contentObjectNumbers[index];
        const text = [
            'BT',
            '/F1 9 Tf',
            '42 752 Td',
            '13 TL',
            ...pageLines.map((line) => `(${ascii(line)}) Tj T*`),
            'ET',
        ].join('\n');
        objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumber} 0 R >>`;
        objects[contentNumber] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
    });

    let pdf = '%PDF-1.4\n%generated\n';
    const offsets: number[] = [0];
    for (let number = 1; number < objects.length; number += 1) {
        offsets[number] = pdf.length;
        pdf += `${number} 0 obj\n${objects[number]}\nendobj\n`;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += '0000000000 65535 f \n';
    for (let number = 1; number < objects.length; number += 1) {
        pdf += `${String(offsets[number]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    downloadBlob(new Blob([pdf], { type: 'application/pdf' }), filename);
}

function formatDate(
    value: string | null | undefined,
    timezone = 'Asia/Manila',
    dateOnly = false,
) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-PH',
        dateOnly
            ? {
                  timeZone: timezone,
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
              }
            : {
                  timeZone: timezone,
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
              },
    ).format(date);
}
