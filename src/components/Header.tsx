import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Bell,
  Sparkles,
  ChevronDown,
  User as UserIcon,
  Zap,
  FilePlus,
  GitFork,
  Bot,
  FileText,
  LogOut,
  LogIn,
  ShieldCheck,
  Cpu,
  Menu
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '../lib/firebase';
import { Signal87Logo } from './Signal87Logo';

interface HeaderProps {
  currentTab?: NavTab;
  onSearchQuery?: (query: string) => void;
  onOpenUpload: () => void;
  onSelectTab: (tab: NavTab) => void;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onToggleMobileMenu?: () => void;
  currentUser?: User | any | null;
  onSignOut?: () => void;
  onGoogleSignIn?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab = 'dashboard',
  onSearchQuery,
  onOpenUpload,
  onSelectTab,
  selectedModel,
  onChangeModel,
  onToggleMobileMenu,
  currentUser: propUser,
  onSignOut: propSignOut,
  onGoogleSignIn: propGoogleSignIn
}) => {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [localUser, setLocalUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLocalUser(user);
    });
    return () => unsubscribe();
  }, []);

  const activeUser = propUser !== undefined ? propUser : localUser;

  const handleGoogleSignIn = async () => {
    if (propGoogleSignIn) {
      propGoogleSignIn();
      setShowUserMenu(false);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      setShowUserMenu(false);
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  const handleSignOut = async () => {
    if (propSignOut) {
      propSignOut();
      setShowUserMenu(false);
      return;
    }
    try {
      await signOut(auth);
      setShowUserMenu(false);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const getModelLabel = (model: string) => {
    if (model === 'gemini-2.5-pro') return 'Signal87 Pro';
    if (model === 'gemini-2.5-flash-lite') return 'Signal87 Fast';
    return 'Signal87 Standard';
  };

  return (
    <header className="py-3.5 px-6 sm:px-8 bg-[var(--paper)]/95 backdrop-blur-md border-b border-[var(--rule)] flex items-center justify-between gap-4 sticky top-0 z-30 text-[var(--ink)]">
      {/* Left: Mobile Menu Toggle + Workspace Title & Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-xl text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--raised)] transition-colors cursor-pointer md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center border border-[var(--rule)]"
          aria-label="Open Navigation Menu"
        >
          <Menu size={20} />
        </button>

        {/* Model Selector (Moved from Right) */}
        <div className="relative">
          <button
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--card)] hover:bg-[var(--raised)] border border-[var(--rule)] rounded-full text-xs font-semibold text-[var(--ink-2)] transition-colors cursor-pointer min-h-[44px]"
          >
            <Sparkles size={13} className="text-[var(--accent)]" />
            <span className="truncate max-w-[90px] sm:max-w-none">{getModelLabel(selectedModel)}</span>
            <ChevronDown size={12} className="text-[var(--slate)]" />
          </button>

          {showModelMenu && (
            <div className="absolute left-0 mt-2 w-72 bg-[var(--card)] border border-[var(--rule)] rounded-2xl py-2 z-50 text-[var(--ink-2)]">
              <div className="px-3 py-1.5 border-b border-[var(--rule)] text-[11px] font-bold text-[var(--slate)] uppercase tracking-wider flex items-center gap-1.5">
                <Cpu size={12} className="text-[var(--accent)]" /> Signal87 Engine Selection
              </div>
              
              <button
                onClick={() => {
                  onChangeModel('gemini-2.5-flash-lite');
                  setShowModelMenu(false);
                }}
                className={`w-full px-3 py-2 text-left flex flex-col hover:bg-[var(--raised)]/80 transition-colors cursor-pointer ${
 selectedModel === 'gemini-2.5-flash-lite' ? 'bg-[var(--raised)] border-l-4 border-amber-400' : ''
 }`}
              >
                <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-400" /> Signal87 Fast Engine
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-mono font-bold">Fastest</span>
                </span>
                <span className="text-[11px] text-[var(--slate)]">Ultra low-latency queries</span>
              </button>

              <button
                onClick={() => {
                  onChangeModel('gemini-2.5-flash');
                  setShowModelMenu(false);
                }}
                className={`w-full px-3 py-2 text-left flex flex-col hover:bg-[var(--raised)]/80 transition-colors cursor-pointer ${
 selectedModel === 'gemini-2.5-flash' || selectedModel === 'gemini-2.5-flash' ? 'bg-[var(--raised)] border-l-4 border-sky-400' : ''
 }`}
              >
                <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-sky-400" /> Signal87 Standard Engine
                  <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1 rounded font-mono font-bold">Balanced</span>
                </span>
                <span className="text-[11px] text-[var(--slate)]">General intelligence & document processing</span>
              </button>

              <button
                onClick={() => {
                  onChangeModel('gemini-2.5-pro');
                  setShowModelMenu(false);
                }}
                className={`w-full px-3 py-2 text-left flex flex-col hover:bg-[var(--raised)]/80 transition-colors cursor-pointer ${
 selectedModel === 'gemini-2.5-pro' ? 'bg-[var(--raised)] border-l-4 border-purple-400' : ''
 }`}
              >
                <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                  <Bot size={13} className="text-purple-600" /> Signal87 Deep Engine
                  <span className="text-[9px] bg-purple-500/10 text-purple-700 border border-purple-500/30 px-1 rounded font-mono font-bold">Deep Reasoning</span>
                </span>
                <span className="text-[11px] text-[var(--slate)]">Deep multi-document legal synthesis</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Far Right Controls: Action Button + User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Actions Dropdown */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--teal)] hover:opacity-90 text-white font-extrabold rounded-full text-xs transition-all cursor-pointer min-h-[44px]"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>Action</span>
            <ChevronDown size={12} />
          </button>

          {showQuickActions && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--card)] border border-[var(--rule)] rounded-2xl py-2 z-50 text-[var(--ink-2)]">
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenUpload();
                }}
                className="w-full px-4 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--raised)] flex items-center gap-2.5 font-semibold cursor-pointer"
              >
                <FilePlus size={16} className="text-sky-400" />
                <span>Upload Documents</span>
              </button>

              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onSelectTab('research');
                }}
                className="w-full px-4 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--raised)] flex items-center gap-2.5 font-semibold cursor-pointer"
              >
                <Bot size={16} className="text-amber-400" />
                <span>Launch Deep Research</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onSelectTab('compare');
                }}
                className="w-full px-4 py-2.5 text-left text-xs text-[var(--ink)] hover:bg-[var(--raised)] flex items-center gap-2.5 font-semibold cursor-pointer"
              >
                <GitFork size={16} className="text-indigo-600" />
                <span>Compare Contracts</span>
              </button>
            </div>
          )}
        </div>

        {/* Firebase User Profile & Auth Button */}
        <div className="relative border-l border-[var(--rule)] pl-2 sm:pl-3">
          {activeUser ? (
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-[var(--raised)] border border-transparent hover:border-[var(--rule)] transition-colors cursor-pointer min-h-[44px]"
            >
              {activeUser.photoURL ? (
                <img
                  src={activeUser.photoURL}
                  alt="Profile"
                  className="w-8 h-8 rounded-full border border-[var(--rule)] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--raised)] border border-[var(--rule)] text-[var(--accent)] font-extrabold text-xs flex items-center justify-center">
                  {activeUser.displayName ? activeUser.displayName.substring(0, 2).toUpperCase() : 'S87'}
                </div>
              )}
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-[var(--ink)] truncate max-w-[120px]">
                  {activeUser.displayName || activeUser.email || 'Signal87 Guest'}
                </span>
                <span className="text-[10px] text-[var(--slate)] font-medium flex items-center gap-1">
                  <ShieldCheck size={11} className="text-[var(--verify)]" />
                  {activeUser.email ? 'Authenticated' : 'Guest Mode'}
                </span>
              </div>
              <ChevronDown size={14} className="text-[var(--slate)] hidden sm:block" />
            </button>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--card)] border border-[var(--rule)] hover:bg-[var(--raised)] text-[var(--ink)] rounded-full text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
              title="Sign in with your Google Account"
            >
              <LogIn size={15} className="text-[var(--accent)]" />
              <span className="hidden sm:inline">Sign in with Google</span>
              <span className="sm:hidden">Google Sign In</span>
            </button>
          )}

          {showUserMenu && activeUser && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--card)] border border-[var(--rule)] text-[var(--ink)] rounded-2xl py-2 z-50">
              <div className="px-4 py-2 border-b border-[var(--rule)]">
                <p className="text-xs font-bold text-[var(--ink)] truncate">
                  {activeUser.displayName || 'Google User'}
                </p>
                <p className="text-[11px] text-[var(--slate)] truncate">
                  {activeUser.email || 'guest@signal87.ai'}
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 font-semibold cursor-pointer"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

