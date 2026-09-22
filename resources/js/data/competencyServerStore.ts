import axios from 'axios';
import { useEffect, useRef, useState, type SetStateAction } from 'react';
import type { CompetencyState } from './competency';
import { replaceSharedPersonnel, type PersonnelIdentity } from './personnel';

export type CompetencyPayload = {
    state: CompetencyState;
    revision: number;
    personnel: PersonnelIdentity[];
    permissions: { govern: boolean };
    actor: { databaseId: number; personnelKey: string; name: string; role: string };
};
const collections = ['competencies', 'roleProfiles', 'cycles', 'assessorAuthorizations', 'assessments', 'recommendations', 'acknowledgmentEvents'] as const;
const emptyState: CompetencyState = { schemaVersion: 4, competencies: [], roleProfiles: [], cycles: [], assessorAuthorizations: [], assessments: [], recommendations: [], acknowledgmentEvents: [], activities: [], auditLog: [] };

export function competencyChanges(before: CompetencyState, after: CompetencyState) {
    return collections.flatMap(collection => {
        const previous = new Map<string, unknown>(before[collection].map(record => [record.id, record]));
        return after[collection].filter(record => JSON.stringify(record) !== JSON.stringify(previous.get(record.id))).map(record => ({ collection, record }));
    });
}

/** Serial, revision-checked server mutations; local state is only the pending editor view. */
export function useCompetencyServerStore(initial?: CompetencyPayload) {
    const confirmed = useRef(initial ?? null);
    const pending = useRef<SetStateAction<CompetencyState>[]>([]);
    const running = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const alive = useRef(true);
    const [state, render] = useState(initial?.state ?? emptyState);
    const [saving, setSaving] = useState(false);
    const [storageError, setError] = useState('');
    const apply = (base: CompetencyState, updates: SetStateAction<CompetencyState>[]) => updates.reduce<CompetencyState>((s, update) => typeof update === 'function' ? update(s) : update, base);

    const reload = async () => {
        const { data } = await axios.get<CompetencyPayload>('/competency/api/state');
        confirmed.current = data;
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
    useEffect(() => {
        alive.current = true;
        if (!initial) void reload().catch(() => setError('Competency records could not be loaded. Refresh to retry.'));
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
