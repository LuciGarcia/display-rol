import { Container } from "pixi.js";

export interface CameraOptions {
  minZoom?: number;
  maxZoom?: number;
}

export class PixiCamera {
  private container: Container;
  private minZoom: number;
  private maxZoom: number;

  constructor(container: Container, options?: CameraOptions) {
    this.container = container;
    this.minZoom = options?.minZoom ?? 0.5;
    this.maxZoom = options?.maxZoom ?? 2.5;
  }

  public setZoom(zoomFactor: number, focusX?: number, focusY?: number): void {
    const previousZoom = this.container.scale.x;
    const clampedZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, zoomFactor),
    );

    if (previousZoom === clampedZoom) return;

    if (focusX !== undefined && focusY !== undefined) {
      // Mantiene el punto bajo el cursor relativamente estable al hacer zoom
      const worldPos = {
        x: (focusX - this.container.x) / previousZoom,
        y: (focusY - this.container.y) / previousZoom,
      };

      this.container.scale.set(clampedZoom);

      this.container.x = focusX - worldPos.x * clampedZoom;
      this.container.y = focusY - worldPos.y * clampedZoom;
    } else {
      this.container.scale.set(clampedZoom);
    }
  }

  public getZoom(): number {
    return this.container.scale.x;
  }

  public pan(dx: number, dy: number): void {
    this.container.x += dx;
    this.container.y += dy;
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  public resetPosition(): void {
    this.container.x = 0;
    this.container.y = 0;
    this.container.scale.set(1);
  }
}
