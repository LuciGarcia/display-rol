import { Application } from "pixi.js";
import { World } from "../../domain/world/world";
import type { LayoutResult } from "../../engine/layout/types";
import { PixiWorldContainer } from "./PixiWorldContainer";
import { PixiAreaRenderer } from "./PixiAreaRenderer";
import { PixiEntityRenderer } from "./PixiEntityRenderer";
import { PixiRoleRenderer } from "./PixiRoleRenderer";
import { PixiCamera } from "./PixiCamera";
import {
  EMPTY_RESOLVED_ASSETS,
  type ResolvedWorldAssets,
} from "../../assets/types";
import { PixiBoardRenderer } from "./PixiBoardRenderer";
import { BOARD } from "../visual/theme";

function need<T>(map: Map<string, T>, id: string, label: string): T {
  const value = map.get(id);
  if (!value) {
    throw new Error(
      `PixiWorldRenderer: el layout no contiene ${label} "${id}"`,
    );
  }
  return value;
}

export class PixiWorldRenderer {
  private app: Application | null = null;
  private worldContainer: PixiWorldContainer;
  private camera: PixiCamera | null = null;
  private selectedAreaId: string | null = null;
  private onAreaSelectedCallback?: (areaId: string) => void;

  constructor() {
    this.worldContainer = new PixiWorldContainer();
  }

  public async init(containerElement: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resizeTo: containerElement,
      backgroundColor: BOARD.background,
      antialias: true,
    });

    containerElement.appendChild(this.app.canvas);
    this.app.stage.addChild(this.worldContainer);
    this.camera = new PixiCamera(this.worldContainer);
  }

  public getCamera(): PixiCamera | null {
    return this.camera;
  }

  public setSelectedArea(areaId: string | null): void {
    this.selectedAreaId = areaId;
  }

  public setOnAreaSelectedListener(callback?: (areaId: string) => void): void {
    this.onAreaSelectedCallback = callback;
  }

  public render(
    world: World,
    layout: LayoutResult,
    assets: ResolvedWorldAssets = EMPTY_RESOLVED_ASSETS,
  ): void {
    const areaBy = new Map(layout.areas.map((l) => [l.id, l]));
    const entityBy = new Map(layout.entities.map((l) => [l.id, l]));
    const roleBy = new Map(layout.roles.map((l) => [l.id, l]));

    const areas = world.areas.map((area) => ({
      area,
      bounds: need(areaBy, area.id, "el área"),
    }));
    const entities = world.entities.map((entity) => ({
      entity,
      slot: need(entityBy, entity.id, "la entidad"),
    }));
    const roles = world.roleInstances.map((role) => ({
      role,
      slot: need(roleBy, role.id, "el rol"),
    }));

    this.worldContainer.clearAll();
    this.worldContainer.addChild(PixiBoardRenderer.renderBoard(layout.areas));

    for (const { area, bounds } of areas) {
      this.worldContainer.addChild(
        PixiAreaRenderer.renderArea(
          area,
          bounds,
          this.selectedAreaId === area.id,
          this.onAreaSelectedCallback,
        ),
      );
    }
    for (const { entity, slot } of entities) {
      this.worldContainer.addChild(
        PixiEntityRenderer.renderEntity(
          entity,
          slot,
          assets.entities.get(entity.id) ?? null,
        ),
      );
    }
    for (const { role, slot } of roles) {
      this.worldContainer.addChild(
        PixiRoleRenderer.renderRole(
          role,
          slot,
          assets.roles.get(role.id) ?? null,
        ),
      );
    }
  }

  public destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
