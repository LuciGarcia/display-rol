# display-rol

Tablero de rol visual: un Master controla un `World` dinámico que se dibuja con Pixi.

```text
Master → AIProvider → AIProposal → Zod → Commands → WorldEngine → World → LayoutEngine → AssetResolver → Pixi
```

## Requisitos

- Node.js 20.9 o superior (requisito de Next 16)
- npm
- PostgreSQL

## Instalación

```bash
npm install
```

## Configuración del entorno

Copia la plantilla y completa tus valores locales (`.env.local` está ignorado por Git):

```bash
# macOS / Linux
cp .env.example .env.local
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

`DATABASE_URL` debe apuntar a tu instancia local de PostgreSQL, por ejemplo:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/display_rol
```

La base de datos debe existir antes de migrar (`CREATE DATABASE display_rol;`).

## Persistencia

```text
WorldRepository (puerto)
       ↓
DrizzleWorldRepository
       ↓
Drizzle ORM
       ↓
PostgreSQL
```

El navegador no accede a la base: usa `HttpWorldRepository`, que llama a `/api/worlds`.
Drizzle y `DATABASE_URL` solo existen en el servidor (rutas API).
`InMemoryWorldRepository` se mantiene para tests.

## Tiempo real (Pusher)

El Master modifica el `World`; al persistirse, el servidor publica `WORLD_UPDATED` en el canal
`game-{World.id}`. El Display (`/display/{World.id}`) carga el World persistido, escucha ese canal,
valida cada mensaje con `WorldSchema` y descarta lo que no sea más nuevo que lo mostrado
(`metadata.updatedAt`). Al reconectar vuelve a leer el World persistido.

```text
Master → WorldEngine → World → /api/worlds (PostgreSQL) → publicar → Pusher → Display → Layout → Assets → Pixi
```

Variables (ver `.env.example`): `PUSHER_APP_ID` y `PUSHER_SECRET` son solo de servidor;
`NEXT_PUBLIC_PUSHER_KEY` y `NEXT_PUBLIC_PUSHER_CLUSTER` son públicas. Sin ellas la app funciona
sin difusión en vivo.

## Migraciones

Schema: `src/infrastructure/persistence/drizzle/schema.ts`. Migraciones: `drizzle/`.

```bash
npm run db:generate   # genera la migración tras cambiar el schema
npm run db:migrate    # aplica las migraciones a la base de DATABASE_URL
```

## Desarrollo

```bash
npm run dev
```

## Tests

```bash
npm test                  # unitarios (no requieren PostgreSQL)
npm run test:integration  # requieren PostgreSQL (TEST_DATABASE_URL en .env.local)
```
