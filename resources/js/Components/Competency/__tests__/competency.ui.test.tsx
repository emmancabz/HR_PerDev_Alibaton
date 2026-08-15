import AdminCompetency from "@/Pages/AdminCompetency";
import { RecommendationForm } from "@/Components/Competency/CompetencyForms";
import {
    AppDrawer,
    primaryButtonClass,
} from "@/Components/Competency/CompetencyUI";
import {
    COMPETENCY_STORAGE_KEY,
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

vi.mock("@inertiajs/react", () => ({
    Head: () => null,
    usePage: () => ({
        props: {
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
}));

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function renderPage({ preserveStorage = false } = {}) {
    if (!preserveStorage) window.localStorage.clear();
    return render(<AdminCompetency />);
}

async function openHazardGap() {
    const user = userEvent.setup();
    await user.click(
        screen.getByRole("button", { name: "Gap & Development" }),
    );
    const hazardLabels = await screen.findAllByText("Hazard Identification");
    const row = hazardLabels
        .map((label) => label.closest("tr"))
        .find((candidate) => candidate?.textContent?.includes("Elaine Bautista"));
    if (!row) throw new Error("Expected Elaine Bautista's Hazard Identification gap row.");
    await user.click(row);
    const drawer = await screen.findByRole("dialog", {
        name: "Hazard Identification · Competency Gap",
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
    it("opens a validated competency gap drawer from the real workspace table", async () => {
        renderPage();
        const { drawer } = await openHazardGap();
        expect(drawer).toBeVisible();
        expect(within(drawer).getByText("Assessment Source")).toBeVisible();
    });

    it("opens Recommend Learning on a higher overlay than its drawer", async () => {
        renderPage();
        const { drawer, modal } = await openRecommendation("Learning");
        expect(drawer).toHaveClass("z-[40]");
        expect(modal).toHaveClass("z-[70]");
    });

    it("keeps every recommendation field enabled and editable", async () => {
        renderPage();
        const { user, modal } = await openRecommendation("Learning");
        const title = within(modal).getByLabelText(/^Recommendation Title/);
        const note = within(modal).getByLabelText(/^Development Note/);
        const date = within(modal).getByLabelText(/^Target Reassessment Date/);
        await user.type(title, "Safety refresher learning path");
        await user.type(note, "Learning Management may review this recommendation.");
        await user.type(date, "2026-10-30");
        expect(title).toHaveValue("Safety refresher learning path");
        expect(note).toHaveValue("Learning Management may review this recommendation.");
        expect(date).toHaveValue("2026-10-30");
        expect(title).toBeEnabled();
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
        expect(screen.getByRole("status")).toHaveTextContent(
            "Learning recommendation saved",
        );
    });

    it("shows the saved recommendation and audit entry in the still-open drawer", async () => {
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
        expect(within(drawer).getByText("Development recommendation created")).toBeVisible();
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
            expect(window.localStorage.getItem(COMPETENCY_STORAGE_KEY)).not.toBeNull(),
        );
        const before = JSON.parse(
            window.localStorage.getItem(COMPETENCY_STORAGE_KEY) ?? "{}",
        ).recommendations.length;
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
        const after = JSON.parse(
            window.localStorage.getItem(COMPETENCY_STORAGE_KEY) ?? "{}",
        ).recommendations.length;
        expect(after).toBe(before);
    });

    it("preloads the correct existing recommendation for editing", async () => {
        renderPage();
        const { user, drawer } = await openHazardGap();
        const editButtons = within(drawer).getAllByRole("button", {
            name: "Add / Edit Development Note",
        });
        await user.click(editButtons[0]);
        const modal = await screen.findByRole("dialog", {
            name: "Recommend Training",
        });
        expect(within(modal).getByLabelText(/^Recommendation Title/)).toHaveValue(
            "Site Hazard Identification Practical Session",
        );
        expect(within(modal).getByLabelText(/^Development Note/)).toHaveValue(
            "Recommendation only; Training Management owns scheduling and completion.",
        );
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

    it("hydrates a saved recommendation from the isolated Competency store", async () => {
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
            expect(window.localStorage.getItem(COMPETENCY_STORAGE_KEY)).toContain(
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
        const user = userEvent.setup();
        expect(
            screen.queryByRole("button", { name: "Add Competency" }),
        ).not.toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "Competency Library" }),
        );
        expect(
            screen.getAllByRole("button", { name: "Add Competency" }),
        ).toHaveLength(1);
    });

    it("does not render percentages in Overview urgent active-cycle records", () => {
        renderPage();
        const heading = screen.getByText("Active cycle progress");
        const section = heading.closest("section");
        if (!section) throw new Error("Expected Active cycle progress section.");
        expect(section).not.toHaveTextContent(/\d+%/);
        expect(section.querySelector('[style*="width"]')).not.toBeInTheDocument();
    });
});
