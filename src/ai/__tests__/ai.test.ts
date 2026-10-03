import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AIProviderError, type AIErrorCode } from "../errors";
import { loadAIConfig } from "../config";
import { FakeAIProvider } from "../FakeAIProvider";
import {
  GoogleAIProvider,
  type GoogleTransport,
} from "../providers/GoogleAIProvider";
import type { AIProvider } from "../types";

const KEY = "SECRET-KEY-123";
const cfg = {
  provider: "google" as const,
  apiKey: KEY,
  model: "test-model",
  timeoutMs: 1000,
};
const google = (t: GoogleTransport) => new GoogleAIProvider(cfg, t);
const httpError = (status: number, msg = "fallo") =>
  Object.assign(new Error(msg), { status });

// A. Un consumidor que solo conoce AIProvider
async function consumer(provider: AIProvider, prompt: string): Promise<string> {
  const r = await provider.generate({ prompt });
  return `${r.providerId}:${r.text}`;
}

const rejectsWith = (p: AIProvider, code: AIErrorCode) =>
  assert.rejects(
    () => p.generate({ prompt: "hola" }),
    (e: unknown) => e instanceof AIProviderError && e.code === code,
  );

describe("FASE 6 — contrato AIProvider", () => {
  const providers: AIProvider[] = [
    new FakeAIProvider(() => "ok"),
    google(async () => "ok"),
  ];
  for (const p of providers) {
    it(`A. el consumidor funciona igual con "${p.id}"`, async () => {
      assert.equal(await consumer(p, "hola"), `${p.id}:ok`);
    });
    it(`A. "${p.id}" rechaza prompts vacíos`, async () => {
      await assert.rejects(
        () => p.generate({ prompt: "   " }),
        (e: unknown) =>
          e instanceof AIProviderError && e.code === "INVALID_REQUEST",
      );
    });
  }
});

describe("FASE 6 — FakeAIProvider", () => {
  it("B. es determinista y registra las llamadas", async () => {
    const fake = new FakeAIProvider((r) => r.prompt.toUpperCase());
    assert.equal((await fake.generate({ prompt: "abc" })).text, "ABC");
    assert.equal((await fake.generate({ prompt: "abc" })).text, "ABC");
    assert.equal(fake.calls.length, 2);
  });
  it("B. puede simular errores controlados", async () => {
    const fake = new FakeAIProvider(() => {
      throw new AIProviderError("RATE_LIMIT", "simulado");
    });
    await rejectsWith(fake, "RATE_LIMIT");
  });
});

describe("FASE 6 — configuración", () => {
  it("D. configuración válida con valores por defecto", () => {
    const c = loadAIConfig({ GOOGLE_GENERATIVE_AI_API_KEY: KEY });
    assert.equal(c.provider, "google");
    assert.equal(c.apiKey, KEY);
    assert.ok(c.model.length > 0 && c.timeoutMs > 0);
  });
  it("D. acepta GEMINI_API_KEY (compatibilidad con el legacy)", () => {
    assert.equal(loadAIConfig({ GEMINI_API_KEY: KEY }).apiKey, KEY);
  });
  it("D. respeta AI_MODEL y AI_TIMEOUT_MS", () => {
    const c = loadAIConfig({
      GEMINI_API_KEY: KEY,
      AI_MODEL: "otro",
      AI_TIMEOUT_MS: "5000",
    });
    assert.equal(c.model, "otro");
    assert.equal(c.timeoutMs, 5000);
  });
  it("D. sin API key lanza CONFIG", () => {
    assert.throws(
      () => loadAIConfig({}),
      (e: unknown) => e instanceof AIProviderError && e.code === "CONFIG",
    );
  });
  it("D. proveedor desconocido y timeout inválido lanzan CONFIG", () => {
    for (const env of [
      { GEMINI_API_KEY: KEY, AI_PROVIDER: "foo" },
      { GEMINI_API_KEY: KEY, AI_TIMEOUT_MS: "abc" },
    ]) {
      assert.throws(
        () => loadAIConfig(env),
        (e: unknown) => e instanceof AIProviderError && e.code === "CONFIG",
      );
    }
  });
  it("D. el mensaje de error de configuración no filtra la key", () => {
    try {
      loadAIConfig({ GEMINI_API_KEY: KEY, AI_PROVIDER: "foo" });
      assert.fail("debía lanzar");
    } catch (e) {
      assert.ok(!(e as Error).message.includes(KEY));
    }
  });
});

