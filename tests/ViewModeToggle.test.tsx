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

  it("has correct aria-label attributes", () => {
    renderWithProviders(<ViewModeToggle />);
    expect(screen.getByRole("radio", { name: "grid" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "list" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "carousel" })).toBeInTheDocument();
  });

  it("renders radiogroup container", () => {
    renderWithProviders(<ViewModeToggle />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });
});
