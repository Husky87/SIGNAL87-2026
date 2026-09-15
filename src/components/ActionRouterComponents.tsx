import React, { useState, useMemo } from 'react';
import { exportResult } from "../lib/exportDocument";
import {
  Copy,
  Check,
  Download,
  Share2,
  FileSpreadsheet,
  Edit2,
  Save,
  Bookmark
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Spreadsheet from 'react-spreadsheet';
import { ChatMessage, Citation } from '../types';

export type DeliverableType = 'qa' | 'report' | 'table';

/**
 * Helpers for inline text formatting
 */
export const parseInlineStyles = (
  text: string,
  citations?: Citation[],
  onSelectDocument?: (doc: any) => void,
  documents?: any[]
) => {
  // Convert LaTeX-style math delimiters the model occasionally emits
  // (e.g. "$\rightarrow$") into plain Unicode symbols. Matched narrowly —
  // a dollar sign immediately followed by a backslash command — so real
  // currency amounts like "$45,000" are never touched.
  const withMathSymbols = text.replace(
    /\$\\(rightarrow|leftarrow|times|leq|geq|pm|approx|neq|cdot|div)\$/g,
    (_match, cmd: string) => {
      const symbols: Record<string, string> = {
        rightarrow: '→',
        leftarrow: '←',
        times: '×',
        leq: '≤',
        geq: '≥',
        pm: '±',
        approx: '≈',
        neq: '≠',
        cdot: '·',
        div: '÷',
      };
      return symbols[cmd] || _match;
    }
  );
  const clean = withMathSymbols.replace(/^#+\s*/, '');
  // Matches single citation markers like [3] as well as multi-source groups
  // like [3, 4, 11] — both are resolved (or dropped) by the handler below.
  const parts = clean.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[\d+(?:\s*,\s*\d+)*\]|\[CIT-\d+\]|\[SPA-\d+\.\d+\])/g);

  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--rule)] px-1.5 py-0.5 rounded-[3px] text-[11px] font-mono font-bold tracking-tight inline-block mx-0.5"
          style={{ fontFamily: 'var(--mono)' }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-[var(--ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-[var(--ink-2)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('[') && part.endsWith(']')) {
      const label = part.slice(1, -1);

      let indices: number[] = [];
      if (/^\d+(\s*,\s*\d+)*$/.test(label)) {
        indices = label.split(',').map((n) => parseInt(n.trim(), 10) - 1);
      } else if (label.startsWith('CIT-')) {
        indices = [parseInt(label.replace('CIT-', ''), 10) - 1];
      } else if (label.startsWith('SPA-')) {
        if (label.includes('8.2')) indices = [0];
        else if (label.includes('8.4')) indices = [1];
        else if (label.includes('8.7')) indices = [2];
      }

      const validIndices = citations && citations.length > 0
        ? indices.filter((n) => n >= 0 && n < citations.length)
        : [];

      if (validIndices.length === 0) {
        return null;
      }

      return (
        <React.Fragment key={idx}>
          {validIndices.map((citationIndex) => {
            const cite = citations![citationIndex];
            return (
              <button
                key={citationIndex}
                onClick={() => {
                  if (onSelectDocument) {
                    const matched = documents?.find(
                      (d) =>
                        d.id === cite.docId ||
                        d.title.toLowerCase().includes(cite.docTitle.toLowerCase()) ||
                        cite.docTitle.toLowerCase().includes(d.title.toLowerCase())
                    );
                    if (matched) {
                      onSelectDocument(matched);
                    } else {
                      onSelectDocument({
                        id: cite.docId || `doc-${Date.now()}`,
                        title: cite.docTitle || 'Document',
                        type: 'PDF',
                        sizeBytes: 1024 * 1024 * 2.4,
                        uploadDate: new Date().toLocaleDateString(),
                        tags: ['Citation', 'Verified'],
                        owner: 'Signal87 AI',
                        organization: 'Signal87 Enterprise',
                        status: 'Ready',
                        aiIndexed: true,
                        embeddingsComplete: true,
                        versionHistory: [],
                        permissions: 'Project Only',
                        summary: cite.snippet || 'Grounded citation reference for this synthesis.',
                        category: 'Legal',
                      });
                    }
                  }
                }}
                className="text-[var(--teal)] hover:opacity-80 font-bold text-xs cursor-pointer align-super mx-0.5 select-none hover:underline"
                title={cite.paragraphRef ? `View: ${cite.docTitle} (${cite.paragraphRef})` : `View: ${cite.docTitle}`}
              >
                [{citationIndex + 1}]
              </button>
            );
          })}
        </React.Fragment>
      );
    }
    return part;
  });
};

