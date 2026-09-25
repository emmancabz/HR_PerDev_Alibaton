import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { buildCompetencyProfiles, formatDate } from '@/data/competencyCalculations';
import { proficiencyLabel } from '@/data/competency';
import { useCompetencyServerStore, type CompetencyPayload } from '@/data/competencyServerStore';
import type { LearningState } from '@/data/learning';
import { learningClient, learningError } from '@/data/learningClient';
import { replaceSharedPersonnel, type PersonnelIdentity } from '@/data/personnel';
import { Head, Link, usePage } from '@inertiajs/react';
import { Award, CheckCircle2, CircleAlert, History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const tabs = ['Competency Progress', 'Skill Gaps', 'Learning History'] as const;
type DevelopmentTab = (typeof tabs)[number];

const statusTone: Record<string, string> = {
    'Requirements Met': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'Has Competency Gaps': 'bg-rose-50 text-rose-700 ring-rose-200',
    'Assessment Incomplete': 'bg-amber-50 text-amber-700 ring-amber-200',
    'Profile Not Assigned': 'bg-slate-100 text-slate-600 ring-slate-200',
    'Reassessment Due': 'bg-orange-50 text-orange-700 ring-orange-200',
};

function tabFromHash(): DevelopmentTab {
    if (typeof window === 'undefined') return 'Competency Progress';
    const decoded = decodeURIComponent(window.location.hash.replace(/^#/, '').replace(/\+/g, ' '));
    return tabs.includes(decoded as DevelopmentTab) ? (decoded as DevelopmentTab) : 'Competency Progress';
}

export default function UserSkillsWallet() {
    const page = usePage();
    const canonicalPersonnel = ((page.props as { canonicalPersonnel?: PersonnelIdentity[] }).canonicalPersonnel ?? []);
    useState(() => {
        replaceSharedPersonnel(canonicalPersonnel);
        return true;
    });

    const { state, storageError } = useCompetencyServerStore((page.props as unknown as { competency: CompetencyPayload }).competency);
    const authUser = page.props.auth.user;
    const isTrainee = authUser.persona === 'trainee';
    const profile = buildCompetencyProfiles(state).find((row) => row.person.id === authUser.personnel_key);
    const [activeTab, setActiveTab] = useState<DevelopmentTab>(() => tabFromHash());
    const [learningState, setLearningState] = useState<LearningState | null>(null);
    const [learningHistoryLoading, setLearningHistoryLoading] = useState(false);
    const [learningHistoryError, setLearningHistoryError] = useState('');

    useEffect(() => {
        const sync = () => setActiveTab(tabFromHash());
        window.addEventListener('hashchange', sync);
        return () => window.removeEventListener('hashchange', sync);
    }, []);

    useEffect(() => {
        if (activeTab !== 'Learning History' || learningState || learningHistoryLoading) return;

        let cancelled = false;
        setLearningHistoryLoading(true);
        setLearningHistoryError('');

        void learningClient
            .state()
            .then((next) => {
                if (!cancelled) setLearningState(next);
            })
            .catch((error) => {
                if (!cancelled) setLearningHistoryError(learningError(error));
            })
            .finally(() => {
                if (!cancelled) setLearningHistoryLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, learningState]);

    const gaps = useMemo(
        () => profile?.requirements.filter((detail) => ['Below Requirement', 'Not Assessed'].includes(detail.result)) ?? [],
        [profile],
    );

    const assessmentHistory = useMemo(
        () => profile?.requirements.filter((detail) => Boolean(detail.lastAssessed)).sort((a, b) => String(b.lastAssessed).localeCompare(String(a.lastAssessed))) ?? [],
        [profile],
    );

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
            detail: {
                source: 'learner-development',
                context: {
                    workspace: activeTab,
                    profile: profile
                        ? {
                              person: profile.person.fullName,
                              profileName: profile.profile?.name ?? null,
                              position: profile.person.position,
                              department: profile.person.department,
                          }
                        : null,
                    gaps: gaps.slice(0, 20).map((detail) => ({
                        competency: detail.competency?.name ?? detail.requirement.competencyId,
                        currentLevel: detail.currentLevel,
                        requiredLevel: detail.requirement.requiredLevel,
                        result: detail.result,
                    })),
                    assessmentHistoryCount: assessmentHistory.length,
                    learningHistoryLoaded: Boolean(learningState),
                    completedLearningCount: learningState?.completions?.length ?? 0,
                },
            },
        }));

        return () => {
            window.dispatchEvent(new CustomEvent('aevyn:screen-context', {
                detail: { source: 'learner-development', context: null },
            }));
        };
    }, [activeTab, profile, gaps, assessmentHistory.length, learningState]);

    const selectTab = (tab: DevelopmentTab) => {
        setActiveTab(tab);
        window.history.replaceState(null, '', `#${encodeURIComponent(tab)}`);
    };

    return (
        <AuthenticatedLayout
            header={
                isTrainee ? (
                    <div className="min-w-0 py-0.5">
                        <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-950">Learning Dashboard</h1>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">Current section: {activeTab}</p>
                    </div>
                ) : (
                    <h1 className="truncate text-sm font-bold text-slate-900">Development</h1>
                )
            }
        >
            <Head title="Development" />
            <div className="space-y-5">
                {storageError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{storageError}</div>}

                {activeTab === 'Learning History' ? (
                    <LearningHistory
                        assessmentHistory={assessmentHistory}
                        learningAssignments={learningState?.assignments ?? []}
                        learningCompletions={learningState?.completions ?? []}
                        loadingLearning={learningHistoryLoading}
                        learningErrorMessage={learningHistoryError}
                    />
                ) : !profile ? (
                    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <CircleAlert className="mx-auto h-7 w-7 text-slate-300" />
                        <h3 className="mt-3 text-sm font-bold text-slate-900">No canonical competency profile found</h3>
                        <p className="mt-1 text-xs text-slate-500">Your account is not linked to an active canonical personnel record.</p>
                    </section>
                ) : activeTab === 'Competency Progress' ? (
                    <CompetencyProgress profile={profile} />
                ) : (
                    <SkillGaps gaps={gaps} />
                )}

            </div>
        </AuthenticatedLayout>
    );
}

