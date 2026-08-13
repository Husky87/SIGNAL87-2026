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
  getDocFromServer
} from 'firebase/firestore';
import { DocumentItem, Project, GeneratedReport, ChatMessage, SavedItem } from '../types';

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
const REPORTS_COLLECTION = 'reports';
const CHAT_COLLECTION = 'chat_messages';
const SAVED_ITEMS_COLLECTION = 'saved_items';

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

export async function fetchReportsFromFirestore(): Promise<GeneratedReport[]> {
  if (!currentUid()) return [];
  try {
    const querySnapshot = await getDocs(userCollection(REPORTS_COLLECTION));
    const reportsList: GeneratedReport[] = [];
    querySnapshot.forEach((docSnap) => {
      reportsList.push({ id: docSnap.id, ...docSnap.data() } as GeneratedReport);
    });
    return reportsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, userPath(REPORTS_COLLECTION));
    return [];
  }
}

export async function saveReportToFirestore(report: GeneratedReport): Promise<void> {
  const docPath = userPath(REPORTS_COLLECTION, report.id);
  try {
    if (!currentUid()) return;
    await setDoc(userDocRef(REPORTS_COLLECTION, report.id), {
      title: report.title,
      templateId: report.templateId,
      content: report.content,
      author: report.author,
      generatedAt: report.generatedAt,
      userId: currentUid()
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
