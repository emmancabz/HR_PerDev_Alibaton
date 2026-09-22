import SystemSelect from '@/Components/SystemSelect';
import {
    ChartDateRangeControl,
    DEFAULT_CHART_DATE_RANGE,
    dateFallsInChartRange,
    resolveChartDateRange,
    type ChartDateRangeValue,
} from "@/Components/ChartDateRange";
import { HeaderFilters } from "@/Layouts/AuthenticatedLayout";
import {
    AppModal,
    ConfirmDialog,
    controlClass,
    EmptyState,
    PersonCell,
    primaryButtonClass,
    ProgressBar,
    SectionCard,
    secondaryButtonClass,
    StatusBadge,
} from "@/Components/Competency/CompetencyUI";
import {
    COMPETENCY_CATEGORIES,
    PROFICIENCY_LEVELS,
    proficiencyLabel,
    type AssessmentStatus,
    type CompetencyCategory,
    type CompetencyState,
} from "@/data/competency";
import {
    buildAssessmentAutomationExceptions,
    buildAssessmentRows,
    buildCompetencyAnalytics,
    buildCompetencyProfiles,
    buildGapRows,
    buildDevelopmentRows,
    buildOverviewMetrics,
    effectiveCycleStatus,
    EMPTY_ANALYTICS_FILTERS,
    filterAssessmentRows,
    formatDate,
    roleProfileVersionKey,
    todayIso,
    type CompetencyAnalyticsFilters,
} from "@/data/competencyCalculations";
import { calculateCycleCompletion } from "@/data/competencyLifecycle";
import { SHARED_PERSONNEL } from "@/data/personnel";
import {
    AlertTriangle,
    BarChart3,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    ClipboardList,
    Eye,
    FileClock,
    FolderKanban,
    GripVertical,
    Library,
    Search,
    ShieldCheck,
    Target,
    UserCheck,
    Users,
    Wrench,
    X,
    type LucideIcon,
} from "lucide-react";
import {
    Children,
    Fragment,
    isValidElement,
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type KeyboardEvent,
    type ReactNode,
} from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

function activateRow(
    event: KeyboardEvent<HTMLTableRowElement>,
    action: () => void,
) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
    }
}

function Filters({
    children,
    onReset,
    active,
}: {
    children: ReactNode;
    onReset: () => void;
    active: boolean;
}) {
    // Phase 8: table/workspace filters live in the shared header.
    // Local text-search controls are intentionally omitted so the app keeps
    // one system-wide search bar: the global search in AuthenticatedLayout.
    const items = Children.toArray(children);
    const headerControls = items.filter(
        (child) => !(isValidElement(child) && (child.type === SearchBox || child.type === "button")),
    );
    const pageActions = items.filter(
        (child) => isValidElement(child) && child.type === "button",
    );

    return (
        <>
            <HeaderFilters active={active} onReset={onReset}>
                {headerControls}
            </HeaderFilters>
            {pageActions.length > 0 && (
                <div className="flex w-full flex-wrap items-center justify-end gap-2">
                    {pageActions}
                </div>
            )}
        </>
    );
}

function SearchBox({
    value,
    onChange,
    placeholder = "Search records…",
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="relative min-w-52 flex-1 sm:max-w-xs">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className={`${controlClass} pl-9`}
            />
        </label>
    );
}

function usePagination<T>(rows: T[], pageSize = 10) {
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    useEffect(
        () => setPage((current) => Math.min(current, pageCount)),
        [pageCount],
    );
    return {
        page,
        pageCount,
        setPage,
        pageRows: rows.slice((page - 1) * pageSize, page * pageSize),
        pageSize,
    };
}

function buildPaginationItems(page: number, pageCount: number): Array<number | string> {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

    const items: Array<number | string> = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(pageCount - 1, page + 1);

    if (start > 2) items.push("ellipsis-start");
    for (let value = start; value <= end; value += 1) items.push(value);
    if (end < pageCount - 1) items.push("ellipsis-end");
    items.push(pageCount);

    return items;
}

function TablePadding({ count, columns }: { count: number; columns: number }) {
    return <>{Array.from({ length: Math.max(0, 10 - count) }, (_, index) => <tr key={`padding-${index}`} aria-hidden="true" className="h-[60px] border-b border-slate-100"><td colSpan={columns} /></tr>)}</>;
}

function Pagination({
    page,
    pageCount,
    total,
    pageSize,
    onPage,
}: {
    page: number;
    pageCount: number;
    total: number;
    pageSize: number;
    onPage: (page: number) => void;
}) {
    if (total <= pageSize) return null;
    const first = (page - 1) * pageSize + 1;
    const last = Math.min(total, page * pageSize);
    const items = buildPaginationItems(page, pageCount);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-2.5 text-xs text-slate-500">
            <span>
                Showing {first}–{last} of {total}
            </span>
            <nav aria-label="Table pagination" className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => onPage(page - 1)}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                >
                    Previous
                </button>
                {items.map((item) =>
                    typeof item === "number" ? (
                        <button
                            key={item}
                            type="button"
                            aria-label={`Go to page ${item}`}
                            aria-current={item === page ? "page" : undefined}
                            onClick={() => onPage(item)}
                            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[11px] font-bold tabular-nums transition ${
                                item === page
                                    ? "border-amber-400 bg-amber-50 text-amber-800"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                            {item}
                        </button>
                    ) : (
                        <span key={item} className="inline-flex h-8 min-w-5 items-center justify-center text-slate-400" aria-hidden="true">
                            …
                        </span>
                    ),
                )}
                <button
                    type="button"
                    disabled={page === pageCount}
                    onClick={() => onPage(page + 1)}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                >
                    Next
                </button>
            </nav>
        </div>
    );
}

const categoryColors: Record<CompetencyCategory, string> = {
    "Core & Behavioral": "#f59e0b",
    "Functional & Technical": "#0ea5e9",
    "Safety & Compliance": "#ef4444",
    "Leadership & Supervisory": "#8b5cf6",
    "Digital & Analytical": "#10b981",
};

