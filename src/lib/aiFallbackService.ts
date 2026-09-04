import { GoogleGenAI } from '@google/genai';

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateWithFallbackOptions {
  prompt?: string;
  messages?: OpenAiMessage[];
  systemInstruction?: string;
  model?: string; // Default Gemini model, e.g. 'gemini-3.6-flash'
  fallbackModel?: string; // Default OpenAI model, e.g. 'gpt-4o-mini' or 'gpt-4o'
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: any;
  timeoutMs?: number;
}

export interface NormalizedAiResponse {
  text: string;
  /** 'none' means no model answered — the payload is an explicit failure notice. */
  provider: 'gemini' | 'openai' | 'none';
  modelUsed: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
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

/**
 * Normalizes input options into a standard OpenAI message array:
 * [{ role: "system", content: "..." }, { role: "user", content: "..." }]
 */
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

/**
 * Maps standard OpenAI message structures into Google GenAI SDK contents & systemInstruction
 */
export function mapMessagesToGeminiFormat(messages: OpenAiMessage[]) {
  const systemMsgs = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const systemInstruction = systemMsgs.length > 0 ? systemMsgs.join('\n\n') : undefined;

  const chatMsgs = messages.filter((m) => m.role !== 'system');

  if (chatMsgs.length === 1 && chatMsgs[0].role === 'user') {
    return {
      contents: chatMsgs[0].content,
      systemInstruction
    };
  }

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  return {
    contents,
    systemInstruction
  };
}

/**
 * Multi-provider fallback utility for AI generation.
 * Tries Gemini first and automatically falls back to OpenAI (ChatGPT API)
 * if Gemini hits rate limits (429), errors (500/503), or times out.
 */
export async function generateWithFallback(
  options: GenerateWithFallbackOptions
): Promise<NormalizedAiResponse> {
  const geminiModel = options.model || 'gemini-3.6-flash';
  const openaiModel = options.fallbackModel || 'gpt-4o-mini';
  const temperature = options.temperature ?? 0.2;
  const timeoutMs = options.timeoutMs ?? 25000;

  const normalizedMessages = normalizeOpenAiMessages(options);

  // Helper function to call Gemini API
  const callGemini = async (modelToUse: string): Promise<string> => {
    const ai = getGeminiClient();
    const { contents, systemInstruction } = mapMessagesToGeminiFormat(normalizedMessages);

    const geminiPromise = ai.models.generateContent({
      model: modelToUse,
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction,
        temperature: temperature,
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

  // 1. Primary Attempt with requested Gemini model
  let primaryError: any = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      const responseText = await callGemini(geminiModel);
      if (responseText) {
        return {
          text: responseText,
          provider: 'gemini',
          modelUsed: geminiModel,
          fallbackTriggered: false
        };
      }
    } catch (err: any) {
      primaryError = err;
      const errorMsg = err?.message || String(err);
      const statusCode = err?.status || err?.response?.status;
      console.warn(
        `Gemini primary model (${geminiModel}) failed [Status: ${statusCode || 'N/A'}]: ${errorMsg}. Retrying with secondary Gemini model...`
      );
    }

    // 2. Retry with secondary Gemini model (gemini-3.5-flash-lite) if 503/429/error
    const secondaryModel = geminiModel === 'gemini-3.5-flash-lite' ? 'gemini-3.6-flash' : 'gemini-3.5-flash-lite';
    try {
      // Small 600ms backoff
      await new Promise((r) => setTimeout(r, 600));
      const responseText = await callGemini(secondaryModel);
      if (responseText) {
        return {
          text: responseText,
          provider: 'gemini',
          modelUsed: secondaryModel,
          fallbackTriggered: true,
          fallbackReason: `Primary model ${geminiModel} failed (${primaryError?.message || '503/Rate limit'}). Recovered using ${secondaryModel}.`
        };
      }
    } catch (secErr: any) {
      console.warn(`Gemini secondary model (${secondaryModel}) also failed. Checking OpenAI fallback...`);
    }
  }

  // 3. Fallback Call to OpenAI Chat Completions API if available
  const initialReason = primaryError?.message || 'GEMINI_API_KEY missing or service unavailable';
  if (process.env.OPENAI_API_KEY) {
    try {
      return await executeOpenAIFallback(normalizedMessages, options, openaiModel, initialReason);
    } catch (openAiErr: any) {
      console.error('OpenAI fallback also encountered an error:', openAiErr?.message || openAiErr);
    }
  }

  // 4. Nothing answered. Return an explicit failure rather than a plausible-looking
  //    payload — this is a legal research tool, so a fabricated answer is worse
  //    than no answer.
  console.error('No AI provider answered. Returning an explicit analysis-unavailable payload.');

  if (options.responseMimeType === 'application/json') {
    // Reports that nothing ran, and returns nothing. This previously claimed
    // "Analysis completed... parsed and verified" and invented two entities with
    // 95%/90% relevance plus a risk highlight — all of which were written into
    // the document record on upload, indistinguishable from real extraction.
    return {
      text: JSON.stringify({
        summary: `Automated analysis did not run for this document. Reason: ${initialReason}. No summary, entities, or risks have been extracted.`,
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

  // Report the actual cause. This used to assert "HTTP 503 / high demand spikes"
  // and advise retrying shortly no matter what went wrong — so a missing or
  // rejected API key, an exhausted quota, or an unknown model name all presented
  // as transient congestion, sending the user off to wait for nothing.
  const missingKeys = [
    !process.env.GEMINI_API_KEY && 'GEMINI_API_KEY',
    !process.env.OPENAI_API_KEY && 'OPENAI_API_KEY'
  ].filter(Boolean);

  const diagnosis = missingKeys.length
    ? `No AI provider is configured on the server. Missing environment ${
        missingKeys.length > 1 ? 'variables' : 'variable'
      }: ${missingKeys.join(' and ')}.`
    : `Every configured AI provider rejected the request. Last error: ${initialReason}`;

  const guidance = missingKeys.length
    ? 'Set the missing key in the deployment environment and redeploy — retrying will not help until then.'
    : 'If this persists, check the provider status and the account quota for the configured key.';

  return {
    text: `## Analysis unavailable\n\nYour question was **not** answered — no AI model produced a response, and nothing below has been analysed.\n\n**Why:** ${diagnosis}\n\n**What to do:** ${guidance}\n\n> Your documents are untouched and still indexed in your workspace.`,
    provider: 'none',
    modelUsed: 'analysis-unavailable',
    fallbackTriggered: true,
    fallbackReason: initialReason
  };
}

async function executeOpenAIFallback(
  normalizedMessages: OpenAiMessage[],
  options: GenerateWithFallbackOptions,
  openaiModel: string,
  reason: string
): Promise<NormalizedAiResponse> {
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!openAiKey) {
    console.error('OPENAI_API_KEY environment variable is not set. Cannot perform fallback to OpenAI.');
    throw new Error(`Gemini failed (${reason}) and OPENAI_API_KEY is missing for fallback.`);
  }

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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
    let errText;
    try {
      errText = await response.text();
    } catch (e) {
      errText = 'Could not read error text';
    }
    console.error(`OpenAI Fallback failed with status ${response.status}: ${errText}`);
    console.error(`Payload: ${JSON.stringify(bodyPayload)}`);
    throw new Error(`OpenAI API fallback call failed [HTTP ${response.status}]: ${errText}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';

  return {
    text: responseText,
    provider: 'openai',
    modelUsed: openaiModel,
    fallbackTriggered: true,
    fallbackReason: reason
  };
}
