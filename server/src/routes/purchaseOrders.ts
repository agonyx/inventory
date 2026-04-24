import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { PurchaseOrder, PurchaseOrderStatus } from '../entities/PurchaseOrder';
import { PurchaseOrderItem } from '../entities/PurchaseOrderItem';
import { InventoryLevel } from '../entities/InventoryLevel';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { parsePagination, buildPaginationResponse } from '../utils/pagination';
import { parseSort } from '../utils/sort';

const poRepo = () => AppDataSource.getRepository(PurchaseOrder);
const itemRepo = () => AppDataSource.getRepository(PurchaseOrderItem);
const invRepo = () => AppDataSource.getRepository(InventoryLevel);
const auditRepo = () => AppDataSource.getRepository(AuditLog);

const poItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().min(0),
});

const createPOSchema = z.object({
  supplierId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(poItemSchema).min(1),
});

const updatePOSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(['draft', 'sent', 'partially_received', 'received', 'cancelled']).optional(),
});

const receiveItemSchema = z.object({
  itemId: z.string().uuid(),
  quantityReceived: z.number().int().positive(),
});

const receiveSchema = z.object({
  items: z.array(receiveItemSchema).min(1),
});

const PO_SORT_COLUMNS = ['createdAt', 'status'];

const app = new Hono();
app.onError(errorHandler);

app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);
  const { sortBy, sortDir } = parseSort({ ...query, sortBy: query.sortBy || 'createdAt' }, PO_SORT_COLUMNS);
  const statusFilter = query.status;
  const supplierFilter = query.supplierId;

  const qb = poRepo()
    .createQueryBuilder('po')
    .leftJoinAndSelect('po.supplier', 'supplier')
    .leftJoin('po.items', 'item')
    .select([
      'po.id', 'po.supplierId', 'po.status', 'po.notes', 'po.createdAt', 'po.updatedAt',
      'supplier.id', 'supplier.name',
    ])
    .addSelect('COUNT(item.id)', 'itemCount')
    .addSelect('COALESCE(SUM(item.quantity * item.unitCost), 0)', 'totalCost')
    .groupBy('po.id')
    .addGroupBy('supplier.id')
    .orderBy(`po.${sortBy}`, sortDir)
    .offset((page - 1) * limit)
    .limit(limit);

  if (statusFilter) {
    qb.andWhere('po.status = :status', { status: statusFilter });
  }
  if (supplierFilter) {
    qb.andWhere('po.supplierId = :supplierId', { supplierId: supplierFilter });
  }

  const countQb = poRepo().createQueryBuilder('po');
  if (statusFilter) countQb.andWhere('po.status = :status', { status: statusFilter });
  if (supplierFilter) countQb.andWhere('po.supplierId = :supplierId', { supplierId: supplierFilter });

  const [result, total] = await Promise.all([
    qb.getRawAndEntities(),
    countQb.getCount(),
  ]);

  const countMap = new Map<string, number>();
  const costMap = new Map<string, number>();
  (result.raw as any[]).forEach((r) => {
    const count = parseInt(r.itemcount, 10) || parseInt(r.itemCount, 10) || 0;
    const cost = parseFloat(r.totalcost) || parseFloat(r.totalCost) || 0;
    countMap.set(r.po_id, count);
    costMap.set(r.po_id, cost);
  });

  const data = result.entities.map((po) => ({
    ...po,
    itemCount: countMap.get(po.id) || 0,
    totalCost: costMap.get(po.id) || 0,
  }));

  return c.json({
    data,
    pagination: buildPaginationResponse(page, limit, total),
  });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const po = await poRepo().findOne({
    where: { id },
    relations: ['supplier', 'items', 'items.variant'],
  });
  if (!po) throw new AppError(404, ErrorCode.NOT_FOUND, 'Purchase order not found');
  return c.json(po);
});

app.post('/', zValidator('json', createPOSchema), async (c) => {
  const data = c.req.valid('json');

  const po = await AppDataSource.transaction(async (manager) => {
    const order = manager.create(PurchaseOrder, {
      supplierId: data.supplierId,
      status: PurchaseOrderStatus.DRAFT,
      notes: data.notes || null,
    });
    const saved = await manager.save(PurchaseOrder, order);

    const items = data.items.map((item) =>
      manager.create(PurchaseOrderItem, {
        purchaseOrderId: saved.id,
        variantId: item.variantId,
        quantity: item.quantity,
        receivedQuantity: 0,
        unitCost: item.unitCost,
      }),
    );
    await manager.save(PurchaseOrderItem, items);

    await manager.save(AuditLog, manager.create(AuditLog, {
      action: 'create_purchase_order' as AuditAction,
      entityType: 'purchase_order',
      entityId: saved.id,
      newValues: { supplierId: data.supplierId, itemCount: data.items.length },
    }));

    return saved;
  });

  const full = await poRepo().findOne({
    where: { id: po.id },
    relations: ['supplier', 'items', 'items.variant'],
  });
  return c.json(full, 201);
});

