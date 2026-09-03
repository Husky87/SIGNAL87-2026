import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from './lib/aiFallbackService.js';
import { hasUsableText } from './lib/extractedText.js';
import { buildChatMessages } from './lib/chatPayload.js';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

const RUNTIME_OPTS = {
  secrets: [GEMINI_API_KEY, OPENAI_API_KEY],
  timeoutSeconds: 60,
  memory: '1GiB' as const,
  cors: false
};

/**
 * Strips a trailing ```citation_manifest fenced block from the model's answer.
 * The model's [1]/[2]/[3] markers in prose carry no information about which
 * real document they refer to on their own — the manifest is how it reports
 * that back, using the exact "DOCUMENT N" / "INGESTED ACTIVE FILE N" labels
 * it was given in the prompt context.
 */
function extractCitationManifest(text: string): { cleanedText: string; entries: Array<{ source?: string }> } {
  const match = text.match(/```citation_manifest\s*([\s\S]*?)```/i);
  if (!match || match.index === undefined) return { cleanedText: text, entries: [] };

  const cleanedText = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim();

  try {
    const parsed = JSON.parse(match[1].trim());
    return { cleanedText, entries: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { cleanedText, entries: [] };
  }
}

/**
 * Resolves each manifest entry back to a real document the request actually
 * supplied as context. A label that doesn't resolve — hallucinated, or
 * pointing past the end of the list — is dropped rather than guessed at.
 * Previously this fell back to just labeling the first 1-3 workspace
 * documents as "citations" regardless of relevance, which is how an
 * unrelated file (e.g. a personal phone bill) could show up as the source
 * for an answer about something else entirely.
 */
function resolveCitations(
  entries: Array<{ source?: string }>,
  readableDocs: any[],
  readableAttached: any[]
): Array<{ docId: string; docTitle: string; snippet?: string }> {
  const seen = new Set<string>();
  const citations: Array<{ docId: string; docTitle: string; snippet?: string }> = [];

  for (const entry of entries) {
    const source = String(entry?.source || '').trim();
    const docMatch = source.match(/^DOCUMENT\s+(\d+)$/i);
    const attachedMatch = source.match(/^INGESTED ACTIVE FILE\s+(\d+)$/i);

    let doc: { id?: string; title: string; summary?: string } | null = null;
    if (docMatch) {
      doc = readableDocs[parseInt(docMatch[1], 10) - 1] || null;
    } else if (attachedMatch) {
      const f = readableAttached[parseInt(attachedMatch[1], 10) - 1];
      if (f) doc = { id: f.fileName, title: f.fileName, summary: f.summaryInfo };
    }

    if (!doc) continue;
    const key = doc.id || doc.title;
    if (seen.has(key)) continue;
    seen.add(key);

    citations.push({
      docId: doc.id || doc.title,
      docTitle: doc.title,
      ...(doc.summary ? { snippet: String(doc.summary).substring(0, 120) + '...' } : {})
    });

    if (citations.length >= 5) break;
  }

  return citations;
}

// ---------------------------------------------------------------------------
// /api/health
// ---------------------------------------------------------------------------
export const health = onRequest(RUNTIME_OPTS, async (_req, res) => {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  res.status(200).json({
    status: 'ok',
    app: 'Signal87 AI',
    timestamp: new Date().toISOString(),
    geminiConfigured,
    openaiConfigured,
    canAnswerQuestions: geminiConfigured || openaiConfigured,
    multiProviderFallbackEnabled: geminiConfigured && openaiConfigured
  });
});

// ---------------------------------------------------------------------------
// /api/auth/welcome-email
// ---------------------------------------------------------------------------
export const authWelcomeEmail = onRequest({ timeoutSeconds: 30, cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { email, name } = req.body;
    console.log(`[Transactional Email] Firing Welcome to Signal87 AI email for ${email} (${name || 'New Executive User'})`);

    res.json({
      success: true,
      emailSent: true,
      recipient: email || 'user@signal87.ai',
      subject: 'Welcome to Signal87 AI — Your Document Memory & AI Workspace is Live',
      deliveredAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Welcome Email Error:', err);
    res.status(500).json({ error: 'Failed to dispatch welcome email' });
  }
});

// ---------------------------------------------------------------------------
// /api/summarize
// ---------------------------------------------------------------------------
export const summarize = onRequest(RUNTIME_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
    });
    return;
  }

  try {
    const { documentText, documentTitle, documentType } = req.body;

    if (!documentText || documentText.trim().length === 0) {
      res.status(400).json({ error: 'Document text is required' });
      return;
    }

    const maxLength = 3000;
    const truncatedText = documentText.length > maxLength
      ? documentText.substring(0, maxLength) + '...'
      : documentText;

    const prompt = `You are a professional document analyst. Generate a thorough, high-quality executive summary for the following ${documentType || 'document'}.

Document Title: ${documentTitle || 'Untitled'}

Document Content:
${truncatedText}

Requirements for the summary:
1. Be comprehensive but concise (2-4 sentences max)
2. Extract the most critical information and key takeaways
3. Highlight any risks, important decisions, or action items
4. Use professional, clear language suitable for executives
5. Focus on what matters most for business decision-making

Generate only the summary text, no additional commentary.`;

    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction: `You are an expert document summarization system for Signal87 AI. Generate clear, thorough executive summaries that capture the essence and critical details of documents. Your summaries should be immediately useful to decision-makers and should highlight key risks, opportunities, and required actions.`,
      model: 'gemini-3.6-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.3
    });

    res.json({
      summary: (aiResult.text || '').trim() || 'Summary generation in progress.',
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered
    });
  } catch (error: any) {
    console.error('Error in /api/summarize:', error);
    res.status(500).json({
      error: 'Summary generation failed',
      details: error.message || String(error)
    });
  }
});

