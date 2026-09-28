import axios from 'axios';

declare global {
    interface Window {
        axios: typeof axios;
    }
}

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const READ_MODEL_REFRESH_EVENT = 'pnd:read-model-refresh';
const refreshTimers = new Map<string, number>();

function mutationDomain(url: string | undefined): string | null {
    if (!url) return null;
    let path = url;
    try {
        path = new URL(url, window.location.origin).pathname;
    } catch {
        path = url.split('?')[0] ?? url;
    }

    if (path.startsWith('/learning/api/')) return 'learning';
    if (path.startsWith('/training/api/')) return 'training';
    if (path.startsWith('/performance/api/') || path.startsWith('/api/performance/')) return 'performance';
    if (path.startsWith('/competency/api/')) return 'competency';
    if (path.startsWith('/succession/api/')) return 'succession';
    if (path.startsWith('/recognition/api/')) return 'recognition';
    if (path.startsWith('/governance/api/users') || path.startsWith('/admin/users/')) return 'users';
    if (path.startsWith('/governance/api/reports')) return 'reports';
    return null;
}

function skipAutomaticRefresh(method: string, url: string | undefined): boolean {
    if (!url) return true;
    let path = url;
    try {
        path = new URL(url, window.location.origin).pathname;
    } catch {
        path = url.split('?')[0] ?? url;
    }

    if (method === 'put' && /^\/learning\/api\/versions\/[^/]+$/.test(path)) return true;
    if (method === 'put' && /^\/learning\/api\/attempts\/[^/]+\/responses$/.test(path)) return true;
    if (method === 'put' && /^\/learning\/api\/assignments\/[^/]+\/lesson-progress$/.test(path)) return true;
    if (/^\/learning\/api\/lessons\/[^/]+\/materials$/.test(path)) return true;
    if (/^\/learning\/api\/materials\/[^/]+$/.test(path)) return true;
    if (/^\/learning\/api\/versions\/[^/]+\/thumbnail$/.test(path)) return true;
    if (path === '/api/header-notifications/read' || path === '/api/session/heartbeat') return true;
    return false;
}

function scheduleReadModelRefresh(domain: string) {
    const previous = refreshTimers.get(domain);
    if (previous !== undefined) window.clearTimeout(previous);

    const timer = window.setTimeout(() => {
        refreshTimers.delete(domain);
        window.dispatchEvent(new CustomEvent(READ_MODEL_REFRESH_EVENT, {
            detail: { domains: [domain] },
        }));
    }, 350);

    refreshTimers.set(domain, timer);
}

axios.interceptors.response.use((response) => {
    const method = String(response.config.method ?? 'get').toLowerCase();
    if (['get', 'head', 'options'].includes(method)) return response;

    const data = response.data?.data;
    // Full-state mutations already hand the authoritative state back to the page.
    if (data && typeof data === 'object' && data.actor) return response;
    if (skipAutomaticRefresh(method, response.config.url)) return response;

    const domain = mutationDomain(response.config.url);
    if (domain) scheduleReadModelRefresh(domain);

    return response;
});
