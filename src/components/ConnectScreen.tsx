import { useState } from "react";
import { getSavedConfig, saveConfig } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import type { MismatchDirection } from "../lib/contract";
import { ShieldCheck } from "lucide-react";
import { LanguageSelect } from "./LanguageSelect";
import { Commit, Rule } from "./ui";
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

/**
 * A bare word carrying a 1px `--border` underline — the form of every
 * non-committing action in the app (§C5a). No fill, no ring, no radius.
 */
const WORD_ACTION = {
  borderRadius: 0,
  borderBottomWidth: "1px",
  borderBottomStyle: "solid" as const,
  borderBottomColor: "var(--border)",
};

/**
 * §R1.6 — a text field is a line to write on, and it is the app's only input
 * form: transparent ground, one 1px rule underneath, no box, no radius, no
 * ring. The label above it carries the naming; the rule carries the affordance.
 */
const UNDERLINE_INPUT = {
  borderRadius: 0,
  // §C3.6: no control is under 48px of reach, an input included.
  minHeight: "var(--tap)",
  backgroundColor: "transparent",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid" as const,
  borderBottomColor: "var(--input-border)",
  color: "var(--text-primary)",
};

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
      <div className="flex flex-col items-center text-center space-y-4 max-w-md">
        <img src={logoMelitta} alt="Melitta" className="h-10 object-contain" draggable={false} />
        <img src={machineImg} alt="" className="h-24 object-contain opacity-50" draggable={false} />
        <h2 className="t-title text-primary">
          {t(isAppOld ? "contract.update_app_title" : "contract.update_integration_title")}
        </h2>
        <p className="t-body text-tertiary leading-relaxed">
          {t(isAppOld ? "contract.update_app_desc" : "contract.update_integration_desc")}
        </p>
        {onDisconnect && (
          <button
            onClick={onDisconnect}
            className="tap press mt-4 t-body text-secondary hover:text-primary"
            style={WORD_ACTION}
          >
            {t("app.disconnect")}
          </button>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

        <div className="space-y-4">
          <div>
            <label htmlFor="connect-url" className="block t-label text-secondary mb-1">
              {t("connect.url_label")}
            </label>
            <input
              id="connect-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
              className="w-full px-0 py-3 t-body outline-none transition"
              style={UNDERLINE_INPUT}
              required
            />
          </div>
          <div>
            <label htmlFor="connect-token" className="block t-label text-secondary mb-1">
              {t("connect.token_label")}
            </label>
            <input
              id="connect-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              className="w-full px-0 py-3 t-body outline-none transition"
              style={UNDERLINE_INPUT}
              required
            />
          </div>
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