function CompetencyProgress({ profile }: { profile: ReturnType<typeof buildCompetencyProfiles>[number] }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-5 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Competency Progress Workspace</p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">Competency Progress</h3>
                <p className="mt-1 text-sm text-slate-500">Review validated progress toward your trainee development targets.</p>
            </header>

            {profile.requirements.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">No validated competency requirements are available yet.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-[1080px] w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-white text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            <tr>
                                <th className="px-5 py-3.5">Competency</th>
                                <th className="px-4 py-3.5">Category</th>
                                <th className="px-4 py-3.5">Current</th>
                                <th className="px-4 py-3.5">Target</th>
                                <th className="px-4 py-3.5">Gap</th>
                                <th className="px-4 py-3.5">Status</th>
                                <th className="px-4 py-3.5">Last Validated</th>
                                <th className="px-5 py-3.5">Related Learning</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {profile.requirements.map((detail) => {
                                const currentLevel = detail.currentLevel ?? null;
                                const targetLevel = detail.requirement.requiredLevel;
                                const gap = currentLevel === null ? null : Math.max(0, targetLevel - currentLevel);

                                const progressStatus = currentLevel === null
                                    ? { label: 'Not Assessed', className: 'bg-slate-100 text-slate-600' }
                                    : currentLevel >= targetLevel
                                      ? { label: 'Target Met', className: 'bg-emerald-50 text-emerald-700' }
                                      : gap !== null && gap >= 2
                                        ? { label: 'Needs Development', className: 'bg-rose-50 text-rose-700' }
                                        : { label: 'Developing', className: 'bg-amber-50 text-amber-700' };

                                const integrationDetail = detail as unknown as {
                                    relatedLearning?: string | { title?: string; href?: string } | null;
                                    relatedLearningTitle?: string | null;
                                    relatedLearningHref?: string | null;
                                };

                                const relatedLearningTitle =
                                    typeof integrationDetail.relatedLearning === 'string'
                                        ? integrationDetail.relatedLearning
                                        : integrationDetail.relatedLearning?.title ?? integrationDetail.relatedLearningTitle ?? null;

                                const relatedLearningHref =
                                    typeof integrationDetail.relatedLearning === 'object' && integrationDetail.relatedLearning
                                        ? integrationDetail.relatedLearning.href ?? integrationDetail.relatedLearningHref ?? null
                                        : integrationDetail.relatedLearningHref ?? null;

                                return (
                                    <tr key={detail.requirement.id} className="transition hover:bg-slate-50/70">
                                        <td className="px-5 py-4 font-bold text-slate-900">
                                            {detail.competency?.name ?? detail.requirement.competencyId}
                                        </td>
                                        <td className="px-4 py-4 text-slate-600">
                                            {detail.competency?.category ?? '—'}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex rounded-lg bg-slate-50 px-2.5 py-1 font-bold text-slate-700">
                                                {currentLevel === null ? 'Not Assessed' : `Level ${currentLevel}`}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 font-semibold text-slate-700">Level {targetLevel}</td>
                                        <td className="px-4 py-4 text-slate-600">
                                            {gap === null ? '—' : `${gap} ${gap === 1 ? 'level' : 'levels'}`}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${progressStatus.className}`}>
                                                {progressStatus.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-slate-600">
                                            {detail.lastAssessed ? formatDate(detail.lastAssessed) : '—'}
                                        </td>
                                        <td className="px-5 py-4">
                                            {relatedLearningTitle ? (
                                                relatedLearningHref ? (
                                                    <Link
                                                        href={relatedLearningHref}
                                                        className="font-semibold text-slate-800 underline decoration-amber-400 underline-offset-4 transition hover:text-amber-700"
                                                    >
                                                        {relatedLearningTitle}
                                                    </Link>
                                                ) : (
                                                    <span className="font-semibold text-slate-800">{relatedLearningTitle}</span>
                                                )
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function SkillGaps({ gaps }: { gaps: ReturnType<typeof buildCompetencyProfiles>[number]['requirements'] }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Skill Gaps</p>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-950">Development areas to focus on</h3>
                    <p className="mt-1 text-sm text-slate-500">Only gaps derived from the current validated competency profile are shown.</p>
                </div>
                <CircleAlert className="mt-1 h-5 w-5 text-amber-500" />
            </header>
            {gaps.length === 0 ? (
                <div className="p-10 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="mt-3 text-sm font-bold text-slate-900">No open validated skill gap</p>
                    <p className="mt-1 text-xs text-slate-500">Your current role-profile requirements do not show a below-requirement or not-assessed item.</p>
                </div>
            ) : (
                <RequirementTable title="Open Development Gaps" details={gaps} />
            )}
        </section>
    );
}

type DevelopmentHistoryItem = {
    id: string;
    activity: string;
    type: 'Course' | 'Training' | 'Assessment' | 'Certificate' | 'Competency Development' | string;
    relatedCourseTraining?: string | null;
    completionDate?: string | null;
    resultStatus?: string | null;
    hours?: number | string | null;
    certificate?: string | null;
    certificateHref?: string | null;
    certificateStatus?: string | null;
};

type QuarterFilter = 'All' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

function reviewPeriod(value?: string | null) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    const quarter = Math.floor(parsed.getMonth() / 3) + 1;
    return `Q${quarter} ${parsed.getFullYear()}`;
}

function LearningHistory({
    assessmentHistory,
    learningAssignments,
    learningCompletions,
    loadingLearning,
    learningErrorMessage,
}: {
    assessmentHistory: ReturnType<typeof buildCompetencyProfiles>[number]['requirements'];
    learningAssignments: any[];
    learningCompletions: any[];
    loadingLearning: boolean;
    learningErrorMessage: string;
}) {
    const page = usePage();
    const integrationHistory = ((page.props as { developmentLearningHistory?: DevelopmentHistoryItem[] }).developmentLearningHistory ?? []);
    const [filter, setFilter] = useState<'All' | 'Courses' | 'Training' | 'Assessments' | 'Certificates'>('All');
    const [quarterFilter, setQuarterFilter] = useState<QuarterFilter>('All');

    const learningRows: DevelopmentHistoryItem[] = learningCompletions
        .filter((completion: any) => Boolean(completion?.completed_at))
        .map((completion: any) => {
            const version = completion?.version_number ?? completion?.versionNumber ?? null;
            const code = completion?.code ?? completion?.course_code ?? null;
            const certificateIssued = Boolean(
                completion?.certificate_id ||
                completion?.certificate_number ||
                String(completion?.certificate_status ?? '').toLowerCase() === 'issued',
            );
            const certificateStatus = certificateIssued
                ? String(completion?.certificate_status ?? 'Issued')
                : String(completion?.certificate_status ?? 'Not issued');

            return {
                id: `learning-completion-${completion?.id ?? `${completion?.course_id ?? completion?.title}-${completion?.completed_at}`}`,
                activity: completion?.title ?? 'Completed course',
                type: 'Course',
                relatedCourseTraining: [code, version ? `Version ${version}` : null].filter(Boolean).join(' · ') || 'Online Learning',
                completionDate: completion?.completed_at ?? null,
                resultStatus: completion?.assessment_score !== null && completion?.assessment_score !== undefined
                    ? `Completed · Assessment ${completion.assessment_score}`
                    : 'Completed',
                hours: completion?.duration_hours ?? completion?.hours ?? null,
                certificate: certificateIssued ? (completion?.certificate_number ?? 'Issued certificate') : null,
                certificateHref: completion?.certificate_download_url ?? completion?.certificate_url ?? null,
                certificateStatus,
            } satisfies DevelopmentHistoryItem;
        });


    const completionVersionIds = new Set(
        learningCompletions
            .map((completion: any) =>
                String(completion?.course_version_id ?? completion?.courseVersionId ?? ''),
            )
            .filter(Boolean),
    );

    const assignmentRows: DevelopmentHistoryItem[] = learningAssignments
        .filter((assignment: any) => {
            const progress = Number(assignment?.progress_percent ?? 0);
            const completed =
                assignment?.status === 'Completed' ||
                assignment?.display_status === 'Completed' ||
                (Number.isFinite(progress) && progress >= 100);

            if (!completed) return false;

            const versionId = String(
                assignment?.course_version_id ?? assignment?.courseVersionId ?? '',
            );

            return !versionId || !completionVersionIds.has(versionId);
        })
        .map((assignment: any) => {
            const version = assignment?.version_number ?? assignment?.versionNumber ?? null;
            const code = assignment?.code ?? assignment?.course_code ?? null;

            return {
                id: `learning-assignment-${assignment?.id ?? `${assignment?.course_id ?? assignment?.title}-${assignment?.completed_at ?? ''}`}`,
                activity: assignment?.title ?? 'Completed course',
                type: 'Course',
                relatedCourseTraining:
                    [code, version ? `Version ${version}` : null].filter(Boolean).join(' · ') ||
                    'Online Learning',
                completionDate: assignment?.completed_at ?? null,
                resultStatus: 'Completed',
                hours: assignment?.duration_hours ?? assignment?.hours ?? null,
                certificate: null,
                certificateHref: null,
                certificateStatus: 'Not issued',
            } satisfies DevelopmentHistoryItem;
        });

    const competencyRows: DevelopmentHistoryItem[] = assessmentHistory.map((detail) => ({
        id: `competency-${detail.requirement.id}`,
        activity: `${detail.competency?.name ?? detail.requirement.competencyId} validation`,
        type: 'Competency Development',
        relatedCourseTraining: `Target Level ${detail.requirement.requiredLevel}`,
        completionDate: detail.lastAssessed ?? null,
        resultStatus: detail.currentLevel
            ? `Level ${detail.currentLevel} · ${detail.result === 'Meets Requirement' ? 'Target Met' : detail.result}`
            : detail.result,
        hours: null,
        certificate: null,
        certificateStatus: 'Not applicable',
    }));

    const uniqueRows = new Map<string, DevelopmentHistoryItem>();
    [...learningRows, ...assignmentRows, ...integrationHistory, ...competencyRows].forEach((row) => {
        const key = `${row.type}|${row.activity}|${row.completionDate ?? ''}`.toLowerCase();
        if (!uniqueRows.has(key)) uniqueRows.set(key, row);
    });

    const rows = [...uniqueRows.values()].sort((a, b) => {
        const aTime = a.completionDate ? new Date(a.completionDate).getTime() : 0;
        const bTime = b.completionDate ? new Date(b.completionDate).getTime() : 0;
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });

    const filteredRows = rows.filter((row) => {
        const typeMatches =
            filter === 'All' ||
            (filter === 'Courses' && row.type === 'Course') ||
            (filter === 'Training' && row.type === 'Training') ||
            (filter === 'Assessments' && row.type === 'Assessment') ||
            (filter === 'Certificates' && row.type === 'Certificate');
        if (!typeMatches) return false;

        if (quarterFilter === 'All') return true;
        return reviewPeriod(row.completionDate).startsWith(`${quarterFilter} `);
    });

    const filters = ['All', 'Courses', 'Training', 'Assessments', 'Certificates'] as const;
    const quarters: QuarterFilter[] = ['All', 'Q1', 'Q2', 'Q3', 'Q4'];

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Development Record</p>
                        <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">Learning History</h3>
                        <p className="mt-1 max-w-3xl text-sm text-slate-500">Completed learning becomes a permanent development record here and can support quarterly evaluation evidence. Course completion does not automatically mean a certificate was issued.</p>
                    </div>
                    {loadingLearning && <span className="text-xs font-semibold text-slate-400">Syncing learning records…</span>}
                </div>

                {learningErrorMessage && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                        {learningErrorMessage}
                    </div>
                )}

                <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Record Type</p>
                        <div className="flex flex-wrap gap-2">
                            {filters.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setFilter(item)}
                                    className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                                        filter === item
                                            ? 'bg-[#121922] text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                    }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Quarter / Review Period</p>
                        <div className="flex flex-wrap gap-2">
                            {quarters.map((quarter) => (
                                <button
                                    key={quarter}
                                    type="button"
                                    onClick={() => setQuarterFilter(quarter)}
                                    className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                                        quarterFilter === quarter
                                            ? 'bg-[#F4B400] text-slate-950'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                    }`}
                                >
                                    {quarter}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {filteredRows.length === 0 ? (
                <div className="p-10 text-center">
                    <History className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-900">No learning history available</p>
                    <p className="mt-1 text-xs text-slate-500">No completed development records match the selected filters yet.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-[1280px] w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-white text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            <tr>
                                <th className="px-5 py-3.5">Activity</th>
                                <th className="px-4 py-3.5">Type</th>
                                <th className="px-4 py-3.5">Course / Development Context</th>
                                <th className="px-4 py-3.5">Completed</th>
                                <th className="px-4 py-3.5">Review Period</th>
                                <th className="px-4 py-3.5">Result / Status</th>
                                <th className="px-4 py-3.5">Hours</th>
                                <th className="px-5 py-3.5">Certificate Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRows.map((row) => (
                                <tr key={row.id} className="transition hover:bg-slate-50/70">
                                    <td className="px-5 py-4 font-bold text-slate-900">{row.activity}</td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                                            {row.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-slate-600">{row.relatedCourseTraining || '—'}</td>
                                    <td className="px-4 py-4 text-slate-600">{row.completionDate ? formatDate(row.completionDate) : '—'}</td>
                                    <td className="px-4 py-4 font-semibold text-slate-700">{reviewPeriod(row.completionDate)}</td>
                                    <td className="px-4 py-4 text-slate-700">{row.resultStatus || '—'}</td>
                                    <td className="px-4 py-4 text-slate-600">{row.hours ?? '—'}</td>
                                    <td className="px-5 py-4">
                                        {row.certificate ? (
                                            row.certificateHref ? (
                                                <Link
                                                    href={row.certificateHref}
                                                    className="font-semibold text-slate-800 underline decoration-amber-400 underline-offset-4 transition hover:text-amber-700"
                                                >
                                                    {row.certificate}
                                                </Link>
                                            ) : (
                                                <span className="font-semibold text-emerald-700">{row.certificateStatus ?? row.certificate}</span>
                                            )
                                        ) : (
                                            <span className={row.type === 'Course' ? 'font-semibold text-slate-600' : 'text-slate-400'}>
                                                {row.certificateStatus ?? (row.type === 'Course' ? 'Not issued' : '—')}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function RequirementTable({ title, details, profileLabel }: { title: string; details: ReturnType<typeof buildCompetencyProfiles>[number]['requirements']; profileLabel?: string }) {
    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                    <h3 className="text-sm font-extrabold text-slate-950">{title}</h3>
                    {profileLabel && <p className="mt-1 text-[11px] text-slate-500">{profileLabel}</p>}
                </div>
                <Award className="h-5 w-5 text-amber-500" />
            </div>
            {details.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No requirement records are available for this view.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-[1120px] w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Competency</th>
                                <th className="px-4 py-3">Current Level</th>
                                <th className="px-4 py-3">Required</th>
                                <th className="px-4 py-3">Result</th>
                                <th className="px-4 py-3">Last Assessed</th>
                                <th className="px-4 py-3">Evidence</th>
                                <th className="px-4 py-3">Recommended Learning</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {details.map((detail) => {
                                const integrationDetail = detail as unknown as {
                                    recommendedLearning?:
                                        | string
                                        | { title?: string; href?: string }
                                        | Array<string | { title?: string; href?: string }>
                                        | null;
                                    recommendedLearningTitle?: string | null;
                                    recommendedLearningHref?: string | null;
                                };

                                const rawRecommendations = Array.isArray(integrationDetail.recommendedLearning)
                                    ? integrationDetail.recommendedLearning
                                    : integrationDetail.recommendedLearning
                                      ? [integrationDetail.recommendedLearning]
                                      : integrationDetail.recommendedLearningTitle
                                        ? [{
                                              title: integrationDetail.recommendedLearningTitle,
                                              href: integrationDetail.recommendedLearningHref ?? undefined,
                                          }]
                                        : [];

                                const recommendations = rawRecommendations
                                    .map((recommendation) =>
                                        typeof recommendation === 'string'
                                            ? { title: recommendation, href: undefined as string | undefined }
                                            : {
                                                  title: recommendation.title ?? '',
                                                  href: recommendation.href,
                                              },
                                    )
                                    .filter((recommendation) => recommendation.title.trim().length > 0);

                                return (
                                    <tr key={detail.requirement.id} className="hover:bg-slate-50/70">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-slate-900">{detail.competency?.name ?? detail.requirement.competencyId}</p>
                                            <p className="mt-0.5 text-[10px] text-slate-400">{detail.competency?.category ?? 'Definition unavailable'}</p>
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-700">{detail.currentLevel ? `${detail.currentLevel} · ${proficiencyLabel(detail.currentLevel)}` : 'Not Assessed'}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-700">{detail.requirement.requiredLevel} · {proficiencyLabel(detail.requirement.requiredLevel)}</td>
                                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${detail.result === 'Below Requirement' ? 'bg-rose-50 text-rose-700' : detail.result === 'Not Assessed' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{detail.result}</span></td>
                                        <td className="px-4 py-3 text-slate-600">{detail.lastAssessed ? formatDate(detail.lastAssessed) : '—'}</td>
                                        <td className="px-4 py-3 text-slate-600">{detail.evidenceCount}</td>
                                        <td className="px-4 py-3">
                                            {recommendations.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {recommendations.map((recommendation, index) =>
                                                        recommendation.href ? (
                                                            <Link
                                                                key={`${detail.requirement.id}-recommendation-${index}`}
                                                                href={recommendation.href}
                                                                className="block font-semibold text-slate-800 underline decoration-amber-400 underline-offset-4 transition hover:text-amber-700"
                                                            >
                                                                {recommendation.title}
                                                            </Link>
                                                        ) : (
                                                            <span
                                                                key={`${detail.requirement.id}-recommendation-${index}`}
                                                                className="block font-semibold text-slate-800"
                                                            >
                                                                {recommendation.title}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">No recommendation yet</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
