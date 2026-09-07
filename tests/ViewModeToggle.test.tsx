import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./test-utils";
import { ViewModeToggle } from "../src/components/ViewModeToggle";

describe("ViewModeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders three mode buttons", () => {
    renderWithProviders(<ViewModeToggle />);
    const buttons = screen.getAllByRole("radio");
    expect(buttons).toHaveLength(3);
  });

  it("has grid mode selected by default", () => {
    renderWithProviders(<ViewModeToggle />);
    const buttons = screen.getAllByRole("radio");
    expect(buttons[0]).toHaveAttribute("aria-checked", "true");
    expect(buttons[1]).toHaveAttribute("aria-checked", "false");
    expect(buttons[2]).toHaveAttribute("aria-checked", "false");
  });

  it("switches to list mode on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ViewModeToggle />);
    const buttons = screen.getAllByRole("radio");

    await user.click(buttons[1]);

    expect(buttons[1]).toHaveAttribute("aria-checked", "true");
    expect(buttons[0]).toHaveAttribute("aria-checked", "false");
  });

  it("switches to carousel mode on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ViewModeToggle />);
    const buttons = screen.getAllByRole("radio");

    await user.click(buttons[2]);

    expect(buttons[2]).toHaveAttribute("aria-checked", "true");
    expect(buttons[0]).toHaveAttribute("aria-checked", "false");
  });

  it("persists selection to localStorage", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ViewModeToggle />);
    const buttons = screen.getAllByRole("radio");

    await user.click(buttons[1]);

    expect(localStorage.getItem("melitta_view_mode")).toBe("list");
  });

  it("restores selection from localStorage", () => {
    localStorage.setItem("melitta_view_mode", "carousel");
    renderWithProviders(<ViewModeToggle />);
    const buttons = screen.getAllByRole("radio");
    expect(buttons[2]).toHaveAttribute("aria-checked", "true");
  });

  it("names each radio with its localized label, never the raw token", () => {
    renderWithProviders(<ViewModeToggle />);
    expect(screen.getByRole("radio", { name: "Grid" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "List" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Carousel" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "grid" })).not.toBeInTheDocument();
  });

  it("renders radiogroup container", () => {
    renderWithProviders(<ViewModeToggle />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("is the shared Option, not a fourth hand-rolled copy of one", () => {
    renderWithProviders(<ViewModeToggle />);
    for (const button of screen.getAllByRole("radio")) {
      expect(button.getAttribute("data-ui")).toBe("option");
    }
  });

  it("says the chosen mode with a lit underline in an always-reserved slot", () => {
    renderWithProviders(<ViewModeToggle />);
    const [grid, list] = screen.getAllByRole("radio");

    expect(grid.getAttribute("data-underline")).toBe("lit");
    expect(list.getAttribute("data-underline")).toBe("reserved");
    expect(grid.style.borderBottomColor).toBe("var(--accent)");
    expect(list.style.borderBottomColor).toBe("transparent");
    // The slot is declared in both states, so choosing shifts nothing.
    expect(list.style.borderBottomWidth).toBe(grid.style.borderBottomWidth);
    expect(list.style.borderBottomStyle).toBe("solid");
  });

  it("paints nothing and curves nothing — the fill and the radius are gone", () => {
    renderWithProviders(<ViewModeToggle />);
    for (const button of screen.getAllByRole("radio")) {
      expect(button.style.backgroundColor).toBe("");
      expect(button.style.background).toBe("");
      expect(button.style.borderRadius).toBe("0px");
      expect(button.className).not.toMatch(/rounded-|ring-|shadow-/);
      expect(button.className).toContain("tap");
      expect(button.className).toContain("press");
    }
  });
});
