import { World, WorldSchema } from "../../domain/world/world";
import { Area, AreaSchema } from "../../domain/world/area";
import { Entity, EntitySchema, LocalPosition } from "../../domain/world/entity";
import { RoleInstance, RoleInstanceSchema } from "../../domain/roles/role";
import { Command, CommandSchema } from "../../domain/events/command";
import { WorldEvent } from "../../domain/events/event";
import { DynamicValue } from "../../domain/common/state";

import {
  AreaNotFoundError,
  AreaNotEmptyError,
  EntityNotFoundError,
  RoleInstanceNotFoundError,
  RoleDefinitionNotFoundError,
  DuplicateAreaError,
  DuplicateEntityError,
  DuplicateRoleInstanceError,
} from "./errors";

export class WorldEngine {
  private world: World;
  private eventLog: WorldEvent[] = [];

  constructor(initialWorld: World) {
    this.world = WorldSchema.parse(initialWorld);
  }

  // Snapshot defensivo temporal para garantizar inmutabilidad en lecturas
  public getWorld(): World {
    return JSON.parse(JSON.stringify(this.world));
  }

  public getEventHistory(): readonly WorldEvent[] {
    return JSON.parse(JSON.stringify(this.eventLog));
  }

  public serialize(): string {
    return JSON.stringify(this.world);
  }

  public static deserialize(jsonString: string): WorldEngine {
    const parsed = JSON.parse(jsonString);
    const validated = WorldSchema.parse(parsed);
    return new WorldEngine(validated);
  }

  // --- MÉTODOS DE DOMINIO EXPLÍCITOS ---

  public addArea(rawArea: unknown): WorldEvent {
    const area = AreaSchema.parse(rawArea);
    if (this.world.areas.some((a) => a.id === area.id)) {
      throw new DuplicateAreaError(area.id);
    }

    this.world.areas.push(area);
    const event: WorldEvent = {
      type: "AREA_ADDED",
      timestamp: new Date().toISOString(),
      area,
    };
    this.eventLog.push(event);
    return event;
  }

  public removeArea(areaId: string): WorldEvent {
    const index = this.world.areas.findIndex((a) => a.id === areaId);
    if (index === -1) {
      throw new AreaNotFoundError(areaId);
    }

    // Invariante: No se puede eliminar un área con entidades o roles
    const entityCount = this.world.entities.filter(
      (e) => e.areaId === areaId,
    ).length;
    const roleCount = this.world.roleInstances.filter(
      (r) => r.areaId === areaId,
    ).length;

    if (entityCount > 0 || roleCount > 0) {
      throw new AreaNotEmptyError(areaId, entityCount, roleCount);
    }

    this.world.areas.splice(index, 1);
    const event: WorldEvent = {
      type: "AREA_REMOVED",
      timestamp: new Date().toISOString(),
      areaId,
    };
    this.eventLog.push(event);
    return event;
  }

  public addEntity(rawEntity: unknown): WorldEvent {
    const entity = EntitySchema.parse(rawEntity);
    if (this.world.entities.some((e) => e.id === entity.id)) {
      throw new DuplicateEntityError(entity.id);
    }
    if (!this.world.areas.some((a) => a.id === entity.areaId)) {
      throw new AreaNotFoundError(entity.areaId);
    }

    this.world.entities.push(entity);
    const event: WorldEvent = {
      type: "ENTITY_ADDED",
      timestamp: new Date().toISOString(),
      entity,
    };
    this.eventLog.push(event);
    return event;
  }

  public removeEntity(entityId: string): WorldEvent {
    const index = this.world.entities.findIndex((e) => e.id === entityId);
    if (index === -1) {
      throw new EntityNotFoundError(entityId);
    }

    this.world.entities.splice(index, 1);
    const event: WorldEvent = {
      type: "ENTITY_REMOVED",
      timestamp: new Date().toISOString(),
      entityId,
    };
    this.eventLog.push(event);
    return event;
  }

  public addRoleInstance(rawRole: unknown): WorldEvent {
    const role = RoleInstanceSchema.parse(rawRole);
    if (this.world.roleInstances.some((r) => r.id === role.id)) {
      throw new DuplicateRoleInstanceError(role.id);
    }
    if (
      !this.world.roleDefinitions.some((rd) => rd.id === role.roleDefinitionId)
    ) {
      throw new RoleDefinitionNotFoundError(role.roleDefinitionId);
    }
    if (!this.world.areas.some((a) => a.id === role.areaId)) {
      throw new AreaNotFoundError(role.areaId);
    }

    this.world.roleInstances.push(role);
    const event: WorldEvent = {
      type: "ROLE_ADDED",
      timestamp: new Date().toISOString(),
      role,
    };
    this.eventLog.push(event);
    return event;
  }

