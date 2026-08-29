import {
  db,
  auth
} from './firebase';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';
import { DocumentItem, Project, ChatMessage, SavedItem } from '../types';
import { PdfEditOverlay } from './pdfEditTypes';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Notice (operating in resilient offline/local mode):', JSON.stringify(errInfo));
}

function currentUid(): string | null {
  return auth?.currentUser?.uid ?? null;
}

function userCollection(name: string) {
  const uid = currentUid();
  if (!uid) throw new Error('Not signed in');
  return collection(db, 'users', uid, name);
}

function userDocRef(name: string, id: string) {
  const uid = currentUid();
  if (!uid) throw new Error('Not signed in');
  return doc(db, 'users', uid, name, id);
}

function userPath(name: string, id?: string) {
  const uid = currentUid();
  if (!uid) return `users/?/${name}${id ? `/${id}` : ''}`;
  return id ? `users/${uid}/${name}/${id}` : `users/${uid}/${name}`;
}

export async function testFirestoreConnection() {
  const uid = currentUid();
  if (!uid) return;
  try {
    await getDocFromServer(doc(db, 'users', uid, '_meta', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase configuration notice: Client operating in offline mode.');
    }
  }
}

const DOCS_COLLECTION = 'documents';
const PROJECTS_COLLECTION = 'projects';
const CHAT_COLLECTION = 'chat_messages';
const SAVED_ITEMS_COLLECTION = 'saved_items';
const PDF_EDITS_COLLECTION = 'pdf_edits';

export async function fetchDocumentsFromFirestore(): Promise<DocumentItem[]> {
  if (!currentUid()) return [];
  try {
    const querySnapshot = await getDocs(userCollection(DOCS_COLLECTION));
    const docsList: DocumentItem[] = [];
    querySnapshot.forEach((docSnap) => {
      docsList.push({ id: docSnap.id, ...docSnap.data() } as DocumentItem);
    });
    return docsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, userPath(DOCS_COLLECTION));
    return [];
  }
}

export async function saveDocumentToFirestore(docItem: DocumentItem): Promise<string> {
  const docPath = userPath(DOCS_COLLECTION, docItem.id);
  try {
    const uid = currentUid();
    if (!uid) return docItem.id;
    await setDoc(userDocRef(DOCS_COLLECTION, docItem.id), {
      title: docItem.title,
      type: docItem.type,
      sizeBytes: docItem.sizeBytes,
      uploadDate: docItem.uploadDate,
      tags: docItem.tags || [],
      owner: docItem.owner || auth?.currentUser?.email || '',
      organization: docItem.organization || 'Signal87 AI',
      status: docItem.status || 'Indexed',
      aiIndexed: docItem.aiIndexed ?? true,
      category: docItem.category || 'General',
      summary: docItem.summary || '',
      contentPreview: docItem.contentPreview || '',
      fileUrl: docItem.fileUrl && !docItem.fileUrl.startsWith('blob:') ? docItem.fileUrl : '',
      starred: docItem.starred || false,
      trashed: docItem.trashed || false,
      trashedAt: docItem.trashedAt || null,
      folderId: docItem.folderId || null,
      permissions: docItem.permissions || 'Private',
      projectIds: docItem.projectIds || [],
      fullText: docItem.fullText || '',
      userId: uid
    }, { merge: true });
    return docItem.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
    return docItem.id;
  }
}

