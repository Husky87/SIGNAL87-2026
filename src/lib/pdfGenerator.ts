import { DocumentItem } from '../types';

// Original bytes captured at upload time, so a document can still be previewed
// before (or without) a successful Storage upload. Entries must always contain
// valid PDF bytes — PDFViewer checks the %PDF- header before trusting them.
export const fileDataCache = new Map<string, ArrayBuffer>();

/**
 * The URL of the document's own PDF, or '' when there isn't one.
 *
 * This used to manufacture a PDF with jsPDF whenever the real file was missing
 * or wasn't a PDF — a cover page reading "SIGNAL87 EXECUTIVE WORKSPACE ·
 * SECURED DOCUMENT" followed by the extracted text, complete with page footers.
 * Opening a Word file, or any document whose upload to Storage had failed,
 * therefore produced an official-looking document the user had never seen, in
 * place of the one they asked for.
 *
 * Callers should treat '' as "there is nothing to render here" and show the
 * extracted text instead, clearly labelled as extracted text.
 */
export function getDocumentPdfUrl(doc: DocumentItem): string {
  return doc.type === 'pdf' && doc.fileUrl ? doc.fileUrl : '';
}

/** Whether a document has a real PDF that pdf.js can render. */
export function hasRenderablePdf(doc: DocumentItem): boolean {
  return doc.type === 'pdf' && (!!doc.fileUrl || fileDataCache.has(doc.id));
}
