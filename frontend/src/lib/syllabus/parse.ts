// Browser-side text extraction for syllabus uploads.
//
// PDF: pdfjs-dist's legacy build, configured with a worker URL Vite can
// resolve. DOCX: mammoth's browser bundle. Both produce a single plain-text
// string that the LLM extractor then turns into structured course data.

import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth/mammoth.browser";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type SyllabusFileKind = "pdf" | "docx" | "txt";

export interface ParsedSyllabus {
  kind: SyllabusFileKind;
  text: string;
  filename: string;
}

export function detectKind(file: File): SyllabusFileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt") || file.type.startsWith("text/")) return "txt";
  return null;
}

export async function parseSyllabus(file: File): Promise<ParsedSyllabus> {
  const kind = detectKind(file);
  if (!kind) throw new Error("Unsupported file type — use PDF, DOCX, or TXT.");
  if (kind === "txt") {
    return { kind, filename: file.name, text: await file.text() };
  }
  if (kind === "pdf") {
    return { kind, filename: file.name, text: await extractPdf(file) };
  }
  return { kind, filename: file.name, text: await extractDocx(file) };
}

async function extractPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) out.push(pageText);
  }
  return out.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value.trim();
}
