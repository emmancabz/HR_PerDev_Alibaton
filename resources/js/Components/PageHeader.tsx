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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                {description && (
                    <p className="mt-0.5 text-sm text-slate-500">{description}</p>
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
