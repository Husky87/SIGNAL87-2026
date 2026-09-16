import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';
import { hasUsableText } from '../src/lib/extractedText.js';
import { requireFirebaseUser } from '../src/lib/firebaseAuth.js';

const DEFAULT_PRIMARY_MODEL = 'gpt-4o';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.6-flash';
const MAX_CONTEXT_CHARS = 120_000;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let userId: string;
  try {
    userId = await requireFirebaseUser(getAuthorizationHeader(req));
  } catch (error: any) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: error?.message || 'A valid Firebase ID token is required.'
    });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither OpenAI nor Gemini is configured in the server environment.'
    });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const researchGoal = typeof body.researchGoal === 'string' ? body.researchGoal.trim() : '';
    const requestedModel = typeof body.model === 'string' ? body.model : DEFAULT_PRIMARY_MODEL;
    const documentIds = Array.isArray(body.documentIds) ? body.documentIds.filter((id: unknown): id is string => typeof id === 'string') : [];
    const allDocs: ResearchDocument[] = Array.isArray(body.documents) ? body.documents : [];
    const allAttached: IngestedFile[] = Array.isArray(body.ingestedFilesData) ? body.ingestedFilesData : [];

    if (!researchGoal) {
      return res.status(400).json({ error: 'Research goal is required' });
    }
    if (researchGoal.length > 12_000) {
      return res.status(400).json({ error: 'Research goal is too long.' });
    }

    // The browser supplies the currently selected document context. Enforce the
    // selection server-side so a caller cannot silently expand the requested set.
    const selectedIdSet = new Set(documentIds);
    const selectedDocs = documentIds.length > 0
      ? allDocs.filter((doc) => typeof doc.id === 'string' && selectedIdSet.has(doc.id))
      : allDocs;

    const readableDocs = selectedDocs.filter((doc) =>
      hasUsableText(doc.fullText || doc.contentPreview || doc.summary)
    );
    const unreadableTitles: string[] = selectedDocs
      .filter((doc) => !readableDocs.includes(doc))
      .map((doc) => doc.title || 'Untitled document');

    let remainingChars = MAX_CONTEXT_CHARS;
    const docSections: string[] = [];
    for (const [idx, doc] of readableDocs.entries()) {
      const bodyText = doc.fullText || doc.contentPreview || doc.summary || '';
      const section = `Doc ${idx + 1}: ${doc.title || 'Untitled document'}\n${trimContext(bodyText, remainingChars)}`;
      docSections.push(section);
      remainingChars -= section.length;
      if (remainingChars <= 0) break;
    }

    let docContext = docSections.join('\n\n');
    if (unreadableTitles.length > 0) {
      docContext +=
        `\n\nDOCUMENTS THAT COULD NOT BE READ (no text extracted — do not answer from them, ` +
        `name them and say they must be re-uploaded):\n` +
        unreadableTitles.map((title) => `- ${title}`).join('\n');
    }

    const readableAttached = allAttached.filter((file) => hasUsableText(file.extractedText));
    const unreadableAttached = allAttached
      .filter((file) => !readableAttached.includes(file))
      .map((file) => file.fileName || 'Untitled attachment');

    const attachedSections: string[] = [];
    for (const [idx, file] of readableAttached.entries()) {
      if (remainingChars <= 0) break;
      const section = `Attachment ${idx + 1}: ${file.fileName || 'Untitled attachment'} (${file.summaryInfo || ''})\nRaw Content:\n${trimContext(file.extractedText || '', remainingChars)}`;
      attachedSections.push(section);
      remainingChars -= section.length;
    }

    let attachedFilesContext = attachedSections.join('\n\n');
    if (unreadableAttached.length > 0) {
      attachedFilesContext += `\n\nATTACHMENTS THAT COULD NOT BE READ:\n${unreadableAttached.map((name) => `- ${name}`).join('\n')}`;
    }

    const systemInstruction = `You are the official Signal87 AI Platform Research Assistant executing multi-document deep research for authenticated user ${userId}.
Cross-reference the supplied legislative texts, corporate filings, lease terms, and government policies with careful logical synthesis.

Do not claim that you performed retrieval, browsing, legal verification, clause verification, or other operations unless the supplied context or tool result actually demonstrates it. Distinguish document evidence from inference and clearly identify missing or unreadable sources.

When document content is supplied, perform direct qualitative analysis rather than generic templates. Map first-order categories to second-order themes and synthesize findings across the research phases represented in the supplied data.

For spreadsheet requests, output the required excel_export JSON object at the end of the response. Otherwise, structure the response with clean markdown using relevant sections such as Deep Qualitative Analysis, Category & Theme Mapping, Phase-Based Research Patterns, Risk Assessment & Legal/Policy Exposure, and Strategic Actionable Recommendations.`;

    let prompt = `DEEP RESEARCH GOAL: ${researchGoal}\n\nSELECTED REPOSITORY DOCUMENTS:\n${docContext || 'No readable indexed documents were selected.'}`;
    if (attachedFilesContext) {
      prompt = `ACTIVE ATTACHED FILES INGESTED:\n${attachedFilesContext}\n\n${prompt}`;
    }

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
      `Prepared ${readableDocs.length} readable document(s) and ${readableAttached.length} readable attachment(s)`,
      `Generated research response with ${aiResult.provider === 'none' ? 'no available provider' : `${aiResult.provider.toUpperCase()} (${aiResult.modelUsed})`}`,
      ...(aiResult.fallbackTriggered ? [`OpenAI failed; Gemini fallback was used: ${aiResult.fallbackReason || 'primary provider failure'}`] : []),
      'Response returned with source-readability and execution metadata'
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
        contextCharsProcessed: prompt.length,
        latencyMs
      }
    });
  } catch (error: any) {
    console.error('Error in /api/research:', error);
    return res.status(500).json({
      error: 'Failed to run Deep Research agent',
      details: error?.message || String(error)
    });
  }
}