describe("FASE 6 — GoogleAIProvider (sin red)", () => {
  it("C. devuelve AIResponse neutral", async () => {
    const r = await google(async () => "hola").generate({ prompt: "x" });
    assert.deepEqual(r, {
      text: "hola",
      providerId: "google",
      model: "test-model",
    });
  });
  it("C. pasa system, formato y temperatura al transporte ya normalizados", async () => {
    let seen: unknown;
    await google(async (req) => ((seen = req), "ok")).generate({
      prompt: "x",
      system: "s",
      responseFormat: "json",
      temperature: 0,
    });
    assert.deepEqual(seen, {
      prompt: "x",
      system: "s",
      responseFormat: "json",
      temperature: 0,
    });
  });
  it("E. respuesta vacía → EMPTY_RESPONSE", async () => {
    await rejectsWith(
      google(async () => "  "),
      "EMPTY_RESPONSE",
    );
  });
  it("E. 429 → RATE_LIMIT (reintentable)", async () => {
    const p = google(async () => {
      throw httpError(429);
    });
    await assert.rejects(
      () => p.generate({ prompt: "x" }),
      (e: unknown) =>
        e instanceof AIProviderError &&
        e.code === "RATE_LIMIT" &&
        e.retryable &&
        e.status === 429,
    );
  });
  it("E. 503 → UNAVAILABLE", async () => {
    await rejectsWith(
      google(async () => {
        throw httpError(503);
      }),
      "UNAVAILABLE",
    );
  });
  it("E. 401/403 → CONFIG", async () => {
    await rejectsWith(
      google(async () => {
        throw httpError(403);
      }),
      "CONFIG",
    );
  });
  it("E. AbortError → TIMEOUT", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    await rejectsWith(
      google(async () => {
        throw abort;
      }),
      "TIMEOUT",
    );
  });
  it("E. error desconocido → UNKNOWN", async () => {
    await rejectsWith(
      google(async () => {
        throw new Error("raro");
      }),
      "UNKNOWN",
    );
  });
  it("E. nunca filtra la API key en el mensaje", async () => {
    const p = google(async () => {
      throw new Error(`falló https://x.test?key=${KEY}`);
    });
    try {
      await p.generate({ prompt: "x" });
      assert.fail("debía lanzar");
    } catch (e) {
      assert.ok(e instanceof AIProviderError);
      assert.ok(!e.message.includes(KEY));
    }
  });
});

describe("FASE 6 — fronteras arquitectónicas", () => {
  const listSrc = (dir: string): string[] => {
    const root = join(process.cwd(), dir);
    if (!existsSync(root)) return [];
    return (readdirSync(root, { recursive: true }) as string[])
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))
      .map((f) => join(root, f));
  };
  const SDK =
    /from\s+["'](@google\/generative-ai|@ai-sdk\/[^"']+|openai|ai)["']/;
  const AI_MODULE = /from\s+["'](@\/ai\/|(\.\.?\/)+ai\/)/;
  const LAYERS = [
    "src/domain",
    "src/engine",
    "src/assets",
    "src/renderers",
    "src/adapters",
    "src/hooks",
    "src/components",
  ];

  it("F. ninguna capa existente importa un SDK de IA ni el módulo src/ai", () => {
    for (const file of LAYERS.flatMap(listSrc)) {
      const src = readFileSync(file, "utf8");
      assert.ok(!SDK.test(src), `SDK de IA importado en ${file}`);
      assert.ok(!AI_MODULE.test(src), `src/ai importado en ${file}`);
    }
  });
  it("F. dentro de src/ai solo providers/ importa el SDK", () => {
    for (const file of listSrc("src/ai")) {
      const inProviders = file
        .replace(/\\/g, "/")
        .includes("/src/ai/providers/");
      if (!inProviders)
        assert.ok(
          !SDK.test(readFileSync(file, "utf8")),
          `SDK importado en ${file}`,
        );
    }
  });
  it("F. src/ai no depende del dominio ni del renderer", () => {
    for (const file of listSrc("src/ai")) {
      assert.ok(
        !/from\s+["'][^"']*(domain|engine|assets|renderers)[^"']*["']/.test(
          readFileSync(file, "utf8"),
        ),
        file,
      );
    }
  });
});