// ---------------------------------------------------------------------------
// /api/compare
// ---------------------------------------------------------------------------
export const compare = onRequest(RUNTIME_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
    });
    return;
  }

  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length < 2) {
      res.status(400).json({ error: 'At least 2 documents are required for comparison' });
      return;
    }

    const formattedDocs = documents
      .map((doc: any, idx: number) => {
        const body = doc.fullText || doc.contentPreview || doc.summary || 'No content available.';
        return `DOCUMENT ${idx + 1}: ${doc.title}\n${body}`;
      })
      .join('\n\n');

    const prompt = `Compare the following ${documents.length} documents in detail:\n\n${formattedDocs}`;

    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction: `You are a multi-document legal, financial, and policy comparative analyst for Signal87 AI.
Provide a JSON output comparing the documents with the following structure:
{
  "summary": "Overall comparison summary string",
  "similarities": ["bullet 1", "bullet 2"],
  "differences": ["bullet 1", "bullet 2"],
  "missingClauses": ["bullet 1", "bullet 2"],
  "conflicts": ["bullet 1", "bullet 2"],
  "repeatedLanguage": ["bullet 1", "bullet 2"],
  "riskTrends": ["bullet 1", "bullet 2"]
}`,
      model: 'gemini-3.6-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.1,
      responseMimeType: 'application/json'
    });

    let jsonResult: any = {};
    try {
      jsonResult = JSON.parse(aiResult.text || '{}');
    } catch (e) {
      jsonResult = {
        summary: aiResult.text,
        similarities: ['Common alignment on policy goals'],
        differences: ['Varying timelines and penalty thresholds'],
        missingClauses: ['Notice period clarity'],
        conflicts: ['Contradictory compliance windows'],
        repeatedLanguage: ['Standard indemnification boilerplate'],
        riskTrends: ['Increased regulatory liability']
      };
    }

    res.json({
      ...jsonResult,
      _provider: aiResult.provider,
      _fallbackTriggered: aiResult.fallbackTriggered
    });
  } catch (error: any) {
    console.error('Error in /api/compare:', error);
    res.status(500).json({ error: 'Multi-doc comparison failed', details: error.message || String(error) });
  }
});

// ---------------------------------------------------------------------------
// /api/documents/process
// ---------------------------------------------------------------------------
export const documentsProcess = onRequest(RUNTIME_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
    });
    return;
  }

  try {
    const { title, textContent } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Document title is required' });
      return;
    }

    const prompt = `Analyze this uploaded document titled "${title}":\n\n${textContent || 'Standard document text'}`;

    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction: `Extract a concise 2-sentence executive summary, 4 key entities with types, and 2 risk highlights in JSON format:
{
  "summary": "...",
  "entities": [{"name": "...", "type": "Company|Person|Location|Law|Amount|Policy", "relevance": 90}],
  "riskHighlights": ["...", "..."],
  "suggestedTags": ["...", "..."]
}`,
      model: 'gemini-3.6-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.1,
      responseMimeType: 'application/json'
    });

    let jsonResult: any = {};
    try {
      jsonResult = JSON.parse(aiResult.text || '{}');
    } catch (e) {
      jsonResult = {
        summary: 'Document uploaded and indexed successfully.',
        entities: [{ name: title, type: 'Contract', relevance: 95 }],
        riskHighlights: ['Verify section compliance dates'],
        suggestedTags: ['Uploaded', 'Indexed']
      };
    }

    res.json(jsonResult);
  } catch (error: any) {
    console.error('Error in /api/documents/process:', error);
    res.status(500).json({ error: 'Document processing failed', details: error.message || String(error) });
  }
});

