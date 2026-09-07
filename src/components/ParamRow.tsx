import type { CSSProperties } from "react";
import { Ban } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import { displayNameFor } from "../lib/i18n";
import { Option, OptionRow } from "./ui";
import iconBean from "../assets/icons/bean.png";
import iconMilk from "../assets/icons/milk.png";
import iconWater from "../assets/icons/water.png";

/**
 * The parameter rows of a two-component drink — the three-up configure column
 * that `FreestyleSection` draws on the page and `RecipeEditModal` draws inside
 * a panel.
 *
 * They were the same rows written twice: `ProcessRow`, `TokenRow`,
 * `PROCESS_IMG_ICONS`, the 18px option glyph and the row rule all existed
 * byte-for-byte in both files, which is how the row rule ended up being C30's
 * "same constant declared twice". A parameter row is one control with one
 * spacing wherever it is drawn, so it is declared here once and imported by
 * both.
 */

const PROCESS_IMG_ICONS: Record<string, string> = {
  coffee: iconBean,
  milk: iconMilk,
  water: iconWater,
};

/** §C1: the glyph beside an option word sits at 18–20px. */
const OPTION_GLYPH = 18;

/**
 * The rule that opens a bare control row, and the one spelling of it (C30).
 *
 * §G2.7: sibling control rows are separated by the same 1px `--border`
 * hairline and nothing else — no zebra, no grouping box, no card. `OptionRow`
 * draws its own; `MeterField` is a bare control, so a numeric row borrows the
 * rule here rather than sitting in the stack unruled. The 6px of padding under
 * the rule is what keeps its label row off the line, and it pairs with the
 * §G2.6 `space-y-3` the whole stack sits on.
 */
export const PARAM_ROW_RULE: CSSProperties = {
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "var(--border)",
  paddingTop: "0.375rem",
};

export interface ProcessRowProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}

/**
 * The process picker — coffee / milk / water (and `none` on component 2) — as
 * a row of chooseable words, each carrying its 18px glyph.
 *
 * Replaces the `rounded-xl ring-1` capsule bar whose selected segment was a
 * solid `--accent` fill: selection is now the word turning white over
 * a lit 1px `--accent` underline, in a slot that was already reserved, so
 * choosing never shifts a pixel of the row.
 */
export function ProcessRow({ options, value, onChange, ariaLabel }: ProcessRowProps) {
  const { locale } = usePreferences();
  if (options.length === 0) return null;

  return (
    <OptionRow role="radiogroup" ariaLabel={ariaLabel}>
      {options.map((opt) => {
        const imgSrc = PROCESS_IMG_ICONS[opt];
        return (
          <Option
            key={opt}
            role="radio"
            label={displayNameFor(locale, "process", opt)}
            selected={opt === value}
            onSelect={() => onChange(opt)}
            icon={
              imgSrc ? (
                <img
                  src={imgSrc}
                  alt=""
                  className="object-contain"
                  style={{ width: OPTION_GLYPH, height: OPTION_GLYPH }}
                  draggable={false}
                />
              ) : (
                <Ban size={OPTION_GLYPH} strokeWidth={1.75} />
              )
            }
          />
        );
      })}
    </OptionRow>
  );
}

export interface TokenRowProps {
  family: string;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

/**
 * One enumerated parameter (intensity, aroma, temperature, shots) as a
 * labelled row of words — §C1, and the form the reference machine itself uses
 * for aroma (a caret against STANDARD / INTENSE, never a bar).
 *
 * This is what replaces the `rounded-full` range track and its `shadow-lg`
 * thumb: an ordinal token list was never a measured quantity, so it is chosen
 * by name rather than dragged. Only the genuinely numeric portion keeps a
 * meter (`MeterField`).
 */
export function TokenRow({
  family,
  label,
  options,
  value,
  onChange,
  disabled = false,
}: TokenRowProps) {
  const { locale } = usePreferences();
  if (options.length === 0) return null;

  return (
    <OptionRow label={label} role="radiogroup" ariaLabel={label}>
      {options.map((opt) => (
        <Option
          key={opt}
          role="radio"
          label={displayNameFor(locale, family, opt)}
          selected={opt === value}
          onSelect={() => onChange(opt)}
          disabled={disabled}
        />
      ))}
    </OptionRow>
  );
}
