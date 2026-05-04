const BaseProvider = require("./baseProvider");

/**
 * Single implementation that fronts every OpenAI-compatible chat-completions
 * endpoint: OpenAI itself, OpenRouter, Groq, and Ollama (via its /v1 shim).
 *
 * Differences across them are encoded as constructor args (baseUrl, apiKey,
 * extraHeaders, requireAuth) — the wire format is identical, so the registry
 * stamps out one instance per configured backend.
 */
class OpenAICompatibleProvider extends BaseProvider {
  constructor({
    name,
    baseUrl,
    apiKey,
    defaultModel,
    requireAuth = true,
    extraHeaders = {},
  } = {}) {
    super({ name, defaultModel });
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.requireAuth = requireAuth;
    this.extraHeaders = extraHeaders;
  }

  isConfigured() {
    if (!this.baseUrl) return false;
    if (this.requireAuth && !this.apiKey) return false;
    return true;
  }

  async generateText({
    prompt,
    systemPrompt,
    model,
    temperature = 0.4,
    maxTokens = 2048,
  } = {}) {
    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const payload = {
      model: model || this.defaultModel(),
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const headers = {
      "Content-Type": "application/json",
      ...this.extraHeaders,
    };
    if (this.requireAuth) headers.Authorization = `Bearer ${this.apiKey}`;

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const e = new Error(`${this.name} network error: ${err.message}`);
      e.status = 502;
      throw e;
    }

    if (!res.ok) {
      const errBody = await res.text();
      const err = new Error(
        `${this.name} ${res.status}: ${errBody.slice(0, 500)}`
      );
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return {
      text: String(text).trim(),
      provider: this.name,
      model: data?.model || payload.model,
      usage: data?.usage || null,
    };
  }
}

module.exports = OpenAICompatibleProvider;
