import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Una fila = una partida = el World completo serializado (la unidad de persistencia).
// Los timestamps NO tienen default de base de datos: los fija el dominio
// (world.metadata.createdAt / updatedAt) y la base solo los almacena.
export const games = pgTable("games", {
  id: text("id").primaryKey(), // === World.id
  name: text("name").notNull(), // copia de world.metadata.name, solo para listar sin cargar el JSON
  worldJson: text("world_json").notNull(), // salida de serializeWorld()
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});
