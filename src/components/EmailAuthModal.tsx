import React, { useState } from 'react';
import { X, Mail, Lock, Loader2 } from 'lucide-react';

interface EmailAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onGoogleSignIn?: () => void;
}

export const EmailAuthModal: React.FC<EmailAuthModalProps> = ({
  isOpen,
  onClose,
  onSignUp,
  onSignIn,
  onGoogleSignIn
}) => {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        await onSignUp(email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (err: any) {
      setError(friendlyAuthError(err?.code, mode));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-2xl max-w-sm w-full p-6 text-[var(--ink)] space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px]" style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            {mode === 'signup' ? 'Create your account' : 'Log in'}
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-full cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {mode === 'signup' && (
          <p className="text-[13px] text-[var(--ink-2)]" style={{ lineHeight: 1.5 }}>
            Start with a 5-day free trial. No card required.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" size={16} />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full pl-10 pr-3.5 py-2.5 bg-[var(--raised)] border border-[var(--rule)] rounded-xl text-[15px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--teal)] transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" size={16} />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min. 6 characters)"
              className="w-full pl-10 pr-3.5 py-2.5 bg-[var(--raised)] border border-[var(--rule)] rounded-xl text-[15px] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--teal)] transition-all"
            />
          </div>

          {error && (
            <p className="text-[12.5px] text-[var(--warn)]" style={{ lineHeight: 1.5 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[var(--teal)] hover:opacity-90 disabled:opacity-60 text-white font-medium text-[13.5px] rounded-full cursor-pointer transition-all min-h-[44px] flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            <span>{mode === 'signup' ? 'Create account' : 'Log in'}</span>
          </button>
        </form>

        {onGoogleSignIn && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--rule)]" />
              <span className="text-[11px] text-[var(--muted)] uppercase" style={{ letterSpacing: '0.08em' }}>or</span>
              <div className="flex-1 h-px bg-[var(--rule)]" />
            </div>
            <button
              onClick={onGoogleSignIn}
              className="w-full py-2.5 bg-[var(--raised)] hover:bg-[var(--rule-2)] text-[var(--ink)] font-medium text-[13.5px] rounded-full cursor-pointer transition-all min-h-[44px]"
            >
              Continue with Google
            </button>
          </>
        )}

        <p className="text-center text-[13px] text-[var(--ink-2)]">
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }}
            className="text-[var(--teal)] hover:underline cursor-pointer font-medium"
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
};

function friendlyAuthError(code: string | undefined, mode: 'signup' | 'signin'): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/invalid-email':
      return 'That email address doesn\'t look right.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return mode === 'signup'
        ? 'Could not create your account. Please try again.'
        : 'Could not log in. Please try again.';
  }
}
