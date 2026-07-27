import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    Award,
    Eye,
    Layers,
    Pencil,
    Plus,
    Star,
    Target,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type Competency = {
    id: string;
    name: string;
    category: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    avgScore: number;
    employees: number;
    status: 'Active' | 'Draft';
};

const competencies: Competency[] = [
    { id: '1', name: 'Communication', category: 'Soft Skills', level: 'Advanced', avgScore: 4.35, employees: 98, status: 'Active' },
    { id: '2', name: 'Leadership', category: 'Management', level: 'Intermediate', avgScore: 4.2, employees: 45, status: 'Active' },
    { id: '3', name: 'Technical Skills', category: 'Technical', level: 'Advanced', avgScore: 4.1, employees: 72, status: 'Active' },
    { id: '4', name: 'Teamwork', category: 'Soft Skills', level: 'Intermediate', avgScore: 4.05, employees: 110, status: 'Active' },
    { id: '5', name: 'Problem Solving', category: 'Analytical', level: 'Intermediate', avgScore: 3.9, employees: 86, status: 'Active' },
    { id: '6', name: 'Safety Compliance', category: 'Compliance', level: 'Beginner', avgScore: 0, employees: 0, status: 'Draft' },
];

const statCards = [
    { label: 'Total Competencies', value: 24, icon: Layers },
    { label: 'Active', value: 20, icon: Target },
    { label: 'Avg. Score', value: '4.1', icon: Star },
    { label: 'Employees Assessed', value: 112, icon: Users },
];

type StatusFilter = 'All' | 'Active' | 'Draft';

export default function CompetencyManagement() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [selected, setSelected] = useState<Competency | null>(null);
    const [showAdd, setShowAdd] = useState(false);

    const categories = useMemo(
        () => Array.from(new Set(competencies.map((c) => c.category))),
        [],
    );

    const filtered = useMemo(() => {
        return competencies.filter((c) => {
            const matchStatus = statusFilter === 'All' || c.status === statusFilter;
            const matchCategory = categoryFilter === 'All Categories' || c.category === categoryFilter;
            return matchStatus && matchCategory;
        });
    }, [statusFilter, categoryFilter]);

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Competency Management</h1>}>
            <Head title="Competency Management" />

            {selected && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">{selected.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{selected.category} · {selected.level}</p>
                        <div className="mt-4 space-y-2 text-sm">
                            <p><span className="text-slate-500">Avg. Score:</span> <span className="font-semibold">{selected.avgScore || '—'}</span></p>
                            <p><span className="text-slate-500">Employees:</span> <span className="font-semibold">{selected.employees}</span></p>
                            <p><span className="text-slate-500">Status:</span> <span className="font-semibold">{selected.status}</span></p>
                        </div>
                        <button onClick={() => setSelected(null)} className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
                    </div>
                </div>
            )}

            {showAdd && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">Add Competency</h3>
                        <p className="mt-1 text-xs text-slate-500">Create a new competency framework entry.</p>
                        <div className="mt-4 space-y-3">
                            <input placeholder="Competency name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none">
                                <option>Soft Skills</option><option>Technical</option><option>Management</option>
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
                    title="Competency Management"
                    description="Define and track employee competency frameworks"
                    actions={
                        <>
                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                <option>All Categories</option>
                                {categories.map((c) => <option key={c}>{c}</option>)}
                            </select>
                            <button type="button" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]">
                                <Plus className="h-3.5 w-3.5" /> Add Competency
                            </button>
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statCards.map((c) => <StatCard key={c.label} {...c} />)}
                </div>

                <DataTable
                    title="All Competencies"
                    data={filtered}
                    rowKey={(r) => r.id}
                    filterTabs={[
                        { label: 'All', value: 'All' },
                        { label: 'Active', value: 'Active' },
                        { label: 'Draft', value: 'Draft' },
                    ]}
                    activeFilter={statusFilter}
                    onFilterChange={(v) => setStatusFilter(v as StatusFilter)}
                    columns={[
                        {
                            key: 'name',
                            header: 'Competency',
                            render: (r) => (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                        <Award className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">{r.name}</p>
                                        <p className="text-[11px] text-slate-400">{r.category}</p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'level', header: 'Level', render: (r) => <span className="text-xs">{r.level}</span> },
                        {
                            key: 'score',
                            header: 'Avg. Score',
                            render: (r) => r.avgScore ? (
                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{r.avgScore}
                                </span>
                            ) : <span className="text-slate-300">—</span>,
                        },
                        { key: 'employees', header: 'Employees', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.employees}</span> },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (r) => (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {r.status}
                                </span>
                            ),
                        },
                        {
                            key: 'action',
                            header: 'Action',
                            render: (r) => (
                                <div className="flex items-center gap-0.5">
                                    <button type="button" onClick={() => setSelected(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View"><Eye className="h-3.5 w-3.5" /></button>
                                    <button type="button" onClick={() => setSelected(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                                </div>
                            ),
                        },
                    ]}
                    footer={
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Showing {filtered.length} of {competencies.length} competencies</span>
                        </div>
                    }
                />
            </div>
        </AuthenticatedLayout>
    );
}