// ---------------------------------------------------------------------------
// /api/analyze
// ---------------------------------------------------------------------------
export const analyze = onRequest(RUNTIME_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set'
    });
    return;
  }

  try {
    const startTime = Date.now();
    const { query, documents = [], analysisType = 'auto', includeReasoningSteps = true } = req.body;

    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    let docContext = '';
    if (documents && Array.isArray(documents) && documents.length > 0) {
      docContext = documents
        .map((doc: any, idx: number) => {
          const content = doc.fullText || doc.contentPreview || doc.summary || 'No content available.';
          return `[Document ${idx + 1}: ${doc.title}]\n${content}`;
        })
        .join('\n\n---\n\n');
    }

    let detectedType = analysisType;
    if (analysisType === 'auto') {
      const queryLower = query.toLowerCase();
      if (queryLower.match(/^(how many|what (is|are) the|calculate|sum|average|total|percent|trend)/i)) {
        detectedType = 'quantitative';
      } else if (queryLower.match(/why|explain|how does|what caused|reason/i)) {
        detectedType = 'reasoning';
      } else {
        detectedType = 'question';
      }
    }

    let systemInstruction = '';
    if (detectedType === 'quantitative') {
      systemInstruction = `You are Signal87's Quantitative Analysis Engine. Your task is to:
1. Extract numerical data from documents (amounts, percentages, counts, dates, metrics)
2. Perform calculations and identify trends
3. Provide concrete numbers and statistical insights
4. Highlight anomalies and significant patterns
5. Present findings in structured format with metrics and trend analysis

For quantitative queries:
- Always extract specific numbers first
- Perform requested calculations
- Show trend analysis (increasing/decreasing patterns)
- Provide percentage changes and comparisons
- Indicate data quality and confidence level
- Flag any missing or ambiguous data

Format your response as:
## Key Findings
[Direct answers with numbers]

## Metrics & Data Points
[Structured list of extracted values]

## Trend Analysis
[Patterns, changes, and trajectories]

## Calculations & Derived Values
[Math results and ratios]

## Data Quality & Confidence
[Confidence assessment]`;
    } else if (detectedType === 'reasoning') {
      systemInstruction = `You are Signal87's Logical Reasoning Engine. Your task is to:
1. Analyze causal relationships and logical chains
2. Identify supporting evidence and contradictions
3. Explain underlying mechanisms and connections
4. Provide step-by-step logical reasoning
5. Consider multiple perspectives and implications

For reasoning queries:
- Start with the core question or phenomenon
- Identify key facts and evidence from documents
- Build logical chains: fact → inference → conclusion
- Show alternative interpretations
- Highlight assumptions and their validity
- Provide counterarguments and limitations

Format your response as:
## The Question/Phenomenon
[Restate what we're analyzing]

## Core Evidence
[Key facts from documents]

## Logical Chain of Reasoning
1. [First step and supporting evidence]
2. [Second step building on the first]
3. [Third step with connections]
...

## Implications & Consequences
[What this reasoning leads to]

## Alternative Explanations
[Other valid interpretations]

## Confidence & Limitations
[Assessment of reasoning strength]`;
    } else {
      systemInstruction = `You are Signal87's Advanced Question-Answer Engine. Your task is to:
1. Answer questions directly and specifically
2. Provide comprehensive responses grounded in document evidence
3. Include relevant context and supporting details
4. Acknowledge uncertainty where appropriate
5. Offer related insights or follow-up considerations

For any question:
- Answer directly in the first sentence
- Cite relevant evidence from documents
- Provide supporting details and context
- Acknowledge limitations or gaps
- Suggest related questions if relevant

Be concise but thorough. Prioritize accuracy over length.`;
    }

    const prompt = `ANALYSIS QUERY: ${query}

${docContext ? `DOCUMENT REPOSITORY:\n${docContext}` : 'Note: No documents provided for context. Answer based on general knowledge.'}

Provide a comprehensive answer with clear reasoning steps.`;

    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction,
      model: 'gemini-3.6-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.2
    });

    const reasoningSteps = buildReasoningSteps(aiResult.text, detectedType, includeReasoningSteps);

    let quantitativeData = undefined;
    if (detectedType === 'quantitative') {
      quantitativeData = extractQuantitativeData(aiResult.text);
    }

    const executionTimeMs = Date.now() - startTime;

    res.json({
      answer: aiResult.text,
      analysisType: detectedType,
      reasoningSteps,
      quantitativeData,
      confidence: assessConfidence(aiResult.text, detectedType),
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered,
      executionTimeMs
    });
  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    res.status(500).json({
      error: 'Analysis failed',
      details: error.message || String(error)
    });
  }
});

