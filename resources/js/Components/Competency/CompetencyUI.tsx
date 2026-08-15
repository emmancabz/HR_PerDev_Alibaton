import Modal from "@/Components/Modal";
import {
    colorForId,
    initialsFor,
    type PersonnelIdentity,
} from "@/data/personnel";
import { AlertTriangle, Info, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const COMPETENCY_OVERLAY_LEVELS = {
    drawer: "z-[40]",
    modal: "z-[70]",
    confirmation: "z-[90]",
} as const;

export const controlClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition [color-scheme:light] placeholder:text-slate-400 focus:border-[#F4B400] focus:ring-2 focus:ring-[#F4B400]/20 read-only:border-slate-200 read-only:bg-slate-50 read-only:text-slate-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none disabled:ring-0 disabled:[-webkit-text-fill-color:#64748b]";
export const primaryButtonClass =
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F4B400] px-3 py-2 text-xs font-bold text-black transition hover:bg-[#dba300] disabled:cursor-not-allowed disabled:bg-amber-200 disabled:text-amber-700 disabled:opacity-100";
export const secondaryButtonClass =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100";
export const dangerButtonClass =
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
    label,
    required,
    hint,
    error,
    children,
}: {
    label: string;
    required?: boolean;
    hint?: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600">
                {label}
                {required && <span className="text-rose-500">*</span>}
            </span>
            {children}
            {error ? (
                <span className="mt-1 block text-xs font-medium text-rose-600">
                    {error}
                </span>
            ) : null}
            {!error && hint ? (
                <span className="mt-1 block text-xs text-slate-400">
                    {hint}
                </span>
            ) : null}
        </label>
    );
}

export function Toggle({
    checked,
    onChange,
    label,
    description,
    disabled = false,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
}) {
    return (
        <label
            className={`flex items-start justify-between gap-3 rounded-lg border p-3 transition ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-50" : "cursor-pointer border-slate-200 bg-white hover:border-slate-300"}`}
        >
            <span>
                <span className="block text-xs font-semibold text-slate-700">
                    {label}
                </span>
                {description && (
                    <span className="mt-0.5 block text-xs leading-4 text-slate-400">
                        {description}
                    </span>
                )}
            </span>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 bg-white text-amber-500 [color-scheme:light] focus:ring-amber-400 disabled:bg-slate-100 disabled:opacity-100"
            />
        </label>
    );
}

const statusStyles: Record<string, string> = {
    Active: "bg-emerald-100 text-emerald-700",
    Finalized: "bg-emerald-100 text-emerald-700",
    "Requirements Met": "bg-emerald-100 text-emerald-700",
    "Meets Requirement": "bg-emerald-100 text-emerald-700",
    "Exceeds Requirement": "bg-sky-100 text-sky-700",
    Reviewed: "bg-sky-100 text-sky-700",
    Reassessed: "bg-sky-100 text-sky-700",
    Draft: "bg-slate-100 text-slate-600",
    Pending: "bg-slate-100 text-slate-600",
    "Not Assessed": "bg-slate-100 text-slate-600",
    "Profile Not Assigned": "bg-slate-100 text-slate-600",
    Scheduled: "bg-violet-100 text-violet-700",
    Submitted: "bg-indigo-100 text-indigo-700",
    "Pending Validation": "bg-indigo-100 text-indigo-700",
    "In Progress": "bg-amber-100 text-amber-800",
    Recommended: "bg-amber-100 text-amber-800",
    "Reassessment Requested": "bg-amber-100 text-amber-800",
    "Assessment Incomplete": "bg-amber-100 text-amber-800",
    "Reassessment Due": "bg-orange-100 text-orange-700",
    "Has Competency Gaps": "bg-rose-100 text-rose-700",
    "Below Requirement": "bg-rose-100 text-rose-700",
    Critical: "bg-rose-100 text-rose-700",
    "Returned for Revision": "bg-rose-100 text-rose-700",
    Overdue: "bg-rose-100 text-rose-700",
    Cancelled: "bg-rose-100 text-rose-700",
    Archived: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ value }: { value: string }) {
    return (
        <span
            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[value] ?? "bg-slate-100 text-slate-600"}`}
        >
            {value}
        </span>
    );
}

export function ProgressBar({
    value,
    label,
}: {
    value: number;
    label?: string;
}) {
    return (
        <div className="flex min-w-28 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                    className="h-full rounded-full bg-[#F4B400] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-600">
                {label ?? `${value}%`}
            </span>
        </div>
    );
}

export function PersonCell({
    person,
    subtitle,
}: {
    person: PersonnelIdentity;
    subtitle?: string;
}) {
    return (
        <div className="flex min-w-44 items-center gap-2.5">
            <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: colorForId(person.id) }}
            >
                {initialsFor(person.fullName)}
            </div>
            <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">
                    {person.fullName}
                </p>
                <p className="truncate text-xs text-slate-400">
                    {subtitle ?? person.employeeOrTraineeId}
                </p>
            </div>
        </div>
    );
}

export function SectionCard({
    title,
    description,
    action,
    children,
    className = "",
    bodyClassName = "",
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section
            className={`flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 sm:px-4">
                <div>
                    <h2 className="text-sm font-bold text-slate-900">
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-0.5 text-xs leading-4 text-slate-400">
                            {description}
                        </p>
                    )}
                </div>
                {action}
            </div>
            <div className={`flex min-h-0 flex-1 flex-col ${bodyClassName}`}>
                {children}
            </div>
        </section>
    );
}

