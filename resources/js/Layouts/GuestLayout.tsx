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
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                <div className="absolute bottom-10 left-10 right-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400">
                        Alibaton Construction Inc.
                    </p>
                    <h2 className="mt-2 text-3xl font-bold text-white">
                        YOUR LIFTING EQUIPMENT EXPERT
                    </h2>
                </div>
            </div>

            <div className="flex w-full items-center justify-center bg-white px-6 py-10 lg:w-2/5">
                <div className="w-full max-w-md">{children}</div>
            </div>
        </div>
    );
}