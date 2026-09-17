import { GoogleGenerativeAI } from "@google/generative-ai";
import { MapData, buildMapSchema } from "@/types/schema";
import { getMapGenerationSystemPrompt } from "@/app/lib/prompts";
import { CATALOG_IDS, CATALOG_LIST_TEXT } from "@/app/lib/assetsCatalog";
import { NextResponse } from "next/server";

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Lista de modelos ordenados por prioridad
const AVAILABLE_MODELS = ["gemini-3.6-flash", "gemini-3.1-pro-preview"];

// Función auxiliar para esperar N milisegundos entre reintentos
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// IMPORTANTE: los assetId usados acá deben existir en CATALOG (src/lib/catalog.ts)
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
    const mapSchema = buildMapSchema(CATALOG_IDS);

    let mapObject: MapData | null = null;

    // Iterar sobre los modelos disponibles
    for (const modelName of AVAILABLE_MODELS) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: systemPrompt,
      });

      // Intentar hasta 2 reintentos si ocurre un error 503 o si falla la validación
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await model.generateContent(
            `Genera el mapa en JSON para el siguiente escenario: "${prompt}"`,
          );
          const responseText = result.response.text();
          const rawParsed = JSON.parse(responseText);

          // Validación estricta contra el catálogo real (incluye assetId)
          const validation = mapSchema.safeParse(rawParsed);
          if (!validation.success) {
            console.warn(
              `Respuesta de ${modelName} no pasó la validación de esquema:`,
              validation.error.flatten(),
            );
            throw new Error("Validación de esquema fallida");
          }

          mapObject = validation.data;
          break; // Éxito
        } catch (error: any) {
          const is503 =
            error?.message?.includes("503") || error?.status === 503;
          console.warn(
            `Intento ${attempt} con ${modelName} falló (${error?.message || error}).`,
          );

          if (is503 && attempt < 2) {
            console.log(
              "Esperando 1.5s antes de reintentar por saturación del servidor...",
            );
            await delay(1500);
          } else if (attempt < 2) {
            // reintento simple también para fallas de validación de esquema
            continue;
          } else {
            break; // Saltar al siguiente modelo de la lista
          }
        }
      }

      if (mapObject) break; // Si se generó el mapa con éxito, salir del bucle
    }

    // Si todos los intentos fallaron (503 o validación), entregar el mapa local de resguardo
    if (!mapObject) {
      console.warn(
        "No se pudo generar/validar un mapa vía Gemini. Usando mapa de resguardo local.",
      );
      mapObject = MOCK_FALLBACK_MAP;
    }

    return NextResponse.json({ success: true, map: mapObject });
  } catch (error: any) {
    console.error("Error procesando la petición:", error);
    return NextResponse.json({ success: true, map: MOCK_FALLBACK_MAP });
  }
}
