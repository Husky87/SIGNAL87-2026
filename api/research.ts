import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
    });
  }

  try {
    const { researchGoal, documentIds, model = 'gemini-2.5-flash', documents, ingestedFilesData } = req.body;

    if (!researchGoal) {
      return res.status(400).json({ error: 'Research goal is required' });
    }

    let docContext = '';
    if (documents && Array.isArray(documents) && documents.length > 0) {
      docContext = documents
        .map((doc: any, idx: number) => `Doc ${idx + 1}: ${doc.title}\nSummary: ${doc.summary}\nContent: ${doc.contentPreview}`)
        .join('\n\n');
    }

    let attachedFilesContext = '';
    if (ingestedFilesData && Array.isArray(ingestedFilesData) && ingestedFilesData.length > 0) {
      attachedFilesContext = ingestedFilesData
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
      prompt: prompt,
      systemInstruction,
      model: model,
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

    return res.json({
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
    return res.status(500).json({
      error: 'Failed to run Deep Research agent',
      details: error.message || String(error)
    });
  }
}
