import { ChartDateRangeControl, DEFAULT_CHART_DATE_RANGE, dateFallsInChartRange, type ChartDateRangeValue } from '@/Components/ChartDateRange';
import AuthenticatedLayout, { HeaderFilters } from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Award,
    BookOpenCheck,
    BriefcaseBusiness,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    GraduationCap,
    LayoutDashboard,
    ShieldCheck,
    Star,
    Target,
    TrendingDown,
    TrendingUp,
    UserRoundCheck,
    Users,
} from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

type DashboardStats = {
    activeWorkforce: number;
    performanceActions: number;
    competencyActions: number;
    trainingActions: number;
    successionRisk: number;
    recognitionPending: number;
};

type AttentionItem = {
    id: string;
    module: string;
    title: string;
    detail: string;
    count: number;
    priority: 'High' | 'Medium' | string;
    href: string;
};

type PerformanceSnapshot = {
    cycleName: string | null;
    cycleStatus: string;
    periodLabel: string;
    reviewWindowLabel: string;
    reviewOpenDate: string | null;
    reviewDueDate: string | null;
    total: number;
    scheduled: number;
    inProgress: number;
    calibration: number;
    finalized: number;
    overdue: number;
    actions: number;
    averageFinalizedRating: number | null;
};

type PerformancePoint = {
    date: string;
    month: string;
    score: number;
    count: number;
};

type DevelopmentSnapshot = {
    learningInProgress: number;
    learningOverdue: number;
    trainingRequirements: number;
    activeSuccessionPlans: number;
};

type UpcomingItem = {
    type: string;
    title: string;
    meta: string;
    date: string;
    href: string;
};

type ActivityItem = {
    type: string;
    title: string;
    subtitle: string;
    occurredAt: string;
    href: string;
};

type DepartmentSummary = {
    department: string;
    count: number;
};

type AdminDashboardState = {
    stats: DashboardStats;
    needsAttention: AttentionItem[];
    performance: PerformanceSnapshot;
    performanceSeries: PerformancePoint[];
    development: DevelopmentSnapshot;
    upcoming: UpcomingItem[];
    recentActivities: ActivityItem[];
    workforceByDepartment: DepartmentSummary[];
};

type Props = {
    userName?: string;
    dashboard: AdminDashboardState;
};

type KpiDefinition = {
    label: string;
    value: number | string;
    icon: ComponentType<{ className?: string }>;
    href: string;
    attention?: boolean;
};

const moduleIcon: Record<string, ComponentType<{ className?: string }>> = {
    Performance: Star,
    Competency: Target,
    Learning: BookOpenCheck,
    Training: GraduationCap,
    Succession: UserRoundCheck,
    Recognition: Award,
    Security: ShieldCheck,
};

const activityIcon: Record<string, ComponentType<{ className?: string }>> = {
    person_created: Users,
    learning_completed: BookOpenCheck,
    training_completed: GraduationCap,
    performance_finalized: Star,
    recognition_given: Award,
    competency_finalized: Target,
    succession_finalized: UserRoundCheck,
};

const quickAccess = [
    { label: 'Users', icon: Users, href: () => route('admin.users.index') },
    { label: 'Performance', icon: Star, href: () => route('admin.performance.index') },
    { label: 'Competency', icon: Target, href: () => route('admin.competency.index') },
    { label: 'Learning', icon: BookOpenCheck, href: () => route('admin.learning.index') },
    { label: 'Training', icon: GraduationCap, href: () => route('admin.training.index') },
    { label: 'Succession', icon: UserRoundCheck, href: () => route('admin.succession.index') },
    { label: 'Recognition', icon: Award, href: () => route('admin.recognition.index') },
    { label: 'Reports', icon: BriefcaseBusiness, href: () => route('admin.reports.index') },
];

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function relativeTime(value: string): string {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return '—';
    const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(value);
}

