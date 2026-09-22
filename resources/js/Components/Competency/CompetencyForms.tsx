import SystemSelect from '@/Components/SystemSelect';
import {
    AppModal,
    controlClass,
    Field,
    primaryButtonClass,
    secondaryButtonClass,
    Toggle,
} from "@/Components/Competency/CompetencyUI";
import {
    ASSESSMENT_METHODS,
    ASSESSMENT_TYPES,
    COMPETENCY_CATEGORIES,
    EVIDENCE_TYPES,
    PROFICIENCY_LEVELS,
    type AssessmentCycle,
    type AssessmentEvidence,
    type AssessorAuthorization,
    type CompetencyDefinition,
    type CompetencyState,
    type DevelopmentRecommendation,
    type EvidenceRequirement,
    type ProficiencyLevel,
    type RecommendationType,
    type RoleProfile,
    type RoleRequirement,
    localDateValue,
    uniqueId,
} from "@/data/competency";
import {
    saveCompetencyRevision,
    saveRoleProfileRevision,
} from "@/data/competencyLifecycle";
import {
    assignmentDueDate,
    cyclePopulationMatches,
    getAuthorizedAssessors,
    resolveAssessmentAssessor,
    roleProfileIdentityKey,
} from "@/data/competencyCalculations";
import { SHARED_PERSONNEL } from "@/data/personnel";
import { competencyReferenceIds } from "@/data/competencyReferenceBasis";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

function currentDate(): string {
    return localDateValue();
}

