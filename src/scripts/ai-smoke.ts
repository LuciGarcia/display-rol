import { createAIProvider } from "../ai/createAIProvider";

async function main() {
  const provider = createAIProvider();
  const res = await provider.generate({
    prompt: 'Responde únicamente con el JSON {"ok":true}',
    responseFormat: "json",
    temperature: 0,
  });
  console.log(`[${res.providerId} / ${res.model}]`, res.text);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? `${error.name}: ${error.message}` : error,
  );
  process.exit(1);
});
