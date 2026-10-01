import { Container } from "pixi.js";

export interface CameraOptions {
  minZoom?: number;
  maxZoom?: number;
}

export class PixiCamera {
  private container: Container;
  private minZoom: number;
  private maxZoom: number;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };

  constructor(container: Container, options?: CameraOptions) {
    this.container = container;
    this.minZoom = options?.minZoom ?? 0.5;
    this.maxZoom = options?.maxZoom ?? 2.5;
  }

  public setZoom(zoomFactor: number, focusX?: number, focusY?: number): void {
    const clampedZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, zoomFactor),
    );
    this.container.scale.set(clampedZoom);
  }

  public getZoom(): number {
    return this.container.scale.x;
  }

  public pan(dx: number, dy: number): void {
    this.container.x += dx;
    this.container.y += dy;
  }

  public resetPosition(): void {
    this.container.x = 0;
    this.container.y = 0;
    this.container.scale.set(1);
  }
}
