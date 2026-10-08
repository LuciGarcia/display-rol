import { Container, Graphics } from "pixi.js";
import type { Entity } from "../../domain/world/entity";
import type { SlotLayout } from "../../engine/layout/types";
import type { ResolvedAsset } from "../../assets/types";
import {
  estimateTextWidth,
  fitText,
  resolveEntityVisual,
} from "../visual/semantics";
import { INK, TONES, mix } from "../visual/theme";
import { drawPill, makeText } from "./PixiText";
import {
  applyAsset,
  defaultTextureLoader,
  type TextureLoader,
} from "./spriteAsset";

const BOX = { x: 0, y: 0, width: 60, height: 40 };

export class PixiEntityRenderer {
  public static renderEntity(
    entity: Entity,
    slot: SlotLayout,
    asset: ResolvedAsset | null = null,
    loadTexture: TextureLoader = defaultTextureLoader,
  ): Container {
    const visual = resolveEntityVisual(entity);
    const container = new Container();
    container.x = slot.x;
    container.y = slot.y;

    // Sombra de contacto: ancla el objeto al suelo (siempre debajo del sprite)
    const shadow = new Graphics();
    shadow.ellipse(BOX.width / 2, BOX.height - 1, 28, 6);
    shadow.fill({ color: INK.shadow, alpha: 0.28 });
    container.addChild(shadow);

    // Placeholder genérico: color estable por tipo + inicial. No conoce tipos concretos.
    const placeholder = new Container();
    const body = new Graphics();
    body.roundRect(BOX.x, BOX.y, BOX.width, BOX.height - 4, 6);
    body.fill({ color: visual.color });
    body.stroke({ color: mix(visual.color, INK.shadow, 0.35), width: 2 });
    placeholder.addChild(body);
    const initial = makeText(visual.initial, 16, INK.white, true);
    initial.anchor.set(0.5);
    initial.x = BOX.width / 2;
    initial.y = (BOX.height - 4) / 2;
    placeholder.addChild(initial);
    container.addChild(placeholder);

    // Etiqueta con fondo: legible sobre cualquier suelo
    const text = fitText(entity.name, slot.width - 8, 10);
    const labelWidth = estimateTextWidth(text, 10) + 12;
    const pill = new Graphics();
    drawPill(pill, 0, BOX.height + 3, labelWidth, 16, INK.pill, 0.78);
    container.addChild(pill);
    const label = makeText(text, 10, INK.white);
    label.x = 6;
    label.y = BOX.height + 6;
    container.addChild(label);

    // Insignia de condición (dañado / roto)
    if (visual.badge) {
      const badge = new Graphics();
      badge.circle(BOX.width - 3, 3, 8);
      badge.fill({ color: TONES[visual.badge] });
      badge.stroke({ color: INK.white, width: 1.5 });
      container.addChild(badge);
      const mark = makeText("!", 11, INK.white, true);
      mark.anchor.set(0.5);
      mark.x = BOX.width - 3;
      mark.y = 3;
      container.addChild(mark);
    }

    if (asset)
      applyAsset({ container, placeholder, asset, box: BOX, loadTexture });
    return container;
  }
}
