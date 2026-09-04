import { GoogleGenAI } from '@google/genai';

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
}

export interface NormalizedAiResponse {
  text: string;
  provider: 'gemini' | 'openai' | 'none';
  modelUsed: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
}

const DEPRECATED_MODEL_MAP: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-3.6-flash',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.6-flash'
};

function resolveGeminiModel(requestedModel: string | undefined, defaultModel: string): string {
  const model = requestedModel || defaultModel;
  const remapped = DEPRECATED_MODEL_MAP[model];
  if (remapped) {
    console.warn(`Requested deprecated model "${model}" — remapping to "${remapped}".`);
    return remapped;
  }
  return model;
}

/** UI still sends gemini-* IDs. Map them onto OpenAI now that OpenAI is primary. */
function mapToOpenAiModel(requested?: string, fallback?: string): string {
  if (requested === 'gpt-4o' || requested === 'gemini-2.5-pro') return 'gpt-4o';
  if (requested === 'gpt-4o-mini' || requested === 'gemini-3.5-flash-lite') return 'gpt-4o-mini';
  if (requested?.startsWith('gpt-')) return requested;
  return fallback || 'gpt-4o';
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || 'DUMMY_KEY',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
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
  if (options.systemInstruction) {
    msgs.push({ role: 'system', content: options.systemInstruction });
  }
  if (options.prompt) {
    msgs.push({ role: 'user', content: options.prompt });
  }
  return msgs;
}

export function mapMessagesToGeminiFormat(messages: OpenAiMessage[]) {
  const systemMsgs = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const systemInstruction = systemMsgs.length > 0 ? systemMsgs.join('\n\n') : undefined;
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  if (chatMsgs.length === 1 && chatMsgs[0].role === 'user') {
    return { contents: chatMsgs[0].content, systemInstruction };
  }

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  return { contents, systemInstruction };
}

async function callOpenAI(
  normalizedMessages: OpenAiMessage[],
  options: GenerateWithFallbackOptions,
  openaiModel: string
): Promise<string> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) throw new Error('OPENAI_API_KEY is missing.');

  const bodyPayload: Record<string, any> = {
    model: openaiModel,
    messages: normalizedMessages.map((m) => ({ ...m })),
    temperature: options.temperature ?? 0.2
  };

  if (options.responseMimeType === 'application/json') {
    bodyPayload.response_format = { type: 'json_object' };
    const lastMsg = bodyPayload.messages[bodyPayload.messages.length - 1];
    if (lastMsg) {
      lastMsg.content = `${lastMsg.content}\n\nPlease output the response as a valid JSON object.`;
    }
  }

  const timeoutMs = options.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errText = 'Could not read error text';
    try {
      errText = await response.text();
    } catch {}
    throw new Error(`OpenAI API call failed [HTTP ${response.status}]: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function generateWithFallback(
  options: GenerateWithFallbackOptions
): Promise<NormalizedAiResponse> {
  const geminiModel = resolveGeminiModel(options.model, 'gemini-3.6-flash');
  const openaiModel = mapToOpenAiModel(options.model, options.fallbackModel);
  const temperature = options.temperature ?? 0.2;
  const timeoutMs = options.timeoutMs ?? 25000;
  const normalizedMessages = normalizeOpenAiMessages(options);

  const callGemini = async (modelToUse: string): Promise<string> => {
    const ai = getGeminiClient();
    const { contents, systemInstruction } = mapMessagesToGeminiFormat(normalizedMessages);
    const geminiPromise = ai.models.generateContent({
      model: modelToUse,
      contents: contents as any,
      config: {
        systemInstruction,
        temperature,
        ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
        ...(options.responseSchema ? { responseSchema: options.responseSchema } : {})
      }
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Gemini API request (${modelToUse}) timed out`)), timeoutMs);
    });
    const response = await Promise.race([geminiPromise, timeoutPromise]);
    return response.text || '';
  };

  let primaryError: any = null;

  if (process.env.OPENAI_API_KEY) {
    try {
      const responseText = await callOpenAI(normalizedMessages, options, openaiModel);
      if (responseText) {
        return {
          text: responseText,
          provider: 'openai',
          modelUsed: openaiModel,
          fallbackTriggered: false
        };
      }
    } catch (err: any) {
      primaryError = err;
      console.warn(`OpenAI primary (${openaiModel}) failed: ${err?.message || err}. Falling back to Gemini...`);
    }
  }

  const initialReason = primaryError?.message || 'OPENAI_API_KEY missing or service unavailable';

  if (process.env.GEMINI_API_KEY) {
    try {
      const responseText = await callGemini(geminiModel);
      if (responseText) {
        return {
          text: responseText,
          provider: 'gemini',
          modelUsed: geminiModel,
          fallbackTriggered: true,
          fallbackReason: initialReason
        };
      }
    } catch (err: any) {
      console.warn(`Gemini fallback (${geminiModel}) failed: ${err?.message || err}`);
    }

    const secondaryModel =
      geminiModel === 'gemini-3.5-flash-lite' ? 'gemini-3.6-flash' : 'gemini-3.5-flash-lite';
    try {
      await new Promise((r) => setTimeout(r, 600));
      const responseText = await callGemini(secondaryModel);
      if (responseText) {
        return {
          text: responseText,
          provider: 'gemini',
          modelUsed: secondaryModel,
          fallbackTriggered: true,
          fallbackReason: `OpenAI failed (${initialReason}); Gemini ${geminiModel} also failed. Recovered using ${secondaryModel}.`
        };
      }
    } catch {
      console.warn(`Gemini secondary (${secondaryModel}) also failed.`);
    }
  }

  const missingKeys = [
    !process.env.OPENAI_API_KEY && 'OPENAI_API_KEY',
    !process.env.GEMINI_API_KEY && 'GEMINI_API_KEY'
  ].filter(Boolean);

  if (options.responseMimeType === 'application/json') {
    return {
      text: JSON.stringify({
        summary: `Automated analysis did not run. Reason: ${initialReason}.`,
        entities: [],
        riskHighlights: [],
        suggestedTags: [],
        analysisSkipped: true,
        analysisSkippedReason: initialReason
      }),
      provider: 'none',
      modelUsed: 'analysis-unavailable',
      fallbackTriggered: true,
      fallbackReason: initialReason
    };
  }

  const diagnosis = missingKeys.length
    ? `No AI provider is configured. Missing: ${missingKeys.join(' and ')}.`
    : `Every configured AI provider rejected the request. Last error: ${initialReason}`;

  return {
    text: `## Analysis unavailable\n\nYour question was **not** answered.\n\n**Why:** ${diagnosis}`,
    provider: 'none',
    modelUsed: 'analysis-unavailable',
    fallbackTriggered: true,
    fallbackReason: initialReason
  };
}