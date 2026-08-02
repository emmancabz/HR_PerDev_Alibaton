import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Award,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ClipboardList,
    GraduationCap,
    Layers,
    Loader2,
    Lock,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Send,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    UploadCloud,
    Users,
    Wand2,
    X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
export type CourseCategory = 'Leadership' | 'Technical Skills' | 'Behavioral Skills' | 'Safety & Compliance' | 'Other';
export type CourseStatus = 'Draft' | 'Review' | 'Published' | 'Archived';
type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type CompetencyLevel = 'Basic' | 'Intermediate' | 'Advanced';
type LearnerType = 'Employees' | 'Trainees';
export type ContentType = 'Video' | 'PDF / Document' | 'Presentation' | 'Text / Reading' | 'External Resource';
export type QuestionType = 'Multiple Choice' | 'True/False';
export type Material = {
    fileName: string;
    fileSize: string;
    previewUrl?: string; 
    externalUrl?: string;
};
export type Lesson = {
    id: string;
    title: string;
    description: string;
    objective: string;
    duration: string;
    contentType: ContentType;
    material: Material | null;
};
export type ModuleDraft = {
    id: string;
    title: string;
    description: string;
    lessons: Lesson[];
};
export type QuizQuestion = {
    id: string;
    type: QuestionType;
    text: string;
    options: string[]; 
    correctIndex: number;
    points: number;
};
export type Quiz = {
    title: string;
    instructions: string;
    passingScore: number;
    attempts: number;
    questions: QuizQuestion[];
};
export type CourseDraft = {
    existingId?: string;
    status?: CourseStatus;
    title: string;
    description: string;
    category: CourseCategory | '';
    instructor: string;
    difficulty: Difficulty | '';
    duration: string;
    imagePreview: string | null;
    imageName: string | null;
    targetTypes: LearnerType[];
    departments: string[];
    positions: string;
    roles: string;
    relatedCompetency: string;
    requiredLevel: CompetencyLevel | '';
    developmentPurpose: string;
    owner: string;
    authors: string[];
    reviewers: string[];
    publisher: string;
    modules: ModuleDraft[];
    moduleQuizzes: Record<string, Quiz>; 
    finalAssessmentEnabled: boolean;
    finalAssessment: Quiz;
};
export type LibraryCourseInput = {
    title: string;
    category: CourseCategory;
    instructor: string;
    duration: string;
    status: CourseStatus;
    completionRate: number;
    lastUpdated: string;
    description: string;
    objectives: string[];
    targetLearners: LearnerType[];
    relatedCompetency: string;
    requiredLevel: CompetencyLevel | '';
    owner: string;
    authors: string[];
    reviewers: string[];
    publisher: string;
    modules: { id: string; title: string; lessonCount: number }[];
    assessments: { knowledgeChecks: number; hasFinalAssessment: boolean };
    enrollment: { enrolled: number; completed: number; inProgress: number; notStarted: number; avgAssessmentScore: number };
};
export const CATEGORIES: CourseCategory[] = ['Leadership', 'Technical Skills', 'Behavioral Skills', 'Safety & Compliance', 'Other'];
export const USER_POOL = ['Juan Dela Cruz', 'Ainah Sta. Maria', 'Emmanuel Cabanas', 'Lisa Montero', 'Mhicaela Buban', 'Kaye Caagusan'];
const INSTRUCTORS = USER_POOL;
export const CURRENT_USER = USER_POOL[0];
const DEPARTMENTS = ['All Departments', 'Sales', 'Marketing', 'Operations', 'Human Resources', 'Finance', 'IT', 'Customer Service'];
const COMPETENCIES = ['Leadership', 'Communication', 'Data Analysis', 'Customer Focus', 'Safety Awareness', 'Regulatory Compliance', 'Personal Effectiveness', 'Technical Proficiency'];
const DEVELOPMENT_PURPOSES = ['Close Competency Gap', 'Build New Skill', 'Prepare for Role Transition', 'Regulatory Requirement', 'General Development'];
const CONTENT_TYPES: ContentType[] = ['Video', 'PDF / Document', 'Presentation', 'Text / Reading', 'External Resource'];
const emptyQuiz = (): Quiz => ({ title: '', instructions: '', passingScore: 80, attempts: 2, questions: [] });
export const emptyDraft = (): CourseDraft => ({
    title: '',
    description: '',
    category: '',
    instructor: '',
    difficulty: '',
    duration: '',
    imagePreview: null,
    imageName: null,
    targetTypes: [],
    departments: [],
    positions: '',
    roles: '',
    relatedCompetency: '',
    requiredLevel: '',
    developmentPurpose: '',
    owner: '',
    authors: [],
    reviewers: [],
    publisher: '',
    modules: [],
    moduleQuizzes: {},
    finalAssessmentEnabled: false,
    finalAssessment: emptyQuiz(),
});
export function draftToLibraryCourse(draft: CourseDraft, status: CourseStatus, previous?: Partial<LibraryCourseInput>): LibraryCourseInput {
    return {
        title: draft.title || 'Untitled Course',
        category: (draft.category || 'Other') as CourseCategory,
        instructor: draft.instructor || draft.owner || USER_POOL[0],
        duration: draft.duration || '—',
        status,
        completionRate: previous?.completionRate ?? 0,
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        description: draft.description,
        objectives: previous?.objectives ?? [],
        targetLearners: draft.targetTypes,
        relatedCompetency: draft.relatedCompetency,
        requiredLevel: draft.requiredLevel,
        owner: draft.owner,
        authors: draft.authors,
        reviewers: draft.reviewers,
        publisher: draft.publisher,
        modules: draft.modules.map((m) => ({ id: m.id, title: m.title, lessonCount: m.lessons.length })),
        assessments: {
            knowledgeChecks: Object.keys(draft.moduleQuizzes).length,
            hasFinalAssessment: draft.finalAssessmentEnabled,
        },
        enrollment: previous?.enrollment ?? {
            enrolled: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            avgAssessmentScore: 0,
        },
    };
}
const uid = () => Math.random().toString(36).slice(2, 9);
function mockGenerateLessonDraft(input: { topic: string; difficulty: string; duration: string }) {
    const topic = input.topic.trim() || 'this topic';
    return {
        title: input.topic.trim() || 'New Lesson',
        description: `A ${input.difficulty ? input.difficulty.toLowerCase() : 'foundational'} lesson covering ${topic}, designed to take about ${input.duration || 'a short session'}.`,
        objective: `By the end of this lesson, learners can explain and apply ${topic} in their own work.`,
    };
}
type ModuleSuggestion = { title: string; lessons: string[] };
const CURATED_STRUCTURES: Record<string, ModuleSuggestion[]> = {
    leadership: [
        { title: 'Leadership Fundamentals', lessons: ['What Leadership Means Day to Day', 'Common Leadership Styles'] },
        { title: 'Effective Communication', lessons: ['Setting Clear Expectations', 'Giving Feedback That Lands'] },
        { title: 'Decision Making', lessons: ['A Simple Framework for Fast Decisions', 'Case Study: Under Pressure'] },
        { title: 'Team Leadership', lessons: ['Delegating Without Losing Control', 'Handling Team Conflict'] },
    ],
    communication: [
        { title: 'Foundations of Workplace Communication', lessons: ['Message Structure Basics', 'Choosing the Right Channel'] },
        { title: 'Active Listening', lessons: ['Listening to Understand vs. Reply', 'Reading Non-Verbal Cues'] },
        { title: 'Difficult Conversations', lessons: ['Preparing for a Hard Conversation', 'Staying Calm Under Pushback'] },
    ],
    safety: [
        { title: 'Workplace Safety Fundamentals', lessons: ['Introduction to Workplace Safety', 'Common Workplace Hazards'] },
        { title: 'Safety Procedures', lessons: ['Standard Operating Procedures', 'Personal Protective Equipment'] },
        { title: 'Emergency Response', lessons: ['Evacuation Routes and Assembly Points', 'First Response Basics'] },
    ],
    excel: [
        { title: 'Formulas & Functions', lessons: ['Multi-Condition Formulas', 'Lookup Functions'] },
        { title: 'Pivot Tables', lessons: ['Summarizing Large Datasets', 'Grouping and Filtering'] },
        { title: 'Dashboards', lessons: ['Designing a Simple Dashboard', 'Making It Interactive'] },
    ],
};
function mockSuggestModuleStructure(context: { title: string; category: string; competency: string }): ModuleSuggestion[] {
    const haystack = `${context.title} ${context.category} ${context.competency}`.toLowerCase();
    const key = Object.keys(CURATED_STRUCTURES).find((k) => haystack.includes(k));
    if (key) return CURATED_STRUCTURES[key];
    const topic = context.title.trim() || context.category || 'This Course';
    return [
        { title: `${topic} Fundamentals`, lessons: [`Introduction to ${topic}`, 'Key Terms and Concepts'] },
        { title: `Applying ${topic} in Practice`, lessons: ['Worked Examples', 'Common Mistakes to Avoid'] },
        { title: `${topic}: Building Confidence`, lessons: ['Practice Scenario', 'Self-Check and Next Steps'] },
    ];
}
function mockSuggestLessonsForModule(moduleTitle: string, category: string): { title: string; objective: string }[] {
    const haystack = `${moduleTitle} ${category}`.toLowerCase();
    const key = Object.keys(CURATED_STRUCTURES).find((k) => haystack.includes(k));
    if (key) {
        const match = CURATED_STRUCTURES[key].find((m) => moduleTitle && m.title.toLowerCase().includes(moduleTitle.toLowerCase().split(' ')[0]));
        const lessons = match?.lessons ?? CURATED_STRUCTURES[key][0].lessons;
        return lessons.map((l) => ({ title: l, objective: `Learners can apply "${l}" in a real work scenario.` }));
    }
    const topic = moduleTitle.trim() || 'this module';
    return [
        { title: `Introduction to ${topic}`, objective: `Learners understand the basics of ${topic}.` },
        { title: `Applying ${topic}`, objective: `Learners can apply ${topic} to a realistic scenario.` },
    ];
}
function mockAnalyzePdf(fileName: string): ModuleSuggestion {
    const clean = fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
    const haystack = clean.toLowerCase();
    const key = Object.keys(CURATED_STRUCTURES).find((k) => haystack.includes(k));
    if (key) {
        const structure = CURATED_STRUCTURES[key];
        return { title: structure[0].title, lessons: structure.flatMap((m) => m.lessons).slice(0, 4) };
    }
    return {
        title: clean || 'Document-Based Module',
        lessons: [`Overview of ${clean || 'the Document'}`, 'Key Concepts', 'Practical Application', 'Summary and Review'],
    };
}
function mockGenerateQuestions(groundingLabel: string, groundingItems: string[]): QuizQuestion[] {
    const items = groundingItems.filter((s) => s.trim().length > 0).slice(0, 3);
    const base = items.length > 0 ? items : [groundingLabel];
    const mcQuestions: QuizQuestion[] = base.map((item) => ({
        id: uid(),
        type: 'Multiple Choice',
        text: `Which of the following best reflects a key idea from "${item}"?`,
        options: [
            `A correct application of ${item}`,
            'An unrelated process from a different topic',
            'A common misconception about this content',
            'None of the above',
        ],
        correctIndex: 0,
        points: 1,
    }));
    const tfQuestion: QuizQuestion = {
        id: uid(),
        type: 'True/False',
        text: `${groundingLabel} content directly supports the course's stated learning objectives.`,
        options: ['True', 'False'],
        correctIndex: 0,
        points: 1,
    };
    return [...mcQuestions, tfQuestion];
}
const STATUS_BADGE_STYLES: Record<CourseStatus, string> = {
    Draft: 'bg-slate-100 text-slate-500',
    Review: 'bg-sky-100 text-sky-700',
    Published: 'bg-emerald-100 text-emerald-700',
    Archived: 'bg-amber-100 text-amber-700',
};
const STEPS = [
    'Basic Information',
    'Target Learners',
    'Competency Mapping',
    'Authors & Collaborators',
    'Course Structure',
    'Lessons & Learning Materials',
    'Knowledge Checks & Assessments',
    'Review',
    'Publish',
] as const;
function validateStep(n: number, draft: CourseDraft): Record<string, string> {
    const errors: Record<string, string> = {};
    if (n === 1) {
        if (!draft.title.trim()) errors.title = 'Course title is required.';
        if (!draft.description.trim()) errors.description = 'Course description is required.';
        if (!draft.category) errors.category = 'Please select a category.';
        if (!draft.instructor) errors.instructor = 'Please select an instructor.';
        if (!draft.difficulty) errors.difficulty = 'Please select a difficulty level.';
        if (!draft.duration.trim()) errors.duration = 'Estimated duration is required.';
    } else if (n === 2) {
        if (draft.targetTypes.length === 0) errors.targetTypes = 'Select at least one learner type.';
    } else if (n === 3) {
        if (!draft.relatedCompetency) errors.relatedCompetency = 'Please select a related competency.';
        if (!draft.requiredLevel) errors.requiredLevel = 'Please select a required level.';
    } else if (n === 4) {
        if (!draft.owner) errors.owner = 'A course owner is required.';
    } else if (n === 5) {
        if (draft.modules.length === 0) errors.modules = 'Add at least one module before continuing.';
    } else if (n === 6) {
        if (draft.modules.length === 0) {
            errors.lessons = 'Add a module in the previous step first.';
        } else if (!draft.modules.every((m) => m.lessons.length > 0)) {
            errors.lessons = 'Every module needs at least one lesson.';
        } else if (draft.modules.some((m) => m.lessons.some((l) => !l.title.trim()))) {
            errors.lessons = 'Every lesson needs a title.';
        }
    }
    return errors;
}
function Field({ label, required, children, hint, error }: { label: string; required?: boolean; children: React.ReactNode; hint?: string; error?: string }) {
    return (
        <label className="block">
            <span className="text-xs font-semibold text-slate-700">
                {label} {required && <span className="text-rose-500">*</span>}
            </span>
            <div className="mt-1">{children}</div>
            {error ? (
                <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-500">
                    <AlertCircle className="h-3 w-3" /> {error}
                </span>
            ) : (
                hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>
            )}
        </label>
    );
}
const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30';
function SectionCard({ title, icon: Icon, children }: { title: string; icon: typeof BookOpen; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
            </div>
            {children}
        </div>
    );
}
function QuestionEditor({
    quiz,
    onChange,
    groundingLabel,
    groundingItems,
    autoSuggest,
}: {
    quiz: Quiz;
    onChange: (q: Quiz) => void;
    groundingLabel?: string;
    groundingItems?: string[];
    autoSuggest?: boolean;
}) {
    const [loading, setLoading] = useState(false);
    const [draftQuestions, setDraftQuestions] = useState<QuizQuestion[] | null>(null);
    const [autoRan, setAutoRan] = useState(false);
    const hasGrounding = !!groundingLabel;
    const groundingReady = (groundingItems ?? []).some((s) => s.trim().length > 0);
    const generateWithAI = () => {
        if (!groundingLabel) return;
        setLoading(true);
        window.setTimeout(() => {
            setDraftQuestions(mockGenerateQuestions(groundingLabel, groundingItems ?? []));
            setLoading(false);
        }, 700);
    };
    useEffect(() => {
        if (autoSuggest && groundingReady && quiz.questions.length === 0 && !draftQuestions && !autoRan && !loading) {
            setAutoRan(true);
            generateWithAI();
        }
    }, [autoSuggest, groundingReady, quiz.questions.length]);
    const acceptDraft = () => {
        if (!draftQuestions) return;
        onChange({ ...quiz, questions: [...quiz.questions, ...draftQuestions] });
        setDraftQuestions(null);
    };
    const addQuestion = (type: QuestionType) => {
        const q: QuizQuestion = {
            id: uid(),
            type,
            text: '',
            options: type === 'Multiple Choice' ? ['', '', '', ''] : ['True', 'False'],
            correctIndex: 0,
            points: 1,
        };
        onChange({ ...quiz, questions: [...quiz.questions, q] });
    };
    const updateQuestion = (id: string, patch: Partial<QuizQuestion>) => {
        onChange({ ...quiz, questions: quiz.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
    };
    const removeQuestion = (id: string) => {
        onChange({ ...quiz, questions: quiz.questions.filter((q) => q.id !== id) });
    };
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title" required>
                    <input className={inputCls} value={quiz.title} onChange={(e) => onChange({ ...quiz, title: e.target.value })} placeholder="e.g. Module 2 Knowledge Check" />
                </Field>
                <Field label="Instructions">
                    <input className={inputCls} value={quiz.instructions} onChange={(e) => onChange({ ...quiz, instructions: e.target.value })} placeholder="e.g. Answer all questions to proceed" />
                </Field>
                <Field label="Passing Score (%)" required>
                    <input type="number" min={0} max={100} className={inputCls} value={quiz.passingScore} onChange={(e) => onChange({ ...quiz, passingScore: Number(e.target.value) })} />
                </Field>
                <Field label="Attempts Allowed" required>
                    <input type="number" min={1} className={inputCls} value={quiz.attempts} onChange={(e) => onChange({ ...quiz, attempts: Number(e.target.value) })} />
                </Field>
            </div>
            {hasGrounding && (
                <div className="rounded-lg border border-dashed border-[#F4B400]/60 bg-amber-50/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6400]">
                            <Sparkles className="h-3.5 w-3.5" /> Generate Quiz with Groq AI
                        </p>
                        <button
                            type="button"
                            disabled={!groundingReady || loading}
                            onClick={generateWithAI}
                            className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                            {loading ? 'Generating…' : 'Generate from ' + groundingLabel}
                        </button>
                    </div>
                    {!groundingReady && (
                        <p className="mt-1.5 text-[11px] text-slate-400">Add lesson titles first so questions can be grounded in real content.</p>
                    )}
                    {draftQuestions && (
                        <div className="mt-3 space-y-2">
                            <p className="text-[11px] font-semibold text-slate-500">AI DRAFT — REVIEW BEFORE ADDING</p>
                            {draftQuestions.map((q, i) => (
                                <div key={q.id} className="rounded-md bg-white px-2.5 py-2 text-xs text-slate-600">
                                    <span className="font-semibold text-slate-800">Q{i + 1} ({q.type}):</span> {q.text}
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <button type="button" onClick={generateWithAI} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                                </button>
                                <button type="button" onClick={() => setDraftQuestions(null)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                                    <ThumbsDown className="h-3.5 w-3.5" /> Discard
                                </button>
                                <button type="button" onClick={acceptDraft} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                                    <ThumbsUp className="h-3.5 w-3.5" /> Accept &amp; Add to Quiz
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="space-y-3">
                {quiz.questions.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                        No questions yet. Add a multiple choice or true/false question below, or generate a grounded draft above.
                    </p>
                )}
                {quiz.questions.map((q, idx) => (
                    <div key={q.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-semibold text-slate-400">Question {idx + 1} · {q.type}</span>
                            <button type="button" onClick={() => removeQuestion(q.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove question">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <input
                            className={`${inputCls} mt-2`}
                            placeholder="Question text"
                            value={q.text}
                            onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                        />
                        <div className="mt-2 space-y-1.5">
                            {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name={`correct-${q.id}`}
                                        checked={q.correctIndex === oi}
                                        onChange={() => updateQuestion(q.id, { correctIndex: oi })}
                                        className="h-3.5 w-3.5 accent-[#F4B400]"
                                    />
                                    {q.type === 'Multiple Choice' ? (
                                        <input
                                            className={inputCls}
                                            placeholder={`Option ${oi + 1}`}
                                            value={opt}
                                            onChange={(e) => {
                                                const options = [...q.options];
                                                options[oi] = e.target.value;
                                                updateQuestion(q.id, { options });
                                            }}
                                        />
                                    ) : (
                                        <span className="text-xs text-slate-600">{opt}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">Points</span>
                            <input
                                type="number"
                                min={1}
                                className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-[#F4B400] focus:outline-none"
                                value={q.points}
                                onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={() => addQuestion('Multiple Choice')} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    <Plus className="h-3.5 w-3.5" /> Multiple Choice
                </button>
                <button type="button" onClick={() => addQuestion('True/False')} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    <Plus className="h-3.5 w-3.5" /> True/False
                </button>
            </div>
        </div>
    );
}
function LessonAIPanel({ lesson, difficulty, onApply }: { lesson: Lesson; difficulty: string; onApply: (patch: Partial<Lesson>) => void }) {
    const [open, setOpen] = useState(false);
    const [topic, setTopic] = useState(lesson.title);
    const [duration, setDuration] = useState(lesson.duration);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ title: string; description: string; objective: string } | null>(null);
    const generate = () => {
        setLoading(true);
        window.setTimeout(() => {
            setResult(mockGenerateLessonDraft({ topic, difficulty, duration }));
            setLoading(false);
        }, 600);
    };
    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-[#F4B400] hover:bg-amber-50/40"
            >
                <Wand2 className="h-3 w-3" /> Generate Lesson Draft with AI
            </button>
        );
    }
    return (
        <div className="mt-2 rounded-lg border border-dashed border-[#F4B400]/60 bg-amber-50/30 p-2.5">
            <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6400]"><Sparkles className="h-3 w-3" /> Generate Lesson Draft</p>
                <button type="button" onClick={() => { setOpen(false); setResult(null); }} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input className={inputCls} placeholder="Lesson topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
                <input className={inputCls} placeholder="Estimated duration (e.g. 15 mins)" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <button
                type="button"
                disabled={!topic.trim() || loading}
                onClick={generate}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#dba300] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {loading ? 'Generating…' : 'Generate'}
            </button>
            {result && (
                <div className="mt-2 space-y-1 rounded-md bg-white p-2.5 text-xs text-slate-600">
                    <p><span className="font-semibold text-slate-800">Title:</span> {result.title}</p>
                    <p><span className="font-semibold text-slate-800">Description:</span> {result.description}</p>
                    <p><span className="font-semibold text-slate-800">Objective:</span> {result.objective}</p>
                    <div className="mt-2 flex gap-2">
                        <button type="button" onClick={generate} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                            <RefreshCw className="h-3 w-3" /> Regenerate
                        </button>
                        <button type="button" onClick={() => { setResult(null); setOpen(false); }} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                            <ThumbsDown className="h-3 w-3" /> Reject
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onApply({ title: result.title, description: result.description, objective: result.objective, duration });
                                setResult(null);
                                setOpen(false);
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                        >
                            <ThumbsUp className="h-3 w-3" /> Accept
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
export type CourseBuilderViewProps = {
    initialDraft?: Partial<CourseDraft>;
    initialStep?: number;
    onSaveDraft?: (course: LibraryCourseInput) => void;
    onSubmitForReview?: (course: LibraryCourseInput) => void;
    onPublish?: (course: LibraryCourseInput) => void;
    onCancel?: () => void;
};
export function CourseBuilderView({ initialDraft, initialStep, onSaveDraft, onSubmitForReview, onPublish, onCancel }: CourseBuilderViewProps) {
    const [step, setStep] = useState(initialStep ?? 1);
    const [furthestStep, setFurthestStep] = useState(initialStep ?? 1);
    const [attemptedContinue, setAttemptedContinue] = useState(false);
    const [draft, setDraft] = useState<CourseDraft>(() => ({ ...emptyDraft(), ...initialDraft }));
    const [published, setPublished] = useState<'draft' | 'review' | 'published' | null>(null);
    const [publishChoice, setPublishChoice] = useState<'draft' | 'review' | 'publish'>(draft.status === 'Review' ? 'review' : 'draft');
    const [expandedModule, setExpandedModule] = useState<string | null>(null);
    const [quizModuleId, setQuizModuleId] = useState<string | null>(null);
    const [structureSuggestion, setStructureSuggestion] = useState<ModuleSuggestion[] | null>(null);
    const [structureSuggestionDismissed, setStructureSuggestionDismissed] = useState(false);
    const [lessonSuggestions, setLessonSuggestions] = useState<Record<string, { title: string; objective: string }[] | null>>({});
    const [lessonSuggestionDismissed, setLessonSuggestionDismissed] = useState<Record<string, boolean>>({});
    const [pdfAnalysis, setPdfAnalysis] = useState<ModuleSuggestion | null>(null);
    const patch = (p: Partial<CourseDraft>) => setDraft((d) => ({ ...d, ...p }));
    const goTo = (n: number) => {
        if (n > furthestStep) return;
        setStep(n);
        setAttemptedContinue(false);
    };
    const continueFrom = (n: number) => {
        const errors = validateStep(n, draft);
        if (Object.keys(errors).length > 0) {
            setAttemptedContinue(true);
            return;
        }
        const nextStep = Math.min(9, n + 1);
        setFurthestStep((f) => Math.max(f, nextStep));
        setStep(nextStep);
        setAttemptedContinue(false);
    };
    const back = () => goTo(Math.max(1, step - 1));
    const currentErrors = attemptedContinue ? validateStep(step, draft) : {};
    const addModule = () => {
        const m: ModuleDraft = { id: uid(), title: `Module ${draft.modules.length + 1}`, description: '', lessons: [] };
        patch({ modules: [...draft.modules, m] });
        setExpandedModule(m.id);
    };
    const addModuleFromSuggestion = (s: ModuleSuggestion) => {
        const m: ModuleDraft = {
            id: uid(),
            title: s.title,
            description: '',
            lessons: s.lessons.map((title) => ({
                id: uid(), title, description: '', objective: `Learners can apply "${title}" in their own work.`,
                duration: '', contentType: 'Text / Reading' as ContentType, material: null,
            })),
        };
        patch({ modules: [...draft.modules, m] });
        return m;
    };
    const renameModule = (id: string, title: string) => patch({ modules: draft.modules.map((m) => (m.id === id ? { ...m, title } : m)) });
    const removeModule = (id: string) => patch({ modules: draft.modules.filter((m) => m.id !== id) });
    const moveModule = (id: string, dir: -1 | 1) => {
        const idx = draft.modules.findIndex((m) => m.id === id);
        const target = idx + dir;
        if (target < 0 || target >= draft.modules.length) return;
        const arr = [...draft.modules];
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        patch({ modules: arr });
    };
    useEffect(() => {
        if (step === 5 && draft.modules.length === 0 && draft.title.trim().length > 0 && !structureSuggestion && !structureSuggestionDismissed) {
            setStructureSuggestion(mockSuggestModuleStructure({ title: draft.title, category: draft.category, competency: draft.relatedCompetency }));
        }
    }, [step, draft.modules.length]);
    const applyStructureSuggestion = () => {
        if (!structureSuggestion) return;
        structureSuggestion.forEach((s) => addModuleFromSuggestion(s));
        setStructureSuggestion(null);
    };
    const dismissStructureSuggestion = () => { setStructureSuggestion(null); setStructureSuggestionDismissed(true); };
    const regenerateStructureSuggestion = () => setStructureSuggestion(mockSuggestModuleStructure({ title: draft.title + ' ', category: draft.category, competency: draft.relatedCompetency }));
    const addLesson = (moduleId: string) => {
        const lesson: Lesson = {
            id: uid(),
            title: '',
            description: '',
            objective: '',
            duration: '',
            contentType: 'Video',
            material: null,
        };
        patch({
            modules: draft.modules.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m)),
        });
    };
    const updateLesson = (moduleId: string, lessonId: string, p: Partial<Lesson>) => {
        patch({
            modules: draft.modules.map((m) =>
                m.id === moduleId ? { ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...p } : l)) } : m,
            ),
        });
    };
    const removeLesson = (moduleId: string, lessonId: string) => {
        patch({
            modules: draft.modules.map((m) => (m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m)),
        });
    };
    useEffect(() => {
        if (!expandedModule) return;
        const m = draft.modules.find((x) => x.id === expandedModule);
        if (
            m && m.lessons.length === 0 && m.title.trim().length > 0 &&
            lessonSuggestions[expandedModule] === undefined && !lessonSuggestionDismissed[expandedModule]
        ) {
            setLessonSuggestions((s) => ({ ...s, [expandedModule]: mockSuggestLessonsForModule(m.title, draft.category) }));
        }
    }, [expandedModule]);
    const applyLessonSuggestion = (moduleId: string, only?: number) => {
        const suggestions = lessonSuggestions[moduleId];
        if (!suggestions) return;
        const toAdd = only !== undefined ? [suggestions[only]] : suggestions;
        const newLessons: Lesson[] = toAdd.map((s) => ({
            id: uid(), title: s.title, description: '', objective: s.objective, duration: '', contentType: 'Text / Reading', material: null,
        }));
        patch({ modules: draft.modules.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons, ...newLessons] } : m)) });
        if (only === undefined) {
            setLessonSuggestions((s) => ({ ...s, [moduleId]: null }));
        } else {
            setLessonSuggestions((s) => ({ ...s, [moduleId]: (s[moduleId] ?? []).filter((_, i) => i !== only) }));
        }
    };
    const dismissLessonSuggestion = (moduleId: string) => {
        setLessonSuggestions((s) => ({ ...s, [moduleId]: null }));
        setLessonSuggestionDismissed((d) => ({ ...d, [moduleId]: true }));
    };
    const analyzePdf = (fileName: string) => setPdfAnalysis(mockAnalyzePdf(fileName));
    const applyPdfAnalysis = () => {
        if (!pdfAnalysis) return;
        addModuleFromSuggestion(pdfAnalysis);
        setPdfAnalysis(null);
    };
    const dismissPdfAnalysis = () => setPdfAnalysis(null);
    const checklist = useMemo(() => {
        return [
            { label: 'Course title and description added', ok: draft.title.trim().length > 0 && draft.description.trim().length > 0 },
            { label: 'Category, instructor, and difficulty set', ok: !!draft.category && !!draft.instructor && !!draft.difficulty },
            { label: 'At least one target learner type selected', ok: draft.targetTypes.length > 0 },
            { label: 'Related competency and required level mapped', ok: !!draft.relatedCompetency && !!draft.requiredLevel },
            { label: 'Course Owner assigned', ok: !!draft.owner },
            { label: 'At least one module created', ok: draft.modules.length > 0 },
            { label: 'Every module has at least one lesson', ok: draft.modules.length > 0 && draft.modules.every((m) => m.lessons.length > 0) },
        ];
    }, [draft]);
    const readyToPublish = checklist.every((c) => c.ok);
    const canPublish = readyToPublish && (!draft.publisher || draft.publisher === CURRENT_USER);
    const renderStep1 = () => (
        <SectionCard title="Basic Information" icon={BookOpen}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <Field label="Course Title" required error={currentErrors.title}>
                        <input className={inputCls} value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Leadership Essentials" />
                    </Field>
                </div>
                <div className="sm:col-span-2">
                    <Field label="Course Description" required error={currentErrors.description}>
                        <textarea rows={3} className={`${inputCls} resize-none`} value={draft.description} onChange={(e) => patch({ description: e.target.value })} placeholder="What will learners gain from this course?" />
                    </Field>
                </div>
                <Field label="Category" required error={currentErrors.category}>
                    <select className={inputCls} value={draft.category} onChange={(e) => patch({ category: e.target.value as CourseCategory })}>
                        <option value="" disabled>Select category</option>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </Field>
                <Field label="Instructor" required error={currentErrors.instructor}>
                    <select className={inputCls} value={draft.instructor} onChange={(e) => patch({ instructor: e.target.value })}>
                        <option value="" disabled>Select instructor</option>
                        {INSTRUCTORS.map((i) => <option key={i}>{i}</option>)}
                    </select>
                </Field>
                <Field label="Difficulty Level" required error={currentErrors.difficulty}>
                    <select className={inputCls} value={draft.difficulty} onChange={(e) => patch({ difficulty: e.target.value as Difficulty })}>
                        <option value="" disabled>Select level</option>
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                    </select>
                </Field>
                <Field label="Estimated Duration" required hint="e.g. 4 hours" error={currentErrors.duration}>
                    <input className={inputCls} value={draft.duration} onChange={(e) => patch({ duration: e.target.value })} placeholder="4 hours" />
                </Field>
                <div className="sm:col-span-2">
                    <Field label="Course Image" hint="Thumbnail shown in the Course Library. Stored locally for now.">
                        <div className="flex items-center gap-3">
                            {draft.imagePreview ? (
                                <img src={draft.imagePreview} alt="Course thumbnail preview" className="h-16 w-24 rounded-lg object-cover" />
                            ) : (
                                <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                            )}
                            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                <UploadCloud className="h-3.5 w-3.5" /> Upload Image
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        patch({ imagePreview: URL.createObjectURL(file), imageName: file.name });
                                    }}
                                />
                            </label>
                            {draft.imageName && <span className="text-[11px] text-slate-400">{draft.imageName}</span>}
                        </div>
                    </Field>
                </div>
            </div>
        </SectionCard>
    );
    const renderStep2 = () => (
        <SectionCard title="Target Learners" icon={Users}>
            <div className="space-y-4">
                <div>
                    <span className="text-xs font-semibold text-slate-700">Who is this course for? <span className="text-rose-500">*</span></span>
                    <div className="mt-2 flex gap-4">
                        {(['Employees', 'Trainees'] as LearnerType[]).map((t) => (
                            <label key={t} className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-[#F4B400]"
                                    checked={draft.targetTypes.includes(t)}
                                    onChange={(e) =>
                                        patch({
                                            targetTypes: e.target.checked ? [...draft.targetTypes, t] : draft.targetTypes.filter((x) => x !== t),
                                        })
                                    }
                                />
                                {t}
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <span className="text-xs font-semibold text-slate-700">Departments</span>
                    <p className="mt-0.5 text-[11px] text-slate-400">Optional. Leave blank or select "All Departments" if this course applies organization-wide. A course can apply to more than one department.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {DEPARTMENTS.map((d) => {
                            const active = draft.departments.includes(d);
                            return (
                                <button
                                    type="button"
                                    key={d}
                                    onClick={() =>
                                        patch({
                                            departments: active ? draft.departments.filter((x) => x !== d) : [...draft.departments, d],
                                        })
                                    }
                                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                        active ? 'border-[#F4B400] bg-amber-50 text-[#8a6400]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {d}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Position (optional)" hint="e.g. Team Leader, Sales Associate">
                        <input className={inputCls} value={draft.positions} onChange={(e) => patch({ positions: e.target.value })} />
                    </Field>
                    <Field label="Role (optional)" hint="e.g. Individual Contributor, Supervisor">
                        <input className={inputCls} value={draft.roles} onChange={(e) => patch({ roles: e.target.value })} />
                    </Field>
                </div>
            </div>
        </SectionCard>
    );
    const renderStep3 = () => (
        <SectionCard title="Competency Mapping" icon={GraduationCap}>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                This links the course to a competency gap so the system can later use course completion as supporting
                evidence. Completing this course does not automatically change a learner's competency level — that
                remains a Competency Management decision.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Related Competency" required>
                    <select className={inputCls} value={draft.relatedCompetency} onChange={(e) => patch({ relatedCompetency: e.target.value })}>
                        <option value="" disabled>Select competency</option>
                        {COMPETENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </Field>
                <Field label="Required Level" required>
                    <select className={inputCls} value={draft.requiredLevel} onChange={(e) => patch({ requiredLevel: e.target.value as CompetencyLevel })}>
                        <option value="" disabled>Select level</option>
                        <option>Basic</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                    </select>
                </Field>
                <div className="sm:col-span-2">
                    <Field label="Development Purpose">
                        <select className={inputCls} value={draft.developmentPurpose} onChange={(e) => patch({ developmentPurpose: e.target.value })}>
                            <option value="" disabled>Select purpose</option>
                            {DEVELOPMENT_PURPOSES.map((p) => <option key={p}>{p}</option>)}
                        </select>
                    </Field>
                </div>
            </div>
        </SectionCard>
    );
    const renderStep4 = () => (
        <SectionCard title="Authors & Collaborators" icon={Users}>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                The Course Owner can invite other Admin/HR users as Authors to help edit modules, lessons,
                materials, and assessments. Only the Owner or assigned Publisher can ultimately publish.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Course Owner" required error={currentErrors.owner}>
                    <select
                        className={inputCls}
                        value={draft.owner}
                        onChange={(e) => {
                            const owner = e.target.value;
                            patch({ owner, authors: draft.authors.includes(owner) ? draft.authors : [...draft.authors, owner] });
                        }}
                    >
                        <option value="" disabled>Select owner</option>
                        {USER_POOL.map((u) => <option key={u}>{u}</option>)}
                    </select>
                </Field>
                <Field label="Publisher" hint="Leave as 'Same as Owner' unless a different person should have final publish approval.">
                    <select className={inputCls} value={draft.publisher} onChange={(e) => patch({ publisher: e.target.value })}>
                        <option value="">Same as Owner</option>
                        {USER_POOL.map((u) => <option key={u}>{u}</option>)}
                    </select>
                </Field>
            </div>
            <div className="mt-3">
                <span className="text-xs font-semibold text-slate-700">Authors</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                    {USER_POOL.map((u) => {
                        const active = draft.authors.includes(u);
                        return (
                            <button
                                type="button"
                                key={u}
                                onClick={() => patch({ authors: active ? draft.authors.filter((a) => a !== u) : [...draft.authors, u] })}
                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${active ? 'border-[#F4B400] bg-amber-50 text-[#8a6400]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                {u}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="mt-3">
                <span className="text-xs font-semibold text-slate-700">Reviewers (optional)</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                    {USER_POOL.map((u) => {
                        const active = draft.reviewers.includes(u);
                        return (
                            <button
                                type="button"
                                key={u}
                                onClick={() => patch({ reviewers: active ? draft.reviewers.filter((a) => a !== u) : [...draft.reviewers, u] })}
                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${active ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                {u}
                            </button>
                        );
                    })}
                </div>
            </div>
        </SectionCard>
    );
    const renderStep5 = () => (
        <SectionCard title="Course Structure" icon={Layers}>
            <p className="mb-3 text-[11px] text-slate-400">Build the module outline first. You'll add lessons inside each module in the next step.</p>
            {currentErrors.modules && (
                <p className="mb-3 flex items-center gap-1 text-[11px] font-medium text-rose-500"><AlertCircle className="h-3 w-3" /> {currentErrors.modules}</p>
            )}
            {structureSuggestion && (
                <div className="mb-3 rounded-lg border border-dashed border-[#F4B400]/60 bg-amber-50/30 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6400]">
                        <Sparkles className="h-3.5 w-3.5" /> Based on your course title, description, target learners, and competency mapping, here are some suggested modules
                    </p>
                    <ol className="mt-2 space-y-1">
                        {structureSuggestion.map((s, i) => (
                            <li key={i} className="rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-600">
                                <span className="font-semibold text-slate-800">Module {i + 1} — {s.title}</span>
                                <div className="mt-0.5 pl-3 text-[11px] text-slate-400">{s.lessons.join(' · ')}</div>
                            </li>
                        ))}
                    </ol>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={regenerateStructureSuggestion} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                        </button>
                        <button type="button" onClick={dismissStructureSuggestion} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                            <ThumbsDown className="h-3.5 w-3.5" /> Dismiss
                        </button>
                        <button type="button" onClick={applyStructureSuggestion} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                            <ThumbsUp className="h-3.5 w-3.5" /> Apply Suggestions
                        </button>
                    </div>
                </div>
            )}
            <div className="space-y-2">
                {draft.modules.length === 0 && !structureSuggestion && (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">No modules yet. Add your first module below.</p>
                )}
                {draft.modules.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5">
                        <span className="w-16 shrink-0 text-[11px] font-semibold text-slate-400">Module {i + 1}</span>
                        <input className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:border-[#F4B400] focus:outline-none" value={m.title} onChange={(e) => renameModule(m.id, e.target.value)} />
                        <span className="text-[11px] text-slate-400">{m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}</span>
                        <button type="button" onClick={() => moveModule(m.id, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => moveModule(m.id, 1)} disabled={i === draft.modules.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => removeModule(m.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove module"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={addModule} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <Plus className="h-3.5 w-3.5" /> Add Module
            </button>
        </SectionCard>
    );
    const renderStep6 = () => {
        const isPdf = (name: string) => /\.pdf$/i.test(name);
        return (
            <SectionCard title="Lessons & Learning Materials" icon={ClipboardList}>
                {currentErrors.lessons && (
                    <p className="mb-3 flex items-center gap-1 text-[11px] font-medium text-rose-500"><AlertCircle className="h-3 w-3" /> {currentErrors.lessons}</p>
                )}
                {pdfAnalysis && (
                    <div className="mb-3 rounded-lg border border-dashed border-[#F4B400]/60 bg-amber-50/30 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6400]">
                            <Sparkles className="h-3.5 w-3.5" /> Analyzed PDF — suggested module structure
                        </p>
                        <div className="mt-2 rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-600">
                            <span className="font-semibold text-slate-800">New Module — {pdfAnalysis.title}</span>
                            <div className="mt-0.5 pl-3 text-[11px] text-slate-400">{pdfAnalysis.lessons.join(' · ')}</div>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">The original PDF stays attached to its lesson either way — this only adds a new module drafted from its contents.</p>
                        <div className="mt-2 flex gap-2">
                            <button type="button" onClick={dismissPdfAnalysis} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                                <ThumbsDown className="h-3 w-3" /> Dismiss
                            </button>
                            <button type="button" onClick={applyPdfAnalysis} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800">
                                <ThumbsUp className="h-3 w-3" /> Accept as New Module
                            </button>
                        </div>
                    </div>
                )}
                {draft.modules.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        No modules yet — add modules in the Course Structure step first.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {draft.modules.map((m, mi) => {
                            const isOpen = expandedModule === m.id;
                            return (
                                <div key={m.id} className="rounded-lg border border-slate-200">
                                    <button type="button" onClick={() => setExpandedModule(isOpen ? null : m.id)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
                                        <span className="text-xs font-semibold text-slate-800">Module {mi + 1} — {m.title || 'Untitled'}</span>
                                        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                    </button>
                                    {isOpen && (
                                        <div className="space-y-3 border-t border-slate-100 p-3">
                                            {lessonSuggestions[m.id] && lessonSuggestions[m.id]!.length > 0 && (
                                                <div className="rounded-lg border border-dashed border-[#F4B400]/60 bg-amber-50/30 p-2.5">
                                                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6400]">
                                                        <Sparkles className="h-3.5 w-3.5" /> Suggested lessons for this module
                                                    </p>
                                                    <ul className="mt-1.5 space-y-1">
                                                        {lessonSuggestions[m.id]!.map((s, si) => (
                                                            <li key={si} className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-600">
                                                                <span>{s.title}</span>
                                                                <button type="button" onClick={() => applyLessonSuggestion(m.id, si)} className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Add Lesson</button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <div className="mt-2 flex gap-2">
                                                        <button type="button" onClick={() => dismissLessonSuggestion(m.id)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                                                            <ThumbsDown className="h-3 w-3" /> Dismiss
                                                        </button>
                                                        <button type="button" onClick={() => applyLessonSuggestion(m.id)} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800">
                                                            <ThumbsUp className="h-3 w-3" /> Apply All
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {m.lessons.map((l, li) => (
                                                <div key={l.id} className="rounded-lg bg-slate-50 p-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-semibold text-slate-400">Lesson {li + 1}</span>
                                                        <button type="button" onClick={() => removeLesson(m.id, l.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove lesson"><Trash2 className="h-3.5 w-3.5" /></button>
                                                    </div>
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                        <input className={inputCls} placeholder="Lesson title" value={l.title} onChange={(e) => updateLesson(m.id, l.id, { title: e.target.value })} />
                                                        <select className={inputCls} value={l.contentType} onChange={(e) => updateLesson(m.id, l.id, { contentType: e.target.value as ContentType })}>
                                                            {CONTENT_TYPES.map((c) => <option key={c}>{c}</option>)}
                                                        </select>
                                                        <input className={inputCls} placeholder="Learning objective" value={l.objective} onChange={(e) => updateLesson(m.id, l.id, { objective: e.target.value })} />
                                                        <input className={inputCls} placeholder="Estimated duration (e.g. 15 mins)" value={l.duration} onChange={(e) => updateLesson(m.id, l.id, { duration: e.target.value })} />
                                                        <div className="sm:col-span-2">
                                                            <textarea rows={2} className={`${inputCls} resize-none`} placeholder="Short description" value={l.description} onChange={(e) => updateLesson(m.id, l.id, { description: e.target.value })} />
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                                                        <span className="text-[11px] font-semibold text-slate-400">Material:</span>
                                                        {l.contentType === 'External Resource' ? (
                                                            <input
                                                                className={`${inputCls} max-w-xs`}
                                                                placeholder="https://..."
                                                                value={l.material?.externalUrl ?? ''}
                                                                onChange={(e) => updateLesson(m.id, l.id, { material: { fileName: '', fileSize: '', externalUrl: e.target.value } })}
                                                            />
                                                        ) : l.material ? (
                                                            <>
                                                                <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-slate-600">
                                                                    <span className="max-w-[140px] truncate font-medium">{l.material.fileName}</span>
                                                                    <span className="text-slate-400">{l.material.fileSize}</span>
                                                                    <button type="button" onClick={() => updateLesson(m.id, l.id, { material: null })} className="text-rose-500 hover:text-rose-600" aria-label="Remove file"><X className="h-3 w-3" /></button>
                                                                </div>
                                                                {isPdf(l.material.fileName) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => analyzePdf(l.material!.fileName)}
                                                                        className="flex items-center gap-1.5 rounded-lg border border-[#F4B400]/60 bg-amber-50/50 px-2.5 py-1.5 text-[11px] font-semibold text-[#8a6400] hover:bg-amber-50"
                                                                    >
                                                                        <Wand2 className="h-3 w-3" /> Analyze &amp; Create Content
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                                                <UploadCloud className="h-3.5 w-3.5" /> Upload
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (!file) return;
                                                                        const sizeKb = (file.size / 1024).toFixed(0);
                                                                        updateLesson(m.id, l.id, {
                                                                            material: {
                                                                                fileName: file.name,
                                                                                fileSize: `${sizeKb} KB`,
                                                                                previewUrl: l.contentType === 'Video' ? URL.createObjectURL(file) : undefined,
                                                                            },
                                                                        });
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                        {l.contentType === 'Video' && l.material?.previewUrl && (
                                                            <video src={l.material.previewUrl} controls className="h-16 w-28 rounded-md bg-black" />
                                                        )}
                                                    </div>
                                                    <LessonAIPanel lesson={l} difficulty={draft.difficulty} onApply={(p) => updateLesson(m.id, l.id, p)} />
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addLesson(m.id)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                                <Plus className="h-3.5 w-3.5" /> Add Lesson
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className="mt-3 text-[11px] text-slate-400">
                    Files are held in memory for this preview only — a PDF stays attached as material regardless of
                    whether you also analyze it. Real storage/CDN upload and text extraction will be wired in once
                    the backend is available; the data shape here already separates file metadata from content.
                </p>
            </SectionCard>
        );
    };
    const renderStep7 = () => {
        const currentModuleId = quizModuleId ?? draft.modules[0]?.id ?? null;
        const currentQuiz = currentModuleId ? draft.moduleQuizzes[currentModuleId] : undefined;
        return (
            <div className="space-y-4">
                <SectionCard title="Knowledge Checks (per module)" icon={ClipboardList}>
                    {draft.modules.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Add modules first to attach knowledge checks.</p>
                    ) : (
                        <>
                            <div className="mb-3 flex flex-wrap gap-2">
                                {draft.modules.map((m, i) => (
                                    <button
                                        type="button"
                                        key={m.id}
                                        onClick={() => setQuizModuleId(m.id)}
                                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                            (currentModuleId === m.id) ? 'border-[#F4B400] bg-amber-50 text-[#8a6400]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}
                                    >
                                        Module {i + 1}: {m.title}
                                        {draft.moduleQuizzes[m.id] && <CheckCircle2 className="ml-1 inline h-3 w-3 text-emerald-500" />}
                                    </button>
                                ))}
                            </div>
                            {currentModuleId && !currentQuiz && (
                                <button
                                    type="button"
                                    onClick={() => patch({ moduleQuizzes: { ...draft.moduleQuizzes, [currentModuleId]: emptyQuiz() } })}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Knowledge Check for this Module
                                </button>
                            )}
                            {currentModuleId && currentQuiz && (
                                <QuestionEditor
                                    quiz={currentQuiz}
                                    onChange={(q) => patch({ moduleQuizzes: { ...draft.moduleQuizzes, [currentModuleId]: q } })}
                                    groundingLabel={`Module: ${draft.modules.find((m) => m.id === currentModuleId)?.title ?? ''}`}
                                    groundingItems={draft.modules.find((m) => m.id === currentModuleId)?.lessons.map((l) => l.title) ?? []}
                                    autoSuggest
                                />
                            )}
                        </>
                    )}
                </SectionCard>
                <SectionCard title="Final Assessment (course-level, optional)" icon={Award}>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-[#F4B400]"
                            checked={draft.finalAssessmentEnabled}
                            onChange={(e) => patch({ finalAssessmentEnabled: e.target.checked })}
                        />
                        This course has a Final Assessment
                    </label>
                    {draft.finalAssessmentEnabled && (
                        <div className="mt-3">
                            <QuestionEditor
                                quiz={draft.finalAssessment}
                                onChange={(q) => patch({ finalAssessment: q })}
                                groundingLabel={`Course: ${draft.title || 'Untitled Course'}`}
                                groundingItems={draft.modules.map((m) => m.title)}
                                autoSuggest
                            />
                        </div>
                    )}
                </SectionCard>
            </div>
        );
    };
    const summaryBody = (n: number): React.ReactNode => {
        switch (n) {
            case 1:
                return (
                    <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                        <p><span className="text-slate-400">Title:</span> {draft.title || '—'}</p>
                        <p><span className="text-slate-400">Category:</span> {draft.category || '—'}</p>
                        <p><span className="text-slate-400">Instructor:</span> {draft.instructor || '—'}</p>
                        <p><span className="text-slate-400">Difficulty:</span> {draft.difficulty || '—'}</p>
                        <p><span className="text-slate-400">Duration:</span> {draft.duration || '—'}</p>
                    </div>
                );
            case 2:
                return (
                    <div className="text-xs text-slate-600">
                        <p><span className="text-slate-400">Learner types:</span> {draft.targetTypes.join(', ') || '—'}</p>
                        <p><span className="text-slate-400">Departments:</span> {draft.departments.join(', ') || 'All / Not specified'}</p>
                    </div>
                );
            case 3:
                return (
                    <div className="text-xs text-slate-600">
                        <p><span className="text-slate-400">Competency:</span> {draft.relatedCompetency || '—'} · <span className="text-slate-400">Required Level:</span> {draft.requiredLevel || '—'}</p>
                        <p><span className="text-slate-400">Purpose:</span> {draft.developmentPurpose || '—'}</p>
                    </div>
                );
            case 4:
                return (
                    <div className="text-xs text-slate-600">
                        <p><span className="text-slate-400">Owner:</span> {draft.owner || '—'} · <span className="text-slate-400">Publisher:</span> {draft.publisher || 'Same as Owner'}</p>
                        <p><span className="text-slate-400">Authors:</span> {draft.authors.join(', ') || '—'}</p>
                        <p><span className="text-slate-400">Reviewers:</span> {draft.reviewers.join(', ') || 'None'}</p>
                    </div>
                );
            case 5:
                return (
                    <div className="text-xs text-slate-600">
                        {draft.modules.length === 0 ? '—' : (
                            <ol className="space-y-1">
                                {draft.modules.map((m, i) => (
                                    <li key={m.id}>Module {i + 1} — {m.title}</li>
                                ))}
                            </ol>
                        )}
                    </div>
                );
            case 6:
                return (
                    <div className="text-xs text-slate-600">
                        {draft.modules.length === 0 ? '—' : (
                            <ol className="space-y-1">
                                {draft.modules.map((m, i) => (
                                    <li key={m.id}>Module {i + 1} — {m.title} ({m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'})</li>
                                ))}
                            </ol>
                        )}
                    </div>
                );
            case 7:
                return (
                    <div className="text-xs text-slate-600">
                        <p>{Object.keys(draft.moduleQuizzes).length} module knowledge check(s) configured.</p>
                        <p>Final Assessment: {draft.finalAssessmentEnabled ? `Yes (${draft.finalAssessment.questions.length} questions)` : 'None'}</p>
                    </div>
                );
            default:
                return null;
        }
    };
    const renderStep8 = () => (
        <SectionCard title="Review" icon={ClipboardList}>
            <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <div key={n} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-700">{n}. {STEPS[n - 1]}</h3>
                            <button type="button" onClick={() => goTo(n)} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700">
                                <Pencil className="h-3 w-3" /> Edit
                            </button>
                        </div>
                        <div className="mt-2">{summaryBody(n)}</div>
                    </div>
                ))}
            </div>
        </SectionCard>
    );
    const renderStep9 = () => {
        if (published) {
            const label = published === 'published' ? 'Course Published' : published === 'review' ? 'Submitted for Review' : 'Draft Saved';
            const body =
                published === 'published'
                    ? `"${draft.title}" is now live in the Course Library. Assign it to learners from the Assign Learners quick action.`
                    : published === 'review'
                    ? `"${draft.title}" was submitted for review. ${draft.publisher ? draft.publisher : 'The assigned publisher'} can publish it once satisfied.`
                    : `"${draft.title}" was saved as a draft. You can continue editing it any time from the Course Library.`;
            return (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-6 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="mt-2 text-sm font-bold text-slate-800">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">{body}</p>
                </div>
            );
        }
        return (
            <SectionCard title="Publish" icon={Send}>
                <p className="mb-3 text-[11px] text-slate-400">Publishing is a deliberate action — nothing goes live until you confirm below.</p>
                <div className="space-y-2">
                    {checklist.map((c) => (
                        <div key={c.label} className="flex items-center gap-2 text-xs">
                            {c.ok ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                            <span className={c.ok ? 'text-slate-600' : 'text-slate-400'}>{c.label}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className={`cursor-pointer rounded-lg border p-3 text-xs ${publishChoice === 'draft' ? 'border-[#F4B400] bg-amber-50' : 'border-slate-200'}`}>
                        <input type="radio" name="publishChoice" className="mr-2 accent-[#F4B400]" checked={publishChoice === 'draft'} onChange={() => setPublishChoice('draft')} />
                        <span className="font-semibold text-slate-700">Save as Draft</span>
                        <p className="mt-1 text-[11px] text-slate-400">Not visible to learners. Keep editing any time.</p>
                    </label>
                    <label className={`cursor-pointer rounded-lg border p-3 text-xs ${publishChoice === 'review' ? 'border-[#F4B400] bg-amber-50' : 'border-slate-200'}`}>
                        <input type="radio" name="publishChoice" className="mr-2 accent-[#F4B400]" checked={publishChoice === 'review'} onChange={() => setPublishChoice('review')} />
                        <span className="font-semibold text-slate-700">Submit for Review</span>
                        <p className="mt-1 text-[11px] text-slate-400">Hands it to {draft.publisher || 'the assigned publisher'} to approve.</p>
                    </label>
                    <label className={`cursor-pointer rounded-lg border p-3 text-xs ${publishChoice === 'publish' ? 'border-[#F4B400] bg-amber-50' : 'border-slate-200'} ${!canPublish ? 'opacity-50' : ''}`}>
                        <input type="radio" name="publishChoice" className="mr-2 accent-[#F4B400]" checked={publishChoice === 'publish'} onChange={() => setPublishChoice('publish')} disabled={!canPublish} />
                        <span className="font-semibold text-slate-700">Publish Now</span>
                        <p className="mt-1 text-[11px] text-slate-400">
                            {!readyToPublish ? 'Complete the checklist above first.' : draft.publisher && draft.publisher !== CURRENT_USER ? `Only ${draft.publisher} can publish this course.` : 'Course becomes visible in the Course Library.'}
                        </p>
                    </label>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        const payload = draftToLibraryCourse(
                            draft,
                            publishChoice === 'publish' ? 'Published' : publishChoice === 'review' ? 'Review' : 'Draft',
                        );
                        if (publishChoice === 'publish') onPublish?.(payload);
                        else if (publishChoice === 'review') onSubmitForReview?.(payload);
                        else onSaveDraft?.(payload);
                        setPublished(publishChoice === 'publish' ? 'published' : publishChoice);
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#F4B400] py-2.5 text-xs font-semibold text-black hover:bg-[#dba300]"
                >
                    {publishChoice === 'publish' ? <Send className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                    {publishChoice === 'publish' ? 'Publish Course' : publishChoice === 'review' ? 'Submit for Review' : 'Save as Draft'}
                </button>
            </SectionCard>
        );
    };
    const stepRenderers: Record<number, () => ReturnType<typeof renderStep1>> = {
        1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4,
        5: renderStep5, 6: renderStep6, 7: renderStep7, 8: renderStep8, 9: renderStep9,
    };
    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            <div className="rounded-xl border border-slate-100 bg-white p-4 lg:sticky lg:top-4 lg:w-60 lg:shrink-0">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-slate-900">{draft.title || 'New Course'}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_STYLES[draft.status ?? 'Draft']}`}>{draft.status ?? 'Draft'}</span>
                </div>
                <ol>
                    {STEPS.map((label, i) => {
                        const n = i + 1;
                        const isActive = n === step;
                        const isDone = n <= furthestStep && n !== step;
                        const clickable = isDone;
                        return (
                            <li key={label} className="relative pb-5 pl-6 last:pb-0">
                                {i < STEPS.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" aria-hidden />}
                                <span
                                    className={`absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                                        isActive ? 'bg-[#F4B400] text-black' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                                    }`}
                                >
                                    {isDone ? <Check className="h-2.5 w-2.5" /> : isActive ? n : <Lock className="h-2 w-2" />}
                                </span>
                                <button
                                    type="button"
                                    disabled={!clickable}
                                    onClick={() => clickable && goTo(n)}
                                    className={`text-left text-[11px] font-semibold leading-4 ${
                                        isActive ? 'text-slate-900' : isDone ? 'cursor-pointer text-emerald-600 hover:text-emerald-700' : 'cursor-not-allowed text-slate-300'
                                    }`}
                                >
                                    {n}. {label}
                                </button>
                            </li>
                        );
                    })}
                </ol>
                {draft.owner && <p className="mt-1 text-[11px] text-slate-400">Owner: {draft.owner}</p>}
                {onCancel && (
                    <button type="button" onClick={onCancel} className="mt-3 text-[11px] font-semibold text-slate-400 hover:text-slate-700">
                        &larr; Back to Course Library
                    </button>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
                {STEPS.map((label, i) => {
                    const n = i + 1;

                    if (n > furthestStep) {
                        return (
                            <div key={n} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 opacity-60">
                                <Lock className="h-4 w-4 shrink-0 text-slate-300" />
                                <span className="text-xs font-semibold text-slate-400">{n}. {label}</span>
                            </div>
                        );
                    }

                    if (n === step) {
                        return (
                            <div key={n}>
                                {stepRenderers[n]()}
                                {!published && n < 9 && (
                                    <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3">
                                        <button
                                            type="button"
                                            onClick={back}
                                            disabled={n === 1}
                                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" /> Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => continueFrom(n)}
                                            className="flex items-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#dba300]"
                                        >
                                            {n === 8 ? 'Continue to Publish' : 'Continue'} <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return (
                        <div key={n} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {n}. {label}
                                </h3>
                                <button type="button" onClick={() => goTo(n)} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700">
                                    <Pencil className="h-3 w-3" /> Edit
                                </button>
                            </div>
                            {n <= 7 && <div className="mt-2">{summaryBody(n)}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
export default function CourseBuilder() {
    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">Course Builder</h1>}>
            <Head title="Course Builder" />
            <CourseBuilderView />
        </AuthenticatedLayout>
    );
}