export async function deleteDocumentFromFirestore(docId: string): Promise<void> {
  const docPath = userPath(DOCS_COLLECTION, docId);
  try {
    if (!currentUid()) return;
    await deleteDoc(userDocRef(DOCS_COLLECTION, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function fetchProjectsFromFirestore(): Promise<Project[]> {
  if (!currentUid()) return [];
  try {
    const querySnapshot = await getDocs(userCollection(PROJECTS_COLLECTION));
    const projectsList: Project[] = [];
    querySnapshot.forEach((docSnap) => {
      projectsList.push({ id: docSnap.id, ...docSnap.data() } as Project);
    });
    return projectsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, userPath(PROJECTS_COLLECTION));
    return [];
  }
}

export async function saveProjectToFirestore(project: Project): Promise<void> {
  const docPath = userPath(PROJECTS_COLLECTION, project.id);
  try {
    if (!currentUid()) return;
    await setDoc(userDocRef(PROJECTS_COLLECTION, project.id), {
      name: project.name,
      description: project.description,
      category: project.category,
      documentIds: project.documentIds || [],
      status: project.status,
      createdAt: project.createdAt
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function fetchChatMessagesFromFirestore(): Promise<ChatMessage[]> {
  if (!currentUid()) return [];
  try {
    const q = query(userCollection(CHAT_COLLECTION), orderBy('timestampAsc', 'asc'), limit(50));
    const querySnapshot = await getDocs(q);
    const msgs: ChatMessage[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      msgs.push({
        id: docSnap.id,
        role: data.role,
        text: data.text,
        timestamp: data.timestamp,
        citations: data.citations,
        verificationTrace: data.verificationTrace,
        reasoningSteps: data.reasoningSteps,
        isDeepResearch: data.isDeepResearch
      });
    });
    return msgs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, userPath(CHAT_COLLECTION));
    return [];
  }
}

export async function saveChatMessageToFirestore(msg: ChatMessage): Promise<void> {
  const docPath = userPath(CHAT_COLLECTION, msg.id);
  try {
    const uid = currentUid();
    if (!uid) return;
    await setDoc(userDocRef(CHAT_COLLECTION, msg.id), {
      role: msg.role,
      text: msg.text,
      timestamp: msg.timestamp,
      timestampAsc: Date.now(),
      citations: msg.citations || [],
      verificationTrace: msg.verificationTrace || null,
      reasoningSteps: msg.reasoningSteps || [],
      isDeepResearch: Boolean(msg.isDeepResearch),
      userId: uid
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function fetchSavedItemsFromFirestore(): Promise<SavedItem[]> {
  if (!currentUid()) return [];
  try {
    const querySnapshot = await getDocs(userCollection(SAVED_ITEMS_COLLECTION));
    const list: SavedItem[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as SavedItem);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, userPath(SAVED_ITEMS_COLLECTION));
    return [];
  }
}

export async function saveSavedItemToFirestore(item: SavedItem): Promise<void> {
  const docPath = userPath(SAVED_ITEMS_COLLECTION, item.id);
  try {
    const uid = currentUid();
    if (!uid) return;
    if (item.type === 'note') {
      await setDoc(userDocRef(SAVED_ITEMS_COLLECTION, item.id), {
        type: 'note',
        title: item.title,
        body: item.body,
        linkedDocId: item.linkedDocId || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        userId: uid
      }, { merge: true });
    } else {
      await setDoc(userDocRef(SAVED_ITEMS_COLLECTION, item.id), {
        type: 'answer',
        text: item.text,
        citations: item.citations || [],
        question: item.question,
        timestamp: item.timestamp,
        userId: uid
      }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteSavedItemFromFirestore(id: string): Promise<void> {
  const docPath = userPath(SAVED_ITEMS_COLLECTION, id);
  try {
    if (!currentUid()) return;
    await deleteDoc(userDocRef(SAVED_ITEMS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/* ── Pending PDF edits ─────────────────────────────────────────────────────
   One document per edited PDF, at users/{uid}/pdf_edits/{docId}. The stored
   value is the pending-edit overlay: page order, rotations, the deleted-page
   set and form values. It is plain JSON and describes *intent* — the original
   bytes in Storage are never touched, and the overlay is applied to them only
   when the user exports.

   No security-rules change is needed: users/{userId}/{document=**} already
   restricts the whole subtree to its owner.                                */

/**
 * The raw stored overlay, or null when there is none.
 *
 * Deliberately untyped at this boundary. Validating it needs the PDF's real
 * page count — which this layer has no way to know — so the caller passes the
 * value through normalizeOverlay() once the document has been opened.
 */
export async function fetchPdfEditOverlayFromFirestore(docId: string): Promise<unknown | null> {
  if (!currentUid()) return null;
  try {
    const snapshot = await getDoc(userDocRef(PDF_EDITS_COLLECTION, docId));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath(PDF_EDITS_COLLECTION, docId));
    return null;
  }
}

export async function savePdfEditOverlayToFirestore(overlay: PdfEditOverlay): Promise<void> {
  const docPath = userPath(PDF_EDITS_COLLECTION, overlay.docId);
  try {
    const uid = currentUid();
    if (!uid) return;
    // Written field by field rather than by spreading the overlay: Firestore
    // rejects undefined, and every value below is a defined primitive, an
    // array of primitives, or an array of flat maps — all of which it stores.
    await setDoc(
      userDocRef(PDF_EDITS_COLLECTION, overlay.docId),
      {
        docId: overlay.docId,
        schemaVersion: overlay.schemaVersion,
        pages: overlay.pages.map((page) => ({
          id: page.id,
          sourceId: page.sourceId,
          sourceIndex: page.sourceIndex,
          rotation: page.rotation
        })),
        deletedOriginalPages: overlay.deletedOriginalPages,
        formValues: overlay.formValues,
        sources: overlay.sources.map((source) => ({
          id: source.id,
          fileName: source.fileName,
          pageCount: source.pageCount,
          sizeBytes: source.sizeBytes,
          addedAt: source.addedAt
        })),
        // Only geometry and provenance. A redaction never carries a copy of
        // the text it removes, so this write cannot become the leak the
        // redaction was for.
        redactions: overlay.redactions.map((redaction) => ({
          id: redaction.id,
          pageIndex: redaction.pageIndex,
          rect: {
            x: redaction.rect.x,
            y: redaction.rect.y,
            width: redaction.rect.width,
            height: redaction.rect.height
          },
          origin: redaction.origin
        })),
        flattenOnExport: overlay.flattenOnExport,
        updatedAt: overlay.updatedAt,
        userId: uid
      },
      { merge: false }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/** Discards the pending edits for a document, restoring the stored original. */
export async function deletePdfEditOverlayFromFirestore(docId: string): Promise<void> {
  const docPath = userPath(PDF_EDITS_COLLECTION, docId);
  try {
    if (!currentUid()) return;
    await deleteDoc(userDocRef(PDF_EDITS_COLLECTION, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
