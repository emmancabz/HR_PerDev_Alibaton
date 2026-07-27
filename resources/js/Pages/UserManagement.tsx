import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Eye,
    GraduationCap,
    Pencil,
    Plus,
    UserCheck,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type UserRow = {
    id: string;
    name: string;
    title: string;
    employeeId: string;
    email: string;
    role: 'HR' | 'Trainee';
    department: string;
    status: 'Active' | 'Inactive';
    dateCreated: string;
    color: string;
};

const users: UserRow[] = [
    { id: '1', name: 'Ainah Sta. Maria', title: 'HR Manager', employeeId: 'EMP-001', email: 'ainah.stamaria@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'July 10, 2021', color: '#f472b6' },
    { id: '2', name: 'Emmanuel Cabanas', title: 'Training Officer', employeeId: 'EMP-002', email: 'emmanuel.cabanas@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'August 12, 2021', color: '#60a5fa' },
    { id: '3', name: 'Lisa Montero', title: 'Staff', employeeId: 'EMP-003', email: 'lisa.montero@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'May 24, 2022', color: '#38bdf8' },
    { id: '4', name: 'Mhicaela Buban', title: 'Staff', employeeId: 'EMP-004', email: 'mhicaela.buban@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'July 10, 2022', color: '#fb7185' },
    { id: '5', name: 'Kaye Caagusan', title: 'Staff', employeeId: 'EMP-005', email: 'kaye.caagusan@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'November 29, 2022', color: '#f87171' },
    { id: '6', name: 'Jaylou Cruiz', title: 'Trainee', employeeId: 'TRN-001', email: 'jaylou.cruiz@alibaton.com', role: 'Trainee', department: 'Information Technology', status: 'Active', dateCreated: 'January 10, 2023', color: '#fbbf24' },
    { id: '7', name: 'Daisy Dacula', title: 'Trainee', employeeId: 'TRN-002', email: 'daisy.dacula@alibaton.com', role: 'Trainee', department: 'Finance', status: 'Active', dateCreated: 'March 3, 2026', color: '#a3e635' },
    { id: '8', name: 'Tyron Mararac', title: 'Trainee', employeeId: 'TRN-003', email: 'tyron.mararac@alibaton.com', role: 'Trainee', department: 'Operations', status: 'Inactive', dateCreated: 'April 25, 2026', color: '#c084fc' },
];

const statCards = [
    { label: 'Total Users', value: 120, icon: Users },
    { label: 'Total HR', value: 5, icon: UserCheck },
    { label: 'Total Trainees', value: 112, icon: GraduationCap },
    { label: 'Active Users', value: 115, icon: UserCheck },
];

type StatusFilter = 'All' | 'Active' | 'Inactive';

export default function UserManagement() {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [roleFilter, setRoleFilter] = useState<'All Roles' | 'HR' | 'Trainee'>('All Roles');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [page, setPage] = useState(1);

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
            const matchesRole = roleFilter === 'All Roles' || user.role === roleFilter;
            return matchesStatus && matchesRole;
        });
    }, [statusFilter, roleFilter]);

    const toggleSelectAll = () => {
        setSelectedIds((prev) =>
            prev.length === filteredUsers.length ? [] : filteredUsers.map((u) => u.id),
        );
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">User Management</h1>}>
            <Head title="User Management" />

            {selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: selectedUser.color }}>
                                {selectedUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">{selectedUser.name}</h3>
                                <p className="text-xs text-slate-500">{selectedUser.title}</p>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div><p className="text-slate-500">Employee ID</p><p className="font-semibold text-slate-800">{selectedUser.employeeId}</p></div>
                            <div><p className="text-slate-500">Role</p><p className="font-semibold text-slate-800">{selectedUser.role}</p></div>
                            <div className="col-span-2"><p className="text-slate-500">Email</p><p className="font-semibold text-slate-800">{selectedUser.email}</p></div>
                            <div><p className="text-slate-500">Department</p><p className="font-semibold text-slate-800">{selectedUser.department}</p></div>
                            <div><p className="text-slate-500">Status</p><p className="font-semibold text-slate-800">{selectedUser.status}</p></div>
                        </div>
                        <button onClick={() => setSelectedUser(null)} className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
                    </div>
                </div>
            )}

            {showAdd && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-900">Add User</h3>
                        <div className="mt-4 space-y-3">
                            <input placeholder="Full name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30" />
                            <input placeholder="Email" type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" />
                            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>HR</option><option>Trainee</option></select>
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
                    title="User Management"
                    description="Manage HR and Trainee accounts"
                    actions={
                        <>
                            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none">
                                <option>All Roles</option>
                                <option value="HR">HR</option>
                                <option value="Trainee">Trainee</option>
                            </select>
                            <button type="button" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]">
                                <Plus className="h-3.5 w-3.5" /> Add User
                            </button>
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statCards.map((c) => <StatCard key={c.label} {...c} />)}
                </div>

                <DataTable
                    title="All Users"
                    data={filteredUsers}
                    rowKey={(u) => u.id}
                    filterTabs={[
                        { label: 'All', value: 'All' },
                        { label: 'Active', value: 'Active' },
                        { label: 'Inactive', value: 'Inactive' },
                    ]}
                    activeFilter={statusFilter}
                    onFilterChange={(v) => setStatusFilter(v as StatusFilter)}
                    headerExtra={
                        selectedIds.length > 0 && (
                            <span className="text-[11px] font-medium text-slate-500">{selectedIds.length} selected</span>
                        )
                    }
                    columns={[
                        {
                            key: 'select',
                            header: '',
                            className: 'w-8',
                            render: (u) => (
                                <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleSelectOne(u.id)} className="rounded border-slate-300 text-[#F4B400] focus:ring-[#F4B400]" />
                            ),
                        },
                        {
                            key: 'user',
                            header: 'User',
                            render: (u) => (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: u.color }}>
                                        {u.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-800">{u.name}</p>
                                        <p className="truncate text-[11px] text-slate-400">{u.title}</p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'id', header: 'Employee ID', render: (u) => <span className="text-xs tabular-nums">{u.employeeId}</span> },
                        { key: 'email', header: 'Email', render: (u) => <span className="text-xs">{u.email}</span> },
                        {
                            key: 'role',
                            header: 'Role',
                            render: (u) => (
                                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${u.role === 'HR' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                            ),
                        },
                        { key: 'dept', header: 'Department', render: (u) => <span className="text-xs">{u.department}</span> },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (u) => (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    <span className={`h-1 w-1 rounded-full ${u.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />
                                    {u.status}
                                </span>
                            ),
                        },
                        { key: 'date', header: 'Created', render: (u) => <span className="text-xs">{u.dateCreated}</span> },
                        {
                            key: 'action',
                            header: 'Action',
                            render: (u) => (
                                <div className="flex items-center gap-0.5">
                                    <button type="button" onClick={() => setSelectedUser(u)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View"><Eye className="h-3.5 w-3.5" /></button>
                                    <button type="button" onClick={() => setSelectedUser(u)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                                </div>
                            ),
                        },
                    ]}
                    footer={
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Showing 1 to {filteredUsers.length} of 120 users</span>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded p-1 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                                {[1, 2, 3].map((p) => (
                                    <button key={p} type="button" onClick={() => setPage(p)} className={`h-6 w-6 rounded text-[11px] font-semibold ${page === p ? 'bg-[#F4B400] text-black' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
                                ))}
                                <button type="button" onClick={() => setPage((p) => p + 1)} className="rounded p-1 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
                            </div>
                        </div>
                    }
                />
            </div>
        </AuthenticatedLayout>
    );
}
