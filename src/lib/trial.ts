import { User } from './firebase';

export const TRIAL_DAYS = 5;

export interface TrialStatus {
  daysRemaining: number;
  isExpired: boolean;
}

// Uses Firebase Auth's own account-creation timestamp as the trial start —
// no separate write needed, and it can't be reset by clearing local storage.
export function getTrialStatus(user: User): TrialStatus {
  const createdAt = user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
  const daysElapsed = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed));
  return {
    daysRemaining,
    isExpired: daysElapsed >= TRIAL_DAYS
  };
}
