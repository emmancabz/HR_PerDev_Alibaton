import { type ReactNode } from 'react';

export default function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950">{title}</h2>
                {description && (
                    <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">{description}</p>
                )}
            </div>
            {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}
