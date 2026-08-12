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
  reasoningSteps: Array<{
    step: number;
    description: string;
    findings?: string;
  }>;
  quantitativeData?: {
    metrics: Record<string, number | string>;
    trends: string[];
    calculations: string[];
  };
  confidence: 'high' | 'medium' | 'low';
  provider: string;
  fallbackTriggered: boolean;
  executionTimeMs: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<AnalysisResponse | { error: string; details?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'AI service is not configured',
      details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set'
    });
  }

  try {
    const startTime = Date.now();
    const body: AnalysisRequest = req.body;
    const { query, documents = [], analysisType = 'auto', includeReasoningSteps = true } = body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Build document context
    let docContext = '';
    if (documents && Array.isArray(documents) && documents.length > 0) {
      docContext = documents
        .map((doc, idx) => {
          const content = doc.fullText || doc.contentPreview || doc.summary || 'No content available.';
          return `[Document ${idx + 1}: ${doc.title}]\n${content}`;
        })
        .join('\n\n---\n\n');
    }

    // Determine analysis type from query patterns
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

    // Build system instruction based on analysis type
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
      model: 'gemini-2.5-flash',
      fallbackModel: 'gpt-4o',
      temperature: 0.2
    });

    // Extract reasoning steps from the response
    const reasoningSteps = buildReasoningSteps(
      aiResult.text,
      detectedType,
      includeReasoningSteps
    );

    // Extract quantitative data if applicable
    let quantitativeData = undefined;
    if (detectedType === 'quantitative') {
      quantitativeData = extractQuantitativeData(aiResult.text);
    }

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
    });
  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    return res.status(500).json({
      error: 'Analysis failed',
      details: error.message || String(error)
    });
  }
}

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
      steps.push({
        step: stepCount++,
        description: 'Extract numerical data from documents',
        findings: extractSection(responseText, 'Key Findings')
      });
    }
    if (responseText.includes('Trend Analysis')) {
      steps.push({
        step: stepCount++,
        description: 'Analyze patterns and trends',
        findings: extractSection(responseText, 'Trend Analysis')
      });
    }
    if (responseText.includes('Calculations')) {
      steps.push({
        step: stepCount++,
        description: 'Perform calculations and derive values',
        findings: extractSection(responseText, 'Calculations')
      });
    }
  } else if (type === 'reasoning') {
    if (responseText.includes('Core Evidence')) {
      steps.push({
        step: stepCount++,
        description: 'Identify key evidence and facts',
        findings: extractSection(responseText, 'Core Evidence')
      });
    }
    if (responseText.includes('Logical Chain')) {
      steps.push({
        step: stepCount++,
        description: 'Build chain of logical reasoning',
        findings: extractSection(responseText, 'Logical Chain')
      });
    }
    if (responseText.includes('Implications')) {
      steps.push({
        step: stepCount++,
        description: 'Derive implications and consequences',
        findings: extractSection(responseText, 'Implications')
      });
    }
  } else {
    steps.push({
      step: 1,
      description: 'Answer question with evidence',
      findings: responseText.substring(0, 300)
    });
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

  // Extract numbers and percentages
  const numberMatches = responseText.match(/(\d+(?:\.\d+)?)\s*(%|billion|million|thousand|dollars?|usd)/gi) || [];
  numberMatches.forEach((match, idx) => {
    metrics[`metric_${idx + 1}`] = match;
  });

  // Extract trend indicators
  const trendMatches = responseText.match(/(increasing|decreasing|rising|falling|growing|declining|trending|up|down)/gi) || [];
  trendMatches.forEach((match) => {
    if (!trends.includes(match.toLowerCase())) {
      trends.push(match.toLowerCase());
    }
  });

  // Extract calculation results
  const calcMatches = responseText.match(/(?:total|sum|average|mean|result|equals?|is).*?(\d+(?:\.\d+)?)/gi) || [];
  calcMatches.forEach((match) => {
    calculations.push(match);
  });

  return { metrics, trends, calculations };
}

function assessConfidence(responseText: string, type: string): 'high' | 'medium' | 'low' {
  const uncertaintyKeywords = ['might', 'may', 'unclear', 'uncertain', 'unknown', 'estimate', 'approximate'];
  const uncertaintyCount = uncertaintyKeywords.filter(keyword =>
    responseText.toLowerCase().includes(keyword)
  ).length;

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
