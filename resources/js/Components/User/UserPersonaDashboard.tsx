import { useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import {
    Award,
    BookOpen,
    CalendarClock,
    ClipboardCheck,
    ExternalLink,
    GraduationCap,
    Star,
    Users,
    Wallet,
} from 'lucide-react';

type DashboardState = {
    stats: {
        activeLearning: number;
        completedLearning: number;
        upcomingTraining: number;
        recognitions: number;
        latestPerformance: { rating: number; finalizedAt: string } | null;
    };
    learningDue: Array<{
        id: string;
        title: string;
        status: string;
        progress: number;
        dueAt: string | null;
    }>;
    upcomingTrainings: Array<{
        id: string;
        title: string;
        sessionLabel: string;
        startsAt: string;
        venue: string;
    }>;
};

type TeamState = {
    directReports: number;
    activeReviews: number;
};

type Persona = 'trainee' | 'employee' | 'supervisor' | 'manager';

type Props = {
    userName: string;
    persona: Persona;
    dashboard: DashboardState;
    team?: TeamState;
};

const personaCopy: Record<
    Persona,
    {
        eyebrow: string;
        subtitle: string;
    }
> = {

    trainee: {
        eyebrow: 'Trainee Learning Dashboard',
        subtitle:
            'Continue your learning path and keep your development moving forward.',
    },
    employee: {
        eyebrow: 'Employee Learning Dashboard',
        subtitle:
            'Continue your learning, training, and personal development in one workspace.',
    },
    supervisor: {
        eyebrow: 'Supervisor Learning Dashboard',
        subtitle:
            'Continue your own development while handling only the team responsibilities assigned to you.',
    },
    manager: {
        eyebrow: 'Manager Learning Dashboard',
        subtitle:
            'Continue your own development while handling authorized team responsibilities.',
    },
};

function fmtDate(value?: string | null) {
    if (!value) return 'No due date';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          });
}

function hrefFor(routeName: string, hash?: string) {
    const href = route(routeName);
    return hash ? `${href}#${encodeURIComponent(hash)}` : href;
}

