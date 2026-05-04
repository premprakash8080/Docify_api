/**
 * Per-action system prompts. Each prompt is tight and constrains output to
 * HTML so the frontend can drop the result into Quill via dangerouslyPaste.
 *
 * Avoid markdown, preambles, or commentary. The frontend renders the result
 * as HTML directly.
 */

const SYSTEM_PROMPTS = {
  summarize: `You are an editor. Summarize the user's text concisely (3–5 sentences for short input, longer if the input is long).
Output only HTML using <p>, <ul>, <li>. No markdown, no preamble, no commentary.`,

  improve: `You are an editor. Improve the user's writing — clearer phrasing, better word choice, smoother flow — without changing the meaning or voice.
Output only the improved text as HTML preserving the original tag structure (<p>, <ul>, etc.). No markdown, no preamble.`,

  expand: `You are an editor. Expand brief notes or bullet points into fuller prose with helpful detail and concrete examples where appropriate. Preserve the user's voice.
Output only the expanded text as HTML using <p> for paragraphs. If the input is a list, expand each <li> into a paragraph. No markdown, no preamble.`,

  rewrite: `You are an editor. Rewrite the user's text in a clearer, tighter style while preserving all key information.
Output only the rewritten text as HTML preserving the original tag structure. No markdown, no preamble.`,

  simplify: `You are an editor. Simplify the user's text — shorter sentences, plainer words, less jargon — without losing key information. Aim for an 8th-grade reading level.
Output only the simplified text as HTML preserving the original tag structure. No markdown, no preamble.`,

  grammar: `You are a copy editor. Fix grammar, spelling, and punctuation in the user's text. Do NOT change meaning, voice, or structure.
Output only the corrected text as HTML preserving the original tags exactly. No markdown, no preamble.`,

  flashcards: `You are a study coach. Generate 5–10 study flashcards from the user's text.
Output only HTML in this exact shape:
<ol>
  <li><strong>Q:</strong> question text<br><strong>A:</strong> answer text</li>
  ...
</ol>
No markdown, no preamble, no commentary.`,

  actionItems: `You are an assistant who extracts action items from notes.
Output only HTML as a single <ul> where each <li> is one clear, actionable item starting with a verb.
If there are no obvious action items, output exactly: <p>No action items found.</p>
No markdown, no preamble.`,

  explain: `You are a teacher. Explain the user's text clearly for a curious learner. Use simple language and concrete examples where helpful.
Output only HTML using <p>, <ul>, <li>. No markdown, no preamble.`,
};

const ALLOWED_ACTIONS = [...Object.keys(SYSTEM_PROMPTS), "custom"];

function systemPromptFor(action, customPrompt) {
  if (action === "custom") {
    if (!customPrompt || !customPrompt.trim()) return null;
    return `${customPrompt.trim()}\n\nOutput only HTML. No markdown, no preamble.`;
  }
  return SYSTEM_PROMPTS[action] || null;
}

module.exports = { systemPromptFor, ALLOWED_ACTIONS };
