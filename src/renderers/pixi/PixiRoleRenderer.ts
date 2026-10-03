import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { RoleInstance } from "../../domain/roles/role";
import type { SlotLayout } from "../../engine/layout/types";
import type { ResolvedAsset } from "../../assets/types";
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
    const container = new Container();
    container.x = slot.x + slot.width / 2;
    container.y = slot.y + radius + 2;

    const placeholder = new Container();
    const avatar = new Graphics();
    avatar.circle(0, 0, radius);
    avatar.fill({ color: 0x2ecc71 });
    avatar.stroke({ color: 0x27ae60, width: 2 });
    placeholder.addChild(avatar);

    const letter = new Text({
      text: role.name.charAt(0).toUpperCase(),
      style: new TextStyle({
        fontSize: 14,
        fill: "#ffffff",
        fontWeight: "bold",
        fontFamily: "Arial",
      }),
    });
    letter.anchor.set(0.5);
    placeholder.addChild(letter);
    container.addChild(placeholder);

    const nameLabel = new Text({
      text: role.name,
      style: new TextStyle({
        fontSize: 11,
        fill: "#2c3e50",
        fontWeight: "bold",
        fontFamily: "Arial",
      }),
    });
    nameLabel.anchor.set(0.5, 0);
    nameLabel.y = radius + 4;
    container.addChild(nameLabel);

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
