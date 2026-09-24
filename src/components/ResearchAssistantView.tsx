import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  ArrowUp,
  Sparkles,
  CheckCircle2,
  Terminal,
  Cpu,
  Trash2,
  Database,
  Bot,
  Layers,
  FileText,
  Search,
  Check,
  Zap,
  Globe,
  CornerDownRight,
  Mic,
  MicOff,
  Copy,
  Download,
  Share2,
  Columns,
  Maximize2,
  Minimize2,
  UploadCloud,
  FileSpreadsheet,
  GitFork,
  BarChart3,
  ShieldCheck,
  Paperclip,
  X,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Clock,
  Loader2,
  Menu,
  LogIn,
  LogOut,
  User as UserIcon,
  FolderOpen,
  FileSearch,
  Clock3
} from 'lucide-react';
import { useAutosizeTextarea } from '../lib/useAutosizeTextarea';
import { User } from '../lib/firebase';
import { DocumentItem, ChatMessage, Citation } from '../types';
import { saveChatMessageToFirestore } from '../lib/firestoreService';
import { requestChat } from '../lib/chatClient';
import { prepareAsk } from '../lib/askContext';
import { getAnswerStyle } from '../lib/answerStyle';
import { ensureIndexed } from '../lib/semanticIndex';
import { Signal87Logo } from './Signal87Logo';
import { determineDeliverableType } from './ActionRouterComponents';
import { AssistantAnswer } from './AssistantAnswer';
import { parseFileContent, ParsedFileResult } from '../lib/fileParser';
import { AttachExistingDocumentModal } from './AttachExistingDocumentModal';

export interface ResearchAssistantViewProps {
  documents: DocumentItem[];
  attachedFiles: { id: string; name: string; size: string; dataUrl?: string }[];
  /** Limit Ask to these workspace files (from "Ask about this file"); nonce re-applies the same request. */
  scopeRequest?: { ids: string[]; nonce: number } | null;
  /** Recent conversations, shown on the empty Ask screen (Ask is the home screen). */
  recentSessions?: Array<{ id: string; title: string; timestamp: string }>;
  onOpenSession?: (id: string) => void;
  /** Opens Files in "choose files to ask about" mode (falls back to the picker dialog when not provided). */
  onChooseFiles?: (currentIds: string[]) => void;
  setAttachedFiles: React.Dispatch<React.SetStateAction<{ id: string; name: string; size: string; dataUrl?: string }[]>>;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onOpenUpload?: () => void;
  onUploadSuccess?: (doc: DocumentItem, parsedFile?: ParsedFileResult) => void;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeSessionId?: string | null;
  currentUser?: User | null;
  onOpenMobileMenu?: () => void;
  onGoogleSignIn?: () => void;
  /** Opens a file in the viewer; from an answer's sources, with its search pre-filled. */
  onSelectDocument?: (doc: DocumentItem, options?: { search?: string }) => void;
  onSaveAnswer?: (msg: ChatMessage, question: string) => void;
  savedAnswerIds?: Set<string>;
  initialQuery?: string | null;
  onInitialQueryConsumed?: () => void;
}