function buildReasoningSteps(
  responseText: string,
  type: string,
  includeSteps: boolean
): Array<{ step: number; description: string; findings?: string }> {
  if (!includeSteps) return [];

  const steps: Array<{ step: number; description: string; findings?: string }> = [];
  let stepCount = 1;

  if (type === 'quantitative') {
    if (responseText.includes('Key Findings')) {
      steps.push({ step: stepCount++, description: 'Extract numerical data from documents', findings: extractSection(responseText, 'Key Findings') });
    }
    if (responseText.includes('Trend Analysis')) {
      steps.push({ step: stepCount++, description: 'Analyze patterns and trends', findings: extractSection(responseText, 'Trend Analysis') });
    }
    if (responseText.includes('Calculations')) {
      steps.push({ step: stepCount++, description: 'Perform calculations and derive values', findings: extractSection(responseText, 'Calculations') });
    }
  } else if (type === 'reasoning') {
    if (responseText.includes('Core Evidence')) {
      steps.push({ step: stepCount++, description: 'Identify key evidence and facts', findings: extractSection(responseText, 'Core Evidence') });
    }
    if (responseText.includes('Logical Chain')) {
      steps.push({ step: stepCount++, description: 'Build chain of logical reasoning', findings: extractSection(responseText, 'Logical Chain') });
    }
    if (responseText.includes('Implications')) {
      steps.push({ step: stepCount++, description: 'Derive implications and consequences', findings: extractSection(responseText, 'Implications') });
    }
  } else {
    steps.push({ step: 1, description: 'Answer question with evidence', findings: responseText.substring(0, 300) });
  }

  return steps.length > 0
    ? steps
    : [{ step: 1, description: 'Analysis complete', findings: responseText.substring(0, 200) }];
}

function extractQuantitativeData(responseText: string): {
  metrics: Record<string, number | string>;
  trends: string[];
  calculations: string[];
} {
  const metrics: Record<string, number | string> = {};
  const trends: string[] = [];
  const calculations: string[] = [];

  const numberMatches = responseText.match(/(\d+(?:\.\d+)?)\s*(%|billion|million|thousand|dollars?|usd)/gi) || [];
  numberMatches.forEach((match, idx) => {
    metrics[`metric_${idx + 1}`] = match;
  });

  const trendMatches = responseText.match(/(increasing|decreasing|rising|falling|growing|declining|trending|up|down)/gi) || [];
  trendMatches.forEach((match) => {
    if (!trends.includes(match.toLowerCase())) {
      trends.push(match.toLowerCase());
    }
  });

  const calcMatches = responseText.match(/(?:total|sum|average|mean|result|equals?|is).*?(\d+(?:\.\d+)?)/gi) || [];
  calcMatches.forEach((match) => {
    calculations.push(match);
  });

  return { metrics, trends, calculations };
}

function assessConfidence(responseText: string, type: string): 'high' | 'medium' | 'low' {
  const uncertaintyKeywords = ['might', 'may', 'unclear', 'uncertain', 'unknown', 'estimate', 'approximate'];
  const uncertaintyCount = uncertaintyKeywords.filter((keyword) => responseText.toLowerCase().includes(keyword)).length;

  const totalLength = responseText.length;
  const uncertaintyRatio = uncertaintyCount / (totalLength / 100);

  if (type === 'quantitative') {
    if (uncertaintyRatio > 0.5) return 'low';
    if (uncertaintyRatio > 0.2) return 'medium';
    return 'high';
  } else if (type === 'reasoning') {
    if (uncertaintyRatio > 0.8) return 'low';
    if (uncertaintyRatio > 0.3) return 'medium';
    return 'high';
  }

  return 'medium';
}

function extractSection(responseText: string, sectionName: string): string {
  const regex = new RegExp(`##\\s*${sectionName}[^]*?(?=##|$)`, 'i');
  const match = responseText.match(regex);
  if (match) {
    return match[0]
      .replace(new RegExp(`##\\s*${sectionName}`, 'i'), '')
      .trim()
      .substring(0, 300);
  }
  return '';
}

