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

describe("LanguageSelect — visual contract", () => {
  it("the trigger is a line to write on, not a filled box", () => {
    const { trigger } = setup();
    expect(trigger.style.backgroundColor).toBe("");
    expect(trigger.style.backgroundImage).toBe("");
    expect(trigger.style.borderRadius).toBe("0px");
    expect(trigger.style.borderBottomWidth).toBe("1px");
    expect(trigger.style.borderBottomColor).toBe("var(--input-border)");
    expect(trigger.getAttribute("class")).not.toMatch(/rounded-|ring-/);
    expect(trigger.className).toContain("tap");
    expect(trigger.className).toContain("press");
  });

  it("the open list is the one flat panel — no ring, no shadow, no radius", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const list = screen.getByRole("listbox");
    expect(list.dataset.fill).toBe("panel");
    expect(list.style.backgroundColor).toBe("var(--surface)");
    expect(list.style.borderRadius).toBe("0px");
    expect(list.style.boxShadow).toBe("none");
    expect(list.getAttribute("class")).not.toMatch(/rounded-|ring-|shadow/);
  });

  it("rows are divided by a hairline and paint nothing", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const rows = screen.getAllByRole("option") as HTMLElement[];
    for (const row of rows) {
      expect(row.style.backgroundColor).toBe("");
      expect(row.style.backgroundImage).toBe("");
      expect(row.style.borderRadius).toBe("0px");
      expect(row.className).toContain("tap");
    }
    expect(rows[0].style.borderTopWidth).toBe("0px");
    expect(rows[1].style.borderTopWidth).toBe("1px");
    expect(rows[1].style.borderTopColor).toBe("var(--border)");
  });

  it("selection is value and weight plus an accent check, never a fill", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const rows = screen.getAllByRole("option") as HTMLElement[];
    const selected = rows.find((r) => r.getAttribute("aria-selected") === "true")!;
    const other = rows.find((r) => r.getAttribute("aria-selected") === "false")!;
    expect(selected.style.color).toBe("var(--text-primary)");
    expect(selected.style.fontWeight).toBe("600");
    expect(selected.style.backgroundColor).toBe("");
    expect(selected.querySelector("svg")).not.toBeNull();
    expect(other.style.color).toBe("var(--text-secondary)");
    expect(other.querySelector("svg")).toBeNull();
  });
});
