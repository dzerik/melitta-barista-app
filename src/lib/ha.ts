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
  await callService(conn, turnOn ? "switch" : "switch", turnOn ? "turn_on" : "turn_off", {
    entity_id: entityId,
  });
}
