import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageProps } from 'react-pdf';

type CustomTextRenderer = NonNullable<PageProps['customTextRenderer']>;

/**
 * One page's text as pdf.js reports it, joined into a single string so a phrase
 * that wraps from one text item to the next can still be found. `items[i]` is the
 * character range of text item `i` in that string. Item indexes follow
 * `page.getTextContent()`, which is what react-pdf's text layer numbers them by.
 */
export interface PageText {
  text: string;
  items: { start: number; end: number }[];
}

export interface SearchMatch {
  /** 1-based page number. */
  page: number;
  start: number;
  end: number;
}

export async function extractPageTexts(pdf: PDFDocumentProxy): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let text = '';
    const items = content.items.map((item) => {
      if (!('str' in item)) return { start: text.length, end: text.length };
      const start = text.length;
      text += item.str;
      const end = text.length;
      // A line break between items reads as a space, so "net thirty\ndays" matches "thirty days".
      if (item.hasEOL) text += ' ';
      return { start, end };
    });
    pages.push({ text, items });
  }
  return pages;
}

export function findMatches(pages: PageText[], query: string): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches: SearchMatch[] = [];
  pages.forEach((page, index) => {
    const haystack = page.text.toLowerCase();
    let from = 0;
    while (from <= haystack.length - needle.length) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      matches.push({ page: index + 1, start: at, end: at + needle.length });
      from = at + needle.length;
    }
  });
  return matches;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Wraps every match on the rendered page in a <mark>. The text layer's spans are
 * transparent and sit exactly over the drawn text, so the mark's background lands
 * on top of the words. The current match carries a distinct class, and every
 * piece carries its match number so the viewer can scroll to the current one.
 */
export function buildHighlightRenderer(
  pages: PageText[],
  matches: SearchMatch[],
  activeIndex: number
): CustomTextRenderer {
  return ({ str, itemIndex, pageNumber }) => {
    const page = pages[pageNumber - 1];
    const range = page?.items[itemIndex];
    if (!range || range.end === range.start) return escapeHtml(str);

    let html = '';
    let cursor = 0;
    matches.forEach((match, index) => {
      if (match.page !== pageNumber || match.end <= range.start || match.start >= range.end) return;
      const from = Math.max(match.start, range.start) - range.start;
      const to = Math.min(match.end, range.end) - range.start;
      if (from < cursor) return;
      const isActive = index === activeIndex;
      html += escapeHtml(str.slice(cursor, from));
      html += `<mark class="s87-search-hit${isActive ? ' s87-search-hit-active' : ''}" data-match="${index}">${escapeHtml(str.slice(from, to))}</mark>`;
      cursor = to;
    });
    return html + escapeHtml(str.slice(cursor));
  };
}
