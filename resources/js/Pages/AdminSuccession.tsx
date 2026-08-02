import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    AlertTriangle,
    Briefcase,
    ChevronRight,
    Eye,
    Layers,
    Plus,
    ShieldCheck,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
type Criticality = 'Critical' | 'High' | 'Moderate';
type PipelineStage =
    | 'Ready Now'
    | 'Ready Soon'
    | 'Developing'
    | 'Needs Significant Development'
    | 'No Successor Identified';
type CriticalPosition = {
    id: string;
    title: string;
    department: string;
    criticality: Criticality;
    currentIncumbent: string;
    requiredCompetencies: string[];
    successorsCount: number;
    readyNowCount: number;
    readySoonCount: number;
    developingCount: number;
    pipelineStage: PipelineStage;
    reviewDate: string;
};
const INITIAL_POSITIONS: CriticalPosition[] = [
    {
        id: '1',
        title: 'Project Manager',
        department: 'Operations',
        criticality: 'Critical',
        currentIncumbent: 'Zack Tubudlo',
        requiredCompetencies: ['Leadership', 'Stakeholder Management', 'Risk Management'],
        successorsCount: 2,
        readyNowCount: 1,
        readySoonCount: 1,
        developingCount: 0,
        pipelineStage: 'Ready Now',
        reviewDate: 'Oct 2026',
    },
    {
        id: '2',
        title: 'Site Engineer',
        department: 'Engineering',
        criticality: 'Critical',
        currentIncumbent: 'Rico Blanco',
        requiredCompetencies: ['Technical Skills', 'Problem Solving', 'Safety Compliance'],
        successorsCount: 1,
        readyNowCount: 0,
        readySoonCount: 1,
        developingCount: 0,
        pipelineStage: 'Ready Soon',
        reviewDate: 'Nov 2026',
    },
    {
        id: '3',
        title: 'Safety Officer',
        department: 'Safety & Compliance',
        criticality: 'High',
        currentIncumbent: 'Regine Velasquez',
        requiredCompetencies: ['Safety Compliance', 'Regulatory Knowledge', 'Communication'],
        successorsCount: 0,
        readyNowCount: 0,
        readySoonCount: 0,
        developingCount: 0,
        pipelineStage: 'No Successor Identified',
        reviewDate: 'Sep 2026',
    },
    {
        id: '4',
        title: 'Finance Manager',
        department: 'Finance',
        criticality: 'Critical',
        currentIncumbent: 'Charlie Puth',
        requiredCompetencies: ['Financial Analysis', 'Leadership', 'Strategic Planning'],
        successorsCount: 1,
        readyNowCount: 0,
        readySoonCount: 0,
        developingCount: 1,
        pipelineStage: 'Developing',
        reviewDate: 'Dec 2026',
    },
    {
        id: '5',
        title: 'HR Manager',
        department: 'Human Resources',
        criticality: 'High',
        currentIncumbent: 'Ainah Sta. Maria',
        requiredCompetencies: ['Leadership', 'Employee Relations', 'Communication'],
        successorsCount: 2,
        readyNowCount: 1,
        readySoonCount: 0,
        developingCount: 1,
        pipelineStage: 'Ready Now',
        reviewDate: 'Oct 2026',
    },
    {
        id: '6',
        title: 'Procurement Manager',
        department: 'Procurement',
        criticality: 'Moderate',
        currentIncumbent: 'Juan Karlos',
        requiredCompetencies: ['Negotiation', 'Vendor Management', 'Analytical Skills'],
        successorsCount: 1,
        readyNowCount: 0,
        readySoonCount: 0,
        developingCount: 0,
        pipelineStage: 'Needs Significant Development',
        reviewDate: 'Jan 2027',
    },
    {
        id: '7',
        title: 'Operations Manager',
        department: 'Operations',
        criticality: 'High',
        currentIncumbent: 'Jemarie Cuesta',
        requiredCompetencies: ['Leadership', 'Process Improvement', 'Decision Making'],
        successorsCount: 3,
        readyNowCount: 2,
        readySoonCount: 1,
        developingCount: 0,
        pipelineStage: 'Ready Now',
        reviewDate: 'Nov 2026',
    },
    {
        id: '8',
        title: 'Equipment & Fleet Superintendent',
        department: 'Operations',
        criticality: 'Moderate',
        currentIncumbent: 'Jovan Saldua',
        requiredCompetencies: ['Technical Skills', 'Resource Planning'],
        successorsCount: 0,
        readyNowCount: 0,
        readySoonCount: 0,
        developingCount: 0,
        pipelineStage: 'No Successor Identified',
        reviewDate: 'Sep 2026',
    },
];
const PIPELINE_STAGES: { stage: PipelineStage; color: string; dot: string; badge: string }[] = [
    { stage: 'Ready Now', color: '#22c55e', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
    { stage: 'Ready Soon', color: '#fbbf24', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
    { stage: 'Developing', color: '#fb923c', dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700' },
    { stage: 'Needs Significant Development', color: '#fb7185', dot: 'bg-rose-400', badge: 'bg-rose-100 text-rose-700' },
    { stage: 'No Successor Identified', color: '#ef4444', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
];
const AT_RISK_STAGES: PipelineStage[] = ['Needs Significant Development', 'No Successor Identified'];
function stageMeta(stage: PipelineStage) {
    return PIPELINE_STAGES.find((s) => s.stage === stage)!;
}
function criticalityBadgeClass(c: Criticality) {
    switch (c) {
        case 'Critical':
            return 'bg-red-100 text-red-700';
        case 'High':
            return 'bg-amber-100 text-amber-700';
        case 'Moderate':
            return 'bg-slate-100 text-slate-600';
    }
}
function riskReasons(p: CriticalPosition): string[] {
    const reasons: string[] = [];
    if (p.successorsCount === 0) reasons.push('No successor identified');
    else if (p.successorsCount === 1) reasons.push('Single successor only');
    if (p.successorsCount > 0 && p.readyNowCount === 0) reasons.push('No ready-now successor');
    return reasons;
}
type CoverageFilter = 'All' | 'Ready Now' | 'In Development' | 'No Successor';
type NewPositionForm = {
    title: string;
    department: string;
    criticality: Criticality;
    currentIncumbent: string;
    competencies: string;
    reviewDate: string;
};
function emptyPositionForm(): NewPositionForm {
    return {
        title: '',
        department: '',
        criticality: 'High',
        currentIncumbent: '',
        competencies: '',
        reviewDate: '',
    };
}
export default function SuccessionManagement() {
    const [positions, setPositions] = useState<CriticalPosition[]>(INITIAL_POSITIONS);
    const [departmentFilter, setDepartmentFilter] = useState('All Departments');
    const [criticalityFilter, setCriticalityFilter] = useState<'All Criticality' | Criticality>('All Criticality');
    const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('All');
    const [selected, setSelected] = useState<CriticalPosition | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState<NewPositionForm>(emptyPositionForm());
    const [showAllAtRisk, setShowAllAtRisk] = useState(false);
    const departments = useMemo(
        () => Array.from(new Set(positions.map((p) => p.department))),
        [positions],
    );
    const filteredPositions = useMemo(() => {
        return positions.filter((p) => {
            const matchesDept = departmentFilter === 'All Departments' || p.department === departmentFilter;
            const matchesCriticality = criticalityFilter === 'All Criticality' || p.criticality === criticalityFilter;
            const matchesCoverage =
                coverageFilter === 'All' ||
                (coverageFilter === 'Ready Now' && p.pipelineStage === 'Ready Now') ||
                (coverageFilter === 'In Development' &&
                    (p.pipelineStage === 'Ready Soon' || p.pipelineStage === 'Developing')) ||
                (coverageFilter === 'No Successor' && AT_RISK_STAGES.includes(p.pipelineStage));
            return matchesDept && matchesCriticality && matchesCoverage;
        });
    }, [positions, departmentFilter, criticalityFilter, coverageFilter]);
    const totalCritical = positions.length;
    const coveredCount = positions.filter((p) => p.successorsCount > 0).length;
    const readyNowHeadcount = positions.reduce((sum, p) => sum + p.readyNowCount, 0);
    const atRiskPositions = positions.filter((p) => AT_RISK_STAGES.includes(p.pipelineStage));
    const pipelineCounts = useMemo(() => {
        return PIPELINE_STAGES.map((s) => ({
            ...s,
            count: positions.filter((p) => p.pipelineStage === s.stage).length,
        }));
    }, [positions]);
    function openAddForm() {
        setForm(emptyPositionForm());
        setShowAddForm(true);
    }
    function closeAddForm() {
        setShowAddForm(false);
    }
    function handleAddPosition() {
        if (!form.title.trim() || !form.department.trim()) return;
        const newPosition: CriticalPosition = {
            id: `${Date.now()}`,
            title: form.title.trim(),
            department: form.department.trim(),
            criticality: form.criticality,
            currentIncumbent: form.currentIncumbent.trim() || 'Vacant',
            requiredCompetencies: form.competencies
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean),
            successorsCount: 0,
            readyNowCount: 0,
            readySoonCount: 0,
            developingCount: 0,
            pipelineStage: 'No Successor Identified',
            reviewDate: form.reviewDate || 'Not scheduled',
        };
        setPositions((prev) => [newPosition, ...prev]);
        setShowAddForm(false);
    }
    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-lg font-bold text-slate-900">
                    Succession Planning
                </h1>
            }
        >
            <Head title="Succession Planning" />
            {selected && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">{selected.title}</h3>
                                <p className="text-xs text-slate-400">{selected.department}</p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${criticalityBadgeClass(selected.criticality)}`}>
                                {selected.criticality}
                            </span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageMeta(selected.pipelineStage).badge}`}>
                                {selected.pipelineStage}
                            </span>
                        </div>
                        <div className="mt-4 space-y-3 text-xs">
                            <div>
                                <p className="font-semibold text-slate-500">Current Incumbent</p>
                                <p className="mt-0.5 text-slate-800">{selected.currentIncumbent}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-500">Required Competencies</p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {selected.requiredCompetencies.map((c) => (
                                        <span key={c} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="font-semibold text-slate-500">Successor Coverage</p>
                                <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{selected.readyNowCount}</p>
                                        <p className="text-[10px] text-slate-400">Ready Now</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{selected.readySoonCount}</p>
                                        <p className="text-[10px] text-slate-400">Ready Soon</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{selected.developingCount}</p>
                                        <p className="text-[10px] text-slate-400">Developing</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-500">Next Review</p>
                                <p className="mt-0.5 text-slate-800">{selected.reviewDate}</p>
                            </div>
                        </div>
                        <p className="mt-4 text-[10px] italic text-slate-400">
                            Success profile, individual successors, and development plans become available in a later phase.
                        </p>
                    </div>
                </div>
            )}
            {showAddForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={closeAddForm}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">Add Critical Position</h3>
                            <button onClick={closeAddForm} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">Position Title</label>
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g. Warehouse Supervisor"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Department</label>
                                    <input
                                        value={form.department}
                                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                                        placeholder="Department"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Criticality</label>
                                    <select
                                        value={form.criticality}
                                        onChange={(e) => setForm({ ...form, criticality: e.target.value as Criticality })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                                    >
                                        <option>Critical</option>
                                        <option>High</option>
                                        <option>Moderate</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                                    Current Incumbent <span className="text-slate-400">(optional)</span>
                                </label>
                                <input
                                    value={form.currentIncumbent}
                                    onChange={(e) => setForm({ ...form, currentIncumbent: e.target.value })}
                                    placeholder="Leave blank if vacant"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                                    Required Competencies <span className="text-slate-400">(comma-separated)</span>
                                </label>
                                <input
                                    value={form.competencies}
                                    onChange={(e) => setForm({ ...form, competencies: e.target.value })}
                                    placeholder="e.g. Leadership, Risk Management"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">Next Review Date</label>
                                <input
                                    type="date"
                                    value={form.reviewDate}
                                    onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <button onClick={closeAddForm} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleAddPosition}
                                disabled={!form.title.trim() || !form.department.trim()}
                                className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Add Position
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showAllAtRisk && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowAllAtRisk(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">Positions Needing Attention</h3>
                            <button onClick={() => setShowAllAtRisk(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-3 space-y-1">
                            {atRiskPositions.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setShowAllAtRisk(false);
                                        setSelected(p);
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                                >
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">{p.title}</p>
                                        <p className="text-[11px] text-slate-400">{p.department}</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {riskReasons(p).map((r) => (
                                                <span key={r} className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${criticalityBadgeClass(p.criticality)}`}>
                                        {p.criticality}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-4">
                <PageHeader
                    title="Succession Planning"
                    description="Identify critical roles, track successor readiness, and plan future leadership continuity"
                    actions={
                        <>
                            <select
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                            >
                                <option>All Departments</option>
                                {departments.map((d) => <option key={d}>{d}</option>)}
                            </select>
                            <select
                                value={criticalityFilter}
                                onChange={(e) => setCriticalityFilter(e.target.value as 'All Criticality' | Criticality)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                            >
                                <option>All Criticality</option>
                                <option>Critical</option>
                                <option>High</option>
                                <option>Moderate</option>
                            </select>
                            <button
                                type="button"
                                onClick={openAddForm}
                                className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add Critical Position
                            </button>
                        </>
                    }
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Critical Positions" value={totalCritical} icon={Briefcase} />
                    <StatCard label="Successor Coverage" value={`${coveredCount}/${totalCritical}`} icon={ShieldCheck} />
                    <StatCard label="Ready Now" value={readyNowHeadcount} icon={UserCheck} />
                    <StatCard label="Positions At Risk" value={atRiskPositions.length} icon={AlertTriangle} />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-[#F4B400]" />
                            <h2 className="text-sm font-bold text-slate-900">Succession Pipeline</h2>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                            Critical positions by successor readiness stage
                        </p>
                        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                            {pipelineCounts.map((s) =>
                                s.count > 0 ? (
                                    <div
                                        key={s.stage}
                                        style={{ width: `${(s.count / totalCritical) * 100}%`, backgroundColor: s.color }}
                                        title={`${s.stage}: ${s.count}`}
                                    />
                                ) : null,
                            )}
                        </div>
                        <div className="mt-3 space-y-1.5">
                            {pipelineCounts.map((s) => (
                                <div key={s.stage} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                                        <span className="text-slate-600">{s.stage}</span>
                                    </div>
                                    <span className="font-semibold text-slate-800">{s.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle className="h-4 w-4 text-[#F4B400]" />
                                <h2 className="text-sm font-bold text-slate-900">Positions Needing Attention</h2>
                            </div>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                            Critical roles with no successor or significant readiness gaps
                        </p>
                        <div className="mt-3 space-y-1">
                            {atRiskPositions.slice(0, 3).map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelected(p)}
                                    className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left hover:bg-slate-50"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-800">{p.title}</p>
                                        <p className="truncate text-[11px] text-slate-400">{p.department}</p>
                                    </div>
                                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${criticalityBadgeClass(p.criticality)}`}>
                                        {p.criticality}
                                    </span>
                                </button>
                            ))}
                            {atRiskPositions.length === 0 && (
                                <p className="py-3 text-center text-xs text-slate-400">No positions currently at risk.</p>
                            )}
                        </div>
                        {atRiskPositions.length > 3 && (
                            <button
                                type="button"
                                onClick={() => setShowAllAtRisk(true)}
                                className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                View All <ChevronRight className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>
                <DataTable
                    title="Critical Positions"
                    data={filteredPositions}
                    rowKey={(r) => r.id}
                    filterTabs={[
                        { label: 'All', value: 'All' },
                        { label: 'Ready Now', value: 'Ready Now' },
                        { label: 'In Development', value: 'In Development' },
                        { label: 'No Successor', value: 'No Successor' },
                    ]}
                    activeFilter={coverageFilter}
                    onFilterChange={(v) => setCoverageFilter(v as CoverageFilter)}
                    columns={[
                        {
                            key: 'position',
                            header: 'Position',
                            render: (r) => (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                        <Briefcase className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">{r.title}</p>
                                        <p className="text-[11px] text-slate-400">{r.currentIncumbent}</p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'department', header: 'Department', render: (r) => <span className="text-xs">{r.department}</span> },
                        {
                            key: 'criticality',
                            header: 'Criticality',
                            render: (r) => (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${criticalityBadgeClass(r.criticality)}`}>
                                    {r.criticality}
                                </span>
                            ),
                        },
                        {
                            key: 'coverage',
                            header: 'Successor Coverage',
                            render: (r) =>
                                r.successorsCount > 0 ? (
                                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                                        <Users className="h-3 w-3 text-slate-400" /> {r.successorsCount} identified
                                    </span>
                                ) : (
                                    <span className="text-xs font-semibold text-red-600">No successor</span>
                                ),
                        },
                        {
                            key: 'readiness',
                            header: 'Readiness Status',
                            render: (r) => (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageMeta(r.pipelineStage).badge}`}>
                                    {r.pipelineStage}
                                </span>
                            ),
                        },
                        {
                            key: 'action',
                            header: 'Action',
                            render: (r) => (
                                <button type="button" onClick={() => setSelected(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View">
                                    <Eye className="h-3.5 w-3.5" />
                                </button>
                            ),
                        },
                    ]}
                    footer={
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Showing {filteredPositions.length} of {totalCritical} critical positions</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setDepartmentFilter('All Departments');
                                    setCriticalityFilter('All Criticality');
                                    setCoverageFilter('All');
                                }}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Reset Filters <ChevronRight className="h-3 w-3" />
                            </button>
                        </div>
                    }
                />
            </div>
        </AuthenticatedLayout>
    );
}