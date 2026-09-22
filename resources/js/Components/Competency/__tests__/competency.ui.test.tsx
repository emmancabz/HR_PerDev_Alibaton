import AdminCompetency from "@/Pages/AdminCompetency";
import { RecommendationForm } from "@/Components/Competency/CompetencyForms";
import {
    AppDrawer,
    primaryButtonClass,
} from "@/Components/Competency/CompetencyUI";
import {
    createCompetencyInitialState,
    type CompetencyState,
    type DevelopmentRecommendation,
} from "@/data/competency";
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { BASE_8_IDENTITIES, GENERATED_IDENTITIES, replaceSharedPersonnel, type PersonnelIdentity } from "@/data/personnel";
import { encodeWorkspaceHash } from "@/workspaceNavigation";

const server = vi.hoisted(() => ({ state: null as CompetencyState | null, revision: 0, personnel: [] as PersonnelIdentity[] }));
function serverPayload() { return { state: server.state!, revision: server.revision, personnel: server.personnel, permissions: { govern: true }, actor: { databaseId: 1, personnelKey: 'user-1', name: 'Celso Ramirez', role: 'admin' } }; }
vi.mock('axios', () => ({ default: {
    isAxiosError: () => false,
    get: vi.fn(async () => ({ data: serverPayload() })),
    post: vi.fn(async (_url: string, input: { changes: { collection: string; record: { id: string } }[] }) => {
        const state = structuredClone(server.state!) as unknown as Record<string, { id: string }[]>;
        for (const change of input.changes) {
            state[change.collection] = [...state[change.collection].filter(row => row.id !== change.record.id), change.record];
        }
        server.state = state as unknown as CompetencyState;
        server.revision += 1;
        return { data: serverPayload() };
    }),
} }));

vi.mock("@inertiajs/react", () => ({
    Head: () => null,
    usePage: () => ({
        props: {
            canonicalPersonnel: server.personnel,
            competency: serverPayload(),
            auth: {
                user: {
                    name: "Celso Ramirez",
                    email: "celso.ramirez@alibaton.com",
                    role: "admin",
                    personnel_key: "user-1",
                },
            },
        },
    }),
}));

vi.mock("@/Layouts/AuthenticatedLayout", () => ({
    default: ({ children }: { children: ReactNode }) => (
        <main data-testid="authenticated-layout">{children}</main>
    ),
    HeaderActions: ({ children }: { children: ReactNode }) => <>{children}</>,
    HeaderFilters: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
    window.localStorage.clear();
    server.personnel = structuredClone([...BASE_8_IDENTITIES, ...GENERATED_IDENTITIES]);
    replaceSharedPersonnel(server.personnel);
    server.state = createCompetencyInitialState();
    server.revision = 0;
    window.location.hash = encodeWorkspaceHash("Overview");
});

afterEach(async () => {
    await waitFor(() => expect(screen.queryByText("Saving Competency changes…")).not.toBeInTheDocument());
    cleanup();
    vi.clearAllMocks();
});

function renderPage({ preserveStorage = false } = {}) {
    if (!preserveStorage) window.localStorage.clear();
    return render(<AdminCompetency />);
}

async function openHazardGap() {
    const user = userEvent.setup();
    window.location.hash = encodeWorkspaceHash("Development");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await screen.findByText("Development Needs");
    let row: HTMLTableRowElement | null | undefined;

    while (!row) {
        row = screen
            .queryAllByText("Hazard Identification")
            .map((label) => label.closest("tr"))
            .find((candidate) =>
                candidate?.textContent?.includes("Elaine Bautista"),
            );

        if (row) break;

        const next = screen.queryByRole("button", {
            name: "Next",
        }) as HTMLButtonElement | null;

        if (!next || next.disabled) break;
        await user.click(next);
    }
    if (!row) throw new Error("Expected Elaine Bautista's Hazard Identification gap row.");
    await user.click(row);
    const drawer = await screen.findByRole("dialog", {
        name: "Hazard Identification · Development Details",
    });
    return { user, drawer };
}

async function openRecommendation(type: "Learning" | "Training") {
    const context = await openHazardGap();
    await context.user.click(
        within(context.drawer).getByRole("button", {
            name: `Recommend ${type}`,
        }),
    );
    const modal = await screen.findByRole("dialog", {
        name: `Recommend ${type}`,
    });
    return { ...context, modal };
}

function recommendation(
    patch: Partial<DevelopmentRecommendation> = {},
): DevelopmentRecommendation {
    return {
        id: "recommendation-test",
        personId: "user-6",
        competencyId: "comp-hazard-identification",
        sourceAssessmentId: "assessment-active-6",
        type: "Learning",
        title: "Existing learning recommendation",
        note: "Existing development note",
        status: "Recommended",
        createdAt: "2026-08-12T09:00:00+08:00",
        createdBy: "Celso Ramirez",
        reviewedAt: null,
        reassessmentDue: "2026-10-15",
        reassessedAt: null,
        reassessmentAssessmentId: null,
        ...patch,
    };
}

function OverlayHarness() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <AppDrawer
                show
                blocked={open}
                title="Test competency gap"
                onClose={() => {}}
            >
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={primaryButtonClass}
                >
                    Open recommendation
                </button>
                <button type="button">Background drawer action</button>
            </AppDrawer>
            {open && (
                <RecommendationForm
                    show
                    type="Learning"
                    gapLabel="Test person · Test competency"
                    actorName="Celso Ramirez"
                    onClose={() => setOpen(false)}
                    onSave={() => ({ ok: true })}
                />
            )}
        </>
    );
}

