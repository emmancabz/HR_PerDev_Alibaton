import loginBg from '@/assets/loginbg.webp';
import { PropsWithChildren, useLayoutEffect } from 'react';

interface GuestLayoutProps extends PropsWithChildren {
    isMfaStep?: boolean;
    surface?: boolean;
    mobileBottomSheet?: boolean;
}

export default function Guest({
    children,
    surface = true,
    mobileBottomSheet = false,
}: GuestLayoutProps) {
    useLayoutEffect(() => {
        const root = document.documentElement;

        const forceAuthLightTheme = () => {
            root.classList.remove('dark');
            root.dataset.theme = 'light';
            root.style.colorScheme = 'light';
        };

        forceAuthLightTheme();

        const observer = new MutationObserver(() => {
            if (root.classList.contains('dark') || root.dataset.theme !== 'light') {
                forceAuthLightTheme();
            }
        });

        observer.observe(root, {
            attributes: true,
            attributeFilter: ['class', 'data-theme'],
        });

        return () => observer.disconnect();
    }, []);

    return (
        <div
            data-pd-auth-shell="true"
            className="relative min-h-[100dvh] overflow-x-hidden bg-slate-100 [color-scheme:light] md:overflow-hidden"
        >
            {/* Mobile login can use a dedicated hero + bottom-sheet composition.
                Desktop/tablet keeps the existing full-screen cinematic background. */}
            <div
                className={
                    mobileBottomSheet
                        ? 'absolute inset-x-0 top-0 h-[40dvh] min-h-[235px] overflow-hidden sm:min-h-[260px] md:inset-0 md:h-auto md:min-h-0'
                        : 'absolute inset-x-0 top-0 h-[42dvh] min-h-[280px] overflow-hidden md:inset-0 md:h-auto md:min-h-0'
                }
            >
                <div className="absolute inset-0 md:inset-[-4%] md:[perspective:1800px]">
                    <img
                        src={loginBg}
                        alt="Alibaton Construction workplace"
                        decoding="async"
                        fetchPriority="high"
                        className={`h-full w-full object-cover md:h-[108%] md:w-[108%] md:max-w-none md:[transform:rotateX(1.5deg)_rotateY(-7deg)_scale(1.06)_translate3d(-1.5%,0,0)] ${
                            mobileBottomSheet ? 'object-[62%_center]' : 'object-center'
                        }`}
                    />
                </div>
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.36),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.16),transparent_24%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_82%,rgba(245,158,11,0.14),transparent_30%),radial-gradient(circle_at_22%_78%,rgba(249,115,22,0.10),transparent_24%)]" />
                <div
                    className={
                        mobileBottomSheet
                            ? 'absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.03)_0%,rgba(15,23,42,0.03)_72%,rgba(15,23,42,0.18)_100%)] md:bg-[linear-gradient(118deg,rgba(255,255,255,0.14)_0%,transparent_34%,transparent_66%,rgba(17,24,39,0.08)_100%)]'
                            : 'absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.02)_56%,rgba(241,245,249,0.94)_100%)] md:bg-[linear-gradient(118deg,rgba(255,255,255,0.14)_0%,transparent_34%,transparent_66%,rgba(17,24,39,0.08)_100%)]'
                    }
                />
            </div>

            <main
                className={
                    mobileBottomSheet
                        ? 'relative z-10 flex min-h-[100dvh] items-end justify-stretch p-0 pt-[34dvh] md:items-center md:justify-center md:px-6 md:py-8 lg:px-8'
                        : 'relative flex min-h-[100dvh] items-start justify-center px-3 pb-6 pt-[22dvh] sm:px-5 sm:pt-[24dvh] md:items-center md:px-6 md:py-8 lg:px-8'
                }
            >
                <div className={mobileBottomSheet ? 'w-full md:max-w-[480px]' : 'w-full max-w-[480px]'}>
                    {surface ? (
                        <div className="rounded-[28px] border border-white/75 bg-white/94 p-5 shadow-[0_30px_90px_-38px_rgba(15,23,42,0.48)] backdrop-blur-xl sm:p-7 md:bg-white/86 md:p-8">
                            {children}
                        </div>
                    ) : (
                        children
                    )}
                </div>
            </main>
        </div>
    );
}
