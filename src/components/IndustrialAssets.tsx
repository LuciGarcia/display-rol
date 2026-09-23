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

    case "horno-industrial":
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#27272A"
            stroke="#09090B"
            strokeWidth={2}
            cornerRadius={3}
          />
          {/* ventana de calor */}
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
          {/* rejillas de ventilación */}
          <Line
            points={[w * 0.15, h * 0.85, w * 0.85, h * 0.85]}
            stroke="#52525B"
            strokeWidth={2}
          />
        </Group>
      );

    case "torno-cnc":
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#3F3F46"
            stroke="#18181B"
            strokeWidth={1.5}
            cornerRadius={2}
          />
          {/* husillo/mandril */}
          <Circle
            x={w * 0.25}
            y={h / 2}
            radius={Math.min(w, h) * 0.18}
            fill="#A1A1AA"
            stroke="#27272A"
            strokeWidth={1.5}
          />
          {/* riel horizontal */}
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

    case "rack-estanteria":
      return (
        <Group>
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
          {/* cajas apiladas dentro */}
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

    case "estacion-soldadura":
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            fill="#3B82F6"
            stroke="#1E3A8A"
            strokeWidth={1.5}
            cornerRadius={2}
          />
          {/* marca de arco/chispa */}
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

    case "camion-carga":
      return (
        <Group>
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

    case "cinta-transportadora":
      return (
        <Group>
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

    case "escritorio-pc":
      return (
        <Group>
          {/* superficie del escritorio */}
          <Rect
            width={w}
            height={h}
            fill="#B45309"
            stroke="#78350F"
            strokeWidth={1.5}
            cornerRadius={2}
          />
          {/* monitor */}
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
          {/* base del monitor */}
          <Rect
            x={w * 0.46}
            y={h * 0.53}
            width={w * 0.08}
            height={h * 0.08}
            fill="#3F3F46"
          />
          {/* teclado */}
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

    case "pallet":
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
          <Group x={w * 0.15} y={h * 0.15} rotation={12}>
            <Rect
              width={w * 0.6}
              height={h * 0.6}
              fill="#C68B59"
              stroke="#7C4A21"
              strokeWidth={1}
              cornerRadius={1}
            />
            <Line
              points={[w * 0.3, 0, w * 0.3, h * 0.6]}
              stroke="#E2C08D"
              strokeWidth={2}
            />
          </Group>
        </Group>
      );
  }
}
