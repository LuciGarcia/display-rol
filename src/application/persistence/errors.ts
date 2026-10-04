export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceError";
  }
}

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
