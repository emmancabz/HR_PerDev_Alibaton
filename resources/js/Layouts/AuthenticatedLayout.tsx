import AevynShell from '@/Components/Aevyn/AevynShell';
import SystemSelect from '@/Components/SystemSelect';
import alibatonLogo from '@/assets/AlibatonLogonobg.png';
import { encodeWorkspaceHash } from '@/workspaceNavigation';
import { Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    Award,
    Bell,
    BookOpen,
    ChevronDown,
    ChevronRight,
    Clock,
    ClipboardCheck,
    FileText,
    GraduationCap,
    LayoutGrid,
    LoaderCircle,
    CheckCheck,
    ExternalLink,
    LogOut,
    Menu,
    Network,
    Route,
    Search,
    Sun,
    Moon,
    RotateCcw,
    Check,
    SlidersHorizontal,
    Settings,
    Settings2,
    ShieldCheck,
    TrendingUp,
    Trophy,
    UserRound,
    Users,
    Wallet,
    X,
    type LucideIcon,
} from 'lucide-react';
import { Children, KeyboardEvent, PropsWithChildren, ReactNode, RefObject, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type AppUserRole = 'admin' | 'hr' | 'user';
type UserPersona = 'trainee' | 'employee' | 'supervisor' | 'manager';

type NavChild = {
    label: string;
    workspace: string;
};

type NavItem = {
    label: string;
    icon: LucideIcon;
    routeName: string;
    children?: NavChild[];
};

type SearchResult = {
    key: string;
    label: string;
    module: string;
    group: string;
    description?: string;
    routeName?: string;
    workspace?: string;
    href?: string;
};

type GlobalSearchResponse = {
    data: SearchResult[];
};

type HeaderNotificationItem = {
    id: string;
    category: string;
    title: string;
    description: string;
    meta: string;
    tone: 'danger' | 'warning' | 'info' | 'success' | string;
    href: string;
    count: number;
    fingerprint: string;
    isRead: boolean;
};

type HeaderNotificationResponse = {
    data: HeaderNotificationItem[];
    totalCount: number;
    activeCount: number;
    unreadCount: number;
    aggregateCount: number;
    generatedAt: string;
};

export type HeaderCrumb = {
    label: string;
    workspace?: string;
    routeName?: string;
    href?: string;
};

export function HeaderActions({ children }: PropsWithChildren) {
    const items = Children.toArray(children);
    if (items.length === 0) return null;

    return (
        <div
            data-pd-page-actions="true"
            className="mb-4 flex w-full flex-wrap items-center justify-end gap-2 [&>a]:!h-9 [&>a]:!whitespace-nowrap [&>a]:!px-3 [&>a]:!text-xs [&>button]:!h-9 [&>button]:!whitespace-nowrap [&>button]:!px-3 [&>button]:!text-xs"
        >
            {items}
        </div>
    );
}

type HeaderSelectOption = {
    value: string;
    label: string;
    disabled: boolean;
};

type HeaderFilterControl = {
    key: string;
    label: string;
    kind: 'select' | 'input' | 'date-range' | 'action';
    value?: unknown;
    defaultValue?: unknown;
    disabled?: boolean;
    options?: HeaderSelectOption[];
    inputType?: string;
    placeholder?: string;
    apply?: (value: unknown) => void;
    action?: () => void;
    actionLabel?: string;
};

type HeaderFilterGroup = {
    id: string;
    controls: HeaderFilterControl[];
    onApply?: (values: Record<string, unknown>) => void;
    onReset?: () => void;
    active?: boolean;
};

type HeaderFilterRegistryContextValue = {
    registerFilterGroup: (group: HeaderFilterGroup) => () => void;
};

const HeaderFilterRegistryContext = createContext<HeaderFilterRegistryContextValue | null>(null);

function headerFilterText(node: ReactNode): string {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(headerFilterText).join(' ').replace(/\s+/g, ' ').trim();
    if (isValidElement(node)) {
        const props = node.props as { children?: ReactNode };
        return headerFilterText(props.children);
    }
    return '';
}

function cleanHeaderFilterLabel(value: unknown, fallback = 'Filter'): string {
    const label = String(value ?? '')
        .replace(/^filter by\s+/i, '')
        .replace(/\s+dropdown$/i, '')
        .trim();
    return label || fallback;
}

function collectHeaderSelectOptions(children: ReactNode): HeaderSelectOption[] {
    const options: HeaderSelectOption[] = [];

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;

        if (child.type === 'option') {
            const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
            const label = headerFilterText(props.children);
            options.push({
                value: String(props.value ?? label),
                label,
                disabled: Boolean(props.disabled),
            });
            return;
        }

        if (child.type === 'optgroup') {
            const props = child.props as { children?: ReactNode };
            options.push(...collectHeaderSelectOptions(props.children));
        }
    });

    return options;
}

function collectHeaderFilterControls(children: ReactNode): HeaderFilterControl[] {
    const controls: HeaderFilterControl[] = [];

    const visit = (node: ReactNode, path: string) => {
        Children.forEach(node, (child, index) => {
            if (!isValidElement(child)) return;

            const props = child.props as Record<string, any>;
            const key = `${path}-${String(child.key ?? index)}`;

            if (child.type === 'select' || child.type === SystemSelect) {
                const options = collectHeaderSelectOptions(props.children);
                const value = String(props.value ?? props.defaultValue ?? options[0]?.value ?? '');
                const label = cleanHeaderFilterLabel(props.menuLabel ?? props['aria-label'] ?? props.title, 'Filter');
                controls.push({
                    key,
                    label,
                    kind: 'select',
                    value,
                    defaultValue: options[0]?.value ?? '',
                    disabled: Boolean(props.disabled),
                    options,
                    apply: (nextValue) => {
                        if (typeof props.onChange !== 'function') return;
                        props.onChange({
                            target: { value: String(nextValue) },
                            currentTarget: { value: String(nextValue) },
                        });
                    },
                });
                return;
            }

            if (child.type === 'input') {
                const inputType = String(props.type ?? 'text');
                if (inputType === 'hidden') return;
                controls.push({
                    key,
                    label: cleanHeaderFilterLabel(props['aria-label'] ?? props.placeholder, inputType === 'date' ? 'Date' : 'Search'),
                    kind: 'input',
                    value: props.value ?? '',
                    defaultValue: '',
                    disabled: Boolean(props.disabled),
                    inputType,
                    placeholder: props.placeholder,
                    apply: (nextValue) => {
                        if (typeof props.onChange !== 'function') return;
                        props.onChange({
                            target: { value: String(nextValue) },
                            currentTarget: { value: String(nextValue) },
                        });
                    },
                });
                return;
            }

            if (
                props.value &&
                typeof props.value === 'object' &&
                'preset' in props.value &&
                typeof props.onChange === 'function'
            ) {
                controls.push({
                    key,
                    label: cleanHeaderFilterLabel(props.label ?? props['aria-label'], 'Date range'),
                    kind: 'date-range',
                    value: props.value,
                    defaultValue: { preset: 'all', from: '', to: '' },
                    disabled: Boolean(props.disabled),
                    apply: (nextValue) => props.onChange(nextValue),
                });
                return;
            }

            if (child.type === 'button') {
                // Operational actions never belong inside the global filter tray.
                // Page-level actions stay in the page content through HeaderActions.
                return;
            }

            if (props.children !== undefined) visit(props.children, key);
        });
    };

    visit(children, 'filter');
    return controls;
}

function headerFilterIsActive(control: HeaderFilterControl): boolean {
    if (control.kind === 'action') return true;
    if (control.kind === 'date-range') {
        const value = control.value as { preset?: string; from?: string; to?: string } | undefined;
        return Boolean(value && (value.preset !== 'all' || value.from || value.to));
    }
    return String(control.value ?? '') !== String(control.defaultValue ?? '');
}

const FILTER_DATE_PRESETS = [
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '180d', label: 'Last 180 days' },
    { value: '1y', label: 'Last 12 months' },
    { value: 'ytd', label: 'Year to date' },
    { value: 'all', label: 'All dates' },
    { value: 'custom', label: 'Custom date' },
] as const;

type AggregatedHeaderFilterControl = HeaderFilterControl & {
    groupId: string;
};

export function HeaderFilters({
    children,
    onApply,
    onReset,
    active,
}: PropsWithChildren<{
    onApply?: (values: Record<string, unknown>) => void;
    onReset?: () => void;
    active?: boolean;
}>) {
    const registry = useContext(HeaderFilterRegistryContext);
    const reactId = useId();
    const id = useMemo(() => `header-filter-${reactId.replace(/[:]/g, '')}`, [reactId]);
    const controls = useMemo(() => collectHeaderFilterControls(children), [children]);

    useEffect(() => {
        if (!registry || controls.length === 0) return;
        return registry.registerFilterGroup({ id, controls, onApply, onReset, active });
    }, [active, controls, id, onApply, onReset, registry]);

    return null;
}

