import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { AuditLog, AuditAction } from '../entities/AuditLog';
import { AppError, ErrorCode } from '../errors/app-error';

const auditRepo = () => AppDataSource.getRepository(AuditLog);

const listQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 25;
    return Math.min(Math.max(n, 1), 100);
  }),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  performedBy: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const app = new Hono();

app.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { page, limit, entityType, entityId, action, performedBy, from, to } = c.req.valid('query');

  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (action) where.action = action;
  if (performedBy) where.performedBy = performedBy;
  if (from || to) {
    where.createdAt = {} as any;
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await auditRepo().findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return c.json({
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const log = await auditRepo().findOne({ where: { id } });
  if (!log) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'Audit log not found');
  }
  return c.json(log);
});

export default app;
