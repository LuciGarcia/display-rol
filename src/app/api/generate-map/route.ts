import { GoogleGenerativeAI } from "@google/generative-ai";
import { MapData, MapDataInput, buildMapInputSchema } from "@/types/schema";
import { getMapGenerationSystemPrompt } from "@/app/lib/prompts";
import { CATALOG_IDS, CATALOG_LIST_TEXT } from "@/app/lib/assetsCatalog";
import { computeAreaLayout } from "@/app/lib/areaLayout";
import { packAreaFurniture } from "@/app/lib/furniturePacker";
import { NextResponse } from "next/server";

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Confirmá estos IDs contra los modelos vigentes en tu cuenta de Google AI Studio
const AVAILABLE_MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite"];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isChaoticState(state: string): boolean {
  const s = state.toLowerCase();
  return s.includes("caoti") || s.includes("desorden") || s.includes("crisis");
}

function toClientMapData(input: MapDataInput): MapData {
  const layout = computeAreaLayout(
    input.areas.map((a) => ({ id: a.id, type: a.type, weight: a.weight })),
    input.dimensions.width,
    input.dimensions.height,
  );

  const areas = input.areas.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currentState: a.currentState,
    allowedStates: a.allowedStates,
    color: a.color,
    bounds: layout[a.id],
  }));

  const obstacles = input.areas.flatMap((a) =>
    packAreaFurniture(
      { id: a.id, bounds: layout[a.id], currentState: a.currentState },
      a.furnitureRequest,
      isChaoticState(a.currentState),
    ),
  );

  return {
    scenarioName: input.scenarioName,
    dimensions: input.dimensions,
    areas,
    obstacles,
  };
}

const MOCK_FALLBACK_MAP: MapData = {
  scenarioName: "Planta Industrial Metalúrgica (Resguardo)",
  dimensions: { width: 1000, height: 600 },
  areas: [
    {
      id: "area_1",
      name: "Nave de Fundición y Forja",
      type: "fabrica",
      bounds: { x: 30, y: 30, width: 440, height: 250 },
      currentState: "EN FUNCIONAMIENTO",
      allowedStates: [
        "EN FUNCIONAMIENTO",
        "PAUSADO",
        "INCENDIO / EVACUACIÓN",
        "CAOTICO",
      ],
      color: "#1A1C1E",
    },
    {
      id: "area_2",
      name: "Taller de Maquinado CNC",
      type: "fabrica",
      bounds: { x: 500, y: 30, width: 470, height: 250 },
      currentState: "EN FUNCIONAMIENTO",
      allowedStates: ["EN FUNCIONAMIENTO", "CORTE ENERGÍA CRÍTICO", "CAOTICO"],
      color: "#18181B",
    },
    {
      id: "area_3",
      name: "Almacén de Materia Prima",
      type: "deposito",
      bounds: { x: 30, y: 310, width: 300, height: 260 },
      currentState: "ORDENADO",
      allowedStates: ["ORDENADO", "DESORDENADO", "FALTA INSUMOS CRÍTICA"],
      color: "#121316",
    },
    {
      id: "area_4",
      name: "Área de Soldadura y Ensamblaje",
      type: "laboratorio",
      bounds: { x: 350, y: 310, width: 310, height: 260 },
      currentState: "OPERATIVO",
      allowedStates: ["OPERATIVO", "PAUSADO", "CORTE ENERGÍA CRÍTICO"],
      color: "#18181B",
    },
    {
      id: "area_5",
      name: "Sala de Control y Finanzas",
      type: "oficina",
      bounds: { x: 680, y: 310, width: 290, height: 260 },
      currentState: "OPERATIVO",
      allowedStates: ["OPERATIVO", "ABANDONADO"],
      color: "#121316",
    },
  ],
  obstacles: [
    {
      id: "obs_1",
      assetId: "horno-industrial",
      name: "Horno Industrial 01",
      bounds: { x: 60, y: 70, width: 110, height: 110 },
      rotation: 0,
      color: "#DC2626",
    },
    {
      id: "obs_2",
      assetId: "torno-cnc",
      name: "Torno CNC de Alta Calibre",
      bounds: { x: 530, y: 70, width: 130, height: 80 },
      rotation: 0,
      color: "#0284C7",
    },
    {
      id: "obs_3",
      assetId: "rack-estanteria",
      name: "Rack de Perfiles de Acero",
      bounds: { x: 50, y: 350, width: 150, height: 60 },
      rotation: 0,
      color: "#D97706",
    },
    {
      id: "obs_4",
      assetId: "estacion-soldadura",
      name: "Estación de Soldadura Robotizada",
      bounds: { x: 380, y: 350, width: 100, height: 100 },
      rotation: 0,
      color: "#4F46E5",
    },
  ],
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Debes proporcionar las instrucciones del escenario.",
        },
        { status: 400 },
      );
    }

    const systemPrompt = getMapGenerationSystemPrompt(CATALOG_LIST_TEXT);
    const inputSchema = buildMapInputSchema(CATALOG_IDS);

    let mapObject: MapData | null = null;

    for (const modelName of AVAILABLE_MODELS) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: systemPrompt,
      });

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await model.generateContent(
            `Genera el escenario en JSON para: "${prompt}"`,
          );
          const rawParsed = JSON.parse(result.response.text());
          const validation = inputSchema.safeParse(rawParsed);

          if (!validation.success) {
            console.warn(
              `Respuesta de ${modelName} no validó:`,
              validation.error.flatten(),
            );
            throw new Error("Validación de esquema fallida");
          }

          mapObject = toClientMapData(validation.data);
          break;
        } catch (error: any) {
          const is503 =
            error?.message?.includes("503") || error?.status === 503;
          console.warn(
            `Intento ${attempt} con ${modelName} falló (${error?.message || error}).`,
          );
          if (is503 && attempt < 2) {
            await delay(1500);
          } else if (attempt < 2) {
            continue;
          } else {
            break;
          }
        }
      }
      if (mapObject) break;
    }

    if (!mapObject) {
      console.warn(
        "No se pudo generar/validar un mapa. Usando resguardo local.",
      );
      mapObject = MOCK_FALLBACK_MAP;
    }

    return NextResponse.json({ success: true, map: mapObject });
  } catch (error: any) {
    console.error("Error procesando la petición:", error);
    return NextResponse.json({ success: true, map: MOCK_FALLBACK_MAP });
  }
}
