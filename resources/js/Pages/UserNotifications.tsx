import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Bell, CheckCircle2, ChevronRight, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
    activeCount?: number;
    unreadCount: number;
    aggregateCount: number;
    generatedAt: string;
};

export default function UserNotifications() {
    const { auth } = usePage().props;
    const isTrainee = auth.user.persona === 'trainee';
    const [state, setState] = useState<NotificationResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const response = await axios.get<NotificationResponse>('/api/header-notifications', {
                headers: { Accept: 'application/json' },
            });
            setState(response.data);
            setError('');
        } catch (cause) {
            setError(
                axios.isAxiosError(cause)
                    ? (cause.response?.data?.message ?? 'Notifications could not be loaded.')
                    : 'Notifications could not be loaded.',
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        const timer = window.setInterval(() => void load(), 60_000);
        return () => window.clearInterval(timer);
    }, [load]);

    const openNotification = async (item: NotificationItem) => {
        if (!item.isRead && item.fingerprint) {
            setState((current) => current
                ? {
                      ...current,
                      unreadCount: Math.max(0, current.unreadCount - 1),
                      data: current.data.map((row) => row.id === item.id ? { ...row, isRead: true } : row),
                  }
                : current);

            try {
                await axios.post(
                    '/api/header-notifications/read',
                    { notifications: [{ id: item.id, fingerprint: item.fingerprint }] },
                    { headers: { Accept: 'application/json' } },
                );
            } catch {
                void load();
            }
        }

        router.visit(item.href);
    };

    const items = state?.data ?? [];
    const activeCount = Number(state?.activeCount ?? items.length);
    const unreadCount = Number(state?.unreadCount ?? 0);

    return (
        <AuthenticatedLayout
            header={
                isTrainee ? (
                    <div className="min-w-0 py-0.5">
                        <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-950">Learning Dashboard</h1>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">Current section: Notifications</p>
                    </div>
                ) : (
                    <h1 className="truncate text-sm font-bold text-slate-900">Notifications</h1>
                )
            }
        >
            <Head title="Notifications" />
            <div className="space-y-5">
                {!isTrainee && (
                    <section>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Notifications</p>
                        <h2 className="mt-2 text-3xl font-bold text-slate-900">Your notifications</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Review alerts and updates generated from your authorized learning, training, development, and other portal records.
                        </p>
                    </section>
                )}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
                        {isTrainee ? (
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Notifications</p>
                                <h2 className="mt-2 text-xl font-extrabold text-slate-950">Your notifications</h2>
                                <p className="mt-1 text-sm text-slate-500">Review alerts and updates generated from your authorized learning, training, development, and portal records.</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-950">All notifications</h3>
                                <p className="mt-1 text-xs text-slate-500">{unreadCount} unread · {activeCount} active</p>
                            </div>
                        )}
                        <div className="text-right">
                            {isTrainee && (
                                <p className="text-xs font-semibold text-slate-500">{unreadCount} unread · {activeCount} active</p>
                            )}
                            <div className="mt-1 flex items-center justify-end gap-2 text-xs font-semibold text-slate-500">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                Updates refresh automatically
                            </div>
                        </div>
                    </header>

                    {loading && state === null ? (
                        <div className="flex items-center justify-center gap-2 p-12 text-sm font-semibold text-slate-500">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                            Loading notifications…
                        </div>
                    ) : error && state === null ? (
                        <div className="p-10 text-center">
                            <Bell className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-3 text-sm font-bold text-slate-900">Notifications are temporarily unavailable</p>
                            <p className="mt-1 text-xs text-slate-500">{error}</p>
                        </div>
                    ) : items.length ? (
                        <div className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => void openNotification(item)}
                                    className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${item.isRead ? '' : 'bg-amber-50/30'}`}
                                >
                                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? 'bg-slate-300' : 'bg-[#F4B400]'}`} />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-start justify-between gap-2">
                                            <span className={`text-sm font-bold ${item.isRead ? 'text-slate-700' : 'text-slate-950'}`}>{item.title}</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.meta}</span>
                                        </span>
                                        <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                                    </span>
                                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                <Bell className="h-5 w-5" />
                            </div>
                            <p className="mt-3 text-sm font-bold text-slate-900">No active notifications</p>
                            <p className="mt-1 text-xs text-slate-500">There is nothing that currently needs your attention.</p>
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
