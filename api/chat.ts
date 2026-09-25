import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithFallback } from '../src/lib/aiFallbackService.js';
import { hasUsableText } from '../src/lib/extractedText.js';
import { buildChatMessages } from '../src/lib/chatPayload.js';
import { verifyFirebaseIdToken } from '../src/lib/firebaseAuth.js';
import { buildWorkspaceIndex, isQuickLookup, renderDocuments, retrieveContext, RetrievalGroup, RetrievalStats } from '../src/lib/retrieval.js';
import { attributeSources } from '../src/lib/sourceAttribution.js';
import { applyCitations, CitedDoc, extractCitationManifest } from '../src/lib/citations.js';

const MAX_DOC_CHARS = 28000;
const MAX_TOTAL_CONTEXT_CHARS = 90000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 12000;
const DEFAULT_CHAT_MODEL = 'gpt-4o';
const MIN_DOC_BUDGET_CHARS = 20000;
const CHAT_TEMPERATURE = 0.4;

/** "DOCUMENT 2" / "INGESTED ACTIVE FILE 1" → the document it names in this request. */
function makeSourceResolver(contextDocs: any[], readableAttached: any[]) {
  return (source: string): CitedDoc | null => {
    const docMatch = source.match(/^DOCUMENT\s+(\d+)$/i);
    const attachedMatch = source.match(/^INGESTED ACTIVE FILE\s+(\d+)$/i);
    let doc: any = null;
    if (docMatch) doc = contextDocs[parseInt(docMatch[1], 10) - 1] || null;
    if (attachedMatch) { const file = readableAttached[parseInt(attachedMatch[1], 10) - 1]; if (file) doc = { id: file.fileName, title: file.fileName, summary: file.summaryInfo }; }
    if (!doc) return null;
    const key = String(doc.id || doc.title);
    return { docId: key, docTitle: String(doc.title || key), ...(doc.summary ? { snippet: String(doc.summary).slice(0, 120) + '...' } : {}) };
  };
}
function compactText(value: unknown, maxChars: number): string { const text = String(value || '').trim(); return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[Context truncated for latency. Use only the supplied portion.]`; }
interface ContextOptions {
  readableDocs: any[];
  readableAttached: any[];
  unreadableDocs: any[];
  unreadableAttached: any[];
  question: string;
  previousQuestions: string[];
  profile: { name?: string; email?: string };
  /** Passages already ranked by the app (larger workspaces). When present, used instead of server-side retrieval. */
  retrieved?: unknown;
}

const MAX_RETRIEVED_GROUPS = 40;
const MAX_RETRIEVED_CHARS = 100000;

/** Validates and bounds passages ranked in the browser, so a bad or oversized payload can't blow up the prompt. */
function readRetrievedPayload(value: unknown): { groups: RetrievalGroup[]; stats: RetrievalStats; workspaceFiles: string[]; unreadableFiles: string[] } | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as any;
  if (!Array.isArray(v.groups)) return null;
  let used = 0;
  const groups: RetrievalGroup[] = [];
  for (const g of v.groups.slice(0, MAX_RETRIEVED_GROUPS)) {
    if (!g || !Array.isArray(g.passages)) continue;
    const passages: Array<{ index: number; text: string }> = [];
    for (const p of g.passages) {
      const text = String(p?.text || '');
      if (!text || used + text.length > MAX_RETRIEVED_CHARS) continue;
      used += text.length;
      passages.push({ index: Math.max(0, Number(p.index) || 0), text });
    }
    if (passages.length === 0) continue;
    const title = String(g.title || 'Untitled').slice(0, 300);
    const str = (x: unknown, max: number) => (typeof x === 'string' && x ? x.slice(0, max) : undefined);
    const versionCount = Number(g.versionCount) > 1 ? Math.min(99, Math.floor(Number(g.versionCount))) : undefined;
    groups.push({
      doc: { id: String(g.id || title).slice(0, 200), title, uploadDate: str(g.uploadDate, 40), fullText: passages.map((p) => p.text).join('\n\n') },
      passages,
      total: Math.max(passages.length, Number(g.total) || passages.length),
      versionCount,
      olderVersionOf: str(g.olderVersionOf, 300),
      familyId: str(g.familyId, 200)
    });
  }
  const s = v.stats || {};
  const num = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
  const stats: RetrievalStats = {
    mode: s.mode === 'overview' ? 'overview' : groups.length ? 'search' : 'empty',
    semantic: Boolean(s.semantic),
    searchedDocuments: num(s.searchedDocuments),
    searchedPassages: num(s.searchedPassages),
    usedDocuments: groups.length,
    usedPassages: groups.reduce((n, g) => n + g.passages.length, 0)
  };
  const list = (x: unknown) => (Array.isArray(x) ? x.slice(0, 1000).map((t) => String(t).slice(0, 200)) : []);
  return { groups, stats, workspaceFiles: list(v.workspaceFiles), unreadableFiles: list(v.unreadableFiles).slice(0, 100) };
}

/**
 * Builds the grounded context. Attached files are always included (the user
 * attached them on purpose). Repository documents go through retrieval: all of
 * them when they fit, otherwise the best-matching passages from every file.
 */
function buildGroundedContext(options: ContextOptions): { text: string; contextDocs: any[]; groups: RetrievalGroup[]; stats: RetrievalStats } {
  const { readableDocs, readableAttached, unreadableDocs, unreadableAttached } = options;
  let attachedUsed = 0;
  const attachedBlocks = readableAttached.map((file: any, i: number) => {
    if (attachedUsed >= MAX_TOTAL_CONTEXT_CHARS - MIN_DOC_BUDGET_CHARS) return '';
    const remaining = Math.min(MAX_DOC_CHARS, MAX_TOTAL_CONTEXT_CHARS - MIN_DOC_BUDGET_CHARS - attachedUsed);
    const body = compactText(file.extractedText, remaining);
    attachedUsed += body.length;
    return `=== INGESTED ACTIVE FILE ${i + 1}: ${file.fileName} ===\n${body}\n=== END FILE ===`;
  }).filter(Boolean);

  const preRanked = readRetrievedPayload(options.retrieved);
  const retrieval = preRanked
    ? {
        text: renderDocuments(preRanked.groups, true),
        workspaceIndex: buildWorkspaceIndex(preRanked.workspaceFiles.map((title) => ({ title }))),
        contextDocs: preRanked.groups.map((g) => g.doc),
        groups: preRanked.groups,
        stats: preRanked.stats
      }
    : retrieveContext(readableDocs, {
        question: options.question,
        previousQuestions: options.previousQuestions,
        profile: options.profile,
        budgetChars: Math.max(MIN_DOC_BUDGET_CHARS, MAX_TOTAL_CONTEXT_CHARS - attachedUsed),
        maxDocChars: MAX_DOC_CHARS
      });
  const unreadableNames = [...unreadableDocs.map((d: any) => d.title), ...(preRanked?.unreadableFiles || [])];

  const sections: string[] = [];
  if (retrieval.text) sections.push(retrieval.text);
  if (attachedBlocks.length) sections.push(`ACTIVE ATTACHED FILES:\n${attachedBlocks.join('\n\n')}`);
  if (retrieval.workspaceIndex) sections.push(retrieval.workspaceIndex);
  if (unreadableNames.length || unreadableAttached.length) {
    const names = [...unreadableNames, ...unreadableAttached.map((f: any) => f.fileName)];
    sections.push(`UNREADABLE FILES — these files COULD NOT BE READ (parsing failed or no extractable text was found) and their contents are unavailable. Tell the user each file listed below could not be read; do not answer questions about them:\n${names.map((n) => `- ${n}`).join('\n')}`);
  }
  return { text: sections.join('\n\n'), contextDocs: retrieval.contextDocs, groups: retrieval.groups, stats: retrieval.stats };
}

const MAX_MEMORIES = 60;

/** Saved facts the user asked Signal87 to remember, plus any remember/forget that just happened. */
function buildMemorySection(memories: unknown, memoryEvent: unknown): string {
  const facts = (Array.isArray(memories) ? memories : [])
    .map((m) => String(m ?? '').replace(/\s+/g, ' ').trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, MAX_MEMORIES);
  let section = '';
  if (facts.length) {
    section += `\n\nSAVED MEMORY\nFacts the user asked you to remember. Treat them as true unless their files contradict them (then point out the conflict). When you rely on one, say it's from their saved memory; don't cite a file for it.\n${facts.map((f) => `- ${f}`).join('\n')}`;
  }
  const e = memoryEvent && typeof memoryEvent === 'object' ? memoryEvent as { type?: string; text?: string } : null;
  const text = String(e?.text || '').slice(0, 300);
  if (e?.type === 'saved') section += `\n\nJUST NOW: the user asked you to remember "${text}". It has been saved to their memory. Confirm in one short, natural sentence, then answer anything else they asked.`;
  else if (e?.type === 'forgotten') section += `\n\nJUST NOW: "${text}" was removed from the user's saved memory at their request. Confirm in one short sentence.`;
  else if (e?.type === 'not-found') section += `\n\nJUST NOW: the user asked you to forget or remember something, but it could not be done (${text}). Say so briefly and mention they can manage memory in Settings → Memory.`;
  return section;
}

