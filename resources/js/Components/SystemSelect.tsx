import { Check, ChevronDown } from 'lucide-react';
import {
    Children,
    KeyboardEvent as ReactKeyboardEvent,
    ReactElement,
    ReactNode,
    SelectHTMLAttributes,
    isValidElement,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

type OptionItem = {
    value: string;
    label: ReactNode;
    labelText: string;
    disabled: boolean;
    group?: string;
};

type SystemSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    menuLabel?: string;
    maxVisibleOptions?: number;
    triggerClassName?: string;
};

const ITEM_HEIGHT = 36;
const MENU_PADDING = 12;
const VIEWPORT_GUTTER = 12;
const MENU_OFFSET = 6;
const MAX_Z_INDEX = 2147483000;

function textFromNode(node: ReactNode): string {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textFromNode).join('');
    if (isValidElement(node)) return textFromNode((node.props as { children?: ReactNode }).children);
    return '';
}

function collectOptions(children: ReactNode, group?: string): OptionItem[] {
    const result: OptionItem[] = [];

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;

        if (child.type === 'option') {
            const props = child.props as {
                value?: string | number;
                disabled?: boolean;
                children?: ReactNode;
            };
            const label = props.children;
            const labelText = textFromNode(label).trim();
            result.push({
                value: String(props.value ?? labelText),
                label,
                labelText,
                disabled: Boolean(props.disabled),
                group,
            });
            return;
        }

        if (child.type === 'optgroup') {
            const props = child.props as { label?: string; children?: ReactNode };
            result.push(...collectOptions(props.children, props.label));
            return;
        }

        const props = child.props as { children?: ReactNode };
        if (props.children !== undefined) {
            result.push(...collectOptions(props.children, group));
        }
    });

    return result;
}



function pluralizeContextLabel(raw: string): string {
    const cleaned = raw
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/^filter by\s+/i, '')
        .replace(/\s+filter$/i, '')
        .replace(/\s+dropdown$/i, '')
        .trim();
    if (!cleaned) return 'All Options';

    const key = cleaned.toLowerCase();
    const known: Record<string, string> = {
        'department': 'Departments',
        'departments': 'Departments',
        'course': 'Courses',
        'courses': 'Courses',
        'course version': 'Course Versions',
        'course versions': 'Course Versions',
        'position': 'Positions',
        'positions': 'Positions',
        'person type': 'Person Types',
        'person types': 'Person Types',
        'assignment source': 'Assignment Sources',
        'assignment sources': 'Assignment Sources',
        'status': 'Statuses',
        'assessment status': 'Assessment Statuses',
        'competency': 'Competencies',
        'competencies': 'Competencies',
        'category': 'Categories',
        'categories': 'Categories',
        'recognition category': 'Recognition Categories',
        'criticality': 'Criticality Levels',
        'coverage': 'Coverage Levels',
        'role profile': 'Role Profiles',
        'role profile and version': 'Role Profiles & Versions',
        'assessment cycle': 'Assessment Cycles',
        'program': 'Programs',
        'session': 'Sessions',
        'event': 'Events',
        'event type': 'Event Types',
        'role': 'Roles',
        'source': 'Sources',
        'type': 'Types',
        'priority': 'Priorities',
        'year': 'Years',
    };
    if (known[key]) return `All ${known[key]}`;
    if (/\ball\b/i.test(cleaned)) return cleaned;
    if (cleaned.endsWith('s')) return `All ${cleaned}`;
    if (/[^aeiou]y$/i.test(cleaned)) return `All ${cleaned.slice(0, -1)}ies`;
    return `All ${cleaned}s`;
}

function contextualOptionText(option: OptionItem | undefined, context?: string): string {
    if (!option) return context || 'Select';
    const label = option.labelText.trim();
    if (/^all$/i.test(label)) return pluralizeContextLabel(context ?? 'Options');
    return label || context || 'Select';
}

