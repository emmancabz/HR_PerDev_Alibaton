import {
    CompetencyForm,
    CycleForm,
    RecommendationForm,
    RoleProfileForm,
} from "@/Components/Competency/CompetencyForms";
import {
    AppDrawer,
    AppModal,
    primaryButtonClass,
} from "@/Components/Competency/CompetencyUI";
import {
    ASSESSMENT_METHODS,
    COMPETENCY_CATEGORIES,
    createCompetencyInitialState,
} from "@/data/competency";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

afterEach(() => cleanup());

function InteractiveModalHarness() {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [choice, setChoice] = useState("A");
    const [checked, setChecked] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                Open modal probe
            </button>
            <AppModal
                show={open}
                title="Modal probe"
                onClose={() => setOpen(false)}
                footer={<button type="button" onClick={() => setOpen(false)}>Save probe</button>}
            >
                <label>
                    Probe text
                    <input value={text} onChange={(event) => setText(event.target.value)} />
                </label>
                <label>
                    Probe select
                    <select value={choice} onChange={(event) => setChoice(event.target.value)}>
                        <option>A</option>
                        <option>B</option>
                    </select>
                </label>
                <label>
                    Probe checkbox
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setChecked(event.target.checked)}
                    />
                </label>
                <div className="h-[1200px]" aria-hidden="true" />
                <input aria-label="Final reachable field" />
            </AppModal>
        </>
    );
}

function DrawerModalHarness({ onDrawerAction }: { onDrawerAction: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <AppDrawer show blocked={open} title="Drawer probe" onClose={() => {}}>
                <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
                    Open drawer modal
                </button>
                <button type="button" onClick={onDrawerAction}>
                    Protected drawer action
                </button>
            </AppDrawer>
            {open && (
                <RecommendationForm
                    show
                    type="Learning"
                    gapLabel="Overlay regression gap"
                    actorName="Celso Ramirez"
                    onClose={() => setOpen(false)}
                    onSave={() => ({ ok: true })}
                />
            )}
        </>
    );
}

