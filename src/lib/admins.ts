const ADMIN_EMAILS = [
  'mbenezra@erezcapital.io',
  'ceo@signal87.ai',
  'michaelraymondbenezra@gmail.com',
  'ddeluca@libertylutheran.org'
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
