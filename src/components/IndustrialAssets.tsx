"use client";

import { Group, Rect, Circle, Line, Path } from "react-konva";

interface AssetRendererProps {
  assetId: string;
  width: number;
  height: number;
}

// 1. PALÉ DE MADERA DECORATIVO
export function PalletAsset({
  x,
  y,
  rotation = 0,
  scale = 1,
}: {
  x: number;
  y: number;
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
  x,
  y,
  color = "#261C14",
}: {
  x: number;
  y: number;
  color?: string;
}) {
  return (
    <Group x={x} y={y}>
      <Path
        data="M 0 0 C 15 -10, 35 -5, 40 10 C 45 25, 25 35, 10 30 C -5 25, -15 10, 0 0 Z"
        fill={color}
        opacity={0.55}
      />
    </Group>
  );
}

// 3. CAJAS DISPERSAS / ESCOMBROS
export function ScatteredBoxesAsset({ x, y }: { x: number; y: number }) {
  return (
    <Group x={x} y={y}>
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

// 4. RENDERIZADOR PRINCIPAL POR ASSET ID
export function CatalogAssetRenderer({
  assetId,
  width: w,
  height: h,
}: AssetRendererProps) {
  switch (assetId) {
    case "caja_carton":
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#C68B59"
            stroke="#7C4A21"
            strokeWidth={1.5}
            cornerRadius={1}
          />
          <Line
            points={[w / 2, 0, w / 2, h]}
            stroke="#E2C08D"
            strokeWidth={2}
          />
        </Group>
      );

    case "pale_madera":
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#8D5B33"
            stroke="#4A2E16"
            strokeWidth={1.5}
            cornerRadius={1}
          />
          <Line
            points={[0, h * 0.25, w, h * 0.25]}
            stroke="#4A2E16"
            strokeWidth={1.5}
          />
          <Line
            points={[0, h * 0.5, w, h * 0.5]}
            stroke="#4A2E16"
            strokeWidth={1.5}
          />
          <Line
            points={[0, h * 0.75, w, h * 0.75]}
            stroke="#4A2E16"
            strokeWidth={1.5}
          />
        </Group>
      );

    case "escritorio_pc":
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#D97706"
            stroke="#78350F"
            strokeWidth={1.5}
            cornerRadius={2}
          />
          <Rect
            x={w / 2 - 8}
            y={3}
            width={16}
            height={6}
            fill="#1E293B"
            stroke="#0F172A"
            strokeWidth={1}
          />
          <Rect x={w / 2 - 6} y={12} width={12} height={4} fill="#475569" />
        </Group>
      );

    case "camion_reparto":
      return (
        <Group>
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

    case "mancha_aceite":
      return (
        <Path
          data="M 0 0 C 15 -10, 35 -5, 40 10 C 45 25, 25 35, 10 30 C -5 25, -15 10, 0 0 Z"
          fill="#261C14"
          opacity={0.6}
        />
      );

    default:
      return (
        <Group>
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
}
