import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, X, Cloud, Sparkles, CheckCircle2, AlertCircle, Loader2,
  File as FileIcon, FolderPlus, ArrowRight, Database, Check, ShieldCheck, Zap
} from 'lucide-react';
import { DocumentItem } from '../types';
import { parseFileContent, ParsedFileResult } from '../lib/fileParser';
import { fileDataCache } from '../lib/pdfGenerator';
import { auth, uploadDocumentFile } from '../lib/firebase';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newDoc: DocumentItem, parsedFile?: ParsedFileResult) => void;
  documents: DocumentItem[];
  onSelectExistingDocument?: (doc: DocumentItem) => void;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
  onAllUploadsComplete?: () => void;
  targetFolderId?: string | null;
}

interface FileProgressItem {
  id: string;
  name: string;
  sizeBytes: number;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'ready' | 'error';
  stepMessage: string;
  category?: 'Legal' | 'Legislative' | 'Financial' | 'Research';
}

const STORAGE_TIMEOUT_MS = 120000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function detectDocumentType(title: string): DocumentItem['type'] {
  const extension = title.split('.').pop()?.toLowerCase() || '';
  if (extension === 'doc' || extension === 'docx') return 'docx' as DocumentItem['type'];
  if (extension === 'xlsx' || extension === 'xls') return 'xlsx' as DocumentItem['type'];
  if (extension === 'csv') return 'csv' as DocumentItem['type'];
  if (extension === 'pdf') return 'pdf' as DocumentItem['type'];
  if (extension === 'pptx') return 'pptx' as DocumentItem['type'];
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return 'image' as DocumentItem['type'];
  return 'txt' as DocumentItem['type'];
}

