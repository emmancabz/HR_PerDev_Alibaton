import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import Dropdown from '@/Components/Dropdown';
import { Link, usePage } from '@inertiajs/react';
import {
    Award,
    Bell,
    BookOpen,
    ChevronDown,
    FileText,
    GraduationCap,
    LayoutGrid,
    Menu,
    Network,
    Route,
    Search,
    Settings,
    Settings2,
    TrendingUp,
    Trophy,
    Users,
    Wallet,
    X,
    type LucideIcon,
} from 'lucide-react';
import { PropsWithChildren, ReactNode, useMemo, useState } from 'react';
type AppUserRole = 'admin' | 'hr' | 'user';
type NavItem = {
    label: string;
    icon: LucideIcon;
    routeName: string;
};
const hrNavItems: NavItem[] = [
    { label: 'Learning Management', icon: GraduationCap, routeName: 'hr.learning.index' },
    { label: 'Training Management', icon: BookOpen, routeName: 'hr.training.index' },
    { label: 'Competency Management', icon: Settings2, routeName: 'hr.competency.index' },
    { label: 'Performance Management', icon: TrendingUp, routeName: 'hr.performance.index' },
    { label: 'Succession Planning', icon: Network, routeName: 'hr.succession.index' },
    { label: 'Social Recognition', icon: Award, routeName: 'hr.recognition.index' },
    { label: 'Reports', icon: FileText, routeName: 'hr.reports.index' },
    { label: 'Settings', icon: Settings, routeName: 'hr.settings.index' },
];
const userNavItems: NavItem[] = [
    { label: 'My Learning', icon: GraduationCap, routeName: 'user.learning.index' },
    { label: 'My Training', icon: BookOpen, routeName: 'user.training.index' },
    { label: 'My Skills Wallet', icon: Wallet, routeName: 'user.skills.index' },
    { label: 'My Performance', icon: TrendingUp, routeName: 'user.performance.index' },
    { label: 'My Career Path', icon: Route, routeName: 'user.career.index' },
    { label: 'Company Leaderboard', icon: Trophy, routeName: 'user.leaderboard.index' },
    { label: 'My Transcripts', icon: FileText, routeName: 'user.transcripts.index' },
    { label: 'Settings', icon: Settings, routeName: 'user.settings.index' },
];
const adminNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutGrid, routeName: 'admin.dashboard' },
    { label: 'Users', icon: Users, routeName: 'admin.users.index' },
    { label: 'Performance', icon: TrendingUp, routeName: 'admin.performance.index' },
    { label: 'Competency', icon: Settings2, routeName: 'admin.competency.index' },
    { label: 'Learning', icon: GraduationCap, routeName: 'admin.learning.index' },
    { label: 'Training', icon: BookOpen, routeName: 'admin.training.index' },
    { label: 'Succession', icon: Network, routeName: 'admin.succession.index' },
    { label: 'Recognition', icon: Award, routeName: 'admin.recognition.index' },
    { label: 'Reports', icon: FileText, routeName: 'admin.reports.index' },
    { label: 'Settings', icon: Settings, routeName: 'admin.settings.index' },
];
function resolveNavItems(role: unknown): NavItem[] {
    const normalizedRole =
        role === 'admin' || role === 'hr' || role === 'user' ? role : 'user';
    switch (normalizedRole) {
        case 'admin':
            return adminNavItems;
        case 'hr':
            return hrNavItems;
        default:
            return userNavItems;
    }
}
function isNavItemActive(routeName: string): boolean {
    if (!route().has(routeName)) {
        return false;
    }
    const routePrefix = routeName.replace(/\.index$/, '');
    return (
        route().current(routeName) ||
        route().current(`${routePrefix}.*`) ||
        route().current(`${routePrefix}.index`)
    );
}
function resolveNavHref(routeName: string): string {
    return route().has(routeName) ? route(routeName) : '#';
}
export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = usePage().props.auth.user;
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sidebar_collapsed') === 'true';
        }
        return false;
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const navItems = useMemo(
        () => resolveNavItems(user.role),
        [user.role],
    );
    const closeMobileSidebar = () => setMobileOpen(false);
    const handleToggleMenu = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setMobileOpen((prev) => !prev);
        } else {
            setCollapsed((prev) => {
                const nextState = !prev;
                localStorage.setItem('sidebar_collapsed', String(nextState));
                return nextState;
            });
        }
    };
    return (
        <div className="flex min-h-screen bg-[#ededed]">
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
                    onClick={closeMobileSidebar}
                    aria-hidden="true"
                />
            )}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col bg-[#121212] transition-[width,transform] duration-200 ease-in-out lg:sticky lg:top-0 lg:translate-x-0 ${
                    collapsed ? 'w-[5.25rem]' : 'w-64'
                } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                <div
                    className={`relative flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4 ${
                        collapsed ? 'justify-center px-3' : ''
                    }`}
                >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
                        <img
                            src={alibatonLogo}
                            alt="Alibaton Construction"
                            className="max-h-full max-w-full object-contain object-center"
                        />
                    </div>
                    {!collapsed && (
                        <div className="min-w-0 flex-1 overflow-hidden pr-2">
                            <p className="truncate whitespace-nowrap text-sm font-bold leading-snug tracking-tight text-white">
                                Alibaton
                            </p>
                            <p className="truncate whitespace-nowrap text-xs font-medium leading-snug text-white/60">
                                Construction Incorporate
                            </p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={closeMobileSidebar}
                        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 lg:hidden"
                        aria-label="Close navigation menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = isNavItemActive(item.routeName);
                        return (
                            <Link
                                key={item.routeName}
                                href={resolveNavHref(item.routeName)}
                                onClick={closeMobileSidebar}
                                title={collapsed ? item.label : undefined}
                                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                                    collapsed ? 'justify-center px-2.5' : ''
                                } ${
                                    isActive
                                        ? 'bg-[#F4B400] text-black'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <Icon
                                    className={`h-5 w-5 shrink-0 ${
                                        isActive
                                            ? 'text-black'
                                            : 'text-white/60 group-hover:text-white'
                                    }`}
                                />

                                {!collapsed && (
                                    <span className="min-w-0 flex-1 truncate whitespace-nowrap leading-snug">
                                        {item.label}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
                <div
                    className={`shrink-0 border-t border-white/10 p-3 ${
                        collapsed ? 'flex justify-center' : ''
                    }`}
                >
                    <div
                        className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                            collapsed ? 'justify-center' : ''
                        }`}
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4B400] text-sm font-bold text-black">
                            {user.name?.charAt(0)?.toUpperCase()}
                        </div>
                        {!collapsed && (
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                                {user.name}
                            </span>
                        )}
                    </div>
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 bg-white/75 px-4 shadow-sm backdrop-blur-xl backdrop-saturate-150 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={handleToggleMenu}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100"
                            aria-label="Toggle navigation menu" >
                            <Menu className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-center px-2">
                        <div className="relative w-full max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                placeholder="Search anything..."
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 py-0 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-[#F4B400] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
                            />
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            aria-label="Notifications" >
                            <Bell className="h-5 w-5" />
                        </button>
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button
                                    type="button"
                                    className="inline-flex h-10 items-center gap-2 rounded-lg px-2 transition hover:bg-slate-100" >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4B400] text-sm font-semibold text-black">
                                        {user.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-slate-800 sm:block">
                                        {user.name}
                                    </span>
                                    <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-500 sm:block" />
                                </button>
                            </Dropdown.Trigger>
                            <Dropdown.Content>
                                <Dropdown.Link href={route('profile.edit')}>
                                    Profile
                                </Dropdown.Link>
                                <Dropdown.Link
                                    href={route('logout')}
                                    method="post"
                                    as="button"
                                >
                                    Log Out
                                </Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-4 sm:p-5">
                    {children}
                </main>
            </div>
        </div>
    );
}