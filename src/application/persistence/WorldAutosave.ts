import type { World } from "../../domain/world/world";
import type { WorldLifecycleService } from "./WorldLifecycleService";

export type AutosaveOutcome = "saved" | "skipped";

// Decide CUÁNDO se persiste un snapshot del World (una única estrategia, sin lógica de
// guardado en cada acción del Master) y garantiza que los guardados se apliquen en el
// orden en que se generaron los snapshots.
//
// Un World recién cargado desde el almacenamiento ya es idéntico a lo guardado: volver a
// escribirlo no aporta nada y, con una base real, sería una escritura (y un posible
// pisado de datos) producida solo por abrir la partida.
export class WorldAutosave {
  private justLoaded: { id: string; updatedAt: string } | null = null;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly service: WorldLifecycleService) {}

  /** Declara que `world` acaba de leerse del almacenamiento: su próxima notificación no se guarda. */
  markLoaded(world: World): void {
    this.justLoaded = { id: world.id, updatedAt: world.metadata.updatedAt };
  }

  /** Notifica un snapshot nuevo del World. Rechaza si el guardado falla; la cola sigue viva. */
  notify(world: World): Promise<AutosaveOutcome> {
    const marker = this.justLoaded;
    this.justLoaded = null; // de un solo uso: cualquier cambio posterior sí se guarda
    if (
      marker &&
      marker.id === world.id &&
      marker.updatedAt === world.metadata.updatedAt
    ) {
      return Promise.resolve("skipped");
    }

    const run = this.tail
      .then(() => this.service.persist(world))
      .then((): AutosaveOutcome => "saved");
    this.tail = run.catch(() => undefined);
    return run;
  }
}
