import type { CSSProperties, ChangeEvent, FocusEvent, KeyboardEvent } from "react";
import { INPUT_RULE, UNDERLINE_W } from "./tokens";

export type FieldType = "text" | "number" | "password" | "url" | "email" | "search";

export interface FieldProps {
  /** The field's value. Controlled — the caller owns the state. */
  value: string | number;
  /** Receives the raw input string; parse it yourself for `type="number"`. */
  onChange: (value: string) => void;
  /** A quiet caption above the line. Omit and pass `ariaLabel` instead. */
  label?: string;
  type?: FieldType;
  /** Passed straight through, so a numeric field still gets a numeric keypad. */
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  name?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  spellCheck?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  /** Right-align the text — how a machine number reads in a settings row. */
  align?: "start" | "end";
  /** Tabular figures. Defaults to true for `type="number"` (§7.6, C25). */
  numeric?: boolean;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  id?: string;
  className?: string;
  /** Extra classes on the `<input>` itself, not on the wrapper. */
  inputClassName?: string;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
}

/**
 * The underline input — §R1.6, and the app's ONLY input form.
 *
 * A text field is a line to write on: transparent ground, one hairline
 * underneath, no box, no radius, no ring, no focus fill. The three weights of
 * line the audit found under the same role (C6) collapse to one, and the
 * survivor is `--input-border`: `--border` and `--border-hover` are content
 * dividers, while an input's rule is a distinct thing with its own token in
 * both themes. The width comes from `--underline-w`, so the app has exactly
 * one declaration of how thick a hairline under type is (C24).
 *
 * It wraps a real `<input>` and hands `type`, `inputMode`, `min`/`max`/`step`
 * and every aria attribute straight through — nothing here re-implements a
 * form control, and the 48px reach lives on the input itself (§C3.6) rather
 * than on a wrapper the pointer never reaches.
 */
export function Field({
  value,
  onChange,
  label,
  type = "text",
  inputMode,
  placeholder,
  min,
  max,
  step,
  maxLength,
  name,
  autoComplete,
  autoFocus,
  spellCheck,
  readOnly = false,
  disabled = false,
  align = "start",
  numeric,
  onBlur,
  onKeyDown,
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
  id,
  className = "",
  inputClassName = "",
  style,
  inputStyle,
}: FieldProps) {
  const tabular = numeric ?? type === "number";

  return (
    <div
      data-ui="field"
      className={["flex flex-col gap-1", className].filter(Boolean).join(" ")}
      style={{ borderRadius: 0, ...style }}
    >
      {label === undefined ? null : (
        <label
          htmlFor={id}
          data-ui="field-label"
          className="t-label text-tertiary"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={spellCheck}
        readOnly={readOnly}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        data-ui="field-input"
        className={[
          "t-body w-full",
          tabular ? "num" : "",
          align === "end" ? "text-right" : "",
          inputClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          backgroundColor: "transparent",
          color: "var(--text-primary)",
          // §C3.6: no control is under 48px of reach, an input included.
          minHeight: "var(--tap)",
          paddingLeft: 0,
          paddingRight: 0,
          borderRadius: 0,
          borderBottomWidth: UNDERLINE_W,
          borderBottomStyle: "solid",
          borderBottomColor: INPUT_RULE,
          outline: "none",
          opacity: disabled ? 0.35 : 1,
          ...inputStyle,
        }}
      />
    </div>
  );
}