app.patch('/:id', zValidator('json', updatePOSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const po = await poRepo().findOne({ where: { id } });
  if (!po) throw new AppError(404, ErrorCode.NOT_FOUND, 'Purchase order not found');

  if (data.notes !== undefined) po.notes = data.notes;
  if (data.status !== undefined) po.status = data.status as PurchaseOrderStatus;
  await poRepo().save(po);

  await auditRepo().save(auditRepo().create({
    action: 'update_purchase_order' as AuditAction,
    entityType: 'purchase_order',
    entityId: id,
    newValues: data,
  }));

  return c.json(po);
});

app.post('/:id/send', async (c) => {
  const id = c.req.param('id');
  const po = await poRepo().findOne({ where: { id } });
  if (!po) throw new AppError(404, ErrorCode.NOT_FOUND, 'Purchase order not found');
  if (po.status !== PurchaseOrderStatus.DRAFT) {
    throw new AppError(409, ErrorCode.CONFLICT, 'Only draft purchase orders can be sent');
  }

  po.status = PurchaseOrderStatus.SENT;
  await poRepo().save(po);

  await auditRepo().save(auditRepo().create({
    action: 'update_purchase_order' as AuditAction,
    entityType: 'purchase_order',
    entityId: id,
    newValues: { status: 'sent' },
  }));

  return c.json(po);
});

app.post('/:id/receive', zValidator('json', receiveSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const result = await AppDataSource.transaction(async (manager) => {
    const po = await manager.findOne(PurchaseOrder, {
      where: { id },
      relations: ['items', 'items.variant'],
    });
    if (!po) throw new AppError(404, ErrorCode.NOT_FOUND, 'Purchase order not found');
    if (po.status !== PurchaseOrderStatus.SENT && po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new AppError(409, ErrorCode.CONFLICT, 'Only sent or partially received purchase orders can be received');
    }

    const auth = c.get('auth');

    for (const recv of data.items) {
      const item = po.items.find((i) => i.id === recv.itemId);
      if (!item) throw new AppError(404, ErrorCode.NOT_FOUND, `Item ${recv.itemId} not found in this purchase order`);

      const newReceived = item.receivedQuantity + recv.quantityReceived;
      if (newReceived > item.quantity) {
        throw new AppError(409, ErrorCode.CONFLICT, `Cannot receive more than ordered quantity for item ${item.id}`);
      }

      item.receivedQuantity = newReceived;
      await manager.save(PurchaseOrderItem, item);

      const locations = await manager.find('Location' as any);
      const locationId = locations.length > 0 ? locations[0].id : null;

      if (locationId) {
        let invLevel = await manager.findOne(InventoryLevel, {
          where: { variantId: item.variantId, locationId },
        });
        if (invLevel) {
          invLevel.quantity += recv.quantityReceived;
          await manager.save(InventoryLevel, invLevel);
        } else {
          invLevel = manager.create(InventoryLevel, {
            variantId: item.variantId,
            locationId,
            quantity: recv.quantityReceived,
            reservedQuantity: 0,
          });
          await manager.save(InventoryLevel, invLevel);
        }
      }
    }

    const allReceived = po.items.every((i) => i.receivedQuantity >= i.quantity);
    const anyReceived = po.items.some((i) => i.receivedQuantity > 0);

    if (allReceived) {
      po.status = PurchaseOrderStatus.RECEIVED;
    } else if (anyReceived) {
      po.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    await manager.save(PurchaseOrder, po);

    await manager.save(AuditLog, manager.create(AuditLog, {
      action: 'receive_purchase_order' as AuditAction,
      entityType: 'purchase_order',
      entityId: id,
      newValues: { status: po.status, receivedItems: data.items },
      performedBy: auth?.userId || null,
    }));

    return po;
  });

  const full = await poRepo().findOne({
    where: { id: result.id },
    relations: ['supplier', 'items', 'items.variant'],
  });
  return c.json(full);
});

app.post('/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const po = await poRepo().findOne({ where: { id } });
  if (!po) throw new AppError(404, ErrorCode.NOT_FOUND, 'Purchase order not found');
  if (po.status === PurchaseOrderStatus.RECEIVED || po.status === PurchaseOrderStatus.CANCELLED) {
    throw new AppError(409, ErrorCode.CONFLICT, `Cannot cancel purchase order in ${po.status} status`);
  }

  po.status = PurchaseOrderStatus.CANCELLED;
  await poRepo().save(po);

  await auditRepo().save(auditRepo().create({
    action: 'cancel_purchase_order' as AuditAction,
    entityType: 'purchase_order',
    entityId: id,
    newValues: { status: 'cancelled' },
  }));

  return c.json(po);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const po = await poRepo().findOne({ where: { id } });
  if (!po) throw new AppError(404, ErrorCode.NOT_FOUND, 'Purchase order not found');
  if (po.status !== PurchaseOrderStatus.DRAFT) {
    throw new AppError(409, ErrorCode.CONFLICT, 'Only draft purchase orders can be deleted');
  }

  await poRepo().remove(po);
  return c.json({ success: true });
});

export default app;
