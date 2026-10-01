import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Area } from "../../domain/world/area";

export interface AreaLayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PixiAreaRenderer {
  public static renderArea(
    area: Area,
    bounds: AreaLayoutBounds,
    isSelected: boolean,
    onSelect?: (areaId: string) => void,
  ): Container {
    const areaContainer = new Container();
    areaContainer.x = bounds.x;
    areaContainer.y = bounds.y;
    areaContainer.label = area.id;

    // Configuración de interactividad PixiJS 8
    areaContainer.eventMode = "static";
    areaContainer.cursor = "pointer";

    if (onSelect) {
      areaContainer.on("pointertap", (e) => {
        e.stopPropagation();
        onSelect(area.id);
      });
    }

    const bg = new Graphics();
    const isLightingOff =
      area.state.lighting === "off" || area.state.lighting === false;

    const fillColor = isLightingOff ? 0x2c3e50 : 0xecf0f1;
    const borderColor = isSelected ? 0x3498db : 0x7f8c8d; // Highlight azul si está seleccionada
    const borderWidth = isSelected ? 4 : 2;

    bg.rect(0, 0, bounds.width, bounds.height);
    bg.fill({ color: fillColor, alpha: 0.85 });
    bg.stroke({ color: borderColor, width: borderWidth });

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
