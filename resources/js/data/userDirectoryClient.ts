import axios from 'axios';

let directoryCache: unknown | null = null;
let directoryRequest: Promise<unknown> | null = null;

export function peekUserDirectoryState<T>(): T | null {
    return directoryCache as T | null;
}

export async function fetchUserDirectoryState<T>(force = false): Promise<T> {
    if (!force && directoryCache) return directoryCache as T;
    if (directoryRequest) return directoryRequest as Promise<T>;

    directoryRequest = axios
        .get('/governance/api/users', { headers: { Accept: 'application/json' } })
        .then((response) => {
            directoryCache = response.data.data;
            return directoryCache;
        })
        .finally(() => {
            directoryRequest = null;
        });

    return directoryRequest as Promise<T>;
}

export function rememberUserDirectoryState<T>(payload: T): T {
    directoryCache = payload;
    return payload;
}
