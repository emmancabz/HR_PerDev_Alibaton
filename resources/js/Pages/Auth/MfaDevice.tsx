import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    LoaderCircle,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type LoginRequest = {
    uuid: string;
    requestedAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
};

type Props = {
    device: {
        uuid: string;
        name: string;
        accountName: string;
        accountEmail: string;
    } | null;
    request: LoginRequest | null;
    recoveryCodes: string[];
    status?: string;
};

function describeDevice(userAgent: string | null): string {
    if (!userAgent) return 'Unknown browser';

    const browser = userAgent.includes('Edg/')
        ? 'Edge'
        : userAgent.includes('Chrome/')
          ? 'Chrome'
          : userAgent.includes('Firefox/')
            ? 'Firefox'
            : userAgent.includes('Safari/')
              ? 'Safari'
              : 'Browser';

    const os = userAgent.includes('Windows')
        ? 'Windows'
        : userAgent.includes('Android')
          ? 'Android'
          : userAgent.includes('iPhone') || userAgent.includes('iPad')
            ? 'iOS'
            : userAgent.includes('Mac OS')
              ? 'macOS'
              : 'device';

    return `${browser} on ${os}`;
}

export default function MfaDevice({
    device,
    request: initialRequest,
    recoveryCodes,
    status,
}: Props) {
    const [loginRequest, setLoginRequest] =
        useState<LoginRequest | null>(initialRequest);
    const [notificationsEnabled, setNotificationsEnabled] = useState(
        () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted',
    );
    const lastNotifiedRequest = useRef<string | null>(initialRequest?.uuid ?? null);
    const approveForm = useForm({
        challenge_uuid: initialRequest?.uuid ?? '',
        number: '',
    });
    const denyForm = useForm({
        challenge_uuid: initialRequest?.uuid ?? '',
    });
    const ackForm = useForm({});

    useEffect(() => {
        if (!device) return;

        const interval = window.setInterval(async () => {
            try {
                const response = await fetch(route('mfa.device.status'), {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });

                if (!response.ok) return;

                const payload = await response.json();
                const next = payload.request as LoginRequest | null;

                if (
                    next &&
                    next.uuid !== lastNotifiedRequest.current &&
                    typeof window !== 'undefined' &&
                    'Notification' in window &&
                    Notification.permission === 'granted'
                ) {
                    lastNotifiedRequest.current = next.uuid;
                    new Notification('Alibaton sign-in request', {
                        body: `${describeDevice(next.userAgent)} is requesting approval. Open Alibaton to enter the 2-digit number.`,
                    });
                }

                setLoginRequest(next);

                if (next?.uuid !== approveForm.data.challenge_uuid) {
                    approveForm.setData({
                        challenge_uuid: next?.uuid ?? '',
                        number: '',
                    });
                    denyForm.setData('challenge_uuid', next?.uuid ?? '');
                }
            } catch {
                // Keep polling. A transient failure should not revoke the device.
            }
        }, 2000);

        return () => window.clearInterval(interval);
    }, [device, approveForm.data.challenge_uuid]);

    if (!device) {
        return (
            <GuestLayout isMfaStep>
                <Head title="Trusted device" />
                <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
                    <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
                    <h1 className="mt-3 text-xl font-bold text-slate-900">
                        This browser is not trusted
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Register it from an Alibaton MFA enrollment link before it can
                        approve sign-ins.
                    </p>
                </div>
            </GuestLayout>
        );
    }

    return (
        <GuestLayout isMfaStep>
            <Head title="Trusted device approvals" />

            <div className="mx-auto w-full max-w-md">
                <div className="mb-5 text-center">
                    <img
                        src={alibatonLogo}
                        alt="Alibaton"
                        className="mx-auto mb-2 h-12 w-12 object-contain"
                    />
                    <h1 className="text-xl font-bold text-slate-900">
                        Alibaton trusted device
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                        {device.name} · {device.accountEmail}
                    </p>
                </div>

                {status && (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {status}
                    </div>
                )}

                {!notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && (
                    <button
                        type="button"
                        onClick={async () => {
                            const permission = await Notification.requestPermission();
                            setNotificationsEnabled(permission === 'granted');
                        }}
                        className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                        Enable browser notifications while this trusted-device page is open
                    </button>
                )}

                {recoveryCodes.length > 0 && (
                    <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <h2 className="font-bold text-slate-900">
                            Save your recovery codes
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            These are shown because MFA was just enabled. Each code can
                            be used once if your normal factor is unavailable.
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {recoveryCodes.map((code) => (
                                <code
                                    key={code}
                                    className="rounded-lg border border-amber-200 bg-white px-2 py-2 text-center text-xs font-bold tracking-wider text-slate-800"
                                >
                                    {code}
                                </code>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                ackForm.post(
                                    route(
                                        'mfa.device.recovery-codes.acknowledge',
                                    ),
                                )
                            }
                            className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                        >
                            I saved these codes
                        </button>
                    </section>
                )}

                {loginRequest ? (
                    <section className="rounded-2xl border-2 border-[#F4B400] bg-white p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-amber-100 p-2.5">
                                <Smartphone className="h-5 w-5 text-amber-700" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="font-bold text-slate-900">
                                    Sign-in request
                                </h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    {describeDevice(loginRequest.userAgent)}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    IP {loginRequest.ipAddress ?? 'unavailable'}
                                </p>
                            </div>
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                approveForm.post(route('mfa.device.approve'), {
                                    preserveScroll: true,
                                    onSuccess: () => setLoginRequest(null),
                                });
                            }}
                            className="mt-5"
                        >
                            <label className="block text-center text-sm font-semibold text-slate-700">
                                Enter the 2-digit number shown on the sign-in screen
                            </label>
                            <input
                                autoFocus
                                value={approveForm.data.number}
                                onChange={(event) =>
                                    approveForm.setData(
                                        'number',
                                        event.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 2),
                                    )
                                }
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="00"
                                className="mx-auto mt-3 block w-32 rounded-2xl border-slate-200 bg-slate-50 py-4 text-center text-4xl font-black tracking-widest focus:border-[#F4B400] focus:ring-[#F4B400]/30"
                            />
                            <InputError
                                message={approveForm.errors.number}
                                className="mt-2 text-center"
                            />

                            <button
                                type="submit"
                                disabled={
                                    approveForm.processing ||
                                    approveForm.data.number.length !== 2
                                }
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F4B400] px-4 py-3 font-bold text-slate-950 disabled:opacity-50"
                            >
                                <ShieldCheck className="h-5 w-5" />
                                Approve sign in
                            </button>
                        </form>

                        <button
                            type="button"
                            onClick={() =>
                                denyForm.post(route('mfa.device.deny'), {
                                    preserveScroll: true,
                                    onSuccess: () => setLoginRequest(null),
                                })
                            }
                            disabled={denyForm.processing}
                            className="mt-2 w-full rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50"
                        >
                            Deny
                        </button>
                    </section>
                ) : (
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <h2 className="mt-3 font-bold text-slate-900">
                            Ready for sign-in requests
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Keep this device registered. New requests will appear here
                            automatically while this page is open.
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            Checking securely
                        </div>
                    </section>
                )}
            </div>
        </GuestLayout>
    );
}
