import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  callService,
  type Connection,
  type HassEntities,
} from "home-assistant-js-websocket";

const HA_URL_KEY = "melitta_ha_url";
const HA_TOKEN_KEY = "melitta_ha_token";

export function getSavedConfig() {
  return {
    url: localStorage.getItem(HA_URL_KEY) || "",
    token: localStorage.getItem(HA_TOKEN_KEY) || "",
  };
}

export function saveConfig(url: string, token: string) {
  localStorage.setItem(HA_URL_KEY, url);
  localStorage.setItem(HA_TOKEN_KEY, token);
}

export function clearConfig() {
  localStorage.removeItem(HA_URL_KEY);
  localStorage.removeItem(HA_TOKEN_KEY);
}

export async function connectToHA(
  url: string,
  token: string,
): Promise<Connection> {
  const auth = createLongLivedTokenAuth(url, token);
  return createConnection({ auth });
}

export function subscribeToEntities(
  conn: Connection,
  callback: (entities: HassEntities) => void,
) {
  return subscribeEntities(conn, callback);
}

export async function pressButton(conn: Connection, entityId: string) {
  await callService(conn, "button", "press", { entity_id: entityId });
}

export async function selectOption(
  conn: Connection,
  entityId: string,
  option: string,
) {
  await callService(conn, "select", "select_option", {
    entity_id: entityId,
    option,
  });
}

export async function setNumber(
  conn: Connection,
  entityId: string,
  value: number,
) {
  await callService(conn, "number", "set_value", {
    entity_id: entityId,
    value,
  });
}

export async function setTextValue(
  conn: Connection,
  entityId: string,
  value: string,
) {
  await callService(conn, "text", "set_value", {
    entity_id: entityId,
    value,
  });
}

export async function toggleSwitch(
  conn: Connection,
  entityId: string,
  turnOn: boolean,
) {
  await callService(conn, "switch", turnOn ? "turn_on" : "turn_off", {
    entity_id: entityId,
  });
}

/** Brew freestyle via dedicated HA service — all params in one call. */
export async function brewFreestyle(
  conn: Connection,
  entityId: string,
  params: {
    name: string;
    process1: string;
    intensity1: string;
    portion1_ml: number;
    temperature1: string;
    shots1: string;
    process2: string;
    intensity2: string;
    portion2_ml: number;
    temperature2: string;
    shots2: string;
  },
) {
  await callService(conn, "melitta_barista", "brew_freestyle", {
    entity_id: entityId,
    ...params,
  });
}

/** Brew a DirectKey recipe for the active profile. */
export async function brewDirectkey(
  conn: Connection,
  entityId: string,
  category: string,
) {
  await callService(conn, "melitta_barista", "brew_directkey", {
    entity_id: entityId,
    category,
  });
}

/** Save a customized DirectKey recipe for a profile. */
export async function saveDirectkey(
  conn: Connection,
  entityId: string,
  params: {
    category: string;
    profile_id?: number;
    process1: string;
    intensity1: string;
    portion1_ml: number;
    temperature1: string;
    shots1: string;
    process2: string;
    intensity2: string;
    portion2_ml: number;
    temperature2: string;
    shots2: string;
  },
) {
  await callService(conn, "melitta_barista", "save_directkey", {
    entity_id: entityId,
    ...params,
  });
}

/** Fire-and-forget wrapper with error logging. Returns true on success. */
export function safeCall(fn: () => Promise<unknown>): void {
  fn().catch((e) => {
    console.error("[melitta] Service call failed:", e);
  });
}
