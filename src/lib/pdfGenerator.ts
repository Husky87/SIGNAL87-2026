import { jsPDF } from 'jspdf';
import { DocumentItem } from '../types';

// Cache used by PDFViewer. Entries must always contain valid PDF bytes.
export const fileDataCache = new Map<string, ArrayBuffer>();
const pdfUrlCache = new Map<string, string>();

export function getDocumentPdfUrl(doc: DocumentItem & { fullText?: string }): string {
  // Native PDFs can be rendered directly.
  if (doc.fileUrl && doc.type === 'pdf') return doc.fileUrl;

  const cacheKey = `${doc.id}_${doc.uploadDate}_${doc.title}`;
  if (pdfUrlCache.has(cacheKey)) return pdfUrlCache.get(cacheKey)!;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxLineWidth = pageWidth - margin * 2;

  pdf.setFillColor(19, 28, 37);
  pdf.rect(0, 0, pageWidth, 28, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('SIGNAL87 EXECUTIVE WORKSPACE · SECURED DOCUMENT', margin, 17);

  pdf.setTextColor(19, 28, 37);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  let y = 42;
  const titleLines = pdf.splitTextToSize(doc.title, maxLineWidth);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 7 + 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(110, 124, 137);
  pdf.text(`Type: ${doc.type.toUpperCase()}  |  Organization: ${doc.organization || 'Signal87 Executive'}  |  Owner: ${doc.owner || 'ceo@signal87.ai'}`, margin, y);
  y += 5;
  pdf.text(`Uploaded: ${new Date(doc.uploadDate).toLocaleDateString()}  |  ID: ${doc.id}`, margin, y);
  y += 7;
  pdf.setDrawColor(211, 217, 222);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);

  y += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(19, 28, 37);
  pdf.text('EXECUTIVE SUMMARY', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(61, 75, 88);
  const summaryLines = pdf.splitTextToSize(doc.summary || 'No summary available.', maxLineWidth);
  pdf.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 6;

  if (doc.riskHighlights?.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(140, 47, 39);
    pdf.text('RISK HIGHLIGHTS & COMPLIANCE NOTES', margin, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(61, 75, 88);
    for (const risk of doc.riskHighlights) {
      const riskLines = pdf.splitTextToSize(`• ${risk}`, maxLineWidth - 4);
      if (y + riskLines.length * 5 > pageHeight - 25) { pdf.addPage(); y = 20; }
      pdf.text(riskLines, margin + 4, y);
      y += riskLines.length * 5 + 2;
    }
    y += 4;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(19, 28, 37);
  pdf.text('DOCUMENT CONTENT & EXTRACTED TEXT', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(40, 40, 40);

  const fullContent = doc.fullText || doc.contentPreview || doc.summary || 'No detailed content available.';
  const contentLines = pdf.splitTextToSize(fullContent, maxLineWidth);
  for (const line of contentLines) {
    if (y > pageHeight - 25) { pdf.addPage(); y = 20; }
    pdf.text(line, margin, y);
    y += 5;
  }

  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(110, 124, 137);
    pdf.text(`Page ${i} of ${totalPages} — Signal87 Executive Workspace (Confidential)`, margin, pageHeight - 10);
  }

  const arrayBuffer = pdf.output('arraybuffer');
  fileDataCache.set(doc.id, arrayBuffer);
  const url = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/pdf' }));
  pdfUrlCache.set(cacheKey, url);
  return url;
}
