import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    BookOpen,
    Clock,
    Eye,
    GraduationCap,
    Pencil,
    Plus,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type Course = {
    id: string;
    title: string;
    category: string;
    instructor: string;
    duration: string;
    enrolled: number;
    status: 'Published' | 'Draft';
};

const courses: Course[] = [
    { id: '1', title: 'Effective Communication', category: 'Soft Skills', instructor: 'Ainah Sta. Maria', duration: '4 hrs', enrolled: 45, status: 'Published' },
    { id: '2', title: 'Leadership Fundamentals', category: 'Management', instructor: 'Emmanuel Cabanas', duration: '6 hrs', enrolled: 32, status: 'Published' },
    { id: '3', title: 'Workplace Safety', category: 'Compliance', instructor: 'Lisa Montero', duration: '2 hrs', enrolled: 112, status: 'Published' },
    { id: '4', title: 'Time Management', category: 'Productivity', instructor: 'Mhicaela Buban', duration: '3 hrs', enrolled: 28, status: 'Published' },
    { id: '5', title: 'Advanced Excel', category: 'Technical', instructor: 'Kaye Caagusan', duration: '8 hrs', enrolled: 0, status: 'Draft' },
];

const statCards = [
    { label: 'Total Courses', value: 18, icon: BookOpen },
    { label: 'Published', value: 15, icon: GraduationCap },
    { label: 'Total Enrolled', value: 217, icon: Users },
    { label: 'Avg. Duration', value: '4.5 hrs', icon: Clock },
];

type StatusFilter = 'All' | 'Published' | 'Draft';

export default function LearningManagement() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [selected, setSelected] = useState<Course | null>(null);
    const [showAdd, setShowAdd] = useState(false);

    const categories = useMemo(
        () => Array.from(new Set(courses.map((c) => c.category))),
        [],
    );

    const filtered = useMemo(() => {
        return courses.filter((c) => {
            const matchStatus = statusFilter === 'All' || c.status === statusFilter;
            const matchCategory = categoryFilter === 'All Categories' || c.category === categoryFilter;
            return matchStatus && matchCategory;
        });
    }, [statusFilter, categoryFilter]);

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Learning Management</h1>}>
            <Head title="Learning Management" />

            {selected && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">{selected.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">{selected.category}</p>
                        <div className="mt-4 space-y-2 text-sm">
                            <p><span className="text-slate-500">Instructor:</span> <span className="font-semibold">{selected.instructor}</span></p>
                            <p><span className="text-slate-500">Duration:</span> <span className="font-semibold">{selected.duration}</span></p>
                            <p><span className="text-slate-500">Enrolled:</span> <span className="font-semibold">{selected.enrolled}</span></p>
                        </div>
                        <button onClick={() => setSelected(null)} className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
                    </div>
                </div>
            )}

            {showAdd && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">Add Course</h3>
                        <p className="mt-1 text-xs text-slate-500">Create a new learning course.</p>
                        <div className="mt-4 space-y-3">
                            <input placeholder="Course title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                            <input placeholder="Instructor" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" />
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
                    title="Learning Management"
                    description="Manage courses and learning content"
                    actions={
                        <>
                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                <option>All Categories</option>
                                {categories.map((c) => <option key={c}>{c}</option>)}
                            </select>
                            <button type="button" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]">
                                <Plus className="h-3.5 w-3.5" /> Add Course
                            </button>
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statCards.map((c) => <StatCard key={c.label} {...c} />)}
                </div>

                <DataTable
                    title="All Courses"
                    data={filtered}
                    rowKey={(r) => r.id}
                    filterTabs={[
                        { label: 'All', value: 'All' },
                        { label: 'Published', value: 'Published' },
                        { label: 'Draft', value: 'Draft' },
                    ]}
                    activeFilter={statusFilter}
                    onFilterChange={(v) => setStatusFilter(v as StatusFilter)}
                    columns={[
                        {
                            key: 'title',
                            header: 'Course',
                            render: (r) => (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                        <BookOpen className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">{r.title}</p>
                                        <p className="text-[11px] text-slate-400">{r.category}</p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'instructor', header: 'Instructor', render: (r) => <span className="text-xs">{r.instructor}</span> },
                        { key: 'duration', header: 'Duration', render: (r) => <span className="text-xs">{r.duration}</span> },
                        { key: 'enrolled', header: 'Enrolled', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.enrolled}</span> },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (r) => (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
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
                            <span>Showing {filtered.length} of {courses.length} courses</span>
                        </div>
                    }
                />
            </div>
        </AuthenticatedLayout>
    );
}
