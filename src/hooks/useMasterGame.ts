"use client";

import { useState } from "react";
import type { SetupRole } from "@/application/world/spawnRoles";
import { INITIAL_ROLES } from "@/app/lib/roles";
import { emitGameEvent } from "@/app/lib/events";

import { useWorldEngine } from "@/hooks/useWorldEngine";
import type { AreaType } from "@/domain/world/area";

import { useAIInstruction } from "@/hooks/useAIInstruction";

const INCIDENT_STATES = {
  incendio: "INCENDIO / EVACUACIÓN",
  falla_electrica: "CORTE ENERGÍA CRÍTICO",
  rotura_stock: "FALTA INSUMOS CRÍTICA",
} as const;

export interface ExtendedRoleDefinition extends SetupRole {
  enabled: boolean;
}

export function useMasterGame() {
  const { world, loadWorld, clearWorld, execute, executeBatch } =
    useWorldEngine();
  const ai = useAIInstruction({ world, loadWorld, executeBatch });
  const [sessionId] = useState("sesion1");
  const [prompt, setPrompt] = useState("");
  const loading = ai.state.phase === "loading";

  // Inicializamos roles con flag 'enabled' en true
  const [roles, setRoles] = useState<ExtendedRoleDefinition[]>(() =>
    INITIAL_ROLES.map((r) => ({ ...r, enabled: true })),
  );

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

  // Iniciar Partida: la IA propone el mundo (modo "generate"), el Master revisa la
  // vista previa y al aplicarla el World queda cargado en el WorldEngine.
  const handleStartGame = async () => {
    if (!prompt.trim()) return;
    const activeRoles = roles.filter((r) => r.enabled);
    if (activeRoles.length === 0) {
      alert(
        "Debes seleccionar al menos un rol activo para iniciar la partida.",
      );
      return;
    }
    await ai.interpret(prompt, "generate", { roles: activeRoles });
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

  const handleMoveCharacterToArea = (charId: string, areaId: string) => {
    const result = execute({
      type: "MOVE_ROLE",
      roleInstanceId: charId,
      targetAreaId: areaId,
    });
    if (!result.ok) console.error("MOVE_ROLE falló:", result.error);
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
    handleMoveCharacterToArea(world.roleInstances[0].id, target.id);
  };

  return {
    prompt,
    setPrompt,
    loading,
    roles,
    selectedAreaId,
    setSelectedAreaId,
    handleStartGame,
    handleStateChange,
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