export function CompetencyForm({
    show,
    existing,
    duplicate,
    nextCode,
    actorName,
    existingNames,
    onClose,
    onSave,
}: {
    show: boolean;
    existing: CompetencyDefinition | null;
    duplicate?: boolean;
    nextCode: string;
    actorName: string;
    existingNames: string[];
    onClose: () => void;
    onSave: (competency: CompetencyDefinition) => void;
}) {
    const source = existing;
    const [name, setName] = useState(
        source ? `${source.name}${duplicate ? " Copy" : ""}` : "",
    );
    const [category, setCategory] = useState(
        source?.category ?? COMPETENCY_CATEGORIES[0],
    );
    const [definition, setDefinition] = useState(source?.definition ?? "");
    const [behavioralIndicators, setBehavioralIndicators] = useState<
        Record<ProficiencyLevel, string>
    >(source?.behavioralIndicators ?? { 1: "", 2: "", 3: "", 4: "", 5: "" });
    const [assessmentMethods, setAssessmentMethods] = useState(
        source?.assessmentMethods ?? [],
    );
    const [requiredEvidenceTypes, setRequiredEvidenceTypes] = useState(
        source?.requiredEvidenceTypes ?? [],
    );
    const [reassessmentInterval, setReassessmentInterval] = useState(
        source?.reassessmentIntervalMonths?.toString() ?? "",
    );
    const status = "Draft" as const;
    const [error, setError] = useState("");

    function toggleMethod(method: (typeof ASSESSMENT_METHODS)[number]) {
        setAssessmentMethods((items) =>
            items.includes(method)
                ? items.filter((item) => item !== method)
                : [...items, method],
        );
    }

    function toggleEvidence(type: (typeof EVIDENCE_TYPES)[number]) {
        setRequiredEvidenceTypes((items) =>
            items.includes(type)
                ? items.filter((item) => item !== type)
                : [...items, type],
        );
    }

    function submit() {
        const trimmed = name.trim();
        if (!trimmed || !definition.trim()) {
            setError("Competency name and definition are required.");
            return;
        }
        if (
            existingNames.some(
                (item) =>
                    item.toLowerCase() === trimmed.toLowerCase() &&
                    (!source ||
                        item.toLowerCase() !== source.name.toLowerCase() ||
                        duplicate),
            )
        ) {
            setError("A competency with this name already exists.");
            return;
        }
        if (Object.values(behavioralIndicators).some((item) => !item.trim())) {
            setError(
                "Behavioral indicators are required for all five proficiency levels.",
            );
            return;
        }
        if (!assessmentMethods.length) {
            setError("Select at least one accepted assessment method.");
            return;
        }
        const today = currentDate();
        const nextCompetency = saveCompetencyRevision(source, {
            name: trimmed,
            category,
            definition: definition.trim(),
            behavioralIndicators,
            assessmentMethods,
            requiredEvidenceTypes,
            reassessmentIntervalMonths: reassessmentInterval
                ? Number(reassessmentInterval)
                : null,
            status,
        }, { code: nextCode, actor: actorName, changedAt: today, duplicate });
        onSave(nextCompetency);
    }

    return (
        <AppModal
            show={show}
            onClose={onClose}
            title={
                source && !duplicate
                    ? "Edit Competency"
                    : duplicate
                      ? "Duplicate Competency"
                      : "Add Competency"
            }
            description="The library defines the competency only. Position-specific required levels belong in Role Profiles."
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
                        Save Draft
                    </button>
                </>
            }
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                    {error}
                </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <Field
                    label="Competency Code"
                    hint="Auto-generated and read-only."
                >
                    <input
                        value={source && !duplicate ? source.code : nextCode}
                        readOnly
                        className={controlClass}
                    />
                </Field>
                <Field label="Status" hint="Publishing is a separate explicit action after the Draft is saved.">
                    <input value="Draft" readOnly className={controlClass} />
                </Field>
                <Field label="Competency Name" required>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className={controlClass}
                        placeholder="e.g. Equipment Inspection"
                    />
                </Field>
                <Field label="Category" required>
                    <SystemSelect
                        value={category}
                        onChange={(event) =>
                            setCategory(event.target.value as typeof category)
                        }
                        className={controlClass}
                    >
                        {COMPETENCY_CATEGORIES.map((item) => (
                            <option key={item}>{item}</option>
                        ))}
                    </SystemSelect>
                </Field>
                <div className="sm:col-span-2">
                    <Field label="Definition" required>
                        <textarea
                            rows={3}
                            value={definition}
                            onChange={(event) =>
                                setDefinition(event.target.value)
                            }
                            className={controlClass}
                        />
                    </Field>
                </div>
            </div>
            <div className="mt-5">
                <h3 className="text-xs font-bold text-slate-800">
                    Behavioral indicators
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                    Describe directly observable behavior at each official
                    proficiency level.
                </p>
                <div className="mt-3 space-y-3">
                    {PROFICIENCY_LEVELS.map((level) => (
                        <Field
                            key={level.value}
                            label={`Level ${level.value} — ${level.label}`}
                            required
                        >
                            <textarea
                                rows={2}
                                value={behavioralIndicators[level.value]}
                                onChange={(event) =>
                                    setBehavioralIndicators((items) => ({
                                        ...items,
                                        [level.value]: event.target.value,
                                    }))
                                }
                                className={controlClass}
                            />
                        </Field>
                    ))}
                </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                    <p className="mb-2 text-xs font-bold text-slate-600">
                        Accepted assessment methods *
                    </p>
                    <div className="space-y-2">
                        {ASSESSMENT_METHODS.map((method) => (
                            <label
                                key={method}
                                className="flex items-center gap-2 text-xs text-slate-600"
                            >
                                <input
                                    type="checkbox"
                                    checked={assessmentMethods.includes(method)}
                                    onChange={() => toggleMethod(method)}
                                    className="rounded border-slate-300 text-amber-500"
                                />
                                {method}
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="mb-2 text-xs font-bold text-slate-600">
                        Accepted evidence types
                    </p>
                    <div className="space-y-2">
                        {EVIDENCE_TYPES.map((type) => (
                            <label
                                key={type}
                                className="flex items-center gap-2 text-xs text-slate-600"
                            >
                                <input
                                    type="checkbox"
                                    checked={requiredEvidenceTypes.includes(
                                        type,
                                    )}
                                    onChange={() => toggleEvidence(type)}
                                    className="rounded border-slate-300 text-amber-500"
                                />
                                {type}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-5 max-w-xs">
                <Field
                    label="Default reassessment interval (months)"
                    hint="Optional; a Role Profile may override this value."
                >
                    <input
                        type="number"
                        min={1}
                        value={reassessmentInterval}
                        onChange={(event) =>
                            setReassessmentInterval(event.target.value)
                        }
                        className={controlClass}
                    />
                </Field>
            </div>
        </AppModal>
    );
}

export function RoleProfileForm({
    show,
    existing,
    state,
    actorName,
    onClose,
    onSave,
}: {
    show: boolean;
    existing: RoleProfile | null;
    state: CompetencyState;
    actorName: string;
    onClose: () => void;
    onSave: (profile: RoleProfile) => void;
}) {
    const roleContexts = useMemo(() => {
        const seen = new Map<string, { department: string; position: string; personTypes: Set<string> }>();
        SHARED_PERSONNEL.forEach((person) => {
            const key = `${person.department}::${person.position}`;
            const current = seen.get(key) ?? {
                department: person.department,
                position: person.position,
                personTypes: new Set<string>(),
            };
            current.personTypes.add(person.personType);
            seen.set(key, current);
        });
        return [...seen.values()].sort((a, b) =>
            a.department.localeCompare(b.department) || a.position.localeCompare(b.position),
        );
    }, []);
    const initialContext =
        roleContexts.find(
            (item) =>
                item.department === existing?.department &&
                item.position === existing?.position,
        ) ?? roleContexts[0];
    const [position, setPosition] = useState(existing?.position ?? initialContext?.position ?? "");
    const [department, setDepartment] = useState(existing?.department ?? initialContext?.department ?? "");
    const selectedContext = roleContexts.find(
        (item) => item.department === department && item.position === position,
    );
    const appliesTo = existing?.appliesTo ??
        (selectedContext?.personTypes.size === 1 && selectedContext.personTypes.has("Trainee")
            ? "Trainee"
            : selectedContext?.personTypes.has("Trainee") && selectedContext.personTypes.size > 1
              ? "Both"
              : "Employee");
    const generatedName = existing?.name ?? `${position} Competency Profile`;
    const [effectiveDate, setEffectiveDate] = useState(
        existing?.effectiveDate ?? currentDate(),
    );
    const status = "Draft" as const;
    const [requirements, setRequirements] = useState<RoleRequirement[]>(
        existing?.requirements.map((item) => ({ ...item })) ?? [],
    );
    const [error, setError] = useState("");

    function addRequirement() {
        const competency = state.competencies.find(
            (item) =>
                item.status === "Active" &&
                !requirements.some((req) => req.competencyId === item.id),
        );
        if (!competency) return;
        setRequirements((items) => [
            ...items,
            {
                id: uniqueId("req"),
                competencyId: competency.id,
                requiredLevel: 3,
                critical: false,
                evidenceRequirement: "Optional",
                reassessmentIntervalMonths:
                    competency.reassessmentIntervalMonths,
                notes: "",
            },
        ]);
    }

    function updateRequirement(id: string, patch: Partial<RoleRequirement>) {
        setRequirements((items) =>
            items.map((item) => {
                if (item.id !== id) return item;
                const next = { ...item, ...patch };
                if (patch.competencyId) {
                    const competency = state.competencies.find(
                        (candidate) => candidate.id === patch.competencyId,
                    );
                    next.reassessmentIntervalMonths = competency?.reassessmentIntervalMonths ?? null;
                }
                return next;
            }),
        );
    }

    function submit() {
        if (!position || !department || !effectiveDate) {
            setError(
                "Position, department, and effective date are required.",
            );
            return;
        }
        if (!requirements.length) {
            setError("Add at least one competency requirement.");
            return;
        }
        if (
            new Set(requirements.map((item) => item.competencyId)).size !==
            requirements.length
        ) {
            setError("A competency can appear only once in a role profile.");
            return;
        }
        const nextIdentity = roleProfileIdentityKey({
            department,
            position,
            appliesTo,
        });
        const overlap = state.roleProfiles.find(
            (profile) =>
                profile.id !== existing?.id &&
                profile.id !== existing?.draftSourceId &&
                profile.status === "Active" &&
                roleProfileIdentityKey(profile) === nextIdentity,
        );
        if (overlap) {
            setError(
                `Only one active profile is allowed for this department, position, and person type. Conflict: ${overlap.name}.`,
            );
            return;
        }
        onSave(saveRoleProfileRevision(existing, {
            name: generatedName,
            position,
            department,
            appliesTo,
            requirements,
            effectiveDate,
            status,
        }, state.competencies, { actor: actorName, changedAt: currentDate() }));
    }

    const activeCompetencies = state.competencies.filter(
        (item) => item.status === "Active",
    );
    return (
        <AppModal
            show={show}
            onClose={onClose}
            title={existing ? "Edit Role Profile Draft" : "New Role Profile"}
            description="Role applicability is resolved from the canonical workforce source. Admin/HR governs requirements; employees are matched automatically by position, department, and person type."
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
                        Save Draft
                    </button>
                </>
            }
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                    {error}
                </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Profile Name" hint="System-generated from the canonical position; not assigned per employee.">
                    <input value={generatedName} readOnly className={controlClass} />
                </Field>
                <Field label="Status" hint="Publishing is a separate explicit action after the Draft is saved.">
                    <input value="Draft" readOnly className={controlClass} />
                </Field>
                <Field
                    label="Organizational Role"
                    required
                    hint="Only position + department combinations that exist in the canonical workforce source are available."
                >
                    <SystemSelect
                        disabled={Boolean(existing)}
                        value={`${department}::${position}`}
                        onChange={(event) => {
                            const [nextDepartment, nextPosition] = event.target.value.split("::");
                            setDepartment(nextDepartment);
                            setPosition(nextPosition);
                        }}
                        className={controlClass}
                    >
                        {roleContexts.map((item) => (
                            <option
                                key={`${item.department}::${item.position}`}
                                value={`${item.department}::${item.position}`}
                            >
                                {item.position} · {item.department}
                            </option>
                        ))}
                    </SystemSelect>
                </Field>
                <Field label="Department" hint="Derived from the selected canonical organizational role.">
                    <input value={department} readOnly className={controlClass} />
                </Field>
                <Field label="Applies To" hint="Derived from the canonical workforce person type.">
                    <input value={appliesTo} readOnly className={controlClass} />
                </Field>
                <Field label="Effective Date" required>
                    <input
                        type="date"
                        value={effectiveDate}
                        onChange={(event) =>
                            setEffectiveDate(event.target.value)
                        }
                        className={controlClass}
                    />
                </Field>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700">Governance / Reference Basis</p>
                <p className="mt-1 text-xs text-slate-500">
                    Data A governs the interim Competency Framework and Role Profile baseline through ALB-PND-GDL-014 and ALB-PND-REF-015.
                    Data B remains the canonical workforce source for position, department, and person type.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                        "ALB-PND-GDL-014",
                        "ALB-PND-REF-015",
                        ...new Set(
                            requirements.flatMap((requirement) => {
                                const competency = state.competencies.find((item) => item.id === requirement.competencyId);
                                return competency ? competencyReferenceIds[competency.code] ?? [] : [];
                            }),
                        ),
                    ].map((reference) => (
                        <span
                            key={reference}
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600"
                        >
                            {reference}
                        </span>
                    ))}
                </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-xs font-bold text-slate-800">
                        Competency requirements
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                        No duplicate competency is allowed inside one profile.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={addRequirement}
                    disabled={requirements.length >= activeCompetencies.length}
                    className={secondaryButtonClass}
                >
                    <Plus className="h-3.5 w-3.5" /> Add Requirement
                </button>
            </div>
            <div className="mt-3 space-y-3">
                {requirements.map((item) => (
                    <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                    >
                        <div className="grid gap-3 md:grid-cols-12">
                            <div className="md:col-span-4">
                                <Field label="Competency" required>
                                    <SystemSelect
                                        value={item.competencyId}
                                        onChange={(event) =>
                                            updateRequirement(item.id, {
                                                competencyId:
                                                    event.target.value,
                                            })
                                        }
                                        className={controlClass}
                                    >
                                        {activeCompetencies
                                            .filter(
                                                (comp) =>
                                                    comp.id ===
                                                        item.competencyId ||
                                                    !requirements.some(
                                                        (req) =>
                                                            req.competencyId ===
                                                            comp.id,
                                                    ),
                                            )
                                            .map((comp) => (
                                                <option
                                                    key={comp.id}
                                                    value={comp.id}
                                                >
                                                    {comp.code} · {comp.name}
                                                </option>
                                            ))}
                                    </SystemSelect>
                                </Field>
                            </div>
                            <div className="md:col-span-2">
                                <Field label="Required Level" required>
                                    <SystemSelect
                                        value={item.requiredLevel}
                                        onChange={(event) =>
                                            updateRequirement(item.id, {
                                                requiredLevel: Number(
                                                    event.target.value,
                                                ) as ProficiencyLevel,
                                            })
                                        }
                                        className={controlClass}
                                    >
                                        {PROFICIENCY_LEVELS.map((level) => (
                                            <option
                                                key={level.value}
                                                value={level.value}
                                            >
                                                {level.value} — {level.label}
                                            </option>
                                        ))}
                                    </SystemSelect>
                                </Field>
                            </div>
                            <div className="md:col-span-2">
                                <Field label="Evidence">
                                    <SystemSelect
                                        value={item.evidenceRequirement}
                                        onChange={(event) =>
                                            updateRequirement(item.id, {
                                                evidenceRequirement: event
                                                    .target
                                                    .value as EvidenceRequirement,
                                            })
                                        }
                                        className={controlClass}
                                    >
                                        <option>None</option>
                                        <option>Optional</option>
                                        <option>Required</option>
                                    </SystemSelect>
                                </Field>
                            </div>
                            <div className="md:col-span-2">
                                <Field
                                    label="Reassess (months)"
                                    hint="Inherited automatically from the governed Competency Library definition."
                                >
                                    <input
                                        value={item.reassessmentIntervalMonths ?? "Not scheduled"}
                                        readOnly
                                        className={controlClass}
                                    />
                                </Field>
                            </div>
                            <div className="flex items-end gap-3 md:col-span-2">
                                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={item.critical}
                                        onChange={(event) =>
                                            updateRequirement(item.id, {
                                                critical: event.target.checked,
                                            })
                                        }
                                        className="rounded border-slate-300 text-amber-500"
                                    />{" "}
                                    Critical
                                </label>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setRequirements((items) =>
                                            items.filter(
                                                (req) => req.id !== item.id,
                                            ),
                                        )
                                    }
                                    className="mb-1.5 rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                                    aria-label="Remove requirement"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="md:col-span-12">
                                <Field label="Notes">
                                    <input
                                        value={item.notes}
                                        onChange={(event) =>
                                            updateRequirement(item.id, {
                                                notes: event.target.value,
                                            })
                                        }
                                        className={controlClass}
                                    />
                                </Field>
                            </div>
                        </div>
                    </div>
                ))}
                {!requirements.length && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                        Add the first competency requirement.
                    </div>
                )}
            </div>
        </AppModal>
    );
}

