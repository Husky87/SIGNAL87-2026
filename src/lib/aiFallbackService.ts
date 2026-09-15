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
  if (requested === 'gemini-3.6-flash') return 'gemini-3.6-flash';
  if (requested === 'gemini-3.5-flash-lite') return 'gemini-3.5-flash-lite';
  if (requested === 'gemini-2.5-pro') return 'gemini-2.5-pro';
  if (requested === 'gemini-2.5-flash') return 'gemini-2.5-flash';
  if (requested?.startsWith('gemini-')) return requested;
  return process.env.GEMINI_MODEL || 'gemini-3.6-flash';
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
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('OpenAI returned an empty response.');
    return text;
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

  const generationConfig: Record<string, any> = {
    maxOutputTokens: options.maxOutputTokens ?? 1400
  };
  if (options.responseMimeType) generationConfig.responseMimeType = options.responseMimeType;

  const body: Record<string, any> = {
    contents,
    generationConfig
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
      throw new Error(`Gemini API call failed [HTTP ${response.status}, model ${model}]: ${detail}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
    if (!text) throw new Error(`Gemini returned an empty response for ${model}.`);
    return text;
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
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Grok returned an empty response.');
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateWithFallback(options: GenerateWithFallbackOptions): Promise<NormalizedAiResponse> {
  const normalizedMessages = normalizeOpenAiMessages(options);
  const requestedModel = options.model || process.env.AI_MODEL || 'gemini-3.6-flash';
  const isGemini = requestedModel.startsWith('gemini-');
  const isGrok = requestedModel.startsWith('grok-');
  const isOpenAI = requestedModel.startsWith('gpt-');

  const primaryProvider: 'gemini' | 'grok' | 'openai' = isGemini ? 'gemini' : isGrok ? 'grok' : 'openai';
  const primaryModel = primaryProvider === 'gemini'
    ? mapToGeminiModel(requestedModel)
    : primaryProvider === 'grok'
      ? mapToGrokModel(requestedModel)
      : mapToOpenAiModel(requestedModel);

  const attempts: Array<{ provider: 'gemini' | 'grok' | 'openai'; model: string }> = [
    { provider: primaryProvider, model: primaryModel }
  ];

  const addFallback = (provider: 'gemini' | 'grok' | 'openai', model: string) => {
    if (!attempts.some((attempt) => attempt.provider === provider)) attempts.push({ provider, model });
  };

  addFallback('gemini', mapToGeminiModel(options.fallbackModel));
  addFallback('openai', mapToOpenAiModel(options.fallbackModel));
  addFallback('grok', mapToGrokModel(options.fallbackModel));

  let lastError: any = null;
  let firstError: any = null;

  for (let index = 0; index < attempts.length; index++) {
    const attempt = attempts[index];
    const isPrimary = index === 0;
    try {
      let text = '';
      if (attempt.provider === 'gemini') {
        text = await callGemini(normalizedMessages, options, attempt.model);
      } else if (attempt.provider === 'openai') {
        text = await callOpenAI(normalizedMessages, options, attempt.model);
      } else {
        text = await callGrok(normalizedMessages, options, attempt.model);
      }

      return {
        text,
        provider: attempt.provider,
        modelUsed: attempt.model,
        fallbackTriggered: !isPrimary,
        ...(firstError ? { fallbackReason: firstError.message || String(firstError) } : {})
      };
    } catch (err: any) {
      lastError = err;
      if (!firstError) firstError = err;
      console.warn(`[Signal87 AI] ${attempt.provider} (${attempt.model}) failed: ${err?.message || err}`);
    }
  }

  const configuredProviders = [
    process.env.GEMINI_API_KEY && 'Gemini',
    process.env.OPENAI_API_KEY && 'OpenAI',
    process.env.XAI_API_KEY && 'Grok'
  ].filter(Boolean).join(', ');

  const fallbackReason = lastError?.message || firstError?.message || 'All configured AI providers failed.';
  const missingKeys = [
    !process.env.GEMINI_API_KEY && 'GEMINI_API_KEY',
    !process.env.OPENAI_API_KEY && 'OPENAI_API_KEY',
    !process.env.XAI_API_KEY && 'XAI_API_KEY'
  ].filter(Boolean) as string[];

  if (options.responseMimeType === 'application/json') {
    return {
      text: JSON.stringify({
        summary: `Automated analysis did not run. Reason: ${fallbackReason}.`,
        entities: [],
        riskHighlights: [],
        suggestedTags: [],
        analysisSkipped: true,
        analysisSkippedReason: fallbackReason
      }),
      provider: 'none',
      modelUsed: 'analysis-unavailable',
      fallbackTriggered: true,
      fallbackReason
    };
  }

  const diagnosis = missingKeys.length === 3
    ? `No AI provider is configured. Missing: ${missingKeys.join(', ')}.`
    : `AI providers configured: ${configuredProviders || 'none'}. Last error: ${fallbackReason}`;

  return {
    text: `## Analysis unavailable\n\nYour question was **not** answered.\n\n**Why:** ${diagnosis}`,
    provider: 'none',
    modelUsed: 'analysis-unavailable',
    fallbackTriggered: true,
    fallbackReason
  };
}
