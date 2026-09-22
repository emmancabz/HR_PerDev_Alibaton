import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, IdCard, Mail, Send, ShieldAlert, UserCog } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

type RecoveryView = 'standard' | 'admin_recovery' | 'success';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const [view, setView] = useState<RecoveryView>('standard');
    const [adminData, setAdminData] = useState({
        employeeId: '',
        companyEmail: '',
        personalGmail: '',
    });

    const submitStandard: FormEventHandler = (event) => {
        event.preventDefault();
        post(route('password.email'));
    };

    const submitAdminRecovery: FormEventHandler = (event) => {
        event.preventDefault();
        setView('success');
    };

    return (
        <GuestLayout surface={false}>
            <Head title="Forgot password" />

            <style>{`
                @keyframes authPageEnter {
                    from {
                        opacity: 0;
                        transform: translateY(16px) scale(0.985);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes authPanelSwap {
                    from {
                        opacity: 0;
                        transform: translateY(12px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .auth-page-enter {
                    animation: authPageEnter 380ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .auth-panel-enter {
                    animation: authPanelSwap 280ms cubic-bezier(0.22, 1, 0.36, 1);
                }
            `}</style>

            <div className="mx-auto w-full max-w-[470px] auth-page-enter">
                {status && (
                    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm font-medium text-emerald-700">
                        {status}
                    </div>
                )}

                <div className="rounded-[30px] border border-white/70 bg-white/88 p-6 shadow-[0_28px_90px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
                    <div className="mb-6 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                            <img
                                src={alibatonLogo}
                                alt="Alibaton Construction Incorporated"
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                        <h1 className="text-[34px] font-bold tracking-tight text-slate-900">Account Recovery</h1>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            We&apos;ll help you regain access to your HR — Performance &amp; Development account.
                        </p>
                    </div>

                    <div key={view} className="auth-panel-enter">
                        {view === 'standard' && (
                            <>
                                <div className="mb-6 text-center text-sm leading-6 text-slate-600">
                                    Forgot your password? Enter your Alibaton email and we&apos;ll send a secure reset link.
                                </div>

                                <form onSubmit={submitStandard} className="space-y-4">
                                    <div>
                                        <InputLabel htmlFor="email" value="Alibaton Email" className="text-sm font-semibold text-slate-700" />
                                        <div className="relative mt-1.5">
                                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                            <TextInput
                                                id="email"
                                                type="email"
                                                name="email"
                                                value={data.email}
                                                className="block w-full rounded-xl border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-800 shadow-sm transition focus:border-amber-300 focus:ring-amber-100"
                                                isFocused={true}
                                                placeholder="name@alibaton-ph.com"
                                                onChange={(e) => setData('email', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <InputError message={errors.email} className="mt-2" />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-[linear-gradient(135deg,#111827_0%,#1f2937_62%,#b45309_100%)] px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-[0_20px_40px_-24px_rgba(180,83,9,0.45)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Send className="h-4 w-4" />
                                        Send Reset Link
                                    </button>
                                </form>

                                <div className="mt-7 border-t border-slate-200 pt-6 text-center">
                                    <p className="text-sm text-slate-500">Lost access to your company email?</p>
                                    <button
                                        type="button"
                                        onClick={() => setView('admin_recovery')}
                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40"
                                    >
                                        <UserCog className="h-4 w-4 text-amber-700" />
                                        Try another option
                                    </button>
                                </div>
                            </>
                        )}

                        {view === 'admin_recovery' && (
                            <>
                                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm leading-6 text-slate-700 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <ShieldAlert className="mt-0.5 h-5 w-5 flex-none text-amber-700" />
                                        <p>
                                            Provide your details below. An Admin will review your information and manually help restore your account.
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={submitAdminRecovery} className="space-y-4">
                                    <div>
                                        <InputLabel htmlFor="employeeId" value="Employee ID" className="text-sm font-semibold text-slate-700" />
                                        <div className="relative mt-1.5">
                                            <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                            <TextInput
                                                id="employeeId"
                                                type="text"
                                                value={adminData.employeeId}
                                                className="block w-full rounded-xl border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-800 shadow-sm transition focus:border-amber-300 focus:ring-amber-100"
                                                placeholder="e.g. EMP-2026-01"
                                                onChange={(e) => setAdminData({ ...adminData, employeeId: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <InputLabel htmlFor="companyEmail" value="Company Email" className="text-sm font-semibold text-slate-700" />
                                        <div className="relative mt-1.5">
                                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                            <TextInput
                                                id="companyEmail"
                                                type="email"
                                                value={adminData.companyEmail}
                                                className="block w-full rounded-xl border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-800 shadow-sm transition focus:border-amber-300 focus:ring-amber-100"
                                                placeholder="name@alibaton-ph.com"
                                                onChange={(e) => setAdminData({ ...adminData, companyEmail: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <InputLabel htmlFor="personalGmail" value="Personal Gmail" className="text-sm font-semibold text-slate-700" />
                                        <div className="relative mt-1.5">
                                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                            <TextInput
                                                id="personalGmail"
                                                type="email"
                                                value={adminData.personalGmail}
                                                className="block w-full rounded-xl border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-800 shadow-sm transition focus:border-amber-300 focus:ring-amber-100"
                                                placeholder="yourname@gmail.com"
                                                onChange={(e) => setAdminData({ ...adminData, personalGmail: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-[linear-gradient(135deg,#111827_0%,#1f2937_62%,#b45309_100%)] px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-[0_20px_40px_-24px_rgba(180,83,9,0.45)] transition hover:brightness-105"
                                    >
                                        <Send className="h-4 w-4" />
                                        Submit to Admin
                                    </button>
                                </form>

                                <div className="mt-5 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setView('standard')}
                                        className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-amber-700"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Back to Standard Reset
                                    </button>
                                </div>
                            </>
                        )}

                        {view === 'success' && (
                            <div className="space-y-4 py-6 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Request Submitted</h3>
                                <p className="mx-auto max-w-sm text-sm leading-6 text-slate-600">
                                    Thank you. Please wait for the Admin to review your details and help restore your account.
                                </p>
                                <div className="pt-2">
                                    <Link
                                        href={route('login')}
                                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                                    >
                                        Back to Sign in
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {view !== 'success' && (
                        <div className="mt-7 text-center">
                            <Link
                                href={route('login')}
                                className="inline-flex items-center justify-center text-sm font-semibold text-slate-600 transition hover:text-amber-700"
                            >
                                Return to Sign in
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </GuestLayout>
    );
}
