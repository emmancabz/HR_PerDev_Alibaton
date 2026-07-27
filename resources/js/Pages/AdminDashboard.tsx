import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import {
    Award,
    BookOpen,
    Briefcase,
    Building2,
    Calendar,
    Clock,
    GraduationCap,
    Hash,
    Mail,
    MapPin,
    Phone,
    Star,
    TrendingUp,
    Trophy,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

const statCards = [
    { label: 'Total HR', value: 0, icon: Users },
    { label: 'Total Trainees', value: 0, icon: Users },
    { label: 'Total Course', value: 0, icon: BookOpen },
    { label: 'Active Training', value: 0, icon: GraduationCap },
    { label: 'Completed Trainings', value: 0, icon: Trophy },
    { label: 'Average Performance', value: 0, icon: Star },
];

const performanceData = [
    { month: 'Jan', score: 42 },
    { month: 'Feb', score: 38 },
    { month: 'Mar', score: 45 },
    { month: 'Apr', score: 48 },
    { month: 'May', score: 44 },
    { month: 'Jun', score: 50 },
    { month: 'Jul', score: 55 },
    { month: 'Aug', score: 52 },
    { month: 'Sep', score: 58 },
    { month: 'Oct', score: 62 },
    { month: 'Nov', score: 68 },
    { month: 'Dec', score: 85 },
];

const recentActivities = [
    {
        icon: UserPlus,
        title: 'New Trainee registered',
        subtitle: 'Emmanuel Cabanas',
        time: '10:30 AM',
    },
    {
        icon: GraduationCap,
        title: 'Training Completed',
        subtitle: 'Leadership Fundamentals',
        time: 'Yesterday',
    },
    {
        icon: Star,
        title: 'Performance evaluation',
        subtitle: '15 evaluation submitted',
        time: 'Yesterday',
    },
    {
        icon: Award,
        title: 'Recognition given',
        subtitle: 'Vicky Melgar',
        time: 'May 20',
    },
];

const completionData = [
    { name: 'Completed', value: 78, percent: 78, count: 89, color: '#F4B400' },
    { name: 'In Progress', value: 16, percent: 16, count: 18, color: '#1a1a1a' },
    { name: 'Not Started', value: 6, percent: 6, count: 7, color: '#d4d4d4' },
];

const topCompetencies = [
    { label: 'Communication', score: 4.35 },
    { label: 'Leadership', score: 4.2 },
    { label: 'Technical Skills', score: 4.1 },
    { label: 'Teamwork', score: 4.05 },
    { label: 'Problem Solving', score: 3.9 },
];

type Trainee = {
    name: string;
    role: string;
    score: number;
    employeeId: string;
    phone: string;
    email: string;
    address: string;
    position: string;
    department: string;
    dateCreated: string;
    lastLogin: string;
    status: 'Active' | 'Inactive';
};

const topTrainees: Trainee[] = [
    {
        name: 'Princess Buban',
        role: 'HR Assistant',
        score: 4.85,
        employeeId: 'EMP-002',
        phone: '+639171234567',
        email: 'princess.buban@alibaton.com',
        address: 'Quezon City',
        position: 'HR Assistant',
        department: 'Human Resources',
        dateCreated: 'July 12, 2021',
        lastLogin: 'July 26, 2026  9:15 AM',
        status: 'Active',
    },
    {
        name: 'Vicky Melgar',
        role: 'Sales Trainee',
        score: 4.7,
        employeeId: 'EMP-003',
        phone: '+639182345678',
        email: 'vicky.melgar@alibaton.com',
        address: 'Makati City',
        position: 'Sales Trainee',
        department: 'Sales',
        dateCreated: 'August 3, 2021',
        lastLogin: 'July 25, 2026  4:40 PM',
        status: 'Active',
    },
    {
        name: 'Emmanuel Cabanas',
        role: 'IT Support Trainee',
        score: 4.65,
        employeeId: 'EMP-004',
        phone: '+639193456789',
        email: 'emmanuel.cabanas@alibaton.com',
        address: 'Calamba City',
        position: 'IT Support Trainee',
        department: 'Information Technology',
        dateCreated: 'September 15, 2021',
        lastLogin: 'July 27, 2026  8:02 AM',
        status: 'Active',
    },
    {
        name: 'Ainah Sta. Maria',
        role: 'Marketing Trainee',
        score: 4.6,
        employeeId: 'EMP-001',
        phone: '+639565147895',
        email: 'ainah.stamaria@alibaton.com',
        address: 'Caloocan City',
        position: 'HR Manager',
        department: 'Human Resources',
        dateCreated: 'July 10, 2021',
        lastLogin: 'July 23, 2026  10:30 AM',
        status: 'Active',
    },
    {
        name: 'Zyna Caguysan',
        role: 'Finance Trainee',
        score: 4.55,
        employeeId: 'EMP-005',
        phone: '+639204567890',
        email: 'zyna.caguysan@alibaton.com',
        address: 'Pasig City',
        position: 'Finance Trainee',
        department: 'Finance',
        dateCreated: 'October 1, 2021',
        lastLogin: 'July 24, 2026  2:18 PM',
        status: 'Inactive',
    },
];

const upcomingTrainings = [
    {
        month: 'May',
        day: '25',
        title: 'Effective Communication',
        fullDate: 'May 25, 2026 • 9:00 AM - 1:00 PM',
        participants: 25,
    },
    {
        month: 'May',
        day: '28',
        title: 'Leadership Fundamentals',
        fullDate: 'May 28, 2026 • 1:00 PM - 4:00 PM',
        participants: 18,
    },
    {
        month: 'Jun',
        day: '02',
        title: 'Time Management',
        fullDate: 'Jun 2, 2026 • 9:00 AM - 12:00 PM',
        participants: 30,
    },
    {
        month: 'Jun',
        day: '05',
        title: 'Problem Solving & Decision Making',
        fullDate: 'Jun 5, 2026 • 1:00 PM - 5:00 PM',
        participants: 20,
    },
];

const quickActions = [
    { label: 'Manage Users', icon: Users, route: 'admin.users.index' },
    { label: 'Manage Courses', icon: BookOpen, route: 'admin.learning.index' },
    { label: 'Manage Training', icon: GraduationCap, route: 'admin.training.index' },
    { label: 'Performance', icon: Star, route: 'admin.performance.index' },
    { label: 'Competencies', icon: Award, route: 'admin.competency.index' },
    { label: 'Recognition', icon: Trophy, route: 'admin.recognition.index' },
];

const avgScore = Math.round(
    performanceData.reduce((sum, d) => sum + d.score, 0) / performanceData.length,
);
const latestScore = performanceData[performanceData.length - 1].score;
const previousScore = performanceData[performanceData.length - 2].score;
const scoreTrend = latestScore - previousScore;

function PerformanceTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-lg ring-1 ring-slate-900/5">
            <p className="text-xs font-medium text-slate-500">{label} 2026</p>
            <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900">
                    {payload[0].value}
                </span>
                <span className="text-xs font-medium text-slate-400">/ 100</span>
            </p>
        </div>
    );
}

