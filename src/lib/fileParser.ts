import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker to matching ESM version on jsdelivr/unpkg CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface ParsedFileResult {
  id: string;
  fileName: string;
  fileSizeFormatted: string;
  sizeBytes: number;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'other';
  extractedText: string;
  spreadsheetData?: any; // New field for raw tabular data
  rowCount?: number;
  columnCount?: number;
  charCount: number;
  wordCount: number;
  summaryInfo: string; // e.g. "124 rows, 8 columns" or "2.4 KB, 850 words"
}

export async function parseFileContent(file: File): Promise<ParsedFileResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const fileSizeFormatted = formatBytes(file.size);
  const id = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let extractedText = '';
  let rowCount: number | undefined = undefined;
  let columnCount: number | undefined = undefined;
  let fileType: ParsedFileResult['fileType'] = 'other';
  let spreadsheetData: any = undefined;

  try {
    if (['csv', 'tsv'].includes(extension)) {
      fileType = 'csv';
      const text = await readFileAsText(file);
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      rowCount = lines.length > 0 ? lines.length - 1 : 0; // Exclude header
      if (lines.length > 0) {
        columnCount = lines[0].split(extension === 'tsv' ? '\t' : ',').length;
      }
      extractedText = formatCsvAsText(text, extension === 'tsv' ? '\t' : ',');
      spreadsheetData = lines.map(line => line.split(extension === 'tsv' ? '\t' : ','));
    } else if (['xlsx', 'xls'].includes(extension)) {
      fileType = 'xlsx';
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      let totalRows = 0;
      let sheetsText: string[] = [];
      spreadsheetData = {};

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        totalRows += rows.length;

        spreadsheetData[sheetName] = rows;
        sheetsText.push(`--- Sheet: ${sheetName} ---\n${formatAsMarkdownTable(rows)}`); // No truncation here
      });

      rowCount = totalRows;
      extractedText = sheetsText.join('\n\n');
    } else if (extension === 'docx') {
      fileType = 'docx';
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const result = await mammoth.extractRawText({ arrayBuffer });
      extractedText = result.value || '';
    } else if (extension === 'pdf') {
      fileType = 'pdf';
      const arrayBuffer = await readFileAsArrayBuffer(file);
      try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        const pageTexts: string[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageItems = textContent.items.map((item: any) => item.str).join(' ');
          pageTexts.push(`[Page ${pageNum}]\n${pageItems}`);
        }
        extractedText = pageTexts.join('\n\n');
      } catch (pdfErr) {
        console.warn('PDF.js parsing fallback triggered:', pdfErr);
        // Fallback to text decoding
        extractedText = await readFileAsText(file);
      }
    } else {
      // txt, json, md, log, etc.
      fileType = extension === 'txt' ? 'txt' : 'other';
      extractedText = await readFileAsText(file);
    }
  } catch (err) {
    console.error(`Error parsing file ${file.name}:`, err);
    extractedText = `[Error parsing file content for ${file.name}: ${err instanceof Error ? err.message : String(err)}]`;
  }

  const wordCount = extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0;
  const charCount = extractedText.length;

  let summaryInfo = `${fileSizeFormatted}`;
  if (rowCount !== undefined && rowCount >= 0) {
    summaryInfo += `, ${rowCount.toLocaleString()} rows${columnCount ? ` x ${columnCount} cols` : ''}`;
  } else {
    summaryInfo += `, ${wordCount.toLocaleString()} words`;
  }

  return {
    id,
    fileName: file.name,
    fileSizeFormatted,
    sizeBytes: file.size,
    fileType,
    extractedText,
    rowCount,
    columnCount,
    charCount,
    wordCount,
    summaryInfo,
    spreadsheetData
  };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function formatCsvAsText(csvContent: string, delimiter: string = ','): string {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return '';

  // Return formatted tabular text
  return lines.map((line, idx) => {
    if (idx === 0) return `HEADER: ${line}`;
    return `ROW ${idx}: ${line}`;
  }).join('\n');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatAsMarkdownTable(rows: any[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(row => `| ${headers.map(h => (row[h] !== undefined ? row[h] : '')).join(' | ')} |`).join('\n');
  return `${headerRow}\n${separatorRow}\n${dataRows}`;
}
