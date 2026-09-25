import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Passkeys } from '@laravel/passkeys';
import { Eye, EyeOff, Fingerprint, LoaderCircle, Lock, Mail } from 'lucide-react';
import { FormEventHandler, useEffect, useLayoutEffect, useState } from 'react';

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
        remember: false,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [passkeySupported, setPasskeySupported] = useState(false);
    const [passkeyProcessing, setPasskeyProcessing] = useState(false);
    const [passkeyError, setPasskeyError] = useState<string | null>(null);

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
        <GuestLayout surface={false} mobileBottomSheet>
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

            <div className="w-full auth-page-enter md:mx-auto md:max-w-[460px]">
                {status && (
                    <div className="mx-5 mb-3 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 text-sm font-medium text-slate-600 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl md:mx-0 md:mb-4 md:bg-white/92">
                        {status}
                    </div>
                )}

                <div className="min-h-[66dvh] w-full rounded-t-[30px] border-x-0 border-b-0 border-t border-white/80 bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 shadow-[0_-16px_50px_-22px_rgba(15,23,42,0.28)] sm:min-h-[62dvh] sm:rounded-t-[34px] sm:px-7 sm:pt-6 md:min-h-0 md:rounded-[30px] md:border md:border-white/75 md:bg-white/88 md:p-8 md:shadow-[0_30px_90px_-38px_rgba(15,23,42,0.48)] md:backdrop-blur-xl">
                    <div className="mb-5 text-center sm:mb-6 md:mb-7">
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center sm:mb-3 sm:h-14 sm:w-14 md:mb-4 md:h-16 md:w-16">
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

                        <div className="mx-auto mt-3 flex max-w-[300px] items-center gap-3 md:mt-4">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                            <p className="whitespace-nowrap text-[11px] font-semibold tracking-[0.05em] text-amber-700">
                                HR — Performance &amp; Development
                            </p>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                        </div>

                        <h1 className="mt-3 text-[24px] font-bold tracking-tight text-slate-900 sm:mt-4 sm:text-[27px] md:mt-5 md:text-[29px]">
                            Welcome back
                        </h1>
                        <p className="mt-1.5 text-sm leading-5 text-slate-600 md:mt-2 md:leading-6">
                            Sign in to access your assigned workspace.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-4 md:space-y-5">
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
                                    placeholder=""
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

                    <div className="my-4 flex items-center gap-3 md:my-5" aria-hidden="true">
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
