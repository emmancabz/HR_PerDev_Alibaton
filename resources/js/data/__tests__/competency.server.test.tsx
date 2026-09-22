import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { competencyChanges, useCompetencyServerStore, type CompetencyPayload } from '../competencyServerStore';
import { createCompetencyInitialState } from '../competency';
import { BASE_8_IDENTITIES, GENERATED_IDENTITIES, replaceSharedPersonnel } from '../personnel';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: (error: { isAxiosError?: boolean }) => error.isAxiosError === true } }));
function payload(revision = 0): CompetencyPayload {
    const state = createCompetencyInitialState();
    state.recommendations[0].status = "Recommended";
    return { state, revision, personnel: [...BASE_8_IDENTITIES, ...GENERATED_IDENTITIES], permissions: { govern: true }, actor: { databaseId: 1, personnelKey: 'user-1', name: 'Mara Villanueva', role: 'admin' } };
}
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); replaceSharedPersonnel([...BASE_8_IDENTITIES,...GENERATED_IDENTITIES]); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());

describe('Persistent Competency client contract', () => {
    it('saves changed records to the server and does not persist authoritative localStorage', async () => {
        const initial = payload(2);
        const saved = structuredClone(initial); saved.revision = 3; saved.state.recommendations[0].status = 'Reviewed';
        vi.mocked(axios.post).mockResolvedValue({ data: saved });
        const storage = vi.spyOn(Storage.prototype, 'setItem');
        const { result } = renderHook(() => useCompetencyServerStore(initial));
        act(() => result.current.setState(state => ({ ...state, recommendations: state.recommendations.map((r,i) => i ? r : {...r,status:'Reviewed'}) })));
        expect(result.current.saving).toBe(true);
        await act(async () => vi.advanceTimersByTimeAsync(400));
        await waitFor(() => expect(result.current.saving).toBe(false));
        expect(axios.post).toHaveBeenCalledWith('/competency/api/changes', expect.objectContaining({ revision: 2, changes: [expect.objectContaining({ collection: 'recommendations' })] }));
        expect(result.current.state.recommendations[0].status).toBe('Reviewed');
        expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
    });
    it('reloads committed server records after a conflict without silently overwriting them', async () => {
        const initial = payload(4); const other = payload(5); other.state.recommendations[0].title = 'Already changed by HR';
        vi.mocked(axios.post).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: 'Records changed in another session.' } } });
        vi.mocked(axios.get).mockResolvedValue({ data: other });
        const { result } = renderHook(() => useCompetencyServerStore(initial));
        act(() => result.current.setState(state => ({ ...state, recommendations: state.recommendations.map((r,i) => i ? r : {...r,status:'Reviewed'}) })));
        await act(async () => vi.advanceTimersByTimeAsync(400));
        await waitFor(() => expect(result.current.saving).toBe(false));
        expect(result.current.state.recommendations[0].title).toBe('Already changed by HR');
        expect(result.current.storageError).toContain('another session');
        expect(axios.post).toHaveBeenCalledTimes(1);
    });
    it('serializes edits made while the previous mutation is in flight', async () => {
        const initial = payload(10);
        let finish!: (value: {data: CompetencyPayload}) => void;
        vi.mocked(axios.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const first = structuredClone(initial); first.revision = 11; first.state.recommendations[0].status = 'Reviewed';
        const second = structuredClone(first); second.revision = 12; second.state.recommendations[0].status = 'Reassessment Requested';
        vi.mocked(axios.post).mockResolvedValueOnce({ data: second });
        const { result } = renderHook(() => useCompetencyServerStore(initial));
        act(() => result.current.setState(s => ({...s,recommendations:s.recommendations.map((r,i)=>i?r:{...r,status:'Reviewed'})})));
        await act(async () => vi.advanceTimersByTimeAsync(400));
        act(() => result.current.setState(s => ({...s,recommendations:s.recommendations.map((r,i)=>i?r:{...r,status:'Reassessment Requested'})})));
        await act(async () => { finish({data:first}); });
        await waitFor(() => expect(result.current.saving).toBe(false));
        expect(vi.mocked(axios.post).mock.calls.map(call => (call[1] as {revision: number}).revision)).toEqual([10,11]);
        expect(result.current.state.recommendations[0].status).toBe('Reassessment Requested');
    });
    it('does not send client-computed metrics, audit actors, or deleted collections as authority', () => {
        const initial = payload().state;
        const edited = {...initial,metrics:{activeValidatedGaps:999},auditLog:[],activities:[],assessments:[]};
        expect(competencyChanges(initial,edited)).toEqual([]);
    });
});