export default function UserPersonaDashboard({
    userName,
    persona,
    dashboard,
    team,
}: Props) {
    const copy = personaCopy[persona];

    useEffect(() => {
        if (persona !== 'trainee') return;

        window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
            detail: {
                source: 'trainee-dashboard',
                context: {
                    workspace: 'Dashboard',
                    activeLearning: dashboard.stats.activeLearning,
                    completedLearning: dashboard.stats.completedLearning,
                    upcomingTraining: dashboard.stats.upcomingTraining,
                    currentLearning: dashboard.learningDue.slice(0, 4).map((row) => ({
                        title: row.title,
                        status: row.status,
                        progress: row.progress,
                        dueAt: row.dueAt,
                    })),
                    upcomingTrainingItems: dashboard.upcomingTrainings.slice(0, 4).map((row) => ({
                        title: row.title,
                        session: row.sessionLabel,
                        startsAt: row.startsAt,
                        venue: row.venue,
                    })),
                },
            },
        }));

        return () => {
            window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
                detail: { source: 'trainee-dashboard', context: null },
            }));
        };
    }, [dashboard, persona]);

    const currentLearning = dashboard.learningDue[0] ?? null;
    const remainingLearning = dashboard.learningDue.slice(1, 4);
    const upcoming = dashboard.upcomingTrainings.slice(0, 3);

    const isEmployeePlus = persona !== 'trainee';
    const isTeamLead = persona === 'supervisor' || persona === 'manager';

    const performance = dashboard.stats.latestPerformance;

    const developmentTiles = [
        {
            title: currentLearning?.title ?? 'My Learning',
            meta: currentLearning
                ? `${currentLearning.status} · ${currentLearning.progress}% complete`
                : 'Learning workspace',
            text: currentLearning
                ? 'Continue your current governed learning assignment.'
                : 'Open your assigned learning and eligible courses.',
            href: hrefFor('user.learning.index', 'My Courses'),
            icon: BookOpen,
        },
        {
            title: 'Competency Progress',
            meta: 'Development',
            text: 'Review your validated competency progress and skill gaps.',
            href: hrefFor('user.development.index', 'Competency Progress'),
            icon: Wallet,
        },
        {
            title: 'Certificates & Achievements',
            meta: 'Learning records',
            text: `${dashboard.stats.completedLearning} completed learning record${
                dashboard.stats.completedLearning === 1 ? '' : 's'
            }.`,
            href: hrefFor('user.certificates.index', 'Certificates'),
            icon: Award,
        },
    ];

    return (
        <AuthenticatedLayout
            header={
                persona === 'trainee' ? (
                    <div className="min-w-0 py-0.5">
                        <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-950">Learning Dashboard</h1>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">Current section: Dashboard</p>
                    </div>
                ) : (
                    <div className="min-w-0 py-0.5">
                        <p className="truncate text-[9px] font-bold uppercase tracking-[0.22em] text-amber-700">Learner LMS</p>
                        <h1 className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-slate-950">Learning Dashboard</h1>
                        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{copy.subtitle}</p>
                    </div>
                )
            }
        >
            <Head title="Learning Dashboard" />

            <div className="space-y-5 pb-8">
                {/* Standard trainee page title */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <header className="px-5 py-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            {copy.eyebrow}
                        </p>
                        <h2 className="mt-2 text-xl font-extrabold text-slate-950">
                            Welcome back, {userName}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {copy.subtitle}
                        </p>
                    </header>
                </section>

                {/* Current learning + right summary */}
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        {currentLearning ? (
                            <div className="grid min-h-[325px] lg:grid-cols-[58%_42%]">
                                <div className="flex flex-col p-6">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                                        Current Learning
                                    </p>

                                    <h3 className="mt-3 text-[24px] font-extrabold tracking-tight text-slate-950">
                                        {currentLearning.title}
                                    </h3>

                                    <div className="mt-5 rounded-lg bg-slate-50 px-4 py-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                            Up Next
                                        </p>

                                        <p className="mt-2 text-[16px] font-bold text-slate-900">
                                            Continue assigned learning
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {currentLearning.status} · Due{' '}
                                            {fmtDate(currentLearning.dueAt)}
                                        </p>
                                    </div>

                                    <div className="mt-auto pt-6">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-xs font-medium text-slate-600">
                                                Progress
                                            </span>

                                            <span className="text-xs font-extrabold text-slate-900">
                                                {currentLearning.progress}% complete
                                            </span>
                                        </div>

                                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                            <div
                                                className="h-full rounded-full bg-[#F4B63E]"
                                                style={{
                                                    width: `${Math.max(
                                                        0,
                                                        Math.min(
                                                            100,
                                                            currentLearning.progress,
                                                        ),
                                                    )}%`,
                                                }}
                                            />
                                        </div>

                                        <Link
                                            href={hrefFor(
                                                'user.learning.index',
                                                'My Courses',
                                            )}
                                            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#111827] px-5 text-sm font-bold text-white transition hover:bg-black"
                                        >
                                            {currentLearning.progress > 0
                                                ? 'Resume Learning'
                                                : 'Start Learning'}
                                        </Link>
                                    </div>
                                </div>

                                <Link
                                    href={hrefFor(
                                        'user.learning.index',
                                        'My Courses',
                                    )}
                                    className="bg-[#dceaf5] p-4 transition hover:bg-[#d2e4f1]"
                                >
                                    <div className="flex h-full min-h-[250px] flex-col justify-end rounded-xl border border-dashed border-slate-400/60 bg-[#cfe1ee] p-5">
                                        <GraduationCap className="h-9 w-9 text-slate-600" />

                                        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                                            Course Media
                                        </p>

                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                            Open your assigned course and continue
                                            from your saved learning progress.
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        ) : (
                            <div className="flex min-h-[325px] flex-col justify-center p-8">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                                    Current Learning
                                </p>

                                <h3 className="mt-3 text-2xl font-extrabold text-slate-950">
                                    No active learning yet
                                </h3>

                                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                                    Assigned learning and self-enrolled courses
                                    will appear here when available.
                                </p>

                                <div className="mt-5 flex flex-wrap gap-3">
                                    <Link
                                        href={hrefFor(
                                            'user.learning.index',
                                            'Course Catalog',
                                        )}
                                        className="rounded-lg bg-[#111827] px-5 py-2.5 text-sm font-bold text-white"
                                    >
                                        Browse Course Catalog
                                    </Link>

                                    <Link
                                        href={hrefFor(
                                            'user.learning.index',
                                            'Assigned Learning',
                                        )}
                                        className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700"
                                    >
                                        Assigned Learning
                                    </Link>
                                </div>
                            </div>
                        )}
                    </section>

                    <div className="space-y-4">
                        <Link
                            href={hrefFor(
                                'user.assessments.index',
                                'My Assessments',
                            )}
                            className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300"
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                Today&apos;s Learning
                            </p>

                            <p className="mt-3 text-[20px] font-extrabold text-slate-950">
                                {dashboard.stats.activeLearning} item
                                {dashboard.stats.activeLearning === 1 ? '' : 's'}{' '}
                                to review
                            </p>

                            <p className="mt-4 text-xs leading-5 text-slate-600">
                                {currentLearning
                                    ? `Continue ${currentLearning.title}`
                                    : 'No course currently in progress'}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Open My Assessments for available quizzes and
                                assessment records.
                            </p>
                        </Link>

                        <Link
                            href={hrefFor(
                                'user.learning.index',
                                'Learning Progress',
                            )}
                            className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300"
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                This Week
                            </p>

                            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-2xl font-extrabold text-slate-950">
                                        {dashboard.stats.activeLearning}
                                    </p>
                                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                                        Active
                                    </p>
                                </div>

                                <div>
                                    <p className="text-2xl font-extrabold text-slate-950">
                                        {dashboard.stats.upcomingTraining}
                                    </p>
                                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                                        Upcoming
                                    </p>
                                </div>

                                <div>
                                    <p className="text-2xl font-extrabold text-slate-950">
                                        {dashboard.stats.completedLearning}
                                    </p>
                                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                                        Completed
                                    </p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Aevyn */}
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <img
                                    src="/branding/aevyn.png"
                                    alt=""
                                    aria-hidden="true"
                                    className="h-5 w-5 rounded-full object-contain"
                                    draggable={false}
                                />

                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                    Recommended by Aevyn
                                </p>
                            </div>

                            <h3 className="mt-2 text-[19px] font-extrabold text-slate-950 dark:text-slate-100">
                                Learning connected to your development
                            </h3>
                        </div>

                        <Link
                            href={hrefFor(
                                'user.learning.index',
                                'Recommended Learning',
                            )}
                            className="text-xs font-semibold text-slate-700 underline decoration-amber-400 underline-offset-4 dark:text-slate-200"
                        >
                            View all
                        </Link>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {developmentTiles.map(
                            ({ title, meta, text, href, icon: Icon }) => (
                                <Link
                                    key={title}
                                    href={href}
                                    className="min-h-[112px] rounded-lg border border-slate-200 bg-[#fafafa] p-4 transition hover:border-amber-300 hover:bg-amber-50/40 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-amber-400/60 dark:hover:bg-slate-800"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                                                {title}
                                            </p>

                                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                {meta}
                                            </p>
                                        </div>

                                        <Icon className="h-4 w-4 shrink-0 text-amber-600" />
                                    </div>

                                    <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                        {text}
                                    </p>
                                </Link>
                            ),
                        )}
                    </div>
                </section>

                {/* Training + Assessments */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                    Upcoming Training
                                </p>

                                <h3 className="mt-2 text-lg font-extrabold text-slate-950">
                                    Next sessions
                                </h3>
                            </div>

                            <Link
                                href={hrefFor(
                                    'user.training.index',
                                    'Schedule',
                                )}
                                className="text-xs font-semibold text-slate-700 underline decoration-amber-400 underline-offset-4"
                            >
                                View schedule
                            </Link>
                        </div>

                        <div className="mt-4">
                            {upcoming.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-200 px-5 py-7 text-center">
                                    <CalendarClock className="mx-auto h-5 w-5 text-slate-400" />
                                    <p className="mt-2 text-xs text-slate-500">
                                        No upcoming training session is assigned
                                        to you.
                                    </p>
                                </div>
                            ) : (
                                upcoming.map((session) => (
                                    <Link
                                        key={session.id}
                                        href={hrefFor(
                                            'user.training.index',
                                            'Schedule',
                                        )}
                                        className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 first:border-t-0"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-800">
                                                {session.title}
                                            </p>

                                            <p className="mt-1 text-[11px] text-slate-500">
                                                {session.sessionLabel} ·{' '}
                                                {fmtDate(session.startsAt)}
                                            </p>
                                        </div>

                                        <span className="shrink-0 text-[10px] text-slate-500">
                                            {session.venue || 'Venue TBA'}
                                        </span>
                                    </Link>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                    Pending Assessments
                                </p>

                                <h3 className="mt-2 text-lg font-extrabold text-slate-950">
                                    Keep your learning moving
                                </h3>
                            </div>

                            <Link
                                href={hrefFor(
                                    'user.assessments.index',
                                    'My Assessments',
                                )}
                                className="text-xs font-semibold text-slate-700 underline decoration-amber-400 underline-offset-4"
                            >
                                View assessments
                            </Link>
                        </div>

                        <div className="mt-4">
                            {remainingLearning.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-200 px-5 py-7 text-center">
                                    <ClipboardCheck className="mx-auto h-5 w-5 text-slate-400" />
                                    <p className="mt-2 text-xs text-slate-500">
                                        No additional learning item currently
                                        needs attention.
                                    </p>
                                </div>
                            ) : (
                                remainingLearning.map((item) => (
                                    <Link
                                        key={item.id}
                                        href={hrefFor(
                                            'user.learning.index',
                                            'My Courses',
                                        )}
                                        className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 first:border-t-0"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-800">
                                                {item.title}
                                            </p>

                                            <p className="mt-1 text-[11px] text-slate-500">
                                                {item.status} · Due{' '}
                                                {fmtDate(item.dueAt)}
                                            </p>
                                        </div>

                                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                                            {item.progress}%
                                        </span>
                                    </Link>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Employee / Supervisor / Manager personal records */}
                {isEmployeePlus && (
                    <section className="grid gap-4 lg:grid-cols-2">
                        <Link
                            href={hrefFor(
                                'user.performance.index',
                                'My Performance',
                            )}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        My Performance
                                    </p>

                                    <h3 className="mt-2 text-base font-extrabold text-slate-950">
                                        Personal performance records
                                    </h3>
                                </div>

                                <Star className="h-5 w-5 text-amber-500" />
                            </div>

                            <p className="mt-4 text-xs leading-5 text-slate-600">
                                {performance
                                    ? `Latest finalized rating: ${performance.rating.toFixed(
                                          2,
                                      )} / 5 · ${fmtDate(
                                          performance.finalizedAt,
                                      )}`
                                    : 'No finalized performance rating is available yet.'}
                            </p>
                        </Link>

                        <Link
                            href={route('user.leaderboard.index')}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Recognition
                                    </p>

                                    <h3 className="mt-2 text-base font-extrabold text-slate-950">
                                        Recognition records
                                    </h3>
                                </div>

                                <Award className="h-5 w-5 text-amber-500" />
                            </div>

                            <p className="mt-4 text-xs text-slate-600">
                                {dashboard.stats.recognitions} recognition
                                record
                                {dashboard.stats.recognitions === 1 ? '' : 's'}{' '}
                                available to your account.
                            </p>
                        </Link>
                    </section>
                )}

                {/* Supervisor / Manager */}
                {isTeamLead && (
                    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                    My Team Reviews
                                </p>

                                <h3 className="mt-2 text-lg font-extrabold text-slate-950">
                                    Assigned evaluator responsibilities
                                </h3>

                                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                                    Only direct-report or explicitly assigned
                                    Performance reviews are shown here.
                                </p>
                            </div>

                            <Link
                                href={hrefFor(
                                    'user.performance.index',
                                    'My Team Reviews',
                                )}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2.5 text-xs font-bold text-white"
                            >
                                Open My Team Reviews
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-slate-50 p-4">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Users className="h-4 w-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">
                                        Direct Reports
                                    </span>
                                </div>

                                <p className="mt-2 text-2xl font-extrabold text-slate-950">
                                    {team?.directReports ?? 0}
                                </p>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-4">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <ClipboardCheck className="h-4 w-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">
                                        Assigned Reviews
                                    </span>
                                </div>

                                <p className="mt-2 text-2xl font-extrabold text-slate-950">
                                    {team?.activeReviews ?? 0}
                                </p>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
