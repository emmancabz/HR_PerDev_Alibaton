import { AppModal, Field } from '@/Components/Competency/CompetencyUI';
import SystemSelect from '@/Components/SystemSelect';
import { recognitionClient, recognitionError } from '@/data/recognitionClient';
import {
    emptyRecognitionDraft,
    recognitionDraftFromRecord,
    type RecognitionDraft,
    type RecognitionRecord,
    type RecognitionState,
} from '@/data/recognition';
import { Save, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

const input = 'app-control';
const secondary = 'app-button';
const primary = 'app-button app-button-primary';

type Props = {
    state: RecognitionState;
    embedded?: boolean;
    onClose?: () => void;
    onSaved: () => Promise<void> | void;
    record?: RecognitionRecord | null;
    replacementOf?: RecognitionRecord | null;
};

export default function RecognitionNominationForm({
    state,
    embedded = false,
    onClose,
    onSaved,
    record = null,
    replacementOf = null,
}: Props) {
    const firstCategory = state.categories.find((category) => category.isActive)?.id ?? '';
    const initial = useMemo<RecognitionDraft>(() => {
        if (record) return recognitionDraftFromRecord(record, false);
        if (replacementOf) return recognitionDraftFromRecord(replacementOf, true);
        return emptyRecognitionDraft(firstCategory);
    }, [firstCategory, record, replacementOf]);
    const [form, setForm] = useState<RecognitionDraft>(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const colleagues = state.personnel.filter((person) => person.id !== state.actor.id);
    const activeCategories = state.categories.filter((category) => category.isActive || category.id === form.categoryId);
    const selected = colleagues.find((person) => person.id === form.recipientId) ?? state.personnel.find((person) => person.id === form.recipientId);
    const isEditing = Boolean(record?.status === 'Draft');
    const isReplacement = Boolean(replacementOf);

    async function submit(saveAsDraft: boolean) {
        if (!form.recipientId || !form.categoryId || form.title.trim().length < 5 || form.achievementDetails.trim().length < 10 || !form.achievementDate) return;
        setBusy(true);
        setError('');
        try {
            const payload = { ...form, saveAsDraft };
            if (isEditing && record) {
                await recognitionClient.update(record.id, payload);
                if (!saveAsDraft) await recognitionClient.submit(record.id);
            } else {
                await recognitionClient.create(payload);
            }
            await onSaved();
            onClose?.();
        } catch (requestError) {
            setError(recognitionError(requestError));
        } finally {
            setBusy(false);
        }
    }

    const body = (
        <div className="space-y-5">
            {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
            {isReplacement && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    This creates a new governed nomination linked to the previous declined or revoked record. The historical record remains unchanged.
                </div>
            )}
            <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Recipient" required>
                        <SystemSelect className={input} value={form.recipientId ?? ''} onChange={(event) => setForm({ ...form, recipientId: event.target.value ? Number(event.target.value) : null })}>
                            <option value="">Select an active colleague</option>
                            {colleagues.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.position || 'Unassigned'}</option>)}
                        </SystemSelect>
                    </Field>
                    <Field label="Category" required>
                        <SystemSelect className={input} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                            <option value="">Select category</option>
                            {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </SystemSelect>
                    </Field>
                </div>
                {selected && <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><strong>{selected.name}</strong> · {selected.position || 'Unassigned'} · {selected.department || 'Unassigned'}</div>}
            </section>
            <div className="grid gap-4">
                <Field label="Recognition title" required hint="Keep it specific to the contribution being recognized.">
                    <input className={input} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Safety Leadership Contribution" />
                </Field>
                <Field label="Achievement / contribution" required>
                    <textarea className={`${input} min-h-28 resize-y`} maxLength={10000} value={form.achievementDetails} onChange={(event) => setForm({ ...form, achievementDetails: event.target.value })} placeholder="Describe what the employee contributed, what happened, and why it is worth recognizing." />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Achievement date" required>
                        <input type="date" max={new Date().toISOString().slice(0, 10)} className={input} value={form.achievementDate} onChange={(event) => setForm({ ...form, achievementDate: event.target.value })} />
                    </Field>
                    <Field label="Supporting note" hint="Optional. Use a concise reference, witness note, or verification context.">
                        <input className={input} value={form.evidence[0]?.description ?? ''} onChange={(event) => setForm({ ...form, evidence: event.target.value ? [{ type: 'Supporting Note', sourceModule: null, sourceRecordId: null, sourceFinalizedAt: null, description: event.target.value }] : [] })} placeholder="Optional supporting context" />
                    </Field>
                </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                Self-recognition is blocked. Recognition is published only after governance review and never changes performance ratings, competency levels, learning/training outcomes, or succession readiness automatically.
            </div>
        </div>
    );

    const footer = (
        <>
            {onClose && <button type="button" onClick={onClose} className={secondary} disabled={busy}>Cancel</button>}
            <button type="button" disabled={busy} onClick={() => void submit(true)} className={secondary}><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save Draft'}</button>
            <button type="button" disabled={busy} onClick={() => void submit(false)} className={primary}><Send className="h-4 w-4" />{busy ? 'Submitting…' : isEditing ? 'Submit Nomination' : 'Submit Nomination'}</button>
        </>
    );

    if (embedded) {
        return (
            <section className="app-card overflow-hidden">
                <div className="app-card-header"><div><h2 className="text-sm font-bold text-slate-950">Nominate a Colleague</h2><p className="mt-1 text-xs text-slate-500">Social recognition is reviewed before it appears in the company feed.</p></div></div>
                <div className="p-5">{body}</div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">{footer}</div>
            </section>
        );
    }

    return (
        <AppModal
            show
            title={isReplacement ? 'Create Corrected Nomination' : isEditing ? 'Edit Recognition Draft' : 'Nominate Employee'}
            description={isReplacement ? 'Create a new nomination while preserving the prior historical record.' : 'Recognize a specific contribution from an active colleague.'}
            onClose={() => onClose?.()}
            maxWidth="2xl"
            footer={footer}
        >
            {body}
        </AppModal>
    );
}
