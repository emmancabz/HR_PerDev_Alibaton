import { Archive } from 'lucide-react';

export default function DeleteUserForm({ className = '' }: { className?: string }) {
    return <section className={`rounded-xl border border-amber-200 bg-amber-50 p-5 ${className}`}>
        <div className="flex items-start gap-3"><Archive className="mt-0.5 h-5 w-5 text-amber-700" /><div><h2 className="text-sm font-bold text-amber-950">Governed account retention</h2><p className="mt-1 text-xs leading-5 text-amber-900/75">Permanent self-service deletion is disabled. Admin manages account archiving, five-year retention, and privacy-preserving anonymization from Settings.</p></div></div>
    </section>;
}
