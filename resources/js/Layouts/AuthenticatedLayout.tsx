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
                className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-alibaton transition-all duration-200 lg:static lg:translate-x-0 ${
                    collapsed ? 'w-20' : 'w-64'
                } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                {/* Brand Header */}
                <div className="relative flex items-center gap-3 border-b border-black/10 px-4 py-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                        <img src="/assets/AlibatonLogonobg.png" alt="Alibaton Logo" className="object-contain" />
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="truncate font-bold text-black">
                                Alibaton
                            </p>
                            <p className="truncate text-xs font-semibold text-black/75">
                                Construction Incorporated
                            </p>
                        </div>
                    )}

                    <button
                        onClick={() => setMobileOpen(false)}
                        className="ml-auto text-black lg:hidden"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <button
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black text-white shadow lg:flex"
                    >
                        <ChevronLeft
                            className={`h-4 w-4 transition-transform ${
                                collapsed ? 'rotate-180' : ''
                            }`}
                        />
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
                                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                                    isActive
                                        ? 'bg-white/40 border border-black/15 text-black'
                                        : 'text-black/80 hover:bg-white/25 border border-transparent'
                                } ${collapsed ? 'justify-center' : ''}`}
                                title={collapsed ? item.label : undefined}
                            >
                                <Icon className="h-5 w-5 shrink-0" />
                                {!collapsed && <span>{item.label}</span>}
                                
                                {/* Maliit na tag/indicator arrow sa dulo ng active button katulad sa Figma */}
                                {isActive && !collapsed && (
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-black mr-1" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main content */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Topbar (Naka-dilaw na rin para tuloy-tuloy mula sa Sidebar!) */}
                <header className="flex items-center gap-4 border-b border-black/10 bg-alibaton px-4 py-3 sm:px-6">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="text-black lg:hidden"
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    {header ?? (
                        <h1 className="text-lg font-bold text-black">
                            Dashboard
                        </h1>
                    )}

                    {/* Translucent Search Bar para magandang tingnan sa Yellow Header */}
                    <div className="relative ml-auto hidden max-w-xs flex-1 sm:block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" />
                        <input
                            type="text"
                            placeholder="Search anything..."
                            className="w-full rounded-lg border-transparent bg-white/60 py-2 pl-9 pr-3 text-sm text-black placeholder-black/50 focus:border-black/20 focus:bg-white focus:ring-0"
                        />
                    </div>

                    <button className="relative text-black/80 hover:text-black">
                        <Bell className="h-5 w-5" />
                    </button>

                    <Dropdown>
                        <Dropdown.Trigger>
                            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/20">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-semibold text-alibaton">
                                    {user.name?.charAt(0)}
                                </div>
                                <span className="hidden text-sm font-bold text-black sm:block">
                                    {user.name}
                                </span>
                                <ChevronDown className="hidden h-4 w-4 text-black/80 sm:block" />
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
                </header>

                <main className="flex-1 p-4 sm:p-6">{children}</main>
            </div>
        </div>
    );
}