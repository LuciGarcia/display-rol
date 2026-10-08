"use client";

import { useMasterGame } from "@/hooks/useMasterGame";
import { GameSetup } from "@/components/master/GameSetup";
import { MasterControlPanel } from "@/components/master/MasterControlPanel";
import { PixiWorldCanvas } from "@/renderers/PixiWorldCanvas";
import { SavedGamesPanel } from "@/components/master/SavedGamesPanel";
import {
  AIInstructionPanel,
  AIProposalPreview,
} from "@/components/master/AIInstructionPanel";
import {
  worldToPanelAreas,
  worldToPanelCharacters,
} from "@/adapters/worldToPanel";
import { useMasterSession } from "@/hooks/useMasterSession";
import { MasterLogin } from "@/components/master/MasterLogin";

function MasterWorkspace() {
  const game = useMasterGame();

  // El World (WorldEngine) es la única fuente de verdad de la partida
  const world = game.world;

  return (
    <div className="p-6 bg-neutral-900 min-h-screen text-white font-sans">
      {!world ? (
        <>
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
          <SavedGamesPanel
            games={game.lifecycle.savedGames}
            error={game.lifecycle.error}
            onLoad={game.lifecycle.loadGame}
            onDelete={game.lifecycle.deleteGame}
          />
          {/* El mundo propuesto por la IA se revisa y aprueba antes de cargarse */}
          <div className="max-w-4xl mx-auto mt-4 space-y-2">
            <AIProposalPreview
              state={game.ai.state}
              onApply={game.ai.apply}
              onDiscard={game.ai.discard}
            />
          </div>
        </>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-blue-400">
              {world.metadata.name}
            </h2>
            <div className="flex items-center gap-3">
              <a
                href={`/display/${encodeURIComponent(world.id)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 border border-blue-700 rounded text-sm transition-colors"
              >
                Abrir Display
              </a>
              <button
                onClick={() => {
                  game.ai.discard();
                  game.clearWorld();
                  game.setSelectedAreaId(null);
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-sm transition-colors"
              >
                Nueva Partida
              </button>
            </div>
          </div>

          {game.lifecycle.error && (
            <p className="mb-4 text-xs text-red-400">
              No se pudo guardar la partida: {game.lifecycle.error}
            </p>
          )}

          <div className="flex flex-col gap-6">
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden h-[600px] w-full relative">
              {/* Flujo: WorldEngine → World → Layout → Assets → PixiWorldCanvas */}
              <PixiWorldCanvas
                world={world}
                onAreaSelected={(areaId) => game.setSelectedAreaId(areaId)}
              />
            </div>

            <AIInstructionPanel
              state={game.ai.state}
              onInterpret={(text) => game.ai.interpret(text)}
              onApply={game.ai.apply}
              onDiscard={game.ai.discard}
            />

            {/* Panel derivado del World */}
            <MasterControlPanel
              areas={worldToPanelAreas(world)}
              characters={worldToPanelCharacters(world)}
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

// Puerta de acceso: el workspace (y su carga de partidas) solo se monta con sesión de Master.
export default function MasterDashboard() {
  const session = useMasterSession();

  if (session.state === "checking") {
    return (
      <div className="min-h-screen bg-neutral-900 p-6 text-neutral-400 font-sans">
        Verificando acceso...
      </div>
    );
  }

  if (session.state === "anonymous") {
    return <MasterLogin onLogin={session.login} error={session.error} />;
  }

  return <MasterWorkspace />;
}
