"use client";

import { useState } from "react";
import { MapData, RoleDefinition, CharacterData } from "@/types/schema";
import { INITIAL_ROLES, generateCharactersFromRoles } from "@/app/lib/roles";
import { emitGameEvent } from "@/app/lib/events";

import { useWorldEngine } from "@/hooks/useWorldEngine";
import { legacyToWorld } from "@/adapters/legacyToWorld";
import type { AreaType } from "@/domain/world/area";

import { useAIInstruction } from "@/hooks/useAIInstruction";

const INCIDENT_STATES = {
  incendio: "INCENDIO / EVACUACIÓN",
  falla_electrica: "CORTE ENERGÍA CRÍTICO",
  rotura_stock: "FALTA INSUMOS CRÍTICA",
} as const;

export interface ExtendedRoleDefinition extends RoleDefinition {
  enabled: boolean;
}

export function useMasterGame() {
  const { world, loadWorld, clearWorld, execute, executeBatch } =
    useWorldEngine();
  const ai = useAIInstruction({ world, loadWorld, executeBatch });
  const [sessionId] = useState("sesion1");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<MapData | null>(null);

  // Inicializamos roles con flag 'enabled' en true
  const [roles, setRoles] = useState<ExtendedRoleDefinition[]>(() =>
    INITIAL_ROLES.map((r) => ({ ...r, enabled: true })),
  );

  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  // Activar / Desactivar Rol para la partida
  const handleToggleRole = (roleId: string) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  // Eliminar Rol de la lista
  const handleDeleteRole = (roleId: string) => {
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
  };

  // Editar Rol existente
  const handleEditRole = (
    roleId: string,
    updated: { name: string; title: string; targetAreaType: string },
  ) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, ...updated } : r)),
    );
  };

  // Agregar Rol Dinámico
  const handleAddRole = (
    name: string,
    title: string,
    targetAreaType: string,
  ) => {
    const newRole: ExtendedRoleDefinition = {
      id: `custom_role_${Date.now()}`,
      name,
      title,
      targetAreaType,
      color: "#EC4899",
      enabled: true,
    };
    setRoles((prev) => [...prev, newRole]);
  };

  // Iniciar Partida (solo filtra los roles marcados como enabled)
  const handleStartGame = async () => {
    if (!prompt.trim()) return;
    const activeRoles = roles.filter((r) => r.enabled);
    if (activeRoles.length === 0) {
      alert(
        "Debes seleccionar al menos un rol activo para iniciar la partida.",
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/generate-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (data.success) {
        const spawned = generateCharactersFromRoles(activeRoles, data.map);
        const newWorld = legacyToWorld(data.map, spawned, activeRoles); // si falla, no queda estado a medias
        setMapData(data.map);
        setCharacters(spawned);
        loadWorld(newWorld);
        await emitGameEvent(sessionId, "map-init", {
          map: data.map,
          characters: spawned,
        });
      } else {
        alert(data.error || "Error generando el plano");
      }
    } catch (err) {
      console.error("Error al iniciar partida:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStateChange = async (areaId: string, newState: string) => {
    const result = execute({
      type: "SET_STATE",
      targetType: "AREA",
      targetId: areaId,
      key: "currentState",
      value: newState,
    });
    if (!result.ok) {
      console.error("SET_STATE falló:", result.error);
      return;
    }
    await emitGameEvent(sessionId, "area-state-changed", { areaId, newState });
  };

  const handleCharacterDragEnd = async (
    charId: string,
    newX: number,
    newY: number,
  ) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === charId ? { ...c, x: newX, y: newY } : c)),
    );
    await emitGameEvent(sessionId, "character-moved", {
      charId,
      x: newX,
      y: newY,
    });
  };

  const handleMoveCharacterToArea = async (charId: string, areaId: string) => {
    const result = execute({
      type: "MOVE_ROLE",
      roleInstanceId: charId,
      targetAreaId: areaId,
    });
    if (!result.ok) {
      console.error("MOVE_ROLE falló:", result.error);
      return;
    }
    // Compat con Player legacy: aún espera coordenadas absolutas
    const target = mapData?.areas.find((a) => a.id === areaId);
    if (!target) return;
    await emitGameEvent(sessionId, "character-moved", {
      charId,
      x: target.bounds.x + target.bounds.width / 2,
      y: target.bounds.y + target.bounds.height / 2,
    });
  };

  const handleTriggerIncident = async (
    incidentType: keyof typeof INCIDENT_STATES,
  ) => {
    if (!world || world.roleInstances.length === 0) return;
    const byType = (t: AreaType) => world.areas.find((a) => a.type === t);
    const target =
      (incidentType === "incendio"
        ? byType("production_floor")
        : incidentType === "falla_electrica"
          ? (byType("laboratory") ?? world.areas[1])
          : byType("warehouse")) ?? world.areas[0];

    await handleStateChange(target.id, INCIDENT_STATES[incidentType]);
    await handleMoveCharacterToArea(world.roleInstances[0].id, target.id);
  };

  return {
    prompt,
    setPrompt,
    loading,
    mapData,
    setMapData,
    roles,
    characters,
    selectedAreaId,
    setSelectedAreaId,
    handleStartGame,
    handleStateChange,
    handleCharacterDragEnd,
    handleMoveCharacterToArea,
    handleTriggerIncident,
    handleAddRole,
    handleToggleRole,
    handleDeleteRole,
    handleEditRole,
    world,
    clearWorld,
    ai,
  };
}
