import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';
import { hasUsableText } from '../src/lib/extractedText.js';
import { buildChatMessages } from '../src/lib/chatPayload.js';
import { requireFirebaseUser } from '../src/lib/firebaseAuth.js';

const MAX_DOC_CHARS = 28000;
const MAX_TOTAL_CONTEXT_CHARS = 90000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 12000;
const DEFAULT_CHAT_MODEL = 'gpt-4o';

function extractCitationManifest(text: string): { cleanedText: string; entries: Array<{ source?: string }> } {
  const match = text.match(/```citation_manifest\s*([\s\S]*?)```/i);
  if (!match || match.index === undefined) return { cleanedText: text, entries: [] };
  const cleanedText = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim();
  try { const parsed = JSON.parse(match[1].trim()); return { cleanedText, entries: Array.isArray(parsed) ? parsed : [] }; } catch { return { cleanedText, entries: [] }; }
}
function resolveCitations(entries: Array<{ source?: string }>, readableDocs: any[], readableAttached: any[]) {
  const seen = new Set<string>(); const citations: Array<{ docId: string; docTitle: string; snippet?: string }> = [];
  for (const entry of entries) {
    const source = String(entry?.source || '').trim(); const docMatch = source.match(/^DOCUMENT\s+(\d+)$/i); const attachedMatch = source.match(/^INGESTED ACTIVE FILE\s+(\d+)$/i); let doc: any = null;
    if (docMatch) doc = readableDocs[parseInt(docMatch[1], 10) - 1] || null;
    if (attachedMatch) { const file = readableAttached[parseInt(attachedMatch[1], 10) - 1]; if (file) doc = { id: file.fileName, title: file.fileName, summary: file.summaryInfo }; }
    if (!doc) continue; const key = String(doc.id || doc.title); if (seen.has(key)) continue; seen.add(key);
    citations.push({ docId: key, docTitle: String(doc.title || key), ...(doc.summary ? { snippet: String(doc.summary).slice(0, 120) + '...' } : {}) }); if (citations.length >= 10) break;
  }
  return citations;
}
function compactText(value: unknown, maxChars: number): string { const text = String(value || '').trim(); return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[Context truncated for latency. Use only the supplied portion.]`; }
function buildBoundedContext(readableDocs: any[], readableAttached: any[], unreadableDocs: any[], unreadableAttached: any[]) {
  let usedChars = 0; const sections: string[] = [];
  if (readableDocs.length) { const docs = readableDocs.map((doc: any, i: number) => { if (usedChars >= MAX_TOTAL_CONTEXT_CHARS) return ''; const remaining = Math.min(MAX_DOC_CHARS, MAX_TOTAL_CONTEXT_CHARS - usedChars); const body = compactText(doc.fullText || doc.contentPreview || doc.summary, remaining); usedChars += body.length; return `--- DOCUMENT ${i + 1}: ${doc.title} ---\n${body}\n--- END DOCUMENT ${i + 1} ---`; }).filter(Boolean); if (docs.length) sections.push(`REPOSITORY DOCUMENTS:\n${docs.join('\n\n')}`); }
  if (readableAttached.length && usedChars < MAX_TOTAL_CONTEXT_CHARS) { const files = readableAttached.map((file: any, i: number) => { if (usedChars >= MAX_TOTAL_CONTEXT_CHARS) return ''; const remaining = Math.min(MAX_DOC_CHARS, MAX_TOTAL_CONTEXT_CHARS - usedChars); const body = compactText(file.extractedText, remaining); usedChars += body.length; return `=== INGESTED ACTIVE FILE ${i + 1}: ${file.fileName} ===\n${body}\n=== END FILE ===`; }).filter(Boolean); if (files.length) sections.push(`ACTIVE ATTACHED FILES:\n${files.join('\n\n')}`); }
  if (unreadableDocs.length || unreadableAttached.length) { const names = [...unreadableDocs.map((d: any) => d.title), ...unreadableAttached.map((f: any) => f.fileName)]; sections.push(`UNREADABLE FILES — these files COULD NOT BE READ (parsing failed or no extractable text was found) and their contents are unavailable. Tell the user each file listed below could not be read; do not answer questions about them:\n${names.map((n) => `- ${n}`).join('\n')}`); }
  return sections.join('\n\n');
}
const SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION = `You are the official Signal87 AI Platform Assistant: precise, direct, evidence-grounded, and useful.\n\nDOCUMENT GROUNDING IS MANDATORY.\n- Every factual claim about supplied documents must come only from the supplied extracted text.\n- If the supplied documents do not establish an answer, say so and never fall back on prior knowledge to fill the gap. Never invent dates, amounts, parties, clauses, page numbers, confidence scores, or citations.\n- Distinguish document facts from reasonable inferences.\n- For quantitative questions, show the figures and calculations used.\n- For comparisons, identify contradictions instead of silently resolving them.\n- Match answer length to the question. A simple lookup should be concise.\n- You may answer general platform questions without document evidence.\n\nCITATIONS.\n- When using document evidence, place [1], [2], etc. directly after the relevant claim.\n- At the very end, output a fenced block labeled citation_manifest containing a JSON array mapping each marker to the literal context label used for its source, such as DOCUMENT 2 or INGESTED ACTIVE FILE 1.\n- If no document evidence was used, output an empty citation_manifest array.\n- Never cite a document that was not actually used.\n\nNever output internal IDs, database keys, or system metadata.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestStartedAt = Date.now(); const mark = (name: string) => { const value = Date.now() - requestStartedAt; console.info(`[Signal87 chat] ${name}: ${value}ms`); return value; };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  try { await requireFirebaseUser(req.headers.authorization); } catch (error: any) { return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'Valid Firebase ID token required' }); }
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY);
  if (!process.env.OPENAI_API_KEY && !hasGeminiKey) return res.status(503).json({ error: 'AI service is not configured', details: 'OPENAI_API_KEY or GEMINI_API_KEY is required' });
  try {
    const { prompt, messages, documents, ingestedFilesData, attachedFiles, model = DEFAULT_CHAT_MODEL } = req.body || {};
    if (!prompt && (!Array.isArray(messages) || messages.length === 0)) return res.status(400).json({ error: 'Prompt or messages array is required' });
    mark(`request received; model=${model}`);
    const allDocs: any[] = Array.isArray(documents) ? documents : []; const readableDocs = allDocs.filter((doc: any) => hasUsableText(doc.fullText || doc.contentPreview || doc.summary)); const unreadableDocs = allDocs.filter((doc: any) => !readableDocs.includes(doc));
    const allAttached: any[] = Array.isArray(ingestedFilesData) ? ingestedFilesData : []; const readableAttached = allAttached.filter((file: any) => hasUsableText(file.extractedText)); const unreadableAttached = allAttached.filter((file: any) => !readableAttached.includes(file));
    const context = buildBoundedContext(readableDocs, readableAttached, unreadableDocs, unreadableAttached) || 'NO DOCUMENTS ARE AVAILABLE. If the question asks about document contents, say that no document is attached and ask the user to attach it. Do not answer from prior knowledge.';
    const userPrompt = String(prompt || messages[messages.length - 1]?.content || '');
    const boundedHistory = Array.isArray(messages) ? messages.slice(-MAX_HISTORY_MESSAGES).map((message: any) => ({ role: message.role, content: compactText(message.content, Math.floor(MAX_HISTORY_CHARS / MAX_HISTORY_MESSAGES)) })) : [];
    const groundedPrompt = `${context}\n\nUSER QUESTION:\n${userPrompt}`; const modelMessages = buildChatMessages({ systemInstruction: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION, messages: boundedHistory, groundedPrompt }); mark('context prepared');
    const imageData = (Array.isArray(attachedFiles) ? attachedFiles : []).filter((file: any) => typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:image/')).slice(0, 5);
    let aiResult: any;
    if (imageData.length === 0) {
      aiResult = await generateWithFallback({ model, fallbackModel: 'gemini-3.6-flash', messages: modelMessages, temperature: 0.2, timeoutMs: 30000, maxOutputTokens: 1400 });
    } else {
      const multimodalMessages: any[] = modelMessages.map((message) => ({ ...message })); const last = multimodalMessages[multimodalMessages.length - 1];
      last.content = [{ type: 'text', text: String(last.content || '') }, ...imageData.map((file: any) => ({ type: 'image_url', image_url: { url: file.dataUrl } }))];
      let text = ''; let provider: 'openai' | 'gemini' = 'openai'; let modelUsed = 'gpt-4o'; let fallbackTriggered = false; let fallbackReason: string | undefined;
      try {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
        const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-4o', messages: multimodalMessages, temperature: 0.2, max_tokens: 1400, stream: false }) });
        if (!response.ok) throw new Error(`OpenAI vision call failed [HTTP ${response.status}]: ${await response.text().catch(() => '')}`); const data = await response.json(); text = data.choices?.[0]?.message?.content || ''; if (!text) throw new Error('OpenAI vision provider returned an empty response.');
      } catch (primaryError: any) {
        fallbackTriggered = true; fallbackReason = primaryError?.message || 'OpenAI vision unavailable'; const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY; if (!geminiKey) throw primaryError;
        const parts: any[] = [{ text: String(last.content?.[0]?.text || '') }, ...imageData.map((file: any) => { const match = String(file.dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/); return match ? { inlineData: { mimeType: match[1], data: match[2] } } : null; }).filter(Boolean)];
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 1400 } }) });
        if (!geminiResponse.ok) throw new Error(`${fallbackReason}; Gemini vision call failed [HTTP ${geminiResponse.status}]: ${await geminiResponse.text().catch(() => '')}`); const geminiData = await geminiResponse.json(); text = geminiData.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''; if (!text) throw new Error(`${fallbackReason}; Gemini vision returned an empty response.`); provider = 'gemini'; modelUsed = 'gemini-3.6-flash';
      }
      aiResult = { text, provider, modelUsed, fallbackTriggered, fallbackReason };
    }
    const providerMs = mark('provider response complete'); const citationResult = extractCitationManifest(aiResult.text || '');
    let citations = resolveCitations(citationResult.entries, readableDocs, readableAttached);
    // Some providers emit the requested [1] marker but omit the manifest. A
    // single readable source is unambiguous; recover its real identity so the
    // UI does not silently remove a valid citation. Never guess among sources.
    if (citations.length === 0 && /\[1\]/.test(citationResult.cleanedText) && readableDocs.length + readableAttached.length === 1) {
      citations = resolveCitations([{ source: readableDocs.length ? 'DOCUMENT 1' : 'INGESTED ACTIVE FILE 1' }], readableDocs, readableAttached);
    }
    const totalMs = mark('response complete');
    res.setHeader('X-Signal87-Total-Ms', String(totalMs)); res.setHeader('X-Signal87-Provider-Ms', String(providerMs));
    return res.json({ text: citationResult.cleanedText || aiResult.text, citations, provider: aiResult.provider, modelUsed: aiResult.modelUsed, fallbackTriggered: aiResult.fallbackTriggered, fallbackReason: aiResult.fallbackReason, latencyMs: totalMs, verificationTrace: { provider: aiResult.provider, model: aiResult.modelUsed, groundedDocuments: readableDocs.length, groundedAttachments: readableAttached.length, unreadableDocuments: unreadableDocs.length + unreadableAttached.length, latencyMs: totalMs } });
  } catch (error: any) { console.error('Error in /api/chat:', error); return res.status(500).json({ error: 'AI request failed', details: error?.message || String(error) }); }
}
