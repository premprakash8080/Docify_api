const Anthropic = require("@anthropic-ai/sdk");
const BaseProvider = require("./baseProvider");

/**
 * Anthropic Claude via the official SDK.
 *
 * Notable model-specific quirks the registry encodes:
 *   - Opus 4.7 (the SDK default we ship with) does not accept `temperature`,
 *     `top_p`, or `top_k` and rejects `budget_tokens` — they all 400. We drop
 *     the temperature parameter on Opus 4.7 and let the user override the
 *     model via `ANTHROPIC_MODEL` if they need a model that takes sampling
 *     params.
 */
class AnthropicProvider extends BaseProvider {
  constructor({ apiKey, defaultModel = "claude-opus-4-7" } = {}) {
    super({ name: "anthropic", defaultModel });
    this.apiKey = apiKey;
    this._client = null;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  client() {
    if (!this._client) {
      // The SDK package's CommonJS export shape is `{ default: AnthropicCtor, ... }`.
      const Ctor = Anthropic.default || Anthropic;
      this._client = new Ctor({ apiKey: this.apiKey });
    }
    return this._client;
  }

  async generateText({
    prompt,
    systemPrompt,
    model,
    temperature,
    maxTokens = 4096,
  } = {}) {
    const m = model || this.defaultModel();

    const params = {
      model: m,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    };
    if (systemPrompt) params.system = systemPrompt;

    // Opus 4.7 disallows sampling params — silently omit on those models.
    const isOpus47 = m.startsWith("claude-opus-4-7");
    if (temperature !== undefined && !isOpus47) {
      params.temperature = temperature;
    }

    const message = await this.client().messages.create(params);

    if (message.stop_reason === "refusal") {
      const err = new Error("AI declined the request.");
      err.status = 422;
      throw err;
    }

    const text = (message.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return {
      text,
      provider: "anthropic",
      model: message.model || m,
      usage: message.usage || null,
    };
  }
}

module.exports = AnthropicProvider;
