"use client";

import dynamic from "next/dynamic";
import { useMasterGame } from "@/hooks/useMasterGame";
import { GameSetup } from "@/components/master/GameSetup";
import { MasterControlPanel } from "@/components/master/MasterControlPanel";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";
import {
  worldToPanelAreas,
  worldToPanelCharacters,
} from "@/adapters/worldToPanel";

const FloorMap = dynamic(() => import("@/components/FloorMap"), { ssr: false });

export default function MasterDashboard() {
  const game = useMasterGame();

  // El World real (WorldEngine) es la fuente de verdad; mapData queda como legacy
  const hasMap = Boolean(game.world || game.mapData);
  const scenarioTitle =
    game.world?.metadata.name ?? game.mapData?.scenarioName ?? "Escenario";

  return (
    <div className="p-6 bg-neutral-900 min-h-screen text-white font-sans">
      {!hasMap ? (
        <GameSetup
          prompt={game.prompt}
          setPrompt={game.setPrompt}
          roles={game.roles}
          loading={game.loading}
          onAddRole={game.handleAddRole}
          onToggleRole={game.handleToggleRole}
          onDeleteRole={game.handleDeleteRole}
          onEditRole={game.handleEditRole}
          onStartGame={game.handleStartGame}
        />
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-blue-400">
              {scenarioTitle}
            </h2>
            <button
              onClick={() => {
                game.clearWorld();
                game.setMapData(null);
                game.setSelectedAreaId(null);
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-sm transition-colors"
            >
              Nueva Partida
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden h-[600px] w-full relative">
              {game.world ? (
                // Flujo principal: WorldEngine → World → PixiWorldCanvas
                <PixiWorldCanvas
                  world={game.world}
                  onAreaSelected={(areaId) => game.setSelectedAreaId(areaId)}
                />
              ) : game.mapData ? (
                // Fallback legacy (Konva) mientras dure la migración
                <div className="p-4 overflow-auto flex justify-center items-center h-full w-full">
                  <FloorMap
                    mapData={game.mapData}
                    characters={game.characters}
                    selectedAreaId={game.selectedAreaId}
                    isMaster={true}
                    onAreaClick={(id: string) => game.setSelectedAreaId(id)}
                    onCharacterDragEnd={game.handleCharacterDragEnd}
                  />
                </div>
              ) : null}
            </div>

            {/* Panel: derivado del World. En fallback legacy (sin World) no se muestra */}
            {game.world && (
              <MasterControlPanel
                areas={worldToPanelAreas(game.world)}
                characters={worldToPanelCharacters(game.world)}
                selectedAreaId={game.selectedAreaId}
                onTriggerIncident={game.handleTriggerIncident}
                onMoveCharacterToArea={game.handleMoveCharacterToArea}
                onStateChange={game.handleStateChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
