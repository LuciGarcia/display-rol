import type { Graphics } from "pixi.js";
import { ENV, type FloorPattern } from "../visual/theme";

// Decoración procedural reutilizable. Todo se compone por patrones y superposiciones genéricas:
// ningún tipo de escenario tiene su propio dibujo.

const STEP = 24;

export function drawFloorPattern(
  g: Graphics,
  kind: FloorPattern,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): void {
  switch (kind) {
    case "grid": {
      for (let px = x + STEP; px < x + width; px += STEP)
        g.moveTo(px, y).lineTo(px, y + height);
      for (let py = y + STEP; py < y + height; py += STEP)
        g.moveTo(x, py).lineTo(x + width, py);
      g.stroke({ color, width: 1, alpha: 0.55 });
      break;
    }
    case "tiles": {
      const size = STEP * 1.5;
      for (let i = 0, px = x; px < x + width; i++, px += size) {
        for (let j = 0, py = y; py < y + height; j++, py += size) {
          if ((i + j) % 2 === 0) {
            g.rect(
              px,
              py,
              Math.min(size, x + width - px),
              Math.min(size, y + height - py),
            );
          }
        }
      }
      g.fill({ color, alpha: 0.35 });
      break;
    }
    case "stripes": {
      for (let py = y + 14; py < y + height; py += 14)
        g.moveTo(x, py).lineTo(x + width, py);
      g.stroke({ color, width: 2, alpha: 0.6 });
      break;
    }
    case "dashes": {
      const cy = y + height / 2;
      for (let px = x + 10; px < x + width - 18; px += 34)
        g.moveTo(px, cy).lineTo(px + 18, cy);
      g.stroke({ color, width: 3, alpha: 0.85 });
      break;
    }
    case "dots": {
      for (let px = x + 12; px < x + width; px += STEP) {
        for (let py = y + 12; py < y + height; py += STEP)
          g.circle(px, py, 1.6);
      }
      g.fill({ color, alpha: 0.6 });
      break;
    }
  }
}

// Franja de peligro (diagonales) y grietas deterministas: la misma geometría produce el mismo dibujo.
export function drawHazard(
  g: Graphics,
  width: number,
  height: number,
  seed: number,
): void {
  const band = 10;
  g.rect(0, height - band, width, band);
  g.fill({ color: ENV.hazardDark });
  for (let px = -band; px < width; px += 20) {
    g.poly([
      px,
      height,
      px + 10,
      height,
      px + 10 + band,
      height - band,
      px + band,
      height - band,
    ]);
  }
  g.fill({ color: ENV.hazardYellow });

  let s = seed >>> 0 || 1;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let c = 0; c < 3; c++) {
    let cx = width * (0.2 + 0.3 * c) + next() * 20;
    let cy = 40 + next() * 20;
    g.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) {
      cx += (next() - 0.5) * 26;
      cy += 18 + next() * 18;
      g.lineTo(cx, Math.min(cy, height - band - 4));
    }
  }
  g.stroke({ color: ENV.crack, width: 2, alpha: 0.7 });
}

export function drawFlood(g: Graphics, width: number, height: number): void {
  const top = height * 0.62;
  g.moveTo(0, top);
  for (let px = 0; px <= width; px += 8)
    g.lineTo(px, top + Math.sin(px / 14) * 3);
  g.lineTo(width, height).lineTo(0, height).closePath();
  g.fill({ color: ENV.flood, alpha: 0.38 });
}
