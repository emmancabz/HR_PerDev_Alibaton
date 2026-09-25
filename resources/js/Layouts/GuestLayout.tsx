import loginBg from '@/assets/loginbg.webp';
import { PropsWithChildren, useLayoutEffect } from 'react';

interface GuestLayoutProps extends PropsWithChildren {
    isMfaStep?: boolean;
    surface?: boolean;
}

export default function Guest({
    children,
    surface = true,
}: GuestLayoutProps) {
    useLayoutEffect(() => {
        const root = document.documentElement;

        const forceAuthLightTheme = () => {
            root.classList.remove('dark');
            root.dataset.theme = 'light';
            root.style.colorScheme = 'light';
        };

        // Public/auth screens intentionally keep their own light glass design.
        // Do not change the saved authenticated preference in localStorage.
        forceAuthLightTheme();

        // If a stale authenticated-layout effect or SPA transition tries to
        // restore `.dark` while an auth screen is mounted, immediately remove it.
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
        <div data-pd-auth-shell="true" className="relative min-h-screen overflow-hidden bg-slate-100 [color-scheme:light]">
            <div className="absolute inset-0">
                <div className="absolute inset-[-4%] [perspective:1800px]">
                    <img
                        src={loginBg}
                        alt="Alibaton Construction workplace"
                        decoding="async"
                        fetchPriority="high"
                        className="h-[108%] w-[108%] max-w-none object-cover object-center [transform:rotateX(1.5deg)_rotateY(-7deg)_scale(1.06)_translate3d(-1.5%,0,0)]"
                    />
                </div>
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.36),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.16),transparent_24%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_82%,rgba(245,158,11,0.14),transparent_30%),radial-gradient(circle_at_22%_78%,rgba(249,115,22,0.10),transparent_24%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.14)_0%,transparent_34%,transparent_66%,rgba(17,24,39,0.08)_100%)]" />
            </div>

            <main className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
                <div className="w-full max-w-[480px]">
                    {surface ? (
                        <div className="rounded-[28px] border border-white/65 bg-white/86 p-6 shadow-[0_28px_80px_-38px_rgba(15,23,42,0.52)] backdrop-blur-xl sm:p-8">
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
