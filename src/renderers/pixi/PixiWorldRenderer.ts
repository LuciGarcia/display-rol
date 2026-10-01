import { Application } from "pixi.js";
import { World } from "../../domain/world/world";
import { PixiWorldContainer } from "./PixiWorldContainer";
import { PixiAreaRenderer, AreaLayoutBounds } from "./PixiAreaRenderer";
import { PixiEntityRenderer } from "./PixiEntityRenderer";
import { PixiRoleRenderer } from "./PixiRoleRenderer";
import { PixiCamera } from "./PixiCamera";

export class PixiWorldRenderer {
  private app: Application | null = null;
  private worldContainer: PixiWorldContainer;
  private camera: PixiCamera | null = null;

  // Mapa de disposición estático temporal (sin contaminar el Dominio)
  private areaLayouts: Record<string, AreaLayoutBounds> = {
    office: { x: 50, y: 50, width: 280, height: 200 },
    "production-floor": { x: 360, y: 50, width: 420, height: 320 },
    production_floor: { x: 360, y: 50, width: 420, height: 320 },
    warehouse: { x: 50, y: 280, width: 280, height: 220 },
  };

  constructor() {
    this.worldContainer = new PixiWorldContainer();
  }

  public async init(containerElement: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resizeTo: containerElement,
      backgroundColor: 0x34495e,
      antialias: true,
    });

    containerElement.appendChild(this.app.canvas);
    this.app.stage.addChild(this.worldContainer);
    this.camera = new PixiCamera(this.worldContainer);
  }

  public getCamera(): PixiCamera | null {
    return this.camera;
  }

  public render(world: World): void {
    this.worldContainer.clearAll();

    const areaOrigins: Record<string, { x: number; y: number }> = {};

    // 1. Renderizar Áreas
    for (const area of world.areas) {
      const bounds = this.areaLayouts[area.id] ?? {
        x: 50,
        y: 50,
        width: 200,
        height: 200,
      };
      areaOrigins[area.id] = { x: bounds.x, y: bounds.y };

      const areaGraphics = PixiAreaRenderer.renderArea(area, bounds);
      this.worldContainer.addChild(areaGraphics);
    }

    // 2. Renderizar Entidades
    for (const entity of world.entities) {
      const origin = areaOrigins[entity.areaId] ?? { x: 50, y: 50 };
      const entityGraphics = PixiEntityRenderer.renderEntity(entity, origin);
      this.worldContainer.addChild(entityGraphics);
    }

    // 3. Renderizar Roles
    for (const role of world.roleInstances) {
      const origin = areaOrigins[role.areaId] ?? { x: 50, y: 50 };
      const roleGraphics = PixiRoleRenderer.renderRole(role, origin);
      this.worldContainer.addChild(roleGraphics);
    }
  }

  public destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
