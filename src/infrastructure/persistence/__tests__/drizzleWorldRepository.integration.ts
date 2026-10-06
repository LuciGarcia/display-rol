import { after, describe } from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { describeWorldRepositoryContract } from "../../../application/persistence/__tests__/worldRepositoryContract";
import { DrizzleWorldRepository } from "../DrizzleWorldRepository";
import * as schema from "../drizzle/schema";

type Sql = ReturnType<typeof postgres>;
const url = process.env.TEST_DATABASE_URL;

function assertSafeTestDatabase(testUrl: string): void {
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL no puede ser igual a DATABASE_URL: el test vacía la tabla games.",
    );
  }
  if (!/test/i.test(new URL(testUrl).pathname)) {
    throw new Error(
      'El nombre de la base de TEST_DATABASE_URL debe contener "test".',
    );
  }
}

if (!url) {
  describe(
    "DrizzleWorldRepository (integración con PostgreSQL)",
    { skip: "Definí TEST_DATABASE_URL en .env.local para ejecutarlo." },
    () => {},
  );
} else {
  assertSafeTestDatabase(url);
  const testUrl = url;
  const repositoryConnections = new Set<Sql>();
  let migrated: Promise<void> | null = null;

  async function withConnection<T>(
    operation: (sql: Sql) => Promise<T>,
  ): Promise<T> {
    const sql = postgres(testUrl, { max: 1 });
    try {
      return await operation(sql);
    } finally {
      await sql.end();
    }
  }

  async function prepareEmptyDatabase(): Promise<void> {
    // Aplica las migraciones reales del repo: así se prueba que el esquema es reproducible
    migrated ??= withConnection((sql) =>
      migrate(drizzle(sql), { migrationsFolder: "./drizzle" }),
    );
    await migrated;
    await withConnection(async (sql) => {
      await sql`TRUNCATE TABLE games`;
    });
  }

  after(async () => {
    await Promise.all([...repositoryConnections].map((sql) => sql.end()));
  });

  describeWorldRepositoryContract(
    "DrizzleWorldRepository + PostgreSQL",
    async () => {
      await prepareEmptyDatabase();
      let current: Sql | null = null;
      return {
        // Cada open() es un repositorio con conexión NUEVA y libera la anterior:
        // lo que sigue existiendo vive solo en PostgreSQL (prueba de durabilidad).
        open() {
          if (current) void current.end();
          current = postgres(testUrl, { max: 1 });
          repositoryConnections.add(current);
          return new DrizzleWorldRepository(drizzle(current, { schema }));
        },
        // Inserta una fila saltándose el repositorio, para simular datos corruptos
        plantRaw: (id, raw) =>
          withConnection(async (sql) => {
            await sql`INSERT INTO games (id, name, world_json, created_at, updated_at) VALUES (${id}, 'corrupta', ${raw}, now(), now())`;
          }),
      };
    },
  );
}