function inferCategory(title: string, text: string): FileProgressItem['category'] {
  const haystack = `${title} ${text.slice(0, 4000)}`.toLowerCase();
  if (/invoice|balance sheet|income statement|financial|budget|expense|revenue|10-k|10q|bank statement/.test(haystack)) return 'Financial';
  if (/bill|statute|legislation|legislative|regulation|ordinance|committee|senate|house of representatives/.test(haystack)) return 'Legislative';
  if (/contract|agreement|lease|nda|indemnity|indemnification|legal|litigation|terms/.test(haystack)) return 'Legal';
  return 'Research';
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen, onClose, onUploadSuccess, initialFiles, onInitialFilesConsumed, onAllUploadsComplete, targetFolderId
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<FileProgressItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      handleFilesSelected(initialFiles);
      onInitialFilesConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFiles]);

  if (!isOpen) return null;

  const simulateProgress = async (fileId: string, fileObj?: File, titleOverride?: string) => {
    const title = titleOverride || (fileObj ? fileObj.name : 'Untitled Document.pdf');
    const sizeBytes = fileObj ? fileObj.size : 1024 * 350;
    const updateItem = (updates: Partial<FileProgressItem>) => {
      setUploadingFiles((prev) => prev.map((item) => item.id === fileId ? { ...item, ...updates } : item));
    };

    try {
      updateItem({ progress: 10, status: 'uploading', stepMessage: 'Uploading document payload...' });
      await new Promise((r) => setTimeout(r, 200));
      updateItem({ progress: 35, status: 'uploading', stepMessage: 'Parsing file structure & metadata...' });

      let parsedResult: ParsedFileResult | undefined;
      let extractedText = `Uploaded enterprise document "${title}".`;
      if (fileObj) {
        parsedResult = await parseFileContent(fileObj);
        extractedText = parsedResult.extractedText || extractedText;
        if (extractedText.startsWith('[Error parsing') || extractedText.startsWith('Cannot extract text')) {
          throw new Error(extractedText.slice(0, 500));
        }
      } else {
        await new Promise((r) => setTimeout(r, 250));
      }

      const category = inferCategory(title, extractedText);
      updateItem({ progress: 55, status: 'processing', stepMessage: 'Reading your document...', category });
      await new Promise((r) => setTimeout(r, 300));
      updateItem({ progress: 75, status: 'processing', stepMessage: 'Making it searchable...' });

      let backendData: any = {};
      try {
        const res = await fetch('/api/documents/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, textContent: extractedText.slice(0, 100000), spreadsheetData: parsedResult?.spreadsheetData })
        });
        if (!res.ok) {
          const message = await res.text().catch(() => 'Document processing failed');
          throw new Error(`Document processing failed (${res.status}): ${message.slice(0, 240)}`);
        }
        backendData = await res.json();
      } catch (apiErr) {
        // AI enrichment is useful but the source file can still be persisted safely.
        // Do not mark the upload failed merely because enrichment is temporarily down.
        console.warn('Document AI processing unavailable; continuing with local extraction:', apiErr);
      }

      updateItem({ progress: 88, status: 'processing', stepMessage: 'Saving to secure storage...' });
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      let fileUrl = '';
      if (fileObj) {
        if (!auth.currentUser) throw new Error('Your session expired. Please sign in again and retry the upload.');
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Secure storage upload timed out after 120 seconds.')), STORAGE_TIMEOUT_MS)
        );
        try {
          fileUrl = await Promise.race([uploadDocumentFile(fileObj, docId), timeoutPromise]);
        } catch (storageErr) {
          throw new Error(`Could not save the original file to secure storage: ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`);
        }
      }

      const detectedType = detectDocumentType(title);
      updateItem({ progress: 95, status: 'processing', stepMessage: 'Generating summary...' });

      let aiSummary = '';
      try {
        const summaryRes = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentText: extractedText, documentTitle: title, documentType: detectedType })
        });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          aiSummary = summaryData.summary || '';
        } else {
          console.warn('Summary generation returned', summaryRes.status);
        }
      } catch (err) {
        console.warn('Failed to generate AI summary; keeping document available:', err);
      }

      const now = new Date().toISOString();
      const owner = auth.currentUser?.email || 'Unknown user';
      const organization = auth.currentUser?.displayName || 'Signal87 AI';
      const fallbackTags = ['Uploaded', category || 'Research'];
      const newDoc: DocumentItem & { fullText?: string } = {
        id: docId,
        title,
        type: detectedType,
        sizeBytes,
        uploadDate: now,
        tags: backendData.suggestedTags?.length ? backendData.suggestedTags : fallbackTags,
        owner,
        organization,
        status: 'ready',
        aiIndexed: Boolean(backendData && Object.keys(backendData).length),
        embeddingsComplete: Boolean(backendData && Object.keys(backendData).length),
        versionHistory: [{ version: 1, updatedAt: now, updatedBy: owner, changeNote: 'Initial upload' }],
        permissions: 'Organization',
        summary: aiSummary || backendData.summary || (parsedResult ? `Ready — ${parsedResult.summaryInfo}` : 'Document uploaded and ready to search.'),
        entities: backendData.entities || [{ name: title, type: 'Document', relevance: 90 }],
        riskHighlights: backendData.riskHighlights || [],
        contentPreview: extractedText,
        fullText: extractedText,
        category: category || 'Research',
        projectIds: [],
        fileUrl,
        folderId: targetFolderId || undefined
      };

      if (fileObj) {
        try { fileDataCache.set(newDoc.id, await fileObj.arrayBuffer()); }
        catch (err) { console.warn('Failed to cache uploaded file buffer:', err); }
      }

      updateItem({ progress: 100, status: 'ready', stepMessage: 'Ready' });
      onUploadSuccess(newDoc as DocumentItem, parsedResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateItem({ progress: 0, status: 'error', stepMessage: message.slice(0, 180) });
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const validFiles = files.filter((file) => file.size > 0 && file.size <= MAX_FILE_SIZE_BYTES);
    const rejected = files.filter((file) => file.size === 0 || file.size > MAX_FILE_SIZE_BYTES);
    const newItems: FileProgressItem[] = validFiles.map((file, idx) => ({
      id: `up-${Date.now()}-${idx}`, name: file.name, sizeBytes: file.size, progress: 0,
      status: 'queued', stepMessage: 'Queued for processing'
    }));
    const rejectedItems: FileProgressItem[] = rejected.map((file, idx) => ({
      id: `rejected-${Date.now()}-${idx}`, name: file.name, sizeBytes: file.size, progress: 0,
      status: 'error', stepMessage: file.size > MAX_FILE_SIZE_BYTES ? 'File exceeds the 50MB upload limit' : 'File is empty'
    }));
    setUploadingFiles((prev) => [...prev, ...newItems, ...rejectedItems]);
    setIsProcessing(validFiles.length > 0);
    let finished = 0;
    for (let i = 0; i < validFiles.length; i++) {
      await simulateProgress(newItems[i].id, validFiles[i]);
      finished++;
      setCompletedCount((prev) => prev + 1);
      setOverallProgress(Math.round((finished / Math.max(validFiles.length, 1)) * 100));
    }
    setIsProcessing(false);

    if (validFiles.length > 0) {
      setTimeout(() => {
        onAllUploadsComplete?.();
        handleCloseModal();
      }, 1200);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.length) handleFilesSelected((Array.from(e.dataTransfer.files) as File[]).filter((f) => f.size > 0));
  };
  const handleCloseModal = () => { setUploadingFiles([]); setIsProcessing(false); setOverallProgress(0); setCompletedCount(0); onClose(); };
  const totalProgress = uploadingFiles.length ? Math.round(uploadingFiles.reduce((acc, curr) => acc + curr.progress, 0) / uploadingFiles.length) : 0;

  return (
    <div className="fixed inset-0 bg-[#131C25]/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#FFFFFF] rounded-2xl max-w-xl w-full border border-[#D3D9DE] text-[#131C25] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[#D3D9DE] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2.5"><div className="p-2 bg-[#131C25] text-white rounded-xl"><Upload size={18} className="text-[#F0B429]" /></div><div><h2 className="text-base font-extrabold text-[#131C25]">{uploadingFiles.length > 0 ? 'Document Ingestion' : 'Upload Documents'}</h2><span className="font-mono text-[10px] font-bold text-[#6E7C89] uppercase tracking-wider block">{uploadingFiles.length > 0 ? `${completedCount} of ${uploadingFiles.length} files processed` : 'AI Vector Indexing & Text Extraction'}</span></div></div>
          <button onClick={handleCloseModal} className="p-1.5 text-[#3D4B58] hover:text-[#131C25] hover:bg-[#EDEFF2] rounded-lg cursor-pointer transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden ${dragActive ? 'border-[#0F6E66] bg-[#E8F2F0] scale-[0.99]' : 'border-[#D3D9DE] hover:border-[#131C25] bg-[#F8F9FA] hover:bg-[#EDEFF2]/60'}`}>
            <input ref={fileInputRef} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg,.webp" onChange={(e) => { if (e.target.files?.length) handleFilesSelected((Array.from(e.target.files) as File[]).filter((f) => f.size > 0)); }} />
            <div className="w-12 h-12 rounded-full bg-[#131C25] text-[#F0B429] flex items-center justify-center"><Cloud size={24} /></div>
            <div className="space-y-1"><p className="text-sm font-extrabold text-[#131C25]">Drag and drop files here, or <span className="text-[#0F6E66] underline">browse files</span></p><p className="text-xs text-[#6E7C89] font-medium">Supports PDF, DOC, DOCX, XLS, XLSX, CSV, PPTX, TXT, and Images up to 50MB</p></div>
            <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-[#0F6E66] font-bold"><ShieldCheck size={14} /><span>We read and index every file automatically</span></div>
          </div>
          {uploadingFiles.length > 0 && <div className="p-4 bg-[#F8F9FA] border border-[#D3D9DE] rounded-xl space-y-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2">{isProcessing ? <Loader2 size={16} className="text-[#0F6E66] animate-spin" /> : <CheckCircle2 size={16} className="text-[#0F6E66]" />}<span className="font-bold text-xs text-[#131C25]">{isProcessing ? 'Processing & Indexing Files...' : 'Upload Complete'}</span></div><span className="font-mono text-xs font-extrabold text-[#0F6E66]">{totalProgress}%</span></div><div className="w-full h-3 bg-[#D3D9DE] rounded-full overflow-hidden p-0.5 relative"><div className="h-full bg-gradient-to-r from-[#0F6E66] to-[#F0B429] rounded-full transition-all duration-300" style={{ width: `${totalProgress}%` }} /></div><p className="text-[11px] font-mono text-[#6E7C89] flex items-center justify-between"><span>{isProcessing ? 'Reading your documents...' : 'All documents ready to search'}</span><span className="font-bold text-[#131C25]">{completedCount}/{uploadingFiles.length}</span></p></div>}
          {uploadingFiles.length > 0 && <div className="space-y-2.5"><h4 className="text-xs font-bold text-[#6E7C89] uppercase font-mono">Uploaded Files Queue ({uploadingFiles.length})</h4><div className="space-y-2 max-h-56 overflow-y-auto pr-1">{uploadingFiles.map((file) => <div key={file.id} className="p-3 bg-[#FFFFFF] border border-[#D3D9DE] rounded-xl space-y-2"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><FileIcon size={16} className="text-[#131C25] flex-shrink-0" /><div className="min-w-0"><h5 className="font-bold text-xs text-[#131C25] truncate">{file.name}</h5><p className="font-mono text-[10px] text-[#6E7C89]">{(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p></div></div><div>{file.status === 'ready' ? <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E8F2F0] text-[#0F6E66] uppercase flex items-center gap-1"><Check size={11} /> Ready</span> : file.status === 'error' ? <span className="font-mono text-[10px] font-bold text-red-600 uppercase flex items-center gap-1"><AlertCircle size={12} /> Error</span> : <span className="font-mono text-[10px] text-[#6E7C89] uppercase">{file.progress}%</span>}</div></div><div className="w-full h-1.5 bg-[#EDEFF2] rounded-full overflow-hidden"><div className="h-full bg-[#0F6E66] transition-all duration-300" style={{ width: `${file.progress}%` }} /></div><p className="text-[10px] text-[#6E7C89] font-mono">{file.stepMessage}</p></div>)}</div></div>}
        </div>
      </div>
    </div>
  );
};
