import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { Award, CalendarClock, CheckCircle2, CircleAlert, ShieldCheck, Target } from 'lucide-react';
import { buildCompetencyProfiles, formatDate } from '@/data/competencyCalculations';
import { proficiencyLabel } from '@/data/competency';
import { useCompetencyServerStore, type CompetencyPayload } from '@/data/competencyServerStore';
import { useState } from 'react';
import { replaceSharedPersonnel, type PersonnelIdentity } from '@/data/personnel';

const statusTone: Record<string, string> = {
    'Requirements Met': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'Has Competency Gaps': 'bg-rose-50 text-rose-700 ring-rose-200',
    'Assessment Incomplete': 'bg-amber-50 text-amber-700 ring-amber-200',
    'Profile Not Assigned': 'bg-slate-100 text-slate-600 ring-slate-200',
    'Reassessment Due': 'bg-orange-50 text-orange-700 ring-orange-200',
};

export default function UserSkillsWallet() {
    const page = usePage();
    const canonicalPersonnel = ((page.props as { canonicalPersonnel?: PersonnelIdentity[] }).canonicalPersonnel ?? []);
    useState(() => { replaceSharedPersonnel(canonicalPersonnel); return true; });

    const { state, storageError } = useCompetencyServerStore((page.props as unknown as { competency: CompetencyPayload }).competency);
    const authUser = page.props.auth.user;
    const profile = buildCompetencyProfiles(state).find((row) => row.person.id === authUser.personnel_key);

    return (
        <AuthenticatedLayout header={<h1 className="truncate text-sm font-bold text-slate-900">My Skills Wallet</h1>}>
            <Head title="My Skills Wallet" />
            <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600">Validated competency profile</p>
                            <h2 className="mt-1 text-xl font-extrabold text-slate-950">My Skills Wallet</h2>
                            <a href="/competency#assessments" className="mt-2 inline-flex text-xs font-semibold text-amber-700 hover:underline">Open assessment workspace</a>
                            <p className="mt-1 text-xs text-slate-500">Only finalized competency assessments are treated as official validated levels.</p>
                        </div>
                        {profile && <span className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${statusTone[profile.status] ?? statusTone['Profile Not Assigned']}`}>{profile.status}</span>}
                    </div>
                </section>

                {storageError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{storageError}</div>}

                {!profile ? (
                    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <CircleAlert className="mx-auto h-7 w-7 text-slate-300" />
                        <h3 className="mt-3 text-sm font-bold text-slate-900">No canonical competency profile found</h3>
                        <p className="mt-1 text-xs text-slate-500">Your account is not linked to an active canonical personnel record.</p>
                    </section>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {[
                                { label: 'Profile Coverage', value: `${profile.coverage}%`, icon: Target },
                                { label: 'Meets / Exceeds', value: profile.meetsOrExceeds, icon: CheckCircle2 },
                                { label: 'Open Gaps', value: profile.openGaps, icon: CircleAlert },
                                { label: 'Not Assessed', value: profile.notAssessed, icon: ShieldCheck },
                                { label: 'Next Reassessment', value: profile.nextReassessment ? formatDate(profile.nextReassessment) : 'Not scheduled', icon: CalendarClock },
                            ].map(({ label, value, icon: Icon }) => (
                                <article key={label} className="app-kpi-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><Icon className="h-4 w-4 text-amber-500" /></div>
                                    <p className="mt-2 text-lg font-extrabold text-slate-950">{value}</p>
                                </article>
                            ))}
                        </div>

                        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                                <div>
                                    <h3 className="text-sm font-extrabold text-slate-950">Validated Requirements</h3>
                                    <p className="mt-1 text-[11px] text-slate-500">{profile.profile ? `${profile.profile.name} · v${profile.profile.version}` : 'No active role profile assigned'}</p>
                                </div>
                                <Award className="h-5 w-5 text-amber-500" />
                            </div>
                            {!profile.profile || profile.requirements.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-500">No active role-profile requirements are assigned to your current canonical position.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                                            <tr><th className="px-4 py-3">Competency</th><th className="px-4 py-3">Current Level</th><th className="px-4 py-3">Required</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Last Assessed</th><th className="px-4 py-3">Evidence</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {profile.requirements.map((detail) => (
                                                <tr key={detail.requirement.id} className="hover:bg-slate-50/70">
                                                    <td className="px-4 py-3"><p className="font-bold text-slate-900">{detail.competency?.name ?? detail.requirement.competencyId}</p><p className="mt-0.5 text-[10px] text-slate-400">{detail.competency?.category ?? 'Definition unavailable'}</p></td>
                                                    <td className="px-4 py-3 font-semibold text-slate-700">{detail.currentLevel ? `${detail.currentLevel} · ${proficiencyLabel(detail.currentLevel)}` : 'Not Assessed'}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-700">{detail.requirement.requiredLevel} · {proficiencyLabel(detail.requirement.requiredLevel)}</td>
                                                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${detail.result === 'Below Requirement' ? 'bg-rose-50 text-rose-700' : detail.result === 'Not Assessed' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{detail.result}</span></td>
                                                    <td className="px-4 py-3 text-slate-600">{detail.lastAssessed ? formatDate(detail.lastAssessed) : '—'}</td>
                                                    <td className="px-4 py-3 text-slate-600">{detail.evidenceCount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
                            Learning or Training completion is supporting development evidence only. A competency gap closes only after a new finalized competency assessment validates the required level.
                        </div>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
