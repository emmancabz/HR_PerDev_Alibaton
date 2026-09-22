import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { Award, BookOpenCheck, CalendarClock, CheckCircle2, ExternalLink, Star } from 'lucide-react';

type UserDashboardState = {
    stats: {
        activeLearning: number;
        completedLearning: number;
        upcomingTraining: number;
        recognitions: number;
        latestPerformance: { rating: number; finalizedAt: string } | null;
    };
    learningDue: Array<{ id: string; title: string; status: string; progress: number; dueAt: string | null }>;
    upcomingTrainings: Array<{ id: string; title: string; sessionLabel: string; startsAt: string; venue: string }>;
};

type Props = { userName: string; dashboard: UserDashboardState };

function fmtDate(value?: string | null) {
    if (!value) return 'No due date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function UserDashboard({ userName, dashboard }: Props) {
    const performance = dashboard.stats.latestPerformance;
    const cards = [
        { label: 'Active Learning', value: dashboard.stats.activeLearning, icon: BookOpenCheck, href: route('user.learning.index') },
        { label: 'Completed Learning', value: dashboard.stats.completedLearning, icon: CheckCircle2, href: `${route('user.learning.index')}#Learning%20Transcript` },
        { label: 'Upcoming Training', value: dashboard.stats.upcomingTraining, icon: CalendarClock, href: route('user.training.index') },
        { label: 'Recognition Records', value: dashboard.stats.recognitions, icon: Award, href: route('user.leaderboard.index') },
        { label: 'Latest Performance', value: performance ? `${performance.rating.toFixed(2)} / 5` : '—', icon: Star, href: route('user.performance.index') },
    ];

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">My Dashboard</h1>}>
            <Head title="My Dashboard" />
            <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">My Performance &amp; Development</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">Welcome, {userName}</h2>
                    <p className="mt-1 text-sm text-slate-500">Your current assignments, training schedule, recognition, and finalized performance data.</p>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {cards.map(({ label, value, icon: Icon, href }) => (
                        <a key={label} href={href} className="app-kpi-card group flex min-h-28 items-start justify-between p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                                <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
                                {label === 'Latest Performance' && performance && <p className="mt-1 text-[10px] text-slate-400">Finalized {fmtDate(performance.finalizedAt)}</p>}
                            </div>
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-[#F4B400] group-hover:text-black"><Icon className="h-4 w-4" /></span>
                        </a>
                    ))}
                </section>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div><h3 className="text-sm font-bold text-slate-900">Learning in Progress</h3><p className="mt-0.5 text-xs text-slate-500">Your active persistent Learning assignments.</p></div>
                            <a href={route('user.learning.index')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Open Learning <ExternalLink className="h-3.5 w-3.5" /></a>
                        </div>
                        <div className="mt-4 space-y-2.5">
                            {dashboard.learningDue.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs font-medium text-slate-400">You have no active Learning assignment.</div>}
                            {dashboard.learningDue.map((item) => (
                                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.status} · Due {fmtDate(item.dueAt)}</p></div><span className="shrink-0 text-xs font-black text-amber-700">{item.progress}%</span></div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#F4B400]" style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} /></div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Upcoming Training</h3><p className="mt-0.5 text-xs text-slate-500">Sessions where you are a persisted participant.</p></div><a href={route('user.training.index')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Open Training <ExternalLink className="h-3.5 w-3.5" /></a></div>
                        <div className="mt-4 space-y-2.5">
                            {dashboard.upcomingTrainings.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs font-medium text-slate-400">No upcoming training session is assigned to you.</div>}
                            {dashboard.upcomingTrainings.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"><p className="text-sm font-bold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.sessionLabel} · {item.venue}</p><p className="mt-1 text-[11px] font-semibold text-amber-700">{fmtDate(item.startsAt)}</p></div>)}
                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
