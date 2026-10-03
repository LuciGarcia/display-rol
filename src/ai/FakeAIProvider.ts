import {
  parseAIRequest,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from "./types";

type FakeHandler = (request: AIRequest) => string | Promise<string>;

// Para tests: sin red, sin key, sin cuota. Si el handler lanza AIProviderError, se propaga.
export class FakeAIProvider implements AIProvider {
  readonly id = "fake";
  readonly calls: AIRequest[] = [];

  constructor(private readonly handler: FakeHandler = () => "{}") {}

  async generate(request: AIRequest): Promise<AIResponse> {
    parseAIRequest(request);
    this.calls.push({ ...request });
    const text = await this.handler(request);
    return { text, providerId: this.id, model: "fake" };
  }
}
