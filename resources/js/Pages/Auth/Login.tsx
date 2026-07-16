import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { LoaderCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import alibatonLogo from '@/assets/AlibatonLogonobg.png';

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

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Log in" />

            {status && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mb-6">
                    <img
                        src={alibatonLogo}
                        alt="Alibaton Construction Incorporated"
                        className="mb-8 h-35 w-auto"
                    />
                    <h1 className="mt-2 text-2xl font-bold text-slate-900">
                        Human Resources
                    </h1>
                    <p className="text-lg font-semibold text-orange-600">
                        Performance &amp; Development
                    </p>
                    <p className="mt-3 text-sm text-slate-600">
                        Welcome back! Sign in to your workforce portal to start your day.
                    </p>
                </div>

                <div>
                    <InputLabel
                        htmlFor="email"
                        value="Email"
                        className="font-medium text-slate-800"
                    />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full rounded-xl border-slate-300 bg-white px-4 py-3 shadow-sm transition focus:border-orange-500 focus:ring-orange-500"
                        autoComplete="username"
                        isFocused={true}
                        onChange={(e) => setData('email', e.target.value)}
                    />

                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel
                        htmlFor="password"
                        value="Password"
                        className="font-medium text-slate-800"
                    />

                    <div className="relative">
                        <TextInput
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            className="mt-1 block w-full rounded-xl border-slate-300 bg-white px-4 py-3 pr-11 shadow-sm transition focus:border-orange-500 focus:ring-orange-500"
                            autoComplete="current-password"
                            onChange={(e) => setData('password', e.target.value)}
                        />

                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                            ) : (
                                <Eye className="h-5 w-5" />
                            )}
                        </button>
                    </div>

                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="mt-4 block">
                    <label className="flex items-center">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                            onChange={(e) =>
                                setData(
                                    'remember',
                                    (e.target.checked || false) as false,
                                )
                            }
                        />
                        <span className="ms-2 text-sm text-slate-600">
                            Remember me
                        </span>
                    </label>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4">
                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="rounded-md text-sm text-slate-600 underline decoration-slate-400 underline-offset-4 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            Forgot your password?
                        </Link>
                    )}

                    <PrimaryButton
                        className="ms-auto inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white shadow-lg shadow-orange-600/30 hover:bg-orange-500 focus:bg-orange-500 active:bg-orange-700"
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
                                Log in
                            </>
                        )}
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}