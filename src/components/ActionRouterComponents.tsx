import React, { useState, useMemo } from 'react';
import { exportResult } from "../lib/exportDocument";
import { Copy, Check, Download, Share2, FileSpreadsheet, Edit2, Save, Bookmark } from 'lucide-react';
import * as XLSX from 'xlsx';
import Spreadsheet from 'react-spreadsheet';
import { ChatMessage } from '../types';
import { exportAnswerText, exportSourceLines, splitSentences } from '../lib/citationSegments';

export type DeliverableType = 'qa' | 'report' | 'table';

const MATH_SYMBOLS: Record<string, string> = { rightarrow: '→', leftarrow: '←', times: '×', leq: '≤', geq: '≥', pm: '±', approx: '≈', neq: '≠', cdot: '·', div: '÷' };

/** Text with citation sentinels swapped for rendered markers. */
const withMarkers = (text: string, key: string, marker: (nums: number[], key: string) => React.ReactNode): React.ReactNode[] =>
  text.split(/([\d,]+)/g).filter(Boolean).map((piece, i) =>
    piece.startsWith('') ? marker(piece.slice(1, -1).split(',').map(Number), `${key}m${i}`) : piece);

/** Inline markdown (code, bold, italics, a few LaTeX arrows) with citation markers rendered in place. */
const renderInline = (text: string, key: string, marker: (nums: number[], key: string) => React.ReactNode): React.ReactNode[] => {
  const clean = text
    .replace(/\$\\(rightarrow|leftarrow|times|leq|geq|pm|approx|neq|cdot|div)\$/g, (whole, cmd: string) => MATH_SYMBOLS[cmd] || whole)
    .replace(/^#+\s*/, '');
  return clean.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, i) => {
    const k = `${key}.${i}`;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) return <code key={k} className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--rule)] px-1.5 py-0.5 rounded-[3px] text-[11px] font-mono font-bold tracking-tight inline-block mx-0.5" style={{ fontFamily: 'var(--mono)' }}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 3) return <strong key={k} className="font-semibold text-[var(--ink)]">{withMarkers(part.slice(2, -2), k, marker)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 1) return <em key={k} className="italic text-[var(--ink-2)]">{withMarkers(part.slice(1, -1), k, marker)}</em>;
    return <React.Fragment key={k}>{withMarkers(part, k, marker)}</React.Fragment>;
  });
};

/**
 * How cited sentences look and behave. AssistantAnswer supplies it; without it,
 * citation numbers are hidden and sentences are plain text.
 */
export interface CitationUI {
  /** Show the raised [n] markers (Settings → Answer preferences). */
  showNumbers: boolean;
  /** Number of citations on the answer; markers beyond it are ignored. */
  citationCount: number;
  /** Citation numbers whose sentences are highlighted (a hovered or tapped source chip). */
  highlight: number[];
  /** Prefix for the ids of cited sentences, unique per answer. */
  idPrefix: string;
  /** The sentence whose sources popover is open, and the popover's id. */
  openId?: string | null;
  popoverId?: string;
  onSentenceEnter?: (id: string) => void;
  onSentenceLeave?: (id: string) => void;
  onSentenceActivate?: (id: string, cites: number[], viaKeyboard: boolean) => void;
  onSentenceEscape?: (id: string) => void;
}

const NO_CITATION_UI: CitationUI = { showNumbers: false, citationCount: 0, highlight: [], idPrefix: 'answer' };

/**
 * One block of inline text, split into sentences. A sentence that carries
 * citations is focusable and opens its sources; its markers are rendered
 * visible or hidden (hidden markers stay in the DOM so Word export keeps them).
 */
const renderCited = (content: string, key: string, ui: CitationUI, counter: { n: number }): React.ReactNode[] => {
  const valid = (nums: number[]) => nums.filter((n) => n >= 1 && n <= ui.citationCount);
  const marker = (nums: number[], k: string) => {
    const shown = valid(nums);
    if (!shown.length) return null;
    return <sup key={k} className={`s87-cite text-[var(--teal)] font-semibold select-none${ui.showNumbers ? '' : ' s87-cite--hidden'}`}>{shown.map((n) => `[${n}]`).join('')}</sup>;
  };
  return splitSentences(content).map((sentence, i) => {
    const k = `${key}s${i}`;
    const cites = valid(sentence.cites);
    if (sentence.gap || cites.length === 0) return <React.Fragment key={k}>{renderInline(sentence.text, k, marker)}</React.Fragment>;
    const id = `${ui.idPrefix}-c${counter.n++}`;
    const open = ui.openId === id;
    return (
      <span
        key={k}
        id={id}
        className="s87-cited"
        data-cites={cites.join(' ')}
        data-hl={cites.some((n) => ui.highlight.includes(n)) ? 'true' : undefined}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? ui.popoverId : undefined}
        onMouseEnter={() => ui.onSentenceEnter?.(id)}
        onMouseLeave={() => ui.onSentenceLeave?.(id)}
        onClick={() => ui.onSentenceActivate?.(id, cites, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.onSentenceActivate?.(id, cites, true); }
          else if (e.key === 'Escape') ui.onSentenceEscape?.(id);
        }}
      >
        {renderInline(sentence.text, k, marker)}
      </span>
    );
  });
};

