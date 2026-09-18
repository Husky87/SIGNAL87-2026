/**
 * Synthetic, anonymized stand-ins for the Phase 0 audit (docs/phase-0-audit.md).
 * None of this is real customer data — it exists only to give the retrieval
 * pipeline deterministic, sized text to move through the same code paths a
 * real Rockland Trust statement or Mount Horeb document would.
 */

/** Repeatable filler text, not random, so payload sizes are exactly reproducible. */
function fillerText(targetChars: number): string {
  const paragraph =
    'This portion of the statement lists routine account activity including ' +
    'recurring merchant payments, automated transfers, and standard service ' +
    'charges applied during the covered period. No action is required unless ' +
    'a line item appears unfamiliar to the account holder. ';
  let out = '';
  while (out.length < targetChars) out += paragraph;
  return out.slice(0, targetChars);
}

/** A small bank-statement-style document containing one findable fact (the "needle"). */
function rocklandTrustStatement(id: string, month: string, verizonAmount: string, verizonDate: string) {
  return {
    id,
    title: `Rockland Trust Statement - ${month}.pdf`,
    fullText:
      `[Page 1]\nRockland Trust Company - Business Checking Statement - ${month}\n` +
      `Account holder: Mount Horeb Lodging LLC\n\n` +
      `TRANSACTION HISTORY\n` +
      `${verizonDate}  VERIZON WIRELESS PAYMENT              -$${verizonAmount}\n` +
      `${verizonDate}  COMCAST BUSINESS                       -$212.00\n` +
      `${verizonDate}  STATE FARM INSURANCE                   -$340.50\n` +
      `[Page 2]\nEnding balance carried forward to next statement.\n`
  };
}

export const rocklandTrustMarch = rocklandTrustStatement('doc-rt-march', 'March 2026', '184.22', '03/14');
export const rocklandTrustApril = rocklandTrustStatement('doc-rt-april', 'April 2026', '184.22', '04/14');
export const rocklandTrustMay = rocklandTrustStatement('doc-rt-may', 'May 2026', '191.87', '05/14');

/** A small, single-fact control document — should always be answerable. */
export const mtHorebLease = {
  id: 'doc-lease',
  title: 'Mount Horeb Lodging Lease.pdf',
  fullText: '[Page 1]\nLEASE AGREEMENT\nMonthly base rent is $4,200.00, effective January 1, 2025.\n[Page 2]\nRemaining terms are standard.\n'
};

/** A large filler document, sized in whole characters, to consume context budget. */
export function fillerDocument(id: string, title: string, sizeChars: number) {
  return { id, title, fullText: `[Page 1]\n${fillerText(sizeChars)}` };
}

/** A small attached/ingested file (the second, parallel document pathway). */
export function rocklandTrustAttachment(fileName: string, verizonAmount: string, verizonDate: string) {
  return {
    fileName,
    extractedText: `[Page 1]\nRockland Trust Statement\n${verizonDate}  VERIZON WIRELESS PAYMENT  -$${verizonAmount}\n`,
    summaryInfo: '1 page'
  };
}

/** Stand-ins for what a scanned/image-only document's extraction looks like today. */
export const scannedDocEmptyExtraction = { id: 'doc-scan-empty', title: 'Scanned Invoice (blank OCR).pdf', fullText: '' };
export const scannedDocPdfBinaryNoise = {
  id: 'doc-scan-binary',
  title: 'Scanned Contract (raw bytes).pdf',
  // Mirrors what pdfjs failure used to fall back to storing (src/lib/extractedText.ts
  // header comment): the PDF container itself, not decoded text.
  fullText: '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\nstream\n\x00\x01\x02\x03\x04\x05\x06\x07endstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
};
export const scannedDocWhitespaceOnly = { id: 'doc-scan-blank', title: 'Scanned Receipt (no OCR text).pdf', fullText: '   \n\n\t  \n   \n' };
