import Modal from "@/Components/Modal";
import {
    colorForId,
    initialsFor,
    type PersonnelIdentity,
} from "@/data/personnel";
import { AlertTriangle, Info, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const COMPETENCY_OVERLAY_LEVELS = {
    drawer: "z-[40]",
    detail: "z-[60]",
    modal: "z-[70]",
    confirmation: "z-[90]",
} as const;

export const controlClass =
    "app-control [color-scheme:light] read-only:bg-slate-50 read-only:text-slate-600 disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-100 disabled:[-webkit-text-fill-color:#64748b]";
export const primaryButtonClass =
    "app-button app-button-primary disabled:bg-amber-200 disabled:text-amber-700 disabled:opacity-100";
export const secondaryButtonClass =
    "app-button disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100";
export const dangerButtonClass =
    "app-button app-button-danger";

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
            className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-bold ${statusStyles[value] ?? "bg-slate-100 text-slate-600"}`}
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
            <span className="w-10 text-right text-[10px] font-bold tabular-nums text-slate-600">
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
        <div className="flex min-w-0 items-center gap-2.5">
            <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: colorForId(person.id) }}
            >
                {initialsFor(person.fullName)}
            </div>
            <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-800">
                    {person.fullName}
                </p>
                <p className="truncate text-[9px] text-slate-400">
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
            className={`app-card flex h-full min-w-0 flex-col ${className}`}
        >
            <div className="app-card-header items-start">
                <div>
                    <h2 className="text-sm font-bold text-slate-900">
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
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
        <div className="flex min-h-44 flex-1 flex-col justify-center px-4 py-8 text-center">
            <Icon className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">{title}</p>
            {description && (
                <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">
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
            panelClassName="!bg-white dark:!bg-slate-900 [color-scheme:light] dark:[color-scheme:dark]"
            rootClassName={COMPETENCY_OVERLAY_LEVELS[layer]}
            ariaLabel={title}
        >
            <div
                data-overlay-part="scroll-body"
                className="max-h-[calc(100dvh-3rem)] touch-pan-y overflow-y-auto overscroll-contain bg-white text-slate-900 [color-scheme:light] dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {title}
                        </h2>
                        {description && (
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
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
    headerContent,
    blocked = false,
    variant = "light",
    maxWidthClassName = "sm:max-w-[800px]",
    presentation = "drawer",
}: {
    show: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    eyebrow?: string;
    headerContent?: ReactNode;
    blocked?: boolean;
    variant?: "dark" | "light";
    maxWidthClassName?: string;
    presentation?: "drawer" | "modal";
}) {
    const drawerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!show || blocked) return;
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const root = drawerRef.current;
        root?.querySelector<HTMLElement>('button')?.focus();
        const handleKey = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            if (event.key !== 'Tab' || !root) return;
            const controls = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(element => element.getAttribute('aria-hidden') !== 'true');
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', handleKey);
        return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
    }, [show, blocked]);
    if (!show) return null;
    const centered = presentation === "modal";
    return createPortal(
        <div
            ref={drawerRef}
            data-overlay-root={centered ? "modal" : "drawer"}
            className={`pointer-events-none fixed inset-0 ${centered ? COMPETENCY_OVERLAY_LEVELS.detail : COMPETENCY_OVERLAY_LEVELS.drawer} ${centered ? "flex items-center justify-center p-4 sm:p-6 lg:p-8" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            inert={blocked}
            aria-hidden={blocked || undefined}
        >
            <div
                data-overlay-part={centered ? "backdrop" : "drawer-backdrop"}
                className="pointer-events-auto absolute inset-0 z-0 cursor-default bg-slate-950/55 backdrop-blur-[1px]"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                data-overlay-part={centered ? "panel" : "drawer-panel"}
                className={`pointer-events-auto z-10 flex w-full max-w-full flex-col bg-white text-slate-900 shadow-2xl [color-scheme:light] dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark] ${maxWidthClassName} ${centered ? "relative max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200" : "absolute inset-y-0 right-0 animate-in slide-in-from-right-full duration-200"}`}
            >
                <div
                    className={`relative shrink-0 border-b px-5 pb-4 pt-5 sm:px-6 sm:pt-6 ${
                        variant === "light"
                            ? "border-slate-200 bg-white text-slate-900"
                            : "border-white/10 bg-[#1a1d21] text-white"
                    }`}
                >
                    <div className="flex items-center justify-between gap-3">
                        <p
                            className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                                variant === "light" ? "text-slate-500" : "text-[#F4B400]"
                            }`}
                        >
                            {eyebrow}
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className={`shrink-0 rounded-lg border border-transparent p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] ${
                                variant === "light"
                                    ? "text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                            }`}
                            aria-label="Close details"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    {headerContent ? (
                        headerContent
                    ) : (
                        <>
                            <h2
                                className={`mt-3 text-lg font-extrabold leading-tight ${
                                    variant === "light" ? "text-slate-950" : "text-white"
                                }`}
                            >
                                {title}
                            </h2>
                            {description && (
                                <p
                                    className={`mt-1.5 max-w-2xl text-xs leading-5 ${
                                        variant === "light" ? "text-slate-500" : "text-slate-400"
                                    }`}
                                >
                                    {description}
                                </p>
                            )}
                        </>
                    )}
                </div>
                {!centered && footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-b border-slate-200 bg-white px-5 py-3 sm:px-6">{footer}</div>}
                <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${centered ? "bg-white" : "bg-slate-50"}`}>
                    {children}
                </div>
                {centered && footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:px-6">{footer}</div>}

            </div>
        </div>, document.body
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