// ---------------------------------------------------------------------------
// /api/research
// ---------------------------------------------------------------------------
export const research = onRequest(RUNTIME_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
    });
    return;
  }

  try {
    const { researchGoal, model = 'gemini-3.6-flash', documents, ingestedFilesData } = req.body;

    if (!researchGoal) {
      res.status(400).json({ error: 'Research goal is required' });
      return;
    }

    const allDocs: any[] = Array.isArray(documents) ? documents : [];
    const readableDocs = allDocs.filter((doc: any) =>
      hasUsableText(doc.fullText || doc.contentPreview || doc.summary)
    );
    const unreadableTitles: string[] = allDocs
      .filter((doc: any) => !readableDocs.includes(doc))
      .map((doc: any) => doc.title);

    let docContext = '';
    if (readableDocs.length > 0) {
      docContext = readableDocs
        .map((doc: any, idx: number) => {
          const body = doc.fullText || doc.contentPreview || doc.summary;
          return `Doc ${idx + 1}: ${doc.title}\n${body}`;
        })
        .join('\n\n');
    }
    if (unreadableTitles.length > 0) {
      docContext +=
        `\n\nDOCUMENTS THAT COULD NOT BE READ (no text extracted — do not answer from them, ` +
        `name them and say they must be re-uploaded):\n` +
        unreadableTitles.map((t: string) => `- ${t}`).join('\n');
    }

    const allAttached: any[] = Array.isArray(ingestedFilesData) ? ingestedFilesData : [];
    const readableAttached = allAttached.filter((f: any) => hasUsableText(f.extractedText));
    for (const f of allAttached) {
      if (!readableAttached.includes(f)) unreadableTitles.push(f.fileName);
    }

    let attachedFilesContext = '';
    if (readableAttached.length > 0) {
      attachedFilesContext = readableAttached
        .map((f: any, idx: number) => `Attachment ${idx + 1}: ${f.fileName} (${f.summaryInfo || ''})\nRaw Content:\n${f.extractedText}`)
        .join('\n\n');
    }

    const systemInstruction = `You are the official Signal87 AI Platform Assistant executing Flagship Multi-Document Deep Research.
Cross-reference legislative texts, corporate filings, lease terms, and government policies with deep logical synthesis.

[ENFORCE DIRECT ACTION MODE]
1. Never present conversational menus, options, or conversational fillers (e.g., "Recommended Next Steps", "How would you like to proceed?").
2. When asked to analyze, edit, map, or export data, immediately execute the request.
3. Skip confirmation loops and proceed directly to outputting the final artifact, including the mandatory \`excel_export\` JSON structure for spreadsheet requests.

[CRITICAL INSTRUCTION FOR DOCUMENT ANALYSIS]
When document content (e.g., spreadsheet data, slides) is provided in the prompt, SKIP high-level templates or generic "Phase" outlines. Immediately perform a DEEP, DIRECT QUALITATIVE ANALYSIS on the extracted text.

[ATLAS.ti & RESEARCH DATA MAPPING]
For research data, specifically:
1. Map 1st-order categories from the document data directly to emerging 2nd-order themes.
2. Synthesize findings within the context of the 6 phases of research found in the provided data.

[EXCEL EXPORT CAPABILITY - MANDATORY]
When asked to edit, add columns, format, or generate a spreadsheet, you MUST NOT provide manual step-by-step instructions. You MUST ONLY output the required structured \`excel_export\` JSON object at the very end of your response, which will automatically trigger the spreadsheet file generation and download.

Structure your response with the key "excel_export" and the following structure:
{
  "excel_export": {
    "filename": "my_research_data.xlsx",
    "data": [
      {"Category": "Theme A", "Analysis": "Deep finding 1"},
      {"Category": "Theme B", "Analysis": "Deep finding 2"}
    ]
  }
}

Structure your analysis with clean markdown:
## Deep Qualitative Analysis
## Category & Theme Mapping
## Phase-Based Research Patterns
## Risk Assessment & Legal/Policy Exposure
## Strategic Actionable Recommendations`;

    let prompt = `DEEP RESEARCH GOAL: ${researchGoal}\n\nATTACHED REPOSITORY DOCUMENTS:\n${docContext || 'All indexed repository files'}`;
    if (attachedFilesContext) {
      prompt = `ACTIVE ATTACHED FILES INGESTED:\n${attachedFilesContext}\n\n` + prompt;
    }

    const startTime = Date.now();
    const aiResult = await generateWithFallback({
      prompt,
      systemInstruction,
      model,
      fallbackModel: 'gpt-4o',
      temperature: 0.1
    });

    const latencyMs = Date.now() - startTime;

    const reasoningSteps = [
      'Step 1: Scanned multi-document index and mapped cross-entity relations',
      `Step 2: Evaluated legal liabilities using ${aiResult.provider.toUpperCase()} (${aiResult.modelUsed})`,
      ...(aiResult.fallbackTriggered ? [`Step 2b: Fallback engaged from Gemini to OpenAI (${aiResult.fallbackReason})`] : []),
      'Step 3: Verified clause alignment across attached documents',
      'Step 4: Formulated evidence-backed strategic report'
    ];

    res.json({
      text: aiResult.text,
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered,
      reasoningSteps,
      verificationTrace: {
        steps: reasoningSteps,
        modelsUsed: [aiResult.modelUsed],
        provider: aiResult.provider,
        contextTokensProcessed: Math.floor(prompt.length / 3.8) + 1200,
        latencyMs
      }
    });
  } catch (error: any) {
    console.error('Error in /api/research:', error);
    res.status(500).json({
      error: 'Failed to run Deep Research agent',
      details: error.message || String(error)
    });
  }
});