export function CycleForm({
    show,
    existing,
    state,
    actorName,
    onClose,
    onSave,
}: {
    show: boolean;
    existing: AssessmentCycle | null;
    state: CompetencyState;
    actorName: string;
    onClose: () => void;
    onSave: (cycle: AssessmentCycle) => void;
}) {
    const departments = [
        ...new Set(SHARED_PERSONNEL.map((person) => person.department)),
    ].sort();
    const positions = [
        ...new Set(SHARED_PERSONNEL.map((person) => person.position)),
    ].sort();
    const [name, setName] = useState(existing?.name ?? "");
    const [type, setType] = useState(existing?.type ?? ASSESSMENT_TYPES[0]);
    const [startDate, setStartDate] = useState(
        existing?.startDate ?? currentDate(),
    );
    const [endDate, setEndDate] = useState(existing?.endDate ?? "");
    const [appliesTo, setAppliesTo] = useState(existing?.appliesTo ?? "Both");
    const [selectedDepartments, setSelectedDepartments] = useState(
        existing?.departments ?? [],
    );
    const [selectedPositions, setSelectedPositions] = useState(
        existing?.positions ?? [],
    );
    const [roleProfileIds, setRoleProfileIds] = useState(
        existing?.roleProfileIds ?? [],
    );
    const [assignmentMethod, setAssignmentMethod] = useState(
        existing?.assignmentMethod ?? "Role-based Assessor",
    );
    const [roleBasedAssessorScope, setRoleBasedAssessorScope] = useState<
        AssessmentCycle["roleBasedAssessorScope"]
    >(existing?.roleBasedAssessorScope ?? "Department");
    const [roleBasedAssessorPositions, setRoleBasedAssessorPositions] =
        useState(existing?.roleBasedAssessorPositions ?? []);
    const [requireSelfAssessment, setRequireSelfAssessment] = useState(
        existing?.requireSelfAssessment ?? false,
    );
    const [requireSupportingEvidence, setRequireSupportingEvidence] = useState(
        existing?.requireSupportingEvidence ?? true,
    );
    const [requireHrValidation, setRequireHrValidation] = useState(
        existing?.requireHrValidation ?? true,
    );
    const [requireAcknowledgment, setRequireAcknowledgment] = useState(
        existing?.requireAcknowledgment ?? true,
    );
    const [dueDays, setDueDays] = useState(
        existing?.dueDaysAfterAssignment ?? 30,
    );
    const reassessmentRule =
        existing?.reassessmentRule ??
        "Follow the active role-profile/competency reassessment interval; Learning or Training completion does not close a competency gap without finalized reassessment.";
    const [status, setStatus] = useState(existing?.status ?? "Draft");
    const [error, setError] = useState("");
    const hasAssignments = Boolean(
        existing &&
            state.assessments.some(
                (assessment) => assessment.cycleId === existing.id,
            ),
    );
    const terminal = Boolean(
        existing && ["Closed", "Cancelled"].includes(existing.status),
    );
    const criticalLocked = hasAssignments || terminal;

    function toggle(
        list: string[],
        value: string,
        setter: (next: string[]) => void,
    ) {
        setter(
            list.includes(value)
                ? list.filter((item) => item !== value)
                : [...list, value],
        );
    }

    function submit() {
        if (!name.trim() || !startDate || !endDate) {
            setError("Cycle name and assessment window are required.");
            return;
        }
        if (startDate > endDate) {
            setError("Assessment end date must be on or after the start date.");
            return;
        }
        if (!roleProfileIds.length) {
            setError("Select at least one role profile.");
            return;
        }
        if (existing && hasAssignments && endDate < existing.endDate) {
            setError(
                "After assignments exist, the assessment end date can only be extended.",
            );
            return;
        }
        if (
            assignmentMethod === "Role-based Assessor" &&
            (!roleBasedAssessorScope || !roleBasedAssessorPositions.length)
        ) {
            setError(
                "Configure the exact authorization scope and eligible assessor positions for role-based assignment.",
            );
            return;
        }
        const locked = existing && criticalLocked ? existing : null;
        const now = currentDate();
        onSave({
            id: existing?.id ?? uniqueId("cycle"),
            name: name.trim(),
            type: locked?.type ?? type,
            startDate: locked?.startDate ?? startDate,
            endDate,
            appliesTo: locked?.appliesTo ?? appliesTo,
            departments: locked?.departments ?? selectedDepartments,
            positions: locked?.positions ?? selectedPositions,
            roleProfileIds: locked?.roleProfileIds ?? roleProfileIds,
            assignmentMethod: locked?.assignmentMethod ?? assignmentMethod,
            roleBasedAssessorScope:
                locked?.roleBasedAssessorScope ??
                (assignmentMethod === "Role-based Assessor"
                    ? roleBasedAssessorScope
                    : null),
            roleBasedAssessorPositions:
                locked?.roleBasedAssessorPositions ??
                (assignmentMethod === "Role-based Assessor"
                    ? roleBasedAssessorPositions
                    : []),
            requireSelfAssessment:
                locked?.requireSelfAssessment ?? requireSelfAssessment,
            requireSupportingEvidence:
                locked?.requireSupportingEvidence ?? requireSupportingEvidence,
            requireHrValidation:
                locked?.requireHrValidation ?? requireHrValidation,
            requireAcknowledgment:
                locked?.requireAcknowledgment ?? requireAcknowledgment,
            dueDaysAfterAssignment: locked?.dueDaysAfterAssignment ?? dueDays,
            reassessmentRule:
                locked?.reassessmentRule ?? reassessmentRule.trim(),
            autoAssign:
                locked?.autoAssign ??
                assignmentMethod !== "Manual Authorized Assignment",
            status,
            createdAt: existing?.createdAt ?? now,
            createdBy: existing?.createdBy ?? actorName,
            updatedAt: now,
            updatedBy: actorName,
            cancellationReason: existing?.cancellationReason ?? null,
            cancelledAt: existing?.cancelledAt ?? null,
        });
    }

    return (
        <AppModal
            show={show}
            onClose={onClose}
            title={
                existing ? "Edit Assessment Cycle" : "Create Assessment Cycle"
            }
            description="Configure the governed window. Scheduled cycles activate automatically on the start date, and eligible assignments are system-generated when an authorized assessor can be resolved."
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
                        Save Cycle
                    </button>
                </>
            }
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                    {error}
                </div>
            )}
            {criticalLocked && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    Critical rules are locked because assignments already exist
                    or the cycle is terminal. Only the name and a forward
                    extension of the end date remain editable.
                </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cycle Name" required>
                    <input
                        value={name}
                        disabled={terminal}
                        onChange={(event) => setName(event.target.value)}
                        className={controlClass}
                    />
                </Field>
                <Field label="Assessment Type" required>
                    <SystemSelect
                        disabled={criticalLocked}
                        value={type}
                        onChange={(event) =>
                            setType(event.target.value as typeof type)
                        }
                        className={controlClass}
                    >
                        {ASSESSMENT_TYPES.map((item) => (
                            <option key={item}>{item}</option>
                        ))}
                    </SystemSelect>
                </Field>
                <Field label="Assessment Window Start" required>
                    <input
                        type="date"
                        disabled={criticalLocked}
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className={controlClass}
                    />
                </Field>
                <Field
                    label="Assessment Window End"
                    required
                    hint={
                        hasAssignments
                            ? "Assignments exist; this date may be extended but not shortened."
                            : undefined
                    }
                >
                    <input
                        type="date"
                        min={hasAssignments ? existing?.endDate : undefined}
                        disabled={terminal}
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className={controlClass}
                    />
                </Field>
                <Field label="Applies To" required>
                    <SystemSelect
                        disabled={criticalLocked}
                        value={appliesTo}
                        onChange={(event) =>
                            setAppliesTo(event.target.value as typeof appliesTo)
                        }
                        className={controlClass}
                    >
                        <option>Employee</option>
                        <option>Trainee</option>
                        <option>Both</option>
                    </SystemSelect>
                </Field>
                <Field label="Assignment Method" required hint="Use deterministic reporting/role-based assignment normally. Exceptional authorized assignment is only for cases where the canonical workforce source has no valid automatic assessor path.">
                    <SystemSelect
                        disabled={criticalLocked}
                        value={assignmentMethod}
                        onChange={(event) =>
                            setAssignmentMethod(
                                event.target.value as typeof assignmentMethod,
                            )
                        }
                        className={controlClass}
                    >
                        <option>Reporting Relationship</option>
                        <option>Role-based Assessor</option>
                        <option value="Manual Authorized Assignment">Exceptional Authorized Assignment</option>
                    </SystemSelect>
                </Field>
                <Field label="Due days after assignment" required hint="The system caps each assignment due date at the cycle end date.">
                    <input
                        disabled={criticalLocked}
                        type="number"
                        min={1}
                        value={dueDays}
                        onChange={(event) =>
                            setDueDays(Number(event.target.value))
                        }
                        className={controlClass}
                    />
                </Field>
                <Field label="Status" required>
                    {existing ? (
                        <input
                            value={status}
                            readOnly
                            className={controlClass}
                        />
                    ) : (
                        <SystemSelect
                            value={status}
                            onChange={(event) =>
                                setStatus(event.target.value as typeof status)
                            }
                            className={controlClass}
                        >
                            <option>Draft</option>
                            <option>Scheduled</option>
                        </SystemSelect>
                    )}
                </Field>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
                <CheckboxGroup
                    disabled={criticalLocked}
                    title="Departments"
                    items={departments}
                    selected={selectedDepartments}
                    onToggle={(value) =>
                        toggle(
                            selectedDepartments,
                            value,
                            setSelectedDepartments,
                        )
                    }
                    emptyLabel="All departments"
                />
                <CheckboxGroup
                    disabled={criticalLocked}
                    title="Positions"
                    items={positions}
                    selected={selectedPositions}
                    onToggle={(value) =>
                        toggle(selectedPositions, value, setSelectedPositions)
                    }
                    emptyLabel="All matching positions"
                />
                <CheckboxGroup
                    disabled={criticalLocked}
                    title="Role Profiles *"
                    items={state.roleProfiles
                        .filter((item) => item.status === "Active")
                        .map((item) => item.id)}
                    selected={roleProfileIds}
                    onToggle={(value) =>
                        toggle(roleProfileIds, value, setRoleProfileIds)
                    }
                    labelFor={(id) =>
                        state.roleProfiles.find((item) => item.id === id)
                            ?.name ?? id
                    }
                />
            </div>
            {assignmentMethod === "Role-based Assessor" && (
                <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                    <Field
                        label="Required authorization scope"
                        required
                        hint="The authorization must match this exact scope for the assessed person/profile."
                    >
                        <SystemSelect
                            disabled={criticalLocked}
                            value={roleBasedAssessorScope ?? ""}
                            onChange={(event) =>
                                setRoleBasedAssessorScope(
                                    event.target.value as NonNullable<
                                        AssessmentCycle["roleBasedAssessorScope"]
                                    >,
                                )
                            }
                            className={controlClass}
                        >
                            <option value="Department">Department</option>
                            <option value="Position">Position</option>
                            <option value="Role Profile">Role Profile</option>
                        </SystemSelect>
                    </Field>
                    <CheckboxGroup
                        disabled={criticalLocked}
                        title="Eligible assessor positions *"
                        items={positions}
                        selected={roleBasedAssessorPositions}
                        onToggle={(value) =>
                            toggle(
                                roleBasedAssessorPositions,
                                value,
                                setRoleBasedAssessorPositions,
                            )
                        }
                    />
                </div>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Toggle
                    disabled={criticalLocked}
                    checked={requireSelfAssessment}
                    onChange={setRequireSelfAssessment}
                    label="Require self-assessment"
                    description="Self-input remains separate and cannot become the official level."
                />
                <Toggle
                    disabled={criticalLocked}
                    checked={requireSupportingEvidence}
                    onChange={setRequireSupportingEvidence}
                    label="Require supporting evidence"
                    description="When enabled, every competency requires evidence. Critical requirements always require evidence."
                />
                <Toggle
                    disabled={criticalLocked}
                    checked={requireHrValidation}
                    onChange={setRequireHrValidation}
                    label="Require HR validation"
                    description="Submitted records wait for authorized validation when enabled. Critical competencies always require Admin/HR validation even if this toggle is off."
                />
                <Toggle
                    disabled={criticalLocked}
                    checked={requireAcknowledgment}
                    onChange={setRequireAcknowledgment}
                    label="Require employee acknowledgment"
                    description="Acknowledgment records receipt, not agreement."
                />
            </div>
            <div className="mt-4">
                <Field
                    label="Reassessment Rules"
                    hint="System-governed from the active Role Profile and Competency Library intervals."
                >
                    <textarea
                        rows={3}
                        value={reassessmentRule}
                        readOnly
                        className={controlClass}
                    />
                </Field>
            </div>
        </AppModal>
    );
}

function CheckboxGroup({
    title,
    items,
    selected,
    onToggle,
    emptyLabel,
    labelFor = (value) => value,
    disabled = false,
}: {
    title: string;
    items: string[];
    selected: string[];
    onToggle: (value: string) => void;
    emptyLabel?: string;
    labelFor?: (value: string) => string;
    disabled?: boolean;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-bold text-slate-600">{title}</p>
            <div
                className={`max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 ${disabled ? "bg-slate-50" : "bg-white"}`}
            >
                {items.map((item) => (
                    <label
                        key={item}
                        className="flex items-start gap-2 text-xs leading-4 text-slate-600"
                    >
                        <input
                            disabled={disabled}
                            type="checkbox"
                            checked={selected.includes(item)}
                            onChange={() => onToggle(item)}
                            className="mt-0.5 rounded border-slate-300 bg-white text-amber-500 [color-scheme:light] disabled:bg-slate-100 disabled:opacity-100"
                        />
                        <span>{labelFor(item)}</span>
                    </label>
                ))}
                {emptyLabel && selected.length === 0 && (
                    <p className="text-xs italic text-slate-400">
                        {emptyLabel}
                    </p>
                )}
            </div>
        </div>
    );
}

export function AssessmentAssignmentForm({
    show,
    state,
    actorName,
    initialCycleId,
    onClose,
    onSave,
}: {
    show: boolean;
    state: CompetencyState;
    actorName: string;
    initialCycleId?: string | null;
    onClose: () => void;
    onSave: (
        personId: string,
        profileId: string,
        cycleId: string,
        assessorId: string,
        dueDate: string,
    ) => void;
}) {
    const availableCycles = state.cycles.filter((item) =>
        ["Scheduled", "Active"].includes(item.status),
    );
    const initialCycle =
        availableCycles.find((item) => item.id === initialCycleId) ??
        availableCycles.find((item) => item.status === "Active") ??
        availableCycles[0] ??
        null;
    const [cycleId, setCycleId] = useState(initialCycle?.id ?? "");
    const [personId, setPersonId] = useState("");
    const [profileId, setProfileId] = useState("");
    const [assessorId, setAssessorId] = useState("");
    const [dueDate, setDueDate] = useState(
        initialCycle ? assignmentDueDate(initialCycle) : "",
    );
    const [error, setError] = useState("");
    const cycle = state.cycles.find((item) => item.id === cycleId) ?? null;
    const person = SHARED_PERSONNEL.find((item) => item.id === personId);
    const eligiblePeople = cycle
        ? SHARED_PERSONNEL.filter((candidate) =>
              state.roleProfiles.some((candidateProfile) =>
                  cyclePopulationMatches(cycle, candidate, candidateProfile),
              ),
          )
        : [];
    const profiles = state.roleProfiles.filter((profile) =>
        Boolean(
            cycle && person && cyclePopulationMatches(cycle, person, profile),
        ),
    );
    const profile = state.roleProfiles.find((item) => item.id === profileId);
    const assessors =
        person && profile ? getAuthorizedAssessors(state, person, profile) : [];
    const resolution =
        cycle && person && profile
            ? resolveAssessmentAssessor(
                  state,
                  cycle,
                  person,
                  profile,
                  assessorId,
              )
            : null;

    function submit() {
        if (!cycle || !person || !profile || !dueDate) {
            setError("Cycle, person, role profile, and due date are required.");
            return;
        }
        if (!["Scheduled", "Active"].includes(cycle.status)) {
            setError(
                "Manual assignments can be created only for a Scheduled or Active cycle.",
            );
            return;
        }
        if (!cyclePopulationMatches(cycle, person, profile)) {
            setError(
                "This person and role profile are outside the selected cycle population.",
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
            setError(
                "A matching person, cycle, and role-profile assessment already exists.",
            );
            return;
        }
        if (!resolution?.assessor) {
            setError(resolution?.error ?? "An assessor could not be resolved.");
            return;
        }
        onSave(personId, profileId, cycleId, resolution.assessor.id, dueDate);
    }

    return (
        <AppModal
            show={show}
            onClose={onClose}
            title="Create Exception Assessment Assignment"
            description={`Exception-only governance action by ${actorName}. Normal cycle assignments are generated automatically; use this only when an authorized manual path is required.`}
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
                        Create Exception Assignment
                    </button>
                </>
            }
            maxWidth="lg"
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                    {error}
                </div>
            )}
            <div className="space-y-4">
                <Field
                    label="Assessment Cycle"
                    required
                    hint={
                        availableCycles.length
                            ? "Only people inside this cycle’s configured population can be selected."
                            : "No Scheduled or Active cycle is available."
                    }
                >
                    <SystemSelect
                        value={cycleId}
                        onChange={(event) => {
                            const nextCycle = state.cycles.find(
                                (item) => item.id === event.target.value,
                            );
                            setCycleId(event.target.value);
                            setPersonId("");
                            setProfileId("");
                            setAssessorId("");
                            setDueDate(
                                nextCycle
                                    ? assignmentDueDate(nextCycle)
                                    : "",
                            );
                            setError("");
                        }}
                        className={controlClass}
                    >
                        <option value="">Select cycle</option>
                        {availableCycles.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} · {item.status}
                            </option>
                        ))}
                    </SystemSelect>
                </Field>
                <Field
                    label="Person"
                    required
                    hint={
                        cycle && !eligiblePeople.length
                            ? "No centralized personnel record matches this cycle population."
                            : undefined
                    }
                >
                    <SystemSelect
                        value={personId}
                        onChange={(event) => {
                            setPersonId(event.target.value);
                            setProfileId("");
                            setAssessorId("");
                            setError("");
                        }}
                        className={controlClass}
                    >
                        <option value="">Select eligible person</option>
                        {eligiblePeople.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.fullName} · {item.personType} ·{" "}
                                {item.position}
                            </option>
                        ))}
                    </SystemSelect>
                </Field>
                <Field
                    label="Role Profile"
                    required
                    hint={
                        person && !profiles.length
                            ? "No active role profile matches this person."
                            : undefined
                    }
                >
                    <SystemSelect
                        value={profileId}
                        onChange={(event) => {
                            setProfileId(event.target.value);
                            setAssessorId("");
                        }}
                        className={controlClass}
                    >
                        <option value="">Select matching profile</option>
                        {profiles.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} · v{item.version}
                            </option>
                        ))}
                    </SystemSelect>
                </Field>
                {cycle?.assignmentMethod === "Manual Authorized Assignment" ? (
                    <Field
                        label="Authorized Assessor"
                        required
                        hint={
                            person && profile && !assessors.length
                                ? "No active authorization covers this person and role profile."
                                : "Manual assignment requires an explicit selection; no assessor is preselected."
                        }
                    >
                        <SystemSelect
                            value={assessorId}
                            onChange={(event) =>
                                setAssessorId(event.target.value)
                            }
                            className={controlClass}
                        >
                            <option value="">Select authorized assessor</option>
                            {assessors.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.fullName} · {item.position}
                                </option>
                            ))}
                        </SystemSelect>
                    </Field>
                ) : (
                    <Field
                        label="Resolved Assessor"
                        hint={
                            resolution?.error ??
                            (cycle
                                ? `${cycle.assignmentMethod} rules determine this read-only value.`
                                : undefined)
                        }
                    >
                        <input
                            readOnly
                            value={
                                resolution?.assessor
                                    ? `${resolution.assessor.fullName} · ${resolution.assessor.position}`
                                    : ""
                            }
                            className={controlClass}
                            placeholder="Select a person and role profile to resolve"
                        />
                    </Field>
                )}
                <Field
                    label="Due Date"
                    required
                    hint="System-owned: calculated from the cycle due rule and never later than the cycle end date."
                >
                    <input
                        type="date"
                        value={dueDate}
                        readOnly
                        className={controlClass}
                    />
                </Field>
            </div>
        </AppModal>
    );
}

