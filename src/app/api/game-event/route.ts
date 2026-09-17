import { pusherServer } from "@/app/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { sessionId, eventType, data } = await req.json();

    if (!sessionId || !eventType) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros" },
        { status: 400 },
      );
    }

    // Transmitir evento a todos los clientes suscritos al canal de la sesión
    await pusherServer.trigger(`game-session-${sessionId}`, eventType, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error emitiendo evento de tiempo real:", error);
    return NextResponse.json(
      { success: false, error: "Error de sincronización" },
      { status: 500 },
    );
  }
}
