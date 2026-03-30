import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
} from 'docx';
import { saveAs } from 'file-saver';
import type { QAPair } from '../types';

export async function exportToWord(
  qaPairs: QAPair[],
  pdfName: string,
): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `Deployment Q&A – ${pdfName}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          ...qaPairs.flatMap((qa, idx) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Q${idx + 1}: ${qa.question}`,
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Answer: ${qa.answer || '(No answer provided)'}`,
                  size: 22,
                }),
              ],
              indent: { left: 360 },
            }),
            new Paragraph({ text: '' }),
          ]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${pdfName.replace(/\.pdf$/i, '')}-qa.docx`;
  saveAs(blob, fileName);
}

export function buildEmailBody(qaPairs: QAPair[], pdfName: string): string {
  const header = `Deployment Q&A – ${pdfName}\n${'='.repeat(50)}\n\n`;
  const body = qaPairs
    .map(
      (qa, idx) =>
        `Q${idx + 1}: ${qa.question}\nAnswer: ${qa.answer || '(No answer provided)'}`,
    )
    .join('\n\n');
  return header + body;
}

export function openEmailClient(
  toEmail: string,
  qaPairs: QAPair[],
  pdfName: string,
): void {
  const subject = encodeURIComponent(`Deployment Q&A – ${pdfName}`);
  const body = encodeURIComponent(buildEmailBody(qaPairs, pdfName));
  // Most email clients and servers cap mailto: URIs around 2000 chars;
  // we stay under that limit to ensure maximum compatibility.
  const maxLength = 1900;
  const truncatedBody =
    body.length > maxLength ? body.substring(0, maxLength) + '...' : body;
  window.location.href = `mailto:${encodeURIComponent(toEmail)}?subject=${subject}&body=${truncatedBody}`;
}
