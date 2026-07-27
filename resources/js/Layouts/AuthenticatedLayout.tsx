import Dropdown from '@/Components/Dropdown';
import { Link, usePage } from '@inertiajs/react';
import {
    LayoutGrid,
    TrendingUp,
    Settings2,
    GraduationCap,
    BookOpen,
    Network,
    Award,
    FileText,
    Settings,
    Search,
    Bell,
    ChevronDown,
    ChevronLeft,
    Menu,
    X,
} from 'lucide-react';
import { PropsWithChildren, ReactNode, useState } from 'react';

const navItems = [
    { label: 'Dashboard', icon: LayoutGrid, routeName: 'admin.dashboard' },
    { label: 'Performance Management', icon: TrendingUp, href: '#' },
    { label: 'Competency Management', icon: Settings2, href: '#' },
    { label: 'Learning Management', icon: GraduationCap, href: '#' },
    { label: 'Training Management', icon: BookOpen, href: '#' },
    { label: 'Succession Planning', icon: Network, href: '#' },
    { label: 'Social Recognition', icon: Award, href: '#' },
    { label: 'Reports', icon: FileText, href: '#' },
    { label: 'Settings', icon: Settings, href: '#' },
];

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = usePage().props.auth.user;

    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-amber-200 bg-amber-50 transition-all duration-200 lg:static lg:translate-x-0 ${
                    collapsed ? 'w-20' : 'w-64'
                } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                {/* Brand Header */}
                <div className="relative flex items-center gap-3 border-b border-amber-200 px-4 py-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
                        <img
                            src="/assets/AlibatonLogonobg.png"
                            alt="Alibaton Logo"
                            className="h-full w-full object-contain p-1"
                        />
                    </div>

                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold leading-tight text-slate-800">
                                Alibaton Construction
                            </p>
                            <p className="truncate text-xs font-semibold leading-tight text-amber-700">
                                Performance &amp; Development
                            </p>
                        </div>
                    )}

                    <button
                        onClick={() => setMobileOpen(false)}
                        className="ml-auto shrink-0 text-slate-700 lg:hidden"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <button
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200 bg-white text-slate-700 shadow lg:flex"
                    >
                        <ChevronLeft
                            className={`h-4 w-4 transition-transform ${
                                collapsed ? 'rotate-180' : ''
                            }`}
                        />
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.routeName
                            ? route().current(item.routeName)
                            : false;

                        const linkProps = item.routeName
                            ? { href: route(item.routeName) }
                            : { href: item.href };

                        return (
                            <Link
                                key={item.label}
                                {...linkProps}
                                className={`relative flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                                    isActive
                                        ? 'border-amber-300 bg-amber-200/70 text-slate-900'
                                        : 'border-transparent text-slate-700 hover:bg-amber-100'
                                } ${collapsed ? 'justify-center' : ''}`}
                                title={collapsed ? item.label : undefined}
                            >
                                <Icon className="h-5 w-5 shrink-0" />
                                {!collapsed && (
                                    <span className="truncate">{item.label}</span>
                                )}

                                {isActive && (
                                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-amber-600" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main content */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Topbar */}
                <header className="flex h-16 items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="text-slate-700 lg:hidden"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        {header ?? (
                            <h1 className="text-lg font-bold text-slate-800">
                                Dashboard
                            </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden max-w-xs flex-1 sm:block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search anything..."
                                className="w-full rounded-lg border border-amber-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-amber-400"
                            />
                        </div>

                        <button className="relative text-slate-600 hover:text-slate-900">
                            <Bell className="h-5 w-5" />
                        </button>

                        <Dropdown>
                            <Dropdown.Trigger>
                                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-amber-100">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-semibold text-white">
                                        {user.name?.charAt(0)}
                                    </div>
                                    <span className="hidden text-sm font-semibold text-slate-800 sm:block">
                                        {user.name}
                                    </span>
                                    <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
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

                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}