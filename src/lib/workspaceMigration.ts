/**
 * Workspaces used to live under flat localStorage keys shared by every account
 * (`signal87_documents`), before data was namespaced per user
 * (`signal87_documents_{uid}`). Without a migration, everyone with an existing
 * library opens the app to an empty workspace while their data sits orphaned
 * under the old key — and because Firestore sync was broken for some time, that
 * cache is frequently the only copy.
 */
export const LEGACY_WORKSPACE_KEYS = [
  'documents',
  'folders',
  'saved_items',
  'attached_files'
];

/**
 * Adopts any legacy workspace into `uid`'s namespace, once.
 *
 * Never overwrites data the account already has. Removes each legacy key as it
 * is adopted, so a second account signing in on the same browser cannot inherit
 * the same workspace.
 *
 * @returns the keys that were adopted.
 */
export function adoptLegacyWorkspace(uid: string, store: Storage = localStorage): string[] {
  const adopted: string[] = [];
  try {
    if (store.getItem(`signal87_migrated_${uid}`)) return adopted;

    for (const key of LEGACY_WORKSPACE_KEYS) {
      const legacy = store.getItem(`signal87_${key}`);
      if (legacy === null) continue;

      const scoped = `signal87_${key}_${uid}`;
      if (store.getItem(scoped) === null) {
        store.setItem(scoped, legacy);
        adopted.push(key);
      }
      store.removeItem(`signal87_${key}`);
    }

    store.setItem(`signal87_migrated_${uid}`, '1');
  } catch (e) {
    console.warn('Legacy workspace migration skipped:', e);
  }
  return adopted;
}
