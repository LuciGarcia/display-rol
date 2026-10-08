import { Container, Graphics } from "pixi.js";
import type { RoleInstance } from "../../domain/roles/role";
import type { SlotLayout } from "../../engine/layout/types";
import type { ResolvedAsset } from "../../assets/types";
import {
  estimateTextWidth,
  fitText,
  resolveRoleVisual,
} from "../visual/semantics";
import { INK } from "../visual/theme";
import { drawPill, makeText } from "./PixiText";
import {
  applyAsset,
  defaultTextureLoader,
  type TextureLoader,
} from "./spriteAsset";

export class PixiRoleRenderer {
  public static renderRole(
    role: RoleInstance,
    slot: SlotLayout,
    asset: ResolvedAsset | null = null,
    loadTexture: TextureLoader = defaultTextureLoader,
  ): Container {
    const radius = 16;
    const visual = resolveRoleVisual(role);
    const container = new Container();
    container.x = slot.x + slot.width / 2;
    container.y = slot.y + radius + 2;

    const shadow = new Graphics();
    shadow.ellipse(0, radius - 1, radius - 1, 5);
    shadow.fill({ color: INK.shadow, alpha: 0.3 });
    container.addChild(shadow);

    // Avatar con la identidad del rol (color propio del rol o estable por definición)
    const placeholder = new Container();
    const avatar = new Graphics();
    avatar.circle(0, 0, radius);
    avatar.fill({ color: visual.color });
    placeholder.addChild(avatar);
    const letter = makeText(visual.initial, 14, INK.white, true);
    letter.anchor.set(0.5);
    placeholder.addChild(letter);
    container.addChild(placeholder);

    // Aro de identidad: se mantiene aunque el avatar se reemplace por un asset
    const ring = new Graphics();
    ring.circle(0, 0, radius + 1);
    ring.stroke({ color: INK.white, width: 3 });
    ring.circle(0, 0, radius + 3.5);
    ring.stroke({ color: visual.color, width: 2, alpha: 0.9 });
    container.addChild(ring);

    // Nombre en una cápsula del color del rol
    const text = fitText(role.name, slot.width, 10, true);
    const width = estimateTextWidth(text, 10, true) + 14;
    const pill = new Graphics();
    drawPill(pill, -width / 2, radius + 6, width, 16, visual.color);
    container.addChild(pill);
    const name = makeText(text, 10, INK.white, true);
    name.anchor.set(0.5, 0);
    name.y = radius + 9;
    container.addChild(name);

    if (asset) {
      applyAsset({
        container,
        placeholder,
        asset,
        box: { x: -radius, y: -radius, width: radius * 2, height: radius * 2 },
        loadTexture,
      });
    }
    return container;
  }
}
