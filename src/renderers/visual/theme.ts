import type { AreaType } from "../../domain/world/area";

// Único lugar con valores visuales (colores, tipografía, medidas). Los renderers solo
// consumen estos tokens; para cambiar la identidad del tablero se edita este archivo.

export const FONT = "Inter, 'Segoe UI', system-ui, Arial, sans-serif";

export const INK = {
  white: 0xffffff,
  light: 0xf5f7fa,
  dark: 0x1f2937,
  mutedLight: 0xb8c2d0,
  mutedDark: 0x5b6677,
  shadow: 0x000000,
  pill: 0x111827,
  select: 0x4cc9f0,
  night: 0x0b1020,
} as const;

export const BOARD = {
  background: 0x151b28,
  mat: 0x1f2839,
  matLine: 0x2c3750,
  margin: 56,
  dotStep: 40,
} as const;

export const METRICS = {
  radius: 10,
  wall: 8, // franja superior: da sensación de pared / profundidad
  header: 36,
  shadowOffset: 7,
  chipHeight: 18,
  darkMix: 0.68, // cuánto se oscurece un área sin luz
} as const;

export type StatusTone =
  | "normal"
  | "active"
  | "warning"
  | "critical"
  | "closed"
  | "neutral";

export const TONES: Record<StatusTone, number> = {
  normal: 0x2f9e6b,
  active: 0x2f80d1,
  warning: 0xe0a030,
  critical: 0xd64545,
  closed: 0x6b7280,
  neutral: 0x64748b,
};

export type FloorPattern = "grid" | "tiles" | "stripes" | "dashes" | "dots";

export interface AreaPalette {
  floor: number;
  wall: number;
  accent: number;
  pattern: FloorPattern;
  patternColor: number;
}

// Un estilo por tipo semántico (nunca por id ni por nombre). Record exhaustivo: si se agrega
// un AreaType, TypeScript obliga a darle paleta.
export const AREA_PALETTES: Record<AreaType, AreaPalette> = {
  office: {
    floor: 0xdfe7f1,
    wall: 0x8fa3bf,
    accent: 0x4f7cac,
    pattern: "tiles",
    patternColor: 0xc3cfe0,
  },
  production_floor: {
    floor: 0xcfcac1,
    wall: 0x7a746a,
    accent: 0xe0a030,
    pattern: "grid",
    patternColor: 0xb8b2a7,
  },
  warehouse: {
    floor: 0xd9c7a3,
    wall: 0x8a7550,
    accent: 0xb5651d,
    pattern: "grid",
    patternColor: 0xc2ae86,
  },
  loading_dock: {
    floor: 0x9aa3ad,
    wall: 0x5f6b78,
    accent: 0xf2994a,
    pattern: "dashes",
    patternColor: 0xf2c94c,
  },
  corridor: {
    floor: 0xcfd8dc,
    wall: 0x78909c,
    accent: 0x607d8b,
    pattern: "stripes",
    patternColor: 0xb7c3c9,
  },
  reception: {
    floor: 0xefe3d3,
    wall: 0xa58b6f,
    accent: 0xc77d5b,
    pattern: "tiles",
    patternColor: 0xdccbb5,
  },
  laboratory: {
    floor: 0xe3f3ef,
    wall: 0x7fb3a8,
    accent: 0x2a9d8f,
    pattern: "tiles",
    patternColor: 0xc5e3dc,
  },
  custom: {
    floor: 0xd5dae3,
    wall: 0x8791a5,
    accent: 0x6c7a99,
    pattern: "dots",
    patternColor: 0xb9c1d0,
  },
};

// Colores de superposiciones ambientales
export const ENV = {
  hazardYellow: 0xf2c94c,
  hazardDark: 0x2b2b2b,
  crack: 0x3b3b3b,
  flood: 0x3b82c4,
} as const;

// Identidad por hash cuando el dato no trae color propio
export const ROLE_PALETTE: readonly number[] = [
  0x8e44ad, 0xe67e22, 0x2980b9, 0x16a085, 0xc0392b, 0xd35400, 0x27ae60,
  0x34495e,
];
export const ENTITY_PALETTE: readonly number[] = [
  0x6c7a99, 0x8d6e63, 0x5c8a8a, 0x9575cd, 0xa1887f, 0x4f8a6e,
];

/** Mezcla `a` hacia `b` (t = 0 → a, t = 1 → b). */
export function mix(a: number, b: number, t: number): number {
  const channel = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t) & 0xff;
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
