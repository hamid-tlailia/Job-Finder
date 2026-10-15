import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function readCvFile(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      const lines: string[] = [];
      let lastY: number | undefined;
      for (const it of content.items as { str: string; transform: number[] }[]) {
        const y = it.transform[5];
        if (lastY !== undefined && Math.abs(y - lastY) > 2) {
          lines.push(line);
          line = '';
        }
        line += it.str + ' ';
        lastY = y;
      }
      lines.push(line);
      pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'));
    }
    return pages.join('\n\n');
  }
  return file.text();
}
