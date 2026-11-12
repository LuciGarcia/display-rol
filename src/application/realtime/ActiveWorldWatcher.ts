// Lado Player: averigua qué partida está activa y avisa solo cuando cambia.
// Consulta periódicamente (el Display no depende de que el tiempo real esté conectado para
// cambiar de partida). No conoce React, el proveedor de tiempo real ni el almacenamiento: solo
// necesita una fuente de lectura.
export interface ActiveWorldSource {
  getActiveId(): Promise<string | null>;
}

export interface ActiveWorldWatcherDeps {
  source: ActiveWorldSource;
  onActive(worldId: string | null): void;
  onError?(error: unknown): void;
  pollIntervalMs: number;
}

export class ActiveWorldWatcher {
  private stopped = false;
  private last: { id: string | null } | null = null; // null = aún sin lectura correcta
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: ActiveWorldWatcherDeps) {}

  start(): () => void {
    this.stopped = false;
    void this.check();
    this.timer = setInterval(() => void this.check(), this.deps.pollIntervalMs);
    return () => {
      this.stopped = true;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    };
  }

  private async check(): Promise<void> {
    try {
      const id = await this.deps.source.getActiveId();
      if (this.stopped) return;
      if (this.last === null || this.last.id !== id) {
        this.last = { id };
        this.deps.onActive(id);
      }
    } catch (error) {
      if (this.stopped) return;
      this.last = null; // tras un fallo, la próxima lectura correcta vuelve a notificarse
      this.deps.onError?.(error);
    }
  }
}
