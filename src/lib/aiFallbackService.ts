export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateWithFallbackOptions {
  prompt?: string;
  messages?: OpenAiMessage[];
  systemInstruction?: string;
  model?: string;
  fallbackModel?: string;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: any;
  timeoutMs?: number;
  maxOutputTokens?: number;
}

export interface NormalizedAiResponse {
  text: string;
  provider: 'openai' | 'gemini' | 'grok' | 'none';
  modelUsed: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
}

function mapToOpenAiModel(requested?: string): string {
  if (requested?.startsWith('gpt-')) return requested;
  return process.env.OPENAI_MODEL || 'gpt-4o';
}

function mapToGeminiModel(requested?: string): string {
  if (requested?.startsWith('gemini-')) return requested;
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

function mapToGrokModel(requested?: string): string {
  if (requested?.startsWith('grok-')) return requested;
  return process.env.GROK_MODEL || 'grok-4.6';
}

export function normalizeOpenAiMessages(options: GenerateWithFallbackOptions): OpenAiMessage[] {
  if (options.messages && options.messages.length > 0) {
    const msgs = [...options.messages];
    if (options.systemInstruction && !msgs.some((m) => m.role === 'system')) {
      msgs.unshift({ role: 'system', content: options.systemInstruction });
    }
    return msgs;
  }

  const msgs: OpenAiMessage[] = [];
  if (options.systemInstruction) msgs.push({ role: 'system', content: options.systemInstruction });
  if (options.prompt) msgs.push({ role: 'user', content: options.prompt });
  return msgs;
}

function toGeminiContents(messages: OpenAiMessage[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));
}

async function callOpenAI(
  normalizedMessages: OpenAiMessage[],
  options: GenerateWithFallbackOptions,
  model: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');

  const bodyPayload: Record<string, any> = {
    model,
    messages: normalizedMessages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxOutputTokens ?? 1400
  };

  if (options.responseMimeType === 'application/json') {
    bodyPayload.response_format = { type: 'json_object' };
    const lastMsg = bodyPayload.messages[bodyPayload.messages.length - 1];
    if (lastMsg) lastMsg.content = `${lastMsg.content}\n\nReturn only a valid JSON object.`;
  }

  const timeoutMs = options.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenAI API call failed [HTTP ${response.status}]: ${detail}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini(
  normalizedMessages: OpenAiMessage[],
  options: GenerateWithFallbackOptions,
  model: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');

  const systemInstruction = options.systemInstruction || normalizedMessages.find((m) => m.role === 'system')?.content;
  const contents = toGeminiContents(normalizedMessages);
  if (contents.length === 0) throw new Error('No user content available for Gemini.');

  const body: Record<string, any> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 1400,
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
    }
  };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  const timeoutMs = options.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Gemini API call failed [HTTP ${response.status}]: ${detail}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGrok(
  normalizedMessages: OpenAiMessage[],
  options: GenerateWithFallbackOptions,
  model: string
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY is missing.');

  const messages = [...normalizedMessages];
  if (options.responseMimeType === 'application/json') {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) lastMsg.content = `${lastMsg.content}\n\nReturn only a valid JSON object.`;
  }

  const timeoutMs = options.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxOutputTokens ?? 1400,
        stream: false
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Grok API call failed [HTTP ${response.status}]: ${detail}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateWithFallback(options: GenerateWithFallbackOptions): Promise<NormalizedAiResponse> {
  const normalizedMessages = normalizeOpenAiMessages(options);
  const openaiModel = mapToOpenAiModel(options.model);
  const geminiModel = mapToGeminiModel(options.fallbackModel);
  const grokModel = mapToGrokModel(options.fallbackModel);
  let primaryError: any = null;

  // Routing contract: OpenAI first, Gemini second, Grok third.
  if (process.env.OPENAI_API_KEY) {
    try {
      const responseText = await callOpenAI(normalizedMessages, options, openaiModel);
      if (responseText) return { text: responseText, provider: 'openai', modelUsed: openaiModel, fallbackTriggered: false };
      primaryError = new Error('OpenAI returned an empty response.');
    } catch (err: any) {
      primaryError = err;
      console.warn(`OpenAI primary (${openaiModel}) failed. Falling back to Gemini: ${err?.message || err}`);
    }
  } else {
    primaryError = new Error('OPENAI_API_KEY is missing.');
  }

  let geminiError = primaryError;
  if (process.env.GEMINI_API_KEY) {
    try {
      const responseText = await callGemini(normalizedMessages, options, geminiModel);
      if (responseText) {
        return { text: responseText, provider: 'gemini', modelUsed: geminiModel, fallbackTriggered: true, fallbackReason: primaryError?.message || 'OpenAI service unavailable' };
      }
      geminiError = new Error('Gemini returned an empty response.');
    } catch (err: any) {
      geminiError = err;
      console.warn(`Gemini fallback (${geminiModel}) failed. Falling back to Grok: ${err?.message || err}`);
    }
  } else {
    geminiError = new Error('GEMINI_API_KEY is missing.');
  }

  const fallbackReason = `${primaryError?.message || 'OpenAI service unavailable'}; Gemini: ${geminiError?.message || 'unavailable'}`;
  if (process.env.XAI_API_KEY) {
    try {
      const responseText = await callGrok(normalizedMessages, options, grokModel);
      if (responseText) return { text: responseText, provider: 'grok', modelUsed: grokModel, fallbackTriggered: true, fallbackReason };
    } catch (err: any) {
      console.warn(`Grok fallback (${grokModel}) failed: ${err?.message || err}`);
    }
  }

  const missingKeys = [!process.env.OPENAI_API_KEY && 'OPENAI_API_KEY', !process.env.GEMINI_API_KEY && 'GEMINI_API_KEY', !process.env.XAI_API_KEY && 'XAI_API_KEY'].filter(Boolean) as string[];
  if (options.responseMimeType === 'application/json') {
    return {
      text: JSON.stringify({ summary: `Automated analysis did not run. Reason: ${fallbackReason}.`, entities: [], riskHighlights: [], suggestedTags: [], analysisSkipped: true, analysisSkippedReason: fallbackReason }),
      provider: 'none', modelUsed: 'analysis-unavailable', fallbackTriggered: true, fallbackReason
    };
  }

  const diagnosis = missingKeys.length
    ? `No AI provider is configured. Missing: ${missingKeys.join(' and ')}.`
    : `The configured AI providers rejected the request. OpenAI/Gemini chain: ${fallbackReason}`;
  return {
    text: `## Analysis unavailable\n\nYour question was **not** answered.\n\n**Why:** ${diagnosis}`,
    provider: 'none', modelUsed: 'analysis-unavailable', fallbackTriggered: true, fallbackReason
  };
}
