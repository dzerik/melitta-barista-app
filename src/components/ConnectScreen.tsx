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
        className="w-full max-w-md space-y-6 rounded-3xl bg-coffee-900/60 p-8 backdrop-blur-sm"
      >
        <div className="text-center">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="text-2xl font-bold text-coffee-100">Melitta Barista</h1>
          <p className="mt-1 text-sm text-coffee-400">
            Connect to Home Assistant
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-coffee-300 mb-1">
              HA URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
              className="w-full rounded-xl bg-coffee-800/50 px-4 py-3 text-coffee-50 placeholder-coffee-600 outline-none ring-1 ring-coffee-700 focus:ring-coffee-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-coffee-300 mb-1">
              Long-Lived Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              className="w-full rounded-xl bg-coffee-800/50 px-4 py-3 text-coffee-50 placeholder-coffee-600 outline-none ring-1 ring-coffee-700 focus:ring-coffee-500 transition"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-900/30 px-4 py-3 text-sm text-red-300 ring-1 ring-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={connecting}
          className="w-full rounded-xl bg-coffee-600 py-3.5 font-semibold text-coffee-50 transition hover:bg-coffee-500 active:scale-[0.98] disabled:opacity-50"
        >
          {connecting ? "Connecting..." : "Connect"}
        </button>

        <p className="text-center text-xs text-coffee-600">
          Create a token in HA → Profile → Long-Lived Access Tokens
        </p>
      </form>
    </div>
  );
}
