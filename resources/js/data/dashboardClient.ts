import axios from 'axios';

type DashboardPayload = {
    kind: 'admin' | 'hr' | 'user';
    persona?: 'trainee' | 'employee' | 'supervisor' | 'manager';
    dashboard: unknown;
    team?: unknown;
};

let cachedDashboardPayload: DashboardPayload | null = null;
let dashboardRequest: Promise<DashboardPayload> | null = null;

export function peekDashboardState<T extends DashboardPayload = DashboardPayload>(): T | null {
    return cachedDashboardPayload as T | null;
}

export function rememberDashboardState(payload: DashboardPayload): void {
    cachedDashboardPayload = payload;
}

export async function fetchDashboardState<T extends DashboardPayload = DashboardPayload>(force = false): Promise<T> {
    if (!force && cachedDashboardPayload) return cachedDashboardPayload as T;
    if (!force && dashboardRequest) return dashboardRequest as Promise<T>;

    const request = axios
        .get<{ data: DashboardPayload }>('/api/dashboard-state', {
            headers: { Accept: 'application/json' },
        })
        .then((response) => {
            cachedDashboardPayload = response.data.data;
            return response.data.data;
        })
        .finally(() => {
            if (dashboardRequest === request) dashboardRequest = null;
        });

    dashboardRequest = request;
    return request as Promise<T>;
}
