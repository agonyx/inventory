import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Like, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Order, OrderStatus } from '../entities/Order';
import { InventoryLevel } from '../entities/InventoryLevel';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { sendShippingConfirmation } from '../services/email';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';
import { parseSort } from '../utils/sort';
import { exportToCsv, getCsvFilename } from '../utils/csv-export';
import {
  createPdf,
  pdfToBuffer,
  pdfResponseHeaders,
  drawHeader,
  drawTable,
  drawFooters,
  drawInfoBlock,
  type PdfTableColumn,
  type PdfTableRow,
} from '../utils/pdf';

const CARRIER_TRACKING_URLS: Record<string, (tracking: string) => string> = {
  dhl: (t) => `https://www.dhl.com/track?id=${encodeURIComponent(t)}`,
  ups: (t) => `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`,
  fedex: (t) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`,
  usps: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`,
  royal_mail: (t) => `https://www.royalmail.com/track-your-item/?trackNumber=${encodeURIComponent(t)}`,
};

const orderRepo = () => AppDataSource.getRepository(Order);
const auditRepo = () => AppDataSource.getRepository(AuditLog);
const inventoryRepo = () => AppDataSource.getRepository(InventoryLevel);

const statusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

const shippingSchema = z.object({
  trackingNumber: z.string().min(1),
  shippingCarrier: z.string().min(1),
});

const ORDER_SORT_COLUMNS = ['createdAt', 'totalAmount', 'customerName'];

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [],
  [OrderStatus.CANCELLED]: [],
};

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort(query, ORDER_SORT_COLUMNS);

  // Build base conditions (AND)
  const conditions: Record<string, any> = {};

  if (query.status) conditions.status = query.status as OrderStatus;
  if (query.source) conditions.source = query.source;

  // Date range on createdAt
  if (query.from && query.to) {
    conditions.createdAt = Between(new Date(query.from), new Date(query.to));
  } else if (query.from) {
    conditions.createdAt = MoreThanOrEqual(new Date(query.from));
  } else if (query.to) {
    conditions.createdAt = LessThanOrEqual(new Date(query.to));
  }

  // Search with ILIKE (OR across fields)
  let where: any;
  if (query.search) {
    const pattern = Like(`%${query.search}%`);
    where = [
      { ...conditions, externalOrderId: pattern },
      { ...conditions, customerName: pattern },
      { ...conditions, customerEmail: pattern },
    ];
  } else {
    where = Object.keys(conditions).length > 0 ? conditions : {};
  }

  const [orders, total] = await orderRepo().findAndCount({
    where,
    relations: ['items', 'items.variant', 'items.variant.product'],
    order: { [sortBy]: sortDir },
    ...paginate(page, limit),
  });

  return c.json({
    data: orders,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

// GET /api/orders/export — CSV export
app.get('/export', async (c) => {
  const query = c.req.query();
  const { sortBy, sortDir } = parseSort(query, ORDER_SORT_COLUMNS);

  const conditions: Record<string, any> = {};
  if (query.status) conditions.status = query.status as OrderStatus;
  if (query.source) conditions.source = query.source;

  if (query.from && query.to) {
    conditions.createdAt = Between(new Date(query.from), new Date(query.to));
  } else if (query.from) {
    conditions.createdAt = MoreThanOrEqual(new Date(query.from));
  } else if (query.to) {
    conditions.createdAt = LessThanOrEqual(new Date(query.to));
  }

  let where: any;
  if (query.search) {
    const pattern = Like(`%${query.search}%`);
    where = [
      { ...conditions, externalOrderId: pattern },
      { ...conditions, customerName: pattern },
      { ...conditions, customerEmail: pattern },
    ];
  } else {
    where = Object.keys(conditions).length > 0 ? conditions : {};
  }

  const [orders] = await orderRepo().findAndCount({
    where,
    order: { [sortBy]: sortDir },
  });

  const headers = ['externalOrderId', 'status', 'customerName', 'customerEmail', 'totalAmount', 'source', 'createdAt'];
  const rows = orders.map((o) => ({
    externalOrderId: o.externalOrderId,
    status: o.status,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    totalAmount: o.totalAmount,
    source: o.source || '',
    createdAt: o.createdAt?.toISOString(),
  }));

  const csv = exportToCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${getCsvFilename('orders')}"`,
    },
  });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const order = await orderRepo().findOne({
    where: { id },
    relations: ['items', 'items.variant', 'items.variant.product'],
  });
  if (!order) throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
  return c.json(order);
});

app.patch('/:id/status', zValidator('json', statusSchema), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const order = await manager.findOne(Order, {
      where: { id },
      relations: ['items', 'items.variant'],
    });
    if (!order) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
    }

    const oldStatus = order.status;

    if (!VALID_ORDER_TRANSITIONS[oldStatus].includes(status)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR,
        `Invalid transition: ${oldStatus} → ${status}`);
    }

    order.status = status;
    await manager.save(order);

    for (const item of order.items) {
      if (!item.variant) continue;

      const level = await manager.findOne(InventoryLevel, {
        where: { variantId: item.variant.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!level) continue;

      if (oldStatus === OrderStatus.PENDING && status === OrderStatus.CANCELLED) {
        level.reservedQuantity -= item.quantity;
      } else if (oldStatus === OrderStatus.CONFIRMED && status === OrderStatus.PACKED) {
        level.reservedQuantity -= item.quantity;
      } else if (oldStatus === OrderStatus.CONFIRMED && status === OrderStatus.CANCELLED) {
        level.reservedQuantity -= item.quantity;
      } else if (oldStatus === OrderStatus.PACKED && status === OrderStatus.SHIPPED) {
        level.quantity -= item.quantity;
      }

      await manager.save(level);
    }

    const audit = manager.create(AuditLog, {
      action: AuditAction.UPDATE_ORDER_STATUS,
      entityType: 'order',
      entityId: id,
      oldValues: { status: oldStatus },
      newValues: { status },
      notes: `Order status changed from ${oldStatus} to ${status}`,
    });
    await manager.save(audit);

    return await manager.findOne(Order, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product'],
    });
  });

  if (status === OrderStatus.SHIPPED && result) {
    sendShippingConfirmation(result).catch((err) => {
      console.error('[orders] Failed to send shipping confirmation email:', err);
    });
  }

  return c.json(result);
});

