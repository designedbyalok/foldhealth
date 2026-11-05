import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PROTOCOL_FILE_MAX, PROTOCOL_TEXT_MAX } from './protocolSchema';

/* Reads an uploaded protocol file in the browser: PDF text (with "[Page N]"
   markers so the parser can cite pages), Word text, or parsed JSON. The
   parser only ever sees text; the original file is kept as uploaded. */

const KIND_BY_EXT = { pdf: 'pdf', docx: 'docx', json: 'json' };

export const PROTOCOL_ACCEPT = '.pdf,.docx,.json';
export const PROTOCOL_ACCEPT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/json',
];

export function protocolFileKind(file) {
  const ext = String(file?.name || '').split('.').pop().toLowerCase();
  return KIND_BY_EXT[ext] || null;
}

async function pdfText(file) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  // Pages are independent; pdf.js queues the work in its worker, and
  // Promise.all keeps them in page order.
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, idx) => {
    const page = await pdf.getPage(idx + 1);
    const { items } = await page.getTextContent();
    // Keep line breaks where the PDF has them so tables stay readable.
    const text = items.map(it => `${it.str}${it.hasEOL ? '\n' : ' '}`).join('').replace(/[ \t]+\n/g, '\n').trim();
    return `[Page ${idx + 1}]\n${text}`;
  }));
  return { text: pages.join('\n\n'), pages: pdf.numPages };
}

async function docxText(file) {
  const { default: mammoth } = await import('mammoth/mammoth.browser');
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { text: value.trim(), pages: null };
}

/**
 * Resolves { kind, text, pages, json, truncated } or throws an Error whose
 * message can be shown as is.
 */
export async function extractProtocolText(file) {
  const kind = protocolFileKind(file);
  if (!kind) throw new Error('Upload a PDF, Word (.docx) or JSON file.');
  if (file.size > PROTOCOL_FILE_MAX) throw new Error('Files can be up to 25 MB.');

  if (kind === 'json') {
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      throw new Error('This JSON file could not be read. Check that it is valid JSON.');
    }
    const text = JSON.stringify(json, null, 2);
    return { kind, text: text.slice(0, PROTOCOL_TEXT_MAX), pages: null, json, truncated: text.length > PROTOCOL_TEXT_MAX };
  }

  const { text, pages } = kind === 'pdf' ? await pdfText(file) : await docxText(file);
  if (text.replace(/\[Page \d+\]/g, '').trim().length < 40) {
    throw new Error(kind === 'pdf'
      ? 'This PDF has no readable text (it may be a scan). Upload the Word version or a text-based PDF.'
      : 'This document has no readable text.');
  }
  return { kind, text: text.slice(0, PROTOCOL_TEXT_MAX), pages, json: null, truncated: text.length > PROTOCOL_TEXT_MAX };
}
