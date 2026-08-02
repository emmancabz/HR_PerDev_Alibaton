import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    Archive,
    BarChart3,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    Copy,
    Eye,
    FileBarChart,
    Filter,
    Layers,
    Pencil,
    Plus,
    Search,
    Sparkles,
    UploadCloud,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    CATEGORIES,
    CourseBuilderView,
    USER_POOL,
    type CourseCategory,
    type CourseDraft,
    type CourseStatus,
    type LibraryCourseInput
} from './CourseBuilder';
const uid = () => Math.random().toString(36).slice(2, 9);
type LibraryCourse = LibraryCourseInput & {
    id: string;
    assessmentScores: { label: string; score: number; learnersAssessed: number }[];
};
const INITIAL_COURSES: LibraryCourse[] = [
    {
        id: 'c1',
        title: 'Workplace Safety Fundamentals',
        category: 'Safety & Compliance',
        instructor: USER_POOL[2],
        duration: '3 hours',
        status: 'Published',
        completionRate: 82,
        lastUpdated: 'Jul 18, 2026',
        description: 'Core safety procedures, hazard identification, and emergency response for all staff.',
        objectives: ['Identify common workplace hazards', 'Follow standard safety procedures', 'Respond correctly in an emergency'],
        targetLearners: ['Employees'],
        relatedCompetency: 'Safety Awareness',
        requiredLevel: 'Basic',
        owner: USER_POOL[2],
        authors: [USER_POOL[2]],
        reviewers: [USER_POOL[0]],
        publisher: USER_POOL[0],
        modules: [
            { id: 'm1', title: 'Workplace Safety Fundamentals', lessonCount: 2 },
            { id: 'm2', title: 'Safety Procedures', lessonCount: 2 },
            { id: 'm3', title: 'Emergency Response', lessonCount: 2 },
        ],
        assessments: { knowledgeChecks: 3, hasFinalAssessment: true },
        enrollment: { enrolled: 148, completed: 121, inProgress: 19, notStarted: 8, avgAssessmentScore: 84 },
        assessmentScores: [
            { label: 'Module 1 Knowledge Check', score: 88, learnersAssessed: 140 },
            { label: 'Module 2 Knowledge Check', score: 79, learnersAssessed: 133 },
            { label: 'Module 3 Knowledge Check', score: 85, learnersAssessed: 128 },
            { label: 'Final Assessment', score: 84, learnersAssessed: 121 },
        ],
    },
    {
        id: 'c2',
        title: 'Leadership Development Program',
        category: 'Leadership',
        instructor: USER_POOL[0],
        duration: '6 hours',
        status: 'Published',
        completionRate: 64,
        lastUpdated: 'Jul 22, 2026',
        description: 'Practical leadership fundamentals for new and aspiring team leaders.',
        objectives: ['Apply core leadership styles', 'Communicate expectations clearly', 'Handle team conflict constructively'],
        targetLearners: ['Employees', 'Trainees'],
        relatedCompetency: 'Leadership',
        requiredLevel: 'Intermediate',
        owner: USER_POOL[0],
        authors: [USER_POOL[0], USER_POOL[3]],
        reviewers: [USER_POOL[1]],
        publisher: USER_POOL[0],
        modules: [
            { id: 'm1', title: 'Leadership Fundamentals', lessonCount: 2 },
            { id: 'm2', title: 'Effective Communication', lessonCount: 2 },
            { id: 'm3', title: 'Team Leadership', lessonCount: 2 },
        ],
        assessments: { knowledgeChecks: 3, hasFinalAssessment: true },
        enrollment: { enrolled: 96, completed: 61, inProgress: 27, notStarted: 8, avgAssessmentScore: 78 },
        assessmentScores: [
            { label: 'Module 1 Knowledge Check', score: 81, learnersAssessed: 90 },
            { label: 'Module 2 Knowledge Check', score: 74, learnersAssessed: 84 },
            { label: 'Module 3 Knowledge Check', score: 77, learnersAssessed: 70 },
            { label: 'Final Assessment', score: 78, learnersAssessed: 61 },
        ],
    },
    {
        id: 'c3',
        title: 'Equipment Handling & Maintenance',
        category: 'Technical Skills',
        instructor: USER_POOL[4],
        duration: '4 hours',
        status: 'Draft',
        completionRate: 0,
        lastUpdated: 'Jul 28, 2026',
        description: 'Proper handling, routine maintenance, and troubleshooting for standard operations equipment.',
        objectives: ['Operate equipment according to procedure', 'Perform routine maintenance checks'],
        targetLearners: ['Employees'],
        relatedCompetency: 'Technical Proficiency',
        requiredLevel: 'Basic',
        owner: USER_POOL[4],
        authors: [USER_POOL[4]],
        reviewers: [],
        publisher: '',
        modules: [
            { id: 'm1', title: 'Equipment Overview', lessonCount: 2 },
            { id: 'm2', title: 'Routine Maintenance', lessonCount: 0 },
        ],
        assessments: { knowledgeChecks: 1, hasFinalAssessment: false },
        enrollment: { enrolled: 0, completed: 0, inProgress: 0, notStarted: 0, avgAssessmentScore: 0 },
        assessmentScores: [],
    },
    {
        id: 'c4',
        title: 'Communication Skills for Managers',
        category: 'Behavioral Skills',
        instructor: USER_POOL[3],
        duration: '2.5 hours',
        status: 'Draft',
        completionRate: 0,
        lastUpdated: 'Jul 30, 2026',
        description: 'Foundations of clear workplace communication, active listening, and difficult conversations.',
        objectives: ['Structure a clear message', 'Practice active listening'],
        targetLearners: ['Employees'],
        relatedCompetency: 'Communication',
        requiredLevel: 'Intermediate',
        owner: USER_POOL[3],
        authors: [USER_POOL[3]],
        reviewers: [],
        publisher: '',
        modules: [{ id: 'm1', title: 'Foundations of Workplace Communication', lessonCount: 2 }],
        assessments: { knowledgeChecks: 0, hasFinalAssessment: false },
        enrollment: { enrolled: 0, completed: 0, inProgress: 0, notStarted: 0, avgAssessmentScore: 0 },
        assessmentScores: [],
    },
    {
        id: 'c5',
        title: 'Customer Service Excellence',
        category: 'Behavioral Skills',
        instructor: USER_POOL[5],
        duration: '3 hours',
        status: 'Archived',
        completionRate: 91,
        lastUpdated: 'Feb 04, 2026',
        description: 'Legacy customer-service training, retired and replaced by the updated program.',
        objectives: ['Handle customer complaints professionally', 'Apply the service recovery framework'],
        targetLearners: ['Employees'],
        relatedCompetency: 'Customer Focus',
        requiredLevel: 'Basic',
        owner: USER_POOL[5],
        authors: [USER_POOL[5]],
        reviewers: [USER_POOL[0]],
        publisher: USER_POOL[0],
        modules: [
            { id: 'm1', title: 'Service Fundamentals', lessonCount: 2 },
            { id: 'm2', title: 'Handling Complaints', lessonCount: 2 },
        ],
        assessments: { knowledgeChecks: 2, hasFinalAssessment: true },
        enrollment: { enrolled: 203, completed: 185, inProgress: 4, notStarted: 14, avgAssessmentScore: 88 },
        assessmentScores: [
            { label: 'Module 1 Knowledge Check', score: 90, learnersAssessed: 198 },
            { label: 'Module 2 Knowledge Check', score: 86, learnersAssessed: 191 },
            { label: 'Final Assessment', score: 88, learnersAssessed: 185 },
        ],
    },
];
const STATUS_BADGE_STYLES: Record<CourseStatus, string> = {
    Draft: 'bg-slate-100 text-slate-500',
    Review: 'bg-sky-100 text-sky-700',
    Published: 'bg-emerald-100 text-emerald-700',
    Archived: 'bg-amber-100 text-amber-700',
};
const STATUS_FILTERS: ('All' | CourseStatus)[] = ['All', 'Draft', 'Published', 'Archived'];
function StatCard({ icon: Icon, label, value, hint }: { icon: typeof BookOpen; label: string; value: string | number; hint?: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[#8a6400]">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <p className="text-lg font-bold leading-tight text-slate-900">{value}</p>
                <p className="truncate text-[11px] font-semibold text-slate-500">{label}</p>
                {hint && <p className="truncate text-[10px] text-slate-400">{hint}</p>}
            </div>
        </div>
    );
}
function ProgressBar({ value, tone = 'amber' }: { value: number; tone?: 'amber' | 'emerald' }) {
    const barColor = tone === 'emerald' ? 'bg-emerald-500' : 'bg-[#F4B400]';
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
            </div>
            <span className="w-8 shrink-0 text-[11px] font-semibold text-slate-500">{value}%</span>
        </div>
    );
}
function EmptyState({ label }: { label: string }) {
    return <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">{label}</p>;
}
function libraryCourseToDraft(course: LibraryCourse): Partial<CourseDraft> {
    return {
        existingId: course.id,
        status: course.status,
        title: course.title,
        description: course.description,
        category: course.category,
        instructor: course.instructor,
        duration: course.duration,
        difficulty: '',
        imagePreview: null,
        imageName: null,
        targetTypes: course.targetLearners,
        departments: [],
        positions: '',
        roles: '',
        relatedCompetency: course.relatedCompetency,
        requiredLevel: course.requiredLevel,
        developmentPurpose: '',
        owner: course.owner,
        authors: course.authors,
        reviewers: course.reviewers,
        publisher: course.publisher,
        modules: course.modules.map((m) => ({
            id: m.id,
            title: m.title,
            description: '',
            lessons: Array.from({ length: m.lessonCount }).map(() => ({
                id: uid(),
                title: '',
                description: '',
                objective: '',
                duration: '',
                contentType: 'Text / Reading' as const,
                material: null,
            })),
        })),
    };
}
function guessResumeStep(draft: Partial<CourseDraft>): number {
    if (!draft.title || !draft.description || !draft.category || !draft.instructor || !draft.difficulty || !draft.duration) return 1;
    if (!draft.targetTypes || draft.targetTypes.length === 0) return 2;
    if (!draft.relatedCompetency || !draft.requiredLevel) return 3;
    if (!draft.owner) return 4;
    if (!draft.modules || draft.modules.length === 0) return 5;
    if (draft.modules.some((m) => m.lessons.length === 0 || m.lessons.some((l) => !l.title.trim()))) return 6;
    return 7;
}
function AssignLearnersModal({ course, onClose, onAssign }: { course: LibraryCourse; onClose: () => void; onAssign: (count: number) => void }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const candidates = USER_POOL.filter((u) => u.toLowerCase().includes(query.toLowerCase()));
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Assign Learners</h3>
                        <p className="text-[11px] text-slate-400">{course.title}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-300" />
                    <input
                        className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs focus:border-[#F4B400] focus:outline-none"
                        placeholder="Search learners..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                    {candidates.length === 0 && <EmptyState label="No matching learners." />}
                    {candidates.map((u) => {
                        const active = selected.includes(u);
                        return (
                            <label key={u} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-[#F4B400]"
                                    checked={active}
                                    onChange={() => setSelected((s) => (active ? s.filter((x) => x !== u) : [...s, u]))}
                                />
                                {u}
                            </label>
                        );
                    })}
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{selected.length} selected</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={selected.length === 0}
                            onClick={() => onAssign(selected.length)}
                            className="rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Confirm Assignment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
function UploadMaterialModal({
    draftCourses,
    onClose,
    onContinueEditing,
}: {
    draftCourses: LibraryCourse[];
    onClose: () => void;
    onContinueEditing: (courseId: string) => void;
}) {
    const [selectedId, setSelectedId] = useState(draftCourses[0]?.id ?? '');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Upload Learning Material</h3>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {draftCourses.length === 0 ? (
                    <EmptyState label="No draft courses to add material to yet. Start a New Course first." />
                ) : (
                    <>
                        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                            Materials are uploaded per lesson inside the Course Builder, so lesson objectives and AI
                            suggestions stay grounded in the right content. Pick a draft course to continue into its
                            Lessons &amp; Learning Materials step.
                        </p>
                        <label className="block">
                            <span className="text-xs font-semibold text-slate-700">Draft Course</span>
                            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                                {draftCourses.map((c) => (
                                    <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                            </select>
                        </label>
                        <div className="mt-3 flex justify-end gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => onContinueEditing(selectedId)}
                                className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#dba300]"
                            >
                                <UploadCloud className="h-3.5 w-3.5" /> Continue to Course
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
function CourseDetailDrawer({ course, onClose, onAssign }: { course: LibraryCourse; onClose: () => void; onAssign: () => void }) {
    const [tab, setTab] = useState<'Overview' | 'Content' | 'Learners' | 'Assessment Analytics'>('Overview');
    const tabs: typeof tab[] = ['Overview', 'Content', 'Learners', 'Assessment Analytics'];
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
            <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-100 p-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-slate-900">{course.title}</h2>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_STYLES[course.status]}`}>{course.status}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{course.category} · {course.duration} · Updated {course.lastUpdated}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex gap-1 border-b border-slate-100 px-4">
                    {tabs.map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTab(t)}
                            className={`border-b-2 px-2 py-2.5 text-[11px] font-semibold transition ${
                                tab === t ? 'border-[#F4B400] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {tab === 'Overview' && (
                        <div className="space-y-4">
                            <p className="text-xs leading-relaxed text-slate-600">{course.description}</p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <p className="text-[11px] text-slate-400">Instructor / Author</p>
                                    <p className="font-semibold text-slate-800">{course.instructor}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-slate-400">Owner</p>
                                    <p className="font-semibold text-slate-800">{course.owner || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-slate-400">Target Learners</p>
                                    <p className="font-semibold text-slate-800">{course.targetLearners.join(', ') || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-slate-400">Related Competency</p>
                                    <p className="font-semibold text-slate-800">{course.relatedCompetency || '—'} {course.requiredLevel && `(${course.requiredLevel})`}</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-100 p-3">
                                <p className="mb-2 text-[11px] font-semibold text-slate-500">Completion Rate</p>
                                <ProgressBar value={course.completionRate} tone="emerald" />
                            </div>
                            {course.objectives.length > 0 && (
                                <div>
                                    <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Learning Objectives</p>
                                    <ul className="list-inside list-disc space-y-1 text-xs text-slate-600">
                                        {course.objectives.map((o) => <li key={o}>{o}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    {tab === 'Content' && (
                        <div className="space-y-2">
                            {course.modules.length === 0 ? (
                                <EmptyState label="No modules yet." />
                            ) : (
                                course.modules.map((m, i) => (
                                    <div key={m.id} className="rounded-lg border border-slate-200 p-3">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="text-xs font-semibold text-slate-800">Module {i + 1} — {m.title}</span>
                                        </div>
                                        <p className="mt-1 pl-5 text-[11px] text-slate-400">{m.lessonCount} lesson{m.lessonCount === 1 ? '' : 's'}</p>
                                    </div>
                                ))
                            )}
                            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                                <p>{course.assessments.knowledgeChecks} module knowledge check(s) configured.</p>
                                <p>Final Assessment: {course.assessments.hasFinalAssessment ? 'Yes' : 'None'}</p>
                            </div>
                        </div>
                    )}
                    {tab === 'Learners' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard icon={Users} label="Enrolled" value={course.enrollment.enrolled} />
                                <StatCard icon={CheckCircle2} label="Completed" value={course.enrollment.completed} />
                                <StatCard icon={ClipboardList} label="In Progress" value={course.enrollment.inProgress} />
                                <StatCard icon={BookOpen} label="Not Started" value={course.enrollment.notStarted} />
                            </div>
                            <button
                                type="button"
                                onClick={onAssign}
                                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                <Users className="h-3.5 w-3.5" /> Assign Learners
                            </button>
                        </div>
                    )}
                    {tab === 'Assessment Analytics' && (
                        <div className="space-y-3">
                            {course.assessmentScores.length === 0 ? (
                                <EmptyState label="No assessment data yet — this course hasn't been assessed by any learners." />
                            ) : (
                                <div className="space-y-2.5 rounded-xl border border-slate-100 p-3">
                                    <p className="text-[11px] font-semibold text-slate-500">Assessment Performance</p>
                                    {course.assessmentScores.map((s) => (
                                        <div key={s.label}>
                                            <div className="mb-0.5 flex items-center justify-between text-[11px] text-slate-500">
                                                <span>{s.label}</span>
                                                <span className="font-semibold text-slate-700">{s.score}%</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-full rounded-full bg-[#F4B400]" style={{ width: `${s.score}%` }} />
                                            </div>
                                            <p className="mt-0.5 text-[10px] text-slate-300">{s.learnersAssessed} learners assessed</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="rounded-xl border border-slate-100 p-3 text-xs text-slate-600">
                                <p className="text-[11px] font-semibold text-slate-500">Course-level Average</p>
                                <p className="mt-1 text-lg font-bold text-slate-900">{course.enrollment.avgAssessmentScore}%</p>
                                <p className="text-[10px] text-slate-400">This reflects learning assessment performance, not employee performance ratings.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
function CourseLibraryTable({
    courses,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    onView,
    onContinueEditing,
    onEdit,
    onArchive,
    onDuplicate,
}: {
    courses: LibraryCourse[];
    statusFilter: 'All' | CourseStatus;
    setStatusFilter: (s: 'All' | CourseStatus) => void;
    categoryFilter: 'All' | CourseCategory;
    setCategoryFilter: (c: 'All' | CourseCategory) => void;
    search: string;
    setSearch: (s: string) => void;
    onView: (id: string) => void;
    onContinueEditing: (id: string) => void;
    onEdit: (id: string) => void;
    onArchive: (id: string) => void;
    onDuplicate: (id: string) => void;
}) {
    return (
        <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-900">Course Library</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-300" />
                        <input
                            className="w-40 rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-xs focus:border-[#F4B400] focus:outline-none sm:w-56"
                            placeholder="Search courses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-300" />
                        <select
                            className="appearance-none rounded-lg border border-slate-200 py-1.5 pl-8 pr-6 text-xs focus:border-[#F4B400] focus:outline-none"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value as 'All' | CourseCategory)}
                        >
                            <option value="All">All Categories</option>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-300" />
                    </div>
                </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
                {STATUS_FILTERS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                            statusFilter === s ? 'border-[#F4B400] bg-amber-50 text-[#8a6400]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {s}
                    </button>
                ))}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                    <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            <th className="py-2 pr-3">Course</th>
                            <th className="py-2 pr-3">Category</th>
                            <th className="py-2 pr-3">Instructor</th>
                            <th className="py-2 pr-3">Target Audience</th>
                            <th className="py-2 pr-3">Duration</th>
                            <th className="py-2 pr-3">Enrolled</th>
                            <th className="py-2 pr-3">Completion Rate</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2 pr-3">Last Updated</th>
                            <th className="py-2 pr-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.length === 0 && (
                            <tr>
                                <td colSpan={10} className="py-8">
                                    <EmptyState label="No courses match these filters." />
                                </td>
                            </tr>
                        )}
                        {courses.map((c) => (
                            <tr key={c.id} className="border-b border-slate-50 align-top hover:bg-slate-50/60">
                                <td className="max-w-[220px] py-3 pr-3">
                                    <div className="flex items-start gap-2.5">
                                        <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                                            <BookOpen className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold text-slate-800">{c.title}</p>
                                            <p className="line-clamp-2 text-[11px] text-slate-400">{c.description}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 pr-3 text-slate-600">{c.category}</td>
                                <td className="py-3 pr-3 text-slate-600">{c.instructor}</td>
                                <td className="py-3 pr-3 text-slate-600">{c.targetLearners.join(', ') || '—'}</td>
                                <td className="py-3 pr-3 text-slate-600">{c.duration}</td>
                                <td className="py-3 pr-3 text-slate-600">{c.enrollment.enrolled}</td>
                                <td className="py-3 pr-3"><ProgressBar value={c.completionRate} tone="emerald" /></td>
                                <td className="py-3 pr-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_STYLES[c.status]}`}>{c.status}</span>
                                </td>
                                <td className="py-3 pr-3 text-slate-500">{c.lastUpdated}</td>
                                <td className="py-3 pr-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <button type="button" onClick={() => onView(c.id)} title="View" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        {c.status === 'Draft' && (
                                            <button type="button" onClick={() => onContinueEditing(c.id)} title="Continue Editing" className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-[#8a6400]">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {c.status === 'Published' && (
                                            <button type="button" onClick={() => onEdit(c.id)} title="Edit" className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-[#8a6400]">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {c.status !== 'Archived' && (
                                            <button type="button" onClick={() => onDuplicate(c.id)} title="Duplicate" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                                <Copy className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {c.status === 'Published' && (
                                            <button type="button" onClick={() => onArchive(c.id)} title="Archive" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                                                <Archive className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
function QuickActions({
    onNewCourse,
    onAssignLearners,
    onUploadMaterial,
    onCourseReports,
}: {
    onNewCourse: () => void;
    onAssignLearners: () => void;
    onUploadMaterial: () => void;
    onCourseReports: () => void;
}) {
    const actions = [
        { label: 'New Course', icon: Plus, onClick: onNewCourse },
        { label: 'Assign Learners', icon: Users, onClick: onAssignLearners },
        { label: 'Upload Learning Material', icon: UploadCloud, onClick: onUploadMaterial },
        { label: 'Course Reports', icon: FileBarChart, onClick: onCourseReports },
    ];
    return (
        <div className="rounded-xl border border-slate-100 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {actions.map((a) => (
                    <button
                        key={a.label}
                        type="button"
                        onClick={a.onClick}
                        className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-3 text-center text-[11px] font-semibold text-slate-600 hover:border-[#F4B400] hover:bg-amber-50 hover:text-[#8a6400]"
                    >
                        <a.icon className="h-4 w-4" />
                        {a.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
function PickCourseModal({ courses, title, onPick, onClose }: { courses: LibraryCourse[]; title: string; onClose: () => void; onPick: (id: string) => void }) {
    const [selectedId, setSelectedId] = useState(courses[0]?.id ?? '');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                    <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
                </div>
                {courses.length === 0 ? (
                    <EmptyState label="No courses available." />
                ) : (
                    <>
                        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        <div className="mt-3 flex justify-end gap-2">
                            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button type="button" onClick={() => onPick(selectedId)} className="rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#dba300]">Continue</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
function CourseReportsPanel({ courses, onClose }: { courses: LibraryCourse[]; onClose: () => void }) {
    const withScores = courses.filter((c) => c.assessmentScores.length > 0);
    return (
        <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><BarChart3 className="h-4 w-4 text-slate-400" /> Course Reports — Assessment Performance</h2>
                <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            {withScores.length === 0 ? (
                <EmptyState label="No assessment data yet." />
            ) : (
                <div className="space-y-2.5">
                    {withScores.map((c) => (
                        <div key={c.id}>
                            <div className="mb-0.5 flex items-center justify-between text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">{c.title}</span>
                                <span>{c.enrollment.avgAssessmentScore}% avg</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-[#F4B400]" style={{ width: `${c.enrollment.avgAssessmentScore}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
type PageView =
    | { mode: 'library' }
    | { mode: 'builder'; editingId: string | null; initialDraft: Partial<CourseDraft>; initialStep: number }
    | { mode: 'detail'; id: string };
function CourseLibraryPage() {
    const [courses, setCourses] = useState<LibraryCourse[]>(INITIAL_COURSES);
    const [view, setView] = useState<PageView>({ mode: 'library' });
    const [statusFilter, setStatusFilter] = useState<'All' | CourseStatus>('All');
    const [categoryFilter, setCategoryFilter] = useState<'All' | CourseCategory>('All');
    const [search, setSearch] = useState('');
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [pickingAssignCourse, setPickingAssignCourse] = useState(false);
    const [uploadingMaterial, setUploadingMaterial] = useState(false);
    const [showReports, setShowReports] = useState(false);
    const filteredCourses = useMemo(() => {
        return courses.filter((c) => {
            if (statusFilter !== 'All' && c.status !== statusFilter) return false;
            if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
            if (search.trim() && !c.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
            return true;
        });
    }, [courses, statusFilter, categoryFilter, search]);
    const summary = useMemo(
        () => ({
            total: courses.length,
            enrolled: courses.reduce((sum, c) => sum + c.enrollment.enrolled, 0),
            completed: courses.reduce((sum, c) => sum + c.enrollment.completed, 0),
            active: courses.filter((c) => c.status === 'Published').length,
        }),
        [courses],
    );
    const draftCourses = useMemo(() => courses.filter((c) => c.status === 'Draft'), [courses]);
    const selectedCourse = view.mode === 'detail' ? courses.find((c) => c.id === view.id) ?? null : null;
    const assigningCourse = assigningId ? courses.find((c) => c.id === assigningId) ?? null : null;
    const openNewCourse = () => setView({ mode: 'builder', editingId: null, initialDraft: {}, initialStep: 1 });
    const openContinueEditing = (id: string) => {
        const course = courses.find((c) => c.id === id);
        if (!course) return;
        const draft = libraryCourseToDraft(course);
        setView({ mode: 'builder', editingId: id, initialDraft: draft, initialStep: guessResumeStep(draft) });
    };
    const openEdit = openContinueEditing;
    const backToLibrary = () => setView({ mode: 'library' });
    const upsertCourse = (payload: LibraryCourseInput, editingId: string | null) => {
        setCourses((prev) => {
            if (editingId) {
                return prev.map((c) => (c.id === editingId ? { ...c, ...payload, assessmentScores: c.assessmentScores } : c));
            }
            return [...prev, { ...payload, id: uid(), assessmentScores: [] }];
        });
        setView({ mode: 'library' });
    };
    const archiveCourse = (id: string) => setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'Archived' } : c)));
    const duplicateCourse = (id: string) => {
        setCourses((prev) => {
            const source = prev.find((c) => c.id === id);
            if (!source) return prev;
            const copy: LibraryCourse = {
                ...source,
                id: uid(),
                title: `${source.title} (Copy)`,
                status: 'Draft',
                completionRate: 0,
                lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                enrollment: { enrolled: 0, completed: 0, inProgress: 0, notStarted: 0, avgAssessmentScore: 0 },
                assessmentScores: [],
            };
            return [...prev, copy];
        });
    };
    const assignLearners = (id: string, count: number) => {
        setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, enrollment: { ...c.enrollment, enrolled: c.enrollment.enrolled + count, notStarted: c.enrollment.notStarted + count } } : c)));
        setAssigningId(null);
        setPickingAssignCourse(false);
    };
    if (view.mode === 'builder') {
        return (
            <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Learning Management</h1>}>
                <Head title="Course Builder" />
                <div className="mx-auto max-w-5xl p-4">
                    <button type="button" onClick={backToLibrary} className="mb-3 text-[11px] font-semibold text-slate-400 hover:text-slate-700">
                        &larr; Back to Course Library
                    </button>
                    <CourseBuilderView
                        initialDraft={view.initialDraft}
                        initialStep={view.initialStep}
                        onCancel={backToLibrary}
                        onSaveDraft={(payload) => upsertCourse({ ...payload, status: 'Draft' }, view.editingId)}
                        onSubmitForReview={(payload) => upsertCourse({ ...payload, status: 'Review' }, view.editingId)}
                        onPublish={(payload) => upsertCourse({ ...payload, status: 'Published' }, view.editingId)}
                    />
                </div>
            </AuthenticatedLayout>
        );
    }
    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Learning Management</h1>}>
            <Head title="Learning Management" />
            <div className="w-full space-y-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Learning Management</h1>
                        <p className="mt-0.5 text-xs text-slate-500">Manage courses, learning content, learner assignments, and course progress.</p>
                    </div>
                    <button
                        type="button"
                        onClick={openNewCourse}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-[#F4B400] px-4 py-2 text-xs font-semibold text-black hover:bg-[#dba300]"
                    >
                        <Plus className="h-3.5 w-3.5" /> New Course
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard icon={BookOpen} label="Total Courses" value={summary.total} />
                    <StatCard icon={Users} label="Enrolled Trainees" value={summary.enrolled} />
                    <StatCard icon={CheckCircle2} label="Completed Courses" value={summary.completed} />
                    <StatCard icon={Sparkles} label="Active Courses" value={summary.active} hint="Currently published" />
                </div>
                <CourseLibraryTable
                    courses={filteredCourses}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    categoryFilter={categoryFilter}
                    setCategoryFilter={setCategoryFilter}
                    search={search}
                    setSearch={setSearch}
                    onView={(id) => setView({ mode: 'detail', id })}
                    onContinueEditing={openContinueEditing}
                    onEdit={openEdit}
                    onArchive={archiveCourse}
                    onDuplicate={duplicateCourse}
                />
                {showReports && <CourseReportsPanel courses={courses} onClose={() => setShowReports(false)} />}
                <QuickActions
                    onNewCourse={openNewCourse}
                    onAssignLearners={() => setPickingAssignCourse(true)}
                    onUploadMaterial={() => setUploadingMaterial(true)}
                    onCourseReports={() => setShowReports((v) => !v)}
                />
            </div>
            {selectedCourse && (
                <CourseDetailDrawer course={selectedCourse} onClose={backToLibrary} onAssign={() => setAssigningId(selectedCourse.id)} />
            )}
            {assigningCourse && (
                <AssignLearnersModal course={assigningCourse} onClose={() => setAssigningId(null)} onAssign={(count) => assignLearners(assigningCourse.id, count)} />
            )}
            {pickingAssignCourse && (
                <PickCourseModal
                    courses={courses}
                    title="Assign Learners — choose a course"
                    onClose={() => setPickingAssignCourse(false)}
                    onPick={(id) => { setPickingAssignCourse(false); setAssigningId(id); }}
                />
            )}
            {uploadingMaterial && (
                <UploadMaterialModal
                    draftCourses={draftCourses}
                    onClose={() => setUploadingMaterial(false)}
                    onContinueEditing={(id) => { setUploadingMaterial(false); openContinueEditing(id); }}
                />
            )}
        </AuthenticatedLayout>
    );
}
export default function LearningManagement() {
    return <CourseLibraryPage />;
}