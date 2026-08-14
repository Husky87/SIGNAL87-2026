/**
 * Reading half of the end-to-end check.
 *
 * Builds real files in the browser, runs them through the real parseFileContent
 * — same pdf.js worker, same code path an upload takes — and reports what came
 * out. Nothing here is stubbed: if the parser regresses, this goes red.
 */
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { parseFileContent } from '../src/lib/fileParser';
import { hasUsableText } from '../src/lib/extractedText';

const CONTRACT_LINES = [
  'MERCOR — OFFER OF ENGAGEMENT',
  '',
  'Dear Michael Benezra,',
  '',
  'We are pleased to offer you an engagement with Mercor Inc.',
  '',
  'Start Date: 08/12/2026',
  'Pay Rate: $70.00 USD per hour',
  'Engagement Type: Independent Contractor',
  'Reporting To: Talent Operations',
  'Notice Period: 14 days written notice by either party.',
  'Governing Law: State of Delaware.',
  '',
  'Confidentiality: Contractor shall not disclose Proprietary Information',
  'for a period of three (3) years following termination.',
  '',
  'Total minimum commitment: 20 hours per week.'
];

function makePdf(name: string): File {
  const doc = new jsPDF();
  doc.setFontSize(11);
  CONTRACT_LINES.forEach((line, i) => doc.text(line, 14, 20 + i * 7));
  return new File([doc.output('blob')], name, { type: 'application/pdf' });
}

function makeCsv(name: string): File {
  const rows = [
    'invoice,vendor,amount_usd,due_date',
    'INV-1001,Mercor Inc,4200.00,2026-09-01',
    'INV-1002,Northwind Legal,1875.50,2026-09-15',
    'INV-1003,Mercor Inc,3300.00,2026-10-01'
  ].join('\n');
  return new File([rows], name, { type: 'text/csv' });
}

function makeXlsx(name: string): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { clause: 'Termination', page: 4, risk: 'High' },
    { clause: 'Indemnity', page: 7, risk: 'Medium' }
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Clauses');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([out], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/** A PDF whose bytes are corrupt — pdf.js cannot open it. */
function makeBrokenPdf(name: string): File {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0xff, 0xfe, 0x00, 0x01]);
  return new File([bytes], name, { type: 'application/pdf' });
}

async function run() {
  const results: any = { checks: [], parsed: {} };
  const check = (name: string, ok: boolean, detail = '') =>
    results.checks.push({ name, ok, detail: ok ? '' : detail });

  // --- PDF: the format the reported bug involved ---
  const pdf = await parseFileContent(makePdf('Mercor Offer Letter.pdf'));
  results.parsed.pdf = pdf.extractedText;
  check('PDF parses to real text, not container bytes', hasUsableText(pdf.extractedText), pdf.extractedText.slice(0, 200));
  check('PDF start date survives extraction', pdf.extractedText.includes('08/12/2026'), pdf.extractedText.slice(0, 300));
  check('PDF pay rate survives extraction', pdf.extractedText.includes('$70.00'), pdf.extractedText.slice(0, 300));
  check('PDF governing law survives extraction', /Delaware/.test(pdf.extractedText));
  check('PDF notice period survives extraction', /14 days/.test(pdf.extractedText));
  check('PDF is page-tagged for locating answers', pdf.extractedText.includes('[Page 1]'));
  check('PDF word count is real', pdf.wordCount > 40, `wordCount=${pdf.wordCount}`);

  // --- A PDF that cannot be opened must be marked unreadable, never guessed at ---
  const broken = await parseFileContent(makeBrokenPdf('Corrupt.pdf'));
  results.parsed.broken = broken.extractedText;
  check('corrupt PDF is rejected, not salvaged into noise', !hasUsableText(broken.extractedText), broken.extractedText.slice(0, 200));
  check('corrupt PDF never yields container bytes as text', !broken.extractedText.includes('%PDF-1.4') || broken.extractedText.startsWith('[Error'), broken.extractedText.slice(0, 200));

  // --- CSV ---
  const csv = await parseFileContent(makeCsv('Invoices.csv'));
  results.parsed.csv = csv.extractedText;
  check('CSV parses to usable text', hasUsableText(csv.extractedText));
  check('CSV amounts survive extraction', csv.extractedText.includes('4200.00') && csv.extractedText.includes('1875.50'));
  check('CSV row count is right', csv.rowCount === 3, `rowCount=${csv.rowCount}`);

  // --- XLSX ---
  const xlsx = await parseFileContent(makeXlsx('Clauses.xlsx'));
  results.parsed.xlsx = xlsx.extractedText;
  check('XLSX parses to usable text', hasUsableText(xlsx.extractedText));
  check('XLSX cell values survive extraction', xlsx.extractedText.includes('Termination') && xlsx.extractedText.includes('Indemnity'));

  // --- TXT ---
  const txt = await parseFileContent(new File(['Effective Date: 01/03/2027. Counterparty: Acme LLC.'], 'note.txt', { type: 'text/plain' }));
  results.parsed.txt = txt.extractedText;
  check('TXT parses to usable text', hasUsableText(txt.extractedText) && txt.extractedText.includes('01/03/2027'));

  // --- An unsupported type must fail loudly ---
  const img = await parseFileContent(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'scan.png', { type: 'image/png' }));
  check('images are refused rather than silently emptied', !hasUsableText(img.extractedText) && img.extractedText.includes('Cannot extract text'), img.extractedText.slice(0, 160));

  (document.getElementById('out') as HTMLElement).textContent = JSON.stringify(results);
  (window as any).__done = true;
}

run().catch((e) => {
  (document.getElementById('out') as HTMLElement).textContent = JSON.stringify({ fatal: String(e) });
  (window as any).__done = true;
});
