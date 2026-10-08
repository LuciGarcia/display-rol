import { Container, Graphics } from "pixi.js";
import type { Rect } from "../../engine/layout/types";
import { BOARD, INK } from "../visual/theme";

const MAX_DOTS = 2500;

// Tapete del tablero: superficie sobre la que "apoyan" las áreas (separa fondo y contenido).
export class PixiBoardRenderer {
  public static renderBoard(areas: readonly Rect[]): Container {
    const container = new Container();
    container.label = "board";
    if (areas.length === 0) return container;

    const left = Math.min(...areas.map((a) => a.x)) - BOARD.margin;
    const top = Math.min(...areas.map((a) => a.y)) - BOARD.margin;
    const right = Math.max(...areas.map((a) => a.x + a.width)) + BOARD.margin;
    const bottom = Math.max(...areas.map((a) => a.y + a.height)) + BOARD.margin;
    const width = right - left;
    const height = bottom - top;

    const g = new Graphics();
    g.roundRect(left, top, width, height, 24);
    g.fill({ color: BOARD.mat });
    g.stroke({ color: BOARD.matLine, width: 2 });

    // Puntos de referencia espacial; el paso crece si el mundo es muy grande
    const dots = (width / BOARD.dotStep) * (height / BOARD.dotStep);
    const step = BOARD.dotStep * Math.max(1, Math.sqrt(dots / MAX_DOTS));
    for (let x = left + step; x < right; x += step) {
      for (let y = top + step; y < bottom; y += step) g.circle(x, y, 1.5);
    }
    g.fill({ color: BOARD.matLine, alpha: 0.9 });
    g.roundRect(left, top, width, 3, 2);
    g.fill({ color: INK.white, alpha: 0.05 });
    container.addChild(g);
    return container;
  }
}
