export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityId: string) {
    super(`Entity with ID "${entityId}" was not found.`);
  }
}

export class AreaNotFoundError extends DomainError {
  constructor(areaId: string) {
    super(`Area with ID "${areaId}" was not found.`);
  }
}

export class RoleInstanceNotFoundError extends DomainError {
  constructor(roleId: string) {
    super(`RoleInstance with ID "${roleId}" was not found.`);
  }
}
