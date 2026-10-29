import { Container, Graphics } from "pixi.js";
import type {
  CirculationLayout,
  OpeningLayout,
  Rect,
  WallLayout,
} from "../../engine/layout/types";
import { BUILDING, INK } from "../visual/theme";

// Dibuja la construcción física que el LayoutEngine ya calculó: no decide ninguna posición.
export class PixiBuildingRenderer {
  // Debajo de las áreas: sombra proyectada del conjunto + suelo de circulación.
  public static renderFloor(
    areas: readonly Rect[],
    circulation: readonly CirculationLayout[],
  ): Container {
    const container = new Container();
    container.label = "building-floor";
    const g = new Graphics();

    for (const r of [...areas, ...circulation]) {
      g.rect(r.x + BUILDING.shadowX, r.y + BUILDING.shadowY, r.width, r.height);
    }
    g.fill({ color: INK.shadow, alpha: BUILDING.shadowAlpha });

    for (const c of circulation) g.rect(c.x, c.y, c.width, c.height);
    g.fill({ color: BUILDING.circulationFloor });

    // Línea guía discontinua a lo largo del eje mayor de cada pasillo
    for (const c of circulation) {
      if (c.width >= c.height) {
        const y = c.y + c.height / 2;
        for (let x = c.x + 14; x < c.x + c.width - 24; x += 28)
          g.moveTo(x, y).lineTo(x + 14, y);
      } else {
        const x = c.x + c.width / 2;
        for (let y = c.y + 14; y < c.y + c.height - 24; y += 28)
          g.moveTo(x, y).lineTo(x, y + 14);
      }
    }
    g.stroke({ color: BUILDING.circulationLine, width: 2, alpha: 0.8 });

    container.addChild(g);
    return container;
  }

  // Encima de las áreas: muros (ya con los huecos descontados) y marcas de puerta.
  public static renderWalls(
    walls: readonly WallLayout[],
    openings: readonly OpeningLayout[],
  ): Container {
    const container = new Container();
    container.label = "building-walls";
    const t = BUILDING.wallThickness;
    const g = new Graphics();

    // Se prolonga medio grosor en cada extremo: las esquinas y las jambas quedan cerradas
    for (const w of walls) {
      if (w.y1 === w.y2) g.rect(w.x1 - t / 2, w.y1 - t / 2, w.x2 - w.x1 + t, t);
      else g.rect(w.x1 - t / 2, w.y1 - t / 2, t, w.y2 - w.y1 + t);
    }
    g.fill({ color: BUILDING.wall });

    for (const o of openings) {
      const horizontal = o.orientation === "h";
      const x2 = horizontal ? o.x + o.length : o.x;
      const y2 = horizontal ? o.y : o.y + o.length;
      g.rect(o.x - t / 2, o.y - t / 2, t, t);
      g.rect(x2 - t / 2, y2 - t / 2, t, t);
    }
    g.fill({ color: BUILDING.doorJamb });

    for (const o of openings) {
      g.moveTo(o.x, o.y).lineTo(
        o.orientation === "h" ? o.x + o.length : o.x,
        o.orientation === "h" ? o.y : o.y + o.length,
      );
    }
    g.stroke({ color: BUILDING.doorSill, width: 2, alpha: 0.9 });

    container.addChild(g);
    return container;
  }
}
