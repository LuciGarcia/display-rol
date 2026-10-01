"use client";

import React from "react";
import { Group, Rect, Circle, Line, Path } from "react-konva";

interface AssetRendererProps {
  assetId: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}

// ==========================================
// COMPONENTES INDIVIDUALES POR ASSET
// ==========================================

// 1. PALÉ DE MADERA DECORATIVO
export function PalletAsset({
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={44}
        height={44}
        fill="#8D5B33"
        stroke="#4A2E16"
        strokeWidth={1.5}
        cornerRadius={1}
      />
      <Line points={[0, 11, 44, 11]} stroke="#4A2E16" strokeWidth={1.5} />
      <Line points={[0, 22, 44, 22]} stroke="#4A2E16" strokeWidth={1.5} />
      <Line points={[0, 33, 44, 33]} stroke="#4A2E16" strokeWidth={1.5} />
      <Group x={6} y={6} rotation={12}>
        <Rect
          width={28}
          height={28}
          fill="#C68B59"
          stroke="#7C4A21"
          strokeWidth={1}
          cornerRadius={1}
        />
        <Line points={[14, 0, 14, 28]} stroke="#E2C08D" strokeWidth={2} />
      </Group>
    </Group>
  );
}

// 2. MANCHAS DE ACEITE / RESIDUOS
export function OilStainAsset({
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
  color = "#261C14",
}: {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
  color?: string;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Path
        data="M 0 0 C 15 -10, 35 -5, 40 10 C 45 25, 25 35, 10 30 C -5 25, -15 10, 0 0 Z"
        fill={color}
        opacity={0.55}
      />
    </Group>
  );
}

// 3. CAJAS DISPERSAS / ESCOMBROS
export function ScatteredBoxesAsset({
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        x={0}
        y={0}
        width={18}
        height={18}
        fill="#D49B6A"
        stroke="#7C4A21"
        strokeWidth={1}
        rotation={15}
      />
      <Rect
        x={12}
        y={10}
        width={22}
        height={16}
        fill="#B57B48"
        stroke="#5C3A18"
        strokeWidth={1}
        rotation={-25}
      />
      <Rect
        x={-8}
        y={15}
        width={14}
        height={14}
        fill="#8C5A32"
        stroke="#4A2E16"
        strokeWidth={1}
        rotation={42}
      />
    </Group>
  );
}

// 4. CAJA DE CARTÓN
export function CajaCartonAsset({
  width: w = 44,
  height: h = 44,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#C68B59"
        stroke="#7C4A21"
        strokeWidth={1.5}
        cornerRadius={1}
      />
      <Line points={[w / 2, 0, w / 2, h]} stroke="#E2C08D" strokeWidth={2} />
    </Group>
  );
}

// 6. ESCRITORIO CON PC
export function EscritorioPCAsset({
  width: w = 50,
  height: h = 40,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#B45309"
        stroke="#78350F"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      <Rect
        x={w * 0.3}
        y={h * 0.08}
        width={w * 0.4}
        height={h * 0.45}
        fill="#18181B"
        stroke="#000000"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      <Rect
        x={w * 0.34}
        y={h * 0.13}
        width={w * 0.32}
        height={h * 0.3}
        fill="#0EA5E9"
        opacity={0.85}
      />
      <Rect
        x={w * 0.46}
        y={h * 0.53}
        width={w * 0.08}
        height={h * 0.08}
        fill="#3F3F46"
      />
      <Rect
        x={w * 0.25}
        y={h * 0.68}
        width={w * 0.5}
        height={h * 0.14}
        fill="#475569"
        cornerRadius={1}
      />
    </Group>
  );
}

// 7. CAMIÓN DE REPARTO
export function CamionRepartoAsset({
  width: w = 60,
  height: h = 40,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        x={w - 30}
        y={2}
        width={28}
        height={h - 4}
        fill="#DC2626"
        stroke="#991B1B"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      <Rect
        x={0}
        y={0}
        width={w - 32}
        height={h}
        fill="#E2E8F0"
        stroke="#64748B"
        strokeWidth={1.5}
        cornerRadius={2}
      />
    </Group>
  );
}

// 8. HORNO INDUSTRIAL
export function HornoIndustrialAsset({
  width: w = 50,
  height: h = 50,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#27272A"
        stroke="#09090B"
        strokeWidth={2}
        cornerRadius={3}
      />
      <Rect
        x={w * 0.2}
        y={h * 0.25}
        width={w * 0.6}
        height={h * 0.4}
        fill="#F97316"
        stroke="#7C2D12"
        strokeWidth={1.5}
        cornerRadius={2}
        shadowColor="#F97316"
        shadowBlur={8}
      />
      <Line
        points={[w * 0.15, h * 0.85, w * 0.85, h * 0.85]}
        stroke="#52525B"
        strokeWidth={2}
      />
    </Group>
  );
}

