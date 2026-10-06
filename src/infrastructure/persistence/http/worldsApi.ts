import type { World } from "../../../domain/world/world";
import {
  InvalidPersistedWorldError,
  STORAGE_UNAVAILABLE_MESSAGE,
  WorldAlreadyExistsError,
  WorldNotFoundError,
} from "../../../application/persistence/errors";
import {
  deserializeWorld,
  serializeWorld,
} from "../../../application/persistence/serialization";
import type { WorldRepository } from "../../../application/persistence/WorldRepository";
import { STATUS_BY_CODE, type WireError } from "./wire";

function logStorageFailure(error: unknown): void {
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause
      : error;
  const name = cause instanceof Error ? cause.name : "desconocido";
  const code = (cause as { code?: unknown } | null)?.code;
  // Solo nombre y código: nunca el mensaje, que podría traer datos de conexión
  console.error(
    "API de partidas: fallo de almacenamiento",
    name,
    typeof code === "string" ? code : "",
  );
}

function errorResponse(error: unknown): Response {
  let wire: WireError;
  if (error instanceof WorldNotFoundError) {
    wire = { code: "NOT_FOUND", message: error.message };
  } else if (error instanceof WorldAlreadyExistsError) {
    wire = { code: "ALREADY_EXISTS", message: error.message };
  } else if (error instanceof InvalidPersistedWorldError) {
    wire = { code: "INVALID_WORLD", message: error.message };
  } else {
    wire = { code: "STORAGE", message: STORAGE_UNAVAILABLE_MESSAGE };
    logStorageFailure(error);
  }
  return Response.json(wire, { status: STATUS_BY_CODE[wire.code] });
}

export function createWorldsApi(getRepository: () => WorldRepository) {
  const respond = async (
    operation: (repository: WorldRepository) => Promise<Response>,
  ) => {
    try {
      return await operation(getRepository());
    } catch (error) {
      return errorResponse(error);
    }
  };

  // El cuerpo viaja como lo produce serializeWorld y se revalida al entrar
  const worldFrom = async (
    request: Request,
    expectedId?: string,
  ): Promise<World> => {
    const world = deserializeWorld(await request.text());
    if (expectedId !== undefined && world.id !== expectedId) {
      throw new InvalidPersistedWorldError(
        "el id de la URL no coincide con el del World",
      );
    }
    return world;
  };

  return {
    list: () => respond(async (repo) => Response.json(await repo.list())),
    create: (request: Request) =>
      respond(async (repo) => {
        await repo.create(await worldFrom(request));
        return new Response(null, { status: 201 });
      }),
    get: (id: string) =>
      respond(
        async (repo) =>
          new Response(serializeWorld(await repo.getById(id)), {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    save: (id: string, request: Request) =>
      respond(async (repo) => {
        await repo.save(await worldFrom(request, id));
        return new Response(null, { status: 204 });
      }),
    remove: (id: string) =>
      respond(async (repo) => {
        await repo.delete(id);
        return new Response(null, { status: 204 });
      }),
  };
}