// GET /api/orders/:id/packing-slip — Packing slip PDF
app.get('/:id/packing-slip', async (c) => {
  const id = c.req.param('id');
  const download = c.req.query('download') === 'true';

  const order = await orderRepo().findOne({
    where: { id },
    relations: ['items', 'items.variant', 'items.variant.product'],
  });
  if (!order) throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');

  const doc = createPdf();
  const title = 'Packing Slip';
  const subtitle = `Order ${order.externalOrderId}`;
  drawHeader(doc, title, subtitle);

  // Info block
  const leftX = doc.page.margins.left;
  let y = doc.y;

  y = drawInfoBlock(
    doc,
    [
      { label: 'Order #:', value: order.externalOrderId },
      { label: 'Date:', value: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—' },
      { label: 'Status:', value: order.status },
      { label: 'Source:', value: order.source || '—' },
    ],
    leftX,
    y,
    70,
  );

  // Customer info on the right
  const rightX = leftX + 250;
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#374151')
    .text('Ship To:', rightX, doc.y - (4 * 16), { continued: false });
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#111827');
  const shipY = doc.y;
  doc.text(order.customerName, rightX, shipY);
  doc.text(order.customerEmail, rightX, doc.y);
  if (order.shippingAddress) {
    doc.text(order.shippingAddress, rightX, doc.y, { width: 240 });
  }
  doc.fillColor('#000000');
  doc.x = leftX;

  // Move past the info blocks
  y = Math.max(doc.y, y) + 16;

  // Items table
  const columns: PdfTableColumn[] = [
    { header: 'Product', width: 180 },
    { header: 'Variant', width: 100 },
    { header: 'SKU', width: 100 },
    { header: 'Barcode', width: 90 },
    { header: 'Qty', width: 40, align: 'center' },
    { header: 'Unit Price', width: 70, align: 'right' },
  ];

  const tableRows: PdfTableRow[] = order.items.map((item) => ({
    cells: [
      item.variant?.product?.name || 'Unknown',
      item.variant?.name || item.externalSku || 'N/A',
      item.variant?.sku || item.externalSku || 'N/A',
      item.variant?.barcode || '',
      String(item.quantity),
      `$${Number(item.unitPrice).toFixed(2)}`,
    ],
  }));

  y = drawTable(doc, columns, tableRows, leftX, y);

  // Total
  doc.moveDown(0.5);
  y = doc.y;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  doc
    .moveTo(leftX + totalWidth - 110, y)
    .lineTo(leftX + totalWidth, y)
    .strokeColor('#d1d5db')
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`Total: $${Number(order.totalAmount).toFixed(2)}`, leftX + totalWidth - 110, doc.y, {
      align: 'right',
      width: 110,
    });

  drawFooters(doc);

  const buf = await pdfToBuffer(doc);
  const filename = `packing-slip-${order.externalOrderId}.pdf`;
  return new Response(new Uint8Array(buf), { headers: pdfResponseHeaders(filename, download) });
});

app.patch('/:id/shipping', zValidator('json', shippingSchema), async (c) => {
  const id = c.req.param('id');
  const { trackingNumber, shippingCarrier } = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const order = await manager.findOne(Order, {
      where: { id },
      relations: ['items', 'items.variant', 'items.variant.product'],
    });
    if (!order) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');
    }

    order.trackingNumber = trackingNumber;
    order.shippingCarrier = shippingCarrier;
    await manager.save(order);

    const audit = manager.create(AuditLog, {
      action: AuditAction.UPDATE,
      entityType: 'order',
      entityId: id,
      oldValues: { trackingNumber: null, shippingCarrier: null },
      newValues: { trackingNumber, shippingCarrier },
      notes: `Shipping info updated: ${shippingCarrier} - ${trackingNumber}`,
    });
    await manager.save(audit);

    return order;
  });

  return c.json(result);
});

app.get('/:id/tracking-url', async (c) => {
  const id = c.req.param('id');
  const order = await orderRepo().findOne({ where: { id } });
  if (!order) throw new AppError(404, ErrorCode.NOT_FOUND, 'Order not found');

  if (!order.trackingNumber || !order.shippingCarrier) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'No tracking information available');
  }

  const urlBuilder = CARRIER_TRACKING_URLS[order.shippingCarrier];
  if (!urlBuilder) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Unknown carrier: ${order.shippingCarrier}`);
  }

  return c.json({
    trackingUrl: urlBuilder(order.trackingNumber),
    trackingNumber: order.trackingNumber,
    shippingCarrier: order.shippingCarrier,
  });
});

export default app;
