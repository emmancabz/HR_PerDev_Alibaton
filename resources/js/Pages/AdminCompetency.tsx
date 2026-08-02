import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    AlertTriangle,
    Award,
    CheckCircle2,
    ClipboardList,
    Eye,
    Layers,
    PieChart,
    Plus,
    Sparkles,
    Target,
    TrendingDown,
    Users,
    X
} from 'lucide-react';
import { useMemo, useState } from 'react';
type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
type CompetencyCategory =
    | 'Technical Skills'
    | 'Behavioral Skills'
    | 'Leadership'
    | 'Safety & Compliance'
    | 'Analytical Skills';
type DefinitionStatus = 'Active' | 'Draft';
type CompetencyDefinition = {
    id: string;
    name: string;
    category: CompetencyCategory;
    description: string;
    requiredLevel: Level;
    status: DefinitionStatus;
};
type AssessmentStatus = 'Achieved' | 'Needs Improvement' | 'Not Assessed';
type EmployeeAssessment = {
    id: string;
    employeeId: string;
    employeeName: string;
    position: string;
    department: string;
    competency: string;
    category: CompetencyCategory;
    currentLevel: Level | null;
    requiredLevel: Level;
    status: AssessmentStatus;
    score: number | null;
    evaluator: string;
    lastAssessed: string | null;
    comments: string;
};
const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const LEVEL_RANK: Record<Level, number> = { Beginner: 1, Intermediate: 2, Advanced: 3, Expert: 4 };
const CATEGORIES: CompetencyCategory[] = [
    'Technical Skills',
    'Behavioral Skills',
    'Leadership',
    'Safety & Compliance',
    'Analytical Skills',
];
const categoryDistribution: { category: CompetencyCategory; count: number; color: string }[] = [
    { category: 'Technical Skills', count: 8, color: '#F4B400' },
    { category: 'Behavioral Skills', count: 7, color: '#3B82F6' },
    { category: 'Leadership', count: 4, color: '#8B5CF6' },
    { category: 'Safety & Compliance', count: 5, color: '#EF4444' },
];
const TOTAL_COMPETENCIES = categoryDistribution.reduce((s, c) => s + c.count, 0); 
const levelDistribution: { level: Level; count: number }[] = [
    { level: 'Beginner', count: 18 },
    { level: 'Intermediate', count: 42 },
    { level: 'Advanced', count: 38 },
    { level: 'Expert', count: 14 },
];
const TOTAL_ASSESSED_RECORDS = levelDistribution.reduce((s, l) => s + l.count, 0); 
const summary = {
    totalCompetencies: TOTAL_COMPETENCIES,
    employeesAssessed: TOTAL_ASSESSED_RECORDS,
    achieved: 86,
    needsImprovement: 26,
};
const initialDefinitions: CompetencyDefinition[] = [
    { id: 'c1', name: 'Communication', category: 'Behavioral Skills', description: 'Ability to clearly convey information and actively listen in professional settings.', requiredLevel: 'Advanced', status: 'Active' },
    { id: 'c2', name: 'Teamwork', category: 'Behavioral Skills', description: 'Ability to collaborate effectively and contribute to shared team goals.', requiredLevel: 'Intermediate', status: 'Active' },
    { id: 'c3', name: 'Leadership', category: 'Leadership', description: 'Ability to guide, coordinate, and support team members toward organizational objectives.', requiredLevel: 'Advanced', status: 'Active' },
    { id: 'c4', name: 'Technical Skills', category: 'Technical Skills', description: 'Proficiency in the tools, systems, and technical processes required for the role.', requiredLevel: 'Intermediate', status: 'Active' },
    { id: 'c5', name: 'Problem Solving', category: 'Analytical Skills', description: 'Ability to identify issues, evaluate options, and apply sound solutions.', requiredLevel: 'Intermediate', status: 'Active' },
    { id: 'c6', name: 'Safety & Compliance', category: 'Safety & Compliance', description: 'Adherence to workplace safety standards and regulatory requirements.', requiredLevel: 'Intermediate', status: 'Active' },
    { id: 'c7', name: 'Data Analysis', category: 'Analytical Skills', description: 'Ability to interpret data and translate findings into actionable recommendations.', requiredLevel: 'Advanced', status: 'Draft' },
    { id: 'c8', name: 'Equipment Handling', category: 'Technical Skills', description: 'Safe and effective operation of assigned tools and machinery.', requiredLevel: 'Advanced', status: 'Active' },
];
const initialAssessments: EmployeeAssessment[] = [
    { id: 'a1', employeeId: 'e1', employeeName: 'Vicky Melgar', position: 'Sales Trainee', department: 'Sales', competency: 'Communication', category: 'Behavioral Skills', currentLevel: 'Intermediate', requiredLevel: 'Advanced', status: 'Needs Improvement', score: 3, evaluator: 'HR Admin', lastAssessed: 'July 25, 2026', comments: 'Shows steady improvement in client-facing conversations; needs more confidence in objection handling.' },
    { id: 'a2', employeeId: 'e1', employeeName: 'Vicky Melgar', position: 'Sales Trainee', department: 'Sales', competency: 'Leadership', category: 'Leadership', currentLevel: 'Advanced', requiredLevel: 'Advanced', status: 'Achieved', score: 5, evaluator: 'HR Admin', lastAssessed: 'July 20, 2026', comments: 'Consistently takes initiative during team huddles.' },
    { id: 'a3', employeeId: 'e1', employeeName: 'Vicky Melgar', position: 'Sales Trainee', department: 'Sales', competency: 'Technical Skills', category: 'Technical Skills', currentLevel: 'Intermediate', requiredLevel: 'Intermediate', status: 'Achieved', score: 4, evaluator: 'HR Admin', lastAssessed: 'July 20, 2026', comments: 'Comfortable with the CRM and quoting tools.' },
    { id: 'a4', employeeId: 'e1', employeeName: 'Vicky Melgar', position: 'Sales Trainee', department: 'Sales', competency: 'Safety & Compliance', category: 'Safety & Compliance', currentLevel: 'Beginner', requiredLevel: 'Intermediate', status: 'Needs Improvement', score: 2, evaluator: 'HR Admin', lastAssessed: 'July 18, 2026', comments: 'Needs to complete the site safety orientation module.' },
    { id: 'a5', employeeId: 'e2', employeeName: 'Vincent Sasi', position: 'Equipment Operator', department: 'Operations', competency: 'Safety & Compliance', category: 'Safety & Compliance', currentLevel: 'Advanced', requiredLevel: 'Advanced', status: 'Achieved', score: 5, evaluator: 'HR Admin', lastAssessed: 'July 28, 2026', comments: 'Exemplary adherence to site safety protocols.' },
    { id: 'a6', employeeId: 'e2', employeeName: 'Vincent Sasi', position: 'Equipment Operator', department: 'Operations', competency: 'Technical Skills', category: 'Technical Skills', currentLevel: 'Intermediate', requiredLevel: 'Advanced', status: 'Needs Improvement', score: 3, evaluator: 'HR Admin', lastAssessed: 'July 28, 2026', comments: 'Needs further training on the new equipment calibration process.' },
    { id: 'a7', employeeId: 'e3', employeeName: 'Sabrina Carpenter', position: 'HR Officer', department: 'Human Resources', competency: 'Communication', category: 'Behavioral Skills', currentLevel: 'Advanced', requiredLevel: 'Advanced', status: 'Achieved', score: 5, evaluator: 'HR Manager', lastAssessed: 'July 22, 2026', comments: 'Strong facilitation skills during onboarding sessions.' },
    { id: 'a8', employeeId: 'e3', employeeName: 'Sabrina Carpenter', position: 'HR Officer', department: 'Human Resources', competency: 'Leadership', category: 'Leadership', currentLevel: 'Intermediate', requiredLevel: 'Advanced', status: 'Needs Improvement', score: 3, evaluator: 'HR Manager', lastAssessed: 'July 22, 2026', comments: 'Ready for a stretch assignment leading a small project.' },
    { id: 'a9', employeeId: 'e4', employeeName: 'Kitchie Nadal', position: 'Software Engineer', department: 'IT', competency: 'Technical Skills', category: 'Technical Skills', currentLevel: 'Expert', requiredLevel: 'Advanced', status: 'Achieved', score: 5, evaluator: 'Engineering Lead', lastAssessed: 'July 27, 2026', comments: 'Regularly mentors junior developers.' },
    { id: 'a10', employeeId: 'e4', employeeName: 'Kitchie Nadal', position: 'Software Engineer', department: 'IT', competency: 'Problem Solving', category: 'Analytical Skills', currentLevel: 'Advanced', requiredLevel: 'Intermediate', status: 'Achieved', score: 5, evaluator: 'Engineering Lead', lastAssessed: 'July 27, 2026', comments: 'Consistently proposes efficient technical solutions.' },
    { id: 'a11', employeeId: 'e5', employeeName: 'Ed Sheeran', position: 'Warehouse Associate', department: 'Operations', competency: 'Safety & Compliance', category: 'Safety & Compliance', currentLevel: null, requiredLevel: 'Intermediate', status: 'Not Assessed', score: null, evaluator: '—', lastAssessed: null, comments: '' },
    { id: 'a12', employeeId: 'e6', employeeName: 'Selena Gomez', position: 'Sales Associate', department: 'Sales', competency: 'Teamwork', category: 'Behavioral Skills', currentLevel: 'Intermediate', requiredLevel: 'Intermediate', status: 'Achieved', score: 4, evaluator: 'Sales Manager', lastAssessed: 'July 24, 2026', comments: 'Collaborates well across the floor team.' },
];
const employeeDirectory = [
    { id: 'e1', name: 'Vicky Melgar', position: 'Sales Trainee', department: 'Sales' },
    { id: 'e2', name: 'Vincent Sasi', position: 'Equipment Operator', department: 'Operations' },
    { id: 'e3', name: 'Maria Santos', position: 'HR Officer', department: 'Human Resources' },
    { id: 'e4', name: 'Kitchie Nadal', position: 'Software Engineer', department: 'IT' },
    { id: 'e5', name: 'Ed Sheeran', position: 'Warehouse Associate', department: 'Operations' },
    { id: 'e6', name: 'Selena Gomez', position: 'Sales Associate', department: 'Sales' },
];
function statusBadgeClass(status: AssessmentStatus) {
    switch (status) {
        case 'Achieved':
            return 'bg-green-100 text-green-700';
        case 'Needs Improvement':
            return 'bg-red-100 text-red-600';
        default:
            return 'bg-slate-100 text-slate-500';
    }
}
function gapLevels(current: Level | null, required: Level) {
    if (!current) return null;
    const diff = LEVEL_RANK[required] - LEVEL_RANK[current];
    return diff > 0 ? diff : 0;
}
type StatusFilter = 'All' | AssessmentStatus;
export default function CompetencyManagement() {
    const [definitions, setDefinitions] = useState<CompetencyDefinition[]>(initialDefinitions);
    const [assessments, setAssessments] = useState<EmployeeAssessment[]>(initialAssessments);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [categoryFilter, setCategoryFilter] = useState<'All Categories' | CompetencyCategory>('All Categories');
    const [profileEmployeeId, setProfileEmployeeId] = useState<string | null>(null);
    const [showAddCompetency, setShowAddCompetency] = useState(false);
    const [showAssessEmployee, setShowAssessEmployee] = useState(false);
    const [showAllGaps, setShowAllGaps] = useState(false);
    const [aiInsights, setAiInsights] = useState<string[] | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const filtered = useMemo(() => {
        return assessments.filter((a) => {
            const matchStatus = statusFilter === 'All' || a.status === statusFilter;
            const matchCategory = categoryFilter === 'All Categories' || a.category === categoryFilter;
            return matchStatus && matchCategory;
        });
    }, [assessments, statusFilter, categoryFilter]);
    const gapRecords = useMemo(
        () => assessments.filter((a) => a.status === 'Needs Improvement'),
        [assessments],
    );
    const profileAssessments = useMemo(
        () => (profileEmployeeId ? assessments.filter((a) => a.employeeId === profileEmployeeId) : []),
        [assessments, profileEmployeeId],
    );
    const profileEmployee = employeeDirectory.find((e) => e.id === profileEmployeeId);
    function handleGenerateAiAnalysis() {
        setAiLoading(true);
        setTimeout(() => {
            setAiInsights([
                'Communication is currently at Intermediate while the required level is Advanced across several Sales roles.',
                'Leadership has reached the required level for most assessed employees this quarter.',
                'Safety & Compliance requires further development for newly onboarded Operations staff.',
            ]);
            setAiLoading(false);
        }, 900);
    }
    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Competency Management</h1>}>
            <Head title="Competency Management" />
            {profileEmployee && (
                <EmployeeProfileModal
                    employee={profileEmployee}
                    records={profileAssessments}
                    onClose={() => setProfileEmployeeId(null)}
                />
            )}
            {showAddCompetency && (
                <AddCompetencyModal
                    onClose={() => setShowAddCompetency(false)}
                    onSave={(def) => {
                        setDefinitions((prev) => [...prev, def]);
                        setShowAddCompetency(false);
                    }}
                />
            )}
            {showAssessEmployee && (
                <AssessEmployeeModal
                    definitions={definitions}
                    onClose={() => setShowAssessEmployee(false)}
                    onSave={(record) => {
                        setAssessments((prev) => [record, ...prev]);
                        setShowAssessEmployee(false);
                    }}
                />
            )}
            {showAllGaps && (
                <AllGapsModal records={gapRecords} onClose={() => setShowAllGaps(false)} onView={(id) => { setShowAllGaps(false); setProfileEmployeeId(id); }} />
            )}
            <div className="flex flex-col gap-4">
                <PageHeader
                    title="Competency Management"
                    description="Track employee competency levels against role requirements and identify development gaps"
                    actions={
                        <>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                            >
                                <option>All Categories</option>
                                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowAddCompetency(true)}
                                className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add Competency
                            </button>
                        </>
                    }
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Total Competencies" value={summary.totalCompetencies} icon={Layers} />
                    <StatCard label="Employees Assessed" value={summary.employeesAssessed} icon={Users} />
                    <StatCard label="Competencies Achieved" value={summary.achieved} icon={CheckCircle2} />
                    <StatCard label="Need Improvement" value={summary.needsImprovement} icon={AlertTriangle} />
                </div>
                <DataTable
                    title="Employee Competency Overview"
                    data={filtered}
                    rowKey={(r) => r.id}
                    filterTabs={[
                        { label: 'All', value: 'All' },
                        { label: 'Achieved', value: 'Achieved' },
                        { label: 'Needs Improvement', value: 'Needs Improvement' },
                        { label: 'Not Assessed', value: 'Not Assessed' },
                    ]}
                    activeFilter={statusFilter}
                    onFilterChange={(v) => setStatusFilter(v as StatusFilter)}
                    columns={[
                        {
                            key: 'employee',
                            header: 'Employee',
                            render: (r) => (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                        <Award className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">{r.employeeName}</p>
                                        <p className="text-[11px] text-slate-400">{r.competency}</p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'position', header: 'Position', render: (r) => <span className="text-xs">{r.position}</span> },
                        { key: 'department', header: 'Department', render: (r) => <span className="text-xs">{r.department}</span> },
                        { key: 'competency', header: 'Competency', render: (r) => <span className="text-xs">{r.competency}</span> },
                        { key: 'currentLevel', header: 'Current Level', render: (r) => <span className="text-xs">{r.currentLevel ?? '—'}</span> },
                        { key: 'requiredLevel', header: 'Required Level', render: (r) => <span className="text-xs">{r.requiredLevel}</span> },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (r) => (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(r.status)}`}>
                                    {r.status}
                                </span>
                            ),
                        },
                        { key: 'lastAssessed', header: 'Last Assessed', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.lastAssessed ?? '—'}</span> },
                        {
                            key: 'action',
                            header: 'Action',
                            render: (r) => (
                                <div className="flex items-center gap-0.5">
                                    <button type="button" onClick={() => setProfileEmployeeId(r.employeeId)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View">
                                        <Eye className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ),
                        },
                    ]}
                    footer={
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Showing {filtered.length} of {assessments.length} assessment records</span>
                        </div>
                    }
                />
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Competency Gap Overview</h3>
                        <button type="button" onClick={() => setShowAllGaps(true)} className="text-xs font-semibold text-[#b5860a] hover:underline">
                            View all gaps
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {assessments.slice(0, 3).map((r) => {
                            const gap = gapLevels(r.currentLevel, r.requiredLevel);
                            return (
                                <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-xs font-semibold text-slate-800">{r.competency}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">Current: {r.currentLevel ?? '—'}</p>
                                    <p className="text-[11px] text-slate-500">Required: {r.requiredLevel}</p>
                                    {gap !== null && gap > 0 ? (
                                        <p className="mt-1 text-[11px] font-semibold text-red-600">Gap: {gap} Level{gap > 1 ? 's' : ''}</p>
                                    ) : null}
                                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(r.status)}`}>
                                        {r.status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <CompetencyCategoriesCard />
                    <CompetencyLevelDistributionCard />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => setShowAssessEmployee(true)}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <ClipboardList className="h-4 w-4 text-[#b5860a]" /> Assess Employee
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddCompetency(true)}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <Plus className="h-4 w-4 text-[#b5860a]" /> Add Competency
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAllGaps(true)}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <TrendingDown className="h-4 w-4 text-[#b5860a]" /> View Competency Gaps
                        </button>
                    </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#b5860a]" />
                        <h3 className="text-sm font-bold text-slate-900">Groq AI Competency Insights</h3>
                    </div>
                    <p className="text-xs text-slate-500">
                        Based on available performance, competency, learning, and training data, the system can identify development
                        patterns for HR to review. AI insights are suggestions only — HR reviews and decides on any action.
                    </p>
                    {aiInsights && (
                        <div className="mt-3 space-y-2">
                            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                                {aiInsights.map((line, i) => <li key={i}>{line}</li>)}
                            </ul>
                            <div className="rounded-lg bg-amber-50 p-3">
                                <p className="text-[11px] font-semibold text-amber-700">Suggested Development Areas</p>
                                <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-700">
                                    <li>Advanced Communication</li>
                                    <li>Safety & Compliance Training</li>
                                </ul>
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleGenerateAiAnalysis}
                        disabled={aiLoading}
                        className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300] disabled:opacity-60"
                    >
                        <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? 'Analyzing…' : 'Generate AI Analysis'}
                    </button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
