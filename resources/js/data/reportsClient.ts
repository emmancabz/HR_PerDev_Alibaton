import axios from 'axios';

type ReportParams = {
    report?: string;
    department?: string;
    date_from?: string;
    date_to?: string;
};

const cache = new Map<string, unknown>();
const requests = new Map<string, Promise<unknown>>();

function cacheKey(params: ReportParams): string {
    return JSON.stringify({
        report: params.report ?? '',
        department: params.department ?? '',
        date_from: params.date_from ?? '',
        date_to: params.date_to ?? '',
    });
}

export function peekReportsState<T>(params: ReportParams = {}): T | null {
    return (cache.get(cacheKey(params)) as T | undefined) ?? null;
}

export async function fetchReportsState<T>(params: ReportParams = {}, force = false): Promise<T> {
    const key = cacheKey(params);
    if (!force && cache.has(key)) return cache.get(key) as T;
    if (requests.has(key)) return requests.get(key) as Promise<T>;

    const request = axios
        .get('/governance/api/reports', {
            params,
            headers: { Accept: 'application/json' },
        })
        .then((response) => {
            cache.set(key, response.data.data);
            return response.data.data;
        })
        .finally(() => {
            requests.delete(key);
        });

    requests.set(key, request);
    return request as Promise<T>;
}
