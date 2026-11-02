import { WorldSchema, type World } from "../../../domain/world/world";
import type { AreaType } from "../../../domain/world/area";

// Escenarios de prueba del motor visual (solo desarrollo). Son datos semánticos del World:
// ninguna coordenada. Sirven para comprobar cantidades, tamaños y relaciones variadas.

interface AreaSpec {
  id: string;
  type: AreaType;
  name: string;
  items?: number; // entidades "machine" dentro del área
  relations?: {
    targetAreaId: string;
    type: "adjacency" | "proximity" | "access";
    strength: "preferred" | "required";
  }[];
}

function build(id: string, name: string, specs: AreaSpec[]): World {
  return WorldSchema.parse({
    id,
    metadata: { name, createdAt: "x", updatedAt: "x" },
    environment: { id: "env", type: "custom", name },
    areas: specs.map(({ id, type, name, relations }) => ({
      id,
      type,
      name,
      relations,
    })),
    entities: specs.flatMap((s) =>
      Array.from({ length: s.items ?? 0 }, (_, i) => ({
        id: `${s.id}-m${i + 1}`,
        type: "machine",
        name: `${s.name} ${i + 1}`,
        areaId: s.id,
      })),
    ),
    roleDefinitions: [
      { id: "role-director", name: "Director General" },
      { id: "role-op", name: "Operario" },
      { id: "role-guard", name: "Guardia" },
    ],
    roleInstances: specs[0]
      ? [
          {
            id: "director",
            roleDefinitionId: "role-director",
            name: "Director General",
            areaId: specs[0].id,
          },
        ]
      : [],
  });
}

const TYPES: AreaType[] = [
  "office",
  "production_floor",
  "warehouse",
  "loading_dock",
  "reception",
  "laboratory",
  "custom",
];
const numbered = (n: number, items = 0): AreaSpec[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `area-${i + 1}`,
    type: TYPES[i % TYPES.length],
    name: `Área ${i + 1}`,
    items,
  }));

export interface DevScenario {
  id: string;
  label: string;
  build(): World;
}

export const DEV_SCENARIOS: DevScenario[] = [
  {
    id: "factory",
    label: "Fábrica (3 áreas, con contenido)",
    build: () =>
      build("dev-world", "Planta de Producción San Rafael", [
        { id: "office", type: "office", name: "Oficina Central" },
        { id: "production_floor", type: "production_floor", name: "Planta", items: 2 },
        { id: "warehouse", type: "warehouse", name: "Depósito", items: 2 },
      ]),
  },
  {
    id: "single",
    label: "1 habitación",
    build: () => build("dev-world", "Una habitación", numbered(1)),
  },
  {
    id: "three",
    label: "3 áreas",
    build: () => build("dev-world", "Tres áreas", numbered(3, 1)),
  },
  {
    id: "six",
    label: "6 áreas",
    build: () => build("dev-world", "Seis áreas", numbered(6, 2)),
  },
  {
    id: "twelve",
    label: "12 áreas (varias filas)",
    build: () => build("dev-world", "Doce áreas", numbered(12, 2)),
  },
  {
    id: "sizes",
    label: "Tamaños muy distintos",
    build: () =>
      build("dev-world", "Tamaños distintos", [
        { id: "peq", type: "office", name: "Oficina", items: 0 },
        { id: "gran", type: "production_floor", name: "Planta grande", items: 40 },
        { id: "med", type: "warehouse", name: "Depósito", items: 8 },
        { id: "dock", type: "loading_dock", name: "Muelle" },
        { id: "lab", type: "laboratory", name: "Laboratorio", items: 14 },
        { id: "vacia", type: "custom", name: "Vacía" },
      ]),
  },
  {
    id: "relations",
    label: "Con relaciones semánticas",
    build: () =>
      build("dev-world", "Relaciones", [
        {
          id: "recepcion",
          type: "reception",
          name: "Recepción",
          relations: [
            { targetAreaId: "oficina", type: "access", strength: "required" },
            { targetAreaId: "muelle", type: "proximity", strength: "preferred" },
          ],
        },
        { id: "oficina", type: "office", name: "Oficina", items: 1 },
        { id: "planta", type: "production_floor", name: "Planta", items: 6 },
        {
          id: "deposito",
          type: "warehouse",
          name: "Depósito",
          items: 4,
          relations: [
            { targetAreaId: "planta", type: "adjacency", strength: "required" },
            { targetAreaId: "muelle", type: "adjacency", strength: "preferred" },
          ],
        },
        { id: "muelle", type: "loading_dock", name: "Muelle" },
        {
          id: "lab",
          type: "laboratory",
          name: "Laboratorio",
          items: 3,
          relations: [{ targetAreaId: "planta", type: "proximity", strength: "preferred" }],
        },
      ]),
  },
  {
    id: "dense",
    label: "Muchas entidades",
    build: () =>
      build("dev-world", "Muchas entidades", [
        { id: "a", type: "production_floor", name: "Planta", items: 60 },
        { id: "b", type: "warehouse", name: "Depósito", items: 30 },
        { id: "c", type: "office", name: "Oficina", items: 5 },
      ]),
  },
  {
    id: "empty",
    label: "Sin entidades",
    build: () => build("dev-world", "Sin entidades", numbered(5, 0)),
  },
];

export const DEFAULT_SCENARIO = DEV_SCENARIOS[0];
