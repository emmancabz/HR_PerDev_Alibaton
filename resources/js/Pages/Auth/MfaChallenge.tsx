import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { KeyRound, LoaderCircle, Mail, RefreshCw, TicketCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Method = 'email_number_match' | 'totp' | 'recovery_code';

type Props = {
    account: { name: string; email: string; role: string };
    challenge: {
        uuid: string;
        number: string;
        expiresAt: string;
        status: string;
        resendAvailableAt: string;
    };
    methods: {
        emailNumberMatch: boolean;
        totp: boolean;
        recoveryCode: boolean;
    };
    notificationEmail: string | null;
    defaultMethod: string;
    deliveryFailed: boolean;
    statusMessage?: string;
};

export default function MfaChallenge({
    account,
    challenge,
    methods,
    notificationEmail,
    defaultMethod,
    deliveryFailed,
    statusMessage,
}: Props) {
    const initialMethod: Method =
        defaultMethod === 'email_number_match' && methods.emailNumberMatch
            ? 'email_number_match'
            : methods.totp
              ? 'totp'
              : 'recovery_code';

    const [method, setMethod] = useState<Method>(initialMethod);
    const [state, setState] = useState(challenge.status);
    const [seconds, setSeconds] = useState(() =>
        Math.max(
            0,
            Math.ceil((new Date(challenge.expiresAt).getTime() - Date.now()) / 1000),
        ),
    );
    const [resendSeconds, setResendSeconds] = useState(() =>
        Math.max(
            0,
            Math.ceil(
                (new Date(challenge.resendAvailableAt).getTime() - Date.now()) / 1000,
            ),
        ),
    );
    const completionStarted = useRef(false);

    const verifyForm = useForm({ method: initialMethod, code: '' });
    const resendForm = useForm({});
    const retryForm = useForm({});

    const alternateMethods = useMemo(
        () => [
            ...(methods.totp
                ? [{ id: 'totp' as const, label: 'Authenticator app' }]
                : []),
            ...(methods.recoveryCode
                ? [{ id: 'recovery_code' as const, label: 'Recovery code' }]
                : []),
        ],
        [methods.recoveryCode, methods.totp],
    );

    const changeMethod = (next: Method) => {
        setMethod(next);
        verifyForm.setData({ method: next, code: '' });
        verifyForm.clearErrors();
    };

    useEffect(() => {
        setState(challenge.status);
        setResendSeconds(
            Math.max(
                0,
                Math.ceil(
                    (new Date(challenge.resendAvailableAt).getTime() - Date.now()) / 1000,
                ),
            ),
        );
        completionStarted.current = false;
    }, [challenge.resendAvailableAt, challenge.status, challenge.uuid]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setSeconds(
                Math.max(
                    0,
                    Math.ceil(
                        (new Date(challenge.expiresAt).getTime() - Date.now()) / 1000,
                    ),
                ),
            );
            setResendSeconds(
                Math.max(
                    0,
                    Math.ceil(
                        (new Date(challenge.resendAvailableAt).getTime() - Date.now()) / 1000,
                    ),
                ),
            );
        }, 1000);

        return () => window.clearInterval(timer);
    }, [challenge.expiresAt, challenge.resendAvailableAt]);

    useEffect(() => {
        if (method !== 'email_number_match') return;

        const checkStatus = async () => {
            try {
                const response = await fetch(route('mfa.challenge.status'), {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });

                if (!response.ok) return;

                const payload = await response.json();
                setState(payload.status);

                if (payload.status === 'approved' && !completionStarted.current) {
                    completionStarted.current = true;
                    router.post(route('mfa.challenge.complete'), {}, {
                        preserveScroll: true,
                        onError: () => {
                            completionStarted.current = false;
                        },
                    });
                }

                if (payload.status === 'denied') {
                    router.visit(route('login'));
                }
            } catch {
                // A short network interruption should not interrupt the sign-in screen.
            }
        };

        void checkStatus();
        const interval = window.setInterval(checkStatus, 750);

        return () => window.clearInterval(interval);
    }, [method, challenge.uuid]);

    const submitAlternative = () => {
        verifyForm.post(route('mfa.challenge.verify'));
    };

    const expired = seconds <= 0 || state === 'expired';

    return (
        <GuestLayout>
            <Head title="Verify sign-in" />

            <div className="mx-auto w-full max-w-[430px]">
                <div className="mb-7 text-center">
                    <img
                        src={alibatonLogo}
                        alt="Alibaton Construction Incorporated"
                        className="mx-auto mb-4 h-16 w-16 object-contain"
                    />
                    <h1 className="text-2xl font-bold text-slate-900">Verify your sign-in</h1>
                    <p className="mt-1 text-sm text-slate-500">{account.email}</p>
                </div>

                {statusMessage && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        {statusMessage}
                    </div>
                )}

                {method === 'email_number_match' && methods.emailNumberMatch ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">Check your email</p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    We sent a sign-in request to {notificationEmail ?? 'your verification email'}.
                                    Open that message on a device where you can access the inbox, select the matching number, then confirm the request.
                                </p>
                            </div>
                        </div>

                        <div className="my-6 rounded-2xl bg-slate-950 px-6 py-7 text-center text-white">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                                Number to match
                            </p>
                            <p className="mt-2 text-5xl font-black tracking-[0.16em]">
                                {challenge.number}
                            </p>
                        </div>

                        {deliveryFailed ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                The message could not be delivered. Check the mail configuration or use another method.
                            </div>
                        ) : state === 'approved' ? (
                            <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
                                Approved. Opening your dashboard…
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                Waiting for your selection{seconds > 0 ? ` · ${seconds}s` : ''}
                            </div>
                        )}

                        <div className="mt-5 flex gap-2">
                            <button
                                type="button"
                                onClick={() => resendForm.post(route('mfa.challenge.resend'))}
                                disabled={resendForm.processing || expired || resendSeconds > 0}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <RefreshCw className="h-4 w-4" />
                                {resendSeconds > 0 ? `Send again in ${resendSeconds}s` : 'Send again'}
                            </button>
                            {alternateMethods.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => changeMethod(alternateMethods[0].id)}
                                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Use another method
                                </button>
                            )}
                        </div>

                        {expired && (
                            <button
                                type="button"
                                onClick={() => retryForm.post(route('mfa.challenge.retry'))}
                                disabled={retryForm.processing}
                                className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Start a new request
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex gap-2 rounded-xl bg-slate-50 p-1">
                            {methods.emailNumberMatch && (
                                <button
                                    type="button"
                                    onClick={() => changeMethod('email_number_match')}
                                    className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
                                >
                                    Email request
                                </button>
                            )}
                            {methods.totp && (
                                <button
                                    type="button"
                                    onClick={() => changeMethod('totp')}
                                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${method === 'totp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                                >
                                    Authenticator
                                </button>
                            )}
                            {methods.recoveryCode && (
                                <button
                                    type="button"
                                    onClick={() => changeMethod('recovery_code')}
                                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${method === 'recovery_code' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                                >
                                    Recovery code
                                </button>
                            )}
                        </div>

                        <div className="mb-5 flex items-start gap-3">
                            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                                {method === 'totp' ? (
                                    <KeyRound className="h-5 w-5" />
                                ) : (
                                    <TicketCheck className="h-5 w-5" />
                                )}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">
                                    {method === 'totp' ? 'Authenticator app' : 'Recovery code'}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    {method === 'totp'
                                        ? 'Enter the current 6-digit code from your authenticator app.'
                                        : 'Enter one of your unused recovery codes.'}
                                </p>
                            </div>
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                submitAlternative();
                            }}
                        >
                            <input
                                value={verifyForm.data.code}
                                onChange={(event) =>
                                    verifyForm.setData(
                                        'code',
                                        method === 'totp'
                                            ? event.target.value.replace(/\D/g, '').slice(0, 6)
                                            : event.target.value.toUpperCase().slice(0, 64),
                                    )
                                }
                                inputMode={method === 'totp' ? 'numeric' : 'text'}
                                autoComplete="one-time-code"
                                placeholder={method === 'totp' ? '000000' : 'XXXX-XXXX-XXXX-XXXX'}
                                className="w-full rounded-xl border-slate-200 py-3 text-center text-lg font-bold tracking-[0.2em] focus:border-[#F4B400] focus:ring-[#F4B400]/30"
                            />
                            <InputError message={verifyForm.errors.code} className="mt-2" />

                            <button
                                type="submit"
                                disabled={verifyForm.processing || verifyForm.data.code.trim() === ''}
                                className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                Continue
                            </button>
                        </form>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => router.visit(route('login'))}
                    className="mt-5 w-full text-center text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                    Back to sign in
                </button>
            </div>
        </GuestLayout>
    );
}
