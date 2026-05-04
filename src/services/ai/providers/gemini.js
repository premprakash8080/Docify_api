const BaseProvider = require("./baseProvider");

/**
 * Google Gemini via the v1beta `generateContent` REST endpoint.
 *
 * Gemini's wire format differs from OpenAI's: a `contents` array of
 * `{ parts: [{ text }] }` and a separate `systemInstruction` field. We bridge
 * the OpenAI-style {systemPrompt, prompt} interface onto it here.
 */
class GeminiProvider extends BaseProvider {
  constructor({ apiKey, defaultModel = "gemini-2.0-flash" } = {}) {
    super({ name: "gemini", defaultModel });
    this.apiKey = apiKey;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async generateText({
    prompt,
    systemPrompt,
    model,
    temperature = 0.4,
    maxTokens = 2048,
  } = {}) {
    const m = model || this.defaultModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      m
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };
    if (systemPrompt) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const e = new Error(`gemini network error: ${err.message}`);
      e.status = 502;
      throw e;
    }

    if (!res.ok) {
      const errBody = await res.text();
      const err = new Error(`gemini ${res.status}: ${errBody.slice(0, 500)}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("") || "";

    return {
      text: String(text).trim(),
      provider: "gemini",
      model: m,
      usage: data?.usageMetadata || null,
    };
  }
}

module.exports = GeminiProvider;
