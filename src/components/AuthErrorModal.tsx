import React from 'react';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';

interface AuthErrorModalProps {
  isOpen: boolean;
  error: {
    code?: string;
    message?: string;
  } | null;
  onClose: () => void;
  onRetryGoogleSignIn: () => void;
}

export const AuthErrorModal: React.FC<AuthErrorModalProps> = ({
  isOpen,
  error,
  onClose,
  onRetryGoogleSignIn
}) => {
  if (!isOpen || !error) return null;

  const isUnauthorizedDomain =
    error.code === 'auth/unauthorized-domain' ||
    (error.message && error.message.includes('unauthorized-domain'));

  const isPopupBlocked =
    error.code === 'auth/popup-blocked' ||
    (error.message && error.message.includes('popup-blocked'));

  const isPopupClosed =
    error.code === 'auth/popup-closed-by-user' ||
    (error.message && error.message.includes('popup-closed-by-user'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-lg w-full p-6 relative space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Google Sign-In Status</h3>
            <p className="text-xs text-slate-400 font-mono">
              Error Code: {error.code || 'auth/configuration-issue'}
            </p>
          </div>
        </div>

        {/* Diagnostic Details Box */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-3 text-xs leading-relaxed">
          {isUnauthorizedDomain ? (
            <>
              <div className="flex items-start gap-2 text-amber-300 font-semibold">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>Domain Authorization Notice for signal87.ai</span>
              </div>
              <p className="text-slate-300">
                Your custom domain <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-300 font-mono">signal87.ai</code> needs to be added to Firebase Authorized Domains for Google OAuth sign-in.
              </p>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                <span className="font-bold text-slate-200 block">How to enable signal87.ai in Firebase:</span>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open <strong>Firebase Console</strong> &gt; <strong>Authentication</strong></li>
                  <li>Click <strong>Settings</strong> &gt; <strong>Authorized domains</strong></li>
                  <li>Click <strong>Add domain</strong> and enter <code className="text-sky-300 font-mono">signal87.ai</code></li>
                </ol>
              </div>
            </>
          ) : isPopupBlocked ? (
            <>
              <div className="flex items-start gap-2 text-amber-300 font-semibold">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>Pop-up Window Blocked</span>
              </div>
              <p className="text-slate-300">
                Your browser blocked the Google Authentication popup window. Please allow popups for this site and try again.
              </p>
            </>
          ) : isPopupClosed ? (
            <>
              <div className="flex items-start gap-2 text-slate-300 font-semibold">
                <AlertTriangle size={16} className="mt-0.5 text-amber-400 flex-shrink-0" />
                <span>Sign-In Window Closed</span>
              </div>
              <p className="text-slate-300">
                The Google Sign-in popup was closed before authentication finished.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-slate-300 font-semibold">
                <AlertTriangle size={16} className="mt-0.5 text-amber-400 flex-shrink-0" />
                <span>Authentication Notice</span>
              </div>
              <p className="text-slate-300">
                {error.message || 'Google Auth is currently completing setup on this domain.'}
              </p>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            onClick={onRetryGoogleSignIn}
            className="w-full sm:w-auto px-6 py-2.5 bg-[var(--teal)] hover:opacity-90 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
          >
            Retry Google Login
          </button>
        </div>
      </div>
    </div>
  );
};
