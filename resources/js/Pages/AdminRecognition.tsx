import DataTable from '@/Components/DataTable';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import {
    Award,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Clock,
    Hash,
    Lightbulb,
    Mail,
    MapPin,
    Phone,
    Plus,
    Shield,
    Sparkles,
    Trophy,
    Users,
    X,
    XCircle
} from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';
type RecognitionCategory =
    | 'Performance Excellence'
    | 'Teamwork & Collaboration'
    | 'Leadership'
    | 'Innovation'
    | 'Learning & Development'
    | 'Safety & Compliance';
type RecognitionStatus = 'Pending Review' | 'Recognized' | 'Declined';
type RecognitionRecord = {
    id: string;
    recipient: string;
    position: string;
    department: string;
    title: string;
    category: RecognitionCategory;
    recognizedBy: string;
    recognizedByRole: string;
    date: string;
    month: string;
    status: RecognitionStatus;
    color: string;
    note?: string;
    declineReason?: string;
    employeeId?: string;
    phone?: string;
    email?: string;
    address?: string;
    dateCreatedProfile?: string;
    lastLogin?: string;
};
type MockEmployee = {
    id: string;
    name: string;
    position: string;
    department: string;
    color: string;
    employeeId: string;
    phone: string;
    email: string;
    address: string;
    dateCreatedProfile: string;
    lastLogin: string;
};
const MOCK_EMPLOYEES: MockEmployee[] = [
    { id: 'e1', name: 'Bruno Mars', position: 'IT Trainee', department: 'Information Technology', color: '#fbbf24', employeeId: 'EMP-002', phone: '+639171234567', email: 'bruno.mars@alibaton.com', address: 'Quezon City', dateCreatedProfile: 'July 12, 2021', lastLogin: 'July 26, 2026 9:15 AM' },
    { id: 'e2', name: 'Taylor Swift', position: 'Finance Trainee', department: 'Finance', color: '#a3e635', employeeId: 'EMP-003', phone: '+639182345678', email: 'taylor.swift@alibaton.com', address: 'Makati City', dateCreatedProfile: 'August 3, 2021', lastLogin: 'July 25, 2026 4:40 PM' },
    { id: 'e3', name: 'Justin Bieber', position: 'Operations Staff', department: 'Operations', color: '#c084fc', employeeId: 'EMP-004', phone: '+639193456789', email: 'justin.bieber@alibaton.com', address: 'Calamba City', dateCreatedProfile: 'September 15, 2021', lastLogin: 'July 27, 2026 8:02 AM' },
    { id: 'e4', name: 'Jemarie Cuesta', position: 'Operations Manager', department: 'Operations', color: '#38bdf8', employeeId: 'EMP-005', phone: '+639204567890', email: 'jemarie.cuesta@alibaton.com', address: 'Pasig City', dateCreatedProfile: 'October 1, 2021', lastLogin: 'July 24, 2026 2:18 PM' },
    { id: 'e5', name: 'Rico Blanco', position: 'Site Engineer', department: 'Engineering', color: '#fb923c', employeeId: 'EMP-006', phone: '+639215678901', email: 'rico.blanco@alibaton.com', address: 'Manila City', dateCreatedProfile: 'November 5, 2021', lastLogin: 'July 22, 2026 11:10 AM' },
    { id: 'e6', name: 'Lana Del Rey', position: 'Operations Staff', department: 'Operations', color: '#fb7185', employeeId: 'EMP-007', phone: '+639226789012', email: 'lana.delrey@alibaton.com', address: 'Taguig City', dateCreatedProfile: 'December 1, 2021', lastLogin: 'July 27, 2026 1:00 PM' },
    { id: 'e7', name: 'Avril Lavigne', position: 'Operations Staff', department: 'Operations', color: '#f87171', employeeId: 'EMP-008', phone: '+639237890123', email: 'avril.lavigne@alibaton.com', address: 'Quezon City', dateCreatedProfile: 'January 10, 2022', lastLogin: 'July 20, 2026 11:10 AM' },
    { id: 'e8', name: 'Juan Karlos', position: 'Procurement Officer', department: 'Procurement', color: '#34d399', employeeId: 'EMP-009', phone: '+639248901234', email: 'juan.karlos@alibaton.com', address: 'San Juan City', dateCreatedProfile: 'February 15, 2022', lastLogin: 'July 26, 2026 10:00 AM' },
    { id: 'e9', name: 'Ainah Sta. Maria', position: 'HR Manager', department: 'Human Resources', color: '#818cf8', employeeId: 'EMP-001', phone: '+639565147895', email: 'ainah.stamaria@alibaton.com', address: 'Caloocan City', dateCreatedProfile: 'July 10, 2021', lastLogin: 'July 23, 2026 10:30 AM' },
    { id: 'e10', name: 'Jovan Saldua', position: 'Fleet Coordinator', department: 'Operations', color: '#fbbf24', employeeId: 'EMP-010', phone: '+639259012345', email: 'jovan.saldua@alibaton.com', address: 'Quezon City', dateCreatedProfile: 'March 11, 2022', lastLogin: 'July 25, 2026 9:00 AM' },
    { id: 'e11', name: 'Charlie Puth', position: 'Finance Manager', department: 'Finance', color: '#60a5fa', employeeId: 'EMP-011', phone: '+639260123456', email: 'charlie.puth@alibaton.com', address: 'Makati City', dateCreatedProfile: 'April 12, 2022', lastLogin: 'July 26, 2026 2:00 PM' },
    { id: 'e12', name: 'Regine Velasquez', position: 'Safety Officer', department: 'Safety & Compliance', color: '#f472b6', employeeId: 'EMP-012', phone: '+639271234567', email: 'regine.velasquez@alibaton.com', address: 'Quezon City', dateCreatedProfile: 'May 13, 2022', lastLogin: 'July 27, 2026 3:00 PM' },
    { id: 'e13', name: 'Zack Tubudlo', position: 'Project Manager', department: 'Operations', color: '#2dd4bf', employeeId: 'EMP-013', phone: '+639282345678', email: 'zack.tubudlo@alibaton.com', address: 'Pasig City', dateCreatedProfile: 'June 14, 2022', lastLogin: 'July 24, 2026 4:00 PM' },
    { id: 'e14', name: 'Kaye Caagusan', position: 'Operations Staff', department: 'Operations', color: '#a78bfa', employeeId: 'EMP-014', phone: '+639293456789', email: 'kaye.caagusan@alibaton.com', address: 'Mandaluyong City', dateCreatedProfile: 'July 15, 2022', lastLogin: 'July 23, 2026 5:00 PM' },
];
const INITIAL_RECOGNITIONS: RecognitionRecord[] = [
    {
        id: '1',
        recipient: 'Bruno Mars',
        position: 'IT Trainee',
        department: 'Information Technology',
        title: 'Outstanding Support During System Migration',
        category: 'Innovation',
        recognizedBy: 'Ainah Sta. Maria',
        recognizedByRole: 'HR Manager',
        date: 'August 1, 2026',
        month: 'August 2026',
        status: 'Recognized',
        color: '#fbbf24',
        note: 'Went beyond scope to keep the migration on schedule and documented the fix for the team.',
        employeeId: 'EMP-002',
        phone: '+639171234567',
        email: 'bruno.mars@alibaton.com',
        address: 'Quezon City',
        dateCreatedProfile: 'July 12, 2021',
        lastLogin: 'July 26, 2026 9:15 AM',
    },
    {
        id: '2',
        recipient: 'Taylor Swift',
        position: 'Finance Trainee',
        department: 'Finance',
        title: 'Exceptional Collaboration on Year-End Audit',
        category: 'Teamwork & Collaboration',
        recognizedBy: 'Charlie Puth',
        recognizedByRole: 'Finance Manager',
        date: 'July 28, 2026',
        month: 'July 2026',
        status: 'Recognized',
        color: '#a3e635',
        note: 'Coordinated closely with three departments to close the audit ahead of deadline.',
        employeeId: 'EMP-003',
        phone: '+639182345678',
        email: 'taylor.swift@alibaton.com',
        address: 'Makati City',
        dateCreatedProfile: 'August 3, 2021',
        lastLogin: 'July 25, 2026 4:40 PM',
    },
    {
        id: '3',
        recipient: 'Justin Bieber',
        position: 'Operations Staff',
        department: 'Operations',
        title: 'Consistent Safety Compliance on Site',
        category: 'Safety & Compliance',
        recognizedBy: 'Regine Velasquez',
        recognizedByRole: 'Safety Officer',
        date: 'July 22, 2026',
        month: 'July 2026',
        status: 'Recognized',
        color: '#c084fc',
        note: 'Zero safety incidents on-site for two consecutive quarters under his watch.',
        employeeId: 'EMP-004',
        phone: '+639193456789',
        email: 'justin.bieber@alibaton.com',
        address: 'Calamba City',
        dateCreatedProfile: 'September 15, 2021',
        lastLogin: 'July 27, 2026 8:02 AM',
    },
    {
        id: '4',
        recipient: 'Jemarie Cuesta',
        position: 'Operations Manager',
        department: 'Operations',
        title: 'Led Successful Process Improvement Initiative',
        category: 'Leadership',
        recognizedBy: 'Zack Tubudlo',
        recognizedByRole: 'Project Manager',
        date: 'July 15, 2026',
        month: 'July 2026',
        status: 'Recognized',
        color: '#38bdf8',
        note: 'Redesigned the equipment dispatch process, cutting turnaround time noticeably.',
        employeeId: 'EMP-005',
        phone: '+639204567890',
        email: 'jemarie.cuesta@alibaton.com',
        address: 'Pasig City',
        dateCreatedProfile: 'October 1, 2021',
        lastLogin: 'July 24, 2026 2:18 PM',
    },
    {
        id: '5',
        recipient: 'Rico Blanco',
        position: 'Site Engineer',
        department: 'Engineering',
        title: 'Completed Advanced Structural Safety Training',
        category: 'Learning & Development',
        recognizedBy: 'Regine Velasquez',
        recognizedByRole: 'Safety Officer',
        date: 'July 10, 2026',
        month: 'July 2026',
        status: 'Recognized',
        color: '#fb923c',
        note: 'Completed certification a full quarter ahead of the training plan.',
        employeeId: 'EMP-006',
        phone: '+639215678901',
        email: 'rico.blanco@alibaton.com',
        address: 'Manila City',
        dateCreatedProfile: 'November 5, 2021',
        lastLogin: 'July 22, 2026 11:10 AM',
    },
    {
        id: '6',
        recipient: 'Lana Del Rey',
        position: 'Operations Staff',
        department: 'Operations',
        title: 'Went Above and Beyond During Client Site Visit',
        category: 'Performance Excellence',
        recognizedBy: 'Mhicaela Buban',
        recognizedByRole: 'Staff',
        date: 'August 1, 2026',
        month: 'August 2026',
        status: 'Pending Review',
        color: '#fb7185',
        note: 'Client specifically called out her professionalism and quick problem-solving on-site.',
        employeeId: 'EMP-007',
        phone: '+639226789012',
        email: 'lana.delrey@alibaton.com',
        address: 'Taguig City',
        dateCreatedProfile: 'December 1, 2021',
        lastLogin: 'July 27, 2026 1:00 PM',
    },
    {
        id: '7',
        recipient: 'Avril Lavigne',
        position: 'Operations Staff',
        department: 'Operations',
        title: 'Innovative Equipment Maintenance Solution',
        category: 'Innovation',
        recognizedBy: 'Kaye Caagusan',
        recognizedByRole: 'Staff',
        date: 'July 30, 2026',
        month: 'July 2026',
        status: 'Pending Review',
        color: '#f87171',
        note: 'Devised a low-cost fix for recurring equipment downtime.',
        employeeId: 'EMP-008',
        phone: '+639237890123',
        email: 'avril.lavigne@alibaton.com',
        address: 'Quezon City',
        dateCreatedProfile: 'January 10, 2022',
        lastLogin: 'July 20, 2026 11:10 AM',
    },
    {
        id: '8',
        recipient: 'Juan Karlos',
        position: 'Procurement Officer',
        department: 'Procurement',
        title: 'Negotiated Cost-Saving Vendor Contract',
        category: 'Performance Excellence',
        recognizedBy: 'Jemarie Cuesta',
        recognizedByRole: 'Operations Manager',
        date: 'June 25, 2026',
        month: 'June 2026',
        status: 'Recognized',
        color: '#34d399',
        note: 'Renegotiated the fuel supply contract for meaningful year-over-year savings.',
        employeeId: 'EMP-009',
        phone: '+639248901234',
        email: 'juan.karlos@alibaton.com',
        address: 'San Juan City',
        dateCreatedProfile: 'February 15, 2022',
        lastLogin: 'July 26, 2026 10:00 AM',
    },
    {
        id: '9',
        recipient: 'Ainah Sta. Maria',
        position: 'HR Manager',
        department: 'Human Resources',
        title: 'Outstanding Mentorship of New Trainees',
        category: 'Leadership',
        recognizedBy: 'Emmanuel Cabanas',
        recognizedByRole: 'Training Officer',
        date: 'June 18, 2026',
        month: 'June 2026',
        status: 'Recognized',
        color: '#818cf8',
        note: 'Onboarded and mentored five new trainees this quarter with strong retention.',
        employeeId: 'EMP-001',
        phone: '+639565147895',
        email: 'ainah.stamaria@alibaton.com',
        address: 'Caloocan City',
        dateCreatedProfile: 'July 10, 2021',
        lastLogin: 'July 23, 2026 10:30 AM',
    },
    {
        id: '10',
        recipient: 'Jovan Saldua',
        position: 'Fleet Coordinator',
        department: 'Operations',
        title: 'Reliable Fleet Uptime Management',
        category: 'Performance Excellence',
        recognizedBy: 'Jemarie Cuesta',
        recognizedByRole: 'Operations Manager',
        date: 'August 2, 2026',
        month: 'August 2026',
        status: 'Pending Review',
        color: '#fbbf24',
        note: 'Maintained fleet availability above target throughout the quarter.',
        employeeId: 'EMP-010',
        phone: '+639259012345',
        email: 'jovan.saldua@alibaton.com',
        address: 'Quezon City',
        dateCreatedProfile: 'March 11, 2022',
        lastLogin: 'July 25, 2026 9:00 AM',
    },
];
const TREND_DATA: { month: string; count: number }[] = [
    { month: 'Feb', count: 3 },
    { month: 'Mar', count: 5 },
    { month: 'Apr', count: 4 },
    { month: 'May', count: 6 },
    { month: 'Jun', count: 7 },
    { month: 'Jul', count: 9 },
    { month: 'Aug', count: 6 },
];
const CATEGORIES: RecognitionCategory[] = [
    'Performance Excellence',
    'Teamwork & Collaboration',
    'Leadership',
    'Innovation',
    'Learning & Development',
    'Safety & Compliance',
];
const CATEGORY_META: Record<RecognitionCategory, { badge: string; dot: string; icon: typeof Trophy }> = {
    'Performance Excellence': { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400', icon: Trophy },
    'Teamwork & Collaboration': { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400', icon: Users },
    Leadership: { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400', icon: Award },
    Innovation: { badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-400', icon: Lightbulb },
    'Learning & Development': { badge: 'bg-green-100 text-green-700', dot: 'bg-green-400', icon: Sparkles },
    'Safety & Compliance': { badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-400', icon: Shield },
};
const PERIOD_OPTIONS = ['All Periods', 'June 2026', 'July 2026', 'August 2026'];
function statusBadgeClass(status: RecognitionStatus) {
    switch (status) {
        case 'Recognized':
            return 'bg-green-100 text-green-700';
        case 'Pending Review':
            return 'bg-amber-100 text-amber-700';
        case 'Declined':
            return 'bg-slate-200 text-slate-600';
    }
}
function statusDotClass(status: RecognitionStatus) {
    switch (status) {
        case 'Recognized':
            return 'bg-green-500';
        case 'Pending Review':
            return 'bg-amber-500';
        case 'Declined':
            return 'bg-slate-400';
    }
}
function initialsOf(name: string) {
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('');
}
function todayForForm() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}
function formatDisplayDate(isoDate: string) {
    if (!isoDate) return '';
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function formatMonthKey(isoDate: string) {
    if (!isoDate) return '';
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
function RecognitionDetailsModal({
    selected,
    onClose,
    onApprove,
    onStartDecline,
    decliningId,
    declineReasonDraft,
    setDeclineReasonDraft,
    onConfirmDecline,
    setDecliningId,
}: {
    selected: RecognitionRecord;
    onClose: () => void;
    onApprove: (id: string) => void;
    onStartDecline: (id: string) => void;
    decliningId: string | null;
    declineReasonDraft: string;
    setDeclineReasonDraft: (v: string) => void;
    onConfirmDecline: (id: string) => void;
    setDecliningId: (v: string | null) => void;
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
                        Recognition Details
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                        <div
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
                            style={{ backgroundColor: selected.color }}
                        >
                            {initialsOf(selected.recipient)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-xl font-bold text-white">
                                {selected.recipient}
                            </h2>
                            <p className="mt-0.5 text-sm text-white/60">
                                {selected.position} · {selected.department}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                        selected.status === 'Recognized'
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : selected.status === 'Pending Review'
                                            ? 'bg-amber-500/20 text-amber-300'
                                            : 'bg-white/10 text-white/50'
                                    }`}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                            selected.status === 'Recognized'
                                                ? 'bg-emerald-400'
                                                : selected.status === 'Pending Review'
                                                ? 'bg-amber-400'
                                                : 'bg-white/40'
                                        }`}
                                    />
                                    {selected.status}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F4B400]/20 px-3 py-1 text-xs font-semibold text-[#F4B400]">
                                    {selected.category}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100 shadow-sm space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Recognition Achievement
                        </p>
                        <p className="text-sm font-bold text-slate-900">{selected.title}</p>
                        {selected.note && <p className="text-xs leading-relaxed text-slate-600">{selected.note}</p>}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField icon={Award} label="Recognized By" value={`${selected.recognizedBy} (${selected.recognizedByRole})`} />
                        <DetailField icon={Calendar} label="Date Recognized" value={selected.date} />
                    </div>
                    {selected.status === 'Declined' && selected.declineReason && (
                        <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100 text-xs">
                            <p className="font-semibold text-rose-700">Decline Reason</p>
                            <p className="mt-1 text-rose-600">{selected.declineReason}</p>
                        </div>
                    )}
                    <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Contact Information
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField icon={Hash} label="Employee ID" value={selected.employeeId || 'EMP-002'} />
                        <DetailField icon={Mail} label="Email" value={selected.email || `${selected.recipient.toLowerCase().replace(/\s+/g, '.')}\@alibaton.com`} />
                        <DetailField icon={Phone} label="Phone Number" value={selected.phone || '+639171234567'} />
                        <DetailField icon={MapPin} label="Address" value={selected.address || 'Quezon City'} />
                    </div>
                    <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Account Activity
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailField icon={Calendar} label="Date Created" value={selected.dateCreatedProfile || 'July 12, 2021'} />
                        <DetailField icon={Clock} label="Last Login" value={selected.lastLogin || 'July 26, 2026 9:15 AM'} />
                    </div>
                    {selected.status === 'Pending Review' && (
                        <div className="mt-4 rounded-xl bg-amber-50/60 p-4 ring-1 ring-amber-200/60">
                            <p className="text-xs font-bold text-amber-900 mb-2">Review Required</p>
                            {decliningId === selected.id ? (
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-medium text-slate-600">Reason for declining (optional)</label>
                                    <textarea
                                        value={declineReasonDraft}
                                        onChange={(e) => setDeclineReasonDraft(e.target.value)}
                                        rows={2}
                                        placeholder="e.g. Needs more supporting context"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#F4B400] focus:outline-none"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setDecliningId(null)}
                                            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => onConfirmDecline(selected.id)}
                                            className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                                        >
                                            Confirm Decline
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onStartDecline(selected.id)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                                    >
                                        <XCircle className="h-4 w-4 text-rose-500" /> Decline
                                    </button>
                                    <button
                                        onClick={() => onApprove(selected.id)}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300] shadow-sm"
                                    >
                                        <CheckCircle2 className="h-4 w-4" /> Approve & Recognize
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
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
function RecognitionTrendChart({ data }: { data: { month: string; count: number }[] }) {
    const width = 520;
    const height = 180;
    const padding = { top: 12, right: 8, bottom: 24, left: 24 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const barGap = 10;
    const barWidth = innerW / data.length - barGap;
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
            {[0.25, 0.5, 0.75, 1].map((f) => (
                <line
                    key={f}
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={padding.top + innerH * (1 - f)}
                    y2={padding.top + innerH * (1 - f)}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                />
            ))}
            {data.map((d, i) => {
                const barHeight = (d.count / max) * innerH;
                const x = padding.left + i * (barWidth + barGap);
                const y = padding.top + innerH - barHeight;
                const isLast = i === data.length - 1;
                return (
                    <g key={d.month}>
                        <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill={isLast ? '#F4B400' : '#fde9ad'}
                        />
                        <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 9, fontWeight: 600 }}>
                            {d.count}
                        </text>
                        <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9 }}>
                            {d.month}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
export default function SocialRecognition() {
    const currentUser = usePage().props.auth?.user;
    const [recognitions, setRecognitions] = useState<RecognitionRecord[]>(INITIAL_RECOGNITIONS);
    const [departmentFilter, setDepartmentFilter] = useState('All Departments');
    const [categoryFilter, setCategoryFilter] = useState<'All Categories' | RecognitionCategory>('All Categories');
    const [periodFilter, setPeriodFilter] = useState('All Periods');
    const [statusFilter, setStatusFilter] = useState<'All' | RecognitionStatus>('All');
    const [selected, setSelected] = useState<RecognitionRecord | null>(null);
    const [decliningId, setDecliningId] = useState<string | null>(null);
    const [declineReasonDraft, setDeclineReasonDraft] = useState('');
    const [showAllRecent, setShowAllRecent] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const departments = useMemo(
        () => Array.from(new Set(recognitions.map((r) => r.department))),
        [recognitions],
    );
    const filtered = useMemo(() => {
        return recognitions.filter((r) => {
            const matchesDept = departmentFilter === 'All Departments' || r.department === departmentFilter;
            const matchesCategory = categoryFilter === 'All Categories' || r.category === categoryFilter;
            const matchesPeriod = periodFilter === 'All Periods' || r.month === periodFilter;
            const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
            return matchesDept && matchesCategory && matchesPeriod && matchesStatus;
        });
    }, [recognitions, departmentFilter, categoryFilter, periodFilter, statusFilter]);
    const totalRecognitions = recognitions.length;
    const thisMonthCount = recognitions.filter((r) => r.month === 'August 2026').length;
    const employeesRecognized = new Set(
        recognitions.filter((r) => r.status === 'Recognized').map((r) => r.recipient),
    ).size;
    const pendingReviewCount = recognitions.filter((r) => r.status === 'Pending Review').length;
    const categoryCounts = useMemo(() => {
        return CATEGORIES.map((c) => ({
            category: c,
            count: recognitions.filter((r) => r.category === c).length,
        }));
    }, [recognitions]);
    const departmentCounts = useMemo(() => {
        const counts = departments.map((d) => ({
            department: d,
            count: recognitions.filter((r) => r.department === d).length,
        }));
        return counts.sort((a, b) => b.count - a.count);
    }, [recognitions, departments]);
    const maxDeptCount = Math.max(...departmentCounts.map((d) => d.count), 1);
    const recentRecognitions = useMemo(
        () => [...recognitions].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 4),
        [recognitions],
    );
    function approveRecognition(id: string) {
        setRecognitions((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'Recognized' as const } : r)));
        setSelected((prev) => (prev && prev.id === id ? { ...prev, status: 'Recognized' } : prev));
    }
    function startDecline(id: string) {
        setDecliningId(id);
        setDeclineReasonDraft('');
    }
    function confirmDecline(id: string) {
        setRecognitions((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: 'Declined' as const, declineReason: declineReasonDraft.trim() || undefined } : r)),
        );
        setSelected((prev) => (prev && prev.id === id ? { ...prev, status: 'Declined', declineReason: declineReasonDraft.trim() || undefined } : prev));
        setDecliningId(null);
        setDeclineReasonDraft('');
    }
    type CreateForm = {
        employeeId: string;
        title: string;
        category: RecognitionCategory;
        note: string;
        date: string;
        reviewerRole: string;
        publishNow: boolean;
    };
    const emptyForm = (): CreateForm => ({
        employeeId: '',
        title: '',
        category: 'Performance Excellence',
        note: '',
        date: todayForForm(),
        reviewerRole: '',
        publishNow: false,
    });
    const [form, setForm] = useState<CreateForm>(emptyForm());
    function openCreateForm() {
        setForm(emptyForm());
        setShowCreateForm(true);
    }
    function closeCreateForm() {
        setShowCreateForm(false);
    }
    const selectedEmployee = MOCK_EMPLOYEES.find((e) => e.id === form.employeeId) || null;
    const canSubmitCreate = !!selectedEmployee && form.title.trim().length > 0 && !!form.date;
    function handleCreateSubmit() {
        if (!selectedEmployee || !canSubmitCreate) return;
        const newRecord: RecognitionRecord = {
            id: `${Date.now()}`,
            recipient: selectedEmployee.name,
            position: selectedEmployee.position,
            department: selectedEmployee.department,
            title: form.title.trim(),
            category: form.category,
            recognizedBy: currentUser?.name || 'HR/Admin',
            recognizedByRole: form.reviewerRole.trim() || 'HR/Admin',
            date: formatDisplayDate(form.date),
            month: formatMonthKey(form.date),
            status: form.publishNow ? 'Recognized' : 'Pending Review',
            color: selectedEmployee.color,
            note: form.note.trim() || undefined,
            employeeId: selectedEmployee.employeeId,
            phone: selectedEmployee.phone,
            email: selectedEmployee.email,
            address: selectedEmployee.address,
            dateCreatedProfile: selectedEmployee.dateCreatedProfile,
            lastLogin: selectedEmployee.lastLogin,
        };
        setRecognitions((prev) => [newRecord, ...prev]);
        setShowCreateForm(false);
    }
    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-lg font-bold text-slate-900">
                    Social Recognition
                </h1>
            }
        >
            <Head title="Social Recognition" />
            {selected && (
                <RecognitionDetailsModal
                    selected={selected}
                    onClose={() => {
                        setSelected(null);
                        setDecliningId(null);
                    }}
                    onApprove={approveRecognition}
                    onStartDecline={startDecline}
                    decliningId={decliningId}
                    declineReasonDraft={declineReasonDraft}
                    setDeclineReasonDraft={setDeclineReasonDraft}
                    onConfirmDecline={confirmDecline}
                    setDecliningId={setDecliningId}
                />
            )}
            {showAllRecent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowAllRecent(false)}>
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">Recent Recognitions</h3>
                            <button onClick={() => setShowAllRecent(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-3 space-y-1">
                            {[...recognitions].sort((a, b) => Number(b.id) - Number(a.id)).map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => {
                                        setShowAllRecent(false);
                                        setSelected(r);
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: r.color }}>
                                            {initialsOf(r.recipient)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold text-slate-800">{r.recipient}</p>
                                            <p className="truncate text-[11px] text-slate-400">{r.title}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_META[r.category].badge}`}>
                                        {r.category}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {showCreateForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={closeCreateForm}>
                    <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-[#F4B400]" />
                                <h3 className="text-sm font-bold text-slate-900">Create Recognition</h3>
                            </div>
                            <button onClick={closeCreateForm} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">Recipient</label>
                                <select
                                    value={form.employeeId}
                                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                                >
                                    <option value="">Select employee...</option>
                                    {MOCK_EMPLOYEES.map((e) => (
                                        <option key={e.id} value={e.id}>{e.name} — {e.position}</option>
                                    ))}
                                </select>
                                {selectedEmployee && (
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        {selectedEmployee.position} · {selectedEmployee.department}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">Recognition Title</label>
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g. Outstanding Client Handling"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">Category</label>
                                <select
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value as RecognitionCategory })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                                >
                                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                                    Achievement Details <span className="text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    value={form.note}
                                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                                    rows={3}
                                    placeholder="Briefly describe the contribution or achievement"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Date</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                                        Your Role/Title <span className="text-slate-400">(optional)</span>
                                    </label>
                                    <input
                                        value={form.reviewerRole}
                                        onChange={(e) => setForm({ ...form, reviewerRole: e.target.value })}
                                        placeholder="HR/Admin"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                    />
                                </div>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-3">
                                <label className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.publishNow}
                                        onChange={(e) => setForm({ ...form, publishNow: e.target.checked })}
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#F4B400] focus:ring-[#F4B400]"
                                    />
                                    <span className="text-xs text-slate-600">
                                        <span className="font-semibold text-slate-800">Publish immediately as Recognized.</span>{' '}
                                        Leave unchecked to save as Pending Review for a second look before it's published.
                                    </span>
                                </label>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <button onClick={closeCreateForm} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateSubmit}
                                disabled={!canSubmitCreate}
                                className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {form.publishNow ? 'Publish Recognition' : 'Save as Pending Review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-4">
                <PageHeader
                    title="Social Recognition"
                    description="Track and review employee recognitions across the organization"
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
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value as 'All Categories' | RecognitionCategory)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                            >
                                <option>All Categories</option>
                                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                            <select
                                value={periodFilter}
                                onChange={(e) => setPeriodFilter(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-[#F4B400] focus:outline-none"
                            >
                                {PERIOD_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                            </select>
                            <button
                                type="button"
                                onClick={openCreateForm}
                                className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#dba300]"
                            >
                                <Plus className="h-3.5 w-3.5" /> Create Recognition
                            </button>
                        </>
                    }
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Total Recognitions" value={totalRecognitions} icon={Trophy} />
                    <StatCard label="This Month" value={thisMonthCount} icon={Clock} />
                    <StatCard label="Employees Recognized" value={employeesRecognized} icon={Users} />
                    <StatCard label="Pending Review" value={pendingReviewCount} icon={Award} />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Recognition Trend</h2>
                            <p className="text-[11px] text-slate-400">Monthly recognition volume</p>
                        </div>
                        <div className="mt-3">
                            <RecognitionTrendChart data={TREND_DATA} />
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-[#F4B400]" />
                            <h2 className="text-sm font-bold text-slate-900">Recognition by Department</h2>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">Where recognitions are coming from</p>
                        <div className="mt-3 space-y-2.5">
                            {departmentCounts.map((d) => (
                                <div key={d.department}>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-600">{d.department}</span>
                                        <span className="font-semibold text-slate-800">{d.count}</span>
                                    </div>
                                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full bg-[#F4B400]"
                                            style={{ width: `${(d.count / maxDeptCount) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                            <Trophy className="h-4 w-4 text-[#F4B400]" />
                            <h2 className="text-sm font-bold text-slate-900">Recent Recognitions</h2>
                        </div>
                        <div className="mt-3 space-y-1">
                            {recentRecognitions.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelected(r)}
                                    className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left hover:bg-slate-50"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: r.color }}>
                                            {initialsOf(r.recipient)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold text-slate-800">{r.recipient}</p>
                                            <p className="truncate text-[11px] text-slate-400">{r.title}</p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-slate-400">{r.date}</span>
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAllRecent(true)}
                            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            View All <ChevronRight className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-1.5">
                            <Award className="h-4 w-4 text-[#F4B400]" />
                            <h2 className="text-sm font-bold text-slate-900">Recognition Categories</h2>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">Recognized behaviors this period</p>
                        <div className="mt-3 space-y-1.5">
                            {categoryCounts.map(({ category, count }) => {
                                const meta = CATEGORY_META[category];
                                const Icon = meta.icon;
                                return (
                                    <button
                                        key={category}
                                        onClick={() => setCategoryFilter(category)}
                                        className="flex w-full items-center justify-between rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.badge}`}>
                                                <Icon className="h-3 w-3" />
                                            </span>
                                            <span className="text-xs text-slate-700">{category}</span>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-800">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <DataTable
                    title="Recognition Activity"
                    data={filtered}
                    rowKey={(r) => r.id}
                    onRowClick={(r) => setSelected(r)}
                    filterTabs={[
                        { label: 'All', value: 'All' },
                        { label: 'Recognized', value: 'Recognized' },
                        { label: 'Pending Review', value: 'Pending Review' },
                        { label: 'Declined', value: 'Declined' },
                    ]}
                    activeFilter={statusFilter}
                    onFilterChange={(v) => setStatusFilter(v as 'All' | RecognitionStatus)}
                    columns={[
                        {
                            key: 'recipient',
                            header: 'Recipient',
                            render: (r) => (
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: r.color }}>
                                        {initialsOf(r.recipient)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800">{r.recipient}</p>
                                        <p className="text-[11px] text-slate-400">{r.position}</p>
                                    </div>
                                </div>
                            ),
                        },
                        { key: 'department', header: 'Department', render: (r) => <span className="text-xs">{r.department}</span> },
                        {
                            key: 'title',
                            header: 'Recognition',
                            render: (r) => <span className="text-xs text-slate-700">{r.title}</span>,
                        },
                        {
                            key: 'category',
                            header: 'Category',
                            render: (r) => (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_META[r.category].badge}`}>
                                    {r.category}
                                </span>
                            ),
                        },
                        {
                            key: 'recognizedBy',
                            header: 'Recognized By',
                            render: (r) => (
                                <div>
                                    <p className="text-xs text-slate-700">{r.recognizedBy}</p>
                                    <p className="text-[11px] text-slate-400">{r.recognizedByRole}</p>
                                </div>
                            ),
                        },
                        { key: 'date', header: 'Date', className: 'tabular-nums', render: (r) => <span className="text-xs">{r.date}</span> },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (r) => (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(r.status)}`}>
                                    <span className={`h-1 w-1 rounded-full ${statusDotClass(r.status)}`} />
                                    {r.status}
                                </span>
                            ),
                        },
                    ]}
                    footer={
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Showing {filtered.length} of {totalRecognitions} recognitions</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setDepartmentFilter('All Departments');
                                    setCategoryFilter('All Categories');
                                    setPeriodFilter('All Periods');
                                    setStatusFilter('All');
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