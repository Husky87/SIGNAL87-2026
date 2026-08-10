import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Check,
  RefreshCw,
  FileText,
  Table,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Info,
  ExternalLink,
  FolderOpen
} from 'lucide-react';
import {
  DriveFile,
  getDriveAccessToken,
  authenticateGoogleDrive,
  fetchDriveFiles,
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
  const [token, setToken] = useState<string | null>(getDriveAccessToken());
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'document' | 'spreadsheet' | 'pdf'>('all');
  
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentToken = getDriveAccessToken();
      setToken(currentToken);
      if (currentToken) {
        loadFiles(currentToken);
      }
    }
  }, [isOpen]);

  const loadFiles = async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const driveFiles = await fetchDriveFiles(authToken, searchQuery, categoryFilter);
      setFiles(driveFiles);
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED' || err.message?.includes('401')) {
        setToken(null);
        setError('Google authentication expired. Please click "Connect Google Workspace" below to reconnect.');
      } else {
        setError(err.message || 'Failed to access Google Workspace files');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectDrive = async () => {
    setAuthenticating(true);
    setError(null);
    try {
      const newAuthToken = await authenticateGoogleDrive();
      setToken(newAuthToken);
      await loadFiles(newAuthToken);
    } catch (err: any) {
      console.error('Google Drive Auth error:', err);
      setError(err.message || 'Failed to authenticate with Google Workspace');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      loadFiles(token);
    }
  };

  const toggleSelectFile = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === files.length && files.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  const handleStartPorting = async () => {
    if (!token || selectedIds.size === 0) return;

    setImporting(true);
    setError(null);
    const selectedFiles = files.filter((f) => selectedIds.has(f.id));
    const importedDocs: DocumentItem[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const driveFile = selectedFiles[i];
        setImportStep(`[${i + 1}/${selectedFiles.length}] Porting "${driveFile.name}"...`);
        const { doc } = await importFileFromDrive(token, driveFile, (msg) => {
          setImportStep(`[${i + 1}/${selectedFiles.length}] ${msg}`);
        });
        importedDocs.push(doc);
      }

      onPortSuccess(importedDocs);
      setSelectedIds(new Set());
      onClose();
    } catch (err: any) {
      console.error('Error porting Google Drive files:', err);
      setError(err.message || 'Failed to port files from Google Workspace');
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

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      return new Date(isoStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
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
                <h2 className="text-base font-bold text-white">Google Workspace Porting Hub</h2>
                <span className="text-[10px] font-mono font-extrabold uppercase bg-sky-500/20 text-[#7dd3fc] border border-sky-500/30 px-2 py-0.5 rounded-full">
                  Direct Integration
                </span>
              </div>
              <p className="text-xs text-[#c4c7c5]">
                Select files from your Google Workspace for instant OCR, legal parsing & AI memory indexing
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
          
          {/* Unauthenticated / Auth Connect Banner */}
          {!token ? (
            <div className="py-8 px-6 bg-gradient-to-br from-[#1e1f20] to-[#131314] border border-[#37393b] rounded-2xl flex flex-col items-center justify-center text-center space-y-4 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-[#28292a] border border-[#37393b] flex items-center justify-center text-[#7dd3fc]">
                <FolderOpen size={32} />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-bold text-white">Connect Your Google Workspace Account</h3>
                <p className="text-xs text-[#c4c7c5] leading-relaxed">
                  Authorize Signal87 AI to list and import Google Docs, Sheets, PDFs, and legal briefs securely.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl max-w-md w-full">
                  {error}
                </div>
              )}

              <button
                onClick={handleConnectDrive}
                disabled={authenticating}
                className="px-6 py-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2.5 active:scale-95 disabled:opacity-50"
              >
                {authenticating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Connecting to Google OAuth...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span>Connect Google Workspace</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 text-[11px] text-[#8e918f]">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Read-only file access. Your credentials are never stored.</span>
              </div>
            </div>
          ) : (
            /* Authenticated File Picker Interface */
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              
              {/* Controls Header: Search & Category Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0">
                <form onSubmit={handleSearchSubmit} className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e918f]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Google Workspace files..."
                    className="w-full pl-10 pr-20 py-2 bg-[#131314] border border-[#37393b] rounded-xl text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-[#1a73e8]"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#28292a] hover:bg-[#37393b] text-xs font-semibold text-[#7dd3fc] rounded-lg transition-colors cursor-pointer"
                  >
                    Search
                  </button>
                </form>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 bg-[#131314] p-1 border border-[#37393b] rounded-xl overflow-x-auto scrollbar-none">
                  {(
                    [
                      { id: 'all', label: 'All Files' },
                      { id: 'document', label: 'Docs' },
                      { id: 'spreadsheet', label: 'Sheets' },
                      { id: 'pdf', label: 'PDFs' }
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setCategoryFilter(cat.id);
                        if (token) loadFiles(token);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
 categoryFilter === cat.id
 ? 'bg-[#1a73e8] text-white '
 : 'text-[#c4c7c5] hover:text-white hover:bg-[#28292a]'
 }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => token && loadFiles(token)}
                  disabled={loading}
                  className="p-2 bg-[#131314] border border-[#37393b] hover:bg-[#28292a] text-[#c4c7c5] hover:text-white rounded-xl transition-colors cursor-pointer flex-shrink-0 flex items-center justify-center"
                  title="Refresh Files"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between">
                  <span>{error}</span>
                  <button
                    onClick={handleConnectDrive}
                    className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    Reconnect Workspace
                  </button>
                </div>
              )}

              {/* Drive File List Header Bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#131314] border border-[#37393b] rounded-xl text-xs font-semibold text-[#8e918f] flex-shrink-0">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
                >
                  {selectedIds.size > 0 && selectedIds.size === files.length ? (
                    <CheckSquare size={16} className="text-[#1a73e8]" />
                  ) : (
                    <Square size={16} />
                  )}
                  <span>
                    Select All ({selectedIds.size}/{files.length})
                  </span>
                </button>

                <div className="flex items-center gap-4 text-[11px]">
                  <span>Last Modified</span>
                  <span>Size</span>
                </div>
              </div>

              {/* Scrollable Files List Container */}
              <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[380px] space-y-1.5 pr-1">
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center space-y-3 text-[#c4c7c5]">
                    <RefreshCw size={24} className="animate-spin text-[#1a73e8]" />
                    <span className="text-xs font-semibold">Fetching Google Workspace directory...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center space-y-2 text-[#8e918f]">
                    <FolderOpen size={32} />
                    <span className="text-xs font-semibold">No matching Google Workspace files found</span>
                    <p className="text-[11px] text-[#c4c7c5]">
                      Try adjusting your search filter or uploading documents to Google Workspace.
                    </p>
                  </div>
                ) : (
                  files.map((file) => {
                    const isSelected = selectedIds.has(file.id);
                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleSelectFile(file.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
 isSelected
 ? 'bg-[#004a77]/30 border-[#1a73e8] '
 : 'bg-[#131314] border-[#28292a] hover:border-[#37393b] hover:bg-[#1e1f20]'
 }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectFile(file.id);
                            }}
                            className="p-0.5 text-[#8e918f] hover:text-white transition-colors cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare size={18} className="text-[#1a73e8]" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>

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

                        <div className="flex items-center gap-4 text-right flex-shrink-0 text-[11px] text-[#c4c7c5]">
                          <span className="hidden sm:inline">{formatDate(file.modifiedTime)}</span>
                          <span className="w-16 font-mono text-right">{formatFileSize(file.size)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Import Processing Overlay */}
          {importing && (
            <div className="p-4 bg-[#004a77]/30 border border-[#1a73e8] rounded-2xl flex items-center gap-3 animate-pulse">
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
              className="px-4 py-2 bg-[#28292a] hover:bg-[#37393b] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {token && (
              <button
                onClick={handleStartPorting}
                disabled={selectedIds.size === 0 || importing}
                className="px-5 py-2.5 bg-gradient-to-r from-[#1a73e8] to-sky-500 hover:from-[#1557b0] hover:to-sky-400 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <Sparkles size={15} />
                <span>Port {selectedIds.size > 0 ? selectedIds.size : ''} File(s) into Signal87</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
