import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function AdminDashboard({ userName }: { userName: string }) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Admin Dashboard
                </h2>
            }
        >
            <Head title="Admin Dashboard" />

            <div className="py-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="rounded-2xl border border-indigo-200 bg-white p-8 shadow-sm dark:border-indigo-900/60 dark:bg-gray-900">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                            Hello, {userName}
                        </p>
                        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">
                            Admin Portal - Smart Workforce Intelligence
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                            Use this space to review organizational insights, monitor
                            platform activity, and coordinate strategic workforce plans.
                        </p>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
