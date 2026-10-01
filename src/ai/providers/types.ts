import { World } from "../../domain/world/world";
import { Command } from "../../domain/events/command";

export interface AIProviderConfig {
  apiKey?: string;
  modelName?: string;
  temperature?: number;
}

export interface AIProvider {
  id: string;
  generateWorldSchema(
    prompt: string,
    config?: AIProviderConfig,
  ): Promise<World>;
  interpretActionToCommand(
    currentWorld: World,
    userActionPrompt: string,
  ): Promise<Command>;
}
