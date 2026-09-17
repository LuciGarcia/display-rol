// src/lib/catalog.ts

export interface CatalogItem {
  assetId: string;
  name: string;
  description?: string;
}

export const CATALOG: CatalogItem[] = [
  {
    assetId: "horno-industrial",
    name: "Horno Industrial",
    description: "Horno de fundición de gran tamaño",
  },
  {
    assetId: "torno-cnc",
    name: "Torno CNC",
    description: "Máquina de mecanizado de precisión",
  },
  {
    assetId: "rack-estanteria",
    name: "Rack / Estantería",
    description: "Estantería de almacenamiento industrial",
  },
  {
    assetId: "estacion-soldadura",
    name: "Estación de Soldadura",
    description: "Puesto robotizado o manual de soldadura",
  },
  {
    assetId: "escritorio",
    name: "Escritorio",
    description: "Escritorio de oficina",
  },
  {
    assetId: "camion-carga",
    name: "Camión de Carga",
    description: "Vehículo de transporte en muelle de carga",
  },
  // agregá acá el resto de tus assets reales
];

export const CATALOG_IDS = CATALOG.map((item) => item.assetId) as [
  string,
  ...string[],
];

export const CATALOG_LIST_TEXT = CATALOG.map(
  (item) => `- ${item.assetId}: ${item.description ?? item.name}`,
).join("\n");
