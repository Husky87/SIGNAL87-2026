import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  FileText,
  Table,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Info,
  Trash2,
  Plus,
  FolderOpen
} from 'lucide-react';
import {
  DriveFile,
  pickFilesFromDrive,
  importFileFromDrive
} from '../lib/googleDriveService';
import { DocumentItem } from '../types';

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPortSuccess: (newDocs: DocumentItem[]) => void;
  onOpenIntro?: () => void;
}

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  onPortSuccess,
  onOpenIntro
}) => {
  const [pickedFiles, setPickedFiles] = useState<DriveFile[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Start each visit from a clean slate — a stale selection from a previous
  // open is more confusing than an empty picker.
  useEffect(() => {
    if (isOpen) {
      setPickedFiles([]);
      setError(null);
      setImportStep('');
    }
  }, [isOpen]);

  const handleChooseFiles = async () => {
    setChoosing(true);
    setError(null);
    try {
      const { token: driveToken, files } = await pickFilesFromDrive();
      setToken(driveToken);

      if (files.length > 0) {
        // Merge, skipping anything already staged.
        setPickedFiles((prev) => {
          const seen = new Set(prev.map((f) => f.id));
          return [...prev, ...files.filter((f) => !seen.has(f.id))];
        });
      }
    } catch (err: any) {
      console.error('Google Drive picker error:', err);
      setError(err.message || 'Could not open Google Drive. Please try again.');
    } finally {
      setChoosing(false);
    }
  };

  const removeFile = (id: string) => {
    setPickedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleStartPorting = async () => {
    if (!token || pickedFiles.length === 0) return;

    setImporting(true);
    setError(null);
    const importedDocs: DocumentItem[] = [];

    try {
      for (let i = 0; i < pickedFiles.length; i++) {
        const driveFile = pickedFiles[i];
        setImportStep(`[${i + 1}/${pickedFiles.length}] Porting "${driveFile.name}"...`);
        const { doc } = await importFileFromDrive(token, driveFile, (msg) => {
          setImportStep(`[${i + 1}/${pickedFiles.length}] ${msg}`);
        });
        importedDocs.push(doc);
      }

      onPortSuccess(importedDocs);
      setPickedFiles([]);
      onClose();
    } catch (err: any) {
      console.error('Error porting Google Drive files:', err);
      if (err.message === 'UNAUTHORIZED') {
        setToken(null);
        setError('Google access expired. Choose your files again to reconnect.');
      } else {
        setError(err.message || 'Failed to port files from Google Drive');
      }
    } finally {
      setImporting(false);
    }
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return 'Google Doc';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return 'Google Doc';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMimeIcon = (mimeType: string) => {
    if (mimeType.includes('document') || mimeType.includes('word')) {
      return <FileText size={18} className="text-sky-400" />;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      return <Table size={18} className="text-emerald-400" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText size={18} className="text-rose-400" />;
    }
    return <FolderOpen size={18} className="text-amber-400" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#18191a] rounded-3xl max-w-3xl w-full border border-[#37393b] text-[#e3e3e3] overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#28292a] flex items-center justify-between bg-[#131314] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--teal)] text-white flex items-center justify-center">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 87.3 78">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.4.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.4-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                <path d="m43.65 25 13.75 23.8h27.5c0-1.55-.4-3.1-1.2-4.5l-25.4-44c-.8-1.4-1.9-2.5-3.3-3.3z" fill="#00832d"/>
                <path d="m57.4 48.8-13.75 23.8c1.4.8 2.95 1.2 4.5 1.2h54.8c1.55 0 3.1-.4 4.5-1.2l-13.75-23.8z" fill="#2684fc"/>
                <path d="m13.75 25 13.75 23.8 13.75-23.8-13.75-23.8z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Import from Google Drive</h2>
                <span className="text-[10px] font-mono font-extrabold uppercase bg-sky-500/20 text-[#7dd3fc] border border-sky-500/30 px-2 py-0.5 rounded-full">
                  Per-file access
                </span>
              </div>
              <p className="text-xs text-[#c4c7c5]">
                Choose documents in Google's own picker for OCR, legal parsing & AI memory indexing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenIntro && (
              <button
                onClick={onOpenIntro}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#28292a] hover:bg-[#37393b] text-[#7dd3fc] border border-[#37393b] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Info size={14} />
                <span>Integration Guide</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-[#c4c7c5] hover:text-white hover:bg-[#28292a] rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto flex flex-col space-y-4 min-h-0">

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex-shrink-0">
              {error}
            </div>
          )}

          {pickedFiles.length === 0 ? (
            /* Empty state — the only way in is Google's picker */
            <div className="py-8 px-6 bg-gradient-to-br from-[#1e1f20] to-[#131314] border border-[#37393b] rounded-2xl flex flex-col items-center justify-center text-center space-y-4 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-[#28292a] border border-[#37393b] flex items-center justify-center text-[#7dd3fc]">
                <FolderOpen size={32} />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-bold text-white">Choose documents from Google Drive</h3>
                <p className="text-xs text-[#c4c7c5] leading-relaxed">
                  Signal87 AI opens Google's own file picker. Only the documents you select there
                  are shared with Signal87 AI — the rest of your Drive stays private.
                </p>
              </div>

              <button
                onClick={handleChooseFiles}
                disabled={choosing}
                className="px-6 py-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2.5 active:scale-95 disabled:opacity-50"
              >
                {choosing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Opening Google Drive...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span>Choose from Google Drive</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 text-[11px] text-[#8e918f]">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Access is limited to the files you pick. Your credentials are never stored.</span>
              </div>
            </div>
          ) : (
            /* Staged selection */
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-2 bg-[#131314] border border-[#37393b] rounded-xl text-xs font-semibold text-[#8e918f] flex-shrink-0">
                <span>
                  {pickedFiles.length} file{pickedFiles.length === 1 ? '' : 's'} ready to import
                </span>
                <button
                  onClick={handleChooseFiles}
                  disabled={choosing || importing}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#28292a] hover:bg-[#37393b] disabled:opacity-40 text-[#7dd3fc] rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  {choosing ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  <span>Add more</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-[180px] max-h-[380px] space-y-1.5 pr-1">
                {pickedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-2xl border bg-[#131314] border-[#28292a] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-[#28292a] rounded-xl flex-shrink-0">
                        {getMimeIcon(file.mimeType)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate leading-tight">
                          {file.name}
                        </h4>
                        <p className="text-[11px] text-[#8e918f] truncate mt-0.5">
                          {file.mimeType.replace('application/vnd.google-apps.', 'Google ').replace('application/', '')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 text-[11px] text-[#c4c7c5]">
                      <span className="w-16 font-mono text-right hidden sm:inline">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        onClick={() => removeFile(file.id)}
                        disabled={importing}
                        title={`Remove ${file.name}`}
                        className="p-1.5 text-[#8e918f] hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Processing Overlay */}
          {importing && (
            <div className="p-4 bg-[#004a77]/30 border border-[#1a73e8] rounded-2xl flex items-center gap-3 animate-pulse flex-shrink-0">
              <RefreshCw size={20} className="animate-spin text-[#7dd3fc]" />
              <div>
                <h4 className="text-xs font-bold text-white">Signal87 Ingestion Pipeline Running</h4>
                <p className="text-[11px] text-[#7dd3fc] font-mono">{importStep}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-[#131314] border-t border-[#28292a] flex items-center justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 text-xs text-[#8e918f]">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className="hidden sm:inline">Zero-Hallucination Vector Indexing</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 bg-[#28292a] hover:bg-[#37393b] disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {pickedFiles.length > 0 && (
              <button
                onClick={handleStartPorting}
                disabled={importing}
                className="px-5 py-2.5 bg-gradient-to-r from-[#1a73e8] to-sky-500 hover:from-[#1557b0] hover:to-sky-400 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <Sparkles size={15} />
                <span>Port {pickedFiles.length} File{pickedFiles.length === 1 ? '' : 's'} into Signal87</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
