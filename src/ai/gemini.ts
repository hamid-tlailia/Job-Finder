import * as z from 'zod/v4';

/**
 * Gemini text models that are live as of October 2026 (ai.google.dev/gemini-api/docs/deprecations).
 * Already shut down and deliberately absent: gemini-2.0-flash(-lite), gemini-3-pro-preview,
 * gemini-3.1-flash-lite-preview and the dated 2.5 previews. 2.5 models are limited to earlier users.
 */
export const GEMINI_MODELS = [
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon', note: 'best' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: 'balanced' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', note: 'balanced' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', note: 'cheapest' },
] as const;

/** Tried in order when the chosen model has been retired, so the app keeps working after a shutdown. */
const SUCCESSORS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-4-argon'];
const SWITCH_KEY = 'jf-gemini-switch';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const isGemini = (model: string) => model.startsWith('gemini-');

class GeminiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function switched(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SWITCH_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function remember(from: string, to: string): void {
  try {
    localStorage.setItem(SWITCH_KEY, JSON.stringify({ ...switched(), [from]: to }));
  } catch {
    /* storage unavailable: the lookup simply repeats next time */
  }
}

async function call(key: string, model: string, body: unknown): Promise<string> {
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  if (!res.ok) throw new GeminiError(res.status, data.error?.message ?? `Gemini HTTP ${res.status}`);
  if (data.promptFeedback?.blockReason) throw new GeminiError(400, `Gemini blocked the request (${data.promptFeedback.blockReason}).`);
  const c = data.candidates?.[0];
  if (c?.finishReason === 'MAX_TOKENS') throw new GeminiError(200, 'The response was cut off; try again.');
  const text = (c?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
  if (!text) throw new GeminiError(200, `Gemini returned no answer (${c?.finishReason ?? 'empty'}).`);
  return text;
}

/** A retired or unknown model id answers 404 (or 400 "not found / not supported"). */
const retired = (e: unknown) => e instanceof GeminiError && (e.status === 404 || (e.status === 400 && /not (found|supported)|deprecated|shut ?down/i.test(e.message)));

/** Structured JSON from Gemini, validated with the same zod schema the Claude path uses. */
export async function geminiStructured<T extends z.ZodType>(key: string, model: string, schema: T, system: string, prompt: string, maxTokens: number): Promise<z.infer<T>> {
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  const base = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  const withSchema = { ...base, generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json', responseJsonSchema: jsonSchema } };
  // Fallback if a model rejects the JSON Schema: same request with the schema spelled out in the prompt.
  const inPrompt = {
    systemInstruction: base.systemInstruction,
    contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nAnswer with JSON only, matching this JSON Schema:\n${JSON.stringify(jsonSchema)}` }] }],
    generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
  };

  const chain = [switched()[model] ?? model, ...SUCCESSORS].filter((m, i, a) => a.indexOf(m) === i);
  let lastError: unknown;
  for (const m of chain) {
    try {
      let text: string;
      try {
        text = await call(key, m, withSchema);
      } catch (e) {
        if (e instanceof GeminiError && e.status === 400 && !retired(e)) text = await call(key, m, inPrompt);
        else throw e;
      }
      if (m !== model) remember(model, m);
      const parsed = schema.safeParse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
      if (!parsed.success) throw new Error('Could not read the model response.');
      return parsed.data;
    } catch (e) {
      lastError = e;
      if (!retired(e)) throw e;
    }
  }
  throw lastError;
}

/** Checks the key and returns the Gemini text models this key can use right now. */
export async function geminiAvailable(key: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string }; models?: { name: string; supportedGenerationMethods?: string[] }[] };
  if (!res.ok) throw new Error(data.error?.message ?? `Gemini HTTP ${res.status}`);
  return (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
}
