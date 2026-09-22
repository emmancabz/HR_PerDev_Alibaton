import SystemSelect from '@/Components/SystemSelect';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    BookOpen,
    Check,
    ChevronRight,
    ClipboardList,
    Info,
    Lightbulb,
    Loader2,
    RefreshCw,
    Sparkles,
    Target,
    ThumbsDown,
    ThumbsUp,
    TrendingUp,
    UserCircle2,
    Wand2,
    X
} from 'lucide-react';
import { useState } from 'react';
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30';
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
    return (
        <label className="block">
            <span className="text-xs font-semibold text-slate-700">{label}</span>
            <div className="mt-1">{children}</div>
            {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
        </label>
    );
}
function SectionCard({ title, icon: Icon, description, children }: { title: string; icon: typeof BookOpen; description?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
            </div>
            {description && <p className="mb-3 text-[11px] leading-relaxed text-slate-400">{description}</p>}
            {children}
        </div>
    );
}
type CourseDraftResult = {
    suggestedTitle: string;
    objectives: string[];
    modules: { title: string; lessons: string[] }[];
};
const CURATED_TOPICS: Record<string, CourseDraftResult> = {
    leadership: {
        suggestedTitle: 'Leadership Essentials',
        objectives: [
            'Apply core leadership styles to real team situations',
            'Communicate direction and expectations clearly',
            'Make sound decisions under time pressure',
        ],
        modules: [
            { title: 'Leadership Fundamentals', lessons: ['What Leadership Means Day to Day', 'Common Leadership Styles'] },
            { title: 'Effective Communication', lessons: ['Setting Clear Expectations', 'Giving Feedback That Lands'] },
            { title: 'Decision Making', lessons: ['A Simple Framework for Fast Decisions', 'Case Study: Under Pressure'] },
            { title: 'Team Leadership', lessons: ['Delegating Without Losing Control', 'Handling Team Conflict'] },
        ],
    },
    communication: {
        suggestedTitle: 'Advanced Workplace Communication',
        objectives: [
            'Structure messages so the key point lands first',
            'Adapt tone across written and verbal channels',
            'Navigate difficult conversations calmly',
        ],
        modules: [
            { title: 'Foundations of Workplace Communication', lessons: ['Message Structure Basics', 'Choosing the Right Channel'] },
            { title: 'Active Listening', lessons: ['Listening to Understand vs. Reply', 'Reading Non-Verbal Cues'] },
            { title: 'Difficult Conversations', lessons: ['Preparing for a Hard Conversation', 'Staying Calm Under Pushback'] },
        ],
    },
    safety: {
        suggestedTitle: 'Workplace Safety Fundamentals',
        objectives: ['Identify common workplace hazards', 'Follow correct emergency response procedures'],
        modules: [
            { title: 'Hazard Identification', lessons: ['Spotting Hazards in Your Work Area', 'Reporting Near-Misses'] },
            { title: 'Emergency Procedures', lessons: ['Evacuation Routes and Assembly Points', 'First Response Basics'] },
        ],
    },
};
function genericDraft(topic: string): CourseDraftResult {
    const t = topic.trim() || 'this topic';
    return {
        suggestedTitle: `${topic || 'New Course'} Essentials`,
        objectives: [
            `Understand the core concepts behind ${t}`,
            `Apply ${t} in day-to-day work situations`,
            `Recognize when to escalate or ask for support around ${t}`,
        ],
        modules: [
            { title: `${topic || 'Topic'} Fundamentals`, lessons: [`Introduction to ${topic || 'the Topic'}`, 'Key Terms and Concepts'] },
            { title: `Applying ${topic || 'the Topic'} in Practice`, lessons: ['Worked Examples', 'Common Mistakes to Avoid'] },
            { title: `${topic || 'Topic'}: Building Confidence`, lessons: ['Practice Scenario', 'Self-Check and Next Steps'] },
        ],
    };
}
function mockGenerateCourseDraft(topic: string, variant: number): CourseDraftResult {
    const key = topic.trim().toLowerCase();
    const curated = Object.keys(CURATED_TOPICS).find((k) => key.includes(k));
    const base = curated ? CURATED_TOPICS[curated] : genericDraft(topic);
    if (variant % 2 === 1) {
        return {
            ...base,
            modules: [...base.modules].reverse(),
            objectives: [...base.objectives].reverse(),
        };
    }
    return base;
}
type CourseDraftInputs = {
    topic: string;
    targetLearner: string;
    department: string;
    competency: string;
    requiredLevel: string;
    duration: string;
};
function CourseDraftGenerator() {
    const [inputs, setInputs] = useState<CourseDraftInputs>({
        topic: '', targetLearner: '', department: '', competency: '', requiredLevel: '', duration: '',
    });
    const [loading, setLoading] = useState(false);
    const [variant, setVariant] = useState(0);
    const [draft, setDraft] = useState<CourseDraftResult | null>(null);
    const [status, setStatus] = useState<'idle' | 'accepted' | 'rejected'>('idle');
    const [editableTitle, setEditableTitle] = useState('');
    const canGenerate = inputs.topic.trim().length > 0;
    const generate = (nextVariant: number) => {
        setLoading(true);
        setStatus('idle');
        window.setTimeout(() => {
            const result = mockGenerateCourseDraft(inputs.topic, nextVariant);
            setDraft(result);
            setEditableTitle(result.suggestedTitle);
            setVariant(nextVariant);
            setLoading(false);
        }, 700);
    };
    return (
        <SectionCard
            title="Generate Course Draft"
            icon={Wand2}
            description="Give the assistant a topic and some targeting details. It drafts a module outline for you to review — nothing is created in the Course Library until you accept it into the Course Builder."
        >
            <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Topic"><input className={inputCls} placeholder="e.g. Leadership" value={inputs.topic} onChange={(e) => setInputs({ ...inputs, topic: e.target.value })} /></Field>
                <Field label="Target Learner"><input className={inputCls} placeholder="e.g. Sales Trainees" value={inputs.targetLearner} onChange={(e) => setInputs({ ...inputs, targetLearner: e.target.value })} /></Field>
                <Field label="Department"><input className={inputCls} placeholder="e.g. Sales" value={inputs.department} onChange={(e) => setInputs({ ...inputs, department: e.target.value })} /></Field>
                <Field label="Related Competency"><input className={inputCls} placeholder="e.g. Leadership" value={inputs.competency} onChange={(e) => setInputs({ ...inputs, competency: e.target.value })} /></Field>
                <Field label="Required Level">
                    <SystemSelect className={inputCls} value={inputs.requiredLevel} onChange={(e) => setInputs({ ...inputs, requiredLevel: e.target.value })}>
                        <option value="">Select level</option>
                        <option>Basic</option><option>Intermediate</option><option>Advanced</option>
                    </SystemSelect>
                </Field>
                <Field label="Estimated Duration"><input className={inputCls} placeholder="e.g. 4 hours" value={inputs.duration} onChange={(e) => setInputs({ ...inputs, duration: e.target.value })} /></Field>
            </div>
            <button
                type="button"
                disabled={!canGenerate || loading}
                onClick={() => generate(0)}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {loading ? 'Generating with Groq AI…' : 'Generate Course Draft'}
            </button>
            {draft && status === 'idle' && !loading && (
                <div className="mt-4 rounded-lg border border-dashed border-[#F4B400]/60 bg-amber-50/40 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6400]">
                        <Sparkles className="h-3.5 w-3.5" /> AI DRAFT — REVIEW BEFORE USING
                    </div>
                    <input
                        className={`${inputCls} mb-3 font-semibold`}
                        value={editableTitle}
                        onChange={(e) => setEditableTitle(e.target.value)}
                    />
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Learning Objectives</p>
                    <ul className="mb-3 space-y-1">
                        {draft.objectives.map((o, i) => <li key={i} className="text-xs text-slate-600">• {o}</li>)}
                    </ul>
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Suggested Modules</p>
                    <ol className="space-y-1.5">
                        {draft.modules.map((m, i) => (
                            <li key={i} className="rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-600">
                                <span className="font-semibold text-slate-800">Module {i + 1} — {m.title}</span>
                                <div className="mt-0.5 pl-3 text-[11px] text-slate-400">{m.lessons.join(' · ')}</div>
                            </li>
                        ))}
                    </ol>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => generate(variant + 1)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                        </button>
                        <button type="button" onClick={() => setStatus('rejected')} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                            <ThumbsDown className="h-3.5 w-3.5" /> Reject
                        </button>
                        <button type="button" onClick={() => setStatus('accepted')} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                            <ThumbsUp className="h-3.5 w-3.5" /> Accept &amp; Send to Course Builder
                        </button>
                    </div>
                </div>
            )}
            {status === 'accepted' && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    Draft accepted. Open the Course Builder to continue filling in details, lessons, and materials —
                    the module outline above carries over as the starting Course Structure. It is still a draft
                    until an Admin/HR user publishes it there.
                </div>
            )}
            {status === 'rejected' && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    Draft discarded. Adjust the inputs above and generate again whenever you're ready.
                </div>
            )}
        </SectionCard>
    );
}
type EmployeeGap = {
    id: string;
    name: string;
    department: string;
    competency: string;
    currentLevel: string;
    requiredLevel: string;
    signal: string; 
    recommendedCourse: string;
    suggestedLessons: string[];
};
const EMPLOYEE_GAPS: EmployeeGap[] = [
    {
        id: 'E-1',
        name: 'Vicky Melgar',
        department: 'Sales',
        competency: 'Communication',
        currentLevel: 'Intermediate',
        requiredLevel: 'Advanced',
        signal: 'Recent performance review flagged client-communication clarity as a growth area',
        recommendedCourse: 'Advanced Workplace Communication',
        suggestedLessons: ['Message Structure Basics', 'Active Listening', 'Difficult Conversations'],
    },
    {
        id: 'E-2',
        name: 'Rafael Ortiz',
        department: 'Operations',
        competency: 'Leadership',
        currentLevel: 'Basic',
        requiredLevel: 'Intermediate',
        signal: 'Competency assessment shows a gap after moving into a team lead role',
        recommendedCourse: 'Leadership Essentials',
        suggestedLessons: ['What Leadership Means Day to Day', 'Delegating Without Losing Control'],
    },
    {
        id: 'E-3',
        name: 'Carmela Ibanez',
        department: 'Customer Service',
        competency: 'Safety Awareness',
        currentLevel: 'Basic',
        requiredLevel: 'Basic',
        signal: 'Annual compliance refresher due; no active gap, routine renewal',
        recommendedCourse: 'Workplace Safety',
        suggestedLessons: ['Spotting Hazards in Your Work Area', 'Evacuation Routes and Assembly Points'],
    },
];
function RecommendationsPanel() {
    const [reviewing, setReviewing] = useState<EmployeeGap | null>(null);
    const [decisions, setDecisions] = useState<Record<string, 'accepted' | 'dismissed'>>({});

    const decide = (id: string, decision: 'accepted' | 'dismissed') => {
        setDecisions((d) => ({ ...d, [id]: decision }));
        setReviewing(null);
    };
    return (
        <SectionCard
            title="Personalized Learning Recommendations"
            icon={TrendingUp}
            description="Combines performance signals, competency gaps, and learning history to suggest a course per learner. The AI recommends — an Admin/HR user always decides whether to assign it."
        >
            <div className="space-y-2">
                {EMPLOYEE_GAPS.map((e) => {
                    const decision = decisions[e.id];
                    return (
                        <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <UserCircle2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-[160px] flex-1">
                                <p className="text-xs font-semibold text-slate-800">{e.name}</p>
                                <p className="text-[11px] text-slate-400">{e.department} · Gap: {e.competency} ({e.currentLevel} → {e.requiredLevel})</p>
                            </div>
                            {decision === 'accepted' && (
                                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><Check className="h-3 w-3" /> Accepted</span>
                            )}
                            {decision === 'dismissed' && (
                                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"><X className="h-3 w-3" /> Dismissed</span>
                            )}
                            {!decision && (
                                <button
                                    type="button"
                                    onClick={() => setReviewing(e)}
                                    className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                                >
                                    Review Recommendation <ChevronRight className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            {reviewing && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
                    onClick={() => setReviewing(null)}
                >
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6400]">
                                <Sparkles className="h-3.5 w-3.5" /> AI RECOMMENDATION
                            </div>
                            <button onClick={() => setReviewing(null)} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X className="h-4 w-4" /></button>
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-slate-900">{reviewing.name}</h3>
                        <p className="text-xs text-slate-400">{reviewing.department}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                            <div><p className="text-slate-400">Competency Gap</p><p className="font-semibold text-slate-800">{reviewing.competency}</p></div>
                            <div><p className="text-slate-400">Current → Required</p><p className="font-semibold text-slate-800">{reviewing.currentLevel} → {reviewing.requiredLevel}</p></div>
                        </div>
                        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-sky-50 p-2.5 text-[11px] text-sky-700">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {reviewing.signal}
                        </div>
                        <div className="mt-3">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Target className="h-3.5 w-3.5 text-slate-400" /> Recommended Course</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{reviewing.recommendedCourse}</p>
                        </div>
                        <div className="mt-3">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Lightbulb className="h-3.5 w-3.5 text-slate-400" /> Suggested Lessons</p>
                            <ul className="mt-1 space-y-1">
                                {reviewing.suggestedLessons.map((l, i) => <li key={i} className="text-xs text-slate-600">• {l}</li>)}
                            </ul>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <button onClick={() => decide(reviewing.id, 'dismissed')} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                Dismiss
                            </button>
                            <button onClick={() => decide(reviewing.id, 'accepted')} className="flex-1 rounded-lg bg-[#F4B400] py-2 text-xs font-semibold text-black hover:bg-[#dba300]">
                                Accept &amp; Assign Learners
                            </button>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400">
                            Accepting opens the same Assign Learners flow used from the Course Library — nothing is
                            assigned automatically.
                        </p>
                    </div>
                </div>
            )}
        </SectionCard>
    );
}

function AIAssistantContent() {
    const [tab, setTab] = useState<'draft' | 'recommend'>('draft');
    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#8a6400]" />
                    <h2 className="text-sm font-bold text-slate-900">Groq AI Learning Assistant</h2>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    The assistant drafts content and surfaces recommendations. It never publishes a course,
                    assigns it, or changes anyone's competency level — every output here is reviewed, edited if
                    needed, and explicitly accepted or rejected by an Admin/HR user.
                </p>
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setTab('draft')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'draft' ? 'bg-[#F4B400] text-black' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    Course Draft Generation
                </button>
                <button
                    type="button"
                    onClick={() => setTab('recommend')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'recommend' ? 'bg-[#F4B400] text-black' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    Personalized Recommendations
                </button>
            </div>
            {tab === 'draft' ? <CourseDraftGenerator /> : <RecommendationsPanel />}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-[11px] text-slate-500">
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                Lesson drafting, quiz generation, and final assessment generation grounded in actual lesson
                content live inside the Course Builder, next to the content they generate from.
            </div>
        </div>
    );
}
export default function AILearningAssistant() {
    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Groq AI Learning Assistant</h1>}>
            <Head title="Groq AI Learning Assistant" />
            <AIAssistantContent />
        </AuthenticatedLayout>
    );
}