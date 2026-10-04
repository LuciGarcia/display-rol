import { RoleDefinition } from "@/types/schema";

// 1. Roles predeterminados de tu proyecto
export const INITIAL_ROLES: RoleDefinition[] = [
  {
    id: "role_buho",
    name: "Búho",
    title: "Dirección General",
    targetAreaType: "oficina",
    color: "0B45B5", // Azul Oscuro
  },
  {
    id: "role_toro",
    name: "Toro",
    title: "Producción y Operaciones",
    targetAreaType: "fabrica",
    color: "#EF4444", // Rojo
  },
  {
    id: "role_zorro",
    name: "Zorro",
    title: "Área Comercial y Ventas",
    targetAreaType: "ventas",
    color: "#F97316", // Naranja
  },
  {
    id: "role_castor",
    name: "Castor",
    title: "Ingeniería y Mejora Continua",
    targetAreaType: "laboratorio",
    color: "#10B981", // Verde
  },
  {
    id: "role_ardilla",
    name: "Ardilla",
    title: "Administración y Finanzas",
    targetAreaType: "oficina",
    color: "#D4E048", // Amarillo
  },
];