/**
 * Chambers-Style Clean Markdown Renderer
 */
export const GeminiMarkdownRenderer: React.FC<{
  text: string;
  citations?: Citation[];
  onSelectDocument?: (doc: any) => void;
  documents?: any[];
}> = ({ text, citations, onSelectDocument, documents }) => {
  const blocks = useMemo(() => {
    const rawLines = text.split('\n');
    const result: Array<{
      type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'excel_card' | 'hr';
      level?: number;
      content?: string;
      items?: string[];
      tableHeaders?: string[];
      tableRows?: string[][];
      lang?: string;
      excelData?: any;
    }> = [];

    let i = 0;
    while (i < rawLines.length) {
      const line = rawLines[i].trim();

      if (!line) {
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        result.push({ type: 'hr' });
        i++;
        continue;
      }

      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
          codeLines.push(rawLines[i]);
          i++;
        }
        if (i < rawLines.length && rawLines[i].trim().startsWith('```')) {
          i++;
        }

        const codeContent = codeLines.join('\n');

        if (codeContent.includes('"excel_export"') || codeContent.includes('excel_export')) {
          try {
            const cleanJson = codeContent.replace(/^json\s*/i, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.excel_export && parsed.excel_export.data) {
              result.push({
                type: 'excel_card',
                excelData: parsed.excel_export
              });
              continue;
            }
          } catch {
            // fallback
          }
        }

        result.push({
          type: 'code',
          lang: lang || 'code',
          content: codeContent
        });
        continue;
      }

      if (/^#+\s*/.test(line)) {
        const match = line.match(/^(#+)\s*(.*)/);
        if (match) {
          result.push({
            type: 'heading',
            level: match[1].length,
            content: match[2].trim()
          });
          i++;
          continue;
        }
      }

      if (line.startsWith('|') && line.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
          tableLines.push(rawLines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const validRows = tableLines.filter((r) => !/^\|[\s\-:|]+\|$/.test(r));
          if (validRows.length > 0) {
            const tableHeaders = validRows[0]
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim().replace(/[\*\_]/g, ''));
            const tableRows = validRows.slice(1).map((r) =>
              r
                .split('|')
                .slice(1, -1)
                .map((c) => c.trim().replace(/[\*\_]/g, ''))
            );
            result.push({
              type: 'table',
              tableHeaders,
              tableRows
            });
            continue;
          }
        }
      }

      const listMatch = line.match(/^([\*\-\+]|(\d+)\.)\s+(.*)/);
      if (listMatch) {
        const listItems: string[] = [];
        while (i < rawLines.length) {
          const l = rawLines[i].trim();
          const match = l.match(/^([\*\-\+]|(\d+)\.)\s+(.*)/);
          if (match) {
            listItems.push(match[3].trim());
            i++;
          } else {
            break;
          }
        }
        result.push({
          type: 'list',
          items: listItems
        });
        continue;
      }

      const paragraphLines: string[] = [];
      while (i < rawLines.length) {
        const l = rawLines[i].trim();
        if (!l) break;
        if (l.startsWith('```')) break;
        if (/^#+\s*/.test(l)) break;
        if (l.startsWith('|') && l.endsWith('|')) break;
        if (/^([\*\-\+]|(\d+)\.)\s+/.test(l)) break;
        paragraphLines.push(l);
        i++;
      }
      if (paragraphLines.length > 0) {
        result.push({
          type: 'paragraph',
          content: paragraphLines.join(' ')
        });
      }
    }

    return result;
  }, [text]);

  const downloadExcelFromBlock = (data: any[], filename = 'research_export.xlsx') => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="text-[15.5px] sm:text-[16px] leading-[1.6] text-[var(--ink)] tracking-normal space-y-1">
      {blocks.map((block, idx) => {
        if (block.type === 'hr') {
          return <hr key={idx} className="my-5 border-t border-[var(--rule)]" />;
        }

        if (block.type === 'excel_card') {
          return (
            <div key={idx} className="my-4 p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[3px] bg-[color-mix(in_srgb,var(--teal)_10%,transparent)] border border-[color-mix(in_srgb,var(--teal)_30%,transparent)] text-[var(--teal)] flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-mono font-bold text-[var(--teal)] uppercase tracking-[0.09em]" style={{ fontFamily: 'var(--mono)' }}>
                    EXCEL DATASET GENERATED
                  </div>
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {block.excelData.filename || 'analysis_export.xlsx'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => downloadExcelFromBlock(block.excelData.data, block.excelData.filename)}
                className="px-3.5 py-1.5 bg-[var(--teal)] hover:opacity-90 text-white text-xs font-semibold rounded-[3px] transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0"
              >
                <FileSpreadsheet size={14} />
                <span>Download .xlsx</span>
              </button>
            </div>
          );
        }

        if (block.type === 'code') {
          return (
            <div key={idx} className="my-3 border border-[var(--rule)] rounded-[4px] bg-[var(--surface)] overflow-hidden max-w-full">
              <div className="px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--rule)] text-[10px] font-mono font-bold uppercase tracking-[0.09em] text-[var(--muted)]" style={{ fontFamily: 'var(--mono)' }}>
                {block.lang || 'CODE'}
              </div>
              <div className="overflow-x-auto max-w-full">
                <pre className="p-3 text-xs font-mono text-[var(--ink)] leading-relaxed whitespace-pre-wrap break-all sm:break-normal" style={{ fontFamily: 'var(--mono)' }}>
                  {block.content}
                </pre>
              </div>
            </div>
          );
        }

        if (block.type === 'heading') {
          const cleanText = parseInlineStyles(block.content || '', citations, onSelectDocument, documents);
          if (block.level === 1) {
            return (
              <h1 key={idx} className="font-sans text-xl sm:text-2xl font-bold text-[var(--ink)] mt-6 mb-2.5 tracking-tight">
                {cleanText}
              </h1>
            );
          }
          if (block.level === 2) {
            return (
              <h2 key={idx} className="font-sans text-lg sm:text-xl font-semibold text-[var(--ink)] mt-5 mb-2 tracking-tight">
                {cleanText}
              </h2>
            );
          }
          return (
            <h3 key={idx} className="font-sans text-base sm:text-lg font-semibold text-[var(--ink)] mt-4 mb-1.5">
              {cleanText}
            </h3>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={idx} className="my-4 overflow-x-auto border border-[var(--rule)] rounded-[4px]">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-2)]">
                    {(block.tableHeaders || []).map((header, hIdx) => (
                      <th key={hIdx} className="text-left px-3 py-2 border-b border-[var(--rule)] font-semibold text-[var(--ink)] whitespace-nowrap">
                        {parseInlineStyles(header, citations, onSelectDocument, documents)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(block.tableRows || []).map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-[var(--rule)] last:border-b-0">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 align-top text-[var(--ink-2)]">
                          {parseInlineStyles(cell, citations, onSelectDocument, documents)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={idx} className="list-disc pl-5 my-2 space-y-1">
              {(block.items || []).map((item, itemIdx) => (
                <li key={itemIdx} className="pl-1">
                  {parseInlineStyles(item, citations, onSelectDocument, documents)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} className="my-2.5 text-[var(--ink-2)]">
            {parseInlineStyles(block.content || '', citations, onSelectDocument, documents)}
          </p>
        );
      })}
    </div>
  );
};

/**
 * Action router card: action-oriented UI attached to assistant responses.
 */
export const ActionRouterCard: React.FC<{
  msg: ChatMessage;
  userPrompt?: string;
  copiedMsgId: string | null;
  onCopy: (id: string, text: string) => void;
  onExportPDF: (title: string, text: string) => void;
  onInspectInCanvas?: (msg: ChatMessage) => void;
  onSelectDocument?: (doc: any) => void;
  documents?: any[];
  onSaveAnswer?: (msg: ChatMessage, question: string) => void;
  isAnswerSaved?: boolean;
}> = ({
  msg,
  userPrompt,
  copiedMsgId,
  onCopy,
  onExportPDF,
  onSelectDocument,
  documents,
  onSaveAnswer,
  isAnswerSaved
}) => {
  const [shareCopied, setShareCopied] = useState(false);
  const [isEditingExcel, setIsEditingExcel] = useState(false);
  const [spreadsheetData, setSpreadsheetData] = useState<any>(null);
  const [exporting, setExporting] = useState<"pdf" | "word" | "excel" | null>(null);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Ignore clipboard failures in browsers that block clipboard access.
    }
  };

  const exportAsPDF = async () => {
    try {
      setExporting("pdf");
      onExportPDF(msg.title || 'Signal87 Export', msg.content || '');
    } finally {
      setExporting(null);
    }
  };

  const exportAsWord = async () => {
    try {
      setExporting("word");
      await exportResult(msg.title || 'Signal87 Export', msg.content || '', 'word');
    } finally {
      setExporting(null);
    }
  };

  const exportAsExcel = async () => {
    try {
      setExporting("excel");
      await exportResult(msg.title || 'Signal87 Export', msg.content || '', 'excel');
    } finally {
      setExporting(null);
    }
  };

  const excelData = msg.metadata?.excelData;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <button
        onClick={() => onCopy(msg.id, msg.content || '')}
        className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
      >
        {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
      </button>

      <button
        onClick={exportAsPDF}
        disabled={exporting !== null}
        className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50"
      >
        {exporting === "pdf" ? "Exporting..." : "PDF"}
      </button>

      <button
        onClick={exportAsWord}
        disabled={exporting !== null}
        className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50"
      >
        {exporting === "word" ? "Exporting..." : "Word"}
      </button>

      <button
        onClick={exportAsExcel}
        disabled={exporting !== null}
        className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50"
      >
        {exporting === "excel" ? "Exporting..." : "Excel"}
      </button>

      {excelData && (
        <button
          onClick={() => {
            setSpreadsheetData(excelData);
            setIsEditingExcel(true);
          }}
          className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Edit2 size={13} /> Edit Excel
        </button>
      )}

      <button
        onClick={handleShare}
        className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-1.5"
      >
        <Share2 size={13} /> {shareCopied ? 'Copied' : 'Share'}
      </button>

      {onSaveAnswer && userPrompt && (
        <button
          onClick={() => onSaveAnswer(msg, userPrompt)}
          className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Bookmark size={13} /> {isAnswerSaved ? 'Saved' : 'Save'}
        </button>
      )}

      {isEditingExcel && spreadsheetData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-[var(--ink)]">Edit Excel</div>
              <button
                onClick={() => setIsEditingExcel(false)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                Close
              </button>
            </div>
            <Spreadsheet
              data={spreadsheetData}
              onChange={setSpreadsheetData}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setIsEditingExcel(false)}
                className="px-3 py-1.5 bg-[var(--teal)] text-white text-xs font-semibold rounded-[3px] cursor-pointer"
              >
                <Save size={13} className="inline mr-1" /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