export function OverviewView({
    state,
    onNavigate,
    onSelectAssessment,
}: {
    state: CompetencyState;
    onNavigate: (
        tab: "People" | "Assessments" | "Development",
        focus: string,
    ) => void;
    onSelectAssessment: (id: string) => void;
}) {
    const metrics = useMemo(() => buildOverviewMetrics(state), [state]);
    const profiles = useMemo(() => buildCompetencyProfiles(state), [state]);
    const mappedProfiles = profiles.filter((row) => row.profile);
    const activePersonnel = profiles.length;
    const roleProfileCoverage = activePersonnel
        ? Math.round((mappedProfiles.length / activePersonnel) * 100)
        : 0;
    const requirementsMet = mappedProfiles.filter(
        (row) =>
            row.requirements.length > 0 &&
            row.openGaps === 0 &&
            row.notAssessed === 0 &&
            !row.requirements.some((detail) => detail.reassessmentDue),
    ).length;
    const peopleWithGaps = mappedProfiles.filter((row) => row.openGaps > 0).length;
    const assessmentIncomplete = mappedProfiles.filter(
        (row) => row.notAssessed > 0,
    ).length;
    const notAssessedRequirements = mappedProfiles.reduce(
        (sum, row) => sum + row.notAssessed,
        0,
    );

    const requirementDistribution = [
        {
            name: "Meets / Exceeds",
            value: mappedProfiles.reduce(
                (sum, row) => sum + row.meetsOrExceeds,
                0,
            ),
            color: "#10b981",
        },
        {
            name: "Below Required",
            value: mappedProfiles.reduce((sum, row) => sum + row.openGaps, 0),
            color: "#ef4444",
        },
        {
            name: "Not Assessed",
            value: notAssessedRequirements,
            color: "#94a3b8",
        },
    ];

    const departmentCoverage = useMemo(() => {
        const grouped = new Map<
            string,
            { department: string; total: number; mapped: number }
        >();
        profiles.forEach((row) => {
            const current = grouped.get(row.person.department) ?? {
                department: row.person.department,
                total: 0,
                mapped: 0,
            };
            current.total += 1;
            if (row.profile) current.mapped += 1;
            grouped.set(row.person.department, current);
        });
        return [...grouped.values()]
            .map((row) => ({
                ...row,
                missing: row.total - row.mapped,
                coverage: row.total
                    ? Math.round((row.mapped / row.total) * 100)
                    : 0,
            }))
            .sort(
                (a, b) =>
                    b.missing - a.missing ||
                    a.department.localeCompare(b.department),
            );
    }, [profiles]);

    const attentionRows = useMemo(() => {
        return profiles
            .map((row) => {
                const criticalGaps = row.requirements.filter(
                    (detail) =>
                        detail.result === "Below Requirement" &&
                        detail.requirement.critical,
                ).length;
                const reassessmentDue = row.requirements.filter(
                    (detail) => detail.reassessmentDue,
                ).length;
                const firstCriticalGapId = metrics.criticalGaps.find(
                    (gap) => gap.person.id === row.person.id,
                )?.id;

                if (!row.profile) {
                    return {
                        row,
                        priority: 1,
                        status: "Role Profile Missing",
                        detail: "No active role requirements are mapped to this current position.",
                        actionLabel: "Open profile",
                        gapId: undefined,
                    };
                }
                if (criticalGaps > 0) {
                    return {
                        row,
                        priority: 5,
                        status: "Critical Competency Gap",
                        detail: `${criticalGaps} critical · ${row.openGaps} open gap${row.openGaps === 1 ? "" : "s"}`,
                        actionLabel: "Open gap",
                        gapId: firstCriticalGapId,
                    };
                }
                if (row.openGaps > 0) {
                    return {
                        row,
                        priority: 4,
                        status: "Competency Gap",
                        detail: `${row.openGaps} role requirement${row.openGaps === 1 ? "" : "s"} below the required level`,
                        actionLabel: "Open profile",
                        gapId: undefined,
                    };
                }
                if (reassessmentDue > 0) {
                    return {
                        row,
                        priority: 3,
                        status: "Reassessment Due",
                        detail: `${reassessmentDue} validated requirement${reassessmentDue === 1 ? "" : "s"} due for refresh`,
                        actionLabel: "Open profile",
                        gapId: undefined,
                    };
                }
                if (row.notAssessed > 0) {
                    return {
                        row,
                        priority: 2,
                        status: "Assessment Incomplete",
                        detail: `${row.notAssessed} mapped requirement${row.notAssessed === 1 ? "" : "s"} not yet validated`,
                        actionLabel: "Open profile",
                        gapId: undefined,
                    };
                }
                return null;
            })
            .filter(
                (item): item is NonNullable<typeof item> => item !== null,
            )
            .sort(
                (a, b) =>
                    b.priority - a.priority ||
                    a.row.person.fullName.localeCompare(b.row.person.fullName),
            );
    }, [metrics.criticalGaps, profiles]);

    const cards = [
        {
            key: "coverage",
            label: "Role Profile Coverage",
            value: `${mappedProfiles.length}/${activePersonnel}`,
            meta: `${roleProfileCoverage}% of current personnel have active role requirements`,
            icon: FolderKanban,
            action: () =>
                onNavigate(
                    "People",
                    mappedProfiles.length === activePersonnel
                        ? "All"
                        : "Profile Not Assigned",
                ),
        },
        {
            key: "met",
            label: "Requirements Met",
            value: requirementsMet,
            meta: "People with complete, current validated role requirements",
            icon: ShieldCheck,
            action: () => onNavigate("People", "Requirements Met"),
        },
        {
            key: "gaps",
            label: "People with Competency Gaps",
            value: peopleWithGaps,
            meta: `${metrics.criticalGaps.length} critical validated requirement gap${metrics.criticalGaps.length === 1 ? "" : "s"}`,
            icon: AlertTriangle,
            action: () => onNavigate("Development", "open"),
        },
        {
            key: "incomplete",
            label: "Assessment Incomplete",
            value: assessmentIncomplete,
            meta: `${notAssessedRequirements} mapped role requirement${notAssessedRequirements === 1 ? "" : "s"} still Not Assessed`,
            icon: FileClock,
            action: () => onNavigate("People", "Assessment Incomplete"),
        },
    ];

    const attentionPagination = usePagination(attentionRows);
    const [selectedAttentionPersonId, setSelectedAttentionPersonId] = useState<string | null>(null);
    const selectedAttentionItem =
        attentionRows.find((item) => item.row.person.id === selectedAttentionPersonId) ?? null;

    const openPeople = (focus = "All") => {
        onNavigate("People", focus);
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            onClick={card.action}
                            className="app-kpi-card group relative min-h-[108px] w-full p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-semibold text-slate-500">
                                        {card.label}
                                    </p>
                                    <p className="mt-1.5 truncate text-xl font-extrabold tabular-nums tracking-tight text-slate-950">
                                        {card.value}
                                    </p>
                                </div>
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
                                {card.meta}
                            </p>
                        </button>
                    );
                })}
            </div>

            <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className="h-full">
                    <SectionCard
                        title="Workforce Capability Snapshot"
                        description="Finalized competency results compared with active role requirements for current personnel."
                        action={
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                                {mappedProfiles.length}/{activePersonnel} mapped
                            </span>
                        }
                    >
                        <div className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Validated Role Requirements
                                    </p>
                                    <h3 className="mt-1 text-sm font-extrabold text-slate-900">
                                        Current capability distribution
                                    </h3>
                                </div>
                            </div>
                            <div className="mt-2">
                                <DonutBreakdown
                                    data={requirementDistribution.map((item) => ({
                                        label: item.name,
                                        value: item.value,
                                        color: item.color,
                                    }))}
                                    totalLabel="Mapped requirements"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 border-t border-slate-100">
                            {requirementDistribution.map((item, index) => (
                                <div
                                    key={item.name}
                                    className={`px-3 py-3 ${index > 0 ? "border-l border-slate-100" : ""}`}
                                >
                                    <p className="text-base font-extrabold tabular-nums text-slate-950">
                                        {item.value}
                                    </p>
                                    <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-500">
                                        {item.name}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-slate-100 px-4 py-2.5 text-[10px] leading-4 text-slate-500">
                            Missing validation remains <span className="font-semibold text-slate-700">Not Assessed</span>. Performance ratings and LMS scores never become official proficiency levels.
                        </div>
                    </SectionCard>
                </div>

                <div className="h-full">
                    <SectionCard
                        title="Role Profile Coverage by Department"
                        description="Current personnel coverage. Role profile mapping is separate from assessment completion."
                        action={
                            <button
                                type="button"
                                onClick={() => openPeople("All")}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/50"
                            >
                                Open People
                            </button>
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px] table-fixed">
                                <thead className="border-b border-slate-200 bg-slate-50">
                                    <tr>
                                        <th className="w-[34%] px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Department</th>
                                        <th className="w-[13%] px-2 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">People</th>
                                        <th className="w-[13%] px-2 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">With Profile</th>
                                        <th className="w-[13%] px-2 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">Missing</th>
                                        <th className="w-[27%] px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Coverage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {departmentCoverage.map((row) => (
                                        <tr
                                            key={row.department}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                openPeople(`department:${row.department}`)
                                            }
                                            onKeyDown={(event) =>
                                                activateRow(event, () =>
                                                    openPeople(`department:${row.department}`),
                                                )
                                            }
                                            className="cursor-pointer transition hover:bg-amber-50/40 focus:bg-amber-50 focus:outline-none"
                                        >
                                            <td className="px-3 py-2.5">
                                                <p className="truncate text-[10px] font-semibold text-slate-800">{row.department}</p>
                                            </td>
                                            <td className="px-2 py-2.5 text-center text-[10px] font-semibold tabular-nums text-slate-600">{row.total}</td>
                                            <td className="px-2 py-2.5 text-center text-[10px] font-bold tabular-nums text-emerald-700">{row.mapped}</td>
                                            <td className={`px-2 py-2.5 text-center text-[10px] font-bold tabular-nums ${row.missing > 0 ? "text-rose-600" : "text-emerald-700"}`}>{row.missing}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                                                        <div
                                                            className="h-full rounded-full bg-[#F4B400] transition-all"
                                                            style={{ width: `${Math.min(100, Math.max(0, row.coverage))}%` }}
                                                        />
                                                    </div>
                                                    <span className={`w-8 shrink-0 text-right text-[9px] font-extrabold tabular-nums ${row.coverage === 100 ? "text-emerald-700" : row.coverage > 0 ? "text-amber-700" : "text-slate-400"}`}>
                                                        {row.coverage}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-auto border-t border-slate-100 px-4 py-2.5 text-[10px] leading-4 text-slate-500">
                            Role-profile coverage shows whether current positions have active competency requirements. Assessment completion is tracked separately.
                        </div>
                    </SectionCard>
                </div>
            </div>

            <SectionCard
                title="Competency Attention Queue"
                description="Capability issues first: critical gaps, open gaps, reassessment due, incomplete validation, then missing role profiles."
                action={
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        {attentionRows.length} requiring attention
                    </span>
                }
            >
                {attentionRows.length ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] table-fixed divide-y divide-slate-100">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="w-[20%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Person</th>
                                        <th className="w-[18%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Role</th>
                                        <th className="w-[21%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Role Profile</th>
                                        <th className="w-[18%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Capability</th>
                                        <th className="w-[19%] px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Concern</th>
                                        <th className="w-[4%] px-4 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            <span className="sr-only">Expand</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {attentionPagination.pageRows.map((item) => {
                                        const selected = selectedAttentionPersonId === item.row.person.id;
                                        return (
                                            <Fragment key={item.row.person.id}>
                                                <tr
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-haspopup="dialog"
                                                    aria-current={selected ? "true" : undefined}
                                                    onClick={() => setSelectedAttentionPersonId(item.row.person.id)}
                                                    onKeyDown={(event) =>
                                                        activateRow(event, () => setSelectedAttentionPersonId(item.row.person.id))
                                                    }
                                                    className={`group cursor-pointer transition hover:bg-amber-50/50 focus:bg-amber-50 focus:outline-none ${selected ? "bg-amber-50/40" : ""}`}
                                                >
                                                    <td className="px-4 py-2.5">
                                                        <PersonCell
                                                            person={item.row.person}
                                                            subtitle={item.row.person.employeeOrTraineeId}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <p className="truncate text-[10px] font-semibold text-slate-700">
                                                            {item.row.person.position}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-[9px] text-slate-400">
                                                            {item.row.person.department}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        {item.row.profile ? (
                                                            <>
                                                                <p className="truncate text-[10px] font-semibold text-slate-700">
                                                                    {item.row.profile.name}
                                                                </p>
                                                                <p className="mt-0.5 truncate text-[9px] text-slate-400">
                                                                    v{item.row.profile.version} · {item.row.requirements.length} requirements
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold text-slate-400">
                                                                Not assigned
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        {item.row.profile ? (
                                                            <p className="truncate text-[10px] text-slate-600">
                                                                <span className="font-bold text-emerald-700">{item.row.meetsOrExceeds}</span> met · <span className="font-bold text-rose-700">{item.row.openGaps}</span> gaps · <span className="font-bold text-slate-600">{item.row.notAssessed}</span> not assessed
                                                            </p>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400">Awaiting framework mapping</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <p className={`truncate text-[10px] font-bold ${item.priority >= 4 ? "text-rose-700" : item.priority === 3 ? "text-amber-700" : "text-slate-700"}`}>
                                                            {item.status}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-[9px] text-slate-400" title={item.detail}>
                                                            {item.detail}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        <span
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition group-hover:bg-amber-50 group-hover:text-amber-700"
                                                            aria-hidden="true"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </span>
                                                    </td>
                                                </tr>

                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            page={attentionPagination.page}
                            pageCount={attentionPagination.pageCount}
                            total={attentionRows.length}
                            pageSize={attentionPagination.pageSize}
                            onPage={attentionPagination.setPage}
                        />
                    </>
                ) : (
                    <EmptyState
                        icon={ShieldCheck}
                        title="No capability issues requiring attention"
                        description="All mapped role requirements are current and validated."
                    />
                )}
            </SectionCard>

            {selectedAttentionItem && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px] sm:p-6 lg:p-8"
                    onMouseDown={() => setSelectedAttentionPersonId(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Competency Details for ${selectedAttentionItem.row.person.fullName}`}
                        onMouseDown={(event) => event.stopPropagation()}
                        className="flex max-h-[90vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-amber-600">Competency Attention</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-extrabold text-slate-950">
                                        {selectedAttentionItem.row.person.fullName}
                                    </h3>
                                    <StatusBadge value={selectedAttentionItem.row.status} />
                                </div>
                                <p className="mt-1 text-[10px] text-slate-500">
                                    {selectedAttentionItem.row.person.position} · {selectedAttentionItem.row.person.department} · {selectedAttentionItem.row.person.personType}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const personId = selectedAttentionItem.row.person.id;
                                        setSelectedAttentionPersonId(null);
                                        onNavigate("People", personId);
                                    }}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50"
                                >
                                    Open in People
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedAttentionPersonId(null)}
                                    className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                                    aria-label="Close competency details"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="space-y-5">
                                <section>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Competency Summary</h4>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500">Read-only governed record</span>
                                    </div>
                                    <div className="overflow-hidden rounded-xl border border-slate-200">
                                        <table className="w-full border-collapse text-left text-[11px]">
                                            <tbody>
                                                <tr className="border-b border-slate-100">
                                                    <th className="w-1/5 bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Personnel</th>
                                                    <td className="w-[30%] px-3 py-2.5 font-semibold text-slate-700">{selectedAttentionItem.row.person.fullName}</td>
                                                    <th className="w-1/5 bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Current Concern</th>
                                                    <td className="w-[30%] px-3 py-2.5 font-semibold text-slate-700">{selectedAttentionItem.status}</td>
                                                </tr>
                                                <tr className="border-b border-slate-100">
                                                    <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Role Profile</th>
                                                    <td className="px-3 py-2.5 font-semibold text-slate-700">
                                                        {selectedAttentionItem.row.profile ? `${selectedAttentionItem.row.profile.name} · v${selectedAttentionItem.row.profile.version}` : "Not assigned"}
                                                    </td>
                                                    <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Capability Status</th>
                                                    <td className="px-3 py-2.5 font-semibold text-slate-700">{selectedAttentionItem.row.status}</td>
                                                </tr>
                                                <tr>
                                                    <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Last Validated</th>
                                                    <td className="px-3 py-2.5 font-semibold text-slate-700">{formatDate(selectedAttentionItem.row.lastAssessed)}</td>
                                                    <th className="bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase text-slate-400">Next Reassessment</th>
                                                    <td className="px-3 py-2.5 font-semibold text-slate-700">{formatDate(selectedAttentionItem.row.nextReassessment)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Capability Snapshot</h4>
                                    <div className="grid gap-2 sm:grid-cols-4">
                                        {[
                                            ["Requirements", selectedAttentionItem.row.profile ? selectedAttentionItem.row.requirements.length.toString() : "—"],
                                            ["Meets / Exceeds", selectedAttentionItem.row.meetsOrExceeds.toString()],
                                            ["Open Gaps", selectedAttentionItem.row.openGaps.toString()],
                                            ["Not Assessed", selectedAttentionItem.row.profile ? selectedAttentionItem.row.notAssessed.toString() : "—"],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3">
                                                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                                                <p className="mt-1 text-sm font-extrabold text-slate-900">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Current Requirements</h4>
                                        <span className="text-[9px] font-semibold text-slate-400">
                                            {selectedAttentionItem.row.profile ? `${selectedAttentionItem.row.requirements.length} mapped requirement${selectedAttentionItem.row.requirements.length === 1 ? "" : "s"}` : "No active role profile"}
                                        </span>
                                    </div>

                                    {!selectedAttentionItem.row.profile ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-6 text-center">
                                            <p className="text-[10px] font-bold text-slate-700">Role requirements are not yet assigned.</p>
                                            <p className="mt-1 text-[10px] leading-4 text-slate-500">Create and activate a matching Role Profile before competency gaps can be calculated.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                                            <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="w-[28%] px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Competency</th>
                                                        <th className="w-[14%] px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Current</th>
                                                        <th className="w-[14%] px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Required</th>
                                                        <th className="w-[17%] px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Result</th>
                                                        <th className="w-[12%] px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">Evidence</th>
                                                        <th className="w-[15%] px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Last Assessed</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {selectedAttentionItem.row.requirements.map((detail) => (
                                                        <tr key={detail.requirement.id}>
                                                            <td className="px-3 py-3">
                                                                <p className="truncate text-[10px] font-bold text-slate-800">
                                                                    {detail.competency?.code ? `${detail.competency.code} · ` : ""}{detail.competency?.name ?? "Competency"}
                                                                </p>
                                                                <p className="mt-0.5 truncate text-[9px] text-slate-400">
                                                                    {detail.requirement.critical ? "Critical requirement" : "Role requirement"}
                                                                    {detail.recommendations.length ? ` · ${detail.recommendations.length} development action${detail.recommendations.length === 1 ? "" : "s"}` : ""}
                                                                </p>
                                                            </td>
                                                            <td className="px-3 py-3 text-[10px] font-semibold text-slate-700">
                                                                {detail.currentLevel ? `L${detail.currentLevel} · ${proficiencyLabel(detail.currentLevel)}` : "Not Assessed"}
                                                            </td>
                                                            <td className="px-3 py-3 text-[10px] font-semibold text-slate-700">
                                                                L{detail.requirement.requiredLevel} · {proficiencyLabel(detail.requirement.requiredLevel)}
                                                            </td>
                                                            <td className="px-3 py-3"><StatusBadge value={detail.result} /></td>
                                                            <td className="px-3 py-3 text-center text-[10px] font-semibold tabular-nums text-slate-600">{detail.evidenceCount}</td>
                                                            <td className="px-3 py-3">
                                                                <p className="text-[10px] text-slate-500">{formatDate(detail.lastAssessed)}</p>
                                                                <p className="mt-0.5 text-[9px] text-slate-400">Reassess: {formatDate(detail.nextReassessment ?? detail.validUntil)}</p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SectionCard
                title="Assessment & Reassessment Watch"
                description={
                    metrics.activeCycles.length
                        ? `Read-only operational watch · ${metrics.activeCycles.map((cycle) => cycle.name).join(" · ")}`
                        : "Read-only operational watch · no active assessment cycle"
                }
                action={
                    <button
                        type="button"
                        onClick={() => onNavigate("Assessments", "Assessment Queue")}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/50"
                    >
                        Open Assessments
                    </button>
                }
            >
                <div className="grid sm:grid-cols-3">
                    {[
                        {
                            label: "Pending HR Validation",
                            value: metrics.pendingValidation.length,
                            note: "Submitted results waiting for governed HR validation",
                            action: () => onNavigate("Assessments", "Pending Validation"),
                            tone: "text-indigo-700",
                        },
                        {
                            label: "Overdue Assessments",
                            value: metrics.overdue.length,
                            note: "Assigned assessments beyond their due date",
                            action: () => onNavigate("Assessments", "Overdue"),
                            tone: "text-rose-700",
                        },
                        {
                            label: "Reassessments Due",
                            value: metrics.reassessments.length,
                            note: "Validated capabilities whose refresh date is due",
                            action: () => openPeople("status:Reassessment Due"),
                            tone: "text-amber-700",
                        },
                    ].map((item, index) => (
                        <button
                            key={item.label}
                            type="button"
                            onClick={item.action}
                            className={`group min-h-[76px] px-3 py-3 text-left transition hover:bg-amber-50/40 focus:outline-none focus-visible:bg-amber-50/60 ${index > 0 ? "border-l border-slate-100" : ""}`}
                        >
                            <p className={`text-lg font-extrabold tabular-nums ${item.tone}`}>{item.value}</p>
                            <p className="mt-0.5 text-[10px] font-bold text-slate-700">{item.label}</p>
                            <p className="mt-1 line-clamp-1 text-[9px] text-slate-400">{item.note}</p>
                        </button>
                    ))}
                </div>

                <div className="grid gap-px border-t border-slate-100 bg-slate-100 xl:grid-cols-2">
                    <div className="bg-white">
                        <div className="border-b border-slate-100 px-4 py-2.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Assessment records requiring review
                            </p>
                            <p className="mt-1 text-[9px] leading-4 text-slate-400">
                                Opens a read-only preview here. Finalization and record changes are completed in Assessments.
                            </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {[...metrics.pendingValidation, ...metrics.overdue]
                                .slice(0, 5)
                                .map((row) => (
                                    <button
                                        type="button"
                                        key={row.assessment.id}
                                        onClick={() => onSelectAssessment(row.assessment.id)}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-amber-50/50"
                                    >
                                        <PersonCell
                                            person={row.person}
                                            subtitle={row.profile?.name ?? "Role profile unavailable"}
                                        />
                                        <div className="shrink-0 text-right">
                                            <StatusBadge value={row.displayStatus} />
                                            <p className="mt-1 text-[9px] text-slate-400">
                                                Due {formatDate(row.assessment.dueDate)}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            {!metrics.pendingValidation.length && !metrics.overdue.length && (
                                <div className="px-4 py-7 text-center">
                                    <ClipboardCheck className="mx-auto h-5 w-5 text-emerald-400" />
                                    <p className="mt-2 text-[10px] font-semibold text-slate-600">No urgent assessment records</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white">
                        <div className="border-b border-slate-100 px-4 py-2.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Validated capabilities due for reassessment
                            </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {metrics.reassessments.slice(0, 5).map(({ row, detail }) => (
                                <button
                                    type="button"
                                    key={`${row.person.id}-${detail.requirement.id}`}
                                    onClick={() => openPeople(`person:${row.person.id}`)}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-amber-50/50"
                                >
                                    <PersonCell
                                        person={row.person}
                                        subtitle={detail.competency?.name}
                                    />
                                    <div className="shrink-0 text-right">
                                        <p className="text-[10px] font-bold text-amber-700">Reassessment Due</p>
                                        <p className="mt-1 text-[9px] text-slate-400">{formatDate(detail.nextReassessment ?? detail.validUntil)}</p>
                                    </div>
                                </button>
                            ))}
                            {!metrics.reassessments.length && (
                                <div className="px-4 py-7 text-center">
                                    <CalendarClock className="mx-auto h-5 w-5 text-slate-300" />
                                    <p className="mt-2 text-[10px] font-semibold text-slate-600">No reassessments currently due</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </SectionCard>

        </div>
    );
}

function Metric({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "emerald" | "indigo" | "rose";
}) {
    const classes =
        tone === "emerald"
            ? "bg-emerald-50 text-emerald-700"
            : tone === "indigo"
              ? "bg-indigo-50 text-indigo-700"
              : "bg-rose-50 text-rose-700";
    return (
        <div className={`rounded-xl p-3 ${classes}`}>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs font-semibold">{label}</p>
        </div>
    );
}

export function LibraryView({
    state,
    onSelect,
    onCreate: _onCreate,
}: {
    state: CompetencyState;
    onSelect: (id: string) => void;
    onCreate: () => void;
}) {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("All");
    const [status, setStatus] = useState("All");
    const [sort, setSort] = useState("name");
    const rows = state.competencies
        .filter(
            (item) =>
                (!query ||
                    `${item.code} ${item.name} ${item.definition}`
                        .toLowerCase()
                        .includes(query.toLowerCase())) &&
                (category === "All" || item.category === category) &&
                (status === "All" || item.status === status),
        )
        .sort((a, b) =>
            sort === "updated"
                ? b.lastUpdated.localeCompare(a.lastUpdated)
                : sort === "code"
                  ? a.code.localeCompare(b.code)
                  : a.name.localeCompare(b.name),
        );
    const pagination = usePagination(rows);
    const usage = (id: string) =>
        state.roleProfiles.filter((profile) =>
            profile.requirements.some(
                (requirement) => requirement.competencyId === id,
            ),
        ).length;

    return (
        <div className="space-y-3">
            <Filters
                active={Boolean(
                    query || category !== "All" || status !== "All",
                )}
                onReset={() => {
                    setQuery("");
                    setCategory("All");
                    setStatus("All");
                }}
            >
                <SearchBox
                    value={query}
                    onChange={setQuery}
                    placeholder="Search code, name, or definition…"
                />
                <SystemSelect
                    aria-label="Competency category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {COMPETENCY_CATEGORIES.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Competency status"
                    value={status}
                    onChange={(event) => {
                        setStatus(event.target.value);
                    }}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Draft</option>
                    <option>Active</option>
                    <option>Archived</option>
                </SystemSelect>
                <SystemSelect
                    aria-label="Sort competencies"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="name">Name A–Z</option>
                    <option value="code">Code</option>
                    <option value="updated">Recently updated</option>
                </SystemSelect>
            </Filters>

            <SectionCard
                title="Competencies"
                description={`${rows.length} of ${state.competencies.length} governed definitions · proficiency requirements belong to Role Requirements, not this catalog table`}
                action={
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {state.competencies.filter((item) => item.status === "Active").length} active
                    </span>
                }
            >
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] table-fixed divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="w-[11%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Code</th>
                                    <th className="w-[28%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Competency</th>
                                    <th className="w-[17%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Category</th>
                                    <th className="w-[22%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Assessment Methods</th>
                                    <th className="w-[8%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Role Use</th>
                                    <th className="w-[6%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Version</th>
                                    <th className="w-[12%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagination.pageRows.map((item) => (
                                    <tr
                                        key={item.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(item.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () => onSelect(item.id))
                                        }
                                        className="cursor-pointer transition hover:bg-amber-50/50 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-4 py-2.5 text-xs font-bold text-slate-700">
                                            {item.code}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="truncate text-xs font-semibold text-slate-800">
                                                {item.name}
                                            </p>
                                            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-400">
                                                {item.definition}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            {item.category}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs leading-4 text-slate-500">
                                            {item.assessmentMethods.join(", ")}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-bold tabular-nums text-slate-700">
                                            {usage(item.id)}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600">
                                            v{item.version}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge value={item.status} />
                                        </td>
                                    </tr>
                                ))}
                            <TablePadding count={pagination.pageRows.length} columns={12} />
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={Library}
                        title="No competency definitions match"
                        description="Reset filters or add a competency definition."
                    />
                )}
                <Pagination
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    total={rows.length}
                    pageSize={pagination.pageSize}
                    onPage={pagination.setPage}
                />
            </SectionCard>
        </div>
    );
}

export function RoleProfilesView({
    state,
    onSelect,
    onCreate: _onCreate,
}: {
    state: CompetencyState;
    onSelect: (id: string) => void;
    onCreate: () => void;
}) {
    const [query, setQuery] = useState("");
    const [department, setDepartment] = useState("All");
    const [status, setStatus] = useState("All");
    const departments = [
        ...new Set(state.roleProfiles.map((item) => item.department)),
    ].sort();
    const rows = state.roleProfiles
        .filter(
            (item) =>
                (!query ||
                    `${item.name} ${item.position}`
                        .toLowerCase()
                        .includes(query.toLowerCase())) &&
                (department === "All" || item.department === department) &&
                (status === "All" || item.status === status),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    const pagination = usePagination(rows);
    const assignedPeople = (profileId: string) => {
        const profile = state.roleProfiles.find((item) => item.id === profileId);
        return profile
            ? SHARED_PERSONNEL.filter(
                  (person) =>
                      person.position === profile.position &&
                      person.department === profile.department &&
                      (profile.appliesTo === "Both" ||
                          profile.appliesTo === person.personType),
              ).length
            : 0;
    };

    const activeProfiles = state.roleProfiles.filter(
        (profile) => profile.status === "Active",
    ).length;
    const mappedPeople = SHARED_PERSONNEL.filter((person) =>
        state.roleProfiles.some(
            (profile) =>
                profile.status === "Active" &&
                profile.position === person.position &&
                profile.department === person.department &&
                (profile.appliesTo === "Both" ||
                    profile.appliesTo === person.personType),
        ),
    ).length;

    return (
        <div className="space-y-3">
            <Filters
                active={Boolean(
                    query || department !== "All" || status !== "All",
                )}
                onReset={() => {
                    setQuery("");
                    setDepartment("All");
                    setStatus("All");
                }}
            >
                <SearchBox
                    value={query}
                    onChange={setQuery}
                    placeholder="Search profile or position…"
                />
                <SystemSelect
                    aria-label="Role profile department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Role profile status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Draft</option>
                    <option>Active</option>
                    <option>Archived</option>
                </SystemSelect>
            </Filters>

            <SectionCard
                title="Role Requirements"
                description="Position-based requirements mapped against the same canonical current position, department, and person type used across Performance."
                action={
                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {activeProfiles} active profiles
                        </span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            {mappedPeople}/{SHARED_PERSONNEL.length} people mapped
                        </span>
                    </div>
                }
            >
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1040px] table-fixed divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="w-[24%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Role Profile</th>
                                    <th className="w-[18%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Position</th>
                                    <th className="w-[16%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Department</th>
                                    <th className="w-[11%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Applies To</th>
                                    <th className="w-[10%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Requirements</th>
                                    <th className="w-[8%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Critical</th>
                                    <th className="w-[7%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">People</th>
                                    <th className="w-[6%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagination.pageRows.map((profile) => (
                                    <tr
                                        key={profile.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(profile.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () => onSelect(profile.id))
                                        }
                                        className="cursor-pointer transition hover:bg-amber-50/50 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-4 py-2.5">
                                            <p className="truncate text-xs font-semibold text-slate-800">
                                                {profile.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                v{profile.version} · effective {formatDate(profile.effectiveDate)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                                            {profile.position}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            {profile.department}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            {profile.appliesTo}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-bold tabular-nums text-slate-700">
                                            {profile.requirements.length}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-bold tabular-nums text-rose-700">
                                            {profile.requirements.filter((item) => item.critical).length}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-bold tabular-nums text-slate-700">
                                            {assignedPeople(profile.id)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge value={profile.status} />
                                        </td>
                                    </tr>
                                ))}
                            <TablePadding count={pagination.pageRows.length} columns={12} />
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={FolderKanban}
                        title="No role requirements match"
                        description="Reset filters or create a governed role profile."
                    />
                )}
                <Pagination
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    total={rows.length}
                    pageSize={pagination.pageSize}
                    onPage={pagination.setPage}
                />
            </SectionCard>
        </div>
    );
}

export function CyclesView({
    state,
    focus,
    onSelect,
    onCreate,
    onAuthorize,
    onToggleAuthorization,
}: {
    state: CompetencyState;
    focus: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onAuthorize: () => void;
    onToggleAuthorization: (id: string) => void;
}) {
    const [status, setStatus] = useState(focus === "active" ? "Active" : "All");
    useEffect(() => {
        if (focus === "active") setStatus("Active");
    }, [focus]);
    const rows = state.cycles
        .filter((item) =>
            status === "All" || effectiveCycleStatus(item) === status,
        )
        .sort((left, right) => right.startDate.localeCompare(left.startDate));
    const cyclePagination = usePagination(rows);
    const automationExceptions = useMemo(
        () => buildAssessmentAutomationExceptions(state),
        [state],
    );
    const authorizationRows = [...state.assessorAuthorizations].sort(
        (left, right) =>
            Number(right.active) - Number(left.active) ||
            (
                SHARED_PERSONNEL.find((person) => person.id === left.assessorId)
                    ?.fullName ?? left.assessorId
            ).localeCompare(
                SHARED_PERSONNEL.find(
                    (person) => person.id === right.assessorId,
                )?.fullName ?? right.assessorId,
            ),
    );
    const authorizationPagination = usePagination(authorizationRows);
    return (
        <div className="space-y-4">
            <Filters active={status !== "All"} onReset={() => setStatus("All")}>
                <SystemSelect
                    aria-label="Assessment cycle status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Draft</option>
                    <option>Scheduled</option>
                    <option>Active</option>
                    <option>Closed</option>
                    <option>Expired</option>
                    <option>Cancelled</option>
                </SystemSelect>
                <button
                    type="button"
                    onClick={onAuthorize}
                    hidden={state.governanceAllowed === false}
                    className={secondaryButtonClass}
                >
                    <UserCheck className="h-3.5 w-3.5" /> Authorize Assessor
                </button>
            </Filters>
            <div className="grid gap-3 lg:grid-cols-2">
                {cyclePagination.pageRows.map((cycle) => {
                    const assignments = state.assessments.filter(
                        (item) => item.cycleId === cycle.id,
                    );
                    const completion = calculateCycleCompletion(assignments);
                    return (
                        <section
                            key={cycle.id}
                            className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <StatusBadge value={effectiveCycleStatus(cycle)} />
                                        <span className="text-xs font-semibold text-slate-400">
                                            {cycle.type}
                                        </span>
                                    </div>
                                    <h2 className="mt-2 text-sm font-bold text-slate-900">
                                        {cycle.name}
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {formatDate(cycle.startDate)} –{" "}
                                        {formatDate(cycle.endDate)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSelect(cycle.id)}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    aria-label="View cycle"
                                >
                                    <Eye className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                <Info
                                    label="Applies To"
                                    value={cycle.appliesTo}
                                />
                                <Info
                                    label="Assignment"
                                    value={cycle.assignmentMethod}
                                />
                                <Info
                                    label="Automation"
                                    value={
                                        cycle.autoAssign !== false &&
                                        cycle.assignmentMethod !==
                                            "Manual Authorized Assignment"
                                            ? "System managed"
                                            : "Governance exception"
                                    }
                                />
                                <Info
                                    label="Profiles"
                                    value={cycle.roleProfileIds.length.toString()}
                                />
                                <Info
                                    label="Due Rule"
                                    value={`${cycle.dueDaysAfterAssignment} days · capped at cycle end`}
                                />
                            </div>
                            <div className="mt-auto pt-4">
                                <ProgressBar
                                    value={completion.rate}
                                    label={`${completion.finalized}/${completion.eligible}`}
                                />
                                <p className="mt-1 text-xs text-slate-500" title="Finalized non-cancelled assessments divided by all non-cancelled assessments">
                                    Completion excludes {completion.cancelled} cancelled assignment{completion.cancelled === 1 ? "" : "s"}.
                                </p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onSelect(cycle.id)}
                                    className={secondaryButtonClass}
                                >
                                    View / Manage
                                </button>
                            </div>
                        </section>
                    );
                })}
                {!rows.length && (
                    <div className="lg:col-span-2">
                        <EmptyState
                            icon={CalendarClock}
                            title="No assessment cycles match"
                        />
                    </div>
                )}
            </div>
            <Pagination
                page={cyclePagination.page}
                pageCount={cyclePagination.pageCount}
                total={rows.length}
                pageSize={cyclePagination.pageSize}
                onPage={cyclePagination.setPage}
            />
            <SectionCard
                title="Assignment Automation Exceptions"
                description="Normal assignments and due reassessments are system-generated. Only unresolved profile, cycle, or assessor-authority cases appear here for Admin/HR action."
                action={
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${automationExceptions.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                        {automationExceptions.length} exception{automationExceptions.length === 1 ? "" : "s"}
                    </span>
                }
            >
                {automationExceptions.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] table-fixed divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="w-[22%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Person</th>
                                    <th className="w-[16%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Automation</th>
                                    <th className="w-[22%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Cycle / Profile</th>
                                    <th className="w-[40%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {automationExceptions.slice(0, 10).map((item) => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-2.5">
                                            <PersonCell
                                                person={item.person}
                                                subtitle={`${item.person.position} · ${item.person.department}`}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge value={item.kind} />
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            <p className="font-semibold text-slate-700">{item.cycle?.name ?? "No matching active cycle"}</p>
                                            <p className="mt-0.5 text-slate-400">{item.profile?.name ?? "Current Role Profile unresolved"}</p>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs leading-5 text-amber-800">
                                            {item.reason}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {automationExceptions.length > 10 && (
                            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                                Showing the first 10 of {automationExceptions.length} exceptions. Resolve assessor authority or governed reassessment-cycle coverage to let automation continue.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="px-4 py-4 text-xs text-emerald-700">
                        No automation exceptions. Current active cycle populations can resolve their governed assignment path.
                    </div>
                )}
            </SectionCard>
            <SectionCard
                title="Assessor Authority"
                description="Explicit Competency assessor authorization. Access role or Performance evaluator status alone does not grant Competency assessment authority."
            >
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] table-fixed divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="w-[23%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Assessor</th>
                                <th className="w-[11%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Access Role</th>
                                <th className="w-[14%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Scope</th>
                                <th className="w-[20%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Scope Value</th>
                                <th className="w-[10%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                                <th className="w-[14%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Authorized By</th>
                                <th className="w-[8%] px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {authorizationPagination.pageRows.map((item) => {
                                const assessor = SHARED_PERSONNEL.find(
                                    (person) => person.id === item.assessorId,
                                );
                                const scopeLabel =
                                    item.scope === "Role Profile"
                                        ? state.roleProfiles.find(
                                              (profile) =>
                                                  profile.id ===
                                                  item.scopeValue,
                                          )?.name
                                        : item.scope === "Specific Person"
                                          ? SHARED_PERSONNEL.find(
                                                (person) =>
                                                    person.id ===
                                                    item.scopeValue,
                                            )?.fullName
                                          : item.scopeValue;
                                return (
                                    <tr key={item.id}>
                                        <td className="px-4 py-2.5">
                                            {assessor ? (
                                                <PersonCell person={assessor} />
                                            ) : (
                                                item.assessorId
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs">
                                            {assessor?.accessRole ?? "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs">
                                            {item.scope}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs">
                                            {scopeLabel ?? item.scopeValue}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge
                                                value={
                                                    item.active
                                                        ? "Active"
                                                        : "Archived"
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-xs">
                                            {item.authorizedBy}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button
                                                type="button"
                                                hidden={state.governanceAllowed === false}
                                                onClick={() =>
                                                    onToggleAuthorization(
                                                        item.id,
                                                    )
                                                }
                                                className={secondaryButtonClass}
                                            >
                                                {item.active
                                                    ? "Deactivate"
                                                    : "Reactivate"}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        <TablePadding count={authorizationPagination.pageRows.length} columns={12} />
                            </tbody>
                    </table>
                </div>
                <Pagination
                    page={authorizationPagination.page}
                    pageCount={authorizationPagination.pageCount}
                    total={authorizationRows.length}
                    pageSize={authorizationPagination.pageSize}
                    onPage={authorizationPagination.setPage}
                />
            </SectionCard>
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {label}
            </p>
            <p className="mt-1 font-semibold text-slate-700">{value}</p>
        </div>
    );
}

export function AssessmentsView({
    state,
    focus,
    onSelect,
    onCreate: _onCreate,
}: {
    state: CompetencyState;
    focus: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
}) {
    const [query, setQuery] = useState("");
    const [cycleId, setCycleId] = useState(
        focus && focus !== "All" && focus !== "Assessment Queue" ? focus : "All",
    );
    const [status, setStatus] = useState("All");
    const [department, setDepartment] = useState("All");
    const [personType, setPersonType] = useState("All");
    const [sort, setSort] = useState("due");
    useEffect(() => {
        if (focus && focus !== "All" && focus !== "Assessment Queue")
            setCycleId(focus);
    }, [focus]);
    const allRows = useMemo(() => buildAssessmentRows(state), [state]);
    const activeCycleIds = new Set(
        state.cycles
            .filter((cycle) => cycle.status === "Active")
            .map((cycle) => cycle.id),
    );
    const rows = allRows
        .filter(
            (row) =>
                (!query ||
                    `${row.person.fullName} ${row.person.position} ${row.cycle?.name}`
                        .toLowerCase()
                        .includes(query.toLowerCase())) &&
                (cycleId === "All" ||
                    (cycleId === "active"
                        ? activeCycleIds.has(row.assessment.cycleId)
                        : row.assessment.cycleId === cycleId)) &&
                (status === "All" || row.displayStatus === status) &&
                (department === "All" ||
                    row.person.department === department) &&
                (personType === "All" || row.person.personType === personType),
        )
        .sort((a, b) =>
            sort === "person"
                ? a.person.fullName.localeCompare(b.person.fullName)
                : sort === "updated"
                  ? b.assessment.lastUpdated.localeCompare(
                        a.assessment.lastUpdated,
                    )
                  : a.assessment.dueDate.localeCompare(b.assessment.dueDate),
        );
    const pagination = usePagination(rows);
    const departments = [
        ...new Set(SHARED_PERSONNEL.map((item) => item.department)),
    ].sort();
    const active = Boolean(
        query ||
            cycleId !== "All" ||
            status !== "All" ||
            department !== "All" ||
            personType !== "All",
    );
    const actionCount = rows.filter(
        (row) =>
            row.contextChanged ||
            ["Pending Validation", "Overdue", "Returned for Revision"].includes(
                row.displayStatus,
            ),
    ).length;

    return (
        <div className="space-y-3">
            <Filters
                active={active}
                onReset={() => {
                    setQuery("");
                    setCycleId("All");
                    setStatus("All");
                    setDepartment("All");
                    setPersonType("All");
                }}
            >
                <SearchBox
                    value={query}
                    onChange={setQuery}
                    placeholder="Search person, position, or cycle…"
                />
                <SystemSelect
                    aria-label="Assessment cycle"
                    value={cycleId}
                    onChange={(event) => setCycleId(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="All">All Cycles</option>
                    <option value="active">All Active Cycles</option>
                    {state.cycles.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Assessment status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {[
                        "Pending",
                        "In Progress",
                        "Submitted",
                        "Pending Validation",
                        "Returned for Revision",
                        "Finalized",
                        "Overdue",
                        "Cancelled",
                    ].map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Person type"
                    value={personType}
                    onChange={(event) => setPersonType(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Employee</option>
                    <option>Trainee</option>
                </SystemSelect>
                <SystemSelect
                    aria-label="Sort assessments"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="due">Due date</option>
                    <option value="updated">Recently updated</option>
                    <option value="person">Person A–Z</option>
                </SystemSelect>
            </Filters>

            <SectionCard
                title="Assessment Queue"
                description="One row per governed person-and-role-profile assessment. Person, current position, and department use the same workforce records used across Performance & Development."
                action={
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {actionCount} needing action
                    </span>
                }
            >
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] table-fixed divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="w-[20%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Person</th>
                                    <th className="w-[18%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Role Profile</th>
                                    <th className="w-[17%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Assessment Cycle</th>
                                    <th className="w-[15%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Assessor</th>
                                    <th className="w-[10%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Progress</th>
                                    <th className="w-[12%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                                    <th className="w-[8%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Due</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagination.pageRows.map((row) => (
                                    <tr
                                        key={row.assessment.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(row.assessment.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () =>
                                                onSelect(row.assessment.id),
                                            )
                                        }
                                        className="cursor-pointer transition hover:bg-amber-50/50 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-4 py-2.5">
                                            <PersonCell
                                                person={row.person}
                                                subtitle={`${row.person.position} · ${row.person.department}`}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="truncate text-xs font-semibold text-slate-700">
                                                {row.profile?.name ?? "Role profile unavailable"}
                                            </p>
                                            <p className={`mt-0.5 text-xs ${row.contextChanged ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                                                {row.contextChanged
                                                    ? "Current role/profile context changed · reissue required"
                                                    : row.profile
                                                      ? `v${row.profile.version}`
                                                      : "Assessment snapshot retained"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="truncate text-xs font-semibold text-slate-700">
                                                {row.cycle?.name ?? "Unknown cycle"}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                {row.cycle?.type ?? "Cycle snapshot"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {row.assessor ? (
                                                <PersonCell
                                                    person={row.assessor}
                                                    subtitle="Authorized assessor"
                                                />
                                            ) : (
                                                <span className="text-xs font-semibold text-slate-400">
                                                    Unassigned
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <ProgressBar value={row.progress} />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex flex-wrap gap-1">
                                                <StatusBadge value={row.displayStatus} />
                                                {row.contextChanged && (
                                                    <StatusBadge value="Context Changed" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            {formatDate(row.assessment.dueDate)}
                                        </td>
                                    </tr>
                                ))}
                            <TablePadding count={pagination.pageRows.length} columns={12} />
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={ClipboardList}
                        title="No assessments match"
                        description="Reset the filters. Normal assignments are system-generated; use an exception assignment only when governance requires a manual path."
                    />
                )}
                <Pagination
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    total={rows.length}
                    pageSize={pagination.pageSize}
                    onPage={pagination.setPage}
                />
            </SectionCard>
        </div>
    );
}

type PeopleSummaryFilter = "All" | "Coverage" | "Gaps" | "Incomplete";

function PeopleSummaryCard({
    label,
    value,
    detail,
    icon: Icon,
    selected,
    onClick,
}: {
    label: string;
    value: ReactNode;
    detail: string;
    icon: LucideIcon;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className="app-kpi-card group relative min-h-[108px] w-full p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4B400] focus-visible:ring-offset-2"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-slate-500">
                        {label}
                    </p>
                    <p className="mt-1.5 truncate text-xl font-extrabold tabular-nums tracking-tight text-slate-950">
                        {value}
                    </p>
                </div>
                <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-amber-600 transition-colors ${
                        selected
                            ? "bg-amber-100 ring-1 ring-amber-300"
                            : "bg-amber-50 group-hover:bg-amber-100"
                    }`}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
                {detail}
            </p>
        </button>
    );
}

export function ProfilesView({
    state,
    focus,
    onSelect,
    selectedPersonId = null,
    inlineDetails,
    onCloseDetails,
}: {
    state: CompetencyState;
    focus: string;
    onSelect: (personId: string) => void;
    selectedPersonId?: string | null;
    inlineDetails?: ReactNode;
    onCloseDetails?: () => void;
}) {
    const decodePeopleFocus = (value: string) => {
        if (value.startsWith("department:")) {
            return { department: value.slice("department:".length), status: "All", personId: null };
        }
        if (value.startsWith("status:")) {
            return { department: "All", status: value.slice("status:".length), personId: null };
        }
        if (value.startsWith("person:")) {
            return { department: "All", status: "All", personId: value.slice("person:".length) };
        }
        if (value.startsWith("user-")) {
            return { department: "All", status: "All", personId: value };
        }
        if (value && value !== "All") {
            return { department: "All", status: value, personId: null };
        }
        return { department: "All", status: "All", personId: null };
    };
    const initialFocus = decodePeopleFocus(focus);
    const [query, setQuery] = useState("");
    const [department, setDepartment] = useState(initialFocus.department);
    const [personType, setPersonType] = useState("All");
    const [status, setStatus] = useState(initialFocus.status);
    const [summaryFilter, setSummaryFilter] =
        useState<PeopleSummaryFilter>("All");
    useEffect(() => {
        const next = decodePeopleFocus(focus);
        setDepartment(next.department);
        setStatus(next.status);
        setSummaryFilter("All");
        if (next.personId) onSelect(next.personId);
    }, [focus]);

    const allRows = useMemo(() => buildCompetencyProfiles(state), [state]);
    const rows = allRows
        .filter(
            (row) =>
                (!query ||
                    `${row.person.fullName} ${row.person.position}`
                        .toLowerCase()
                        .includes(query.toLowerCase())) &&
                (department === "All" ||
                    row.person.department === department) &&
                (personType === "All" ||
                    row.person.personType === personType) &&
                (status === "All" || row.status === status) &&
                (summaryFilter === "All" ||
                    (summaryFilter === "Coverage" && Boolean(row.profile)) ||
                    (summaryFilter === "Gaps" && row.openGaps > 0) ||
                    (summaryFilter === "Incomplete" &&
                        Boolean(row.profile) &&
                        row.notAssessed > 0)),
        )
        .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
    const pagination = usePagination(rows);
    const departments = [
        ...new Set(SHARED_PERSONNEL.map((item) => item.department)),
    ].sort();
    const mapped = allRows.filter((row) => row.profile).length;
    const withGaps = allRows.filter((row) => row.openGaps > 0).length;
    const incomplete = allRows.filter((row) => row.profile && row.notAssessed > 0).length;

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
                <PeopleSummaryCard
                    label="Role Profile Coverage"
                    value={`${mapped}/${allRows.length}`}
                    detail="Canonical workforce with mapped role requirements"
                    icon={Users}
                    selected={summaryFilter === "Coverage"}
                    onClick={() => {
                        setStatus("All");
                        setSummaryFilter("Coverage");
                        onCloseDetails?.();
                    }}
                />
                <PeopleSummaryCard
                    label="People with Gaps"
                    value={withGaps}
                    detail="Finalized competency results below role requirements"
                    icon={AlertTriangle}
                    selected={summaryFilter === "Gaps"}
                    onClick={() => {
                        setStatus("All");
                        setSummaryFilter("Gaps");
                        onCloseDetails?.();
                    }}
                />
                <PeopleSummaryCard
                    label="Assessment Incomplete"
                    value={incomplete}
                    detail="Mapped people with at least one Not Assessed requirement"
                    icon={ClipboardList}
                    selected={summaryFilter === "Incomplete"}
                    onClick={() => {
                        setStatus("All");
                        setSummaryFilter("Incomplete");
                        onCloseDetails?.();
                    }}
                />
            </div>

            <Filters
                active={Boolean(
                    query ||
                        department !== "All" ||
                        personType !== "All" ||
                        status !== "All" ||
                        summaryFilter !== "All",
                )}
                onReset={() => {
                    setQuery("");
                    setDepartment("All");
                    setPersonType("All");
                    setStatus("All");
                    setSummaryFilter("All");
                    onCloseDetails?.();
                }}
            >
                <SearchBox
                    value={query}
                    onChange={(value) => {
                        setQuery(value);
                        onCloseDetails?.();
                    }}
                    placeholder="Search person or position…"
                />
                <SystemSelect
                    aria-label="Profile department"
                    value={department}
                    onChange={(event) => {
                        setDepartment(event.target.value);
                        onCloseDetails?.();
                    }}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Profile person type"
                    value={personType}
                    onChange={(event) => {
                        setPersonType(event.target.value);
                        onCloseDetails?.();
                    }}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Employee</option>
                    <option>Trainee</option>
                </SystemSelect>
                <SystemSelect
                    aria-label="Requirement status"
                    value={status}
                    onChange={(event) => {
                        setStatus(event.target.value);
                        onCloseDetails?.();
                    }}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {[
                        "Requirements Met",
                        "Has Competency Gaps",
                        "Assessment Incomplete",
                        "Profile Not Assigned",
                        "Reassessment Due",
                    ].map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
            </Filters>

            <SectionCard
                title="Workforce Competency Profiles"
                description="One row per active canonical person. Position and department follow the same canonical personnel context used by Performance; only finalized Competency assessments establish proficiency."
                className="relative overflow-hidden"
                action={
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {rows.length} of {allRows.length} people
                    </span>
                }
            >
                {inlineDetails}
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1120px] table-fixed divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="w-[20%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Person</th>
                                    <th className="w-[16%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Current Role</th>
                                    <th className="w-[13%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Department</th>
                                    <th className="w-[18%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Role Profile</th>
                                    <th className="w-[7%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Met</th>
                                    <th className="w-[7%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Gaps</th>
                                    <th className="w-[7%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Not Assessed</th>
                                    <th className="w-[12%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagination.pageRows.map((row) => (
                                    <tr
                                        key={row.person.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(row.person.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () => onSelect(row.person.id))
                                        }
                                        aria-current={
                                            selectedPersonId === row.person.id
                                                ? "true"
                                                : undefined
                                        }
                                        className={`cursor-pointer transition focus:outline-none ${
                                            selectedPersonId === row.person.id
                                                ? "bg-amber-50"
                                                : "hover:bg-amber-50/50 focus:bg-amber-50"
                                        }`}
                                    >
                                        <td className="px-4 py-2.5">
                                            <PersonCell
                                                person={row.person}
                                                subtitle={row.person.employeeOrTraineeId}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="truncate text-xs font-semibold text-slate-700">
                                                {row.person.position}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                {row.person.personType}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            {row.person.department}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {row.profile ? (
                                                <>
                                                    <p className="truncate text-xs font-semibold text-slate-700">
                                                        {row.profile.name}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-slate-400">
                                                        v{row.profile.version} · {row.requirements.length} requirements · last validated {formatDate(row.lastAssessed)}
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-xs font-semibold text-slate-400">Not assigned</p>
                                                    <p className="mt-0.5 text-xs text-slate-400">No active profile matches the current role</p>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-extrabold tabular-nums text-emerald-700">
                                            {row.profile ? row.meetsOrExceeds : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-extrabold tabular-nums text-rose-700">
                                            {row.profile ? row.openGaps : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-extrabold tabular-nums text-slate-600">
                                            {row.profile ? row.notAssessed : "—"}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge value={row.status} />
                                        </td>
                                    </tr>
                                ))}
                            <TablePadding count={pagination.pageRows.length} columns={12} />
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={UserCheck}
                        title="No competency profiles match"
                    />
                )}
                <Pagination
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    total={rows.length}
                    pageSize={pagination.pageSize}
                    onPage={(page) => {
                        pagination.setPage(page);
                        onCloseDetails?.();
                    }}
                />
            </SectionCard>
        </div>
    );
}

export function GapDevelopmentView({
    state,
    onSelect,
}: {
    state: CompetencyState;
    onSelect: (id: string) => void;
}) {
    const [query, setQuery] = useState("");
    const [department, setDepartment] = useState("All");
    const [critical, setCritical] = useState("All");
    const [development, setDevelopment] = useState("All");
    const automationExceptions = useMemo(
        () => buildAssessmentAutomationExceptions(state),
        [state],
    );
    const today = todayIso();
    const developmentStage = (
        row: ReturnType<typeof buildDevelopmentRows>[number],
    ) => {
        const recommendation = row.recommendations[0];
        if (!recommendation) return "No Recommendation";
        if (recommendation.status === "Reassessed")
            return recommendation.outcome ?? "Reassessed";
        if (recommendation.reassessmentAssessmentId)
            return "Reassessment Requested";
        if (recommendation.integration?.completedAt) {
            if (!recommendation.reassessmentDue)
                return "Governance Interval Missing";
            if (recommendation.reassessmentDue > today)
                return "Reassessment Scheduled";
            const blocked = automationExceptions.some(
                (item) =>
                    item.kind === "Reassessment" &&
                    item.person.id === row.person.id &&
                    item.competencyIds.includes(row.requirement.competencyId),
            );
            return blocked ? "Reassessment Blocked" : "Reassessment Ready";
        }
        return recommendation.outcome ?? recommendation.status;
    };
    const gaps = useMemo(() => buildDevelopmentRows(state), [state])
        .filter(
            (row) =>
                (!query ||
                    `${row.person.fullName} ${row.competency?.name}`
                        .toLowerCase()
                        .includes(query.toLowerCase())) &&
                (department === "All" ||
                    row.person.department === department) &&
                (critical === "All" ||
                    (critical === "Critical") === row.requirement.critical) &&
                (development === "All" ||
                    developmentStage(row) === development),
        )
        .sort(
            (a, b) =>
                Number(b.requirement.critical) -
                    Number(a.requirement.critical) ||
                (b.gap ?? 0) - (a.gap ?? 0) ||
                a.person.fullName.localeCompare(b.person.fullName),
        );
    const pagination = usePagination(gaps);
    const departments = [
        ...new Set(SHARED_PERSONNEL.map((item) => item.department)),
    ].sort();
    const criticalCount = gaps.filter((row) => row.requirement.critical).length;
    const withRecommendation = gaps.filter(
        (row) => row.recommendationStatus !== "No Recommendation",
    ).length;

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs leading-4 text-slate-600">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p>
                    <span className="font-bold text-slate-800">Development rule:</span>{" "}
                    Learning and Training may address a validated gap, but completion is supporting evidence only. The system calculates governed reassessment timing, creates a targeted reassessment when eligible, and surfaces any blocked automation path. The gap closes only after a new finalized Competency reassessment proves the required level.
                </p>
            </div>

            <Filters
                active={Boolean(
                    query ||
                        department !== "All" ||
                        critical !== "All" ||
                        development !== "All",
                )}
                onReset={() => {
                    setQuery("");
                    setDepartment("All");
                    setCritical("All");
                    setDevelopment("All");
                }}
            >
                <SearchBox
                    value={query}
                    onChange={setQuery}
                    placeholder="Search person or competency…"
                />
                <SystemSelect
                    aria-label="Department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Criticality"
                    value={critical}
                    onChange={(event) => setCritical(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Critical</option>
                    <option>Non-critical</option>
                </SystemSelect>
                <SystemSelect
                    aria-label="Development status"
                    value={development}
                    onChange={(event) => setDevelopment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>No Recommendation</option>
                    <option>Recommended</option>
                    <option>Reviewed</option>
                    <option>Development Open</option>
                    <option>Reassessment Scheduled</option>
                    <option>Reassessment Ready</option>
                    <option>Reassessment Requested</option>
                    <option>Reassessment Blocked</option>
                    <option>Governance Interval Missing</option>
                    <option>Reassessed</option>
                    <option>Gap Resolved</option>
                    <option>Gap Reduced</option>
                    <option>Gap Still Open</option>
                </SystemSelect>
            </Filters>

            <SectionCard
                title="Development Needs"
                description={`${gaps.length} validated role requirements below target · Not Assessed requirements are excluded from the gap register`}
                action={
                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            {criticalCount} critical
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {withRecommendation} with development action
                        </span>
                    </div>
                }
            >
                {gaps.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1080px] table-fixed divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="w-[20%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Person</th>
                                    <th className="w-[20%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Competency</th>
                                    <th className="w-[11%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Current</th>
                                    <th className="w-[11%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Required</th>
                                    <th className="w-[6%] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Gap</th>
                                    <th className="w-[8%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Priority</th>
                                    <th className="w-[16%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Development</th>
                                    <th className="w-[8%] px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Due</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagination.pageRows.map((row) => (
                                    <tr
                                        key={row.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(row.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () => onSelect(row.id))
                                        }
                                        className="cursor-pointer transition hover:bg-amber-50/50 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-4 py-2.5">
                                            <PersonCell
                                                person={row.person}
                                                subtitle={`${row.person.position} · ${row.person.department}`}
                                            />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="truncate text-xs font-semibold text-slate-800">
                                                {row.competency?.name ?? "Unknown"}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                {row.competency?.code ?? row.requirement.competencyId} · last validated {formatDate(row.lastAssessed)}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            L{row.currentLevel} · {proficiencyLabel(row.currentLevel)}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                                            L{row.requirement.requiredLevel} · {proficiencyLabel(row.requirement.requiredLevel)}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-extrabold tabular-nums text-rose-700">
                                            {row.gap}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {row.requirement.critical ? (
                                                <StatusBadge value="Critical" />
                                            ) : (
                                                <span className="text-xs font-semibold text-slate-500">Standard</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge value={developmentStage(row)} />
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                            {row.recommendations[0]?.reassessmentDue
                                                ? formatDate(row.recommendations[0]?.reassessmentDue)
                                                : row.recommendations[0]?.integration?.completedAt
                                                  ? "Interval required"
                                                  : row.recommendations[0]
                                                    ? "After completion"
                                                    : "—"}
                                        </td>
                                    </tr>
                                ))}
                            <TablePadding count={pagination.pageRows.length} columns={12} />
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={ShieldCheck}
                        title="No validated gaps match"
                        description="Not Assessed requirements are intentionally not treated as Level 0 or an automatic gap."
                    />
                )}
                <Pagination
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    total={gaps.length}
                    pageSize={pagination.pageSize}
                    onPage={pagination.setPage}
                />
            </SectionCard>
        </div>
    );
}

type AnalyticsChartId =
    | "requirement-attainment"
    | "proficiency-distribution"
    | "gaps-by-competency"
    | "gaps-by-category"
    | "gaps-by-department"
    | "gaps-by-position"
    | "comparable-cycle-trend"
    | "development-outcomes";

const DEFAULT_ANALYTICS_CHART_ORDER: AnalyticsChartId[] = [
    "requirement-attainment",
    "proficiency-distribution",
    "gaps-by-competency",
    "gaps-by-category",
    "gaps-by-department",
    "gaps-by-position",
    "comparable-cycle-trend",
    "development-outcomes",
];

const COMPETENCY_ANALYTICS_LAYOUT_KEY = "alibaton.competency.analytics.chart-order.v1";

export function AnalyticsView({ state }: { state: CompetencyState }) {
    const [filters, setFilters] = useState<CompetencyAnalyticsFilters>(
        EMPTY_ANALYTICS_FILTERS,
    );
    const [chartDateRange, setChartDateRange] = useState<ChartDateRangeValue>({ ...DEFAULT_CHART_DATE_RANGE, preset: "all" });
    const [chartOrder, setChartOrder] = useState<AnalyticsChartId[]>(() => {
        if (typeof window === "undefined") return DEFAULT_ANALYTICS_CHART_ORDER;
        try {
            const parsed = JSON.parse(window.localStorage.getItem(COMPETENCY_ANALYTICS_LAYOUT_KEY) ?? "null");
            if (
                Array.isArray(parsed) &&
                parsed.length === DEFAULT_ANALYTICS_CHART_ORDER.length &&
                DEFAULT_ANALYTICS_CHART_ORDER.every((id) => parsed.includes(id))
            ) {
                return parsed as AnalyticsChartId[];
            }
        } catch {
            // Keep the canonical default order when a saved layout is invalid.
        }
        return DEFAULT_ANALYTICS_CHART_ORDER;
    });
    const [draggedChart, setDraggedChart] = useState<AnalyticsChartId | null>(null);
    const [dragTargetChart, setDragTargetChart] = useState<AnalyticsChartId | null>(null);
    const draggedChartRef = useRef<AnalyticsChartId | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(COMPETENCY_ANALYTICS_LAYOUT_KEY, JSON.stringify(chartOrder));
    }, [chartOrder]);

    const moveAnalyticsChart = (targetId: AnalyticsChartId) => {
        const sourceId = draggedChartRef.current;
        if (!sourceId || sourceId === targetId) return;
        setChartOrder((current) => {
            const sourceIndex = current.indexOf(sourceId);
            const targetIndex = current.indexOf(targetId);
            if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
            const next = [...current];
            next.splice(sourceIndex, 1);
            next.splice(targetIndex, 0, sourceId);
            return next;
        });
        setDragTargetChart(targetId);
    };

    const finishAnalyticsDrag = () => {
        draggedChartRef.current = null;
        setDraggedChart(null);
        setDragTargetChart(null);
    };

    const chartReorder = (id: AnalyticsChartId) => ({
        id,
        order: chartOrder.indexOf(id),
        isDragging: draggedChart === id,
        isTarget: dragTargetChart === id && draggedChart !== id,
        onDragStart: (event: DragEvent<HTMLButtonElement>) => {
            draggedChartRef.current = id;
            setDraggedChart(id);
            setDragTargetChart(null);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", id);
            const card = event.currentTarget.closest<HTMLElement>("[data-analytics-card]");
            if (card) {
                const rect = card.getBoundingClientRect();
                event.dataTransfer.setDragImage(
                    card,
                    Math.max(20, Math.min(rect.width * 0.08, 48)),
                    24,
                );
            }
        },
        onDragEnter: () => moveAnalyticsChart(id),
        onDrop: finishAnalyticsDrag,
        onDragEnd: finishAnalyticsDrag,
    });
    const scopedState = useMemo<CompetencyState>(() => ({
        ...state,
        assessments: state.assessments.filter((assessment) =>
            chartDateRange.preset === "all" ||
            dateFallsInChartRange(
                assessment.finalizedAt ?? assessment.submittedAt ?? assessment.assignedAt,
                chartDateRange,
            ),
        ),
        recommendations: state.recommendations.filter((recommendation) =>
            chartDateRange.preset === "all" || dateFallsInChartRange(recommendation.createdAt, chartDateRange),
        ),
    }), [state, chartDateRange]);
    const analytics = useMemo(
        () => buildCompetencyAnalytics(scopedState, filters),
        [scopedState, filters],
    );
    const allRows = useMemo(() => buildAssessmentRows(scopedState), [scopedState]);
    const automaticComparableProfile = useMemo(() => {
        const comparableRows = filterAssessmentRows(
            allRows,
            { ...filters, roleProfileVersion: "All" },
            scopedState,
        ).filter((row) => row.displayStatus === "Finalized");
        const groups = new Map<string, {
            key: string;
            label: string;
            cycleIds: Set<string>;
            finalized: number;
        }>();
        for (const row of comparableRows) {
            const key = roleProfileVersionKey(row.assessment);
            const snapshot = row.assessment.roleProfileSnapshot;
            const existing = groups.get(key) ?? {
                key,
                label: `${snapshot.name} · v${snapshot.version}`,
                cycleIds: new Set<string>(),
                finalized: 0,
            };
            existing.cycleIds.add(row.assessment.cycleId);
            existing.finalized += 1;
            groups.set(key, existing);
        }
        return [...groups.values()]
            .filter((group) => group.cycleIds.size >= 2)
            .sort((a, b) =>
                b.cycleIds.size - a.cycleIds.size ||
                b.finalized - a.finalized ||
                a.label.localeCompare(b.label),
            )[0] ?? null;
    }, [allRows, filters, scopedState]);
    const effectiveTrendProfileKey =
        filters.roleProfileVersion === "All"
            ? automaticComparableProfile?.key ?? "__NO_COMPARABLE_SCOPE__"
            : filters.roleProfileVersion;
    const trendAnalytics = useMemo(
        () => buildCompetencyAnalytics(scopedState, {
            ...filters,
            roleProfileVersion: effectiveTrendProfileKey,
        }),
        [scopedState, filters, effectiveTrendProfileKey],
    );
    const effectiveTrendSnapshot = allRows.find(
        (row) => roleProfileVersionKey(row.assessment) === effectiveTrendProfileKey,
    )?.assessment.roleProfileSnapshot;
    const effectiveTrendLabel = effectiveTrendSnapshot
        ? `${effectiveTrendSnapshot.name} · v${effectiveTrendSnapshot.version}`
        : automaticComparableProfile?.label ?? null;
    const rowsWithout = <K extends keyof CompetencyAnalyticsFilters>(key: K) =>
        filterAssessmentRows(
            allRows,
            { ...filters, [key]: "All" } as CompetencyAnalyticsFilters,
            scopedState,
        );
    const cycleOptions = [
        ...new Map(
            rowsWithout("cycleId")
                .filter((row) => row.cycle)
                .map((row) => [row.assessment.cycleId, row.cycle!]),
        ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const departments = [
        ...new Set(
            rowsWithout("department").map((row) => row.person.department),
        ),
    ].sort();
    const positions = [
        ...new Set(rowsWithout("position").map((row) => row.person.position)),
    ].sort();
    const profileVersions = [
        ...new Map(
            rowsWithout("roleProfileVersion").map((row) => [
                roleProfileVersionKey(row.assessment),
                row.assessment.roleProfileSnapshot,
            ]),
        ).entries(),
    ].sort((a, b) =>
        `${a[1].name}-${a[1].version}`.localeCompare(
            `${b[1].name}-${b[1].version}`,
        ),
    );
    const competencyOptions = [
        ...new Map(
            rowsWithout("competencyId").flatMap((row) =>
                row.assessment.roleProfileSnapshot.requirements.map(
                    (requirement) =>
                        [
                            requirement.competencyId,
                            requirement.competency.name,
                        ] as const,
                ),
            ),
        ).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1]));
    const update = <K extends keyof CompetencyAnalyticsFilters>(
        key: K,
        value: CompetencyAnalyticsFilters[K],
    ) => setFilters((items) => ({ ...items, [key]: value }));
    useEffect(() => {
        setFilters((current) => ({
            ...current,
            cycleId:
                current.cycleId === "All" ||
                cycleOptions.some((item) => item.id === current.cycleId)
                    ? current.cycleId
                    : "All",
            department:
                current.department === "All" ||
                departments.includes(current.department)
                    ? current.department
                    : "All",
            position:
                current.position === "All" ||
                positions.includes(current.position)
                    ? current.position
                    : "All",
            roleProfileVersion:
                current.roleProfileVersion === "All" ||
                profileVersions.some(
                    ([key]) => key === current.roleProfileVersion,
                )
                    ? current.roleProfileVersion
                    : "All",
            competencyId:
                current.competencyId === "All" ||
                competencyOptions.some(([id]) => id === current.competencyId)
                    ? current.competencyId
                    : "All",
        }));
    }, [
        cycleOptions.map((item) => item.id).join("|"),
        departments.join("|"),
        positions.join("|"),
        profileVersions.map(([key]) => key).join("|"),
        competencyOptions.map(([id]) => id).join("|"),
    ]);
    const active =
        JSON.stringify(filters) !== JSON.stringify(EMPTY_ANALYTICS_FILTERS);
    return (
        <div className="space-y-4">
            <Filters
                active={active}
                onReset={() => setFilters(EMPTY_ANALYTICS_FILTERS)}
            >
                <SystemSelect
                    aria-label="Assessment Cycle"
                    value={filters.cycleId}
                    onChange={(event) => update("cycleId", event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="All">All Cycles</option>
                    {cycleOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Department"
                    value={filters.department}
                    onChange={(event) =>
                        update("department", event.target.value)
                    }
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="All">All Departments</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Position"
                    value={filters.position}
                    onChange={(event) => update("position", event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="All">All Positions</option>
                    {positions.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Person Type"
                    value={filters.personType}
                    onChange={(event) =>
                        update(
                            "personType",
                            event.target.value as typeof filters.personType,
                        )
                    }
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Employee</option>
                    <option>Trainee</option>
                </SystemSelect>
                <SystemSelect
                    aria-label="Role Profile and Version"
                    value={filters.roleProfileVersion}
                    onChange={(event) =>
                        update("roleProfileVersion", event.target.value)
                    }
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="All">All Role Profile Versions</option>
                    {profileVersions.map(([key, snapshot]) => (
                        <option key={key} value={key}>
                            {snapshot.name} · v{snapshot.version}
                        </option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Competency"
                    value={filters.competencyId}
                    onChange={(event) =>
                        update("competencyId", event.target.value)
                    }
                    className={`${controlClass} w-auto`}
                >
                    <option value="All">All Competencies</option>
                    {competencyOptions.map(([id, name]) => (
                        <option key={id} value={id}>
                            {name}
                        </option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Category"
                    value={filters.category}
                    onChange={(event) =>
                        update(
                            "category",
                            event.target.value as typeof filters.category,
                        )
                    }
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="All">All Categories</option>
                    {COMPETENCY_CATEGORIES.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <SystemSelect
                    aria-label="Assessment Status"
                    value={filters.status}
                    onChange={(event) =>
                        update(
                            "status",
                            event.target.value as typeof filters.status,
                        )
                    }
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {[
                        "Pending",
                        "In Progress",
                        "Submitted",
                        "Pending Validation",
                        "Returned for Revision",
                        "Finalized",
                        "Overdue",
                        "Cancelled",
                    ].map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </SystemSelect>
                <ChartDateRangeControl compact label="Competency analytics date" value={chartDateRange} onChange={setChartDateRange} />
            </Filters>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AnalyticsMetric
                    icon={ClipboardCheck}
                    label="Assessment Completion"
                    value={`${analytics.completionRate}%`}
                    meta={`${analytics.finalized}/${analytics.assigned} finalized`}
                />
                <AnalyticsMetric
                    icon={FolderKanban}
                    label="Role-profile Coverage"
                    value={`${analytics.profileCoverage}%`}
                    meta={`${analytics.currentProfileCount} current personnel profiles`}
                />
                <AnalyticsMetric
                    icon={AlertTriangle}
                    label="Open Critical Gaps"
                    value={analytics.openCriticalGaps.toString()}
                    meta="Finalized below-target results"
                />
                <AnalyticsMetric
                    icon={CalendarClock}
                    label="Reassessments Due"
                    value={analytics.reassessmentsDue.toString()}
                    meta="People due for formal reassessment"
                />
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-800">
                <strong>Comparison rule:</strong> Date scope: {resolveChartDateRange(chartDateRange).label}. Employee and trainee results
                are not ranked or directly compared. The cycle trend never mixes Role Profile versions; when no version is selected,
                it automatically uses the largest valid same-version history available in the current filters.
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <GripVertical className="h-3.5 w-3.5" />
                Drag a card by its grip. The whole card follows the pointer and the eight-card layout reorders live; the order is saved on this device.
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
                <ChartCard
                    title="Requirement attainment"
                    reorder={chartReorder("requirement-attainment")}
                    description="Finalized ratings only"
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={analytics.attainment}
                            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                interval={0}
                            />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar
                                dataKey="value"
                                fill="#F4B400"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard
                    title="Proficiency distribution"
                    reorder={chartReorder("proficiency-distribution")}
                    description="No missing level is counted as zero"
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                            data={analytics.proficiency.map((item) => ({
                                name: proficiencyLabel(item.level),
                                count: item.count,
                            }))}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar
                                dataKey="count"
                                fill="#0ea5e9"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard
                    title="Gaps by competency"
                    reorder={chartReorder("gaps-by-competency")}
                    description="Validated below-requirement results"
                    shape="horizontal"
                    rowCount={analytics.gapsByCompetency.slice(0, 8).length}
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={analytics.gapsByCompetency.slice(0, 8)}
                            layout="vertical"
                            margin={{ top: 6, right: 16, bottom: 6, left: 4 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                horizontal={false}
                            />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={116}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip />
                            <Bar
                                dataKey="count"
                                fill="#ef4444"
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard
                    title="Gaps by category"
                    reorder={chartReorder("gaps-by-category")}
                    description="Same filtered finalized population"
                    shape="donut"
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    <DonutBreakdown
                        data={analytics.gapsByCategory.map((item) => ({
                            label: item.category,
                            value: item.count,
                            color: categoryColors[item.category as CompetencyCategory] ?? "#94a3b8",
                        }))}
                        totalLabel="Validated gaps in scope"
                    />
                </ChartCard>
                <ChartCard
                    title="Gaps by department"
                    reorder={chartReorder("gaps-by-department")}
                    description="Counts, not employee rankings"
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={analytics.gapsByDepartment}
                            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="department"
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar
                                dataKey="gaps"
                                fill="#8b5cf6"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard
                    title="Gaps by position"
                    reorder={chartReorder("gaps-by-position")}
                    description="Counts for the selected comparable scope"
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={analytics.gapsByPosition}
                            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="position" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar
                                dataKey="gaps"
                                fill="#f97316"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard
                    title="Comparable-cycle attainment trend"
                    reorder={chartReorder("comparable-cycle-trend")}
                    description={
                        effectiveTrendLabel
                            ? `Same-version history · ${effectiveTrendLabel}${filters.roleProfileVersion === "All" ? " · auto-selected comparable scope" : ""}`
                            : "No same-version Role Profile has finalized results in at least two cycles."
                    }
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    {effectiveTrendLabel && trendAnalytics.comparableCycles.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={trendAnalytics.comparableCycles}
                                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="cycle" tick={{ fontSize: 11 }} interval={0} />
                                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                <Tooltip formatter={(value) => [`${value}%`, "Attainment"]} />
                                <Line
                                    type="monotone"
                                    dataKey="attainment"
                                    name="Attainment"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState
                            icon={BarChart3}
                            title="No comparable cycle history yet"
                            description="A valid trend needs finalized assessments for the same Role Profile version in at least two cycles."
                        />
                    )}
                </ChartCard>
                <ChartCard
                    title="Development recommendation outcomes"
                    reorder={chartReorder("development-outcomes")}
                    description="Recommendations do not equal course enrollment or gap closure"
                    dateRange={chartDateRange}
                    onDateRangeChange={setChartDateRange}
                    dateLabel="Competency analytics date"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={analytics.recommendationOutcomes}
                            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar
                                dataKey="count"
                                fill="#14b8a6"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
                <SectionCard
                    title="Not-assessed and expired requirements"
                    description="Missing assessment remains a status, never Level 0"
                >
                    <div className="grid grid-cols-2 gap-3 p-4">
                        <Metric
                            label="Not Assessed"
                            value={analytics.notAssessed}
                            tone="indigo"
                        />
                        <Metric
                            label="Expired / Due"
                            value={analytics.expired}
                            tone="rose"
                        />
                    </div>
                </SectionCard>
                <SectionCard
                    title="Assessment validation quality"
                    description="Evidence and workflow indicators, not a performance score"
                >
                    <div className="grid grid-cols-2 gap-3 p-4">
                        <Info
                            label="Pending validation"
                            value={analytics.validationQuality.pendingValidation.toString()}
                        />
                        <Info
                            label="Returned for revision"
                            value={analytics.validationQuality.returnedForRevision.toString()}
                        />
                        <Info
                            label="Required evidence coverage"
                            value={`${analytics.validationQuality.evidenceCoverage}%`}
                        />
                        <Info
                            label="Employee acknowledgments"
                            value={`${analytics.validationQuality.acknowledged}/${analytics.validationQuality.acknowledgmentRequired}`}
                        />
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}

function DonutBreakdown({
    data,
    totalLabel,
}: {
    data: Array<{ label: string; value: number; color: string }>;
    totalLabel: string;
}) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) {
        return (
            <div className="flex min-h-[190px] items-center justify-center rounded-lg bg-slate-50/70 px-5 text-center">
                <div>
                    <p className="text-sm font-bold text-slate-600">No validated distribution in scope</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Change the date or filters to include finalized competency evidence.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid min-h-[190px] gap-3 sm:grid-cols-[minmax(150px,0.82fr)_minmax(0,1.18fr)] sm:items-center">
            <div className="h-[190px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={76}
                            paddingAngle={2}
                        >
                            {data.map((item) => (
                                <Cell key={item.label} fill={item.color} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, "Count"]} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="min-w-0 space-y-2 pr-1">
                {data.map((item) => {
                    const percentage = total ? Math.round((item.value / total) * 100) : 0;
                    return (
                        <div key={item.label} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="min-w-0 flex-1 text-xs font-semibold text-slate-600">{item.label}</span>
                            <span className="shrink-0 text-right">
                                <span className="block text-xs font-extrabold tabular-nums text-slate-800">{item.value}</span>
                                <span className="block text-[10px] font-semibold tabular-nums text-slate-400">{percentage}%</span>
                            </span>
                        </div>
                    );
                })}
                <div className="flex items-center justify-between border-t border-slate-100 px-1 pt-2 text-[11px] font-semibold text-slate-400">
                    <span>{totalLabel}</span>
                    <span className="tabular-nums text-slate-600">{total}</span>
                </div>
            </div>
        </div>
    );
}

function AnalyticsMetric({
    icon: Icon,
    label,
    value,
    meta,
}: {
    icon: typeof Target;
    label: string;
    value: string;
    meta: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xl font-bold text-slate-900">{value}</p>
            <p className="text-xs font-semibold text-slate-600">{label}</p>
            <p className="mt-1 text-xs text-slate-400">{meta}</p>
        </div>
    );
}
function ChartCard({
    title,
    description,
    children,
    rowCount,
    shape = "trend",
    dateRange,
    onDateRangeChange,
    dateLabel = "Chart date",
    reorder,
}: {
    title: string;
    description: string;
    children: ReactNode;
    rowCount?: number;
    shape?: "horizontal" | "donut" | "trend";
    dateRange?: ChartDateRangeValue;
    onDateRangeChange?: (value: ChartDateRangeValue) => void;
    dateLabel?: string;
    reorder?: {
        id: AnalyticsChartId;
        order: number;
        isDragging: boolean;
        isTarget: boolean;
        onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
        onDragEnter: () => void;
        onDrop: () => void;
        onDragEnd: () => void;
    };
}) {
    const height =
        shape === "horizontal"
            ? Math.min(300, Math.max(190, (rowCount ?? 0) * 32 + 54))
            : shape === "donut"
              ? 215
              : undefined;
    return (
        <section
            data-analytics-card={reorder?.id}
            className={`flex h-full min-w-0 flex-col rounded-xl border bg-white p-4 shadow-sm transition ${
                reorder?.isDragging
                    ? "scale-[0.99] border-amber-300 opacity-55"
                    : reorder?.isTarget
                      ? "border-amber-400 ring-2 ring-amber-200/70"
                      : "border-slate-200"
            }`}
            style={reorder ? { order: reorder.order } : undefined}
            onDragEnter={reorder ? (event) => { event.preventDefault(); reorder.onDragEnter(); } : undefined}
            onDragOver={reorder ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } : undefined}
            onDrop={reorder ? (event) => { event.preventDefault(); reorder.onDrop(); } : undefined}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                    {reorder && (
                        <button
                            type="button"
                            draggable
                            aria-label={`Move ${title}`}
                            title="Drag this whole analytics card"
                            onDragStart={reorder.onDragStart}
                            onDragEnd={reorder.onDragEnd}
                            className="mt-0.5 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-300 transition hover:bg-amber-50 hover:text-amber-600 active:cursor-grabbing"
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                    )}
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
                        <p className="mt-0.5 text-xs leading-4 text-slate-400">{description}</p>
                    </div>
                </div>
                {dateRange && onDateRangeChange && (
                    <ChartDateRangeControl compact label={dateLabel} value={dateRange} onChange={onDateRangeChange} />
                )}
            </div>
            <div
                className={shape === "trend" ? "mt-3 h-52 sm:h-56 xl:h-60" : "mt-3"}
                style={height ? { height } : undefined}
            >
                {children}
            </div>
        </section>
    );
}
