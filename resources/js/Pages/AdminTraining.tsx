import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    CalendarClock,
    CalendarPlus,
    CheckCircle2,
    ClipboardList,
    Clock,
    Download,
    Eye,
    FileBarChart,
    GraduationCap,
    Layers,
    Lightbulb,
    ListChecks,
    Loader2,
    MapPin,
    Pencil,
    Plus,
    Sparkles,
    Star,
    Target,
    Trash2,
    TrendingUp,
    UserPlus,
    Users,
    XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
type ProgramStatus = 'Draft' | 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';
type TrainingType = 'Onsite' | 'Instructor-led';
type TrainingProgram = {
    id: string;
    title: string;
    description: string;
    category: string;
    trainingType: TrainingType;
    facilitator: string;
    duration: string;
    participants: number;
    nextSession: string | null;
    status: ProgramStatus;
    objectives: string[];
    targetParticipants: string;
    targetCompetencies?: string[];
    relatedLearningCourse?: string;
};
type SessionStatus = 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';
type TrainingSession = {
    id: string;
    programId: string;
    label: string;
    date: string;
    startTime: string;
    endTime: string;
    venue: string;
    facilitator: string;
    capacity: number;
    assignedCount: number;
    status: SessionStatus;
};
type ParticipantType = 'Employee' | 'Trainee';
type ParticipantStatus = 'Registered' | 'Scheduled' | 'Attended' | 'Completed' | 'Did Not Complete';
type Participant = {
    id: string;
    sessionId: string;
    name: string;
    employeeId: string;
    type: ParticipantType;
    department: string;
    position: string;
    status: ParticipantStatus;
};
type AttendanceStatus = 'Present' | 'Absent' | 'Excused';
type EvaluationResponse = {
    id: string;
    sessionId: string;
    contentRating: number;
    facilitatorRating: number;
    relevanceRating: number;
    organizationRating: number;
    overallSatisfaction: number;
};
type SessionTab = 'participants' | 'attendance' | 'evaluation' | 'completion';
type RecommendationStatus = 'Suggested' | 'Under Review' | 'Accepted' | 'Edited' | 'Rejected';
type TrainingRecommendation = {
    id: string;
    employeeName: string;
    employeeId: string;
    developmentNeed: string;
    suggestedProgramId: string;
    reason: string;
    status: RecommendationStatus;
};
const TRAINING_PROGRAMS: TrainingProgram[] = [
    {
        id: '1',
        title: 'Leadership Development Program',
        description:
            'A structured leadership program designed to strengthen supervisory and people-management capabilities for high-potential staff.',
        category: 'Management',
        trainingType: 'Instructor-led',
        facilitator: 'Emmanuel Cabanas',
        duration: '3 days',
        participants: 24,
        nextSession: 'Aug 15, 2026',
        status: 'Scheduled',
        objectives: [
            'Develop core leadership and decision-making skills',
            'Strengthen team communication and conflict resolution',
            'Prepare participants for expanded supervisory responsibilities',
        ],
        targetParticipants: 'Team Leads and Supervisors across Operations, IT, and Finance',
        targetCompetencies: ['Leadership', 'Communication', 'Teamwork'],
        relatedLearningCourse: 'Leadership Fundamentals',
    },
    {
        id: '2',
        title: 'Workplace Safety Onsite Training',
        description:
            'Mandatory onsite safety training covering hazard recognition, proper PPE use, and emergency protocols for site personnel.',
        category: 'Compliance',
        trainingType: 'Onsite',
        facilitator: 'Lisa Montero',
        duration: '1 day',
        participants: 58,
        nextSession: 'Aug 6, 2026',
        status: 'Ongoing',
        objectives: [
            'Reinforce hazard identification and reporting procedures',
            'Ensure proper use of personal protective equipment',
            'Review site-specific emergency response protocols',
        ],
        targetParticipants: 'All onsite construction personnel and site-based staff',
        targetCompetencies: ['Safety Compliance', 'Risk Awareness'],
    },
    {
        id: '3',
        title: 'Effective Communication Workshop',
        description:
            'An interactive workshop focused on improving verbal, written, and interpersonal communication across teams.',
        category: 'Soft Skills',
        trainingType: 'Instructor-led',
        facilitator: 'Ainah Sta. Maria',
        duration: '2 days',
        participants: 31,
        nextSession: 'Aug 20, 2026',
        status: 'Scheduled',
        objectives: [
            'Improve clarity in verbal and written communication',
            'Build active listening and feedback skills',
            'Reduce cross-department miscommunication',
        ],
        targetParticipants: 'Staff and trainees from Sales, Finance, and Support departments',
        targetCompetencies: ['Communication', 'Teamwork'],
        relatedLearningCourse: 'Effective Communication',
    },
    {
        id: '4',
        title: 'Advanced Equipment Handling',
        description:
            'Hands-on technical training for the safe and efficient operation of heavy construction equipment.',
        category: 'Technical',
        trainingType: 'Onsite',
        facilitator: 'Kaye Caagusan',
        duration: '5 days',
        participants: 16,
        nextSession: null,
        status: 'Completed',
        objectives: [
            'Demonstrate safe start-up and operation procedures',
            'Apply proper maintenance checks before equipment use',
            'Handle equipment-specific emergency shutdown procedures',
        ],
        targetParticipants: 'Equipment operators and field technicians',
        targetCompetencies: ['Technical Proficiency', 'Safety Compliance'],
    },
    {
        id: '5',
        title: 'Time Management Essentials',
        description:
            'A practical session on prioritization, scheduling, and workload management for daily productivity.',
        category: 'Productivity',
        trainingType: 'Instructor-led',
        facilitator: 'Mhicaela Buban',
        duration: '1 day',
        participants: 0,
        nextSession: null,
        status: 'Draft',
        objectives: [
            'Apply prioritization frameworks to daily tasks',
            'Reduce time lost to context-switching',
            'Build a personal weekly planning routine',
        ],
        targetParticipants: 'General staff (open enrollment)',
        targetCompetencies: ['Productivity'],
        relatedLearningCourse: 'Time Management',
    },
    {
        id: '6',
        title: 'Site Emergency Response Drill',
        description:
            'A simulated onsite emergency drill to test evacuation procedures and emergency response readiness.',
        category: 'Compliance',
        trainingType: 'Onsite',
        facilitator: 'Lisa Montero',
        duration: '1 day',
        participants: 12,
        nextSession: null,
        status: 'Cancelled',
        objectives: [
            'Test site evacuation timing and routes',
            'Assess emergency response team coordination',
            'Identify gaps in current emergency protocols',
        ],
        targetParticipants: 'All site personnel',
        targetCompetencies: ['Safety Compliance'],
    },
];
const SEED_SESSIONS: TrainingSession[] = [
    { id: 's1', programId: '1', label: 'Session 1', date: 'Aug 15, 2026', startTime: '9:00 AM', endTime: '4:00 PM', venue: 'Training Room A', facilitator: 'Emmanuel Cabanas', capacity: 30, assignedCount: 24, status: 'Scheduled' },
    { id: 's1b', programId: '1', label: 'Session 2', date: 'Sept 3, 2026', startTime: '9:00 AM', endTime: '4:00 PM', venue: 'Training Room B', facilitator: 'Emmanuel Cabanas', capacity: 30, assignedCount: 18, status: 'Scheduled' },
    { id: 's2', programId: '2', label: 'Session 1', date: 'Aug 6, 2026', startTime: '8:00 AM', endTime: '12:00 PM', venue: 'Site Grounds - Bay 2', facilitator: 'Lisa Montero', capacity: 60, assignedCount: 58, status: 'Ongoing' },
    { id: 's3', programId: '3', label: 'Session 1', date: 'Aug 20, 2026', startTime: '1:00 PM', endTime: '5:00 PM', venue: 'Training Room B', facilitator: 'Ainah Sta. Maria', capacity: 35, assignedCount: 31, status: 'Scheduled' },
    { id: 's4', programId: '4', label: 'Session 1', date: 'Jul 10, 2026', startTime: '8:00 AM', endTime: '5:00 PM', venue: 'Equipment Yard', facilitator: 'Kaye Caagusan', capacity: 20, assignedCount: 16, status: 'Completed' },
    { id: 's6', programId: '6', label: 'Session 1', date: 'Jul 25, 2026', startTime: '8:00 AM', endTime: '12:00 PM', venue: 'Site Grounds', facilitator: 'Lisa Montero', capacity: 15, assignedCount: 0, status: 'Cancelled' },
];
const PARTICIPANT_POOL: { name: string; employeeId: string; type: ParticipantType; department: string; position: string }[] = [
    { name: 'Juan Dela Cruz', employeeId: 'EMP-1042', type: 'Employee', department: 'Operations', position: 'Equipment Operator' },
    { name: 'Maria Santos', employeeId: 'EMP-1077', type: 'Employee', department: 'Human Resources', position: 'HR Staff' },
    { name: 'Jaylou Cruiz', employeeId: 'TRN-2091', type: 'Trainee', department: 'Information Technology', position: 'IT Trainee' },
    { name: 'Daisy Dacula', employeeId: 'TRN-2104', type: 'Trainee', department: 'Finance', position: 'Finance Trainee' },
    { name: 'Tyron Mararac', employeeId: 'TRN-2118', type: 'Trainee', department: 'Operations', position: 'Operations Trainee' },
    { name: 'Rizza Escorial', employeeId: 'TRN-2126', type: 'Trainee', department: 'Operations', position: 'Operations Trainee' },
    { name: 'Zk Magalang', employeeId: 'TRN-2133', type: 'Trainee', department: 'Operations', position: 'Operations Trainee' },
    { name: 'Vicky Melgar', employeeId: 'TRN-2145', type: 'Trainee', department: 'Sales', position: 'Sales Trainee' },
];
function findInPool(name: string) {
    return PARTICIPANT_POOL.find((p) => p.name === name)!;
}
const SEED_PARTICIPANTS: Participant[] = [
    { id: 'pt1', sessionId: 's1', ...findInPool('Juan Dela Cruz'), status: 'Scheduled' },
    { id: 'pt2', sessionId: 's1', ...findInPool('Maria Santos'), status: 'Registered' },
    { id: 'pt3', sessionId: 's1b', ...findInPool('Jaylou Cruiz'), status: 'Registered' },
    { id: 'pt4', sessionId: 's2', ...findInPool('Tyron Mararac'), status: 'Scheduled' },
    { id: 'pt5', sessionId: 's2', ...findInPool('Zk Magalang'), status: 'Scheduled' },
    { id: 'pt6', sessionId: 's3', ...findInPool('Vicky Melgar'), status: 'Registered' },
    { id: 'pt7', sessionId: 's3', ...findInPool('Daisy Dacula'), status: 'Registered' },
    { id: 'pt8', sessionId: 's4', ...findInPool('Rizza Escorial'), status: 'Completed' },
];
const SEED_ATTENDANCE: Record<string, AttendanceStatus> = {
    pt4: 'Present',
    pt5: 'Present',
    pt8: 'Present',
};
const SEED_EVALUATIONS: EvaluationResponse[] = [
    { id: 'ev1', sessionId: 's2', contentRating: 4, facilitatorRating: 5, relevanceRating: 4, organizationRating: 4, overallSatisfaction: 4 },
    { id: 'ev2', sessionId: 's2', contentRating: 3, facilitatorRating: 4, relevanceRating: 4, organizationRating: 3, overallSatisfaction: 4 },
    { id: 'ev3', sessionId: 's4', contentRating: 5, facilitatorRating: 5, relevanceRating: 5, organizationRating: 4, overallSatisfaction: 5 },
    { id: 'ev4', sessionId: 's4', contentRating: 4, facilitatorRating: 4, relevanceRating: 4, organizationRating: 4, overallSatisfaction: 4 },
    { id: 'ev5', sessionId: 's4', contentRating: 4, facilitatorRating: 5, relevanceRating: 4, organizationRating: 5, overallSatisfaction: 4 },
];
const SEED_RECOMMENDATIONS: TrainingRecommendation[] = [
    {
        id: 'rec1',
        ...(() => { const p = findInPool('Juan Dela Cruz'); return { employeeName: p.name, employeeId: p.employeeId }; })(),
        developmentNeed: 'Safety Compliance',
        suggestedProgramId: '2',
        reason: 'Recent onsite activity suggests reinforcing safety compliance awareness would be beneficial.',
        status: 'Suggested',
    },
    {
        id: 'rec2',
        ...(() => { const p = findInPool('Maria Santos'); return { employeeName: p.name, employeeId: p.employeeId }; })(),
        developmentNeed: 'Leadership',
        suggestedProgramId: '1',
        reason: 'Development planning flags supervisory growth as a near-term priority.',
        status: 'Under Review',
    },
    {
        id: 'rec3',
        ...(() => { const p = findInPool('Vicky Melgar'); return { employeeName: p.name, employeeId: p.employeeId }; })(),
        developmentNeed: 'Communication',
        suggestedProgramId: '3',
        reason: 'Cross-department coordination may benefit from stronger communication skills.',
        status: 'Suggested',
    },
];
const statusStyles: Record<ProgramStatus | SessionStatus, string> = {
    Draft: 'bg-slate-100 text-slate-500',
    Scheduled: 'bg-blue-100 text-blue-700',
    Ongoing: 'bg-amber-100 text-amber-700',
    Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-rose-100 text-rose-700',
};
const participantStatusStyles: Record<ParticipantStatus, string> = {
    Registered: 'bg-slate-100 text-slate-500',
    Scheduled: 'bg-blue-100 text-blue-700',
    Attended: 'bg-indigo-100 text-indigo-700',
    Completed: 'bg-green-100 text-green-700',
    'Did Not Complete': 'bg-rose-100 text-rose-700',
};
const attendanceStatusStyles: Record<AttendanceStatus, string> = {
    Present: 'bg-green-100 text-green-700',
    Absent: 'bg-rose-100 text-rose-700',
    Excused: 'bg-amber-100 text-amber-700',
};
const recommendationStatusStyles: Record<RecommendationStatus, string> = {
    Suggested: 'bg-slate-100 text-slate-500',
    'Under Review': 'bg-blue-100 text-blue-700',
    Accepted: 'bg-green-100 text-green-700',
    Edited: 'bg-indigo-100 text-indigo-700',
    Rejected: 'bg-rose-100 text-rose-700',
};
const PARTICIPANT_STATUS_OPTIONS: ParticipantStatus[] = ['Registered', 'Scheduled', 'Attended', 'Completed', 'Did Not Complete'];
type StatusFilter = 'All' | ProgramStatus;
type SessionFormState = {
    id: string | null;
    programId: string;
    label: string;
    date: string;
    startTime: string;
    endTime: string;
    venue: string;
    facilitator: string;
    capacity: string;
    status: SessionStatus;
};
function emptySessionForm(programId: string, nextLabel: string, defaultFacilitator: string): SessionFormState {
    return {
        id: null,
        programId,
        label: nextLabel,
        date: '',
        startTime: '',
        endTime: '',
        venue: '',
        facilitator: defaultFacilitator,
        capacity: '',
        status: 'Scheduled',
    };
}
function parseSessionDate(dateStr: string): Date | null {
    if (!dateStr || dateStr === 'TBD') return null;
    const normalized = dateStr.replace(/^Sept(\s)/, 'Sep$1');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
}
function StarRating({ value }: { value: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
            ))}
        </div>
    );
}
function StarRatingInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
            <div className="mt-1 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        className="p-0.5"
                        aria-label={`${label}: ${n} star${n > 1 ? 's' : ''}`}
                    >
                        <Star className={`h-4 w-4 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    </button>
                ))}
            </div>
        </div>
    );
}
function MetricBar({ label, value, max, displayValue, colorClass }: { label: string; value: number; max: number; displayValue?: string; colorClass?: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">{label}</span>
                <span className="font-semibold text-slate-800">{displayValue ?? value}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${colorClass ?? 'bg-[#F4B400]'}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
function InlineBar({ value, max, colorClass }: { value: number; max: number; colorClass?: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
        <div className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${colorClass ?? 'bg-[#F4B400]'}`} style={{ width: `${pct}%` }} />
        </div>
    );
}
function AiBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            <Sparkles className="h-3 w-3" /> AI-Assisted
        </span>
    );
}
function ProgramDetails({
    program,
    sessions,
    onBack,
    onAddSession,
    onEditSession,
    onOpenSession,
}: {
    program: TrainingProgram;
    sessions: TrainingSession[];
    onBack: () => void;
    onAddSession: () => void;
    onEditSession: (session: TrainingSession) => void;
    onOpenSession: (session: TrainingSession) => void;
}) {
    const learningCourseHref = route().has('admin.learning.index') ? route('admin.learning.index') : '#';
    return (
        <div className="flex flex-col gap-4">
            <button
                type="button"
                onClick={onBack}
                className="flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Training Programs
            </button>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900">{program.title}</h2>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[program.status]}`}>
                                {program.status}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            {program.category} · {program.trainingType} · {program.duration}
                        </p>
                    </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{program.description}</p>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            <ListChecks className="h-3.5 w-3.5" /> Objectives
                        </p>
                        <ul className="mt-1.5 space-y-1">
                            {program.objectives.map((o) => (
                                <li key={o} className="flex items-start gap-1.5 text-xs text-slate-700">
                                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#F4B400]" /> {o}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Facilitator</p>
                            <p className="mt-1 text-xs font-medium text-slate-800">{program.facilitator}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Target Participants</p>
                            <p className="mt-1 text-xs font-medium text-slate-800">{program.targetParticipants}</p>
                        </div>
                        {program.targetCompetencies && (
                            <div>
                                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    <Target className="h-3.5 w-3.5" /> Target Competencies
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {program.targetCompetencies.map((c) => (
                                        <span key={c} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{c}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {program.relatedLearningCourse && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Related Learning Course</p>
                                <Link
                                    href={learningCourseHref}
                                    className="mt-1 flex w-fit items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                    <GraduationCap className="h-3.5 w-3.5 text-amber-600" /> {program.relatedLearningCourse}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <DataTable
                title="Training Sessions"
                data={sessions}
                rowKey={(r) => r.id}
                headerExtra={
                    <button
                        type="button"
                        onClick={onAddSession}
                        className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-[#dba300]"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Session
                    </button>
                }
                columns={[
                    {
                        key: 'label',
                        header: 'Session',
                        render: (r) => (
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <Layers className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-xs font-semibold text-slate-800">{r.label}</span>
                            </div>
                        ),
                    },
                    { key: 'date', header: 'Date', render: (r) => <span className="text-xs">{r.date}</span> },
                    {
                        key: 'time',
                        header: 'Time',
                        render: (r) => (
                            <span className="flex items-center gap-1 text-xs text-slate-600">
                                <Clock className="h-3 w-3 text-slate-400" /> {r.startTime}–{r.endTime}
                            </span>
                        ),
                    },
                    {
                        key: 'venue',
                        header: 'Venue',
                        render: (r) => (
                            <span className="flex items-center gap-1 text-xs text-slate-600">
                                <MapPin className="h-3 w-3 text-slate-400" /> {r.venue}
                            </span>
                        ),
                    },
                    { key: 'facilitator', header: 'Facilitator', render: (r) => <span className="text-xs">{r.facilitator}</span> },
                    { key: 'capacity', header: 'Capacity', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.capacity}</span> },
                    {
                        key: 'participants',
                        header: 'Participants',
                        className: 'tabular-nums',
                        render: (r) => <span className="text-xs">{r.assignedCount}/{r.capacity}</span>,
                    },
                    {
                        key: 'status',
                        header: 'Status',
                        render: (r) => (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[r.status]}`}>
                                {r.status}
                            </span>
                        ),
                    },
                    {
                        key: 'action',
                        header: 'Action',
                        render: (r) => (
                            <div className="flex items-center gap-0.5">
                                <button type="button" onClick={() => onOpenSession(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Open session workspace">
                                    <Users className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => onEditSession(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit session">
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ),
                    },
                ]}
                footer={
                    <span className="text-xs text-slate-500">
                        {sessions.length === 0
                            ? 'No sessions scheduled yet for this training program.'
                            : `${sessions.length} session${sessions.length > 1 ? 's' : ''} for this program`}
                    </span>
                }
            />
        </div>
    );
}
type ViewState = { mode: 'list' } | { mode: 'details'; programId: string } | { mode: 'reports' };
export default function TrainingManagement() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [showAdd, setShowAdd] = useState(false);
    const [view, setView] = useState<ViewState>({ mode: 'list' });
    const [sessions, setSessions] = useState<TrainingSession[]>(SEED_SESSIONS);
    const [participants, setParticipants] = useState<Participant[]>(SEED_PARTICIPANTS);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(SEED_ATTENDANCE);
    const [evaluations, setEvaluations] = useState<EvaluationResponse[]>(SEED_EVALUATIONS);
    const [recommendations, setRecommendations] = useState<TrainingRecommendation[]>(SEED_RECOMMENDATIONS);
    const [showSessionForm, setShowSessionForm] = useState(false);
    const [sessionForm, setSessionForm] = useState<SessionFormState | null>(null);
    const [activeSession, setActiveSession] = useState<TrainingSession | null>(null);
    const [sessionTab, setSessionTab] = useState<SessionTab>('participants');
    const [newParticipantName, setNewParticipantName] = useState('');
    const [evalForm, setEvalForm] = useState({ content: 0, facilitator: 0, relevance: 0, organization: 0, overall: 0 });
    const [reportProgramFilter, setReportProgramFilter] = useState('All');
    const [reportDepartmentFilter, setReportDepartmentFilter] = useState('All');
    const [reportStatusFilter, setReportStatusFilter] = useState<StatusFilter>('All');
    const [reportDateFrom, setReportDateFrom] = useState('');
    const [reportDateTo, setReportDateTo] = useState('');
    const [exportState, setExportState] = useState<'idle' | 'preparing'>('idle');
    const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
    const [aiInsights, setAiInsights] = useState<string[] | null>(null);
    const [editingRecommendationId, setEditingRecommendationId] = useState<string | null>(null);
    const [editedProgramId, setEditedProgramId] = useState('');
    const categories = useMemo(
        () => Array.from(new Set(TRAINING_PROGRAMS.map((p) => p.category))),
        [],
    );
    const departments = useMemo(
        () => Array.from(new Set(PARTICIPANT_POOL.map((p) => p.department))),
        [],
    );
    const filteredPrograms = useMemo(() => {
        return TRAINING_PROGRAMS.filter((p) => {
            const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
            const matchesCategory = categoryFilter === 'All Categories' || p.category === categoryFilter;
            return matchesStatus && matchesCategory;
        });
    }, [statusFilter, categoryFilter]);
    const upcomingSessions = useMemo(
        () => sessions.filter((s) => s.status === 'Scheduled' || s.status === 'Ongoing'),
        [sessions],
    );
    const activeProgramsCount = useMemo(
        () => TRAINING_PROGRAMS.filter((p) => p.status === 'Scheduled' || p.status === 'Ongoing').length,
        [],
    );
    const totalParticipants = useMemo(
        () => TRAINING_PROGRAMS.reduce((sum, p) => sum + p.participants, 0),
        [],
    );
    const completionRateOverall = '82%';
    const statCards = [
        { label: 'Active Training Programs', value: activeProgramsCount, icon: ClipboardList },
        { label: 'Upcoming Sessions', value: upcomingSessions.length, icon: CalendarClock },
        { label: 'Total Participants Enrolled', value: totalParticipants, icon: Users },
        { label: 'Completion Rate', value: completionRateOverall, icon: CheckCircle2 },
    ];
    const activeProgram = view.mode === 'details' ? TRAINING_PROGRAMS.find((p) => p.id === view.programId) ?? null : null;
    const activeProgramSessions = useMemo(
        () => (activeProgram ? sessions.filter((s) => s.programId === activeProgram.id) : []),
        [activeProgram, sessions],
    );
    function openDetails(program: TrainingProgram) {
        setView({ mode: 'details', programId: program.id });
    }
    function openAddSession() {
        if (!activeProgram) return;
        const nextLabel = `Session ${activeProgramSessions.length + 1}`;
        setSessionForm(emptySessionForm(activeProgram.id, nextLabel, activeProgram.facilitator));
        setShowSessionForm(true);
    }
    function openEditSession(session: TrainingSession) {
        setSessionForm({
            id: session.id,
            programId: session.programId,
            label: session.label,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            venue: session.venue,
            facilitator: session.facilitator,
            capacity: String(session.capacity),
            status: session.status,
        });
        setShowSessionForm(true);
    }
    function closeSessionForm() {
        setShowSessionForm(false);
        setSessionForm(null);
    }
    function saveSession() {
        if (!sessionForm) return;
        const capacityNum = Number(sessionForm.capacity) || 0;
        if (sessionForm.id) {
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === sessionForm.id
                        ? {
                              ...s,
                              label: sessionForm.label || s.label,
                              date: sessionForm.date || s.date,
                              startTime: sessionForm.startTime || s.startTime,
                              endTime: sessionForm.endTime || s.endTime,
                              venue: sessionForm.venue || s.venue,
                              facilitator: sessionForm.facilitator || s.facilitator,
                              capacity: capacityNum || s.capacity,
                              status: sessionForm.status,
                          }
                        : s,
                ),
            );
        } else {
            const newSession: TrainingSession = {
                id: `s-${Date.now()}`,
                programId: sessionForm.programId,
                label: sessionForm.label,
                date: sessionForm.date || 'TBD',
                startTime: sessionForm.startTime || '—',
                endTime: sessionForm.endTime || '—',
                venue: sessionForm.venue || 'TBD',
                facilitator: sessionForm.facilitator,
                capacity: capacityNum,
                assignedCount: 0,
                status: sessionForm.status,
            };
            setSessions((prev) => [...prev, newSession]);
        }
        closeSessionForm();
    }
    function openSessionWorkspace(session: TrainingSession) {
        setActiveSession(session);
        setSessionTab('participants');
        setNewParticipantName('');
        setEvalForm({ content: 0, facilitator: 0, relevance: 0, organization: 0, overall: 0 });
    }
    function closeSessionWorkspace() {
        setActiveSession(null);
        setNewParticipantName('');
    }
    const sessionParticipants = useMemo(
        () => (activeSession ? participants.filter((p) => p.sessionId === activeSession.id) : []),
        [activeSession, participants],
    );
    const availableToAdd = useMemo(
        () => PARTICIPANT_POOL.filter((p) => !sessionParticipants.some((sp) => sp.name === p.name)),
        [sessionParticipants],
    );
    function addParticipant() {
        if (!activeSession || !newParticipantName) return;
        const pick = findInPool(newParticipantName);
        const newParticipant: Participant = {
            id: `pt-${Date.now()}`,
            sessionId: activeSession.id,
            ...pick,
            status: 'Registered',
        };
        setParticipants((prev) => [...prev, newParticipant]);
        setNewParticipantName('');
    }
    function removeParticipant(id: string) {
        setParticipants((prev) => prev.filter((p) => p.id !== id));
        setAttendance((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }
    function updateParticipantStatus(id: string, status: ParticipantStatus) {
        setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    }
    const participantsLocked = activeSession?.status === 'Completed' || activeSession?.status === 'Cancelled';
    const attendanceLocked = activeSession?.status === 'Cancelled';
    const attendanceCounts = useMemo(() => {
        let present = 0, absent = 0, excused = 0;
        sessionParticipants.forEach((p) => {
            const s = attendance[p.id];
            if (s === 'Present') present++;
            else if (s === 'Absent') absent++;
            else if (s === 'Excused') excused++;
        });
        return { total: sessionParticipants.length, present, absent, excused };
    }, [sessionParticipants, attendance]);
    const attendanceMarkedTotal = attendanceCounts.present + attendanceCounts.absent + attendanceCounts.excused;
    const attendanceRate = attendanceMarkedTotal > 0 ? `${Math.round((attendanceCounts.present / attendanceMarkedTotal) * 100)}%` : '—';
    function markAttendance(participantId: string, status: AttendanceStatus) {
        setAttendance((prev) => ({ ...prev, [participantId]: status }));
    }
    function markAllPresent() {
        setAttendance((prev) => {
            const next = { ...prev };
            sessionParticipants.forEach((p) => {
                next[p.id] = 'Present';
            });
            return next;
        });
    }
    const sessionEvaluations = useMemo(
        () => (activeSession ? evaluations.filter((e) => e.sessionId === activeSession.id) : []),
        [activeSession, evaluations],
    );
    function averageOf(list: EvaluationResponse[], key: keyof Omit<EvaluationResponse, 'id' | 'sessionId'>): number | null {
        if (list.length === 0) return null;
        const sum = list.reduce((acc, e) => acc + e[key], 0);
        return sum / list.length;
    }
    const contentAvg = averageOf(sessionEvaluations, 'contentRating');
    const facilitatorAvg = averageOf(sessionEvaluations, 'facilitatorRating');
    const relevanceAvg = averageOf(sessionEvaluations, 'relevanceRating');
    const organizationAvg = averageOf(sessionEvaluations, 'organizationRating');
    const overallAvg = averageOf(sessionEvaluations, 'overallSatisfaction');
    const compositeAvg =
        contentAvg !== null && facilitatorAvg !== null && relevanceAvg !== null && organizationAvg !== null && overallAvg !== null
            ? (contentAvg + facilitatorAvg + relevanceAvg + organizationAvg + overallAvg) / 5
            : null;
    function fmtRating(v: number | null) {
        return v === null ? '—' : `${v.toFixed(1)}/5`;
    }
    const evalFormComplete = evalForm.content > 0 && evalForm.facilitator > 0 && evalForm.relevance > 0 && evalForm.organization > 0 && evalForm.overall > 0;
    function submitEvaluation() {
        if (!activeSession || !evalFormComplete) return;
        const newResponse: EvaluationResponse = {
            id: `ev-${Date.now()}`,
            sessionId: activeSession.id,
            contentRating: evalForm.content,
            facilitatorRating: evalForm.facilitator,
            relevanceRating: evalForm.relevance,
            organizationRating: evalForm.organization,
            overallSatisfaction: evalForm.overall,
        };
        setEvaluations((prev) => [...prev, newResponse]);
        setEvalForm({ content: 0, facilitator: 0, relevance: 0, organization: 0, overall: 0 });
    }
    const completionCounts = useMemo(() => {
        const total = sessionParticipants.length;
        const completed = sessionParticipants.filter((p) => p.status === 'Completed').length;
        return { total, completed, notCompleted: total - completed };
    }, [sessionParticipants]);
    const sessionCompletionRate = completionCounts.total > 0 ? `${Math.round((completionCounts.completed / completionCounts.total) * 100)}%` : '—';
    const reportFilteredSessions = useMemo(() => {
        return sessions.filter((s) => {
            const program = TRAINING_PROGRAMS.find((p) => p.id === s.programId);
            if (!program) return false;
            if (reportProgramFilter !== 'All' && s.programId !== reportProgramFilter) return false;
            if (reportStatusFilter !== 'All' && program.status !== reportStatusFilter) return false;
            const d = parseSessionDate(s.date);
            if (reportDateFrom && d && d < new Date(reportDateFrom)) return false;
            if (reportDateTo && d && d > new Date(reportDateTo)) return false;
            return true;
        });
    }, [sessions, reportProgramFilter, reportStatusFilter, reportDateFrom, reportDateTo]);
    const reportFilteredParticipants = useMemo(() => {
        const sessionIds = new Set(reportFilteredSessions.map((s) => s.id));
        return participants.filter((p) => sessionIds.has(p.sessionId) && (reportDepartmentFilter === 'All' || p.department === reportDepartmentFilter));
    }, [participants, reportFilteredSessions, reportDepartmentFilter]);
    const reportTotalPrograms = useMemo(() => new Set(reportFilteredSessions.map((s) => s.programId)).size, [reportFilteredSessions]);
    const reportTotalSessions = reportFilteredSessions.length;
    const reportTotalParticipants = reportFilteredParticipants.length;
    const reportAttendanceCounts = useMemo(() => {
        let present = 0, absent = 0, excused = 0;
        reportFilteredParticipants.forEach((p) => {
            const s = attendance[p.id];
            if (s === 'Present') present++;
            else if (s === 'Absent') absent++;
            else if (s === 'Excused') excused++;
        });
        return { present, absent, excused, marked: present + absent + excused };
    }, [reportFilteredParticipants, attendance]);
    const reportAttendanceRateNum = reportAttendanceCounts.marked > 0 ? Math.round((reportAttendanceCounts.present / reportAttendanceCounts.marked) * 100) : null;
    const reportCompletedCount = reportFilteredParticipants.filter((p) => p.status === 'Completed').length;
    const reportCompletionRateNum = reportTotalParticipants > 0 ? Math.round((reportCompletedCount / reportTotalParticipants) * 100) : null;
    const reportEvaluations = useMemo(
        () => evaluations.filter((e) => reportFilteredSessions.some((s) => s.id === e.sessionId)),
        [evaluations, reportFilteredSessions],
    );
    const reportEvaluationAvg = useMemo(() => {
        if (reportEvaluations.length === 0) return null;
        const sum = reportEvaluations.reduce(
            (acc, e) => acc + (e.contentRating + e.facilitatorRating + e.relevanceRating + e.organizationRating + e.overallSatisfaction) / 5,
            0,
        );
        return sum / reportEvaluations.length;
    }, [reportEvaluations]);
    const departmentBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        reportFilteredParticipants.forEach((p) => map.set(p.department, (map.get(p.department) ?? 0) + 1));
        return Array.from(map.entries())
            .map(([department, count]) => ({ department, count }))
            .sort((a, b) => b.count - a.count);
    }, [reportFilteredParticipants]);
    const departmentMax = Math.max(1, ...departmentBreakdown.map((d) => d.count));
    const activityByMonth = useMemo(() => {
        const map = new Map<string, number>();
        reportFilteredSessions.forEach((s) => {
            const d = parseSessionDate(s.date);
            if (!d) return;
            const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            map.set(label, (map.get(label) ?? 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    }, [reportFilteredSessions]);
    const activityMax = Math.max(1, ...activityByMonth.map(([, count]) => count));
    function resetReportFilters() {
        setReportProgramFilter('All');
        setReportDepartmentFilter('All');
        setReportStatusFilter('All');
        setReportDateFrom('');
        setReportDateTo('');
    }
    function handleExportReport() {
        setExportState('preparing');
        setTimeout(() => setExportState('idle'), 900);
    }
    function computeAiInsights(): string[] {
        const insights: string[] = [];
        if (reportTotalParticipants === 0) {
            return ['Not enough training data is available yet for the selected filters to generate a meaningful insight.'];
        }
        if (reportAttendanceRateNum !== null && reportCompletionRateNum !== null && reportAttendanceRateNum - reportCompletionRateNum >= 15) {
            insights.push(
                `Attendance (${reportAttendanceRateNum}%) is notably higher than completion (${reportCompletionRateNum}%) for the selected filters. HR may want to review participants who attended but have not been marked as completed.`,
            );
        }
        if (reportEvaluationAvg !== null && reportEvaluationAvg >= 4 && reportCompletionRateNum !== null && reportCompletionRateNum < 70) {
            insights.push(
                `Facilitator and content feedback is strong (avg ${reportEvaluationAvg.toFixed(1)}/5), even though completion sits at ${reportCompletionRateNum}%. The gap may be administrative rather than related to training quality — worth a closer look.`,
            );
        }
        if (departmentBreakdown.length > 0) {
            const top = departmentBreakdown[0];
            insights.push(
                `${top.department} currently accounts for the largest share of participation among the selected filters. HR may confirm this reflects an intended training priority.`,
            );
        }
        if (insights.length === 0) {
            insights.push('Attendance, completion, and evaluation results are broadly aligned for the selected filters — no notable gaps stand out right now.');
        }
        return insights.slice(0, 3);
    }
    function generateAiInsights() {
        setAiInsightsLoading(true);
        setAiInsights(null);
        setTimeout(() => {
            setAiInsights(computeAiInsights());
            setAiInsightsLoading(false);
        }, 1200);
    }
    function updateRecommendationStatus(id: string, status: RecommendationStatus) {
        setRecommendations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
    function startEditRecommendation(r: TrainingRecommendation) {
        setEditingRecommendationId(r.id);
        setEditedProgramId(r.suggestedProgramId);
    }
    function cancelEditRecommendation() {
        setEditingRecommendationId(null);
        setEditedProgramId('');
    }
    function saveEditedRecommendation(id: string) {
        if (!editedProgramId) return;
        setRecommendations((prev) => prev.map((r) => (r.id === id ? { ...r, suggestedProgramId: editedProgramId, status: 'Edited' } : r)));
        cancelEditRecommendation();
    }
    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Training Management</h1>}>
            <Head title="Training Management" />
            {showAdd && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">Create Training Program</h3>
                        <p className="mt-1 text-xs text-slate-500">Enter the training program details below.</p>
                        <div className="mt-4 space-y-3">
                            <input placeholder="Training program title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                            <input placeholder="Training Facilitator" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" />
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300]">Save as Draft</button>
                        </div>
                    </div>
                </div>
            )}
            {showSessionForm && sessionForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={closeSessionForm}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">{sessionForm.id ? 'Edit Training Session' : 'Add Training Session'}</h3>
                        <p className="mt-1 text-xs text-slate-500">{sessionForm.label} — {activeProgram?.title}</p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <input
                                placeholder="Date (e.g. August 15, 2026)"
                                value={sessionForm.date}
                                onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                                className="col-span-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                            />
                            <input
                                placeholder="Start time"
                                value={sessionForm.startTime}
                                onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                            />
                            <input
                                placeholder="End time"
                                value={sessionForm.endTime}
                                onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                            />
                            <input
                                placeholder="Venue"
                                value={sessionForm.venue}
                                onChange={(e) => setSessionForm({ ...sessionForm, venue: e.target.value })}
                                className="col-span-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                            />
                            <input
                                placeholder="Facilitator"
                                value={sessionForm.facilitator}
                                onChange={(e) => setSessionForm({ ...sessionForm, facilitator: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                            />
                            <input
                                type="number"
                                min={0}
                                placeholder="Capacity"
                                value={sessionForm.capacity}
                                onChange={(e) => setSessionForm({ ...sessionForm, capacity: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                            />
                            <select
                                value={sessionForm.status}
                                onChange={(e) => setSessionForm({ ...sessionForm, status: e.target.value as SessionStatus })}
                                className="col-span-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                            >
                                {(['Scheduled', 'Ongoing', 'Completed', 'Cancelled'] as SessionStatus[]).map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button onClick={closeSessionForm} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={saveSession} className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300]">Save Session</button>
                        </div>
                    </div>
                </div>
            )}
            {activeSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={closeSessionWorkspace}>
                    <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">{activeSession.label}</h3>
                                <p className="mt-0.5 text-xs text-slate-500">{activeProgram?.title}</p>
                            </div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[activeSession.status]}`}>
                                {activeSession.status}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /> {activeSession.date}, {activeSession.startTime}–{activeSession.endTime}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" /> {activeSession.venue}</span>
                            <span>Facilitator: <span className="font-semibold text-slate-800">{activeSession.facilitator}</span></span>
                            <span>Capacity: <span className="font-semibold text-slate-800">{activeSession.assignedCount}/{activeSession.capacity}</span></span>
                        </div>
                        <div className="mt-4 flex w-fit rounded-lg border border-slate-200 p-0.5">
                            {(
                                [
                                    { value: 'participants', label: 'Participants' },
                                    { value: 'attendance', label: 'Attendance' },
                                    { value: 'evaluation', label: 'Evaluation' },
                                    { value: 'completion', label: 'Completion' },
                                ] as { value: SessionTab; label: string }[]
                            ).map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => setSessionTab(tab.value)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                        sessionTab === tab.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {sessionTab === 'participants' && (
                            <div className="mt-4">
                                {!participantsLocked && (
                                    <div className="mb-3 flex items-center gap-2">
                                        <select
                                            value={newParticipantName}
                                            onChange={(e) => setNewParticipantName(e.target.value)}
                                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#F4B400] focus:outline-none"
                                        >
                                            <option value="">Select a participant to add…</option>
                                            {availableToAdd.map((p) => (
                                                <option key={p.name} value={p.name}>{p.name} — {p.position}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={addParticipant}
                                            disabled={!newParticipantName}
                                            className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <UserPlus className="h-3.5 w-3.5" /> Add
                                        </button>
                                    </div>
                                )}
                                {participantsLocked && (
                                    <p className="mb-3 text-[11px] italic text-slate-400">
                                        This session is {activeSession.status.toLowerCase()} — participant assignment is locked.
                                    </p>
                                )}
                                <DataTable
                                    title="Assigned Participants"
                                    data={sessionParticipants}
                                    rowKey={(r) => r.id}
                                    columns={[
                                        {
                                            key: 'name',
                                            header: 'Name',
                                            render: (r) => (
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-800">{r.name}</p>
                                                    <p className="text-[11px] text-slate-400">{r.employeeId}</p>
                                                </div>
                                            ),
                                        },
                                        { key: 'type', header: 'Type', render: (r) => <span className="text-xs">{r.type}</span> },
                                        { key: 'department', header: 'Department', render: (r) => <span className="text-xs">{r.department}</span> },
                                        { key: 'position', header: 'Position', render: (r) => <span className="text-xs">{r.position}</span> },
                                        {
                                            key: 'status',
                                            header: 'Training Status',
                                            render: (r) =>
                                                participantsLocked ? (
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${participantStatusStyles[r.status]}`}>
                                                        {r.status}
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={r.status}
                                                        onChange={(e) => updateParticipantStatus(r.id, e.target.value as ParticipantStatus)}
                                                        className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold focus:outline-none ${participantStatusStyles[r.status]}`}
                                                    >
                                                        {PARTICIPANT_STATUS_OPTIONS.map((s) => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                ),
                                        },
                                        {
                                            key: 'action',
                                            header: 'Action',
                                            render: (r) => (
                                                <button
                                                    type="button"
                                                    onClick={() => removeParticipant(r.id)}
                                                    disabled={participantsLocked}
                                                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                                                    aria-label="Remove participant"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            ),
                                        },
                                    ]}
                                    footer={
                                        <span className="text-xs text-slate-500">
                                            Showing {sessionParticipants.length} of {activeSession.assignedCount} assigned participants
                                        </span>
                                    }
                                />
                            </div>
                        )}
                        {sessionTab === 'attendance' && (
                            <div className="mt-4 flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                    <StatCard label="Total Participants" value={attendanceCounts.total} icon={Users} />
                                    <StatCard label="Present" value={attendanceCounts.present} icon={CheckCircle2} />
                                    <StatCard label="Absent" value={attendanceCounts.absent} icon={XCircle} />
                                    <StatCard label="Excused" value={attendanceCounts.excused} icon={Clock} />
                                    <StatCard label="Attendance Rate" value={attendanceRate} icon={ClipboardList} />
                                </div>
                                {attendanceLocked ? (
                                    <p className="text-[11px] italic text-slate-400">This session was cancelled — attendance is not applicable.</p>
                                ) : (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={markAllPresent}
                                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark All Present
                                        </button>
                                    </div>
                                )}
                                <DataTable
                                    title="Attendance"
                                    data={sessionParticipants}
                                    rowKey={(r) => r.id}
                                    columns={[
                                        {
                                            key: 'name',
                                            header: 'Participant',
                                            render: (r) => (
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-800">{r.name}</p>
                                                    <p className="text-[11px] text-slate-400">{r.employeeId}</p>
                                                </div>
                                            ),
                                        },
                                        { key: 'type', header: 'Role/Type', render: (r) => <span className="text-xs">{r.type}</span> },
                                        { key: 'department', header: 'Department', render: (r) => <span className="text-xs">{r.department}</span> },
                                        {
                                            key: 'attendanceStatus',
                                            header: 'Attendance Status',
                                            render: (r) => {
                                                const current = attendance[r.id];
                                                return (
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${current ? attendanceStatusStyles[current] : 'bg-slate-100 text-slate-400'}`}>
                                                        {current ?? 'Not Marked'}
                                                    </span>
                                                );
                                            },
                                        },
                                        {
                                            key: 'attendanceAction',
                                            header: 'Attendance Action',
                                            render: (r) => {
                                                const current = attendance[r.id];
                                                const btn = (status: AttendanceStatus, activeClass: string) => (
                                                    <button
                                                        type="button"
                                                        disabled={attendanceLocked}
                                                        onClick={() => markAttendance(r.id, status)}
                                                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                                            current === status ? activeClass : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        {status}
                                                    </button>
                                                );
                                                return (
                                                    <div className="flex items-center gap-1">
                                                        {btn('Present', 'bg-green-600 text-white')}
                                                        {btn('Absent', 'bg-rose-600 text-white')}
                                                        {btn('Excused', 'bg-amber-500 text-white')}
                                                    </div>
                                                );
                                            },
                                        },
                                    ]}
                                    footer={<span className="text-xs text-slate-500">Attendance reflects this scheduled training session only</span>}
                                />
                            </div>
                        )}
                        {sessionTab === 'evaluation' && (
                            <div className="mt-4 flex flex-col gap-3">
                                {activeSession.status === 'Cancelled' ? (
                                    <p className="text-[11px] italic text-slate-400">This session was cancelled — no evaluation applies.</p>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                            <StatCard label="Average Evaluation Score" value={fmtRating(compositeAvg)} icon={Star} />
                                            <StatCard label="Content Rating" value={fmtRating(contentAvg)} icon={Star} />
                                            <StatCard label="Facilitator Rating" value={fmtRating(facilitatorAvg)} icon={Star} />
                                            <StatCard label="Relevance Rating" value={fmtRating(relevanceAvg)} icon={Star} />
                                            <StatCard label="Organization Rating" value={fmtRating(organizationAvg)} icon={Star} />
                                            <StatCard label="Overall Satisfaction" value={fmtRating(overallAvg)} icon={Star} />
                                        </div>
                                        <DataTable
                                            title="Evaluation Responses"
                                            data={sessionEvaluations}
                                            rowKey={(r) => r.id}
                                            columns={[
                                                {
                                                    key: 'label',
                                                    header: 'Response',
                                                    render: (r) => <span className="text-xs font-semibold text-slate-700">Response #{sessionEvaluations.findIndex((e) => e.id === r.id) + 1}</span>,
                                                },
                                                { key: 'content', header: 'Content', render: (r) => <StarRating value={r.contentRating} /> },
                                                { key: 'facilitator', header: 'Facilitator', render: (r) => <StarRating value={r.facilitatorRating} /> },
                                                { key: 'relevance', header: 'Relevance', render: (r) => <StarRating value={r.relevanceRating} /> },
                                                { key: 'organization', header: 'Organization', render: (r) => <StarRating value={r.organizationRating} /> },
                                                { key: 'overall', header: 'Overall', render: (r) => <StarRating value={r.overallSatisfaction} /> },
                                            ]}
                                            footer={<span className="text-xs text-slate-500">{sessionEvaluations.length} evaluation response{sessionEvaluations.length === 1 ? '' : 's'} on file</span>}
                                        />
                                        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                                            <p className="text-xs font-bold text-slate-900">Log an Evaluation Response</p>
                                            <p className="mt-0.5 text-[11px] text-slate-400">Rates the training session and facilitator.</p>
                                            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                                                <StarRatingInput label="Training Content" value={evalForm.content} onChange={(v) => setEvalForm({ ...evalForm, content: v })} />
                                                <StarRatingInput label="Facilitator Effectiveness" value={evalForm.facilitator} onChange={(v) => setEvalForm({ ...evalForm, facilitator: v })} />
                                                <StarRatingInput label="Relevance" value={evalForm.relevance} onChange={(v) => setEvalForm({ ...evalForm, relevance: v })} />
                                                <StarRatingInput label="Organization" value={evalForm.organization} onChange={(v) => setEvalForm({ ...evalForm, organization: v })} />
                                                <StarRatingInput label="Overall Satisfaction" value={evalForm.overall} onChange={(v) => setEvalForm({ ...evalForm, overall: v })} />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={submitEvaluation}
                                                disabled={!evalFormComplete}
                                                className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Plus className="h-3.5 w-3.5" /> Log Response
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {sessionTab === 'completion' && (
                            <div className="mt-4 flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <StatCard label="Total Participants" value={completionCounts.total} icon={Users} />
                                    <StatCard label="Completed" value={completionCounts.completed} icon={CheckCircle2} />
                                    <StatCard label="In Progress / Not Completed" value={completionCounts.notCompleted} icon={ClipboardList} />
                                    <StatCard label="Completion Rate" value={sessionCompletionRate} icon={Target} />
                                </div>
                                <p className="text-[11px] italic text-slate-400">
                                    Attendance is shown for context — completion status is set independently.
                                </p>
                                <DataTable
                                    title="Participant Completion"
                                    data={sessionParticipants}
                                    rowKey={(r) => r.id}
                                    columns={[
                                        {
                                            key: 'name',
                                            header: 'Participant',
                                            render: (r) => (
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-800">{r.name}</p>
                                                    <p className="text-[11px] text-slate-400">{r.employeeId}</p>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'attendance',
                                            header: 'Attendance',
                                            render: (r) => {
                                                const current = attendance[r.id];
                                                return (
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${current ? attendanceStatusStyles[current] : 'bg-slate-100 text-slate-400'}`}>
                                                        {current ?? 'Not Marked'}
                                                    </span>
                                                );
                                            },
                                        },
                                        {
                                            key: 'status',
                                            header: 'Training Status',
                                            render: (r) => (
                                                <select
                                                    value={r.status}
                                                    onChange={(e) => updateParticipantStatus(r.id, e.target.value as ParticipantStatus)}
                                                    className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold focus:outline-none ${participantStatusStyles[r.status]}`}
                                                >
                                                    {PARTICIPANT_STATUS_OPTIONS.map((s) => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            ),
                                        },
                                    ]}
                                    footer={<span className="text-xs text-slate-500">Completion does not, by itself, confirm competency achievement</span>}
                                />
                            </div>
                        )}
                        <button onClick={closeSessionWorkspace} className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-4">
                {view.mode === 'list' && (
                    <PageHeader
                        title="Training Management"
                        description="Manage instructor-led and onsite training programs, sessions, and schedules"
                        actions={
                            <>
                                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                    <option>All Categories</option>
                                    {categories.map((c) => <option key={c}>{c}</option>)}
                                </select>
                                <button type="button" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]">
                                    <Plus className="h-3.5 w-3.5" /> Create Training Program
                                </button>
                            </>
                        }
                    />
                )}
                {view.mode === 'details' && (
                    <PageHeader
                        title="Training Program Details"
                        description={activeProgram?.title}
                    />
                )}
                {view.mode === 'reports' && (
                    <PageHeader
                        title="Training Reports & Analytics"
                        description="AI-assisted insights and recommendations always require HR/Admin review before any action is taken"
                    />
                )}
                {view.mode === 'list' && (
                    <>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {statCards.map((c) => <StatCard key={c.label} {...c} />)}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <button
                                type="button"
                                onClick={() => setShowAdd(true)}
                                className="flex items-center gap-2 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:ring-[#F4B400]/50"
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <Plus className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-800">Create Program</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (filteredPrograms[0]) {
                                        openDetails(filteredPrograms[0]);
                                        setTimeout(() => openAddSession(), 0);
                                    }
                                }}
                                title="Opens the first program's details to schedule a session"
                                className="flex items-center gap-2 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:ring-[#F4B400]/50"
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <CalendarPlus className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-800">Schedule Session</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const firstSession = sessions[0];
                                    if (!firstSession) return;
                                    const program = TRAINING_PROGRAMS.find((p) => p.id === firstSession.programId);
                                    if (!program) return;
                                    openDetails(program);
                                    setTimeout(() => openSessionWorkspace(firstSession), 0);
                                }}
                                title="Opens an existing session to manage its participants"
                                className="flex items-center gap-2 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:ring-[#F4B400]/50"
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <UserPlus className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-800">Manage Participants</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setView({ mode: 'reports' })}
                                className="flex items-center gap-2 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition hover:ring-[#F4B400]/50"
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <FileBarChart className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-800">Training Report</span>
                            </button>
                        </div>
                        <DataTable
                            title="Training Programs"
                            data={filteredPrograms}
                            rowKey={(r) => r.id}
                            filterTabs={[
                                { label: 'All', value: 'All' },
                                { label: 'Scheduled', value: 'Scheduled' },
                                { label: 'Ongoing', value: 'Ongoing' },
                                { label: 'Completed', value: 'Completed' },
                            ]}
                            activeFilter={statusFilter}
                            onFilterChange={(v) => setStatusFilter(v as StatusFilter)}
                            columns={[
                                {
                                    key: 'title',
                                    header: 'Training Program',
                                    render: (r) => (
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                                <ClipboardList className="h-3.5 w-3.5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-800">{r.title}</p>
                                                <p className="text-[11px] text-slate-400">{r.category}</p>
                                            </div>
                                        </div>
                                    ),
                                },
                                { key: 'facilitator', header: 'Facilitator', render: (r) => <span className="text-xs">{r.facilitator}</span> },
                                { key: 'duration', header: 'Duration', render: (r) => <span className="text-xs">{r.duration}</span> },
                                { key: 'participants', header: 'Participants', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.participants}</span> },
                                { key: 'nextSession', header: 'Next Session', render: (r) => <span className="text-xs">{r.nextSession ?? '—'}</span> },
                                {
                                    key: 'status',
                                    header: 'Status',
                                    render: (r) => (
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[r.status]}`}>
                                            {r.status}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'action',
                                    header: 'Action',
                                    render: (r) => (
                                        <div className="flex items-center gap-0.5">
                                            <button type="button" onClick={() => openDetails(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View"><Eye className="h-3.5 w-3.5" /></button>
                                            <button type="button" onClick={() => openDetails(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                                        </div>
                                    ),
                                },
                            ]}
                            footer={
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Showing {filteredPrograms.length} of {TRAINING_PROGRAMS.length} training programs</span>
                                </div>
                            }
                        />
                        <DataTable
                            title="Upcoming Training Sessions"
                            data={upcomingSessions}
                            rowKey={(r) => r.id}
                            columns={[
                                {
                                    key: 'programTitle',
                                    header: 'Training',
                                    render: (r) => (
                                        <span className="text-xs font-semibold text-slate-800">
                                            {TRAINING_PROGRAMS.find((p) => p.id === r.programId)?.title ?? '—'}
                                        </span>
                                    ),
                                },
                                { key: 'date', header: 'Date', render: (r) => <span className="text-xs">{r.date}</span> },
                                {
                                    key: 'time',
                                    header: 'Time',
                                    render: (r) => (
                                        <span className="flex items-center gap-1 text-xs text-slate-600">
                                            <Clock className="h-3 w-3 text-slate-400" /> {r.startTime}–{r.endTime}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'venue',
                                    header: 'Venue',
                                    render: (r) => (
                                        <span className="flex items-center gap-1 text-xs text-slate-600">
                                            <MapPin className="h-3 w-3 text-slate-400" /> {r.venue}
                                        </span>
                                    ),
                                },
                                { key: 'facilitator', header: 'Facilitator', render: (r) => <span className="text-xs">{r.facilitator}</span> },
                                {
                                    key: 'participants',
                                    header: 'Participants',
                                    className: 'tabular-nums',
                                    render: (r) => <span className="text-xs">{r.assignedCount}/{r.capacity}</span>,
                                },
                                {
                                    key: 'status',
                                    header: 'Status',
                                    render: (r) => (
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[r.status]}`}>
                                            {r.status}
                                        </span>
                                    ),
                                },
                            ]}
                            footer={
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Showing {upcomingSessions.length} upcoming sessions</span>
                                </div>
                            }
                        />
                    </>
                )}
                {view.mode === 'details' && activeProgram && (
                    <ProgramDetails
                        program={activeProgram}
                        sessions={activeProgramSessions}
                        onBack={() => setView({ mode: 'list' })}
                        onAddSession={openAddSession}
                        onEditSession={openEditSession}
                        onOpenSession={openSessionWorkspace}
                    />
                )}
                {view.mode === 'reports' && (
                    <div className="flex flex-col gap-4">
                        <button
                            type="button"
                            onClick={() => setView({ mode: 'list' })}
                            className="flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to Training Management
                        </button>
                        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500">Training Program</label>
                                <select value={reportProgramFilter} onChange={(e) => setReportProgramFilter(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#F4B400] focus:outline-none">
                                    <option value="All">All Programs</option>
                                    {TRAINING_PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500">Department</label>
                                <select value={reportDepartmentFilter} onChange={(e) => setReportDepartmentFilter(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#F4B400] focus:outline-none">
                                    <option value="All">All Departments</option>
                                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500">Training Status</label>
                                <select value={reportStatusFilter} onChange={(e) => setReportStatusFilter(e.target.value as StatusFilter)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#F4B400] focus:outline-none">
                                    <option value="All">All Statuses</option>
                                    {(['Draft', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled'] as ProgramStatus[]).map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500">From</label>
                                <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#F4B400] focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-slate-500">To</label>
                                <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#F4B400] focus:outline-none" />
                            </div>
                            <button type="button" onClick={resetReportFilters} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                Reset Filters
                            </button>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleExportReport}
                                    disabled={exportState === 'preparing'}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {exportState === 'preparing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    {exportState === 'preparing' ? 'Preparing…' : 'Export Report'}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <StatCard label="Training Programs" value={reportTotalPrograms} icon={ClipboardList} />
                            <StatCard label="Training Sessions" value={reportTotalSessions} icon={Layers} />
                            <StatCard label="Total Participants" value={reportTotalParticipants} icon={Users} />
                            <StatCard label="Completion Rate" value={reportCompletionRateNum !== null ? `${reportCompletionRateNum}%` : '—'} icon={CheckCircle2} />
                        </div>
                        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                            <p className="text-sm font-bold text-slate-900">Overall Performance</p>
                            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
                                <MetricBar
                                    label="Attendance Rate"
                                    value={reportAttendanceRateNum ?? 0}
                                    max={100}
                                    displayValue={reportAttendanceRateNum !== null ? `${reportAttendanceRateNum}%` : '—'}
                                    colorClass="bg-blue-500"
                                />
                                <MetricBar
                                    label="Completion Rate"
                                    value={reportCompletionRateNum ?? 0}
                                    max={100}
                                    displayValue={reportCompletionRateNum !== null ? `${reportCompletionRateNum}%` : '—'}
                                    colorClass="bg-green-500"
                                />
                                <div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-slate-600">Evaluation Score</span>
                                        <span className="font-semibold text-slate-800">{reportEvaluationAvg !== null ? `${reportEvaluationAvg.toFixed(1)}/5` : '—'}</span>
                                    </div>
                                    <div className="mt-1.5">{reportEvaluationAvg !== null ? <StarRating value={reportEvaluationAvg} /> : <span className="text-xs text-slate-300">—</span>}</div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <DataTable
                                title="Participation by Department"
                                data={departmentBreakdown}
                                rowKey={(r) => r.department}
                                columns={[
                                    {
                                        key: 'department',
                                        header: 'Department',
                                        render: (r) => (
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                                <Building2 className="h-3.5 w-3.5 text-slate-400" /> {r.department}
                                            </span>
                                        ),
                                    },
                                    { key: 'count', header: 'Participants', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.count}</span> },
                                    {
                                        key: 'share',
                                        header: 'Share',
                                        render: (r) => (
                                            <div className="flex items-center gap-2">
                                                <InlineBar value={r.count} max={departmentMax} colorClass="bg-blue-500" />
                                                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-500">
                                                    {reportTotalParticipants > 0 ? `${Math.round((r.count / reportTotalParticipants) * 100)}%` : '—'}
                                                </span>
                                            </div>
                                        ),
                                    },
                                ]}
                            />
                            <DataTable
                                title="Training Activity Over Time"
                                data={activityByMonth.map(([month, count]) => ({ month, count }))}
                                rowKey={(r) => r.month}
                                columns={[
                                    {
                                        key: 'month',
                                        header: 'Month',
                                        render: (r) => (
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                                <TrendingUp className="h-3.5 w-3.5 text-slate-400" /> {r.month}
                                            </span>
                                        ),
                                    },
                                    { key: 'count', header: 'Sessions', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.count}</span> },
                                    {
                                        key: 'activity',
                                        header: 'Activity',
                                        render: (r) => <InlineBar value={r.count} max={activityMax} colorClass="bg-indigo-500" />,
                                    },
                                ]}
                            />
                        </div>
                        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-amber-600" />
                                    <p className="text-sm font-bold text-slate-900">Groq AI Training Insights</p>
                                    <AiBadge />
                                </div>
                                <button
                                    type="button"
                                    onClick={generateAiInsights}
                                    disabled={aiInsightsLoading}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {aiInsightsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    {aiInsightsLoading ? 'Analyzing…' : 'Generate AI Insights'}
                                </button>
                            </div>
                            {aiInsightsLoading && (
                                <p className="mt-3 text-xs text-slate-400">Analyzing attendance, completion, and evaluation data for the selected filters…</p>
                            )}
                            {!aiInsightsLoading && aiInsights && (
                                <div className="mt-3 flex flex-col gap-2">
                                    {aiInsights.map((text, i) => (
                                        <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50/60 p-3">
                                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                            <p className="text-xs text-slate-700">{text}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!aiInsightsLoading && !aiInsights && (
                                <p className="mt-3 text-xs text-slate-400">Generate insights for the currently filtered training data.</p>
                            )}
                        </div>
                        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-amber-600" />
                                <p className="text-sm font-bold text-slate-900">Groq AI Training Recommendations</p>
                                <AiBadge />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400">AI Analysis → HR/Admin Review → Accept, Edit, or Reject → Human Decision</p>
                            <div className="mt-3 flex flex-col gap-3">
                                {recommendations.map((r) => {
                                    const suggestedProgram = TRAINING_PROGRAMS.find((p) => p.id === r.suggestedProgramId);
                                    const isEditing = editingRecommendationId === r.id;
                                    const actionable = r.status === 'Suggested' || r.status === 'Under Review';
                                    return (
                                        <div key={r.id} className="rounded-lg border border-slate-100 p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <AiBadge />
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${recommendationStatusStyles[r.status]}`}>
                                                    {r.status}
                                                </span>
                                            </div>
                                            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <div>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Employee</p>
                                                    <p className="text-xs font-medium text-slate-800">{r.employeeName} <span className="text-slate-400">({r.employeeId})</span></p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Development Need</p>
                                                    <span className="mt-0.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{r.developmentNeed}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Suggested Training</p>
                                                {isEditing ? (
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        <select value={editedProgramId} onChange={(e) => setEditedProgramId(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-[#F4B400] focus:outline-none">
                                                            {TRAINING_PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                                                        </select>
                                                        <button type="button" onClick={() => saveEditedRecommendation(r.id)} className="rounded-lg bg-[#F4B400] px-2.5 py-1 text-xs font-semibold text-black hover:bg-[#dba300]">Save</button>
                                                        <button type="button" onClick={cancelEditRecommendation} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <p className="mt-1 text-xs font-semibold text-slate-800">{suggestedProgram?.title ?? '—'}</p>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs italic text-slate-500">"{r.reason}"</p>
                                            {actionable && !isEditing && (
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <button type="button" onClick={() => updateRecommendationStatus(r.id, 'Accepted')} className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700">
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                                                    </button>
                                                    <button type="button" onClick={() => startEditRecommendation(r)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                                    </button>
                                                    <button type="button" onClick={() => updateRecommendationStatus(r.id, 'Rejected')} className="flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                                                        <XCircle className="h-3.5 w-3.5" /> Reject
                                                    </button>
                                                </div>
                                            )}
                                            {r.status === 'Accepted' && (
                                                <p className="mt-2 text-[11px] italic text-slate-400">Assign or schedule this training from the program's session workspace.</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}