import { Graphics, Text, TextStyle } from "pixi.js";
import { FONT } from "../visual/theme";

// Texto con la tipografía del tema y resolución doble (nítido con zoom).
export function makeText(
  text: string,
  fontSize: number,
  fill: number,
  bold = false,
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT,
      fontSize,
      fill,
      fontWeight: bold ? "700" : "400",
    }),
    resolution: 2,
  });
}

export function drawPill(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha = 1,
): void {
  g.roundRect(x, y, width, height, height / 2);
  g.fill({ color, alpha });
}
