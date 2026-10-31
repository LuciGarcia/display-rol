import { createBrowserWorldSubscriber } from "@/infrastructure/realtime/browserSubscriber";

export const worldSubscriber = createBrowserWorldSubscriber();
export { worldReader } from "@/app/lib/worldReader";
