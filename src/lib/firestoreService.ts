import {
  db,
  auth
} from './firebase';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
  getDocFromServer
} from 'firebase/firestore';
import { DocumentItem, Project, GeneratedReport, ChatMessage } from '../types';

// Skill Error Handler Standards
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

// Connection check per Firebase Skill
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase configuration notice: Client operating in offline mode.');
    }
  }
}

// Collection Names
const DOCS_COLLECTION = 'documents';
const PROJECTS_COLLECTION = 'projects';
const REPORTS_COLLECTION = 'reports';
const CHAT_COLLECTION = 'chat_messages';

// Fetch Documents from Firestore
export async function fetchDocumentsFromFirestore(): Promise<DocumentItem[]> {
  try {
    const querySnapshot = await getDocs(collection(db, DOCS_COLLECTION));
    const docsList: DocumentItem[] = [];
    querySnapshot.forEach((docSnap) => {
      docsList.push({ id: docSnap.id, ...docSnap.data() } as DocumentItem);
    });
    return docsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, DOCS_COLLECTION);
    return [];
  }
}

// Save or Update Document in Firestore
export async function saveDocumentToFirestore(docItem: DocumentItem): Promise<string> {
  const docPath = `${DOCS_COLLECTION}/${docItem.id}`;
  try {
    const docRef = doc(db, DOCS_COLLECTION, docItem.id);
    await setDoc(docRef, {
      title: docItem.title,
      type: docItem.type,
      sizeBytes: docItem.sizeBytes,
      uploadDate: docItem.uploadDate,
      tags: docItem.tags || [],
      owner: docItem.owner || 'Signal87 Executive',
      organization: docItem.organization || 'Signal87 AI',
      status: docItem.status || 'Indexed',
      aiIndexed: docItem.aiIndexed ?? true,
      category: docItem.category || 'General',
      summary: docItem.summary || '',
      contentPreview: docItem.contentPreview || ''
    });
    return docItem.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
    return docItem.id;
  }
}

// Delete Document from Firestore
export async function deleteDocumentFromFirestore(docId: string): Promise<void> {
  const docPath = `${DOCS_COLLECTION}/${docId}`;
  try {
    await deleteDoc(doc(db, DOCS_COLLECTION, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// Fetch Projects from Firestore
export async function fetchProjectsFromFirestore(): Promise<Project[]> {
  try {
    const querySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
    const projectsList: Project[] = [];
    querySnapshot.forEach((docSnap) => {
      projectsList.push({ id: docSnap.id, ...docSnap.data() } as Project);
    });
    return projectsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROJECTS_COLLECTION);
    return [];
  }
}

// Save Project to Firestore
export async function saveProjectToFirestore(project: Project): Promise<void> {
  const docPath = `${PROJECTS_COLLECTION}/${project.id}`;
  try {
    const docRef = doc(db, PROJECTS_COLLECTION, project.id);
    await setDoc(docRef, {
      name: project.name,
      description: project.description,
      category: project.category,
      documentIds: project.documentIds || [],
      status: project.status,
      createdAt: project.createdAt
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// Fetch Reports from Firestore
export async function fetchReportsFromFirestore(): Promise<GeneratedReport[]> {
  try {
    const querySnapshot = await getDocs(collection(db, REPORTS_COLLECTION));
    const reportsList: GeneratedReport[] = [];
    querySnapshot.forEach((docSnap) => {
      reportsList.push({ id: docSnap.id, ...docSnap.data() } as GeneratedReport);
    });
    return reportsList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, REPORTS_COLLECTION);
    return [];
  }
}

// Save Report to Firestore
export async function saveReportToFirestore(report: GeneratedReport): Promise<void> {
  const docPath = `${REPORTS_COLLECTION}/${report.id}`;
  try {
    const docRef = doc(db, REPORTS_COLLECTION, report.id);
    await setDoc(docRef, {
      title: report.title,
      templateId: report.templateId,
      content: report.content,
      author: report.author,
      generatedAt: report.generatedAt
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// Fetch Chat History from Firestore
export async function fetchChatMessagesFromFirestore(): Promise<ChatMessage[]> {
  try {
    const q = query(collection(db, CHAT_COLLECTION), orderBy('timestampAsc', 'asc'), limit(50));
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
    handleFirestoreError(error, OperationType.LIST, CHAT_COLLECTION);
    return [];
  }
}

// Save Chat Message to Firestore
export async function saveChatMessageToFirestore(msg: ChatMessage): Promise<void> {
  const docPath = `${CHAT_COLLECTION}/${msg.id}`;
  try {
    const docRef = doc(db, CHAT_COLLECTION, msg.id);
    await setDoc(docRef, {
      role: msg.role,
      text: msg.text,
      timestamp: msg.timestamp,
      timestampAsc: Date.now(),
      citations: msg.citations || [],
      verificationTrace: msg.verificationTrace || null,
      reasoningSteps: msg.reasoningSteps || [],
      isDeepResearch: Boolean(msg.isDeepResearch)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

