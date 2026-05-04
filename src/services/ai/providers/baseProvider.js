/**
 * Common interface every AI provider implements.
 *
 * All providers return:
 *   { text: string, provider: string, model: string, usage?: object }
 *
 * `isConfigured()` is what the registry uses to decide whether the provider
 * is available — typically "API key + base URL set".
 */
class BaseProvider {
  constructor({ name, defaultModel } = {}) {
    this.name = name;
    this._defaultModel = defaultModel;
  }

  isConfigured() {
    return false;
  }

  defaultModel() {
    return this._defaultModel;
  }

  // eslint-disable-next-line no-unused-vars
  async generateText({ prompt, systemPrompt, model, temperature, maxTokens } = {}) {
    throw new Error(`generateText not implemented for provider "${this.name}"`);
  }
}

module.exports = BaseProvider;