function KpiCard({ card }: { card: KpiDefinition }) {
    const Icon = card.icon;
    const hasAttention = card.attention && Number(card.value) > 0;

    return (
        <Link
            href={card.href}
            className="app-kpi-card group block min-w-0 overflow-hidden px-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2"
        >
            <div className="flex min-h-12 items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-500 transition group-hover:text-amber-700">
                        {card.label}
                    </p>
                    <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums tracking-tight text-slate-950">
                        {card.value}
                    </p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${hasAttention ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-200' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'}`}>
                    <Icon className="h-4.5 w-4.5" />
                </div>
            </div>
        </Link>
    );
}

function SectionHeader({ title, description, href, action = 'Open workspace' }: { title: string; description?: string; href?: string; action?: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3.5">
            <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">{title}</h2>
                {description ? <p className="mt-0.5 text-[11px] text-slate-500">{description}</p> : null}
            </div>
            {href ? (
                <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700 transition hover:text-amber-800">
                    {action}<ChevronRight className="h-3.5 w-3.5" />
                </Link>
            ) : null}
        </div>
    );
}

function PerformanceTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: { value: number; payload?: PerformancePoint }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;

    return (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-lg ring-1 ring-slate-900/5">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <div className="mt-1 flex items-end gap-1.5">
                <span className="text-2xl font-extrabold text-slate-950">{Number(payload[0].value).toFixed(2)}</span>
                <span className="pb-0.5 text-xs font-semibold text-slate-400">/ 5</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
                {point?.count ?? 0} finalized review{point?.count === 1 ? '' : 's'}
            </p>
        </div>
    );
}

export default function AdminDashboard({ userName = 'Admin', dashboard }: Props) {
    const [performanceRange, setPerformanceRange] = useState<ChartDateRangeValue>({
        ...DEFAULT_CHART_DATE_RANGE,
        preset: 'ytd',
    });
    const [areaFilter, setAreaFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');

    const kpis: KpiDefinition[] = [
        {
            label: 'Active Workforce',
            value: dashboard.stats.activeWorkforce,
            icon: Users,
            href: route('admin.users.index'),
        },
        {
            label: 'Performance Actions',
            value: dashboard.stats.performanceActions,
            icon: ClipboardCheck,
            href: `${route('admin.performance.index')}#Reviews`,
            attention: true,
        },
        {
            label: 'Competency Actions',
            value: dashboard.stats.competencyActions,
            icon: Target,
            href: `${route('admin.competency.index')}#Assessments`,
            attention: true,
        },
        {
            label: 'Training Actions',
            value: dashboard.stats.trainingActions,
            icon: GraduationCap,
            href: `${route('admin.training.index')}#Overview`,
            attention: true,
        },
        {
            label: 'Succession Risk',
            value: dashboard.stats.successionRisk,
            icon: UserRoundCheck,
            href: `${route('admin.succession.index')}#Succession%20Register`,
            attention: true,
        },
        {
            label: 'Recognition Pending',
            value: dashboard.stats.recognitionPending,
            icon: Award,
            href: `${route('admin.recognition.index')}#Review%20Queue`,
            attention: true,
        },
    ];

    const visiblePerformanceData = useMemo(
        () => dashboard.performanceSeries.filter((point) => dateFallsInChartRange(point.date, performanceRange)),
        [dashboard.performanceSeries, performanceRange],
    );

    const performanceReviewCount = visiblePerformanceData.reduce((sum, point) => sum + point.count, 0);
    const weightedPerformanceAverage = performanceReviewCount > 0
        ? visiblePerformanceData.reduce((sum, point) => sum + (point.score * point.count), 0) / performanceReviewCount
        : null;
    const latestScore = visiblePerformanceData.at(-1)?.score ?? null;
    const previousScore = visiblePerformanceData.at(-2)?.score ?? null;
    const scoreTrend = latestScore !== null && previousScore !== null ? latestScore - previousScore : null;

    const totalReviews = dashboard.performance.total;
    const finalizationPercent = totalReviews > 0
        ? Math.round((dashboard.performance.finalized / totalReviews) * 100)
        : 0;
    const workforceTotal = dashboard.workforceByDepartment.reduce((sum, item) => sum + item.count, 0);
    const filteredNeedsAttention = useMemo(
        () => dashboard.needsAttention.filter((item) => {
            const areaMatches = areaFilter === 'all' || item.module.toLowerCase() === areaFilter;
            const priorityMatches = priorityFilter === 'all' || item.priority.toLowerCase() === priorityFilter;
            return areaMatches && priorityMatches;
        }),
        [areaFilter, dashboard.needsAttention, priorityFilter],
    );
    const filteredUpcoming = useMemo(
        () => dashboard.upcoming.filter((item) => areaFilter === 'all' || item.type.toLowerCase() === areaFilter),
        [areaFilter, dashboard.upcoming],
    );



    return (
        <AuthenticatedLayout
            header={
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-amber-500" />
                        <h1 className="truncate text-lg font-bold text-slate-900">Dashboard</h1>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">Performance & Development command center</p>
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="app-page app-page-enter space-y-5">
                <HeaderFilters
                    active={areaFilter !== 'all' || priorityFilter !== 'all'}
                    onReset={() => {
                        setAreaFilter('all');
                        setPriorityFilter('all');
                    }}
                >
                    <select aria-label="Dashboard area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                        <option value="all">All areas</option>
                        <option value="performance">Performance</option>
                        <option value="competency">Competency</option>
                        <option value="learning">Learning</option>
                        <option value="training">Training</option>
                        <option value="succession">Succession</option>
                        <option value="recognition">Recognition</option>
                        <option value="security">Security</option>
                    </select>
                    <select aria-label="Priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                        <option value="all">All priorities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                    </select>
                </HeaderFilters>

                <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {kpis.map((card) => <KpiCard key={card.label} card={card} />)}
                </section>

                <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                    <div className="app-card overflow-hidden xl:col-span-2">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                            <div className="min-w-0">
                                <h2 className="text-sm font-bold text-slate-900">Performance Trend</h2>
                                <p className="mt-0.5 text-[11px] text-slate-500">Monthly average from finalized formal reviews only.</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <ChartDateRangeControl
                                    compact
                                    label="Performance chart date"
                                    value={performanceRange}
                                    onChange={setPerformanceRange}
                                />
                                <Link
                                    href={`${route('admin.performance.index')}#Analytics`}
                                    className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                                >
                                    Analytics<ChevronRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-3 sm:grid-cols-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Average rating</p>
                                <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-950">
                                    {weightedPerformanceAverage === null ? '—' : weightedPerformanceAverage.toFixed(2)}
                                    {weightedPerformanceAverage !== null ? <span className="ml-1 text-xs font-semibold text-slate-400">/ 5</span> : null}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Latest month</p>
                                <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-950">
                                    {latestScore === null ? '—' : latestScore.toFixed(2)}
                                    {latestScore !== null ? <span className="ml-1 text-xs font-semibold text-slate-400">/ 5</span> : null}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Finalized reviews</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <p className="text-xl font-extrabold tabular-nums text-slate-950">{performanceReviewCount}</p>
                                    {scoreTrend !== null ? (
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${scoreTrend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                            {scoreTrend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                            {scoreTrend >= 0 ? '+' : ''}{scoreTrend.toFixed(2)}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="h-[300px] px-2 pb-4 pt-3">
                            {visiblePerformanceData.length ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={visiblePerformanceData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="dashboardPerformanceFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#F4B400" stopOpacity={0.28} />
                                                <stop offset="100%" stopColor="#F4B400" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef2f7" />
                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            dy={8}
                                            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                                        />
                                        <YAxis
                                            domain={[0, 5]}
                                            ticks={[0, 1, 2, 3, 4, 5]}
                                            axisLine={false}
                                            tickLine={false}
                                            width={32}
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        />
                                        <Tooltip
                                            content={<PerformanceTooltip />}
                                            cursor={{ stroke: '#F4B400', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            stroke="#D99A00"
                                            strokeWidth={3}
                                            fill="url(#dashboardPerformanceFill)"
                                            dot={visiblePerformanceData.length <= 2 ? { r: 4, fill: '#F4B400', stroke: '#fff', strokeWidth: 2 } : false}
                                            activeDot={{ r: 6, fill: '#F4B400', stroke: '#fff', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center text-center">
                                    <TrendingUp className="h-8 w-8 text-slate-300" />
                                    <p className="mt-3 text-sm font-bold text-slate-800">No finalized performance trend yet</p>
                                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">The line graph appears automatically when finalized formal reviews exist inside the selected date range.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="app-card overflow-hidden">
                        <SectionHeader
                            title="Needs Attention"
                            description="Highest-priority Admin and HR governance actions."
                        />
                        <div className="divide-y divide-slate-100">
                            {filteredNeedsAttention.length ? filteredNeedsAttention.slice(0, 6).map((item) => {
                                const Icon = moduleIcon[item.module] ?? AlertTriangle;
                                const high = item.priority === 'High';
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50"
                                    >
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${high ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-xs font-bold text-slate-900">{item.title}</p>
                                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${high ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.priority}</span>
                                            </div>
                                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.module} · {item.detail}</p>
                                        </div>
                                        <span className="min-w-7 rounded-lg bg-slate-100 px-2 py-1 text-center text-xs font-extrabold tabular-nums text-slate-800">{item.count}</span>
                                    </Link>
                                );
                            }) : (
                                <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
                                    <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                                    <p className="mt-3 text-sm font-bold text-slate-900">No governance actions waiting</p>
                                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Reviews, validation, training, succession, recognition, learning, and security items will appear here when action is required.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="app-card overflow-hidden">
                    <SectionHeader
                        title="Performance Cycle Summary"
                        description={dashboard.performance.periodLabel}
                        href={`${route('admin.performance.index')}#Overview`}
                        action="Open workspace"
                    />

                    <div className="p-4">
                        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="truncate text-sm font-bold text-slate-900">{dashboard.performance.cycleName ?? 'No active quarterly cycle'}</h3>
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{dashboard.performance.cycleStatus}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{dashboard.performance.reviewWindowLabel}</p>
                            </div>

                            <div className="flex items-center gap-5 text-xs">
                                <div>
                                    <p className="text-slate-400">Finalization</p>
                                    <p className="mt-0.5 font-extrabold tabular-nums text-slate-900">{finalizationPercent}%</p>
                                </div>
                                <div className="h-8 w-px bg-slate-200" />
                                <div>
                                    <p className="text-slate-400">Finalized rating</p>
                                    <p className="mt-0.5 font-extrabold text-slate-900">
                                        {dashboard.performance.averageFinalizedRating === null ? '—' : `${dashboard.performance.averageFinalizedRating.toFixed(2)} / 5`}
                                    </p>
                                </div>
                                {dashboard.performance.overdue > 0 ? (
                                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">{dashboard.performance.overdue} overdue</span>
                                ) : (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">On track</span>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                                ['Scheduled', dashboard.performance.scheduled],
                                ['In Progress', dashboard.performance.inProgress],
                                ['Calibration', dashboard.performance.calibration],
                                ['Finalized', dashboard.performance.finalized],
                            ].map(([label, value]) => (
                                <Link
                                    key={String(label)}
                                    href={`${route('admin.performance.index')}#Reviews`}
                                    className="group rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-amber-300 hover:bg-amber-50/40"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                                            <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-950">{value}</p>
                                        </div>
                                        <div className="h-2.5 w-2.5 rounded-full bg-[#F4B400] opacity-80" />
                                    </div>
                                </Link>
                            ))}
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-[#F4B400] transition-all" style={{ width: `${Math.min(100, finalizationPercent)}%` }} />
                            </div>
                            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">{dashboard.performance.finalized} of {dashboard.performance.total} finalized</span>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="app-card overflow-hidden">
                        <SectionHeader title="Workforce by Department" description={`${workforceTotal} active personnel`} href={route('admin.users.index')} action="Open users" />
                        <div className="space-y-3 p-4">
                            {dashboard.workforceByDepartment.length ? dashboard.workforceByDepartment.slice(0, 7).map((item) => {
                                const percent = workforceTotal ? Math.round((item.count / workforceTotal) * 100) : 0;
                                return (
                                    <Link key={item.department} href={route('admin.users.index', { department: item.department })} className="group block rounded-lg p-1 -m-1 transition hover:bg-slate-50">
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                            <span className="min-w-0 truncate font-semibold text-slate-700 group-hover:text-amber-700">{item.department}</span>
                                            <span className="shrink-0 font-extrabold tabular-nums text-slate-900">{item.count}</span>
                                        </div>
                                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                                        </div>
                                    </Link>
                                );
                            }) : (
                                <p className="py-10 text-center text-xs text-slate-500">No active personnel records.</p>
                            )}
                        </div>
                    </div>

                    <div className="app-card overflow-hidden">
                        <SectionHeader title="Upcoming" description="Next 30 days" />
                        <div className="divide-y divide-slate-100">
                            {filteredUpcoming.length ? filteredUpcoming.slice(0, 6).map((item, index) => (
                                <Link key={`${item.type}-${item.date}-${index}`} href={item.href} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                                    <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-50 py-1.5 text-amber-800">
                                        <span className="text-[9px] font-bold uppercase">{new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(new Date(item.date))}</span>
                                        <span className="text-base font-extrabold leading-5">{new Intl.DateTimeFormat('en-PH', { day: '2-digit' }).format(new Date(item.date))}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-xs font-bold text-slate-900">{item.title}</p>
                                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{item.type}</span>
                                        </div>
                                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.meta}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-amber-600" />
                                </Link>
                            )) : (
                                <p className="px-4 py-10 text-center text-xs text-slate-500">No upcoming items match the selected dashboard filters.</p>
                            )}
                        </div>
                    </div>

                    <div className="app-card overflow-hidden">
                        <SectionHeader title="Recent Activity" description="Latest governed events" />
                        <div className="divide-y divide-slate-100 px-4">
                            {dashboard.recentActivities.length ? dashboard.recentActivities.slice(0, 6).map((activity, index) => {
                                const Icon = activityIcon[activity.type] ?? BriefcaseBusiness;
                                return (
                                    <Link key={`${activity.type}-${activity.occurredAt}-${index}`} href={activity.href} className="group flex items-start gap-3 py-3">
                                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                                            <Icon className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-bold text-slate-900 group-hover:text-amber-700">{activity.title}</p>
                                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{activity.subtitle}</p>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-medium text-slate-400">{relativeTime(activity.occurredAt)}</span>
                                    </Link>
                                );
                            }) : (
                                <p className="py-10 text-center text-xs text-slate-500">No recent governed activity yet.</p>
                            )}
                        </div>
                    </div>
                </section>

                <section className="app-card overflow-hidden">
                    <SectionHeader title="Quick Access" description="Jump directly to the main Performance & Development workspaces." />
                    <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4 xl:grid-cols-8">
                        {quickAccess.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href()}
                                    className="group flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-3 py-3 transition hover:border-amber-200 hover:bg-amber-50/40"
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition group-hover:bg-amber-100">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <span className="truncate text-xs font-bold text-slate-700 group-hover:text-amber-800">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
