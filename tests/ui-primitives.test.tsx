import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ActionBand,
  Commit,
  Dot,
  DrinkStage,
  Field,
  Glyph,
  GLYPH_OPACITY,
  GLYPH_OPACITY_UNLIT,
  GLYPH_PX,
  Heading,
  Meter,
  MeterField,
  Option,
  OptionRow,
  Panel,
  Rule,
  TickRing,
  Word,
  completedTicks,
  filledSegments,
  truthScale,
  underlineSlot,
  HANG,
  INPUT_RULE,
  PANEL_PAD,
  RAIL_TEXT,
  TICK_COUNT,
  TRUTH_CEIL,
  TRUTH_FLOOR,
  TRUTH_UNSERVED,
  UNDERLINE_W,
  UNDERLINE_W_NAV,
  UNDERLINE_FILL,
  underlineFill,
} from "../src/components/ui";
import { CoffeeIcon } from "../src/components/CoffeeIcon";
import { CARVE_OUTS } from "./hard-rules";

/* ══════════════════════════════════════════════════════════════════════
   The underline contract (owner decision 1, §C3.1)
   ══════════════════════════════════════════════════════════════════════ */
describe("Option — the underline is a reserved slot, not a state that appears", () => {
  it("reserves a transparent underline when unselected so nothing shifts", () => {
    render(<Option label="Мягкий" selected={false} onSelect={() => {}} />);
    const el = screen.getByRole("button", { name: "Мягкий" });

    expect(el).toHaveAttribute("data-underline", "reserved");
    // The slot is declared, occupies layout, and is simply not inked.
    expect(el.style.borderBottomWidth).toBe("1px");
    expect(el.style.borderBottomStyle).toBe("solid");
    expect(el.style.borderBottomColor).toBe("transparent");
  });

  it("lights the underline in --accent when selected, at the same width", () => {
    render(<Option label="Мягкий" selected onSelect={() => {}} />);
    const el = screen.getByRole("button", { name: "Мягкий" });

    expect(el).toHaveAttribute("data-underline", "lit");
    expect(el.style.borderBottomWidth).toBe("1px");
    expect(el.style.borderBottomStyle).toBe("solid");
    expect(el.style.borderBottomColor).toBe("var(--accent)");
  });

  it("keeps the underline width identical across states (zero layout shift)", () => {
    const { rerender, container } = render(
      <Option label="Мягкий" selected={false} onSelect={() => {}} />,
    );
    const before = (container.firstElementChild as HTMLElement).style
      .borderBottomWidth;
    rerender(<Option label="Мягкий" selected onSelect={() => {}} />);
    const after = (container.firstElementChild as HTMLElement).style
      .borderBottomWidth;

    expect(after).toBe(before);
  });

  it("carries selection as WHITE text, never as accent text or a fill", () => {
    const { rerender, container } = render(
      <Option label="Мягкий" selected onSelect={() => {}} />,
    );
    const el = () => container.firstElementChild as HTMLElement;

    expect(el().style.color).toBe("var(--text-primary)");
    expect(el().style.backgroundColor).toBe("");

    rerender(<Option label="Мягкий" selected={false} onSelect={() => {}} />);
    expect(el().style.color).toBe("var(--text-secondary)");
    expect(el().style.backgroundColor).toBe("");
  });

  it("exposes aria-pressed by default and aria-checked in a radiogroup", () => {
    const { rerender } = render(
      <Option label="Сетка" selected onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Сетка" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    rerender(<Option label="Сетка" selected onSelect={() => {}} role="radio" />);
    expect(screen.getByRole("radio", { name: "Сетка" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("marks a chosen nav option aria-current and doubles the underline to 2px", () => {
    render(<Option label="Избранное" selected onSelect={() => {}} level="nav" />);
    const el = screen.getByRole("button", { name: "Избранное" });

    expect(el).toHaveAttribute("aria-current", "page");
    expect(el.style.borderBottomWidth).toBe("2px");
  });

  it("keeps its 48px reach and press feedback", () => {
    render(<Option label="Мягкий" selected={false} onSelect={() => {}} />);
    const el = screen.getByRole("button", { name: "Мягкий" });
    expect(el.className).toContain("tap");
    expect(el.className).toContain("press");
  });

  it("does not fire while disabled and keeps its space at opacity 0.35", async () => {
    const onSelect = vi.fn();
    render(
      <Option label="Мягкий" selected={false} onSelect={onSelect} disabled />,
    );
    const el = screen.getByRole("button", { name: "Мягкий" });

    expect(el.style.opacity).toBe("0.35");
    await userEvent.click(el).catch(() => {});
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("OptionRow", () => {
  it("opens the row with a 1px --border hairline and no fill", () => {
    const { container } = render(
      <OptionRow label="Настроение">
        <Option label="Бодрый" selected onSelect={() => {}} />
      </OptionRow>,
    );
    const row = container.firstElementChild as HTMLElement;

    expect(row.style.borderTopWidth).toBe("1px");
    expect(row.style.borderTopColor).toBe("var(--border)");
    expect(row.style.backgroundColor).toBe("");
    expect(row.className).toContain("flex-wrap");
  });

  it("can carry radiogroup semantics for its Options", () => {
    render(
      <OptionRow label="Вид" role="radiogroup" ariaLabel="Вид">
        <Option label="Сетка" selected onSelect={() => {}} role="radio" />
        <Option label="Список" selected={false} onSelect={() => {}} role="radio" />
      </OptionRow>,
    );
    expect(screen.getByRole("radiogroup", { name: "Вид" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Commit — the one fill per screen (§5.C, owner decision 3)
   ══════════════════════════════════════════════════════════════════════ */
describe("Commit", () => {
  it("is a square-cut --accent rectangle in both themes, with no shadow", () => {
    render(<Commit label="Заварить" onCommit={() => {}} />);
    const el = screen.getByRole("button", { name: "Заварить" });

    expect(el.style.backgroundColor).toBe("var(--accent)");
    expect(el.style.color).toBe("var(--text-inverse)");
    expect(el.style.borderRadius).toBe("0px");
    expect(el.style.boxShadow).toBe("none");
    expect(el.style.minHeight).toBe("var(--tap-lg)");
    expect(el).toHaveAttribute("data-fill", "commit");
  });

  it("takes its width from the caller's structure, never from padding", () => {
    render(<Commit label="Заварить" onCommit={() => {}} />);
    const el = screen.getByRole("button", { name: "Заварить" });

    expect(el.className).toContain("w-full");
    expect(el.className).not.toMatch(/px-16|max-w-/);
  });

  it("is the only element in its own tree that paints a fill", () => {
    const { container } = render(<Commit label="Заварить" onCommit={() => {}} />);
    const filled = container.querySelectorAll<HTMLElement>("[data-fill]");
    expect(filled).toHaveLength(1);
    expect(filled[0]).toHaveAttribute("data-fill", "commit");
  });

  it("swaps the label to the progressive verb at opacity .5 while busy", async () => {
    const onCommit = vi.fn();
    render(
      <Commit
        label="Заварить"
        busyLabel="Завариваем…"
        busy
        onCommit={onCommit}
      />,
    );
    const el = screen.getByRole("button", { name: "Завариваем…" });

    expect(screen.queryByText("Заварить")).not.toBeInTheDocument();
    expect(el.style.opacity).toBe("0.5");
    expect(el).toHaveAttribute("aria-busy", "true");
    // The fill stays: it is still the commit, it is just in flight.
    expect(el.style.backgroundColor).toBe("var(--accent)");

    await userEvent.click(el).catch(() => {});
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("dims to 0.35 and refuses taps when disabled", async () => {
    const onCommit = vi.fn();
    render(<Commit label="Заварить" onCommit={onCommit} disabled />);
    const el = screen.getByRole("button", { name: "Заварить" });

    expect(el.style.opacity).toBe("0.35");
    await userEvent.click(el).catch(() => {});
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits on click when idle", async () => {
    const onCommit = vi.fn();
    render(<Commit label="Заварить" onCommit={onCommit} />);
    await userEvent.click(screen.getByRole("button", { name: "Заварить" }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Meter — the segment maths (§9.2, §C-Numeric)
   ══════════════════════════════════════════════════════════════════════ */
describe("Meter segment maths", () => {
  it("computes the continuous case as round(fraction × segments)", () => {
    expect(filledSegments(0, 0, 100, 12)).toBe(0);
    expect(filledSegments(50, 0, 100, 12)).toBe(6);
    expect(filledSegments(100, 0, 100, 12)).toBe(12);
    expect(filledSegments(4, 0, 100, 12)).toBe(0);
    expect(filledSegments(5, 0, 100, 12)).toBe(1);
  });

  it("is exact for an enumerated scale (one segment per token)", () => {
    // Three intensity tokens, the middle one chosen → value = index + 1.
    expect(filledSegments(1, 0, 3, 3)).toBe(1);
    expect(filledSegments(2, 0, 3, 3)).toBe(2);
    expect(filledSegments(3, 0, 3, 3)).toBe(3);
  });

  it("honours a non-zero minimum", () => {
    expect(filledSegments(30, 30, 240, 12)).toBe(0);
    expect(filledSegments(135, 30, 240, 12)).toBe(6);
    expect(filledSegments(240, 30, 240, 12)).toBe(12);
  });

  it("clamps out-of-range values and degenerate ranges", () => {
    expect(filledSegments(-40, 0, 100, 12)).toBe(0);
    expect(filledSegments(400, 0, 100, 12)).toBe(12);
    expect(filledSegments(5, 10, 10, 12)).toBe(0);
  });

  it("paints exactly that many segments, square-cut, with no track chrome", () => {
    const { container } = render(
      <Meter value={50} max={100} segments={12} ariaLabel="Порция" />,
    );
    const segments = container.querySelectorAll<HTMLElement>("[data-segment]");
    const filled = container.querySelectorAll('[data-segment="filled"]');

    expect(segments).toHaveLength(12);
    expect(filled).toHaveLength(6);
    expect((segments[0] as HTMLElement).style.backgroundColor).toBe(
      "var(--accent)",
    );
    expect((segments[11] as HTMLElement).style.backgroundColor).toBe(
      "var(--meter-empty)",
    );
    segments.forEach((s) => expect(s.style.borderRadius).toBe("0px"));

    // The bar itself is unpainted: the segments are the whole drawing.
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.style.backgroundColor).toBe("");
    expect(bar.style.borderRadius).toBe("0px");
    expect(bar.style.height).toBe("var(--meter-h)");
    expect(bar.style.columnGap).toBe("var(--meter-gap)");
  });

  it("desaturates for service readouts", () => {
    const { container } = render(<Meter value={100} max={100} segments={3} tone="quiet" />);
    const first = container.querySelector<HTMLElement>('[data-segment="filled"]')!;
    expect(first.style.backgroundColor).toBe("var(--text-secondary)");
  });

  it("MeterField keeps the readout in the label row and the reach on a driver", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <MeterField
        label="Порция"
        value={120}
        min={30}
        max={240}
        displayValue="120 ml"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("120 ml")).toBeInTheDocument();

    const driver = container.querySelector<HTMLInputElement>(
      '[data-ui="meter-driver"]',
    )!;
    expect(driver.type).toBe("range");
    expect(driver.style.opacity).toBe("0");
    expect(driver.style.height).toBe("var(--tap)");
    expect(driver).toHaveAccessibleName("Порция");

    // The painted meter defers its semantics to the real control.
    const painted = container.querySelector('[data-ui="meter"]')!;
    expect(painted).toHaveAttribute("aria-hidden", "true");

    await userEvent.click(
      screen.queryByRole("button", { name: "Больше" }) ?? driver,
    ).catch(() => {});
  });

  it("MeterField turns the VALUE accent when changed, and never the row", () => {
    const { container } = render(
      <MeterField label="Порция" value={120} max={240} changed onChange={() => {}} />,
    );
    const value = container.querySelector<HTMLElement>(
      '[data-ui="meter-field-value"]',
    )!;
    const row = container.firstElementChild as HTMLElement;

    expect(value.style.color).toBe("var(--accent)");
    expect(row.style.backgroundColor).toBe("");
  });

  it("MeterField steppers carry localized names and step the value", async () => {
    const onChange = vi.fn();
    render(
      <MeterField
        label="Порция"
        value={120}
        min={30}
        max={240}
        step={10}
        onChange={onChange}
        steppers={{ decrement: "Меньше", increment: "Больше" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Больше" }));
    expect(onChange).toHaveBeenCalledWith(130);

    await userEvent.click(screen.getByRole("button", { name: "Меньше" }));
    expect(onChange).toHaveBeenCalledWith(110);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   TickRing (§9.1, owner decision 4)
   ══════════════════════════════════════════════════════════════════════ */
describe("TickRing", () => {
  it("always draws 90 ticks on a 4° pitch", () => {
    const { container } = render(<TickRing value={37} max={100} />);
    expect(container.querySelectorAll("[data-tick]")).toHaveLength(90);
    expect(TICK_COUNT).toBe(90);

    const last = container.querySelectorAll("[data-tick]")[89];
    expect(last.getAttribute("transform")).toContain("rotate(356");
  });

  it("lights 0 / 45 / 90 ticks at 0% / 50% / 100%", () => {
    const done = (value: number) => {
      const { container, unmount } = render(<TickRing value={value} max={100} />);
      const n = container.querySelectorAll('[data-tick="done"]').length;
      const rest = container.querySelectorAll('[data-tick="remaining"]').length;
      unmount();
      return [n, rest];
    };

    expect(done(0)).toEqual([0, 90]);
    expect(done(50)).toEqual([45, 45]);
    expect(done(100)).toEqual([90, 0]);
    expect(completedTicks(0, 0, 100)).toBe(0);
    expect(completedTicks(50, 0, 100)).toBe(45);
    expect(completedTicks(100, 0, 100)).toBe(90);
  });

  it("fills clockwise from exactly 12 o'clock with an abrupt boundary", () => {
    const { container } = render(<TickRing value={50} max={100} />);
    const ticks = Array.from(container.querySelectorAll("[data-tick]"));

    expect(ticks[0].getAttribute("data-tick")).toBe("done");
    expect(ticks[0].getAttribute("transform")).toContain("rotate(0");
    expect(ticks[44].getAttribute("data-tick")).toBe("done");
    expect(ticks[45].getAttribute("data-tick")).toBe("remaining");

    // Completed ticks are accent at full alpha; remaining are tertiary at .55.
    expect(ticks[0].getAttribute("fill")).toBe("var(--accent)");
    expect(ticks[0].getAttribute("fill-opacity")).toBe("1");
    expect(ticks[45].getAttribute("fill")).toBe("var(--text-tertiary)");
    expect(ticks[45].getAttribute("fill-opacity")).toBe("0.55");
  });

  it("draws square-cut ticks 2×11 between r56 and r67, and no track circle", () => {
    const { container } = render(<TickRing value={10} max={100} />);
    const tick = container.querySelector("[data-tick]")!;

    expect(tick.tagName.toLowerCase()).toBe("rect");
    expect(tick.getAttribute("width")).toBe("2");
    expect(tick.getAttribute("height")).toBe("11");
    expect(tick.getAttribute("y")).toBe("0");
    expect(container.querySelector("circle")).toBeNull();
  });

  it("prints no percentage and hands the centre to a glyph slot", () => {
    const { container } = render(
      <TickRing value={42} max={100} ariaLabel="Готовим">
        <span data-testid="glyph">☕</span>
      </TickRing>,
    );
    expect(container.textContent).not.toMatch(/\d/);
    expect(screen.getByTestId("glyph")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Готовим" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
  });

  it("desaturates for a maintenance programme", () => {
    const { container } = render(<TickRing value={50} max={100} tone="service" />);
    const tick = container.querySelector('[data-tick="done"]')!;
    expect(tick.getAttribute("fill")).toBe("var(--text-secondary)");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   DrinkStage (§6.2) and Rule (§S4.2)
   ══════════════════════════════════════════════════════════════════════ */
describe("DrinkStage", () => {
  const Glass = () => <svg data-testid="glass" width={140} height={93} />;

  it("lays a neutral radial glow behind the drink and never tints it", () => {
    const { container } = render(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    const glow = container.querySelector<HTMLElement>('[data-ui="drink-glow"]')!;

    expect(glow.style.backgroundImage).toContain("radial-gradient");
    expect(glow.style.backgroundImage).toContain("var(--drink-glow)");
    expect(glow.style.backgroundImage).not.toContain("--accent");
    expect(glow).toHaveAttribute("aria-hidden", "true");
    expect(glow.style.zIndex).toBe("0");

    // Nothing is applied to the drink itself.
    const drink = screen.getAllByTestId("glass")[0].parentElement as HTMLElement;
    expect(drink.style.zIndex).toBe("10");
    expect(drink.style.filter).toBe("");
    expect(drink.style.backgroundColor).toBe("");
  });

  it("burns the glow at 1x when active and idles at 0.55x", () => {
    const { container, rerender } = render(
      <DrinkStage size={140} active>
        <Glass />
      </DrinkStage>,
    );
    const glow = () =>
      container.querySelector<HTMLElement>('[data-ui="drink-glow"]')!;

    expect(glow().style.opacity).toBe("1");
    rerender(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    expect(glow().style.opacity).toBe("0.55");
  });

  it("mirrors the glass under a mask at the family's depth, plus a contact darkening", () => {
    const { container } = render(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    // 140 wide → 93 drawn tall; how far of that the mirror falls is
    // `--reflection-height` (0.18 in cappuccino, as it shipped).
    const reflection = container.querySelector<HTMLElement>(
      '[data-ui="drink-reflection"]',
    )!;
    expect(reflection.style.height).toBe("max(1px, calc(var(--reflection-height) * 93px))");

    const mirrored = reflection.firstElementChild as HTMLElement;
    expect(mirrored.style.transform).toBe("scaleY(-1)");
    expect(mirrored.style.opacity).toBe("var(--reflection-alpha)");
    expect(mirrored.style.maskImage).toContain("linear-gradient");

    const contact = container.querySelector<HTMLElement>(
      '[data-ui="drink-contact"]',
    )!;
    expect(contact.style.height).toBe("1px");
    expect(contact.style.backgroundImage).toContain("var(--drink-contact)");

    // The reflection is decoration, never a second announcement of the drink.
    expect(reflection).toHaveAttribute("aria-hidden", "true");
  });

  it("can drop the reflection where there is no vertical room", () => {
    const { container } = render(
      <DrinkStage size={140} reflection={false}>
        <Glass />
      </DrinkStage>,
    );
    expect(container.querySelector('[data-ui="drink-reflection"]')).toBeNull();
    expect(screen.getAllByTestId("glass")).toHaveLength(1);
  });
});

describe("Rule", () => {
  it("draws a flat structural hairline and can span rail to rail", () => {
    const { container } = render(<Rule rail />);
    const rule = container.firstElementChild as HTMLElement;

    expect(rule.style.height).toBe("1px");
    expect(rule.style.backgroundColor).toBe("var(--border)");
    expect(rule.style.marginLeft).toBe("var(--rail)");
    expect(rule.style.marginRight).toBe("var(--rail)");
    expect(rule.style.borderRadius).toBe("0px");
    expect(rule).toHaveAttribute("aria-hidden", "true");
  });

  it("fades an inline rule away from its anchor", () => {
    const { container } = render(<Rule variant="inline" tone="divider" />);
    const rule = container.firstElementChild as HTMLElement;

    // The family's material rides ON the tone fade, as a first layer that is
    // `none` in every family but obsidian.
    expect(rule.style.backgroundImage).toBe(
      "var(--rule-fill-inline), linear-gradient(90deg, var(--section-divider), transparent)",
    );
    expect(rule.style.backgroundColor).toBe("");
  });

  it("turns vertical for a column separator", () => {
    const { container } = render(<Rule orientation="vertical" />);
    const rule = container.firstElementChild as HTMLElement;
    expect(rule.style.width).toBe("1px");
    expect(rule.style.alignSelf).toBe("stretch");
  });

  it("reserves 2px accent for the rule that opens an action band", () => {
    const { container } = render(<Rule weight={2} tone="accent" />);
    const rule = container.firstElementChild as HTMLElement;
    expect(rule.style.height).toBe("2px");
    expect(rule.style.backgroundColor).toBe("var(--accent)");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Word — acting, and therefore NOT underlined (C5, R8)
   ══════════════════════════════════════════════════════════════════════ */
describe("Word — the bare secondary action", () => {
  it("wears no underline at all: a rule under a word says 'chosen'", () => {
    render(<Word label="Отмена" onClick={() => {}} />);
    const el = screen.getByRole("button", { name: "Отмена" });

    expect(el.style.borderBottomWidth).toBe("");
    expect(el.style.borderBottomStyle).toBe("");
    expect(el.style.borderBottomColor).toBe("");
    // ...and it is not an Option in disguise, so nothing reserves a slot.
    expect(el).not.toHaveAttribute("data-underline");
    expect(el).toHaveAttribute("data-ui", "word");
  });

  it("paints nothing and rounds nothing", () => {
    render(<Word label="Отмена" onClick={() => {}} />);
    const el = screen.getByRole("button", { name: "Отмена" });
    expect(el.style.backgroundColor).toBe("");
    expect(el.style.borderRadius).toBe("0px");
    expect(el.style.boxShadow).toBe("");
  });

  it("carries rank in ink, at one type step for every tone", () => {
    const ink = (tone: "quiet" | "strong" | "destructive") => {
      const { container, unmount } = render(
        <Word label="Отмена" tone={tone} onClick={() => {}} />,
      );
      const el = container.firstElementChild as HTMLElement;
      const out = [el.style.color, el.className.includes("t-body")] as const;
      unmount();
      return out;
    };

    expect(ink("quiet")).toEqual(["var(--text-secondary)", true]);
    expect(ink("strong")).toEqual(["var(--text-primary)", true]);
    expect(ink("destructive")).toEqual(["var(--error-text)", true]);
  });

  it("carries a word beside its glyph — the disclosure is never naked (R8)", () => {
    render(
      <Word
        label="Подробнее"
        icon={<svg data-testid="chevron" width={16} height={16} />}
        onClick={() => {}}
      />,
    );
    const el = screen.getByRole("button", { name: "Подробнее" });

    expect(el).toHaveTextContent("Подробнее");
    expect(screen.getByTestId("chevron")).toBeInTheDocument();
    // The glyph is decoration; the word is the accessible name.
    expect(screen.getByTestId("chevron").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("can announce and perform collapse, which its predecessor could not", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Word label="Подробнее" ariaExpanded={false} onClick={onClick} />,
    );
    expect(screen.getByRole("button", { name: "Подробнее" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await userEvent.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Word label="Подробнее" ariaExpanded onClick={onClick} />);
    expect(screen.getByRole("button", { name: "Подробнее" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("keeps its 48px reach and press feedback", () => {
    render(<Word label="Отмена" onClick={() => {}} />);
    const el = screen.getByRole("button", { name: "Отмена" });
    expect(el.className).toContain("tap");
    expect(el.className).toContain("press");
  });

  it("swaps to the progressive verb at opacity .5 while busy, refusing taps", async () => {
    const onClick = vi.fn();
    render(
      <Word label="Сбросить" busyLabel="Сбрасываем…" busy onClick={onClick} />,
    );
    const el = screen.getByRole("button", { name: "Сбрасываем…" });

    expect(screen.queryByText("Сбросить")).not.toBeInTheDocument();
    expect(el.style.opacity).toBe("0.5");
    expect(el).toHaveAttribute("aria-busy", "true");
    await userEvent.click(el).catch(() => {});
    expect(onClick).not.toHaveBeenCalled();
  });

  it("dims to 0.35 and refuses taps when disabled", async () => {
    const onClick = vi.fn();
    render(<Word label="Отмена" disabled onClick={onClick} />);
    const el = screen.getByRole("button", { name: "Отмена" });

    expect(el.style.opacity).toBe("0.35");
    await userEvent.click(el).catch(() => {});
    expect(onClick).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Field — one hairline under every input in the app (C6)
   ══════════════════════════════════════════════════════════════════════ */
describe("Field — the underline input", () => {
  it("is a line to write on: no fill, no box, no radius, one rule", () => {
    const { container } = render(
      <Field label="Название" value="Утренний" onChange={() => {}} />,
    );
    const input = container.querySelector<HTMLInputElement>(
      '[data-ui="field-input"]',
    )!;

    expect(input.style.backgroundColor).toBe("transparent");
    expect(input.style.borderRadius).toBe("0px");
    expect(input.style.paddingLeft).toBe("0px");
    expect(input.style.outline).toBe("none");
    expect(input.style.borderBottomStyle).toBe("solid");
  });

  it("takes its hairline colour and width from the tokens, not from a literal", () => {
    const { container } = render(<Field value="" onChange={() => {}} ariaLabel="URL" />);
    const input = container.querySelector<HTMLInputElement>(
      '[data-ui="field-input"]',
    )!;

    expect(input.style.borderBottomColor).toBe(INPUT_RULE);
    expect(INPUT_RULE).toBe("var(--input-border)");
    expect(input.style.borderBottomWidth).toBe(UNDERLINE_W);
    expect(UNDERLINE_W).toBe("var(--underline-w)");
  });

  it("keeps the 48px reach on the input itself, where the pointer lands", () => {
    const { container } = render(<Field value="" onChange={() => {}} ariaLabel="URL" />);
    const input = container.querySelector<HTMLInputElement>(
      '[data-ui="field-input"]',
    )!;
    expect(input.style.minHeight).toBe("var(--tap)");
  });

  it("passes type, inputMode, bounds and aria straight through", () => {
    const { container } = render(
      <Field
        value={120}
        type="number"
        inputMode="numeric"
        min={30}
        max={240}
        step={10}
        ariaLabel="Порция"
        ariaDescribedBy="hint"
        onChange={() => {}}
      />,
    );
    const input = container.querySelector<HTMLInputElement>(
      '[data-ui="field-input"]',
    )!;

    expect(input.type).toBe("number");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("min", "30");
    expect(input).toHaveAttribute("max", "240");
    expect(input).toHaveAttribute("step", "10");
    expect(input).toHaveAttribute("aria-describedby", "hint");
    expect(input).toHaveAccessibleName("Порция");
    // §7.6 — a machine number is tabular, spelled `.num` and never `tabular-nums`.
    expect(input.className).toContain("num");
    expect(input.className).not.toContain("tabular-nums");
  });

  it("names itself from its visible label when no ariaLabel is given", () => {
    render(<Field label="Название" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveAccessibleName("Название");
  });

  it("reports the raw string on every keystroke", async () => {
    const onChange = vi.fn();
    render(<Field label="Название" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Panel — the §5.B modal shell (C7, C8, C9, R3)
   ══════════════════════════════════════════════════════════════════════ */
describe("Panel", () => {
  const open = (extra: Partial<React.ComponentProps<typeof Panel>> = {}) =>
    render(
      <Panel title="Выбор рецепта" closeLabel="Отмена" onClose={() => {}} {...extra}>
        <p>тело</p>
      </Panel>,
    );

  it("draws a scrim plus ONE flat --surface panel, radius 0, no border or shadow", () => {
    open();
    const panel = document.querySelector<HTMLElement>('[data-ui="panel"]')!;
    const scrim = document.querySelector<HTMLElement>('[data-ui="panel-scrim"]')!;

    expect(scrim.style.backgroundColor).toBe("var(--overlay-bg)");
    expect(scrim).toHaveAttribute("data-fill", "scrim");

    expect(panel.style.backgroundColor).toBe("var(--surface)");
    expect(panel.style.borderRadius).toBe("0px");
    expect(panel.style.boxShadow).toBe("none");
    expect(panel.style.borderWidth).toBe("");
    expect(panel).toHaveAttribute("data-fill", "panel");
    expect(panel.className).not.toMatch(/(^|\s)ring-|(^|\s)rounded|shadow-|backdrop-blur/);
    // The panel is the only fill inside the scrim: the header, the body and
    // the close control paint nothing, and the header's hairline is a rule.
    const inner = Array.from(
      document.querySelectorAll('[data-ui="panel"] [data-fill]'),
    ).map((el) => el.getAttribute("data-fill"));
    expect(inner).toEqual(["rule"]);
  });

  it("sets the fill with backgroundColor, never the background shorthand (R3)", () => {
    open();
    const panel = document.querySelector<HTMLElement>('[data-ui="panel"]')!;
    // jsdom drops `background: var(--x)` outright, so a shorthand fill is
    // invisible to every assertion in this repo. This is the regression.
    expect(panel.style.backgroundColor).not.toBe("");
    expect(panel.className).not.toContain("surface");
  });

  it("has ONE header: title left, one close control right, one Rule beneath", () => {
    open();
    const header = document.querySelector<HTMLElement>('[data-ui="panel-header"]')!;
    const heading = header.querySelector("h2")!;

    expect(heading.className).toContain("t-title");
    expect(heading.className).toContain("text-primary");
    expect(heading.textContent).toBe("Выбор рецепта");
    expect(header.style.paddingLeft).toBe(PANEL_PAD);

    const closes = document.querySelectorAll('[data-ui="panel-close"]');
    expect(closes).toHaveLength(1);

    const rules = document.querySelectorAll('[data-ui="panel"] > [data-ui="rule"]');
    expect(rules).toHaveLength(1);
  });

  it("draws the close control as one lucide X at one size in one colour (C9)", () => {
    open();
    const close = document.querySelector<HTMLElement>('[data-ui="panel-close"]')!;
    const svg = close.querySelector("svg")!;

    expect(close).toHaveAccessibleName("Отмена");
    expect(close.style.color).toBe("var(--text-secondary)");
    expect(close.style.borderRadius).toBe("0px");
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.classList.contains("lucide-x")).toBe(true);
    expect(close.className).toContain("tap");
    expect(close.className).toContain("press");
  });

  it("offers exactly three measures and no ad-hoc max-w class (C8)", () => {
    const widths: Record<string, string> = {};
    (["sm", "md", "lg"] as const).forEach((measure) => {
      const { unmount } = open({ measure });
      const panel = document.querySelector<HTMLElement>('[data-ui="panel"]')!;
      widths[measure] = panel.style.maxWidth;
      expect(panel).toHaveAttribute("data-measure", measure);
      expect(panel.className).not.toMatch(/max-w-/);
      unmount();
    });

    expect(widths).toEqual({ sm: "28rem", md: "42rem", lg: "56rem" });
    // md is the default, so a caller that says nothing still lands in the set.
    open();
    expect(document.querySelector('[data-ui="panel"]')).toHaveAttribute(
      "data-measure",
      "md",
    );
  });

  it("is a dialog named by its title, holding its body in one scrolling slot", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Выбор рецепта" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const body = document.querySelector<HTMLElement>('[data-ui="panel-body"]')!;
    expect(body.textContent).toBe("тело");
    expect(body.className).toContain("overflow-y-auto");
    // Body padding is the caller's: a picker grid runs edge to edge.
    expect(body.style.padding).toBe("");
  });

  it("closes from the control, from the scrim and from Escape", async () => {
    const onClose = vi.fn();
    render(
      <Panel title="Выбор" closeLabel="Отмена" onClose={onClose}>
        <p>тело</p>
      </Panel>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(document.querySelector('[data-ui="panel-scrim"]')!);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);

    // A tap inside the panel is not a tap on the scrim.
    fireEvent.click(document.querySelector('[data-ui="panel-body"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("hangs its action band below the body, untouched", () => {
    render(
      <Panel
        title="Правка"
        closeLabel="Отмена"
        onClose={() => {}}
        actions={<ActionBand commit={<Commit label="Сохранить" scale="panel" onCommit={() => {}} />} />}
      >
        <p>тело</p>
      </Panel>,
    );
    const panel = document.querySelector<HTMLElement>('[data-ui="panel"]')!;
    const band = panel.querySelector('[data-ui="action-band"]')!;
    expect(band).toBeInTheDocument();
    expect(panel.lastElementChild).toBe(band);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   ActionBand — one arrangement for every screen that commits (C10)
   ══════════════════════════════════════════════════════════════════════ */
describe("ActionBand", () => {
  const band = (extra: Partial<React.ComponentProps<typeof ActionBand>> = {}) =>
    render(
      <ActionBand
        secondary={<Word label="Отмена" onClick={() => {}} />}
        commit={<Commit label="Сохранить" scale="panel" onCommit={() => {}} />}
        {...extra}
      />,
    );

  it("opens with the one 2px accent rule the language allows (§8.3)", () => {
    const { container } = band();
    const rule = container.querySelector<HTMLElement>('[data-ui="rule"]')!;

    expect(rule.style.height).toBe("2px");
    expect(rule.style.backgroundColor).toBe("var(--accent)");
    expect(container.firstElementChild!.firstElementChild).toBe(rule);
  });

  it("puts the words first at their own width and gives the commit the rest", () => {
    const { container } = band();
    const row = container.querySelector<HTMLElement>('[data-ui="action-band-row"]')!;
    const secondary = row.querySelector<HTMLElement>('[data-ui="action-band-secondary"]')!;
    const commit = row.querySelector<HTMLElement>('[data-ui="action-band-commit"]')!;

    expect(row.firstElementChild).toBe(secondary);
    expect(secondary.className).toContain("shrink-0");
    expect(commit.className).toContain("flex-1");
    // The commit's width comes from this row, never from its own padding.
    expect(
      commit.querySelector<HTMLElement>('[data-ui="commit"]')!.className,
    ).toContain("w-full");
  });

  it("holds exactly one commit rectangle", () => {
    const { container } = band();
    expect(container.querySelectorAll('[data-fill="commit"]')).toHaveLength(1);
  });

  it("works with no secondary, and can drop the rule", () => {
    const { container } = band({ secondary: undefined, rule: false });
    expect(container.querySelector('[data-ui="action-band-secondary"]')).toBeNull();
    expect(container.querySelector('[data-ui="rule"]')).toBeNull();
    expect(container.querySelector('[data-ui="action-band-commit"]')).not.toBeNull();
  });

  it("offers two gutters and spells the 10px hang once (C23)", () => {
    const gutter = (inset: "panel" | "rail" | "none") => {
      const { container, unmount } = band({ inset });
      const row = container.querySelector<HTMLElement>('[data-ui="action-band-row"]')!;
      const out = row.style.paddingLeft;
      unmount();
      return out;
    };

    expect(gutter("panel")).toBe(PANEL_PAD);
    expect(gutter("rail")).toBe(`calc(var(--rail) + ${HANG})`);
    expect(gutter("none")).toBe("");
    expect(RAIL_TEXT).toBe("calc(var(--rail) + var(--hang))");
    expect(HANG).toBe("var(--hang)");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Dot — the position mark (C20, C21)
   ══════════════════════════════════════════════════════════════════════ */
describe("Dot", () => {
  it("is a solid accent disc when current and a hollow ring when not", () => {
    const { container, rerender } = render(<Dot current />);
    const el = () => container.firstElementChild as HTMLElement;

    expect(el().style.backgroundColor).toBe("var(--accent)");
    expect(el().style.borderWidth).toBe("0px");

    rerender(<Dot current={false} />);
    expect(el().style.backgroundColor).toBe("var(--bg)");
    expect(el().style.borderWidth).toBe("1px");
    expect(el().style.borderColor).toBe("var(--accent)");
  });

  it("never changes size between states — no growing capsule", () => {
    const size = (current: boolean) => {
      const { container, unmount } = render(<Dot current={current} />);
      const el = container.firstElementChild as HTMLElement;
      const out = [el.style.width, el.style.height, el.style.opacity] as const;
      unmount();
      return out;
    };

    expect(size(true)).toEqual(size(false));
    expect(size(true)[0]).toBe("var(--dot)");
  });

  it("is a TRUE circle and declares itself as the radius exception", () => {
    const { container } = render(<Dot current />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.borderRadius).toBe("50%");
    expect(el).toHaveAttribute("data-shape", "circle");
    expect(el.style.width).toBe(el.style.height);
  });

  it("carries ONE data-fill value for every position mark in the app (C21)", () => {
    const { container, rerender } = render(<Dot current />);
    expect(container.firstElementChild).toHaveAttribute("data-fill", "dot");
    rerender(<Dot current={false} />);
    expect(container.firstElementChild).toHaveAttribute("data-fill", "dot");
  });

  it("announces nothing — the reach and the name belong to the button around it", () => {
    const { container } = render(<Dot current />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.tagName.toLowerCase()).toBe("span");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Heading (C31) and Glyph (C27, C28)
   ══════════════════════════════════════════════════════════════════════ */
describe("Heading", () => {
  it("has one type, one colour and one bottom margin", () => {
    const { container } = render(<Heading>Обслуживание</Heading>);
    const el = container.firstElementChild as HTMLElement;

    expect(el.tagName.toLowerCase()).toBe("h3");
    expect(el.className).toContain("t-label");
    expect(el.className).toContain("text-tertiary");
    // Weight comes from `.t-label`'s own 500 and is never overridden.
    expect(el.style.fontWeight).toBe("");
    expect(el.style.marginBottom).toBe("1rem");
    expect(el.style.marginTop).toBe("0px");
    expect(el.className).not.toMatch(/mb-\d|font-semibold|font-bold|text-primary/);
  });

  it("paints nothing and rounds nothing", () => {
    const { container } = render(<Heading>Обслуживание</Heading>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backgroundColor).toBe("");
    expect(el.style.borderRadius).toBe("0px");
  });

  it("spells the 10px hang exactly two ways, both from the token (C23)", () => {
    const pad = (hang: "none" | "rail" | "inner") => {
      const { container, unmount } = render(<Heading hang={hang}>Х</Heading>);
      const out = (container.firstElementChild as HTMLElement).style.paddingLeft;
      unmount();
      return out;
    };

    expect(pad("none")).toBe("");
    expect(pad("rail")).toBe(RAIL_TEXT);
    expect(pad("inner")).toBe(HANG);
  });

  it("can render as another element without changing its look", () => {
    const { container } = render(<Heading as="h2">Х</Heading>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe("h2");
    expect(el.className).toContain("t-label");
  });
});

describe("Glyph", () => {
  it("has a two-rung ladder and one opacity knock-down", () => {
    expect(GLYPH_PX).toEqual({ row: 20, state: 80 });
    expect(GLYPH_OPACITY).toBe(0.6);
    expect(GLYPH_OPACITY_UNLIT).toBe(0.45);
  });

  it("draws a raster asset at its rung with the state knock-down", () => {
    const { container } = render(
      <Glyph src="/offline.png" alt="Машина офлайн" size="state" />,
    );
    const img = container.querySelector<HTMLImageElement>("img")!;

    expect(img.style.width).toBe("80px");
    expect(img.style.height).toBe("80px");
    expect(img.style.opacity).toBe("0.6");
    expect(img).toHaveAttribute("alt", "Машина офлайн");
    expect(img.style.borderRadius).toBe("0px");
    expect(img.style.backgroundColor).toBe("");
  });

  it("lights and unlights a row glyph without moving it", () => {
    const box = (lit: boolean) => {
      const { container, unmount } = render(
        <Glyph src="/x.png" alt="" lit={lit} />,
      );
      const img = container.querySelector<HTMLImageElement>("img")!;
      const out = [img.style.width, img.style.opacity] as const;
      unmount();
      return out;
    };

    expect(box(true)).toEqual(["20px", "1"]);
    expect(box(false)).toEqual(["20px", "0.45"]);
  });

  it("hides a decorative mark from the accessibility tree", () => {
    const { container } = render(<Glyph src="/x.png" alt="" />);
    const img = container.querySelector<HTMLImageElement>("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("takes a lucide node on the same ladder, so empties stop being a third idiom", () => {
    const { container } = render(
      <Glyph size="state" alt="Пусто">
        <svg data-testid="lucide" />
      </Glyph>,
    );
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.width).toBe("80px");
    expect(el.style.opacity).toBe("0.6");
    expect(screen.getByTestId("lucide")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Пусто" })).toBe(el);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Truth scale (§6.3, C17/H8) and the one reflection (C29, R6)
   ══════════════════════════════════════════════════════════════════════ */
describe("truth scale", () => {
  it("maps a 0–1 magnitude onto the 0.55–1.0 band and clamps outside it", () => {
    expect(TRUTH_FLOOR).toBe(0.55);
    expect(TRUTH_CEIL).toBe(1);
    expect(truthScale(0)).toBeCloseTo(0.55);
    expect(truthScale(1)).toBeCloseTo(1);
    expect(truthScale(0.5)).toBeCloseTo(0.775);
    expect(truthScale(-3)).toBeCloseTo(0.55);
    expect(truthScale(9)).toBeCloseTo(1);
    expect(truthScale(Number.NaN)).toBeCloseTo(0.55);
  });

  const drawnWidth = (props: Record<string, unknown>) => {
    const { container, unmount } = render(
      <CoffeeIcon recipe="Espresso" size={140} {...props} />,
    );
    const el = container.querySelector("img,svg")!;
    const out = el.getAttribute("width");
    unmount();
    return out;
  };

  /** A procedural drawing: nothing in the geometry says how big the drink is. */
  const SPEC = {
    spec_version: 1,
    glass: "espresso_cup",
    total_ml: 40,
    fill_level: 0.67,
    layers: [{ role: "coffee", ml: 40, fraction: 1, intensity: 0.68, crema: true }],
    foam: null,
    steam: false,
  } as never;

  it("shrinks a PROCEDURAL drawing by its real volume, floor 0.55 and ceiling 1.0", () => {
    expect(drawnWidth({ icon: SPEC })).toBe("140");
    expect(drawnWidth({ icon: SPEC, scaleTo: 1 })).toBe("140");
    expect(drawnWidth({ icon: SPEC, scaleTo: 0 })).toBe("77");
    // The unserved fallback is a fixed 0.80×, not a claim to full size.
    expect(TRUTH_UNSERVED).toBe(0.8);
    expect(drawnWidth({ icon: SPEC, scaleTo: TRUTH_UNSERVED })).toBe(
      String(Math.round(140 * truthScale(0.8))),
    );
  });

  it("leaves the ARTWORK alone, because the artwork already is the truth", () => {
    // The 25 recipe PNGs share one 1080×720 canvas, stand on one baseline and
    // draw each glass at its real relative size — espresso measures 0.44× a
    // latte macchiato in the artwork and 0.43× on the counter. Scaling by
    // volume on top of that counts the same fact twice.
    expect(drawnWidth({})).toBe("140");
    expect(drawnWidth({ scaleTo: 0 })).toBe("140");
    expect(drawnWidth({ scaleTo: TRUTH_UNSERVED })).toBe("140");
  });

  it("bottom-aligns in a box of the FULL height so bases line up, tops stay ragged", () => {
    const { container } = render(
      <CoffeeIcon recipe="Espresso" size={140} scaleTo={0} baseline />,
    );
    const box = container.querySelector<HTMLElement>(
      '[data-ui="coffee-icon-baseline"]',
    )!;

    // 140 wide → 93 tall; the artwork is not shrunk (it carries its own
    // scale), so the box reserves exactly the drawing's height and the
    // alignment is what keeps a row of them standing on one line.
    expect(box.style.height).toBe("93px");
    expect(box.className).toContain("items-end");
    expect(container.querySelector("img")!.getAttribute("height")).toBe(
      String(Math.round(140 * (720 / 1080))),
    );
  });

  it("renders exactly as before when neither prop is passed", () => {
    const { container } = render(<CoffeeIcon recipe="Espresso" size={120} />);
    expect(
      container.querySelector('[data-ui="coffee-icon-baseline"]'),
    ).toBeNull();
    expect(container.firstElementChild!.tagName.toLowerCase()).toBe("img");
  });
});

describe("DrinkStage serves any drawn object, so there is one reflection (C29)", () => {
  const Glass = () => <svg data-testid="glass" width={280} height={350} />;

  it("takes the drawn aspect rather than assuming CoffeeIcon's 720/1080", () => {
    const { container } = render(
      <DrinkStage size={280} aspect={150 / 120}>
        <Glass />
      </DrinkStage>,
    );
    const glow = container.querySelector<HTMLElement>('[data-ui="drink-glow"]')!;
    // 280 wide × 1.25 = 350 drawn tall — not 187.
    expect(glow.style.height).toBe("350px");
    // The drawn base height is still resolved here; only HOW FAR the mirror
    // falls became a family decision, and it is multiplied in CSS so no
    // JavaScript ever resolves a custom property.
    expect(
      container.querySelector<HTMLElement>('[data-ui="drink-reflection"]')!.style
        .height,
    ).toBe("max(1px, calc(var(--reflection-height) * 350px))");
  });

  it("puts the horizon on the object's base, not on the bottom of its box", () => {
    const { container } = render(
      <DrinkStage size={280} aspect={150 / 120} baseFraction={112 / 150}>
        <Glass />
      </DrinkStage>,
    );
    const glow = container.querySelector<HTMLElement>('[data-ui="drink-glow"]')!;
    const contact = container.querySelector<HTMLElement>(
      '[data-ui="drink-contact"]',
    )!;
    const reflection = container.querySelector<HTMLElement>(
      '[data-ui="drink-reflection"]',
    )!;

    // 350 drawn tall, base at 261 → 89px of empty drawing below it.
    expect(glow.style.height).toBe("261px");
    expect(contact.style.marginTop).toBe("-89px");
    // The mirror hangs from the BASE, so its height is a fraction of 261, not
    // of the 350 the box draws.
    expect(reflection.style.height).toBe("max(1px, calc(var(--reflection-height) * 261px))");
    expect(
      (reflection.firstElementChild as HTMLElement).style.transform,
    ).toBe("translateY(-89px) scaleY(-1)");
  });

  it("mirrors by re-rendering the child, so it needs no colour and works in both themes", () => {
    const { container } = render(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    const mirrored = container.querySelector<HTMLElement>(
      '[data-ui="drink-reflection"]',
    )!.firstElementChild as HTMLElement;

    expect(screen.getAllByTestId("glass")).toHaveLength(2);
    expect(mirrored.style.transform).toBe("scaleY(-1)");
    // No hardcoded rgba anywhere: the mirror is the drink, dimmed and masked.
    expect(mirrored.style.backgroundColor).toBe("");
    expect(mirrored.style.color).toBe("");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The token helpers (C24)
   ══════════════════════════════════════════════════════════════════════ */
describe("underlineSlot — one declaration of how thick an underline is", () => {
  it("always declares the slot and inks it only when chosen", () => {
    expect(underlineSlot(false)).toEqual({
      borderBottomWidth: "var(--underline-w)",
      borderBottomStyle: "solid",
      borderBottomColor: "transparent",
      borderRadius: 0,
    });
    expect(underlineSlot(true).borderBottomColor).toBe("var(--accent)");
  });

  it("doubles at nav level and never anywhere else", () => {
    expect(underlineSlot(true, "nav").borderBottomWidth).toBe(UNDERLINE_W_NAV);
    expect(UNDERLINE_W_NAV).toBe("var(--underline-w-nav)");
  });

  it("keeps the width identical across states, so nothing shifts", () => {
    expect(underlineSlot(true).borderBottomWidth).toBe(
      underlineSlot(false).borderBottomWidth,
    );
    expect(underlineSlot(true, "nav", { literal: true }).borderBottomWidth).toBe(
      underlineSlot(false, "nav", { literal: true }).borderBottomWidth,
    );
  });

  it("can resolve to px for the one caller whose tests pin the literal", () => {
    // `Option` takes this path; the measure is still declared once, here.
    expect(underlineSlot(true, "option", { literal: true }).borderBottomWidth).toBe(
      "1px",
    );
    expect(underlineSlot(true, "nav", { literal: true }).borderBottomWidth).toBe(
      "2px",
    );
  });

  it("is the only way Option writes its slot", () => {
    render(<Option label="Мягкий" selected onSelect={() => {}} />);
    const el = screen.getByRole("button", { name: "Мягкий" });
    const slot = underlineSlot(true, "option", { literal: true });

    expect(el.style.borderBottomWidth).toBe(slot.borderBottomWidth);
    expect(el.style.borderBottomStyle).toBe(slot.borderBottomStyle);
    expect(el.style.borderBottomColor).toBe(slot.borderBottomColor);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The two hard rules, enforced across the whole primitive set
   ══════════════════════════════════════════════════════════════════════ */
describe("the hard rules hold across every primitive", () => {
  /** Fills the language permits, each of which must announce itself. */

  const samples: Array<[string, React.ReactElement]> = [
    ["Option (idle)", <Option label="Мягкий" selected={false} onSelect={() => {}} />],
    ["Option (chosen)", <Option label="Мягкий" selected onSelect={() => {}} />],
    [
      "OptionRow",
      <OptionRow label="Настроение">
        <Option label="Бодрый" selected onSelect={() => {}} />
      </OptionRow>,
    ],
    ["Word", <Word label="Отмена" onClick={() => {}} />],
    [
      "Word (destructive, with a glyph)",
      <Word
        label="Удалить"
        tone="destructive"
        icon={<svg width={16} height={16} />}
        onClick={() => {}}
      />,
    ],
    ["Commit", <Commit label="Заварить" onCommit={() => {}} />],
    ["Commit (busy)", <Commit label="Заварить" busyLabel="Завариваем…" busy onCommit={() => {}} />],
    [
      "ActionBand",
      <ActionBand
        secondary={<Word label="Отмена" onClick={() => {}} />}
        commit={<Commit label="Сохранить" scale="panel" onCommit={() => {}} />}
      />,
    ],
    ["Field", <Field label="Название" value="Утренний" onChange={() => {}} />],
    ["Meter", <Meter value={50} max={100} segments={12} />],
    [
      "MeterField",
      <MeterField
        label="Порция"
        value={120}
        max={240}
        onChange={() => {}}
        steppers={{ decrement: "Меньше", increment: "Больше" }}
      />,
    ],
    ["TickRing", <TickRing value={50} max={100} />],
    ["Heading", <Heading hang="rail">Обслуживание</Heading>],
    ["Glyph (row)", <Glyph src="/x.png" alt="" />],
    ["Glyph (state)", <Glyph src="/x.png" alt="Офлайн" size="state" />],
    ["Dot (current)", <Dot current />],
    ["Dot (idle)", <Dot current={false} />],
    [
      "DrinkStage",
      <DrinkStage size={140}>
        <svg width={140} height={93} />
      </DrinkStage>,
    ],
    ["Rule", <Rule rail />],
    [
      "Panel",
      <Panel title="Правка" closeLabel="Отмена" portal={false} onClose={() => {}}>
        <p>тело</p>
      </Panel>,
    ],
  ];

  it.each(samples)("%s emits no radius other than 0", (_name, element) => {
    const { container } = render(element);
    const all = container.querySelectorAll<HTMLElement>("*");

    all.forEach((el) => {
      const radius = el.style?.borderRadius ?? "";
      // The one exception the language grants: a TRUE circle, which must say
      // so and must be as wide as it is tall.
      if (el.getAttribute("data-shape") === "circle") {
        expect(radius).toBe("50%");
        expect(el.style.width).toBe(el.style.height);
        return;
      }
      if (radius !== "") expect(radius).toBe("0px");
      // No Tailwind radius utility either — not even rounded-full, which the
      // primitives have no use for: their only circle is drawn in SVG or
      // declared as `data-shape="circle"`.
      expect(String(el.className)).not.toMatch(/(^|\s)rounded/);
    });
  });

  it.each(samples)("%s paints no fill outside the carve-outs", (_name, element) => {
    const { container } = render(element);
    const all = container.querySelectorAll<HTMLElement>("*");

    all.forEach((el) => {
      const painted =
        (el.style?.backgroundColor ?? "") !== "" ||
        (el.style?.backgroundImage ?? "") !== "";
      if (!painted) return;
      // A transparent ground is the absence of a fill, not a fill.
      if ((el.style?.backgroundColor ?? "") === "transparent") return;
      const declared = el.getAttribute("data-fill");
      expect(
        declared !== null && CARVE_OUTS.has(declared),
        `${el.tagName} paints without declaring a carve-out (data-fill=${declared})`,
      ).toBe(true);
    });
  });

  it.each(samples)("%s uses no ring or shadow", (_name, element) => {
    const { container } = render(element);
    const all = container.querySelectorAll<HTMLElement>("*");

    all.forEach((el) => {
      const shadow = el.style?.boxShadow ?? "";
      if (shadow !== "") expect(shadow).toBe("none");
      expect(String(el.className)).not.toMatch(/(^|\s)ring-/);
      expect(String(el.className)).not.toMatch(/shadow-/);
      expect(String(el.className)).not.toMatch(/tracking-|uppercase/);
    });
  });

  it.each(samples)("%s says 'tabular' one way, and it is `.num` (C25)", (_name, element) => {
    const { container } = render(element);
    container.querySelectorAll<HTMLElement>("*").forEach((el) => {
      expect(String(el.className)).not.toMatch(/(^|\s)tabular-nums(\s|$)/);
    });
  });

  it.each(samples)("%s never underlines an action word", (_name, element) => {
    const { container } = render(element);
    container
      .querySelectorAll<HTMLElement>('[data-ui="word"]')
      .forEach((el) => {
        expect(el.style.borderBottomWidth).toBe("");
        expect(el.style.borderBottomColor).toBe("");
      });
  });
});

/* ══════════════════════════════════════════════════════════════════════
   THE THREE THEME FAMILIES (the 2026-09-07 amendment)

   A family changes the MATERIAL, never the mechanism. Everything the
   primitives can be asked about here is therefore the same question asked
   three ways: does the component read a token, or does it know which family
   it is in? Vitest runs with `css: false`, so `getComputedStyle` answers ""
   for every custom property — which is exactly why these tests assert on the
   token REFERENCES a primitive emits rather than on resolved colour. The
   resolved values are pinned on the other side, in `tests/theme.test.tsx`,
   which parses `index.css` and works the cascade out itself.
   ══════════════════════════════════════════════════════════════════════ */

/** Every family/mode pair that resolves. Obsidian is dark-only by design. */
const FAMILIES: ReadonlyArray<readonly [string, string]> = [
  ["cappuccino", "dark"],
  ["cappuccino", "light"],
  ["obsidian", "dark"],
  ["caramel", "dark"],
  ["caramel", "light"],
];

/** Render inside the two attributes `<html>` carries in the running app. */
function renderInFamily(
  family: string,
  mode: string,
  element: React.ReactElement,
) {
  return render(
    <div data-theme-family={family} data-theme={mode}>
      {element}
    </div>,
  );
}

/** The primitives a family can touch, plus the ones it deliberately cannot. */
const THEMED_SAMPLES: Array<[string, React.ReactElement]> = [
  ["Option (chosen)", <Option label="Мягкий" selected onSelect={() => {}} />],
  ["Option (idle)", <Option label="Мягкий" selected={false} onSelect={() => {}} />],
  [
    "Option (chosen, nav)",
    <Option label="Рецепты" selected level="nav" onSelect={() => {}} />,
  ],
  ["Commit", <Commit label="Заварить" onCommit={() => {}} />],
  ["Rule (structural)", <Rule rail />],
  ["Rule (inline)", <Rule variant="inline" tone="divider" />],
  [
    "Rule (inline, fading toward the start)",
    <Rule variant="inline" tone="divider" fadeToward="start" />,
  ],
  [
    "DrinkStage",
    <DrinkStage size={140}>
      <svg width={140} height={93} />
    </DrinkStage>,
  ],
  ["Meter", <Meter value={50} max={100} segments={12} />],
  ["TickRing", <TickRing value={50} max={100} />],
  ["Dot", <Dot current />],
];

describe("a family changes the material, and no primitive knows which family it is in", () => {
  it.each(THEMED_SAMPLES)(
    "%s draws identical markup in all three families",
    (_name, element) => {
      const drawn = FAMILIES.map(([family, mode]) => {
        const { container, unmount } = renderInFamily(family, mode, element);
        const html = (container.firstElementChild as HTMLElement).innerHTML;
        unmount();
        return html;
      });

      // One string, five renders. If a primitive ever branched on the family —
      // an `if (obsidian)`, a palette lookup, a second element drawn only for
      // one material — this is the assertion that would catch it, and the
      // whole scheme would have failed: the material belongs in `index.css`,
      // and a component's job is to name the token that carries it.
      drawn.forEach((html) => expect(html).toBe(drawn[0]));
    },
  );

  it("spends its family tokens on the four permitted surfaces and nowhere else", () => {
    /**
     * Which `data-fill` each material token is allowed to land on. This is the
     * amendment restated as a machine-checkable map: `--drink-sheen` is on the
     * list because it rides the DrinkStage GLOW layer — §S4.4 imagery, not a
     * container fill — which is precisely why it adds no element of its own.
     */
    const MATERIAL: Record<string, string> = {
      "--rule-fill": "rule",
      "--rule-fill-inline": "rule",
      "--underline-fill": "underline",
      "--commit-fill": "commit",
      "--drink-sheen": "glow",
      "--ground-wash": "ground",
    };

    for (const [family, mode] of FAMILIES) {
      for (const [name, element] of THEMED_SAMPLES) {
        const { container, unmount } = renderInFamily(family, mode, element);

        container.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const image = el.style?.backgroundImage ?? "";
          for (const [token, expected] of Object.entries(MATERIAL)) {
            if (!image.includes(`var(${token})`)) continue;
            expect(
              el.getAttribute("data-fill"),
              `${name} in ${family}/${mode}: ${token} is painted on data-fill=` +
                `${el.getAttribute("data-fill")}, and it belongs on "${expected}"`,
            ).toBe(expected);
          }
        });

        unmount();
      }
    }
  });

  it("paints a gradient only where the amendment permits one", () => {
    /** The amendment's four, verbatim. */
    const PERMITTED = new Set(["ground", "rule", "underline", "commit"]);
    /**
     * §S4.4 imagery, which predates the amendment and is not a fill in its
     * sense: the neutral halo behind a drink and the 1px contact darkening
     * under its base. Neither is a container, a card, a row or a control —
     * they are the ground the drink stands on, and both already shipped.
     */
    const IMAGERY = new Set(["glow", "contact"]);

    for (const [family, mode] of FAMILIES) {
      for (const [name, element] of THEMED_SAMPLES) {
        const { container, unmount } = renderInFamily(family, mode, element);

        container.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const image = el.style?.backgroundImage ?? "";
          if (image === "") return;
          const declared = el.getAttribute("data-fill") ?? "(none)";
          expect(
            PERMITTED.has(declared) || IMAGERY.has(declared),
            `${name} in ${family}/${mode}: <${el.tagName.toLowerCase()}> paints ` +
              `"${image}" on data-fill=${declared}. A gradient is legal only on ` +
              `ground | rule | underline | commit, and on the drink's own ` +
              `imagery (glow | contact).`,
          ).toBe(true);
        });

        unmount();
      }
    }
  });

  it("never expresses selection, or any state, as a container fill", () => {
    for (const [family, mode] of FAMILIES) {
      for (const [name, element] of THEMED_SAMPLES) {
        const { container, unmount } = renderInFamily(family, mode, element);

        container.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const bg = el.style?.backgroundColor ?? "";
          if (bg === "" || bg === "transparent") return;
          const declared = el.getAttribute("data-fill") ?? "(none)";
          expect(
            CARVE_OUTS.has(declared),
            `${name} in ${family}/${mode}: a background-color on data-fill=${declared}`,
          ).toBe(true);
          // And the one that would be a regression rather than a slip: no
          // family may fill the chosen word's box.
          expect(declared).not.toBe("underline");
        });

        unmount();
      }
    }
  });

  it("adds no radius and no shadow in any family", () => {
    for (const [family, mode] of FAMILIES) {
      for (const [name, element] of THEMED_SAMPLES) {
        const { container, unmount } = renderInFamily(family, mode, element);

        container.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const radius = el.style?.borderRadius ?? "";
          if (radius !== "" && el.getAttribute("data-shape") !== "circle") {
            expect(radius, `${name} in ${family}/${mode}`).toBe("0px");
          }
          const shadow = el.style?.boxShadow ?? "";
          if (shadow !== "") expect(shadow).toBe("none");
        });

        unmount();
      }
    }
  });
});

describe("the lit underline keeps its slot when a family paints a gradient on it", () => {
  const strip = (root: HTMLElement) =>
    root.querySelector<HTMLElement>('[data-fill="underline"]');

  it("lays the family's fill as a 1px strip over the reserved accent border", () => {
    const { container } = render(<Option label="Мягкий" selected onSelect={() => {}} />);
    const word = container.firstElementChild as HTMLElement;
    const lit = strip(word)!;

    // The border is untouched — five test files outside this directory assert
    // it, and every flat family still renders exactly that.
    expect(word.style.borderBottomColor).toBe("var(--accent)");
    expect(word.style.borderBottomWidth).toBe("1px");

    expect(lit).not.toBeNull();
    expect(lit).toHaveAttribute("aria-hidden", "true");
    expect(lit.style.backgroundImage).toBe(UNDERLINE_FILL);
    // Exactly `--underline-w` tall, laid on the border it covers rather than
    // above it, so the strip occupies the slot instead of adding to it.
    expect(lit.style.height).toBe(UNDERLINE_W);
    expect(lit.style.bottom).toBe(`calc(-1 * ${UNDERLINE_W})`);
    expect(lit.style.position).toBe("absolute");
    expect(lit.style.borderRadius).toBe("0px");
    // It carries no colour of its own: a family with `none` paints nothing.
    expect(lit.style.backgroundColor).toBe("");
  });

  it("takes the nav measure at nav level", () => {
    const { container } = render(
      <Option label="Рецепты" selected level="nav" onSelect={() => {}} />,
    );
    const lit = strip(container.firstElementChild as HTMLElement)!;
    expect(lit.style.height).toBe(UNDERLINE_W_NAV);
    expect(lit.style.bottom).toBe(`calc(-1 * ${UNDERLINE_W_NAV})`);
  });

  it("shows the strip ONLY when chosen, and shifts no layout when it appears", () => {
    const { container, rerender } = render(
      <Option label="Мягкий" selected={false} onSelect={() => {}} />,
    );
    const word = () => container.firstElementChild as HTMLElement;

    // Unchosen: the slot is reserved by the transparent border and nothing is
    // painted — a family cannot make an unchosen word glow.
    expect(strip(word())).toBeNull();
    expect(word()).toHaveAttribute("data-underline", "reserved");
    const before = word().style.borderBottomWidth;

    rerender(<Option label="Мягкий" selected onSelect={() => {}} />);
    expect(strip(word())).not.toBeNull();
    expect(word().style.borderBottomWidth).toBe(before);
    // The strip is out of flow, so the word itself cannot move.
    expect(strip(word())!.style.position).toBe("absolute");
    expect(word().className).toContain("relative");
  });

  it("declares the measure once, in tokens, for both levels", () => {
    expect(underlineFill()).toMatchObject({
      height: UNDERLINE_W,
      backgroundImage: UNDERLINE_FILL,
      borderRadius: 0,
    });
    expect(underlineFill("nav").height).toBe(UNDERLINE_W_NAV);
    // Same slot, same absence of colour, whichever level asks.
    expect(underlineFill().backgroundColor).toBeUndefined();
  });
});

describe("weight is a theme axis; the primitives read it rather than spelling it", () => {
  it("gives the chosen word --w-chosen and the unchosen one --w-body", () => {
    const { container, rerender } = render(
      <Option label="Мягкий" selected onSelect={() => {}} />,
    );
    const word = () => container.firstElementChild as HTMLElement;
    expect(word().style.fontWeight).toBe("var(--w-chosen)");

    rerender(<Option label="Мягкий" selected={false} onSelect={() => {}} />);
    expect(word().style.fontWeight).toBe("var(--w-body)");
  });

  it("weighs the commit verb as a chosen word", () => {
    const { container } = render(<Commit label="Заварить" onCommit={() => {}} />);
    expect((container.firstElementChild as HTMLElement).style.fontWeight).toBe(
      "var(--w-chosen)",
    );
  });

  it("never introduces a size of its own — the four-step scale is frozen", () => {
    for (const [family, mode] of FAMILIES) {
      for (const [name, element] of THEMED_SAMPLES) {
        const { container, unmount } = renderInFamily(family, mode, element);
        container.querySelectorAll<HTMLElement>("*").forEach((el) => {
          expect(el.style?.fontSize ?? "", `${name} in ${family}/${mode}`).toBe("");
        });
        unmount();
      }
    }
  });
});

describe("Rule and Commit carry the material, and carry it in the right direction", () => {
  it("lays --rule-fill over a structural rule's tone colour, not instead of it", () => {
    const { container } = render(<Rule tone="border-hover" />);
    const rule = container.firstElementChild as HTMLElement;

    expect(rule.style.backgroundColor).toBe("var(--border-hover)");
    expect(rule.style.backgroundImage).toBe("var(--rule-fill)");
    expect(rule).toHaveAttribute("data-fill", "rule");
  });

  it("mirrors an inline rule that fades toward its start, so both layers turn together", () => {
    const end = render(<Rule variant="inline" tone="divider" />);
    const endRule = end.container.firstElementChild as HTMLElement;
    expect(endRule.style.transform).toBe("");

    const start = render(
      <Rule variant="inline" tone="divider" fadeToward="start" />,
    );
    const startRule = start.container.firstElementChild as HTMLElement;

    // `--rule-fill-inline` is written once, at a fixed 90deg dying toward the
    // end. A start-fading rule is therefore drawn end-ward and flipped, which
    // turns the tone fade and the material together — the pair of mirrored
    // rules that flank a caption stay symmetrical in every family.
    expect(startRule.style.backgroundImage).toBe(endRule.style.backgroundImage);
    expect(startRule.style.transform).toBe("scaleX(-1)");
  });

  it("leaves a vertical inline rule to its tone: the material token is horizontal", () => {
    const { container } = render(
      <Rule orientation="vertical" variant="inline" tone="divider" />,
    );
    const rule = container.firstElementChild as HTMLElement;
    expect(rule.style.backgroundImage).toBe(
      "linear-gradient(180deg, var(--section-divider), transparent)",
    );
    expect(rule.style.backgroundImage).not.toContain("--rule-fill");
  });

  it("keeps the commit a flat --accent rectangle with the family's ramp over it", () => {
    const { container } = render(<Commit label="Заварить" onCommit={() => {}} />);
    const commit = container.firstElementChild as HTMLElement;

    expect(commit.style.backgroundColor).toBe("var(--accent)");
    expect(commit.style.backgroundImage).toBe("var(--commit-fill)");
    expect(commit).toHaveAttribute("data-fill", "commit");
    // Obsidian's 1px light top edge is the gradient's first hard stop. It is
    // not, and may never become, a shadow.
    expect(commit.style.boxShadow).toBe("none");
    expect(commit.style.borderRadius).toBe("0px");
  });
});

describe("DrinkStage takes its surface from the family without gaining an element", () => {
  const Glass = () => <svg data-testid="glass" width={140} height={93} />;

  it("rides the sheen on the glow layer, over the halo and never over the drink", () => {
    const { container } = render(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    const glow = container.querySelector<HTMLElement>('[data-ui="drink-glow"]')!;

    expect(glow.style.backgroundImage).toBe(
      "var(--drink-sheen), radial-gradient(ellipse 62% 72% at 50% 44%, var(--drink-glow), transparent 70%)",
    );
    // The sheen is a highlight ACROSS the glass, so it sits above the halo in
    // the layer list, and it is still the halo's own element: §S4.4 imagery
    // gains no painted rectangle just because a family turned it on.
    expect(glow).toHaveAttribute("data-fill", "glow");

    const drink = screen.getAllByTestId("glass")[0].parentElement as HTMLElement;
    expect(drink.style.backgroundImage).toBe("");
    expect(drink.style.filter).toBe("");
  });

  it("paints exactly two things in every family: the halo and the contact line", () => {
    for (const [family, mode] of FAMILIES) {
      const { container, unmount } = renderInFamily(
        family,
        mode,
        <DrinkStage size={140}>
          <Glass />
        </DrinkStage>,
      );
      const painted = Array.from(
        container.querySelectorAll<HTMLElement>("*"),
      ).filter((el) => (el.style?.backgroundImage ?? "") !== "");

      expect(painted.map((el) => el.getAttribute("data-fill"))).toEqual([
        "glow",
        "contact",
      ]);
      unmount();
    }
  });

  it("reads how strongly and how far it mirrors from the family", () => {
    const { container } = render(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    const reflection = container.querySelector<HTMLElement>(
      '[data-ui="drink-reflection"]',
    )!;

    // Unitless tokens: the alpha goes straight into `opacity` and the height
    // is multiplied by the drawn base height in CSS, so nothing here asks
    // JavaScript to resolve a custom property (it would answer "").
    expect((reflection.firstElementChild as HTMLElement).style.opacity).toBe(
      "var(--reflection-alpha)",
    );
    expect(reflection.style.height).toBe("max(1px, calc(var(--reflection-height) * 93px))");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The light hugs the GLASS, not the frame
   ══════════════════════════════════════════════════════════════════════
   The recipe artwork shares one canvas so the glasses come out at true
   relative scale, which means the drawn glass occupies anywhere from 11% of
   its frame (espresso) to 68% (hot water), and is not always centred in it —
   the water glass sits 12% of the canvas to the right. Light sized and placed
   by the FRAME therefore lands beside the cup: that is exactly what the first
   cut of this shipped, one soft blob a cup-width to the left of every cup.
*/
describe("DrinkStage lights the measured glass", () => {
  const Glass = () => <svg data-testid="glass" width={140} height={93} />;
  /** A narrow glass parked right of centre — an espresso-shaped worst case. */
  const OFFSET = { left: 0.5, right: 0.8, top: 0.4, bottom: 1 };

  it("anchors the halo to the middle of the stage, then steps onto the glass", () => {
    const { container } = render(
      <DrinkStage size={140} bounds={OFFSET}>
        <Glass />
      </DrinkStage>,
    );
    const glow = container.querySelector<HTMLElement>('[data-ui="drink-glow"]')!;

    // The drawn box is centred in a full-width stage, so the halo must be
    // placed from the centre out. Measuring from the stage's left edge is the
    // defect this pins.
    expect(glow.style.left).toBe("50%");
    // A 42px glass (0.3 of a 140px box) starting 70px in: its middle lands
    // 21px right of the box's middle. The halo is 18% of the glass per side.
    const halo = Math.round(42 * 0.18);
    expect(glow.style.marginLeft).toBe(`${21 - 42 / 2 - halo}px`);
    expect(glow.style.width).toBe(`${42 + halo * 2}px`);
    // Vertically: from the glass's own top, not the frame's.
    expect(glow.style.top).toBe(`${Math.round(93 * 0.4) - halo}px`);
  });

  it("steps the contact line onto the glass's own middle", () => {
    const { container } = render(
      <DrinkStage size={140} bounds={OFFSET}>
        <Glass />
      </DrinkStage>,
    );
    const contact = container.querySelector<HTMLElement>(
      '[data-ui="drink-contact"]',
    )!;

    expect(contact.style.width).toBe("42px");
    expect(contact.style.transform).toBe("translateX(21px)");
  });

  it("leaves a procedural drawing exactly as it was, because it fills its box", () => {
    // No bounds: no halo padding, no offset, no transform — the geometry the
    // freestyle glass and the icon specs have always drawn.
    const { container } = render(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    const glow = container.querySelector<HTMLElement>('[data-ui="drink-glow"]')!;
    const contact = container.querySelector<HTMLElement>(
      '[data-ui="drink-contact"]',
    )!;

    expect(glow.style.marginLeft).toBe("-70px");
    expect(glow.style.width).toBe("140px");
    expect(glow.style.top).toBe("0px");
    expect(contact.style.width).toBe("140px");
    expect(contact.style.transform).toBe("");
  });
});
