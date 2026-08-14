import React, { useState, useEffect, useMemo } from 'react';
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
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { AuthErrorModal } from './components/AuthErrorModal';
import { EmailAuthModal } from './components/EmailAuthModal';
import { PaywallView } from './components/PaywallView';
import { getTrialStatus } from './lib/trial';
import { isAdminEmail } from './lib/admins';
import { Signal87Logo } from './components/Signal87Logo';
import { MobileDock } from './components/MobileDock';
import { SavedView } from './components/SavedView';
import { auth, onAuthStateChanged, User, signInWithPopup, signUpWithEmail, signInWithEmail, googleProvider, getRedirectResult, signInWithGoogleRedirect } from './lib/firebase';
import { LogIn, Sparkles, X, Menu, ChevronDown, Check, MoreVertical } from 'lucide-react';

import {
  INITIAL_REPORT_TEMPLATES,
  INITIAL_AUDIT_LOGS,
  INITIAL_ORG_STATS
} from './data/mockData';

import { DocumentItem, FolderItem, GeneratedReport, ChatMessage, SavedItem, SavedAnswer } from './types';
import {
  fetchDocumentsFromFirestore,
  saveDocumentToFirestore,
  deleteDocumentFromFirestore,
  fetchReportsFromFirestore,
  saveReportToFirestore,
  fetchSavedItemsFromFirestore,
  saveSavedItemToFirestore,
  deleteSavedItemFromFirestore
} from './lib/firestoreService';
import { adoptLegacyWorkspace } from './lib/workspaceMigration';

