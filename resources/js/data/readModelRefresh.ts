import { useEffect, useRef } from 'react';

export const READ_MODEL_REFRESH_EVENT = 'pnd:read-model-refresh';

export type ReadModelDomain =
    | 'dashboard'
    | 'users'
    | 'performance'
    | 'competency'
    | 'learning'
    | 'training'
    | 'succession'
    | 'recognition'
    | 'reports';

type ReadModelRefreshDetail = {
    domains?: string[];
};

export function useReadModelRefresh(domain: ReadModelDomain, callback: () => void | Promise<void>) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<ReadModelRefreshDetail>).detail;
            if (!detail?.domains?.includes(domain)) return;
            void callbackRef.current();
        };

        window.addEventListener(READ_MODEL_REFRESH_EVENT, handler);
        return () => window.removeEventListener(READ_MODEL_REFRESH_EVENT, handler);
    }, [domain]);
}
