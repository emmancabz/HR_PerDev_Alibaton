import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Passkeys } from '@laravel/passkeys';
import { Clock3, Eye, EyeOff, Fingerprint, LoaderCircle, Lock, Mail } from 'lucide-react';
import { FormEventHandler, useEffect, useLayoutEffect, useState } from 'react';

export default function Login({
    status,
    canResetPassword,
    sessionTimedOut = false,
    sessionTimeoutMinutes = 5,
}: {
    status?: string;
    canResetPassword: boolean;
    sessionTimedOut?: boolean;
    sessionTimeoutMinutes?: number;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [passkeySupported, setPasskeySupported] = useState(false);
    const [passkeyProcessing, setPasskeyProcessing] = useState(false);
    const [passkeyError, setPasskeyError] = useState<string | null>(null);
    const [timeoutDialogOpen, setTimeoutDialogOpen] = useState(sessionTimedOut);

    useLayoutEffect(() => {
        const root = document.documentElement;
        root.classList.remove('dark');
        root.dataset.theme = 'light';
        root.style.colorScheme = 'light';
    }, []);

    useEffect(() => {
        setPasskeySupported(Passkeys.isSupported());

        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
            const key = window.localStorage.key(index);
            if (key?.startsWith('pd:last-human-activity:')) {
                window.localStorage.removeItem(key);
            }
        }
    }, []);

    useEffect(() => {
        setTimeoutDialogOpen(sessionTimedOut);
    }, [sessionTimedOut]);

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        setPasskeyError(null);
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const signInWithPasskey = async () => {
        setPasskeyError(null);
        setPasskeyProcessing(true);

        try {
            const response = await Passkeys.verify({ remember: data.remember });
            window.location.assign(response.redirect || route('dashboard'));
        } catch (error) {
            const message =
                error instanceof Error && error.name === 'NotAllowedError'
                    ? 'Passkey sign-in was cancelled or timed out.'
                    : 'Passkey sign-in could not be completed. You can try again or use your password.';
            setPasskeyError(message);
        } finally {
            setPasskeyProcessing(false);
        }
    };

    return (
        <GuestLayout surface={false}>
            <Head title="Sign in" />

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

                .auth-page-enter {
                    animation: authPageEnter 380ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .auth-login-input {
                    background: #ffffff !important;
                    color: #0f172a !important;
                    color-scheme: light !important;
                    -webkit-text-fill-color: #0f172a !important;
                }

                .auth-login-input:-webkit-autofill,
                .auth-login-input:-webkit-autofill:hover,
                .auth-login-input:-webkit-autofill:focus,
                .auth-login-input:-webkit-autofill:active {
                    -webkit-text-fill-color: #0f172a !important;
                    caret-color: #0f172a !important;
                    -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
                    box-shadow: 0 0 0 1000px #ffffff inset !important;
                    border-color: #e2e8f0 !important;
                }

                .auth-login-checkbox {
                    color-scheme: light !important;
                    background-color: #ffffff !important;
                    border-color: #cbd5e1 !important;
                    accent-color: #f4b400;
                }
            `}</style>

            {timeoutDialogOpen && (
                <div
                    className="fixed inset-0 z-[2147483640] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[3px]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="session-timeout-title"
                >
                    <div className="w-full max-w-sm rounded-[26px] border border-white/75 bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                            <Clock3 className="h-6 w-6" />
                        </div>
                        <h2 id="session-timeout-title" className="mt-4 text-xl font-bold text-slate-900">
                            Session Timeout
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Your session ended after {sessionTimeoutMinutes} minutes of inactivity. Please sign in again to continue.
                        </p>
                        <button
                            type="button"
                            autoFocus
                            onClick={() => setTimeoutDialogOpen(false)}
                            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto w-full max-w-[460px] auth-page-enter">
                {status && (
                    <div className="mb-4 rounded-2xl border border-white/70 bg-white/92 px-4 py-3 text-sm font-medium text-slate-600 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                        {status}
                    </div>
                )}

                <div className="rounded-[30px] border border-white/70 bg-white/88 p-6 shadow-[0_28px_90px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
                    <div className="mb-7 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                            <img
                                src={alibatonLogo}
                                alt="Alibaton Construction Incorporated"
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>

                        <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-slate-900/95">
                            Alibaton Construction Inc.
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                            Crane &amp; Trucking Management System
                        </p>

                        <div className="mx-auto mt-4 flex max-w-[300px] items-center gap-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                            <p className="whitespace-nowrap text-[11px] font-semibold tracking-[0.05em] text-amber-700">
                                HR — Performance &amp; Development
                            </p>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                        </div>

                        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[29px]">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Sign in to access your assigned workspace.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-5">
                        <div>
                            <InputLabel htmlFor="email" value="Email address" className="text-sm font-semibold text-slate-700" />
                            <div className="relative mt-1.5">
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <TextInput
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    className="auth-login-input block w-full rounded-xl border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm focus:border-amber-300 focus:ring-amber-100"
                                    autoComplete="username webauthn"
                                    style={{
                                        backgroundColor: '#ffffff',
                                        color: '#0f172a',
                                        WebkitTextFillColor: '#0f172a',
                                        WebkitBoxShadow: '0 0 0 1000px #ffffff inset',
                                        boxShadow: '0 0 0 1000px #ffffff inset',
                                        colorScheme: 'light',
                                    }}
                                    isFocused
                                    placeholder="name@alibaton-ph.com"
                                    onChange={(event) => setData('email', event.target.value)}
                                />
                            </div>
                            <InputError message={errors.email} className="mt-2" />
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <InputLabel htmlFor="password" value="Password" className="text-sm font-semibold text-slate-700" />
                                {canResetPassword && (
                                    <Link
                                        href={route('password.request')}
                                        className="text-xs font-semibold text-amber-700 transition hover:text-amber-800"
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
                            <div className="relative mt-1.5">
                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <TextInput
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={data.password}
                                    className="auth-login-input block w-full rounded-xl border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 shadow-sm focus:border-amber-300 focus:ring-amber-100"
                                    autoComplete="current-password"
                                    style={{
                                        backgroundColor: '#ffffff',
                                        color: '#0f172a',
                                        WebkitTextFillColor: '#0f172a',
                                        WebkitBoxShadow: '0 0 0 1000px #ffffff inset',
                                        boxShadow: '0 0 0 1000px #ffffff inset',
                                        colorScheme: 'light',
                                    }}
                                    onChange={(event) => setData('password', event.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((value) => !value)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <InputError message={errors.password} className="mt-2" />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <Checkbox
                                name="remember"
                                checked={data.remember}
                                className="auth-login-checkbox"
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderColor: '#cbd5e1',
                                    color: '#f4b400',
                                    accentColor: '#f4b400',
                                    colorScheme: 'light',
                                }}
                                onChange={(event) => setData('remember', event.target.checked)}
                            />
                            Keep me signed in
                        </label>

                        <button
                            type="submit"
                            disabled={processing || passkeyProcessing}
                            className="flex w-full items-center justify-center rounded-xl border border-amber-300/40 bg-[linear-gradient(135deg,#111827_0%,#1f2937_62%,#b45309_100%)] px-4 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_20px_40px_-24px_rgba(180,83,9,0.45)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Sign in
                        </button>
                    </form>

                    <div className="my-5 flex items-center gap-3" aria-hidden="true">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300/80 to-transparent" />
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">or</span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300/80 to-transparent" />
                    </div>

                    <button
                        type="button"
                        onClick={() => void signInWithPasskey()}
                        disabled={!passkeySupported || passkeyProcessing || processing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {passkeyProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                        Sign in with a passkey
                    </button>

                    {!passkeySupported && (
                        <p className="mt-2 text-center text-xs text-slate-500">
                            Passkey sign-in is unavailable on this device.
                        </p>
                    )}

                    {passkeyError && (
                        <div className="mt-3 rounded-xl border border-rose-200/70 bg-rose-50/95 px-4 py-3 text-sm text-rose-700">
                            {passkeyError}
                        </div>
                    )}
                </div>
            </div>
        </GuestLayout>
    );
}