export const GeminiMarkdownRenderer: React.FC<{ text: string; citationUI?: CitationUI }> = ({ text, citationUI }) => {
  const ui = citationUI || NO_CITATION_UI;
  // Cited sentences are numbered in reading order, so ids are stable between renders.
  const counter = { n: 0 };
  const inline = (content: string, key: string) => renderCited(content, key, ui, counter);
  const blocks = useMemo(() => {
    const rawLines = text.split('\n');
    const result: Array<{ type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'excel_card' | 'hr'; level?: number; content?: string; items?: string[]; tableHeaders?: string[]; tableRows?: string[][]; lang?: string; excelData?: any; }> = [];
    let i = 0;
    while (i < rawLines.length) {
      const line = rawLines[i].trim(); if (!line) { i++; continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { result.push({ type: 'hr' }); i++; continue; }
      if (line.startsWith('```')) { const lang = line.slice(3).trim(); const codeLines: string[] = []; i++; while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) { codeLines.push(rawLines[i]); i++; } if (i < rawLines.length && rawLines[i].trim().startsWith('```')) i++; const codeContent = codeLines.join('\n'); if (codeContent.includes('"excel_export"') || codeContent.includes('excel_export')) { try { const cleanJson = codeContent.replace(/^json\s*/i, '').trim(); const parsed = JSON.parse(cleanJson); if (parsed.excel_export && parsed.excel_export.data) { result.push({ type: 'excel_card', excelData: parsed.excel_export }); continue; } } catch {} } result.push({ type: 'code', lang: lang || 'code', content: codeContent }); continue; }
      if (/^#+\s*/.test(line)) { const match = line.match(/^(#+)\s*(.*)/); if (match) { result.push({ type: 'heading', level: match[1].length, content: match[2].trim() }); i++; continue; } }
      if (line.startsWith('|') && line.endsWith('|')) { const tableLines: string[] = []; while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) { tableLines.push(rawLines[i].trim()); i++; } if (tableLines.length >= 2) { const validRows = tableLines.filter((r) => !/^\|[\s\-:|]+\|$/.test(r)); if (validRows.length > 0) { const tableHeaders = validRows[0].split('|').slice(1, -1).map((c) => c.trim().replace(/[\*\_]/g, '')); const tableRows = validRows.slice(1).map((r) => r.split('|').slice(1, -1).map((c) => c.trim().replace(/[\*\_]/g, ''))); result.push({ type: 'table', tableHeaders, tableRows }); continue; } } }
      const listMatch = line.match(/^([\*\-\+]|(\d+)\.)\s+(.*)/); if (listMatch) { const listItems: string[] = []; while (i < rawLines.length) { const l = rawLines[i].trim(); const match = l.match(/^([\*\-\+]|(\d+)\.)\s+(.*)/); if (match) { listItems.push(match[3].trim()); i++; } else break; } result.push({ type: 'list', items: listItems }); continue; }
      const paragraphLines: string[] = []; while (i < rawLines.length) { const l = rawLines[i].trim(); if (!l || l.startsWith('```') || /^#+\s*/.test(l) || (l.startsWith('|') && l.endsWith('|')) || /^([\*\-\+]|(\d+)\.)\s+/.test(l)) break; paragraphLines.push(l); i++; } if (paragraphLines.length > 0) result.push({ type: 'paragraph', content: paragraphLines.join(' ') });
    }
    return result;
  }, [text]);
  const downloadExcelFromBlock = (data: any[], filename = 'research_export.xlsx') => { const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws, 'Data'); XLSX.writeFile(wb, filename); };
  return <div className="s87-prose text-[16px] leading-[1.7] text-[var(--ink)] tracking-normal">{blocks.map((block, idx) => {
    if (block.type === 'hr') return <hr key={idx} className="my-5 border-t border-[var(--rule)]" />;
    if (block.type === 'excel_card') return <div key={idx} className="my-4 p-4 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-[3px] bg-[color-mix(in_srgb,var(--teal)_10%,transparent)] border border-[color-mix(in_srgb,var(--teal)_30%,transparent)] text-[var(--teal)] flex items-center justify-center flex-shrink-0"><FileSpreadsheet size={18} /></div><div><div className="text-[10px] font-mono font-bold text-[var(--teal)] uppercase tracking-[0.09em]" style={{ fontFamily: 'var(--mono)' }}>EXCEL DATASET GENERATED</div><div className="text-sm font-semibold text-[var(--ink)]">{block.excelData.filename || 'analysis_export.xlsx'}</div></div></div><button onClick={() => downloadExcelFromBlock(block.excelData.data, block.excelData.filename)} className="px-3.5 py-1.5 bg-[var(--teal)] hover:opacity-90 text-white text-xs font-semibold rounded-[3px] transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0"><FileSpreadsheet size={14} /><span>Download .xlsx</span></button></div>;
    if (block.type === 'code') return <div key={idx} className="my-3 border border-[var(--rule)] rounded-[4px] bg-[var(--surface)] overflow-hidden max-w-full"><div className="px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--rule)] text-[10px] font-mono font-bold uppercase tracking-[0.09em] text-[var(--muted)]" style={{ fontFamily: 'var(--mono)' }}>{block.lang || 'CODE'}</div><div className="overflow-x-auto max-w-full"><pre className="p-3 text-xs font-mono text-[var(--ink)] leading-relaxed whitespace-pre-wrap break-all sm:break-normal" style={{ fontFamily: 'var(--mono)' }}>{block.content}</pre></div></div>;
    if (block.type === 'heading') { const cleanText = inline(block.content || '', `h${idx}`); if (block.level === 1) return <h1 key={idx} className="font-sans text-xl sm:text-2xl font-bold text-[var(--ink)] mt-6 mb-2.5 tracking-tight">{cleanText}</h1>; if (block.level === 2) return <h2 key={idx} className="font-sans text-lg sm:text-xl font-semibold text-[var(--ink)] mt-5 mb-2 tracking-tight">{cleanText}</h2>; return <h3 key={idx} className="font-sans text-base sm:text-lg font-semibold text-[var(--ink)] mt-4 mb-1.5">{cleanText}</h3>; }
    if (block.type === 'table') return <div key={idx} className="my-4 overflow-x-auto border border-[var(--rule)] rounded-[4px]"><table className="w-full text-sm border-collapse"><thead><tr className="bg-[var(--surface-2)]">{(block.tableHeaders || []).map((header, hIdx) => <th key={hIdx} className="text-left px-3 py-2 border-b border-[var(--rule)] font-semibold text-[var(--ink)] whitespace-nowrap">{inline(header, `t${idx}h${hIdx}`)}</th>)}</tr></thead><tbody>{(block.tableRows || []).map((row, rIdx) => <tr key={rIdx} className="border-b border-[var(--rule)] last:border-b-0">{row.map((cell, cIdx) => <td key={cIdx} className="px-3 py-2 align-top text-[var(--ink-2)]">{inline(cell, `t${idx}r${rIdx}c${cIdx}`)}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === 'list') return <ul key={idx} className="list-disc pl-6 my-3 space-y-1.5">{(block.items || []).map((item, itemIdx) => <li key={itemIdx} className="pl-1">{inline(item, `l${idx}i${itemIdx}`)}</li>)}</ul>;
    return <p key={idx} className="my-0 mb-4 last:mb-0 text-[var(--ink)]">{inline(block.content || '', `p${idx}`)}</p>;
  })}</div>;
};

export const StandardQAOutput = GeminiMarkdownRenderer;
export const DataTableOutput = GeminiMarkdownRenderer;
export function determineDeliverableType(_prompt?: string, _text?: string, _isDeepResearch?: boolean): DeliverableType { return 'qa'; }

const copyShareText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy is not available in this browser.');
};

export const ActionRouterCard: React.FC<{
  msg: ChatMessage; userPrompt?: string; copiedMsgId: string | null; onCopy: (id: string, text: string) => void; onExportPDF: (title: string, text: string) => void; onInspectInCanvas?: (msg: ChatMessage) => void; onSelectDocument?: (doc: any) => void; documents?: any[]; onSaveAnswer?: (msg: ChatMessage, question: string) => void; isAnswerSaved?: boolean;
}> = ({ msg, userPrompt, copiedMsgId, onCopy, onExportPDF, onSelectDocument, documents, onSaveAnswer, isAnswerSaved }) => {
  const [shareStatus, setShareStatus] = useState<'idle' | 'shared' | 'copied' | 'error'>('idle');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isEditingExcel, setIsEditingExcel] = useState(false);
  const [spreadsheetData, setSpreadsheetData] = useState<any>(null);
  const [exporting, setExporting] = useState<"pdf" | "word" | "excel" | null>(null);
  // Exports always carry numbered citations and a Sources list, whatever the on-screen setting.
  const exportText = exportAnswerText(msg.text || '', msg.citations || [], msg.sources || []);
  const handleShare = async () => {
    const title = userPrompt?.trim() || 'Signal87 answer';
    const answer = (msg.text || '').trim();
    try {
      if (navigator.share) {
        await navigator.share({ title, text: answer.slice(0, 1800), url: window.location.href });
        setShareStatus('shared');
      } else {
        await copyShareText(`${title}\n\n${answer}\n\n${window.location.href}`);
        setShareStatus('copied');
      }
      setTimeout(() => setShareStatus('idle'), 2500);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await copyShareText(`${title}\n\n${answer}\n\n${window.location.href}`);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2500);
      } catch {
        setShareStatus('error');
      }
    }
  };
  const exportAsPDF = async () => { try { setExporting('pdf'); onExportPDF(userPrompt?.trim() || 'Signal87 Export', exportText); } finally { setExporting(null); } };
  const exportAsWord = async () => { try { setExporting('word'); setActionNotice(null); const source = document.querySelector(`[data-export-message-id="${msg.id}"]`) as HTMLElement | null; await exportResult({ element: source, format: 'word', title: userPrompt?.trim() || 'Signal87 Export', filename: 'Signal87-AI-Brief', sources: exportSourceLines(msg.citations || [], msg.sources || []) }); setActionNotice('Word document downloaded.'); } catch (error) { console.error('Word export failed', error); setActionNotice('Word export failed. Please try again.'); } finally { setExporting(null); } };
  const exportAsExcel = async () => { try { setExporting('excel'); setActionNotice(null); const source = document.querySelector(`[data-export-message-id="${msg.id}"]`) as HTMLElement | null; await exportResult({ element: source, format: 'excel', title: userPrompt?.trim() || 'Signal87 Export', filename: 'Signal87-AI-Brief' }); setActionNotice('Excel workbook downloaded.'); } catch (error) { console.error('Excel export failed', error); setActionNotice('Excel export failed. Please try again.'); } finally { setExporting(null); } };
  const excelData = msg.excelExportData;
  const shareLabel = shareStatus === 'shared' ? 'Shared' : shareStatus === 'copied' ? 'Copied' : shareStatus === 'error' ? 'Share failed' : 'Share';
  return <div className="flex flex-wrap items-center gap-2 mt-3">
    <button onClick={() => onCopy(msg.id, exportText)} className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer">{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</button>
    <button onClick={exportAsPDF} disabled={exporting !== null} className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50">{exporting === 'pdf' ? 'Exporting...' : 'PDF'}</button>
    <button onClick={exportAsWord} disabled={exporting !== null} className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50">{exporting === 'word' ? 'Exporting...' : 'Word'}</button>
    <button onClick={exportAsExcel} disabled={exporting !== null} className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50">{exporting === 'excel' ? 'Exporting...' : 'Excel'}</button>
    {excelData && <button onClick={() => { setSpreadsheetData(excelData); setIsEditingExcel(true); }} className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-1.5"><Edit2 size={13} /> Edit Excel</button>}
    <button onClick={handleShare} className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-1.5"><Share2 size={13} /> {shareLabel}</button>
    {onSaveAnswer && userPrompt && <button onClick={() => onSaveAnswer(msg, userPrompt)} className="px-3 py-1.5 border border-[var(--rule)] rounded-[3px] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-1.5"><Bookmark size={13} /> {isAnswerSaved ? 'Saved' : 'Save'}</button>}
    {actionNotice && <span role="status" className="basis-full text-[11px] text-[var(--muted)]">{actionNotice}</span>}
    {isEditingExcel && spreadsheetData && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] p-4"><div className="flex items-center justify-between mb-3"><div className="font-semibold text-[var(--ink)]">Edit Excel</div><button onClick={() => setIsEditingExcel(false)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer">Close</button></div><Spreadsheet data={spreadsheetData} onChange={setSpreadsheetData} /><div className="mt-3 flex justify-end"><button onClick={() => setIsEditingExcel(false)} className="px-3 py-1.5 bg-[var(--teal)] text-white text-xs font-semibold rounded-[3px] cursor-pointer"><Save size={13} className="inline mr-1" /> Done</button></div></div></div>}
  </div>;
};