export function EvidenceForm({
    show,
    competencyName,
    existing,
    allowedTypes,
    actorName,
    onClose,
    onSave,
}: {
    show: boolean;
    competencyName: string;
    existing?: AssessmentEvidence | null;
    allowedTypes: AssessmentEvidence["type"][];
    actorName: string;
    onClose: () => void;
    onSave: (evidence: AssessmentEvidence) => void;
}) {
    const [type, setType] = useState(
        existing?.type ?? allowedTypes[0] ?? EVIDENCE_TYPES[0],
    );
    const [title, setTitle] = useState(existing?.title ?? "");
    const [reference, setReference] = useState(existing?.reference ?? "");
    const [description, setDescription] = useState(existing?.description ?? "");
    const [verificationState, setVerificationState] = useState<
        AssessmentEvidence["verificationState"]
    >(existing?.verificationState ?? "Unverified");
    const [error, setError] = useState("");
    function submit() {
        if (!allowedTypes.length) {
            setError(
                "This competency snapshot does not accept any evidence types. Update the competency definition before creating a new assessment.",
            );
            return;
        }
        if (!allowedTypes.includes(type)) {
            setError(
                "Select an evidence type accepted by this assessment snapshot.",
            );
            return;
        }
        if (!title.trim() || !description.trim()) {
            setError("Evidence title and description are required.");
            return;
        }
        onSave({
            id: existing?.id ?? uniqueId("evidence"),
            type,
            title: title.trim(),
            reference: reference.trim(),
            description: description.trim(),
            addedAt: existing?.addedAt ?? currentDate(),
            addedBy: existing?.addedBy ?? actorName,
            verificationState,
            sourceContext: "Metadata or link reference",
        });
    }
    return (
        <AppModal
            show={show}
            onClose={onClose}
            title={
                existing
                    ? "Edit Assessment Evidence"
                    : "Add Assessment Evidence"
            }
            description={`${competencyName} · Records metadata or a link reference; it does not upload or verify a file.`}
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
                        {existing ? "Save Evidence" : "Add Evidence"}
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
                <Field
                    label="Evidence Type"
                    required
                    hint="Options come from the competency definition captured for this assessment."
                >
                    <SystemSelect
                        value={type}
                        onChange={(event) =>
                            setType(event.target.value as typeof type)
                        }
                        className={controlClass}
                    >
                        {allowedTypes.map((item) => (
                            <option key={item}>{item}</option>
                        ))}
                    </SystemSelect>
                </Field>
                <Field label="Evidence Title" required>
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className={controlClass}
                        placeholder="e.g. Site inspection observation"
                    />
                </Field>
                <Field label="Description" required>
                    <textarea
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className={controlClass}
                        placeholder="Describe what this reference supports."
                    />
                </Field>
                <Field
                    label="Reference / Link"
                    hint="Optional metadata or URL only; no file is uploaded here."
                >
                    <input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        className={controlClass}
                        placeholder="Document ID or https://…"
                    />
                </Field>
                <Field
                    label="Verification State"
                    hint="This is a recorded review state, not automatic verification."
                >
                    <SystemSelect
                        value={verificationState}
                        onChange={(event) =>
                            setVerificationState(
                                event.target
                                    .value as AssessmentEvidence["verificationState"],
                            )
                        }
                        className={controlClass}
                    >
                        <option>Unverified</option>
                        <option>Reviewed</option>
                        <option>Verified</option>
                    </SystemSelect>
                </Field>
            </div>
        </AppModal>
    );
}

