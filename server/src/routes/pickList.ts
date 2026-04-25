import { Hono } from 'hono';
import { generatePickList, type PickListItem } from '../services/pickList';
import { AppDataSource } from '../data-source';
import { ProductVariant } from '../entities/ProductVariant';
import {
  createPdf,
  pdfToBuffer,
  pdfResponseHeaders,
  drawHeader,
  drawTable,
  drawFooters,
  type PdfTableColumn,
  type PdfTableRow,
} from '../utils/pdf';

const app = new Hono();

app.get('/', async (c) => {
  const pickList = await generatePickList();
  return c.json(pickList);
});

// GET /api/pick-list/pdf — Pick list PDF
app.get('/pdf', async (c) => {
  const download = c.req.query('download') === 'true';
  const locationFilter = c.req.query('location');

  let items = await generatePickList();

  if (locationFilter) {
    items = items.filter(i => i.locationName === locationFilter);
  }

  const doc = createPdf();
  const now = new Date();
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const subtitle = locationFilter
    ? `Generated: ${dateStr} · ${items.length} items · Location: ${locationFilter}`
    : `Generated: ${dateStr} · ${items.length} items`;
  drawHeader(doc, 'Pick List', subtitle);

  const leftX = doc.page.margins.left;

  if (items.length === 0) {
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#6b7280')
      .text('No pending orders to pick.', leftX, doc.y);
    doc.fillColor('#000000');
    drawFooters(doc);
    const buf = await pdfToBuffer(doc);
    return new Response(new Uint8Array(buf), { headers: pdfResponseHeaders('pick-list.pdf', download) });
  }

  // Fetch barcodes for all unique SKUs
  const skus = [...new Set(items.map(i => i.sku))];
  const variants = skus.length > 0
    ? await AppDataSource.getRepository(ProductVariant).find({
        where: skus.map(sku => ({ sku })),
      })
    : [];
  const barcodeBySku = new Map(variants.map(v => [v.sku, v.barcode || '']));

  // Group items by location
  const grouped: Record<string, PickListItem[]> = {};
  for (const item of items) {
    if (!grouped[item.locationName]) grouped[item.locationName] = [];
    grouped[item.locationName]!.push(item);
  }

  const columns: PdfTableColumn[] = [
    { header: 'Product', width: 170 },
    { header: 'Variant', width: 90 },
    { header: 'SKU', width: 100 },
    { header: 'Barcode', width: 90 },
    { header: 'Qty', width: 40, align: 'center' },
  ];

  let firstGroup = true;
  for (const [location, locItems] of Object.entries(grouped)) {
    if (!firstGroup) {
      doc.addPage();
    }
    firstGroup = false;

    // Location section header
    const y = doc.y;
    doc
      .fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text(`Location: ${location}`, leftX, y);
    doc.fillColor('#000000');
    doc.moveDown(0.5);

    // Aggregate quantities per SKU within this location
    const aggregated = new Map<string, { product: string; variant: string; sku: string; barcode: string; qty: number }>();
    for (const item of locItems) {
      const key = item.sku;
      const existing = aggregated.get(key);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        aggregated.set(key, {
          product: item.productName,
          variant: item.variantName,
          sku: item.sku,
          barcode: barcodeBySku.get(item.sku) || '',
          qty: item.quantity,
        });
      }
    }

    const rows: PdfTableRow[] = [...aggregated.values()].map((entry) => ({
      cells: [
        entry.product,
        entry.variant,
        entry.sku,
        entry.barcode,
        String(entry.qty),
      ],
    }));

    drawTable(doc, columns, rows, leftX, doc.y);
  }

  drawFooters(doc);

  const buf = await pdfToBuffer(doc);
  const filename = `pick-list-${now.toISOString().split('T')[0]}.pdf`;
  return new Response(new Uint8Array(buf), { headers: pdfResponseHeaders(filename, download) });
});

export default app;
