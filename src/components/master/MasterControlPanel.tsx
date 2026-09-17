"use client";

import { useState } from "react";
import { MapData, CharacterData } from "@/types/schema";

interface MasterControlPanelProps {
  mapData: MapData;
  characters: CharacterData[];
  selectedAreaId: string | null;
  onTriggerIncident: (
    type: "incendio" | "falla_electrica" | "rotura_stock",
  ) => void;
  onMoveCharacterToArea: (charId: string, areaId: string) => void;
  onStateChange: (areaId: string, newState: string) => void;
}

export function MasterControlPanel({
  mapData,
  characters,
  selectedAreaId,
  onTriggerIncident,
  onMoveCharacterToArea,
  onStateChange,
}: MasterControlPanelProps) {
  const [customStateText, setCustomStateText] = useState("");

  const selectedArea = mapData.areas.find((a) => a.id === selectedAreaId);

  const handleCustomSubmit = () => {
    if (selectedArea && customStateText.trim()) {
      onStateChange(selectedArea.id, customStateText.trim());
      setCustomStateText("");
    }
  };

  return (
    <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 h-fit space-y-6">
      {/* Incidentes */}
      <div>
        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">
          Panel de Incidentes
        </h3>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => onTriggerIncident("incendio")}
            className="py-2 px-3 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded text-xs font-bold text-red-200 text-left transition-colors"
          >
            Alarma de Incendio
          </button>
          <button
            onClick={() => onTriggerIncident("falla_electrica")}
            className="py-2 px-3 bg-amber-950/80 hover:bg-amber-900 border border-amber-800 rounded text-xs font-bold text-amber-200 text-left transition-colors"
          >
            Falla Eléctrica
          </button>
          <button
            onClick={() => onTriggerIncident("rotura_stock")}
            className="py-2 px-3 bg-blue-950/80 hover:bg-blue-900 border border-blue-800 rounded text-xs font-bold text-blue-200 text-left transition-colors"
          >
            Rotura de Stock
          </button>
        </div>
      </div>

      {/* Teleport Roles */}
      <div className="border-t border-neutral-700 pt-4">
        <h3 className="text-sm font-bold text-neutral-300 uppercase tracking-wider mb-3">
          Reubicar Personaje
        </h3>
        <div className="space-y-2">
          {characters.map((char) => (
            <div
              key={char.id}
              className="flex items-center justify-between text-xs bg-neutral-900 p-2 rounded border border-neutral-700"
            >
              <span className="font-bold" style={{ color: char.color }}>
                {char.name}
              </span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onMoveCharacterToArea(char.id, e.target.value);
                    e.target.value = "";
                  }
                }}
                className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[11px] rounded p-1"
              >
                <option value="">Mover a...</option>
                {mapData.areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Control de Zona */}
      <div className="border-t border-neutral-700 pt-4">
        <h3 className="text-sm font-bold text-neutral-300 uppercase tracking-wider mb-3">
          Control de Zona
        </h3>
        {selectedArea ? (
          <div>
            <p className="font-semibold text-md text-blue-400 mb-1">
              {selectedArea.name}
            </p>
            <span className="inline-block px-2 py-1 bg-blue-950 text-blue-300 border border-blue-800 rounded text-xs font-semibold mb-4">
              {selectedArea.currentState}
            </span>

            <p className="text-[11px] text-neutral-400 font-bold uppercase mb-2">
              Estados Predefinidos:
            </p>
            <div className="flex flex-col gap-1.5 mb-4">
              {selectedArea.allowedStates.map((state) => (
                <button
                  key={state}
                  onClick={() => onStateChange(selectedArea.id, state)}
                  className={`py-1.5 px-3 rounded text-left text-xs font-medium transition-colors ${
                    selectedArea.currentState === state
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-neutral-400 font-bold uppercase mb-2">
              Estado Personalizado:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Escribe un estado..."
                value={customStateText}
                onChange={(e) => setCustomStateText(e.target.value)}
                className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded text-xs text-white"
              />
              <button
                onClick={handleCustomSubmit}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 font-bold rounded text-xs transition-colors"
              >
                Ok
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">
            Haz clic en una zona del plano para modificar su estado.
          </p>
        )}
      </div>
    </div>
  );
}