/** Direct style (Settings → Answer preferences) replaces the conversational tone guidance. */
function buildStyleSection(answerStyle: unknown, quickLookup: boolean): string {
  let section = '';
  if (answerStyle === 'direct') {
    section += `\n\nSTYLE: DIRECT (overrides any tone guidance above)\n- No greetings, pleasantries, first names, or follow-up offers.\n- Lead with the facts. Use short bullets when there are several.\n- Answer only what was asked; keep general-knowledge additions to one line, labelled.`;
  }
  if (quickLookup) {
    section += `\n\nQUICK LOOKUP\nThis is a quick lookup of a single fact (someone filling in a form).\n- First line: just the value and the file it came from, e.g. "March 14, 1980 (from Smith_Application.pdf)".\n- Then at most one short sentence, only if needed: a different value in another file or version, or a note that the value is missing.\n- If it isn't in the files, say so in one sentence and name the file most likely to hold it. Never guess a value.\n- No follow-up offer.`;
  }
  return section;
}

function buildUserSection(profile: { name?: string; email?: string; preferredName?: string; jobTitle?: string; role?: string; company?: string; industry?: string }): string {
  const name = profile.name?.trim();
  const email = profile.email?.trim();
  if (!name && !email) return '';
  const who = name ? `${name}${email ? ` (${email})` : ''}` : email;
  const firstName = profile.preferredName?.trim() || (name ? name.split(/\s+/)[0] : '');
  const work = [profile.jobTitle, profile.role && profile.role !== profile.jobTitle ? profile.role : '', profile.company ? `at ${profile.company}` : '', profile.industry ? `(${profile.industry})` : '']
    .filter(Boolean).join(' ');
  return `\n\nABOUT THE USER\n- You are talking with ${who}, the signed-in owner of this workspace. "I", "me", "my" and "our" refer to them and their organization.\n- When they ask about themselves, look for their name in the documents like any other person.${work ? `\n- Their work: ${work}. Use it to pitch answers at the right level and pick relevant examples; don't restate it back to them.` : ''}${firstName ? `\n- Address them by first name (${firstName}) now and then, not in every reply.` : ''}`;
}

const SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION = `You are Signal87, an AI analyst that works across the user's own files: contracts, filings, loan documents, spreadsheets, memos and notes. Talk like a sharp, friendly colleague who has read everything: plain English, natural sentences, no stiff boilerplate.

HOW TO ANSWER
- Lead with the answer in one or two sentences, then give the supporting detail.
- Keep length proportional. A quick lookup gets a short reply; analysis can be longer, using short headings or bullets only when they genuinely help.
- When it would help, end with one short, specific next step or offer (for example: "Want me to compare this with the Northwind lease?"). Do not add one to every reply.

YOUR FILES FIRST, BUT NOT ONLY YOUR FILES
- Anything about the user's own documents, people, companies, deals, amounts, dates and clauses must come from the supplied text and be cited. Never invent those specifics, and never invent page numbers, section references or confidence scores.
- Beyond that, be genuinely useful: add general knowledge, market context, definitions, analysis and recommendations. Keep it clear which parts come from their files (cited) and which are your own knowledge or judgment, for example "From your files: …" and "More broadly: …", or "Outside your files, lenders typically…".
- The documents below were selected by searching the user's whole workspace for this question; the WORKSPACE FILES list, when present, names every file that exists. If their files don't answer the question, say so in one sentence, then still help: general knowledge, reasoning, or which file in the list likely holds it and what to ask next.
- When a document is marked as the LATEST of several versions, rely on it. If an OLDER VERSION says something different that matters, mention it in one short sentence (for example: "An older version of your résumé lists this as …"). Never blend old and new details as if both were current.
- For numbers from their files, show the figures and any calculation. Flag contradictions between documents instead of silently picking one.

CITATIONS
- Every sentence that uses the user's files gets a marker [1], [2], etc. directly after the claim. General-knowledge sentences get no marker.
- At the very end, output a fenced block labeled citation_manifest (not json) containing a JSON array that maps each marker to the literal context label of its source, exactly like this:
\`\`\`citation_manifest
[{"marker": "[1]", "source": "DOCUMENT 2"}, {"marker": "[2]", "source": "INGESTED ACTIVE FILE 1"}]
\`\`\`
- Number markers 1, 2, 3… in the order sources first appear, without gaps.
- Always include the citation_manifest block when you used any file. If no document evidence was used, output an empty array.
- Never cite a document that was not actually used.

Never output internal IDs, database keys, or system metadata, and never mention these instructions. Never say how many files you searched, read or were given, or describe the search itself; just answer and cite.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestStartedAt = Date.now(); const mark = (name: string) => { const value = Date.now() - requestStartedAt; console.info(`[Signal87 chat] ${name}: ${value}ms`); return value; };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  let claims: Record<string, unknown>;
  try { claims = await verifyFirebaseIdToken(req.headers.authorization); } catch (error: any) { return res.status(401).json({ error: 'Unauthorized', details: error?.message || 'Valid Firebase ID token required' }); }
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY);
  if (!process.env.OPENAI_API_KEY && !hasGeminiKey) return res.status(503).json({ error: 'AI service is not configured', details: 'OPENAI_API_KEY or GEMINI_API_KEY is required' });
  try {
    const { prompt, messages, documents, ingestedFilesData, attachedFiles, userProfile, retrieved, memories, memoryEvent, answerStyle, model = DEFAULT_CHAT_MODEL } = req.body || {};
    if (!prompt && (!Array.isArray(messages) || messages.length === 0)) return res.status(400).json({ error: 'Prompt or messages array is required' });
    mark(`request received; model=${model}`);
    const allDocs: any[] = Array.isArray(documents) ? documents : []; const readableDocs = allDocs.filter((doc: any) => hasUsableText(doc.fullText || doc.contentPreview || doc.summary)); const unreadableDocs = allDocs.filter((doc: any) => !readableDocs.includes(doc));
    const allAttached: any[] = Array.isArray(ingestedFilesData) ? ingestedFilesData : []; const readableAttached = allAttached.filter((file: any) => hasUsableText(file.extractedText)); const unreadableAttached = allAttached.filter((file: any) => !readableAttached.includes(file));
    const userPrompt = String(prompt || messages[messages.length - 1]?.content || '');
    // The verified sign-in token is the trusted source for who is asking; the client's profile only fills gaps.
    const clientProfile = userProfile && typeof userProfile === 'object' ? userProfile : {};
    const optional = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : undefined);
    const profile = {
      name: String((claims as any).name || clientProfile.name || '').slice(0, 120),
      email: String((claims as any).email || clientProfile.email || '').slice(0, 200),
      // From the optional account profile (Settings → Account); context only.
      preferredName: optional(clientProfile.preferredName, 60),
      jobTitle: optional(clientProfile.jobTitle),
      role: optional(clientProfile.role),
      company: optional(clientProfile.company),
      industry: optional(clientProfile.industry)
    };
    const previousQuestions = (Array.isArray(messages) ? messages : [])
      .filter((m: any) => m && m.role === 'user' && typeof m.content === 'string')
      .map((m: any) => m.content)
      .filter((content: string) => content !== userPrompt)
      .slice(-3);
    const grounded = buildGroundedContext({ readableDocs, readableAttached, unreadableDocs, unreadableAttached, question: userPrompt, previousQuestions, profile, retrieved });
    const context = grounded.text || 'NO DOCUMENTS ARE AVAILABLE. If the question asks about document contents, say that no document is attached and ask the user to attach it. Do not answer from prior knowledge.';
    const contextDocs = grounded.contextDocs;
    const quickLookup = isQuickLookup(userPrompt);
    const systemInstruction = SIGNAL87_ASSISTANT_SYSTEM_INSTRUCTION + buildUserSection(profile) + buildMemorySection(memories, memoryEvent) + buildStyleSection(answerStyle, quickLookup);
    const boundedHistory = Array.isArray(messages) ? messages.slice(-MAX_HISTORY_MESSAGES).map((message: any) => ({ role: message.role, content: compactText(message.content, Math.floor(MAX_HISTORY_CHARS / MAX_HISTORY_MESSAGES)) })) : [];
    const groundedPrompt = `${context}\n\nUSER QUESTION:\n${userPrompt}`; const modelMessages = buildChatMessages({ systemInstruction, messages: boundedHistory, groundedPrompt }); mark(`context prepared; mode=${grounded.stats.mode} used=${grounded.stats.usedDocuments}/${grounded.stats.searchedDocuments} docs`);
    const imageData = (Array.isArray(attachedFiles) ? attachedFiles : []).filter((file: any) => typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:image/')).slice(0, 5);
    let aiResult: any;
    if (imageData.length === 0) {
      aiResult = await generateWithFallback({ model, fallbackModel: 'gemini-3.6-flash', messages: modelMessages, temperature: CHAT_TEMPERATURE, timeoutMs: 30000, maxOutputTokens: quickLookup ? 400 : 1400 });
    } else {
      const multimodalMessages: any[] = modelMessages.map((message) => ({ ...message })); const last = multimodalMessages[multimodalMessages.length - 1];
      last.content = [{ type: 'text', text: String(last.content || '') }, ...imageData.map((file: any) => ({ type: 'image_url', image_url: { url: file.dataUrl } }))];
      let text = ''; let provider: 'openai' | 'gemini' = 'openai'; let modelUsed = 'gpt-4o'; let fallbackTriggered = false; let fallbackReason: string | undefined;
      try {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
        const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-4o', messages: multimodalMessages, temperature: CHAT_TEMPERATURE, max_tokens: 1400, stream: false }) });
        if (!response.ok) throw new Error(`OpenAI vision call failed [HTTP ${response.status}]: ${await response.text().catch(() => '')}`); const data = await response.json(); text = data.choices?.[0]?.message?.content || ''; if (!text) throw new Error('OpenAI vision provider returned an empty response.');
      } catch (primaryError: any) {
        fallbackTriggered = true; fallbackReason = primaryError?.message || 'OpenAI vision unavailable'; const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY; if (!geminiKey) throw primaryError;
        const parts: any[] = [{ text: String(last.content?.[0]?.text || '') }, ...imageData.map((file: any) => { const match = String(file.dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/); return match ? { inlineData: { mimeType: match[1], data: match[2] } } : null; }).filter(Boolean)];
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemInstruction }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: CHAT_TEMPERATURE, maxOutputTokens: 1400 } }) });
        if (!geminiResponse.ok) throw new Error(`${fallbackReason}; Gemini vision call failed [HTTP ${geminiResponse.status}]: ${await geminiResponse.text().catch(() => '')}`); const geminiData = await geminiResponse.json(); text = geminiData.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''; if (!text) throw new Error(`${fallbackReason}; Gemini vision returned an empty response.`); provider = 'gemini'; modelUsed = 'gemini-3.6-flash';
      }
      aiResult = { text, provider, modelUsed, fallbackTriggered, fallbackReason };
    }
    const providerMs = mark('provider response complete'); const citationResult = extractCitationManifest(aiResult.text || '');
    // Tie markers to documents and renumber them in order, so [1] is the first source shown.
    // With a single readable source, markers without a manifest are unambiguous. Never guess among several.
    const resolveSource = makeSourceResolver(contextDocs, readableAttached);
    const onlySource = grounded.stats.searchedDocuments + readableAttached.length === 1
      ? resolveSource(contextDocs.length ? 'DOCUMENT 1' : 'INGESTED ACTIVE FILE 1')
      : null;
    const applied = applyCitations(citationResult.cleanedText, citationResult.entries, resolveSource, onlySource);
    let citations = applied.citations;
    const answerText = applied.text || citationResult.cleanedText;
    // The model sometimes answers from the files without citing them. Rather than show no
    // sources, find the documents that clearly contain the answer's details.
    let sources: Array<{ docId: string; docTitle: string; versions?: number }> = citations.map((c) => ({ docId: c.docId, docTitle: c.docTitle }));
    if (sources.length === 0 && contextDocs.length > 0) {
      sources = attributeSources(answerText || aiResult.text || '', contextDocs)
        .map((index) => contextDocs[index])
        .map((doc: any) => ({ docId: String(doc.id || doc.title), docTitle: String(doc.title || doc.id || 'Document') }));
    }
    // One chip per document family: versions collapse into their newest file ("· 5 versions").
    {
      const familyOf = new Map<string, { id: string; title: string; versions?: number }>();
      for (const g of grounded.groups || []) {
        const id = String(g.doc.id || g.doc.title || '');
        if (g.familyId) {
          const primaryGroup = (grounded.groups || []).find((x) => String(x.doc.id || x.doc.title || '') === g.familyId);
          familyOf.set(id, {
            id: g.familyId,
            title: String(primaryGroup?.doc.title || g.olderVersionOf || g.doc.title || id),
            versions: primaryGroup?.versionCount ?? g.versionCount
          });
        }
      }
      const seen = new Set<string>();
      sources = sources
        .map((src) => {
          const fam = familyOf.get(src.docId);
          return fam ? { docId: fam.id, docTitle: fam.title, ...(fam.versions && fam.versions > 1 ? { versions: fam.versions } : {}) } : src;
        })
        .filter((src) => (seen.has(src.docId) ? false : (seen.add(src.docId), true)));
    }
    const totalMs = mark('response complete');
    res.setHeader('X-Signal87-Total-Ms', String(totalMs)); res.setHeader('X-Signal87-Provider-Ms', String(providerMs));
    return res.json({ text: answerText || aiResult.text, citations, sources, provider: aiResult.provider, modelUsed: aiResult.modelUsed, fallbackTriggered: aiResult.fallbackTriggered, fallbackReason: aiResult.fallbackReason, latencyMs: totalMs, memoryEvent: memoryEvent && typeof memoryEvent === 'object' ? memoryEvent : undefined, retrieval: grounded.stats, verificationTrace: { quickLookup, semanticSearch: Boolean(grounded.stats.semantic), provider: aiResult.provider, model: aiResult.modelUsed, groundedDocuments: contextDocs.length, searchedDocuments: grounded.stats.searchedDocuments, retrievalMode: grounded.stats.mode, passagesUsed: grounded.stats.usedPassages, groundedAttachments: readableAttached.length, unreadableDocuments: unreadableDocs.length + unreadableAttached.length, latencyMs: totalMs } });
  } catch (error: any) { console.error('Error in /api/chat:', error); return res.status(500).json({ error: 'AI request failed', details: error?.message || String(error) }); }
}
