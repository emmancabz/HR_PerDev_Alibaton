import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

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
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">
                        Secure Access
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                        Sign in to your portal
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Authenticate with your role account to open the correct dashboard.
                    </p>
                </div>

                <div>
                    <InputLabel
                        htmlFor="email"
                        value="Email"
                        className="text-slate-700"
                    />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full rounded-xl border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:border-indigo-500 focus:ring-indigo-500"
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
                        className="text-slate-700"
                    />

                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full rounded-xl border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:border-indigo-500 focus:ring-indigo-500"
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />

                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="mt-4 block">
                    <label className="flex items-center">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
                            className="rounded-md text-sm text-slate-600 underline decoration-slate-400 underline-offset-4 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            Forgot your password?
                        </Link>
                    )}

                    <PrimaryButton
                        className="ms-auto inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:bg-indigo-500 active:bg-indigo-700"
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
