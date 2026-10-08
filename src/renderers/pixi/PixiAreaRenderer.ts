import { Container, Graphics } from "pixi.js";
import { Area } from "../../domain/world/area";
import {
  fitText,
  estimateTextWidth,
  hashString,
  resolveAreaVisual,
} from "../visual/semantics";
import { INK, METRICS, TONES, mix } from "../visual/theme";
import { drawFlood, drawFloorPattern, drawHazard } from "./areaDecor";
import { drawPill, makeText } from "./PixiText";

export interface AreaLayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PixiAreaRenderer {
  // Composición por capas: sombra → pared → suelo → patrón → ambiente → cabecera → selección.
  // Todo se deriva de area.type y area.state; nada depende de ids ni nombres.
  public static renderArea(
    area: Area,
    bounds: AreaLayoutBounds,
    isSelected: boolean,
    onSelect?: (areaId: string) => void,
  ): Container {
    const { width, height } = bounds;
    const visual = resolveAreaVisual(area);
    const { palette } = visual;
    const r = METRICS.radius;
    const floorY = METRICS.wall;

    const container = new Container();
    container.x = bounds.x;
    container.y = bounds.y;
    container.label = area.id;
    container.eventMode = "static";
    container.cursor = "pointer";

    const floorColor = visual.dark
      ? mix(palette.floor, INK.night, METRICS.darkMix)
      : palette.floor;
    const wallColor = visual.dark
      ? mix(palette.wall, INK.night, 0.6)
      : palette.wall;
    const patternColor = visual.dark
      ? mix(palette.patternColor, INK.night, 0.5)
      : palette.patternColor;

    const shape = new Graphics();
    // Sombra proyectada + pared (da profundidad sin 3D)
    shape.roundRect(3, METRICS.shadowOffset, width, height, r);
    shape.fill({ color: INK.shadow, alpha: 0.38 });
    shape.roundRect(0, 0, width, height, r);
    shape.fill({ color: wallColor });
    // Suelo
    shape.roundRect(0, floorY, width, height - floorY, r);
    shape.fill({ color: floorColor });
    drawFloorPattern(
      shape,
      palette.pattern,
      4,
      floorY + 4,
      width - 8,
      height - floorY - 8,
      patternColor,
    );
    container.addChild(shape);

    // Ambiente: composición genérica de superposiciones
    const environment = new Graphics();
    if (visual.overlays.includes("flood"))
      drawFlood(environment, width, height);
    if (visual.overlays.includes("hazard")) {
      drawHazard(
        environment,
        width,
        height,
        hashString(`${bounds.x}:${bounds.y}`),
      );
    }
    if (visual.dark) {
      environment.roundRect(0, floorY, width, height - floorY, r);
      environment.fill({ color: INK.night, alpha: 0.28 });
    }
    container.addChild(environment);

    // Borde: el tono del estado comunica gravedad; si no, el acento del tipo de área
    const edgeColor =
      visual.tone === "critical" || visual.tone === "warning"
        ? TONES[visual.tone]
        : palette.accent;
    const edge = new Graphics();
    edge.roundRect(0, floorY, width, height - floorY, r);
    edge.stroke({ color: edgeColor, width: 2, alpha: 0.9 });
    container.addChild(edge);

    // Cabecera: título + chip de estado
    const textColor = visual.dark ? INK.light : INK.dark;
    const chipText = visual.statusLabel
      ? fitText(visual.statusLabel, width * 0.45, 10, true)
      : null;
    const chipWidth = chipText ? estimateTextWidth(chipText, 10, true) + 18 : 0;
    const title = makeText(
      fitText(area.name, width - chipWidth - 36, 13, true),
      13,
      textColor,
      true,
    );
    title.x = 14;
    title.y = floorY + 9;
    container.addChild(title);

    if (chipText) {
      const chip = new Graphics();
      const cx = width - chipWidth - 10;
      const cy = floorY + 9;
      drawPill(chip, cx, cy, chipWidth, METRICS.chipHeight, TONES[visual.tone]);
      container.addChild(chip);
      const label = makeText(chipText, 10, INK.white, true);
      label.x = cx + 9;
      label.y = cy + 3;
      container.addChild(label);
    }

    // Insignias de condiciones ambientales (abajo a la izquierda)
    let bx = 12;
    const by =
      height -
      METRICS.chipHeight -
      (visual.overlays.includes("hazard") ? 18 : 8);
    for (const badge of visual.badges) {
      const text = makeText(badge.label, 9, INK.white, true);
      const w = estimateTextWidth(badge.label, 9, true) + 14;
      if (bx + w > width - 8) break;
      const pill = new Graphics();
      drawPill(pill, bx, by, w, METRICS.chipHeight, TONES[badge.tone]);
      container.addChild(pill);
      text.x = bx + 7;
      text.y = by + 4;
      container.addChild(text);
      bx += w + 6;
    }

    // Hover y selección (solo con interacción: el Display no pasa onSelect)
    const hover = new Graphics();
    hover.roundRect(-3, floorY - 3, width + 6, height - floorY + 6, r + 3);
    hover.stroke({ color: INK.select, width: 2, alpha: 0.45 });
    hover.visible = false;
    container.addChild(hover);

    if (isSelected) {
      const glow = new Graphics();
      for (const [grow, w, alpha] of [
        [2, 3, 1],
        [6, 5, 0.3],
        [10, 8, 0.12],
      ] as const) {
        glow.roundRect(
          -grow,
          floorY - grow,
          width + grow * 2,
          height - floorY + grow * 2,
          r + grow,
        );
        glow.stroke({ color: INK.select, width: w, alpha });
      }
      container.addChild(glow);
    }

    if (onSelect) {
      container.on("pointertap", (e) => {
        e.stopPropagation();
        onSelect(area.id);
      });
      container.on("pointerover", () => (hover.visible = true));
      container.on("pointerout", () => (hover.visible = false));
    }
    return container;
  }
}
