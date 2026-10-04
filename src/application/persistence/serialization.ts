import { z } from "zod";
import { WorldSchema, type World } from "../../domain/world/world";
import { InvalidPersistedWorldError } from "./errors";

// Versión del formato de almacenamiento, propiedad de la capa de persistencia.
// No se usa metadata.version: es dato opcional del dominio (default "1.0.0") y no
// garantiza qué formato se escribió. Si el formato cambia, se sube este número.
export const PERSISTENCE_FORMAT_VERSION = 1;

const EnvelopeSchema = z.object({
  format: z.number().int(),
  world: z.unknown(),
});

const describeIssues = (error: z.ZodError): string =>
  error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "world"}: ${i.message}`)
    .join("; ");

export function serializeWorld(world: World): string {
  const valid = WorldSchema.safeParse(world); // nunca se persiste un World inválido
  if (!valid.success) {
    throw new InvalidPersistedWorldError(
      `no se puede guardar (${describeIssues(valid.error)})`,
    );
  }
  return JSON.stringify({
    format: PERSISTENCE_FORMAT_VERSION,
    world: valid.data,
  });
}

// Frontera: lo almacenado es dato no confiable y siempre se revalida con WorldSchema.
export function deserializeWorld(raw: string): World {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new InvalidPersistedWorldError("el contenido no es JSON válido");
  }
  const envelope = EnvelopeSchema.safeParse(data);
  if (!envelope.success) {
    throw new InvalidPersistedWorldError("falta el formato de almacenamiento");
  }
  if (envelope.data.format !== PERSISTENCE_FORMAT_VERSION) {
    throw new InvalidPersistedWorldError(
      `formato ${envelope.data.format} no soportado (se esperaba ${PERSISTENCE_FORMAT_VERSION})`,
    );
  }
  const parsed = WorldSchema.safeParse(envelope.data.world);
  if (!parsed.success) {
    throw new InvalidPersistedWorldError(describeIssues(parsed.error));
  }
  return parsed.data;
}
