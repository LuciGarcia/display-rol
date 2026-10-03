import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { Entity } from "../../domain/world/entity";
import type { SlotLayout } from "../../engine/layout/types";
import type { ResolvedAsset } from "../../assets/types";
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
    const container = new Container();
    container.x = slot.x;
    container.y = slot.y;

    // Placeholder neutro: no conoce tipos de entidad
    const placeholder = new Container();
    const shape = new Graphics();
    shape.rect(BOX.x, BOX.y, BOX.width, BOX.height);
    shape.fill({ color: 0x7f8c8d });
    shape.stroke({ color: 0x2c3e50, width: 1 });
    placeholder.addChild(shape);
    container.addChild(placeholder);

    const label = new Text({
      text: entity.name,
      style: new TextStyle({
        fontSize: 10,
        fill: "#ffffff",
        fontFamily: "Arial",
      }),
    });
    label.x = 2;
    label.y = BOX.height + 2;
    container.addChild(label);

    if (asset)
      applyAsset({ container, placeholder, asset, box: BOX, loadTexture });
    return container;
  }
}
