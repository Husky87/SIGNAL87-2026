import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';
import { hasUsableText } from '../src/lib/extractedText.js';
import { requireFirebaseUser } from '../src/lib/firebaseAuth.js';
import { retrieveRelevantChunks } from '../src/lib/retrieval.js';

const DEFAULT_PRIMARY_MODEL = 'gpt-4o';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.6-flash';
const MAX_CONTEXT_CHARS = 120_000;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0608802366';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';

type ResearchDocument = {
  id?: string;
  title?: string;
  fullText?: string;
  contentPreview?: string;
  summary?: string;
};

type IngestedFile = {
  id?: string;
  fileName?: string;
  extractedText?: string;
  summaryInfo?: string;
};

function getAuthorizationHeader(req: VercelRequest): string | undefined {
  const value = req.headers.authorization;
  return Array.isArray(value) ? value[0] : value;
}

function trimContext(value: string, remaining: number): string {
  if (remaining <= 0) return '';
  return value.length <= remaining ? value : `${value.slice(0, remaining)}\n[Context truncated by server limit]`;
}

function decodeFirestoreValue(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {});
  return value;
}

function decodeFirestoreFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

async function fetchAuthorizedDocument(authHeader: string, userId: string, documentId: string): Promise<ResearchDocument | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/users/${encodeURIComponent(userId)}/documents/${encodeURIComponent(documentId)}`;
  const response = await fetch(url, { headers: { Authorization: authHeader, Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore document lookup failed [HTTP ${response.status}]`);
  const payload = await response.json();
  const fields = decodeFirestoreFields(payload.fields || {});
  return { id: documentId, ...fields } as ResearchDocument;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authorization = getAuthorizationHeader(req);
  let userId: string;
  try {
    userId = await requireFirebaseUser(authorization);
  } catch (error: any) {
    return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'A valid Firebase ID token is required.' });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'AI service is not configured', details: 'Neither OpenAI nor Gemini is configured in the server environment.' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const researchGoal = typeof body.researchGoal === 'string' ? body.researchGoal.trim() : '';
    const documentIds = Array.isArray(body.documentIds) ? body.documentIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0).slice(0, 50) : [];
    const suppliedDocs: ResearchDocument[] = Array.isArray(body.documents) ? body.documents : [];
    const allAttached: IngestedFile[] = Array.isArray(body.ingestedFilesData) ? body.ingestedFilesData : [];

    if (!researchGoal) return res.status(400).json({ error: 'Research goal is required' });
    if (researchGoal.length > 12_000) return res.status(400).json({ error: 'Research goal is too long.' });

    // Document IDs are resolved against the authenticated user's Firestore
    // namespace. The browser-supplied document body is not trusted as the source
    // of truth when IDs are present.
    let selectedDocs: ResearchDocument[] = [];
    if (documentIds.length > 0) {
      const resolved = await Promise.all(documentIds.map((id) => fetchAuthorizedDocument(authorization as string, userId, id)));
      selectedDocs = resolved.filter((doc): doc is ResearchDocument => Boolean(doc));
    } else {
      selectedDocs = suppliedDocs;
    }

    const readableDocs = selectedDocs.filter((doc) => hasUsableText(doc.fullText || doc.contentPreview || doc.summary));
    const unreadableTitles = selectedDocs.filter((doc) => !readableDocs.includes(doc)).map((doc) => doc.title || 'Untitled document');
    const readableAttached = allAttached.filter((file) => hasUsableText(file.extractedText));
    const unreadableAttached = allAttached.filter((file) => !readableAttached.includes(file)).map((file) => file.fileName || 'Untitled attachment');

    // Retrieval by relevance to researchGoal, not array order — see
    // docs/phase-0-audit.md §1.2 row 6: the previous `remainingChars` loop
    // dropped every document/attachment past the ceiling with zero trace.
    // Falls back to the old blind-concatenation-with-disclosure behavior
    // whenever retrieval can't run (no OPENAI_API_KEY, embeddings failure).
    const retrievalSources = [
      ...readableDocs.map((doc, i) => ({ key: `doc:${i}`, title: doc.title || 'Untitled document', fullText: String(doc.fullText || doc.contentPreview || doc.summary || '') })),
      ...readableAttached.map((file, i) => ({ key: `att:${i}`, title: file.fileName || 'Untitled attachment', fullText: String(file.extractedText || '') }))
    ];
    const retrieval = await retrieveRelevantChunks(researchGoal, retrievalSources, MAX_CONTEXT_CHARS);

    let docContext: string;
    let attachedFilesContext: string;
    let usedRetrieval = retrieval.usedRetrieval;

    if (!retrieval.usedRetrieval) {
      let remainingChars = MAX_CONTEXT_CHARS;
      const docSections: string[] = [];
      for (const [idx, doc] of readableDocs.entries()) {
        const bodyText = doc.fullText || doc.contentPreview || doc.summary || '';
        const section = `Doc ${idx + 1}: ${doc.title || 'Untitled document'}\n${trimContext(bodyText, remainingChars)}`;
        docSections.push(section);
        remainingChars -= section.length;
        if (remainingChars <= 0) break;
      }
      docContext = docSections.join('\n\n');
      const attachedSections: string[] = [];
      for (const [idx, file] of readableAttached.entries()) {
        if (remainingChars <= 0) break;
        const section = `Attachment ${idx + 1}: ${file.fileName || 'Untitled attachment'} (${file.summaryInfo || ''})\nRaw Content:\n${trimContext(file.extractedText || '', remainingChars)}`;
        attachedSections.push(section);
        remainingChars -= section.length;
      }
      attachedFilesContext = attachedSections.join('\n\n');
    } else {
      const omittedForLength: string[] = [];
      const excerptNote = (partial: boolean) => partial ? '\n[Additional content in this source exists but was not included in this excerpt.]' : '';
      const docSections = readableDocs.map((doc, i) => {
        const key = `doc:${i}`; const body = retrieval.selectedText.get(key);
        if (body === undefined) { omittedForLength.push(doc.title || 'Untitled document'); return ''; }
        return `Doc ${i + 1}: ${doc.title || 'Untitled document'}\n${body}${excerptNote(retrieval.partialKeys.has(key))}`;
      }).filter(Boolean);
      docContext = docSections.join('\n\n');
      const attachedSections = readableAttached.map((file, i) => {
        const key = `att:${i}`; const body = retrieval.selectedText.get(key);
        if (body === undefined) { omittedForLength.push(file.fileName || 'Untitled attachment'); return ''; }
        return `Attachment ${i + 1}: ${file.fileName || 'Untitled attachment'} (${file.summaryInfo || ''})\nRaw Content:\n${body}${excerptNote(retrieval.partialKeys.has(key))}`;
      }).filter(Boolean);
      attachedFilesContext = attachedSections.join('\n\n');
      if (omittedForLength.length > 0) {
        docContext += `\n\nSOURCES OMITTED FOR LENGTH — these exist and are readable but no part of them was relevant enough to this specific research goal to include; never say they do not exist, instead name them and say a narrower goal could surface them:\n${omittedForLength.map((n) => `- ${n}`).join('\n')}`;
      }
    }

    if (unreadableTitles.length > 0) {
      docContext += `\n\nDOCUMENTS THAT COULD NOT BE READ (no text extracted — do not answer from them, name them and say they must be re-uploaded):\n${unreadableTitles.map((title) => `- ${title}`).join('\n')}`;
    }
    if (unreadableAttached.length > 0) attachedFilesContext += `\n\nATTACHMENTS THAT COULD NOT BE READ:\n${unreadableAttached.map((name) => `- ${name}`).join('\n')}`;

    const systemInstruction = `You are the official Signal87 AI Platform Research Assistant executing multi-document deep research for authenticated user ${userId}.
Cross-reference supplied legislative texts, corporate filings, lease terms, and government policies with careful logical synthesis.
Do not claim retrieval, browsing, legal verification, clause verification, or other operations unless the supplied context or tool result actually demonstrates it. Distinguish document evidence from inference and identify missing or unreadable sources.
When document content is supplied, perform direct qualitative analysis rather than generic templates. Map first-order categories to second-order themes and synthesize findings across the research phases represented in the supplied data.
For spreadsheet requests, output the required excel_export JSON object at the end of the response. Otherwise, use clean markdown with relevant research sections.`;

    let prompt = `DEEP RESEARCH GOAL: ${researchGoal}\n\nAUTHORIZED SELECTED DOCUMENTS:\n${docContext || 'No readable authorized documents were selected.'}`;
    if (attachedFilesContext) prompt = `ACTIVE ATTACHED FILES INGESTED:\n${attachedFilesContext}\n\n${prompt}`;

    const startTime = Date.now();
    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction,
      model: DEFAULT_PRIMARY_MODEL,
      fallbackModel: DEFAULT_FALLBACK_MODEL,
      temperature: 0.1,
      timeoutMs: 25_000,
      maxOutputTokens: 1800
    });
    const latencyMs = Date.now() - startTime;

    const reasoningSteps = [
      'Input validated and authenticated',
      `Resolved ${selectedDocs.length} authorized document(s); ${readableDocs.length} contained readable text`,
      `Prepared ${readableAttached.length} readable attachment(s)`,
      usedRetrieval ? 'Selected the most relevant excerpts by embedding similarity to the research goal' : `Included sources in request order up to the context budget${retrieval.fallbackReason ? ` (relevance ranking unavailable: ${retrieval.fallbackReason})` : ''}`,
      `Generated response with ${aiResult.provider === 'none' ? 'no available provider' : `${aiResult.provider.toUpperCase()} (${aiResult.modelUsed})`}`,
      ...(aiResult.fallbackTriggered ? [`OpenAI failed; Gemini fallback was used: ${aiResult.fallbackReason || 'primary provider failure'}`] : []),
      'Returned response with source-readability and execution metadata'
    ];

    return res.json({
      agent: 'research-assistant',
      authenticatedUserId: userId,
      text: aiResult.text,
      provider: aiResult.provider,
      modelUsed: aiResult.modelUsed,
      fallbackTriggered: aiResult.fallbackTriggered,
      fallbackReason: aiResult.fallbackReason,
      reasoningSteps,
      verificationTrace: {
        steps: reasoningSteps,
        modelsUsed: aiResult.provider === 'none' ? [] : [aiResult.modelUsed],
        provider: aiResult.provider,
        primaryModel: DEFAULT_PRIMARY_MODEL,
        fallbackModel: DEFAULT_FALLBACK_MODEL,
        selectedDocumentCount: selectedDocs.length,
        readableDocumentCount: readableDocs.length,
        readableAttachmentCount: readableAttached.length,
        unreadableSourceCount: unreadableTitles.length + unreadableAttached.length,
        usedRetrieval,
        ...(retrieval.fallbackReason ? { retrievalFallbackReason: retrieval.fallbackReason } : {}),
        contextCharsProcessed: prompt.length,
        latencyMs
      }
    });
  } catch (error: any) {
    console.error('Error in /api/research:', error);
    return res.status(500).json({ error: 'Failed to run Deep Research agent', details: error?.message || String(error) });
  }
}
