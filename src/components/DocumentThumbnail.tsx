import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Mail,
  Archive,
  File as FileIcon
} from 'lucide-react';
import { DocumentItem, DocumentFileType } from '../types';

type TypeMeta = {
  label: string;
  color: string;
  Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
};

/**
 * File-format accents. These are format identity rather than app chrome — they
 * have to stay distinguishable from one another — so they are category tokens
 * rather than --accent. They used to be Drive's own red/blue/green palette; the
 * roles are unchanged, but the hues now come from the Chambers family and live
 * in index.css like every other colour in the app.
 */
const TYPE_META: Record<DocumentFileType, TypeMeta> = {
  pdf: { label: 'PDF', color: 'var(--cat-brick)', Icon: FileText },
  docx: { label: 'Doc', color: 'var(--cat-sepia)', Icon: FileText },
  txt: { label: 'Text', color: 'var(--cat-stone)', Icon: FileText },
  xlsx: { label: 'Sheet', color: 'var(--cat-forest)', Icon: FileSpreadsheet },
  csv: { label: 'Sheet', color: 'var(--cat-forest)', Icon: FileSpreadsheet },
  pptx: { label: 'Slides', color: 'var(--cat-ochre)', Icon: Presentation },
  img: { label: 'Image', color: 'var(--cat-plum)', Icon: ImageIcon },
  email: { label: 'Email', color: 'var(--cat-sepia)', Icon: Mail },
  zip: { label: 'Archive', color: 'var(--cat-stone)', Icon: Archive }
};

export const getTypeMeta = (type: DocumentFileType): TypeMeta =>
  TYPE_META[type] || { label: 'File', color: 'var(--cat-stone)', Icon: FileIcon };

// The page inside a thumbnail is paper, not chrome: it stands for a real sheet
// of A4, so it stays white and its rule lines stay grey however the app is
// themed. --thumb-* still override it per theme if that ever stops being true.
const PAPER = 'var(--thumb-paper, #FFFFFF)';
const PAPER_INK = 'var(--thumb-ink, #57534E)';
const PAPER_INK_SOFT = 'var(--thumb-ink-soft, #8F8880)';

const isSpreadsheet = (type: DocumentFileType) => type === 'xlsx' || type === 'csv';

/** Splits delimited text into a small grid for spreadsheet previews. */
const toGrid = (text: string, maxRows: number, maxCols: number): string[][] =>
  text
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, maxRows)
    .map((line) => line.split(/[\t,;|]/).slice(0, maxCols).map((cell) => cell.trim()));

// Enough rows to overflow the frame, so the grid runs past the crop the way a
// real spreadsheet preview does instead of stopping at the last row of data.
const GRID_ROWS = 22;

const SpreadsheetPage: React.FC<{ text: string }> = ({ text }) => {
  const grid = toGrid(text, GRID_ROWS, 5);
  if (grid.length === 0) return null;
  const colCount = Math.max(...grid.map((r) => r.length));
  const padded: string[][] = [
    ...grid,
    ...Array.from({ length: Math.max(0, GRID_ROWS - grid.length) }, () => [] as string[])
  ];

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: '2.2cqw',
        lineHeight: 1.45,
        color: PAPER_INK
      }}
    >
      <tbody>
        {padded.map((row, r) => (
          <tr key={r}>
            {Array.from({ length: colCount }).map((_, c) => (
              <td
                key={c}
                style={{
                  border: '0.4px solid rgba(0,0,0,0.13)',
                  padding: '0.7cqw 1cqw',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  fontWeight: r === 0 ? 700 : 400,
                  background: r === 0 ? 'rgba(0,0,0,0.035)' : 'transparent'
                }}
              >
                {row[c] ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * Documents lead with their own heading, so the first short line becomes the
 * page title. Deliberately not doc.title — the filename already sits in the card
 * header above, and a page reading ".pdf" at the top looks nothing like a page.
 */
const splitHeading = (text: string): { heading: string; body: string } => {
  const lines = text.replace(/\r/g, '').split('\n');
  const first = lines.findIndex((l) => l.trim().length > 0);
  if (first === -1) return { heading: '', body: '' };

  const candidate = lines[first].trim();
  if (candidate.length > 90) return { heading: '', body: text.trim() };

  return { heading: candidate, body: lines.slice(first + 1).join('\n').trim() };
};

const ProsePage: React.FC<{ text: string }> = ({ text }) => {
  const { heading, body } = splitHeading(text);
  return (
    <>
      {heading && (
        <div
          style={{
            fontSize: '2.9cqw',
            fontWeight: 700,
            lineHeight: 1.35,
            color: PAPER_INK,
            marginBottom: '1.8cqw'
          }}
        >
          {heading}
        </div>
      )}
      <div
        style={{
          fontSize: '2.3cqw',
          lineHeight: 1.6,
          color: PAPER_INK_SOFT,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {body}
      </div>
    </>
  );
};

/**
 * Renders a document's preview as a miniature page. Text comes from the extracted
 * content already stored on the document, so no thumbnail files are generated,
 * stored, or fetched — the preview costs nothing beyond what upload already saved.
 */
export const DocumentThumbnail: React.FC<{ doc: DocumentItem }> = ({ doc }) => {
  const { Icon, color } = getTypeMeta(doc.type);

  // Real images preview themselves.
  if (doc.type === 'img' && doc.fileUrl) {
    return (
      <img
        src={doc.fileUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
    );
  }

  const preview = (doc.contentPreview || '').trim();

  // Nothing extracted (still indexing, or a binary like a zip): show the format.
  if (!preview) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
        <Icon size={30} style={{ color }} />
        <span className="text-[10px] text-[var(--muted)]">{getTypeMeta(doc.type).label}</span>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: PAPER,
        // Page text is sized in cqw against this box, so a preview looks like the
        // same page whether it sits in a 2-column phone grid or a 4-column desktop
        // one. Required for the cqw units below to resolve — without a query
        // container they fall back to viewport width.
        containerType: 'inline-size',
        // The frame is sized by aspect-ratio, not by this text, so letting the
        // browser skip layout for off-screen previews costs no layout shift.
        contentVisibility: 'auto'
      }}
    >
      {/* Inset like a page margin; the 4:3 frame crops the rest, as Drive does. */}
      <div style={{ padding: '8% 9% 0' }}>
        {isSpreadsheet(doc.type) ? (
          <SpreadsheetPage text={preview} />
        ) : (
          /* Comfortably more than fills the frame, so the page crops mid-flow
             under the fade rather than trailing off into blank paper — but not so
             much that long libraries pay to lay out text nobody can see. Because
             the type scales with the box, the amount that fits is the same at
             every card width. */
          <ProsePage text={preview.slice(0, 2200)} />
        )}
      </div>

      {/* Fade the crop so text doesn't end on a sliced glyph. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, transparent, ${PAPER})` }}
      />
    </div>
  );
};