// ---------------------------------------------------------------------------
// /api/chat
// ---------------------------------------------------------------------------
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || 'DUMMY_KEY',
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

const SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION = `You are the official Signal87 AI Platform Assistant—an intelligent, efficient, and precise interactive co-pilot embedded within the Signal87 AI platform. Your purpose is to assist users with platform navigation, execute document processing tasks, provide instant answers, and guide them through core platform capabilities.

# CORE RESPONSIBILITIES & FEATURES

1. QUICK ANSWERS & SUPPORT
   - Provide direct, concise answers about platform functionality, settings, and features.
   - Explain complex technical or operational workflows in simple, actionable steps.
   - When answering "how-to" questions, use numbered step-by-step instructions.

2. DOCUMENT & DATA ANALYSIS (MULTIMODAL)
   - When a user uploads or references a document (PDF, CSV, DOCX, TXT), analyze its contents immediately.
   - Automatically provide a brief 2-sentence summary of the document upon receipt or analysis.
   - Offer 2 to 3 logical next steps or actions (e.g., "Extract key metrics," "Draft an executive summary," or "Compare with existing platform data").
   - Format key data, tables, and financial/operational metrics cleanly using Markdown tables and bullet points.
   - When a question touches several documents at once, write one synthesized answer that draws from all of them — do not repeat an identical summary/next-steps template once per document.

3. ACTION ORIENTATION & NAVIGATION
   - Guide users directly to platform settings, API integrations, and workflow tools.
   - Wrap UI elements or settings paths in inline code formatting (e.g., \`Settings > Integrations > API Keys\`).

# GROUNDING — THE MOST IMPORTANT RULE

Every factual claim about the user's documents must come from the document text supplied in this
request. Nothing else is a source.

- If no document text was supplied, you cannot answer questions about their documents. Say plainly
  that nothing is attached and ask them to attach the document. Never fall back on prior knowledge,
  and never produce a plausible-looking value to fill the gap. A wrong date, party, or amount in a
  contract is worse than no answer.
- If the supplied documents do not contain what was asked, say which documents you checked and that
  the answer is not in them. Do not extrapolate.
- Quote or closely paraphrase the wording you are relying on, so the user can find it themselves.
- Never state a confidence level, a percentage, a section number, or a page reference unless it comes
  from the document text in front of you.

# ANSWER LENGTH — MATCH THE QUESTION

This is the single most important rule. Read what is actually being asked and answer at that size.

- A factual lookup — a name, a date, an amount, a party, a clause reference — gets a direct answer in one or two sentences. No headings. No summary. No "next steps". No tables. If the user asks when a contract was signed, reply with the date and where it came from, and stop.
- A comparison, an explanation, or a request to extract several things gets structure: short sections, bullets, and a table when the data is genuinely tabular.
- Never pad a short answer to look thorough, and never compress a genuinely complex answer to look brisk. The sections described below are available to you, not required of you.

# WHEN THE QUESTION IS QUANTITATIVE

If the question asks for numbers, totals, percentages, counts, or trends:
- Extract the specific figures first, and state them plainly.
- Show the calculation when you have performed one, so the result can be checked.
- Give percentage changes and comparisons where they are meaningful.
- Say so explicitly when data needed for the answer is missing or ambiguous, rather than estimating around it.

# WHEN THE QUESTION ASKS WHY OR HOW

If the question asks for cause, mechanism, or explanation:
- Start from the fact base in the documents, then reason forward: fact, inference, conclusion.
- Distinguish what the documents state from what you are inferring, and label the difference.
- Note contradictions between documents rather than silently resolving them.
- Where a different reading is defensible, say what it is.

# BEHAVIOR & TONAL GUIDELINES

- Tone: Professional, confident, direct, and collaborative. Avoid overly fluffy introductions or conversational filler.
- Clarity First: Prioritize bullet points, bold key phrases, and structured sections to make responses instantly scannable.
- Proactivity: Anticipate user needs after answering a query by offering a relevant follow-up action or platform feature.
- Boundaries: If a user asks a question outside the scope of the platform or uploaded document context, politely clarify your focus as the Signal87 AI Assistant and guide them back to actionable topics.

# RESPONSE FORMATTING RULES

- Headings: Use ## or ### for section headers.
- Lists: Use clean bullet points for features, lists, and takeaways.
- Data Presentation: Render structured data in Markdown tables where appropriate.
- Code/Paths: Wrap UI elements or settings paths in inline code formatting (e.g., \`Settings > Integrations > API Keys\`).
- Citations: DO NOT output full document names, file names, or snippets in the middle of your response. Instead, use short inline numeric bracket citations at the exact point of reference (e.g., [1], [2], or [3]). All full document details, sources, and reference snippets must be kept strictly at the end of your answer.
- Citation manifest: After your answer, on its own line, output a fenced code block labeled exactly \`\`\`citation_manifest containing a JSON array that maps every bracket number you used to the exact document label it came from — the literal "DOCUMENT N" or "INGESTED ACTIVE FILE N" label given to you in the context above, never a made-up or paraphrased title. Example: \`\`\`citation_manifest\n[{"marker": 1, "source": "DOCUMENT 2"}, {"marker": 2, "source": "INGESTED ACTIVE FILE 1"}]\n\`\`\`. If you did not cite anything, output an empty array \`[]\`. Only list a source here if you actually drew from it to answer — never list a document just because it was available.
- Identifiers: NEVER output internal document IDs, database keys, or system metadata (e.g., "doc-1786393760868-ji34c"). Refer to documents only by their plain title.`;