const parseInlineStyles = (text: string) => {
  const clean = text.replace(/#+/g, '');
  const parts = clean.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--rule)] px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-[var(--ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-[var(--ink-2)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
};

const renderFormattedText = (rawText: string) => {
  if (!rawText) return null;

  const lines = rawText.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];

  const flushTable = (key: string) => {
    if (tableRows.length === 0) return;

    const validRows = tableRows.filter((r) => !/^\|[\s\-:|]+\|$/.test(r.trim()));
    if (validRows.length > 0) {
      const headerRow = validRows[0];
      const bodyRows = validRows.slice(1);

      const headerCols = headerRow
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      elements.push(
        <div key={key} className="overflow-x-auto my-3 border border-[var(--rule)] rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--rule)] text-[var(--ink)] font-bold">
                {headerCols.map((col, cIdx) => (
                  <th key={cIdx} className="p-2.5">
                    {parseInlineStyles(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] bg-[var(--surface)]">
              {bodyRows.map((rowStr, rIdx) => {
                const cols = rowStr
                  .split('|')
                  .slice(1, -1)
                  .map((c) => c.trim());
                return (
                  <tr key={rIdx} className="hover:bg-[var(--surface-2)] transition-colors">
                    {cols.map((col, cIdx) => (
                      <td key={cIdx} className="p-2.5 text-[var(--ink-2)]">
                        {parseInlineStyles(col)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    tableRows = [];
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableRows.push(trimmed);
      return;
    } else {
      flushTable(`table-${lineIdx}`);
    }

    if (!trimmed) return;

    const isHashHeader = /^#+\s*/.test(trimmed);
    if (isHashHeader) {
      const headerText = trimmed.replace(/^#+\s*/, '').replace(/[\*\_]/g, '');
      elements.push(
        <h3 key={lineIdx} className="font-bold text-[var(--ink)] text-sm sm:text-base tracking-tight pt-3 pb-1 border-b border-[var(--rule)]">
          {headerText}
        </h3>
      );
      return;
    }

    const bulletMatch = trimmed.match(/^[\*\-\+]\s+(.*)/);
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);

    if (bulletMatch) {
      const content = bulletMatch[1];
      elements.push(
        <div key={lineIdx} className="flex items-start gap-2.5 pl-1 my-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal)] mt-2 flex-shrink-0" />
          <div className="flex-1 text-[var(--ink-2)]">{parseInlineStyles(content)}</div>
        </div>
      );
      return;
    }

    if (numberedMatch) {
      const num = numberedMatch[1];
      const content = numberedMatch[2];
      elements.push(
        <div key={lineIdx} className="flex items-start gap-2.5 pl-1 my-1">
          <span className="font-bold text-[var(--ink)] text-xs font-mono mt-0.5 flex-shrink-0">{num}.</span>
          <div className="flex-1 text-[var(--ink-2)]">{parseInlineStyles(content)}</div>
        </div>
      );
      return;
    }

    elements.push(
      <p key={lineIdx} className="my-1.5 text-[var(--ink-2)] leading-relaxed">
        {parseInlineStyles(trimmed)}
      </p>
    );
  });

  flushTable('table-final');

  return (
    <div className="space-y-2 font-sans text-[13.5px] sm:text-sm leading-relaxed text-[var(--ink-2)] antialiased tracking-normal">
      {elements}
    </div>
  );
};

export const ResearchAssistantView: React.FC<ResearchAssistantViewProps> = ({
  documents,
  attachedFiles,
  scopeRequest,
  recentSessions = [],
  onOpenSession,
  onChooseFiles,
  setAttachedFiles,
  selectedModel,
  onChangeModel,
  onOpenUpload,
  onUploadSuccess,
  chatHistory,
  setChatHistory,
  currentUser,
  onOpenMobileMenu,
  onGoogleSignIn,
  onSelectDocument,
  onSaveAnswer,
  savedAnswerIds,
  initialQuery,
  onInitialQueryConsumed
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const composerInputRef = useAutosizeTextarea(inputQuery, 200, chatHistory.length === 0);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(documents.map((d) => d.id));
  const knownDocIdsRef = useRef<Set<string>>(new Set(documents.map((d) => d.id)));

  // Keep the meaning-based search index up to date in the background: new or
  // changed files are embedded once; everything else is already indexed.
  useEffect(() => {
    if (!currentUser || documents.length === 0) return;
    const timer = setTimeout(() => {
      void ensureIndexed(documents.map((d: any) => ({ id: d.id, title: d.title, summary: d.summary, fullText: d.fullText || d.contentPreview || d.summary })));
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentUser, documents]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ingestedFiles, setIngestedFiles] = useState<ParsedFileResult[]>([]);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const getModelLabel = (model: string) => {
    switch (model) {
      case 'gemini-3.5-flash-lite': return 'Signal87 Fast';
      case 'gemini-3.6-flash': return 'Signal87 Standard';
      case 'gemini-2.5-pro': return 'Signal87 Deep';
      default: return 'Signal87 Standard';
    }
  };

  const handleFileIngest = async (file: File, attachToChat: boolean = false) => {
    if (file.size === 0) {
      alert(`File "${file.name}" is empty and cannot be indexed.`);
      return;
    }
    setIsParsingFile(true);
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          if (attachToChat) {
            setAttachedFiles((prev) => [
              ...prev.filter((f) => f.name !== file.name),
              { id: `img-${Date.now()}`, name: file.name, size: `${(file.size / 1024).toFixed(1)} KB`, dataUrl }
            ]);
          }
          setIsParsingFile(false);
        };
        reader.onerror = () => {
          console.error('Failed to read image', file.name);
          setIsParsingFile(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const parsed = await parseFileContent(file);
      setIngestedFiles((prev) => [...prev.filter((f) => f.fileName !== parsed.fileName), parsed]);

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const docType = (['pdf', 'docx', 'xlsx', 'csv', 'pptx', 'txt'].includes(fileExt) ? fileExt : 'pdf') as any;

      const newDoc: DocumentItem & { fullText?: string } = {
        id: parsed.id,
        title: file.name,
        type: docType,
        sizeBytes: file.size,
        uploadDate: new Date().toLocaleDateString(),
        tags: ['Active Workspace', 'Ingested'],
        owner: 'ceo@signal87.ai',
        organization: 'Signal87',
        status: 'ready',
        aiIndexed: true,
        embeddingsComplete: true,
        versionHistory: [{ version: 1, updatedAt: new Date().toLocaleDateString(), updatedBy: 'User', changeNote: 'Uploaded via Workspace Canvas' }],
        permissions: 'Private',
        summary: `Active Ingested File (${parsed.summaryInfo})`,
        contentPreview: parsed.extractedText,
        fullText: parsed.extractedText,
        category: 'Research',
        projectIds: []
      };

      if (attachToChat) {
        setAttachedFiles((prev) => [
          ...prev.filter((f) => f.name !== file.name),
          { id: newDoc.id, name: file.name, size: parsed.summaryInfo }
        ]);
      }

      // Automatically select newly ingested file so AI queries include it
      setSelectedDocIds((prev) => Array.from(new Set([...prev, newDoc.id])));

      if (onUploadSuccess) {
        onUploadSuccess(newDoc as DocumentItem, parsed);
      }
      setIsParsingFile(false);
    } catch (err) {
      console.error('Error ingesting file:', err);
      setIsParsingFile(false);
    }
  };

  // Attach a document already in the workspace instead of re-uploading it —
  // feeds the same ingestedFiles/attachedFiles pipeline as a fresh upload.
  const handleToggleAttachExisting = (doc: DocumentItem & { fullText?: string }) => {
    const isAttached = attachedFiles.some((f) => f.id === doc.id);
    if (isAttached) {
      setAttachedFiles((prev) => prev.filter((f) => f.id !== doc.id));
      setIngestedFiles((prev) => prev.filter((f) => f.id !== doc.id));
      return;
    }

    const extractedText = doc.fullText || doc.contentPreview || doc.summary || '';
    const sizeLabel = doc.sizeBytes >= 1_000_000 ? `${(doc.sizeBytes / 1_000_000).toFixed(1)} MB` : `${(doc.sizeBytes / 1024).toFixed(1)} KB`;

    const parsed: ParsedFileResult = {
      id: doc.id,
      fileName: doc.title,
      fileSizeFormatted: sizeLabel,
      sizeBytes: doc.sizeBytes,
      fileType: (['pdf', 'docx', 'xlsx', 'csv', 'txt'].includes(doc.type) ? doc.type : 'other') as ParsedFileResult['fileType'],
      extractedText,
      charCount: extractedText.length,
      wordCount: extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0,
      summaryInfo: sizeLabel
    };

    setIngestedFiles((prev) => [...prev.filter((f) => f.id !== doc.id), parsed]);
    setAttachedFiles((prev) => [...prev.filter((f) => f.id !== doc.id), { id: doc.id, name: doc.title, size: sizeLabel }]);
    setSelectedDocIds((prev) => Array.from(new Set([...prev, doc.id])));
  };

  // Files chosen from the workspace scope the question: when any are attached, Ask
  // searches only those files (with full retrieval, so long files work), not the
  // whole workspace. Files uploaded just for this chat are still sent alongside.
  const workspaceIds = new Set(documents.map((d) => d.id));
  const scopedIds = attachedFiles.filter((f) => workspaceIds.has(f.id)).map((f) => f.id);
  const clearScope = () => {
    setAttachedFiles((prev) => prev.filter((f) => !workspaceIds.has(f.id)));
    setIngestedFiles((prev) => prev.filter((f) => !workspaceIds.has(f.id)));
  };

  // "Ask about this file" from the document viewer.
  useEffect(() => {
    if (!scopeRequest) return;
    if (!scopeRequest.ids.length) { clearScope(); return; }
    const wanted = documents.filter((d) => scopeRequest.ids.includes(d.id));
    if (!wanted.length) return;
    setAttachedFiles((prev) => prev.filter((f) => !workspaceIds.has(f.id) || scopeRequest.ids.includes(f.id)));
    setIngestedFiles((prev) => prev.filter((f) => !workspaceIds.has(f.id) || scopeRequest.ids.includes(f.id)));
    for (const doc of wanted) if (!attachedFiles.some((f) => f.id === doc.id)) handleToggleAttachExisting(doc as any);
    setTimeout(() => composerInputRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeRequest?.nonce]);


  // Split Screen Canvas State
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<{
    id: string;
    title: string;
    content: string;
    citations?: Citation[];
    timestamp: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Include documents in the question as they arrive.
   *
   * The selection was seeded once from `documents` in useState, but the library
   * loads asynchronously after sign-in, so at first render it is empty and the
   * seed captured nothing. Nothing re-synced it, so questions were sent with no
   * document context at all and the model answered from memory — asking for a
   * date in the only uploaded contract returned an invented one.
   *
   * Only ids never seen before are added, so deliberately deselecting a document
   * is not undone on the next render.
   */
  useEffect(() => {
    const fresh = documents.filter((d) => !knownDocIdsRef.current.has(d.id)).map((d) => d.id);
    documents.forEach((d) => knownDocIdsRef.current.add(d.id));
    if (fresh.length > 0) {
      setSelectedDocIds((prev) => Array.from(new Set([...prev, ...fresh])));
    }
  }, [documents]);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Speech Recognition Setup
  const toggleSpeechRecognition = () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputQuery(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsListening(false);
    }
  };

  // Session chat is owned by App (per activeSessionId). Do not replace it
  // with an unscoped Firestore dump.

  const isInitialLoadRef = useRef<boolean>(true);
  const prevHistoryLengthRef = useRef<number>(0);

  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (chatHistory.length > 0) {
        isInitialLoadRef.current = false;
        prevHistoryLengthRef.current = chatHistory.length;
      }
      return;
    }

    if (chatHistory.length > prevHistoryLengthRef.current || loading) {
      // block:'end' pins the marker to the bottom of the scroll container. The
      // default, 'start', aligns it to the top instead, which scrolls the last
      // message off-screen above the fold.
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevHistoryLengthRef.current = chatHistory.length;
  }, [chatHistory.length, loading]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      for (const file of files) {
        if (file.size === 0) continue;
        await handleFileIngest(file, true);
      }
    }
  };

  const sendingRef = useRef(false);
  const handleSendQuery = async (queryText?: string) => {
    const userMsgText = queryText || inputQuery;
    if (!userMsgText.trim() || sendingRef.current) return;
    sendingRef.current = true;

    if (!queryText) setInputQuery('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory((prev) => [...prev, userMsg]);
    saveChatMessageToFirestore(userMsg);
    setLoading(true);

    // A document can arrive from Firestore just before this effect has added
    // its id to selection. Include that newly seen document in the same turn;
    // preserve explicit deselection of ids that were already known.
    const activeDocs = scopedIds.length
      ? documents.filter((d) => scopedIds.includes(d.id))
      : documents.filter((d) =>
          selectedDocIds.includes(d.id) || !knownDocIdsRef.current.has(d.id)
        );

    const fullTextDocumentPayload = activeDocs.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      uploadDate: doc.uploadDate,
      summary: doc.summary,
      fullText: doc.fullText || doc.contentPreview || doc.summary
    }));

    // Scoped workspace files already go through retrieval above; don't send them twice.
    const ingestedFilesData = ingestedFiles.filter((f) => !scopedIds.includes(f.id)).map((f) => ({
      fileName: f.fileName,
      fileType: f.fileType,
      summaryInfo: f.summaryInfo,
      extractedText: f.extractedText
    }));

    try {
      if (!currentUser) throw new Error('Please sign in to send a message.');
      const priorTurns = [...chatHistory, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.text }));
      const profile = { name: currentUser.displayName || '', email: currentUser.email || '' };
      // Memory commands, then either the whole files (small workspaces) or the best
      // passages from every file, ranked by words and meaning (larger ones).
      const ask = await prepareAsk({
        question: userMsgText,
        docs: fullTextDocumentPayload,
        previousQuestions: priorTurns.filter((m) => m.role === 'user').map((m) => m.content).slice(0, -1),
        profile
      });
      const bodyPayload = {
        prompt: userMsgText,
        messages: priorTurns,
        documents: ask.documents,
        retrieved: ask.retrieved,
        memories: ask.memories,
        memoryEvent: ask.memoryEvent,
        // Who is asking, so "I", "me" and "my" resolve to the signed-in user.
        userProfile: profile,
        answerStyle: getAnswerStyle(),
        model: selectedModel,
        ingestedFilesData,
        attachedFiles
      };

      const data = await requestChat(bodyPayload, () => currentUser.getIdToken());

      let responseText = '';
      let reasoningSteps = data.reasoningSteps || [];

      responseText = data.text;

      let excelExportData = null;

      // Check for Excel export trigger
      try {
        const jsonMatch = responseText.match(/\{"excel_export":\s*\{[\s\S]*\}\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          excelExportData = parsed.excel_export;
          responseText = responseText.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {
        console.error('Failed to parse Excel export data', e);
      }

      if (excelExportData) {
        responseText += `\n\n*System Note: Excel export data "${excelExportData.filename}" is available for download.*`;
      }

      const routedDeliverableType = determineDeliverableType(userMsgText, responseText, false);

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: responseText,
        excelExportData: excelExportData || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliverableType: routedDeliverableType,
        // Only real citations. This previously synthesised one pointing at
        // "Sec 4, Para 2" with 96% confidence whenever the API returned none —
        // which is always, since /api/research has no citations field — so every
        // answer carried an invented source reference under a heading reading
        // VERIFICATION TRACE. The trace block is guarded on a non-empty array,
        // so it now simply does not render when there is nothing to cite.
        citations: data.citations,
        sources: data.sources,
        memoryEvent: data.memoryEvent || ask.memoryEvent,
        verificationTrace: data.verificationTrace,
        reasoningSteps: reasoningSteps,
        isDeepResearch: false
      };

      setChatHistory((prev) => [...prev, aiMsg]);
      saveChatMessageToFirestore(aiMsg);

      setActiveArtifact({
        id: aiMsg.id,
        title: userMsgText.slice(0, 45) + '...',
        content: responseText,
        citations: aiMsg.citations,
        timestamp: aiMsg.timestamp
      });

      setLoading(false);
    } catch (err) {
      console.error('Chat submit error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `Unable to answer: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliverableType: 'qa'
      };
      setChatHistory((prev) => [...prev, errorMsg]);
      setLoading(false);
    } finally {
      sendingRef.current = false;
    }
  };

  // A question asked from the home screen arrives here and sends itself.
  const consumedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialQuery) {
      consumedQueryRef.current = null;
      return;
    }
    if (consumedQueryRef.current === initialQuery) return;
    consumedQueryRef.current = initialQuery;
    handleSendQuery(initialQuery);
    if (onInitialQueryConsumed) onInitialQueryConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleExportPDF = (title: string, content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; }
            h1 { font-size: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            h2, h3 { font-size: 16px; margin-top: 20px; color: #1e293b; }
            p { font-size: 13px; margin: 8px 0; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; font-weight: bold; }
            .meta { font-size: 11px; color: #64748b; margin-bottom: 24px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Generated by Signal87 AI Platform • ${new Date().toLocaleString()}</div>
          <div>${content.replace(/\n/g, '<br/>')}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const suggestionCards = [
    { id: 'deadlines', icon: Clock, prompt: 'What compliance deadlines and notice windows are coming up across active agreements?' },
    { id: 'metrics', icon: BarChart3, prompt: 'Extract the key financial metrics from these documents' },
    { id: 'summary', icon: FileText, prompt: 'Draft an executive summary of the key findings across this corpus' },
    { id: 'compare', icon: Columns, prompt: 'Compare terms across two documents I select' }
  ];

  const isEmptyChat = chatHistory.length === 0;

  const composer = (
    <div className="w-full">
      {attachedFiles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-3">
          {scopedIds.length > 0 && (
            <span className="flex-shrink-0 text-[12px] font-medium text-[var(--muted)]">
              Only searching
            </span>
          )}
          {attachedFiles.map((f) => (
            <div
              key={f.id}
              className="pl-3 pr-2 min-h-[36px] bg-[var(--surface-2)] text-[var(--ink)] rounded-full text-[12px] font-medium flex items-center gap-2 flex-shrink-0 max-w-[210px]"
            >
              {f.dataUrl ? (
                <img src={f.dataUrl} alt={f.name} className="w-5 h-5 object-cover rounded-full" />
              ) : (
                <FileText size={13} className="text-[var(--muted)] flex-shrink-0" />
              )}
              <span className="truncate min-w-0 flex-1">{f.name}</span>
              <button
                onClick={() => {
                  setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id));
                  setIngestedFiles((prev) => prev.filter((item) => item.fileName !== f.name));
                }}
                aria-label={`Remove ${f.name}`}
                className="w-8 h-8 -mr-1 flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {scopedIds.length > 0 && (
            <button
              type="button"
              onClick={clearScope}
              className="flex-shrink-0 min-h-[36px] px-3 rounded-full text-[12px] font-medium text-[var(--teal)] hover:bg-[var(--raised)] cursor-pointer"
            >
              Search all files
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSendQuery();
          }}
          className="s87-field relative flex flex-col gap-2 p-3 sm:p-4 min-w-0"
        >
          <textarea
            ref={composerInputRef}
            aria-label="Ask Signal87"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="What would you like to know?"
            className="s87-composer-input w-full bg-transparent border-0 text-base leading-[1.5] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none resize-none min-h-[48px] max-h-[200px] px-1 py-1 font-sans caret-[var(--teal)]"
            rows={2}
          />

          <div className="s87-composer-toolbar flex items-center justify-between gap-2 border-t border-[var(--rule)] pt-2">
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              aria-label={showAttachMenu ? 'Close attach menu' : 'Add attachment'}
              aria-expanded={showAttachMenu}
              className="flex items-center justify-center gap-2 min-h-10 px-3 rounded-full bg-[var(--surface-2)] hover:bg-[var(--raised)] text-[var(--ink-2)] hover:text-[var(--ink)] text-sm transition-colors cursor-pointer"
            >
              {showAttachMenu ? <X size={16} /> : <Plus size={16} />}
              <span>Add documents</span>
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--surface-2)] border border-[var(--rule)] rounded-[12px] py-1.5 z-50 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    if (onChooseFiles) onChooseFiles(scopedIds); else setShowFilePicker(true);
                  }}
                  className="w-full flex items-center gap-2.5 text-left px-4 min-h-[44px] hover:bg-[var(--surface-2)] text-[13px] font-medium text-[var(--ink)] transition-colors cursor-pointer"
                >
                  <FolderOpen size={15} className="text-[var(--muted)]" />
                  <span>Choose from Files</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={isParsingFile}
                  className="w-full flex items-center gap-2.5 text-left px-4 min-h-[44px] hover:bg-[var(--surface-2)] text-[13px] font-medium text-[var(--ink)] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isParsingFile ? <Loader2 size={15} className="animate-spin text-[var(--muted)]" /> : <Paperclip size={15} className="text-[var(--muted)]" />}
                  <span>Upload Document</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setShowAttachMenu(false); if (onChooseFiles) onChooseFiles(scopedIds); else setShowFilePicker(true); }}
            aria-label={scopedIds.length ? `Searching ${scopedIds.length} selected file${scopedIds.length === 1 ? '' : 's'}. Change` : 'Choose files to search'}
            className={`flex items-center gap-2 min-h-10 px-3 rounded-full text-sm transition-colors cursor-pointer flex-shrink-0 ${
              scopedIds.length ? 'bg-[var(--teal-soft)] text-[var(--teal)] font-medium' : 'bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--raised)] hover:text-[var(--ink)]'
            }`}
          >
            <FileSearch size={16} />
            <span className="max-w-[180px] truncate">
              {scopedIds.length === 0
                ? 'All files'
                : scopedIds.length === 1
                  ? (documents.find((d) => d.id === scopedIds[0])?.title || '1 file')
                  : `${scopedIds.length} files`}
            </span>
          </button>
          <span className="flex-1" />

          <div className="flex items-center gap-3">
            <span className="s87-send-hint text-xs text-[var(--muted)]">Enter to send · Shift+Enter for a new line</span>
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            aria-label="Send"
            className={`flex-shrink-0 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              inputQuery.trim() && !loading
                ? 'bg-[var(--teal)] text-[var(--bg)] hover:opacity-90'
                : 'bg-[var(--surface-2)] text-[var(--muted)] cursor-not-allowed'
            }`}
            title="Send message"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2.6} />}
          </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="s87-ask relative flex flex-col bg-[var(--bg)] text-[var(--ink)] font-sans h-full flex-1 min-h-0 overflow-hidden select-none"
    >
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            for (const file of files) {
              if (file.size === 0) continue;
              await handleFileIngest(file, true);
            }
            e.target.value = '';
          }
        }}
      />

      {isDragging && (
        <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-md z-50 flex flex-col items-center justify-center text-[var(--ink)] border-2 border-dashed border-[color-mix(in_srgb,var(--teal)_40%,transparent)] p-6 text-center animate-fadeIn">
          <UploadCloud size={56} className="text-[var(--teal)] mb-4" />
          <h2 className="text-2xl" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>Drop files to add them</h2>
          <p className="text-sm text-[var(--muted)] max-w-md mt-2">
            PDF, DOCX, XLSX, and TXT files are ready to search in a moment.
          </p>
        </div>
      )}

      {/* Clean Header & Model Selector (Desktop) */}
      <header className="hidden md:flex h-12 px-4 items-center justify-between gap-3 flex-shrink-0 z-10 bg-[var(--bg)] border-b border-[var(--rule)]">
        <div className="flex items-center gap-3">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="px-3 py-1.5 text-[13px] rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{getModelLabel(selectedModel)}</span>
              <ChevronDown size={14} className="text-[var(--muted)] ml-0.5" />
            </button>
            {showModelMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-[var(--surface-2)] border border-[var(--rule)] rounded-[12px] py-1.5 z-50 animate-in fade-in duration-150">
                {[
                  { id: 'gemini-3.6-flash', name: 'Signal87 Standard', desc: 'Fast & intelligent for legal research' },
                  { id: 'gemini-2.5-pro', name: 'Signal87 Deep', desc: 'Deep synthesis & reasoning' },
                  { id: 'gemini-3.5-flash-lite', name: 'Signal87 Fast', desc: 'Ultra-low latency responses' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onChangeModel(m.id);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex flex-col gap-0.5 ${
 selectedModel === m.id ? 'bg-[var(--surface-2)] text-[var(--ink)] font-medium' : 'text-[var(--muted)]'
 }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{m.name}</span>
                      {selectedModel === m.id && <Check size={14} className="text-[var(--teal)]" />}
                    </div>
                    <span className="text-[11px] text-[var(--muted)] font-normal">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quiet User Profile / Account Badge */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--surface-2)] rounded-full text-xs text-[var(--ink)] font-medium transition-colors cursor-pointer">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.displayName || 'User'} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold flex items-center justify-center text-[10px]">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="hidden sm:inline font-medium text-[var(--ink-2)]">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
            </div>
          ) : (
            <button
              onClick={onGoogleSignIn}
              className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--ink)] text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn size={13} /> Sign In
            </button>
          )}

          {chatHistory.length > 0 && (
            <button
              onClick={() => { setChatHistory([]); setActiveArtifact(null); }}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-full transition-colors cursor-pointer"
              title="Clear conversation"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Workspace Canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative bg-[var(--bg)]">
        <div className={`flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-x-hidden transition-all duration-300 ${
 splitViewOpen ? 'w-full md:w-1/2 lg:w-3/5 border-r border-[var(--rule)]' : 'w-full'
 }`}>
          {isEmptyChat ? (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center px-4 sm:px-6 py-8">
              <div className="s87-column flex flex-col items-start pb-6">
                <span className="text-[12px] font-medium text-[var(--muted)]">
                  {scopedIds.length
                    ? `Asking about ${scopedIds.length === 1 ? (documents.find((d) => d.id === scopedIds[0])?.title || '1 file') : `${scopedIds.length} files`}`
                    : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'} in your workspace`}
                </span>
                <h1 className="s87-page-title mt-2 text-[var(--ink)]">
                  What would you like to understand?
                </h1>
              </div>

              <div className="s87-column">
                {composer}
              </div>

              <div className="s87-column pt-7">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] mb-3 px-0.5">
                  Try one of these
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggestionCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setInputQuery(card.prompt)}
                        className="flex items-start gap-3 text-left p-4 rounded-[12px] border border-[var(--rule)] bg-[var(--bg)] hover:bg-[var(--surface-2)] hover:border-[color-mix(in_srgb,var(--teal)_35%,var(--rule))] text-[14px] leading-[1.45] text-[var(--ink)] transition-colors cursor-pointer"
                      >
                        <Icon size={17} className="text-[var(--teal)] flex-shrink-0 mt-[1px]" />
                        <span>{card.prompt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const recent = recentSessions
                  .filter((s) => s.title && !['New Research Session', 'New Chat'].includes(s.title))
                  .slice(0, 5);
                if (!recent.length || !onOpenSession) return null;
                return (
                  <div className="s87-column pt-8 pb-6">
                    <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] mb-3 px-0.5">
                      Recent
                    </h2>
                    <div className="overflow-hidden rounded-[12px] border border-[var(--rule)]">
                      {recent.map((session, i) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => onOpenSession(session.id)}
                          className={`flex w-full items-center gap-3 px-4 min-h-[48px] text-left text-[14px] text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer ${i ? 'border-t border-[var(--rule)]' : ''}`}
                        >
                          <Clock3 size={15} className="flex-shrink-0 text-[var(--muted)]" />
                          <span className="min-w-0 flex-1 truncate">{session.title}</span>
                          <span className="flex-shrink-0 text-[12px] text-[var(--muted)]">{session.timestamp}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col">
                <div className="s87-column space-y-4">
                  <div className="space-y-4 pb-4">
                    {chatHistory.map((msg, index) => {
                      const previousUserMsg = index > 0 && chatHistory[index - 1].role === 'user' ? chatHistory[index - 1].text : '';

                      return (
                        <div key={msg.id} className="py-1">
                          {msg.role === 'user' ? (
                            <div className="flex justify-end my-3">
                              <div className="bg-[var(--surface-2)] text-[var(--ink)] px-4 py-2.5 rounded-[18px_18px_5px_18px] text-[14.5px] leading-[1.5] font-normal max-w-[85%] break-words [overflow-wrap:anywhere]">
                                {msg.text}
                              </div>
                            </div>
                          ) : (
                            <AssistantAnswer
                              msg={msg}
                              userPrompt={previousUserMsg}
                              copiedMsgId={copiedMsgId}
                              onCopy={handleCopy}
                              onExportPDF={handleExportPDF}
                              onInspectInCanvas={(item) => {
                                setActiveArtifact({
                                  id: item.id,
                                  title: item.text.slice(0, 40) + '...',
                                  content: item.text,
                                  citations: item.citations,
                                  timestamp: item.timestamp
                                });
                                setSplitViewOpen(true);
                              }}
                              onSelectDocument={onSelectDocument}
                              documents={documents}
                              onSaveAnswer={onSaveAnswer}
                              isAnswerSaved={savedAnswerIds?.has(msg.id)}
                            />
                          )}
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex items-center gap-3 py-3 text-[13.5px] text-[var(--muted)]">
                        <div className="w-6 h-6 bg-[var(--surface-2)] rounded-full flex items-center justify-center text-[var(--muted)]">
                          <Signal87Logo size={14} className="animate-spin" />
                        </div>
                        <span>Reading your documents...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 z-20 px-4 sm:px-6 pt-2 pb-2 sm:pb-3 bg-[var(--bg)]">
                <div className="s87-column">
                  {composer}
                </div>
              </div>
            </>
          )}
        </div>

        {splitViewOpen && (
          <div className="absolute inset-0 md:static w-full md:w-1/2 lg:w-2/5 md:shrink-0 bg-[var(--surface)] border-l border-[var(--rule)] flex flex-col h-full overflow-hidden z-20 animate-fadeIn">
            <div className="h-12 px-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--bg)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[var(--muted)]" />
                <span className="font-medium text-xs text-[var(--ink)] truncate max-w-[200px]">
                  {activeArtifact?.title || 'Deliverable Canvas'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {activeArtifact && (
                  <>
                    <button
                      onClick={() => handleCopy('canvas', activeArtifact.content)}
                      className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                      title="Copy Canvas Content"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleExportPDF(activeArtifact.title, activeArtifact.content)}
                      className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                      title="Export to PDF"
                    >
                      <Download size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSplitViewOpen(false)}
                  className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-[var(--ink)]">
              {activeArtifact ? (
                <div className="space-y-4">
                  <div className="text-xs text-[var(--muted)] border-b border-[var(--rule)] pb-2">
                    Artifact Created at {activeArtifact.timestamp}
                  </div>
                  {renderFormattedText(activeArtifact.content)}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] text-xs text-center p-6 space-y-2">
                  <FileText size={32} className="text-[var(--muted)]" />
                  <p>No deliverable active in side canvas.</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Click "Inspect in Canvas" on any generated AI response to view full side-by-side synthesis.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AttachExistingDocumentModal
        isOpen={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        documents={documents}
        attachedIds={attachedFiles.map((f) => f.id)}
        onToggleAttach={handleToggleAttachExisting}
      />
    </div>
  );
};
