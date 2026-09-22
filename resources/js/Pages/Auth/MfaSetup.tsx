import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Clipboard, KeyRound } from 'lucide-react';
import { useState } from 'react';

type Props = {
    account: { name: string; email: string; role: string };
    totpEnrollment: { secret: string; uri: string } | null;
    recoveryCodes: string[];
    status?: string;
};

export default function MfaSetup({ account, totpEnrollment, recoveryCodes, status }: Props) {
    const [copied, setCopied] = useState(false);
    const beginForm = useForm({});
    const confirmForm = useForm({ code: '' });
    const continueForm = useForm({});

    const copySecret = async () => {
        if (!totpEnrollment) return;
        await navigator.clipboard.writeText(totpEnrollment.secret);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <GuestLayout>
            <Head title="Set up verification" />
            <div className="mx-auto w-full max-w-[430px]">
                <div className="mb-7 text-center">
                    <img src={alibatonLogo} alt="Alibaton" className="mx-auto mb-4 h-16 w-16 object-contain" />
                    <h1 className="text-2xl font-bold text-slate-900">Set up verification</h1>
                    <p className="mt-1 text-sm text-slate-500">{account.email}</p>
                </div>

                {status && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {status}
                    </div>
                )}

                {recoveryCodes.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-bold text-slate-900">Save your recovery codes</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                            Keep these somewhere private. Each code works once.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4 font-mono text-xs font-semibold text-slate-700">
                            {recoveryCodes.map((code) => <span key={code}>{code}</span>)}
                        </div>
                        <button
                            type="button"
                            onClick={() => continueForm.post(route('mfa.setup.continue'))}
                            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                        >
                            Continue
                        </button>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-slate-100 p-2.5">
                                <KeyRound className="h-5 w-5 text-slate-700" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900">Authenticator app</h2>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    {account.role === 'Admin'
                                        ? 'Admin password sign-in requires an authenticator app. Add this account to Google Authenticator, Microsoft Authenticator, or another TOTP app.'
                                        : 'Add this account to Google Authenticator, Microsoft Authenticator, or another TOTP app.'}
                                </p>
                            </div>
                        </div>

                        {!totpEnrollment ? (
                            <button
                                type="button"
                                onClick={() => beginForm.post(route('mfa.setup.totp.begin'))}
                                disabled={beginForm.processing}
                                className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                            >
                                Set up authenticator
                            </button>
                        ) : (
                            <>
                                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Setup key</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <code className="min-w-0 flex-1 break-all text-sm font-bold tracking-wider text-slate-800">
                                            {totpEnrollment.secret}
                                        </code>
                                        <button type="button" onClick={copySecret} className="rounded-lg p-2 text-slate-500 hover:bg-white">
                                            <Clipboard className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {copied && <p className="mt-1 text-xs text-slate-500">Copied</p>}
                                </div>

                                <form
                                    className="mt-4"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        confirmForm.post(route('mfa.setup.totp.confirm'));
                                    }}
                                >
                                    <input
                                        value={confirmForm.data.code}
                                        onChange={(event) =>
                                            confirmForm.setData('code', event.target.value.replace(/\D/g, '').slice(0, 6))
                                        }
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="6-digit code"
                                        className="w-full rounded-xl border-slate-200 bg-white py-3 text-center text-lg font-bold tracking-[0.3em] focus:border-[#F4B400] focus:ring-[#F4B400]/20"
                                    />
                                    <InputError message={confirmForm.errors.code} className="mt-2" />
                                    <button
                                        type="submit"
                                        disabled={confirmForm.processing || confirmForm.data.code.length !== 6}
                                        className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                                    >
                                        Confirm
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => router.visit(route('login'))}
                    className="mt-5 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                    Back to sign in
                </button>
            </div>
        </GuestLayout>
    );
}