export function RecommendationForm({
    show,
    type,
    gapLabel,
    existing,
    actorName,
    onClose,
    onSave,
}: {
    show: boolean;
    type: RecommendationType;
    gapLabel: string;
    existing?: DevelopmentRecommendation | null;
    actorName: string;
    onClose: () => void;
    onSave: (
        title: string,
        note: string,
        dueDate: string | null,
    ) => { ok: boolean; error?: string };
}) {
    const [title, setTitle] = useState(existing?.title ?? "");
    const [note, setNote] = useState(existing?.note ?? "");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const submissionInFlight = useRef(false);
    function submit() {
        if (submissionInFlight.current) return;
        if (!title.trim() || !note.trim()) {
            setError("Recommendation title and note are required.");
            return;
        }
        submissionInFlight.current = true;
        setSubmitting(true);
        setError("");
        const result = onSave(title.trim(), note.trim(), existing?.reassessmentDue ?? null);
        if (!result.ok) {
            submissionInFlight.current = false;
            setSubmitting(false);
            setError(result.error ?? "The recommendation could not be saved.");
        }
    }
    return (
        <AppModal
            show={show}
            onClose={onClose}
            title={`Recommend ${type}`}
            description={`${gapLabel} · Drafted by ${actorName}. This recommendation does not create enrollment or scheduling.`}
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
                        disabled={submitting}
                        className={primaryButtonClass}
                    >
                        {submitting ? "Saving…" : "Save Recommendation"}
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
                <Field label="Recommendation Title" required>
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className={controlClass}
                    />
                </Field>
                <Field label="Development Note" required>
                    <textarea
                        rows={4}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className={controlClass}
                    />
                </Field>
                <Field
                    label="Reassessment Timing"
                    hint="System-owned. After Learning/Training completion, the target date is calculated from the governed competency/profile reassessment interval. The gap closes only after finalized reassessment."
                >
                    <input
                        value={existing?.reassessmentDue ?? "Calculated after completion"}
                        readOnly
                        className={controlClass}
                    />
                </Field>
            </div>
        </AppModal>
    );
}

