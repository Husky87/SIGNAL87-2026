import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { DocumentLibraryView } from './components/DocumentLibraryView';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { DocumentDetailModal } from './components/DocumentDetailModal';
import { ResearchAssistantView } from './components/ResearchAssistantView';
import { MultiDocCompareView } from './components/MultiDocCompareView';
import { ReportsView } from './components/ReportsView';
import { OrganizationView } from './components/OrganizationView';
import { TracesView } from './components/TracesView';
import { AdminView } from './components/AdminView';
import { SavedSearchesView } from './components/SavedSearchesView';
import { TeamView } from './components/TeamView';
import { Footer } from './components/Footer';
import { PrivacyModal } from './components/PrivacyModal';
import { BlogModal } from './components/BlogModal';
import { MediaModal } from './components/MediaModal';
import { QuickAIAgentWidget } from './components/QuickAIAgentWidget';
import { LandingPageView } from './components/LandingPageView';
import { WelcomeTourModal } from './components/WelcomeTourModal';
import { GoogleDrivePickerModal } from './components/GoogleDrivePickerModal';
import { GoogleDriveIntroModal } from './components/GoogleDriveIntroModal';
import { AuthErrorModal } from './components/AuthErrorModal';
import { Signal87Logo } from './components/Signal87Logo';
import { MobileDock } from './components/MobileDock';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider } from './lib/firebase';
import { LogIn, Sparkles, X, Menu, ChevronDown, Check } from 'lucide-react';

import {
  INITIAL_DOCUMENTS,
  INITIAL_REPORT_TEMPLATES,
  INITIAL_REPORTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_ORG_STATS
} from './data/mockData';

import { DocumentItem, FolderItem, GeneratedReport, ChatMessage } from './types';
import {
  fetchDocumentsFromFirestore,
  saveDocumentToFirestore,
  deleteDocumentFromFirestore,
  fetchReportsFromFirestore,
  saveReportToFirestore
} from './lib/firestoreService';

/* iOS shrinks the visual viewport when the keyboard opens but leaves the
   layout viewport alone, which is why bottom-docked controls disappear.
   Track the real visible height and pin the shell to it. */
function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = window.innerHeight - (vv.height + vv.offsetTop);
        setHeight(covered > 60 ? vv.height : null);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return height;
}

