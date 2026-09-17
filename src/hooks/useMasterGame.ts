"use client";

import { useState } from "react";
import { MapData, RoleDefinition, CharacterData } from "@/types/schema";
import { INITIAL_ROLES, generateCharactersFromRoles } from "@/app/lib/roles";
import { emitGameEvent } from "@/app/lib/events";

export interface ExtendedRoleDefinition extends RoleDefinition {
  enabled: boolean;
}

export function useMasterGame() {
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
        setMapData(data.map);
        const spawnedCharacters = generateCharactersFromRoles(
          activeRoles,
          data.map,
        );
        setCharacters(spawnedCharacters);

        await emitGameEvent(sessionId, "map-init", {
          map: data.map,
          characters: spawnedCharacters,
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
    if (!mapData) return;
    const updatedAreas = mapData.areas.map((area) =>
      area.id === areaId ? { ...area, currentState: newState } : area,
    );
    setMapData({ ...mapData, areas: updatedAreas });
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
    if (!mapData) return;
    const targetArea = mapData.areas.find((a) => a.id === areaId);
    if (!targetArea) return;

    const newX = targetArea.bounds.x + targetArea.bounds.width / 2;
    const newY = targetArea.bounds.y + targetArea.bounds.height / 2;

    await handleCharacterDragEnd(charId, newX, newY);
  };

  const handleTriggerIncident = async (
    incidentType: "incendio" | "falla_electrica" | "rotura_stock",
  ) => {
    if (!mapData || characters.length === 0) return;

    let targetArea = mapData.areas[0];
    let incidentState = "EN CRISIS";

    if (incidentType === "incendio") {
      targetArea =
        mapData.areas.find((a) => a.type.includes("fabrica")) ||
        mapData.areas[0];
      incidentState = "INCENDIO / EVACUACIÓN";
    } else if (incidentType === "falla_electrica") {
      targetArea =
        mapData.areas.find((a) => a.type.includes("laboratorio")) ||
        mapData.areas[1] ||
        mapData.areas[0];
      incidentState = "CORTE ENERGÍA CRÍTICO";
    } else if (incidentType === "rotura_stock") {
      targetArea =
        mapData.areas.find((a) => a.type.includes("deposito")) ||
        mapData.areas[0];
      incidentState = "FALTA INSUMOS CRÍTICA";
    }

    await handleStateChange(targetArea.id, incidentState);
    if (characters[0]) {
      await handleMoveCharacterToArea(characters[0].id, targetArea.id);
    }
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
  };
}
