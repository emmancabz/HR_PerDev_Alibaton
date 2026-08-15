import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PasswordStrengthIndicator from '@/Components/PasswordStrengthIndicator';
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
    RefreshCw,
    ShieldCheck,
    Smartphone
} from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';
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
    const [emailValid, setEmailValid] = useState(true);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [mfaError, setMfaError] = useState('');
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const passwordToggleRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            setEmailValid(emailRegex.test(data.email));
        } else {
            setEmailValid(true);
        }
    }, [data.email]);
    useEffect(() => {
        if (isMfaStep) {
            setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 100);
        }
    }, [isMfaStep]);
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => {
                setResendCooldown(resendCooldown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        
        const newCode = [...mfaCode];
        newCode[index] = value.slice(-1);
        setMfaCode(newCode);
        setMfaError('');

        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };
    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();
        if (/^\d{6}$/.test(pastedData)) {
            const digits = pastedData.split('');
            setMfaCode(digits);
            setMfaError('');
            otpInputRefs.current[5]?.focus();
        }
    };
    const handleResendCode = () => {
        if (resendCooldown > 0) return;
        setResendCooldown(60);
        setMfaCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
        console.log('Resend code requested (frontend-only)');
    };
    const handleProceedToMfa = (e: React.FormEvent) => {
        e.preventDefault();
        if (data.email && data.password) {
            setIsMfaStep(true);
        } else {
            submit(e);
        }
    };
    const handleBackToLogin = () => {
        setIsMfaStep(false);
        setMfaCode(['', '', '', '', '', '']);
        setMfaError('');
    };
    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (isMfaStep && mfaCode.some(digit => !digit)) {
            setMfaError('Please enter the complete 6-digit verification code');
            return;
        }
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };
    const allMfaDigitsEntered = mfaCode.every(digit => digit !== '');
    return (
        <GuestLayout isMfaStep={isMfaStep}>
            <Head title="Log in" />
            <div className="mx-auto w-full max-w-[420px]">
                {status && (
                    <div 
                        className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                        role="alert"
                        aria-live="polite"
                    >
                        {status}
                    </div>
                )}
                <div className="mb-4 flex items-center justify-center gap-2" role="progressbar" aria-valuenow={isMfaStep ? 2 : 1} aria-valuemin={1} aria-valuemax={2}>
                    <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${!isMfaStep ? 'bg-[#F4B400]' : 'bg-slate-300'}`} />
                    <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${isMfaStep ? 'bg-[#F4B400]' : 'bg-slate-300'}`} />
                </div>
                <p className="mb-6 text-center text-xs text-slate-500" aria-live="polite">
                    Step {isMfaStep ? '2' : '1'} of 2
                </p>
                <div className="relative w-full overflow-hidden">
                    <div 
                        className="flex w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
                        style={{ transform: isMfaStep ? 'translateX(-50%)' : 'translateX(0)' }}
                    >
                        <div className="w-1/2 shrink-0 px-1">
                            <div className="mb-6 sm:mb-8 text-center">
                                <div className="mx-auto mb-4 sm:mb-5 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center">
                                    <img
                                        src={alibatonLogo}
                                        alt="Alibaton Construction Incorporated"
                                        className="max-h-full max-w-full object-contain drop-shadow-sm"
                                    />
                                </div>
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                    Human Resources
                                </h1>
                                <p className="mt-1 text-sm sm:text-base font-semibold text-[#F4B400]">
                                    Performance &amp; Development
                                </p>
                                <p className="mx-auto mt-2 sm:mt-3 max-w-xs text-xs sm:text-sm leading-relaxed text-slate-500">
                                    Welcome back! Sign in to your workforce portal to start your day.
                                </p>
                            </div>
                            <form onSubmit={handleProceedToMfa} className="space-y-4 sm:space-y-5">
                                <div>
                                    <InputLabel 
                                        htmlFor="email" 
                                        value="Email Address" 
                                        className="text-sm font-semibold text-slate-700" 
                                    />
                                    <div className="relative mt-1.5">
                                        <Mail 
                                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" 
                                            aria-hidden="true"
                                        />
                                        <TextInput
                                            id="email"
                                            type="email"
                                            name="email"
                                            value={data.email}
                                            className="block w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 sm:py-3 pl-10 pr-4 text-sm sm:text-base text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-2 focus:ring-[#F4B400]/30"
                                            autoComplete="username"
                                            isFocused={true}
                                            placeholder="you@company.com"
                                            onChange={(e) => setData('email', e.target.value)}
                                            aria-invalid={!emailValid || !!errors.email}
                                            aria-describedby={errors.email ? "email-error" : undefined}
                                        />
                                    </div>
                                    {!emailValid && data.email && (
                                        <p className="mt-1.5 text-xs text-orange-600" role="alert">
                                            Please enter a valid email address
                                        </p>
                                    )}
                                    <InputError message={errors.email} className="mt-2" id="email-error" />
                                </div>
                                <div>
                                    <InputLabel 
                                        htmlFor="password" 
                                        value="Password" 
                                        className="text-sm font-semibold text-slate-700" 
                                    />
                                    <div className="relative mt-1.5">
                                        <Lock 
                                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" 
                                            aria-hidden="true"
                                        />
                                        <TextInput
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={data.password}
                                            className="block w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 sm:py-3 pl-10 pr-11 text-sm sm:text-base text-slate-800 transition focus:border-[#F4B400] focus:bg-white focus:ring-2 focus:ring-[#F4B400]/30"
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            onChange={(e) => setData('password', e.target.value)}
                                            aria-invalid={!!errors.password}
                                            aria-describedby={errors.password ? "password-error" : "password-strength"}
                                        />
                                        <button
                                            ref={passwordToggleRef}
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#F4B400] focus:ring-offset-1"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            aria-pressed={showPassword}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" aria-hidden="true" />
                                            ) : (
                                                <Eye className="h-4 w-4" aria-hidden="true" />
                                            )}
                                        </button>
                                    </div>
                                    <div id="password-strength">
                                        <PasswordStrengthIndicator password={data.password} />
                                    </div>
                                    <InputError message={errors.password} className="mt-2" id="password-error" />
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <label className="flex cursor-pointer items-center select-none group">
                                        <Checkbox
                                            name="remember"
                                            checked={data.remember}
                                            className="rounded border-slate-300 text-[#F4B400] focus:ring-2 focus:ring-[#F4B400]/30 transition-colors"
                                            onChange={(e) => setData('remember', (e.target.checked || false) as false)}
                                            aria-label="Remember me"
                                        />
                                        <span className="ms-2 text-xs sm:text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                                            Remember me
                                        </span>
                                    </label>
                                    {canResetPassword && (
                                        <Link
                                            href={route('password.request')}
                                            className="text-xs sm:text-sm font-medium text-slate-500 transition-colors hover:text-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400] focus:ring-offset-2 rounded-sm"
                                        >
                                            Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <PrimaryButton
                                    className="mt-5 sm:mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 sm:py-3.5 text-sm font-semibold normal-case tracking-normal text-white transition-all hover:bg-slate-800 active:bg-black disabled:opacity-75 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#F4B400] focus:ring-offset-2"
                                    disabled={processing}
                                    aria-label="Proceed to verification"
                                >
                                    {processing ? (
                                        <>
                                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <span>Proceed</span>
                                    )}
                                </PrimaryButton>
                            </form>
                        </div>
                        <div className="w-1/2 shrink-0 px-1">
                            <div className="mb-4 sm:mb-6 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={handleBackToLogin}
                                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors rounded-md px-2 py-1 -ml-2 focus:outline-none focus:ring-2 focus:ring-[#F4B400]"
                                    aria-label="Go back to login"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                                    <span>Back</span>
                                </button>
                                <span 
                                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 sm:px-3 py-1 text-xs font-semibold text-amber-600 border border-amber-200/60"
                                    role="status"
                                >
                                    <Smartphone className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                                    <span>2-Step Verification</span>
                                </span>
                            </div>
                            <div className="mb-6 sm:mb-8 mt-4 text-center">
                                <div className="mx-auto mb-4 sm:mb-5 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center">
                                    <img
                                        src={alibatonLogo}
                                        alt="Alibaton Construction Incorporated"
                                        className="max-h-full max-w-full object-contain drop-shadow-sm"
                                    />
                                </div>
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                                    Security Verification
                                </h2>
                                <p className="mx-auto mt-2 max-w-xs text-xs sm:text-sm leading-relaxed text-slate-500">
                                    Enter the 6-digit verification code sent to your device.
                                </p>
                            </div>
                            <form onSubmit={submit} className="space-y-5 sm:space-y-6">
                                <div>
                                    <div 
                                        className="flex justify-between gap-1.5 sm:gap-2"
                                        role="group"
                                        aria-label="Enter 6-digit verification code"
                                    >
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
                                                onPaste={index === 0 ? handleOtpPaste : undefined}
                                                className="h-11 sm:h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-center text-base sm:text-lg font-bold text-slate-800 transition-all focus:border-[#F4B400] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                                                aria-label={`Digit ${index + 1} of 6`}
                                                aria-invalid={!!mfaError}
                                            />
                                        ))}
                                    </div>
                                    {allMfaDigitsEntered && !mfaError && (
                                        <div className="mt-3 flex items-center justify-center gap-2 text-xs sm:text-sm text-emerald-600 font-medium animate-in fade-in duration-300" role="status" aria-live="polite">
                                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                            <span>Code entered successfully</span>
                                        </div>
                                    )}
                                    {mfaError && (
                                        <p className="mt-3 text-xs sm:text-sm text-red-600 font-medium text-center" role="alert" aria-live="assertive">
                                            {mfaError}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={resendCooldown > 0}
                                    className="w-full text-xs sm:text-sm font-medium text-slate-500 hover:text-[#F4B400] transition-colors disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#F4B400] rounded-md py-2"
                                    aria-label={resendCooldown > 0 ? `Resend code available in ${resendCooldown} seconds` : 'Resend verification code'}
                                >
                                    {resendCooldown > 0 ? (
                                        <span className="inline-flex items-center gap-2">
                                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                            Resend code in {resendCooldown}s
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-2">
                                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                            Resend code
                                        </span>
                                    )}
                                </button>
                                <PrimaryButton
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 sm:py-3.5 text-sm font-semibold normal-case tracking-normal text-white transition-all hover:bg-slate-800 active:bg-black disabled:opacity-75 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#F4B400] focus:ring-offset-2"
                                    disabled={processing || !allMfaDigitsEntered}
                                    aria-label="Sign in with verification code"
                                >
                                    {processing ? (
                                        <>
                                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                            <span>Signing in...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                            <span>Sign In</span>
                                        </>
                                    )}
                                </PrimaryButton>
                            </form>
                        </div>
                    </div>
                </div>
                <p className="mt-6 sm:mt-8 text-center text-xs text-slate-400">
                    &copy; {new Date().getFullYear()} Alibaton Construction Inc. All rights reserved.
                </p>
            </div>
        </GuestLayout>
    );
}
