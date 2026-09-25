/**
 * Optional account profile: who the user is, their company and how they use
 * Signal87. Every field is optional. It personalises answers (role, company and
 * industry go to Ask as context) and tells Signal87 who its users are.
 *
 * Stored at users/{uid}/account/profile, which the existing Firestore rules
 * already limit to the signed-in user. Admins read it with the Firebase Admin
 * SDK / console (which bypass client rules), never from another user's browser.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface AccountProfile {
  fullName?: string;
  preferredName?: string;
  jobTitle?: string;
  role?: string;
  company?: string;
  industry?: string;
  companySize?: string;
  teamSize?: string;
  location?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  useCases?: string[];
  documentTypes?: string[];
  documentsPerMonth?: string;
  goals?: string;
  referralSource?: string;
  productUpdates?: boolean;
  researchCalls?: boolean;
  updatedAt?: number;
  createdAt?: number;
}

export const ROLE_OPTIONS = ['Attorney / legal counsel', 'Paralegal', 'Compliance / risk', 'Finance / accounting', 'Real estate / development', 'Investor / private equity', 'Executive / founder', 'Operations', 'Consultant / advisor', 'Other'];
export const INDUSTRY_OPTIONS = ['Legal services', 'Financial services', 'Real estate', 'Private equity / venture', 'Insurance', 'Healthcare / life sciences', 'Government / public sector', 'Nonprofit', 'Technology', 'Other'];
export const COMPANY_SIZE_OPTIONS = ['Just me', '2–10', '11–50', '51–200', '201–1,000', '1,000+'];
export const TEAM_SIZE_OPTIONS = ['Just me', '2–5', '6–20', '21–50', '50+'];
export const USE_CASE_OPTIONS = ['Contract review', 'Due diligence', 'Regulatory compliance', 'Deal / loan documents', 'Tax & financial statements', 'Research & memos', 'Litigation support', 'Board & governance'];
export const DOCUMENT_TYPE_OPTIONS = ['Contracts & agreements', 'Leases', 'Loan documents & term sheets', 'Financial statements', 'Tax forms', 'Filings & regulations', 'Emails & correspondence', 'Spreadsheets'];
export const VOLUME_OPTIONS = ['Under 20', '20–100', '100–500', '500+'];
export const REFERRAL_OPTIONS = ['Search', 'LinkedIn', 'Colleague or friend', 'Event', 'There’s An AI For That', 'News or article', 'Other'];

/** Fields counted toward "profile complete" (contact preferences don't count). */
const COMPLETION_FIELDS: Array<keyof AccountProfile> = ['fullName', 'jobTitle', 'role', 'company', 'industry', 'companySize', 'location', 'useCases', 'documentTypes', 'documentsPerMonth', 'goals', 'referralSource'];

export function profileCompletion(p: AccountProfile | null | undefined): number {
  if (!p) return 0;
  const filled = COMPLETION_FIELDS.filter((k) => {
    const v = p[k];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v !== undefined && v !== null;
  }).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

const MAX_TEXT = 300;
const MAX_GOALS = 1000;

/** Trims strings, caps lengths, keeps only known options in lists, drops empty values. */
export function cleanProfile(p: AccountProfile): AccountProfile {
  const out: AccountProfile = {};
  const text = (v: unknown, max = MAX_TEXT) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  for (const k of ['fullName', 'preferredName', 'jobTitle', 'role', 'company', 'industry', 'companySize', 'teamSize', 'location', 'phone', 'documentsPerMonth', 'referralSource'] as const) {
    const v = text(p[k]);
    if (v) out[k] = v;
  }
  const goals = typeof p.goals === 'string' ? p.goals.trim().slice(0, MAX_GOALS) : '';
  if (goals) out.goals = goals;
  for (const k of ['linkedin', 'website'] as const) {
    const v = text(p[k]);
    if (v && /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) out[k] = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }
  const list = (v: unknown, allowed: string[]) => (Array.isArray(v) ? v.filter((x) => allowed.includes(String(x))).slice(0, allowed.length) : []);
  const useCases = list(p.useCases, USE_CASE_OPTIONS);
  if (useCases.length) out.useCases = useCases;
  const documentTypes = list(p.documentTypes, DOCUMENT_TYPE_OPTIONS);
  if (documentTypes.length) out.documentTypes = documentTypes;
  if (typeof p.productUpdates === 'boolean') out.productUpdates = p.productUpdates;
  if (typeof p.researchCalls === 'boolean') out.researchCalls = p.researchCalls;
  return out;
}

let cache: AccountProfile | null = null;
let cacheUid: string | null = null;

export async function loadAccountProfile(): Promise<AccountProfile | null> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) return null;
  if (cache && cacheUid === uid) return cache;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'account', 'profile'));
    cache = snap.exists() ? (snap.data() as AccountProfile) : {};
    cacheUid = uid;
    return cache;
  } catch (error) {
    console.warn('Could not load the account profile:', error);
    return null;
  }
}

export async function saveAccountProfile(p: AccountProfile): Promise<AccountProfile> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) throw new Error('Sign in to save your profile.');
  const now = Date.now();
  const clean = { ...cleanProfile(p), updatedAt: now, createdAt: cache?.createdAt ?? now };
  // Replace (not merge), so clearing a field in the form really removes it.
  await setDoc(doc(db, 'users', uid, 'account', 'profile'), clean);
  cache = clean;
  cacheUid = uid;
  return clean;
}

/** The few fields Ask uses as context: role and organisation, never contact details. */
export function profileForAsk(p: AccountProfile | null): { jobTitle?: string; role?: string; company?: string; industry?: string } {
  if (!p) return {};
  return {
    ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
    ...(p.role ? { role: p.role } : {}),
    ...(p.company ? { company: p.company } : {}),
    ...(p.industry ? { industry: p.industry } : {})
  };
}
