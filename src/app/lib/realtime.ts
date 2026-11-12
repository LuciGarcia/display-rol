import { createBrowserWorldSubscriber } from "@/infrastructure/realtime/browserSubscriber";

export const worldSubscriber = createBrowserWorldSubscriber();
export { worldReader, activeWorldSource } from "@/app/lib/worldReader";
