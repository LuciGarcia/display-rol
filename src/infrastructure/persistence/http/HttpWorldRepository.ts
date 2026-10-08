import type { World } from "../../../domain/world/world";
import {
  InvalidPersistedWorldError,
  PersistenceError,
  STORAGE_UNAVAILABLE_MESSAGE,
  WorldAlreadyExistsError,
  WorldNotFoundError,
} from "../../../application/persistence/errors";
import {
  deserializeWorld,
  serializeWorld,
} from "../../../application/persistence/serialization";
import type {
  WorldRepository,
  WorldSummary,
} from "../../../application/persistence/WorldRepository";
import { WireErrorSchema, WorldSummaryListSchema } from "./wire";

const JSON_HEADERS = { "Content-Type": "application/json" };

// Adaptador para el navegador: habla con /api/worlds, que a su vez usa el repositorio real.
export class HttpWorldRepository implements WorldRepository {
  constructor(
    private readonly baseUrl: string = "/api/worlds",
    private readonly fetchFn: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}

  async create(world: World): Promise<void> {
    await this.request(
      "",
      { method: "POST", headers: JSON_HEADERS, body: serializeWorld(world) },
      world.id,
    );
  }

  async getById(id: string): Promise<World> {
    const response = await this.request(
      `/${encodeURIComponent(id)}`,
      { method: "GET" },
      id,
    );
    return deserializeWorld(await response.text()); // el navegador también valida con WorldSchema
  }

  async save(world: World): Promise<void> {
    await this.request(
      `/${encodeURIComponent(world.id)}`,
      { method: "PUT", headers: JSON_HEADERS, body: serializeWorld(world) },
      world.id,
    );
  }

  async delete(id: string): Promise<void> {
    await this.request(`/${encodeURIComponent(id)}`, { method: "DELETE" }, id);
  }

  async list(): Promise<WorldSummary[]> {
    const response = await this.request("", { method: "GET" }, "");
    const parsed = WorldSummaryListSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success)
      throw new PersistenceError(STORAGE_UNAVAILABLE_MESSAGE);
    return parsed.data;
  }

  private async request(
    path: string,
    init: RequestInit,
    worldId: string,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, init);
    } catch (error) {
      throw new PersistenceError(STORAGE_UNAVAILABLE_MESSAGE, { cause: error });
    }
    if (response.ok) return response;
    throw await this.errorFrom(response, worldId);
  }

  private async errorFrom(
    response: Response,
    worldId: string,
  ): Promise<PersistenceError> {
    const parsed = WireErrorSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success)
      return new PersistenceError(STORAGE_UNAVAILABLE_MESSAGE);
    switch (parsed.data.code) {
      case "NOT_FOUND":
        return new WorldNotFoundError(worldId);
      case "ALREADY_EXISTS":
        return new WorldAlreadyExistsError(worldId);
      case "INVALID_WORLD":
        return new InvalidPersistedWorldError(
          "los datos de la partida no son válidos",
        );
      case "STORAGE":
        return new PersistenceError(STORAGE_UNAVAILABLE_MESSAGE);
      case "UNAUTHENTICATED":
        return new PersistenceError("Necesitás iniciar sesión como Master.");
      case "FORBIDDEN":
        return new PersistenceError(
          "No tenés permiso para modificar la partida.",
        );
    }
  }
}
