import React, { useState } from 'react';
import { NavTab } from './Sidebar';
import {
  FolderOpen,
  FolderPlus,
  Upload,
  X,
  Menu,
  Plus,
  Search,
  StickyNote,
  Home
} from 'lucide-react';

interface MobileDockProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onNewSession: () => void;
  onOpenMenu?: () => void;
  documentCount?: number;
  onOpenUpload?: () => void;
  onOpenNewFolderModal?: () => void;
  onOpenNewNote?: () => void;
}

export const MobileDock: React.FC<MobileDockProps> = ({
  currentTab,
  onSelectTab,
  onNewSession,
  onOpenUpload,
  onOpenNewFolderModal,
  onOpenNewNote,
  onOpenMenu,
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // The reference design uses Home / Ask / Files / Notes / More as the persistent
  // mobile destinations. The existing "New" action remains available through the
  // center plus control so no creation workflow is lost.
  const tabs: { id: NavTab | 'new' | 'more'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'research', label: 'Ask', icon: Search },
    { id: 'documents', label: 'Files', icon: FolderOpen },
    { id: 'saved', label: 'Notes', icon: StickyNote },
    { id: 'more', label: 'More', icon: Menu },
  ];

  const handleAction = (type: 'folder' | 'upload' | 'note' | 'chat') => {
    setIsBottomSheetOpen(false);
    setTimeout(() => {
      if (type === 'folder') {
        onSelectTab('documents');
        if (onOpenNewFolderModal) {
          onOpenNewFolderModal();
        } else {
          window.dispatchEvent(new CustomEvent('open-new-folder-modal'));
        }
      } else if (type === 'upload') {
        if (onOpenUpload) onOpenUpload();
      } else if (type === 'note') {
        onSelectTab('saved');
        if (onOpenNewNote) {
          onOpenNewNote();
        } else {
          window.dispatchEvent(new CustomEvent('open-new-note'));
        }
      } else if (type === 'chat') {
        onNewSession();
        onSelectTab('research');
      }
    }, 150);
  };

  return (
    <>
      {isBottomSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setIsBottomSheetOpen(false)}
          />
          <div className="relative z-10 mx-auto w-full max-w-lg rounded-t-3xl border-t border-[var(--rule)] bg-[var(--surface)] p-6 pb-8 shadow-2xl">
            <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-[var(--rule)]" />
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[var(--ink)]">Create new</h3>
              <button
                type="button"
                onClick={() => setIsBottomSheetOpen(false)}
                aria-label="Close create menu"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => handleAction('chat')} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--raised)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]"><Search size={20} /></div>
                <span className="text-xs font-semibold text-[var(--ink)]">Ask</span>
              </button>
              <button type="button" onClick={() => handleAction('note')} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--raised)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--raised)] text-[var(--ink-2)]"><StickyNote size={20} /></div>
                <span className="text-xs font-semibold text-[var(--ink)]">Note</span>
              </button>
              <button type="button" onClick={() => handleAction('folder')} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--raised)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]"><FolderPlus size={20} /></div>
                <span className="text-xs font-semibold text-[var(--ink)]">Folder</span>
              </button>
              <button type="button" onClick={() => handleAction('upload')} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--rule)] bg-[var(--surface)] hover:bg-[var(--raised)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--raised)] text-[var(--ink-2)]"><Upload size={20} /></div>
                <span className="text-xs font-semibold text-[var(--ink)]">Upload</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile Navigation"
        className="md:hidden flex items-center justify-between flex-shrink-0 border-t border-[var(--rule)] bg-[var(--surface)] px-1 pt-2 z-40 w-full max-w-full overflow-x-hidden"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            (tab.id === 'dashboard' && currentTab === 'dashboard') ||
            (tab.id === 'research' && currentTab === 'research') ||
            (tab.id === 'documents' && currentTab === 'documents') ||
            (tab.id === 'saved' && currentTab === 'saved');

          const handleClick = () => {
            if (tab.id === 'more') {
              if (onOpenMenu) onOpenMenu();
            } else {
              onSelectTab(tab.id as NavTab);
            }
          };

          return (
            <button
              key={tab.id}
              type="button"
              onClick={handleClick}
              aria-current={isActive ? 'page' : undefined}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 px-0.5 focus:outline-none"
            >
              <div className={`flex h-9 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'text-[var(--ink-2)]'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-[11px] font-medium leading-tight ${isActive ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
