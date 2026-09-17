import { RoleDefinition, CharacterData, MapData } from "@/types/schema";

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

// 2. Generador de personajes que calcula el spawn según los roles configurados
export function generateCharactersFromRoles(
  rolesList: RoleDefinition[],
  mapData: MapData,
): CharacterData[] {
  return rolesList.map((role, index) => {
    // Buscar un área coincidente por tipo o nombre
    const targetArea =
      mapData.areas.find(
        (area) =>
          area.type.toLowerCase().includes(role.targetAreaType.toLowerCase()) ||
          area.name.toLowerCase().includes(role.targetAreaType.toLowerCase()),
      ) || mapData.areas[index % mapData.areas.length]; // Resguardo si no encuentra el área exacta

    // Calcular posición en el centro del área con un pequeño desplazamiento para evitar solapamientos
    const offset = (index * 15) % 40;
    const x = targetArea
      ? targetArea.bounds.x + targetArea.bounds.width / 2 + offset
      : 500;
    const y = targetArea
      ? targetArea.bounds.y + targetArea.bounds.height / 2 + offset
      : 300;

    return {
      id: `char_${role.id}_${Date.now()}`,
      name: role.name,
      title: role.title,
      roleId: role.id,
      color: role.color,
      x,
      y,
    };
  });
}
