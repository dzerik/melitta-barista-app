import { useState } from "react";
import { getSavedConfig, saveConfig } from "../lib/ha";
import { usePreferences } from "../lib/preferences";

interface Props {
  onConnect: (url: string, token: string) => void;
  error: string | null;
  connecting: boolean;
}

export function ConnectScreen({ onConnect, error, connecting }: Props) {
  const saved = getSavedConfig();
  const [url, setUrl] = useState(saved.url || "http://");
  const [token, setToken] = useState(saved.token);
  const { t } = usePreferences();

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
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-primary tracking-wide">{t("connect.title")}</h1>
          <p className="mt-1 text-sm text-tertiary">
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
            {error}
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
      </form>
    </div>
  );
}
