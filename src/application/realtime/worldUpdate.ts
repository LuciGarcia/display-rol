import { z } from "zod";
import { WorldSchema, type World } from "../../domain/world/world";

// Protocolo de sincronización. El canal solo TRANSPORTA el World: no es una entidad de
// dominio ni una segunda fuente de verdad. El payload se valida siempre con WorldSchema.

export const WORLD_UPDATED = "WORLD_UPDATED";

// Los proveedores de tiempo real limitan el tamaño de cada mensaje (típicamente ~10 KB).
// Si el snapshot no cabe, se avisa solo la novedad y el Player lo lee de la persistencia.
export const MAX_INLINE_SNAPSHOT_BYTES = 8_000;

const CHANNEL_SAFE_ID = /^[A-Za-z0-9_\-=@,.;]{1,150}$/;

/** Canal de una partida. World.id es la única identidad de la partida. */
export function worldChannelName(worldId: string): string {
  if (!CHANNEL_SAFE_ID.test(worldId)) {
    throw new Error("World.id no es válido como nombre de canal");
  }
  return `game-${worldId}`;
}

export interface WorldUpdatedMessage {
  type: typeof WORLD_UPDATED;
  worldId: string;
  updatedAt: string;
  /** Snapshot completo; ausente cuando excede el tamaño del mensaje. */
  world?: World;
}

export function buildWorldUpdated(
  world: World,
  maxInlineBytes: number = MAX_INLINE_SNAPSHOT_BYTES,
): WorldUpdatedMessage {
  const valid = WorldSchema.parse(world); // nunca se anuncia un World inválido
  const message: WorldUpdatedMessage = {
    type: WORLD_UPDATED,
    worldId: valid.id,
    updatedAt: valid.metadata.updatedAt,
  };
  const size = new TextEncoder().encode(JSON.stringify(valid)).length;
  if (size <= maxInlineBytes) message.world = valid;
  return message;
}

const EnvelopeSchema = z.object({
  type: z.literal(WORLD_UPDATED),
  worldId: z.string().min(1),
  updatedAt: z.string().min(1),
  world: z.unknown().optional(),
});

export type ParsedWorldUpdate =
  | { ok: true; worldId: string; updatedAt: string; world: World | null }
  | { ok: false; reason: string };

/** Frontera: lo que llega por la red es dato no confiable. */
export function parseWorldUpdated(
  payload: unknown,
  expectedWorldId?: string,
): ParsedWorldUpdate {
  let data = payload;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { ok: false, reason: "el payload no es JSON válido" };
    }
  }
  const envelope = EnvelopeSchema.safeParse(data);
  if (!envelope.success) return { ok: false, reason: "mensaje no reconocido" };
  const { worldId, updatedAt } = envelope.data;
  if (expectedWorldId !== undefined && worldId !== expectedWorldId) {
    return { ok: false, reason: "el mensaje es de otra partida" };
  }
  if (envelope.data.world === undefined) {
    return { ok: true, worldId, updatedAt, world: null };
  }
  const world = WorldSchema.safeParse(envelope.data.world);
  if (!world.success) return { ok: false, reason: "World inválido" };
  if (world.data.id !== worldId) {
    return { ok: false, reason: "el World no coincide con la partida" };
  }
  return { ok: true, worldId, updatedAt, world: world.data };
}

/** Regla de orden: solo gana lo estrictamente más nuevo (`incoming <= current` se ignora). */
export function isNewerTimestamp(
  incoming: string,
  current: string | null,
): boolean {
  const next = Date.parse(incoming);
  if (Number.isNaN(next)) return false;
  if (current === null) return true;
  const known = Date.parse(current);
  return Number.isNaN(known) || next > known;
}

export function isNewerWorld(incoming: World, current: World | null): boolean {
  return isNewerTimestamp(
    incoming.metadata.updatedAt,
    current?.metadata.updatedAt ?? null,
  );
}
