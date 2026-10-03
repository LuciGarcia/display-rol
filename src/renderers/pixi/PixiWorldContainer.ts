import { Container } from "pixi.js";

export class PixiWorldContainer extends Container {
  public clearAll(): void {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
  }
}
