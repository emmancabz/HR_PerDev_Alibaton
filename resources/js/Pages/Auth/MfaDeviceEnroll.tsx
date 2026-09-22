import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { ShieldCheck, Smartphone } from 'lucide-react';

type Props = {
    valid: boolean;
    token: string | null;
    account: { name: string; email: string } | null;
    expiresAt: string | null;
};

export default function MfaDeviceEnroll({ valid, token, account }: Props) {
    const form = useForm({
        confirmation_code: '',
        device_name: '',
    });

    if (!valid || !token || !account) {
        return (
            <GuestLayout isMfaStep>
                <Head title="Device enrollment expired" />
                <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center">
                    <h1 className="text-xl font-bold text-slate-900">
                        Enrollment link unavailable
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        This link is invalid, expired, or has already been used.
                        Start a new trusted-device enrollment from your Alibaton sign-in
                        or Security page.
                    </p>
                </div>
            </GuestLayout>
        );
    }

    return (
        <GuestLayout isMfaStep>
            <Head title="Register trusted device" />
            <div className="mx-auto w-full max-w-md">
                <div className="mb-6 text-center">
                    <img
                        src={alibatonLogo}
                        alt="Alibaton"
                        className="mx-auto mb-3 h-14 w-14 object-contain"
                    />
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
                        <Smartphone className="h-6 w-6 text-amber-700" />
                    </div>
                    <h1 className="mt-3 text-2xl font-bold text-slate-900">
                        Register this device
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {account.name} · {account.email}
                    </p>
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(
                            route('mfa.device.enroll.store', { token }),
                        );
                    }}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <label className="text-sm font-semibold text-slate-700">
                        Device name
                    </label>
                    <input
                        value={form.data.device_name}
                        onChange={(event) =>
                            form.setData('device_name', event.target.value)
                        }
                        placeholder="e.g. Emman's phone"
                        className="mt-1.5 w-full rounded-xl border-slate-200 bg-slate-50 focus:border-[#F4B400] focus:ring-[#F4B400]/30"
                    />
                    <InputError
                        message={form.errors.device_name}
                        className="mt-2"
                    />

                    <label className="mt-4 block text-sm font-semibold text-slate-700">
                        6-digit confirmation code
                    </label>
                    <input
                        value={form.data.confirmation_code}
                        onChange={(event) =>
                            form.setData(
                                'confirmation_code',
                                event.target.value.replace(/\D/g, '').slice(0, 6),
                            )
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        className="mt-1.5 w-full rounded-xl border-slate-200 bg-slate-50 py-3 text-center text-xl font-bold tracking-[0.35em] focus:border-[#F4B400] focus:ring-[#F4B400]/30"
                    />
                    <InputError
                        message={form.errors.confirmation_code}
                        className="mt-2"
                    />

                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                        Only register a device you control. The browser will receive a
                        separate secure device token used only for Alibaton approval
                        requests.
                    </div>

                    <button
                        type="submit"
                        disabled={
                            form.processing ||
                            form.data.confirmation_code.length !== 6 ||
                            form.data.device_name.trim().length < 2
                        }
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F4B400] px-4 py-3 font-bold text-slate-950 disabled:opacity-50"
                    >
                        <ShieldCheck className="h-5 w-5" />
                        Trust this device
                    </button>
                </form>
            </div>
        </GuestLayout>
    );
}