export function AssessorAuthorizationForm({
    show,
    state,
    actorName,
    onClose,
    onSave,
}: {
    show: boolean;
    state: CompetencyState;
    actorName: string;
    onClose: () => void;
    onSave: (authorization: AssessorAuthorization) => void;
}) {
    const [assessorId, setAssessorId] = useState("");
    const [scope, setScope] =
        useState<AssessorAuthorization["scope"]>("Department");
    const [scopeValue, setScopeValue] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const departments = useMemo(
        () =>
            [
                ...new Set(SHARED_PERSONNEL.map((item) => item.department)),
            ].sort(),
        [],
    );
    const positions = useMemo(
        () =>
            [...new Set(SHARED_PERSONNEL.map((item) => item.position))].sort(),
        [],
    );
    const scopeOptions =
        scope === "Department"
            ? departments
            : scope === "Position"
              ? positions
              : scope === "Role Profile"
                ? state.roleProfiles
                      .filter((item) => item.status === "Active")
                      .map((item) => item.id)
                : SHARED_PERSONNEL.map((item) => item.id);
    function submit() {
        if (!assessorId || !scopeValue || !reason.trim()) {
            setError(
                "Assessor, scope, scope value, and authorization reason are required.",
            );
            return;
        }
        if (scope === "Specific Person" && assessorId === scopeValue) {
            setError("Official self-assessment authority is not allowed.");
            return;
        }
        onSave({
            id: uniqueId("authorization"),
            assessorId,
            scope,
            scopeValue,
            active: true,
            reason: reason.trim(),
            authorizedAt: currentDate(),
            authorizedBy: actorName,
        });
    }
    const labelFor = (value: string) =>
        scope === "Role Profile"
            ? (state.roleProfiles.find((item) => item.id === value)?.name ??
              value)
            : scope === "Specific Person"
              ? (SHARED_PERSONNEL.find((item) => item.id === value)?.fullName ??
                value)
              : value;
    return (
        <AppModal
            show={show}
            onClose={onClose}
            title="Authorize Assessor"
            description="Evaluator capability is explicit and separate from Admin, HR, or User access roles."
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
                        Save Authorization
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
                <Field label="Assessor" required>
                    <SystemSelect
                        value={assessorId}
                        onChange={(event) => setAssessorId(event.target.value)}
                        className={controlClass}
                    >
                        <option value="">Select person</option>
                        {SHARED_PERSONNEL.filter(
                            (item) => item.employmentStatus === "Employee",
                        ).map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.fullName} · {item.position} ·{" "}
                                {item.accessRole}
                            </option>
                        ))}
                    </SystemSelect>
                </Field>
                <Field label="Authorization Scope" required>
                    <SystemSelect
                        value={scope}
                        onChange={(event) => {
                            setScope(event.target.value as typeof scope);
                            setScopeValue("");
                        }}
                        className={controlClass}
                    >
                        <option>Department</option>
                        <option>Position</option>
                        <option>Role Profile</option>
                        <option>Specific Person</option>
                    </SystemSelect>
                </Field>
                <Field label="Scope Value" required>
                    <SystemSelect
                        value={scopeValue}
                        onChange={(event) => setScopeValue(event.target.value)}
                        className={controlClass}
                    >
                        <option value="">Select scope</option>
                        {scopeOptions.map((item) => (
                            <option key={item} value={item}>
                                {labelFor(item)}
                            </option>
                        ))}
                    </SystemSelect>
                </Field>
                <Field label="Authorization Reason" required>
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
