import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { LoaderCircle, ShieldCheck, Eye, EyeOff, Mail, Lock } from 'lucide-react';
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
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 p-3 shadow-sm ring-1 ring-slate-100">
                        <img
                            src={alibatonLogo}
                            alt="Alibaton Construction Incorporated"
                            className="max-h-full max-w-full object-contain"
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

                <div>
                    <InputLabel
                        htmlFor="email"
                        value="Email Address"
                        className="text-sm font-semibold text-slate-700"
                    />

                    <div className="relative mt-1.5">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-4 shadow-sm transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                            autoComplete="username"
                            isFocused={true}
                            placeholder="you@company.com"
                            onChange={(e) => setData('email', e.target.value)}
                        />
                    </div>

                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="mt-5">
                    <InputLabel
                        htmlFor="password"
                        value="Password"
                        className="text-sm font-semibold text-slate-700"
                    />

                    <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <TextInput
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-11 shadow-sm transition focus:border-[#F4B400] focus:bg-white focus:ring-[#F4B400]/30"
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            onChange={(e) => setData('password', e.target.value)}
                        />

                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:text-slate-600 focus:outline-none"
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>

                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="mt-5 flex items-center justify-between">
                    <label className="flex cursor-pointer items-center">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            className="rounded border-slate-300 text-[#F4B400] focus:ring-[#F4B400]/30"
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

                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="text-sm font-medium text-slate-500 transition hover:text-[#F4B400]"
                        >
                            Forgot password?
                        </Link>
                    )}
                </div>

                <PrimaryButton
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#121212] py-3.5 text-sm font-semibold normal-case tracking-normal text-white shadow-lg shadow-slate-900/20 transition hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] active:bg-black"
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

            <p className="mt-6 text-center text-xs text-slate-400">
                &copy; {new Date().getFullYear()} Alibaton Construction Inc.
                All rights reserved.
            </p>
        </GuestLayout>
    );
}
