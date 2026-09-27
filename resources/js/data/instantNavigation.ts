import { router } from '@inertiajs/react';

type AppRole = 'admin' | 'hr' | 'user';
type Persona = 'trainee' | 'employee' | 'supervisor' | 'manager';

export type InstantRouteEntry = {
    href: string;
    component: string;
    props?: Record<string, unknown>;
};

const authenticatedPageModules = import.meta.glob('../Pages/*.tsx');
const instantRoutes = new Map<string, InstantRouteEntry>();
const warmedComponents = new Set<string>();
let globalLinkCleanup: (() => void) | null = null;

const TRANSIENT_PAGE_PROPS = [
    'dashboard',
    'dashboardPayload',
    'directoryPayload',
    'initialUserDirectoryState',
    'availablePersonnel',
    'userDirectorySource',
    'initialReportFilters',
    'initialSettingsState',
    'initialWorkspace',
    'performanceView',
    'persona',
    'userName',
] as const;

function asUrl(href: string): URL | null {
    if (!href || href === '#' || typeof window === 'undefined') return null;

    try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return null;
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        return url;
    } catch {
        return null;
    }
}

function routeKey(url: URL): string {
    return url.pathname.replace(/\/+$/, '') || '/';
}

function moduleLoader(component: string): (() => Promise<unknown>) | null {
    const exact = `../Pages/${component}.tsx`;
    const loader = authenticatedPageModules[exact];
    return typeof loader === 'function' ? loader : null;
}

function warmComponent(component: string): void {
    if (warmedComponents.has(component)) return;
    const loader = moduleLoader(component);
    if (!loader) return;

    warmedComponents.add(component);
    void loader().catch(() => warmedComponents.delete(component));
}

function settingsWorkspace(url: URL): string {
    const section = url.searchParams.get('section');
    const fromSection: Record<string, string> = {
        profile: 'My Profile',
        security: 'Sign-in Protection',
        'security-activity': 'Security Logs',
        notifications: 'Notifications & Alerts',
        organization: 'Organization & Reporting',
        archive: 'Archive',
        faq: 'FAQ',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        license: 'Software License',
    };

    if (section && fromSection[section]) return fromSection[section];
    if (url.pathname.endsWith('/audit-logs')) return 'Audit Trail';
    if (url.pathname.endsWith('/integrations')) return 'Notifications & Alerts';
    return 'My Profile';
}

function resolveEntryProps(entry: InstantRouteEntry, url: URL): Record<string, unknown> {
    if (entry.component === 'Settings') {
        return { ...entry.props, initialWorkspace: settingsWorkspace(url) };
    }

    if (entry.component === 'Reports') {
        return {
            ...entry.props,
            initialReportFilters: {
                report: url.searchParams.get('report') ?? '',
                department: url.searchParams.get('department') ?? '',
                date_from: url.searchParams.get('date_from') ?? '',
                date_to: url.searchParams.get('date_to') ?? '',
            },
        };
    }

    return entry.props ?? {};
}

export function registerInstantRoutes(entries: InstantRouteEntry[]): void {
    instantRoutes.clear();

    for (const entry of entries) {
        const url = asUrl(entry.href);
        if (!url) continue;
        instantRoutes.set(routeKey(url), entry);
    }
}

export function warmAuthenticatedHref(href: string): void {
    const url = asUrl(href);
    if (!url) return;
    const entry = instantRoutes.get(routeKey(url));
    if (!entry) return;
    warmComponent(entry.component);
}

export function queueAuthenticatedRouteWarmup(hrefs: string[]): void {
    if (typeof window === 'undefined') return;

    const components = Array.from(new Set(
        hrefs
            .map((href) => {
                const url = asUrl(href);
                return url ? instantRoutes.get(routeKey(url))?.component ?? null : null;
            })
            .filter((value): value is string => Boolean(value)),
    ));

    components.forEach((component, index) => {
        window.setTimeout(() => warmComponent(component), 100 + index * 45);
    });
}

export function warmAuthenticatedPageBundles(): void {
    if (typeof window === 'undefined') return;
    const components = Array.from(new Set(Array.from(instantRoutes.values()).map((entry) => entry.component)));

    const run = () => components.forEach((component, index) => {
        window.setTimeout(() => warmComponent(component), index * 35);
    });

    const idleWindow = window as typeof window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
        idleWindow.requestIdleCallback(run, { timeout: 900 });
    } else {
        window.setTimeout(run, 250);
    }
}

export function instantNavigate(href: string): boolean {
    const url = asUrl(href);
    if (!url) return false;

    const entry = instantRoutes.get(routeKey(url));
    if (!entry) return false;

    const target = `${url.pathname}${url.search}${url.hash}`;
    const current = new URL(window.location.href);

    if (current.pathname === url.pathname && current.search === url.search) {
        if (current.hash !== url.hash) {
            window.history.pushState(window.history.state, '', target);
        }
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return true;
    }

    warmComponent(entry.component);

    const clientRouter = router as unknown as {
        push?: (options: {
            url: string;
            component: string;
            props?: (current: Record<string, unknown>) => Record<string, unknown>;
            preserveScroll?: boolean;
            preserveState?: boolean;
        }) => void;
    };

    if (typeof clientRouter.push !== 'function') return false;

    const routeProps = resolveEntryProps(entry, url);

    clientRouter.push({
        url: target,
        component: entry.component,
        props: (currentProps) => {
            const next: Record<string, unknown> = { ...currentProps };
            for (const key of TRANSIENT_PAGE_PROPS) delete next[key];

            const auth = next.auth as { user?: { name?: string } } | undefined;
            if (auth?.user?.name) next.userName = auth.user.name;

            return { ...next, ...routeProps };
        },
        preserveScroll: false,
        preserveState: false,
    });

    return true;
}

export function installGlobalLinkWarmup(): () => void {
    if (typeof window === 'undefined') return () => {};
    globalLinkCleanup?.();

    const anchorFromTarget = (target: EventTarget | null): HTMLAnchorElement | null => {
        const element = target instanceof Element ? target.closest('a[href]') : null;
        return element instanceof HTMLAnchorElement ? element : null;
    };

    const warmFromTarget = (target: EventTarget | null) => {
        const anchor = anchorFromTarget(target);
        if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
        warmAuthenticatedHref(anchor.href);
    };

    const click = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = anchorFromTarget(event.target);
        if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;

        const url = asUrl(anchor.href);
        if (!url || !instantRoutes.has(routeKey(url))) return;

        event.preventDefault();
        instantNavigate(anchor.href);
    };

    const pointer = (event: Event) => warmFromTarget(event.target);
    const focus = (event: Event) => warmFromTarget(event.target);
    const touch = (event: Event) => warmFromTarget(event.target);

    document.addEventListener('click', click, true);
    document.addEventListener('pointerover', pointer, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('touchstart', touch, { capture: true, passive: true });

    const cleanup = () => {
        document.removeEventListener('click', click, true);
        document.removeEventListener('pointerover', pointer, true);
        document.removeEventListener('focusin', focus, true);
        document.removeEventListener('touchstart', touch, true);
        if (globalLinkCleanup === cleanup) globalLinkCleanup = null;
    };

    globalLinkCleanup = cleanup;
    return cleanup;
}

// Retained as a compatibility no-op for callers from the V4/V5 transition. Data is
// fetched by each destination page so background warmups never saturate HostForge.
export function scheduleOperationalDataWarmup(_role: AppRole, _persona?: Persona): void {}
