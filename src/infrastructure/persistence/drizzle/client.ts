import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// Único punto donde se crea la conexión. Next recarga módulos en caliente en desarrollo:
// sin este caché en globalThis cada recarga abriría un pool nuevo.
const globalForDb = globalThis as unknown as { displayRolDb?: Database };

export function getDatabase(): Database {
  if (globalForDb.displayRolDb) return globalForDb.displayRolDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida.");
  globalForDb.displayRolDb = drizzle(postgres(url, { max: 5 }), { schema });
  return globalForDb.displayRolDb;
}
