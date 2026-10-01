import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Area } from "../../domain/world/area";

export interface AreaLayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PixiAreaRenderer {
  public static renderArea(area: Area, bounds: AreaLayoutBounds): Container {
    const areaContainer = new Container();
    areaContainer.x = bounds.x;
    areaContainer.y = bounds.y;

    const bg = new Graphics();
    const isLightingOff =
      area.state.lighting === "off" || area.state.lighting === false;

    const fillColor = isLightingOff ? 0x2c3e50 : 0xecf0f1;
    const borderColor = 0x7f8c8d;

    bg.rect(0, 0, bounds.width, bounds.height);
    bg.fill({ color: fillColor, alpha: 0.85 });
    bg.stroke({ color: borderColor, width: 2 });

    areaContainer.addChild(bg);

    const style = new TextStyle({
      fontSize: 14,
      fill: isLightingOff ? "#ecf0f1" : "#2c3e50",
      fontWeight: "bold",
      fontFamily: "Arial",
    });

    const titleText = new Text({ text: area.name, style });
    titleText.x = 10;
    titleText.y = 10;
    areaContainer.addChild(titleText);

    return areaContainer;
  }
}