export default function App() {
  const visualHeight = useVisualViewportHeight();
  const [currentTab, setCurrentTab] = useState<NavTab>('research');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthBanner, setShowAuthBanner] = useState(true);

  // Core Data States
  const [folders, setFolders] = useState<FolderItem[]>(() => {
    try {
      const stored = localStorage.getItem('signal87_folders');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed loading folders from localStorage', e);
    }
    return [
      { id: 'fld_contracts', name: 'Legal & Contracts', color: '#1a73e8', parentId: null, createdAt: new Date().toISOString() },
      { id: 'fld_financials', name: 'Financial Disclosures', color: '#0f9d58', parentId: null, createdAt: new Date().toISOString() },
      { id: 'fld_governance', name: 'Board Minutes', color: '#f4b400', parentId: null, createdAt: new Date().toISOString() }
    ];
  });

  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    try {
      const stored = localStorage.getItem('signal87_documents');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed loading documents from localStorage', e);
    }
    return INITIAL_DOCUMENTS;
  });

  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; size: string; dataUrl?: string }[]>(() => {
    try {
      const stored = localStorage.getItem('signal87_attached_files');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [reports, setReports] = useState<GeneratedReport[]>(() => {
    try {
      const stored = localStorage.getItem('signal87_reports');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed loading reports from localStorage', e);
    }
    return INITIAL_REPORTS;
  });

  const [auditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [stats, setStats] = useState(INITIAL_ORG_STATS);

  // Persist documents to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('signal87_documents', JSON.stringify(documents));
    } catch (e) {
      console.warn('Failed saving documents to localStorage', e);
    }
  }, [documents]);

  // Persist attachedFiles to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('signal87_attached_files', JSON.stringify(attachedFiles));
    } catch (e) {}
  }, [attachedFiles]);

  // Persist folders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('signal87_folders', JSON.stringify(folders));
    } catch (e) {
      console.warn('Failed saving folders to localStorage', e);
    }
  }, [folders]);

  // Folder Action Handlers
  const handleCreateFolder = (name: string, color?: string) => {
    const newFld: FolderItem = {
      id: `fld_${Date.now()}`,
      name,
      color: color || '#1a73e8',
      parentId: null,
      createdAt: new Date().toISOString()
    };
    setFolders((prev) => [...prev, newFld]);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: newName, updatedAt: new Date().toISOString() } : f))
    );
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setDocuments((prev) =>
      prev.map((d) => (d.folderId === folderId ? { ...d, folderId: undefined } : d))
    );
  };

  const handleMoveDocument = (docId: string, folderId: string | undefined) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, folderId } : d))
    );
  };

  // Persist reports to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('signal87_reports', JSON.stringify(reports));
    } catch (e) {}
  }, [reports]);

  // UI Modal States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [isDriveIntroOpen, setIsDriveIntroOpen] = useState(false);
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DocumentItem | null>(null);

  const handleDrivePortSuccess = (newDocs: DocumentItem[]) => {
    setDocuments((prev) => [...newDocs, ...prev]);
    newDocs.forEach((doc) => {
      setAttachedFiles((prev) => [
        ...prev.filter((f) => f.id !== doc.id),
        { id: doc.id, name: doc.title, size: `${(doc.sizeBytes / 1024).toFixed(1)} KB` }
      ]);
      saveDocumentToFirestore(doc).catch((err) =>
        console.warn('Firestore document save fallback:', err)
      );
    });
  };
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.6-flash');
  const [showMobileModelMenu, setShowMobileModelMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getModelLabel = (model: string) => {
    if (model === 'gemini-3.1-pro-preview') return 'Signal87 Deep';
    if (model === 'gemini-3.1-flash-lite') return 'Signal87 Fast';
    return 'Signal87 Standard';
  };
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isBlogOpen, setIsBlogOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [inDemoMode, setInDemoMode] = useState(false);
  const [authError, setAuthError] = useState<{ code?: string; message?: string } | null>(null);
  const [sessions, setSessions] = useState(() => {
    try {
      const stored = localStorage.getItem('signal87_sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed loading sessions from localStorage', e);
    }
    return [
      { id: 's1', title: 'Boston Ordinance Analysis', timestamp: 'Today, 10:24 AM' },
      { id: 's2', title: 'Lease Indemnification Review', timestamp: 'Yesterday' },
      { id: 's3', title: 'Q3 Financial Metrics Extraction', timestamp: '2 days ago' },
      { id: 's4', title: 'Healthcare Reform Comparison', timestamp: '3 days ago' }
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      const storedActive = localStorage.getItem('signal87_active_session_id');
      if (storedActive) return storedActive;
    } catch (e) {}
    return 's1';
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Persist sessions array to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('signal87_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed saving sessions to localStorage', e);
    }
  }, [sessions]);

  // Persist activeSessionId to localStorage
  useEffect(() => {
    if (activeSessionId) {
      try {
        localStorage.setItem('signal87_active_session_id', activeSessionId);
      } catch (e) {}
    }
  }, [activeSessionId]);

  // Load chat history for active session ID from localStorage or default
  useEffect(() => {
    if (!activeSessionId) {
      setChatHistory([]);
      return;
    }
    try {
      const storedChat = localStorage.getItem(`signal87_chat_${activeSessionId}`);
      if (storedChat) {
        setChatHistory(JSON.parse(storedChat));
      } else {
        setChatHistory([]);
      }
    } catch (e) {
      console.warn('Error loading chat history for session:', activeSessionId, e);
      setChatHistory([]);
    }
  }, [activeSessionId]);

  // Save chatHistory to localStorage for the active session
  useEffect(() => {
    if (!activeSessionId) return;
    try {
      localStorage.setItem(`signal87_chat_${activeSessionId}`, JSON.stringify(chatHistory));

      // Auto-update thread title if it's currently 'New Research Session' and user has sent a message
      if (chatHistory.length > 0) {
        const firstUserMsg = chatHistory.find((m) => m.role === 'user');
        if (firstUserMsg) {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === activeSessionId && (s.title === 'New Research Session' || s.title === 'New Chat')) {
                const newTitle = firstUserMsg.text.slice(0, 32) + (firstUserMsg.text.length > 32 ? '...' : '');
                return { ...s, title: newTitle };
              }
              return s;
            })
          );
        }
      }
    } catch (e) {
      console.warn('Failed saving chat history to localStorage', e);
    }
  }, [chatHistory, activeSessionId]);

  const mainScrollRef = React.useRef<HTMLDivElement>(null);

  // Ensure document title is always Signal87 AI
  useEffect(() => {
    document.title = 'Signal87 AI';
  }, [currentTab]);

  // Scroll Position Reset on Route/Tab Navigation (Start at Top)
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentTab]);

  // First-Time SaaS Sign-Up & Welcome Email Workflow
  useEffect(() => {
    if (currentUser) {
      const onboardKey = `signal87_onboarded_${currentUser.uid}`;
      const driveIntroKey = `signal87_gdrive_intro_seen_${currentUser.uid}`;
      const hasOnboarded = localStorage.getItem(onboardKey);
      const hasSeenDriveIntro = localStorage.getItem(driveIntroKey);

      if (!hasOnboarded) {
        setIsWelcomeModalOpen(true);
        localStorage.setItem(onboardKey, 'true');

        // Dispatch Transactional Welcome Email
        fetch('/api/auth/welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser.email,
            name: currentUser.displayName
          })
        }).catch((err) => console.warn('Welcome Email Dispatch Error:', err));
      } else if (!hasSeenDriveIntro) {
        setIsDriveIntroOpen(true);
        localStorage.setItem(driveIntroKey, 'true');
      }
    }
  }, [currentUser]);

  // Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setAuthError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initial Sync from Firestore
  useEffect(() => {
    async function syncFirestoreData() {
      // Documents sync
      const remoteDocs = await fetchDocumentsFromFirestore();
      if (remoteDocs && remoteDocs.length > 0) {
        // Merge without duplicates
        setDocuments((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const newUnique = remoteDocs.filter((rd) => !existingIds.has(rd.id));
          return [...newUnique, ...prev];
        });
      }

      // Projects sync
      // Projects removed
      
      // Reports sync
      const remoteReports = await fetchReportsFromFirestore();
      if (remoteReports && remoteReports.length > 0) {
        setReports((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newUnique = remoteReports.filter((rr) => !existingIds.has(rr.id));
          return [...newUnique, ...prev];
        });
      }
    }

    syncFirestoreData();
  }, []);

  // Handlers
  const handleUploadSuccess = (newDoc: DocumentItem, _parsedFile?: any) => {
    setDocuments((prev) => [newDoc, ...prev]);
    saveDocumentToFirestore(newDoc); // Persist to Firestore
    setStats((prev) => ({
      ...prev,
      totalDocs: prev.totalDocs + 1,
      storageUsedBytes: prev.storageUsedBytes + newDoc.sizeBytes
    }));
  };

  const handleDeleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    deleteDocumentFromFirestore(docId); // Delete from Firestore
  };

  const handleSaveReport = (newRep: GeneratedReport) => {
    setReports((prev) => [newRep, ...prev]);
    saveReportToFirestore(newRep); // Persist to Firestore
  };

  const handleCompareFromDocs = (docsToCompare: DocumentItem[]) => {
    setCurrentTab('compare');
  };

  const handleEnterDemoMode = () => {
    const guestUser = {
      uid: 'demo-executive-87',
      displayName: 'Signal87 Guest',
      email: 'guest@signal87.ai',
      photoURL: ''
    };
    setCurrentUser(guestUser as any);
    setInDemoMode(true);
    setAuthError(null);
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn('Firebase Sign-Out Warning:', err);
    }
    // Explicit client-side wipe on logout
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage wipe notice:', e);
    }

    // Reset inputs, active views, and state variables to initial defaults
    setCurrentUser(null);
    setInDemoMode(false);
    setAuthError(null);
    setCurrentTab('research');
    setSelectedDocForDetail(null);
    setSearchQuery('');
    setIsUploadOpen(false);
    setIsWelcomeModalOpen(false);
    setDocuments(INITIAL_DOCUMENTS);
    setAttachedFiles([]);
    setFolders([
      { id: 'fld_contracts', name: 'Legal & Contracts', color: '#1a73e8', parentId: null, createdAt: new Date().toISOString() },
      { id: 'fld_financials', name: 'Financial Disclosures', color: '#0f9d58', parentId: null, createdAt: new Date().toISOString() },
      { id: 'fld_governance', name: 'Board Minutes', color: '#f4b400', parentId: null, createdAt: new Date().toISOString() }
    ]);
    setReports(INITIAL_REPORTS);
  };

  const handleCreateNewSession = () => {
    const newSession = {
      id: `s_${Date.now()}`,
      title: 'New Research Session',
      timestamp: 'Just now'
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setChatHistory([]);
    setCurrentTab('research');
  };

  const handleDeleteSession = (id: string) => {
    try {
      localStorage.removeItem(`signal87_chat_${id}`);
    } catch (e) {}

    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);

    if (activeSessionId === id) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        const freshSession = {
          id: `s_${Date.now()}`,
          title: 'New Research Session',
          timestamp: 'Just now'
        };
        setSessions([freshSession]);
        setActiveSessionId(freshSession.id);
        setChatHistory([]);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      const res = await signInWithPopup(auth, googleProvider);
      if (res && res.user) {
        setCurrentUser(res.user);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setAuthError({
        code: err.code || 'auth/configuration-issue',
        message: err.message || 'Google Sign-In was not completed.'
      });
    }
  };

  const getPageTitle = (tab: NavTab): string => {
    switch (tab) {
      case 'research':
        return 'Signal87 AI';
      case 'documents':
        return 'Documents';
      case 'projects':
        return 'Projects';
      case 'admin':
        return 'Settings & Admin';
      case 'dashboard':
        return 'Dashboard';
      case 'compare':
        return 'Comparison';
      case 'reports':
        return 'AI Reports';
      case 'searches':
        return 'Saved Searches';
      case 'team':
        return 'Team';
      case 'organization':
        return 'Organization';
      default:
        return 'Signal87 AI';
    }
  };

  if (!currentUser) {
    return (
      <>
        <LandingPageView
          onGoogleSignIn={handleGoogleSignIn}
          onEnterDemo={handleEnterDemoMode}
          onOpenPrivacy={() => setIsPrivacyOpen(true)}
          onOpenBlog={() => setIsBlogOpen(true)}
          onOpenMedia={() => setIsMediaOpen(true)}
          onSelectTab={(tab) => {
            if (tab === 'team') {
              const el = document.getElementById('team');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            } else {
              handleEnterDemoMode();
            }
          }}
        />

        <AuthErrorModal
          isOpen={Boolean(authError)}
          error={authError}
          onClose={() => setAuthError(null)}
          onEnterGuestMode={handleEnterDemoMode}
          onRetryGoogleSignIn={handleGoogleSignIn}
        />

        <PrivacyModal
          isOpen={isPrivacyOpen}
          onClose={() => setIsPrivacyOpen(false)}
        />
        <BlogModal
          isOpen={isBlogOpen}
          onClose={() => setIsBlogOpen(false)}
        />
        <MediaModal
          isOpen={isMediaOpen}
          onClose={() => setIsMediaOpen(false)}
        />
      </>
    );
  }

  return (
    <div
      className="s87-app flex h-[100dvh] w-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)] antialiased"
      style={
        visualHeight
          ? { height: `${visualHeight}px` }
          : { height: '100dvh', minHeight: '-webkit-fill-available' }
      }
    >
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setMobileMenuOpen(false);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        documentCount={documents.length}
        projectCount={0}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        onNewSession={handleCreateNewSession}
        recentSessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onDeleteSession={handleDeleteSession}
        onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {/* Main Workspace Area */}
      <div ref={mainScrollRef} className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
        {/* Persistent Mobile Top Header (Authentic Google Drive Pill Search Bar) */}
        <header className="flex md:hidden bg-[var(--paper)] px-4 pt-3.5 pb-2.5 items-center flex-shrink-0 z-30 relative">
          <div className="w-full flex items-center gap-2 bg-[var(--card)] px-3 py-1.5 border border-[var(--rule)] rounded-full shadow-sm hover:shadow transition-shadow">
            {/* Hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] rounded-full flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Input Search - Search documents */}
            <div className="flex-1 flex items-center">
              <input
                type="text"
                placeholder="Search documents"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (currentTab !== 'documents' && currentTab !== 'searches') {
                    setCurrentTab('documents');
                  }
                }}
                className="w-full bg-transparent border-0 text-sm text-[var(--ink)] placeholder-[var(--ink-2)] focus:outline-none py-1"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-[var(--slate)] hover:text-[var(--ink)] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Model Indicator/Selector Button */}
            <button
              onClick={() => setShowMobileModelMenu(!showMobileModelMenu)}
              className="flex items-center gap-1 p-1 px-2 text-[10px] font-bold text-[var(--ink-2)] bg-[var(--paper)] hover:bg-[var(--raised)] rounded-full border border-[var(--rule)] uppercase cursor-pointer"
              title="Change active AI model"
            >
              <Sparkles size={11} className="text-amber-500 animate-pulse" />
              <span className="max-w-[70px] truncate">{selectedModel === 'gemini-3.1-pro-preview' ? 'Deep' : selectedModel === 'gemini-3.1-flash-lite' ? 'Fast' : 'Standard'}</span>
              <ChevronDown size={10} className="text-[var(--slate)]" />
            </button>

            {/* User Avatar */}
            {currentUser ? (
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--paper)] font-bold flex items-center justify-center text-xs overflow-hidden shadow-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}</span>
                )}
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center cursor-pointer hover:opacity-90"
                title="Sign In"
              >
                <LogIn size={13} />
              </button>
            )}
          </div>

          {/* Model selector dropdown for mobile if clicked */}
          {showMobileModelMenu && (
            <div className="absolute top-16 left-4 right-4 bg-[var(--card)] border border-[var(--rule)] rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in duration-150">
              {[
                { id: 'gemini-3.6-flash', name: 'Signal87 Standard', desc: 'Fast & intelligent for legal research' },
                { id: 'gemini-3.1-pro-preview', name: 'Signal87 Deep', desc: 'Deep synthesis & reasoning' },
                { id: 'gemini-3.1-flash-lite', name: 'Signal87 Fast', desc: 'Ultra-low latency responses' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    setShowMobileModelMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-[var(--raised)] transition-colors cursor-pointer flex flex-col gap-0.5 ${
                    selectedModel === m.id ? 'bg-[var(--raised)] text-[var(--ink)] font-semibold' : 'text-[var(--ink-2)]'
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
        </header>

        {/* Tab Views */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {currentTab === 'dashboard' && (
            <div className="flex-1 overflow-y-auto">
              <DashboardView
                documents={documents}
                projects={folders}
                stats={stats}
                onSelectTab={(tab) => setCurrentTab(tab === 'projects' ? 'documents' : tab)}
                onOpenUpload={() => setIsUploadOpen(true)}
                onSelectDocument={setSelectedDocForDetail}
                onSelectProject={(p) => {
                  setSelectedFolderId(p.id);
                  setCurrentTab('documents');
                }}
              />
            </div>
          )}

          {currentTab === 'documents' && (
            <div className="flex-1 flex flex-col min-h-0">
              <DocumentLibraryView
                documents={documents}
                folders={folders}
                onSelectDocument={setSelectedDocForDetail}
                onOpenUpload={() => setIsUploadOpen(true)}
                onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
                onCompareSelected={handleCompareFromDocs}
                onDeleteDocument={handleDeleteDocument}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onMoveDocument={handleMoveDocument}
                initialFolderId={selectedFolderId}
                onFolderChange={setSelectedFolderId}
              />
            </div>
          )}

          {currentTab === 'research' && (
            <ResearchAssistantView
              documents={documents}
              attachedFiles={attachedFiles}
              setAttachedFiles={setAttachedFiles}
              selectedModel={selectedModel}
              onChangeModel={setSelectedModel}
              onOpenUpload={() => setIsUploadOpen(true)}
              onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
              onUploadSuccess={handleUploadSuccess}
              onSaveReport={handleSaveReport}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              activeSessionId={activeSessionId}
              currentUser={currentUser}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              onGoogleSignIn={handleGoogleSignIn}
              onSelectDocument={setSelectedDocForDetail}
            />
          )}

          {currentTab === 'traces' && (
            <TracesView onSelectTrace={() => setCurrentTab('research')} />
          )}

          {currentTab === 'compare' && (
            <MultiDocCompareView documents={documents} />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              templates={INITIAL_REPORT_TEMPLATES}
              reports={reports}
              documents={documents}
              onSaveReport={handleSaveReport}
            />
          )}

          {currentTab === 'searches' && (
            <SavedSearchesView
              documents={documents}
              initialQuery={searchQuery}
              onSelectDocument={setSelectedDocForDetail}
            />
          )}

          {currentTab === 'team' && (
            <TeamView />
          )}

          {currentTab === 'organization' && (
            <OrganizationView stats={stats} />
          )}

          {currentTab === 'admin' && (
            <AdminView
              stats={stats}
              selectedModel={selectedModel}
              onChangeModel={setSelectedModel}
            />
          )}
        </main>

        {/* Mobile bottom navigation. Hidden at md and above, where the
            Sidebar takes over. */}
        <MobileDock
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onNewSession={handleCreateNewSession}
          onOpenMenu={() => setMobileMenuOpen(true)}
          documentCount={documents.length}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
          onOpenNewFolderModal={() => {
            setCurrentTab('documents');
            // Dispatch custom event to trigger folder creation modal
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-new-folder-modal'));
            }, 100);
          }}
        />
      </div>

      {/* Global Modals */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        documents={documents}
        onOpenDrivePicker={() => setIsDrivePickerOpen(true)}
        onSelectExistingDocument={(doc) => {
          setAttachedFiles((prev) => [
            ...prev.filter((f) => f.id !== doc.id),
            { id: doc.id, name: doc.title, size: `${(doc.sizeBytes / 1024).toFixed(1)} KB` }
          ]);
        }}
      />

      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onPortSuccess={handleDrivePortSuccess}
        onOpenIntro={() => setIsDriveIntroOpen(true)}
      />

      <GoogleDriveIntroModal
        isOpen={isDriveIntroOpen}
        onClose={() => setIsDriveIntroOpen(false)}
        onConnectDrive={() => setIsDrivePickerOpen(true)}
      />

      <DocumentDetailModal
        document={selectedDocForDetail}
        onClose={() => setSelectedDocForDetail(null)}
        onOpenCompare={(doc) => {
          setSelectedDocForDetail(null);
          setCurrentTab('compare');
        }}
      />

      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      <BlogModal
        isOpen={isBlogOpen}
        onClose={() => setIsBlogOpen(false)}
      />

      <MediaModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
      />

      <WelcomeTourModal
        isOpen={isWelcomeModalOpen}
        onClose={() => setIsWelcomeModalOpen(false)}
        userName={currentUser?.displayName}
        userEmail={currentUser?.email}
      />
    </div>
  );
}