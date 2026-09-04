import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageSelect } from "../src/components/LanguageSelect";
import { SUPPORTED_LOCALES } from "../src/lib/i18n";

function setup(onChange = vi.fn()) {
  render(<LanguageSelect value="en" onChange={onChange} label="Language" id="pick" />);
  return { onChange, trigger: screen.getByRole("button", { name: "Language" }) };
}

describe("LanguageSelect", () => {
  it("shows the current language by its own name", () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain("English");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("lists every shipped language once opened", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.getAllByRole("option")).toHaveLength(SUPPORTED_LOCALES.length);
    expect(screen.getByText("Русский")).toBeTruthy();
  });

  it("marks the current language as selected", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const selected = screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("English");
  });

  it("reports the chosen language and closes", () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Deutsch"));
    expect(onChange).toHaveBeenCalledWith("de");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape without choosing anything", () => {
    const { onChange, trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on a press outside itself", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
