import { useCallback, useEffect, useRef, useState } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { connectToHA, getSavedConfig, subscribeToEntities } from "../lib/ha";
import { detectPrefix } from "../lib/entities";

interface HAState {
  status: "disconnected" | "connecting" | "connected" | "error";
  connection: Connection | null;
  entities: HassEntities;
  prefix: string | null;
  error: string | null;
}

/** Filter entities to only those matching the Melitta device prefix. */
function filterMelittaEntities(
  all: HassEntities,
  prefix: string,
): HassEntities {
  const filtered: HassEntities = {};
  const suffix = `${prefix}_`;
  for (const [id, entity] of Object.entries(all)) {
    // Match pattern: domain.prefix_* (e.g. sensor.melitta_state)
    const dot = id.indexOf(".");
    if (dot !== -1 && id.substring(dot + 1).startsWith(suffix)) {
      filtered[id] = entity;
    }
  }
  return filtered;
}

export function useHA() {
  const [state, setState] = useState<HAState>({
    status: "disconnected",
    connection: null,
    entities: {},
    prefix: null,
    error: null,
  });
  const unsubRef = useRef<(() => void) | null>(null);
  const prefixRef = useRef<string | null>(null);

  const connect = useCallback(async (url: string, token: string) => {
    setState((s) => ({ ...s, status: "connecting", error: null }));
    try {
      const conn = await connectToHA(url, token);

      conn.addEventListener("disconnected", () => {
        setState((s) => ({ ...s, status: "disconnected" }));
      });
      conn.addEventListener("reconnect-error", () => {
        setState((s) => ({ ...s, status: "error", error: "Reconnect failed" }));
      });
      conn.addEventListener("ready", () => {
        setState((s) => ({ ...s, status: "connected" }));
      });

      unsubRef.current = subscribeToEntities(conn, (allEntities) => {
        // Detect prefix once, then cache it
        if (!prefixRef.current) {
          prefixRef.current = detectPrefix(allEntities);
        }
        const prefix = prefixRef.current;

        // Only pass Melitta-related entities to avoid unnecessary re-renders
        const entities = prefix
          ? filterMelittaEntities(allEntities, prefix)
          : {};

        setState((s) => ({ ...s, entities, prefix, status: "connected" }));
      });

      setState((s) => ({ ...s, connection: conn, status: "connected" }));
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "error",
        error: e instanceof Error ? e.message : "Connection failed",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    unsubRef.current?.();
    prefixRef.current = null;
    state.connection?.close();
    setState({
      status: "disconnected",
      connection: null,
      entities: {},
      prefix: null,
      error: null,
    });
  }, [state.connection]);

  // Auto-connect on mount if saved config exists
  useEffect(() => {
    const { url, token } = getSavedConfig();
    if (url && token) {
      connect(url, token);
    }
    return () => {
      unsubRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, connect, disconnect };
}
