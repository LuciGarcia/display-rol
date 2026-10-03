import { loadAIConfig, type Env } from "./config";
import { GoogleAIProvider } from "./providers/GoogleAIProvider";
import type { AIProvider } from "./types";

// Único punto donde se elige el proveedor concreto. Solo para código de servidor.
export function createAIProvider(env: Env = process.env): AIProvider {
  const config = loadAIConfig(env);
  switch (config.provider) {
    case "google":
      return new GoogleAIProvider(config);
  }
}
