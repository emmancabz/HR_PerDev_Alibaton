import loginBg from '@/assets/loginbg.png';
import { PropsWithChildren, useEffect, useState } from 'react';
interface GuestLayoutProps extends PropsWithChildren {
    isMfaStep?: boolean;
}
export default function Guest({ children, isMfaStep = false }: GuestLayoutProps) {
    const [isTransitioning, setIsTransitioning] = useState(false);
    useEffect(() => {
        setIsTransitioning(true);
        const timer = setTimeout(() => {
            setIsTransitioning(false);
        }, 700); // Exaktong duration nung transition
        return () => clearTimeout(timer);
    }, [isMfaStep]);
    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-slate-900">
            <div 
                className={`absolute bottom-0 left-0 top-0 z-10 hidden w-full lg:block lg:w-[60vw] transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isMfaStep ? 'lg:translate-x-[40vw]' : 'translate-x-0'
                } ${isTransitioning ? 'blur-[3px] scale-[1.01]' : 'blur-0 scale-100'}`}
            >
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
            <div 
                className={`absolute bottom-0 right-0 top-0 z-20 flex w-full lg:w-[40vw] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-amber-50/30 px-6 py-10 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isMfaStep ? 'lg:-translate-x-[60vw]' : 'translate-x-0'
                }`}
            >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#F4B400]/5 blur-3xl" />
                    <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-orange-500/5 blur-3xl" />
                </div>
                <div className="relative w-full max-w-md">
                    {children}
                </div>
            </div>
        </div>
    );
}