function MarqueeText({
    text,
    active = false,
    className = '',
}: {
    text: string;
    active?: boolean;
    className?: string;
}) {
    const viewportRef = useRef<HTMLSpanElement>(null);
    const contentRef = useRef<HTMLSpanElement>(null);
    const [overflow, setOverflow] = useState(0);
    const [hovered, setHovered] = useState(false);

    useLayoutEffect(() => {
        const measure = () => {
            const viewport = viewportRef.current;
            const content = contentRef.current;
            if (!viewport || !content) return;
            setOverflow(Math.max(0, content.scrollWidth - viewport.clientWidth));
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        if (viewportRef.current) observer.observe(viewportRef.current);
        if (contentRef.current) observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [text]);

    const moving = overflow > 6 && (hovered || active);
    const duration = Math.max(3.6, Math.min(12, 2.8 + overflow / 24));
    const style = moving
        ? ({
            '--system-marquee-distance': `-${overflow}px`,
            animation: `system-select-marquee ${duration}s ease-in-out infinite alternate`,
        } as CSSProperties)
        : undefined;

    return (
        <span
            ref={viewportRef}
            className={`block min-w-0 overflow-hidden whitespace-nowrap ${className}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span ref={contentRef} className="inline-block min-w-max will-change-transform" style={style}>
                {text}
            </span>
        </span>
    );
}

function layoutClassFromOriginal(className = ''): string {
    const tokens = className.split(/\s+/).filter(Boolean);
    const keep = tokens.filter((token) =>
        /^(w-|min-w-|max-w-|mt-|mb-|ml-|mr-|mx-|my-|self-|justify-self-|col-span-|sm:|md:|lg:|xl:|2xl:)/.test(token),
    );
    return keep.join(' ');
}

export default function SystemSelect({
    children,
    className = '',
    menuLabel,
    maxVisibleOptions = 8,
    triggerClassName = '',
    disabled,
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    id,
    'aria-label': ariaLabel,
    title,
    ...selectProps
}: SystemSelectProps) {
    const generatedId = useId();
    const nativeId = id ?? `system-select-${generatedId.replace(/:/g, '')}`;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const nativeRef = useRef<HTMLSelectElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hoverCloseTimerRef = useRef<number | null>(null);
    const options = useMemo(() => collectOptions(children), [children]);
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? options[0]?.value ?? ''));
    const selectedValue = String(isControlled ? value ?? '' : internalValue);
    const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];
    const selectContext = String(menuLabel ?? ariaLabel ?? title ?? selectProps.name ?? id ?? 'Options');
    const selectedLabel = contextualOptionText(selectedOption, selectContext);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === selectedValue)));
    const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number }>({
        left: VIEWPORT_GUTTER,
        top: VIEWPORT_GUTTER,
        width: 180,
        maxHeight: ITEM_HEIGHT * maxVisibleOptions + MENU_PADDING,
    });
    const [scrollState, setScrollState] = useState({ canUp: false, canDown: options.length > maxVisibleOptions });

    const layoutClass = layoutClassFromOriginal(className);
    const fullWidth = /(^|\s)(w-full|flex-1)(\s|$)/.test(className) || /(^|\s)(w-full|flex-1)(\s|$)/.test(triggerClassName);
    const visibleCount = Math.max(1, Math.min(maxVisibleOptions, options.length || 1));
    const desiredMenuHeight = visibleCount * ITEM_HEIGHT + MENU_PADDING;

    const updatePosition = () => {
        const trigger = triggerRef.current;
        if (!trigger || typeof window === 'undefined') return;

        const rect = trigger.getBoundingClientRect();
        const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_GUTTER - MENU_OFFSET;
        const availableAbove = rect.top - VIEWPORT_GUTTER - MENU_OFFSET;
        const openAbove = availableBelow < Math.min(desiredMenuHeight, 220) && availableAbove > availableBelow;
        const maxHeight = Math.max(108, Math.min(desiredMenuHeight, openAbove ? availableAbove : availableBelow));
        const desiredWidth = Math.max(rect.width, 176);
        const width = Math.min(desiredWidth, window.innerWidth - VIEWPORT_GUTTER * 2);
        const left = Math.min(
            Math.max(VIEWPORT_GUTTER, rect.left),
            Math.max(VIEWPORT_GUTTER, window.innerWidth - width - VIEWPORT_GUTTER),
        );

        setPosition(
            openAbove
                ? {
                    left,
                    bottom: window.innerHeight - rect.top + MENU_OFFSET,
                    width,
                    maxHeight,
                }
                : {
                    left,
                    top: rect.bottom + MENU_OFFSET,
                    width,
                    maxHeight,
                },
        );
    };

    const updateScrollState = () => {
        const node = scrollRef.current;
        if (!node) return;
        const tolerance = 2;
        setScrollState({
            canUp: node.scrollTop > tolerance,
            canDown: node.scrollTop + node.clientHeight < node.scrollHeight - tolerance,
        });
    };

    useEffect(() => {
        if (!open) return;
        updatePosition();
        const handler = () => updatePosition();
        window.addEventListener('resize', handler);
        window.addEventListener('scroll', handler, true);
        return () => {
            window.removeEventListener('resize', handler);
            window.removeEventListener('scroll', handler, true);
        };
    }, [open, desiredMenuHeight]);

    useEffect(() => {
        if (!open) return;
        const index = Math.max(0, options.findIndex((option) => option.value === selectedValue));
        setActiveIndex(index);
        requestAnimationFrame(() => {
            const node = scrollRef.current;
            const active = node?.querySelector<HTMLElement>(`[data-system-option-index="${index}"]`);
            active?.scrollIntoView({ block: 'nearest' });
            updateScrollState();
        });
    }, [open, options, selectedValue]);

    useEffect(() => {
        if (isControlled) return;
        if (!options.some((option) => option.value === internalValue)) {
            setInternalValue(String(defaultValue ?? options[0]?.value ?? ''));
        }
    }, [defaultValue, internalValue, isControlled, options]);

    const cancelHoverClose = () => {
        if (hoverCloseTimerRef.current) {
            window.clearTimeout(hoverCloseTimerRef.current);
            hoverCloseTimerRef.current = null;
        }
    };

    const scheduleHoverClose = () => {
        if (typeof window === 'undefined') return;
        cancelHoverClose();
        hoverCloseTimerRef.current = window.setTimeout(() => {
            setOpen(false);
            hoverCloseTimerRef.current = null;
        }, 160);
    };

    useEffect(() => () => cancelHoverClose(), []);

    const choose = (option: OptionItem) => {
        if (option.disabled || disabled) return;
        const native = nativeRef.current;
        if (!native) return;

        if (!isControlled) setInternalValue(option.value);
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        if (setter) setter.call(native, option.value);
        else native.value = option.value;
        native.dispatchEvent(new Event('change', { bubbles: true }));
        cancelHoverClose();
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
    };

    const moveActive = (direction: 1 | -1) => {
        if (!options.length) return;
        let next = activeIndex;
        for (let attempts = 0; attempts < options.length; attempts += 1) {
            next = (next + direction + options.length) % options.length;
            if (!options[next]?.disabled) break;
        }
        setActiveIndex(next);
        requestAnimationFrame(() => {
            scrollRef.current
                ?.querySelector<HTMLElement>(`[data-system-option-index="${next}"]`)
                ?.scrollIntoView({ block: 'nearest' });
            updateScrollState();
        });
    };

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveActive(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveActive(-1);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open) setOpen(true);
            else if (options[activeIndex]) choose(options[activeIndex]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        } else if (event.key === 'Home' && open) {
            event.preventDefault();
            setActiveIndex(0);
        } else if (event.key === 'End' && open) {
            event.preventDefault();
            setActiveIndex(Math.max(0, options.length - 1));
        }
    };

    const menu = open && typeof document !== 'undefined'
        ? createPortal(
            <>
                <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="fixed inset-0 cursor-default bg-transparent"
                    style={{ zIndex: MAX_Z_INDEX - 1 }}
                    onMouseDown={() => setOpen(false)}
                />
                <div
                    ref={menuRef}
                    role="listbox"
                    aria-label={menuLabel ?? String(ariaLabel ?? title ?? 'Select options')}
                    className="pd-theme-portal fixed overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-950/20"
                    style={{
                        zIndex: MAX_Z_INDEX,
                        left: position.left,
                        top: position.top,
                        bottom: position.bottom,
                        width: position.width,
                        maxWidth: `calc(100vw - ${VIEWPORT_GUTTER * 2}px)`,
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onMouseEnter={cancelHoverClose}
                    onMouseLeave={scheduleHoverClose}
                >
                    <div className="relative overflow-hidden rounded-lg">
                        {scrollState.canUp && (
                            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-white via-white/90 via-45% to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)]" />
                        )}
                        <div
                            ref={scrollRef}
                            className="system-dropdown-scroll overscroll-contain"
                            style={{ maxHeight: position.maxHeight, overflowY: options.length > maxVisibleOptions || desiredMenuHeight > position.maxHeight ? 'auto' : 'hidden' }}
                            onScroll={updateScrollState}
                        >
                            {options.map((option, index) => {
                                const active = option.value === selectedValue;
                                const highlighted = index === activeIndex;
                                const showGroup = option.group && (index === 0 || options[index - 1]?.group !== option.group);
                                return (
                                    <div key={`${option.group ?? ''}:${option.value}:${index}`}>
                                        {showGroup && (
                                            <div className="px-3 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                                                {option.group}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            data-system-option-index={index}
                                            disabled={option.disabled}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onClick={() => choose(option)}
                                            className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition ${active
                                                ? 'bg-[#F4B400]/14 font-bold text-amber-900'
                                                : highlighted
                                                    ? 'bg-slate-50 font-semibold text-slate-900'
                                                    : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            } disabled:cursor-not-allowed disabled:opacity-40`}
                                        >
                                            <MarqueeText text={contextualOptionText(option, selectContext)} active={highlighted} className="flex-1" />
                                            {active && <Check className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {scrollState.canDown && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-11 bg-gradient-to-t from-white via-white/90 via-45% to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black_0%,black_58%,transparent_100%)]" />
                        )}
                    </div>
                </div>
            </>,
            document.body,
        )
        : null;

    return (
        <span className={`inline-block min-w-0 align-middle ${fullWidth ? 'w-full' : ''} ${layoutClass}`}>
            <select
                {...selectProps}
                id={nativeId}
                ref={nativeRef}
                value={value}
                defaultValue={defaultValue}
                disabled={disabled}
                onChange={onChange}
                onBlur={onBlur}
                onFocus={onFocus}
                aria-label={ariaLabel}
                title={title}
                className="sr-only"
                tabIndex={-1}
            >
                {children}
            </select>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`${String(ariaLabel ?? menuLabel ?? selectedLabel)} dropdown`}
                title={title ?? selectedLabel}
                onClick={() => setOpen((current) => !current)}
                onMouseEnter={() => {
                    if (disabled) return;
                    cancelHoverClose();
                    setOpen(true);
                }}
                onMouseLeave={scheduleHoverClose}
                onFocus={cancelHoverClose}
                onKeyDown={handleKeyDown}
                className={`inline-flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg border px-3 text-left text-xs font-semibold outline-none transition ${fullWidth ? 'w-full' : 'min-w-[9rem]'} ${open
                    ? 'border-[#F4B400] bg-amber-50/70 text-slate-900 ring-2 ring-[#F4B400]/20'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:border-[#F4B400] focus-visible:ring-2 focus-visible:ring-[#F4B400]/20'
                } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 ${triggerClassName}`}
            >
                <MarqueeText text={selectedLabel} active={open} className="flex-1" />
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-amber-600' : ''}`} />
            </button>
            {menu}
        </span>
    );
}