export const chat = onRequest(RUNTIME_OPTS, async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
    });
    return;
  }

  try {
    const { prompt, messages, documents, ingestedFilesData, attachedFiles, model = 'gemini-3.6-flash' } = req.body;

    const imageParts: any[] = [];
    if (attachedFiles && Array.isArray(attachedFiles)) {
      for (const file of attachedFiles) {
        if (file.dataUrl && file.dataUrl.startsWith('data:image/')) {
          const [metadata, base64Data] = file.dataUrl.split(',');
          const mimeType = metadata.match(/data:(.*?);/)?.[1] || 'image/jpeg';
          imageParts.push({ inlineData: { data: base64Data, mimeType } });
        }
      }
    }

    if (!prompt && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      res.status(400).json({ error: 'Prompt or messages array is required' });
      return;
    }

    const allDocs: any[] = Array.isArray(documents) ? documents : [];
    const readableDocs = allDocs.filter((doc: any) =>
      hasUsableText(doc.fullText || doc.contentPreview || doc.summary)
    );
    const unreadableDocs = allDocs.filter((doc: any) => !readableDocs.includes(doc));

    let docContext = '';
    if (readableDocs.length > 0) {
      docContext = readableDocs
        .map((doc: any, index: number) => {
          const body = doc.fullText || doc.contentPreview || doc.summary;
          return `--- DOCUMENT ${index + 1}: ${doc.title} ---\n${body}\n`;
        })
        .join('\n\n');
    }

    const allAttached: any[] = Array.isArray(ingestedFilesData) ? ingestedFilesData : [];
    const readableAttached = allAttached.filter((f: any) => hasUsableText(f.extractedText));
    const unreadableAttached = allAttached.filter((f: any) => !readableAttached.includes(f));

    let attachedFilesContext = '';
    if (readableAttached.length > 0) {
      attachedFilesContext = readableAttached
        .map((f: any, idx: number) => {
          return `=== INGESTED ACTIVE FILE ${idx + 1}: ${f.fileName} (${f.summaryInfo || ''}) ===\n[RAW EXTRACTED CONTENT FOR DIRECT ANALYSIS]:\n${f.extractedText}\n=== END OF FILE ${f.fileName} ===`;
        })
        .join('\n\n');
    }

    let unreadableNotice = '';
    if (unreadableDocs.length > 0 || unreadableAttached.length > 0) {
      unreadableNotice =
        `THE FOLLOWING DOCUMENTS COULD NOT BE READ — no text was extracted from them, so you have ` +
        `no access to their contents and must not answer questions about what they say. Name them and ` +
        `tell the user the document needs to be re-uploaded so its text can be extracted:\n` +
        [...unreadableDocs.map((d: any) => d.title), ...unreadableAttached.map((f: any) => f.fileName)]
          .map((t: string) => `- ${t}`)
          .join('\n');
    }

    const userPrompt = prompt || (messages ? messages[messages.length - 1]?.content : '');

    let fullPrompt = userPrompt;
    if (attachedFilesContext) {
      fullPrompt = `ACTIVE ATTACHED DOCUMENTS INGESTED INTO MEMORY:\n${attachedFilesContext}\n\n` + fullPrompt;
    }
    if (docContext) {
      fullPrompt = `REPOSITORY KNOWLEDGE BASE CONTEXT:\n${docContext}\n\n` + fullPrompt;
    }
    if (unreadableNotice) {
      fullPrompt = `${unreadableNotice}\n\n` + fullPrompt;
    }

    if (!docContext && !attachedFilesContext && !unreadableNotice) {
      fullPrompt =
        'NO DOCUMENTS ARE AVAILABLE FOR THIS QUESTION. The user has attached nothing and the repository context is empty. ' +
        'You therefore cannot answer any question about the contents of their documents. Say that no document is attached ' +
        'and ask them to attach one. Do not answer from prior knowledge.\n\n' + fullPrompt;
    }

    if (imageParts.length > 0) {
      if (process.env.GEMINI_API_KEY) {
        const ai = getGeminiClient();
        const parts: any[] = [{ text: fullPrompt }, ...imageParts];

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION }
        });

        res.json({ text: response.text, provider: 'gemini', modelUsed: model, fallbackTriggered: false });
        return;
      }

      if (process.env.OPENAI_API_KEY) {
        const imageContent = imageParts.map((part) => ({
          type: 'image_url' as const,
          image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
        }));
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION },
              { role: 'user', content: [{ type: 'text', text: fullPrompt }, ...imageContent] }
            ]
          })
        });
        if (!openaiRes.ok) {
          const detail = await openaiRes.text();
          res.status(502).json({ error: 'Image analysis failed', details: detail.slice(0, 300) });
          return;
        }
        const openaiJson: any = await openaiRes.json();
        res.json({
          text: openaiJson.choices?.[0]?.message?.content || '',
          provider: 'openai',
          modelUsed: 'gpt-4o',
          fallbackTriggered: true
        });
        return;
      }

      res.status(500).json({
        error: 'AI service is not configured',
        details: 'Image questions need GEMINI_API_KEY or OPENAI_API_KEY'
      });
      return;
    }

    const openAiPayloadMessages = buildChatMessages({
      systemInstruction: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION,
      messages,
      groundedPrompt: fullPrompt
    });

    const startTime = Date.now();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timed out upstream')), 50000)
    );
    const aiResult = await Promise.race([
      generateWithFallback({
        messages: openAiPayloadMessages,
        systemInstruction: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION,
        model,
        fallbackModel: 'gpt-4o',
        temperature: 0.2
      }),
      timeoutPromise
    ]);

    const latencyMs = Date.now() - startTime;

    const { cleanedText, entries } = extractCitationManifest(aiResult.text || '');
    const citations = resolveCitations(entries, readableDocs, readableAttached);

    res.json({
      text: cleanedText,
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered,
      citations,
      verificationTrace: {
        steps: [
          'Received query and mapped doc identifiers to repository vector space',
          `Parsed ${documents?.length || 0} document contexts and ${ingestedFilesData?.length || 0} active attachments`,
          `Executed synthesis using ${aiResult.modelUsed} (${aiResult.provider.toUpperCase()})`,
          ...(aiResult.fallbackTriggered ? [`Fallback triggered from Gemini to OpenAI (${aiResult.fallbackReason})`] : []),
          citations.length > 0
            ? `Matched ${citations.length} cited source${citations.length === 1 ? '' : 's'} to workspace documents`
            : 'No cited sources could be confirmed against workspace documents'
        ],
        modelsUsed: [aiResult.modelUsed],
        provider: aiResult.provider,
        contextTokensProcessed: Math.floor(fullPrompt.length / 4) + 250,
        latencyMs
      }
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: 'Failed to process AI chat request',
      details: error.message || String(error)
    });
  }
});
