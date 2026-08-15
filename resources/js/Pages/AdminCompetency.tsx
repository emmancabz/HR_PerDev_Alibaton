import {
    AssessmentAssignmentForm,
    AssessorAuthorizationForm,
    CompetencyForm,
    CycleForm,
    EvidenceForm,
    RecommendationForm,
    RoleProfileForm,
} from "@/Components/Competency/CompetencyForms";
import {
    AnalyticsView,
    AssessmentsView,
    CyclesView,
    GapDevelopmentView,
    LibraryView,
    OverviewView,
    ProfilesView,
    RoleProfilesView,
} from "@/Components/Competency/CompetencyViews";
import {
    AppDrawer,
    AppModal,
    ConfirmDialog,
    controlClass,
    EmptyState,
    Field,
    PersonCell,
    primaryButtonClass,
    ProgressBar,
    SectionCard,
    secondaryButtonClass,
    StatusBadge,
} from "@/Components/Competency/CompetencyUI";
import PageHeader from "@/Components/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import {
    cloneAssessmentCycleSnapshot,
    cloneRoleProfileSnapshot,
    localDateTimeValue,
    localDateValue,
    PROFICIENCY_LEVELS,
    proficiencyLabel,
    snapshotRoleProfile,
    snapshotAssessmentCycle,
    type AssessmentCycle,
    type AssessmentEvidence,
    type AssessmentStatus,
    type AssessorAuthorization,
    type CompetencyAssessment,
    type CompetencyAuditEntry,
    type CompetencyDefinition,
    type CompetencyRating,
    type DevelopmentRecommendation,
    type FinalizedAssessmentSnapshot,
    type ProficiencyLevel,
    type RecommendationType,
    type RoleProfile,
    uniqueId,
} from "@/data/competency";
import {
    assessmentProgress,
    buildAssessmentRows,
    buildCompetencyProfiles,
    buildGapRows,
    canAssess,
    cyclePopulationMatches,
    cycleConfigurationMatches,
    findActiveProfileForPerson,
    formatDate,
    getAuthorizedAssessors,
    getRequirementResult,
    latestFinalizedSnapshot,
    resolveAssessmentAssessor,
    validateAssessmentForSubmit,
} from "@/data/competencyCalculations";
import {
    acknowledgeFinalizedAssessmentVersion,
    ensureCompetencyWorkingDraft,
    ensureRoleProfileWorkingDraft,
    findAssessmentAcknowledgmentEvent,
    publishCompetencyDraft,
    publishRoleProfileDraft,
} from "@/data/competencyLifecycle";
import { useCompetencyStore } from "@/data/competencyStorage";
import { SHARED_PERSONNEL, getPersonById } from "@/data/personnel";
import { Head, usePage } from "@inertiajs/react";
import {
    AlertTriangle,
    Archive,
    BarChart3,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
    Copy,
    FileCheck2,
    FolderKanban,
    History,
    Library,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Send,
    Settings2,
    ShieldCheck,
    UserCheck,
    Users,
    Wrench,
    X,
    type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";

type WorkspaceTab =
    | "Overview"
    | "Competency Library"
    | "Role Profiles"
    | "Assessment Cycles"
    | "Assessments"
    | "Competency Profiles"
    | "Gap & Development"
    | "Analytics";

const WORKSPACE_TABS: { label: WorkspaceTab; icon: LucideIcon }[] = [
    { label: "Overview", icon: ClipboardList },
    { label: "Competency Library", icon: Library },
    { label: "Role Profiles", icon: FolderKanban },
    { label: "Assessment Cycles", icon: CalendarClock },
    { label: "Assessments", icon: FileCheck2 },
    { label: "Competency Profiles", icon: Users },
    { label: "Gap & Development", icon: Wrench },
    { label: "Analytics", icon: BarChart3 },
];

type DetailSelection =
    | { kind: "competency"; id: string }
    | { kind: "profile"; id: string }
    | { kind: "cycle"; id: string }
    | { kind: "assessment"; id: string }
    | { kind: "person-profile"; id: string }
    | { kind: "gap"; id: string }
    | null;

type ConfirmAction = {
    title: string;
    description: string;
    label: string;
    tone?: "danger" | "warning" | "primary";
    reasonRequired?: boolean;
    execute: (reason: string) => void;
} | null;

type CompetencyFormState = { id: string | null; duplicate: boolean } | null;
type RecommendationTarget = {
    gapId: string;
    type: RecommendationType;
    existingId: string | null;
} | null;
type EvidenceTarget = {
    assessmentId: string;
    competencyId: string;
    evidenceId?: string;
} | null;
type GapRow = ReturnType<typeof buildGapRows>[number];

function nowIso(): string {
    return localDateTimeValue();
}

function addDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateValue(date);
}

function cloneRatings(ratings: CompetencyRating[]): CompetencyRating[] {
    return ratings.map((rating) => ({
        ...rating,
        evidence: rating.evidence.map((item) => ({ ...item })),
    }));
}

function finalizedSnapshotFor(
    assessment: CompetencyAssessment,
    finalizedAt: string,
    finalizedBy: string,
    validationNotes: string,
): FinalizedAssessmentSnapshot {
    return {
        version: assessment.finalizedSnapshots.length + 1,
        profile: cloneRoleProfileSnapshot(assessment.roleProfileSnapshot),
        cycle: cloneAssessmentCycleSnapshot(assessment.cycleSnapshot),
        ratings: cloneRatings(assessment.ratings),
        assessorId: assessment.assessorId,
        hrValidationNotes: validationNotes,
        submittedAt: assessment.submittedAt,
        employeeAcknowledgedAt: null,
        finalizedAt,
        finalizedBy,
    };
}