function ModalShell({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}
function EmployeeProfileModal({
    employee,
    records,
    onClose,
}: {
    employee: { id: string; name: string; position: string; department: string };
    records: EmployeeAssessment[];
    onClose: () => void;
}) {
    const achievedCount = records.filter((r) => r.status === 'Achieved').length;
    const needsImprovementCount = records.filter((r) => r.status === 'Needs Improvement').length;
    const overallStatus: AssessmentStatus = needsImprovementCount > 0 ? 'Needs Improvement' : 'Achieved';
    return (
        <ModalShell onClose={onClose} wide>
            <div className="flex items-start justify-between">
                <h3 className="text-sm font-bold text-slate-900">Employee Competency Profile</h3>
                <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-3 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-sm font-bold text-amber-600">
                    {employee.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-900">{employee.name}</p>
                    <p className="text-xs text-slate-500">{employee.position} · {employee.department} Department</p>
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-600">Overall Competency Status</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(overallStatus)}`}>
                    {overallStatus}
                </span>
            </div>
            <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-slate-700">Competencies</p>
                <div className="space-y-2">
                    {records.map((r) => (
                        <div key={r.id} className="rounded-lg border border-slate-100 p-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-800">{r.competency}</p>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(r.status)}`}>
                                    {r.status}
                                </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">Current Level: {r.currentLevel ?? '—'}</p>
                            <p className="text-[11px] text-slate-500">Required Level: {r.requiredLevel}</p>
                        </div>
                    ))}
                    {records.length === 0 && <p className="text-xs text-slate-400">No assessment records yet.</p>}
                </div>
            </div>
            <div className="mt-4 rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-700">Competency Gap Summary</p>
                <p className="mt-1 text-[11px] text-amber-700">{needsImprovementCount} Competencies Need Improvement</p>
                <p className="text-[11px] text-amber-700">{achievedCount} Competencies Achieved</p>
            </div>

            <button onClick={onClose} className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
        </ModalShell>
    );
}
function AddCompetencyModal({
    onClose,
    onSave,
}: {
    onClose: () => void;
    onSave: (def: CompetencyDefinition) => void;
}) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<CompetencyCategory>('Technical Skills');
    const [description, setDescription] = useState('');
    const [requiredLevel, setRequiredLevel] = useState<Level>('Intermediate');
    const [applicableTo, setApplicableTo] = useState('');
    const [status, setStatus] = useState<DefinitionStatus>('Active');
    function handleSave() {
        if (!name.trim()) return;
        onSave({
            id: `c${Date.now()}`,
            name: name.trim(),
            category,
            description: description.trim(),
            requiredLevel,
            status,
        });
    }
    return (
        <ModalShell onClose={onClose}>
            <h3 className="text-sm font-bold text-slate-900">Add Competency</h3>
            <p className="mt-1 text-xs text-slate-500">Define a new organization-wide competency framework entry.</p>

            <div className="mt-4 space-y-3">
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Competency Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leadership" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                </div>
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value as CompetencyCategory)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none">
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Ability to guide, coordinate, and support team members toward organizational objectives." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Required Level</label>
                        <select value={requiredLevel} onChange={(e) => setRequiredLevel(e.target.value as Level)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none">
                            {LEVELS.map((l) => <option key={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as DefinitionStatus)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none">
                            <option>Active</option>
                            <option>Draft</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Applicable Position/Department</label>
                    <input value={applicableTo} onChange={(e) => setApplicableTo(e.target.value)} placeholder="e.g. Sales, Operations" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300]">Save</button>
            </div>
        </ModalShell>
    );
}
function AssessEmployeeModal({
    definitions,
    onClose,
    onSave,
}: {
    definitions: CompetencyDefinition[];
    onClose: () => void;
    onSave: (record: EmployeeAssessment) => void;
}) {
    const [employeeId, setEmployeeId] = useState(employeeDirectory[0].id);
    const [competencyId, setCompetencyId] = useState(definitions[0]?.id ?? '');
    const [currentLevel, setCurrentLevel] = useState<Level>('Intermediate');
    const [score, setScore] = useState(3);
    const [evaluator, setEvaluator] = useState('Current HR User');
    const [date, setDate] = useState('');
    const [comments, setComments] = useState('');

    const employee = employeeDirectory.find((e) => e.id === employeeId)!;
    const competency = definitions.find((c) => c.id === competencyId);
    function handleSave() {
        if (!competency) return;
        const requiredLevel = competency.requiredLevel;
        const status: AssessmentStatus = LEVEL_RANK[currentLevel] >= LEVEL_RANK[requiredLevel] ? 'Achieved' : 'Needs Improvement';
        onSave({
            id: `a${Date.now()}`,
            employeeId: employee.id,
            employeeName: employee.name,
            position: employee.position,
            department: employee.department,
            competency: competency.name,
            category: competency.category,
            currentLevel,
            requiredLevel,
            status,
            score,
            evaluator,
            lastAssessed: date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            comments,
        });
    }
    return (
        <ModalShell onClose={onClose}>
            <h3 className="text-sm font-bold text-slate-900">Assess Employee</h3>
            <p className="mt-1 text-xs text-slate-500">Evaluate an employee's current competency level against the role requirement.</p>

            <div className="mt-4 space-y-3">
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Employee</label>
                    <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none">
                        {employeeDirectory.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Position</label>
                        <input readOnly value={employee.position} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Department</label>
                        <input readOnly value={employee.department} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Competency</label>
                    <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none">
                        {definitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Required Level</label>
                        <input readOnly value={competency?.requiredLevel ?? ''} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Current Level</label>
                        <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value as Level)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none">
                            {LEVELS.map((l) => <option key={l}>{l}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Assessment Score (1–5)</label>
                        <input type="number" min={1} max={5} value={score} onChange={(e) => setScore(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" />
                    </div>
                    <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">Assessment Date</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Evaluator</label>
                    <input value={evaluator} onChange={(e) => setEvaluator(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" />
                </div>
                <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-500">Comments / Feedback</label>
                    <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300]">Save Assessment</button>
            </div>
        </ModalShell>
    );
}
function AllGapsModal({
    records,
    onClose,
    onView,
}: {
    records: EmployeeAssessment[];
    onClose: () => void;
    onView: (employeeId: string) => void;
}) {
    return (
        <ModalShell onClose={onClose} wide>
            <div className="flex items-start justify-between">
                <h3 className="text-sm font-bold text-slate-900">Competency Gaps</h3>
                <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 space-y-2">
                {records.map((r) => {
                    const gap = gapLevels(r.currentLevel, r.requiredLevel);
                    return (
                        <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                            <div>
                                <p className="text-xs font-semibold text-slate-800">{r.employeeName} · {r.competency}</p>
                                <p className="text-[11px] text-slate-500">Current: {r.currentLevel} → Required: {r.requiredLevel}{gap ? ` (Gap: ${gap} Level${gap > 1 ? 's' : ''})` : ''}</p>
                            </div>
                            <button onClick={() => onView(r.employeeId)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View">
                                <Eye className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    );
                })}
                {records.length === 0 && <p className="text-xs text-slate-400">No competency gaps found.</p>}
            </div>
            <button onClick={onClose} className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
        </ModalShell>
    );
}
function CompetencyCategoriesCard() {
    const total = TOTAL_COMPETENCIES;
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-[#b5860a]" />
                <h3 className="text-sm font-bold text-slate-900">Competency Categories</h3>
            </div>
            <div className="flex items-center gap-5">
                <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 -rotate-90">
                    {categoryDistribution.map((seg) => {
                        const length = (seg.count / total) * circumference;
                        const offset = cumulative;
                        cumulative += length;
                        return (
                            <circle
                                key={seg.category}
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke={seg.color}
                                strokeWidth="12"
                                strokeDasharray={`${length} ${circumference - length}`}
                                strokeDashoffset={-offset}
                            />
                        );
                    })}
                    <circle cx="50" cy="50" r="30" fill="white" />
                </svg>
                <div className="flex-1 space-y-1.5">
                    {categoryDistribution.map((seg) => (
                        <div key={seg.category} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-slate-600">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
                                {seg.category}
                            </span>
                            <span className="font-semibold text-slate-800">{seg.count}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-xs font-bold text-slate-900">
                        <span>Total</span>
                        <span>{total}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
function CompetencyLevelDistributionCard() {
    const total = TOTAL_ASSESSED_RECORDS;
    const barColor: Record<Level, string> = {
        Beginner: 'bg-slate-300',
        Intermediate: 'bg-amber-300',
        Advanced: 'bg-amber-500',
        Expert: 'bg-emerald-500',
    };
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-[#b5860a]" />
                <h3 className="text-sm font-bold text-slate-900">Competency Level Distribution</h3>
            </div>
            <div className="space-y-3">
                {levelDistribution.map((l) => {
                    const pct = Math.round((l.count / total) * 100);
                    return (
                        <div key={l.level}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="font-medium text-slate-600">{l.level}</span>
                                <span className="font-semibold text-slate-800">{l.count} · {pct}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${barColor[l.level]}`} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}