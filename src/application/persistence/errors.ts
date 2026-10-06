// Único tipo de error que la aplicación y la UI conocen del almacenamiento.
// `cause` conserva el error original del adaptador para diagnóstico, pero nunca se muestra.
export class PersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PersistenceError";
  }
}

export const STORAGE_UNAVAILABLE_MESSAGE =
  "No se pudo acceder al almacenamiento de partidas.";

export class WorldNotFoundError extends PersistenceError {
  constructor(worldId: string) {
    super(`No existe una partida guardada con ID "${worldId}".`);
    this.name = "WorldNotFoundError";
  }
}

export class WorldAlreadyExistsError extends PersistenceError {
  constructor(worldId: string) {
    super(`Ya existe una partida guardada con ID "${worldId}".`);
    this.name = "WorldAlreadyExistsError";
  }
}

// El contenido almacenado no es JSON, no tiene el formato esperado o no valida con WorldSchema.
export class InvalidPersistedWorldError extends PersistenceError {
  constructor(detail: string) {
    super(`El World persistido es inválido: ${detail}.`);
    this.name = "InvalidPersistedWorldError";
  }
}
