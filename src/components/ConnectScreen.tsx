import { useState } from "react";
import { getSavedConfig, saveConfig } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import type { MismatchDirection } from "../lib/contract";
import { ShieldCheck } from "lucide-react";
import { LanguageSelect } from "./LanguageSelect";
import { Commit, Field, Glyph, Rule, Word } from "./ui";
import logoMelitta from "../assets/logo_melitta.png";
import machineImg from "../assets/machine.png";

interface Props {
  onConnect: (url: string, token: string) => void;
  error: string | null;
  connecting: boolean;
}

interface MismatchProps {
  /** Which side is too old (§5.4): server below our minimum / above our maximum. */
  direction: MismatchDirection;
  onDisconnect?: () => void;
}

/** The commit is a submit button; the form itself owns submission. */
const SUBMIT_HANDLED_BY_FORM = () => {};

/**
 * The §5.4 PWA version-mismatch screen — the app has no legacy mode, so an
 * unsupported (or absent, i.e. pre-contract) `contract_version` renders one
 * of two full-screen prompts instead of a degraded UI: server too old →
 * "update the integration"; server too new → "update the app".
 */
export function VersionMismatchScreen({ direction, onDisconnect }: MismatchProps) {
  const { t } = usePreferences();
  const isAppOld = direction === "update_app";

  return (
    <div className="flex h-full items-center justify-center p-6 bg-page">
      {/* §G2.3: the one permitted cap is the prose measure, and the app's
          three full-screen blocked/empty columns (here, the ResolutionGuard
          block, App's "looking for the integration") now share it rather than
          each picking its own `max-w-*`. */}
      <div className="flex flex-col items-center text-center space-y-4 max-w-prose">
        <img src={logoMelitta} alt="Melitta" className="h-10 object-contain" draggable={false} />
        {/* §6.6 / C27: a blocked page's mark is the `state` rung, 80px at the
            one knock-down — not an `h-24` picked here and nowhere else. */}
        <Glyph src={machineImg} size="state" />
        <h2 className="t-title text-primary">
          {t(isAppOld ? "contract.update_app_title" : "contract.update_integration_title")}
        </h2>
        <p className="t-body text-tertiary leading-relaxed">
          {t(isAppOld ? "contract.update_app_desc" : "contract.update_integration_desc")}
        </p>
        {/* C5: an action, so no underline — that mark means "chosen" here. */}
        {onDisconnect && (
          <Word
            label={t("app.disconnect")}
            onClick={onDisconnect}
            className="mt-4"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Sign-in.
 *
 * The form floats on the page ground: no panel, no ring, no radius, no
 * backdrop blur. §5.B licenses one flat `--surface` panel per modal or
 * overlay, and this screen is neither — it is the page — so the fill goes and
 * hairlines do the holding. What remains is two lines to write on, one accent
 * commit rectangle whose width is the form column's own measure (§5.C), and
 * quiet meta below a rule.
 */
export function ConnectScreen({ onConnect, error, connecting }: Props) {
  const saved = getSavedConfig();
  const [url, setUrl] = useState(saved.url || "https://");
  const [token, setToken] = useState(saved.token);
  const { t, locale, setLocale } = usePreferences();

  // `Field` is the app's one input form and it does not carry `required` — the
  // native validation bubble is a rounded, filled, system-drawn box, which is
  // the one shape this language has no room for. The same guarantee is spelled
  // in the language instead: an incomplete form leaves the commit at §10's
  // disabled value, and the handler refuses it either way.
  const complete = url.trim() !== "" && token.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    const cleanUrl = url.replace(/\/+$/, "");
    saveConfig(cleanUrl, token);
    onConnect(cleanUrl, token);
  };

  return (
    <div className="flex h-full items-center justify-center p-6 bg-page">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4">
          <img src={logoMelitta} alt="Melitta" className="h-12 object-contain" draggable={false} />
          <img src={machineImg} alt="Barista Smart" className="h-28 object-contain opacity-80" draggable={false} />
          <p className="t-body text-tertiary">
            {t("connect.subtitle")}
          </p>
        </div>

        {/* C6/C24: two lines to write on, and `Field` owns the line. It reads
            `--underline-w` for the weight and `--input-border` for the ink, so
            the three rival hairline colours under the one input role collapse
            to the one token that exists for it. */}
        <div className="space-y-4">
          <Field
            id="connect-url"
            type="url"
            label={t("connect.url_label")}
            value={url}
            onChange={setUrl}
            placeholder="http://homeassistant.local:8123"
            autoComplete="url"
            spellCheck={false}
          />
          <Field
            id="connect-token"
            type="password"
            label={t("connect.token_label")}
            value={token}
            onChange={setToken}
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            autoComplete="current-password"
            spellCheck={false}
          />
        </div>

        {/* §10 error: `--error-text` type between two 1px `--error-border`
            rules. No tinted box — the box was the whole violation. */}
        {error && (
          <div data-ui="error-notice">
            <Rule style={{ backgroundColor: "var(--error-border)" }} />
            <p role="alert" className="t-body py-3" style={{ color: "var(--error-text)" }}>
              {t("connect.error")}
            </p>
            <Rule style={{ backgroundColor: "var(--error-border)" }} />
          </div>
        )}

        {/* The screen's one commit (§C3.5). Width comes from this column, not
            from padding: the rectangle is exactly as wide as the two rules
            above it. */}
        <Commit
          type="submit"
          label={t("connect.button")}
          busyLabel={t("connect.connecting")}
          busy={connecting}
          disabled={!complete}
          onCommit={SUBMIT_HANDLED_BY_FORM}
        />

        <p className="text-center t-label text-tertiary">
          {t("connect.hint")}
        </p>

        <div>
          <Rule />
          <div className="flex items-center gap-2 pt-3">
            <ShieldCheck
              size={18}
              strokeWidth={1.75}
              className="shrink-0"
              style={{ color: "var(--success)" }}
            />
            <p className="t-label text-tertiary leading-tight">
              {t("connect.security")}
            </p>
          </div>
        </div>

        {/* Every shipped language, named in itself — the sign-in screen is
            where someone who does not read English arrives first. */}
        <div className="pt-2">
          <label htmlFor="connect-locale" className="block t-label text-tertiary mb-1">
            {t("prefs.language")}
          </label>
          <LanguageSelect
            id="connect-locale"
            label={t("prefs.language")}
            value={locale}
            onChange={setLocale}
          />
        </div>
      </form>
    </div>
  );
}
