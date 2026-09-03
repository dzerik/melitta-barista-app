import { useState } from "react";
import { getSavedConfig, saveConfig } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import type { Locale } from "../lib/i18n";
import type { MismatchDirection } from "../lib/contract";
import { ShieldCheck } from "lucide-react";
import logoMelitta from "../assets/logo_melitta.png";
import machineImg from "../assets/machine.png";
import flagEn from "../assets/flags/en.png";
import flagRu from "../assets/flags/ru.png";
import flagDe from "../assets/flags/de.png";

const LOCALES: { value: Locale; flag: string }[] = [
  { value: "en", flag: flagEn },
  { value: "ru", flag: flagRu },
  { value: "de", flag: flagDe },
];

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
        <h2 className="text-xl font-semibold text-primary tracking-wide">
          {t(isAppOld ? "contract.update_app_title" : "contract.update_integration_title")}
        </h2>
        <p className="text-sm text-tertiary leading-relaxed">
          {t(isAppOld ? "contract.update_app_desc" : "contract.update_integration_desc")}
        </p>
        {onDisconnect && (
          <button
            onClick={onDisconnect}
            className="mt-4 rounded-lg px-4 py-2 text-sm text-secondary ring-1 ring-border hover:ring-border-hover transition"
          >
            {t("app.disconnect")}
          </button>
        )}
      </div>
    </div>
  );
}

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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-2xl p-8 surface ring-1 ring-border backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-4">
          <img src={logoMelitta} alt="Melitta" className="h-12 object-contain" draggable={false} />
          <img src={machineImg} alt="Barista Smart" className="h-28 object-contain opacity-80" draggable={false} />
          <p className="text-sm text-tertiary">
            {t("connect.subtitle")}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {t("connect.url_label")}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
              className="w-full rounded-xl px-4 py-3 text-primary outline-none ring-1 transition"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--input-border)",
                color: "var(--text-primary)",
              }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {t("connect.token_label")}
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              className="w-full rounded-xl px-4 py-3 text-primary outline-none ring-1 transition"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--input-border)",
                color: "var(--text-primary)",
              }}
              required
            />
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm ring-1"
            style={{
              background: "var(--error-bg)",
              color: "var(--error-text)",
              borderColor: "var(--error-border)",
            }}
          >
            {t("connect.error")}
          </div>
        )}

        <button
          type="submit"
          disabled={connecting}
          className="w-full rounded-xl py-3.5 font-semibold transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{
            background: "var(--btn-primary-bg)",
            color: "var(--btn-primary-text)",
          }}
        >
          {connecting ? t("connect.connecting") : t("connect.button")}
        </button>

        <p className="text-center text-xs text-tertiary">
          {t("connect.hint")}
        </p>

        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface)" }}>
          <ShieldCheck size={14} className="text-green-500 shrink-0" />
          <p className="text-[10px] text-tertiary leading-tight">
            {t("connect.security")}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          {LOCALES.map(({ value, flag }) => (
            <button
              key={value}
              type="button"
              onClick={() => setLocale(value)}
              className={`rounded-lg p-1.5 transition ${
                locale === value
                  ? "ring-2 ring-accent opacity-100"
                  : "opacity-40 hover:opacity-70"
              }`}
            >
              <img src={flag} alt={value} className="h-4 w-auto rounded-sm" draggable={false} />
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
