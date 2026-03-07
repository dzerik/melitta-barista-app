import type { HassEntities, HassEntity } from "home-assistant-js-websocket";

/** Detect Melitta device prefix from entity list */
export function detectPrefix(entities: HassEntities): string | null {
  for (const id of Object.keys(entities)) {
    const m = id.match(/^button\.(.+?)_brew$/);
    if (m && entities[`sensor.${m[1]}_state`]) return m[1];
  }
  return null;
}

/** Helper to get entity by prefix + suffix */
export function getEntity(
  entities: HassEntities,
  prefix: string,
  domain: string,
  suffix: string,
): HassEntity | undefined {
  return entities[`${domain}.${prefix}_${suffix}`];
}

export function getState(
  entities: HassEntities,
  prefix: string,
  domain: string,
  suffix: string,
): string | null {
  const e = getEntity(entities, prefix, domain, suffix);
  if (!e) return null;
  const s = e.state;
  return s && s !== "unknown" && s !== "unavailable" ? s : null;
}

export function getOptions(
  entities: HassEntities,
  prefix: string,
  suffix: string,
): string[] {
  const e = getEntity(entities, prefix, "select", suffix);
  return (e?.attributes?.options as string[]) || [];
}
