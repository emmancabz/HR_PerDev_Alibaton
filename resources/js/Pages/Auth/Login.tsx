import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Eye,
    EyeOff,
    LoaderCircle,
    Lock,
    Mail,
    ShieldCheck,
    Smartphone
} from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';
export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isMfaStep, setIsMfaStep] = useState(false);
    const [mfaCode, setMfaCode] = useState(['', '', '', '', '', '']);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newCode = [...mfaCode];
        newCode[index] = value.slice(-1);
        setMfaCode(newCode);
        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };
    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };
    const handleProceedToMfa = (e: React.FormEvent) => {
        e.preventDefault();
        if (data.email && data.password) {
            setIsMfaStep(true);
        } else {
            submit(e);
        }
    };
    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };
    return (
        <GuestLayout isMfaStep={isMfaStep}>
            <Head title="Log in" />
            <div className="mx-auto w-full max-w-[420px]">
                {status && (
                    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                        {status}
                    </div>
                )}
                <div className="relative w-full overflow-hidden">
                    <div 
                        className="flex w-[200%] transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{ transform: isMfaStep ? 'translateX(-50%)' : 'translateX(0)' }}
                    >
                        <div className="w-1/2 shrink-0 px-1">
                            <div className="mb-8 text-center">
                                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                                    <img
                                        src={alibatonLogo}
                                        alt="Alibaton Construction Incorporated"
                                        className="max-h-full max-w-full object-contain drop-shadow-sm"
                                    />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900">
                                    Human Resources
                                </h1>
                                <p className="mt-1 text-base font-semibold text-[#F4B400]">
                                    Performance &amp; Development
                                </p>
                                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
                                    Welcome back! Sign in to your workforce portal to start
                                    your day.
                                </p>
                            </div>
                            <form onSubmit={handleProceedToMfa} className="space-y-5">
                                <div>
                                    <InputLabel htmlFor="email" value="Email Address" className="text-sm font-semibold text-slate-700" />
                                    <div className="relative mt-1.5">
                                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <TextInput
                                            id="email"
                                            type="email"
                                            name="email"
                                            value={data.email}
                                            className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                                            autoComplete="username"
                                            isFocused={true}
                                            placeholder="you@company.com"
                                            onChange={(e) => setData('email', e.target.value)}
                                        />
                                    </div>
                                    <InputError message={errors.email} className="mt-2" />
                                </div>
                                <div>
                                    <InputLabel htmlFor="password" value="Password" className="text-sm font-semibold text-slate-700" />
                                    <div className="relative mt-1.5">
                                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <TextInput
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={data.password}
                                            className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            onChange={(e) => setData('password', e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <InputError message={errors.password} className="mt-2" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="flex cursor-pointer items-center select-none">
                                        <Checkbox
                                            name="remember"
                                            checked={data.remember}
                                            className="rounded border-slate-300 text-[#F4B400] focus:ring-[#F4B400]/30"
                                            onChange={(e) => setData('remember', (e.target.checked || false) as false)}
                                        />
                                        <span className="ms-2 text-sm text-slate-600">Remember me</span>
                                    </label>
                                    {canResetPassword && (
                                        <Link
                                            href={route('password.request')}
                                            className="text-sm font-medium text-slate-500 transition hover:text-[#F4B400]"
                                        > Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <PrimaryButton
                                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold normal-case tracking-normal text-white transition hover:bg-slate-800 active:bg-black disabled:opacity-75"
                                    disabled={processing}
                                > Proceed
                                </PrimaryButton>
                            </form>
                        </div>
                        <div className="w-1/2 shrink-0 px-1">
                            <div className="mb-6 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setIsMfaStep(false)}
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
                                >
                                    <ArrowLeft className="h-4 w-4" /> Back
                                </button>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 border border-amber-200/60">
                                    <Smartphone className="h-3.5 w-3.5" />
                                    2-Step Verification</span>
                            </div>

                            <div className="mb-8 mt-4 text-center">
                                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                                    <img
                                        src={alibatonLogo}
                                        alt="Alibaton Construction Incorporated"
                                        className="max-h-full max-w-full object-contain drop-shadow-sm"
                                    />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Security Verification</h2>
                                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                                    Enter the 6-digit verification code sent to your device.</p>
                            </div>
                            <form onSubmit={submit} className="space-y-6">
                                <div className="flex justify-between gap-2">
                                    {mfaCode.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={(el) => { otpInputRefs.current[index] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-bold text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:outline-none focus:ring-[#F4B400]/30"
                                        />
                                    ))}
                                </div>
                                <PrimaryButton
                                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold normal-case tracking-normal text-white transition hover:bg-slate-800 active:bg-black disabled:opacity-75"
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <>
                                            <LoaderCircle className="h-4 w-4 animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="h-4 w-4" />
                                            Sign In
                                        </>
                                    )}
                                </PrimaryButton>
                            </form>
                        </div>
                    </div>
                </div>
                <p className="mt-8 text-center text-xs text-slate-400">
                    &copy; {new Date().getFullYear()} Alibaton Construction Inc.
                    All rights reserved.
                </p>
            </div>
        </GuestLayout>
    );
}