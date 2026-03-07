import { useState } from "react";
import { getSavedConfig, saveConfig } from "../lib/ha";

interface Props {
  onConnect: (url: string, token: string) => void;
  error: string | null;
  connecting: boolean;
}

export function ConnectScreen({ onConnect, error, connecting }: Props) {
  const saved = getSavedConfig();
  const [url, setUrl] = useState(saved.url || "http://");
  const [token, setToken] = useState(saved.token);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.replace(/\/+$/, "");
    saveConfig(cleanUrl, token);
    onConnect(cleanUrl, token);
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-2xl bg-neutral-900/80 p-8 ring-1 ring-neutral-800 backdrop-blur-sm"
      >
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white tracking-wide">Melitta Barista</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Connect to Home Assistant
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">
              HA URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
              className="w-full rounded-xl bg-neutral-800/60 px-4 py-3 text-white placeholder-neutral-600 outline-none ring-1 ring-neutral-700 focus:ring-neutral-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">
              Long-Lived Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              className="w-full rounded-xl bg-neutral-800/60 px-4 py-3 text-white placeholder-neutral-600 outline-none ring-1 ring-neutral-700 focus:ring-neutral-500 transition"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-400 ring-1 ring-red-900">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={connecting}
          className="w-full rounded-xl bg-white py-3.5 font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50"
        >
          {connecting ? "Connecting..." : "Connect"}
        </button>

        <p className="text-center text-xs text-neutral-600">
          Create a token in HA → Profile → Long-Lived Access Tokens
        </p>
      </form>
    </div>
  );
}
