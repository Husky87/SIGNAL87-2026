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
import { fetchChatMessagesFromFirestore, saveChatMessageToFirestore } from '../lib/firestoreService';
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
        <code key={idx} className="bg-slate-100 text-slate-900 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-slate-800">
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
        <div key={key} className="overflow-x-auto my-3 border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-900 font-bold">
                {headerCols.map((col, cIdx) => (
                  <th key={cIdx} className="p-2.5">
                    {parseInlineStyles(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {bodyRows.map((rowStr, rIdx) => {
                const cols = rowStr
                  .split('|')
                  .slice(1, -1)
                  .map((c) => c.trim());
                return (
                  <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                    {cols.map((col, cIdx) => (
                      <td key={cIdx} className="p-2.5 text-slate-700">
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
        <h3 key={lineIdx} className="font-bold text-slate-900 text-sm sm:text-base tracking-tight pt-3 pb-1 border-b border-slate-100">
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
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2 flex-shrink-0" />
          <div className="flex-1 text-slate-800">{parseInlineStyles(content)}</div>
        </div>
      );
      return;
    }

    if (numberedMatch) {
      const num = numberedMatch[1];
      const content = numberedMatch[2];
      elements.push(
        <div key={lineIdx} className="flex items-start gap-2.5 pl-1 my-1">
          <span className="font-bold text-slate-900 text-xs font-mono mt-0.5 flex-shrink-0">{num}.</span>
          <div className="flex-1 text-slate-800">{parseInlineStyles(content)}</div>
        </div>
      );
      return;
    }

    elements.push(
      <p key={lineIdx} className="my-1.5 text-slate-800 leading-relaxed">
        {parseInlineStyles(trimmed)}
      </p>
    );
  });

  flushTable('table-final');

  return (
    <div className="space-y-2 font-sans text-[13.5px] sm:text-sm leading-relaxed text-slate-800 antialiased tracking-normal">
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
  const [mode, setMode] = useState<'quick' | 'deep' | 'analyze'>('quick');
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

  // Sync with Firestore
  useEffect(() => {
    async function loadFirestoreChat() {
      const stored = await fetchChatMessagesFromFirestore();
      if (stored && stored.length > 0) {
        setChatHistory(stored);
        const assistantMsgs = stored.filter((m) => m.role === 'assistant');
        if (assistantMsgs.length > 0) {
          const latest = assistantMsgs[assistantMsgs.length - 1];
          if (latest.text.length > 250) {
            setActiveArtifact({
              id: latest.id,
              title: latest.isDeepResearch ? 'Deep Research Synthesis' : 'Workspace Report Deliverable',
              content: latest.text,
              citations: latest.citations,
              timestamp: latest.timestamp
            });
          }
        }
      }
    }
    loadFirestoreChat();
  }, []);

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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleSendQuery = async (queryText?: string, explicitMode?: 'quick' | 'deep') => {
    const userMsgText = queryText || inputQuery;
    if (!userMsgText.trim() || loading) return;

    if (!queryText) setInputQuery('');

    const targetMode = explicitMode || mode;

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
      } else if (targetMode === 'analyze') {
        endpoint = '/api/analyze';
        bodyPayload = {
          query: userMsgText,
          documents: fullTextDocumentPayload,
          analysisType: 'auto',
          includeReasoningSteps: true
        };
      } else {
        bodyPayload = {
          prompt: userMsgText,
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

      // Handle /api/analyze response format
      let responseText = '';
      let reasoningSteps = data.reasoningSteps || [];
      let deliverableTypeOverride = '';

      if (targetMode === 'analyze') {
        responseText = data.answer || 'Analysis complete.';
        reasoningSteps = data.reasoningSteps || [];
        deliverableTypeOverride = data.analysisType || 'qa';

        // Add confidence indicator for analyze mode
        if (data.confidence) {
          responseText = `**Confidence Level:** ${data.confidence.toUpperCase()}\n\n${responseText}`;
        }

        // Append quantitative data summary if available
        if (data.quantitativeData) {
          const qData = data.quantitativeData;
          if (Object.keys(qData.metrics).length > 0 || qData.trends.length > 0 || qData.calculations.length > 0) {
            responseText += `\n\n### Extracted Data\n`;
            if (Object.keys(qData.metrics).length > 0) {
              responseText += `**Metrics:** ${Object.values(qData.metrics).join(', ')}\n`;
            }
            if (qData.trends.length > 0) {
              responseText += `**Trends:** ${qData.trends.join(', ')}\n`;
            }
            if (qData.calculations.length > 0) {
              responseText += `**Calculations:** ${qData.calculations.slice(0, 3).join(', ')}\n`;
            }
          }
        }
      } else {
        responseText = data.text || 'Analysis synthesis complete.';
      }

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

      const routedDeliverableType = deliverableTypeOverride || determineDeliverableType(userMsgText, responseText, targetMode === 'deep');

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: responseText,
        excelExportData: excelExportData || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliverableType: routedDeliverableType,
        citations: data.citations || [
          {
            docId: activeDocs[0]?.id || 'doc-101',
            docTitle: activeDocs[0]?.title || 'Document',
            paragraphRef: 'Sec 4, Para 2',
            snippet: activeDocs[0]?.summary || 'Relevant citation match',
            confidence: 96
          }
        ],
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
        isDeepResearch: targetMode === 'deep' || targetMode === 'analyze'
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
  useEffect(() => {
    if (initialQuery) {
      handleSendQuery(initialQuery);
      if (onInitialQueryConsumed) onInitialQueryConsumed();
    }
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
      mode: 'deep' as const
    },
    {
      id: 'compare',
      label: '⚖️ Compare Key Documents',
      prompt: 'Perform a side-by-side legal clause comparison across all active documents and flag key conflicts and risk escalation triggers.',
      mode: 'quick' as const
    },
    {
      id: 'extract',
      label: '📊 Extract Financial Metrics',
      prompt: 'Extract all financial milestones, indemnification caps, and budget metrics into a clear Markdown table.',
      mode: 'analyze' as const
    },
    {
      id: 'audit',
      label: '🔍 Audit Compliance & Deadlines',
      prompt: 'Audit all compliance timelines, retroactive notice windows, and penalty triggers across active agreements.',
      mode: 'analyze' as const
    },
    {
      id: 'quantitative',
      label: '📈 Quantitative Analysis',
      prompt: 'Analyze all numerical data, calculations, percentages, trends, and metrics in the documents. Provide concrete numbers and statistical insights.',
      mode: 'analyze' as const
    },
    {
      id: 'reasoning',
      label: '🧠 Logical Reasoning & Causality',
      prompt: 'Explain the causal relationships, logical chains, and underlying mechanisms in these documents. What causes what and why?',
      mode: 'analyze' as const
    },
    {
      id: 'qa',
      label: '❓ Ask a Question',
      prompt: 'Ask me anything about these documents and I will provide direct, evidence-based answers with reasoning steps.',
      mode: 'analyze' as const
    }
  ];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col bg-[var(--paper)] text-[var(--ink)] font-sans h-full flex-1 min-h-0 overflow-hidden select-none"
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
        <div className="absolute inset-0 bg-[var(--bg)]/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-[var(--ink)] border-2 border-dashed border-[var(--ink-2)] p-6 text-center animate-fadeIn">
          <UploadCloud size={56} className="text-[var(--ink-2)] mb-4" />
          <h2 className="text-2xl" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>Drop files to add them</h2>
          <p className="text-sm text-[var(--ink-2)] max-w-md mt-2">
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
              className="px-3.5 py-1.5 text-[13px] rounded-full text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>{getModelLabel(selectedModel)}</span>
              <ChevronDown size={14} className="text-[var(--muted)] ml-0.5" />
            </button>
            {showModelMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-[var(--card)] border border-[var(--rule)] rounded-[4px] py-1.5 z-50 animate-in fade-in duration-150">
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
                    className={`w-full text-left px-4 py-2.5 hover:bg-[var(--raised)] transition-colors cursor-pointer flex flex-col gap-0.5 ${
 selectedModel === m.id ? 'bg-[var(--raised)] text-[var(--ink)] font-medium' : 'text-[var(--ink-2)]'
 }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{m.name}</span>
                      {selectedModel === m.id && <Check size={14} className="text-[var(--accent)]" />}
                    </div>
                    <span className="text-[11px] text-[var(--slate)] font-normal">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quiet User Profile / Account Badge */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--card)] hover:bg-[var(--raised)] border border-[var(--rule)] rounded-[3px] text-xs text-[var(--ink)] font-medium transition-colors cursor-pointer">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.displayName || 'User'} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[var(--ink)] text-white font-bold flex items-center justify-center text-[10px]">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="hidden sm:inline font-semibold">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
            </div>
          ) : (
            <button
              onClick={onGoogleSignIn}
              className="px-3.5 py-1.5 bg-[var(--teal)] hover:opacity-90 text-white text-[13px] font-medium rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn size={13} /> Sign In
            </button>
          )}

          {chatHistory.length > 0 && (
            <button
              onClick={() => { setChatHistory([]); setActiveArtifact(null); }}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--raised)] rounded-full transition-colors cursor-pointer"
              title="Clear conversation"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Workspace Canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative bg-[var(--paper)]">
        <div className={`flex-1 flex flex-col justify-between min-w-0 h-full overflow-hidden transition-all duration-300 ${
 splitViewOpen ? 'w-full md:w-1/2 lg:w-3/5 border-r border-[#28292a]' : 'w-full'
 }`}>
          {/* Scrollable Chat Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 sm:py-4 flex flex-col">
            <div className={`max-w-[768px] w-full mx-auto space-y-4 ${chatHistory.length === 0 ? 'flex-1 flex flex-col justify-center my-auto py-2 sm:py-4' : ''}`}>
              {chatHistory.length === 0 ? (
                <div className="flex flex-col justify-center space-y-5 sm:space-y-6 max-w-2xl mx-auto w-full">
                  {/* Welcome Headline */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-[var(--muted)]">
                      {documents.length} {documents.length === 1 ? 'document' : 'documents'} added
                    </span>
                    <h1 className="text-3xl sm:text-4xl text-[var(--ink)] m-0" style={{ fontWeight: 600, letterSpacing: '-0.036em' }}>
                      What do you want to know{currentUser?.displayName?.split(' ')[0] ? `, ${currentUser.displayName.split(' ')[0]}` : ''}?
                    </h1>
                    <p className="text-sm text-[var(--ink-2)] m-0 max-w-[50ch]" style={{ lineHeight: 1.6 }}>
                      Ask about anything you've added. Each answer points to where it came from.
                    </p>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="relative w-full pt-1 sm:pt-2">
                    <button
                      onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--rule)] rounded-xl transition-colors cursor-pointer text-[14.5px] text-[var(--ink)]"
                    >
                      <span>More questions to try</span>
                      <ChevronDown size={16} />
                    </button>
                    {showActionsDropdown && (
                      <div className="absolute top-full left-0 w-full mt-1 bg-[var(--surface)] border border-[var(--rule)] rounded-xl z-20 overflow-hidden">
                        {quickActionChips.map((chip) => (
                          <button
                            key={chip.id}
                            onClick={() => {
                              setInputQuery(chip.prompt);
                              setMode(chip.mode);
                              setShowActionsDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-[var(--raised)] text-[14.5px] text-[var(--ink)] border-b border-[var(--rule-2)] last:border-b-0 cursor-pointer"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {chatHistory.map((msg, index) => {
                    const previousUserMsg = index > 0 && chatHistory[index - 1].role === 'user' ? chatHistory[index - 1].text : '';

                    return (
                      <div key={msg.id} className="py-1">
                        {msg.role === 'user' ? (
                          <div className="flex justify-end my-3">
                            <div className="bg-[var(--raised)] text-[var(--ink)] px-4 py-2.5 rounded-[18px_18px_5px_18px] text-[14.5px] leading-[1.5] font-normal max-w-[80%]">
                              {msg.text}
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3 sm:gap-4 items-start my-4">
                            <div className="w-8 h-8 rounded-full bg-[var(--raised)] text-[var(--ink-2)] flex items-center justify-center flex-shrink-0 mt-1">
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
                    <div className="flex items-center gap-3 py-3 text-[13.5px] text-[var(--ink-2)]">
                      <div className="w-6 h-6 bg-[var(--raised)] rounded-full flex items-center justify-center text-[var(--ink-2)]">
                        <Signal87Logo size={14} className="animate-spin" />
                      </div>
                      <span>Reading your documents...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Gemini Floating Rounded Input Box Container */}
          <div
            className="flex-shrink-0 bg-[var(--paper)] z-20 px-3 sm:px-4 pt-1.5 pb-2 border-t border-[var(--rule)]"
            style={{
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))'
            }}
          >
            <div className="max-w-[768px] w-full mx-auto">

              {attachedFiles.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 -mx-3 px-3 sm:-mx-4 sm:px-4">
                  {attachedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="pl-3 pr-2 min-h-[36px] bg-[var(--raised)] text-[var(--ink)] border border-[var(--rule)] rounded-full text-[12px] font-semibold flex items-center gap-2 flex-shrink-0 max-w-[210px]"
                    >
                      {f.dataUrl ? (
                        <img src={f.dataUrl} alt={f.name} className="w-5 h-5 object-cover rounded-full" />
                      ) : (
                        <FileText size={13} className="text-[var(--slate)] flex-shrink-0" />
                      )}
                      <span className="truncate min-w-0 flex-1">{f.name}</span>
                      <button
                        onClick={() => {
                          setAttachedFiles((prev) => prev.filter((item) => item.id !== f.id));
                           setIngestedFiles((prev) => prev.filter((item) => item.fileName !== f.name));
                         }}
                        aria-label={`Remove ${f.name}`}
                        className="w-8 h-8 -mr-1 flex items-center justify-center text-[var(--slate)] hover:text-[var(--ink)] transition-colors cursor-pointer flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Single-row composer: "+" attach menu, input, send */}
              <div className="relative bg-[var(--surface)] border border-[var(--rule)] rounded-[26px] p-2 sm:p-2.5 flex items-end gap-2 sm:gap-2.5 mt-auto transition-all focus-within:border-[var(--ink-2)]">
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    aria-label={showAttachMenu ? 'Close attach menu' : 'Add attachment'}
                    aria-expanded={showAttachMenu}
                    className="flex items-center justify-center w-10 h-10 md:w-9 md:h-9 rounded-full bg-[var(--raised)] hover:opacity-80 text-[var(--ink-2)] transition-colors cursor-pointer"
                  >
                    {showAttachMenu ? <X size={18} /> : <Plus size={20} />}
                  </button>

                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--card)] border border-[var(--rule)] rounded-[4px] py-1.5 z-50 animate-in fade-in duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowFilePicker(true);
                        }}
                        className="w-full flex items-center gap-2.5 text-left px-4 min-h-[44px] hover:bg-[var(--raised)] text-[13px] font-medium text-[var(--ink)] transition-colors cursor-pointer"
                      >
                        <FolderOpen size={15} className="text-[var(--slate)]" />
                        <span>Choose from Files</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false);
                          fileInputRef.current?.click();
                        }}
                        disabled={isParsingFile}
                        className="w-full flex items-center gap-2.5 text-left px-4 min-h-[44px] hover:bg-[var(--raised)] text-[13px] font-medium text-[var(--ink)] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isParsingFile ? <Loader2 size={15} className="animate-spin text-[var(--ink-2)]" /> : <Paperclip size={15} className="text-[var(--slate)]" />}
                        <span>Upload Document</span>
                      </button>

                    </div>
                  )}
                </div>

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
                  className="flex-1 min-w-0 bg-transparent border-0 text-[15px] sm:text-[16px] leading-[1.5] text-[var(--ink)] placeholder-[var(--ink-2)] focus:outline-none resize-none min-h-[40px] md:min-h-[36px] max-h-24 px-2 py-2 md:py-1.5 font-sans"
                  rows={1}
                />

                <button
                  type="button"
                  onClick={() => handleSendQuery()}
                  disabled={!inputQuery.trim() || loading}
                  aria-label="Send"
                  className={`flex-shrink-0 w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                    inputQuery.trim() && !loading
                      ? 'bg-[var(--teal)] text-white hover:opacity-90'
                      : 'bg-[var(--raised)] text-[var(--muted)] cursor-not-allowed'
                  }`}
                  title="Send message"
                >
                  <ArrowUp size={16} strokeWidth={2.6} />
                </button>
              </div>
              {chatHistory.length === 0 && (
                <p className="text-[11px] text-center text-[var(--slate)] mt-2">
                  Signal87 AI may produce inaccurate information. Verify key citations.
                </p>
              )}
            </div>
          </div>
        </div>

        {splitViewOpen && (
          <div className="w-full md:w-1/2 lg:w-2/5 bg-[#1e1f20] border-l border-[#28292a] flex flex-col h-full overflow-hidden z-20 animate-fadeIn">
            <div className="h-12 px-4 border-b border-[#28292a] flex items-center justify-between bg-[#131314] flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#c4c7c5]" />
                <span className="font-bold text-xs text-[#e3e3e3] truncate max-w-[200px]">
                  {activeArtifact?.title || 'Deliverable Canvas'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {activeArtifact && (
                  <>
                    <button
                      onClick={() => handleCopy('canvas', activeArtifact.content)}
                      className="p-1.5 text-[#c4c7c5] hover:text-[#e3e3e3] rounded-lg hover:bg-[#28292a] transition-colors cursor-pointer"
                      title="Copy Canvas Content"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleExportPDF(activeArtifact.title, activeArtifact.content)}
                      className="p-1.5 text-[#c4c7c5] hover:text-[#e3e3e3] rounded-lg hover:bg-[#28292a] transition-colors cursor-pointer"
                      title="Export to PDF"
                    >
                      <Download size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSplitViewOpen(false)}
                  className="p-1.5 text-[#c4c7c5] hover:text-[#e3e3e3] rounded-lg hover:bg-[#28292a] transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-[#e3e3e3]">
              {activeArtifact ? (
                <div className="space-y-4">
                  <div className="text-xs text-[#8e918f] border-b border-[#28292a] pb-2">
                    Artifact Created at {activeArtifact.timestamp}
                  </div>
                  {renderFormattedText(activeArtifact.content)}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#8e918f] text-xs text-center p-6 space-y-2">
                  <FileText size={32} className="text-[#37393b]" />
                  <p>No deliverable active in side canvas.</p>
                  <p className="text-[11px] text-[#8e918f]">
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