// src/lib/catalog.ts

export interface CatalogItem {
  assetId: string;
  name: string;
  description?: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const CATALOG: CatalogItem[] = [
  {
    assetId: "horno-industrial",
    name: "Horno Industrial",
    description: "Horno de fundición de gran tamaño",
    defaultWidth: 110,
    defaultHeight: 110,
  },
  {
    assetId: "torno-cnc",
    name: "Torno CNC",
    description: "Máquina de mecanizado de precisión",
    defaultWidth: 130,
    defaultHeight: 80,
  },
  {
    assetId: "rack-estanteria",
    name: "Rack / Estantería",
    description: "Estantería de almacenamiento industrial",
    defaultWidth: 150,
    defaultHeight: 60,
  },
  {
    assetId: "estacion-soldadura",
    name: "Estación de Soldadura",
    description: "Puesto robotizado o manual de soldadura",
    defaultWidth: 100,
    defaultHeight: 100,
  },
  {
    assetId: "escritorio-pc",
    name: "Escritorio con computadora",
    description: "Puesto de trabajo de oficina completo",
    defaultWidth: 90,
    defaultHeight: 55,
  },
  {
    assetId: "camion-carga",
    name: "Camión de Carga",
    description: "Vehículo de transporte en muelle de carga",
    defaultWidth: 120,
    defaultHeight: 200,
  },
  {
    assetId: "cinta-transportadora",
    name: "Cinta Transportadora",
    description: "Línea de transporte de piezas entre estaciones",
    defaultWidth: 160,
    defaultHeight: 45,
  },
  {
    assetId: "pallet",
    name: "Pallet de madera",
    description: "Base de madera para almacenamiento y transporte",
    defaultWidth: 55,
    defaultHeight: 55,
  },
];
export const CATALOG_BY_ID = Object.fromEntries(
  CATALOG.map((i) => [i.assetId, i]),
);

export const RENDERABLE_ASSET_IDS = [
  "caja_carton",
  "pale_madera",
  "escritorio_pc",
  "camion_reparto",
  "mancha_aceite",
  "horno-industrial",
  "torno-cnc",
  "rack-estanteria",
  "estacion-soldadura",
  "camion-carga",
  "pallet",
];

if (process.env.NODE_ENV !== "production") {
  const missing = CATALOG.filter(
    (c) => !RENDERABLE_ASSET_IDS.includes(c.assetId),
  );
  if (missing.length > 0) {
    console.warn(
      "Estos assetId del catálogo no tienen un case en CatalogAssetRenderer:",
      missing.map((m) => m.assetId),
    );
  }
}
