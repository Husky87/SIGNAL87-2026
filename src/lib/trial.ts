import { User } from './firebase';

export const TRIAL_DAYS = 5;
// Existing accounts received a fresh five-day window when the September 24
// access policy was announced (10:05 p.m. New York time). Keep this on a
// server-independent timeline so
// clearing browser storage or signing in on another device cannot reset it.
export const EXISTING_USER_GRACE_START = Date.parse('2026-09-24T22:05:00-04:00');

export interface TrialStatus {
  daysRemaining: number;
  isExpired: boolean;
}

// Existing users start September 24; later signups start at Firebase Auth's
// account-creation timestamp. Neither date depends on browser storage.
export function getTrialStatus(user: User, now = Date.now()): TrialStatus {
  const parsed = user.metadata?.creationTime ? Date.parse(user.metadata.creationTime) : NaN;
  // If creationTime is unavailable, do not grant an indefinitely renewable
  // trial. Firebase ordinarily supplies it for every signed-in account.
  const createdAt = Number.isFinite(parsed) ? parsed : EXISTING_USER_GRACE_START;
  const trialStart = Math.max(createdAt, EXISTING_USER_GRACE_START);
  const daysElapsed = (now - trialStart) / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed));
  return {
    daysRemaining,
    isExpired: daysElapsed >= TRIAL_DAYS
  };
}
