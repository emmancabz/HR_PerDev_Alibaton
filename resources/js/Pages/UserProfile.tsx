import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Bell, Building2, CheckCircle2, IdCard, Mail, RefreshCcw, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type ProfileTab = 'Employee Info' | 'Notifications';
const tabs: ProfileTab[] = ['Employee Info', 'Notifications'];

type NotificationItem = {
    id: string;
    category: string;
    title: string;
    description: string;
    meta: string;
    tone: string;
    href: string;
    count: number;
    fingerprint: string;
    isRead: boolean;
};

type NotificationResponse = {
    data: NotificationItem[];
    totalCount: number;
    unreadCount: number;
    aggregateCount: number;
    generatedAt: string;
};

function tabFromHash(): ProfileTab {
    if (typeof window === 'undefined') return 'Employee Info';
    const decoded = decodeURIComponent(window.location.hash.replace(/^#/, '').replace(/\+/g, ' '));
    return tabs.includes(decoded as ProfileTab) ? (decoded as ProfileTab) : 'Employee Info';
}

export default function UserProfile() {
    const { auth } = usePage().props;
    const user = auth.user;
    const isTrainee = user.persona === 'trainee';
    const [activeTab, setActiveTab] = useState<ProfileTab>(() => tabFromHash());
    const [notifications, setNotifications] = useState<NotificationResponse | null>(null);
    const [notificationError, setNotificationError] = useState('');
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    useEffect(() => {
        if (isTrainee) return;
        const sync = () => setActiveTab(tabFromHash());
        window.addEventListener('hashchange', sync);
        return () => window.removeEventListener('hashchange', sync);
    }, [isTrainee]);

    const loadNotifications = useCallback(async () => {
        setLoadingNotifications(true);
        setNotificationError('');
        try {
            const response = await axios.get<NotificationResponse>('/api/header-notifications');
            setNotifications(response.data);
        } catch (error) {
            setNotificationError(
                axios.isAxiosError(error)
                    ? (error.response?.data?.message ?? 'Notifications could not be loaded.')
                    : 'Notifications could not be loaded.',
            );
        } finally {
            setLoadingNotifications(false);
        }
    }, []);

    useEffect(() => {
        if (!isTrainee && activeTab === 'Notifications' && notifications === null && !loadingNotifications) {
            void loadNotifications();
        }
    }, [activeTab, isTrainee, loadNotifications, loadingNotifications, notifications]);

    const selectTab = (tab: ProfileTab) => {
        setActiveTab(tab);
        window.history.replaceState(null, '', `#${encodeURIComponent(tab)}`);
    };

    return (
        <AuthenticatedLayout
            header={
                isTrainee ? (
                    <div className="min-w-0 py-0.5">
                        <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-950">Learning Dashboard</h1>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">Current section: My Profile</p>
                    </div>
                ) : (
                    <h1 className="truncate text-sm font-bold text-slate-900">My Profile</h1>
                )
            }
        >
            <Head title="My Profile" />
            <div className="space-y-5">
                {!isTrainee && (
                    <section>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">My Profile</p>
                        <h2 className="mt-2 text-3xl font-bold text-slate-900">Account and personnel information</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Personnel identity is read-only here and remains owned by the shared HR/personnel source.
                        </p>
                    </section>
                )}

                {isTrainee ? (
                    <>
                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <header className="px-5 py-5">
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">My Profile</p>
                                <h2 className="mt-2 text-xl font-extrabold text-slate-950">Trainee profile and personnel information</h2>
                                <p className="mt-1 text-sm text-slate-500">Review the personnel identity linked to your learner account. Personnel information remains read-only and owned by the shared HR source.</p>
                            </header>
                        </section>
                        <ProfileInformation user={user} trainee />
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => selectTab(tab)}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-[#121922] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-[#F4B400] hover:text-slate-900'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'Employee Info' ? (
                            <ProfileInformation user={user} />
                        ) : (
                            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-950">Notifications</h3>
                                        <p className="mt-1 text-xs text-slate-500">The same live notification source used by the portal header.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void loadNotifications()}
                                        disabled={loadingNotifications}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                        <RefreshCcw className={`h-3.5 w-3.5 ${loadingNotifications ? 'animate-spin' : ''}`} /> Refresh
                                    </button>
                                </header>
                                {notificationError ? (
                                    <div className="p-8 text-center text-sm font-semibold text-rose-700">{notificationError}</div>
                                ) : loadingNotifications && notifications === null ? (
                                    <div className="p-8 text-center text-sm text-slate-500">Loading notifications…</div>
                                ) : notifications?.data.length ? (
                                    <div className="divide-y divide-slate-100">
                                        {notifications.data.map((item) => (
                                            <a key={item.id} href={item.href} className="flex items-start gap-3 px-5 py-4 transition hover:bg-slate-50">
                                                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.isRead ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                                                    <Bell className="h-4 w-4" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.meta}</span>
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center">
                                        <Bell className="mx-auto h-8 w-8 text-slate-300" />
                                        <p className="mt-3 text-sm font-bold text-slate-900">No active notification</p>
                                        <p className="mt-1 text-xs text-slate-500">There is nothing that currently needs your attention.</p>
                                    </div>
                                )}
                            </section>
                        )}
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function ProfileInformation({ user, trainee = false }: { user: any; trainee?: boolean }) {
    return (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <UserRound className="h-9 w-9" />
                </div>
                <h3 className="mt-4 text-xl font-extrabold text-slate-950">{user.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{user.position || 'Position not provided'}</p>
                <span className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{user.persona_label}</span>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-200 px-5 py-4">
                    <h3 className="text-sm font-extrabold text-slate-950">{trainee ? 'Trainee Information' : 'Employee Information'}</h3>
                    <p className="mt-1 text-xs text-slate-500">Canonical details currently linked to this login account.</p>
                </header>
                <div className="grid gap-0 sm:grid-cols-2">
                    <InfoRow icon={IdCard} label={trainee ? 'Trainee ID' : 'Employee / Trainee ID'} value={user.employee_or_trainee_id || '—'} />
                    <InfoRow icon={Mail} label="Email" value={user.email} />
                    <InfoRow icon={Building2} label="Department" value={user.department || '—'} />
                    <InfoRow icon={UserRound} label="Position" value={user.position || '—'} />
                    <InfoRow icon={CheckCircle2} label="Person Type" value={user.person_type || '—'} />
                    <InfoRow icon={CheckCircle2} label="Employment Status" value={user.employment_status || '—'} />
                    <InfoRow icon={IdCard} label="Personnel Key" value={user.personnel_key || '—'} />
                    <InfoRow icon={CheckCircle2} label="Portal Persona" value={user.persona_label} />
                </div>
            </section>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
    return (
        <div className="border-b border-slate-100 px-5 py-4 sm:odd:border-r">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-amber-600">
                    <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
                </div>
            </div>
        </div>
    );
}
