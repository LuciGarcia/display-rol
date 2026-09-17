/*export async function emitGameEvent(
  sessionId: string,
  eventType: string,
  data: any,
) {
  try {
    await fetch("/api/game-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, eventType, data }),
    });
  } catch (err) {
    console.error(`Error emitiendo evento ${eventType}:`, err);
  }
}
*/

export async function emitGameEvent(
  sessionId: string,
  eventType: string,
  data: any,
) {
  try {
    // Sincronización instantánea entre pestañas del mismo navegador
    const channel = new BroadcastChannel(`game-session-${sessionId}`);
    channel.postMessage({ eventType, data });
    channel.close();
  } catch (err) {
    console.error(`Error emitiendo evento local ${eventType}:`, err);
  }
}
