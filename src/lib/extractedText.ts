/**
 * Whether a document's stored text is real prose the model can answer from.
 *
 * PDF text extraction used to fall back to reading the raw file bytes as text
 * when pdf.js failed, which stores the PDF container — `%PDF-1.7`, object
 * tables, compressed streams — instead of the document. That was then handed to
 * the model as if it were the contract, so questions about it were answered
 * from noise. Documents uploaded during that period still carry it, so the
 * check has to run at question time, not only at upload.
 */

/** A leading %PDF header, or a body dominated by bytes that are not text. */
export function looksLikeBinary(text: string): boolean {
  const sample = text.slice(0, 4000);
  if (!sample) return false;
  if (/^\s*%PDF-/.test(sample)) return true;
  if (/\/(Type|Filter|Length)\s*\/?\w*\s*(obj|stream)/.test(sample) && sample.includes('endobj')) return true;

  let unprintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    // Control characters other than tab, newline and carriage return, plus
    // lone replacement characters, indicate decoded binary rather than text.
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 0xfffd) unprintable++;
  }
  return unprintable / sample.length > 0.05;
}

/** The parser's own failure marker, written when extraction threw. */
export function isExtractionError(text: string): boolean {
  return /^\s*\[Error parsing file content/.test(text);
}

/**
 * True when the text can be used as evidence. Deliberately conservative: it is
 * better to tell the user a document is not readable than to answer from noise.
 */
export function hasUsableText(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 20) return false;
  if (isExtractionError(trimmed)) return false;
  if (looksLikeBinary(trimmed)) return false;
  return true;
}