describe("Competency modal overlay regression", () => {
    it("places the complete panel above its backdrop in the body portal", async () => {
        render(<InteractiveModalHarness />);
        await userEvent.setup().click(screen.getByRole("button", { name: "Open modal probe" }));

        const dialog = screen.getByRole("dialog", { name: "Modal probe" });
        const backdrop = dialog.querySelector('[data-overlay-part="backdrop"]');
        const panel = dialog.querySelector('[data-overlay-part="panel"]');
        const body = dialog.querySelector('[data-overlay-part="scroll-body"]');
        if (!backdrop || !panel || !body) {
            throw new Error("Expected the modal backdrop, panel, and scroll body.");
        }

        expect(dialog.parentElement?.closest("body")).toBe(document.body);
        expect(dialog).toHaveClass("pointer-events-none");
        expect(backdrop).toHaveClass("z-0", "pointer-events-auto");
        expect(panel).toHaveClass("relative", "z-10", "pointer-events-auto");
        expect(panel).toContainElement(body as HTMLElement);
        expect(backdrop.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("keeps text, select, and checkbox controls genuinely editable", async () => {
        render(<InteractiveModalHarness />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open modal probe" }));

        const text = screen.getByLabelText("Probe text");
        const select = screen.getByLabelText("Probe select");
        const checkbox = screen.getByLabelText("Probe checkbox");
        await user.click(text);
        await user.type(text, "Interactive body");
        await user.selectOptions(select, "B");
        await user.click(checkbox);

        expect(checkbox).toHaveFocus();
        expect(text).toHaveValue("Interactive body");
        expect(select).toHaveValue("B");
        expect(checkbox).toBeChecked();
        expect(text).toBeEnabled();
    });

    it("keeps long-form bottom content inside the intended scroll body", async () => {
        render(<InteractiveModalHarness />);
        await userEvent.setup().click(screen.getByRole("button", { name: "Open modal probe" }));
        const body = screen
            .getByRole("dialog", { name: "Modal probe" })
            .querySelector('[data-overlay-part="scroll-body"]');
        expect(body).toHaveClass("overflow-y-auto", "overscroll-contain", "touch-pan-y");
        expect(body).toContainElement(screen.getByLabelText("Final reachable field"));
    });

    it("portals a drawer-launched modal outside the inert drawer subtree", async () => {
        render(<DrawerModalHarness onDrawerAction={() => {}} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open drawer modal" }));

        const drawer = document.querySelector<HTMLElement>(
            '[data-overlay-root="drawer"]',
        );
        if (!drawer) throw new Error("Expected the blocked drawer root.");
        const drawerPanel = drawer.querySelector('[data-overlay-part="drawer-panel"]');
        const modal = screen.getByRole("dialog", { name: "Recommend Learning" });
        const modalPanel = modal.querySelector('[data-overlay-part="panel"]');

        expect(drawer).toHaveAttribute("inert");
        expect(drawer).toHaveAttribute("aria-hidden", "true");
        expect(drawerPanel).not.toContainElement(modalPanel as HTMLElement);
        expect(modalPanel?.closest("[inert]")).toBeNull();
    });

    it("keeps drawer actions protected while its child modal is active", async () => {
        const onDrawerAction = vi.fn();
        render(<DrawerModalHarness onDrawerAction={onDrawerAction} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Open drawer modal" }));

        const drawer = document.querySelector<HTMLElement>(
            '[data-overlay-root="drawer"]',
        );
        if (!drawer) throw new Error("Expected the blocked drawer root.");
        expect(within(drawer).getByRole("button", { name: "Protected drawer action", hidden: true }).closest("[inert]")).not.toBeNull();
        expect(onDrawerAction).not.toHaveBeenCalled();
    });

    it("supports every field in the long Add Competency form and saves", async () => {
        const onSave = vi.fn();
        render(
            <CompetencyForm
                show
                existing={null}
                nextCode="COMP-999"
                actorName="Celso Ramirez"
                existingNames={[]}
                onClose={() => {}}
                onSave={onSave}
            />,
        );
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/Competency Name/), "Overlay Interaction Safety");
        await user.selectOptions(screen.getByLabelText(/Category/), COMPETENCY_CATEGORIES[1]);
        await user.type(screen.getByLabelText(/Definition/), "Confirms the complete modal body remains usable.");
        for (let level = 1; level <= 5; level += 1) {
            await user.type(screen.getByLabelText(new RegExp(`Level ${level}`)), `Observable behavior level ${level}`);
        }
        await user.click(screen.getByLabelText(ASSESSMENT_METHODS[0]));
        await user.click(screen.getByRole("button", { name: "Save Draft" }));
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("supports Role Profile requirement selectors, toggles, notes, and save", async () => {
        const initial = createCompetencyInitialState();
        const state = { ...initial, roleProfiles: [] };
        const onSave = vi.fn();
        render(
            <RoleProfileForm
                show
                existing={null}
                state={state}
                actorName="Celso Ramirez"
                onClose={() => {}}
                onSave={onSave}
            />,
        );
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/Profile Name/), "Overlay-safe Role Profile");
        await user.selectOptions(screen.getByLabelText(/Applies To/), "Trainee");
        await user.click(screen.getByRole("button", { name: "Add Requirement" }));
        await user.selectOptions(screen.getByLabelText(/Required Level/), "4");
        await user.selectOptions(screen.getByLabelText(/^Evidence$/), "Required");
        await user.click(screen.getByLabelText("Critical"));
        await user.type(screen.getByLabelText("Notes"), "Evidence-based requirement note.");
        await user.click(screen.getByRole("button", { name: "Save Draft" }));
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("supports Assessment Cycle population, date, select, toggle, and save controls", async () => {
        const state = createCompetencyInitialState();
        const activeProfile = state.roleProfiles.find((profile) => profile.status === "Active");
        if (!activeProfile) throw new Error("Expected an active role profile fixture.");
        const onSave = vi.fn();
        render(
            <CycleForm
                show
                existing={null}
                state={state}
                actorName="Celso Ramirez"
                onClose={() => {}}
                onSave={onSave}
            />,
        );
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/Cycle Name/), "Overlay-safe Assessment Cycle");
        await user.type(screen.getByLabelText(/Assessment Window End/), "2026-12-31");
        await user.selectOptions(screen.getByLabelText(/Assignment Method/), "Reporting Relationship");
        await user.click(screen.getByLabelText(activeProfile.name));
        const selfAssessment = screen.getByRole("checkbox", {
            name: /Require self-assessment/,
        });
        await user.click(selfAssessment);
        expect(selfAssessment).toBeChecked();
        await user.click(screen.getByRole("button", { name: "Save Cycle" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    });
});
