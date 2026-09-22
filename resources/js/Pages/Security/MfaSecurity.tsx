import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Passkeys } from '@laravel/passkeys';
import axios from 'axios';
import {
    Check,
    ChevronRight,
    Clipboard,
    Clock3,
    Fingerprint,
    KeyRound,
    Mail,
    RefreshCw,
    TicketCheck,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';

type Props = {
    mfa: {
        required: boolean;
        enabled: boolean;
        enabledAt: string | null;
        defaultMethod: string;
        notificationEmail: string | null;
        emailNumberMatchEnabled: boolean;
        emailNumberMatchAllowed: boolean;
        adminAuthenticatorRequired: boolean;
        totpEnabled: boolean;
        recoveryCodesRemaining: number;
    };
    passkeys: Array<{
        id: number;
        name: string;
        createdAt: string | null;
        lastUsedAt: string | null;
    }>;
    events: Array<{
        id: number;
        type: string;
        outcome: string;
        ipAddress: string | null;
        createdAt: string;
    }>;
    totpEnrollment: {
        secret: string;
        uri: string;
    } | null;
    newRecoveryCodes: string[];
    status?: string;
};

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
}

function eventLabel(type: string): string {
    const labels: Record<string, string> = {
        'mfa.email.sent': 'Sign-in request sent',
        'mfa.email.number_match': 'Number match',
        'mfa.challenge.created': 'Sign-in verification started',
        'mfa.challenge.denied': 'Sign-in request denied',
        'mfa.totp': 'Authenticator verification',
        'mfa.totp.enrolled': 'Authenticator added',
        'mfa.recovery_code': 'Recovery code used',
        'mfa.recovery_codes.generated': 'Recovery codes generated',
        'auth.mfa.completed': 'Sign-in completed',
        'auth.passkey': 'Passkey sign-in',
        'passkey.registered': 'Passkey added',
        'passkey.deleted': 'Passkey removed',
    };

    return (
        labels[type] ??
        type
            .replace(/^mfa\./, '')
            .replace(/^auth\./, '')
            .replaceAll('.', ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
    );
}

export default function MfaSecurity({
    mfa,
    passkeys,
    events,
    totpEnrollment,
    newRecoveryCodes,
    status,
}: Props) {
    const role = usePage<PageProps>().props.auth.user.role;
    const [copied, setCopied] = useState('');
    const [passkeyName, setPasskeyName] = useState('This device');
    const [passkeyProcessing, setPasskeyProcessing] = useState(false);
    const [passkeyError, setPasskeyError] = useState<string | null>(null);
    const totpStartForm = useForm({});
    const totpConfirmForm = useForm({ code: '' });
    const recoveryForm = useForm({});
    const ackForm = useForm({});
    const defaultForm = useForm({
        method: mfa.defaultMethod === 'totp' ? 'totp' : 'email_number_match',
    });

    const addPasskey = async () => {
        const name = passkeyName.trim();
        if (!name) {
            setPasskeyError('Give this passkey a name so you can recognize it later.');
            return;
        }

        setPasskeyError(null);
        setPasskeyProcessing(true);

        try {
            await Passkeys.register({ name });
            setPasskeyName('This device');
            router.reload({ only: ['passkeys', 'events'] });
        } catch (error) {
            const message =
                error instanceof Error && error.name === 'NotAllowedError'
                    ? 'Passkey registration was cancelled or timed out.'
                    : 'Passkey registration could not be completed. Re-authenticate if prompted, then try again.';
            setPasskeyError(message);
        } finally {
            setPasskeyProcessing(false);
        }
    };

    const removePasskey = async (id: number) => {
        if (!window.confirm('Remove this passkey from your Alibaton account?')) return;

        setPasskeyError(null);
        setPasskeyProcessing(true);

        try {
            await axios.delete(route('passkey.destroy', { passkey: id }), {
                headers: { Accept: 'application/json' },
            });
            router.reload({ only: ['passkeys', 'events'] });
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 428) {
                router.visit(route('password.confirm'));
                return;
            }

            setPasskeyError('That passkey could not be removed. Re-authenticate if prompted, then try again.');
        } finally {
            setPasskeyProcessing(false);
        }
    };

    const copy = async (value: string, label: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(label);
        window.setTimeout(() => setCopied(''), 1500);
    };

    const setDefault = (method: 'email_number_match' | 'totp') => {
        defaultForm.setData('method', method);
        defaultForm.transform(() => ({ method }));
        defaultForm.post(route('security.mfa.default-method'), {
            preserveScroll: true,
            onFinish: () => defaultForm.transform((data) => data),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-sm font-bold text-slate-900">
                    Sign-in Protection
                </h1>
            }
        >
            <Head title="Sign-in Protection" />

            <div className="w-full max-w-none space-y-5">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Link href={route(`${role}.settings.index`)} className="hover:text-amber-700">Settings</Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <Link href={route(`${role}.settings.index`, { section: 'security' })} className="hover:text-amber-700">Security &amp; Access</Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-slate-900">Sign-in Protection</span>
                </nav>

                {status && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                        {status}
                    </div>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex max-w-2xl items-start gap-3">
                            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                                <Fingerprint className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-semibold text-slate-900">Passkeys</h2>
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        Phishing-resistant
                                    </span>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    Sign in with Windows Hello, device biometrics, or a compatible security key. The private credential stays with your authenticator; Alibaton stores only the verification credential.
                                </p>
                            </div>
                        </div>

                        <div className="w-full lg:max-w-sm">
                            <label htmlFor="passkey-name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Passkey name
                            </label>
                            <div className="mt-1.5 flex gap-2">
                                <input
                                    id="passkey-name"
                                    value={passkeyName}
                                    onChange={(event) => setPasskeyName(event.target.value.slice(0, 120))}
                                    maxLength={120}
                                    className="min-w-0 flex-1 rounded-xl border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#F4B400] focus:ring-[#F4B400]/20"
                                    placeholder="e.g. Windows Hello"
                                />
                                <button
                                    type="button"
                                    onClick={() => void addPasskey()}
                                    disabled={passkeyProcessing || passkeyName.trim() === ''}
                                    className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {passkeyError && (
                        <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {passkeyError}
                        </div>
                    )}

                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                        {passkeys.length === 0 ? (
                            <div className="px-4 py-7 text-center">
                                <p className="text-sm font-semibold text-slate-700">No passkeys registered yet</p>
                                <p className="mt-1 text-xs text-slate-500">Add one above, then the login page can use passkey sign-in.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-200">
                                {passkeys.map((passkey) => (
                                    <div key={passkey.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-800">{passkey.name}</p>
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                Added {formatDate(passkey.createdAt)} · Last used {passkey.lastUsedAt ? formatDate(passkey.lastUsedAt) : 'Never'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void removePasskey(passkey.id)}
                                            disabled={passkeyProcessing}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="mt-3 text-xs leading-5 text-slate-500">
                        {mfa.adminAuthenticatorRequired
                            ? 'Adding or removing a passkey requires recent authentication. Keep your authenticator and recovery codes available as fallback methods.'
                            : 'Adding or removing a passkey requires recent authentication. Keep email approval, an authenticator, and recovery codes available as fallback methods.'}
                    </p>
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                    {mfa.emailNumberMatchAllowed && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-slate-900">Email approval</h2>
                                        <p className="mt-1 text-sm leading-6 text-slate-500">
                                            The computer shows one two-digit number. The email shows three choices; select the matching number to continue.
                                        </p>
                                    </div>
                                </div>
                                {mfa.defaultMethod === 'email_number_match' && (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                        Default
                                    </span>
                                )}
                            </div>

                            <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Verification email
                                </p>
                                <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                                    {mfa.notificationEmail ?? 'Not configured'}
                                </p>
                            </div>

                            {mfa.emailNumberMatchEnabled && mfa.defaultMethod !== 'email_number_match' && (
                                <button
                                    type="button"
                                    onClick={() => setDefault('email_number_match')}
                                    disabled={defaultForm.processing}
                                    className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Use as default
                                </button>
                            )}
                        </section>
                    )}

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                                    <KeyRound className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-slate-900">Authenticator app</h2>
                                    <p className="mt-1 text-sm leading-6 text-slate-500">
                                        {mfa.adminAuthenticatorRequired
                                            ? 'Required for Admin password sign-in. Use the current six-digit code from your authenticator app.'
                                            : 'Use a six-digit code from your authenticator app as a secure verification method.'}
                                    </p>
                                </div>
                            </div>
                            {mfa.totpEnabled && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    <Check className="h-3.5 w-3.5" /> Added
                                </span>
                            )}
                        </div>

                        {!mfa.totpEnabled && !totpEnrollment && (
                            <button
                                type="button"
                                onClick={() => totpStartForm.post(route('security.mfa.totp.begin'))}
                                disabled={totpStartForm.processing}
                                className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Add authenticator app
                            </button>
                        )}

                        {totpEnrollment && (
                            <div className="mt-5 rounded-xl bg-slate-50 p-4">
                                <p className="text-sm text-slate-600">
                                    In your authenticator app, choose to enter a setup key and use this value:
                                </p>
                                <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
                                    <code className="min-w-0 flex-1 break-all text-sm font-bold tracking-wider text-slate-800">
                                        {totpEnrollment.secret}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={() => copy(totpEnrollment.secret, 'totp')}
                                        className="rounded-md p-2 text-slate-500 hover:bg-slate-50"
                                        aria-label="Copy setup key"
                                    >
                                        {copied === 'totp' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                                    </button>
                                </div>

                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        totpConfirmForm.post(route('security.mfa.totp.confirm'));
                                    }}
                                    className="mt-3"
                                >
                                    <input
                                        value={totpConfirmForm.data.code}
                                        onChange={(event) =>
                                            totpConfirmForm.setData(
                                                'code',
                                                event.target.value.replace(/\D/g, '').slice(0, 6),
                                            )
                                        }
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="6-digit code"
                                        className="w-full rounded-xl border-slate-200 bg-white py-3 text-center text-lg font-bold tracking-[0.3em] focus:border-[#F4B400] focus:ring-[#F4B400]/30"
                                    />
                                    <InputError message={totpConfirmForm.errors.code} className="mt-2" />
                                    <button
                                        type="submit"
                                        disabled={totpConfirmForm.processing || totpConfirmForm.data.code.length !== 6}
                                        className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                        Confirm authenticator
                                    </button>
                                </form>
                            </div>
                        )}

                        {mfa.totpEnabled && mfa.defaultMethod !== 'totp' && (
                            <button
                                type="button"
                                onClick={() => setDefault('totp')}
                                disabled={defaultForm.processing}
                                className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Use as default
                            </button>
                        )}
                    </section>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                                <TicketCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">Recovery codes</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {mfa.recoveryCodesRemaining} unused code{mfa.recoveryCodesRemaining === 1 ? '' : 's'} available.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => recoveryForm.post(route('security.mfa.recovery-codes.regenerate'))}
                            disabled={recoveryForm.processing}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Generate new codes
                        </button>
                    </div>

                    {newRecoveryCodes.length > 0 && (
                        <div className="mt-5 rounded-xl bg-slate-950 p-4 text-white">
                            <p className="text-sm font-semibold">Save these codes now</p>
                            <p className="mt-1 text-xs text-white/60">
                                Each code can be used once. Generating another set invalidates this one.
                            </p>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                {newRecoveryCodes.map((code) => (
                                    <div
                                        key={code}
                                        className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2"
                                    >
                                        <code className="text-sm font-semibold tracking-wider">{code}</code>
                                        <button
                                            type="button"
                                            onClick={() => copy(code, code)}
                                            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                                            aria-label="Copy recovery code"
                                        >
                                            {copied === code ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => ackForm.post(route('security.mfa.recovery-codes.acknowledge'))}
                                disabled={ackForm.processing}
                                className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900"
                            >
                                I saved these codes
                            </button>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                            <Clock3 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Recent sign-in activity</h2>
                            <p className="mt-0.5 text-sm text-slate-500">Verification events for this account.</p>
                        </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                        {events.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-slate-500">No verification activity yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-200">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                                    >
                                        <div>
                                            <p className="font-medium text-slate-800">{eventLabel(event.type)}</p>
                                            <p className="mt-0.5 text-xs text-slate-500">
                                                {formatDate(event.createdAt)}
                                                {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-xs font-semibold ${event.outcome === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}
                                        >
                                            {event.outcome === 'success' ? 'Completed' : 'Not completed'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
