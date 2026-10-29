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
  // Composición por capas: suelo → patrón → acento → ambiente → cabecera → selección.
  // El área es solo suelo: los muros, las puertas y la sombra los dibuja PixiBuildingRenderer.
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
    const inset = METRICS.inset;
    const innerW = width - 2 * inset;
    const innerH = height - 2 * inset;

    const container = new Container();
    container.x = bounds.x;
    container.y = bounds.y;
    container.label = area.id;
    container.eventMode = "static";
    container.cursor = "pointer";

    const floorColor = visual.dark
      ? mix(palette.floor, INK.night, METRICS.darkMix)
      : palette.floor;
    const patternColor = visual.dark
      ? mix(palette.patternColor, INK.night, 0.5)
      : palette.patternColor;

    const shape = new Graphics();
    shape.rect(0, 0, width, height);
    shape.fill({ color: floorColor });
    drawFloorPattern(
      shape,
      palette.pattern,
      inset,
      inset,
      innerW,
      innerH,
      patternColor,
    );
    // Franja de acento: identifica el tipo de área sin necesitar una "tarjeta"
    shape.rect(inset, inset, innerW, 3);
    shape.fill({ color: palette.accent, alpha: 0.9 });
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
      environment.rect(0, 0, width, height);
      environment.fill({ color: INK.night, alpha: 0.28 });
    }
    container.addChild(environment);

    // El tono del estado comunica gravedad con un borde interior (el muro marca el límite)
    if (visual.tone === "critical" || visual.tone === "warning") {
      const edge = new Graphics();
      edge.rect(inset + 1, inset + 1, innerW - 2, innerH - 2);
      edge.stroke({ color: TONES[visual.tone], width: 2, alpha: 0.9 });
      container.addChild(edge);
    }

    // Cabecera: título + chip de estado
    const textColor = visual.dark ? INK.light : INK.dark;
    const chipText = visual.statusLabel
      ? fitText(visual.statusLabel, width * 0.45, 10, true)
      : null;
    const chipWidth = chipText ? estimateTextWidth(chipText, 10, true) + 18 : 0;
    const title = makeText(
      fitText(area.name, width - chipWidth - 2 * inset - 28, 13, true),
      13,
      textColor,
      true,
    );
    title.x = inset + 10;
    title.y = inset + 9;
    container.addChild(title);

    if (chipText) {
      const chip = new Graphics();
      const cx = width - chipWidth - inset - 8;
      const cy = inset + 9;
      drawPill(chip, cx, cy, chipWidth, METRICS.chipHeight, TONES[visual.tone]);
      container.addChild(chip);
      const label = makeText(chipText, 10, INK.white, true);
      label.x = cx + 9;
      label.y = cy + 3;
      container.addChild(label);
    }

    // Insignias de condiciones ambientales (abajo a la izquierda)
    let bx = inset + 8;
    const by =
      height -
      inset -
      METRICS.chipHeight -
      (visual.overlays.includes("hazard") ? 18 : 6);
    for (const badge of visual.badges) {
      const text = makeText(badge.label, 9, INK.white, true);
      const w = estimateTextWidth(badge.label, 9, true) + 14;
      if (bx + w > width - inset - 6) break;
      const pill = new Graphics();
      drawPill(pill, bx, by, w, METRICS.chipHeight, TONES[badge.tone]);
      container.addChild(pill);
      text.x = bx + 7;
      text.y = by + 4;
      container.addChild(text);
      bx += w + 6;
    }

    // Hover y selección: siempre DENTRO del área (los muros vecinos quedan encima)
    const hover = new Graphics();
    hover.rect(inset + 1, inset + 1, innerW - 2, innerH - 2);
    hover.stroke({ color: INK.select, width: 2, alpha: 0.5 });
    hover.visible = false;
    container.addChild(hover);

    if (isSelected) {
      const glow = new Graphics();
      glow.rect(0, 0, width, height);
      glow.fill({ color: INK.select, alpha: 0.1 });
      for (const [grow, w, alpha] of [
        [1, 3, 1],
        [5, 4, 0.35],
        [9, 6, 0.15],
      ] as const) {
        glow.rect(
          inset + grow,
          inset + grow,
          innerW - 2 * grow,
          innerH - 2 * grow,
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
