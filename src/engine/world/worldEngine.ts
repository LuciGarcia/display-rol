import { World, WorldSchema } from "../../domain/world/world";
import { Command, CommandSchema } from "../../domain/events/command";
import { WorldEvent } from "../../domain/events/event";
import {
  AreaNotFoundError,
  EntityNotFoundError,
  RoleInstanceNotFoundError,
} from "./errors";

export class WorldEngine {
  private world: World;
  private eventLog: WorldEvent[] = [];

  constructor(initialWorld: World) {
    this.world = WorldSchema.parse(initialWorld);
  }

  public getWorld(): World {
    return JSON.parse(JSON.stringify(this.world));
  }

  public getEventHistory(): readonly WorldEvent[] {
    return [...this.eventLog];
  }

  public serialize(): string {
    return JSON.stringify(this.world);
  }

  public static deserialize(jsonString: string): WorldEngine {
    const parsed = JSON.parse(jsonString);
    const validated = WorldSchema.parse(parsed);
    return new WorldEngine(validated);
  }

  public executeCommand(rawCommand: unknown): WorldEvent {
    const command = CommandSchema.parse(rawCommand);
    const timestamp = new Date().toISOString();

    switch (command.type) {
      case "MOVE_ROLE": {
        const role = this.world.roleInstances.find(
          (r) => r.id === command.roleInstanceId,
        );
        if (!role) throw new RoleInstanceNotFoundError(command.roleInstanceId);

        const targetArea = this.world.areas.find(
          (a) => a.id === command.targetAreaId,
        );
        if (!targetArea) throw new AreaNotFoundError(command.targetAreaId);

        const fromAreaId = role.areaId;
        const newLocalPos = command.localPosition ?? role.localPosition;

        role.areaId = targetArea.id;
        role.localPosition = newLocalPos;

        const event: WorldEvent = {
          type: "ROLE_MOVED",
          timestamp,
          roleInstanceId: role.id,
          fromAreaId,
          toAreaId: targetArea.id,
          localPosition: newLocalPos,
        };

        this.eventLog.push(event);
        return event;
      }

      case "SET_STATE": {
        let previousValue: unknown = undefined;

        if (command.targetType === "WORLD") {
          previousValue = this.world.state[command.key];
          this.world.state[command.key] = command.value;
        } else if (command.targetType === "AREA") {
          const area = this.world.areas.find((a) => a.id === command.targetId);
          if (!area) throw new AreaNotFoundError(command.targetId);
          previousValue = area.state[command.key];
          area.state[command.key] = command.value;
        } else if (command.targetType === "ENTITY") {
          const entity = this.world.entities.find(
            (e) => e.id === command.targetId,
          );
          if (!entity) throw new EntityNotFoundError(command.targetId);
          previousValue = entity.state[command.key];
          entity.state[command.key] = command.value;
        }

        const event: WorldEvent = {
          type: "STATE_CHANGED",
          timestamp,
          targetType: command.targetType,
          targetId: command.targetId,
          key: command.key,
          previousValue: previousValue as any,
          newValue: command.value,
        };

        this.eventLog.push(event);
        return event;
      }

      case "ADD_ENTITY": {
        const areaExists = this.world.areas.some(
          (a) => a.id === command.entity.areaId,
        );
        if (!areaExists) throw new AreaNotFoundError(command.entity.areaId);

        this.world.entities.push(command.entity);

        const event: WorldEvent = {
          type: "ENTITY_ADDED",
          timestamp,
          entityId: command.entity.id,
          areaId: command.entity.areaId,
        };

        this.eventLog.push(event);
        return event;
      }

      case "REMOVE_ENTITY": {
        const index = this.world.entities.findIndex(
          (e) => e.id === command.entityId,
        );
        if (index === -1) throw new EntityNotFoundError(command.entityId);

        this.world.entities.splice(index, 1);

        const event: WorldEvent = {
          type: "ENTITY_REMOVED",
          timestamp,
          entityId: command.entityId,
        };

        this.eventLog.push(event);
        return event;
      }
    }
  }
}
