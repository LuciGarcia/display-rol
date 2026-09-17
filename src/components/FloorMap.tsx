"use client";

import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import { MapData, CharacterData } from "@/types/schema";
import {
  CatalogAssetRenderer,
  PalletAsset,
  OilStainAsset,
  ScatteredBoxesAsset,
} from "./IndustrialAssets";

interface FloorMapProps {
  mapData: MapData;
  characters?: CharacterData[];
  selectedAreaId?: string | null;
  isMaster?: boolean;
  onAreaClick?: (areaId: string) => void;
  onCharacterDragEnd?: (charId: string, newX: number, newY: number) => void;
}

export default function FloorMap({
  mapData,
  characters = [],
  selectedAreaId,
  isMaster = false,
  onAreaClick,
  onCharacterDragEnd,
}: FloorMapProps) {
  const { width, height } = mapData.dimensions;

  return (
    <Stage
      width={width}
      height={height}
      className="bg-[#1A1A1A] rounded-lg shadow-2xl border-4 border-[#2A2A2D]"
    >
      <Layer>
        {/* SUELO GENERAL DE CONCRETO RÚSTICO */}
        <Rect x={0} y={0} width={width} height={height} fill="#222225" />

        {/* MUROS PERIMETRALES */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke="#3F3F46"
          strokeWidth={14}
        />
        <Rect x={width / 2 - 50} y={0} width={100} height={8} fill="#E4E4E7" />
        <Rect
          x={width / 2 - 50}
          y={height - 8}
          width={100}
          height={8}
          fill="#E4E4E7"
        />

        {/* RENDERIZADO DE ÁREAS CON AMBIENTACIÓN */}
        {mapData.areas.map((area) => {
          const isSelected = selectedAreaId === area.id;
          const { x, y, width: w, height: h } = area.bounds;
          const isChaotic =
            area.currentState.includes("CAOTICO") ||
            area.currentState.includes("DESORDENADO") ||
            area.currentState.includes("CRISIS") ||
            area.currentState.includes("INCENDIO");

          return (
            <Group
              key={area.id}
              onClick={() => isMaster && onAreaClick?.(area.id)}
            >
              {/* Fondo del área */}
              <Rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={area.color || "#1F1F22"}
                stroke={isSelected ? "#3B82F6" : "#EAB308"}
                strokeWidth={isSelected ? 4 : 2}
                dash={[8, 4]}
              />

              {/* AMBIENTACIÓN ORGÁNICA: MANCHAS Y PALÉS */}
              <OilStainAsset x={x + w * 0.1} y={y + h * 0.5} />
              <PalletAsset x={x + w - 60} y={y + 20} rotation={18} />
              <PalletAsset x={x + 20} y={y + h - 60} rotation={-35} />

              {/* Si la zona está caótica, renderiza cajas tiradas */}
              {isChaotic && (
                <>
                  <ScatteredBoxesAsset x={x + w * 0.4} y={y + h * 0.6} />
                  <OilStainAsset
                    x={x + w * 0.6}
                    y={y + h * 0.2}
                    color="#3E1A00"
                  />
                </>
              )}

              {/* Etiqueta de la Sala */}
              <Group x={x + 10} y={y + 10}>
                <Rect
                  width={220}
                  height={20}
                  fill="#000000"
                  opacity={0.8}
                  cornerRadius={3}
                />
                <Text
                  text={`${area.name.toUpperCase()} • [${area.currentState}]`}
                  fontSize={8.5}
                  fontStyle="bold"
                  fill="#F4F4F5"
                  padding={5}
                />
              </Group>
            </Group>
          );
        })}

        {/* OBSTÁCULOS Y ELEMENTOS DEL CATÁLOGO DINÁMICO */}
        {mapData.obstacles.map((obs) => (
          <Group
            key={obs.id}
            x={obs.bounds.x}
            y={obs.bounds.y}
            rotation={obs.rotation || 0}
          >
            <CatalogAssetRenderer
              assetId={obs.assetId || "caja_carton"}
              width={obs.bounds.width}
              height={obs.bounds.height}
            />
            <Group x={0} y={obs.bounds.height + 2}>
              <Rect
                width={obs.bounds.width}
                height={13}
                fill="#000000"
                opacity={0.8}
                cornerRadius={2}
              />
              <Text
                text={obs.name}
                fontSize={7.5}
                fontStyle="bold"
                fill="#FFFFFF"
                width={obs.bounds.width}
                align="center"
                padding={2.5}
              />
            </Group>
          </Group>
        ))}

        {/* FICHAS DE PERSONAJES */}
        {characters.map((char) => (
          <Group
            key={char.id}
            x={char.x}
            y={char.y}
            draggable={isMaster}
            onDragEnd={(e) => {
              if (isMaster && onCharacterDragEnd) {
                onCharacterDragEnd(char.id, e.target.x(), e.target.y());
              }
            }}
          >
            <Line
              points={[-16, 0, 16, 0]}
              stroke={char.color}
              strokeWidth={1}
              opacity={0.4}
            />
            <Rect
              x={-12}
              y={-12}
              width={24}
              height={24}
              fill={char.color}
              cornerRadius={12}
              stroke="#FFFFFF"
              strokeWidth={2.5}
              shadowColor="black"
              shadowBlur={5}
            />
            <Text
              text={char.name}
              fontSize={9.5}
              fontStyle="bold"
              fill="#FFFFFF"
              x={-35}
              y={16}
              width={70}
              align="center"
            />
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}
