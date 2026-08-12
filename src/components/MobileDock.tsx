import React, { useState } from 'react';
import { NavTab } from './Sidebar';
import {
  Home,
  Clock,
  Users,
  FolderOpen,
  FolderPlus,
  Upload,
  Sparkles,
  Globe,
  X,
  Bookmark,
  Menu,
  Plus,
  Search
} from 'lucide-react';

interface MobileDockProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onNewSession: () => void;
  onOpenMenu?: () => void;
  documentCount?: number;
  onOpenUpload?: () => void;
  onOpenDrivePicker?: () => void;
  onOpenNewFolderModal?: () => void;
}

const GooglePlusColorIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" className="flex-shrink-0">
    <path fill="#34A853" d="M16 16v14h4V20z" />
    <path fill="#4285F4" d="M30 16H20v4h10z" />
    <path fill="#FBBC05" d="M6 16h10v4H6z" />
    <path fill="#EA4335" d="M20 16V6h-4v10z" />
  </svg>
);

export const MobileDock: React.FC<MobileDockProps> = ({
  currentTab,
  onSelectTab,
  onNewSession,
  onOpenUpload,
  onOpenDrivePicker,
  onOpenNewFolderModal,
  onOpenMenu,
}) => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Map of Mobile Style Tabs
  const tabs: { id: NavTab | 'new' | 'more'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'documents', label: 'Files', icon: FolderOpen },
    { id: 'research', label: 'Ask', icon: Search },
    { id: 'new', label: 'New', icon: Plus },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'more', label: 'More', icon: Menu },
  ];

  const handleAction = (type: 'folder' | 'upload' | 'chat' | 'drive') => {
    setIsBottomSheetOpen(false);
    setTimeout(() => {
      if (type === 'folder') {
        // Toggle new folder modal. Since it resides in DocumentLibraryView, we can select documents tab
        onSelectTab('documents');
        if (onOpenNewFolderModal) {
          onOpenNewFolderModal();
        } else {
          // Fallback: Dispatch custom event to open folder modal in Library View
          const event = new CustomEvent('open-new-folder-modal');
          window.dispatchEvent(event);
        }
      } else if (type === 'upload') {
        if (onOpenUpload) onOpenUpload();
      } else if (type === 'chat') {
        onNewSession();
        onSelectTab('research');
      } else if (type === 'drive') {
        if (onOpenDrivePicker) onOpenDrivePicker();
      }
    }, 150);
  };

  return (
    <>
      {/* Floating Action Button (FAB) - Signal87 style */}
      <div className="md:hidden fixed right-4 bottom-22 z-40">
        <button
          onClick={() => setIsBottomSheetOpen(true)}
          className="w-14 h-14 rounded-2xl bg-[var(--card)] hover:bg-[var(--raised)] border border-[var(--rule)] text-[var(--ink)] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
          title="Create new action"
          id="signal87-fab"
        >
          <GooglePlusColorIcon size={26} />
        </button>
      </div>

      {/* Actions Bottom Sheet Modal */}
      {isBottomSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Transparent/blur Backdrop overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsBottomSheetOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <div className="relative bg-[var(--card)] rounded-t-3xl border-t border-[var(--rule)] p-6 pb-8 space-y-6 z-10 transform transition-transform animate-in slide-in-from-bottom duration-250 ease-out max-w-lg mx-auto w-full">
            {/* Soft drag handle marker */}
            <div className="w-10 h-1 bg-[var(--rule)] rounded-full mx-auto" />

            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[var(--ink)]">Create new</h3>
              <button
                onClick={() => setIsBottomSheetOpen(false)}
                className="p-1.5 hover:bg-[var(--raised)] text-[var(--slate)] hover:text-[var(--ink)] rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Options Grid */}
            <div className="grid grid-cols-3 gap-6 text-center">
              {/* Option 1: Create Folder */}
              <button
                onClick={() => handleAction('folder')}
                className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-[var(--teal-soft)] text-[var(--teal)] flex items-center justify-center border border-[var(--teal)]/20 group-active:scale-95 transition-transform">
                  <FolderPlus size={22} />
                </div>
                <span className="text-xs font-semibold text-[var(--ink-2)] truncate w-full">Folder</span>
              </button>

              {/* Option 2: Upload Document */}
              <button
                onClick={() => handleAction('upload')}
                className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900 group-active:scale-95 transition-transform">
                  <Upload size={22} />
                </div>
                <span className="text-xs font-semibold text-[var(--ink-2)] truncate w-full">Upload</span>
              </button>

              {/* Option 3: AI Chat Assistant */}
              <button
                onClick={() => handleAction('chat')}
                className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-100 dark:border-red-900 group-active:scale-95 transition-transform">
                  <Sparkles size={22} />
                </div>
                <span className="text-xs font-semibold text-[var(--ink-2)] truncate w-full">AI Chat</span>
              </button>

              {/* Option 4: Link External */}
              <button
                onClick={() => handleAction('drive')}
                className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900 group-active:scale-95 transition-transform">
                  <Globe size={22} />
                </div>
                <span className="text-xs font-semibold text-[var(--ink-2)] truncate w-full">Cloud Files</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Bottom Navigation Bar - Material 3 Style */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden flex items-center justify-between flex-shrink-0 px-1 sm:px-2 pt-3 pb-2.5 bg-[var(--card)] border-t border-[var(--rule)] z-40 w-full gap-1 sm:gap-2"
        style={{
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            (tab.id === 'documents' && currentTab === 'documents') ||
            (tab.id === 'research' && currentTab === 'research') ||
            (tab.id === 'saved' && currentTab === 'saved');

          const handleClick = () => {
            if (tab.id === 'new') {
              setIsBottomSheetOpen(true);
            } else if (tab.id === 'more') {
              if (onOpenMenu) onOpenMenu();
            } else {
              onSelectTab(tab.id as NavTab);
            }
          };

          return (
            <button
              key={tab.id}
              onClick={handleClick}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors focus:outline-none py-1.5 px-2 flex-shrink-0`}
            >
              {/* Modern Google MD3 Active Accent Pill Indicator */}
              <div
                className={`flex items-center justify-center px-3 py-2 rounded-full transition-all duration-200 ${
 isActive
 ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
 : 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--raised)]/40 hover:text-[var(--ink)]'
 }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Tab Label */}
              <span
                className={`text-[11px] font-semibold leading-tight tracking-tight transition-colors whitespace-nowrap ${
 isActive ? 'text-[var(--accent-ink)]' : 'text-[var(--slate)]'
 }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
