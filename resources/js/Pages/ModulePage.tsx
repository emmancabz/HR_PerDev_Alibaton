import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
export default function ModulePage({ title }: { title: string }) {
    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-lg font-bold text-slate-900">
                    {title}
                </h1>
            }
        >
            <Head title={title} />
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">
                    {title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    This module is ready for implementation. Navigation and
routing are configured for the Performance &amp; Development
sub-system.</p>
            </div>
        </AuthenticatedLayout>
    );
}