describe("Competency UI interaction contract", () => {
    it("opens a validated competency gap in the standardized screen-level details modal", async () => {
        renderPage();
        const { drawer } = await openHazardGap();
        expect(drawer).toBeVisible();
        expect(drawer).toHaveAttribute("data-overlay-root", "modal");
        expect(drawer).toHaveClass("z-[60]");
        expect(drawer.querySelector('[data-overlay-part="panel"]')).toHaveClass("!max-w-[1040px]");
        expect(within(drawer).getByText("Assessment Source")).toBeVisible();
    });

    it("opens Recommend Learning above the standardized development details modal", async () => {
        renderPage();
        const { drawer, modal } = await openRecommendation("Learning");
        expect(drawer).toHaveClass("z-[60]");
        expect(modal).toHaveClass("z-[70]");
    });

    it("keeps recommendation content editable while reassessment timing stays system-owned", async () => {
        renderPage();
        const { user, modal } = await openRecommendation("Learning");
        const title = within(modal).getByLabelText(/^Recommendation Title/);
        const note = within(modal).getByLabelText(/^Development Note/);
        const timing = within(modal).getByLabelText(/^Reassessment Timing/);
        await user.type(title, "Safety refresher learning path");
        await user.type(note, "Learning Management may review this recommendation.");
        expect(title).toHaveValue("Safety refresher learning path");
        expect(note).toHaveValue("Learning Management may review this recommendation.");
        expect(title).toBeEnabled();
        expect(note).toBeEnabled();
        expect(timing).toHaveAttribute("readonly");
        expect(timing).toHaveValue("Calculated after completion");
    });

    it("shows required-field validation and keeps the modal open", async () => {
        renderPage();
        const { user, modal } = await openRecommendation("Learning");
        await user.click(
            within(modal).getByRole("button", { name: "Save Recommendation" }),
        );
        expect(
            within(modal).getByRole("alert"),
        ).toHaveTextContent("Recommendation title and note are required.");
        expect(modal).toBeVisible();
    });

    it("saves a Learning recommendation through the real page handler", async () => {
        renderPage();
        const { user, modal } = await openRecommendation("Learning");
        await user.type(
            within(modal).getByLabelText(/^Recommendation Title/),
            "Hazard awareness learning review",
        );
        await user.type(
            within(modal).getByLabelText(/^Development Note/),
            "Learning Management should review the proposed learning resources.",
        );
        await user.click(
            within(modal).getByRole("button", { name: "Save Recommendation" }),
        );
        await waitFor(() =>
            expect(
                screen.queryByRole("dialog", { name: "Recommend Learning" }),
            ).not.toBeInTheDocument(),
        );
        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
            "Learning recommendation sent for review",
        ));
    });

    it("shows the saved recommendation and audit entry in the still-open details modal", async () => {
        renderPage();
        const { user, drawer, modal } = await openRecommendation("Learning");
        await user.type(
            within(modal).getByLabelText(/^Recommendation Title/),
            "Drawer persistence learning plan",
        );
        await user.type(
            within(modal).getByLabelText(/^Development Note/),
            "Keep the competency gap drawer open after this save.",
        );
        await user.click(
            within(modal).getByRole("button", { name: "Save Recommendation" }),
        );
        await waitFor(() =>
            expect(
                within(drawer).getAllByText(/Drawer persistence learning plan/).length,
            ).toBeGreaterThan(0),
        );
        expect(within(drawer).getAllByText(/Drawer persistence learning plan/).length).toBeGreaterThan(0);
        expect(within(drawer).getAllByText("Recommended").length).toBeGreaterThan(0);
    });

    it("uses the same complete save flow for a Training recommendation", async () => {
        renderPage();
        const { user, drawer, modal } = await openRecommendation("Training");
        await user.type(
            within(modal).getByLabelText(/^Recommendation Title/),
            "Practical hazard identification session",
        );
        await user.type(
            within(modal).getByLabelText(/^Development Note/),
            "Training Management owns any later schedule.",
        );
        await user.click(
            within(modal).getByRole("button", { name: "Save Recommendation" }),
        );
        await waitFor(() =>
            expect(
                within(drawer).getAllByText(/Practical hazard identification session/).length,
            ).toBeGreaterThan(0),
        );
    });

    it("cancels without creating or modifying a recommendation", async () => {
        renderPage();
        await waitFor(() =>
            expect(server.state).not.toBeNull(),
        );
        const before = server.state!.recommendations.length;
        const { user, modal } = await openRecommendation("Learning");
        await user.type(
            within(modal).getByLabelText(/^Recommendation Title/),
            "Cancelled title",
        );
        await user.type(
            within(modal).getByLabelText(/^Development Note/),
            "Cancelled note",
        );
        await user.click(within(modal).getByRole("button", { name: "Cancel" }));
        const after = server.state!.recommendations.length;
        expect(after).toBe(before);
    });

    it("preserves sent recommendation content as immutable receiving-module history", async () => {
        renderPage();
        const { drawer } = await openHazardGap();
        expect(within(drawer).getByText(/Site Hazard Identification Practical Session/)).toBeVisible();
        expect(within(drawer).queryByRole("button", { name: "Add / Edit Development Note" })).not.toBeInTheDocument();
    });

    it("resets form state when the gap, type, or recommendation identity changes", async () => {
        const onSave = vi.fn(() => ({ ok: true }));
        const { rerender } = render(
            <RecommendationForm
                key="gap-a-Learning-new"
                show
                type="Learning"
                gapLabel="Gap A"
                actorName="Celso Ramirez"
                onClose={() => {}}
                onSave={onSave}
            />,
        );
        const user = userEvent.setup();
        await user.type(
            screen.getByLabelText(/^Recommendation Title/),
            "Unsaved stale title",
        );
        rerender(
            <RecommendationForm
                key="gap-b-Training-new"
                show
                type="Training"
                gapLabel="Gap B"
                actorName="Celso Ramirez"
                onClose={() => {}}
                onSave={onSave}
            />,
        );
        expect(screen.getByLabelText(/^Recommendation Title/)).toHaveValue("");
        expect(screen.getByLabelText(/^Development Note/)).toHaveValue("");
    });

    it("Escape closes only the topmost modal and restores focus to its opener", async () => {
        render(<OverlayHarness />);
        const user = userEvent.setup();
        const opener = screen.getByRole("button", { name: "Open recommendation" });
        await user.click(opener);
        expect(screen.getByRole("dialog", { name: "Recommend Learning" })).toBeVisible();
        await user.keyboard("{Escape}");
        await waitFor(() =>
            expect(
                screen.queryByRole("dialog", { name: "Recommend Learning" }),
            ).not.toBeInTheDocument(),
        );
        expect(screen.getByRole("dialog", { name: "Test competency gap" })).toBeVisible();
        expect(opener).toHaveFocus();
    });

    it("the modal backdrop closes only the modal", async () => {
        render(<OverlayHarness />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open recommendation" }));
        const modal = screen.getByRole("dialog", { name: "Recommend Learning" });
        const backdrop = modal.querySelector(".absolute.inset-0");
        if (!backdrop) throw new Error("Expected the modal backdrop.");
        fireEvent.mouseDown(backdrop);
        fireEvent.click(backdrop);
        await waitFor(() =>
            expect(
                screen.queryByRole("dialog", { name: "Recommend Learning" }),
            ).not.toBeInTheDocument(),
        );
        expect(screen.getByRole("dialog", { name: "Test competency gap" })).toBeVisible();
    });

    it("makes drawer controls inert while the child modal is open", async () => {
        render(<OverlayHarness />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open recommendation" }));
        const drawer = document.querySelector<HTMLElement>(
            '[data-overlay-root="drawer"]',
        );
        if (!drawer) throw new Error("Expected the blocked drawer root.");
        expect(drawer).toHaveAttribute("inert");
        expect(drawer).toHaveAttribute("aria-hidden", "true");
    });

    it("keeps the drawer open while users interact with modal fields", async () => {
        render(<OverlayHarness />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open recommendation" }));
        await user.type(
            screen.getByLabelText(/^Recommendation Title/),
            "Modal-only interaction",
        );
        expect(
            document.querySelector('[data-overlay-root="drawer"][inert]'),
        ).toBeInTheDocument();
    });

    it("hydrates a saved recommendation from the persistent server state", async () => {
        const first = renderPage();
        const { user, modal } = await openRecommendation("Learning");
        await user.type(
            within(modal).getByLabelText(/^Recommendation Title/),
            "Hydrated learning recommendation",
        );
        await user.type(
            within(modal).getByLabelText(/^Development Note/),
            "This recommendation must survive a store hydration.",
        );
        await user.click(
            within(modal).getByRole("button", { name: "Save Recommendation" }),
        );
        await waitFor(() =>
            expect(JSON.stringify(server.state)).toContain(
                "Hydrated learning recommendation",
            ),
        );
        first.unmount();
        renderPage({ preserveStorage: true });
        const hydrated = await openHazardGap();
        expect(
            within(hydrated.drawer).getAllByText(/Hydrated learning recommendation/).length,
        ).toBeGreaterThan(0);
    });

    it("prevents duplicate rapid recommendation submission", async () => {
        const onSave = vi.fn(() => ({ ok: true }));
        render(
            <RecommendationForm
                show
                type="Learning"
                gapLabel="Test gap"
                actorName="Celso Ramirez"
                onClose={() => {}}
                onSave={onSave}
            />,
        );
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/^Recommendation Title/), "One save");
        await user.type(screen.getByLabelText(/^Development Note/), "Submit once only");
        const save = screen.getByRole("button", { name: "Save Recommendation" });
        fireEvent.click(save);
        fireEvent.click(save);
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("renders only one primary Add Competency action in its workspace", async () => {
        renderPage();
        expect(
            screen.queryByRole("button", { name: "Add Competency" }),
        ).not.toBeInTheDocument();
        window.location.hash = encodeWorkspaceHash("Competency Framework");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        await screen.findByRole("heading", { name: "Competencies" });
        expect(
            screen.getAllByRole("button", { name: "Add Competency" }),
        ).toHaveLength(1);
    });

    it("uses the new People workspace for the canonical workforce competency table", async () => {
        renderPage();
        window.location.hash = encodeWorkspaceHash("People");
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        await screen.findByRole("heading", { name: "Workforce Competency Profiles" });
        expect(screen.getByText("Role Profile Coverage")).toBeInTheDocument();
    });

    it("makes every People summary card a real clickable drill-down filter", async () => {
        renderPage();
        const user = userEvent.setup();
        window.location.hash = encodeWorkspaceHash("People");
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        const heading = await screen.findByRole("heading", {
            name: "Workforce Competency Profiles",
        });
        const section = heading.closest("section");
        if (!section) throw new Error("Expected People table section.");

        const coverage = screen.getByRole("button", {
            name: /Role Profile Coverage/i,
        });
        const gaps = screen.getByRole("button", {
            name: /People with Gaps/i,
        });
        const incomplete = screen.getByRole("button", {
            name: /Assessment Incomplete/i,
        });
        const initialCount = within(section).getByText(/\d+ of \d+ people/).textContent;
        const coverageValue = coverage.textContent?.match(/(\d+)\/(\d+)/);
        if (!coverageValue) throw new Error("Expected Role Profile Coverage value.");
        const expectedCoverageCount = `${coverageValue[1]} of ${coverageValue[2]} people`;

        await user.click(gaps);
        expect(gaps).toHaveAttribute("aria-pressed", "true");
        expect(coverage).toHaveAttribute("aria-pressed", "false");
        await waitFor(() =>
            expect(within(section).getByText(/\d+ of \d+ people/).textContent).not.toBe(
                initialCount,
            ),
        );

        await user.click(incomplete);
        expect(incomplete).toHaveAttribute("aria-pressed", "true");
        expect(gaps).toHaveAttribute("aria-pressed", "false");

        await user.click(coverage);
        expect(coverage).toHaveAttribute("aria-pressed", "true");
        await waitFor(() =>
            expect(within(section).getByText(/\d+ of \d+ people/).textContent).toBe(
                expectedCoverageCount,
            ),
        );
    });

    it("opens People competency profiles in the standardized centered details modal", async () => {
        renderPage();
        const user = userEvent.setup();
        window.location.hash = encodeWorkspaceHash("People");
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        const heading = await screen.findByRole("heading", {
            name: "Workforce Competency Profiles",
        });
        const section = heading.closest("section");
        if (!section) throw new Error("Expected People table section.");

        const coverage = screen.getByRole("button", {
            name: /Role Profile Coverage/i,
        });
        await user.click(coverage);

        const personRow = within(section)
            .getAllByRole("button")
            .find((element) => element.tagName === "TR");
        if (!personRow) throw new Error("Expected a mapped clickable People row.");

        await user.click(personRow);
        expect(personRow).toHaveAttribute("aria-current", "true");

        const panel = await screen.findByRole("dialog", {
            name: /Competency Profile$/i,
        });

        expect(panel).toHaveAttribute("data-overlay-root", "modal");
        expect(panel).toHaveClass("z-[60]");
        expect(panel.querySelector('[data-overlay-part="panel"]')).toHaveClass("!max-w-[1040px]");
        expect(document.querySelector('[data-overlay-root="drawer"]')).toBeNull();
        expect(within(panel).getByText("Profile Information")).toBeInTheDocument();
        expect(within(panel).getByText("Competency Summary")).toBeInTheDocument();
        expect(within(panel).getByText("Current Requirements")).toBeInTheDocument();
        expect(
            within(panel).getByText(
                /Required levels come from the active Role Profile\. Validated levels come only from finalized Competency assessments\./i,
            ),
        ).toBeInTheDocument();

        await user.click(
            within(panel).getByRole("button", { name: "Close details" }),
        );
        expect(screen.queryByRole("dialog", { name: /Competency Profile$/i })).not.toBeInTheDocument();
    });

    it("renders Competencies and Role Requirements together without segmented tabs and keeps both details modals", async () => {
        renderPage();
        const user = userEvent.setup();
        window.location.hash = encodeWorkspaceHash("Competency Framework");
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        const competencyHeading = await screen.findByRole("heading", { name: "Competencies" });
        const competencySection = competencyHeading.closest("section");
        if (!competencySection) throw new Error("Expected Competencies section.");
        const communication = within(competencySection).getByText("Communication").closest("tr");
        if (!communication) throw new Error("Expected Communication competency row.");
        await user.click(communication);

        const competencyDetails = await screen.findByRole("dialog", {
            name: /CMP-001 · Communication/i,
        });
        expect(competencyDetails).toHaveAttribute("data-overlay-root", "modal");
        expect(competencyDetails).toHaveClass("z-[60]");
        expect(competencyDetails.querySelector('[data-overlay-part="panel"]')).toHaveClass("!max-w-[1040px]");
        await user.click(within(competencyDetails).getByRole("button", { name: "Close details" }));

        expect(
            screen.queryByRole("tab", { name: "Competencies" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("tab", { name: "Role Requirements" }),
        ).not.toBeInTheDocument();
        const roleHeading = await screen.findByRole("heading", { name: "Role Requirements" });
        const roleSection = roleHeading.closest("section");
        if (!roleSection) throw new Error("Expected Role Requirements section.");
        const roleRow = within(roleSection).getAllByRole("button").find((element) => element.tagName === "TR");
        if (!roleRow) throw new Error("Expected clickable Role Requirements row.");
        await user.click(roleRow);

        const profileDetails = await screen.findByRole("dialog");
        expect(profileDetails).toHaveAttribute("data-overlay-root", "modal");
        expect(profileDetails).toHaveClass("z-[60]");
        expect(profileDetails.querySelector('[data-overlay-part="panel"]')).toHaveClass("!max-w-[1040px]");
        expect(within(profileDetails).getByText("Current Workforce Impact")).toBeInTheDocument();
    });

    it("renders Assessment Queue and Cycles & Authority together without segmented tabs while keeping lifecycle automation system-managed", async () => {
        renderPage();
        const user = userEvent.setup();
        window.location.hash = encodeWorkspaceHash("Assessments");
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        await screen.findByRole("heading", { name: "Assessment Queue" });
        expect(
            screen.getByRole("button", { name: "Exception Assignment" }),
        ).toBeInTheDocument();

        expect(
            screen.queryByRole("tab", { name: "Assessment Queue" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("tab", { name: "Cycles & Authority" }),
        ).not.toBeInTheDocument();
        expect(
            await screen.findByRole("heading", {
                name: "Assignment Automation Exceptions",
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /Prepare Assignments/i }),
        ).not.toBeInTheDocument();

        const manage = screen.getAllByRole("button", { name: "View / Manage" })[0];
        await user.click(manage);
        expect(await screen.findByText("Lifecycle Automation")).toBeInTheDocument();
        const cycleDetails = screen.getByRole("dialog");
        expect(cycleDetails).toHaveAttribute("data-overlay-root", "modal");
        expect(cycleDetails).toHaveClass("z-[60]");
        expect(cycleDetails.querySelector('[data-overlay-part="panel"]')).toHaveClass("!max-w-[1040px]");
        expect(screen.getByText("Assignment Automation")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /^Activate$/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /Close Cycle/i }),
        ).not.toBeInTheDocument();
    });

    it("matches the finalized Performance KPI card sizing on Competency Overview", () => {
        renderPage();
        const coverageCard = screen.getByRole("button", { name: /Role Profile Coverage/i });
        expect(coverageCard).toHaveClass("min-h-[108px]", "p-3.5");
        expect(coverageCard.querySelector(".text-xl")).not.toBeNull();
        expect(coverageCard.querySelector(".text-2xl")).toBeNull();
    });

    it("renders a capability-first Overview instead of an assessment-operations dashboard", () => {
        renderPage();
        expect(screen.getByText("Role Profile Coverage")).toBeInTheDocument();
        expect(screen.getByText("Requirements Met")).toBeInTheDocument();
        expect(screen.getByText("People with Competency Gaps")).toBeInTheDocument();
        expect(screen.getAllByText("Assessment Incomplete").length).toBeGreaterThan(0);
        expect(screen.getByText("Workforce Capability Snapshot")).toBeInTheDocument();
        expect(screen.getByText("Role Profile Coverage by Department")).toBeInTheDocument();
        expect(screen.getByText("Competency Attention Queue")).toBeInTheDocument();
        expect(screen.getByText("Assessment & Reassessment Watch")).toBeInTheDocument();
        expect(screen.queryByText("Active cycle progress")).not.toBeInTheDocument();
        expect(screen.queryByText("Assessor workload")).not.toBeInTheDocument();
        expect(screen.queryByText("Quick actions")).not.toBeInTheDocument();
    });

    it("renders department role-profile coverage as a compact table without internal dataset labels", () => {
        renderPage();
        expect(screen.getByText("Role Profile Coverage by Department")).toBeInTheDocument();
        expect(screen.getByText("With Profile")).toBeInTheDocument();
        expect(screen.getByText("Missing")).toBeInTheDocument();
    });

    it("opens Competency Attention Queue details in a centered screen modal", async () => {
        renderPage();
        const user = userEvent.setup();
        const antonio = screen.getByText("Antonio Ruiz");
        const row = antonio.closest("tr");
        expect(row).not.toBeNull();

        await user.click(row!);

        const dialog = await screen.findByRole("dialog", {
            name: "Competency Details for Antonio Ruiz",
        });
        expect(dialog).toHaveClass("max-w-[1040px]", "max-h-[90vh]");
        expect(dialog.parentElement).toHaveClass("z-[60]");
        expect(within(dialog).getByText("Competency Summary")).toBeInTheDocument();
        expect(within(dialog).getByText("Capability Snapshot")).toBeInTheDocument();
        expect(within(dialog).getByText("Current Requirements")).toBeInTheDocument();
        expect(within(dialog).getByText(/Team Leadership/)).toBeInTheDocument();
        expect(row).toHaveAttribute("aria-current", "true");
        expect(document.querySelector('[data-overlay-root="drawer"]')).toBeNull();

        await user.click(
            within(dialog).getByRole("button", { name: "Close competency details" }),
        );
        expect(
            screen.queryByRole("dialog", {
                name: "Competency Details for Antonio Ruiz",
            }),
        ).not.toBeInTheDocument();
    });

    it("shows direct numbered pagination in the Competency Attention Queue", async () => {
        renderPage();
        const user = userEvent.setup();
        const pagination = screen.getByRole("navigation", { name: "Table pagination" });
        const pageTwo = within(pagination).getByRole("button", { name: "Go to page 2" });
        expect(pageTwo).toBeEnabled();
        await user.click(pageTwo);
        expect(pageTwo).toHaveAttribute("aria-current", "page");
    });

    it("opens the full People workspace directly from the generic Open People action", async () => {
        renderPage();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open People" }));

        expect(await screen.findByText("Workforce Competency Profiles")).toBeInTheDocument();
        expect(screen.queryByRole("dialog", { name: "Open People workspace?" })).not.toBeInTheDocument();
        expect(screen.getByText("35 of 35 people")).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: /Profile department/ })).toHaveValue("All");
    });

    it("opens People with the clicked department reflected in the visible filter state", async () => {
        renderPage();
        const user = userEvent.setup();
        const coverage = screen.getByText("Role Profile Coverage by Department").closest("section");
        if (!coverage) throw new Error("Expected department coverage section.");
        const administration = within(coverage).getByText("Administration").closest("tr");
        if (!administration) throw new Error("Expected Administration coverage row.");

        await user.click(administration);

        expect(await screen.findByText("Workforce Competency Profiles")).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: /Profile department/ })).toHaveValue("Administration");
        expect(screen.getByText("4 of 35 people")).toBeInTheDocument();
        expect(screen.queryByRole("dialog", { name: "Open People workspace?" })).not.toBeInTheDocument();
    });

    it("opens the selected People competency profile directly from reassessment context", async () => {
        renderPage();
        const user = userEvent.setup();
        const heading = screen.getByText("Validated capabilities due for reassessment");
        const panel = heading.parentElement?.parentElement;
        if (!panel) throw new Error("Expected reassessment panel.");
        const miguel = within(panel).getAllByText("Miguel Santos")[0];
        const rowButton = miguel.closest("button");
        if (!rowButton) throw new Error("Expected reassessment navigation row.");

        await user.click(rowButton);

        expect(await screen.findByText("Workforce Competency Profiles")).toBeInTheDocument();
        const profile = await screen.findByRole("dialog", {
            name: "Miguel Santos · Competency Profile",
        });
        expect(profile).toHaveClass("z-[60]");
        expect(profile.querySelector('[data-overlay-part="panel"]')).toHaveClass("!max-w-[1040px]");
        expect(screen.queryByRole("dialog", { name: "Open People workspace?" })).not.toBeInTheDocument();
    });

    it("opens Overview assessment records as a read-only preview and keeps finalization in Assessments", async () => {
        renderPage();
        const user = userEvent.setup();
        const watchHeading = screen.getByText("Assessment records requiring review");
        const watchPanel = watchHeading.parentElement?.parentElement;
        if (!watchPanel) throw new Error("Expected assessment review panel.");
        const jose = within(watchPanel).getByText("Jose Castillo");
        const rowButton = jose.closest("button");
        if (!rowButton) throw new Error("Expected Jose Castillo assessment preview button.");
        await user.click(rowButton);
        const preview = await screen.findByRole("dialog", {
            name: "Competency Assessment",
        });
        expect(preview).toHaveAttribute("data-overlay-root", "modal");
        expect(preview.querySelector('[data-overlay-part="panel"]')).toHaveClass("!max-w-[1040px]");
        expect(preview).toHaveClass("z-[60]");
        expect(preview.querySelector('[data-overlay-part="drawer-panel"]')).not.toBeInTheDocument();
        expect(within(preview).getByText("Read-only Overview preview")).toBeVisible();
        expect(within(preview).queryByRole("button", { name: "Finalize" })).not.toBeInTheDocument();
        expect(within(preview).getByRole("button", { name: "Open in Assessments" })).toBeEnabled();
    });

    it("keeps the two Overview capability cards aligned to the same stretched grid row", () => {
        renderPage();
        const snapshot = screen.getByText("Workforce Capability Snapshot").closest("section");
        const coverage = screen.getByText("Role Profile Coverage by Department").closest("section");
        expect(snapshot).not.toBeNull();
        expect(coverage).not.toBeNull();
        expect(snapshot?.parentElement?.parentElement).toHaveClass("items-stretch");
        expect(snapshot).toHaveClass("h-full");
        expect(coverage).toHaveClass("h-full");
    });
});
