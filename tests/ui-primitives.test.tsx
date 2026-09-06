import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Commit,
  DrinkStage,
  Meter,
  MeterField,
  Option,
  OptionRow,
  Rule,
  TickRing,
  completedTicks,
  filledSegments,
  TICK_COUNT,
} from "../src/components/ui";

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

  it("mirrors the glass at 18% height under a mask, plus a contact darkening", () => {
    const { container } = render(
      <DrinkStage size={140}>
        <Glass />
      </DrinkStage>,
    );
    // 140 wide → 93 tall → 18% → 17px.
    const reflection = container.querySelector<HTMLElement>(
      '[data-ui="drink-reflection"]',
    )!;
    expect(reflection.style.height).toBe("17px");

    const mirrored = reflection.firstElementChild as HTMLElement;
    expect(mirrored.style.transform).toBe("scaleY(-1)");
    expect(mirrored.style.opacity).toBe("0.28");
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

    expect(rule.style.backgroundImage).toBe(
      "linear-gradient(90deg, var(--section-divider), transparent)",
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
   The two hard rules, enforced across the whole primitive set
   ══════════════════════════════════════════════════════════════════════ */
describe("the hard rules hold across every primitive", () => {
  /** Fills the language permits, each of which must announce itself. */
  const CARVE_OUTS = new Set(["commit", "meter", "glow", "contact", "rule"]);

  const samples: Array<[string, React.ReactElement]> = [
    ["Option (idle)", <Option label="Мягкий" selected={false} onSelect={() => {}} />],
    ["Option (chosen)", <Option label="Мягкий" selected onSelect={() => {}} />],
    [
      "OptionRow",
      <OptionRow label="Настроение">
        <Option label="Бодрый" selected onSelect={() => {}} />
      </OptionRow>,
    ],
    ["Commit", <Commit label="Заварить" onCommit={() => {}} />],
    ["Commit (busy)", <Commit label="Заварить" busyLabel="Завариваем…" busy onCommit={() => {}} />],
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
    [
      "DrinkStage",
      <DrinkStage size={140}>
        <svg width={140} height={93} />
      </DrinkStage>,
    ],
    ["Rule", <Rule rail />],
  ];

  it.each(samples)("%s emits no radius other than 0", (_name, element) => {
    const { container } = render(element);
    const all = container.querySelectorAll<HTMLElement>("*");

    all.forEach((el) => {
      const radius = el.style?.borderRadius ?? "";
      if (radius !== "") expect(radius).toBe("0px");
      // No Tailwind radius utility either — not even rounded-full, which the
      // primitives have no use for: their only circle is drawn in SVG.
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
});
