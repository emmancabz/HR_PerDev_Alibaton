import { useCallback, useEffect, useState } from 'react';

export function encodeWorkspaceHash(value: string): string {
    return `#${encodeURIComponent(value)}`;
}

export function readWorkspaceHash<T extends string>(
    allowed: readonly T[],
    fallback: T,
): T {
    if (typeof window === 'undefined') return fallback;

    const raw = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function useHashWorkspace<T extends string>(
    allowed: readonly T[],
    fallback: T,
): [T, (next: T) => void] {
    const [workspace, setWorkspace] = useState<T>(() =>
        readWorkspaceHash(allowed, fallback),
    );

    useEffect(() => {
        const sync = () => setWorkspace(readWorkspaceHash(allowed, fallback));
        window.addEventListener('hashchange', sync);
        window.addEventListener('popstate', sync);
        sync();

        return () => {
            window.removeEventListener('hashchange', sync);
            window.removeEventListener('popstate', sync);
        };
    }, [allowed, fallback]);

    const navigate = useCallback((next: T) => {
        setWorkspace(next);
        const hash = encodeWorkspaceHash(next);
        if (window.location.hash !== hash) {
            window.location.hash = hash;
        }
    }, []);

    return [workspace, navigate];
}
