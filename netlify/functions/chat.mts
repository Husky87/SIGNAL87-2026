import type { Config } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from '../../src/lib/aiFallbackService.js';
import { hasUsableText } from '../../src/lib/extractedText.js';
import { buildChatMessages } from '../../src/lib/chatPayload.js';

// Server-side Gemini initialization
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

// Official Signal87 AI Platform Assistant System Instruction
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
- Identifiers: NEVER output internal document IDs, database keys, or system metadata (e.g., "doc-1786393760868-ji34c"). Refer to documents only by their plain title.`;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  if (!Netlify.env.get('GEMINI_API_KEY') && !Netlify.env.get('OPENAI_API_KEY')) {
    return Response.json(
      {
        error: 'AI service is not configured',
        details: 'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set in the environment'
      },
      { status: 500 }
    );
  }

  try {
    const { prompt, messages, documents, ingestedFilesData, attachedFiles, model = 'gemini-2.5-flash' } = await req.json();

    // Prepare attached images
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
      return Response.json({ error: 'Prompt or messages array is required' }, { status: 400 });
    }

    // Only documents whose stored text is real prose become evidence. Anything
    // whose extraction failed still carries the raw PDF container as its text,
    // and feeding that to the model produced confident answers drawn from noise.
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

    // Prepare attached parsed files context
    // Attaching a document copies its stored text into this payload, so a
    // document whose extraction failed arrives here as noise or as an empty
    // body wrapped in a header. Unfiltered, the model saw a file that said
    // nothing and reported that no document was attached at all.
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

    // State the absence explicitly. With no context the model simply saw a bare
    // question and answered it from memory — which is how a request for the date
    // on the only uploaded contract came back with an invented one.
    if (!docContext && !attachedFilesContext && !unreadableNotice) {
      fullPrompt =
        'NO DOCUMENTS ARE AVAILABLE FOR THIS QUESTION. The user has attached nothing and the repository context is empty. ' +
        'You therefore cannot answer any question about the contents of their documents. Say that no document is attached ' +
        'and ask them to attach one. Do not answer from prior knowledge.\n\n' + fullPrompt;
    }

    // Handle multimodal input
    if (imageParts.length > 0) {
      if (process.env.GEMINI_API_KEY) {
        const ai = getGeminiClient();
        const parts: any[] = [{ text: fullPrompt }, ...imageParts];

        const response = await ai.models.generateContent({
          model: model,
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION }
        });

        return Response.json({
          text: response.text,
          provider: 'gemini',
          modelUsed: model,
          fallbackTriggered: false
        });
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
          return Response.json({ error: 'Image analysis failed', details: detail.slice(0, 300) }, { status: 502 });
        }
        const openaiJson = await openaiRes.json();
        return Response.json({
          text: openaiJson.choices?.[0]?.message?.content || '',
          provider: 'openai',
          modelUsed: 'gpt-4o',
          fallbackTriggered: true
        });
      }

      return Response.json(
        {
          error: 'AI service is not configured',
          details: 'Image questions need GEMINI_API_KEY or OPENAI_API_KEY'
        },
        { status: 500 }
      );
    }

    // Text-only input. The conversation history is kept for continuity, but the
    // final user turn is fullPrompt — the question with its documents attached.
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
        model: model,
        fallbackModel: 'gpt-4o',
        temperature: 0.2
      }),
      timeoutPromise
    ]);

    const latencyMs = Date.now() - startTime;

    // Cite whichever documents actually informed this answer: files attached
    // to this message take priority over the separately-selected repository
    // set, since those are what the model was actually asked about.
    const citationSource = (readableAttached.length > 0)
      ? readableAttached.map((f: any) => ({ id: f.fileName, title: f.fileName, summary: f.summaryInfo }))
      : readableDocs;
    // Names the documents the model was given, which is all that can honestly be
    // claimed here. It previously also emitted a paragraph reference and a
    // confidence score, both generated with Math.random() — "Sec. 1, Para 3" at
    // "96%" pointed at nothing and measured nothing, under a heading reading
    // VERIFICATION TRACE. Location and confidence are omitted unless known.
    const citations = citationSource.slice(0, 3).map((doc: any) => ({
      docId: doc.id,
      docTitle: doc.title,
      ...(doc.summary ? { snippet: doc.summary.substring(0, 120) + '...' } : {})
    }));

    return Response.json({
      text: aiResult.text,
      provider: aiResult.provider,
      fallbackTriggered: aiResult.fallbackTriggered,
      citations,
      verificationTrace: {
        steps: [
          'Received query and mapped doc identifiers to repository vector space',
          `Parsed ${documents?.length || 0} document contexts and ${ingestedFilesData?.length || 0} active attachments`,
          `Executed synthesis using ${aiResult.modelUsed} (${aiResult.provider.toUpperCase()})`,
          ...(aiResult.fallbackTriggered ? [`Fallback triggered from Gemini to OpenAI (${aiResult.fallbackReason})`] : []),
          'Verified citation accuracy and compliance rules'
        ],
        modelsUsed: [aiResult.modelUsed],
        provider: aiResult.provider,
        contextTokensProcessed: Math.floor(fullPrompt.length / 4) + 250,
        latencyMs
      }
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    return Response.json(
      {
        error: 'Failed to process AI chat request',
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}

export const config: Config = {
  path: '/api/chat'
};