function readUserJson<T>(uid: string, key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(`signal87_${key}_${uid}`);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeUserJson(uid: string, key: string, value: unknown) {
  try {
    localStorage.setItem(`signal87_${key}_${uid}`, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed saving', key, e);
  }
}

/**
 * Rejects records that explicitly belong to somebody else.
 *
 * Every caller reads from a source that is already scoped to one account — a
 * `signal87_*_{uid}` localStorage key, or a `users/{uid}/...` Firestore path —
 * so this is a second guard, not the isolation boundary itself. It therefore
 * accepts records carrying no ownership at all: returning false for those threw
 * away anything written before the fields existed, and any item created locally
 * before it had been stamped.
 */
function belongsToUser<T extends { userId?: string; owner?: string }>(
  item: T,
  user: { uid: string; email?: string | null }
): boolean {
  if (item.userId) return item.userId === user.uid;
  if (item.owner && user.email) return item.owner === user.email;
  return true;
}

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
  const [authReady, setAuthReady] = useState(false);
  const hadUserRef = React.useRef(false);
  const skipChatSaveRef = React.useRef(false);
  const [showAuthBanner, setShowAuthBanner] = useState(true);

  // Core Data States
  const defaultFolders: FolderItem[] = [
    { id: 'fld_contracts', name: 'Legal & Contracts', color: '#1a73e8', parentId: null, createdAt: new Date().toISOString() },
    { id: 'fld_financials', name: 'Financial Disclosures', color: '#0f9d58', parentId: null, createdAt: new Date().toISOString() },
    { id: 'fld_governance', name: 'Board Minutes', color: '#f4b400', parentId: null, createdAt: new Date().toISOString() }
  ];
  const [folders, setFolders] = useState<FolderItem[]>(defaultFolders);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; size: string; dataUrl?: string }[]>([]);

  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [workspaceReady, setWorkspaceReady] = useState(false);

  const [auditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [stats, setStats] = useState(INITIAL_ORG_STATS);

  // Saved Items State
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [prelinkedDocId, setPrelinkedDocId] = useState<string | null>(null);
  const [newNoteRequestId, setNewNoteRequestId] = useState(0);

  // Persist documents to localStorage
  useEffect(() => {
    if (!currentUser || !workspaceReady) return;
    writeUserJson(currentUser.uid, 'documents', documents);
  }, [documents, currentUser, workspaceReady]);

  // Persist savedItems to localStorage
  useEffect(() => {
    if (!currentUser || !workspaceReady) return;
    writeUserJson(currentUser.uid, 'saved_items', savedItems);
  }, [savedItems, currentUser, workspaceReady]);

  // Persist attachedFiles to localStorage
  useEffect(() => {
    if (!currentUser || !workspaceReady) return;
    writeUserJson(currentUser.uid, 'attached_files', attachedFiles);
  }, [attachedFiles, currentUser, workspaceReady]);

  // Persist folders to localStorage
  useEffect(() => {
    if (!currentUser || !workspaceReady) return;
    writeUserJson(currentUser.uid, 'folders', folders);
  }, [folders, currentUser, workspaceReady]);

  // Folder Action Handlers
  /** Every folder in the subtree rooted at folderId, including itself. */
  const collectFolderSubtree = (folderId: string, all: FolderItem[]): Set<string> => {
    const out = new Set<string>([folderId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of all) {
        const parent = f.parentId ?? null;
        if (parent && out.has(parent) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
    }
    return out;
  };

  const handleCreateFolder = (name: string, color?: string, parentId?: string | null) => {
    const newFld: FolderItem = {
      id: `fld_${Date.now()}`,
      name,
      color: color || '#1a73e8',
      parentId: parentId ?? null,
      createdAt: new Date().toISOString()
    };
    setFolders((prev) => [...prev, newFld]);
  };

  const handleMoveFolder = (folderId: string, parentId: string | null) => {
    if (folderId === parentId) return;
    // Moving a folder inside its own subtree would detach that branch from the
    // root and leave it unreachable, so refuse it.
    if (parentId && collectFolderSubtree(folderId, folders).has(parentId)) return;
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, parentId, updatedAt: new Date().toISOString() } : f
      )
    );
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: newName, updatedAt: new Date().toISOString() } : f))
    );
  };

  const handleDeleteFolder = (folderId: string) => {
    // Deleting a folder deletes its subtree. Removing only the folder itself
    // would leave its children pointing at a parent that no longer exists,
    // which hides them from every view instead of freeing them.
    const doomed = collectFolderSubtree(folderId, folders);
    setFolders((prev) => prev.filter((f) => !doomed.has(f.id)));
    setDocuments((prev) =>
      prev.map((d) => (d.folderId && doomed.has(d.folderId) ? { ...d, folderId: undefined } : d))
    );
    if (selectedFolderId && doomed.has(selectedFolderId)) setSelectedFolderId(null);
  };

  const handleMoveDocument = (docId: string, folderId: string | undefined) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, folderId } : d))
    );
  };

  // Persist reports to localStorage
  useEffect(() => {
    if (!currentUser || !workspaceReady) return;
    writeUserJson(currentUser.uid, 'reports', reports);
  }, [reports, currentUser, workspaceReady]);

  // UI Modal States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DocumentItem | null>(null);
  const [filesView, setFilesView] = useState<'workspace' | 'recent' | 'starred' | 'shared' | 'trash'>('workspace');
  const [pendingDroppedFiles, setPendingDroppedFiles] = useState<File[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const handleFilesDropped = (files: File[]) => {
    setUploadFolderId(selectedFolderId);
    setPendingDroppedFiles(files);
    setIsUploadOpen(true);
  };

  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [showMobileModelMenu, setShowMobileModelMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getModelLabel = (model: string) => {
    if (model === 'gemini-2.5-pro') return 'Signal87 Deep';
    if (model === 'gemini-2.5-flash-lite') return 'Signal87 Fast';
    return 'Signal87 Standard';
  };
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isBlogOpen, setIsBlogOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [isEmailAuthOpen, setIsEmailAuthOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [authError, setAuthError] = useState<{ code?: string; message?: string } | null>(null);
  const [pendingHomeQuery, setPendingHomeQuery] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; title: string; timestamp: string }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pendingCompareIds, setPendingCompareIds] = useState<string[]>([]);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Persist sessions array to localStorage whenever it changes
  useEffect(() => {
    if (!currentUser || !workspaceReady) return;
    writeUserJson(currentUser.uid, 'sessions', sessions);
  }, [sessions, currentUser, workspaceReady]);

  // Persist activeSessionId to localStorage
  useEffect(() => {
    if (!currentUser || !workspaceReady || !activeSessionId) return;
    try {
      localStorage.setItem(`signal87_active_session_id_${currentUser.uid}`, activeSessionId);
    } catch (e) {}
  }, [activeSessionId, currentUser, workspaceReady]);

  // Load chat history for active session ID from localStorage or default
  useEffect(() => {
    skipChatSaveRef.current = true;
    if (!activeSessionId || !currentUser) {
      setChatHistory([]);
      return;
    }
    try {
      const storedChat = localStorage.getItem(`signal87_chat_${currentUser.uid}_${activeSessionId}`);
      if (storedChat) {
        setChatHistory(JSON.parse(storedChat));
      } else {
        setChatHistory([]);
      }
    } catch (e) {
      console.warn('Error loading chat history for session:', activeSessionId, e);
      setChatHistory([]);
    }
  }, [activeSessionId, currentUser]);

  // Save chatHistory to localStorage for the active session
  useEffect(() => {
    if (!activeSessionId || !currentUser || !workspaceReady) return;
    if (skipChatSaveRef.current) {
      skipChatSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(`signal87_chat_${currentUser.uid}_${activeSessionId}`, JSON.stringify(chatHistory));

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
  }, [chatHistory, activeSessionId, currentUser]);

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
      const hasOnboarded = localStorage.getItem(onboardKey);

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
      }
    }
  }, [currentUser]);

  // Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (user) {
        hadUserRef.current = true;
        setCurrentUser(user);
        setAuthError(null);
      } else {
        setCurrentUser(null);
        if (hadUserRef.current) {
          hadUserRef.current = false;
          resetClientState();
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle OAuth redirect result
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          setCurrentUser(result.user);
          setAuthError(null);
        }
      })
      .catch((error: any) => {
        console.error('Redirect result error:', error);
        if (error.code !== 'auth/no-redirect-result') {
          setAuthError({
            code: error.code || 'auth/redirect-error',
            message: error.message || 'OAuth redirect failed'
          });
        }
      });
  }, []);

  // Load only this account's workspace. Never merge another user's leftover
  // localStorage into the current session.
  useEffect(() => {
    if (!currentUser) {
      setWorkspaceReady(false);
      setDocuments([]);
      setSavedItems([]);
      setReports([]);
      setAttachedFiles([]);
      setSessions([]);
      setActiveSessionId(null);
      setChatHistory([]);
      return;
    }

    const uid = currentUser.uid;
    adoptLegacyWorkspace(uid);
    const mine = <T extends { userId?: string; owner?: string }>(items: T[]) =>
      items.filter((item) => belongsToUser(item, currentUser));

    setDocuments(mine(readUserJson<DocumentItem[]>(uid, 'documents', [])));
    setSavedItems(mine(readUserJson<SavedItem[]>(uid, 'saved_items', [])));
    setReports(readUserJson<GeneratedReport[]>(uid, 'reports', []));
    setAttachedFiles(readUserJson(uid, 'attached_files', []));
    const userFolders = readUserJson<FolderItem[]>(uid, 'folders', []);
    setFolders(userFolders.length > 0 ? userFolders : defaultFolders);
    setSessions(readUserJson(uid, 'sessions', []));
    try {
      setActiveSessionId(localStorage.getItem(`signal87_active_session_id_${uid}`));
    } catch {
      setActiveSessionId(null);
    }
    setWorkspaceReady(true);

    let cancelled = false;
    async function syncFirestoreData() {
      const remoteDocs = await fetchDocumentsFromFirestore();
      if (!cancelled) {
        setDocuments(remoteDocs.filter((d) => belongsToUser(d, currentUser)));
      }

      const remoteReports = await fetchReportsFromFirestore();
      if (!cancelled) {
        setReports(remoteReports);
      }

      const remoteSaved = await fetchSavedItemsFromFirestore();
      if (!cancelled) {
        setSavedItems(remoteSaved.filter((item) => belongsToUser(item, currentUser)));
      }
    }

    syncFirestoreData();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    if (sessions.length > 0) return;
    const fresh = {
      id: `s_${Date.now()}`,
      title: 'New Research Session',
      timestamp: 'Just now'
    };
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  }, [currentUser, sessions.length]);

  // Handlers for Saved notebook
  const handleSaveSavedItem = (rawItem: SavedItem) => {
    // Stamp the owner, as uploads already do. Without this every note and saved
    // answer failed the belongsToUser check the moment it was created and
    // disappeared from Saved immediately.
    const item: SavedItem = { ...rawItem, userId: currentUser?.uid };
    setSavedItems((prev) => {
      const idx = prev.findIndex((s) => s.id === item.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      } else {
        return [item, ...prev];
      }
    });
    saveSavedItemToFirestore(item);
  };

  const handleDeleteSavedItem = (id: string) => {
    setSavedItems((prev) => prev.filter((s) => s.id !== id));
    deleteSavedItemFromFirestore(id);
  };

  const handleSaveAnswer = (msg: ChatMessage, question: string) => {
    const isSaved = savedItems.some((s) => s.id === msg.id);
    if (isSaved) {
      handleDeleteSavedItem(msg.id);
    } else {
      const savedAns: SavedAnswer = {
        id: msg.id,
        type: 'answer',
        text: msg.text,
        citations: msg.citations || [],
        question: question,
        timestamp: new Date().toISOString()
      };
      handleSaveSavedItem(savedAns);
    }
  };

  const savedAnswerIds = useMemo(() => {
    return new Set(
      savedItems.filter((s) => s.type === 'answer').map((s) => s.id)
    );
  }, [savedItems]);

  const myDocuments = useMemo(
    () => (currentUser ? documents.filter((d) => belongsToUser(d, currentUser)) : []),
    [documents, currentUser]
  );

  const mySavedItems = useMemo(
    () => (currentUser ? savedItems.filter((item) => belongsToUser(item, currentUser)) : []),
    [savedItems, currentUser]
  );

  // Handlers
  const handleUploadSuccess = (newDoc: DocumentItem, parsedFile?: any) => {
    const withText: DocumentItem = {
      ...newDoc,
      fullText: parsedFile?.extractedText || newDoc.fullText || newDoc.contentPreview,
      owner: currentUser?.email || newDoc.owner,
      userId: currentUser?.uid
    };
    setDocuments((prev) => [withText, ...prev.filter((d) => d.id !== withText.id)]);
    saveDocumentToFirestore(withText);
    setStats((prev) => ({
      ...prev,
      totalDocs: prev.totalDocs + 1,
      storageUsedBytes: prev.storageUsedBytes + withText.sizeBytes
    }));
  };

  // Soft delete — moves to Trash instead of removing immediately, matching
  // Drive's model. Permanent removal only happens from the Trash view.
  const handleDeleteDocument = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, trashed: true, trashedAt: new Date().toISOString() } : d))
    );
    const doc = documents.find((d) => d.id === docId);
    if (doc) saveDocumentToFirestore({ ...doc, trashed: true, trashedAt: new Date().toISOString() });
  };

  const handleRestoreDocument = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, trashed: false, trashedAt: undefined } : d))
    );
    const doc = documents.find((d) => d.id === docId);
    if (doc) saveDocumentToFirestore({ ...doc, trashed: false, trashedAt: undefined });
  };

  const handlePermanentlyDeleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    deleteDocumentFromFirestore(docId);
  };

  const handleEmptyTrash = () => {
    const trashedIds = documents.filter((d) => d.trashed).map((d) => d.id);
    setDocuments((prev) => prev.filter((d) => !d.trashed));
    trashedIds.forEach((id) => deleteDocumentFromFirestore(id));
  };

  const handleToggleStar = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, starred: !d.starred } : d))
    );
    const doc = documents.find((d) => d.id === docId);
    if (doc) saveDocumentToFirestore({ ...doc, starred: !doc.starred });
  };

  const handleRenameDocument = (docId: string, newTitle: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, title: newTitle } : d))
    );
    const doc = documents.find((d) => d.id === docId);
    if (doc) saveDocumentToFirestore({ ...doc, title: newTitle });
  };

  const handleChangeDocumentPermissions = (docId: string, permissions: DocumentItem['permissions']) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, permissions } : d))
    );
    const doc = documents.find((d) => d.id === docId);
    if (doc) saveDocumentToFirestore({ ...doc, permissions });
  };

  const handleSaveReport = (newRep: GeneratedReport) => {
    setReports((prev) => [newRep, ...prev]);
    saveReportToFirestore(newRep); // Persist to Firestore
  };

  // Carry the library's selection into the compare view — it holds its own
  // selection state, so without this the chosen documents were dropped and the
  // user landed on an empty comparison screen.
  const handleCompareFromDocs = (docsToCompare: DocumentItem[]) => {
    setPendingCompareIds(docsToCompare.map((d) => d.id));
    setCurrentTab('compare');
  };

  const resetClientState = () => {
    setAuthError(null);
    setCurrentTab('research');
    setSelectedDocForDetail(null);
    setSearchQuery('');
    setIsUploadOpen(false);
    setIsWelcomeModalOpen(false);
    setDocuments([]);
    setAttachedFiles([]);
    setSavedItems([]);
    setSessions([]);
    setActiveSessionId(null);
    setChatHistory([]);
    setPendingCompareIds([]);
    setNewNoteRequestId(0);
    setReports([]);
    setFolders([
      { id: 'fld_contracts', name: 'Legal & Contracts', color: '#1a73e8', parentId: null, createdAt: new Date().toISOString() },
      { id: 'fld_financials', name: 'Financial Disclosures', color: '#0f9d58', parentId: null, createdAt: new Date().toISOString() },
      { id: 'fld_governance', name: 'Board Minutes', color: '#f4b400', parentId: null, createdAt: new Date().toISOString() }
    ]);
    // Only this app's keys. localStorage.clear() wiped the entire origin,
    // including storage belonging to nothing to do with the workspace.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('signal87_')) localStorage.removeItem(key);
      }
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage wipe notice:', e);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn('Firebase Sign-Out Warning:', err);
    }
    hadUserRef.current = false;
    setCurrentUser(null);
    resetClientState();
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

  // Shared by the sidebar's New menu and the mobile dock's sheet, so both offer
  // the same set of things to create and route them the same way.
  const handleOpenNewFolder = () => {
    setCurrentTab('documents');
    // The modal belongs to the file library, which has to be mounted to hear this.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-new-folder-modal'));
    }, 100);
  };

  const handleOpenNewNote = () => {
    setNewNoteRequestId((id) => id + 1);
    setCurrentTab('saved');
  };

  const handleDeleteSession = (id: string) => {
    try {
      if (currentUser) localStorage.removeItem(`signal87_chat_${currentUser.uid}_${id}`);
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

  const handleAskFromHome = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    handleCreateNewSession();
    setPendingHomeQuery(trimmed);
  };

  const handleOpenSessionFromHome = (id: string) => {
    setActiveSessionId(id);
    setCurrentTab('research');
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
        // Don't invent a Firebase error code. An error with no code is not a
        // configuration problem — a blocked storage backend surfaces here as a
        // plain Error, and labelling it auth/configuration-issue sent everyone
        // looking at the Firebase console instead of the browser.
        code: err.code || 'auth/unknown-error',
        message: err.message || 'Google Sign-In was not completed.'
      });
    }
  };

  const handleGoogleSignInRedirect = async () => {
    try {
      setAuthError(null);
      await signInWithGoogleRedirect();
    } catch (err: any) {
      console.error('Google Sign-In Redirect Error:', err);
      setAuthError({
        code: err.code || 'auth/redirect-failed',
        message: err.message || 'OAuth redirect failed. Please try again.'
      });
    }
  };

  // Errors intentionally propagate to the caller — EmailAuthModal shows
  // them inline next to the form instead of the separate Google-specific
  // AuthErrorModal.
  const handleEmailSignUp = async (email: string, password: string) => {
    await signUpWithEmail(email, password);
    setIsEmailAuthOpen(false);
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    await signInWithEmail(email, password);
    setIsEmailAuthOpen(false);
  };

  if (!authReady) {
    return <div className="min-h-[100dvh] w-full bg-[#0F1010]" />;
  }

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
          onOpenEmailAuth={() => setIsEmailAuthOpen(true)}
          onOpenPrivacy={() => setIsPrivacyOpen(true)}
          onOpenBlog={() => setIsBlogOpen(true)}
          onOpenMedia={() => setIsMediaOpen(true)}
          onSelectTab={(tab) => {
            if (tab === 'team') {
              const el = document.getElementById('team');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'privacy') {
              setIsPrivacyOpen(true);
            } else if (tab === 'terms') {
              setIsTermsOpen(true);
            } else {
              setIsEmailAuthOpen(true);
            }
          }}
        />

        <AuthErrorModal
          isOpen={Boolean(authError)}
          error={authError}
          onClose={() => setAuthError(null)}
          onRetryGoogleSignIn={handleGoogleSignIn}
          onTryRedirectAuth={handleGoogleSignInRedirect}
        />

        <EmailAuthModal
          isOpen={isEmailAuthOpen}
          onClose={() => setIsEmailAuthOpen(false)}
          onSignUp={handleEmailSignUp}
          onSignIn={handleEmailSignIn}
          onGoogleSignIn={() => { setIsEmailAuthOpen(false); handleGoogleSignIn(); }}
        />

        <PrivacyModal
          isOpen={isPrivacyOpen}
          onClose={() => setIsPrivacyOpen(false)}
        />
        {isTermsOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70">
            <button
              type="button"
              onClick={() => setIsTermsOpen(false)}
              className="fixed top-4 right-4 z-50 px-3 py-2 rounded-full bg-[#161818] text-[#F3F3EE] text-sm cursor-pointer"
            >
              Close
            </button>
            <TermsOfService />
          </div>
        )}
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

  const trialStatus = getTrialStatus(currentUser);
  if (trialStatus.isExpired && !isAdminEmail(currentUser.email)) {
    return <PaywallView userEmail={currentUser.email} onSignOut={handleSignOut} />;
  }

  return (
    <div
      className="s87-app flex h-[100dvh] w-full max-w-full overflow-hidden overscroll-none bg-[var(--paper)] text-[var(--ink)] antialiased"
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
        documentCount={myDocuments.length}
        projectCount={0}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        onNewSession={handleCreateNewSession}
        recentSessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onDeleteSession={handleDeleteSession}
        onOpenUpload={() => setIsUploadOpen(true)}
        onSignOut={handleSignOut}
        filesView={filesView}
        onSelectFilesView={(view) => {
          setFilesView(view);
          setCurrentTab('documents');
          setMobileMenuOpen(false);
        }}
        onOpenNewFolderModal={handleOpenNewFolder}
        onOpenNewNote={handleOpenNewNote}
      />

      {/* Main Workspace Area */}
      <div ref={mainScrollRef} className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden">
        {/* Persistent Mobile Top Header (Authentic Google Drive Pill Search Bar) */}
        <header className="flex md:hidden bg-[var(--paper)] px-4 pt-3.5 pb-2.5 items-center flex-shrink-0 z-30 relative">
          <div className="w-full flex items-center gap-2 bg-[var(--card)] px-3 py-1.5 border border-[var(--rule)] rounded-full transition-">
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
                className="w-full min-w-0 bg-transparent border-0 text-base text-[var(--ink)] placeholder-[var(--ink-2)] focus:outline-none py-1"
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

            {/* Model Indicator/Selector Button - hidden below 640px to save header width; model switching moves into the More menu there */}
            <button
              onClick={() => setShowMobileModelMenu(!showMobileModelMenu)}
              className="hidden sm:flex items-center gap-1 p-1 px-2 text-[10px] font-bold text-[var(--ink-2)] bg-[var(--paper)] hover:bg-[var(--raised)] rounded-full border border-[var(--rule)] uppercase cursor-pointer"
              title="Change active AI model"
            >
              <Sparkles size={11} className="text-amber-500 animate-pulse" />
              <span className="max-w-[70px] truncate">{selectedModel === 'gemini-2.5-pro' ? 'Deep' : selectedModel === 'gemini-2.5-flash-lite' ? 'Fast' : 'Standard'}</span>
              <ChevronDown size={10} className="text-[var(--slate)]" />
            </button>

            {/* More menu (under 640px) - houses model switching once the chip above is hidden */}
            <button
              onClick={() => setShowMobileModelMenu(!showMobileModelMenu)}
              className="sm:hidden flex items-center justify-center w-7 h-7 text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] rounded-full cursor-pointer"
              title="More options"
              aria-label="More options"
            >
              <MoreVertical size={16} />
            </button>

            {/* User Avatar */}
            {currentUser ? (
              <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] text-[var(--ink)] font-bold flex items-center justify-center text-xs overflow-hidden">
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
            <div className="absolute top-16 left-4 right-4 bg-[var(--card)] border border-[var(--rule)] rounded-2xl py-1.5 z-50 animate-in fade-in duration-150">
              {[
                { id: 'gemini-2.5-flash', name: 'Signal87 Standard', desc: 'Fast & intelligent for legal research' },
                { id: 'gemini-2.5-pro', name: 'Signal87 Deep', desc: 'Deep synthesis & reasoning' },
                { id: 'gemini-2.5-flash-lite', name: 'Signal87 Fast', desc: 'Ultra-low latency responses' }
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
                currentUser={currentUser}
                recentSessions={sessions}
                onAskQuestion={handleAskFromHome}
                onOpenSession={handleOpenSessionFromHome}
              />
            </div>
          )}

          {currentTab === 'documents' && (
            <div className="flex-1 flex flex-col min-h-0">
              <DocumentLibraryView
                documents={myDocuments}
                folders={folders}
                filesView={filesView}
                initialSearch={searchQuery}
                onSelectDocument={setSelectedDocForDetail}
                onOpenUpload={(folderId) => {
                  setUploadFolderId(folderId ?? selectedFolderId);
                  setIsUploadOpen(true);
                }}
                onCompareSelected={handleCompareFromDocs}
                onDeleteDocument={handleDeleteDocument}
                onRestoreDocument={handleRestoreDocument}
                onPermanentlyDeleteDocument={handlePermanentlyDeleteDocument}
                onEmptyTrash={handleEmptyTrash}
                onToggleStar={handleToggleStar}
                onRenameDocument={handleRenameDocument}
                onChangeDocumentPermissions={handleChangeDocumentPermissions}
                onCreateFolder={handleCreateFolder}
                onMoveFolder={handleMoveFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onMoveDocument={handleMoveDocument}
                onFilesDropped={handleFilesDropped}
                initialFolderId={selectedFolderId}
                onFolderChange={setSelectedFolderId}
              />
            </div>
          )}

          {currentTab === 'research' && (
            <ResearchAssistantView
              documents={myDocuments}
              attachedFiles={attachedFiles}
              setAttachedFiles={setAttachedFiles}
              selectedModel={selectedModel}
              onChangeModel={setSelectedModel}
              onOpenUpload={() => setIsUploadOpen(true)}
              onUploadSuccess={handleUploadSuccess}
              onSaveReport={handleSaveReport}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              activeSessionId={activeSessionId}
              currentUser={currentUser}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              onGoogleSignIn={handleGoogleSignIn}
              onSelectDocument={setSelectedDocForDetail}
              onSaveAnswer={handleSaveAnswer}
              savedAnswerIds={savedAnswerIds}
              initialQuery={pendingHomeQuery}
              onInitialQueryConsumed={() => setPendingHomeQuery(null)}
            />
          )}

          {currentTab === 'traces' && (
            <TracesView onSelectTrace={() => setCurrentTab('research')} />
          )}

          {currentTab === 'compare' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <MultiDocCompareView documents={myDocuments} initialSelectedIds={pendingCompareIds} />
            </div>
          )}

          {currentTab === 'reports' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ReportsView
                templates={INITIAL_REPORT_TEMPLATES}
                reports={reports}
                documents={myDocuments}
                onSaveReport={handleSaveReport}
              />
            </div>
          )}

          {currentTab === 'searches' && (
            <SavedSearchesView
              documents={myDocuments}
              initialQuery={searchQuery}
              onSelectDocument={setSelectedDocForDetail}
            />
          )}

          {currentTab === 'saved' && (
            <SavedView
              savedItems={mySavedItems}
              onSaveItem={handleSaveSavedItem}
              onDeleteItem={handleDeleteSavedItem}
              documents={myDocuments}
              onSelectDocument={setSelectedDocForDetail}
              prelinkedDocId={prelinkedDocId}
              onClearPrelinkedDoc={() => setPrelinkedDocId(null)}
              newNoteRequestId={newNoteRequestId}
            />
          )}

          {currentTab === 'team' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <TeamView />
            </div>
          )}

          {currentTab === 'organization' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <OrganizationView stats={stats} />
            </div>
          )}

          {currentTab === 'admin' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AdminView
                stats={stats}
                selectedModel={selectedModel}
                onChangeModel={setSelectedModel}
                onSignOut={handleSignOut}
              />
            </div>
          )}

          {currentTab === 'privacy' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <PrivacyPolicy />
            </div>
          )}

          {currentTab === 'terms' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <TermsOfService />
            </div>
          )}
        </main>

        {/* Mobile bottom navigation. Hidden at md and above, where the
            Sidebar takes over. */}
        <MobileDock
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onNewSession={handleCreateNewSession}
          onOpenMenu={() => setMobileMenuOpen(true)}
          documentCount={myDocuments.length}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenNewFolderModal={handleOpenNewFolder}
          onOpenNewNote={handleOpenNewNote}
        />
      </div>

      {/* Global Modals */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setUploadFolderId(null);
        }}
        onUploadSuccess={handleUploadSuccess}
        documents={myDocuments}
        targetFolderId={uploadFolderId}
        initialFiles={pendingDroppedFiles}
        onInitialFilesConsumed={() => setPendingDroppedFiles([])}
        onAllUploadsComplete={() => {
          setFilesView('workspace');
          setCurrentTab('documents');
        }}
        onSelectExistingDocument={(doc) => {
          setAttachedFiles((prev) => [
            ...prev.filter((f) => f.id !== doc.id),
            { id: doc.id, name: doc.title, size: `${(doc.sizeBytes / 1024).toFixed(1)} KB` }
          ]);
        }}
      />

      <DocumentDetailModal
        document={selectedDocForDetail}
        onClose={() => setSelectedDocForDetail(null)}
        onOpenCompare={(doc) => {
          setSelectedDocForDetail(null);
          setPendingCompareIds([doc.id]);
          setCurrentTab('compare');
        }}
        onAddNote={(docId) => {
          setPrelinkedDocId(docId);
          setCurrentTab('saved');
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