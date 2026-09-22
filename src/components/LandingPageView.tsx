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

    <footer className="border-t border-[#dedfd8] bg-[#eff0ea] px-5 py-7 sm:px-10 sm:py-9 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-[#d8dad2] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#5f625b]">Technology partners</div>
            <p className="mt-1 text-xs text-[#4c5049]">Supported by leading AI and cloud startup programs.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-[#d7d9d1] bg-white/70 px-3.5 py-2">
              <img src="/partners/nvidia.svg" alt="NVIDIA" className="h-6 w-6" />
              <div className="leading-tight"><div className="text-xs font-semibold text-[#20211e]">NVIDIA</div><div className="text-[10px] text-[#555850]">Inception Program</div></div>
            </div>
            <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-[#d7d9d1] bg-white/70 px-3.5 py-2">
              <img src="/partners/google-cloud.svg" alt="Google Cloud" className="h-6 w-6" />
              <div className="leading-tight"><div className="text-xs font-semibold text-[#20211e]">Google Cloud</div><div className="text-[10px] text-[#555850]">for Startups</div></div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 sm:gap-8 lg:grid-cols-4">
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

        <div className="mt-6 flex flex-col gap-2 border-t border-[#dedfd8] pt-4 text-[11px] text-[#62665e] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Signal87. All rights reserved.</span>
          <button type="button" onClick={() => onOpenEmailAuth('signin')} className="text-left hover:text-[#20211e]">Log in to Signal87</button>
        </div>
      </div>
    </footer>
  </div>
);
