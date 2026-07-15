import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),rgba(2,6,23,0.92)_45%,rgba(2,6,23,1)_80%)]" />
            <div className="pointer-events-none absolute -left-32 top-16 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-8 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />

            <div className="relative w-full max-w-md">
                <Link href="/" className="mb-8 flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 p-2 shadow-lg shadow-indigo-500/20">
                        <ApplicationLogo className="h-8 w-8 fill-indigo-700" />
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                        Alibaton Workforce
                    </span>
                </Link>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/95 px-6 py-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
                    {children}
                </div>
            </div>
        </div>
    );
}