  public removeRoleInstance(roleInstanceId: string): WorldEvent {
    const index = this.world.roleInstances.findIndex(
      (r) => r.id === roleInstanceId,
    );
    if (index === -1) {
      throw new RoleInstanceNotFoundError(roleInstanceId);
    }

    this.world.roleInstances.splice(index, 1);
    const event: WorldEvent = {
      type: "ROLE_REMOVED",
      timestamp: new Date().toISOString(),
      roleInstanceId,
    };
    this.eventLog.push(event);
    return event;
  }

  public moveRole(
    roleInstanceId: string,
    targetAreaId: string,
    localPosition?: { x: number; y: number; z?: number },
  ): WorldEvent {
    const role = this.world.roleInstances.find((r) => r.id === roleInstanceId);
    if (!role) {
      throw new RoleInstanceNotFoundError(roleInstanceId);
    }

    const targetArea = this.world.areas.find((a) => a.id === targetAreaId);
    if (!targetArea) {
      throw new AreaNotFoundError(targetAreaId);
    }

    const fromAreaId = role.areaId;

    const newPos: LocalPosition = localPosition
      ? {
          x: localPosition.x,
          y: localPosition.y,
          z: localPosition.z ?? role.localPosition.z ?? 0,
        }
      : role.localPosition;

    role.areaId = targetArea.id;
    role.localPosition = newPos;

    const event: WorldEvent = {
      type: "ROLE_MOVED",
      timestamp: new Date().toISOString(),
      roleInstanceId: role.id,
      fromAreaId,
      toAreaId: targetArea.id,
      localPosition: newPos,
    };
    this.eventLog.push(event);
    return event;
  }

  public setWorldState(key: string, value: DynamicValue): WorldEvent {
    const previousValue =
      key in this.world.state
        ? (this.world.state[key] as DynamicValue)
        : undefined;
    this.world.state[key] = value;

    const event: WorldEvent = {
      type: "STATE_CHANGED",
      timestamp: new Date().toISOString(),
      targetType: "WORLD",
      targetId: this.world.id,
      key,
      previousValue,
      newValue: value,
    };
    this.eventLog.push(event);
    return event;
  }

  public setAreaState(
    areaId: string,
    key: string,
    value: DynamicValue,
  ): WorldEvent {
    const area = this.world.areas.find((a) => a.id === areaId);
    if (!area) {
      throw new AreaNotFoundError(areaId);
    }

    const previousValue =
      key in area.state ? (area.state[key] as DynamicValue) : undefined;
    area.state[key] = value;

    const event: WorldEvent = {
      type: "STATE_CHANGED",
      timestamp: new Date().toISOString(),
      targetType: "AREA",
      targetId: areaId,
      key,
      previousValue,
      newValue: value,
    };
    this.eventLog.push(event);
    return event;
  }

  public setEntityState(
    entityId: string,
    key: string,
    value: DynamicValue,
  ): WorldEvent {
    const entity = this.world.entities.find((e) => e.id === entityId);
    if (!entity) {
      throw new EntityNotFoundError(entityId);
    }

    const previousValue =
      key in entity.state ? (entity.state[key] as DynamicValue) : undefined;
    entity.state[key] = value;

    const event: WorldEvent = {
      type: "STATE_CHANGED",
      timestamp: new Date().toISOString(),
      targetType: "ENTITY",
      targetId: entityId,
      key,
      previousValue,
      newValue: value,
    };
    this.eventLog.push(event);
    return event;
  }

  // --- EJECUTOR CENTRALIZADO DE COMANDOS ---

  public executeCommand(rawCommand: unknown): WorldEvent {
    const command = CommandSchema.parse(rawCommand);
    const event = this.dispatch(command);
    // metadata.updatedAt es el estado temporal del dominio: solo cambia si el comando se aplicó
    this.world.metadata.updatedAt = event.timestamp;
    return event;
  }

  private dispatch(command: Command): WorldEvent {
    switch (command.type) {
      case "MOVE_ROLE":
        return this.moveRole(
          command.roleInstanceId,
          command.targetAreaId,
          command.localPosition,
        );

      case "SET_STATE":
        if (command.targetType === "WORLD") {
          return this.setWorldState(command.key, command.value);
        } else if (command.targetType === "AREA") {
          return this.setAreaState(
            command.targetId,
            command.key,
            command.value,
          );
        } else {
          return this.setEntityState(
            command.targetId,
            command.key,
            command.value,
          );
        }

      case "ADD_ENTITY":
        return this.addEntity(command.entity);

      case "REMOVE_ENTITY":
        return this.removeEntity(command.entityId);

      case "ADD_AREA":
        return this.addArea(command.area);

      case "REMOVE_AREA":
        return this.removeArea(command.areaId);

      case "ADD_ROLE":
        return this.addRoleInstance(command.role);

      case "REMOVE_ROLE":
        return this.removeRoleInstance(command.roleInstanceId);
    }
  }
}
