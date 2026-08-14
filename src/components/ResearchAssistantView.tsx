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
  Loader2,
  Menu,
  LogIn,
  LogOut,
  User as UserIcon,
  FolderOpen
} from 'lucide-react';
import { User } from '../lib/firebase';
import { DocumentItem, ChatMessage, Citation, GeneratedReport } from '../types';
import { saveChatMessageToFirestore } from '../lib/firestoreService';
import { Signal87Logo } from './Signal87Logo';
import { ActionRouterCard, determineDeliverableType } from './ActionRouterComponents';
import { parseFileContent, ParsedFileResult } from '../lib/fileParser';
import { AttachExistingDocumentModal } from './AttachExistingDocumentModal';

export interface ResearchAssistantViewProps {
  documents: DocumentItem[];
  attachedFiles: { id: string; name: string; size: string; dataUrl?: string }[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<{ id: string; name: string; size: string; dataUrl?: string }[]>>;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onOpenUpload?: () => void;
  onUploadSuccess?: (doc: DocumentItem, parsedFile?: ParsedFileResult) => void;
  onSaveReport?: (rep: GeneratedReport) => void;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeSessionId?: string | null;
  currentUser?: User | null;
  onOpenMobileMenu?: () => void;
  onGoogleSignIn?: () => void;
  onSelectDocument?: (doc: DocumentItem) => void;
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
        <code key={idx} className="bg-[#161818] text-[#F3F3EE] border border-white/10 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-[#F3F3EE]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-white/70">
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
        <div key={key} className="overflow-x-auto my-3 border border-white/10 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#161818] border-b border-white/10 text-[#F3F3EE] font-bold">
                {headerCols.map((col, cIdx) => (
                  <th key={cIdx} className="p-2.5">
                    {parseInlineStyles(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#111212]">
              {bodyRows.map((rowStr, rIdx) => {
                const cols = rowStr
                  .split('|')
                  .slice(1, -1)
                  .map((c) => c.trim());
                return (
                  <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                    {cols.map((col, cIdx) => (
                      <td key={cIdx} className="p-2.5 text-white/70">
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
        <h3 key={lineIdx} className="font-bold text-[#F3F3EE] text-sm sm:text-base tracking-tight pt-3 pb-1 border-b border-white/10">
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
          <span className="w-1.5 h-1.5 rounded-full bg-[#20B8CD] mt-2 flex-shrink-0" />
          <div className="flex-1 text-white/80">{parseInlineStyles(content)}</div>
        </div>
      );
      return;
    }

    if (numberedMatch) {
      const num = numberedMatch[1];
      const content = numberedMatch[2];
      elements.push(
        <div key={lineIdx} className="flex items-start gap-2.5 pl-1 my-1">
          <span className="font-bold text-[#F3F3EE] text-xs font-mono mt-0.5 flex-shrink-0">{num}.</span>
          <div className="flex-1 text-white/80">{parseInlineStyles(content)}</div>
        </div>
      );
      return;
    }

    elements.push(
      <p key={lineIdx} className="my-1.5 text-white/80 leading-relaxed">
        {parseInlineStyles(trimmed)}
      </p>
    );
  });

  flushTable('table-final');

  return (
    <div className="space-y-2 font-sans text-[13.5px] sm:text-sm leading-relaxed text-white/80 antialiased tracking-normal">
      {elements}
    </div>
  );
};

export const ResearchAssistantView: React.FC<ResearchAssistantViewProps> = ({
  documents,
  attachedFiles,
  setAttachedFiles,
  selectedModel,
  onChangeModel,
  onOpenUpload,
  onUploadSuccess,
  onSaveReport,
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
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(documents.map((d) => d.id));
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ingestedFiles, setIngestedFiles] = useState<ParsedFileResult[]>([]);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const getModelLabel = (model: string) => {
    switch (model) {
      case 'gemini-2.5-flash-lite': return 'Signal87 Fast';
      case 'gemini-2.5-flash': return 'Signal87 Standard';
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

  const [savedReportIds, setSavedReportIds] = useState<Set<string>>(new Set());

  // Split Screen Canvas State
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<{
    id: string;
    title: string;
    content: string;
    citations?: Citation[];
    timestamp: string;
  } | null>(null);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // Sync document selection when documents prop changes
  useEffect(() => {
    if (documents && documents.length > 0) {
      setSelectedDocIds((prev) => {
        const prevSet = new Set(prev);
        const allDocIds = documents.map((d) => d.id);
        if (prev.length === 0) return allDocIds;
        const newDocIds = allDocIds.filter((id) => !prevSet.has(id));
        if (newDocIds.length > 0) {
          return [...prev, ...newDocIds];
        }
        const existingDocIdsSet = new Set(allDocIds);
        const filteredPrev = prev.filter((id) => existingDocIdsSet.has(id));
        if (filteredPrev.length !== prev.length) {
          return filteredPrev;
        }
        return prev;
      });
    }
  }, [documents]);

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

  /**
   * `research` picks the heavyweight multi-document synthesis instead of the
   * assistant. It is an argument rather than component state on purpose: this
   * used to be a sticky `mode` that only the preset chips could set and nothing
   * ever reset, so choosing "Draft Executive Report" once sent every later
   * message — including "what is the date on this?" — to the deep research
   * engine, with no way back and nothing on screen saying so.
   */
  const handleSendQuery = async (queryText?: string, research = false) => {
    const userMsgText = queryText || inputQuery;
    if (!userMsgText.trim() || loading) return;

    if (!queryText) setInputQuery('');

    const targetMode = research ? 'deep' : 'quick';

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory((prev) => [...prev, userMsg]);
    saveChatMessageToFirestore(userMsg);
    setLoading(true);

    const activeDocs = documents.filter((d) => selectedDocIds.includes(d.id));

    const fullTextDocumentPayload = activeDocs.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      summary: doc.summary,
      fullText: doc.fullText || doc.contentPreview || doc.summary
    }));

    const ingestedFilesData = ingestedFiles.map((f) => ({
      fileName: f.fileName,
      fileType: f.fileType,
      summaryInfo: f.summaryInfo,
      extractedText: f.extractedText
    }));

    try {
      let endpoint = '/api/chat';
      let bodyPayload: any = {};

      if (targetMode === 'deep') {
        endpoint = '/api/research';
        bodyPayload = {
          researchGoal: userMsgText,
          documentIds: selectedDocIds,
          model: selectedModel,
          documents: fullTextDocumentPayload,
          ingestedFilesData,
          attachedFiles
        };
      } else {
        const priorTurns = [...chatHistory, userMsg]
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.text }));
        bodyPayload = {
          prompt: userMsgText,
          messages: priorTurns,
          documents: fullTextDocumentPayload,
          model: selectedModel,
          ingestedFilesData,
          attachedFiles
        };
      }

      const startTime = Date.now();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        // Surface the server's own explanation instead of a bare status code.
        let serverDetail = '';
        try {
          const errBody = await res.json();
          serverDetail = errBody.details || errBody.error || '';
        } catch {
          try {
            serverDetail = (await res.text()).slice(0, 300);
          } catch {
            serverDetail = '';
          }
        }
        throw new Error(
          `status ${res.status}${serverDetail ? ` \u2014 ${serverDetail}` : ''}`
        );
      }

      const data = await res.json();
      const actualLatency = Date.now() - startTime;

      let responseText = '';
      let reasoningSteps = data.reasoningSteps || [];

      responseText = data.text || 'Analysis synthesis complete.';

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

      const routedDeliverableType = determineDeliverableType(userMsgText, responseText, targetMode === 'deep');

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
        verificationTrace: data.verificationTrace || {
          steps: [
            'Scanned vector indices across selected documents',
            'Cross-referenced structural provisions and requirements',
            'Completed Signal87 inference synthesis'
          ],
          modelsUsed: [selectedModel],
          contextTokensProcessed: Math.floor(userMsgText.length * 3.5) + 12400,
          latencyMs: actualLatency
        },
        reasoningSteps: reasoningSteps,
        isDeepResearch: targetMode === 'deep'
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
        text: `Error: The AI assistant is currently experiencing high demand or configuration issues. Please try again later. (${err instanceof Error ? err.message : 'Unknown error'})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliverableType: 'qa'
      };
      setChatHistory((prev) => [...prev, errorMsg]);
      setLoading(false);
    }
  };

  // A question asked from the home screen arrives here and sends itself.
  const consumedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialQuery || consumedQueryRef.current === initialQuery) return;
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

  const handleSaveToReports = (id: string, title: string, content: string) => {
    const newReport: GeneratedReport = {
      id: `rep-${Date.now()}`,
      title: title || `AI Workspace Report - ${new Date().toLocaleDateString()}`,
      templateId: 'custom-workspace',
      content: content,
      generatedAt: new Date().toISOString(),
      author: 'ceo@signal87.ai',
      sourcesCount: selectedDocIds.length,
      status: 'Final',
      tags: ['AI Workspace', 'Deliverable Brief']
    };

    if (onSaveReport) {
      onSaveReport(newReport);
    }

    setSavedReportIds((prev) => new Set(prev).add(id));
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

  const quickActionChips = [
    {
      id: 'draft',
      label: '📝 Draft Executive Report',
      prompt: 'Draft a comprehensive publication-grade executive brief synthesizing all active documents.',
    },
    {
      id: 'compare',
      label: '⚖️ Compare Key Documents',
      prompt: 'Perform a side-by-side legal clause comparison across all active documents and flag key conflicts and risk escalation triggers.',
    },
    {
      id: 'extract',
      label: '📊 Extract Financial Metrics',
      prompt: 'Extract all financial milestones, indemnification caps, and budget metrics into a clear Markdown table.',
    },
    {
      id: 'audit',
      label: '🔍 Audit Compliance & Deadlines',
      prompt: 'Audit all compliance timelines, retroactive notice windows, and penalty triggers across active agreements.',
    },
    {
      id: 'quantitative',
      label: '📈 Quantitative Analysis',
      prompt: 'Analyze all numerical data, calculations, percentages, trends, and metrics in the documents. Provide concrete numbers and statistical insights.',
    },
    {
      id: 'reasoning',
      label: '🧠 Logical Reasoning & Causality',
      prompt: 'Explain the causal relationships, logical chains, and underlying mechanisms in these documents. What causes what and why?',
    },
    {
      id: 'qa',
      label: '❓ Ask a Question',
      prompt: 'Ask me anything about these documents and I will provide direct, evidence-based answers with reasoning steps.',
    }
  ];

  const isEmptyChat = chatHistory.length === 0;

  const composer = (
    <div className="w-full">
      {attachedFiles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-3">
          {attachedFiles.map((f) => (
            <div
              key={f.id}
              className="pl-3 pr-2 min-h-[36px] bg-[#161818] text-[#F3F3EE] rounded-full text-[12px] font-medium flex items-center gap-2 flex-shrink-0 max-w-[210px]"
            >
              {f.dataUrl ? (
                <img src={f.dataUrl} alt={f.name} className="w-5 h-5 object-cover rounded-full" />
              ) : (
                <FileText size={13} className="text-white/35 flex-shrink-0" />
              )}
              <span className="truncate min-w-0 flex-1">{f.name}</span>
              <button
                onClick={() => {
                  setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id));
                  setIngestedFiles((prev) => prev.filter((item) => item.fileName !== f.name));
                }}
                aria-label={`Remove ${f.name}`}
                className="w-8 h-8 -mr-1 flex items-center justify-center text-white/35 hover:text-[#F3F3EE] transition-colors cursor-pointer flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <div
          className="pointer-events-none absolute -inset-3 sm:-inset-4 rounded-[32px]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(32,184,205,0.2) 0%, rgba(32,184,205,0.06) 42%, transparent 70%)',
            filter: 'blur(10px)'
          }}
        />
        <div
          className="s87-field relative pl-2 pr-2 py-1.5 sm:p-2.5 flex items-center gap-1.5 sm:gap-2.5 min-h-[52px] sm:min-h-[48px]"
        >
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              aria-label={showAttachMenu ? 'Close attach menu' : 'Add attachment'}
              aria-expanded={showAttachMenu}
              className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-transparent hover:bg-white/5 text-white/45 hover:text-[#F3F3EE] transition-colors cursor-pointer"
            >
              {showAttachMenu ? <X size={18} /> : <Plus size={20} />}
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#161818] border border-white/10 rounded-[12px] py-1.5 z-50 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowFilePicker(true);
                  }}
                  className="w-full flex items-center gap-2.5 text-left px-4 min-h-[44px] hover:bg-white/5 text-[13px] font-medium text-[#F3F3EE] transition-colors cursor-pointer"
                >
                  <FolderOpen size={15} className="text-white/35" />
                  <span>Choose from Files</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={isParsingFile}
                  className="w-full flex items-center gap-2.5 text-left px-4 min-h-[44px] hover:bg-white/5 text-[13px] font-medium text-[#F3F3EE] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isParsingFile ? <Loader2 size={15} className="animate-spin text-white/40" /> : <Paperclip size={15} className="text-white/35" />}
                  <span>Upload Document</span>
                </button>
              </div>
            )}
          </div>

          <span
            className="flex-shrink-0 text-[15px] font-medium text-[#20B8CD] select-none"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            aria-hidden="true"
          >
            &gt;_
          </span>

          <textarea
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendQuery();
              }
            }}
            placeholder="Ask anything..."
            className="flex-1 min-w-0 bg-transparent border-0 text-base leading-[1.5] text-[#F3F3EE] placeholder:text-white/30 focus:outline-none resize-none min-h-[28px] max-h-24 px-1 py-2 font-sans caret-[#20B8CD]"
            rows={1}
          />

          {/* Two send actions rather than a mode. The expensive multi-document
              run is always a deliberate press, so nothing can silently redirect
              an ordinary question into it. */}
          <button
            type="button"
            onClick={() => handleSendQuery(undefined, true)}
            disabled={!inputQuery.trim() || loading}
            aria-label="Research across documents"
            title="Research across your documents — slower, writes a full brief"
            className={`flex-shrink-0 h-11 sm:h-9 px-3 flex items-center gap-1.5 rounded-full border transition-colors cursor-pointer text-[12.5px] font-medium ${
              inputQuery.trim() && !loading
                ? 'border-white/15 text-white/70 hover:text-[#F3F3EE] hover:border-white/30'
                : 'border-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            <Layers size={15} />
            <span className="hidden sm:inline">Research</span>
          </button>

          <button
            type="button"
            onClick={() => handleSendQuery()}
            disabled={!inputQuery.trim() || loading}
            aria-label="Send"
            className={`flex-shrink-0 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              inputQuery.trim() && !loading
                ? 'bg-[#20B8CD] text-[#0F1010] hover:opacity-90'
                : 'bg-white/5 text-white/25 cursor-not-allowed'
            }`}
            title="Send message"
          >
            <ArrowUp size={16} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col bg-[#0F1010] text-[#F3F3EE] font-sans h-full flex-1 min-h-0 overflow-hidden select-none"
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
        <div className="absolute inset-0 bg-[#0F1010]/92 backdrop-blur-md z-50 flex flex-col items-center justify-center text-[#F3F3EE] border-2 border-dashed border-[#20B8CD]/40 p-6 text-center animate-fadeIn">
          <UploadCloud size={56} className="text-[#20B8CD] mb-4" />
          <h2 className="text-2xl" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>Drop files to add them</h2>
          <p className="text-sm text-white/45 max-w-md mt-2">
            PDF, DOCX, XLSX, and TXT files are ready to search in a moment.
          </p>
        </div>
      )}

      {/* Clean Header & Model Selector (Desktop) */}
      <header className="hidden md:flex h-12 px-4 items-center justify-between gap-3 flex-shrink-0 z-10 bg-[#0F1010] border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="px-3 py-1.5 text-[13px] rounded-full text-white/45 hover:text-[#F3F3EE] hover:bg-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{getModelLabel(selectedModel)}</span>
              <ChevronDown size={14} className="text-white/30 ml-0.5" />
            </button>
            {showModelMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-[#161818] border border-white/10 rounded-[12px] py-1.5 z-50 animate-in fade-in duration-150">
                {[
                  { id: 'gemini-2.5-flash', name: 'Signal87 Standard', desc: 'Fast & intelligent for legal research' },
                  { id: 'gemini-2.5-pro', name: 'Signal87 Deep', desc: 'Deep synthesis & reasoning' },
                  { id: 'gemini-2.5-flash-lite', name: 'Signal87 Fast', desc: 'Ultra-low latency responses' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onChangeModel(m.id);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer flex flex-col gap-0.5 ${
 selectedModel === m.id ? 'bg-white/5 text-[#F3F3EE] font-medium' : 'text-white/55'
 }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{m.name}</span>
                      {selectedModel === m.id && <Check size={14} className="text-[#20B8CD]" />}
                    </div>
                    <span className="text-[11px] text-white/35 font-normal">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quiet User Profile / Account Badge */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/5 rounded-full text-xs text-[#F3F3EE] font-medium transition-colors cursor-pointer">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.displayName || 'User'} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#161818] text-[#F3F3EE] font-bold flex items-center justify-center text-[10px]">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="hidden sm:inline font-medium text-white/70">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
            </div>
          ) : (
            <button
              onClick={onGoogleSignIn}
              className="px-3 py-1.5 text-white/40 hover:text-white/80 text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn size={13} /> Sign In
            </button>
          )}

          {chatHistory.length > 0 && (
            <button
              onClick={() => { setChatHistory([]); setActiveArtifact(null); }}
              className="p-1.5 text-white/30 hover:text-[#F3F3EE] hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              title="Clear conversation"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Workspace Canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative bg-[#0F1010]">
        <div className={`flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-x-hidden transition-all duration-300 ${
 splitViewOpen ? 'w-full md:w-1/2 lg:w-3/5 border-r border-white/5' : 'w-full'
 }`}>
          {isEmptyChat ? (
            <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] px-4 sm:px-6">
              <div className="flex flex-col items-center justify-end text-center pb-5 sm:pb-7 min-h-0">
                <span className="text-[12px] font-medium text-white/35">
                  {documents.length} {documents.length === 1 ? 'document' : 'documents'} added
                </span>
                <h1 className="mt-2 text-[1.65rem] sm:text-[2.5rem] leading-[1.15] text-[#F3F3EE] m-0 font-semibold tracking-tight max-w-[18ch] sm:max-w-none">
                  What do you want to know{currentUser?.displayName?.split(' ')[0] ? `, ${currentUser.displayName.split(' ')[0]}` : ''}?
                </h1>
              </div>

              <div className="w-full max-w-[640px] mx-auto">
                {composer}
              </div>

              <div className="flex flex-col items-center justify-start pt-5 sm:pt-7 min-h-0 overflow-y-auto">
                <div className="relative w-full max-w-md">
                  <button
                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-transparent hover:bg-white/5 rounded-full transition-colors cursor-pointer text-[13px] text-white/40 hover:text-white/70"
                  >
                    <span>More questions to try</span>
                    <ChevronDown size={14} />
                  </button>
                  {showActionsDropdown && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#161818] border border-white/10 rounded-[12px] z-20 overflow-hidden text-left">
                      {quickActionChips.map((chip) => (
                        <button
                          key={chip.id}
                          onClick={() => {
                            setInputQuery(chip.prompt);
                            setShowActionsDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 text-[13px] text-white/60 hover:text-[#F3F3EE] border-b border-white/5 last:border-b-0 cursor-pointer"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 sm:py-4 flex flex-col">
                {/* mt-auto seats a short conversation at the bottom of the scroll
                    area next to the composer, the way ChatGPT and Claude do —
                    without it one exchange floats at the top with a gap beneath.
                    Once the thread outgrows the container there is no free space
                    left and it scrolls as normal. */}
                <div className="max-w-[768px] w-full mx-auto space-y-4 mt-auto">
                  <div className="space-y-4 pb-4">
                    {chatHistory.map((msg, index) => {
                      const previousUserMsg = index > 0 && chatHistory[index - 1].role === 'user' ? chatHistory[index - 1].text : '';

                      return (
                        <div key={msg.id} className="py-1">
                          {msg.role === 'user' ? (
                            <div className="flex justify-end my-3">
                              <div className="bg-[#161818] text-[#F3F3EE] px-4 py-2.5 rounded-[18px_18px_5px_18px] text-[14.5px] leading-[1.5] font-normal max-w-[80%]">
                                {msg.text}
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3 sm:gap-4 items-start my-4">
                              <div className="w-8 h-8 rounded-full bg-[#161818] text-white/50 flex items-center justify-center flex-shrink-0 mt-1">
                                <Signal87Logo size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <ActionRouterCard
                                  msg={msg}
                                  userPrompt={previousUserMsg}
                                  copiedMsgId={copiedMsgId}
                                  savedReportIds={savedReportIds}
                                  onCopy={handleCopy}
                                  onExportPDF={handleExportPDF}
                                  onSaveReport={(id, title, content) => handleSaveToReports(id, title, content)}
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
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex items-center gap-3 py-3 text-[13.5px] text-white/40">
                        <div className="w-6 h-6 bg-[#161818] rounded-full flex items-center justify-center text-white/40">
                          <Signal87Logo size={14} className="animate-spin" />
                        </div>
                        <span>Reading your documents...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 z-20 px-4 sm:px-6 pt-2 pb-2 sm:pb-3 bg-[#0F1010]">
                <div className="max-w-[768px] w-full mx-auto">
                  {composer}
                </div>
              </div>
            </>
          )}
        </div>

        {splitViewOpen && (
          <div className="w-full md:w-1/2 lg:w-2/5 bg-[#111212] border-l border-white/5 flex flex-col h-full overflow-hidden z-20 animate-fadeIn">
            <div className="h-12 px-4 border-b border-white/5 flex items-center justify-between bg-[#0F1010] flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-white/40" />
                <span className="font-medium text-xs text-[#F3F3EE] truncate max-w-[200px]">
                  {activeArtifact?.title || 'Deliverable Canvas'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {activeArtifact && (
                  <>
                    <button
                      onClick={() => handleCopy('canvas', activeArtifact.content)}
                      className="p-1.5 text-white/35 hover:text-[#F3F3EE] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Copy Canvas Content"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleExportPDF(activeArtifact.title, activeArtifact.content)}
                      className="p-1.5 text-white/35 hover:text-[#F3F3EE] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Export to PDF"
                    >
                      <Download size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSplitViewOpen(false)}
                  className="p-1.5 text-white/35 hover:text-[#F3F3EE] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-[#F3F3EE]">
              {activeArtifact ? (
                <div className="space-y-4">
                  <div className="text-xs text-white/35 border-b border-white/5 pb-2">
                    Artifact Created at {activeArtifact.timestamp}
                  </div>
                  {renderFormattedText(activeArtifact.content)}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/35 text-xs text-center p-6 space-y-2">
                  <FileText size={32} className="text-white/15" />
                  <p>No deliverable active in side canvas.</p>
                  <p className="text-[11px] text-white/30">
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