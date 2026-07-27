import { PropsWithChildren } from 'react';
import loginBg from '@/assets/loginbg.png';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen">
            <div className="relative hidden w-full overflow-hidden lg:block lg:w-3/5">
                <img
                    src={loginBg}
                    alt="Alibaton Construction"
                    className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950/20" />
                <div className="absolute bottom-10 left-10 right-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F4B400]">
                        Alibaton Construction Inc.
                    </p>
                    <h2 className="mt-2 text-3xl font-bold leading-tight text-white">
                        YOUR LIFTING EQUIPMENT EXPERT
                    </h2>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
                        Empowering our workforce through performance tracking,
                        training, and development.
                    </p>
                </div>
            </div>

            <div className="relative flex w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-amber-50/30 px-6 py-10 lg:w-2/5">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#F4B400]/5 blur-3xl" />
                    <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-orange-500/5 blur-3xl" />
                </div>
                <div className="relative w-full max-w-md">
                    <div className="rounded-2xl border border-slate-100 bg-white/80 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
