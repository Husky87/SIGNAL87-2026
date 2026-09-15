export interface OpenAiMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface GenerateWithFallbackOptions { prompt?: string; messages?: OpenAiMessage[]; systemInstruction?: string; model?: string; fallbackModel?: string; temperature?: number; responseMimeType?: string; responseSchema?: any; timeoutMs?: number; maxOutputTokens?: number; }
export interface NormalizedAiResponse { text: string; provider: 'openai' | 'gemini' | 'none'; modelUsed: string; fallbackTriggered: boolean; fallbackReason?: string; }

function mapToOpenAiModel(requested?: string) { return requested?.startsWith('gpt-') ? requested : process.env.OPENAI_MODEL || 'gpt-4o'; }
function mapToGeminiModel(requested?: string) { return requested?.startsWith('gemini-') ? requested : process.env.GEMINI_MODEL || 'gemini-3.6-flash'; }
export function normalizeOpenAiMessages(options: GenerateWithFallbackOptions): OpenAiMessage[] {
  if (options.messages?.length) { const msgs = [...options.messages]; if (options.systemInstruction && !msgs.some(m => m.role === 'system')) msgs.unshift({ role: 'system', content: options.systemInstruction }); return msgs; }
  return [...(options.systemInstruction ? [{ role: 'system' as const, content: options.systemInstruction }] : []), ...(options.prompt ? [{ role: 'user' as const, content: options.prompt }] : [])];
}
function toGeminiContents(messages: OpenAiMessage[]) { return messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })); }
async function callOpenAI(messages: OpenAiMessage[], options: GenerateWithFallbackOptions, model: string) {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('OPENAI_API_KEY is missing.');
  const body: any = { model, messages, temperature: options.temperature ?? 0.2, max_tokens: options.maxOutputTokens ?? 1400 };
  if (options.responseMimeType === 'application/json') { body.response_format = { type: 'json_object' }; const last = body.messages[body.messages.length - 1]; if (last) last.content += '\n\nReturn only a valid JSON object.'; }
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);
  try { const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: controller.signal }); if (!r.ok) throw new Error(`OpenAI API call failed [HTTP ${r.status}]: ${await r.text().catch(() => '')}`); const d = await r.json(); return d.choices?.[0]?.message?.content || ''; } finally { clearTimeout(timeout); }
}
async function callGemini(messages: OpenAiMessage[], options: GenerateWithFallbackOptions, model: string) {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error('GEMINI_API_KEY is missing.');
  const systemInstruction = options.systemInstruction || messages.find(m => m.role === 'system')?.content; const contents = toGeminiContents(messages); if (!contents.length) throw new Error('No user content available for Gemini.');
  const body: any = { contents, generationConfig: { temperature: options.temperature ?? 0.2, maxOutputTokens: options.maxOutputTokens ?? 1400, ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}) } }; if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);
  try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }); if (!r.ok) throw new Error(`Gemini API call failed [HTTP ${r.status}]: ${await r.text().catch(() => '')}`); const d = await r.json(); return d.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''; } finally { clearTimeout(timeout); }
}
export async function generateWithFallback(options: GenerateWithFallbackOptions): Promise<NormalizedAiResponse> {
  const messages = normalizeOpenAiMessages(options); const openaiModel = mapToOpenAiModel(options.model); const geminiModel = mapToGeminiModel(options.fallbackModel); let primaryError: any = null;
  if (process.env.OPENAI_API_KEY) { try { const text = await callOpenAI(messages, options, openaiModel); if (text) return { text, provider: 'openai', modelUsed: openaiModel, fallbackTriggered: false }; primaryError = new Error('OpenAI returned an empty response.'); } catch (e: any) { primaryError = e; } } else primaryError = new Error('OPENAI_API_KEY is missing.');
  let geminiError: any = primaryError;
  if (process.env.GEMINI_API_KEY) { try { const text = await callGemini(messages, options, geminiModel); if (text) return { text, provider: 'gemini', modelUsed: geminiModel, fallbackTriggered: true, fallbackReason: primaryError?.message || 'OpenAI service unavailable' }; geminiError = new Error('Gemini returned an empty response.'); } catch (e: any) { geminiError = e; } } else geminiError = new Error('GEMINI_API_KEY is missing.');
  const fallbackReason = `${primaryError?.message || 'OpenAI service unavailable'}; Gemini: ${geminiError?.message || 'unavailable'}`;
  if (options.responseMimeType === 'application/json') return { text: JSON.stringify({ summary: `Automated analysis did not run. Reason: ${fallbackReason}.`, entities: [], riskHighlights: [], suggestedTags: [], analysisSkipped: true, analysisSkippedReason: fallbackReason }), provider: 'none', modelUsed: 'analysis-unavailable', fallbackTriggered: true, fallbackReason };
  return { text: `## Analysis unavailable\n\nYour question was **not** answered.\n\n**Why:** The configured AI providers could not answer the request. OpenAI/Gemini chain: ${fallbackReason}`, provider: 'none', modelUsed: 'analysis-unavailable', fallbackTriggered: true, fallbackReason };
}
