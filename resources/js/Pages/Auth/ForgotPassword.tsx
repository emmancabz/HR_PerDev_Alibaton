import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, IdCard, Mail, Send, UserCog } from 'lucide-react';
import { FormEventHandler, useState } from 'react';
export default function ForgotPassword({ status }: { status?: string }) {
    const [view, setView] = useState<'standard' | 'admin_recovery' | 'success'>('standard');
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });
    const [adminData, setAdminData] = useState({
        employeeId: '',
        companyEmail: '',
        personalGmail: ''
    });
    const submitStandard: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };
    const submitAdminRecovery: FormEventHandler = (e) => {
        e.preventDefault();
        setView('success');
    };
    return (
        <GuestLayout>
            <Head title="Forgot Password" />
            <div className="mx-auto w-full max-w-[420px]">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                        <img
                            src={alibatonLogo}
                            alt="Alibaton Construction Incorporated"
                            className="max-h-full max-w-full object-contain drop-shadow-sm"
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {view === 'success' ? 'Request Sent' : 'Account Recovery'}
                    </h1>
                </div>
                {status && view === 'standard' && (
                    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                        {status}
                    </div>
                )}
                {view === 'standard' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="mb-6 text-sm text-slate-600 text-center">
                            Forgot your password? No problem. Just let us know your Alibaton email
                            address and we will email you a password reset link (via 2NA).
                        </div>
                        <form onSubmit={submitStandard} className="space-y-4">
                            <div>
                                <InputLabel htmlFor="email" value="Alibaton Email" className="text-sm font-semibold text-slate-700" />
                                <div className="relative mt-1.5">
                                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <TextInput
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                                        isFocused={true}
                                        placeholder="you@alibaton.com"
                                        onChange={(e) => setData('email', e.target.value)}
                                        required
                                    />
                                </div>
                                <InputError message={errors.email} className="mt-2" />
                            </div>
                            <PrimaryButton 
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold normal-case text-white transition hover:bg-slate-800" 
                                disabled={processing}
                            >
                                <Send className="h-4 w-4" />
                                Send Reset Link
                            </PrimaryButton>
                        </form>
                        <div className="mt-8 flex flex-col items-center gap-4 border-t border-slate-200 pt-6">
                            <p className="text-sm text-slate-500">Lost access to your company email?</p>
                            <button
                                type="button"
                                onClick={() => setView('admin_recovery')}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                <UserCog className="h-4 w-4 text-slate-500" />
                                Try another option
                            </button>
                        </div>
                    </div>
                )}
                {view === 'admin_recovery' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="mb-6 text-sm text-slate-600 text-center border-l-4 border-[#F4B400] bg-[#F4B400]/10 p-3 rounded-r-lg">
                            Provide your details below. An Admin will review your information to manually fix and restore your account.
                        </div>
                        <form onSubmit={submitAdminRecovery} className="space-y-4">
                            <div>
                                <InputLabel htmlFor="employeeId" value="Employee ID" className="text-sm font-semibold text-slate-700" />
                                <div className="relative mt-1.5">
                                    <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <TextInput
                                        id="employeeId"
                                        type="text"
                                        value={adminData.employeeId}
                                        className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                                        placeholder="e.g. EMP-2026-01"
                                        onChange={(e) => setAdminData({...adminData, employeeId: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <InputLabel htmlFor="companyEmail" value="Company Email" className="text-sm font-semibold text-slate-700" />
                                <div className="relative mt-1.5">
                                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <TextInput
                                        id="companyEmail"
                                        type="email"
                                        value={adminData.companyEmail}
                                        className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                                        placeholder="you@alibaton.com"
                                        onChange={(e) => setAdminData({...adminData, companyEmail: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <InputLabel htmlFor="personalGmail" value="Personal Gmail" className="text-sm font-semibold text-slate-700" />
                                <div className="relative mt-1.5">
                                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <TextInput
                                        id="personalGmail"
                                        type="email"
                                        value={adminData.personalGmail}
                                        className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                                        placeholder="yourname@gmail.com"
                                        onChange={(e) => setAdminData({...adminData, personalGmail: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <PrimaryButton 
                                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold normal-case text-white transition hover:bg-slate-800" 
                            >
                                <Send className="h-4 w-4" />
                                Submit to Admin
                            </PrimaryButton>
                        </form>
                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                onClick={() => setView('standard')}
                                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1 mx-auto"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Standard Reset
                            </button>
                        </div>
                    </div>
                )}
                {view === 'success' && (
                    <div className="animate-in zoom-in-95 duration-500 text-center space-y-4 py-8">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Request Submitted</h3>
                        <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                            Thank you. Please wait for the Admin to review your details and fix your account. You will be notified via your personal Gmail once it's resolved.
                        </p>
                        <div className="pt-6">
                            <Link
                                href={route('login')}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4B400] px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-[#dca300]"
                            > Back to Log in
                            </Link>
                        </div>
                    </div>
                )}
                {view !== 'success' && (
                    <div className="mt-8 text-center">
                        <Link
                            href={route('login')}
                            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition"
                        > Return to Login screen
                        </Link>
                    </div>
                )}
            </div>
        </GuestLayout>
    );
}