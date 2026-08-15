import {
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
    buildAssessmentRows,
    buildAssessorWorkload,
    buildCompetencyAnalytics,
    buildCompetencyProfiles,
    buildGapRows,
    buildOverviewMetrics,
    EMPTY_ANALYTICS_FILTERS,
    filterAssessmentRows,
    formatDate,
    roleProfileVersionKey,
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
    Filter,
    FolderKanban,
    Library,
    ListChecks,
    RefreshCw,
    Search,
    ShieldCheck,
    Target,
    UserCheck,
    Users,
    Wrench,
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
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
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                {children}
                {active && (
                    <button
                        type="button"
                        onClick={onReset}
                        className={secondaryButtonClass}
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Reset
                    </button>
                )}
            </div>
        </section>
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
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 text-xs text-slate-500">
            <span>
                Showing {first}–{last} of {total}
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => onPage(page - 1)}
                    className={secondaryButtonClass}
                >
                    Previous
                </button>
                <span>
                    Page {page} of {pageCount}
                </span>
                <button
                    type="button"
                    disabled={page === pageCount}
                    onClick={() => onPage(page + 1)}
                    className={secondaryButtonClass}
                >
                    Next
                </button>
            </div>
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
    onSelectGap,
    onCreateCompetency,
    onCreateCycle,
    onCreateAssignment,
}: {
    state: CompetencyState;
    onNavigate: (
        tab:
            | "Assessment Cycles"
            | "Assessments"
            | "Competency Profiles"
            | "Gap & Development",
        focus: string,
    ) => void;
    onSelectAssessment: (id: string) => void;
    onSelectGap: (id: string) => void;
    onCreateCompetency: () => void;
    onCreateCycle: () => void;
    onCreateAssignment: () => void;
}) {
    const metrics = useMemo(() => buildOverviewMetrics(state), [state]);
    const profiles = useMemo(
        () => buildCompetencyProfiles(state).filter((item) => item.profile),
        [state],
    );
    const workload = useMemo(
        () => buildAssessorWorkload(state, metrics.activeCycleIds),
        [state, metrics.activeCycleIds.join("|")],
    );
    const requirementDistribution = [
        {
            name: "Meets / Exceeds",
            value: profiles.reduce((sum, item) => sum + item.meetsOrExceeds, 0),
            color: "#10b981",
        },
        {
            name: "Below",
            value: profiles.reduce((sum, item) => sum + item.openGaps, 0),
            color: "#ef4444",
        },
        {
            name: "Not Assessed",
            value: profiles.reduce((sum, item) => sum + item.notAssessed, 0),
            color: "#94a3b8",
        },
    ];
    const coverageByCategory = COMPETENCY_CATEGORIES.map((category) => {
        const activeIds = new Set(
            state.competencies
                .filter(
                    (item) =>
                        item.status === "Active" && item.category === category,
                )
                .map((item) => item.id),
        );
        return {
            category: category.replace(" & ", " / "),
            count: state.roleProfiles
                .filter((item) => item.status === "Active")
                .reduce(
                    (sum, profile) =>
                        sum +
                        profile.requirements.filter((requirement) =>
                            activeIds.has(requirement.competencyId),
                        ).length,
                    0,
                ),
        };
    });
    const cards = [
        {
            key: "cycle",
            label: "Active Assessment Cycle",
            value:
                metrics.activeCycles.length === 1
                    ? metrics.activeCycles[0].name
                    : metrics.activeCycles.length
                      ? `${metrics.activeCycles.length} active cycles`
                      : "None",
            meta: `${metrics.assigned} assignments across the active cycle population`,
            icon: ClipboardList,
            action: () => onNavigate("Assessment Cycles", "active"),
        },
        {
            key: "completion",
            label: "Assessment Completion",
            value: `${metrics.completionRate}%`,
            meta: `${metrics.finalized} of ${metrics.assigned} finalized`,
            icon: CheckCircle2,
            action: () =>
                onNavigate(
                    "Assessments",
                    metrics.activeCycles.length ? "active" : "All",
                ),
        },
        {
            key: "gaps",
            label: "Open Competency Gaps",
            value: metrics.gaps.length,
            meta: `${metrics.criticalGaps.length} critical requirements`,
            icon: AlertTriangle,
            action: () => onNavigate("Gap & Development", "open"),
        },
        {
            key: "reassessment",
            label: "Reassessments Due",
            value: metrics.reassessments.length,
            meta: "Validated requirements past due",
            icon: CalendarClock,
            action: () => onNavigate("Competency Profiles", "Reassessment Due"),
        },
    ];
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            onClick={card.action}
                            className="relative rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                        >
                            <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#F4B400]" />
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        {card.label}
                                    </p>
                                    <p className="mt-1 truncate text-lg font-bold text-slate-900">
                                        {card.value}
                                    </p>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-slate-500">
                                {card.meta}
                            </p>
                        </button>
                    );
                })}
            </div>

            <SectionCard
                title="Active cycle progress"
                description={
                    metrics.activeCycles.length
                        ? metrics.activeCycles
                              .map((cycle) => cycle.name)
                              .join(" · ")
                        : "No active assessment cycle"
                }
            >
                <div className="grid gap-2.5 p-3 sm:grid-cols-3 sm:p-4">
                    <Metric
                        label="Finalized"
                        value={metrics.finalized}
                        tone="emerald"
                    />
                    <Metric
                        label="Pending HR validation"
                        value={metrics.pendingValidation.length}
                        tone="indigo"
                    />
                    <Metric
                        label="Overdue assessments"
                        value={metrics.overdue.length}
                        tone="rose"
                    />
                </div>
                <div className="border-t border-slate-200">
                    {metrics.pendingValidation.length || metrics.overdue.length ? (
                        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
                            {[...metrics.pendingValidation, ...metrics.overdue]
                                .slice(0, 6)
                                .map((row) => (
                                    <button
                                        type="button"
                                        key={row.assessment.id}
                                        onClick={() =>
                                            onSelectAssessment(row.assessment.id)
                                        }
                                        className="min-w-0 bg-white px-3 py-2.5 text-left transition hover:bg-amber-50/60"
                                    >
                                        <div className="flex min-w-0 items-start justify-between gap-2">
                                            <PersonCell
                                                person={row.person}
                                                subtitle={row.cycle?.name}
                                            />
                                            <StatusBadge value={row.displayStatus} />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">
                                            {row.profile?.name ?? "Role profile unavailable"} · Due {formatDate(row.assessment.dueDate)}
                                        </p>
                                    </button>
                                ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={ClipboardCheck}
                            title="No urgent cycle records"
                            description="Pending validation and overdue assessments will appear here."
                        />
                    )}
                </div>
            </SectionCard>

            <SectionCard
                title="Quick actions"
                description="Configuration and assignment shortcuts"
            >
                <div className="grid gap-2 p-3 sm:grid-cols-3">
                    <button
                        type="button"
                        onClick={onCreateCompetency}
                        className={`${secondaryButtonClass} w-full justify-start`}
                    >
                        <Library className="h-4 w-4 text-amber-600" /> Add
                        competency definition
                    </button>
                    <button
                        type="button"
                        onClick={onCreateCycle}
                        className={`${secondaryButtonClass} w-full justify-start`}
                    >
                        <CalendarClock className="h-4 w-4 text-amber-600" />{" "}
                        Create assessment cycle
                    </button>
                    <button
                        type="button"
                        onClick={onCreateAssignment}
                        className={`${secondaryButtonClass} w-full justify-start`}
                    >
                        <UserCheck className="h-4 w-4 text-amber-600" />{" "}
                        Create assessment assignment
                    </button>
                </div>
            </SectionCard>

            <SectionCard
                title="Assessor workload"
                description="Only people with explicit active assessor authorization appear here"
            >
                {workload.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    {[
                                        "Assessor",
                                        "Assigned",
                                        "Finalized",
                                        "In Progress",
                                        "Pending",
                                        "Overdue",
                                        "Completion",
                                    ].map((item) => (
                                        <th
                                            key={item}
                                            className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                                        >
                                            {item}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {workload.map((row, index) => (
                                    <tr key={row.assessor?.id ?? index}>
                                        <td className="px-3 py-2.5">
                                            {row.assessor ? (
                                                <PersonCell
                                                    person={row.assessor}
                                                    subtitle={`${row.assessor.position} · ${row.assessor.accessRole} access`}
                                                />
                                            ) : (
                                                "Unknown"
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-bold">
                                            {row.assigned}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-emerald-700">
                                            {row.finalized}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-amber-700">
                                            {row.inProgress}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-indigo-700">
                                            {row.pending}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-rose-700">
                                            {row.overdue}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <ProgressBar value={row.progress} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={Users}
                        title="No assessor workload"
                        description="Create authorized assessor assignments first."
                    />
                )}
            </SectionCard>

            <div className="grid gap-3 xl:grid-cols-2">
                    <SectionCard
                        title="Priority critical gaps"
                        description="Finalized results below a critical role requirement"
                    >
                        <div className="divide-y divide-slate-200">
                            {metrics.criticalGaps.slice(0, 5).map((gap) => (
                                <button
                                    type="button"
                                    key={gap.id}
                                    onClick={() => onSelectGap(gap.id)}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-amber-50/60 sm:px-4"
                                >
                                    <PersonCell
                                        person={gap.person}
                                        subtitle={gap.competency?.name}
                                    />
                                    <div className="shrink-0 text-right">
                                        <p className="text-xs font-bold text-rose-700">
                                            Gap {gap.gap}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            L{gap.currentLevel} → L
                                            {gap.requirement.requiredLevel}
                                        </p>
                                    </div>
                                </button>
                            ))}
                            {!metrics.criticalGaps.length && (
                                <EmptyState
                                    icon={ShieldCheck}
                                    title="No open critical gaps"
                                />
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Active role-profile requirements by category"
                        description="Active role-profile requirement usage"
                    >
                        <div
                            className="px-2 pb-3 pt-2 sm:px-3"
                            style={{
                                height: Math.max(
                                    190,
                                    coverageByCategory.length * 34 + 32,
                                ),
                            }}
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={coverageByCategory}
                                    layout="vertical"
                                    margin={{ top: 2, right: 12, bottom: 2, left: 0 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        horizontal={false}
                                    />
                                    <XAxis
                                        type="number"
                                        allowDecimals={false}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="category"
                                        width={150}
                                        interval={0}
                                        tick={{ fontSize: 12 }}
                                        tickMargin={8}
                                    />
                                    <Tooltip />
                                    <Bar
                                        dataKey="count"
                                        fill="#F4B400"
                                        radius={[0, 4, 4, 0]}
                                        barSize={20}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Requirement attainment distribution"
                        description="Current finalized levels only; missing assessments remain Not Assessed"
                    >
                        <div className="h-52 px-3 pb-2 pt-1 sm:h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 6, bottom: 0, left: 6 }}>
                                    <Pie
                                        data={requirementDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="42%"
                                        innerRadius={42}
                                        outerRadius={68}
                                    >
                                        {requirementDistribution.map((item) => (
                                            <Cell
                                                key={item.name}
                                                fill={item.color}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={30}
                                        wrapperStyle={{ fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Upcoming reassessments"
                        description="Validated requirements due in the next 30 days"
                    >
                        <div className="divide-y divide-slate-200">
                            {metrics.upcomingReassessments
                                .sort((a, b) =>
                                    (a.detail.validUntil ?? "").localeCompare(
                                        b.detail.validUntil ?? "",
                                    ),
                                )
                                .slice(0, 6)
                                .map(({ row, detail }) => (
                                    <button
                                        type="button"
                                        key={`${row.person.id}-${detail.requirement.id}`}
                                        onClick={() =>
                                            onNavigate(
                                                "Competency Profiles",
                                                row.person.id,
                                            )
                                        }
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-amber-50/60 sm:px-4"
                                    >
                                        <PersonCell
                                            person={row.person}
                                            subtitle={detail.competency?.name}
                                        />
                                        <div className="shrink-0 text-right">
                                            <p className="text-xs font-semibold text-slate-700">
                                                {formatDate(detail.validUntil)}
                                            </p>
                                            <span className="text-xs font-bold text-amber-700">
                                                Upcoming
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            {!metrics.upcomingReassessments.length && (
                                <EmptyState
                                    icon={CalendarClock}
                                    title="No reassessments due in 30 days"
                                />
                            )}
                        </div>
                    </SectionCard>
            </div>

            <SectionCard
                title="Recent competency activity"
                description="Competency audit activity feed"
            >
                <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
                    {state.activities
                        .slice()
                        .sort((a, b) =>
                            b.createdAt.localeCompare(a.createdAt),
                        )
                        .slice(0, 6)
                        .map((activity) => (
                            <div
                                key={activity.id}
                                className="flex min-w-0 gap-2.5 bg-white px-3 py-2.5 sm:px-4"
                            >
                                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#F4B400]" />
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-slate-700">
                                        {activity.title}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-500">
                                        {activity.detail}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {activity.type} ·{" "}
                                        {formatDate(activity.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
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
    onCreate,
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
        <div className="space-y-4">
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
                <select
                    aria-label="Competency category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {COMPETENCY_CATEGORIES.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>
                <select
                    aria-label="Competency status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Draft</option>
                    <option>Active</option>
                    <option>Archived</option>
                </select>
                <select
                    aria-label="Sort competencies"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="name">Name A–Z</option>
                    <option value="code">Code</option>
                    <option value="updated">Recently updated</option>
                </select>
            </Filters>
            <SectionCard
                title="Competency Library"
                description={`${rows.length} of ${state.competencies.length} definitions · required levels are intentionally excluded from this table`}
            >
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    {[
                                        "Competency Code",
                                        "Competency Name",
                                        "Category",
                                        "Assessment Methods",
                                        "Role Profile Usage",
                                        "Version",
                                        "Status",
                                        "Last Updated",
                                        "Updated By",
                                    ].map((header, index) => (
                                        <th
                                            key={header}
                                            className={`whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400 ${[0, 4, 7, 8].includes(index) ? "" : "hidden lg:table-cell"}`}
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {pagination.pageRows.map((item) => (
                                    <tr
                                        key={item.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(item.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () =>
                                                onSelect(item.id),
                                            )
                                        }
                                        className="cursor-pointer hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-3 py-2.5 text-xs font-bold text-slate-700">
                                            {item.code}
                                        </td>
                                        <td className="min-w-52 px-3 py-2.5">
                                            <p className="text-xs font-semibold text-slate-800">
                                                {item.name}
                                            </p>
                                            <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                                                {item.definition}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-600">
                                            {item.category}
                                        </td>
                                        <td className="max-w-xs px-3 py-2.5 text-xs text-slate-500">
                                            {item.assessmentMethods.join(", ")}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold">
                                            {usage(item.id)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            v{item.version}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge value={item.status} />
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {formatDate(item.lastUpdated)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {item.updatedBy}
                                        </td>
                                    </tr>
                                ))}
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
    onCreate,
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
        const profile = state.roleProfiles.find(
            (item) => item.id === profileId,
        );
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
    return (
        <div className="space-y-4">
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
                <select
                    aria-label="Role profile department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>
                <select
                    aria-label="Role profile status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Draft</option>
                    <option>Active</option>
                    <option>Archived</option>
                </select>
            </Filters>
            <SectionCard
                title="Position-based Role Profiles"
                description="One active profile version per position, department, and applicable person type"
            >
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    {[
                                        "Profile Name",
                                        "Position",
                                        "Department",
                                        "Applies To",
                                        "Required Competencies",
                                        "Critical Competencies",
                                        "Assigned People",
                                        "Version",
                                        "Effective Date",
                                        "Status",
                                    ].map((header) => (
                                        <th
                                            key={header}
                                            className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {pagination.pageRows.map((profile) => (
                                    <tr
                                        key={profile.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(profile.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () =>
                                                onSelect(profile.id),
                                            )
                                        }
                                        className="cursor-pointer hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="min-w-56 px-3 py-2.5">
                                            <p className="text-xs font-semibold text-slate-800">
                                                {profile.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                Click to inspect requirements
                                            </p>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {profile.position}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {profile.department}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {profile.appliesTo}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold">
                                            {profile.requirements.length}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold text-rose-600">
                                            {
                                                profile.requirements.filter(
                                                    (item) => item.critical,
                                                ).length
                                            }
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold">
                                            {assignedPeople(profile.id)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            v{profile.version}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {formatDate(profile.effectiveDate)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge
                                                value={profile.status}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={FolderKanban}
                        title="No role profiles match"
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
    onPrepareAssignments,
    onAuthorize,
    onToggleAuthorization,
}: {
    state: CompetencyState;
    focus: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onPrepareAssignments: (id: string) => void;
    onAuthorize: () => void;
    onToggleAuthorization: (id: string) => void;
}) {
    const [status, setStatus] = useState(focus === "active" ? "Active" : "All");
    useEffect(() => {
        if (focus === "active") setStatus("Active");
    }, [focus]);
    const rows = state.cycles
        .filter((item) => status === "All" || item.status === status)
        .sort((left, right) => right.startDate.localeCompare(left.startDate));
    const cyclePagination = usePagination(rows, 6);
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
                <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Draft</option>
                    <option>Scheduled</option>
                    <option>Active</option>
                    <option>Closed</option>
                    <option>Cancelled</option>
                </select>
                <button
                    type="button"
                    onClick={onAuthorize}
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
                                        <StatusBadge value={cycle.status} />
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
                                    label="Profiles"
                                    value={cycle.roleProfileIds.length.toString()}
                                />
                                <Info
                                    label="Due Rule"
                                    value={`${cycle.dueDaysAfterAssignment} days`}
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
                                {["Scheduled", "Active"].includes(
                                    cycle.status,
                                ) && (
                                    <button
                                        type="button"
                                        onClick={() => onPrepareAssignments(cycle.id)}
                                        className={primaryButtonClass}
                                    >
                                        <ListChecks className="h-3.5 w-3.5" />{" "}
                                        Prepare Assignments
                                    </button>
                                )}
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
                title="Authorized assessor assignments"
                description="Access role does not grant assessment authority"
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                {[
                                    "Assessor",
                                    "Access Role",
                                    "Scope",
                                    "Scope Value",
                                    "Status",
                                    "Authorized By",
                                    "Action",
                                ].map((header) => (
                                    <th
                                        key={header}
                                        className="px-3 py-2.5 text-left text-xs font-bold uppercase text-slate-400"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
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
                                        <td className="px-3 py-2.5">
                                            {assessor ? (
                                                <PersonCell person={assessor} />
                                            ) : (
                                                item.assessorId
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {assessor?.accessRole ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {item.scope}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {scopeLabel ?? item.scopeValue}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge
                                                value={
                                                    item.active
                                                        ? "Active"
                                                        : "Archived"
                                                }
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {item.authorizedBy}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <button
                                                type="button"
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
    onCreate,
}: {
    state: CompetencyState;
    focus: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
}) {
    const [query, setQuery] = useState("");
    const [cycleId, setCycleId] = useState(
        focus && focus !== "All" ? focus : "All",
    );
    const [status, setStatus] = useState("All");
    const [department, setDepartment] = useState("All");
    const [personType, setPersonType] = useState("All");
    const [sort, setSort] = useState("due");
    useEffect(() => {
        if (focus && focus !== "All") setCycleId(focus);
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
    return (
        <div className="space-y-4">
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
                <select
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
                </select>
                <select
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
                </select>
                <select
                    aria-label="Department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>
                <select
                    aria-label="Person type"
                    value={personType}
                    onChange={(event) => setPersonType(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Employee</option>
                    <option>Trainee</option>
                </select>
                <select
                    aria-label="Sort assessments"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="due">Due date</option>
                    <option value="updated">Recently updated</option>
                    <option value="person">Person A–Z</option>
                </select>
            </Filters>
            <SectionCard
                title="Competency Assessments"
                description="Each row is one person’s complete role-profile assessment—not one row per competency"
            >
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    {[
                                        "Person",
                                        "Person Type",
                                        "Position",
                                        "Department",
                                        "Assessment Cycle",
                                        "Assigned Assessor",
                                        "Competency Progress",
                                        "Status",
                                        "Due Date",
                                        "Last Updated",
                                    ].map((header) => (
                                        <th
                                            key={header}
                                            className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {pagination.pageRows.map((row) => (
                                    <tr
                                        key={row.assessment.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() =>
                                            onSelect(row.assessment.id)
                                        }
                                        onKeyDown={(event) =>
                                            activateRow(event, () =>
                                                onSelect(row.assessment.id),
                                            )
                                        }
                                        className="cursor-pointer hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-3 py-2.5">
                                            <PersonCell person={row.person} />
                                        </td>
                                        <td className="hidden px-3 py-2.5 text-xs lg:table-cell">
                                            {row.person.personType}
                                        </td>
                                        <td className="hidden px-3 py-2.5 text-xs lg:table-cell">
                                            {row.person.position}
                                        </td>
                                        <td className="hidden px-3 py-2.5 text-xs lg:table-cell">
                                            {row.person.department}
                                        </td>
                                        <td className="min-w-48 px-3 py-2.5 text-xs font-semibold">
                                            {row.cycle?.name ?? "Unknown cycle"}
                                        </td>
                                        <td className="hidden min-w-48 px-3 py-2.5 lg:table-cell">
                                            {row.assessor ? (
                                                <PersonCell
                                                    person={row.assessor}
                                                />
                                            ) : (
                                                "Unassigned"
                                            )}
                                        </td>
                                        <td className="hidden px-3 py-2.5 lg:table-cell">
                                            <ProgressBar value={row.progress} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge
                                                value={row.displayStatus}
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {formatDate(row.assessment.dueDate)}
                                        </td>
                                        <td className="hidden px-3 py-2.5 text-xs lg:table-cell">
                                            {formatDate(
                                                row.assessment.lastUpdated,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={ClipboardList}
                        title="No assessments match"
                        description="Reset the filters or create an authorized assessment assignment."
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

export function ProfilesView({
    state,
    focus,
    onSelect,
}: {
    state: CompetencyState;
    focus: string;
    onSelect: (personId: string) => void;
}) {
    const [query, setQuery] = useState("");
    const [department, setDepartment] = useState("All");
    const [personType, setPersonType] = useState("All");
    const [status, setStatus] = useState(
        focus && focus !== "All" && !focus.startsWith("user-") ? focus : "All",
    );
    useEffect(() => {
        if (focus && focus !== "All" && !focus.startsWith("user-"))
            setStatus(focus);
    }, [focus]);
    const rows = useMemo(() => buildCompetencyProfiles(state), [state])
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
                (status === "All" || row.status === status),
        )
        .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
    const pagination = usePagination(rows);
    useEffect(() => {
        if (focus.startsWith("user-")) onSelect(focus);
    }, [focus]);
    const departments = [
        ...new Set(SHARED_PERSONNEL.map((item) => item.department)),
    ].sort();
    return (
        <div className="space-y-4">
            <Filters
                active={Boolean(
                    query ||
                        department !== "All" ||
                        personType !== "All" ||
                        status !== "All",
                )}
                onReset={() => {
                    setQuery("");
                    setDepartment("All");
                    setPersonType("All");
                    setStatus("All");
                }}
            >
                <SearchBox
                    value={query}
                    onChange={setQuery}
                    placeholder="Search person or position…"
                />
                <select
                    aria-label="Profile department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>
                <select
                    aria-label="Profile person type"
                    value={personType}
                    onChange={(event) => setPersonType(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Employee</option>
                    <option>Trainee</option>
                </select>
                <select
                    aria-label="Requirement status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
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
                </select>
            </Filters>
            <SectionCard
                title="Current Competency Profiles"
                description="One row per person; unrelated competencies are not reduced to an overall average"
            >
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    {[
                                        "Person",
                                        "Person Type",
                                        "Position",
                                        "Department",
                                        "Active Role Profile",
                                        "Profile Coverage",
                                        "Meets/Exceeds",
                                        "Open Gaps",
                                        "Not Assessed",
                                        "Last Assessed",
                                        "Next Reassessment",
                                        "Requirement Status",
                                    ].map((header) => (
                                        <th
                                            key={header}
                                            className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {pagination.pageRows.map((row) => (
                                    <tr
                                        key={row.person.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(row.person.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () =>
                                                onSelect(row.person.id),
                                            )
                                        }
                                        className="cursor-pointer hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-3 py-2.5">
                                            <PersonCell person={row.person} />
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {row.person.personType}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {row.person.position}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {row.person.department}
                                        </td>
                                        <td className="min-w-52 px-3 py-2.5 text-xs font-semibold">
                                            {row.profile
                                                ? `${row.profile.name} · v${row.profile.version}`
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <ProgressBar value={row.coverage} />
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold text-emerald-700">
                                            {row.meetsOrExceeds}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold text-rose-700">
                                            {row.openGaps}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold text-slate-600">
                                            {row.notAssessed}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {formatDate(row.lastAssessed)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {formatDate(row.nextReassessment)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge value={row.status} />
                                        </td>
                                    </tr>
                                ))}
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
                    onPage={pagination.setPage}
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
    const gaps = useMemo(() => buildGapRows(state), [state])
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
                    row.recommendationStatus === development),
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
    return (
        <div className="space-y-4">
            <p className="text-xs text-slate-500">
                Learning and Training recommendations do not close gaps; only a
                new finalized reassessment can.
            </p>
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
                <select
                    aria-label="Department"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    {departments.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>
                <select
                    aria-label="Criticality"
                    value={critical}
                    onChange={(event) => setCritical(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>Critical</option>
                    <option>Non-critical</option>
                </select>
                <select
                    aria-label="Development status"
                    value={development}
                    onChange={(event) => setDevelopment(event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option>All</option>
                    <option>No Recommendation</option>
                    <option>Recommended</option>
                    <option>Reviewed</option>
                    <option>Reassessment Requested</option>
                    <option>Reassessed</option>
                </select>
            </Filters>
            <SectionCard
                title="Competency Gaps & Development"
                description={`${gaps.length} validated requirements below target; missing assessments are excluded`}
            >
                {gaps.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    {[
                                        "Person",
                                        "Person Type",
                                        "Position",
                                        "Department",
                                        "Competency",
                                        "Current Level",
                                        "Required Level",
                                        "Gap",
                                        "Critical",
                                        "Last Assessed",
                                        "Development Status",
                                        "Reassessment Due",
                                    ].map((header) => (
                                        <th
                                            key={header}
                                            className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {pagination.pageRows.map((row) => (
                                    <tr
                                        key={row.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onSelect(row.id)}
                                        onKeyDown={(event) =>
                                            activateRow(event, () =>
                                                onSelect(row.id),
                                            )
                                        }
                                        className="cursor-pointer hover:bg-amber-50/60 focus:bg-amber-50 focus:outline-none"
                                    >
                                        <td className="px-3 py-2.5">
                                            <PersonCell person={row.person} />
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {row.person.personType}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {row.person.position}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {row.person.department}
                                        </td>
                                        <td className="min-w-48 px-3 py-2.5 text-xs font-semibold">
                                            {row.competency?.name ?? "Unknown"}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            L{row.currentLevel} ·{" "}
                                            {proficiencyLabel(row.currentLevel)}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            L{row.requirement.requiredLevel} ·{" "}
                                            {proficiencyLabel(
                                                row.requirement.requiredLevel,
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold text-rose-700">
                                            {row.gap}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {row.requirement.critical ? (
                                                <StatusBadge value="Critical" />
                                            ) : (
                                                <span className="text-xs text-slate-400">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {formatDate(row.lastAssessed)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge
                                                value={row.recommendationStatus}
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {formatDate(
                                                row.recommendations[0]
                                                    ?.reassessmentDue,
                                            )}
                                        </td>
                                    </tr>
                                ))}
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

export function AnalyticsView({ state }: { state: CompetencyState }) {
    const [filters, setFilters] = useState<CompetencyAnalyticsFilters>(
        EMPTY_ANALYTICS_FILTERS,
    );
    const analytics = useMemo(
        () => buildCompetencyAnalytics(state, filters),
        [state, filters],
    );
    const allRows = useMemo(() => buildAssessmentRows(state), [state]);
    const rowsWithout = <K extends keyof CompetencyAnalyticsFilters>(key: K) =>
        filterAssessmentRows(
            allRows,
            { ...filters, [key]: "All" } as CompetencyAnalyticsFilters,
            state,
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
                <select
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
                </select>
                <select
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
                </select>
                <select
                    aria-label="Position"
                    value={filters.position}
                    onChange={(event) => update("position", event.target.value)}
                    className={`${controlClass} w-full sm:w-auto`}
                >
                    <option value="All">All Positions</option>
                    {positions.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>
                <select
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
                </select>
                <select
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
                </select>
                <select
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
                </select>
                <select
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
                </select>
                <select
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
                </select>
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
                    meta={`${analytics.currentProfileCount} assigned profiles`}
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
                    meta="Expired validated requirements"
                />
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-800">
                <strong>Comparison rule:</strong> Employee and trainee results
                are not ranked or directly compared. Select one Role Profile and
                Version before interpreting gap trends across cycles.
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
                <ChartCard
                    title="Requirement attainment"
                    description="Finalized ratings only"
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
                    description="No missing level is counted as zero"
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
                    description="Validated below-requirement results"
                    shape="horizontal"
                    rowCount={analytics.gapsByCompetency.slice(0, 8).length}
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
                    description="Same filtered finalized population"
                    shape="donut"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={analytics.gapsByCategory}
                                dataKey="count"
                                nameKey="category"
                                innerRadius={45}
                                outerRadius={75}
                            >
                                {analytics.gapsByCategory.map((item) => (
                                    <Cell
                                        key={item.category}
                                        fill={
                                            categoryColors[
                                                item.category as CompetencyCategory
                                            ] ?? "#94a3b8"
                                        }
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard
                    title="Gaps by department"
                    description="Counts, not employee rankings"
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
                    description="Counts for the selected comparable scope"
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
                    description={
                        filters.roleProfileVersion === "All"
                            ? "Select one Role Profile and Version to enable a valid trend."
                            : "Attainment within the selected role-profile version scope"
                    }
                >
                    {filters.roleProfileVersion === "All" ? (
                        <EmptyState
                            icon={BarChart3}
                            title="Comparable scope required"
                            description="Mixed profile versions are intentionally not charted as one trend."
                        />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={analytics.comparableCycles}
                                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="cycle" tick={{ fontSize: 12 }} />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="attainment"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
                <ChartCard
                    title="Development recommendation outcomes"
                    description="Recommendations do not equal course enrollment or gap closure"
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
}: {
    title: string;
    description: string;
    children: ReactNode;
    rowCount?: number;
    shape?: "horizontal" | "donut" | "trend";
}) {
    const height =
        shape === "horizontal"
            ? Math.min(300, Math.max(190, (rowCount ?? 0) * 32 + 54))
            : shape === "donut"
              ? 215
              : undefined;
    return (
        <section className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs leading-4 text-slate-400">{description}</p>
            <div
                className={shape === "trend" ? "mt-3 h-52 sm:h-56 xl:h-60" : "mt-3"}
                style={height ? { height } : undefined}
            >
                {children}
            </div>
        </section>
    );
}
