import { DocumentItem, Project, LegislationItem, KnowledgeNode, KnowledgeLink, AuditLog, OrgStats } from '../types';

export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'Meridian_SPA_v7.pdf',
    type: 'pdf',
    sizeBytes: 4200000,
    uploadDate: '2026-08-01T10:00:00.000Z',
    tags: ['SPA', 'Acquisition', 'Contract'],
    owner: 'ceo@signal87.ai',
    organization: 'Signal87 Executive',
    status: 'ready',
    aiIndexed: true,
    embeddingsComplete: true,
    versionHistory: [{ version: 1, updatedAt: '2026-08-01T10:00:00.000Z', updatedBy: 'ceo@signal87.ai', changeNote: 'Initial deposit' }],
    permissions: 'Organization',
    summary: 'Stock Purchase Agreement for Meridian acquisition including $4.2M liability cap and indemnification clauses.',
    riskHighlights: ['12% cap on seller indemnification', '18 month survival period on general representations'],
    contentPreview: 'STOCK PURCHASE AGREEMENT by and among Meridian Holdings Inc. and Signal87 Acquisition Sub.',
    category: 'Legal',
    folderId: 'fld_contracts'
  },
  {
    id: 'doc-2',
    title: 'Board_Minutes_Mar_2026.pdf',
    type: 'pdf',
    sizeBytes: 1100000,
    uploadDate: '2026-08-02T14:30:00.000Z',
    tags: ['Board', 'Governance', 'Minutes'],
    owner: 'ceo@signal87.ai',
    organization: 'Signal87 Executive',
    status: 'ready',
    aiIndexed: true,
    embeddingsComplete: true,
    versionHistory: [{ version: 1, updatedAt: '2026-08-02T14:30:00.000Z', updatedBy: 'ceo@signal87.ai', changeNote: 'Initial deposit' }],
    permissions: 'Organization',
    summary: 'Minutes of the Board of Directors meeting approving the acquisition framework and budget authorization.',
    riskHighlights: ['Unanimous board consent required for capital calls over $2M'],
    contentPreview: 'MINUTES OF THE SPECIAL MEETING OF THE BOARD OF DIRECTORS. Unanimous approval of resolution 2026-04.',
    category: 'Legal',
    folderId: 'fld_board'
  },
  {
    id: 'doc-3',
    title: 'Disclosure_Schedules_Q2.xlsx',
    type: 'xlsx',
    sizeBytes: 8400000,
    uploadDate: '2026-08-03T09:15:00.000Z',
    tags: ['Financials', 'Schedules', 'Audit'],
    owner: 'ceo@signal87.ai',
    organization: 'Signal87 Executive',
    status: 'ready',
    aiIndexed: true,
    embeddingsComplete: true,
    versionHistory: [{ version: 1, updatedAt: '2026-08-03T09:15:00.000Z', updatedBy: 'ceo@signal87.ai', changeNote: 'Initial deposit' }],
    permissions: 'Organization',
    summary: 'Detailed financial disclosure schedule breakdown across 14 tabs detailing active litigation reserves and liabilities.',
    riskHighlights: ['Litigation reserve shortfall of $120k noted in schedule 4.2'],
    contentPreview: 'Schedule 4.1: Material Contracts. Schedule 4.2: Litigation and Contingent Liabilities.',
    category: 'Financial',
    folderId: 'fld_financials'
  },
  {
    id: 'doc-4',
    title: 'Indemnification_Review.docx',
    type: 'docx',
    sizeBytes: 2300000,
    uploadDate: '2026-08-04T11:00:00.000Z',
    tags: ['Indemnity', 'Review', 'Memo'],
    owner: 'ceo@signal87.ai',
    organization: 'Signal87 Executive',
    status: 'ready',
    aiIndexed: true,
    embeddingsComplete: true,
    versionHistory: [{ version: 1, updatedAt: '2026-08-04T11:00:00.000Z', updatedBy: 'ceo@signal87.ai', changeNote: 'Initial deposit' }],
    permissions: 'Organization',
    summary: 'Legal memo comparative analysis of buyer vs seller indemnification obligations under Delaware law.',
    riskHighlights: ['Carve-outs for fraud and intentional misrepresentation extended to 36 months'],
    contentPreview: 'MEMORANDUM TO INVESTMENT COMMITTEE. Subject: Indemnification Risk Allocation in Meridian SPA.',
    category: 'Legal',
    folderId: 'fld_contracts'
  },
  {
    id: 'doc-5',
    title: 'Keynote_Executive_Summary.pptx',
    type: 'pptx',
    sizeBytes: 5600000,
    uploadDate: '2026-08-04T16:20:00.000Z',
    tags: ['Keynote', 'Presentation', 'Executive'],
    owner: 'ceo@signal87.ai',
    organization: 'Signal87 Executive',
    status: 'ready',
    aiIndexed: true,
    embeddingsComplete: true,
    versionHistory: [{ version: 1, updatedAt: '2026-08-04T16:20:00.000Z', updatedBy: 'ceo@signal87.ai', changeNote: 'Initial deposit' }],
    permissions: 'Organization',
    summary: '24-slide executive presentation outlining strategic synergies, cost savings targets, and post-merger integration timelines.',
    riskHighlights: ['Key personnel retention risks in year 1'],
    contentPreview: 'MERIDIAN ACQUISITION EXECUTIVE BRIEFING. Strategic Alignment & Financial Synergy Projections.',
    category: 'Research',
    folderId: 'fld_board'
  }
];

export const INITIAL_LEGISLATION: LegislationItem[] = [];

export const INITIAL_KNOWLEDGE_NODES: KnowledgeNode[] = [];

export const INITIAL_KNOWLEDGE_LINKS: KnowledgeLink[] = [];


export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_ORG_STATS: OrgStats = {
  totalDocs: 0,
  storageUsedBytes: 0,
  storageCapacityBytes: 5000000000, // 5 GB
  totalEmbeddings: 0,
  tokenUsageToday: 0,
  monthlyBudgetTokens: 100000000,
  activeUsers: 1,
  aiQueriesProcessed: 0,
  modelDistribution: [
    { model: 'Signal87 Standard Engine (Fast OCR & Q&A)', percentage: 80 },
    { model: 'Signal87 Deep Engine (Deep Research)', percentage: 20 }
  ]
};

