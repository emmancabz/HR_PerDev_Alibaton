import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';

export default function ManagerDashboard() {
    const { auth } = usePage().props as any;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Manager Dashboard
                </h2>
            }
        >
            <Head title="Manager Dashboard" />

            <div className="flex flex-col gap-4">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-800">
                        Hello, {auth.user.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Manager Portal - Team Oversight & Performance Tracking
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-32 rounded-xl bg-gray-100" />
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}