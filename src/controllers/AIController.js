const Note = require("../models/note");
const { systemPromptFor, ALLOWED_ACTIONS } = require("../services/ai/prompts");
const {
  listAvailable,
  getDefaultProviderName,
  runWithFallback,
} = require("../services/ai/providers");
const rateLimiter = require("../services/ai/rateLimiter");

const MAX_INPUT_CHARS = Number(process.env.AI_MAX_INPUT_CHARS) || 30_000;

/**
 * AI editor endpoint. Accepts a free-form `selectedText`/`fullContent` pair
 * and an action; runs the configured AI provider with per-action system
 * prompt; returns the text result plus the provider/model it came from so the
 * UI can attribute it.
 */
const editor = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    // Per-user rate limit before doing any work.
    const rl = rateLimiter.check(userId);
    if (!rl.allowed) {
      const retryAfterSec = Math.max(
        0,
        Math.ceil((rl.resetAt - Date.now()) / 1000)
      );
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        msg: "Too many AI requests. Try again in a moment.",
        data: { resetAt: rl.resetAt },
      });
    }

    const {
      action,
      selectedText,
      fullContent,
      noteId,
      customPrompt,
      providerOverride,
    } = req.body || {};

    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({
        success: false,
        msg: `Invalid action. Must be one of: ${ALLOWED_ACTIONS.join(", ")}`,
      });
    }

    if (action === "custom" && (!customPrompt || !customPrompt.trim())) {
      return res.status(400).json({
        success: false,
        msg: 'customPrompt is required when action is "custom".',
      });
    }

    const inputRaw =
      (typeof selectedText === "string" && selectedText.trim()) ||
      (typeof fullContent === "string" && fullContent) ||
      "";
    if (!inputRaw.trim()) {
      return res.status(400).json({
        success: false,
        msg: "No input text. Provide selectedText or fullContent.",
      });
    }
    if (inputRaw.length > MAX_INPUT_CHARS) {
      return res.status(413).json({
        success: false,
        msg: `Input is too long. Max ${MAX_INPUT_CHARS} characters.`,
      });
    }

    // If the client sent a noteId, verify ownership. The server doesn't read
    // the note's content from DB — the body has it — so this is a defensive
    // check to ensure the AI feature can't be used with a foreign note ref.
    if (noteId) {
      const note = await Note.findOne({
        where: { id: noteId, user_id: userId },
        attributes: ["id"],
      });
      if (!note) {
        return res
          .status(404)
          .json({ success: false, msg: "Note not found." });
      }
    }

    const systemPrompt = systemPromptFor(action, customPrompt);
    if (!systemPrompt) {
      return res.status(400).json({
        success: false,
        msg: "Could not resolve a system prompt for this action.",
      });
    }

    const isSelection =
      typeof selectedText === "string" && selectedText.trim().length > 0;
    const userPrompt = isSelection
      ? `The user has selected this excerpt from a note. Apply the action to the SELECTION ONLY:\n\n---\n${inputRaw}\n---`
      : `The user wants the action applied to their full note:\n\n---\n${inputRaw}\n---`;

    const result = await runWithFallback(
      (provider) =>
        provider.generateText({
          prompt: userPrompt,
          systemPrompt,
          temperature: 0.4,
          maxTokens: 2048,
        }),
      providerOverride
    );

    return res.status(200).json({
      success: true,
      msg: "AI response generated",
      data: {
        result: result.text,
        provider: result.provider,
        model: result.model,
        action,
        usage: result.usage || null,
      },
    });
  } catch (err) {
    console.error("[ai/editor] error:", err);
    const status =
      err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    return res.status(status).json({
      success: false,
      msg: err?.message || "AI request failed",
    });
  }
};

const providers = async (_req, res) => {
  try {
    const list = listAvailable();
    return res.status(200).json({
      success: true,
      msg: "Providers",
      data: {
        providers: list,
        default: getDefaultProviderName(),
      },
    });
  } catch (err) {
    console.error("[ai/providers] error:", err);
    return res
      .status(500)
      .json({ success: false, msg: "Failed to list providers" });
  }
};

module.exports = { editor, providers };
