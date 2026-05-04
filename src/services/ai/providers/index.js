const OpenAICompatibleProvider = require("./openaiCompatible");
const GeminiProvider = require("./gemini");
const AnthropicProvider = require("./anthropic");

let _registry = null;

/**
 * Build the provider registry from environment variables. Called lazily on
 * first access so `dotenv` has finished loading by then.
 *
 * Env vars (all optional — providers without their key are skipped):
 *   AI_DEFAULT_PROVIDER     pin a default provider name
 *   AI_FALLBACK_ORDER       comma-separated order, default below
 *   GEMINI_API_KEY          + optional GEMINI_MODEL
 *   GROQ_API_KEY            + optional GROQ_MODEL
 *   OPENROUTER_API_KEY      + optional OPENROUTER_MODEL, OPENROUTER_REFERER
 *   OLLAMA_BASE_URL         + optional OLLAMA_MODEL (no auth required)
 *   OPENAI_API_KEY          + optional OPENAI_MODEL
 *   ANTHROPIC_API_KEY       + optional ANTHROPIC_MODEL
 */
function buildRegistry() {
  const providers = new Map();

  if (process.env.GEMINI_API_KEY) {
    providers.set(
      "gemini",
      new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY,
        defaultModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      })
    );
  }

  if (process.env.GROQ_API_KEY) {
    providers.set(
      "groq",
      new OpenAICompatibleProvider({
        name: "groq",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
        defaultModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      })
    );
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.set(
      "openrouter",
      new OpenAICompatibleProvider({
        name: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultModel:
          process.env.OPENROUTER_MODEL ||
          "meta-llama/llama-3.3-8b-instruct:free",
        extraHeaders: {
          // OpenRouter requires/recommends these for ranking and analytics.
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://docify.app",
          "X-Title": "Docify",
        },
      })
    );
  }

  if (process.env.OLLAMA_BASE_URL) {
    providers.set(
      "ollama",
      new OpenAICompatibleProvider({
        name: "ollama",
        baseUrl: `${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/v1`,
        apiKey: "ollama",
        defaultModel: process.env.OLLAMA_MODEL || "llama3.2",
        requireAuth: false,
      })
    );
  }

  if (process.env.OPENAI_API_KEY) {
    providers.set(
      "openai",
      new OpenAICompatibleProvider({
        name: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      })
    );
  }

  if (process.env.ANTHROPIC_API_KEY) {
    providers.set(
      "anthropic",
      new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel: process.env.ANTHROPIC_MODEL || "claude-opus-4-7",
      })
    );
  }

  // Free providers first by default — Anthropic / OpenAI fall through last.
  const fallbackOrder = (
    process.env.AI_FALLBACK_ORDER ||
    "gemini,groq,openrouter,ollama,anthropic,openai"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let defaultName = null;
  const requested = process.env.AI_DEFAULT_PROVIDER;
  if (requested && providers.has(requested)) {
    defaultName = requested;
  } else {
    defaultName = fallbackOrder.find((n) => providers.has(n)) || null;
  }

  return { providers, fallbackOrder, defaultName };
}

function registry() {
  if (!_registry) _registry = buildRegistry();
  return _registry;
}

function getProviderByName(name) {
  return registry().providers.get(name) || null;
}

function getDefaultProviderName() {
  return registry().defaultName;
}

function getFallbackOrder() {
  return registry().fallbackOrder;
}

function listAvailable() {
  const reg = registry();
  return Array.from(reg.providers.entries()).map(([name, p]) => ({
    name,
    model: p.defaultModel(),
    available: p.isConfigured(),
    isDefault: name === reg.defaultName,
  }));
}

/**
 * Try `preferred` first (if configured), then the default, then every other
 * configured provider in the fallback order. Returns the first success;
 * throws the last error if all fail.
 */
async function runWithFallback(runner, preferred = null) {
  const reg = registry();
  if (reg.providers.size === 0) {
    const err = new Error(
      "No AI provider is configured on the server. Set GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY / OLLAMA_BASE_URL / OPENAI_API_KEY / ANTHROPIC_API_KEY."
    );
    err.status = 503;
    throw err;
  }

  const queue = [];
  const tried = new Set();
  const enqueue = (name) => {
    if (name && reg.providers.has(name) && !tried.has(name)) {
      queue.push(name);
      tried.add(name);
    }
  };

  enqueue(preferred);
  enqueue(reg.defaultName);
  for (const n of reg.fallbackOrder) enqueue(n);

  let lastErr = null;
  for (const name of queue) {
    const provider = reg.providers.get(name);
    try {
      return await runner(provider);
    } catch (err) {
      console.warn(
        `[ai] provider "${name}" failed (${err?.status || "?"}): ${err?.message || err}`
      );
      lastErr = err;
    }
  }
  throw lastErr || new Error("All configured AI providers failed.");
}

module.exports = {
  getProviderByName,
  getDefaultProviderName,
  getFallbackOrder,
  listAvailable,
  runWithFallback,
};
