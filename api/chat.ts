import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from '../src/lib/aiFallbackService';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || 'DUMMY_KEY'
  });
}

const SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION = `You are the official Signal87 AI Platform Assistant—an intelligent, efficient, and precise interactive co-pilot embedded within the Signal87 AI platform. Your purpose is to assist users with platform navigation, execute document processing tasks, provide instant answers, and guide them through core platform capabilities.`;

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
    const { 
      prompt, 
      messages, 
      documents, 
      ingestedFilesData, 
      attachedFiles, 
      model = 'gemini-2.5-flash' 
    } = req.body;

    // Normalize model string to ensure compatibility
    const activeModel = (model && model.includes('gemini')) ? model : 'gemini-2.5-flash';

    const imageParts: any[] = [];
    if (attachedFiles && Array.isArray(attachedFiles)) {
      for (const file of attachedFiles) {
        if (file.dataUrl && file.dataUrl.startsWith('data:image/')) {
          const [metadata, base64Data] = file.dataUrl.split(',');
          const mimeType = metadata.match(/data:(.*?);/)?.[1] || 'image/jpeg';
          imageParts.push({
            inlineData: {
              data: base64Data,
              mimeType
            }
          });
        }
      }
    }

    if (!prompt && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({ error: 'Prompt or messages array is required' });
    }

    let docContext = '';
    if (documents && Array.isArray(documents) && documents.length > 0) {
      docContext = documents
        .map((doc: any, index: number) => `--- REPOSITORY DOC ${index + 1}: ${doc.title} ---\nSummary: ${doc.summary || 'None'}\nExcerpt: ${doc.contentPreview || ''}\n`)
        .join('\n\n');
    }

    let attachedFilesContext = '';
    if (ingestedFilesData && Array.isArray(ingestedFilesData) && ingestedFilesData.length > 0) {
      attachedFilesContext = ingestedFilesData
        .map((f: any, idx: number) => `=== INGESTED ACTIVE FILE ${idx + 1}: ${f.fileName} ===\n${f.extractedText}`)
        .join('\n\n');
    }

    const userPrompt = prompt || (messages ? messages[messages.length - 1]?.content : '');

    let fullPrompt = userPrompt;
    if (attachedFilesContext) fullPrompt = `ATTACHED FILES:\n${attachedFilesContext}\n\n` + fullPrompt;
    if (docContext) fullPrompt = `KNOWLEDGE BASE:\n${docContext}\n\n` + fullPrompt;

    // Handle multimodal input directly through GoogleGenAI
    if (imageParts.length > 0) {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: activeModel,
        contents: [
          {
            role: 'user',
            parts: [{ text: fullPrompt }, ...imageParts]
          }
        ],
        config: { 
          systemInstruction: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION,
          temperature: 0.2
        }
      });

      return res.json({
        text: response.text,
        provider: 'gemini',
        modelUsed: activeModel,
        fallbackTriggered: false
      });
    }

    // Text-only route using fallback service
    const openAiPayloadMessages = messages && Array.isArray(messages) && messages.length > 0
      ? messages
      : [
          { role: 'system' as const, content: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION },
          { role: 'user' as const, content: fullPrompt }
        ];

    const startTime = Date.now();
    const aiResult = await generateWithFallback({
      messages: openAiPayloadMessages,
      systemInstruction: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION,
      model: activeModel,
      fallbackModel: 'gpt-4o',
      temperature: 0.2
    });

    return res.json({
      text: aiResult.text,
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered,
      verificationTrace: {
        steps: ['Executed text synthesis'],
        modelsUsed: [aiResult.modelUsed],
        provider: aiResult.provider,
        latencyMs: Date.now() - startTime
      }
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      error: 'Failed to process AI chat request',
      details: error.message || String(error)
    });
  }
}
