import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    Archive,
    Briefcase,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    Eye,
    GraduationCap,
    Hash,
    Mail,
    MapPin,
    Phone,
    Plus,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';
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
    phone?: string;
    address?: string;
    lastLogin?: string;
};
const initialUsers: UserRow[] = [
    { id: '1', name: 'Ainah Sta. Maria', title: 'HR Manager', employeeId: 'EMP-001', email: 'ainah.stamaria@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'July 10, 2021', color: '#f472b6', phone: '+639565147895', address: 'Caloocan City', lastLogin: 'July 23, 2026 10:30 AM' },
    { id: '2', name: 'Emmanuel Cabanas', title: 'Training Officer', employeeId: 'EMP-002', email: 'emmanuel.cabanas@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'August 12, 2021', color: '#60a5fa', phone: '+639193456789', address: 'Calamba City', lastLogin: 'July 27, 2026 8:02 AM' },
    { id: '3', name: 'Ariana Grande', title: 'Staff', employeeId: 'EMP-003', email: 'ariana.grande@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'May 24, 2022', color: '#38bdf8', phone: '+639171234567', address: 'Quezon City', lastLogin: 'July 26, 2026 9:15 AM' },
    { id: '4', name: 'Mhicaela Buban', title: 'Staff', employeeId: 'EMP-004', email: 'mhicaela.buban@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'July 10, 2022', color: '#fb7185', phone: '+639182345678', address: 'Makati City', lastLogin: 'July 25, 2026 4:40 PM' },
    { id: '5', name: 'Kaye Caagusan', title: 'Staff', employeeId: 'EMP-005', email: 'kaye.caagusan@alibaton.com', role: 'HR', department: 'Human Resources', status: 'Active', dateCreated: 'November 29, 2022', color: '#f87171', phone: '+639204567890', address: 'Pasig City', lastLogin: 'July 24, 2026 2:18 PM' },
    { id: '6', name: 'Bruno Mars', title: 'Trainee', employeeId: 'TRN-001', email: 'bruno.mars@alibaton.com', role: 'Trainee', department: 'Information Technology', status: 'Active', dateCreated: 'January 10, 2023', color: '#fbbf24', phone: '+639215678901', address: 'Manila City', lastLogin: 'July 26, 2026 1:00 PM' },
    { id: '7', name: 'Taylor Swift', title: 'Trainee', employeeId: 'TRN-002', email: 'taylor.swift@alibaton.com', role: 'Trainee', department: 'Finance', status: 'Active', dateCreated: 'March 3, 2026', color: '#a3e635', phone: '+639226789012', address: 'Taguig City', lastLogin: 'July 25, 2026 3:20 PM' },
    { id: '8', name: 'Justin Bieber', title: 'Trainee', employeeId: 'TRN-003', email: 'justin.bieber@alibaton.com', role: 'Trainee', department: 'Operations', status: 'Inactive', dateCreated: 'April 25, 2026', color: '#c084fc', phone: '+639237890123', address: 'Quezon City', lastLogin: 'July 20, 2026 11:10 AM' },
];
const statCards = [
    { label: 'Total Users', value: 120, icon: Users },
    { label: 'Total HR', value: 5, icon: UserCheck },
    { label: 'Total Trainees', value: 112, icon: GraduationCap },
    { label: 'Active Users', value: 115, icon: UserCheck },
];
type StatusFilter = 'All' | 'Active' | 'Inactive';
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
function UserDetailsModal({
    user,
    onClose,
}: {
    user: UserRow;
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
                        User Details
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                        <div
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
                            style={{ backgroundColor: user.color }}
                        >
                            {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-xl font-bold text-white">
                                {user.name}
                            </h2>
                            <p className="mt-0.5 text-sm text-white/60">
                                {user.title}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                        user.status === 'Active'
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-white/10 text-white/50'
                                    }`}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                            user.status === 'Active'
                                                ? 'bg-emerald-400'
                                                : 'bg-white/40'
                                        }`}
                                    />
                                    {user.status}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F4B400]/20 px-3 py-1 text-xs font-semibold text-[#F4B400]">
                                    {user.role} Role
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Contact Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField
                            icon={Hash}
                            label="Employee ID"
                            value={user.employeeId}
                        />
                        <DetailField
                            icon={Mail}
                            label="Email"
                            value={user.email}
                        />
                        <DetailField
                            icon={Phone}
                            label="Phone Number"
                            value={user.phone || '+639171234567'}
                        />
                        <DetailField
                            icon={MapPin}
                            label="Address"
                            value={user.address || 'Quezon City'}
                        />
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Work Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField
                            icon={Briefcase}
                            label="Position / Title"
                            value={user.title}
                        />
                        <DetailField
                            icon={Building2}
                            label="Department"
                            value={user.department}
                        />
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Account Activity
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField
                            icon={Calendar}
                            label="Date Created"
                            value={user.dateCreated}
                        />
                        <DetailField
                            icon={Clock}
                            label="Last Login"
                            value={user.lastLogin || 'July 27, 2026 8:02 AM'}
                        />
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
export default function UserManagement() {
    const [users, setUsers] = useState<UserRow[]>(initialUsers);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [roleFilter, setRoleFilter] = useState<'All Roles' | 'HR' | 'Trainee'>('All Roles');
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [page, setPage] = useState(1);
    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
            const matchesRole = roleFilter === 'All Roles' || user.role === roleFilter;
            return matchesStatus && matchesRole;
        });
    }, [users, statusFilter, roleFilter]);
    const handleArchive = (userToArchive: UserRow) => {
        setUsers((prev) =>
            prev.map((u) =>
                u.id === userToArchive.id ? { ...u, status: 'Inactive' as const } : u
            )
        );
    };
    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">User Management</h1>}>
            <Head title="User Management" />
            {selectedUser && (
                <UserDetailsModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                />
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
                    columns={[
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
                                    <button type="button" onClick={() => handleArchive(u)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-600" aria-label="Archive"><Archive className="h-3.5 w-3.5" /></button>
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