export function EmptyState({
    icon: Icon = Info,
    title,
    description,
    action,
}: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-1 flex-col justify-center px-4 py-4 text-center sm:py-5">
            <Icon className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-600">{title}</p>
            {description && (
                <p className="mx-auto mt-1 max-w-lg text-xs leading-4 text-slate-400">
                    {description}
                </p>
            )}
            {action && <div className="mt-3 flex justify-center">{action}</div>}
        </div>
    );
}

export function AppModal({
    show,
    title,
    description,
    onClose,
    children,
    footer,
    maxWidth = "2xl",
    layer = "modal",
}: {
    show: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
    layer?: "modal" | "confirmation";
}) {
    return (
        <Modal
            show={show}
            onClose={onClose}
            maxWidth={maxWidth}
            overlayClassName="bg-slate-950/45 backdrop-blur-[1px]"
            panelClassName="!bg-white dark:!bg-white [color-scheme:light]"
            rootClassName={COMPETENCY_OVERLAY_LEVELS[layer]}
            ariaLabel={title}
        >
            <div
                data-overlay-part="scroll-body"
                className="max-h-[calc(100dvh-3rem)] touch-pan-y overflow-y-auto overscroll-contain bg-white text-slate-900 [color-scheme:light] dark:bg-white dark:text-slate-900"
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">
                            {title}
                        </h2>
                        {description && (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close dialog"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5 pb-8">{children}</div>
                {footer && (
                    <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export function AppDrawer({
    show,
    title,
    description,
    onClose,
    children,
    footer,
    eyebrow = "Competency Management",
    blocked = false,
}: {
    show: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    eyebrow?: string;
    blocked?: boolean;
}) {
    if (!show) return null;
    return (
        <div
            data-overlay-root="drawer"
            className={`pointer-events-none fixed inset-0 ${COMPETENCY_OVERLAY_LEVELS.drawer}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            inert={blocked}
            aria-hidden={blocked || undefined}
        >
            <button
                type="button"
                data-overlay-part="drawer-backdrop"
                className="pointer-events-auto absolute inset-0 z-0 cursor-default bg-slate-950/55 backdrop-blur-[1px]"
                onClick={onClose}
                aria-label="Close details"
            />
            <div
                data-overlay-part="drawer-panel"
                className="pointer-events-auto absolute inset-y-0 right-0 z-10 flex w-full max-w-full flex-col bg-white text-slate-900 shadow-2xl [color-scheme:light] animate-in slide-in-from-right-full duration-200 sm:max-w-[800px]"
            >
                <div className="relative shrink-0 border-b border-white/10 bg-[#1a1d21] px-5 pb-4 pt-5 text-white sm:px-6 sm:pt-6">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F4B400]">
                            {eyebrow}
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400]"
                            aria-label="Close details"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <h2 className="mt-3 text-lg font-extrabold leading-tight text-white">
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-400">
                            {description}
                        </p>
                    )}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
                    {children}
                </div>
                {footer && (
                    <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-6px_18px_rgba(15,23,42,0.04)] sm:px-6">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export function ConfirmDialog({
    show,
    title,
    description,
    confirmLabel,
    tone = "danger",
    reason,
    onReasonChange,
    reasonRequired,
    onCancel,
    onConfirm,
}: {
    show: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone?: "danger" | "warning" | "primary";
    reason?: string;
    onReasonChange?: (value: string) => void;
    reasonRequired?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const confirmClass =
        tone === "danger"
            ? dangerButtonClass
            : tone === "warning"
              ? "inline-flex items-center justify-center rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
              : primaryButtonClass;
    return (
        <AppModal
            show={show}
            onClose={onCancel}
            title={title}
            maxWidth="md"
            layer="confirmation"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onCancel}
                        className={secondaryButtonClass}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={Boolean(reasonRequired && !reason?.trim())}
                        className={confirmClass}
                    >
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                <p className="text-xs leading-5 text-orange-800">
                    {description}
                </p>
            </div>
            {onReasonChange && (
                <div className="mt-4">
                    <Field label="Reason" required={reasonRequired}>
                        <textarea
                            value={reason ?? ""}
                            onChange={(event) =>
                                onReasonChange(event.target.value)
                            }
                            rows={3}
                            className={controlClass}
                            placeholder="Document the reason for this action."
                        />
                    </Field>
                </div>
            )}
        </AppModal>
    );
}
