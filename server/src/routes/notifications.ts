import { Hono } from 'hono';
import { AppDataSource } from '../data-source';
import { Notification } from '../entities/Notification';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';

const app = new Hono();

const notifRepo = () => AppDataSource.getRepository(Notification);

// GET /api/notifications — paginated, filter by read/unread
app.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit } = parsePagination(query);

  const where: Record<string, any> = {};
  if (query.read !== undefined) {
    where.read = query.read === 'true';
  }

  const [notifications, total] = await notifRepo().findAndCount({
    where: Object.keys(where).length > 0 ? where : undefined,
    order: { createdAt: 'desc' },
    ...paginate(page, limit),
  });

  // Count unread
  const unreadCount = await notifRepo().count({ where: { read: false } });

  return c.json({
    data: notifications,
    pagination: buildPaginationResponse(page, limit, total),
    unreadCount,
  });
});

// GET /api/notifications/unread-count — lightweight endpoint for bell badge
app.get('/unread-count', async (c) => {
  const count = await notifRepo().count({ where: { read: false } });
  return c.json({ count });
});

// PATCH /api/notifications/:id/read
app.patch('/:id/read', async (c) => {
  const id = c.req.param('id');
  const notif = await notifRepo().findOne({ where: { id } });
  if (!notif) {
    return c.json({ error: 'Notification not found' }, 404);
  }
  notif.read = true;
  await notifRepo().save(notif);
  return c.json(notif);
});

// PATCH /api/notifications/read-all
app.patch('/read-all', async (c) => {
  await notifRepo().update({ read: false }, { read: true });
  return c.json({ success: true });
});

export default app;
