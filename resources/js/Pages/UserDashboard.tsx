import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
export default function UserDashboard() {
    const { auth } = usePage().props as { auth: { user: { name: string } } };
    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-lg font-bold text-slate-900">
                    My Dashboard
                </h1>
            }
        >
            <Head title="My Dashboard" />
            <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Hello, {auth.user.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Driver / Trainee Portal — Performance &amp; Development
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-32 rounded-xl border border-slate-200/60 bg-white shadow-sm"
                        />
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
