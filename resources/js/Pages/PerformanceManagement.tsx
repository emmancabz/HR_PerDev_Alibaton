import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    Eye,
    Plus,
    Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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
    color: string;
};

const evaluations: Evaluation[] = [
    { id: '1', employee: 'Jaylou Cruiz', role: 'Trainee', department: 'Information Technology', period: 'Q2 2026 (Jan - Feb)', rating: 4.6, status: 'Completed', evaluator: 'Ainah Sta. Maria', evaluatorRole: 'HR Manager', dateCreated: 'March 12, 2026', color: '#fbbf24' },
    { id: '2', employee: 'Daisy Dacula', role: 'Trainee', department: 'Finance', period: 'Q3 2026 (Jan - Mar)', rating: 4.4, status: 'Completed', evaluator: 'Emmanuel Cabanas', evaluatorRole: 'Training Officer', dateCreated: 'April 15, 2026', color: '#a3e635' },
    { id: '3', employee: 'Tyron Mararac', role: 'Trainee', department: 'Operations', period: 'Q3 2026 (Jan - Mar)', rating: 4.3, status: 'Completed', evaluator: 'Lisa Montero', evaluatorRole: 'Staff', dateCreated: 'April 25, 2026', color: '#c084fc' },
    { id: '4', employee: 'Rizza Escorial', role: 'Trainee', department: 'Operations', period: 'Q3 2028 (Jan - Mar)', rating: null, status: 'Pending', evaluator: 'Mhicaela Buban', evaluatorRole: 'Staff', dateCreated: null, color: '#fb7185' },
    { id: '5', employee: 'Zk Magalang', role: 'Trainee', department: 'Operations', period: 'Q3 2026 (Jan - Mar)', rating: null, status: 'Pending', evaluator: 'Kaye Caagusan', evaluatorRole: 'Staff', dateCreated: null, color: '#f87171' },
];

const statCards = [
    { label: 'Total Evaluation', value: 245, icon: ClipboardList },
    { label: 'Completed', value: 220, icon: CheckCircle2 },
    { label: 'Pending', value: 25, icon: Clock },
    { label: 'Average Rating', value: '4.5/5', icon: Star },
];

type StatusFilter = 'All' | 'Completed' | 'Pending';

export default function PerformanceManagement() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [departmentFilter, setDepartmentFilter] = useState('All Department');
    const [selected, setSelected] = useState<Evaluation | null>(null);
    const [showAdd, setShowAdd] = useState(false);

    const filteredEvaluations = useMemo(() => {
        return evaluations.filter((row) => {
            const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
            const matchesDepartment = departmentFilter === 'All Department' || row.department === departmentFilter;
            return matchesStatus && matchesDepartment;
        });
    }, [statusFilter, departmentFilter]);

    const departments = useMemo(
        () => Array.from(new Set(evaluations.map((e) => e.department))),
        [],
    );

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Performance Management</h1>}>
            <Head title="Performance Management" />

            {selected && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">{selected.employee}</h3>
                        <p className="text-xs text-slate-500">{selected.period}</p>
                        <div className="mt-4 space-y-2 text-xs">
                            <p><span className="text-slate-500">Department:</span> <span className="font-semibold">{selected.department}</span></p>
                            <p><span className="text-slate-500">Rating:</span> <span className="font-semibold">{selected.rating ?? 'Pending'}</span></p>
                            <p><span className="text-slate-500">Evaluator:</span> <span className="font-semibold">{selected.evaluator}</span></p>
                            <p><span className="text-slate-500">Status:</span> <span className="font-semibold">{selected.status}</span></p>
                        </div>
                        <button onClick={() => setSelected(null)} className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
                    </div>
                </div>
            )}

            {showAdd && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">Create Evaluation</h3>
                        <div className="mt-4 space-y-3">
                            <input placeholder="Employee name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                {departments.map((d) => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300]">Save</button>
                        </div>
                    </div>
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
                            <button type="button" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]">
                                <Plus className="h-3.5 w-3.5" /> Create Evaluation
                            </button>
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statCards.map((c) => <StatCard key={c.label} {...c} />)}
                </div>

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
                            key: 'date',
                            header: 'Created',
                            render: (r) => <span className="text-xs">{r.dateCreated ?? '—'}</span>,
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
                            <span>Showing {filteredEvaluations.length} of 245 evaluations</span>
                            <button type="button" onClick={() => setStatusFilter('All')} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                View All <ChevronRight className="h-3 w-3" />
                            </button>
                        </div>
                    }
                />
            </div>
        </AuthenticatedLayout>
    );
}
