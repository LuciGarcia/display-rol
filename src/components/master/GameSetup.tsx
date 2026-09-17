"use client";

import { useState } from "react";
import { ExtendedRoleDefinition } from "@/hooks/useMasterGame";

interface GameSetupProps {
  prompt: string;
  setPrompt: (value: string) => void;
  roles: ExtendedRoleDefinition[];
  loading: boolean;
  onAddRole: (name: string, title: string, targetArea: string) => void;
  onToggleRole: (roleId: string) => void;
  onDeleteRole: (roleId: string) => void;
  onEditRole: (
    roleId: string,
    updated: { name: string; title: string; targetAreaType: string },
  ) => void;
  onStartGame: () => void;
}

export function GameSetup({
  prompt,
  setPrompt,
  roles,
  loading,
  onAddRole,
  onToggleRole,
  onDeleteRole,
  onEditRole,
  onStartGame,
}: GameSetupProps) {
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleTarget, setNewRoleTarget] = useState("oficina");

  // Estado local para edición en línea
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTarget, setEditTarget] = useState("oficina");

  const handleStartEditing = (role: ExtendedRoleDefinition) => {
    setEditingRoleId(role.id);
    setEditName(role.name);
    setEditTitle(role.title);
    setEditTarget(role.targetAreaType);
  };

  const handleSaveEditing = (roleId: string) => {
    onEditRole(roleId, {
      name: editName,
      title: editTitle,
      targetAreaType: editTarget,
    });
    setEditingRoleId(null);
  };

  const handleAdd = () => {
    if (!newRoleName.trim() || !newRoleTitle.trim()) return;
    onAddRole(newRoleName, newRoleTitle, newRoleTarget);
    setNewRoleName("");
    setNewRoleTitle("");
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-8 bg-neutral-800 rounded-xl shadow-2xl border border-neutral-700">
      <h1 className="text-2xl font-bold mb-2 text-center text-blue-400">
        🎯 Configuración de la Partida
      </h1>
      <p className="text-sm text-neutral-400 mb-6 text-center">
        Selecciona los roles que participarán, edítalos o crea nuevos
        personajes.
      </p>

      {/* Escenario Prompt */}
      <div className="mb-8">
        <label className="block text-sm font-bold mb-2 text-neutral-300">
          Escenario del Juego:
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ej: Planta metalúrgica con nave de producción, depósito, área de ventas y laboratorio de calidad"
          className="w-full h-24 p-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Lista de Roles con Toggle, Edit y Delete */}
      <div className="mb-8">
        <h3 className="text-md font-bold mb-3 text-neutral-200">
          Gestión de Roles y Participantes:
        </h3>
        <div className="space-y-3 mb-6">
          {roles.map((role) => {
            const isEditing = editingRoleId === role.id;

            return (
              <div
                key={role.id}
                className={`p-3 bg-neutral-900 border rounded flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                  role.enabled
                    ? "border-neutral-700"
                    : "border-neutral-800 opacity-50"
                }`}
              >
                {/* Checkbox de Selección */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={role.enabled}
                    onChange={() => onToggleRole(role.id)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />

                  {!isEditing ? (
                    <div>
                      <span
                        className="font-bold text-sm mr-2"
                        style={{ color: role.color }}
                      >
                        {role.name}
                      </span>
                      <span className="text-xs text-neutral-400">
                        ({role.title})
                      </span>
                    </div>
                  ) : (
                    /* Formulario de Edición en Línea */
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="p-1 bg-neutral-800 border border-neutral-600 rounded text-xs text-white"
                      />
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="p-1 bg-neutral-800 border border-neutral-600 rounded text-xs text-white"
                      />
                      <select
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        className="p-1 bg-neutral-800 border border-neutral-600 rounded text-xs text-white"
                      >
                        <option value="oficina">Oficina / Admin</option>
                        <option value="fabrica">Planta de Trabajo</option>
                        <option value="laboratorio">
                          Laboratorio / Calidad
                        </option>
                        <option value="ventas">Comercial / Ventas</option>
                        <option value="deposito">Depósito / Almacén</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Acciones: Editar / Eliminar */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                  {!isEditing ? (
                    <>
                      <span className="text-[10px] bg-neutral-800 px-2 py-1 rounded text-neutral-400 border border-neutral-700 uppercase">
                        Spawn: {role.targetAreaType}
                      </span>
                      <button
                        onClick={() => handleStartEditing(role)}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 rounded"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDeleteRole(role.id)}
                        className="px-2 py-1 bg-red-950/80 hover:bg-red-900 text-xs text-red-300 rounded border border-red-800"
                      >
                        Eliminar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSaveEditing(role.id)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingRoleId(null)}
                        className="px-2 py-1 bg-neutral-700 text-xs text-neutral-300 rounded"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Formulario de Adición de Roles */}
        <div className="p-4 bg-neutral-900/60 rounded-lg border border-neutral-700/60">
          <p className="text-xs font-bold text-blue-400 mb-3 uppercase">
            ➕ Agregar Rol Personalizado
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input
              type="text"
              placeholder="Nombre (ej: Águila)"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="p-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white"
            />
            <input
              type="text"
              placeholder="Cargo / Área"
              value={newRoleTitle}
              onChange={(e) => setNewRoleTitle(e.target.value)}
              className="p-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white"
            />
            <select
              value={newRoleTarget}
              onChange={(e) => setNewRoleTarget(e.target.value)}
              className="p-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white"
            >
              <option value="oficina">Oficina / Admin</option>
              <option value="fabrica">Planta de Trabajo</option>
              <option value="laboratorio">Laboratorio / Calidad</option>
              <option value="ventas">Área Comercial / Ventas</option>
              <option value="deposito">Depósito / Almacén</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 text-xs font-bold rounded transition-colors"
          >
            + Añadir Rol a la Lista
          </button>
        </div>
      </div>

      <button
        onClick={onStartGame}
        disabled={loading || !prompt.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex justify-center items-center"
      >
        {loading
          ? "Generando Plano e Instalando Roles Activos..."
          : "Iniciar Partida"}
      </button>
    </div>
  );
}