function DetailField({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                    {value}
                </p>
            </div>
        </div>
    );
}

function TraineeDetailsModal({
    trainee,
    onClose,
}: {
    trainee: Trainee;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-slate-900/10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative bg-gradient-to-br from-[#121212] to-[#2a2a2a] px-6 pb-8 pt-6">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <p className="text-xs font-semibold uppercase tracking-widest text-[#F4B400]">
                        User Details
                    </p>

                    <div className="mt-4 flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F4B400] text-2xl font-bold text-black shadow-lg shadow-[#F4B400]/30">
                            {trainee.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-xl font-bold text-white">
                                {trainee.name}
                            </h2>
                            <p className="mt-0.5 text-sm text-white/60">
                                {trainee.role}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                        trainee.status === 'Active'
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-white/10 text-white/50'
                                    }`}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                            trainee.status === 'Active'
                                                ? 'bg-emerald-400'
                                                : 'bg-white/40'
                                        }`}
                                    />
                                    {trainee.status}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F4B400]/20 px-3 py-1 text-xs font-semibold text-[#F4B400]">
                                    <Star className="h-3 w-3 fill-[#F4B400]" />
                                    {trainee.score} Performance Score
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Contact Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField
                            icon={Hash}
                            label="Employee ID"
                            value={trainee.employeeId}
                        />
                        <DetailField
                            icon={Mail}
                            label="Email"
                            value={trainee.email}
                        />
                        <DetailField
                            icon={Phone}
                            label="Phone Number"
                            value={trainee.phone}
                        />
                        <DetailField
                            icon={MapPin}
                            label="Address"
                            value={trainee.address}
                        />
                    </div>

                    <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Work Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField
                            icon={Briefcase}
                            label="Position"
                            value={trainee.position}
                        />
                        <DetailField
                            icon={Building2}
                            label="Department"
                            value={trainee.department}
                        />
                    </div>

                    <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Account Activity
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField
                            icon={Calendar}
                            label="Date Created"
                            value={trainee.dateCreated}
                        />
                        <DetailField
                            icon={Clock}
                            label="Last Login"
                            value={trainee.lastLogin}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-slate-200 bg-white px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl bg-[#121212] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a2a2a]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(
        null,
    );

    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-lg font-bold text-slate-900">
                    Admin Dashboard
                </h1>
            }
        >
            <Head title="Admin Dashboard" />

            {selectedTrainee && (
                <TraineeDetailsModal
                    trainee={selectedTrainee}
                    onClose={() => setSelectedTrainee(null)}
                />
            )}

            <div className="flex flex-col gap-5">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.label}
                                className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
                                    {card.value}
                                </p>
                                <p className="mt-0.5 text-xs font-medium text-slate-500">
                                    {card.label}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Performance Overview + Recent Activities + Completion Rate */}
                <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
                    {/* Left — Performance Overview */}
                    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm ring-1 ring-slate-100 lg:col-span-2">
                        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">
                                    Performance Overview
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Monthly average performance score
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-2xl font-extrabold tabular-nums text-slate-900">
                                        {avgScore}
                                        <span className="text-sm font-medium text-slate-400">
                                            /100
                                        </span>
                                    </p>
                                    <p
                                        className={`mt-0.5 flex items-center justify-end gap-1 text-xs font-semibold ${
                                            scoreTrend >= 0
                                                ? 'text-emerald-600'
                                                : 'text-red-500'
                                        }`}
                                    >
                                        <TrendingUp
                                            className={`h-3 w-3 ${scoreTrend < 0 ? 'rotate-180' : ''}`}
                                        />
                                        {scoreTrend >= 0 ? '+' : ''}
                                        {scoreTrend} vs last month
                                    </p>
                                </div>
                                <select className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30">
                                    <option>This Year</option>
                                    <option>Last Year</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col px-2 pb-4 pt-2">
                            <div className="min-h-[240px] flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={performanceData}
                                    margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient
                                            id="performanceGradient"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="0%"
                                                stopColor="#F4B400"
                                                stopOpacity={0.35}
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor="#F4B400"
                                                stopOpacity={0.02}
                                            />
                                        </linearGradient>
                                        <linearGradient
                                            id="strokeGradient"
                                            x1="0"
                                            y1="0"
                                            x2="1"
                                            y2="0"
                                        >
                                            <stop offset="0%" stopColor="#F4B400" />
                                            <stop offset="100%" stopColor="#e67e00" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        strokeDasharray="4 4"
                                        vertical={false}
                                        stroke="#f1f5f9"
                                    />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={8}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        ticks={[0, 25, 50, 75, 100]}
                                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={32}
                                    />
                                    <ReferenceLine
                                        y={70}
                                        stroke="#e2e8f0"
                                        strokeDasharray="6 4"
                                        label={{
                                            value: 'Target 70',
                                            position: 'insideTopRight',
                                            fill: '#94a3b8',
                                            fontSize: 10,
                                            fontWeight: 600,
                                        }}
                                    />
                                    <Tooltip
                                        content={<PerformanceTooltip />}
                                        cursor={{
                                            stroke: '#F4B400',
                                            strokeWidth: 1,
                                            strokeDasharray: '4 4',
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke="url(#strokeGradient)"
                                        strokeWidth={2.5}
                                        fill="url(#performanceGradient)"
                                        dot={false}
                                        activeDot={{
                                            r: 6,
                                            fill: '#F4B400',
                                            stroke: '#fff',
                                            strokeWidth: 2,
                                        }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="flex h-full flex-col justify-between gap-6">
                        <div className="flex flex-1 flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                            <h2 className="text-sm font-bold text-slate-900">
                                Recent Activities
                            </h2>
                            <div className="mt-3 flex flex-1 flex-col justify-center space-y-2.5">
                                {recentActivities.map((activity, i) => {
                                    const Icon = activity.icon;
                                    return (
                                        <div
                                            key={i}
                                            className="flex items-start gap-2.5"
                                        >
                                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                                <Icon className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold text-slate-800">
                                                    {activity.title}
                                                </p>
                                                <p className="truncate text-xs text-slate-500">
                                                    {activity.subtitle}
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-[11px] text-slate-400">
                                                {activity.time}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <Link
                                href={route('admin.audit.index')}
                                className="mt-3 block w-full rounded-lg bg-amber-50 py-2 text-center text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                                View All Activities
                            </Link>
                        </div>

                        <div className="flex flex-1 flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                            <h2 className="text-sm font-bold text-slate-900">
                                Training Completion Rate
                            </h2>
                            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={completionData}
                                                dataKey="value"
                                                innerRadius={36}
                                                outerRadius={52}
                                                startAngle={90}
                                                endAngle={-270}
                                            >
                                                {completionData.map((entry, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={entry.color}
                                                    />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-xl font-extrabold leading-none tabular-nums text-slate-900">
                                            78%
                                        </span>
                                        <span className="mt-1 text-[10px] font-medium leading-none text-slate-500">
                                            Complete
                                        </span>
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1 space-y-4">
                                    {completionData.map((entry) => (
                                        <div key={entry.name} className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-800">
                                                    <span
                                                        className="h-2 w-2 shrink-0 rounded-full"
                                                        style={{
                                                            backgroundColor:
                                                                entry.color,
                                                        }}
                                                    />
                                                    <span className="truncate">
                                                        {entry.name}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                                                    {entry.percent}% ({entry.count})
                                                </span>
                                            </div>
                                            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${entry.percent}%`,
                                                        backgroundColor:
                                                            entry.color,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Top Competencies + Top Performing Trainees + Upcoming Trainings */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <h2 className="text-sm font-bold text-slate-900">
                            Top Competencies
                        </h2>
                        <div className="mt-3 space-y-3">
                            {topCompetencies.map((item) => (
                                <div key={item.label}>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-slate-700">
                                            {item.label}
                                        </span>
                                        <span className="font-semibold text-slate-900">
                                            {item.score}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full bg-amber-400"
                                            style={{
                                                width: `${(item.score / 5) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <h2 className="text-sm font-bold text-slate-900">
                            Top Performing Trainees
                        </h2>
                        <div className="mt-3 space-y-2">
                            {topTrainees.map((trainee, i) => (
                                <button
                                    key={trainee.name}
                                    onClick={() => setSelectedTrainee(trainee)}
                                    className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition hover:bg-slate-50"
                                >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-800">
                                            {trainee.name}
                                        </p>
                                        <p className="truncate text-xs text-slate-500">
                                            {trainee.role}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700">
                                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                        {trainee.score}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                        <h2 className="text-sm font-bold text-slate-900">
                            Upcoming Trainings
                        </h2>
                        <div className="mt-3 space-y-3">
                            {upcomingTrainings.map((training, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-[#F4B400]/15 py-2 text-[#8a6400]">
                                        <span className="text-[10px] font-bold uppercase">
                                            {training.month}
                                        </span>
                                        <span className="text-lg font-extrabold leading-tight">
                                            {training.day}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-slate-900">
                                            {training.title}
                                        </p>
                                        <p className="truncate text-xs text-slate-500">
                                            {training.fullDate}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right text-xs font-medium text-slate-400">
                                        {training.participants}
                                        <br />
                                        Participants
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick Management */}
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <h2 className="text-sm font-bold text-slate-900">
                        Quick Management
                    </h2>
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            const href = route().has(action.route)
                                ? route(action.route)
                                : '#';
                            return (
                                <Link
                                    key={action.label}
                                    href={href}
                                    className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 p-3 text-center transition hover:border-amber-200 hover:bg-amber-50"
                                >
                                    <Icon className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-medium text-slate-700">
                                        {action.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}