function HeaderFilterHub({ groups }: { groups: HeaderFilterGroup[] }) {
    const controls = useMemo<AggregatedHeaderFilterControl[]>(() =>
        groups.flatMap((group) =>
            group.controls.map((control) => ({
                ...control,
                key: `${group.id}:${control.key}`,
                groupId: group.id,
            })),
        ), [groups]);
    const [open, setOpen] = useState(false);
    const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});
    const [trayPlacement, setTrayPlacement] = useState({ left: 0, top: 72, width: 0, maxHeight: 560 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const directlyActiveCount = controls.filter(headerFilterIsActive).length;
    const extraActiveGroupCount = groups.filter(
        (group) => group.active && !group.controls.some(headerFilterIsActive),
    ).length;
    const activeCount = directlyActiveCount + extraActiveGroupCount;

    const beginFiltering = () => {
        if (open) {
            setOpen(false);
            return;
        }
        setDraftValues(Object.fromEntries(controls.map((control) => [control.key, control.value ?? control.defaultValue ?? ''])));
        setOpen(true);
    };

    useLayoutEffect(() => {
        if (!open || typeof window === 'undefined') return;

        const updatePlacement = () => {
            const header = document.querySelector('[data-pd-app-header="true"]');
            const sidebar = document.querySelector('[data-pd-sidebar="true"]');
            const headerRect = header instanceof HTMLElement ? header.getBoundingClientRect() : null;
            const sidebarRect = sidebar instanceof HTMLElement ? sidebar.getBoundingClientRect() : null;
            const desktopSidebarVisible = window.innerWidth >= 1024 && sidebarRect && sidebarRect.right > 0;
            const left = desktopSidebarVisible ? Math.max(0, sidebarRect.right) : 0;
            const top = Math.max(0, headerRect?.bottom ?? buttonRef.current?.getBoundingClientRect().bottom ?? 72);
            const width = Math.max(320, window.innerWidth - left);
            const maxHeight = Math.max(260, Math.min(690, window.innerHeight - top - 10));
            setTrayPlacement({ left, top, width, maxHeight });
        };

        updatePlacement();
        window.addEventListener('resize', updatePlacement);
        window.addEventListener('scroll', updatePlacement, true);
        return () => {
            window.removeEventListener('resize', updatePlacement);
            window.removeEventListener('scroll', updatePlacement, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = (event: PointerEvent) => {
            const target = event.target as Node;
            if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    if (controls.length === 0) return null;

    const updateDraft = (control: AggregatedHeaderFilterControl, value: unknown) => {
        setDraftValues((current) => ({ ...current, [control.key]: value }));
    };

    const clearDraft = () => {
        setDraftValues(Object.fromEntries(controls.map((control) => [control.key, control.defaultValue ?? ''])));
    };

    const notifyGroups = (valuesByGroup: Map<string, Record<string, unknown>>) => {
        groups.forEach((group) => group.onApply?.(valuesByGroup.get(group.id) ?? {}));
    };

    const applyFilters = () => {
        const valuesByGroup = new Map<string, Record<string, unknown>>();
        controls.forEach((control) => {
            const nextValue = draftValues[control.key] ?? control.defaultValue ?? '';
            const values = valuesByGroup.get(control.groupId) ?? {};
            values[control.label] = nextValue;
            valuesByGroup.set(control.groupId, values);
            if (JSON.stringify(nextValue) !== JSON.stringify(control.value)) control.apply?.(nextValue);
        });
        notifyGroups(valuesByGroup);
        setOpen(false);
    };

    const resetAppliedFilters = () => {
        const valuesByGroup = new Map<string, Record<string, unknown>>();
        controls.forEach((control) => {
            const nextValue = control.defaultValue ?? '';
            const values = valuesByGroup.get(control.groupId) ?? {};
            values[control.label] = nextValue;
            valuesByGroup.set(control.groupId, values);
            if (JSON.stringify(nextValue) !== JSON.stringify(control.value)) control.apply?.(nextValue);
        });
        groups.forEach((group) => group.onReset?.());
        notifyGroups(valuesByGroup);
        setDraftValues(Object.fromEntries(controls.map((control) => [control.key, control.defaultValue ?? ''])));
        setOpen(false);
    };

    const pendingActiveCount = controls.filter((control) => {
        const next = draftValues[control.key] ?? control.defaultValue;
        if (control.kind === 'date-range') {
            const value = next as { preset?: string; from?: string; to?: string } | undefined;
            return Boolean(value && (value.preset !== 'all' || value.from || value.to));
        }
        return String(next ?? '') !== String(control.defaultValue ?? '');
    }).length;

    const utilityIconButtonClass = 'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]/30';

    return (
        <div data-pd-header-filters className="flex items-center gap-0.5">
            {activeCount > 0 && (
                <button
                    type="button"
                    onClick={resetAppliedFilters}
                    aria-label="Reset filters"
                    title="Reset filters"
                    className={`${utilityIconButtonClass} text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
                >
                    <RotateCcw className="h-5 w-5" />
                </button>
            )}

            <button
                ref={buttonRef}
                type="button"
                onClick={beginFiltering}
                aria-label="Filters"
                title={activeCount > 0 ? `${activeCount} active filter${activeCount === 1 ? '' : 's'}` : 'Filters'}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`${utilityIconButtonClass} ${
                    open || activeCount > 0
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
                <SlidersHorizontal className="h-5 w-5" />
                {activeCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F4B400] px-1 text-[9px] font-extrabold leading-none text-slate-950 ring-2 ring-white">
                        {activeCount > 9 ? '9+' : activeCount}
                    </span>
                )}
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label="Filters"
                    data-pd-filter-tray="true"
                    className="pd-theme-portal fixed z-[45] flex flex-col overflow-hidden border-y border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] lg:rounded-b-2xl"
                    style={{
                        left: trayPlacement.left,
                        top: trayPlacement.top,
                        width: trayPlacement.width,
                        maxHeight: trayPlacement.maxHeight,
                    }}
                >
                    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3 sm:px-6 lg:px-7">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                                <SlidersHorizontal className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                                <h2 className="text-sm font-extrabold text-slate-950">Filters</h2>
                                <p className="truncate text-[11px] text-slate-500">Choose the filters you need, then apply them together.</p>
                            </div>
                        </div>
                        {pendingActiveCount > 0 && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                                {pendingActiveCount} selected
                            </span>
                        )}
                    </div>

                    <div className="system-dropdown-scroll min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-5 lg:p-6">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {controls.map((control) => {
                                if (control.kind === 'input') {
                                    const value = String(draftValues[control.key] ?? control.value ?? '');
                                    return (
                                        <section key={control.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                            <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">{control.label}</p>
                                            <input
                                                type={control.inputType || 'text'}
                                                value={value}
                                                placeholder={control.placeholder}
                                                disabled={control.disabled}
                                                onChange={(event) => updateDraft(control, event.target.value)}
                                                className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#F4B400] focus:ring-2 focus:ring-[#F4B400]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                            />
                                        </section>
                                    );
                                }

                                if (control.kind === 'date-range') {
                                    const value = (draftValues[control.key] ?? control.value ?? { preset: 'all', from: '', to: '' }) as { preset: string; from: string; to: string };
                                    return (
                                        <section key={control.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                            <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">{control.label}</p>
                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                {FILTER_DATE_PRESETS.map((option) => {
                                                    const selected = value.preset === option.value;
                                                    return (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => updateDraft(control, { ...value, preset: option.value })}
                                                            className={`flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition ${selected ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                                        >
                                                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-[#F4B400] bg-[#F4B400] text-slate-950' : 'border-slate-300 bg-white text-transparent'}`}>
                                                                <Check className="h-3 w-3" />
                                                            </span>
                                                            <span>{option.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {value.preset === 'custom' && (
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                        From
                                                        <input type="date" value={value.from ?? ''} max={value.to || undefined} onChange={(event) => updateDraft(control, { ...value, from: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#F4B400]" />
                                                    </label>
                                                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                        To
                                                        <input type="date" value={value.to ?? ''} min={value.from || undefined} onChange={(event) => updateDraft(control, { ...value, to: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#F4B400]" />
                                                    </label>
                                                </div>
                                            )}
                                        </section>
                                    );
                                }

                                const options = control.options ?? [];
                                const draft = String(draftValues[control.key] ?? control.value ?? '');
                                return (
                                    <section key={control.key} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">{control.label}</p>
                                            {control.disabled && <span className="text-[9px] font-bold uppercase tracking-wide text-slate-300">Unavailable</span>}
                                        </div>
                                        <div className="system-dropdown-scroll mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
                                            {options.map((option) => {
                                                const selected = draft === option.value;
                                                return (
                                                    <button
                                                        key={`${control.key}:${option.value}`}
                                                        type="button"
                                                        disabled={control.disabled || option.disabled}
                                                        onClick={() => updateDraft(control, option.value)}
                                                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${selected ? 'bg-amber-50 font-bold text-amber-900' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'} disabled:cursor-not-allowed disabled:opacity-40`}
                                                    >
                                                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-[#F4B400] bg-[#F4B400] text-slate-950' : 'border-slate-300 bg-white text-transparent'}`}>
                                                            <Check className="h-3 w-3" />
                                                        </span>
                                                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-6 lg:px-7">
                        <button
                            type="button"
                            onClick={clearDraft}
                            disabled={pendingActiveCount === 0}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Clear All
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyFilters}
                                className="h-9 rounded-lg bg-[#F4B400] px-4 text-xs font-extrabold text-slate-950 transition hover:bg-[#dca300]"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

function HeaderOverflowPan({
    children,
    className = '',
}: PropsWithChildren<{ className?: string }>) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [overflowDistance, setOverflowDistance] = useState(0);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content) return;

        const measure = () => {
            const distance = Math.max(0, content.scrollWidth - viewport.clientWidth);
            setOverflowDistance((current) => Math.abs(current - distance) > 1 ? distance : current);
        };

        measure();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        observer?.observe(viewport);
        observer?.observe(content);
        window.addEventListener('resize', measure);

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;

        for (const animation of content.getAnimations()) animation.cancel();
        content.style.transform = 'translateX(0)';

        if (overflowDistance <= 2) return;

        const animation = content.animate(
            [
                { transform: 'translateX(0)', offset: 0 },
                { transform: 'translateX(0)', offset: 0.16 },
                { transform: `translateX(-${overflowDistance}px)`, offset: 0.5 },
                { transform: `translateX(-${overflowDistance}px)`, offset: 0.66 },
                { transform: 'translateX(0)', offset: 1 },
            ],
            {
                duration: Math.max(5600, Math.min(9000, 5600 + overflowDistance * 14)),
                easing: 'ease-in-out',
                iterations: Infinity,
            },
        );

        return () => animation.cancel();
    }, [overflowDistance]);

    const overflowing = overflowDistance > 2;

    return (
        <div ref={viewportRef} className={`relative min-w-0 overflow-hidden ${className}`}>
            <div ref={contentRef} className="w-max max-w-none whitespace-nowrap will-change-transform">
                {children}
            </div>
            {overflowing && (
                <>
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-white via-white/85 to-transparent backdrop-blur-[1px]" />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-white via-white/85 to-transparent backdrop-blur-[1px]" />
                </>
            )}
        </div>
    );
}

const performanceChildren: NavChild[] = [
    { label: 'Overview', workspace: 'Overview' },
    { label: 'Review Governance', workspace: 'Review Governance' },
    { label: 'Reviews', workspace: 'Reviews' },
    { label: 'Improvement Plans', workspace: 'Performance Improvement' },
    { label: 'Analytics', workspace: 'Analytics' },
];

const learningChildren: NavChild[] = [
    { label: 'Overview', workspace: 'Overview' },
    { label: 'Courses', workspace: 'Courses' },
    { label: 'Assignments', workspace: 'Assignments' },
    { label: 'Learning Records', workspace: 'Learning Records' },
    { label: 'Analytics', workspace: 'Analytics' },
];

const competencyChildren: NavChild[] = [
    { label: 'Overview', workspace: 'Overview' },
    { label: 'People', workspace: 'People' },
    { label: 'Competency Framework', workspace: 'Competency Framework' },
    { label: 'Assessments', workspace: 'Assessments' },
    { label: 'Development', workspace: 'Development' },
    { label: 'Analytics', workspace: 'Analytics' },
];

const adminNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutGrid, routeName: 'admin.dashboard' },
    {
        label: 'Users',
        icon: Users,
        routeName: 'admin.users.index',
        children: [
            { label: 'All Users', workspace: 'All Users' },
            { label: 'Incoming Trainees', workspace: 'Incoming Trainees' },
            { label: 'Account Issues', workspace: 'Account Issues' },
        ],
    },
    { label: 'Performance', icon: TrendingUp, routeName: 'admin.performance.index', children: performanceChildren },
    { label: 'Competency', icon: Settings2, routeName: 'admin.competency.index', children: competencyChildren },
    { label: 'Learning', icon: GraduationCap, routeName: 'admin.learning.index', children: learningChildren },
    {
        label: 'Training',
        icon: BookOpen,
        routeName: 'admin.training.index',
        children: [
            { label: 'Overview', workspace: 'Overview' },
            { label: 'Training Register', workspace: 'Training Register' },
            { label: 'Training Records', workspace: 'Training Records' },
        ],
    },
    {
        label: 'Succession',
        icon: Network,
        routeName: 'admin.succession.index',
        children: [
            { label: 'Overview', workspace: 'Overview' },
            { label: 'Succession Register', workspace: 'Succession Register' },
            { label: 'Readiness Reviews', workspace: 'Readiness Reviews' },
        ],
    },
    {
        label: 'Recognition',
        icon: Award,
        routeName: 'admin.recognition.index',
        children: [
            { label: 'Overview', workspace: 'Overview' },
            { label: 'Review Queue', workspace: 'Review Queue' },
            { label: 'Recognition Register', workspace: 'Recognition Register' },
        ],
    },
    { label: 'Reports', icon: FileText, routeName: 'admin.reports.index' },
    { label: 'Settings', icon: Settings, routeName: 'admin.settings.index' },
];

const hrNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutGrid, routeName: 'hr.dashboard' },
    {
        label: 'Users',
        icon: Users,
        routeName: 'hr.users.index',
        children: [
            { label: 'All Users', workspace: 'All Users' },
            { label: 'Incoming Trainees', workspace: 'Incoming Trainees' },
            { label: 'Account Issues', workspace: 'Account Issues' },
        ],
    },
    { label: 'Performance', icon: TrendingUp, routeName: 'hr.performance.index', children: performanceChildren },
    { label: 'Competency', icon: Settings2, routeName: 'hr.competency.index', children: competencyChildren },
    { label: 'Learning', icon: GraduationCap, routeName: 'hr.learning.index', children: learningChildren },
    {
        label: 'Training',
        icon: BookOpen,
        routeName: 'hr.training.index',
        children: [
            { label: 'Overview', workspace: 'Overview' },
            { label: 'Training Register', workspace: 'Training Register' },
            { label: 'Training Records', workspace: 'Training Records' },
        ],
    },
    {
        label: 'Succession',
        icon: Network,
        routeName: 'hr.succession.index',
        children: [
            { label: 'Overview', workspace: 'Overview' },
            { label: 'Succession Register', workspace: 'Succession Register' },
            { label: 'Readiness Reviews', workspace: 'Readiness Reviews' },
        ],
    },
    {
        label: 'Recognition',
        icon: Award,
        routeName: 'hr.recognition.index',
        children: [
            { label: 'Overview', workspace: 'Overview' },
            { label: 'Review Queue', workspace: 'Review Queue' },
            { label: 'Recognition Register', workspace: 'Recognition Register' },
        ],
    },
    { label: 'Reports', icon: FileText, routeName: 'hr.reports.index' },
    { label: 'Settings', icon: Settings, routeName: 'hr.settings.index' },
];

const learnerBaseNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutGrid, routeName: 'user.dashboard' },
    {
        label: 'My Learning',
        icon: GraduationCap,
        routeName: 'user.learning.index',
        children: [
            { label: 'My Courses', workspace: 'My Courses' },
            { label: 'Assigned Learning', workspace: 'Assigned Learning' },
            { label: 'Recommended Learning', workspace: 'Recommended Learning' },
            { label: 'Learning Progress', workspace: 'Learning Progress' },
            { label: 'Course Catalog', workspace: 'Course Catalog' },
        ],
    },
    {
        label: 'Assessments',
        icon: ClipboardCheck,
        routeName: 'user.assessments.index',
        children: [
            { label: 'My Assessments', workspace: 'My Assessments' },
            { label: 'Results', workspace: 'Results' },
        ],
    },
    {
        label: 'Training',
        icon: BookOpen,
        routeName: 'user.training.index',
        children: [
            { label: 'Schedule', workspace: 'Schedule' },
            { label: 'Attendance', workspace: 'Attendance' },
            { label: 'Training Requests', workspace: 'Training Requests' },
        ],
    },
    {
        label: 'Development',
        icon: Wallet,
        routeName: 'user.development.index',
        children: [
            { label: 'Competency Progress', workspace: 'Competency Progress' },
            { label: 'Skill Gaps', workspace: 'Skill Gaps' },
            { label: 'Learning History', workspace: 'Learning History' },
        ],
    },
    {
        label: 'Certificates',
        icon: Award,
        routeName: 'user.certificates.index',
        children: [
            { label: 'Certificates', workspace: 'Certificates' },
            { label: 'Achievements', workspace: 'Achievements' },
        ],
    },
    {
        label: 'My Profile',
        icon: UserRound,
        routeName: 'user.profile.index',
        children: [
            { label: 'Employee Info', workspace: 'Employee Info' },
            { label: 'Notifications', workspace: 'Notifications' },
        ],
    },
];

const employeePerformanceNav: NavItem = {
    label: 'Performance',
    icon: TrendingUp,
    routeName: 'user.performance.index',
    children: [{ label: 'My Performance', workspace: 'My Performance' }],
};

const teamPerformanceNav: NavItem = {
    label: 'Performance',
    icon: TrendingUp,
    routeName: 'user.performance.index',
    children: [
        { label: 'My Performance', workspace: 'My Performance' },
        { label: 'My Team Reviews', workspace: 'My Team Reviews' },
        { label: 'Leadership Feedback', workspace: 'Leadership Feedback' },
    ],
};

const recognitionNav: NavItem = {
    label: 'Recognition',
    icon: Award,
    routeName: 'user.leaderboard.index',
};

const traineeNavItems: NavItem[] = learnerBaseNavItems.map((item) => {
    if (item.routeName === 'user.profile.index') {
        return { ...item, children: undefined };
    }

    if (item.routeName === 'user.training.index') {
        const children = item.children ?? [];
        return {
            ...item,
            children: [
                ...children.slice(0, 2),
                { label: 'Trainer Evaluations', workspace: 'Trainer Evaluations' },
                ...children.slice(2),
            ],
        };
    }

    return item;
});
const employeeNavItems: NavItem[] = [...learnerBaseNavItems, employeePerformanceNav, recognitionNav];
const supervisorNavItems: NavItem[] = [...learnerBaseNavItems, teamPerformanceNav, recognitionNav];
const managerNavItems: NavItem[] = [...learnerBaseNavItems, teamPerformanceNav, recognitionNav];

function resolveNavItems(role: unknown, persona?: unknown): NavItem[] {
    const normalizedRole: AppUserRole =
        role === 'admin' || role === 'hr' || role === 'user' ? role : 'user';

    if (normalizedRole === 'admin') return adminNavItems;
    if (normalizedRole === 'hr') return hrNavItems;

    const normalizedPersona: UserPersona =
        persona === 'trainee' || persona === 'employee' || persona === 'supervisor' || persona === 'manager'
            ? persona
            : 'employee';

    if (normalizedPersona === 'trainee') return traineeNavItems;
    if (normalizedPersona === 'supervisor') return supervisorNavItems;
    if (normalizedPersona === 'manager') return managerNavItems;
    return employeeNavItems;
}

function isNavItemActive(routeName: string): boolean {
    if (!route().has(routeName)) return false;
    const routePrefix = routeName.replace(/\.index$/, '');
    return Boolean(
        route().current(routeName) ||
        route().current(`${routePrefix}.*`) ||
        route().current(`${routePrefix}.index`),
    );
}

function resolveNavHref(routeName: string, workspace?: string): string {
    if (!route().has(routeName)) return '#';
    const base = route(routeName);
    return workspace ? `${base}${encodeWorkspaceHash(workspace)}` : base;
}

function readHash(): string {
    if (typeof window === 'undefined') return '';
    return decodeURIComponent(window.location.hash.replace(/^#/, ''));
}

function roleLabel(role: unknown, persona?: unknown): string {
    if (role === 'admin') return 'Admin';
    if (role === 'hr') return 'HR';
    if (persona === 'trainee') return 'Trainee';
    if (persona === 'supervisor') return 'Supervisor';
    if (persona === 'manager') return 'Manager';
    return 'Employee';
}


function greetingForTime(value: Date, timeZone: string): string {
    const hourText = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
    }).format(value);
    const hour = Number.parseInt(hourText, 10);

    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
}

function formatScreenTime(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
    if (minutes > 0) return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    return `${String(seconds).padStart(2, '0')}s`;
}

function browserTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';
}


function safeTimeZone(value: string | null | undefined): string {
    const candidate = value || browserTimeZone();
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format(new Date());
        return candidate;
    } catch {
        return browserTimeZone();
    }
}

function storedCompetencyResults(query: string, navItems: NavItem[]): SearchResult[] {
    if (typeof window === 'undefined' || query.trim().length < 2) return [];

    const competencyModule = navItems.find((item) => item.routeName.includes('competency'));
    if (!competencyModule || !route().has(competencyModule.routeName)) return [];

    const raw = window.localStorage.getItem('alibaton.competency.frontend.v1');
    if (!raw) return [];

    try {
        const state = JSON.parse(raw) as {
            competencies?: Array<{ id?: string; code?: string; name?: string; category?: string; definition?: string; status?: string }>;
            roleProfiles?: Array<{ id?: string; name?: string; position?: string; department?: string; appliesTo?: string; status?: string }>;
            cycles?: Array<{ id?: string; name?: string; type?: string; status?: string }>;
            assessments?: Array<{ id?: string; personId?: string; status?: string; assessmentType?: string }>;
            recommendations?: Array<{ id?: string; title?: string; note?: string; status?: string }>;
        };
        const needle = query.trim().toLowerCase();
        const matches = (values: unknown[]) => values.filter(Boolean).join(' ').toLowerCase().includes(needle);
        const results: SearchResult[] = [];
        const add = (result: SearchResult) => { if (results.length < 8) results.push(result); };

        for (const competency of state.competencies ?? []) {
            if (!matches([competency.code, competency.name, competency.category, competency.definition, competency.status])) continue;
            add({
                key: `competency:${competency.id ?? competency.code ?? competency.name}`,
                label: [competency.code, competency.name].filter(Boolean).join(' — '),
                module: 'Competency Framework',
                group: 'Competency',
                description: [competency.category, competency.status].filter(Boolean).join(' · '),
                routeName: competencyModule.routeName,
                workspace: competencyModule.children?.some((child) => child.workspace === 'Competency Framework') ? 'Competency Framework' : undefined,
            });
        }

        for (const profile of state.roleProfiles ?? []) {
            if (!matches([profile.name, profile.position, profile.department, profile.appliesTo, profile.status])) continue;
            add({
                key: `competency-profile:${profile.id ?? profile.name}`,
                label: profile.name ?? 'Role Profile',
                module: 'Competency Framework',
                group: 'Competency',
                description: [profile.position, profile.department, profile.status].filter(Boolean).join(' · '),
                routeName: competencyModule.routeName,
                workspace: competencyModule.children?.some((child) => child.workspace === 'Competency Framework') ? 'Competency Framework' : undefined,
            });
        }

        for (const cycle of state.cycles ?? []) {
            if (!matches([cycle.name, cycle.type, cycle.status])) continue;
            add({
                key: `competency-cycle:${cycle.id ?? cycle.name}`,
                label: cycle.name ?? 'Assessment Cycle',
                module: 'Assessments',
                group: 'Competency',
                description: [cycle.type, cycle.status].filter(Boolean).join(' · '),
                routeName: competencyModule.routeName,
                workspace: competencyModule.children?.some((child) => child.workspace === 'Assessments') ? 'Assessments' : undefined,
            });
        }

        for (const recommendation of state.recommendations ?? []) {
            if (!matches([recommendation.title, recommendation.note, recommendation.status])) continue;
            add({
                key: `competency-development:${recommendation.id ?? recommendation.title}`,
                label: recommendation.title ?? 'Development Recommendation',
                module: 'Development',
                group: 'Competency',
                description: recommendation.status ?? '',
                routeName: competencyModule.routeName,
                workspace: competencyModule.children?.some((child) => child.workspace === 'Development') ? 'Development' : undefined,
            });
        }

        return results;
    } catch {
        return [];
    }
}

function HeaderFloatingPanel({
    open,
    anchorRef,
    panelRef,
    width,
    align = 'right',
    offset = 8,
    estimatedHeight = 320,
    className = '',
    children,
    onMouseEnter,
    onMouseLeave,
    respectSidebar = false,
}: PropsWithChildren<{
    open: boolean;
    anchorRef: RefObject<HTMLElement | null>;
    panelRef: RefObject<HTMLDivElement | null>;
    width?: number | 'anchor';
    align?: 'left' | 'right';
    offset?: number;
    estimatedHeight?: number;
    className?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    respectSidebar?: boolean;
}>) {
    const [placement, setPlacement] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number }>({
        left: 12,
        top: 12,
        width: typeof width === 'number' ? width : 240,
        maxHeight: estimatedHeight,
    });

    useLayoutEffect(() => {
        if (!open || typeof window === 'undefined') return;
        const update = () => {
            const anchor = anchorRef.current;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            const sidebar = respectSidebar ? document.querySelector('[data-pd-sidebar="true"]') : null;
            const sidebarRect = sidebar instanceof HTMLElement ? sidebar.getBoundingClientRect() : null;
            const sidebarBoundary = sidebarRect && sidebarRect.right > 0 && sidebarRect.left <= 0
                ? sidebarRect.right + 12
                : 12;
            const availableWidth = Math.max(280, window.innerWidth - sidebarBoundary - 12);
            const panelWidth = Math.min(
                width === 'anchor' || width === undefined ? rect.width : width,
                availableWidth,
            );
            const rawLeft = align === 'right' ? rect.right - panelWidth : rect.left;
            const left = Math.min(
                Math.max(sidebarBoundary, rawLeft),
                Math.max(sidebarBoundary, window.innerWidth - panelWidth - 12),
            );
            const below = window.innerHeight - rect.bottom - offset - 12;
            const above = rect.top - offset - 12;
            const openAbove = below < Math.min(estimatedHeight, 180) && above > below;
            const maxHeight = Math.max(120, Math.min(estimatedHeight, openAbove ? above : below));
            setPlacement(openAbove
                ? { left, bottom: window.innerHeight - rect.top + offset, width: panelWidth, maxHeight }
                : { left, top: rect.bottom + offset, width: panelWidth, maxHeight });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [align, anchorRef, estimatedHeight, offset, open, respectSidebar, width]);

    if (!open || typeof document === 'undefined') return null;
    return createPortal(
        <div
            ref={panelRef}
            className={`app-floating-panel fixed overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 ${className}`}
            style={{
                zIndex: 2147483000,
                left: placement.left,
                top: placement.top,
                bottom: placement.bottom,
                width: placement.width,
                maxHeight: placement.maxHeight,
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {children}
        </div>,
        document.body,
    );
}

function notificationToneStyle(tone: HeaderNotificationItem['tone']) {
    if (tone === 'danger') return {
        dot: 'bg-rose-500',
        soft: 'border-rose-200 bg-rose-50 text-rose-700',
        label: 'High priority',
    };
    if (tone === 'warning') return {
        dot: 'bg-amber-500',
        soft: 'border-amber-200 bg-amber-50 text-amber-800',
        label: 'Attention',
    };
    if (tone === 'success') return {
        dot: 'bg-emerald-500',
        soft: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        label: 'Update',
    };
    return {
        dot: 'bg-sky-500',
        soft: 'border-sky-200 bg-sky-50 text-sky-700',
        label: 'Information',
    };
}

function NotificationCenterModal({
    open,
    items,
    selectedId,
    unreadCount,
    activeCount,
    loading,
    error,
    generatedAt,
    onClose,
    onSelect,
    onOpenWorkspace,
    onMarkAllRead,
    onRefresh,
}: {
    open: boolean;
    items: HeaderNotificationItem[];
    selectedId: string | null;
    unreadCount: number;
    activeCount: number;
    loading: boolean;
    error: string;
    generatedAt: string | null;
    onClose: () => void;
    onSelect: (item: HeaderNotificationItem) => void;
    onOpenWorkspace: (item: HeaderNotificationItem) => void;
    onMarkAllRead: () => void;
    onRefresh: () => void;
}) {
    const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

    useEffect(() => {
        if (!open || typeof document === 'undefined') return;
        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, open]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="notification-center-backdrop fixed inset-0 z-[2147483200] flex items-center justify-center p-3 sm:p-6" role="presentation">
            <button
                type="button"
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
                aria-label="Close notification center"
                onClick={onClose}
            />
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Notification center"
                className="notification-center-panel pd-theme-portal relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-extrabold text-slate-950">Notification Center</h2>
                            {unreadCount > 0 && (
                                <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-extrabold text-rose-700">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            {activeCount} active alert{activeCount === 1 ? '' : 's'} from current system records.
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={onMarkAllRead}
                                className="app-button h-9 px-3 text-xs"
                            >
                                <CheckCheck className="h-4 w-4" />
                                <span className="hidden sm:inline">Mark all read</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={loading}
                            className="app-button h-9 w-9 p-0"
                            title="Refresh notifications"
                            aria-label="Refresh notifications"
                        >
                            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="app-button h-9 w-9 p-0"
                            aria-label="Close notification center"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="min-h-0 overflow-y-auto border-b border-slate-200 p-2 md:border-b-0 md:border-r">
                        {loading && items.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm font-semibold text-slate-500">
                                <LoaderCircle className="h-5 w-5 animate-spin" />
                                Loading notifications…
                            </div>
                        ) : items.length ? (
                            <div className="space-y-1">
                                {items.map((item) => {
                                    const tone = notificationToneStyle(item.tone);
                                    const selectedItem = selected?.id === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => onSelect(item)}
                                            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${selectedItem
                                                ? 'border-amber-200 bg-amber-50/70'
                                                : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-start justify-between gap-2">
                                                    <span className={`block text-sm font-bold ${item.isRead ? 'text-slate-700' : 'text-slate-950'}`}>
                                                        {item.title}
                                                    </span>
                                                    {!item.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#F4B400]" title="Unread" />}
                                                </span>
                                                <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                                                <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{item.meta}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="px-5 py-12 text-center">
                                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                    <Bell className="h-5 w-5" />
                                </div>
                                <p className="mt-3 text-sm font-bold text-slate-800">No active alerts</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Nothing currently requires your attention.</p>
                            </div>
                        )}
                    </div>

                    <div className="min-h-0 overflow-y-auto bg-slate-50/50 p-5 sm:p-6">
                        {selected ? (
                            <div className="mx-auto max-w-xl">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${notificationToneStyle(selected.tone).soft}`}>
                                        <span className={`h-2 w-2 rounded-full ${notificationToneStyle(selected.tone).dot}`} />
                                        {notificationToneStyle(selected.tone).label}
                                    </span>
                                    {selected.isRead ? (
                                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Read</span>
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">Unread</span>
                                    )}
                                </div>
                                <h3 className="mt-4 text-xl font-extrabold leading-tight text-slate-950">{selected.title}</h3>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{selected.description}</p>

                                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Current record count</p>
                                    <div className="mt-2 flex items-end justify-between gap-4">
                                        <div>
                                            <p className="text-2xl font-extrabold text-slate-950">{selected.count}</p>
                                            <p className="mt-1 text-xs text-slate-500">{selected.meta}</p>
                                        </div>
                                        <div className={`h-3 w-3 rounded-full ${notificationToneStyle(selected.tone).dot}`} />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onOpenWorkspace(selected)}
                                    className="app-button app-button-primary mt-5 w-full justify-center"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Open workspace
                                </button>
                            </div>
                        ) : (
                            <div className="flex h-full min-h-64 items-center justify-center text-center">
                                <div>
                                    <Bell className="mx-auto h-7 w-7 text-slate-300" />
                                    <p className="mt-3 text-sm font-bold text-slate-700">Select a notification</p>
                                    <p className="mt-1 text-xs text-slate-400">Choose an alert to see its current system context.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400 sm:px-6">
                    <span>{error || 'Notifications are derived from live system records and enabled alert preferences.'}</span>
                    <span>{generatedAt ? `Refreshed ${new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                </footer>
            </section>
        </div>,
        document.body,
    );
}

/*
 * Aevyn must survive Performance page/layout remounts.
 *
 * This module-level value stays alive for the current SPA runtime,
 * while sessionStorage survives browser refreshes in the same tab.
 */
type AevynDockSide = 'left' | 'right';

let aevynRuntimeOpen =
    typeof window !== 'undefined'
        ? window.sessionStorage.getItem('aevyn:open') === 'true'
        : false;

export default function Authenticated({
    header,
    children,
    breadcrumbDetails = [],
}: PropsWithChildren<{ header?: ReactNode; breadcrumbDetails?: HeaderCrumb[] }>) {
    const page = usePage();
    const user = page.props.auth.user;
    const sessionTimeoutMinutes = Math.max(1, Number(page.props.securitySessionTimeoutMinutes ?? 5));
    const navItems = useMemo(() => resolveNavItems(user.role, user.persona), [user.role, user.persona]);

    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('sidebar_collapsed') === 'true';
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const [aevynOpen, setAevynOpenState] = useState(
        () => aevynRuntimeOpen,
    );
    const [aevynDockSide, setAevynDockSideState] =
        useState<AevynDockSide>(() => {
            if (typeof window === 'undefined') return 'right';

            return window.localStorage.getItem('aevyn:dock-side') === 'left'
                ? 'left'
                : 'right';
        });

    const setAevynDockSide = useCallback(
        (side: AevynDockSide) => {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('aevyn:dock-side', side);
            }

            setAevynDockSideState(side);
        },
        [],
    );

    const setAevynOpen = useCallback(
        (nextOpen: boolean) => {
            /*
             * Persist synchronously BEFORE React/Performance can
             * rerender or remount anything.
             */
            aevynRuntimeOpen = nextOpen;

            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(
                    'aevyn:open',
                    nextOpen ? 'true' : 'false',
                );
            }

            setAevynOpenState(nextOpen);
        },
        [],
    );

    /*
     * Human inactivity timeout.
     *
     * Background notification polling must not count as user activity. The
     * browser records only real interaction events, shares the timestamp
     * across tabs, and signs the account out once the configured idle window
     * is reached. The server still keeps its own audit/fallback timeout.
     */
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
        const activityKey = `pd:last-human-activity:${user.id}`;
        let timingOut = false;
        let lastPersistAt = 0;

        const readLastActivity = () => {
            const value = Number(window.localStorage.getItem(activityKey));
            return Number.isFinite(value) && value > 0 ? value : 0;
        };

        const writeActivity = (force = false) => {
            if (timingOut) return;

            const current = Date.now();
            if (!force && current - lastPersistAt < 1000) return;

            lastPersistAt = current;
            window.localStorage.setItem(activityKey, String(current));
        };

        const signOutForTimeout = () => {
            if (timingOut) return;
            timingOut = true;

            router.post(
                route('logout'),
                { reason: 'timeout' },
                {
                    replace: true,
                    preserveScroll: false,
                    preserveState: false,
                },
            );
        };

        const checkTimeout = () => {
            const lastActivity = readLastActivity();
            if (lastActivity > 0 && Date.now() - lastActivity >= timeoutMs) {
                signOutForTimeout();
                return true;
            }

            return false;
        };

        const existingActivity = readLastActivity();
        if (existingActivity === 0) {
            writeActivity(true);
        } else if (checkTimeout()) {
            return;
        }

        const markActivity = () => writeActivity();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            if (!checkTimeout()) writeActivity(true);
        };
        const handleFocus = () => {
            if (!checkTimeout()) writeActivity(true);
        };

        const activityEvents: Array<keyof WindowEventMap> = [
            'pointerdown',
            'pointermove',
            'keydown',
            'wheel',
            'touchstart',
            'scroll',
        ];

        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, markActivity, { passive: true });
        });
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const timer = window.setInterval(checkTimeout, 1000);

        return () => {
            window.clearInterval(timer);
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, markActivity);
            });
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sessionTimeoutMinutes, user.id]);

    /*
     * One cheap global geometry variable for modal surfaces.
     * No :has(), DOM searching, or full-page recalculation.
     */
    useLayoutEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        document.documentElement.style.setProperty(
            '--aevyn-performance-reserve',
            aevynOpen ? '416px' : '0px',
        );
        document.documentElement.style.setProperty(
            '--aevyn-performance-shift',
            aevynOpen
                ? aevynDockSide === 'left'
                    ? '208px'
                    : '-208px'
                : '0px',
        );
    }, [aevynOpen, aevynDockSide]);

    /*
     * If this layout itself gets recreated by a Performance
     * interaction, restore Aevyn from the runtime source immediately.
     */
    useLayoutEffect(() => {
        if (aevynOpen !== aevynRuntimeOpen) {
            setAevynOpenState(aevynRuntimeOpen);
        }
    }, []);
    const [currentHash, setCurrentHash] = useState(readHash);
    const [expandedModule, setExpandedModule] = useState<string | null>(() =>
        navItems.find((item) => item.children?.length && isNavItemActive(item.routeName))?.routeName ?? null,
    );
    const [collapsedFlyout, setCollapsedFlyout] = useState<{ routeName: string; top: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchActiveIndex, setSearchActiveIndex] = useState(0);
    const [remoteSearchResults, setRemoteSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [themePreference, setThemePreference] = useState<'light' | 'dark'>(() => {
        if (typeof window === 'undefined') return 'light';
        return window.localStorage.getItem('pd_theme_preference') === 'dark' ? 'dark' : 'light';
    });
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const isDark = themePreference === 'dark';
        root.classList.toggle('dark', isDark);
        root.dataset.theme = themePreference;
        root.style.colorScheme = themePreference;
    }, [themePreference]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const syncThemeAcrossTabs = (event: StorageEvent) => {
            if (event.key !== 'pd_theme_preference') return;
            setThemePreference(event.newValue === 'dark' ? 'dark' : 'light');
        };
        window.addEventListener('storage', syncThemeAcrossTabs);
        return () => window.removeEventListener('storage', syncThemeAcrossTabs);
    }, []);
    const [accountOpen, setAccountOpen] = useState(false);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
    const [notificationSelectedId, setNotificationSelectedId] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<HeaderNotificationItem[]>([]);
    const [notificationTotal, setNotificationTotal] = useState(0);
    const [notificationActiveCount, setNotificationActiveCount] = useState(0);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationError, setNotificationError] = useState('');
    const [notificationGeneratedAt, setNotificationGeneratedAt] = useState<string | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [timeZone] = useState(() => {
        if (typeof window === 'undefined') return 'Asia/Manila';
        return safeTimeZone(window.localStorage.getItem('header_timezone'));
    });
    const [headerFilterGroups, setHeaderFilterGroups] = useState<Record<string, HeaderFilterGroup>>({});
    const [sidebarHasMore, setSidebarHasMore] = useState(false);
    const [dashboardMessageIndex, setDashboardMessageIndex] = useState(0);
    const [screenTimeSeconds, setScreenTimeSeconds] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const stored = Number(window.sessionStorage.getItem('pd_screen_time_seconds') ?? '0');
        return Number.isFinite(stored) && stored >= 0 ? Math.floor(stored) : 0;
    });

    const sidebarNavRef = useRef<HTMLElement>(null);
    const sidebarScrollStorageKey = `pd_sidebar_scroll_${user.role}`;
    const collapsedFlyoutRef = useRef<HTMLDivElement>(null);
    const collapsedFlyoutCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchPanelRef = useRef<HTMLDivElement>(null);
    const accountRef = useRef<HTMLDivElement>(null);
    const accountPanelRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const notificationPanelRef = useRef<HTMLDivElement>(null);
    const accountCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notificationCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeModule = useMemo(
        () => navItems.find((item) => isNavItemActive(item.routeName)) ?? null,
        [navItems, page.url],
    );

    const searchableItems = useMemo<SearchResult[]>(() => {
        return navItems.flatMap((item) => {
            if (!route().has(item.routeName)) return [];

            if (item.children?.length) {
                return item.children.map((child) => ({
                    key: `${item.routeName}:${child.workspace}`,
                    label: child.label,
                    module: item.label,
                    group: 'Navigation',
                    description: `${item.label} workspace`,
                    routeName: item.routeName,
                    workspace: child.workspace,
                }));
            }

            return [{
                key: item.routeName,
                label: item.label,
                module: item.label,
                group: 'Navigation',
                description: 'Open module',
                routeName: item.routeName,
            }];
        });
    }, [navItems]);

    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
            const quick: SearchResult[] = [];
            for (const item of navItems) {
                if (!route().has(item.routeName)) continue;
                const firstChild = item.children?.[0];
                quick.push({
                    key: `quick:${item.routeName}`,
                    label: item.label,
                    module: firstChild ? firstChild.label : 'Open page',
                    group: 'Modules',
                    description: firstChild ? `Open ${firstChild.label}` : 'Open page',
                    routeName: item.routeName,
                    workspace: firstChild?.workspace,
                });
                if (quick.length === 7) break;
            }
            return quick;
        }

        const navigationResults = searchableItems.filter((result) =>
            `${result.module} ${result.label} ${result.description ?? ''}`.toLowerCase().includes(query),
        );
        return [...navigationResults, ...remoteSearchResults]
            .filter((result, index, all) => all.findIndex((candidate) => candidate.key === result.key) === index)
            .slice(0, 40);
    }, [navItems, remoteSearchResults, searchQuery, searchableItems]);

    const groupedSearchResults = useMemo(() => {
        const groups = new Map<string, SearchResult[]>();
        for (const result of searchResults) {
            const existing = groups.get(result.group) ?? [];
            existing.push(result);
            groups.set(result.group, existing);
        }
        return Array.from(groups.entries());
    }, [searchResults]);


    const headerBreadcrumbs = useMemo<HeaderCrumb[]>(() => {
        if (route().current('profile.edit')) {
            return [];
        }

        if (route().current('security.mfa') || route().current('security.mfa.*')) {
            return [];
        }

        const details = breadcrumbDetails.filter((crumb) => crumb.label.trim().length > 0);

        if (!activeModule) return details.length >= 3 ? details : [];

        if (!activeModule.children?.length) {
            const crumbs = details.length > 0
                ? [{ label: activeModule.label, routeName: activeModule.routeName }, ...details]
                : [];
            return crumbs.length >= 3 ? crumbs : [];
        }

        const currentWorkspace =
            activeModule.children.find((child) => child.workspace === currentHash) ??
            activeModule.children[0];

        if (!currentWorkspace) return details;

        // Overview is the landing page itself, so a breadcrumb there adds no useful hierarchy.
        if (currentWorkspace.label === 'Overview' && details.length === 0) return [];

        const crumbs = [
            { label: activeModule.label, routeName: activeModule.routeName },
            { label: currentWorkspace.label, workspace: currentWorkspace.workspace },
            ...details,
        ];
        return crumbs.length >= 3 ? crumbs : [];
    }, [activeModule, breadcrumbDetails, currentHash, page.url]);

    const currentRoleLabel = roleLabel(user.role, user.persona);
    const isDashboardRoute = Boolean(route().current('admin.dashboard') || route().current('hr.dashboard') || route().current('user.dashboard'));
    const liveGreeting = useMemo(() => greetingForTime(now, timeZone), [now, timeZone]);
    const dashboardTitle =
        user.role === 'admin' ? 'Admin Dashboard' :
            user.role === 'hr' ? 'HR Dashboard' :
                'Dashboard';
    const dashboardMessages = [
        `${liveGreeting}, ${user.name}!`,
        dashboardTitle,
        'New Trainee Registered',
    ];
    const dashboardMessage = dashboardMessages[dashboardMessageIndex] ?? dashboardTitle;
    const registeredHeaderFilterGroups = useMemo(
        () => Object.values(headerFilterGroups).filter((group) => group.controls.length > 0),
        [headerFilterGroups],
    );
    const hasHeaderFilters = registeredHeaderFilterGroups.length > 0;

    const registerFilterGroup = useCallback((group: HeaderFilterGroup) => {
        setHeaderFilterGroups((current) => ({ ...current, [group.id]: group }));
        return () => {
            setHeaderFilterGroups((current) => {
                if (!(group.id in current)) return current;
                const next = { ...current };
                delete next[group.id];
                return next;
            });
        };
    }, []);

    const headerFilterRegistryValue = useMemo<HeaderFilterRegistryContextValue>(
        () => ({ registerFilterGroup }),
        [registerFilterGroup],
    );

    useEffect(() => {
        const syncHash = () => setCurrentHash(readHash());
        window.addEventListener('hashchange', syncHash);
        window.addEventListener('popstate', syncHash);
        syncHash();

        return () => {
            window.removeEventListener('hashchange', syncHash);
            window.removeEventListener('popstate', syncHash);
        };
    }, [page.url]);

    useEffect(() => {
        if (activeModule?.children?.length) {
            setExpandedModule(activeModule.routeName);
        }
    }, [activeModule?.routeName]);

    useEffect(() => {
        if (!collapsed) setCollapsedFlyout(null);
    }, [collapsed]);

    // The sidebar is its own scroll container, so Inertia's preserveScroll does not
    // restore it when the page/layout remounts. Persist its exact position per role
    // so cross-module navigation feels continuous instead of jumping back to the top.
    useLayoutEffect(() => {
        const node = sidebarNavRef.current;
        if (!node || typeof window === 'undefined') return;

        const stored = Number(window.sessionStorage.getItem(sidebarScrollStorageKey) ?? '0');
        if (!Number.isFinite(stored) || stored <= 0) return;

        const restore = () => {
            const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
            node.scrollTop = Math.min(stored, maxScroll);
        };

        restore();
        const frame = window.requestAnimationFrame(restore);
        const timer = window.setTimeout(restore, 60);

        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, [page.url, sidebarScrollStorageKey]);

    useEffect(() => {
        const node = sidebarNavRef.current;
        if (!node) return;

        const updateScrollCue = () => {
            const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;
            setSidebarHasMore(node.scrollHeight > node.clientHeight + 4 && remaining > 8);
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(sidebarScrollStorageKey, String(node.scrollTop));
            }
        };

        const frame = window.requestAnimationFrame(updateScrollCue);
        node.addEventListener('scroll', updateScrollCue, { passive: true });
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollCue) : null;
        observer?.observe(node);

        return () => {
            window.cancelAnimationFrame(frame);
            node.removeEventListener('scroll', updateScrollCue);
            observer?.disconnect();
        };
    }, [collapsed, expandedModule, navItems, sidebarScrollStorageKey]);

    useEffect(() => {
        if (!collapsedFlyout) return;

        const closeFlyout = (event: PointerEvent) => {
            const target = event.target as Node;
            const element = event.target as Element;
            if (collapsedFlyoutRef.current?.contains(target)) return;
            if (element.closest?.('[data-collapsed-module-trigger="true"]')) return;
            setCollapsedFlyout(null);
        };

        document.addEventListener('pointerdown', closeFlyout);
        return () => document.removeEventListener('pointerdown', closeFlyout);
    }, [collapsedFlyout]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isDashboardRoute) {
            setDashboardMessageIndex(0);
            return;
        }

        const durations = [3000, 5000, 3000];
        const timer = window.setTimeout(
            () => setDashboardMessageIndex((current) => (current + 1) % durations.length),
            durations[dashboardMessageIndex] ?? 3000,
        );

        return () => window.clearTimeout(timer);
    }, [dashboardMessageIndex, isDashboardRoute, page.url]);


    useEffect(() => {
        let lastTick = Date.now();

        const tick = () => {
            const current = Date.now();
            const elapsed = Math.max(0, Math.floor((current - lastTick) / 1000));
            lastTick = current;

            if (document.visibilityState !== 'visible' || elapsed <= 0) return;

            setScreenTimeSeconds((previous) => {
                const next = previous + elapsed;
                window.sessionStorage.setItem('pd_screen_time_seconds', String(next));
                return next;
            });
        };

        const resetTickOrigin = () => {
            lastTick = Date.now();
        };

        const timer = window.setInterval(tick, 1000);
        document.addEventListener('visibilitychange', resetTickOrigin);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', resetTickOrigin);
        };
    }, []);

    const fetchNotifications = useCallback(async () => {
        setNotificationLoading(true);
        setNotificationError('');
        try {
            const response = await axios.get<HeaderNotificationResponse>('/api/header-notifications', {
                headers: { Accept: 'application/json' },
            });
            const nextItems = response.data.data ?? [];
            setNotifications(nextItems);
            setNotificationTotal(Number(response.data.unreadCount ?? response.data.totalCount ?? 0));
            setNotificationActiveCount(Number(response.data.activeCount ?? nextItems.length));
            setNotificationGeneratedAt(response.data.generatedAt ?? null);
            setNotificationSelectedId((current) =>
                current && nextItems.some((item) => item.id === current)
                    ? current
                    : nextItems.find((item) => !item.isRead)?.id ?? nextItems[0]?.id ?? null,
            );
        } catch {
            setNotificationError('Notifications could not be refreshed right now.');
        } finally {
            setNotificationLoading(false);
        }
    }, []);

    const markNotificationsRead = useCallback(async (items: HeaderNotificationItem[]) => {
        const unreadItems = items.filter((item) => !item.isRead && item.fingerprint);
        if (unreadItems.length === 0) return;

        const ids = new Set(unreadItems.map((item) => item.id));
        setNotifications((current) => current.map((item) => ids.has(item.id) ? { ...item, isRead: true } : item));
        setNotificationTotal((current) => Math.max(0, current - unreadItems.length));

        try {
            await axios.post('/api/header-notifications/read', {
                notifications: unreadItems.map((item) => ({
                    id: item.id,
                    fingerprint: item.fingerprint,
                })),
            }, {
                headers: { Accept: 'application/json' },
            });
        } catch {
            setNotificationError('Notification read status could not be saved. Refresh to retry.');
            void fetchNotifications();
        }
    }, [fetchNotifications]);

    const openNotificationWorkspace = useCallback(async (item: HeaderNotificationItem) => {
        await markNotificationsRead([item]);
        setNotificationOpen(false);
        setNotificationCenterOpen(false);
        router.visit(item.href);
    }, [markNotificationsRead]);

    const openNotificationCenter = useCallback(() => {
        const target = notifications.find((item) => !item.isRead) ?? notifications[0] ?? null;
        setNotificationOpen(false);
        setNotificationSelectedId((current) => current && notifications.some((item) => item.id === current) ? current : target?.id ?? null);
        setNotificationCenterOpen(true);
        if (target && !target.isRead) void markNotificationsRead([target]);
    }, [markNotificationsRead, notifications]);

    const selectNotificationInCenter = useCallback((item: HeaderNotificationItem) => {
        setNotificationSelectedId(item.id);
        void markNotificationsRead([item]);
    }, [markNotificationsRead]);

    useEffect(() => {
        const refresh = () => void fetchNotifications();
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') refresh();
        };

        refresh();
        const timer = window.setInterval(refresh, 60000);
        window.addEventListener('focus', refresh);
        window.addEventListener('header-notifications:refresh', refresh);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('header-notifications:refresh', refresh);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [fetchNotifications]);

    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 2) {
            setRemoteSearchResults([]);
            setSearchLoading(false);
            setSearchError('');
            return;
        }

        const abortController = new AbortController();
        const timer = window.setTimeout(async () => {
            setSearchLoading(true);
            setSearchError('');

            try {
                const response = await axios.get<GlobalSearchResponse>('/api/global-search', {
                    params: { q: query },
                    signal: abortController.signal,
                    headers: { Accept: 'application/json' },
                });
                setRemoteSearchResults(response.data.data ?? []);
            } catch {
                if (abortController.signal.aborted) return;
                setRemoteSearchResults([]);
                setSearchError('System records could not be searched right now. Navigation search is still available.');
            } finally {
                if (!abortController.signal.aborted) setSearchLoading(false);
            }
        }, 240);

        return () => {
            window.clearTimeout(timer);
            abortController.abort();
        };
    }, [searchQuery]);

    useEffect(() => {
        const closeTransientMenus = (event: PointerEvent) => {
            const target = event.target as Node;
            if (searchRef.current?.contains(target) || searchPanelRef.current?.contains(target) || accountRef.current?.contains(target) || accountPanelRef.current?.contains(target) || notificationRef.current?.contains(target) || notificationPanelRef.current?.contains(target)) return;
            setSearchOpen(false);
            setAccountOpen(false);
            setNotificationOpen(false);
        };

        document.addEventListener('pointerdown', closeTransientMenus);
        return () => document.removeEventListener('pointerdown', closeTransientMenus);
    }, []);

    useEffect(() => {
        setSearchActiveIndex(0);
    }, [searchQuery, searchOpen, remoteSearchResults]);

    useEffect(() => {
        const focusGlobalSearch = (event: globalThis.KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
            event.preventDefault();
            setSearchOpen(true);
            window.requestAnimationFrame(() => searchInputRef.current?.focus());
        };

        window.addEventListener('keydown', focusGlobalSearch);
        return () => window.removeEventListener('keydown', focusGlobalSearch);
    }, []);

    useEffect(() => () => {
        if (collapsedFlyoutCloseTimerRef.current) clearTimeout(collapsedFlyoutCloseTimerRef.current);
        if (accountCloseTimerRef.current) clearTimeout(accountCloseTimerRef.current);
        if (notificationCloseTimerRef.current) clearTimeout(notificationCloseTimerRef.current);
    }, []);

    const closeMobileSidebar = () => setMobileOpen(false);

    const toggleThemePreference = () => {
        setThemePreference((current) => {
            const next = current === 'light' ? 'dark' : 'light';
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('pd_theme_preference', next);
            }
            return next;
        });
    };

    const handleToggleMenu = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setMobileOpen((prev) => !prev);
            return;
        }

        setCollapsedFlyout(null);
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('sidebar_collapsed', String(next));
            return next;
        });
    };

    const cancelCollapsedFlyoutClose = () => {
        if (collapsedFlyoutCloseTimerRef.current) {
            clearTimeout(collapsedFlyoutCloseTimerRef.current);
            collapsedFlyoutCloseTimerRef.current = null;
        }
    };

    const scheduleCollapsedFlyoutClose = () => {
        cancelCollapsedFlyoutClose();
        collapsedFlyoutCloseTimerRef.current = setTimeout(() => {
            setCollapsedFlyout(null);
        }, 140);
    };

    const revealCollapsedModule = (item: NavItem, trigger?: HTMLButtonElement) => {
        if (!item.children?.length || !collapsed || typeof window === 'undefined' || window.innerWidth < 1024) return;

        cancelCollapsedFlyoutClose();
        const rect = trigger?.getBoundingClientRect();
        const estimatedHeight = 54 + item.children.length * 38 + 16;
        const desiredTop = rect?.top ?? 12;
        const top = Math.max(12, Math.min(desiredTop, window.innerHeight - estimatedHeight - 12));
        setCollapsedFlyout({ routeName: item.routeName, top });
    };

    const persistSidebarScroll = () => {
        const node = sidebarNavRef.current;
        if (!node || typeof window === 'undefined') return;
        window.sessionStorage.setItem(sidebarScrollStorageKey, String(node.scrollTop));
    };

    const warmSidebarHref = (href: string) => {
        // Inertia v2 can cache a prefetched GET response. Keep this optional so the
        // sidebar still works if a future router build omits the prefetch API.
        const prefetch = (router as typeof router & { prefetch?: (url: string) => void }).prefetch;
        if (typeof prefetch === 'function') {
            try {
                prefetch.call(router, href);
            } catch {
                // Prefetch is only a latency optimization; navigation must never depend on it.
            }
        }
    };

    const navigateSidebarHref = (href: string) => {
        // Keep module switches inside the Inertia SPA. Do not preserve the previous
        // page component state across different modules; carrying large module state
        // forward makes sidebar navigation feel slower and can retain stale filters.
        persistSidebarScroll();

        router.visit(href, {
            method: 'get',
            preserveState: false,
            preserveScroll: false,
        });

        setCollapsedFlyout(null);
        closeMobileSidebar();
    };

    const openModule = (item: NavItem, trigger?: HTMLButtonElement) => {
        if (!item.children?.length) return;

        if (collapsed && typeof window !== 'undefined' && window.innerWidth >= 1024) {
            revealCollapsedModule(item, trigger);
            return;
        }

        if (!isNavItemActive(item.routeName)) {
            navigateSidebarHref(resolveNavHref(item.routeName, item.children[0].workspace));
            return;
        }

        setExpandedModule((current) =>
            current === item.routeName ? null : item.routeName,
        );
    };

    const navigateChild = (item: NavItem, child: NavChild) => {
        const targetHash = encodeWorkspaceHash(child.workspace);
        const onExactModuleRoute = route().has(item.routeName) && Boolean(route().current(item.routeName));

        if (isNavItemActive(item.routeName) && onExactModuleRoute) {
            if (window.location.hash !== targetHash) {
                const nextUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
                window.history.pushState(null, '', nextUrl);
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            } else {
                // Re-selecting the current workspace still resets any nested
                // course/module/lesson view owned by the page.
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            }
        } else {
            // Sub-pages (for example Course Builder-like administration pages) return to
            // the module index before selecting the requested workspace. This keeps
            // breadcrumb/sidebar navigation functional instead of trapping the user on
            // the current sub-route when the hash already matches.
            navigateSidebarHref(resolveNavHref(item.routeName, child.workspace));
        }

        setCollapsedFlyout(null);
        closeMobileSidebar();
    };

    const navigateSearchResult = (result: SearchResult) => {
        setSearchOpen(false);
        setSearchQuery('');
        setRemoteSearchResults([]);

        if (result.href) {
            const target = new URL(result.href, window.location.origin);
            const isSameOrigin = target.origin === window.location.origin;
            const isDeepSearchTarget =
                target.searchParams.has('gs_table')
                || target.searchParams.has('gs_record')
                || target.searchParams.has('gs_match')
                || target.searchParams.has('gs_open');

            if (isDeepSearchTarget && isSameOrigin) {
                const targetPath = `${target.pathname}${target.search}`;

                router.visit(targetPath, {
                    method: 'get',
                    preserveState: false,
                    preserveScroll: false,
                    onSuccess: () => {
                        // Inertia does not reliably notify hash-driven workspaces when a
                        // search result changes route + query + hash together. Apply the
                        // workspace hash after the page swap and explicitly notify both
                        // the workspace hook and URL-driven record locators.
                        window.requestAnimationFrame(() => {
                            const nextUrl = `${target.pathname}${target.search}${target.hash}`;
                            window.history.replaceState(window.history.state, '', nextUrl);
                            window.dispatchEvent(new HashChangeEvent('hashchange'));
                            window.dispatchEvent(new CustomEvent('global-search:navigate'));
                        });
                    },
                });
                return;
            }

            if (!isSameOrigin) {
                window.location.assign(target.toString());
                return;
            }

            router.visit(`${target.pathname}${target.search}${target.hash}`);
            return;
        }

        if (result.workspace && result.routeName) {
            const item = navItems.find((navItem) => navItem.routeName === result.routeName);
            const child = item?.children?.find((candidate) => candidate.workspace === result.workspace);
            if (item && child) {
                navigateChild(item, child);
                return;
            }
        }

        if (result.routeName) {
            router.visit(resolveNavHref(result.routeName));
        }
    };

    const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (!searchOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            setSearchOpen(true);
            return;
        }

        if (event.key === 'Escape') {
            setSearchOpen(false);
            event.currentTarget.blur();
            return;
        }

        if (!searchResults.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSearchActiveIndex((index) => (index + 1) % searchResults.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSearchActiveIndex((index) => (index - 1 + searchResults.length) % searchResults.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            navigateSearchResult(searchResults[searchActiveIndex] ?? searchResults[0]);
        }
    };

    const cancelNotificationClose = () => {
        if (notificationCloseTimerRef.current) {
            clearTimeout(notificationCloseTimerRef.current);
            notificationCloseTimerRef.current = null;
        }
    };

    const scheduleNotificationClose = () => {
        cancelNotificationClose();
        notificationCloseTimerRef.current = setTimeout(() => {
            setNotificationOpen(false);
        }, 160);
    };

    const openNotifications = () => {
        cancelNotificationClose();
        setNotificationOpen(true);
        void fetchNotifications();
    };

    const cancelAccountClose = () => {
        if (accountCloseTimerRef.current) {
            clearTimeout(accountCloseTimerRef.current);
            accountCloseTimerRef.current = null;
        }
    };

    const scheduleAccountClose = () => {
        cancelAccountClose();
        accountCloseTimerRef.current = setTimeout(() => setAccountOpen(false), 160);
    };

    const collapsedFlyoutItem = collapsedFlyout
        ? navItems.find((item) => item.routeName === collapsedFlyout.routeName) ?? null
        : null;

    return (
        <HeaderFilterRegistryContext.Provider value={headerFilterRegistryValue}>
            <div className="app-shell flex min-h-screen bg-[var(--pd-canvas)] text-[var(--pd-text)] transition-colors duration-300">
                {mobileOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
                        onClick={closeMobileSidebar}
                        aria-hidden="true"
                    />
                )}

                <aside
                    data-pd-sidebar="true"
                    className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-[#121212] dark:bg-[#07090c] transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:translate-x-0 ${collapsed ? 'lg:w-[5.25rem]' : 'lg:w-64'
                        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                >
                    <div
                        className={`relative flex h-[5.5rem] shrink-0 items-center border-b border-white/10 px-3 ${collapsed ? 'lg:justify-center' : ''
                            }`}
                    >
                        <button
                            type="button"
                            onClick={() => navigateSidebarHref(resolveNavHref(navItems[0]?.routeName ?? 'admin.dashboard'))}
                            className={`group min-w-0 transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]/60 ${collapsed
                                ? 'flex lg:w-full lg:justify-center lg:p-1'
                                : 'mx-auto block w-full max-w-[13rem] px-1 py-1.5'
                                }`}
                            aria-label="Open Dashboard"
                            title="Open Dashboard"
                        >
                            <div
                                className={`items-center ${collapsed
                                    ? 'flex lg:justify-center'
                                    : 'grid w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-[16px]'
                                    }`}
                            >
                                <div className={`flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-sm transition-transform duration-300 ease-out group-hover:scale-[1.02] ${collapsed ? '' : 'ml-[9px]'}`}>
                                    <img
                                        src="/images/Alibaton.jpg"
                                        onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.src = alibatonLogo;
                                        }}
                                        alt="Alibaton Construction Incorporated"
                                        className="h-full w-full object-contain object-center"
                                    />
                                </div>

                                <div className={`min-w-0 translate-x-[5px] pl-0.5 text-left ${collapsed ? 'lg:hidden' : ''}`}>
                                    <p className="whitespace-nowrap text-[15.25px] font-extrabold leading-none tracking-tight text-white">
                                        Alibaton
                                    </p>
                                    <p className="mt-1 whitespace-nowrap text-[10px] font-medium leading-tight tracking-[0.005em] text-white/60">
                                        Construction Incorporated
                                    </p>
                                </div>
                            </div>

                            <p className={`mt-2 text-center text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#F4B400] ${collapsed ? 'lg:hidden' : ''}`}>
                                Performance &amp; Development
                            </p>

                        </button>

                        <button
                            type="button"
                            onClick={closeMobileSidebar}
                            className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 lg:hidden"
                            aria-label="Close navigation menu"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <nav ref={sidebarNavRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="space-y-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = isNavItemActive(item.routeName);
                                const hasChildren = Boolean(item.children?.length);
                                const expanded = expandedModule === item.routeName;

                                if (!hasChildren) {
                                    return (
                                        <button
                                            key={item.routeName}
                                            type="button"
                                            onClick={() => navigateSidebarHref(resolveNavHref(item.routeName))}
                                            onMouseEnter={() => warmSidebarHref(resolveNavHref(item.routeName))}
                                            onFocus={() => warmSidebarHref(resolveNavHref(item.routeName))}
                                            title={collapsed ? item.label : undefined}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${collapsed ? 'lg:justify-center lg:px-2.5' : ''
                                                } ${isActive
                                                    ? 'bg-[#F4B400] text-black'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-black' : 'text-white/60 group-hover:text-white'}`} />
                                            <span className={`min-w-0 flex-1 truncate whitespace-nowrap leading-snug ${collapsed ? 'lg:hidden' : ''}`}>
                                                {item.label}
                                            </span>
                                        </button>
                                    );
                                }

                                return (
                                    <div key={item.routeName}>
                                        <button
                                            type="button"
                                            onClick={(event) => openModule(item, event.currentTarget)}
                                            onMouseEnter={(event) => {
                                                revealCollapsedModule(item, event.currentTarget);
                                                if (!isActive && item.children?.[0]) {
                                                    warmSidebarHref(resolveNavHref(item.routeName, item.children[0].workspace));
                                                }
                                            }}
                                            onFocus={() => {
                                                if (!isActive && item.children?.[0]) {
                                                    warmSidebarHref(resolveNavHref(item.routeName, item.children[0].workspace));
                                                }
                                            }}
                                            onMouseLeave={scheduleCollapsedFlyoutClose}
                                            data-collapsed-module-trigger="true"
                                            aria-expanded={collapsed ? collapsedFlyout?.routeName === item.routeName : expanded}
                                            className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${collapsed ? 'lg:justify-center lg:px-2.5' : ''
                                                } ${isActive
                                                    ? 'bg-[#F4B400] text-black'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-black' : 'text-white/60 group-hover:text-white'}`} />
                                            <span className={`min-w-0 flex-1 truncate text-left whitespace-nowrap leading-snug ${collapsed ? 'lg:hidden' : ''}`}>
                                                {item.label}
                                            </span>
                                            <ChevronDown
                                                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${collapsed ? 'lg:hidden' : ''} ${isActive ? 'text-black/60' : 'text-white/45'} ${expanded ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {expanded && (
                                            <div className={`relative ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3 ${collapsed ? 'lg:hidden' : ''}`}>
                                                {item.children!.map((child) => {
                                                    const childActive =
                                                        isActive &&
                                                        (currentHash === child.workspace ||
                                                            (currentHash === '' && child === item.children![0]));

                                                    return (
                                                        <button
                                                            key={child.workspace}
                                                            type="button"
                                                            onClick={() => navigateChild(item, child)}
                                                            aria-current={childActive ? 'page' : undefined}
                                                            className={`group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${childActive
                                                                ? 'bg-[#F4B400]/12 font-semibold text-[#FFD25A]'
                                                                : 'text-white/55 hover:bg-white/5 hover:text-white'
                                                                }`}
                                                        >
                                                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${childActive ? 'bg-[#F4B400]' : 'bg-white/20 group-hover:bg-white/45'}`} />
                                                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </nav>

                    {sidebarHasMore && (
                        <div
                            data-pd-sidebar-fade="true"
                            aria-hidden="true"
                            className="pointer-events-none absolute bottom-[3.5rem] left-0 right-0 z-10 h-9 bg-gradient-to-t from-[#121212] via-[#121212]/75 to-transparent backdrop-blur-[0.5px]"
                        />
                    )}

                    <div
                        data-pd-sidebar-footer="true"
                        className="relative z-20 shrink-0 border-t border-white/10 bg-[#121212] px-3 py-2.5"
                    >
                        <div
                            className={`flex min-h-[2.25rem] items-center justify-center rounded-lg text-center text-white/50 ${collapsed ? 'gap-1 lg:px-1' : 'gap-1.5 px-2'
                                }`}
                            title={`Screen time: ${formatScreenTime(screenTimeSeconds)}`}
                        >
                            <Clock className="h-3.5 w-3.5 shrink-0 text-white/40" />
                            {!collapsed && <span className="text-[9px] font-semibold uppercase tracking-[0.09em] text-white/35">Screen Time</span>}
                            {!collapsed && <span className="text-white/20">·</span>}
                            <span className={`${collapsed ? 'text-[9px]' : 'text-[11px]'} whitespace-nowrap font-semibold tabular-nums text-white/65`}>
                                {formatScreenTime(screenTimeSeconds)}
                            </span>
                        </div>
                    </div>
                </aside>

                {collapsed && collapsedFlyout && collapsedFlyoutItem?.children?.length && (
                    <div
                        ref={collapsedFlyoutRef}
                        onMouseEnter={cancelCollapsedFlyoutClose}
                        onMouseLeave={scheduleCollapsedFlyoutClose}
                        data-pd-sidebar-flyout="true"
                        className="fixed z-[70] hidden w-64 overflow-hidden rounded-xl border border-white/10 bg-[#181818] p-2 shadow-2xl shadow-black/35 lg:block"
                        style={{ left: '5.25rem', top: collapsedFlyout.top }}
                        role="menu"
                        aria-label={`${collapsedFlyoutItem.label} navigation`}
                    >
                        <div className="border-b border-white/10 px-3 py-2.5">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Module</p>
                            <p className="mt-0.5 text-sm font-semibold text-white">{collapsedFlyoutItem.label}</p>
                        </div>
                        <div className="mt-1 space-y-0.5">
                            {collapsedFlyoutItem.children.map((child) => {
                                const isActive = isNavItemActive(collapsedFlyoutItem.routeName);
                                const childActive =
                                    isActive &&
                                    (currentHash === child.workspace ||
                                        (currentHash === '' && child === collapsedFlyoutItem.children![0]));

                                return (
                                    <button
                                        key={child.workspace}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => navigateChild(collapsedFlyoutItem, child)}
                                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${childActive
                                            ? 'bg-[#F4B400]/15 font-semibold text-[#FFD25A]'
                                            : 'text-white/65 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${childActive ? 'bg-[#F4B400]' : 'bg-white/20'}`} />
                                        <span className="min-w-0 flex-1 truncate">{child.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                    <header
                        data-pd-app-header="true"
                        className="app-header sticky top-0 z-40 shrink-0 border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur-xl backdrop-saturate-150 sm:px-5"
                    >
                        <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[4rem_auto] gap-x-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,29rem)_minmax(0,1fr)] lg:grid-rows-[4rem] lg:items-center">
                            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleToggleMenu}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100"
                                    aria-label="Toggle navigation menu"
                                >
                                    <Menu className="h-5 w-5" />
                                </button>
                                <div className="min-w-0 flex-1">
                                    {isDashboardRoute && !(user.role === 'user' && header) ? (
                                        <HeaderOverflowPan key={`dashboard-message-${dashboardMessageIndex}`} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
                                            <h1 className="py-0.5 text-xl font-extrabold leading-[1.2] tracking-tight text-slate-950">
                                                {dashboardMessageIndex === 0 ? (
                                                    <>
                                                        <span className="text-[#F4B400]">{liveGreeting}, </span>
                                                        <span className="text-slate-950">{user.name}!</span>
                                                    </>
                                                ) : dashboardMessage}
                                            </h1>
                                        </HeaderOverflowPan>
                                    ) : header ? (
                                        <HeaderOverflowPan>
                                            <div className="min-w-0 [&_h1]:!overflow-visible [&_h1]:!whitespace-nowrap [&_h1]:![text-overflow:clip] [&_h1]:py-0.5 [&_h1]:!text-xl [&_h1]:!font-extrabold [&_h1]:!leading-[1.2] [&_h1]:tracking-tight [&_h1]:text-slate-950 [&_h2]:!overflow-visible [&_h2]:!whitespace-nowrap [&_h2]:![text-overflow:clip] [&_h2]:py-0.5 [&_h2]:!text-xl [&_h2]:!font-extrabold [&_h2]:!leading-[1.2] [&_h2]:tracking-tight [&_h2]:text-slate-950">
                                                {header}
                                            </div>
                                        </HeaderOverflowPan>
                                    ) : null}
                                    {!isDashboardRoute && headerBreadcrumbs.length > 0 && (
                                        <nav
                                            aria-label="Breadcrumb"
                                            className="mt-0.5 flex min-w-0 items-center overflow-hidden whitespace-nowrap text-[10px] text-slate-400"
                                        >
                                            {headerBreadcrumbs.map((crumb, index) => {
                                                const isCurrent = index === headerBreadcrumbs.length - 1;
                                                const actualChild = crumb.workspace
                                                    ? activeModule?.children?.find((child) => child.workspace === crumb.workspace)
                                                    : undefined;
                                                const crumbClass = `min-w-0 truncate rounded px-1 py-0.5 transition ${isCurrent ? 'font-bold text-slate-600' : 'font-medium hover:bg-slate-100 hover:text-slate-700'}`;

                                                return (
                                                    <div key={`${crumb.label}:${index}`} className="flex min-w-0 items-center">
                                                        {index > 0 && <ChevronRight className="mx-0.5 h-3 w-3 shrink-0 text-slate-300" />}
                                                        {!isCurrent && actualChild && activeModule ? (
                                                            <button type="button" onClick={() => navigateChild(activeModule, actualChild)} className={crumbClass}>
                                                                {crumb.label}
                                                            </button>
                                                        ) : !isCurrent && crumb.routeName && route().has(crumb.routeName) ? (
                                                            <Link href={resolveNavHref(crumb.routeName)} className={crumbClass}>
                                                                {crumb.label}
                                                            </Link>
                                                        ) : !isCurrent && crumb.href ? (
                                                            <Link href={crumb.href} className={crumbClass}>
                                                                {crumb.label}
                                                            </Link>
                                                        ) : (
                                                            <span className={crumbClass}>{crumb.label}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </nav>
                                    )}
                                </div>
                            </div>

                            <div className="col-span-full row-start-2 flex min-w-0 items-center justify-center px-1 pb-2.5 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:w-full lg:max-w-[27rem] lg:justify-self-center lg:px-0 lg:pb-0 xl:max-w-[29rem]">
                                <div ref={searchRef} className="relative w-full">
                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="search"
                                        value={searchQuery}
                                        onChange={(event) => {
                                            setSearchQuery(event.target.value);
                                            setSearchOpen(true);
                                        }}
                                        onFocus={() => setSearchOpen(true)}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder="Search anything..."
                                        aria-label="Search anything across the system"
                                        aria-expanded={searchOpen}
                                        aria-controls="global-navigation-search-results"
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-0 pl-10 pr-10 text-sm text-slate-800 shadow-inner shadow-slate-100/50 placeholder:text-slate-400 transition focus:border-[#F4B400] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4B400]/25"
                                    />
                                    {searchLoading ? (
                                        <LoaderCircle className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                    ) : searchQuery ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setRemoteSearchResults([]);
                                                setSearchError('');
                                                setSearchOpen(true);
                                                searchInputRef.current?.focus();
                                            }}
                                            aria-label="Clear search"
                                            title="Clear search"
                                            className="absolute right-2.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    ) : (
                                        <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400 2xl:inline">
                                            Ctrl K
                                        </span>
                                    )}

                                    <HeaderFloatingPanel
                                        open={searchOpen}
                                        anchorRef={searchRef}
                                        panelRef={searchPanelRef}
                                        width="anchor"
                                        align="left"
                                        estimatedHeight={430}
                                    >
                                        <div id="global-navigation-search-results" className="h-full overflow-hidden">
                                            <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                                        {searchQuery.trim() ? 'Global search' : 'Quick navigation'}
                                                    </p>
                                                    {searchQuery.trim().length === 1 && (
                                                        <p className="mt-0.5 text-[11px] text-slate-400">Type one more character to search system records.</p>
                                                    )}
                                                </div>
                                                <span className="hidden text-[11px] text-slate-400 sm:inline">↑ ↓ to move · Enter to open</span>
                                            </div>

                                            <div className="relative overflow-hidden">
                                                <div className="system-dropdown-scroll max-h-[26rem] overflow-y-auto p-1.5">
                                                    {groupedSearchResults.length ? (
                                                        groupedSearchResults.map(([group, results]) => (
                                                            <div key={group} className="py-1">
                                                                <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">{group}</p>
                                                                {results.map((result) => {
                                                                    const index = searchResults.findIndex((candidate) => candidate.key === result.key);
                                                                    return (
                                                                        <button
                                                                            key={result.key}
                                                                            type="button"
                                                                            onMouseEnter={() => setSearchActiveIndex(index)}
                                                                            onClick={() => navigateSearchResult(result)}
                                                                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${searchActiveIndex === index
                                                                                ? 'bg-[#F4B400]/12'
                                                                                : 'hover:bg-slate-50'
                                                                                }`}
                                                                        >
                                                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${searchActiveIndex === index
                                                                                ? 'bg-[#F4B400]/20 text-amber-700'
                                                                                : 'bg-slate-100 text-slate-500'
                                                                                }`}>
                                                                                <Search className="h-4 w-4" />
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="truncate text-sm font-semibold text-slate-800">{result.label}</p>
                                                                                <p className="truncate text-xs text-slate-500">
                                                                                    {result.module}{result.description ? ` · ${result.description}` : ''}
                                                                                </p>
                                                                            </div>
                                                                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ))
                                                    ) : searchLoading ? (
                                                        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-medium text-slate-500">
                                                            <LoaderCircle className="h-4 w-4 animate-spin" />
                                                            Searching system records...
                                                        </div>
                                                    ) : (
                                                        <div className="px-4 py-8 text-center">
                                                            <p className="text-sm font-semibold text-slate-700">No matching result</p>
                                                            <p className="mt-1 text-xs text-slate-400">Try a person, course, cycle, competency, module, or workspace name.</p>
                                                        </div>
                                                    )}
                                                </div>
                                                {searchResults.length > 8 && (
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-white via-white/80 to-transparent backdrop-blur-[2px]" />
                                                )}
                                            </div>

                                            {searchError && (
                                                <div className="border-t border-amber-100 bg-amber-50 px-3.5 py-2 text-[11px] font-medium text-amber-800">
                                                    {searchError}
                                                </div>
                                            )}
                                        </div>
                                    </HeaderFloatingPanel>
                                </div>
                            </div>

                            <div className="col-start-2 row-start-1 flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2 lg:col-start-3 lg:row-start-1">
                                {hasHeaderFilters && (
                                    <HeaderFilterHub groups={registeredHeaderFilterGroups} />
                                )}
                                <div className="flex items-center gap-1 border-r border-slate-200 pr-1.5 sm:pr-2">
                                    <div
                                        ref={notificationRef}
                                        className="relative"
                                        onMouseEnter={openNotifications}
                                        onMouseLeave={scheduleNotificationClose}
                                    >
                                        <button
                                            type="button"
                                            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition ${notificationOpen ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                                            aria-label={notificationTotal > 0 ? `Notifications, ${notificationTotal} unread` : 'Notifications'}
                                            title={notificationTotal > 0 ? `${notificationTotal} unread notification${notificationTotal === 1 ? '' : 's'}` : 'Notifications'}
                                            aria-haspopup="menu"
                                            aria-expanded={notificationOpen}
                                            onClick={() => {
                                                if (notificationOpen) setNotificationOpen(false);
                                                else openNotifications();
                                            }}
                                            onFocus={openNotifications}
                                        >
                                            <Bell className="h-5 w-5" />
                                            {notificationTotal > 0 && (
                                                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-extrabold leading-none text-white ring-2 ring-white">
                                                    {notificationTotal > 99 ? '99+' : notificationTotal}
                                                </span>
                                            )}
                                        </button>
                                        <HeaderFloatingPanel
                                            open={notificationOpen}
                                            anchorRef={notificationRef}
                                            panelRef={notificationPanelRef}
                                            width={380}
                                            estimatedHeight={480}
                                            onMouseEnter={cancelNotificationClose}
                                            onMouseLeave={scheduleNotificationClose}
                                        >
                                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-900">Notifications</p>
                                                    <p className="mt-0.5 text-[11px] text-slate-400">
                                                        {notificationTotal} unread · {notificationActiveCount} active
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (user.role === 'user' && route().has('user.notifications.index')) {
                                                            setNotificationOpen(false);
                                                            router.visit(route('user.notifications.index'));
                                                            return;
                                                        }
                                                        openNotificationCenter();
                                                    }}
                                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600 transition hover:border-amber-200 hover:bg-amber-50/60 hover:text-amber-800"
                                                >
                                                    View all
                                                </button>
                                            </div>
                                            <div className="max-h-[23rem] overflow-y-auto p-1.5">
                                                {notificationLoading && notifications.length === 0 ? (
                                                    <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs font-semibold text-slate-500">
                                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                                        Loading notifications…
                                                    </div>
                                                ) : notifications.length ? (
                                                    notifications.map((item) => {
                                                        const tone = notificationToneStyle(item.tone);
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => void openNotificationWorkspace(item)}
                                                                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${item.isRead ? 'hover:bg-slate-50' : 'bg-amber-50/40 hover:bg-amber-50/70'}`}
                                                            >
                                                                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="flex items-start justify-between gap-2">
                                                                        <span className={`block text-xs font-bold ${item.isRead ? 'text-slate-700' : 'text-slate-900'}`}>{item.title}</span>
                                                                        {!item.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#F4B400]" />}
                                                                    </span>
                                                                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{item.description}</span>
                                                                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{item.meta}</span>
                                                                </span>
                                                                <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-5 py-8 text-center">
                                                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                                            <Bell className="h-5 w-5" />
                                                        </div>
                                                        <p className="mt-3 text-sm font-bold text-slate-700">No active alerts</p>
                                                        <p className="mt-1 text-xs leading-5 text-slate-400">Nothing in the current system records needs your attention right now.</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
                                                <button
                                                    type="button"
                                                    disabled={notificationTotal === 0}
                                                    onClick={() => void markNotificationsRead(notifications)}
                                                    className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-default disabled:opacity-40"
                                                >
                                                    <CheckCheck className="h-3.5 w-3.5" />
                                                    Mark all read
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNotificationOpen(false);
                                                        const settingsRoute = user.role === 'admin'
                                                            ? 'admin.settings.index'
                                                            : user.role === 'hr'
                                                                ? 'hr.settings.index'
                                                                : 'user.settings.index';
                                                        router.visit(`${route(settingsRoute)}?section=notifications`);
                                                    }}
                                                    className="h-7 rounded-lg px-2 text-[10px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                                                >
                                                    Preferences
                                                </button>
                                            </div>
                                            <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
                                                {notificationError || (notificationGeneratedAt ? `Last refreshed ${new Date(notificationGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Notifications refresh automatically every minute.')}
                                            </div>
                                        </HeaderFloatingPanel>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={toggleThemePreference}
                                        aria-label={themePreference === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                                        title={themePreference === 'light' ? 'Dark mode' : 'Light mode'}
                                        aria-pressed={themePreference === 'dark'}
                                        className={`relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]/50 ${themePreference === 'dark'
                                            ? 'bg-slate-900 text-amber-300 shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-amber-600'
                                            }`}
                                    >
                                        <Sun
                                            className={`absolute h-5 w-5 transition-all duration-500 ease-out ${themePreference === 'light'
                                                ? 'rotate-0 scale-100 opacity-100'
                                                : 'rotate-90 scale-0 opacity-0'
                                                }`}
                                        />
                                        <Moon
                                            className={`absolute h-5 w-5 transition-all duration-500 ease-out ${themePreference === 'dark'
                                                ? 'rotate-0 scale-100 opacity-100'
                                                : '-rotate-90 scale-0 opacity-0'
                                                }`}
                                        />
                                        <span className="sr-only">Theme appearance control</span>
                                    </button>
                                </div>

                                <div
                                    ref={accountRef}
                                    className="relative"
                                    onMouseEnter={() => {
                                        cancelAccountClose();
                                        setAccountOpen(true);
                                    }}
                                    onMouseLeave={scheduleAccountClose}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setAccountOpen((open) => !open)}
                                        onFocus={() => setAccountOpen(true)}
                                        aria-expanded={accountOpen}
                                        aria-haspopup="menu"
                                        data-pd-account-trigger="true"
                                        className={`inline-flex h-10 items-center gap-2 rounded-xl px-1.5 transition focus:outline-none sm:w-[12.25rem] ${themePreference === 'dark'
                                            ? accountOpen
                                                ? 'bg-[#171f29] ring-1 ring-white/[0.06]'
                                                : 'hover:bg-[#171f29] focus:bg-[#171f29]'
                                            : 'hover:bg-slate-100 focus:bg-slate-100'
                                            }`}
                                    >
                                        {user.profile_photo_url ? (
                                            <img
                                                src={user.profile_photo_url}
                                                alt={`${user.name} profile`}
                                                className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-[#F4B400]/70"
                                            />
                                        ) : (
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F4B400] text-[12px] font-bold text-black shadow-sm">
                                                {user.name?.charAt(0)?.toUpperCase()}
                                            </div>
                                        )}
                                        <div className="hidden min-w-0 flex-1 text-left sm:block">
                                            <p className={`truncate text-[13px] font-semibold leading-tight ${themePreference === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{user.name}</p>
                                            <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-slate-400">{currentRoleLabel}</p>
                                        </div>
                                        <ChevronDown className={`ml-auto hidden h-4 w-4 shrink-0 transition-transform sm:block ${themePreference === 'dark' ? 'text-slate-500' : 'text-slate-400'} ${accountOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    <HeaderFloatingPanel
                                        open={accountOpen}
                                        anchorRef={accountRef}
                                        panelRef={accountPanelRef}
                                        width={256}
                                        align="right"
                                        estimatedHeight={260}
                                        onMouseEnter={cancelAccountClose}
                                        onMouseLeave={scheduleAccountClose}
                                    >
                                        <div role="menu" data-pd-account-menu="true">
                                            <div className="border-b border-slate-100 px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {user.profile_photo_url ? (
                                                        <img
                                                            src={user.profile_photo_url}
                                                            alt={`${user.name} profile`}
                                                            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[#F4B400]/70"
                                                        />
                                                    ) : (
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4B400] font-bold text-black">
                                                            {user.name?.charAt(0)?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
                                                        <p className="mt-0.5 text-xs font-medium text-slate-400">{currentRoleLabel}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-1.5">
                                                <Link
                                                    href={
                                                        user.role === 'user'
                                                            ? route('user.profile.index')
                                                            : `${route(user.role === 'admin' ? 'admin.settings.index' : 'hr.settings.index')}?section=profile`
                                                    }
                                                    role="menuitem"
                                                    onClick={() => setAccountOpen(false)}
                                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                                                >
                                                    <UserRound className="h-4 w-4 text-slate-400" />
                                                    <span>Profile</span>
                                                </Link>
                                                <Link
                                                    href={route('security.mfa')}
                                                    role="menuitem"
                                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                                                >
                                                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                                                    <span>Security &amp; MFA</span>
                                                </Link>
                                            </div>
                                            <div className="border-t border-slate-100 p-1.5">
                                                <Link
                                                    href={route('logout')}
                                                    method="post"
                                                    as="button"
                                                    role="menuitem"
                                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                                                >
                                                    <LogOut className="h-4 w-4" />
                                                    <span>Log Out</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </HeaderFloatingPanel>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="app-main min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 xl:p-6">
                        <div
                            className={[
                                'min-w-0 transition-[margin] duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)]',
                                aevynOpen && aevynDockSide === 'right'
                                    ? 'lg:mr-[416px]'
                                    : 'mr-0',
                                aevynOpen && aevynDockSide === 'left'
                                    ? 'lg:ml-[416px]'
                                    : 'ml-0',
                            ].join(' ')}
                        >
                            {children}
                        </div>
                    </main>

                    <NotificationCenterModal
                        open={notificationCenterOpen}
                        items={notifications}
                        selectedId={notificationSelectedId}
                        unreadCount={notificationTotal}
                        activeCount={notificationActiveCount}
                        loading={notificationLoading}
                        error={notificationError}
                        generatedAt={notificationGeneratedAt}
                        onClose={() => setNotificationCenterOpen(false)}
                        onSelect={selectNotificationInCenter}
                        onOpenWorkspace={openNotificationWorkspace}
                        onMarkAllRead={() => void markNotificationsRead(notifications)}
                        onRefresh={() => void fetchNotifications()}
                    />

                    <AevynShell
                        key={`${page.url.split('#')[0]}::${isDashboardRoute ? 'Overall' : currentHash || activeModule?.label || 'Workspace'}`}
                        open={aevynOpen}
                        onOpenChange={setAevynOpen}
                        dockSide={aevynDockSide}
                        onDockSideChange={setAevynDockSide}
                    />
                </div>
            </div>
        </HeaderFilterRegistryContext.Provider>
    );
}