export default function AdminCompetency() {
    const { state, setState, storageError } = useCompetencyStore();
    const authUser = usePage().props.auth.user;
    const actor = SHARED_PERSONNEL.find(
        (person) =>
            person.id === authUser.personnel_key ||
            person.email === authUser.email ||
            person.fullName === authUser.name,
    );
    const actorId = actor?.id ?? "";
    const actorName = actor?.fullName ?? authUser.name ?? "Current Admin User";
    const canValidate =
        actor?.accessRole === "Admin" ||
        actor?.accessRole === "HR" ||
        authUser.role === "admin" ||
        authUser.role === "hr";

    const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("Overview");
    const [workspaceFocus, setWorkspaceFocus] = useState("");
    const [detail, setDetail] = useState<DetailSelection>(null);
    const [competencyForm, setCompetencyForm] =
        useState<CompetencyFormState>(null);
    const [profileFormId, setProfileFormId] = useState<
        string | null | undefined
    >(undefined);
    const [cycleFormId, setCycleFormId] = useState<string | null | undefined>(
        undefined,
    );
    const [assignmentFormCycleId, setAssignmentFormCycleId] = useState<
        string | null | undefined
    >(undefined);
    const [showAuthorizationForm, setShowAuthorizationForm] = useState(false);
    const [evidenceTarget, setEvidenceTarget] = useState<EvidenceTarget>(null);
    const [recommendationTarget, setRecommendationTarget] =
        useState<RecommendationTarget>(null);
    const [reassignAssessmentId, setReassignAssessmentId] = useState<
        string | null
    >(null);
    const [reopenAssessmentId, setReopenAssessmentId] = useState<string | null>(
        null,
    );
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [confirmReason, setConfirmReason] = useState("");
    const [notice, setNotice] = useState("");

    const selectedCompetency =
        detail?.kind === "competency"
            ? (state.competencies.find((item) => item.id === detail.id) ?? null)
            : null;
    const selectedProfile =
        detail?.kind === "profile"
            ? (state.roleProfiles.find((item) => item.id === detail.id) ?? null)
            : null;
    const selectedCycle =
        detail?.kind === "cycle"
            ? (state.cycles.find((item) => item.id === detail.id) ?? null)
            : null;
    const selectedAssessment =
        detail?.kind === "assessment"
            ? (state.assessments.find((item) => item.id === detail.id) ?? null)
            : null;
    const competencyProfiles = useMemo(
        () => buildCompetencyProfiles(state),
        [state],
    );
    const selectedPersonProfile =
        detail?.kind === "person-profile"
            ? (competencyProfiles.find(
                  (item) => item.person.id === detail.id,
              ) ?? null)
            : null;
    const gapRows = useMemo(() => buildGapRows(state), [state]);
    const selectedGap =
        detail?.kind === "gap"
            ? (gapRows.find((item) => item.id === detail.id) ?? null)
            : null;
    const nextCode = `CMP-${String(Math.max(0, ...state.competencies.map((item) => Number(item.code.replace(/\D/g, "")) || 0)) + 1).padStart(3, "0")}`;

    function addActivity(
        type: "Library" | "Profile" | "Cycle" | "Assessment" | "Development",
        title: string,
        activityDetail: string,
        personId: string | null = null,
    ) {
        return {
            id: uniqueId("activity"),
            type,
            title,
            detail: activityDetail,
            personId,
            createdAt: nowIso(),
        } as const;
    }

    function auditEntry(
        action: string,
        auditDetail: string,
        entityType: NonNullable<CompetencyAuditEntry["entityType"]>,
        entityId: string,
        metadata?: CompetencyAuditEntry["metadata"],
    ): CompetencyAuditEntry {
        return {
            id: uniqueId("audit"),
            action,
            detail: auditDetail,
            actorId,
            actorName,
            createdAt: nowIso(),
            entityType,
            entityId,
            metadata,
        };
    }

    function showNotice(message: string) {
        setNotice(message);
        window.setTimeout(() => setNotice(""), 5000);
    }

    function navigate(tab: WorkspaceTab, focus = "") {
        setWorkspaceTab(tab);
        setWorkspaceFocus(focus);
        setDetail(null);
    }

    function openConfirm(action: NonNullable<ConfirmAction>) {
        setConfirmReason("");
        setConfirmAction(action);
    }

    function editCompetency(id: string) {
        try {
            const transition = ensureCompetencyWorkingDraft(
                state.competencies,
                id,
                { actor: actorName, changedAt: nowIso() },
            );
            if (transition.created) {
                setState((current) => ({
                    ...current,
                    competencies: transition.records,
                    activities: [
                        addActivity(
                            "Library",
                            "Competency working Draft created",
                            `${transition.draft.code} · source ${transition.draft.draftSourceId ?? "new"}`,
                        ),
                        ...current.activities,
                    ],
                }));
            }
            setCompetencyForm({ id: transition.draft.id, duplicate: false });
        } catch (error) {
            showNotice(error instanceof Error ? error.message : "The working Draft could not be opened.");
        }
    }

    function saveCompetency(competency: CompetencyDefinition) {
        const exists = state.competencies.some((item) => item.id === competency.id);
        setState((current) => ({
            ...current,
            competencies: exists
                ? current.competencies.map((item) =>
                      item.id === competency.id ? competency : item,
                  )
                : [...current.competencies, competency],
            activities: [
                addActivity(
                    "Library",
                    exists ? "Competency Draft updated" : "Competency Draft created",
                    `${competency.code} · ${competency.name} saved as Draft.`,
                ),
                ...current.activities,
            ],
        }));
        setCompetencyForm(null);
        setDetail({ kind: "competency", id: competency.id });
        showNotice(`${competency.name} Draft was saved. Publish it explicitly when ready.`);
    }

    function publishCompetency(competency: CompetencyDefinition) {
        if (competency.status !== "Draft") {
            showNotice("Only a working Draft can be published.");
            return;
        }
        openConfirm({
            title: "Publish competency Draft",
            description:
                "Publishing archives the exact Active source version, preserves its historical content, and activates this Draft as the sole Active version in the lineage.",
            label: "Publish Draft",
            tone: "primary",
            execute: () => {
                try {
                    const changedAt = nowIso();
                    const transition = publishCompetencyDraft(
                        state.competencies,
                        competency.id,
                        { actor: actorName, changedAt },
                    );
                    setState((current) => ({
                        ...current,
                        competencies: transition.records,
                        activities: [
                            addActivity(
                                "Library",
                                "Competency version published",
                                `${transition.published.code} · ${transition.published.name} · v${transition.published.version}`,
                            ),
                            ...current.activities,
                        ],
                        auditLog: [
                            auditEntry(
                                "Competency version published",
                                `${transition.published.name} published as v${transition.published.version}.`,
                                "Competency",
                                transition.published.id,
                                {
                                    version: transition.published.version,
                                    archivedSourceId: transition.archivedSourceId,
                                    lineageId: transition.published.lineageId,
                                },
                            ),
                            ...current.auditLog,
                        ],
                    }));
                    setDetail({ kind: "competency", id: transition.published.id });
                    setConfirmAction(null);
                    showNotice(`${transition.published.name} published as v${transition.published.version}.`);
                } catch (error) {
                    setConfirmAction(null);
                    showNotice(error instanceof Error ? error.message : "Competency publication failed without changing history.");
                }
            },
        });
    }

    function changeCompetencyStatus(
        competency: CompetencyDefinition,
        nextStatus: "Active" | "Archived",
    ) {
        if (nextStatus === "Active") {
            publishCompetency(competency);
            return;
        }
        if (competency.status !== "Active") {
            showNotice("Only an Active competency can be archived directly. Drafts must be published explicitly.");
            return;
        }
        if (
            state.roleProfiles.some(
                (profile) =>
                    profile.status === "Active" &&
                    profile.requirements.some(
                        (requirement) => requirement.competencyId === competency.id,
                    ),
            )
        ) {
            showNotice("This competency is used by an active role profile and cannot be archived yet.");
            return;
        }
        openConfirm({
            title: "Archive competency",
            description:
                "Archived definitions remain available to historical assessments and version records.",
            label: "Archive",
            tone: "warning",
            execute: () => {
                const changedAt = nowIso();
                setState((current) => ({
                    ...current,
                    competencies: current.competencies.map((item) =>
                        item.id === competency.id
                            ? { ...item, status: "Archived", lastUpdated: changedAt, updatedBy: actorName }
                            : item,
                    ),
                    activities: [
                        addActivity("Library", "Competency archived", competency.name),
                        ...current.activities,
                    ],
                }));
                setConfirmAction(null);
            },
        });
    }

    function editProfile(id: string) {
        try {
            const transition = ensureRoleProfileWorkingDraft(
                state.roleProfiles,
                id,
                state.competencies,
                { actor: actorName, changedAt: nowIso() },
            );
            if (transition.created) {
                setState((current) => ({
                    ...current,
                    roleProfiles: transition.records,
                    activities: [
                        addActivity(
                            "Profile",
                            "Role Profile working Draft created",
                            `${transition.draft.name} · source ${transition.draft.draftSourceId ?? "new"}`,
                        ),
                        ...current.activities,
                    ],
                }));
            }
            setProfileFormId(transition.draft.id);
        } catch (error) {
            showNotice(error instanceof Error ? error.message : "The Role Profile working Draft could not be opened.");
        }
    }

    function saveProfile(profile: RoleProfile) {
        const exists = state.roleProfiles.some((item) => item.id === profile.id);
        setState((current) => ({
            ...current,
            roleProfiles: exists
                ? current.roleProfiles.map((item) =>
                      item.id === profile.id ? profile : item,
                  )
                : [...current.roleProfiles, profile],
            activities: [
                addActivity(
                    "Profile",
                    exists ? "Role Profile Draft updated" : "Role Profile Draft created",
                    `${profile.name} · Draft based on official v${profile.version}`,
                ),
                ...current.activities,
            ],
        }));
        setProfileFormId(undefined);
        setDetail({ kind: "profile", id: profile.id });
        showNotice(`${profile.name} Draft was saved. Publish it explicitly when ready.`);
    }

    function publishProfile(profile: RoleProfile) {
        if (profile.status !== "Draft") {
            showNotice("Only a working Role Profile Draft can be published.");
            return;
        }
        openConfirm({
            title: "Publish Role Profile Draft",
            description:
                "Publishing archives the exact Active source version and activates this Draft as the sole Active Role Profile version in its lineage.",
            label: "Publish Draft",
            tone: "primary",
            execute: () => {
                try {
                    const changedAt = nowIso();
                    const transition = publishRoleProfileDraft(
                        state.roleProfiles,
                        profile.id,
                        state.competencies,
                        { actor: actorName, changedAt },
                    );
                    setState((current) => ({
                        ...current,
                        roleProfiles: transition.records,
                        activities: [
                            addActivity(
                                "Profile",
                                "Role Profile version published",
                                `${transition.published.name} · v${transition.published.version}`,
                            ),
                            ...current.activities,
                        ],
                        auditLog: [
                            auditEntry(
                                "Role Profile version published",
                                `${transition.published.name} published as v${transition.published.version}.`,
                                "Role Profile",
                                transition.published.id,
                                {
                                    version: transition.published.version,
                                    archivedSourceId: transition.archivedSourceId,
                                    lineageId: transition.published.lineageId,
                                },
                            ),
                            ...current.auditLog,
                        ],
                    }));
                    setDetail({ kind: "profile", id: transition.published.id });
                    setConfirmAction(null);
                    showNotice(`${transition.published.name} published as v${transition.published.version}.`);
                } catch (error) {
                    setConfirmAction(null);
                    showNotice(error instanceof Error ? error.message : "Role Profile publication failed without changing history.");
                }
            },
        });
    }

    function archiveProfile(profile: RoleProfile) {
        if (profile.status !== "Active") {
            showNotice("Only an Active Role Profile can be archived directly. Drafts must be published explicitly.");
            return;
        }
        openConfirm({
            title: "Archive role profile",
            description:
                "Historical finalized assessments will retain their immutable profile snapshots. People may become Profile Not Assigned until a new active profile exists.",
            label: "Archive Profile",
            tone: "warning",
            execute: () => {
                setState((current) => ({
                    ...current,
                    roleProfiles: current.roleProfiles.map((item) =>
                        item.id === profile.id
                            ? {
                                  ...item,
                                  status: "Archived",
                                  lastUpdated: nowIso(),
                                  updatedBy: actorName,
                              }
                            : item,
                    ),
                    activities: [
                        addActivity(
                            "Profile",
                            "Role profile archived",
                            profile.name,
                        ),
                        ...current.activities,
                    ],
                }));
                setConfirmAction(null);
            },
        });
    }
    function saveCycle(cycle: AssessmentCycle) {
        const exists = state.cycles.some((item) => item.id === cycle.id);
        const previous = state.cycles.find((item) => item.id === cycle.id);
        const hasAssignments = state.assessments.some(
            (item) => item.cycleId === cycle.id,
        );
        if (
            previous &&
            hasAssignments &&
            (!cycleConfigurationMatches(previous, cycle) ||
                cycle.startDate !== previous.startDate ||
                cycle.type !== previous.type ||
                cycle.endDate < previous.endDate)
        ) {
            showNotice(
                "Critical cycle rules are locked after assignments exist; the end date may only be extended.",
            );
            return;
        }
        setState((current) => ({
            ...current,
            cycles: exists
                ? current.cycles.map((item) =>
                      item.id === cycle.id ? cycle : item,
                  )
                : [...current.cycles, cycle],
            activities: [
                addActivity(
                    "Cycle",
                    exists
                        ? "Assessment cycle updated"
                        : "Assessment cycle created",
                    `${cycle.name} · ${cycle.status}`,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    exists
                        ? "Assessment cycle configuration updated"
                        : "Assessment cycle created",
                    `${cycle.name} was saved with its complete population and workflow rules.`,
                    "Cycle",
                    cycle.id,
                    {
                        previousStatus: previous?.status ?? null,
                        status: cycle.status,
                        appliesTo: cycle.appliesTo,
                        roleProfileCount: cycle.roleProfileIds.length,
                        requireSelfAssessment: cycle.requireSelfAssessment,
                        requireSupportingEvidence:
                            cycle.requireSupportingEvidence,
                        requireHrValidation: cycle.requireHrValidation,
                        requireAcknowledgment: cycle.requireAcknowledgment,
                    },
                ),
                ...current.auditLog,
            ],
        }));
        setCycleFormId(undefined);
        setDetail({ kind: "cycle", id: cycle.id });
        showNotice(`${cycle.name} was saved.`);
    }
    function transitionCycle(
        cycle: AssessmentCycle,
        nextStatus: AssessmentCycle["status"],
    ) {
        const valid: Record<
            AssessmentCycle["status"],
            AssessmentCycle["status"][]
        > = {
            Draft: ["Scheduled", "Active", "Cancelled"],
            Scheduled: ["Active", "Cancelled"],
            Active: ["Closed", "Cancelled"],
            Closed: [],
            Cancelled: [],
        };
        if (!valid[cycle.status].includes(nextStatus)) {
            showNotice(`Cannot move a ${cycle.status} cycle to ${nextStatus}.`);
            return;
        }
        const cycleAssessments = state.assessments.filter(
            (item) => item.cycleId === cycle.id,
        );
        const unresolved = cycleAssessments.filter(
            (item) => !["Finalized", "Cancelled"].includes(item.status),
        );
        if (nextStatus === "Closed" && unresolved.length) {
            showNotice(
                `This cycle cannot close while ${unresolved.length} assessment${unresolved.length === 1 ? "" : "s"} remain unresolved.`,
            );
            return;
        }
        const cancelOpenCount = unresolved.filter(
            (item) => !item.finalizedSnapshots.length,
        ).length;
        const restoreFinalizedCount = unresolved.length - cancelOpenCount;
        openConfirm({
            title: `${nextStatus} assessment cycle`,
            description:
                nextStatus === "Closed"
                    ? "All assignments are resolved. Closing prevents new submissions while finalized records remain unchanged."
                    : nextStatus === "Cancelled"
                      ? `Cancelling records the required reason, cancels ${cancelOpenCount} non-finalized open assignment(s), restores ${restoreFinalizedCount} reopened record(s) to their latest immutable finalization, and preserves every finalized outcome.`
                      : `This will move ${cycle.name} from ${cycle.status} to ${nextStatus}.`,
            label: nextStatus,
            tone: nextStatus === "Cancelled" ? "danger" : "primary",
            reasonRequired: nextStatus === "Cancelled",
            execute: (reason) => {
                const changedAt = nowIso();
                setState((current) => ({
                    ...current,
                    cycles: current.cycles.map((item) =>
                        item.id === cycle.id
                            ? {
                                  ...item,
                                  status: nextStatus,
                                  updatedAt: changedAt,
                                  updatedBy: actorName,
                                  cancellationReason:
                                      nextStatus === "Cancelled"
                                          ? reason
                                          : item.cancellationReason,
                                  cancelledAt:
                                      nextStatus === "Cancelled"
                                          ? changedAt
                                          : item.cancelledAt,
                              }
                            : item,
                    ),
                    assessments:
                        nextStatus !== "Cancelled"
                            ? current.assessments
                            : current.assessments.map((item) => {
                                  if (
                                      item.cycleId !== cycle.id ||
                                      ["Finalized", "Cancelled"].includes(
                                          item.status,
                                      )
                                  )
                                      return item;
                                  const official =
                                      latestFinalizedSnapshot(item);
                                  return official
                                      ? {
                                            ...item,
                                            status: "Finalized" as const,
                                            ratings: cloneRatings(
                                                official.ratings,
                                            ),
                                            submittedAt: official.submittedAt,
                                            finalizedAt: official.finalizedAt,
                                            finalizedSnapshot: official,
                                            lastUpdated: changedAt,
                                            auditHistory: [
                                                ...item.auditHistory,
                                                {
                                                    id: uniqueId("audit"),
                                                    action: "Open revision cancelled with cycle",
                                                    detail: `${reason} Latest finalized version ${official.version} remains official.`,
                                                    actorId,
                                                    actorName,
                                                    createdAt: changedAt,
                                                },
                                            ],
                                        }
                                      : {
                                            ...item,
                                            status: "Cancelled" as const,
                                            lastUpdated: changedAt,
                                            auditHistory: [
                                                ...item.auditHistory,
                                                {
                                                    id: uniqueId("audit"),
                                                    action: "Assessment cancelled with cycle",
                                                    detail: reason,
                                                    actorId,
                                                    actorName,
                                                    createdAt: changedAt,
                                                },
                                            ],
                                        };
                              }),
                    activities: [
                        addActivity(
                            "Cycle",
                            `Assessment cycle ${nextStatus.toLowerCase()}`,
                            `${cycle.name}${reason ? ` · ${reason}` : ""}`,
                        ),
                        ...current.activities,
                    ],
                    auditLog: [
                        auditEntry(
                            "Assessment cycle status changed",
                            `${cycle.name}: ${cycle.status} → ${nextStatus}${reason ? ` · ${reason}` : ""}`,
                            "Cycle",
                            cycle.id,
                            {
                                fromStatus: cycle.status,
                                toStatus: nextStatus,
                                reason: reason || null,
                                cancelledOpenAssignments:
                                    nextStatus === "Cancelled"
                                        ? cancelOpenCount
                                        : 0,
                                restoredFinalizedRevisions:
                                    nextStatus === "Cancelled"
                                        ? restoreFinalizedCount
                                        : 0,
                            },
                        ),
                        ...current.auditLog,
                    ],
                }));
                setConfirmAction(null);
            },
        });
    }
    function makeAssessment(
        personId: string,
        profileId: string,
        cycleId: string,
        assessorId: string,
        dueDate: string,
        revisionSourceAssessmentId: string | null = null,
    ): CompetencyAssessment | null {
        const person = getPersonById(personId);
        const profile = state.roleProfiles.find(
            (item) => item.id === profileId,
        );
        const cycle = state.cycles.find((item) => item.id === cycleId);
        if (
            !person ||
            !profile ||
            !cycle ||
            !cyclePopulationMatches(cycle, person, profile) ||
            !["Scheduled", "Active"].includes(cycle.status)
        )
            return null;
        if (
            !getAuthorizedAssessors(state, person, profile).some(
                (candidate) => candidate.id === assessorId,
            )
        )
            return null;
        const snapshot = snapshotRoleProfile(profile, state.competencies);
        return {
            id: uniqueId("assessment"),
            personId,
            personType: person.personType,
            roleProfileId: profileId,
            roleProfileSnapshot: snapshot,
            cycleId,
            cycleSnapshot: snapshotAssessmentCycle(cycle, state.roleProfiles),
            assessorId,
            assignedAt: nowIso(),
            dueDate,
            status: "Pending",
            ratings: snapshot.requirements.map((requirement) => ({
                competencyId: requirement.competencyId,
                selectedLevel: null,
                selfLevel: null,
                evidence: [],
                assessorComments: "",
                selfComments: "",
                assessedAt: null,
            })),
            hrValidationNotes: "",
            employeeAcknowledgedAt: null,
            submittedAt: null,
            finalizedAt: null,
            finalizedSnapshot: null,
            finalizedSnapshots: [],
            revisionSourceAssessmentId,
            revisionHistory: [],
            reassignmentHistory: [],
            auditHistory: [
                {
                    id: uniqueId("audit"),
                    action: "Assessment assigned",
                    detail: `Authorized assessor ${getPersonById(assessorId)?.fullName ?? assessorId} assigned.`,
                    actorId,
                    actorName,
                    createdAt: nowIso(),
                },
            ],
            lastUpdated: nowIso(),
        };
    }
    function createAssessment(
        personId: string,
        profileId: string,
        cycleId: string,
        assessorId: string,
        dueDate: string,
    ) {
        const person = getPersonById(personId);
        const profile = state.roleProfiles.find(
            (item) => item.id === profileId,
        );
        const cycle = state.cycles.find((item) => item.id === cycleId);
        if (
            !person ||
            !profile ||
            !cycle ||
            !cyclePopulationMatches(cycle, person, profile)
        ) {
            showNotice(
                "The selected assignment is outside the configured cycle population.",
            );
            return;
        }
        const resolution = resolveAssessmentAssessor(
            state,
            cycle,
            person,
            profile,
            assessorId,
        );
        if (!resolution.assessor || resolution.assessor.id !== assessorId) {
            showNotice(
                resolution.error ??
                    "The assessor does not match this cycle assignment method.",
            );
            return;
        }
        if (
            state.assessments.some(
                (item) =>
                    item.personId === personId &&
                    item.cycleId === cycleId &&
                    item.roleProfileId === profileId,
            )
        ) {
            showNotice(
                "A matching person, cycle, and role-profile assessment already exists.",
            );
            return;
        }
        const record = makeAssessment(
            personId,
            profileId,
            cycleId,
            assessorId,
            dueDate,
        );
        if (!record) {
            showNotice(
                "The assignment could not be created for the selected cycle status and population.",
            );
            return;
        }
        setState((current) => ({
            ...current,
            assessments: [record, ...current.assessments],
            activities: [
                addActivity(
                    "Assessment",
                    "Assessment assignment created",
                    `${getPersonById(personId)?.fullName} · ${record.roleProfileSnapshot.name}`,
                    personId,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    "Assessment assignment created",
                    `${getPersonById(personId)?.fullName} was assigned to ${cycle.name} using ${record.roleProfileSnapshot.name} v${record.roleProfileSnapshot.version}.`,
                    "Assessment",
                    record.id,
                    {
                        cycleId,
                        profileVersion: record.roleProfileSnapshot.version,
                        assessorId,
                    },
                ),
                ...current.auditLog,
            ],
        }));
        setAssignmentFormCycleId(undefined);
        setDetail({ kind: "assessment", id: record.id });
        showNotice("Assessment assignment created.");
    }
    function generateCycleAssignments(cycleId: string) {
        const cycle = state.cycles.find((item) => item.id === cycleId);
        if (!cycle) {
            showNotice("The selected assessment cycle is no longer available.");
            return;
        }
        if (cycle.assignmentMethod === "Manual Authorized Assignment") {
            setAssignmentFormCycleId(cycle.id);
            showNotice(
                "Manual cycles require one explicit person, role profile, and authorized assessor selection per assignment.",
            );
            return;
        }
        const additions: CompetencyAssessment[] = [];
        let skippedNoAssessor = 0;
        for (const profileId of cycle.roleProfileIds) {
            const profile = state.roleProfiles.find(
                (item) => item.id === profileId && item.status === "Active",
            );
            if (!profile) continue;
            for (const person of SHARED_PERSONNEL) {
                const matches = cyclePopulationMatches(cycle, person, profile);
                if (!matches) continue;
                if (
                    state.assessments.some(
                        (item) =>
                            item.personId === person.id &&
                            item.cycleId === cycle.id &&
                            item.roleProfileId === profile.id,
                    ) ||
                    additions.some(
                        (item) =>
                            item.personId === person.id &&
                            item.cycleId === cycle.id &&
                            item.roleProfileId === profile.id,
                    )
                )
                    continue;
                const resolution = resolveAssessmentAssessor(
                    state,
                    cycle,
                    person,
                    profile,
                );
                const assessor = resolution.assessor;
                if (!assessor) {
                    skippedNoAssessor += 1;
                    continue;
                }
                const record = makeAssessment(
                    person.id,
                    profile.id,
                    cycle.id,
                    assessor.id,
                    addDays(cycle.dueDaysAfterAssignment),
                );
                if (record) additions.push(record);
            }
        }
        if (!additions.length) {
            showNotice(
                skippedNoAssessor
                    ? `${skippedNoAssessor} matching people have no authorized assessor; no assignments were created.`
                    : "No new eligible assignments were found. Duplicate person/cycle/profile records were skipped.",
            );
            return;
        }
        setState((current) => ({
            ...current,
            assessments: [...additions, ...current.assessments],
            activities: [
                addActivity(
                    "Cycle",
                    "Cycle assignments prepared",
                    `${additions.length} assignments created; ${skippedNoAssessor} skipped without authorization.`,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    "Cycle assignments prepared",
                    `${additions.length} eligible assignments were created; ${skippedNoAssessor} people were skipped without an authorized assessor.`,
                    "Cycle",
                    cycle.id,
                    {
                        created: additions.length,
                        skippedNoAssessor,
                        duplicateSafe: true,
                    },
                ),
                ...current.auditLog,
            ],
        }));
        showNotice(
            `${additions.length} assignments created. ${skippedNoAssessor ? `${skippedNoAssessor} skipped without an authorized assessor.` : ""}`,
        );
    }
    function requestCycleAssignments(cycleId: string) {
        const cycle = state.cycles.find((item) => item.id === cycleId);
        if (!cycle) {
            showNotice("The selected assessment cycle is no longer available.");
            return;
        }
        if (cycle.assignmentMethod === "Manual Authorized Assignment") {
            setAssignmentFormCycleId(cycle.id);
            return;
        }
        openConfirm({
            title: "Prepare cycle assignments",
            description: `This will create one complete role-profile assessment per eligible person in ${cycle.name} using the configured ${cycle.assignmentMethod} rules. Existing person/cycle/profile records will be skipped, and unresolved assessors will not be assigned.`,
            label: "Prepare Assignments",
            tone: "primary",
            execute: () => {
                generateCycleAssignments(cycleId);
                setConfirmAction(null);
            },
        });
    }
    function saveAuthorization(authorization: AssessorAuthorization) {
        const duplicate = state.assessorAuthorizations.some(
            (item) =>
                item.active &&
                item.assessorId === authorization.assessorId &&
                item.scope === authorization.scope &&
                item.scopeValue === authorization.scopeValue,
        );
        if (duplicate) {
            showNotice(
                "An identical active assessor authorization already exists.",
            );
            return;
        }
        setState((current) => ({
            ...current,
            assessorAuthorizations: [
                ...current.assessorAuthorizations,
                authorization,
            ],
            activities: [
                addActivity(
                    "Assessment",
                    "Assessor authorization created",
                    `${getPersonById(authorization.assessorId)?.fullName} · ${authorization.scope}`,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    "Assessor authorization created",
                    `${getPersonById(authorization.assessorId)?.fullName ?? authorization.assessorId} received ${authorization.scope} scope: ${authorization.scopeValue}.`,
                    "Assessor Authorization",
                    authorization.id,
                    {
                        assessorId: authorization.assessorId,
                        scope: authorization.scope,
                        scopeValue: authorization.scopeValue,
                        active: true,
                        reason: authorization.reason,
                    },
                ),
                ...current.auditLog,
            ],
        }));
        setShowAuthorizationForm(false);
        showNotice("Assessor authorization saved.");
    }
    function toggleAuthorization(authorizationId: string) {
        const authorization = state.assessorAuthorizations.find(
            (item) => item.id === authorizationId,
        );
        if (!authorization) {
            showNotice("The selected assessor authorization is no longer available.");
            return;
        }
        openConfirm({
            title: authorization.active
                ? "Deactivate assessor authorization"
                : "Reactivate assessor authorization",
            description: authorization.active
                ? "The assessor will immediately lose this explicit assessment scope. Existing historical assignments remain traceable."
                : "This explicit scope will become available for new and reassigned assessments.",
            label: authorization.active ? "Deactivate" : "Reactivate",
            tone: authorization.active ? "warning" : "primary",
            reasonRequired: true,
            execute: (reason) => {
                const nextActive = !authorization.active;
                setState((current) => ({
                    ...current,
                    assessorAuthorizations: current.assessorAuthorizations.map(
                        (item) =>
                            item.id === authorization.id
                                ? { ...item, active: nextActive }
                                : item,
                    ),
                    activities: [
                        addActivity(
                            "Assessment",
                            `Assessor authorization ${nextActive ? "reactivated" : "deactivated"}`,
                            `${getPersonById(authorization.assessorId)?.fullName ?? authorization.assessorId} · ${reason}`,
                        ),
                        ...current.activities,
                    ],
                    auditLog: [
                        auditEntry(
                            "Assessor authorization status changed",
                            `${authorization.active ? "Active" : "Inactive"} → ${nextActive ? "Active" : "Inactive"} · ${reason}`,
                            "Assessor Authorization",
                            authorization.id,
                            {
                                assessorId: authorization.assessorId,
                                fromActive: authorization.active,
                                toActive: nextActive,
                                reason,
                            },
                        ),
                        ...current.auditLog,
                    ],
                }));
                setConfirmAction(null);
            },
        });
    }
    function updateAssessment(
        id: string,
        updater: (assessment: CompetencyAssessment) => CompetencyAssessment,
    ) {
        setState((current) => ({
            ...current,
            assessments: current.assessments.map((assessment) =>
                assessment.id === id ? updater(assessment) : assessment,
            ),
        }));
    }
    function reassignAssessment(
        assessmentId: string,
        nextAssessorId: string,
        reason: string,
    ) {
        const assessment = state.assessments.find(
            (item) => item.id === assessmentId,
        );
        const person = assessment ? getPersonById(assessment.personId) : null;
        const profile = assessment
            ? (state.roleProfiles.find(
                  (item) => item.id === assessment.roleProfileId,
              ) ?? null)
            : null;
        if (
            !assessment ||
            !person ||
            !profile ||
            !getAuthorizedAssessors(state, person, profile).some(
                (item) => item.id === nextAssessorId,
            )
        ) {
            showNotice(
                "The selected assessor is not actively authorized for this assignment.",
            );
            return;
        }
        const changedAt = nowIso();
        setState((current) => ({
            ...current,
            assessments: current.assessments.map((item) =>
                item.id === assessment.id
                    ? {
                          ...item,
                          assessorId: nextAssessorId,
                          reassignmentHistory: [
                              ...item.reassignmentHistory,
                              {
                                  fromAssessorId: item.assessorId,
                                  toAssessorId: nextAssessorId,
                                  reason,
                                  actorId,
                                  actorName,
                                  createdAt: changedAt,
                              },
                          ],
                          auditHistory: [
                              ...item.auditHistory,
                              {
                                  id: uniqueId("audit"),
                                  action: "Assessor reassigned",
                                  detail: reason,
                                  actorId,
                                  actorName,
                                  createdAt: changedAt,
                              },
                          ],
                          lastUpdated: changedAt,
                      }
                    : item,
            ),
            activities: [
                addActivity(
                    "Assessment",
                    "Authorized assessor reassigned",
                    `${getPersonById(assessment.assessorId)?.fullName ?? assessment.assessorId} → ${getPersonById(nextAssessorId)?.fullName ?? nextAssessorId}`,
                    assessment.personId,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    "Assessment assessor reassigned",
                    reason,
                    "Assessment",
                    assessment.id,
                    {
                        fromAssessorId: assessment.assessorId,
                        toAssessorId: nextAssessorId,
                        cycleId: assessment.cycleId,
                    },
                ),
                ...current.auditLog,
            ],
        }));
        setReassignAssessmentId(null);
        showNotice("Authorized assessor reassigned with history preserved.");
    }
    function updateRating(
        assessmentId: string,
        competencyId: string,
        patch: Partial<CompetencyRating>,
    ) {
        const assessment = state.assessments.find(
            (item) => item.id === assessmentId,
        );
        const cycle = assessment
            ? state.cycles.find((item) => item.id === assessment.cycleId)
            : null;
        if (
            !assessment ||
            cycle?.status !== "Active" ||
            !canAssess(state, assessment, actorId) ||
            ![
                "Pending",
                "In Progress",
                "Returned for Revision",
                "Overdue",
            ].includes(assessment.status)
        ) {
            showNotice(
                "Only the currently authorized assessor can edit an open assessment.",
            );
            return;
        }
        updateAssessment(assessmentId, (item) => ({
            ...item,
            status:
                item.status === "Pending" || item.status === "Overdue"
                    ? "In Progress"
                    : item.status,
            ratings: item.ratings.map((rating) =>
                rating.competencyId === competencyId
                    ? {
                          ...rating,
                          ...patch,
                          assessedAt: patch.selectedLevel
                              ? nowIso()
                              : rating.assessedAt,
                      }
                    : rating,
            ),
            lastUpdated: nowIso(),
        }));
    }
    function updateSelfAssessment(
        assessmentId: string,
        competencyId: string,
        patch: Pick<Partial<CompetencyRating>, "selfLevel" | "selfComments">,
    ) {
        const assessment = state.assessments.find(
            (item) => item.id === assessmentId,
        );
        const cycle = assessment
            ? state.cycles.find((item) => item.id === assessment.cycleId)
            : null;
        if (
            !assessment ||
            actorId !== assessment.personId ||
            !assessment.cycleSnapshot.requireSelfAssessment ||
            cycle?.status !== "Active" ||
            ![
                "Pending",
                "In Progress",
                "Returned for Revision",
                "Overdue",
            ].includes(assessment.status)
        ) {
            showNotice(
                "Self-assessment input is limited to the assessment subject during an active cycle.",
            );
            return;
        }
        updateAssessment(assessment.id, (item) => ({
            ...item,
            ratings: item.ratings.map((rating) =>
                rating.competencyId === competencyId
                    ? { ...rating, ...patch }
                    : rating,
            ),
            lastUpdated: nowIso(),
            auditHistory: [
                ...item.auditHistory,
                {
                    id: uniqueId("audit"),
                    action: "Self-assessment updated",
                    detail: `${item.roleProfileSnapshot.requirements.find((requirement) => requirement.competencyId === competencyId)?.competency.name ?? competencyId} self-input changed; the official assessor level was not modified.`,
                    actorId,
                    actorName,
                    createdAt: nowIso(),
                },
            ],
        }));
    }
    function applyReassessedOutcomes(
        recommendations: DevelopmentRecommendation[],
        assessment: CompetencyAssessment,
        snapshot: FinalizedAssessmentSnapshot,
        assessments: CompetencyAssessment[],
    ): DevelopmentRecommendation[] {
        return recommendations.map((recommendation) => {
            if (
                recommendation.personId !== assessment.personId ||
                recommendation.status !== "Reassessment Requested" ||
                recommendation.sourceAssessmentId === assessment.id
            )
                return recommendation;
            const source = assessments.find(
                (item) => item.id === recommendation.sourceAssessmentId,
            );
            const sourceSnapshot = source
                ? latestFinalizedSnapshot(source)
                : null;
            const requiredLevel = sourceSnapshot?.profile.requirements.find(
                (item) => item.competencyId === recommendation.competencyId,
            )?.requiredLevel;
            const reassessedLevel = snapshot.ratings.find(
                (item) => item.competencyId === recommendation.competencyId,
            )?.selectedLevel;
            return requiredLevel &&
                reassessedLevel !== null &&
                reassessedLevel !== undefined &&
                reassessedLevel >= requiredLevel
                ? {
                      ...recommendation,
                      status: "Reassessed",
                      reassessedAt: snapshot.finalizedAt,
                      reassessmentAssessmentId: assessment.id,
                  }
                : recommendation;
        });
    }
    function saveDraft(assessment: CompetencyAssessment) {
        if (!canAssess(state, assessment, actorId)) {
            showNotice(
                "Save Draft is limited to the assigned authorized assessor.",
            );
            return;
        }
        if (
            state.cycles.find((item) => item.id === assessment.cycleId)
                ?.status !== "Active"
        ) {
            showNotice(
                "Draft changes are allowed only while the assessment cycle is Active.",
            );
            return;
        }
        updateAssessment(assessment.id, (item) => ({
            ...item,
            status: "In Progress",
            lastUpdated: nowIso(),
            auditHistory: [
                ...item.auditHistory,
                {
                    id: uniqueId("audit"),
                    action: "Draft saved",
                    detail: `${assessmentProgress(item)}% of requirements rated.`,
                    actorId,
                    actorName,
                    createdAt: nowIso(),
                },
            ],
        }));
        showNotice(
            "Assessment draft saved. It has not been submitted or finalized.",
        );
    }
    function submitAssessment(assessment: CompetencyAssessment) {
        if (!canAssess(state, assessment, actorId)) {
            showNotice(
                "Submission is limited to the assigned authorized assessor.",
            );
            return;
        }
        const cycle =
            state.cycles.find((item) => item.id === assessment.cycleId) ?? null;
        if (cycle?.status !== "Active") {
            showNotice(
                "Submission is allowed only while the assessment cycle is Active.",
            );
            return;
        }
        const errors = validateAssessmentForSubmit(assessment, cycle);
        if (errors.length) {
            showNotice(
                `${errors.length} requirement issue(s) must be resolved before submission.`,
            );
            return;
        }
        openConfirm({
            title: "Submit competency assessment",
            description: cycle?.requireHrValidation
                ? "This submits the completed role-profile assessment for HR validation. Save Draft remains editable; Submit locks assessor input until returned."
                : "This cycle does not require HR validation, so submission will finalize the assessment.",
            label: "Submit Assessment",
            tone: "primary",
            execute: () => {
                const submittedAt = nowIso();
                setState((current) => {
                    const currentAssessment = current.assessments.find(
                        (item) => item.id === assessment.id,
                    );
                    if (!currentAssessment) return current;
                    const finalizing = !cycle?.requireHrValidation;
                    const assessmentForSnapshot = {
                        ...currentAssessment,
                        submittedAt,
                    };
                    const snapshot = finalizing
                        ? finalizedSnapshotFor(
                              assessmentForSnapshot,
                              submittedAt,
                              actorName,
                              "",
                          )
                        : null;
                    const nextAssessment: CompetencyAssessment = {
                        ...currentAssessment,
                        status: finalizing ? "Finalized" : "Pending Validation",
                        submittedAt,
                        finalizedAt:
                            snapshot?.finalizedAt ??
                            currentAssessment.finalizedAt,
                        finalizedSnapshot:
                            snapshot ?? currentAssessment.finalizedSnapshot,
                        finalizedSnapshots: snapshot
                            ? [
                                  ...currentAssessment.finalizedSnapshots,
                                  snapshot,
                              ]
                            : currentAssessment.finalizedSnapshots,
                        employeeAcknowledgedAt: finalizing
                            ? null
                            : currentAssessment.employeeAcknowledgedAt,
                        lastUpdated: submittedAt,
                        auditHistory: [
                            ...currentAssessment.auditHistory,
                            {
                                id: uniqueId("audit"),
                                action: finalizing
                                    ? "Assessment submitted and finalized"
                                    : "Assessment submitted for HR validation",
                                detail: "Official levels, required self-assessments, and all applicable evidence rules passed.",
                                actorId,
                                actorName,
                                createdAt: submittedAt,
                            },
                        ],
                    };
                    const nextRecommendations = snapshot
                        ? applyReassessedOutcomes(
                              current.recommendations,
                              nextAssessment,
                              snapshot,
                              current.assessments,
                          )
                        : current.recommendations;
                    const reassessedAudits = snapshot
                        ? nextRecommendations
                              .filter(
                                  (recommendation) =>
                                      recommendation.status === "Reassessed" &&
                                      current.recommendations.find(
                                          (item) =>
                                              item.id === recommendation.id,
                                      )?.status !== "Reassessed",
                              )
                              .map((recommendation) =>
                                  auditEntry(
                                      "Development recommendation reassessed",
                                      `Formal reassessment ${assessment.id} finalized competency ${recommendation.competencyId}; the development outcome is now Reassessed.`,
                                      "Development",
                                      recommendation.id,
                                      {
                                          reassessmentAssessmentId:
                                              assessment.id,
                                          competencyId:
                                              recommendation.competencyId,
                                          finalizedVersion: snapshot.version,
                                      },
                                  ),
                              )
                        : [];
                    return {
                        ...current,
                        assessments: current.assessments.map((item) =>
                            item.id === assessment.id ? nextAssessment : item,
                        ),
                        recommendations: nextRecommendations,
                        activities: [
                            addActivity(
                                "Assessment",
                                finalizing
                                    ? "Assessment finalized"
                                    : "Assessment submitted",
                                assessment.roleProfileSnapshot.name,
                                assessment.personId,
                            ),
                            ...current.activities,
                        ],
                        auditLog: [
                            ...reassessedAudits,
                            auditEntry(
                                finalizing
                                    ? "Assessment submitted and finalized"
                                    : "Assessment submitted for HR validation",
                                `${assessment.roleProfileSnapshot.name} v${assessment.roleProfileSnapshot.version}; cycle evidence and self-assessment rules passed.`,
                                "Assessment",
                                assessment.id,
                                {
                                    finalizing,
                                    finalizedVersion: snapshot?.version ?? null,
                                    cycleId: assessment.cycleId,
                                },
                            ),
                            ...current.auditLog,
                        ],
                    };
                });
                setConfirmAction(null);
            },
        });
    }
    function finalizeAssessment(
        assessment: CompetencyAssessment,
        validationNotes: string,
    ) {
        if (
            !canValidate ||
            !["Submitted", "Pending Validation"].includes(assessment.status)
        ) {
            showNotice(
                "Only Admin/HR governance can validate a submitted assessment.",
            );
            return;
        }
        if (!validationNotes.trim()) {
            showNotice("HR validation notes are required before finalization.");
            return;
        }
        openConfirm({
            title: "Finalize competency assessment",
            description:
                "Finalization creates an immutable snapshot of the selected levels, evidence, assessor, role profile version, and validation state.",
            label: "Finalize Assessment",
            tone: "primary",
            execute: () => {
                const finalizedAt = nowIso();
                setState((current) => {
                    const currentAssessment = current.assessments.find(
                        (item) => item.id === assessment.id,
                    );
                    if (!currentAssessment) return current;
                    const snapshot = finalizedSnapshotFor(
                        currentAssessment,
                        finalizedAt,
                        actorName,
                        validationNotes.trim(),
                    );
                    const nextAssessment: CompetencyAssessment = {
                        ...currentAssessment,
                        status: "Finalized",
                        hrValidationNotes: validationNotes.trim(),
                        finalizedAt,
                        finalizedSnapshot: snapshot,
                        finalizedSnapshots: [
                            ...currentAssessment.finalizedSnapshots,
                            snapshot,
                        ],
                        employeeAcknowledgedAt: null,
                        lastUpdated: finalizedAt,
                        auditHistory: [
                            ...currentAssessment.auditHistory,
                            {
                                id: uniqueId("audit"),
                                action: "Assessment finalized",
                                detail: `Immutable finalized version ${snapshot.version}: ${validationNotes.trim()}`,
                                actorId,
                                actorName,
                                createdAt: finalizedAt,
                            },
                        ],
                    };
                    const nextRecommendations = applyReassessedOutcomes(
                        current.recommendations,
                        nextAssessment,
                        snapshot,
                        current.assessments,
                    );
                    const reassessedAudits = nextRecommendations
                        .filter(
                            (recommendation) =>
                                recommendation.status === "Reassessed" &&
                                current.recommendations.find(
                                    (item) => item.id === recommendation.id,
                                )?.status !== "Reassessed",
                        )
                        .map((recommendation) =>
                            auditEntry(
                                "Development recommendation reassessed",
                                `Formal reassessment ${assessment.id} finalized competency ${recommendation.competencyId}; the development outcome is now Reassessed.`,
                                "Development",
                                recommendation.id,
                                {
                                    reassessmentAssessmentId: assessment.id,
                                    competencyId: recommendation.competencyId,
                                    finalizedVersion: snapshot.version,
                                },
                            ),
                        );
                    return {
                        ...current,
                        assessments: current.assessments.map((item) =>
                            item.id === assessment.id ? nextAssessment : item,
                        ),
                        recommendations: nextRecommendations,
                        activities: [
                            addActivity(
                                "Assessment",
                                "Assessment finalized",
                                assessment.roleProfileSnapshot.name,
                                assessment.personId,
                            ),
                            ...current.activities,
                        ],
                        auditLog: [
                            ...reassessedAudits,
                            auditEntry(
                                "Assessment finalized",
                                `Immutable finalized version ${snapshot.version} created for ${assessment.roleProfileSnapshot.name} v${assessment.roleProfileSnapshot.version}.`,
                                "Assessment",
                                assessment.id,
                                {
                                    finalizedVersion: snapshot.version,
                                    profileVersion:
                                        assessment.roleProfileSnapshot.version,
                                    cycleId: assessment.cycleId,
                                },
                            ),
                            ...current.auditLog,
                        ],
                    };
                });
                setConfirmAction(null);
            },
        });
    }
    function returnForRevision(assessment: CompetencyAssessment) {
        openConfirm({
            title: "Return assessment for revision",
            description:
                "The submitted values will be preserved in completed-review revision history before the authorized assessor regains editing access.",
            label: "Return for Revision",
            tone: "warning",
            reasonRequired: true,
            execute: (reason) => {
                setState((current) => ({
                    ...current,
                    assessments: current.assessments.map((item) =>
                        item.id === assessment.id
                            ? {
                                  ...item,
                                  status: "Returned for Revision",
                                  revisionHistory: [
                                      ...item.revisionHistory,
                                      {
                                          version:
                                              item.revisionHistory.length + 1,
                                          action: "Returned for Revision",
                                          reason,
                                          notes: item.hrValidationNotes,
                                          actorId,
                                          actorName,
                                          createdAt: nowIso(),
                                          previousStatus: item.status,
                                          previousRatings: cloneRatings(
                                              item.ratings,
                                          ),
                                          previousHrValidationNotes:
                                              item.hrValidationNotes,
                                      },
                                  ],
                                  lastUpdated: nowIso(),
                                  auditHistory: [
                                      ...item.auditHistory,
                                      {
                                          id: uniqueId("audit"),
                                          action: "Returned for revision",
                                          detail: reason,
                                          actorId,
                                          actorName,
                                          createdAt: nowIso(),
                                      },
                                  ],
                              }
                            : item,
                    ),
                    auditLog: [
                        auditEntry(
                            "Assessment returned for revision",
                            reason,
                            "Assessment",
                            assessment.id,
                            { previousStatus: assessment.status },
                        ),
                        ...current.auditLog,
                    ],
                }));
                setConfirmAction(null);
            },
        });
    }
    function reopenWithinActiveCycle(assessmentId: string, reason: string) {
        const changedAt = nowIso();
        setState((current) => {
            const assessment = current.assessments.find(
                (item) => item.id === assessmentId,
            );
            const cycle = assessment
                ? current.cycles.find((item) => item.id === assessment.cycleId)
                : null;
            if (!assessment || cycle?.status !== "Active") return current;
            const officialSnapshot = latestFinalizedSnapshot(assessment);
            const nextAssessment: CompetencyAssessment = {
                ...assessment,
                status: "Returned for Revision",
                ratings: officialSnapshot
                    ? cloneRatings(officialSnapshot.ratings)
                    : cloneRatings(assessment.ratings),
                submittedAt: null,
                employeeAcknowledgedAt: null,
                revisionHistory: [
                    ...assessment.revisionHistory,
                    {
                        version: assessment.revisionHistory.length + 1,
                        action: "Reopened",
                        reason,
                        notes: assessment.hrValidationNotes,
                        actorId,
                        actorName,
                        createdAt: changedAt,
                        previousStatus: assessment.status,
                        previousRatings: cloneRatings(assessment.ratings),
                        previousHrValidationNotes: assessment.hrValidationNotes,
                    },
                ],
                lastUpdated: changedAt,
                auditHistory: [
                    ...assessment.auditHistory,
                    {
                        id: uniqueId("audit"),
                        action: "Finalized assessment reopened",
                        detail: `${reason} Previous finalized version ${officialSnapshot?.version ?? "legacy"} remains immutable.`,
                        actorId,
                        actorName,
                        createdAt: changedAt,
                    },
                ],
            };
            return {
                ...current,
                assessments: current.assessments.map((item) =>
                    item.id === assessment.id ? nextAssessment : item,
                ),
                activities: [
                    addActivity(
                        "Assessment",
                        "Finalized assessment reopened",
                        `${assessment.roleProfileSnapshot.name} · ${reason}`,
                        assessment.personId,
                    ),
                    ...current.activities,
                ],
                auditLog: [
                    auditEntry(
                        "Finalized assessment reopened",
                        `${reason} Previous finalized versions remain immutable; revision continues only inside the active cycle.`,
                        "Assessment",
                        assessment.id,
                        {
                            cycleId: assessment.cycleId,
                            preservedFinalizedVersions:
                                assessment.finalizedSnapshots.length,
                        },
                    ),
                    ...current.auditLog,
                ],
            };
        });
        setReopenAssessmentId(null);
        showNotice(
            "Assessment reopened inside its active cycle; all finalized versions remain preserved.",
        );
    }
    function createActiveCycleRevision(
        assessmentId: string,
        cycleId: string,
        assessorId: string,
        reason: string,
    ) {
        const source = state.assessments.find(
            (item) => item.id === assessmentId,
        );
        const person = source ? getPersonById(source.personId) : null;
        const profile = person
            ? findActiveProfileForPerson(state, person)
            : null;
        const cycle = state.cycles.find((item) => item.id === cycleId);
        if (
            !source ||
            !person ||
            !profile ||
            !cycle ||
            cycle.status !== "Active" ||
            !cyclePopulationMatches(cycle, person, profile)
        ) {
            showNotice(
                "Select an active cycle whose configured population includes this person and current role profile.",
            );
            return;
        }
        if (
            state.assessments.some(
                (item) =>
                    item.personId === person.id &&
                    item.cycleId === cycle.id &&
                    item.roleProfileId === profile.id,
            )
        ) {
            showNotice(
                "A matching reassessment already exists in the selected active cycle.",
            );
            return;
        }
        const resolution = resolveAssessmentAssessor(
            state,
            cycle,
            person,
            profile,
            assessorId,
        );
        if (!resolution.assessor || resolution.assessor.id !== assessorId) {
            showNotice(
                resolution.error ??
                    "The reassessment assessor does not match this cycle method.",
            );
            return;
        }
        const revision = makeAssessment(
            person.id,
            profile.id,
            cycle.id,
            assessorId,
            addDays(cycle.dueDaysAfterAssignment),
            source.id,
        );
        if (!revision) {
            showNotice("The reassessment could not be created.");
            return;
        }
        revision.auditHistory.push({
            id: uniqueId("audit"),
            action: "Active-cycle reassessment created",
            detail: `Created from finalized assessment ${source.id}. Reason: ${reason}`,
            actorId,
            actorName,
            createdAt: nowIso(),
        });
        setState((current) => ({
            ...current,
            assessments: [
                revision,
                ...current.assessments.map((item) =>
                    item.id === source.id
                        ? {
                              ...item,
                              auditHistory: [
                                  ...item.auditHistory,
                                  {
                                      id: uniqueId("audit"),
                                      action: "Reassessment assigned in active cycle",
                                      detail: `${cycle.name} · ${reason}`,
                                      actorId,
                                      actorName,
                                      createdAt: nowIso(),
                                  },
                              ],
                          }
                        : item,
                ),
            ],
            recommendations: current.recommendations.map((recommendation) =>
                recommendation.personId === source.personId &&
                recommendation.status === "Reviewed"
                    ? { ...recommendation, status: "Reassessment Requested" }
                    : recommendation,
            ),
            activities: [
                addActivity(
                    "Assessment",
                    "Active-cycle reassessment created",
                    `${person.fullName} · ${cycle.name}`,
                    person.id,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    "Active-cycle reassessment created",
                    `Created ${revision.id} from immutable assessment ${source.id}: ${reason}`,
                    "Assessment",
                    revision.id,
                    {
                        sourceAssessmentId: source.id,
                        cycleId: cycle.id,
                        assessorId,
                        profileVersion: revision.roleProfileSnapshot.version,
                    },
                ),
                ...current.auditLog,
            ],
        }));
        setReopenAssessmentId(null);
        setDetail({ kind: "assessment", id: revision.id });
        showNotice(
            "A new reassessment was created in the selected active cycle; the closed/cancelled-cycle record remains finalized and unchanged.",
        );
    }
    function cancelAssessment(assessment: CompetencyAssessment) {
        if (
            !canValidate ||
            ["Finalized", "Cancelled"].includes(assessment.status)
        ) {
            showNotice(
                "Only Admin/HR governance can cancel an open assessment.",
            );
            return;
        }
        openConfirm({
            title: "Cancel assessment assignment",
            description: assessment.finalizedSnapshots.length
                ? "This cancels only the open revision and restores the latest immutable finalized version as the official outcome. History remains preserved."
                : "Cancellation stops this non-finalized assignment without deleting its ratings, evidence, reassignment history, or audit record. Cancelled records are excluded from official outcomes.",
            label: "Cancel Assessment",
            tone: "danger",
            reasonRequired: true,
            execute: (reason) => {
                const changedAt = nowIso();
                setState((current) => ({
                    ...current,
                    assessments: current.assessments.map((item) => {
                        if (item.id !== assessment.id) return item;
                        const official = latestFinalizedSnapshot(item);
                        return official
                            ? {
                                  ...item,
                                  status: "Finalized",
                                  ratings: cloneRatings(official.ratings),
                                  submittedAt: official.submittedAt,
                                  finalizedAt: official.finalizedAt,
                                  finalizedSnapshot: official,
                                  lastUpdated: changedAt,
                                  auditHistory: [
                                      ...item.auditHistory,
                                      {
                                          id: uniqueId("audit"),
                                          action: "Open revision cancelled",
                                          detail: `${reason} Finalized version ${official.version} remains official.`,
                                          actorId,
                                          actorName,
                                          createdAt: changedAt,
                                      },
                                  ],
                              }
                            : {
                                  ...item,
                                  status: "Cancelled",
                                  lastUpdated: changedAt,
                                  auditHistory: [
                                      ...item.auditHistory,
                                      {
                                          id: uniqueId("audit"),
                                          action: "Assessment cancelled",
                                          detail: reason,
                                          actorId,
                                          actorName,
                                          createdAt: changedAt,
                                      },
                                  ],
                              };
                    }),
                    activities: [
                        addActivity(
                            "Assessment",
                            "Assessment cancelled",
                            `${assessment.roleProfileSnapshot.name} · ${reason}`,
                            assessment.personId,
                        ),
                        ...current.activities,
                    ],
                    auditLog: [
                        auditEntry(
                            "Assessment cancelled",
                            reason,
                            "Assessment",
                            assessment.id,
                            {
                                previousStatus: assessment.status,
                                cycleId: assessment.cycleId,
                            },
                        ),
                        ...current.auditLog,
                    ],
                }));
                setConfirmAction(null);
            },
        });
    }
    function acknowledgeAssessment(assessment: CompetencyAssessment) {
        const snapshot = latestFinalizedSnapshot(assessment);
        if (
            assessment.status !== "Finalized" ||
            !assessment.cycleSnapshot.requireAcknowledgment ||
            actorId !== assessment.personId ||
            !snapshot
        ) {
            showNotice(
                "Acknowledgment can be recorded only by the assessment subject for a finalized record that requires it.",
            );
            return;
        }
        const existing = findAssessmentAcknowledgmentEvent(
            state.acknowledgmentEvents,
            assessment.id,
            snapshot.version,
        );
        if (existing) {
            showNotice(`Finalized v${snapshot.version} was already acknowledged as received/viewed.`);
            return;
        }
        try {
            const acknowledgedAt = nowIso();
            const result = acknowledgeFinalizedAssessmentVersion(
                state.acknowledgmentEvents,
                assessment,
                snapshot.version,
                {
                    personId: assessment.personId,
                    actorId,
                    actorName,
                    acknowledgedAt,
                    sourceContext: "Competency assessment detail acknowledgment action",
                },
            );
            setState((current) => ({
                ...current,
                acknowledgmentEvents: result.events,
                assessments: current.assessments.map((item) =>
                    item.id === assessment.id
                        ? {
                              ...item,
                              lastUpdated: acknowledgedAt,
                              auditHistory: [
                                  ...item.auditHistory,
                                  {
                                      id: uniqueId("audit"),
                                      action: "Assessment received / viewed",
                                      detail: `Finalized v${snapshot.version} acknowledged as received/viewed; this does not record agreement.`,
                                      actorId,
                                      actorName,
                                      createdAt: acknowledgedAt,
                                  },
                              ],
                          }
                        : item,
                ),
                auditLog: [
                    auditEntry(
                        "Assessment received / viewed",
                        `Subject acknowledgment recorded for finalized v${snapshot.version} without implying agreement.`,
                        "Assessment",
                        assessment.id,
                        {
                            acknowledgment: "Received / Viewed",
                            finalizedVersion: snapshot.version,
                            acknowledgmentEventId: result.event.id,
                        },
                    ),
                    ...current.auditLog,
                ],
            }));
            showNotice(`Finalized v${snapshot.version} receipt acknowledgment recorded.`);
        } catch (error) {
            showNotice(error instanceof Error ? error.message : "Acknowledgment could not be recorded.");
        }
    }
    function addEvidence(
        target: NonNullable<EvidenceTarget>,
        evidence: AssessmentEvidence,
    ) {
        const assessment = state.assessments.find(
            (item) => item.id === target.assessmentId,
        );
        const rating = assessment?.ratings.find(
            (item) => item.competencyId === target.competencyId,
        );
        if (!assessment || !rating) {
            showNotice("The assessment or competency rating is no longer available. Your evidence was not changed.");
            return;
        }
        const nextEvidence = target.evidenceId
            ? rating.evidence.map((item) =>
                  item.id === target.evidenceId ? evidence : item,
              )
            : [...rating.evidence, evidence];
        updateRating(assessment.id, target.competencyId, {
            evidence: nextEvidence,
        });
        setEvidenceTarget(null);
        showNotice(
            target.evidenceId
                ? "Evidence updated in the assessment draft."
                : "Evidence added to the assessment draft.",
        );
    }
    function removeEvidence(
        assessmentId: string,
        competencyId: string,
        evidenceId: string,
    ) {
        const assessment = state.assessments.find(
            (item) => item.id === assessmentId,
        );
        const rating = assessment?.ratings.find(
            (item) => item.competencyId === competencyId,
        );
        if (!assessment || !rating) {
            showNotice("The assessment or competency rating is no longer available. No evidence was removed.");
            return;
        }
        updateRating(assessmentId, competencyId, {
            evidence: rating.evidence.filter((item) => item.id !== evidenceId),
        });
        showNotice("Evidence removed from the assessment draft.");
    }
    function saveRecommendation(
        title: string,
        note: string,
        dueDate: string | null,
    ): { ok: boolean; error?: string } {
        if (!recommendationTarget) {
            return {
                ok: false,
                error: "The recommendation target is no longer available. Reopen the competency gap and try again.",
            };
        }
        const gap = gapRows.find(
            (item) => item.id === recommendationTarget.gapId,
        );
        if (!gap || !gap.sourceAssessment) {
            return {
                ok: false,
                error: "This competency gap no longer has a valid finalized source assessment. Your typed values were kept.",
            };
        }
        const existing = state.recommendations.find(
            (item) => item.id === recommendationTarget.existingId,
        );
        const recommendation: DevelopmentRecommendation = existing
            ? { ...existing, title, note, reassessmentDue: dueDate }
            : {
                  id: uniqueId("recommendation"),
                  personId: gap.person.id,
                  competencyId: gap.requirement.competencyId,
                  sourceAssessmentId: gap.sourceAssessment.id,
                  type: recommendationTarget.type,
                  title,
                  note,
                  status: "Recommended",
                  createdAt: nowIso(),
                  createdBy: actorName,
                  reviewedAt: null,
                  reassessmentDue: dueDate,
                  reassessedAt: null,
                  reassessmentAssessmentId: null,
              };
        setState((current) => ({
            ...current,
            recommendations: existing
                ? current.recommendations.map((item) =>
                      item.id === existing.id ? recommendation : item,
                  )
                : [recommendation, ...current.recommendations],
            activities: [
                addActivity(
                    "Development",
                    existing
                        ? "Development note updated"
                        : `${recommendation.type} recommendation created`,
                    `${gap.person.fullName} · ${gap.competency?.name}`,
                    gap.person.id,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    existing
                        ? "Development recommendation updated"
                        : "Development recommendation created",
                    `${recommendation.type} · ${recommendation.title}; no enrollment or schedule was created.`,
                    "Development",
                    recommendation.id,
                    {
                        personId: recommendation.personId,
                        competencyId: recommendation.competencyId,
                        status: recommendation.status,
                        sourceAssessmentId: recommendation.sourceAssessmentId,
                    },
                ),
                ...current.auditLog,
            ],
        }));
        setRecommendationTarget(null);
        showNotice(
            `${recommendation.type} recommendation saved. No enrollment or schedule was created.`,
        );
        return { ok: true };
    }
    function updateRecommendationStatus(
        id: string,
        status: "Reviewed" | "Reassessment Requested",
    ) {
        const previous = state.recommendations.find((item) => item.id === id);
        setState((current) => ({
            ...current,
            recommendations: current.recommendations.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          status,
                          reviewedAt:
                              status === "Reviewed"
                                  ? nowIso()
                                  : item.reviewedAt,
                      }
                    : item,
            ),
            activities: [
                addActivity(
                    "Development",
                    `Recommendation marked ${status}`,
                    current.recommendations.find((item) => item.id === id)
                        ?.title ?? id,
                ),
                ...current.activities,
            ],
            auditLog: [
                auditEntry(
                    "Development recommendation status changed",
                    `${previous?.status ?? "Unknown"} → ${status}`,
                    "Development",
                    id,
                    { fromStatus: previous?.status ?? null, toStatus: status },
                ),
                ...current.auditLog,
            ],
        }));
        showNotice(
            status === "Reassessment Requested"
                ? "Reassessment request recorded. It does not create a formal result."
                : `Recommendation marked ${status}.`,
        );
    }
    const pageAction =
        workspaceTab === "Competency Library" ? (
            <button
                type="button"
                onClick={() =>
                    setCompetencyForm({ id: null, duplicate: false })
                }
                className={primaryButtonClass}
            >
                <Plus className="h-3.5 w-3.5" /> Add Competency
            </button>
        ) : workspaceTab === "Role Profiles" ? (
            <button
                type="button"
                onClick={() => setProfileFormId(null)}
                className={primaryButtonClass}
            >
                <Plus className="h-3.5 w-3.5" /> Create Role Profile
            </button>
        ) : workspaceTab === "Assessment Cycles" ? (
            <button
                type="button"
                onClick={() => setCycleFormId(null)}
                className={primaryButtonClass}
            >
                <Plus className="h-3.5 w-3.5" /> Create Cycle
            </button>
        ) : workspaceTab === "Assessments" ? (
            <button
                type="button"
                onClick={() => setAssignmentFormCycleId(null)}
                className={primaryButtonClass}
            >
                <Plus className="h-3.5 w-3.5" /> Create Assignment
            </button>
        ) : null;
    return (
        <AuthenticatedLayout
            header={
                <h1 className="truncate text-sm font-bold text-slate-900">
                    Competency Management
                </h1>
            }
        >
            <Head title="Competency Management" />
            <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-4 overflow-x-clip">
                <PageHeader
                    title="Competency Management"
                    description="Govern competency definitions, role requirements, evidence-based assessments, validated profiles, gaps, and reassessments"
                    actions={pageAction}
                />

                {(storageError || notice) && (
                    <div
                        role={storageError ? "alert" : "status"}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${storageError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                    >
                        <span>{storageError || notice}</span>
                        {notice && (
                            <button
                                type="button"
                                onClick={() => setNotice("")}
                                className="rounded p-1 hover:bg-white/60"
                                aria-label="Dismiss message"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}
                <nav
                    aria-label="Competency Management workspaces"
                    className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 shadow-sm"
                >
                    <div className="flex min-w-max">
                        {WORKSPACE_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const active = workspaceTab === tab.label;
                            return (
                                <button
                                    key={tab.label}
                                    type="button"
                                    onClick={() => navigate(tab.label)}
                                    className={`relative flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
                                    aria-current={active ? "page" : undefined}
                                >
                                    <Icon
                                        className={`h-3.5 w-3.5 ${active ? "text-amber-500" : "text-slate-400"}`}
                                    />
                                    {tab.label}
                                    {active && (
                                        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#F4B400]" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>
                {workspaceTab === "Overview" && (
                    <OverviewView
                        state={state}
                        onNavigate={navigate}
                        onSelectAssessment={(id) =>
                            setDetail({ kind: "assessment", id })
                        }
                        onSelectGap={(id) => setDetail({ kind: "gap", id })}
                        onCreateCompetency={() =>
                            setCompetencyForm({ id: null, duplicate: false })
                        }
                        onCreateCycle={() => setCycleFormId(null)}
                        onCreateAssignment={() =>
                            setAssignmentFormCycleId(null)
                        }
                    />
                )}
                {workspaceTab === "Competency Library" && (
                    <LibraryView
                        state={state}
                        onSelect={(id) => setDetail({ kind: "competency", id })}
                        onCreate={() =>
                            setCompetencyForm({ id: null, duplicate: false })
                        }
                    />
                )}
                {workspaceTab === "Role Profiles" && (
                    <RoleProfilesView
                        state={state}
                        onSelect={(id) => setDetail({ kind: "profile", id })}
                        onCreate={() => setProfileFormId(null)}
                    />
                )}
                {workspaceTab === "Assessment Cycles" && (
                    <CyclesView
                        state={state}
                        focus={workspaceFocus}
                        onSelect={(id) => setDetail({ kind: "cycle", id })}
                        onCreate={() => setCycleFormId(null)}
                        onPrepareAssignments={requestCycleAssignments}
                        onAuthorize={() => setShowAuthorizationForm(true)}
                        onToggleAuthorization={toggleAuthorization}
                    />
                )}
                {workspaceTab === "Assessments" && (
                    <AssessmentsView
                        state={state}
                        focus={workspaceFocus}
                        onSelect={(id) => setDetail({ kind: "assessment", id })}
                        onCreate={() => setAssignmentFormCycleId(null)}
                    />
                )}
                {workspaceTab === "Competency Profiles" && (
                    <ProfilesView
                        state={state}
                        focus={workspaceFocus}
                        onSelect={(id) =>
                            setDetail({ kind: "person-profile", id })
                        }
                    />
                )}
                {workspaceTab === "Gap & Development" && (
                    <GapDevelopmentView
                        state={state}
                        onSelect={(id) => setDetail({ kind: "gap", id })}
                    />
                )}
                {workspaceTab === "Analytics" && (
                    <AnalyticsView state={state} />
                )}
            </div>
            {competencyForm && (
                <CompetencyForm
                    key={`${competencyForm.id ?? "new"}-${competencyForm.duplicate}`}
                    show
                    existing={
                        competencyForm.id
                            ? (state.competencies.find(
                                  (item) => item.id === competencyForm.id,
                              ) ?? null)
                            : null
                    }
                    duplicate={competencyForm.duplicate}
                    nextCode={nextCode}
                    actorName={actorName}
                    existingNames={state.competencies.map((item) => item.name)}
                    onClose={() => setCompetencyForm(null)}
                    onSave={saveCompetency}
                />
            )}
            {profileFormId !== undefined && (
                <RoleProfileForm
                    key={profileFormId ?? "new"}
                    show
                    existing={
                        profileFormId
                            ? (state.roleProfiles.find(
                                  (item) => item.id === profileFormId,
                              ) ?? null)
                            : null
                    }
                    state={state}
                    actorName={actorName}
                    onClose={() => setProfileFormId(undefined)}
                    onSave={saveProfile}
                />
            )}
            {cycleFormId !== undefined && (
                <CycleForm
                    key={cycleFormId ?? "new"}
                    show
                    existing={
                        cycleFormId
                            ? (state.cycles.find(
                                  (item) => item.id === cycleFormId,
                              ) ?? null)
                            : null
                    }
                    state={state}
                    actorName={actorName}
                    onClose={() => setCycleFormId(undefined)}
                    onSave={saveCycle}
                />
            )}
            {assignmentFormCycleId !== undefined && (
                <AssessmentAssignmentForm
                    key={assignmentFormCycleId ?? "any-cycle"}
                    show
                    state={state}
                    actorName={actorName}
                    initialCycleId={assignmentFormCycleId}
                    onClose={() => setAssignmentFormCycleId(undefined)}
                    onSave={createAssessment}
                />
            )}
            {showAuthorizationForm && (
                <AssessorAuthorizationForm
                    show
                    state={state}
                    actorName={actorName}
                    onClose={() => setShowAuthorizationForm(false)}
                    onSave={saveAuthorization}
                />
            )}
            {evidenceTarget &&
                (() => {
                    const assessment = state.assessments.find(
                        (item) => item.id === evidenceTarget.assessmentId,
                    );
                    const requirement =
                        assessment?.roleProfileSnapshot.requirements.find(
                            (item) =>
                                item.competencyId ===
                                evidenceTarget.competencyId,
                        );
                    const existing = assessment?.ratings
                        .find(
                            (item) =>
                                item.competencyId ===
                                evidenceTarget.competencyId,
                        )
                        ?.evidence.find(
                            (item) => item.id === evidenceTarget.evidenceId,
                        );
                    return (
                        <EvidenceForm
                            key={evidenceTarget.evidenceId ?? "new-evidence"}
                            show
                            competencyName={
                                requirement?.competency.name ??
                                "Competency evidence"
                            }
                            existing={existing}
                            allowedTypes={
                                requirement?.competency.requiredEvidenceTypes ??
                                []
                            }
                            actorName={actorName}
                            onClose={() => setEvidenceTarget(null)}
                            onSave={(evidence) =>
                                addEvidence(evidenceTarget, evidence)
                            }
                        />
                    );
                })()}
            {recommendationTarget &&
                (() => {
                    const gap = gapRows.find(
                        (item) => item.id === recommendationTarget.gapId,
                    );
                    const existing = state.recommendations.find(
                        (item) => item.id === recommendationTarget.existingId,
                    );
                    return (
                        <RecommendationForm
                            key={`${recommendationTarget.gapId}-${recommendationTarget.type}-${recommendationTarget.existingId ?? "new"}`}
                            show
                            type={recommendationTarget.type}
                            gapLabel={
                                gap
                                    ? `${gap.person.fullName} · ${gap.competency?.name}`
                                    : "Competency gap"
                            }
                            existing={existing}
                            actorName={actorName}
                            onClose={() => setRecommendationTarget(null)}
                            onSave={saveRecommendation}
                        />
                    );
                })()}
            {reassignAssessmentId && (
                <ReassignAssessmentModal
                    assessment={
                        state.assessments.find(
                            (item) => item.id === reassignAssessmentId,
                        ) ?? null
                    }
                    state={state}
                    actorId={actorId}
                    actorName={actorName}
                    onClose={() => setReassignAssessmentId(null)}
                    onSave={reassignAssessment}
                />
            )}
            {reopenAssessmentId && (
                <ReopenAssessmentModal
                    assessment={
                        state.assessments.find(
                            (item) => item.id === reopenAssessmentId,
                        ) ?? null
                    }
                    state={state}
                    actorId={actorId}
                    actorName={actorName}
                    onClose={() => setReopenAssessmentId(null)}
                    onReopenCurrent={reopenWithinActiveCycle}
                    onCreateRevision={createActiveCycleRevision}
                />
            )}
            <ConfirmDialog
                show={Boolean(confirmAction)}
                title={confirmAction?.title ?? ""}
                description={confirmAction?.description ?? ""}
                confirmLabel={confirmAction?.label ?? "Confirm"}
                tone={confirmAction?.tone}
                reason={confirmReason}
                onReasonChange={
                    confirmAction?.reasonRequired ? setConfirmReason : undefined
                }
                reasonRequired={confirmAction?.reasonRequired}
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => confirmAction?.execute(confirmReason)}
            />
            <CompetencyDetailDrawer
                competency={selectedCompetency}
                state={state}
                onClose={() => setDetail(null)}
                onEdit={editCompetency}
                onDuplicate={(id) => setCompetencyForm({ id, duplicate: true })}
                onStatus={changeCompetencyStatus}
            />
            <RoleProfileDetailDrawer
                profile={selectedProfile}
                state={state}
                onClose={() => setDetail(null)}
                onEdit={editProfile}
                onPublish={publishProfile}
                onArchive={archiveProfile}
            />
            <CycleDetailDrawer
                cycle={selectedCycle}
                state={state}
                onClose={() => setDetail(null)}
                onEdit={(id) => setCycleFormId(id)}
                onTransition={transitionCycle}
                onPrepareAssignments={requestCycleAssignments}
            />
            <AssessmentDetailDrawer
                key={selectedAssessment?.id ?? "no-assessment"}
                assessment={selectedAssessment}
                state={state}
                actorId={actorId}
                canValidate={canValidate}
                onClose={() => setDetail(null)}
                onRating={updateRating}
                onSelfRating={updateSelfAssessment}
                onEvidence={(assessmentId, competencyId, evidenceId) =>
                    setEvidenceTarget({
                        assessmentId,
                        competencyId,
                        evidenceId,
                    })
                }
                onRemoveEvidence={removeEvidence}
                onSaveDraft={saveDraft}
                onSubmit={submitAssessment}
                onFinalize={finalizeAssessment}
                onReturn={returnForRevision}
                onReassign={(id) => setReassignAssessmentId(id)}
                onReopen={(assessment) => setReopenAssessmentId(assessment.id)}
                onCancel={cancelAssessment}
                onAcknowledge={acknowledgeAssessment}
            />
            <PersonProfileDetailDrawer
                row={selectedPersonProfile}
                onClose={() => setDetail(null)}
            />
            <GapDetailDrawer
                gap={selectedGap}
                state={state}
                blocked={Boolean(recommendationTarget)}
                onClose={() => setDetail(null)}
                onRecommend={(gapId, type) =>
                    setRecommendationTarget({ gapId, type, existingId: null })
                }
                onEditNote={(gapId, recommendation) =>
                    setRecommendationTarget({
                        gapId,
                        type: recommendation.type,
                        existingId: recommendation.id,
                    })
                }
                onStatus={updateRecommendationStatus}
            />
        </AuthenticatedLayout>
    );
}
function CompetencyDetailDrawer({
    competency,
    state,
    onClose,
    onEdit,
    onDuplicate,
    onStatus,
}: {
    competency: CompetencyDefinition | null;
    state: ReturnType<typeof useCompetencyStore>["state"];
    onClose: () => void;
    onEdit: (id: string) => void;
    onDuplicate: (id: string) => void;
    onStatus: (
        competency: CompetencyDefinition,
        status: "Active" | "Archived",
    ) => void;
}) {
    if (!competency) return null;
    const usage = state.roleProfiles.filter((profile) =>
        profile.requirements.some(
            (requirement) => requirement.competencyId === competency.id,
        ),
    );
    return (
        <AppDrawer
            show
            title={`${competency.code} · ${competency.name}`}
            description="Competency Library definition"
            onClose={onClose}
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => onDuplicate(competency.id)}
                        className={secondaryButtonClass}
                    >
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(competency.id)}
                        className={primaryButtonClass}
                    >
                        <Pencil className="h-3.5 w-3.5" />{" "}
                        {competency.status === "Draft" ? "Edit Draft" : "Edit Working Draft"}
                    </button>
                </>
            }
        >
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={competency.status} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {competency.category}
                </span>
                <span className="text-xs text-slate-400">
                    Version {competency.version}
                </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
                {competency.definition}
            </p>
            <SectionCard
                title="Five-level behavioral indicators"
                description="Official proficiency scale"
            >
                <div className="divide-y divide-slate-100">
                    {PROFICIENCY_LEVELS.map((level) => (
                        <div key={level.value} className="flex gap-3 px-4 py-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-xs font-bold text-amber-700">
                                {level.value}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-700">
                                    {level.label}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {
                                        competency.behavioralIndicators[
                                            level.value
                                        ]
                                    }
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoBlock
                    label="Assessment Methods"
                    values={competency.assessmentMethods}
                />
                <InfoBlock
                    label="Accepted Evidence Types"
                    values={
                        competency.requiredEvidenceTypes.length
                            ? competency.requiredEvidenceTypes
                            : ["No default evidence type"]
                    }
                />
                <InfoBlock
                    label="Default Reassessment"
                    values={[
                        competency.reassessmentIntervalMonths
                            ? `${competency.reassessmentIntervalMonths} months`
                            : "Not configured",
                    ]}
                />
                <InfoBlock
                    label="Updated"
                    values={[
                        `${formatDate(competency.lastUpdated)} by ${competency.updatedBy}`,
                    ]}
                />
            </div>
            <SectionCard
                title="Role Profile Usage"
                description={`${usage.length} profile(s) reference this competency`}
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {usage.map((profile) => (
                        <div
                            key={profile.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                            <div>
                                <p className="text-xs font-semibold text-slate-700">
                                    {profile.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {profile.position} · {profile.appliesTo} · v
                                    {profile.version}
                                </p>
                            </div>
                            <StatusBadge value={profile.status} />
                        </div>
                    ))}
                    {!usage.length && (
                        <EmptyState
                            icon={FolderKanban}
                            title="Not used by a role profile"
                        />
                    )}
                </div>
            </SectionCard>
            <SectionCard
                title="Version History"
                description="Definition changes remain traceable"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {competency.versionHistory
                        .slice()
                        .reverse()
                        .map((entry) => (
                            <div
                                key={`${entry.version}-${entry.changedAt}`}
                                className="px-4 py-3"
                            >
                                <p className="text-xs font-bold text-slate-700">
                                    Version {entry.version} · {entry.summary}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {formatDate(entry.changedAt)} ·{" "}
                                    {entry.changedBy}
                                </p>
                            </div>
                        ))}
                </div>
            </SectionCard>
            <div className="mt-4 flex gap-2">
                {competency.status === "Draft" && (
                    <button
                        type="button"
                        onClick={() => onStatus(competency, "Active")}
                        className={primaryButtonClass}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Publish Draft
                    </button>
                )}
                {competency.status === "Active" && (
                    <button
                        type="button"
                        onClick={() => onStatus(competency, "Archived")}
                        className={secondaryButtonClass}
                    >
                        <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                )}
            </div>
        </AppDrawer>
    );
}
function InfoBlock({ label, values }: { label: string; values: string[] }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {label}
            </p>
            <div className="mt-2 space-y-1">
                {values.map((value) => (
                    <p key={value} className="text-xs text-slate-600">
                        {value}
                    </p>
                ))}
            </div>
        </div>
    );
}
function RoleProfileDetailDrawer({
    profile,
    state,
    onClose,
    onEdit,
    onPublish,
    onArchive,
}: {
    profile: RoleProfile | null;
    state: ReturnType<typeof useCompetencyStore>["state"];
    onClose: () => void;
    onEdit: (id: string) => void;
    onPublish: (profile: RoleProfile) => void;
    onArchive: (profile: RoleProfile) => void;
}) {
    if (!profile) return null;
    const people = SHARED_PERSONNEL.filter(
        (person) =>
            person.position === profile.position &&
            person.department === profile.department &&
            (profile.appliesTo === "Both" ||
                profile.appliesTo === person.personType),
    );
    return (
        <AppDrawer
            show
            title={profile.name}
            description={`${profile.position} · ${profile.department}`}
            onClose={onClose}
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => onEdit(profile.id)}
                        className={profile.status === "Draft" ? secondaryButtonClass : primaryButtonClass}
                    >
                        <Pencil className="h-3.5 w-3.5" />{" "}
                        {profile.status === "Draft" ? "Edit Draft" : "Edit Working Draft"}
                    </button>
                    {profile.status === "Draft" && (
                        <button
                            type="button"
                            onClick={() => onPublish(profile)}
                            className={primaryButtonClass}
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Publish Draft
                        </button>
                    )}
                    {profile.status === "Active" && (
                        <button
                            type="button"
                            onClick={() => onArchive(profile)}
                            className={secondaryButtonClass}
                        >
                            <Archive className="h-3.5 w-3.5" /> Archive
                        </button>
                    )}
                </>
            }
        >
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={profile.status} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                    {profile.appliesTo}
                </span>
                <span className="text-xs text-slate-400">
                    v{profile.version} · effective{" "}
                    {formatDate(profile.effectiveDate)}
                </span>
            </div>
            <SectionCard
                title="Competency Requirements"
                description="Required levels are position-specific and preserved in assessment snapshots"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {profile.requirements.map((requirement) => {
                        const competency = state.competencies.find(
                            (item) => item.id === requirement.competencyId,
                        );
                        return (
                            <div key={requirement.id} className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">
                                            {competency?.code} ·{" "}
                                            {competency?.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-slate-400">
                                            {competency?.category}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                                            L{requirement.requiredLevel} ·{" "}
                                            {proficiencyLabel(
                                                requirement.requiredLevel,
                                            )}
                                        </span>
                                        {requirement.critical && (
                                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
                                                Critical
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                                    <span>
                                        Evidence:{" "}
                                        {requirement.evidenceRequirement}
                                    </span>
                                    <span>
                                        Reassess:{" "}
                                        {requirement.reassessmentIntervalMonths
                                            ? `${requirement.reassessmentIntervalMonths} months`
                                            : "Default"}
                                    </span>
                                    <span>
                                        {requirement.notes ||
                                            "No additional notes"}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </SectionCard>
            <SectionCard
                title="Assigned People"
                description={`${people.length} current personnel match position, department, and person type`}
                className="mt-4"
            >
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                    {people.map((person) => (
                        <div
                            key={person.id}
                            className="rounded-lg border border-slate-100 p-2"
                        >
                            <PersonCell person={person} />
                        </div>
                    ))}
                    {!people.length && (
                        <p className="text-xs text-slate-400">
                            No matching personnel.
                        </p>
                    )}
                </div>
            </SectionCard>
            <SectionCard
                title="Version History"
                description="Published and draft snapshots preserve meaningful configuration"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {profile.versionHistory
                        .slice()
                        .reverse()
                        .map((entry) => (
                            <div
                                key={`${entry.version}-${entry.changedAt}`}
                                className="px-4 py-3"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold text-slate-700">
                                        Version {entry.version} ·{" "}
                                        {entry.summary}
                                    </p>
                                    <StatusBadge value={entry.status} />
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    {entry.name} · {entry.position} ·{" "}
                                    {entry.department} · {entry.appliesTo}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {entry.requirements.length} requirements ·{" "}
                                    {entry.competencyDefinitions.length}{" "}
                                    captured definitions · effective{" "}
                                    {formatDate(entry.effectiveDate)} ·{" "}
                                    {entry.changedBy}
                                </p>
                            </div>
                        ))}
                </div>
            </SectionCard>
        </AppDrawer>
    );
}
function CycleDetailDrawer({
    cycle,
    state,
    onClose,
    onEdit,
    onTransition,
    onPrepareAssignments,
}: {
    cycle: AssessmentCycle | null;
    state: ReturnType<typeof useCompetencyStore>["state"];
    onClose: () => void;
    onEdit: (id: string) => void;
    onTransition: (
        cycle: AssessmentCycle,
        status: AssessmentCycle["status"],
    ) => void;
    onPrepareAssignments: (id: string) => void;
}) {
    if (!cycle) return null;
    const assignments = state.assessments.filter(
        (item) => item.cycleId === cycle.id,
    );
    const unresolved = assignments.filter(
        (item) => !["Finalized", "Cancelled"].includes(item.status),
    );
    return (
        <AppDrawer
            show
            title={cycle.name}
            description={cycle.type}
            onClose={onClose}
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => onEdit(cycle.id)}
                        disabled={["Closed", "Cancelled"].includes(
                            cycle.status,
                        )}
                        className={secondaryButtonClass}
                    >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    {["Scheduled", "Active"].includes(cycle.status) && (
                        <button
                            type="button"
                            onClick={() => onPrepareAssignments(cycle.id)}
                            className={primaryButtonClass}
                        >
                            <UserCheck className="h-3.5 w-3.5" /> Prepare
                            Assignments
                        </button>
                    )}
                </>
            }
        >
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={cycle.status} />
                <span className="text-xs text-slate-400">
                    {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoBlock label="Applies To" values={[cycle.appliesTo]} />
                <InfoBlock
                    label="Assignment Method"
                    values={[
                        cycle.assignmentMethod,
                        ...(cycle.assignmentMethod === "Role-based Assessor"
                            ? [
                                  `Scope: ${cycle.roleBasedAssessorScope ?? "Not configured"}`,
                                  `Assessor positions: ${cycle.roleBasedAssessorPositions.join(", ") || "Not configured"}`,
                              ]
                            : []),
                    ]}
                />
                <InfoBlock
                    label="Departments"
                    values={[
                        cycle.departments.length
                            ? cycle.departments.join(", ")
                            : "All matching departments",
                    ]}
                />
                <InfoBlock
                    label="Positions"
                    values={[
                        cycle.positions.length
                            ? cycle.positions.join(", ")
                            : "All matching positions",
                    ]}
                />
                <InfoBlock
                    label="Due-date Rule"
                    values={[
                        `${cycle.dueDaysAfterAssignment} days after assignment`,
                    ]}
                />
                <InfoBlock
                    label="Reassessment Rule"
                    values={[cycle.reassessmentRule]}
                />
            </div>
            <SectionCard
                title="Workflow Controls"
                description="Cycle-specific requirements"
                className="mt-4"
            >
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                    {[
                        ["Self-assessment", cycle.requireSelfAssessment],
                        [
                            "Supporting evidence",
                            cycle.requireSupportingEvidence,
                        ],
                        ["HR validation", cycle.requireHrValidation],
                        [
                            "Employee acknowledgment",
                            cycle.requireAcknowledgment,
                        ],
                    ].map(([label, enabled]) => (
                        <div
                            key={String(label)}
                            className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                        >
                            <span className="text-xs font-semibold text-slate-600">
                                {String(label)}
                            </span>
                            <StatusBadge
                                value={enabled ? "Active" : "Archived"}
                            />
                        </div>
                    ))}
                </div>
            </SectionCard>
            <SectionCard
                title="Role Profiles"
                description="Assignment population source"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {cycle.roleProfileIds.map((id) => {
                        const profile = state.roleProfiles.find(
                            (item) => item.id === id,
                        );
                        return (
                            <div key={id} className="px-4 py-3">
                                <p className="text-xs font-semibold text-slate-700">
                                    {profile?.name ?? id}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {profile
                                        ? `${profile.position} · ${profile.appliesTo} · v${profile.version}`
                                        : "Missing profile reference"}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </SectionCard>
            <SectionCard
                title="Assignment Summary"
                description={`${assignments.length} complete role-profile assessment assignments`}
                className="mt-4"
            >
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                    {[
                        "Pending",
                        "In Progress",
                        "Submitted",
                        "Pending Validation",
                        "Returned for Revision",
                        "Finalized",
                        "Overdue",
                        "Cancelled",
                    ].map((status) => (
                        <div
                            key={status}
                            className="rounded-lg bg-slate-50 p-3"
                        >
                            <p className="text-lg font-bold text-slate-800">
                                {
                                    assignments.filter(
                                        (item) => item.status === status,
                                    ).length
                                }
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                                {status}
                            </p>
                        </div>
                    ))}
                </div>
            </SectionCard>
            <div
                className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-5 ${unresolved.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
            >
                <strong>Closure readiness:</strong>{" "}
                {unresolved.length
                    ? `${unresolved.length} unresolved assessment(s) block cycle closure.`
                    : "All assignments are finalized or cancelled; the cycle may close."}
            </div>
            <SectionCard
                title="Cycle Audit History"
                description="Configuration, status, and assignment changes"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {state.auditLog
                        .filter(
                            (entry) =>
                                entry.entityType === "Cycle" &&
                                entry.entityId === cycle.id,
                        )
                        .map((entry) => (
                            <div key={entry.id} className="px-4 py-3">
                                <p className="text-xs font-bold text-slate-700">
                                    {entry.action}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {entry.detail}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {formatDate(entry.createdAt)} ·{" "}
                                    {entry.actorName}
                                </p>
                            </div>
                        ))}
                </div>
            </SectionCard>
            <div className="mt-4 flex flex-wrap gap-2">
                {cycle.status === "Draft" && (
                    <>
                        <button
                            type="button"
                            onClick={() => onTransition(cycle, "Scheduled")}
                            className={secondaryButtonClass}
                        >
                            Schedule
                        </button>
                        <button
                            type="button"
                            onClick={() => onTransition(cycle, "Active")}
                            className={primaryButtonClass}
                        >
                            Activate
                        </button>
                    </>
                )}
                {cycle.status === "Scheduled" && (
                    <button
                        type="button"
                        onClick={() => onTransition(cycle, "Active")}
                        className={primaryButtonClass}
                    >
                        Activate
                    </button>
                )}
                {cycle.status === "Active" && (
                    <button
                        type="button"
                        disabled={Boolean(unresolved.length)}
                        title={
                            unresolved.length
                                ? "Resolve every open assessment before closing."
                                : undefined
                        }
                        onClick={() => onTransition(cycle, "Closed")}
                        className={primaryButtonClass}
                    >
                        Close Cycle
                    </button>
                )}
                {!["Closed", "Cancelled"].includes(cycle.status) && (
                    <button
                        type="button"
                        onClick={() => onTransition(cycle, "Cancelled")}
                        className={secondaryButtonClass}
                    >
                        Cancel Cycle
                    </button>
                )}
            </div>
        </AppDrawer>
    );
}
function AssessmentDetailDrawer({
    assessment,
    state,
    actorId,
    canValidate,
    onClose,
    onRating,
    onSelfRating,
    onEvidence,
    onRemoveEvidence,
    onSaveDraft,
    onSubmit,
    onFinalize,
    onReturn,
    onReassign,
    onReopen,
    onCancel,
    onAcknowledge,
}: {
    assessment: CompetencyAssessment | null;
    state: ReturnType<typeof useCompetencyStore>["state"];
    actorId: string;
    canValidate: boolean;
    onClose: () => void;
    onRating: (
        assessmentId: string,
        competencyId: string,
        patch: Partial<CompetencyRating>,
    ) => void;
    onSelfRating: (
        assessmentId: string,
        competencyId: string,
        patch: Pick<Partial<CompetencyRating>, "selfLevel" | "selfComments">,
    ) => void;
    onEvidence: (
        assessmentId: string,
        competencyId: string,
        evidenceId?: string,
    ) => void;
    onRemoveEvidence: (
        assessmentId: string,
        competencyId: string,
        evidenceId: string,
    ) => void;
    onSaveDraft: (assessment: CompetencyAssessment) => void;
    onSubmit: (assessment: CompetencyAssessment) => void;
    onFinalize: (assessment: CompetencyAssessment, notes: string) => void;
    onReturn: (assessment: CompetencyAssessment) => void;
    onReassign: (id: string) => void;
    onReopen: (assessment: CompetencyAssessment) => void;
    onCancel: (assessment: CompetencyAssessment) => void;
    onAcknowledge: (assessment: CompetencyAssessment) => void;
}) {
    const [validationNotes, setValidationNotes] = useState(
        assessment?.hrValidationNotes ?? "",
    );
    if (!assessment) return null;
    const person = getPersonById(assessment.personId);
    const assessor = getPersonById(assessment.assessorId);
    const cycle = state.cycles.find((item) => item.id === assessment.cycleId);
    const rules = assessment.cycleSnapshot;
    const openStatus = [
        "Pending",
        "In Progress",
        "Returned for Revision",
        "Overdue",
    ].includes(assessment.status);
    const editable =
        cycle?.status === "Active" &&
        canAssess(state, assessment, actorId) &&
        openStatus;
    const selfEditable =
        actorId === assessment.personId &&
        cycle?.status === "Active" &&
        rules.requireSelfAssessment &&
        openStatus;
    const latestSnapshot = latestFinalizedSnapshot(assessment);
    const acknowledgmentEvent = latestSnapshot
        ? findAssessmentAcknowledgmentEvent(
              state.acknowledgmentEvents,
              assessment.id,
              latestSnapshot.version,
          )
        : null;
    const canAcknowledge =
        actorId === assessment.personId &&
        assessment.status === "Finalized" &&
        rules.requireAcknowledgment &&
        Boolean(latestSnapshot) &&
        !acknowledgmentEvent;
    return (
        <AppDrawer
            show
            title={
                person
                    ? `${person.fullName} · Competency Assessment`
                    : "Competency Assessment"
            }
            description={`${assessment.roleProfileSnapshot.name} · v${assessment.roleProfileSnapshot.version}`}
            onClose={onClose}
            footer={
                <>
                    {canAcknowledge && (
                        <button
                            type="button"
                            onClick={() => onAcknowledge(assessment)}
                            className={primaryButtonClass}
                        >
                            Received / Viewed
                        </button>
                    )}
                    {editable && (
                        <>
                            <button
                                type="button"
                                onClick={() => onSaveDraft(assessment)}
                                className={secondaryButtonClass}
                            >
                                <Save className="h-3.5 w-3.5" /> Save Draft
                            </button>
                            <button
                                type="button"
                                onClick={() => onSubmit(assessment)}
                                className={primaryButtonClass}
                            >
                                <Send className="h-3.5 w-3.5" /> Submit
                            </button>
                        </>
                    )}
                    {canValidate &&
                        ["Submitted", "Pending Validation"].includes(
                            assessment.status,
                        ) && (
                            <button
                                type="button"
                                onClick={() =>
                                    onFinalize(assessment, validationNotes)
                                }
                                className={primaryButtonClass}
                            >
                                <ShieldCheck className="h-3.5 w-3.5" /> Finalize
                            </button>
                        )}
                </>
            }
        >
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={assessment.status} />
                <span className="text-xs text-slate-400">
                    Due {formatDate(assessment.dueDate)} ·{" "}
                    {assessmentProgress(assessment)}% officially rated
                </span>
            </div>
            {person && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <PersonCell
                        person={person}
                        subtitle={`${person.personType} · ${person.position} · ${person.department}`}
                    />
                </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoBlock
                    label="Assessment Cycle Snapshot"
                    values={[
                        `${rules.name} · ${rules.type}`,
                        `${formatDate(rules.startDate)} – ${formatDate(rules.endDate)}`,
                    ]}
                />
                <InfoBlock
                    label="Authorized Assessor"
                    values={[
                        assessor
                            ? `${assessor.fullName} · ${assessor.position}`
                            : assessment.assessorId,
                    ]}
                />
                <InfoBlock
                    label="Role Profile Snapshot"
                    values={[
                        `${assessment.roleProfileSnapshot.name} · v${assessment.roleProfileSnapshot.version}`,
                        `${assessment.roleProfileSnapshot.position} · ${assessment.roleProfileSnapshot.department}`,
                    ]}
                />
                <InfoBlock
                    label="Employee Acknowledgment"
                    values={[
                        acknowledgmentEvent && latestSnapshot
                            ? `Finalized v${latestSnapshot.version} · Received / Viewed ${formatDate(acknowledgmentEvent.acknowledgedAt)}`
                            : rules.requireAcknowledgment && latestSnapshot
                              ? `Finalized v${latestSnapshot.version} · Pending employee action; acknowledgment records receipt, not agreement`
                              : "Not required",
                    ]}
                />
            </div>
            {!editable &&
                !["Submitted", "Pending Validation", "Finalized"].includes(
                    assessment.status,
                ) && (
                    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                        <strong>Authorization boundary:</strong> Admin access
                        alone does not permit official competency rating. Only
                        the assigned, actively authorized assessor can edit and
                        submit.
                    </div>
                )}
            {rules.requireSelfAssessment && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
                    <strong>Self-assessment boundary:</strong> Every requirement
                    needs subject input before assessor submission. Self-levels
                    remain separate and never become the official result.
                    {selfEditable
                        ? " You are the assessment subject and may edit the self-input below."
                        : " Only the assessment subject can edit this input."}
                </div>
            )}
            {!editable && openStatus && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
                    <strong>Read-only:</strong>{" "}
                    {cycle?.status !== "Active"
                        ? `The current cycle is ${cycle?.status ?? "unavailable"}; assessment input is locked.`
                        : assessment.assessorId !== actorId
                          ? "Only the assigned assessor can edit official ratings."
                          : "Active assessor authorization is required for this person and role profile."}
                </div>
            )}
            <SectionCard
                title="Required Competencies"
                description="Official levels and historical indicators come from the immutable assignment snapshot"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {assessment.roleProfileSnapshot.requirements.map(
                        (requirement) => {
                            const competency = requirement.competency;
                            const rating = assessment.ratings.find(
                                (item) =>
                                    item.competencyId ===
                                    requirement.competencyId,
                            )!;
                            const result = getRequirementResult(
                                rating?.selectedLevel ?? null,
                                requirement.requiredLevel,
                            );
                            const evidenceRequired = Boolean(
                                rules.requireSupportingEvidence ||
                                    requirement.critical ||
                                    requirement.evidenceRequirement ===
                                        "Required",
                            );
                            return (
                                <div key={requirement.id} className="p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">
                                                {competency.code} ·{" "}
                                                {competency.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-400">
                                                Definition v{competency.version}{" "}
                                                · {competency.category} ·
                                                Required L
                                                {requirement.requiredLevel} ·{" "}
                                                {proficiencyLabel(
                                                    requirement.requiredLevel,
                                                )}
                                                {evidenceRequired
                                                    ? " · Evidence required"
                                                    : ""}
                                            </p>
                                        </div>
                                        <StatusBadge value={result} />
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        {competency.definition}
                                    </p>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <Field label="Official Selected Level">
                                            <select
                                                value={
                                                    rating?.selectedLevel ?? ""
                                                }
                                                disabled={!editable}
                                                onChange={(event) =>
                                                    onRating(
                                                        assessment.id,
                                                        requirement.competencyId,
                                                        {
                                                            selectedLevel: event
                                                                .target.value
                                                                ? (Number(
                                                                      event
                                                                          .target
                                                                          .value,
                                                                  ) as ProficiencyLevel)
                                                                : null,
                                                        },
                                                    )
                                                }
                                                className={controlClass}
                                            >
                                                <option value="">
                                                    Not Assessed
                                                </option>
                                                {PROFICIENCY_LEVELS.map(
                                                    (level) => (
                                                        <option
                                                            key={level.value}
                                                            value={level.value}
                                                        >
                                                            {level.value} —{" "}
                                                            {level.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </Field>
                                        <Field
                                            label="Self-assessment"
                                            hint="Subject context only; never copied into the official level."
                                        >
                                            {rules.requireSelfAssessment ? (
                                                <select
                                                    value={
                                                        rating?.selfLevel ?? ""
                                                    }
                                                    disabled={!selfEditable}
                                                    onChange={(event) =>
                                                        onSelfRating(
                                                            assessment.id,
                                                            requirement.competencyId,
                                                            {
                                                                selfLevel: event
                                                                    .target
                                                                    .value
                                                                    ? (Number(
                                                                          event
                                                                              .target
                                                                              .value,
                                                                      ) as ProficiencyLevel)
                                                                    : null,
                                                            },
                                                        )
                                                    }
                                                    className={controlClass}
                                                >
                                                    <option value="">
                                                        Not submitted
                                                    </option>
                                                    {PROFICIENCY_LEVELS.map(
                                                        (level) => (
                                                            <option
                                                                key={
                                                                    level.value
                                                                }
                                                                value={
                                                                    level.value
                                                                }
                                                            >
                                                                {level.value} —{" "}
                                                                {level.label}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            ) : (
                                                <input
                                                    value="Not enabled"
                                                    readOnly
                                                    className={controlClass}
                                                />
                                            )}
                                        </Field>
                                    </div>
                                    {rating?.selectedLevel && (
                                        <div className="mt-3 rounded-lg bg-amber-50 p-3">
                                            <p className="text-xs font-bold text-amber-800">
                                                Snapshot behavioral indicator
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-amber-900">
                                                {
                                                    competency
                                                        .behavioralIndicators[
                                                        rating.selectedLevel
                                                    ]
                                                }
                                            </p>
                                        </div>
                                    )}
                                    {rules.requireSelfAssessment && (
                                        <div className="mt-3">
                                            <Field
                                                label="Self-assessment Comments"
                                                hint="Visible as context; does not change the assessor result."
                                            >
                                                <textarea
                                                    rows={2}
                                                    value={
                                                        rating?.selfComments ??
                                                        ""
                                                    }
                                                    disabled={!selfEditable}
                                                    onChange={(event) =>
                                                        onSelfRating(
                                                            assessment.id,
                                                            requirement.competencyId,
                                                            {
                                                                selfComments:
                                                                    event.target
                                                                        .value,
                                                            },
                                                        )
                                                    }
                                                    className={controlClass}
                                                />
                                            </Field>
                                        </div>
                                    )}
                                    <div className="mt-3">
                                        <Field label="Assessor Comments">
                                            <textarea
                                                rows={2}
                                                value={
                                                    rating?.assessorComments ??
                                                    ""
                                                }
                                                disabled={!editable}
                                                onChange={(event) =>
                                                    onRating(
                                                        assessment.id,
                                                        requirement.competencyId,
                                                        {
                                                            assessorComments:
                                                                event.target
                                                                    .value,
                                                        },
                                                    )
                                                }
                                                className={controlClass}
                                            />
                                        </Field>
                                    </div>
                                    <div className="mt-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold text-slate-500">
                                                Evidence (
                                                {rating?.evidence.length ?? 0})
                                                {evidenceRequired
                                                    ? " · required"
                                                    : " · optional"}
                                            </p>
                                            {editable && (
                                                <button
                                                    type="button"
                                                    disabled={
                                                        !competency
                                                            .requiredEvidenceTypes
                                                            .length
                                                    }
                                                    title={
                                                        !competency
                                                            .requiredEvidenceTypes
                                                            .length
                                                            ? "This competency snapshot accepts no evidence types."
                                                            : undefined
                                                    }
                                                    onClick={() =>
                                                        onEvidence(
                                                            assessment.id,
                                                            requirement.competencyId,
                                                        )
                                                    }
                                                    className={
                                                        secondaryButtonClass
                                                    }
                                                >
                                                    <Plus className="h-3 w-3" />{" "}
                                                    Add Evidence
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-2 space-y-2">
                                            {rating?.evidence.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2"
                                                >
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-700">
                                                            {item.type} ·{" "}
                                                            {item.title}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                            {item.description} ·{" "}
                                                            {
                                                                item.verificationState
                                                            }
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-400">
                                                            {item.reference ||
                                                                "No link reference"}{" "}
                                                            · added by{" "}
                                                            {item.addedBy}
                                                        </p>
                                                    </div>
                                                    {editable && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onEvidence(
                                                                        assessment.id,
                                                                        requirement.competencyId,
                                                                        item.id,
                                                                    )
                                                                }
                                                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                                                                aria-label={`Edit ${item.title}`}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onRemoveEvidence(
                                                                        assessment.id,
                                                                        requirement.competencyId,
                                                                        item.id,
                                                                    )
                                                                }
                                                                className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                                                                aria-label={`Remove ${item.title}`}
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        },
                    )}
                </div>
            </SectionCard>
            {canValidate &&
                ["Submitted", "Pending Validation"].includes(
                    assessment.status,
                ) && (
                    <SectionCard
                        title="HR Validation"
                        description="Validation notes are required before finalization"
                        className="mt-4"
                    >
                        <div className="p-4">
                            <Field label="HR Validation Notes" required>
                                <textarea
                                    rows={4}
                                    value={validationNotes}
                                    onChange={(event) =>
                                        setValidationNotes(event.target.value)
                                    }
                                    className={controlClass}
                                />
                            </Field>
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => onReturn(assessment)}
                                    className={secondaryButtonClass}
                                >
                                    Return for Revision
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                )}
            {assessment.status === "Finalized" && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
                    <strong>Immutable finalized versions:</strong>{" "}
                    {assessment.finalizedSnapshots.length} preserved; latest is
                    v{assessment.finalizedSnapshot?.version ?? "—"} from{" "}
                    {formatDate(assessment.finalizedSnapshot?.finalizedAt)}.
                </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
                {canValidate &&
                    !["Finalized", "Cancelled"].includes(assessment.status) && (
                        <button
                            type="button"
                            onClick={() => onReassign(assessment.id)}
                            className={secondaryButtonClass}
                        >
                            <UserCheck className="h-3.5 w-3.5" /> Reassign
                            Assessor
                        </button>
                    )}
                {assessment.status === "Finalized" && canValidate && (
                    <button
                        type="button"
                        onClick={() => onReopen(assessment)}
                        className={secondaryButtonClass}
                    >
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen / Reassess
                    </button>
                )}
                {canValidate &&
                    !["Finalized", "Cancelled"].includes(assessment.status) && (
                        <button
                            type="button"
                            onClick={() => onCancel(assessment)}
                            className={secondaryButtonClass}
                        >
                            Cancel Assessment
                        </button>
                    )}
            </div>
            <HistorySections assessment={assessment} />
        </AppDrawer>
    );
}
function HistorySections({ assessment }: { assessment: CompetencyAssessment }) {
    return (
        <div className="mt-4 space-y-4">
            <SectionCard
                title="Finalized Version History"
                description="Every official finalization is immutable and retained"
            >
                <div className="divide-y divide-slate-100">
                    {assessment.finalizedSnapshots
                        .slice()
                        .reverse()
                        .map((snapshot) => (
                            <div
                                key={`${snapshot.version}-${snapshot.finalizedAt}`}
                                className="px-4 py-3"
                            >
                                <p className="text-xs font-bold text-slate-700">
                                    Finalized v{snapshot.version} ·{" "}
                                    {snapshot.profile.name} profile v
                                    {snapshot.profile.version}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {
                                        snapshot.ratings.filter(
                                            (rating) =>
                                                rating.selectedLevel !== null,
                                        ).length
                                    }
                                    /{snapshot.profile.requirements.length}{" "}
                                    official levels · assessor{" "}
                                    {getPersonById(snapshot.assessorId)
                                        ?.fullName ?? snapshot.assessorId}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {snapshot.cycle.name} rules ·{" "}
                                    {formatDate(snapshot.finalizedAt)} ·{" "}
                                    {snapshot.finalizedBy}
                                    {snapshot.hrValidationNotes
                                        ? ` · ${snapshot.hrValidationNotes}`
                                        : ""}
                                </p>
                            </div>
                        ))}
                    {!assessment.finalizedSnapshots.length && (
                        <EmptyState
                            icon={ShieldCheck}
                            title="No finalized version yet"
                        />
                    )}
                </div>
            </SectionCard>
            <SectionCard
                title="Revision History"
                description="Snapshots captured before return or reopen"
            >
                <div className="divide-y divide-slate-100">
                    {assessment.revisionHistory.map((entry) => (
                        <div
                            key={`${entry.version}-${entry.createdAt}`}
                            className="px-4 py-3"
                        >
                            <p className="text-xs font-bold text-slate-700">
                                v{entry.version} · {entry.action}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {entry.reason}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                {formatDate(entry.createdAt)} ·{" "}
                                {entry.actorName} · previous{" "}
                                {entry.previousStatus}
                            </p>
                        </div>
                    ))}
                    {!assessment.revisionHistory.length && (
                        <EmptyState icon={History} title="No revisions" />
                    )}
                </div>
            </SectionCard>
            <SectionCard
                title="Reassignment History"
                description="Assessor changes require documented reason"
            >
                <div className="divide-y divide-slate-100">
                    {assessment.reassignmentHistory.map((entry) => (
                        <div key={entry.createdAt} className="px-4 py-3">
                            <p className="text-xs font-bold text-slate-700">
                                {getPersonById(entry.fromAssessorId)?.fullName}{" "}
                                → {getPersonById(entry.toAssessorId)?.fullName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {entry.reason}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                {formatDate(entry.createdAt)} ·{" "}
                                {entry.actorName}
                            </p>
                        </div>
                    ))}
                    {!assessment.reassignmentHistory.length && (
                        <EmptyState icon={UserCheck} title="No reassignments" />
                    )}
                </div>
            </SectionCard>
            <SectionCard
                title="Audit History"
                description="Assessment activity record"
            >
                <div className="divide-y divide-slate-100">
                    {assessment.auditHistory
                        .slice()
                        .reverse()
                        .map((entry) => (
                            <div key={entry.id} className="px-4 py-3">
                                <p className="text-xs font-bold text-slate-700">
                                    {entry.action}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {entry.detail}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {formatDate(entry.createdAt)} ·{" "}
                                    {entry.actorName}
                                </p>
                            </div>
                        ))}
                </div>
            </SectionCard>
        </div>
    );
}
function PersonProfileDetailDrawer({
    row,
    onClose,
}: {
    row: ReturnType<typeof buildCompetencyProfiles>[number] | null;
    onClose: () => void;
}) {
    if (!row) return null;
    return (
        <AppDrawer
            show
            title={`${row.person.fullName} · Competency Profile`}
            description={`${row.person.personType} · ${row.person.position} · ${row.person.department}`}
            onClose={onClose}
        >
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <PersonCell
                    person={row.person}
                    subtitle={
                        row.profile
                            ? `${row.profile.name} · v${row.profile.version}`
                            : "No active role profile"
                    }
                />
                <StatusBadge value={row.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MiniMetric label="Coverage" value={`${row.coverage}%`} />
                <MiniMetric
                    label="Meets / Exceeds"
                    value={row.meetsOrExceeds.toString()}
                />
                <MiniMetric label="Open Gaps" value={row.openGaps.toString()} />
                <MiniMetric
                    label="Not Assessed"
                    value={row.notAssessed.toString()}
                />
            </div>
            {!row.profile ? (
                <div className="mt-4">
                    <EmptyState
                        icon={FolderKanban}
                        title="Profile Not Assigned"
                        description="Create and activate a matching position, department, and person-type Role Profile."
                    />
                </div>
            ) : (
                <SectionCard
                    title="Current Requirements"
                    description="Latest validated levels and source assessments"
                    className="mt-4"
                >
                    <div className="divide-y divide-slate-100">
                        {row.requirements.map((detail) => (
                            <div key={detail.requirement.id} className="p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">
                                            {detail.competency?.code} ·{" "}
                                            {detail.competency?.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-slate-400">
                                            Required L
                                            {detail.requirement.requiredLevel} ·{" "}
                                            {proficiencyLabel(
                                                detail.requirement
                                                    .requiredLevel,
                                            )}
                                            {detail.requirement.critical
                                                ? " · Critical"
                                                : ""}
                                        </p>
                                    </div>
                                    <StatusBadge value={detail.result} />
                                </div>
                                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                                    <span>
                                        Validated current:{" "}
                                        {detail.currentLevel
                                            ? `L${detail.currentLevel} · ${proficiencyLabel(detail.currentLevel)}`
                                            : "Not Assessed"}
                                    </span>
                                    <span>Gap: {detail.gap ?? "—"}</span>
                                    <span>
                                        Evidence: {detail.evidenceCount}
                                    </span>
                                    <span>
                                        Source:{" "}
                                        {detail.sourceAssessment?.id ?? "—"}
                                    </span>
                                    <span>
                                        Last assessed:{" "}
                                        {formatDate(detail.lastAssessed)}
                                    </span>
                                    <span>
                                        Valid / reassess:{" "}
                                        {formatDate(detail.validUntil)}
                                    </span>
                                </div>
                                {detail.recommendations.length > 0 && (
                                    <div className="mt-3 rounded-lg bg-sky-50 p-3">
                                        <p className="text-xs font-bold text-sky-800">
                                            Linked development recommendations
                                        </p>
                                        {detail.recommendations.map((item) => (
                                            <p
                                                key={item.id}
                                                className="mt-1 text-xs text-sky-700"
                                            >
                                                {item.type} · {item.title} ·{" "}
                                                {item.status}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </AppDrawer>
    );
}
function MiniMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-lg font-bold text-slate-800">{value}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
                {label}
            </p>
        </div>
    );
}
function GapDetailDrawer({
    gap,
    state,
    blocked,
    onClose,
    onRecommend,
    onEditNote,
    onStatus,
}: {
    gap: GapRow | null;
    state: ReturnType<typeof useCompetencyStore>["state"];
    blocked: boolean;
    onClose: () => void;
    onRecommend: (gapId: string, type: RecommendationType) => void;
    onEditNote: (
        gapId: string,
        recommendation: DevelopmentRecommendation,
    ) => void;
    onStatus: (
        id: string,
        status: "Reviewed" | "Reassessment Requested",
    ) => void;
}) {
    if (!gap) return null;
    const recommendations = state.recommendations.filter(
        (item) =>
            item.personId === gap.person.id &&
            item.competencyId === gap.requirement.competencyId,
    );
    return (
        <AppDrawer
            show
            blocked={blocked}
            title={`${gap.competency?.name} · Competency Gap`}
            description={`${gap.person.fullName} · ${gap.profile.name}`}
            onClose={onClose}
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => onRecommend(gap.id, "Learning")}
                        className={primaryButtonClass}
                    >
                        Recommend Learning
                    </button>
                    <button
                        type="button"
                        onClick={() => onRecommend(gap.id, "Training")}
                        className={primaryButtonClass}
                    >
                        Recommend Training
                    </button>
                </>
            }
        >
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center justify-between gap-3">
                    <PersonCell
                        person={gap.person}
                        subtitle={`${gap.person.position} · ${gap.person.department}`}
                    />
                    <StatusBadge
                        value={
                            gap.requirement.critical
                                ? "Critical"
                                : "Below Requirement"
                        }
                    />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                    <MiniMetric
                        label="Current Level"
                        value={gap.currentLevel ? `L${gap.currentLevel}` : "—"}
                    />
                    <MiniMetric
                        label="Required Level"
                        value={`L${gap.requirement.requiredLevel}`}
                    />
                    <MiniMetric
                        label="Validated Gap"
                        value={gap.gap?.toString() ?? "—"}
                    />
                </div>
            </div>
            <SectionCard
                title="Assessment Source"
                description="A gap exists only because a finalized assessment validated a below-target level"
                className="mt-4"
            >
                <div className="p-4 text-xs text-slate-600">
                    <p>
                        <strong>Assessment:</strong> {gap.sourceAssessment?.id}
                    </p>
                    <p className="mt-1">
                        <strong>Last assessed:</strong>{" "}
                        {formatDate(gap.lastAssessed)}
                    </p>
                    <p className="mt-1">
                        <strong>Evidence items:</strong> {gap.evidenceCount}
                    </p>
                    <p className="mt-1">
                        <strong>Reassessment validity:</strong>{" "}
                        {formatDate(gap.validUntil)}
                    </p>
                </div>
            </SectionCard>
            <SectionCard
                title="Development Recommendations"
                description="Recommendations do not enroll, schedule, or close the gap"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {recommendations.map((item) => (
                        <div key={item.id} className="p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-bold text-slate-700">
                                        {item.type} · {item.title}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        {item.note}
                                    </p>
                                </div>
                                <StatusBadge value={item.status} />
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                                Created {formatDate(item.createdAt)} · Reassess{" "}
                                {formatDate(item.reassessmentDue)}
                                {item.status === "Reassessed"
                                    ? ` · Completed by ${item.reassessmentAssessmentId} on ${formatDate(item.reassessedAt)}`
                                    : ""}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onEditNote(gap.id, item)}
                                    className={secondaryButtonClass}
                                >
                                    Add / Edit Development Note
                                </button>
                                {item.status === "Recommended" && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onStatus(item.id, "Reviewed")
                                        }
                                        className={secondaryButtonClass}
                                    >
                                        Mark Recommendation Reviewed
                                    </button>
                                )}
                                {["Recommended", "Reviewed"].includes(
                                    item.status,
                                ) && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onStatus(
                                                item.id,
                                                "Reassessment Requested",
                                            )
                                        }
                                        className={primaryButtonClass}
                                    >
                                        Request Competency Reassessment
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {!recommendations.length && (
                        <EmptyState
                            icon={Wrench}
                            title="No development recommendation yet"
                            description="Recommend Learning or Training first. The receiving module owns enrollment or scheduling."
                        />
                    )}
                </div>
            </SectionCard>
            <SectionCard
                title="Development Audit History"
                description="Recommendation actions and reassessment outcomes"
                className="mt-4"
            >
                <div className="divide-y divide-slate-100">
                    {state.auditLog
                        .filter(
                            (entry) =>
                                entry.entityType === "Development" &&
                                recommendations.some(
                                    (item) => item.id === entry.entityId,
                                ),
                        )
                        .map((entry) => (
                            <div key={entry.id} className="px-4 py-3">
                                <p className="text-xs font-bold text-slate-700">
                                    {entry.action}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {entry.detail}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {formatDate(entry.createdAt)} ·{" "}
                                    {entry.actorName}
                                </p>
                            </div>
                        ))}
                </div>
            </SectionCard>
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800">
                <strong>Boundary:</strong> Course or training completion alone
                cannot close this gap. Only a new finalized Competency
                assessment at or above the required level can.
            </div>
        </AppDrawer>
    );
}
function ReopenAssessmentModal({
    assessment,
    state,
    actorId,
    actorName,
    onClose,
    onReopenCurrent,
    onCreateRevision,
}: {
    assessment: CompetencyAssessment | null;
    state: ReturnType<typeof useCompetencyStore>["state"];
    actorId: string;
    actorName: string;
    onClose: () => void;
    onReopenCurrent: (assessmentId: string, reason: string) => void;
    onCreateRevision: (
        assessmentId: string,
        cycleId: string,
        assessorId: string,
        reason: string,
    ) => void;
}) {
    const currentCycle = assessment
        ? (state.cycles.find((item) => item.id === assessment.cycleId) ?? null)
        : null;
    const person = assessment ? getPersonById(assessment.personId) : null;
    const profile = person ? findActiveProfileForPerson(state, person) : null;
    const activeCycleRevisionRequired = currentCycle?.status !== "Active";
    const eligibleCycles =
        person && profile
            ? state.cycles.filter(
                  (cycle) =>
                      cycle.status === "Active" &&
                      cyclePopulationMatches(cycle, person, profile) &&
                      !state.assessments.some(
                          (item) =>
                              item.personId === person.id &&
                              item.cycleId === cycle.id &&
                              item.roleProfileId === profile.id,
                      ),
              )
            : [];
    const [cycleId, setCycleId] = useState(eligibleCycles[0]?.id ?? "");
    const assessors =
        person && profile ? getAuthorizedAssessors(state, person, profile) : [];
    const [assessorId, setAssessorId] = useState("");
    const selectedRevisionCycle = eligibleCycles.find(
        (item) => item.id === cycleId,
    );
    const assessorResolution =
        person && profile && selectedRevisionCycle
            ? resolveAssessmentAssessor(
                  state,
                  selectedRevisionCycle,
                  person,
                  profile,
                  assessorId,
              )
            : null;
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    if (!assessment) return null;
    function submit() {
        if (!reason.trim()) {
            setError("A documented reason is required.");
            return;
        }
        if (activeCycleRevisionRequired) {
            if (!cycleId || !assessorResolution?.assessor) {
                setError(
                    assessorResolution?.error ??
                        "Select an eligible active cycle and resolve an authorized assessor.",
                );
                return;
            }
            onCreateRevision(
                assessment!.id,
                cycleId,
                assessorResolution.assessor.id,
                reason.trim(),
            );
        } else {
            onReopenCurrent(assessment!.id, reason.trim());
        }
    }
    return (
        <AppModal
            show
            title={
                activeCycleRevisionRequired
                    ? "Create Active-Cycle Reassessment"
                    : "Reopen Finalized Assessment"
            }
            description={
                activeCycleRevisionRequired
                    ? `The original ${currentCycle?.status ?? "unavailable"} cycle cannot accept revisions. Create a separate reassessment while preserving the original finalized record.`
                    : "The cycle is active, so a new immutable finalized version may be created on this assessment."
            }
            onClose={onClose}
            maxWidth="lg"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className={secondaryButtonClass}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        className={primaryButtonClass}
                    >
                        {activeCycleRevisionRequired
                            ? "Create Reassessment"
                            : "Reopen Assessment"}
                    </button>
                </>
            }
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                    {error}
                </div>
            )}
            <div className="space-y-4">
                <Field label="Original Assessment">
                    <input
                        value={`${assessment.id} · ${currentCycle?.name ?? assessment.cycleId} · ${currentCycle?.status ?? "Unknown"}`}
                        readOnly
                        className={controlClass}
                    />
                </Field>
                {activeCycleRevisionRequired && (
                    <>
                        <Field
                            label="Eligible Active Cycle"
                            required
                            hint={
                                eligibleCycles.length
                                    ? "Only cycles whose configured population contains this person and current role profile are listed."
                                    : "No compatible active cycle is available, or an assignment already exists there."
                            }
                        >
                            <select
                                value={cycleId}
                                onChange={(event) => {
                                    setCycleId(event.target.value);
                                    setAssessorId("");
                                }}
                                className={controlClass}
                            >
                                <option value="">Select active cycle</option>
                                {eligibleCycles.map((cycle) => (
                                    <option key={cycle.id} value={cycle.id}>
                                        {cycle.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        {selectedRevisionCycle?.assignmentMethod ===
                        "Manual Authorized Assignment" ? (
                            <Field
                                label="Authorized Assessor"
                                required
                                hint="Manual reassessment requires an explicit selection; no assessor is preselected."
                            >
                                <select
                                    value={assessorId}
                                    onChange={(event) =>
                                        setAssessorId(event.target.value)
                                    }
                                    className={controlClass}
                                >
                                    <option value="">
                                        Select authorized assessor
                                    </option>
                                    {assessors.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.fullName} · {item.position}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        ) : (
                            <Field
                                label="Resolved Assessor"
                                hint={
                                    assessorResolution?.error ??
                                    selectedRevisionCycle?.assignmentMethod
                                }
                            >
                                <input
                                    readOnly
                                    value={
                                        assessorResolution?.assessor
                                            ? `${assessorResolution.assessor.fullName} · ${assessorResolution.assessor.position}`
                                            : ""
                                    }
                                    className={controlClass}
                                />
                            </Field>
                        )}
                    </>
                )}
                <Field label="Reason" required>
                    <textarea
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className={controlClass}
                        placeholder="Document why a revision or reassessment is required."
                    />
                </Field>
                <p className="text-xs leading-4 text-slate-400">
                    Governance action by {actorName}
                    {actorId ? "" : " · current personnel identity unavailable"}
                    . Previous finalized versions remain immutable.
                </p>
            </div>
        </AppModal>
    );
}
function ReassignAssessmentModal({
    assessment,
    state,
    actorId,
    actorName,
    onClose,
    onSave,
}: {
    assessment: CompetencyAssessment | null;
    state: ReturnType<typeof useCompetencyStore>["state"];
    actorId: string;
    actorName: string;
    onClose: () => void;
    onSave: (assessmentId: string, assessorId: string, reason: string) => void;
}) {
    const [assessorId, setAssessorId] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    if (!assessment) return null;
    const assessmentId = assessment.id;
    const person = getPersonById(assessment.personId);
    const profile = state.roleProfiles.find(
        (item) => item.id === assessment.roleProfileId,
    );
    const assessors =
        person && profile
            ? getAuthorizedAssessors(state, person, profile).filter(
                  (item) =>
                      item.id !== assessment.assessorId &&
                      item.id !== person.id,
              )
            : [];
    function submit() {
        if (!assessorId || !reason.trim()) {
            setError("Select an authorized assessor and provide a reason.");
            return;
        }
        onSave(assessmentId, assessorId, reason.trim());
    }
    return (
        <AppModal
            show
            title="Reassign Authorized Assessor"
            description={`Governance action by ${actorName}${actorId ? "" : " · current personnel identity is unavailable"}.`}
            onClose={onClose}
            maxWidth="lg"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className={secondaryButtonClass}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        className={primaryButtonClass}
                    >
                        Confirm Reassignment
                    </button>
                </>
            }
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                    {error}
                </div>
            )}
            <div className="space-y-4">
                <Field label="Current Assessor">
                    <input
                        value={
                            getPersonById(assessment.assessorId)?.fullName ??
                            assessment.assessorId
                        }
                        readOnly
                        className={controlClass}
                    />
                </Field>
                <Field label="New Authorized Assessor" required>
                    <select
                        value={assessorId}
                        onChange={(event) => setAssessorId(event.target.value)}
                        className={controlClass}
                    >
                        <option value="">Select authorized assessor</option>
                        {assessors.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.fullName} · {item.position}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Reason" required>
                    <textarea
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className={controlClass}
                    />
                </Field>
            </div>
        </AppModal>
    );
}
