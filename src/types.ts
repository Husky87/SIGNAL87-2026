/**
 * Signal87 AI - Core Application Types
 */

export type DocumentFileType = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'img' | 'email' | 'txt' | 'zip' | 'csv';

export type DocumentStatus = 'indexing' | 'ready' | 'error';

export interface DocumentVersion {
  version: number;
  updatedAt: string;
  updatedBy: string;
  changeNote: string;
}

export interface DocumentEntity {
  name: string;
  type: 'Person' | 'Company' | 'Location' | 'Law' | 'Amount' | 'Date' | 'Contract' | 'Policy';
  relevance: number; // 0 - 100
}

export interface FolderItem {
  id: string;
  name: string;
  color?: string; // e.g. '#1a73e8', '#0f9d58', '#f4b400', '#ea4335', '#a142f4', '#5f6368'
  parentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  category?: string;
  documentIds?: string[];
  status?: string;
}

export type Project = FolderItem;

export interface DocumentItem {
  id: string;
  title: string;
  type: DocumentFileType;
  sizeBytes: number;
  uploadDate: string;
  tags: string[];
  owner: string;
  organization: string;
  status: DocumentStatus;
  aiIndexed: boolean;
  embeddingsComplete: boolean;
  versionHistory: DocumentVersion[];
  permissions: 'Private' | 'Project Only' | 'Organization';
  summary?: string;
  entities?: DocumentEntity[];
  riskHighlights?: string[];
  contentPreview?: string;
  category: 'Legal' | 'Legislative' | 'Financial' | 'Medical' | 'Research' | 'Operations';
  fileUrl?: string;
  folderId?: string;
  projectIds?: string[];
}

export interface Citation {
  docId: string;
  docTitle: string;
  paragraphRef: string;
  snippet: string;
  confidence: number; // Percentage, e.g. 98
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: Citation[];
  verificationTrace?: {
    steps: string[];
    modelsUsed: string[];
    contextTokensProcessed: number;
    latencyMs: number;
  };
  reasoningSteps?: string[];
  isDeepResearch?: boolean;
  deliverableType?: 'qa' | 'report' | 'table';
  excelExportData?: { filename: string; data: any[] };
}

export interface LegislationItem {
  id: string;
  billNumber: string;
  title: string;
  status: 'Introduced' | 'In Committee' | 'Passed House' | 'Passed Senate' | 'Enacted' | 'Vetoed';
  sponsor: string;
  committee: string;
  introducedDate: string;
  lastAction: string;
  summary: string;
  impactAnalysis: string;
  politicalImplications: string;
  relatedDocIds: string[];
  votes: { Yea: number; Nay: number; Abstain: number };
  stakeholders: string[];
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'Person' | 'Company' | 'Address' | 'Bill' | 'Law' | 'Contract' | 'Date' | 'Investment';
  docCount: number;
  details: string;
}

export interface KnowledgeLink {
  source: string;
  target: string;
  label: string;
  strength: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  iconName: string;
}

export interface GeneratedReport {
  id: string;
  title: string;
  templateId: string;
  content: string;
  generatedAt: string;
  author: string;
  sourcesCount: number;
  status: 'Draft' | 'Final' | 'Exported';
  tags: string[];
}

export interface ComparisonResult {
  documentIds: string[];
  summary: string;
  similarities: string[];
  differences: string[];
  missingClauses: string[];
  conflicts: string[];
  repeatedLanguage: string[];
  riskTrends: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  ip: string;
  status: 'Success' | 'Denied' | 'Warning';
}

export interface OrgStats {
  totalDocs: number;
  storageUsedBytes: number;
  storageCapacityBytes: number;
  totalEmbeddings: number;
  tokenUsageToday: number;
  monthlyBudgetTokens: number;
  activeUsers: number;
  aiQueriesProcessed: number;
  modelDistribution: { model: string; percentage: number }[];
}
