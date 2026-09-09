import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';

interface AnalysisRequest {
  query: string;
  documents?: Array<{
    id: string;
    title: string;
    fullText?: string;
    contentPreview?: string;
    summary?: string;
  }>;
  analysisType?: 'quantitative' | 'reasoning' | 'question' | 'auto';
  includeReasoningSteps?: boolean;
}

interface AnalysisResponse {
  answer: string;
  analysisType: string;
  reasoningSteps: Array<{ step: number; description: string; findings?: string }>;
  quantitativeData?: { metrics: Record<string, number | string>; trends: string[]; calculations: string[] };
  confidence: 'high' | 'medium' | 'low';
  provider: string;
  fallbackTriggered: boolean;
  executionTimeMs: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.OPENAI_API_KEY && !process.env.XAI_API_KEY) {
    return res.status(500).json({ error: 'AI service is not configured', details: 'OPENAI_API_KEY or XAI_API_KEY is required' });
  }

  try {
    const startTime = Date.now();
    const body: AnalysisRequest = req.body;
    const { query, documents = [], analysisType = 'auto', includeReasoningSteps = true } = body;

    if (!query?.trim()) return res.status(400).json({ error: 'Query is required' });

    const docContext = Array.isArray(documents) && documents.length > 0
      ? documents.map((doc, idx) => {
          const content = doc.fullText || doc.contentPreview || doc.summary || 'No content available.';
          return `[Document ${idx + 1}: ${doc.title}]\n${content}`;
        }).join('\n\n---\n\n')
      : '';

    let detectedType = analysisType;
    if (analysisType === 'auto') {
      const q = query.toLowerCase();
      detectedType = /^(how many|what (is|are) the|calculate|sum|average|total|percent|trend)/i.test(q)
        ? 'quantitative'
        : /why|explain|how does|what caused|reason/i.test(q) ? 'reasoning' : 'question';
    }

    const systemInstruction = detectedType === 'quantitative'
      ? `You are Signal87's Quantitative Analysis Engine. Extract numerical data from the supplied documents, perform calculations, identify trends, flag missing or ambiguous data, and show the calculation when you derive a result. Never invent a figure. If the supplied documents do not contain the requested information, say so.`
      : detectedType === 'reasoning'
        ? `You are Signal87's Logical Reasoning Engine. Ground every factual claim in the supplied documents. Distinguish fact, inference, and conclusion; identify contradictions and alternative interpretations; never invent missing evidence.`
        : `You are Signal87's Advanced Question-Answer Engine. Answer directly using only the supplied document evidence. If the documents do not contain the answer, say that clearly. Do not fill gaps from general knowledge or guess.`;

    const prompt = docContext
      ? `ANALYSIS QUERY: ${query}\n\nDOCUMENT REPOSITORY:\n${docContext}\n\nAnswer using only this document evidence.`
      : `NO DOCUMENTS WERE PROVIDED. Do not answer from general knowledge. Tell the user that no document is attached and ask them to attach the relevant document.\n\nUSER QUERY: ${query}`;

    const aiResult = await generateWithFallback({ prompt, systemInstruction, temperature: 0.2 });
    const reasoningSteps = buildReasoningSteps(aiResult.text, detectedType, includeReasoningSteps);
    const quantitativeData = detectedType === 'quantitative' ? extractQuantitativeData(aiResult.text) : undefined;
    const executionTimeMs = Date.now() - startTime;

    return res.json({
      answer: aiResult.text,
      analysisType: detectedType,
      reasoningSteps,
      quantitativeData,
      confidence: assessConfidence(aiResult.text, detectedType),
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered,
      executionTimeMs
    } satisfies AnalysisResponse);
  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    return res.status(500).json({ error: 'Analysis failed', details: error.message || String(error) });
  }
}

function buildReasoningSteps(responseText: string, type: string, includeSteps: boolean) {
  if (!includeSteps) return [];
  const steps: Array<{ step: number; description: string; findings?: string }> = [];
  let stepCount = 1;
  if (type === 'quantitative') {
    if (responseText.includes('Key Findings')) steps.push({ step: stepCount++, description: 'Extract numerical data from documents', findings: extractSection(responseText, 'Key Findings') });
    if (responseText.includes('Trend Analysis')) steps.push({ step: stepCount++, description: 'Analyze patterns and trends', findings: extractSection(responseText, 'Trend Analysis') });
    if (responseText.includes('Calculations')) steps.push({ step: stepCount++, description: 'Perform calculations and derive values', findings: extractSection(responseText, 'Calculations') });
  } else if (type === 'reasoning') {
    if (responseText.includes('Core Evidence')) steps.push({ step: stepCount++, description: 'Identify key evidence and facts', findings: extractSection(responseText, 'Core Evidence') });
    if (responseText.includes('Logical Chain')) steps.push({ step: stepCount++, description: 'Build chain of logical reasoning', findings: extractSection(responseText, 'Logical Chain') });
    if (responseText.includes('Implications')) steps.push({ step: stepCount++, description: 'Derive implications and consequences', findings: extractSection(responseText, 'Implications') });
  } else {
    steps.push({ step: 1, description: 'Answer question with evidence', findings: responseText.substring(0, 300) });
  }
  return steps.length ? steps : [{ step: 1, description: 'Analysis complete', findings: responseText.substring(0, 200) }];
}

function extractQuantitativeData(responseText: string) {
  const metrics: Record<string, number | string> = {};
  const trends: string[] = [];
  const calculations: string[] = [];
  const numberMatches = responseText.match(/(\d+(?:\.\d+)?)\s*(%|billion|million|thousand|dollars?|usd)/gi) || [];
  numberMatches.forEach((match, idx) => { metrics[`metric_${idx + 1}`] = match; });
  const trendMatches = responseText.match(/(increasing|decreasing|rising|falling|growing|declining|trending|up|down)/gi) || [];
  trendMatches.forEach((match) => { if (!trends.includes(match.toLowerCase())) trends.push(match.toLowerCase()); });
  const calcMatches = responseText.match(/(?:total|sum|average|mean|result|equals?|is).*?(\d+(?:\.\d+)?)/gi) || [];
  calcMatches.forEach((match) => calculations.push(match));
  return { metrics, trends, calculations };
}

function assessConfidence(responseText: string, type: string): 'high' | 'medium' | 'low' {
  const uncertaintyCount = ['might', 'may', 'unclear', 'uncertain', 'unknown', 'estimate', 'approximate'].filter(k => responseText.toLowerCase().includes(k)).length;
  const uncertaintyRatio = uncertaintyCount / Math.max(responseText.length / 100, 1);
  if (type === 'quantitative') return uncertaintyRatio > 0.5 ? 'low' : uncertaintyRatio > 0.2 ? 'medium' : 'high';
  if (type === 'reasoning') return uncertaintyRatio > 0.8 ? 'low' : uncertaintyRatio > 0.3 ? 'medium' : 'high';
  return 'medium';
}

function extractSection(responseText: string, sectionName: string): string {
  const regex = new RegExp(`##\\s*${sectionName}[^]*?(?=##|$)`, 'i');
  const match = responseText.match(regex);
  return match ? match[0].replace(new RegExp(`##\\s*${sectionName}`, 'i'), '').trim().substring(0, 300) : '';
}
