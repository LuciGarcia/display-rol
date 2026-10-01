import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Entity } from "../../domain/world/entity";

export class PixiEntityRenderer {
  public static renderEntity(
    entity: Entity,
    areaOrigin: { x: number; y: number },
  ): Container {
    const container = new Container();
    container.x = areaOrigin.x + entity.localPosition.x;
    container.y = areaOrigin.y + entity.localPosition.y;

    const shape = new Graphics();

    let color = 0x3498db; // Azul por defecto
    let width = 40;
    let height = 30;

    switch (entity.type) {
      case "machine":
        color = 0xe74c3c; // Rojo
        width = 60;
        height = 40;
        break;
      case "pallet":
        color = 0xf39c12; // Naranja
        width = 35;
        height = 35;
        break;
      case "table":
        color = 0x9b59b6; // Púrpura
        width = 50;
        height = 25;
        break;
      case "box":
        color = 0xd35400; // Marrón
        width = 25;
        height = 25;
        break;
    }

    shape.rect(0, 0, width, height);
    shape.fill({ color });
    shape.stroke({ color: 0x2c3e50, width: 1 });
    container.addChild(shape);

    const style = new TextStyle({
      fontSize: 10,
      fill: "#ffffff",
      fontFamily: "Arial",
    });
    const label = new Text({ text: entity.name, style });
    label.x = 2;
    label.y = height + 2;
    container.addChild(label);

    return container;
  }
}