// 9. TORNO CNC
export function TornoCNCAsset({
  width: w = 60,
  height: h = 40,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#3F3F46"
        stroke="#18181B"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      <Circle
        x={w * 0.25}
        y={h / 2}
        radius={Math.min(w, h) * 0.18}
        fill="#A1A1AA"
        stroke="#27272A"
        strokeWidth={1.5}
      />
      <Rect
        x={w * 0.35}
        y={h / 2 - 3}
        width={w * 0.55}
        height={6}
        fill="#71717A"
      />
      <Circle x={w * 0.85} y={h / 2} radius={4} fill="#EF4444" />
    </Group>
  );
}

// 10. RACK / ESTANTERÍA
export function RackEstanteriaAsset({
  width: w = 50,
  height: h = 80,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#57534E"
        stroke="#292524"
        strokeWidth={1.5}
        cornerRadius={1}
      />
      <Line
        points={[0, h * 0.33, w, h * 0.33]}
        stroke="#292524"
        strokeWidth={2}
      />
      <Line
        points={[0, h * 0.66, w, h * 0.66]}
        stroke="#292524"
        strokeWidth={2}
      />
      <Rect
        x={w * 0.08}
        y={h * 0.05}
        width={w * 0.35}
        height={h * 0.22}
        fill="#D97706"
      />
      <Rect
        x={w * 0.55}
        y={h * 0.38}
        width={w * 0.35}
        height={h * 0.22}
        fill="#C68B59"
      />
      <Rect
        x={w * 0.08}
        y={h * 0.71}
        width={w * 0.35}
        height={h * 0.22}
        fill="#B57B48"
      />
    </Group>
  );
}

// 11. ESTACIÓN DE SOLDADURA
export function EstacionSoldaduraAsset({
  width: w = 40,
  height: h = 40,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#3B82F6"
        stroke="#1E3A8A"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      <Circle
        x={w * 0.7}
        y={h * 0.3}
        radius={5}
        fill="#FDE68A"
        shadowColor="#FDE68A"
        shadowBlur={10}
      />
      <Line
        points={[w * 0.2, h * 0.7, w * 0.5, h * 0.5]}
        stroke="#1E3A8A"
        strokeWidth={3}
      />
    </Group>
  );
}

// 12. CAMIÓN DE CARGA
export function CamionCargaAsset({
  width: w = 80,
  height: h = 40,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        x={0}
        y={h * 0.15}
        width={w * 0.75}
        height={h * 0.7}
        fill="#E2E8F0"
        stroke="#64748B"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      <Rect
        x={w * 0.75}
        y={0}
        width={w * 0.25}
        height={h}
        fill="#DC2626"
        stroke="#7F1D1D"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      <Circle x={w * 0.2} y={h} radius={h * 0.12} fill="#18181B" />
      <Circle x={w * 0.6} y={h} radius={h * 0.12} fill="#18181B" />
    </Group>
  );
}

// 13. CINTA TRANSPORTADORA
export function CintaTransportadoraAsset({
  width: w = 100,
  height: h = 30,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#52525B"
        stroke="#27272A"
        strokeWidth={1.5}
        cornerRadius={4}
      />
      <Rect
        x={w * 0.05}
        y={h * 0.3}
        width={w * 0.9}
        height={h * 0.4}
        fill="#3F3F46"
      />
      {[0.15, 0.4, 0.65, 0.85].map((p) => (
        <Rect
          key={p}
          x={w * p}
          y={h * 0.35}
          width={w * 0.08}
          height={h * 0.3}
          fill="#71717A"
          cornerRadius={2}
        />
      ))}
    </Group>
  );
}

// 14. ASSET DEFAULT (GENÉRICO)
export function DefaultAsset({
  width: w = 40,
  height: h = 40,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        width={w}
        height={h}
        fill="#B57B48"
        stroke="#5C3A18"
        strokeWidth={1.5}
        cornerRadius={2}
      />
    </Group>
  );
}

// ==========================================
// RENDERIZADOR PRINCIPAL POR ASSET ID
// ==========================================

export function CatalogAssetRenderer({
  assetId,
  width,
  height,
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
}: AssetRendererProps) {
  const commonProps = { x, y, rotation, scale, width, height };

  switch (assetId) {
    case "caja_carton":
      return <CajaCartonAsset {...commonProps} />;

    case "camion_reparto":
      return <CamionRepartoAsset {...commonProps} />;

    case "mancha_aceite":
      return <OilStainAsset {...commonProps} />;

    case "cajas_dispersas":
      return <ScatteredBoxesAsset {...commonProps} />;

    case "horno-industrial":
      return <HornoIndustrialAsset {...commonProps} />;

    case "torno-cnc":
      return <TornoCNCAsset {...commonProps} />;

    case "rack-estanteria":
      return <RackEstanteriaAsset {...commonProps} />;

    case "estacion-soldadura":
      return <EstacionSoldaduraAsset {...commonProps} />;

    case "camion-carga":
      return <CamionCargaAsset {...commonProps} />;

    case "cinta-transportadora":
      return <CintaTransportadoraAsset {...commonProps} />;

    case "escritorio_pc":
    case "escritorio-pc":
      return <EscritorioPCAsset {...commonProps} />;

    case "pallet":
      return <PalletAsset {...commonProps} />;

    default:
      return <DefaultAsset {...commonProps} />;
  }
}
