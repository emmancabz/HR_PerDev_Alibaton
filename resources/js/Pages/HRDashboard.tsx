import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    AlertTriangle,
    Award,
    BookOpenCheck,
    CalendarClock,
    ClipboardCheck,
    ExternalLink,
    Users,
} from 'lucide-react';

type Activity = {
    type: string;
    title: string;
    subtitle: string;
    occurredAt: string;
    route?: string | null;
    params?: Record<string, string>;
};

type UpcomingTraining = {
    id: string;
    title: string;
    sessionLabel: string;
    startsAt: string;
    venue: string;
    participants: number;
    capacity: number;
};

type HRDashboardState = {
    stats: {
        activePersonnel: number;
        openPerformanceReviews: number;
        overdueLearning: number;
        upcomingTraining: number;
        pendingRecognition: number;
    };
    upcomingTrainings: UpcomingTraining[];
    recentActivities: Activity[];
};

type Props = { userName: string; dashboard: HRDashboardState };

function fmtDate(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function href(routeName?: string | null, params?: Record<string, string>) {
    if (!routeName || typeof route === 'undefined' || !route().has(routeName)) return '#';
    return route(routeName, params ?? {});
}

export default function HRDashboard({ userName, dashboard }: Props) {
    const cards = [
        { label: 'Active Personnel', value: dashboard.stats.activePersonnel, icon: Users, href: route('hr.reports.index') },
        { label: 'Open Performance Reviews', value: dashboard.stats.openPerformanceReviews, icon: ClipboardCheck, href: route('hr.performance.index') },
        { label: 'Overdue Learning', value: dashboard.stats.overdueLearning, icon: AlertTriangle, href: `${route('hr.learning.index')}#Assignments` },
        { label: 'Training Next 7 Days', value: dashboard.stats.upcomingTraining, icon: CalendarClock, href: route('hr.training.index') },
        { label: 'Recognition Pending', value: dashboard.stats.pendingRecognition, icon: Award, href: `${route('hr.recognition.index')}#Recognition%20Activity` },
    ];

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">HR Dashboard</h1>}>
            <Head title="HR Dashboard" />
            <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Performance &amp; Development</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">Welcome, {userName}</h2>
                    <p className="mt-1 text-sm text-slate-500">Live HR workload based on persistent Performance, Learning, Training, Recognition, and personnel records.</p>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {cards.map(({ label, value, icon: Icon, href: cardHref }) => (
                        <a key={label} href={cardHref} className="app-kpi-card group flex min-h-28 items-start justify-between p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                                <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
                            </div>
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-[#F4B400] group-hover:text-black"><Icon className="h-4 w-4" /></span>
                        </a>
                    ))}
                </section>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_.95fr]">
                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Upcoming Training Sessions</h3>
                                <p className="mt-0.5 text-xs text-slate-500">Scheduled persistent sessions that still require operational readiness.</p>
                            </div>
                            <a href={route('hr.training.index')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Open Training <ExternalLink className="h-3.5 w-3.5" /></a>
                        </div>
                        <div className="mt-4 space-y-2.5">
                            {dashboard.upcomingTrainings.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs font-medium text-slate-400">No upcoming active training session is currently stored.</div>}
                            {dashboard.upcomingTrainings.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500">{item.sessionLabel} · {item.venue}</p>
                                        <p className="mt-1 text-[11px] font-semibold text-amber-700">{fmtDate(item.startsAt)}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-xs font-bold text-slate-800">{item.participants}/{item.capacity}</p>
                                        <p className="text-[10px] uppercase tracking-wide text-slate-400">Participants</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-amber-500" /><h3 className="text-sm font-bold text-slate-900">Recent P&amp;D Activity</h3></div>
                        <p className="mt-1 text-xs text-slate-500">Latest persisted cross-module events visible to HR.</p>
                        <div className="mt-4 space-y-2.5">
                            {dashboard.recentActivities.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs font-medium text-slate-400">No recent persisted activity is available.</div>}
                            {dashboard.recentActivities.map((item, index) => (
                                <a key={`${item.type}-${index}`} href={href(item.route, item.params)} className="block rounded-xl border border-slate-100 px-4 py-3 transition hover:border-amber-200 hover:bg-amber-50/30">
                                    <p className="text-xs font-bold text-slate-900">{item.title}</p>
                                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.subtitle}</p>
                                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{fmtDate(item.occurredAt)}</p>
                                </a>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
