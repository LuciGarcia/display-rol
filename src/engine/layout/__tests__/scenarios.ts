import { WorldSchema, type World } from "../../../domain/world/world";
import type { AreaType } from "../../../domain/world/area";

// Escenarios de prueba del motor de layout (fixtures de tests). Son datos semánticos del World:
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

type Rel = NonNullable<AreaSpec["relations"]>[number];
const rel = (
  targetAreaId: string,
  type: Rel["type"],
  strength: Rel["strength"] = "required",
): Rel => ({ targetAreaId, type, strength });

// Fase 2: escenarios donde las relaciones deben producir consecuencias geométricas.
const FACTORY: AreaSpec[] = [
  {
    id: "produccion",
    type: "production_floor",
    name: "Producción",
    items: 6,
    relations: [
      rel("deposito", "adjacency"),
      rel("laboratorio", "proximity", "preferred"),
    ],
  },
  {
    id: "deposito",
    type: "warehouse",
    name: "Depósito",
    items: 4,
    relations: [rel("muelle", "adjacency")],
  },
  { id: "laboratorio", type: "laboratory", name: "Laboratorio", items: 3 },
  {
    id: "oficinas",
    type: "office",
    name: "Oficinas",
    items: 2,
    relations: [
      rel("produccion", "access"),
      rel("laboratorio", "proximity", "preferred"),
    ],
  },
  { id: "muelle", type: "loading_dock", name: "Muelle", items: 2 },
];

const SCHOOL: AreaSpec[] = [
  {
    id: "recepcion",
    type: "reception",
    name: "Recepción",
    relations: [
      rel("direccion", "access"),
      rel("aula-1", "proximity", "preferred"),
    ],
  },
  { id: "direccion", type: "office", name: "Dirección", items: 1 },
  {
    id: "aula-1",
    type: "custom",
    name: "Aula 1",
    items: 8,
    relations: [rel("aula-2", "adjacency", "preferred")],
  },
  { id: "aula-2", type: "custom", name: "Aula 2", items: 8 },
  {
    id: "laboratorio",
    type: "laboratory",
    name: "Laboratorio",
    items: 4,
    relations: [rel("aula-2", "proximity")],
  },
  {
    id: "biblioteca",
    type: "warehouse",
    name: "Biblioteca",
    items: 5,
    relations: [rel("aula-1", "access", "preferred")],
  },
  { id: "patio", type: "production_floor", name: "Patio cubierto" },
];

const BIG: AreaSpec[] = [
  ...numbered(14, 2).map((s, i) => ({
    ...s,
    items: [0, 3, 12, 1, 24, 2, 6][i % 7],
    relations:
      i % 3 === 0 && i + 1 < 14
        ? [
            rel(
              `area-${i + 2}`,
              i % 2 ? "adjacency" : "proximity",
              i % 6 === 0 ? "required" : "preferred",
            ),
          ]
        : i % 5 === 1
          ? [rel(`area-${((i + 6) % 14) + 1}`, "access", "preferred")]
          : undefined,
  })),
];

// Incompatible: cinco áreas con adyacencia required entre todas (imposible con rectángulos).
const IMPOSSIBLE: AreaSpec[] = ["a", "b", "c", "d", "e"].map((id, i, all) => ({
  id,
  type: "custom" as const,
  name: `Área ${id.toUpperCase()}`,
  items: 1,
  relations: all.slice(i + 1).map((t) => rel(t, "adjacency")),
}));

export interface LayoutScenario {
  id: string;
  label: string;
  build(): World;
}

export const LAYOUT_SCENARIOS: LayoutScenario[] = [
  {
    id: "f2-factory",
    label: "F2 · Fábrica con relaciones",
    build: () => build("dev-world", "Fábrica (relaciones)", FACTORY),
  },
  {
    id: "f2-school",
    label: "F2 · Escuela",
    build: () => build("dev-world", "Escuela", SCHOOL),
  },
  {
    id: "f2-small",
    label: "F2 · Pequeño (3 áreas)",
    build: () =>
      build("dev-world", "Pequeño", [
        {
          id: "taller",
          type: "production_floor",
          name: "Taller",
          items: 3,
          relations: [rel("oficina", "adjacency")],
        },
        { id: "oficina", type: "office", name: "Oficina", items: 1 },
        {
          id: "bodega",
          type: "warehouse",
          name: "Bodega",
          items: 2,
          relations: [rel("taller", "access")],
        },
      ]),
  },
  {
    id: "f2-big",
    label: "F2 · 14 áreas, muchas relaciones",
    build: () => build("dev-world", "Grande", BIG),
  },
  {
    id: "f2-impossible",
    label: "F2 · Relación imposible (K5)",
    build: () => build("dev-world", "Imposible", IMPOSSIBLE),
  },
  {
    id: "factory",
    label: "Fábrica (3 áreas, con contenido)",
    build: () =>
      build("dev-world", "Planta de Producción San Rafael", [
        { id: "office", type: "office", name: "Oficina Central" },
        {
          id: "production_floor",
          type: "production_floor",
          name: "Planta",
          items: 2,
        },
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
        {
          id: "gran",
          type: "production_floor",
          name: "Planta grande",
          items: 40,
        },
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
            {
              targetAreaId: "muelle",
              type: "proximity",
              strength: "preferred",
            },
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
            {
              targetAreaId: "muelle",
              type: "adjacency",
              strength: "preferred",
            },
          ],
        },
        { id: "muelle", type: "loading_dock", name: "Muelle" },
        {
          id: "lab",
          type: "laboratory",
          name: "Laboratorio",
          items: 3,
          relations: [
            {
              targetAreaId: "planta",
              type: "proximity",
              strength: "preferred",
            },
          ],
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
