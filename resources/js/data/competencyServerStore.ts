import axios from 'axios';
import { useEffect, useRef, useState, type SetStateAction } from 'react';
import type { CompetencyState } from './competency';
import { replaceSharedPersonnel, type PersonnelIdentity } from './personnel';
import { useReadModelRefresh } from './readModelRefresh';

export type CompetencyPayload = {
    state: CompetencyState;
    revision: number;
    personnel: PersonnelIdentity[];
    permissions: { govern: boolean };
    actor: { databaseId: number; personnelKey: string; name: string; role: string };
};
const collections = ['competencies', 'roleProfiles', 'cycles', 'assessorAuthorizations', 'assessments', 'recommendations', 'acknowledgmentEvents'] as const;
const emptyState: CompetencyState = { schemaVersion: 4, competencies: [], roleProfiles: [], cycles: [], assessorAuthorizations: [], assessments: [], recommendations: [], acknowledgmentEvents: [], activities: [], auditLog: [] };
let competencyPayloadCache: CompetencyPayload | null = null;
const COMPETENCY_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const competencyStorageKey = (actorId: number) => `pd:competency-state:v1:${actorId}`;

function readPersistedCompetencyPayload(actorId?: number): CompetencyPayload | null {
    if (typeof window === 'undefined' || !actorId || actorId < 1) return null;
    try {
        const raw = window.sessionStorage.getItem(competencyStorageKey(actorId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; payload?: CompetencyPayload };
        if (!parsed.savedAt || Date.now() - parsed.savedAt > COMPETENCY_CACHE_MAX_AGE_MS || !parsed.payload) {
            window.sessionStorage.removeItem(competencyStorageKey(actorId));
            return null;
        }
        return Number(parsed.payload.actor.databaseId) === actorId ? parsed.payload : null;
    } catch {
        window.sessionStorage.removeItem(competencyStorageKey(actorId));
        return null;
    }
}

function rememberCompetencyPayload(payload: CompetencyPayload): CompetencyPayload {
    competencyPayloadCache = payload;
    const actorId = Number(payload.actor.databaseId);
    if (typeof window !== 'undefined' && actorId > 0) {
        try {
            window.sessionStorage.setItem(
                competencyStorageKey(actorId),
                JSON.stringify({ savedAt: Date.now(), payload }),
            );
        } catch {}
    }
    return payload;
}

export function competencyChanges(before: CompetencyState, after: CompetencyState) {
    return collections.flatMap(collection => {
        const previous = new Map<string, unknown>(before[collection].map(record => [record.id, record]));
        return after[collection].filter(record => JSON.stringify(record) !== JSON.stringify(previous.get(record.id))).map(record => ({ collection, record }));
    });
}

/** Serial, revision-checked server mutations; local state is only the pending editor view. */
export function useCompetencyServerStore(initial?: CompetencyPayload, actorId?: number) {
    const inMemory = competencyPayloadCache && (!actorId || Number(competencyPayloadCache.actor.databaseId) === actorId)
        ? competencyPayloadCache
        : null;
    const hydratedInitial = initial ?? inMemory ?? readPersistedCompetencyPayload(actorId) ?? undefined;
    const confirmed = useRef(hydratedInitial ?? null);
    const pending = useRef<SetStateAction<CompetencyState>[]>([]);
    const running = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const alive = useRef(true);
    const [state, render] = useState(hydratedInitial?.state ?? emptyState);
    const [saving, setSaving] = useState(false);
    const [storageError, setError] = useState('');
    const apply = (base: CompetencyState, updates: SetStateAction<CompetencyState>[]) => updates.reduce<CompetencyState>((s, update) => typeof update === 'function' ? update(s) : update, base);

    const reload = async () => {
        const { data } = await axios.get<CompetencyPayload>('/competency/api/state');
        confirmed.current = data;
        rememberCompetencyPayload(data);
        replaceSharedPersonnel(data.personnel);
        if (alive.current) render(data.state);
        return data;
    };
    const flush = async () => {
        if (running.current || !pending.current.length || !confirmed.current) return;
        running.current = true;
        const count = pending.current.length;
        const updates = pending.current.slice(0, count);
        const before = confirmed.current.state;
        const desired = apply(before, updates);
        try {
            const changes = competencyChanges(before, desired);
            const data = changes.length ? (await axios.post<CompetencyPayload>('/competency/api/changes', { revision: confirmed.current.revision, changes })).data : confirmed.current;
            confirmed.current = data;
            rememberCompetencyPayload(data);
            replaceSharedPersonnel(data.personnel);
            pending.current.splice(0, count);
            if (alive.current) {
                render(apply(data.state, pending.current));
                setError('');
            }
        } catch (error) {
            pending.current = [];
            const message = axios.isAxiosError(error) ? error.response?.data?.message ?? 'The server could not save this change. Check your connection and try again.' : 'The change could not be saved.';
            if (alive.current) setError(message);
            // Reload also handles ambiguous network failures after a committed transaction.
            try { await reload(); } catch { if (alive.current && confirmed.current) render(confirmed.current.state); }
        } finally {
            running.current = false;
            if (pending.current.length) void flush();
            else if (alive.current) setSaving(false);
        }
    };
    const setState = (update: SetStateAction<CompetencyState>) => {
        if (!confirmed.current) { setError('Wait for Competency records to load.'); return; }
        pending.current.push(update);
        setSaving(true);
        setError('');
        render(apply(confirmed.current.state, pending.current));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 350);
    };
    useReadModelRefresh('competency', () => {
        if (!pending.current.length && !running.current) {
            void reload().catch(() => {});
        }
    });

    useEffect(() => {
        alive.current = true;
        if (!hydratedInitial) void reload().catch(() => setError('Competency records could not be loaded. Try again.'));
        else void reload().catch(() => {});
        const warn = (event: BeforeUnloadEvent) => {
            if (pending.current.length || running.current) { event.preventDefault(); event.returnValue = ''; }
        };
        const refresh = () => {
            if (!pending.current.length && !running.current) void reload().catch(() => {});
        };
        window.addEventListener('beforeunload', warn);
        window.addEventListener('focus', refresh);
        return () => { alive.current = false; window.removeEventListener('beforeunload', warn); window.removeEventListener('focus', refresh); };
    }, []);
    return { state, setState, storageError, saving };
}
