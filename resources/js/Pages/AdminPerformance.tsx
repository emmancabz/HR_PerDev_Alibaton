import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import confetti from 'canvas-confetti';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    Briefcase,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    Hash,
    Mail,
    MapPin,
    Minus,
    Phone,
    Plus,
    RotateCcw,
    Search,
    Sparkles,
    Star,
    TrendingDown,
    TrendingUp,
    Trophy,
    X
} from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';
type CompetencyScore = {
    name: string;
    score: number;
};
type Course = {
    title: string;
    dateCompleted: string;
};
type Evaluation = {
    id: string;
    employee: string;
    role: string;
    department: string;
    period: string;
    rating: number | null;
    status: 'Completed' | 'Pending';
    evaluator: string;
    evaluatorRole: string;
    dateCreated: string | null;
    dateEvaluated?: string | null;
    dueDate?: string | null;
    color: string;
    competencyScores?: CompetencyScore[];
    feedback?: string;
    recommendedForPromotion?: boolean;
    needsAdditionalTraining?: boolean;
    employeeId?: string;
    phone?: string;
    email?: string;
    address?: string;
    dateCreatedProfile?: string;
    lastLogin?: string;
    coursesTaken?: Course[];
};
const INITIAL_EVALUATIONS: Evaluation[] = [
    {
        id: '1',
        employee: 'Bruno Mars',
        role: 'Trainee',
        department: 'Information Technology',
        period: 'Q2 2026 (Jan - Feb)',
        rating: 4.6,
        status: 'Completed',
        evaluator: 'Ainah Sta. Maria',
        evaluatorRole: 'HR Manager',
        dateCreated: 'March 12, 2026',
        dateEvaluated: 'March 12, 2026',
        color: '#fbbf24',
        competencyScores: [
            { name: 'Communication', score: 4.7 },
            { name: 'Technical Skills', score: 4.8 },
            { name: 'Team Work', score: 4.6 },
            { name: 'Productivity', score: 4.6 },
            { name: 'Attendance', score: 4.5 },
            { name: 'Problem Solving', score: 4.6 },
        ],
        coursesTaken: [
            { title: 'Full-Stack Web Development', dateCompleted: 'Jan 15, 2026' },
            { title: 'Cybersecurity Fundamentals', dateCompleted: 'Feb 05, 2026' },
            { title: 'React & Tailwind CSS Mastery', dateCompleted: 'Feb 20, 2026' }
        ],
        feedback: 'Continues to show strong technical growth and collaborates well with the rest of the team.',
        recommendedForPromotion: true,
        needsAdditionalTraining: false,
        employeeId: 'EMP-002',
        phone: '+639171234567',
        email: 'bruno.mars@alibaton.com',
        address: 'Quezon City',
        dateCreatedProfile: 'July 12, 2021',
        lastLogin: 'July 26, 2026 9:15 AM',
    },
    {
        id: '2',
        employee: 'Taylor Swift',
        role: 'Trainee',
        department: 'Finance',
        period: 'Q3 2026 (Jan - Mar)',
        rating: 4.4,
        status: 'Completed',
        evaluator: 'Emman Cabanas',
        evaluatorRole: 'Training Officer',
        dateCreated: 'April 15, 2026',
        dateEvaluated: 'April 15, 2026',
        color: '#a3e635',
        competencyScores: [
            { name: 'Communication', score: 4.5 },
            { name: 'Technical Skills', score: 4.5 },
            { name: 'Team Work', score: 4.6 },
            { name: 'Productivity', score: 4.4 },
            { name: 'Attendance', score: 4.3 },
            { name: 'Problem Solving', score: 4.4 },
        ],
        coursesTaken: [
            { title: 'Corporate Finance Basics', dateCompleted: 'Feb 10, 2026' },
            { title: 'Advanced Excel for Accounting', dateCompleted: 'Mar 01, 2026' }
        ],
        feedback: 'Consistent, reliable performance this quarter.',
        recommendedForPromotion: false,
        needsAdditionalTraining: false,
        employeeId: 'EMP-003',
        phone: '+639182345678',
        email: 'taylor.swift@alibaton.com',
        address: 'Makati City',
        dateCreatedProfile: 'August 3, 2021',
        lastLogin: 'July 25, 2026 4:40 PM',
    },
    {
        id: '3',
        employee: 'Justin Bieber',
        role: 'Trainee',
        department: 'Operations',
        period: 'Q3 2026 (Jan - Mar)',
        rating: 4.3,
        status: 'Completed',
        evaluator: 'Lisa Montero',
        evaluatorRole: 'Staff',
        dateCreated: 'April 25, 2026',
        dateEvaluated: 'April 25, 2026',
        color: '#c084fc',
        competencyScores: [
            { name: 'Communication', score: 4.1 },
            { name: 'Technical Skills', score: 4.4 },
            { name: 'Team Work', score: 4.5 },
            { name: 'Productivity', score: 4.3 },
            { name: 'Attendance', score: 4.2 },
            { name: 'Problem Solving', score: 4.4 },
        ],
        coursesTaken: [
            { title: 'Operations Management 101', dateCompleted: 'Jan 22, 2026' }
        ],
        feedback: 'Solid quarter overall but needs improvement on communication.',
        recommendedForPromotion: false,
        needsAdditionalTraining: true,
        employeeId: 'EMP-004',
        phone: '+639193456789',
        email: 'justin.bieber@alibaton.com',
        address: 'Calamba City',
        dateCreatedProfile: 'September 15, 2021',
        lastLogin: 'July 27, 2026 8:02 AM',
    },
    {
        id: '6',
        employee: 'Emman Cabanas',
        role: 'Training Officer',
        department: 'Human Resources',
        period: 'Q2 2026 (Jan - Feb)',
        rating: 4.9,
        status: 'Completed',
        evaluator: 'Ainah Sta. Maria',
        evaluatorRole: 'HR Manager',
        dateCreated: 'March 15, 2026',
        dateEvaluated: 'March 15, 2026',
        color: '#60a5fa',
        competencyScores: [
            { name: 'Communication', score: 5.0 },
            { name: 'Technical Skills', score: 4.9 },
            { name: 'Team Work', score: 4.8 },
            { name: 'Productivity', score: 4.9 },
            { name: 'Attendance', score: 4.9 },
            { name: 'Problem Solving', score: 4.9 },
        ],
        coursesTaken: [
            { title: 'Leadership & Team Management', dateCompleted: 'Dec 10, 2025' },
            { title: 'HR Analytics & Systems', dateCompleted: 'Jan 05, 2026' }
        ],
        feedback: 'Exceptional leadership and execution in training programs.',
        recommendedForPromotion: true,
        needsAdditionalTraining: false,
        employeeId: 'EMP-002',
        phone: '+639193456789',
        email: 'emman.cabanas@alibaton.com',
        address: 'Calamba City',
        dateCreatedProfile: 'August 12, 2021',
        lastLogin: 'July 27, 2026 8:02 AM',
    },
    {
        id: '4',
        employee: 'Lana Del Rey',
        role: 'Trainee',
        department: 'Operations',
        period: 'Q3 2028 (Jan - Mar)',
        rating: null,
        status: 'Pending',
        evaluator: 'Mhicaela Buban',
        evaluatorRole: 'Staff',
        dateCreated: null,
        dueDate: 'August 20, 2026',
        color: '#fb7185',
        coursesTaken: [
            { title: 'Quality Assurance Basics', dateCompleted: 'Jul 10, 2026' }
        ],
        employeeId: 'EMP-005',
        phone: '+639204567890',
        email: 'lana.delrey@alibaton.com',
        address: 'Pasig City',
        dateCreatedProfile: 'October 1, 2021',
        lastLogin: 'July 24, 2026 2:18 PM',
    },
    {
        id: '5',
        employee: 'Avril Lavigne',
        role: 'Trainee',
        department: 'Operations',
        period: 'Q3 2026 (Jan - Mar)',
        rating: null,
        status: 'Pending',
        evaluator: 'Kaye Caagusan',
        evaluatorRole: 'Staff',
        dateCreated: null,
        dueDate: 'August 22, 2026',
        color: '#f87171',
        employeeId: 'EMP-006',
        phone: '+639215678901',
        email: 'avril.lavigne@alibaton.com',
        address: 'Manila City',
        dateCreatedProfile: 'November 5, 2021',
        lastLogin: 'July 22, 2026 11:10 AM',
    },
];
const AVAILABLE_EMPLOYEES = [
    { name: 'Ainah Sta. Maria', role: 'HR Manager', department: 'Human Resources', id: 'HR - 001', employeeId: 'EMP-001', phone: '+639565147895', email: 'ainah.stamaria@alibaton.com', address: 'Caloocan City', dateCreatedProfile: 'July 10, 2021', lastLogin: 'July 23, 2026 10:30 AM', color: '#f472b6' },
    { name: 'Emman Cabanas', role: 'Training Officer', department: 'Human Resources', id: 'HR - 002', employeeId: 'EMP-002', phone: '+639193456789', email: 'emman.cabanas@alibaton.com', address: 'Calamba City', dateCreatedProfile: 'August 12, 2021', lastLogin: 'July 27, 2026 8:02 AM', color: '#60a5fa' },
    { name: 'Ariana Grande', role: 'Staff', department: 'Human Resources', id: 'HR - 003', employeeId: 'EMP-003', phone: '+639171234567', email: 'ariana.grande@alibaton.com', address: 'Quezon City', dateCreatedProfile: 'May 24, 2022', lastLogin: 'July 26, 2026 9:15 AM', color: '#38bdf8' },
    { name: 'Mhicaela Buban', role: 'Staff', department: 'Human Resources', id: 'HR - 004', employeeId: 'EMP-004', phone: '+639182345678', email: 'mhicaela.buban@alibaton.com', address: 'Makati City', dateCreatedProfile: 'July 10, 2022', lastLogin: 'July 25, 2026 4:40 PM', color: '#fb7185' },
    { name: 'Kaye Caagusan', role: 'Staff', department: 'Human Resources', id: 'HR - 005', employeeId: 'EMP-005', phone: '+639204567890', email: 'kaye.caagusan@alibaton.com', address: 'Pasig City', dateCreatedProfile: 'November 29, 2022', lastLogin: 'July 24, 2026 2:18 PM', color: '#f87171' },
    { name: 'Bruno Mars', role: 'Trainee (Information Technology)', department: 'Information Technology', id: 'TRN - 001', employeeId: 'EMP-006', phone: '+639171234567', email: 'bruno.mars@alibaton.com', address: 'Quezon City', dateCreatedProfile: 'July 12, 2021', lastLogin: 'July 26, 2026 9:15 AM', color: '#fbbf24' },
    { name: 'Taylor Swift', role: 'Trainee (Finance)', department: 'Finance', id: 'TRN - 002', employeeId: 'EMP-007', phone: '+639182345678', email: 'taylor.swift@alibaton.com', address: 'Makati City', dateCreatedProfile: 'August 3, 2021', lastLogin: 'July 25, 2026 4:40 PM', color: '#a3e635' },
    { name: 'Justin Bieber', role: 'Trainee (Operations)', department: 'Operations', id: 'TRN - 003', employeeId: 'EMP-008', phone: '+639193456789', email: 'justin.bieber@alibaton.com', address: 'Calamba City', dateCreatedProfile: 'September 15, 2021', lastLogin: 'July 27, 2026 8:02 AM', color: '#c084fc' },
    { name: 'Lana Del Rey', role: 'Trainee (Operations)', department: 'Operations', id: 'TRN - 004', employeeId: 'EMP-009', phone: '+639204567890', email: 'lana.delrey@alibaton.com', address: 'Pasig City', dateCreatedProfile: 'October 1, 2021', lastLogin: 'July 24, 2026 2:18 PM', color: '#fb7185' },
    { name: 'Avril Lavigne', role: 'Trainee (Operations)', department: 'Operations', id: 'TRN - 005', employeeId: 'EMP-010', phone: '+639215678901', email: 'avril.lavigne@alibaton.com', address: 'Manila City', dateCreatedProfile: 'November 5, 2021', lastLogin: 'July 22, 2026 11:10 AM', color: '#f87171' },
    { name: 'Ed Sheeran', role: 'Developer (IT)', department: 'Information Technology', id: 'DEV - 006', employeeId: 'EMP-011', phone: '+639226789012', email: 'ed.sheeran@alibaton.com', address: 'Taguig City', dateCreatedProfile: 'December 1, 2021', lastLogin: 'July 27, 2026 1:00 PM', color: '#3b82f6' },
];
const EVALUATION_CRITERIA_DETAILS = [
    { name: 'Communication', description: 'Shares information clearly and effective' },
    { name: 'Technical Skills', description: 'Knowledge and skills required for the job' },
    { name: 'Team Work', description: 'Work well with team members' },
    { name: 'Productivity', description: 'Completes tasks efficiently and on time' },
    { name: 'Attendance', description: 'Punctuality and presence at work' },
    { name: 'Problem Solving', description: 'Ability to analyze and solve problems' },
];
const PERIOD_OPTIONS = ['All Periods', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
type PerformanceLevelKey = 'exceptional' | 'exceeds' | 'meets' | 'needsImprovement' | 'critical';
const PERFORMANCE_LEVELS: { key: PerformanceLevelKey; label: string; min: number; color: string; barColor: string; textColor: string; bgColor: string }[] = [
    { key: 'exceptional', label: 'Exceptional', min: 4.7, color: '#16a34a', barColor: '#22c55e', textColor: 'text-green-700', bgColor: 'bg-green-100' },
    { key: 'exceeds', label: 'Exceeds Expectations', min: 4.3, color: '#3b82f6', barColor: '#60a5fa', textColor: 'text-blue-700', bgColor: 'bg-blue-100' },
    { key: 'meets', label: 'Meets Expectations', min: 3.7, color: '#F4B400', barColor: '#fbbf24', textColor: 'text-amber-700', bgColor: 'bg-amber-100' },
    { key: 'needsImprovement', label: 'Needs Improvement', min: 3.0, color: '#f97316', barColor: '#fb923c', textColor: 'text-orange-700', bgColor: 'bg-orange-100' },
    { key: 'critical', label: 'Critical Improvement', min: 0, color: '#dc2626', barColor: '#f87171', textColor: 'text-rose-700', bgColor: 'bg-rose-100' },
];
function getPerformanceLevel(rating: number | null | undefined) {
    if (rating === null || rating === undefined) return null;
    return PERFORMANCE_LEVELS.find((l) => rating >= l.min) ?? PERFORMANCE_LEVELS[PERFORMANCE_LEVELS.length - 1];
}
const LEVEL_FILTER_OPTIONS = ['All Levels', ...PERFORMANCE_LEVELS.map((l) => l.label)];
function initials(name: string) {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('');
}
type StatusFilter = 'All' | 'Completed' | 'Pending';
type FormMode = 'create' | 'edit';
type FormState = {
    id: string | null;
    employee: string;
    role: string;
    department: string;
    employeeId: string;
    employeeColor: string;
    period: string;
    evaluator: string;
    evaluatorRole: string;
    dateEvaluated: string;
    comments: string;
    scores: Record<string, number>;
    recommendedForPromotion: boolean;
    needsAdditionalTraining: boolean;
    phone: string;
    email: string;
    address: string;
    dateCreatedProfile: string;
    lastLogin: string;
};
function emptyForm(departments: string[]): FormState {
    return {
        id: null,
        employee: '',
        role: '',
        department: departments[0] ?? 'Information Technology',
        employeeId: '',
        employeeColor: '#94a3b8',
        period: 'Q2 2026 (Jan - Feb)',
        evaluator: 'Ainah Sta. Maria',
        evaluatorRole: 'HR Manager',
        dateEvaluated: 'July 25, 2026',
        comments: '',
        scores: Object.fromEntries(EVALUATION_CRITERIA_DETAILS.map((c) => [c.name, 0])),
        recommendedForPromotion: false,
        needsAdditionalTraining: false,
        phone: '',
        email: '',
        address: '',
        dateCreatedProfile: '',
        lastLogin: '',
    };
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
function EvaluationDetailsModal({
    evaluation,
    onClose,
}: {
    evaluation: Evaluation;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl ring-1 ring-slate-900/10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative bg-gradient-to-br from-[#121212] to-[#2a2a2a] px-6 pb-8 pt-6">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#F4B400]">
                        User Evaluation Details
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                        <div
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
                            style={{ backgroundColor: evaluation.color || '#F4B400' }}
                        >
                            {initials(evaluation.employee)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-xl font-bold text-white">
                                {evaluation.employee}
                            </h2>
                            <p className="mt-0.5 text-sm text-white/60">
                                {evaluation.role} · {evaluation.department}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                        evaluation.status === 'Completed'
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-amber-500/20 text-amber-300'
                                    }`}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                            evaluation.status === 'Completed'
                                                ? 'bg-emerald-400'
                                                : 'bg-amber-400'
                                        }`}
                                    />
                                    {evaluation.status}
                                </span>
                                {evaluation.rating ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F4B400]/20 px-3 py-1 text-xs font-semibold text-[#F4B400]">
                                        <Star className="h-3 w-3 fill-[#F4B400]" />
                                        {evaluation.rating} / 5 Performance Score
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/60">
                                        Pending Rating
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Evaluation Info
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <p className="text-slate-400">Evaluation Period</p>
                                <p className="font-semibold text-slate-800">{evaluation.period}</p>
                            </div>
                            <div>
                                <p className="text-slate-400">Evaluator</p>
                                <p className="font-semibold text-slate-800">{evaluation.evaluator} ({evaluation.evaluatorRole})</p>
                            </div>
                            <div>
                                <p className="text-slate-400">{evaluation.status === 'Completed' ? 'Date Evaluated' : 'Due Date'}</p>
                                <p className="font-semibold text-slate-800">{(evaluation.status === 'Completed' ? evaluation.dateEvaluated : evaluation.dueDate) ?? '—'}</p>
                            </div>
                        </div>
                    </div>
                    {evaluation.competencyScores && evaluation.competencyScores.length > 0 && (
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Competency Scores
                            </p>
                            <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
                                {evaluation.competencyScores.map((c) => (
                                    <div key={c.name} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                        <span className="font-medium text-slate-700">{c.name}</span>
                                        <span className="flex items-center gap-1 font-bold text-slate-900">
                                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {c.score.toFixed(1)} / 5
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {evaluation.feedback && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Feedback / Comments
                            </p>
                            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm text-xs leading-relaxed text-slate-700">
                                {evaluation.feedback}
                            </div>
                        </div>
                    )}
                    {evaluation.coursesTaken && evaluation.coursesTaken.length > 0 && (
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Courses & Trainings Completed
                            </p>
                            <div className="space-y-2.5 rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm">
                                {evaluation.coursesTaken.map((course, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                                                <BookOpen className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="font-semibold text-slate-800">{course.title}</span>
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-500">{course.dateCompleted}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Contact Information
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <DetailField icon={Hash} label="Employee ID" value={evaluation.employeeId || 'EMP-002'} />
                            <DetailField icon={Mail} label="Email" value={evaluation.email || `${evaluation.employee.toLowerCase().replace(/\s+/g, '.')}\@alibaton.com`} />
                            <DetailField icon={Phone} label="Phone Number" value={evaluation.phone || '+639171234567'} />
                            <DetailField icon={MapPin} label="Address" value={evaluation.address || 'Quezon City'} />
                        </div>
                    </div>
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Work Information
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <DetailField icon={Briefcase} label="Position" value={evaluation.role} />
                            <DetailField icon={Building2} label="Department" value={evaluation.department} />
                        </div>
                    </div>
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Account Activity
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <DetailField icon={Calendar} label="Date Created" value={evaluation.dateCreatedProfile || 'July 12, 2021'} />
                            <DetailField icon={Clock} label="Last Login" value={evaluation.lastLogin || 'July 26, 2026 9:15 AM'} />
                        </div>
                    </div>
                </div>
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
function PerformanceDistributionChart({ data, total }: { data: { key: PerformanceLevelKey; label: string; count: number; color: string }[]; total: number }) {
    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <BarChart3 className="h-6 w-6 text-slate-300" />
                <p className="text-xs text-slate-400">No performance records match the selected filters.</p>
            </div>
        );
    }
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
        <div className="space-y-2.5">
            {data.map((d) => {
                const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                const widthPct = Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0);
                return (
                    <div key={d.key} className="group">
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="font-medium text-slate-600">{d.label}</span>
                            <span className="font-semibold text-slate-800">{d.count} <span className="font-normal text-slate-400">({pct}%)</span></span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${widthPct}%`, backgroundColor: d.color }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function LevelBadge({ level }: { level: (typeof PERFORMANCE_LEVELS)[number] | null }) {
    if (!level) {
        return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Not yet rated</span>;
    }
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${level.bgColor} ${level.textColor}`}>
            {level.label}
        </span>
    );
}

function TopPerformerPortraits({
    performers,
    onSelect,
}: {
    performers: Evaluation[];
    onSelect: (ev: Evaluation) => void;
}) {
    if (performers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Trophy className="h-6 w-6 text-slate-300" />
                <p className="text-xs text-slate-400">No performance records match the selected filters.</p>
            </div>
        );
    }
    const displayList = performers.slice(0, 3);
    return (
        <div className="grid grid-cols-3 gap-2.5">
            {displayList.map((ev, idx) => {
                return (
                    <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelect(ev)}
                        className="group relative flex flex-col items-center rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-3 text-center shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-amber-300 hover:shadow-md"
                    >
                        <span className="absolute -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F4B400] text-[10px] font-extrabold text-black shadow-sm">
                            #{idx + 1}
                        </span>
                        <div 
                            className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner transition-transform duration-300 group-hover:scale-105"
                            style={{ backgroundColor: ev.color }}
                        >
                            {initials(ev.employee)}
                        </div>
                        <div className="mt-2.5 w-full min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                                {ev.employee}
                            </p>
                            <p className="truncate text-[10px] text-slate-400 mt-0.5">
                                {ev.department}
                            </p>
                            <div className="mt-2 flex items-center justify-center gap-1 bg-amber-50/80 rounded-md py-1 px-1.5 border border-amber-100/50">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                                <span className="text-[11px] font-bold text-slate-800">
                                    {ev.rating?.toFixed(1)}
                                </span>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function InsightTagIcon({ tag }: { tag: 'strong' | 'stable' | 'attention' | 'insufficient' }) {
    if (tag === 'strong') return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
    if (tag === 'attention') return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    if (tag === 'insufficient') return <Minus className="h-3.5 w-3.5 text-slate-400" />;
    return <TrendingDown className="h-3.5 w-3.5 rotate-180 text-blue-500" />;
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(n)}
                    className="rounded p-0.5 hover:bg-amber-50"
                    aria-label={`Rate ${n}`}
                >
                    <Star className={`h-4 w-4 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                </button>
            ))}
        </div>
    );
}

type AIInsightTag = 'strong' | 'stable' | 'attention' | 'insufficient';
type AIInsight = { tag: AIInsightTag; headline: string; bullets: string[] };

type ActiveFilterContext = {
    department: string;
    period: string;
    level: string;
    status: StatusFilter;
};

function filterContextLabel(ctx: ActiveFilterContext) {
    const parts: string[] = [];
    if (ctx.department !== 'All Department') parts.push(ctx.department);
    if (ctx.period !== 'All Periods') parts.push(ctx.period);
    if (ctx.status !== 'All') parts.push(ctx.status);
    return parts.length ? parts.join(' · ') : 'All Departments';
}

function generatePerformanceInsight(filtered: Evaluation[], ctx: ActiveFilterContext): AIInsight {
    const contextLabel = filterContextLabel(ctx);
    const rated = filtered.filter((e): e is Evaluation & { rating: number } => e.rating !== null);
    if (rated.length === 0) {
        return {
            tag: 'insufficient',
            headline: `Not enough completed evaluations in ${contextLabel} to generate a reliable insight.`,
            bullets: ['Widen the filters or wait for pending evaluations to be completed before drawing conclusions from this view.'],
        };
    }
    const counts: Record<PerformanceLevelKey, number> = { exceptional: 0, exceeds: 0, meets: 0, needsImprovement: 0, critical: 0 };
    rated.forEach((e) => {
        const level = getPerformanceLevel(e.rating);
        if (level) counts[level.key] += 1;
    });
    const avg = rated.reduce((s, e) => s + e.rating, 0) / rated.length;
    const strongCount = counts.exceptional + counts.exceeds;
    const weakCount = counts.needsImprovement + counts.critical;
    const strongPct = Math.round((strongCount / rated.length) * 100);
    const weakPct = Math.round((weakCount / rated.length) * 100);
    if (ctx.level === 'Needs Improvement' || ctx.level === 'Critical Improvement') {
        return {
            tag: 'attention',
            headline: 'The current view contains employees requiring additional development attention.',
            bullets: [
                `${rated.length} employee${rated.length === 1 ? '' : 's'} in this view fall in the ${ctx.level} range.`,
                'Consider reviewing their competency gaps and assigning appropriate learning interventions.',
                `Average rating within this group is ${avg.toFixed(2)} / 5.`,
            ],
        };
    }
    if (weakPct >= 30) {
        return {
            tag: 'attention',
            headline: `${contextLabel} shows a meaningful group of employees who may need development support.`,
            bullets: [
                `${weakCount} of ${rated.length} evaluated employees (${weakPct}%) fall in Needs Improvement or Critical Improvement.`,
                `${strongCount} employees (${strongPct}%) are rated Exceeds Expectations or higher.`,
                `Average rating across this view is ${avg.toFixed(2)} / 5.`,
            ],
        };
    }
    if (strongPct >= 50) {
        return {
            tag: 'strong',
            headline: `${contextLabel} shows a stronger concentration of employees exceeding expectations.`,
            bullets: [
                `${strongCount} of ${rated.length} evaluated employees (${strongPct}%) are rated Exceeds Expectations or higher.`,
                weakCount > 0
                    ? `A smaller group of ${weakCount} (${weakPct}%) remains in the needs-improvement range.`
                    : 'No employees in this view currently fall below Meets Expectations.',
                `Average rating across this view is ${avg.toFixed(2)} / 5.`,
            ],
        };
    }
    return {
        tag: 'stable',
        headline: `Overall performance in ${contextLabel} remains stable, with most employees meeting expectations.`,
        bullets: [
            `${counts.meets} of ${rated.length} evaluated employees (${Math.round((counts.meets / rated.length) * 100)}%) are meeting expectations.`,
            weakCount > 0
                ? `A smaller group of ${weakCount} (${weakPct}%) may benefit from targeted development.`
                : 'No employees in this view currently fall below Meets Expectations.',
            `Average rating across this view is ${avg.toFixed(2)} / 5.`,
        ],
    };
}

function generateTopPerformerInsight(list: Evaluation[], ctx: ActiveFilterContext): AIInsight {
    const contextLabel = filterContextLabel(ctx);
    if (list.length === 0) {
        return {
            tag: 'insufficient',
            headline: `No top performers to analyze in ${contextLabel}.`,
            bullets: ['There are no completed, rated evaluations in the current filters yet.'],
        };
    }
    const avg = list.reduce((s, e) => s + (e.rating ?? 0), 0) / list.length;
    const deptCounts = new Map<string, number>();
    list.forEach((e) => deptCounts.set(e.department, (deptCounts.get(e.department) ?? 0) + 1));
    const topDept = [...deptCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const exceptionalCount = list.filter((e) => getPerformanceLevel(e.rating)?.key === 'exceptional').length;
    return {
        tag: 'strong',
        headline: `${list.length} top performer${list.length === 1 ? '' : 's'} identified in ${contextLabel}.`,
        bullets: [
            `Average score among this group is ${avg.toFixed(2)} / 5.`,
            topDept ? `${topDept[0]} has the strongest representation, with ${topDept[1]} of the listed performers.` : '',
            exceptionalCount > 0
                ? `${exceptionalCount} employee${exceptionalCount === 1 ? '' : 's'} rate in the Exceptional band — a good starting point for recognition or mentorship opportunities.`
                : 'No employees in this view currently reach the Exceptional band.',
        ].filter(Boolean),
    };
}

export default function PerformanceManagement() {
    const [evaluations, setEvaluations] = useState<Evaluation[]>(INITIAL_EVALUATIONS);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [departmentFilter, setDepartmentFilter] = useState('All Department');
    const [periodFilter, setPeriodFilter] = useState('All Periods');
    const [levelFilter, setLevelFilter] = useState('All Levels');
    const [selected, setSelected] = useState<Evaluation | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState<FormMode>('create');
    const [form, setForm] = useState<FormState | null>(null);
    const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
    const [isSearchingEmployee, setIsSearchingEmployee] = useState(false);
    const [showAllPerformers, setShowAllPerformers] = useState(false);
    const [isRevealing, setIsRevealing] = useState(false);
    const departments = useMemo(() => Array.from(new Set(evaluations.map((e) => e.department))), [evaluations]);
    const filtersActive = statusFilter !== 'All' || departmentFilter !== 'All Department' || periodFilter !== 'All Periods' || levelFilter !== 'All Levels';
    const filteredEvaluations = useMemo(() => {
        return evaluations.filter((row) => {
            const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
            const matchesDepartment = departmentFilter === 'All Department' || row.department === departmentFilter;
            const matchesPeriod = periodFilter === 'All Periods' || row.period.startsWith(periodFilter);
            const rowLevel = getPerformanceLevel(row.rating);
            const matchesLevel = levelFilter === 'All Levels' || rowLevel?.label === levelFilter;
            return matchesStatus && matchesDepartment && matchesPeriod && matchesLevel;
        });
    }, [evaluations, statusFilter, departmentFilter, periodFilter, levelFilter]);
    const summaryStats = useMemo(() => {
        const total = filteredEvaluations.length;
        const completed = filteredEvaluations.filter((e) => e.status === 'Completed').length;
        const pending = filteredEvaluations.filter((e) => e.status === 'Pending').length;
        const rated = filteredEvaluations.filter((e) => e.rating !== null);
        const avgRating = rated.length ? (rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length).toFixed(1) : '—';
        return [
            { label: 'Total Evaluation', value: total, icon: ClipboardList },
            { label: 'Completed', value: completed, icon: CheckCircle2 },
            { label: 'Pending', value: pending, icon: Clock },
            { label: 'Average Rating', value: rated.length ? `${avgRating}/5` : '—', icon: Star },
        ];
    }, [filteredEvaluations]);
    const ratedFiltered = useMemo(() => filteredEvaluations.filter((e) => e.rating !== null), [filteredEvaluations]);
    const distribution = useMemo(() => {
        const counts: Record<PerformanceLevelKey, number> = { exceptional: 0, exceeds: 0, meets: 0, needsImprovement: 0, critical: 0 };
        ratedFiltered.forEach((e) => {
            const level = getPerformanceLevel(e.rating);
            if (level) counts[level.key] += 1;
        });
        return PERFORMANCE_LEVELS.map((l) => ({ key: l.key, label: l.label, count: counts[l.key], color: l.color }));
    }, [ratedFiltered]);
    const topPerformers = useMemo(() => [...ratedFiltered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)), [ratedFiltered]);
    const filterContext: ActiveFilterContext = { department: departmentFilter, period: periodFilter, level: levelFilter, status: statusFilter };
    const performanceInsight = useMemo(() => generatePerformanceInsight(filteredEvaluations, filterContext), [filteredEvaluations, departmentFilter, periodFilter, levelFilter, statusFilter]);
    const topPerformerInsight = useMemo(() => generateTopPerformerInsight(topPerformers, filterContext), [topPerformers, departmentFilter, periodFilter, levelFilter, statusFilter]);
    function resetFilters() {
        setStatusFilter('All');
        setDepartmentFilter('All Department');
        setPeriodFilter('All Periods');
        setLevelFilter('All Levels');
    }
    function openCreateForm() {
        setFormMode('create');
        setForm(emptyForm(departments));
        setEmployeeSearchQuery('');
        setIsSearchingEmployee(false);
        setShowForm(true);
    }
    function openEditForm(ev: Evaluation) {
        setFormMode('edit');
        setEmployeeSearchQuery(ev.employee);
        setForm({
            id: ev.id,
            employee: ev.employee,
            role: ev.role,
            department: ev.department,
            employeeId: ev.employeeId ?? 'EMP-002',
            employeeColor: ev.color,
            period: ev.period,
            evaluator: ev.evaluator,
            evaluatorRole: ev.evaluatorRole,
            dateEvaluated: ev.dateEvaluated ?? 'July 25, 2026',
            comments: ev.feedback ?? '',
            scores: Object.fromEntries(
                EVALUATION_CRITERIA_DETAILS.map((c) => [c.name, ev.competencyScores?.find((s) => s.name === c.name)?.score ?? 0]),
            ),
            recommendedForPromotion: ev.recommendedForPromotion ?? false,
            needsAdditionalTraining: ev.needsAdditionalTraining ?? false,
            phone: ev.phone ?? '+639171234567',
            email: ev.email ?? 'trainee@alibaton.com',
            address: ev.address ?? 'Quezon City',
            dateCreatedProfile: ev.dateCreatedProfile ?? 'July 12, 2021',
            lastLogin: ev.lastLogin ?? 'July 26, 2026 9:15 AM',
        });
        setShowForm(true);
    }
    function closeForm() {
        setShowForm(false);
        setForm(null);
    }
    function averageScore(scores: Record<string, number>) {
        const values = Object.values(scores).filter((v) => v > 0);
        if (values.length === 0) return null;
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    }
    function handleSave(status: 'Pending' | 'Completed') {
        if (!form || !form.employee) return;
        const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const avg = averageScore(form.scores);
        const competencyScores: CompetencyScore[] = EVALUATION_CRITERIA_DETAILS
            .filter((c) => form.scores[c.name] > 0)
            .map((c) => ({ name: c.name, score: form.scores[c.name] }));
        if (formMode === 'edit' && form.id) {
            setEvaluations((prev) =>
                prev.map((ev) =>
                    ev.id === form.id
                        ? {
                            ...ev,
                            employee: form.employee,
                            role: form.role,
                            department: form.department,
                            period: form.period,
                            evaluator: form.evaluator,
                            evaluatorRole: form.evaluatorRole,
                            dateEvaluated: form.dateEvaluated,
                            feedback: form.comments || ev.feedback,
                            status,
                            rating: avg ?? ev.rating,
                            competencyScores: competencyScores.length ? competencyScores : ev.competencyScores,
                            dateCreated: ev.dateCreated ?? today,
                            recommendedForPromotion: form.recommendedForPromotion,
                            needsAdditionalTraining: form.needsAdditionalTraining,
                            employeeId: form.employeeId,
                            phone: form.phone,
                            email: form.email,
                            address: form.address,
                          }
                        : ev,
                ),
            );
        } else {
            const newEvaluation: Evaluation = {
                id: `${Date.now()}`,
                employee: form.employee,
                role: form.role || 'Trainee',
                department: form.department,
                period: form.period,
                rating: avg,
                status,
                evaluator: form.evaluator || '—',
                evaluatorRole: form.evaluatorRole || '—',
                dateCreated: today,
                dateEvaluated: form.dateEvaluated,
                dueDate: null,
                color: form.employeeColor || '#94a3b8',
                competencyScores: competencyScores.length ? competencyScores : undefined,
                feedback: form.comments || undefined,
                recommendedForPromotion: form.recommendedForPromotion,
                needsAdditionalTraining: form.needsAdditionalTraining,
                employeeId: form.employeeId || 'EMP-009',
                phone: form.phone || '+639171234567',
                email: form.email || 'employee@alibaton.com',
                address: form.address || 'Quezon City',
                dateCreatedProfile: 'August 2, 2026',
                lastLogin: 'August 2, 2026 4:00 PM',
            };
            setEvaluations((prev) => [newEvaluation, ...prev]);
        }
        closeForm();
    }
    const handleViewAllPerformers = () => {
        setShowAllPerformers(true);
        setIsRevealing(true);
        setTimeout(() => {
            setIsRevealing(false);
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#F4B400', '#fbbf24', '#f59e0b', '#3b82f6', '#10b981'],
                zIndex: 1000
            });
        }, 2200);
    };
    const currentFormAvg = form ? averageScore(form.scores) : null;
    const searchedEmployees = useMemo(() => {
        if (!employeeSearchQuery.trim()) return [];
        const q = employeeSearchQuery.toLowerCase();
        return AVAILABLE_EMPLOYEES.filter((emp) => emp.name.toLowerCase().includes(q) || emp.department.toLowerCase().includes(q));
    }, [employeeSearchQuery]);
    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Performance Management</h1>}>
            <Head title="Performance Management" />
            {selected && (
                <EvaluationDetailsModal
                    evaluation={selected}
                    onClose={() => setSelected(null)}
                />
            )}
            {showForm && form && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in" onClick={closeForm}>
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h3 className="text-base font-bold text-slate-900">Evaluate Employee</h3>
                            <button onClick={closeForm} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="mt-4 space-y-4">
                            <div className="relative">
                                <label className="mb-1 block text-xs font-bold text-slate-700">Search & Select Employee *</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={employeeSearchQuery}
                                        onChange={(e) => {
                                            setEmployeeSearchQuery(e.target.value);
                                            setIsSearchingEmployee(true);
                                            if (!e.target.value) {
                                                setForm({ ...form, employee: '', role: '', employeeId: '', department: '' });
                                            }
                                        }}
                                        onFocus={() => setIsSearchingEmployee(true)}
                                        placeholder="Type employee name (e.g. Bruno Mars, Taylor Swift)..."
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 focus:border-[#F4B400] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                    />
                                </div>
                                {isSearchingEmployee && searchedEmployees.length > 0 && !form.employee && (
                                    <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                        {searchedEmployees.map((emp) => (
                                            <button
                                                key={emp.id}
                                                type="button"
                                                onClick={() => {
                                                    setForm({
                                                        ...form,
                                                        employee: emp.name,
                                                        role: emp.role,
                                                        department: emp.department,
                                                        employeeId: emp.employeeId,
                                                        employeeColor: emp.color,
                                                        phone: emp.phone,
                                                        email: emp.email,
                                                        address: emp.address,
                                                        dateCreatedProfile: emp.dateCreatedProfile,
                                                        lastLogin: emp.lastLogin,
                                                    });
                                                    setEmployeeSearchQuery(emp.name);
                                                    setIsSearchingEmployee(false);
                                                }}
                                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-amber-50/60 transition"
                                            >
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: emp.color }}>
                                                    {initials(emp.name)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-900">{emp.name}</p>
                                                    <p className="text-[10px] text-slate-500">{emp.role} · {emp.department}</p>
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-400">{emp.employeeId}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {form.employee ? (
                                <>
                                    <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/60 p-4 animate-fade-in">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-black shadow-sm" style={{ backgroundColor: form.employeeColor || '#F4B400' }}>
                                                {initials(form.employee)}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900">{form.employee}</h4>
                                                <p className="text-xs text-slate-500">{form.role}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Employee ID</p>
                                            <p className="text-xs font-bold text-slate-800">{form.employeeId || 'EMP-002'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                                            <p className="text-[11px] font-semibold text-slate-500 mb-1">Evaluation Period</p>
                                            <select
                                                value={form.period}
                                                onChange={(e) => setForm({ ...form, period: e.target.value })}
                                                className="w-full rounded border-0 bg-slate-50 py-1 px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-[#F4B400]"
                                            >
                                                {PERIOD_OPTIONS.filter((p) => p !== 'All Periods').map((p) => <option key={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                                            <p className="text-[11px] font-semibold text-slate-500 mb-1">Evaluator</p>
                                            <input
                                                value={form.evaluator}
                                                onChange={(e) => setForm({ ...form, evaluator: e.target.value })}
                                                className="w-full rounded border-0 bg-slate-50 py-1 px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-[#F4B400]"
                                            />
                                        </div>
                                        <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                                            <p className="text-[11px] font-semibold text-slate-500 mb-1">Evaluation Date</p>
                                            <input
                                                value={form.dateEvaluated}
                                                onChange={(e) => setForm({ ...form, dateEvaluated: e.target.value })}
                                                className="w-full rounded border-0 bg-slate-50 py-1 px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-[#F4B400]"
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-900">Performance Criteria</span>
                                            <span className="text-xs font-semibold text-slate-500">Rating (1-5)</span>
                                        </div>
                                        <div className="space-y-2.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                                            {EVALUATION_CRITERIA_DETAILS.map((criterion) => (
                                                <div key={criterion.name} className="flex items-center justify-between border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{criterion.name}</p>
                                                        <p className="text-[11px] text-slate-400">{criterion.description}</p>
                                                    </div>
                                                    <StarRatingInput
                                                        value={form.scores[criterion.name] ?? 0}
                                                        onChange={(v) => setForm({ ...form, scores: { ...form.scores, [criterion.name]: v } })}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-bold text-slate-900">Comments</label>
                                        <textarea
                                            value={form.comments}
                                            onChange={(e) => setForm({ ...form, comments: e.target.value })}
                                            rows={3}
                                            placeholder="Enter your comments about the employee's performance...."
                                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30 placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 mb-1">Over All Rating</p>
                                            <div className="flex items-center gap-2">
                                                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                                                <span className="text-base font-bold text-slate-900">
                                                    {currentFormAvg !== null ? currentFormAvg.toFixed(1) : '0'} / 5
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
                                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={form.recommendedForPromotion}
                                                    onChange={(e) => setForm({ ...form, recommendedForPromotion: e.target.checked })}
                                                    className="rounded border-slate-300 text-[#F4B400] focus:ring-[#F4B400]"
                                                />
                                                Recommended for Promotion
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={form.needsAdditionalTraining}
                                                    onChange={(e) => setForm({ ...form, needsAdditionalTraining: e.target.checked })}
                                                    className="rounded border-slate-300 text-[#F4B400] focus:ring-[#F4B400]"
                                                />
                                                Needs Additional Training
                                            </label>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <ClipboardList className="h-8 w-8 text-slate-300 mb-2" />
                                    <p className="text-xs font-semibold text-slate-600">Please select an employee above to start the evaluation.</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Type a name in the search bar to see employee suggestions.</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <button onClick={closeForm} className="rounded-lg border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            {form.employee && (
                                <button onClick={() => handleSave('Completed')} className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-5 py-2 text-xs font-semibold text-black hover:bg-[#dba300] shadow-sm">
                                    <Plus className="h-3.5 w-3.5" /> Save Evaluation
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showAllPerformers && (
                <div 
                    className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-700 ease-in-out ${
                        isRevealing ? 'bg-slate-900/90 backdrop-blur-xl' : 'bg-slate-900/50 backdrop-blur-sm'
                    }`} 
                    onClick={() => !isRevealing && setShowAllPerformers(false)}
                >
                    {isRevealing ? (
                        <div className="flex flex-col items-center justify-center animate-pulse text-center">
                            <Trophy className="mx-auto h-20 w-20 text-[#F4B400] mb-6 drop-shadow-[0_0_20px_rgba(244,180,0,0.8)] animate-bounce" />
                            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-[0.2em] drop-shadow-md">
                                ANALYZING DATA...
                            </h2>
                            <p className="text-slate-300 mt-3 text-base sm:text-lg font-medium tracking-wide">
                                Generating the Top Performers Directory
                            </p>
                        </div>
                    ) : (
                        <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_0_40px_rgba(0,0,0,0.3)] animate-fade-in transition-all" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-start justify-between border-b border-slate-100 p-5 bg-gradient-to-r from-slate-50 to-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-amber-100/50">
                                        <Trophy className="h-5 w-5 text-[#F4B400]" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">Top Performers Directory</h3>
                                        <p className="text-xs text-slate-500 font-medium">{filterContextLabel(filterContext)} · {topPerformers.length} ranked performer{topPerformers.length === 1 ? '' : 's'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAllPerformers(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition-colors" aria-label="Close">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                                <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-[#F4B400]" />
                                        <span className="text-sm font-bold text-slate-900">AI Insight</span>
                                        <InsightTagIcon tag={topPerformerInsight.tag} />
                                    </div>
                                    <p className="mt-2 text-xs font-semibold text-slate-700">{topPerformerInsight.headline}</p>
                                    <ul className="mt-2 space-y-1.5">
                                        {topPerformerInsight.bullets.map((b) => (
                                            <li key={b} className="flex items-start gap-2 text-xs text-slate-600">
                                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F4B400]" /> {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                {topPerformers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                        <Trophy className="h-6 w-6 text-slate-300" />
                                        <p className="text-xs text-slate-400">No performance records match the selected filters.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {topPerformers.map((p, i) => {
                                            const level = getPerformanceLevel(p.rating);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => { setSelected(p); setShowAllPerformers(false); }}
                                                    className="group relative flex flex-col items-center rounded-xl border border-slate-200/80 bg-white p-4 text-center shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl hover:border-[#F4B400] animate-fade-in"
                                                    style={{ animationFillMode: 'both', animationDelay: `${i * 100}ms` }}
                                                >
                                                    <span className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 group-hover:bg-[#F4B400] group-hover:text-black transition-colors shadow-sm">
                                                        #{i + 1}
                                                    </span>
                                                    <div 
                                                        className="mt-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md transition-transform duration-300 group-hover:scale-110" 
                                                        style={{ backgroundColor: p.color }}
                                                    >
                                                        {initials(p.employee)}
                                                    </div>
                                                    <div className="mt-4 w-full min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                                                            {p.employee}
                                                        </p>
                                                        <p className="truncate text-[11px] text-slate-400 mt-0.5">
                                                            {p.role}
                                                        </p>
                                                        <p className="truncate text-[11px] text-slate-500 font-semibold mt-0.5">
                                                            {p.department}
                                                        </p>
                                                        <div className="mt-3 flex flex-col items-center gap-1.5">
                                                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100/50">
                                                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {p.rating?.toFixed(1)} / 5
                                                            </span>
                                                            <LevelBadge level={level} />
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="flex flex-col gap-4">
                <PageHeader
                    title="Performance Management"
                    description="Monitor and manage employee performance evaluations"
                    actions={
                        <>
                            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                <option>All Department</option>
                                {departments.map((dept) => <option key={dept}>{dept}</option>)}
                            </select>
                            <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                {PERIOD_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                            </select>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                <option value="All">All Status</option>
                                <option value="Completed">Completed</option>
                                <option value="Pending">Pending</option>
                            </select>
                            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                {LEVEL_FILTER_OPTIONS.map((l) => <option key={l}>{l}</option>)}
                            </select>
                            {filtersActive && (
                                <button type="button" onClick={resetFilters} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                    <RotateCcw className="h-3 w-3" /> Reset
                                </button>
                            )}
                            <button type="button" onClick={openCreateForm} className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]">
                                <Plus className="h-3.5 w-3.5" /> Create Evaluation
                            </button>
                        </>
                    }
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {summaryStats.map((c) => <StatCard key={c.label} {...c} />)}
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Performance Distribution</h2>
                            <p className="text-[11px] text-slate-400">
                                {filterContextLabel(filterContext)} · {ratedFiltered.length} rated employee{ratedFiltered.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        <BarChart3 className="h-4 w-4 text-slate-300" />
                    </div>
                    <div className="mt-4">
                        <PerformanceDistributionChart data={distribution} total={ratedFiltered.length} />
                    </div>
                </div>
                {filteredEvaluations.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center">
                        <ClipboardList className="h-6 w-6 text-slate-300" />
                        <p className="text-xs font-medium text-slate-500">No performance records match the selected filters.</p>
                        <button type="button" onClick={resetFilters} className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            <RotateCcw className="h-3 w-3" /> Reset Filters
                        </button>
                    </div>
                )}
                <DataTable
                    title="All Evaluations"
                    data={filteredEvaluations}
                    rowKey={(r) => r.id}
                    filterTabs={[
                        { label: 'All', value: 'All' },
                        { label: 'Completed', value: 'Completed' },
                        { label: 'Pending', value: 'Pending' },
                    ]}
                    activeFilter={statusFilter}
                    onFilterChange={(v) => setStatusFilter(v as StatusFilter)}
                    columns={[
                        {
                            key: 'employee',
                            header: 'Employee',
                            render: (r) => (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: r.color }}>
                                        {r.employee.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">{r.employee}</p>
                                        <p className="text-[11px] text-slate-400">{r.role}</p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'dept', header: 'Department', render: (r) => <span className="text-xs">{r.department}</span> },
                        { key: 'period', header: 'Period', render: (r) => <span className="text-xs">{r.period}</span> },
                        {
                            key: 'rating',
                            header: 'Rating',
                            render: (r) => r.rating ? (
                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{r.rating}
                                </span>
                            ) : <span className="text-slate-300">—</span>,
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (r) => (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    <span className={`h-1 w-1 rounded-full ${r.status === 'Completed' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                    {r.status}
                                </span>
                            ),
                        },
                        {
                            key: 'evaluator',
                            header: 'Evaluator',
                            render: (r) => (
                                <div>
                                    <p className="text-xs text-slate-700">{r.evaluator}</p>
                                    <p className="text-[11px] text-slate-400">{r.evaluatorRole}</p>
                                </div>
                            ),
                        },
                        {
                            key: 'action',
                            header: 'Action',
                            render: (r) => (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (r.status === 'Pending') {
                                            openEditForm(r);
                                        } else {
                                            setSelected(r);
                                        }
                                    }}
                                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                                        r.status === 'Pending'
                                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {r.status === 'Pending' ? 'Evaluate' : 'View Details'}
                                </button>
                            ),
                        },
                    ]}
                    footer={
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Showing {filteredEvaluations.length} of {evaluations.length} evaluations</span>
                            {filtersActive && (
                                <button type="button" onClick={resetFilters} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                    <RotateCcw className="h-3 w-3" /> Reset Filters
                                </button>
                            )}
                        </div>
                    }
                />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <Trophy className="h-4 w-4 text-[#F4B400]" />
                                <h2 className="text-sm font-bold text-slate-900">Top Performers</h2>
                            </div>
                            <span className="text-[11px] text-slate-400">{filterContextLabel(filterContext)}</span>
                        </div>
                        <TopPerformerPortraits performers={topPerformers} onSelect={(ev) => setSelected(ev)} />
                        {topPerformers.length > 0 && (
                            <button
                                type="button"
                                onClick={handleViewAllPerformers}
                                className="mt-3.5 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-amber-600 transition"
                            >
                                View All Performers <ChevronRight className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-[#F4B400]" />
                            <h2 className="text-sm font-bold text-slate-900">AI Performance Insights</h2>
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#F4B400]/10 px-2 py-0.5 text-[10px] font-semibold text-[#b8860b]">
                                <InsightTagIcon tag={performanceInsight.tag} /> AI Insight
                            </span>
                        </div>
                        <div className="mt-3 space-y-2.5">
                            <p className="text-xs font-medium text-slate-700">{performanceInsight.headline}</p>
                            <ul className="space-y-1">
                                {performanceInsight.bullets.map((b) => (
                                    <li key={b} className="flex items-start gap-1.5 text-xs text-slate-600">
                                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#F4B400]" /> {b}
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[10px] italic text-slate-400">
                                Final decisions rest with HR
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}