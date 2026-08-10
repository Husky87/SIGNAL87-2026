import { generateWithFallback } from '../src/lib/aiFallbackService';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { messages, prompt, systemInstruction, model, fallbackModel, temperature, responseMimeType, responseSchema } = req.body || {};

    const aiResponse = await generateWithFallback({
      messages,
      prompt,
      systemInstruction,
      model,
      fallbackModel,
      temperature,
      responseMimeType,
      responseSchema,
    });

    return res.status(200).json(aiResponse);
  } catch (error: any) {
    console.error('API /chat error:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error during AI chat generation',
    });
  }
}
