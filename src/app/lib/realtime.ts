import type { WorldReader } from "@/application/realtime/WorldSync";
import { createBrowserWorldSubscriber } from "@/infrastructure/realtime/browserSubscriber";
import { worldLifecycle } from "@/app/lib/worldLifecycle";

// Raíz de composición del Player (navegador). Instancias estables para los efectos de React.
export const worldSubscriber = createBrowserWorldSubscriber();
// Lector de solo lectura: reutiliza el servicio de ciclo de vida (mismo adaptador HTTP y mismos errores).
export const worldReader: WorldReader = {
  getById: (id) => worldLifecycle.load(id),
};
