"use client";

import dynamic from "next/dynamic";
import { useMasterGame } from "@/hooks/useMasterGame";
import { GameSetup } from "@/components/master/GameSetup";
import { MasterControlPanel } from "@/components/master/MasterControlPanel";

const FloorMap = dynamic(() => import("@/components/FloorMap"), { ssr: false });

export default function MasterDashboard() {
  const game = useMasterGame();

  return (
    <div className="p-6 bg-neutral-900 min-h-screen text-white font-sans">
      {!game.mapData ? (
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
              {game.mapData.scenarioName}
            </h2>
            <button
              onClick={() => game.setMapData(null)}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-sm transition-colors"
            >
              Nueva Partida
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800 overflow-auto flex justify-center items-center">
              <FloorMap
                mapData={game.mapData}
                characters={game.characters}
                selectedAreaId={game.selectedAreaId}
                isMaster={true}
                onAreaClick={(id: string) => game.setSelectedAreaId(id)}
                onCharacterDragEnd={game.handleCharacterDragEnd}
              />
            </div>

            <MasterControlPanel
              mapData={game.mapData}
              characters={game.characters}
              selectedAreaId={game.selectedAreaId}
              onTriggerIncident={game.handleTriggerIncident}
              onMoveCharacterToArea={game.handleMoveCharacterToArea}
              onStateChange={game.handleStateChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
