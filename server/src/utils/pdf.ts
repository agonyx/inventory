import PDFDocument from 'pdfkit';
import { Buffer } from 'node:buffer';

/** The PDFDocument instance type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PDFDoc = any;

export interface PdfTableColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

export interface PdfTableRow {
  cells: string[];
}

/**
 * Create a new PDFDocument with standard configuration.
 */
export function createPdf(): PDFDoc {
  return new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
  });
}

/**
 * Render a PDF to a Buffer.
 */
export function pdfToBuffer(doc: PDFDoc): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Build response headers for a PDF response.
 */
export function pdfResponseHeaders(
  filename: string,
  download: boolean,
): Record<string, string> {
  const disposition = download ? 'attachment' : 'inline';
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${disposition}; filename="${filename}"`,
  };
}

/**
 * Draw a header block at the top of the page.
 */
export function drawHeader(
  doc: PDFDoc,
  title: string,
  subtitle?: string,
): void {
  // Company name / title
  doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'left' });

  if (subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#555555').text(subtitle, {
      align: 'left',
    });
    doc.fillColor('#000000');
  }

  // Horizontal rule
  doc.moveDown(0.5);
  doc
    .moveTo(doc.x, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#cccccc')
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.8);
}

/**
 * Draw a table with header row and data rows.
 * Returns the y position after the last row.
 */
export function drawTable(
  doc: PDFDoc,
  columns: PdfTableColumn[],
  rows: PdfTableRow[],
  startX: number,
  startY: number,
  rowHeight: number = 22,
): number {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  let y = startY;

  // Check if we need a new page for the header + at least one row
  const neededHeight = rowHeight * 2 + 10;
  if (y + neededHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  // Header row
  doc
    .rect(startX, y, tableWidth, rowHeight)
    .fillAndStroke('#f3f4f6', '#d1d5db');
  let x = startX;
  for (const col of columns) {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#374151')
      .text(col.header, x + 4, y + 6, {
        width: col.width - 8,
        align: col.align || 'left',
        lineBreak: false,
      });
    x += col.width;
  }
  doc.fillColor('#000000');
  y += rowHeight;

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    // Check page break
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;

      // Re-draw header on new page
      doc
        .rect(startX, y, tableWidth, rowHeight)
        .fillAndStroke('#f3f4f6', '#d1d5db');
      let hx = startX;
      for (const col of columns) {
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#374151')
          .text(col.header, hx + 4, y + 6, {
            width: col.width - 8,
            align: col.align || 'left',
            lineBreak: false,
          });
        hx += col.width;
      }
      doc.fillColor('#000000');
      y += rowHeight;
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.rect(startX, y, tableWidth, rowHeight).fill('#fafafa');
    }

    // Bottom border
    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + tableWidth, y + rowHeight)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke();

    // Cell text
    x = startX;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const cellText = rows[i].cells[c] || '';
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#111827')
        .text(cellText, x + 4, y + 6, {
          width: col.width - 8,
          align: col.align || 'left',
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    }
    doc.fillColor('#000000');
    y += rowHeight;
  }

  return y;
}

/**
 * Draw a footer on every page with page numbers.
 */
export function drawFooters(doc: PDFDoc): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - doc.page.margins.bottom;
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9ca3af')
      .text(
        `Page ${i + 1} of ${range.count}`,
        doc.page.margins.left,
        bottom,
        { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
      );
    doc.fillColor('#000000');
  }
}

/**
 * Draw a simple info block (key-value pairs).
 */
export function drawInfoBlock(
  doc: PDFDoc,
  fields: { label: string; value: string }[],
  startX: number,
  startY: number,
  labelWidth: number = 100,
): number {
  let y = startY;
  for (const field of fields) {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#6b7280')
      .text(field.label, startX, y, { width: labelWidth, continued: false });
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#111827')
      .text(field.value || '—', startX + labelWidth, y, {
        width: 300,
      });
    y += 16;
  }
  doc.fillColor('#000000');
  return y;
}
