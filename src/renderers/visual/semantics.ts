import type { Area, AreaType } from "../../domain/world/area";
import type { Entity } from "../../domain/world/entity";
import type { RoleInstance } from "../../domain/roles/role";
import type { WorldState } from "../../domain/common/state";
import {
  AREA_PALETTES,
  ENTITY_PALETTE,
  ROLE_PALETTE,
  type AreaPalette,
  type StatusTone,
} from "./theme";

// Capa semántica PURA: del World (type + state) a una descripción visual abstracta.
// No conoce Pixi, ni ids, ni nombres. Un estado nuevo se soporta agregando palabras clave
// o reglas de composición aquí, sin crear componentes por escenario.

const fold = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// El orden es la prioridad: lo más grave gana.
const TONE_KEYWORDS: ReadonlyArray<readonly [StatusTone, readonly string[]]> = [
  [
    "critical",
    [
      "incendio",
      "evacua",
      "critic",
      "emergenc",
      "falla",
      "fallo",
      "colaps",
      "collaps",
      "averi",
      "peligro",
      "alarma",
      "fuego",
      "corte",
      "falta",
      "derrumb",
      "fire",
      "fail",
      "danger",
    ],
  ],
  [
    "closed",
    [
      "cerrad",
      "clausur",
      "bloquead",
      "restring",
      "inactiv",
      "detenid",
      "parad",
      "paus",
      "closed",
      "locked",
      "stopped",
    ],
  ],
  [
    "warning",
    [
      "alerta",
      "precauc",
      "advert",
      "lleno",
      "saturad",
      "demora",
      "retras",
      "mantenim",
      "vaci",
      "warning",
      "full",
    ],
  ],
  [
    "active",
    ["activ", "produc", "en curso", "trabaj", "funcionando", "running"],
  ],
  [
    "normal",
    [
      "operativ",
      "normal",
      "disponib",
      "libre",
      "abierto",
      "listo",
      "ready",
      "available",
      "open",
    ],
  ],
];

/** Texto libre de estado (lo escribe la IA) → tono visual. Desconocido → "neutral". */
export function classifyStatus(text: string | null | undefined): StatusTone {
  if (!text) return "neutral";
  const folded = fold(text);
  for (const [tone, words] of TONE_KEYWORDS) {
    if (words.some((word) => folded.includes(word))) return tone;
  }
  return "neutral";
}

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const isOff = (value: unknown): boolean =>
  value === false ||
  (typeof value === "string" &&
    ["off", "false", "apagado", "apagada", "apagadas", "sin luz"].includes(
      fold(value),
    ));

export type Overlay = "hazard" | "flood";
export interface Badge {
  label: string;
  tone: StatusTone;
}

export interface AreaVisual {
  palette: AreaPalette;
  dark: boolean;
  tone: StatusTone;
  statusLabel: string | null;
  overlays: readonly Overlay[];
  badges: readonly Badge[];
}

function conditionEffects(state: WorldState): {
  overlays: Overlay[];
  badges: Badge[];
} {
  const condition = asText(state.condition);
  if (!condition) return { overlays: [], badges: [] };
  const c = fold(condition);
  if (/coll?aps|derrumb/.test(c))
    return {
      overlays: ["hazard"],
      badges: [{ label: "COLAPSADO", tone: "critical" }],
    };
  if (/dan|averi|damag|broken/.test(c))
    return {
      overlays: ["hazard"],
      badges: [{ label: "DAÑADO", tone: "warning" }],
    };
  if (/inund|flood/.test(c))
    return {
      overlays: ["flood"],
      badges: [{ label: "INUNDADO", tone: "warning" }],
    };
  return { overlays: [], badges: [] };
}

function inventoryBadge(state: WorldState): Badge[] {
  const inventory = asText(state.inventory);
  if (!inventory) return [];
  const i = fold(inventory);
  if (/lleno|full/.test(i))
    return [{ label: "INVENTARIO LLENO", tone: "warning" }];
  if (/vaci|empty/.test(i))
    return [{ label: "SIN INVENTARIO", tone: "critical" }];
  return [];
}

export function resolveAreaVisual(area: Area): AreaVisual {
  const statusLabel = asText(area.state.currentState);
  const effects = conditionEffects(area.state);
  return {
    palette: AREA_PALETTES[area.type as AreaType] ?? AREA_PALETTES.custom,
    dark: isOff(area.state.lighting),
    tone: classifyStatus(statusLabel),
    statusLabel,
    overlays: effects.overlays,
    badges: [...effects.badges, ...inventoryBadge(area.state)],
  };
}

/** Hash determinista (FNV-1a) para elegir colores estables a partir de un identificador semántico. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface EntityVisual {
  color: number;
  initial: string;
  badge: StatusTone | null; // null = condición normal, sin insignia
}

export function resolveEntityVisual(entity: Entity): EntityVisual {
  const condition = asText(entity.state.condition);
  const c = condition ? fold(condition) : "";
  let badge: StatusTone | null = null;
  if (/broken|averi|coll?aps|derrumb|roto/.test(c)) badge = "critical";
  else if (/damag|dan/.test(c)) badge = "warning";
  return {
    color: ENTITY_PALETTE[hashString(entity.type) % ENTITY_PALETTE.length],
    initial: (entity.type.charAt(0) || "?").toUpperCase(),
    badge,
  };
}

export interface RoleVisual {
  color: number;
  initial: string;
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

export function resolveRoleVisual(role: RoleInstance): RoleVisual {
  const declared =
    typeof role.metadata?.color === "string"
      ? HEX_COLOR.exec(role.metadata.color)
      : null;
  return {
    color: declared
      ? parseInt(declared[1], 16)
      : ROLE_PALETTE[hashString(role.roleDefinitionId) % ROLE_PALETTE.length],
    initial: (role.name.charAt(0) || "?").toUpperCase(),
  };
}

// Medición aproximada: medir texto real exige canvas y no funciona sin navegador (tests).
export function estimateTextWidth(
  text: string,
  fontSize: number,
  bold = false,
): number {
  return Math.ceil(text.length * fontSize * (bold ? 0.62 : 0.56));
}

export function truncate(text: string, maxChars: number): string {
  if (maxChars <= 1) return "…";
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

export function fitText(
  text: string,
  maxWidth: number,
  fontSize: number,
  bold = false,
): string {
  const charWidth = fontSize * (bold ? 0.62 : 0.56);
  return truncate(text, Math.max(1, Math.floor(maxWidth / charWidth)));
}
