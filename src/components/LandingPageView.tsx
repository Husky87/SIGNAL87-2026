import React from 'react';
import { Signal87LandingShell } from './Signal87LandingShell';
import { NavTab } from './Sidebar';

interface LandingPageViewProps {
  onOpenEmailAuth: (mode?: 'signup' | 'signin') => void;
  onAskQuestion: (question: string) => void;
  onOpenPrivacy: () => void;
  onOpenBlog: () => void;
  onOpenMedia: () => void;
  onSelectTab: (tab: NavTab) => void;
}

/**
 * Public landing page wrapper. The landing page now exposes the public legal
 * and team pages as real links, while authenticated workspace destinations
 * use the same application navigation callbacks as the signed-in shell.
 */
export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenEmailAuth,
  onAskQuestion,
  onOpenPrivacy,
  onOpenBlog,
  onOpenMedia,
  onSelectTab,
}) => (
  <div className="min-h-screen overflow-x-hidden bg-[#f7f7f3]">
    <Signal87LandingShell
      onOpenEmailAuth={onOpenEmailAuth}
      onAskQuestion={onAskQuestion}
      onSelectTab={onSelectTab}
    />

    <footer className="border-t border-[#dedfd8] bg-[#eff0ea] px-5 py-10 sm:px-10 sm:py-14 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-10 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <div className="text-sm font-semibold tracking-[-0.03em] text-[#20211e]">Signal87</div>
            <p className="mt-3 max-w-xs text-xs leading-6 text-[#74766f]">
              Intelligence for complex information, documents, data, and research.
            </p>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#7b7d75]">Company</div>
            <div className="mt-3 space-y-2.5 text-xs sm:mt-4 sm:space-y-3">
              <a href="/team" className="flex min-h-[44px] w-full items-center text-[#555850] hover:text-[#20211e]">Team</a>
              <button type="button" onClick={onOpenBlog} className="block w-full text-left text-[#555850] hover:text-[#20211e]">Blog</button>
              <button type="button" onClick={onOpenMedia} className="block w-full text-left text-[#555850] hover:text-[#20211e]">Media</button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#7b7d75]">Workspace</div>
            <div className="mt-3 space-y-2.5 text-xs sm:mt-4 sm:space-y-3">
              <button type="button" onClick={() => onSelectTab('dashboard')} className="block text-[#555850] hover:text-[#20211e]">Dashboard</button>
              <button type="button" onClick={() => onSelectTab('documents')} className="block text-[#555850] hover:text-[#20211e]">Documents</button>
              <button type="button" onClick={() => onSelectTab('research')} className="block text-[#555850] hover:text-[#20211e]">AI Research</button>
              <button type="button" onClick={() => onSelectTab('compare')} className="block text-[#555850] hover:text-[#20211e]">Compare</button>
              <button type="button" onClick={() => onSelectTab('saved')} className="block w-full text-left text-[#555850] hover:text-[#20211e]">Saved</button>
              <button type="button" onClick={() => onSelectTab('organization')} className="block text-[#555850] hover:text-[#20211e]">Organization</button>
              <button type="button" onClick={() => onSelectTab('admin')} className="block text-[#555850] hover:text-[#20211e]">Settings</button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#7b7d75]">Legal</div>
            <div className="mt-3 space-y-2.5 text-xs sm:mt-4 sm:space-y-3">
              <a href="/privacy" className="flex min-h-[44px] w-full items-center text-[#555850] hover:text-[#20211e]">Privacy Policy</a>
              <a href="/terms" className="flex min-h-[44px] w-full items-center text-[#555850] hover:text-[#20211e]">Terms of Service</a>
              <button type="button" onClick={onOpenPrivacy} className="block text-[#555850] hover:text-[#20211e]">Privacy & Data Security</button>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[#dedfd8] pt-6 text-[11px] text-[#85877f] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Signal87. All rights reserved.</span>
          <button type="button" onClick={() => onOpenEmailAuth('signin')} className="text-left hover:text-[#20211e]">Log in to Signal87</button>
        </div>
      </div>
    </footer>
  </div>
);
