import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entities/User';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { hashPassword } from '../services/auth';
import { parsePagination, buildPaginationResponse, paginate } from '../utils/pagination';

const userRepo = () => AppDataSource.getRepository(User);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
});

const app = new Hono();
app.onError(errorHandler);

function sanitizeUser(user: User) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

app.get('/', async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const [users, total] = await userRepo().findAndCount({
    select: ['id', 'email', 'name', 'role', 'createdAt', 'lastLogin'],
    order: { createdAt: 'DESC' },
    ...paginate(page, limit),
  });
  return c.json({
    data: users.map(sanitizeUser),
    pagination: buildPaginationResponse(page, limit, total),
  });
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const { email, password, name, role } = c.req.valid('json');

  const existing = await userRepo().findOne({ where: { email } });
  if (existing) {
    throw new AppError(409, ErrorCode.CONFLICT, 'Email already in use');
  }

  const passwordHash = await hashPassword(password);
  const user = userRepo().create({ email, passwordHash, name, role });
  await userRepo().save(user);
  return c.json(sanitizeUser(user), 201);
});

app.get('/:id', async (c) => {
  const user = await userRepo().findOne({
    where: { id: c.req.param('id') },
    select: ['id', 'email', 'name', 'role', 'createdAt', 'updatedAt', 'lastLogin'],
  });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, 'User not found');
  return c.json(sanitizeUser(user));
});

app.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const user = await userRepo().findOne({ where: { id } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, 'User not found');

  if (data.role && user.id === auth.userId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot change your own role');
  }

  if (data.email && data.email !== user.email) {
    const existing = await userRepo().findOne({ where: { email: data.email } });
    if (existing) {
      throw new AppError(409, ErrorCode.CONFLICT, 'Email already in use');
    }
  }

  userRepo().merge(user, data);
  await userRepo().save(user);
  return c.json(sanitizeUser(user));
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');

  if (id === auth.userId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot delete yourself');
  }

  const user = await userRepo().findOne({ where: { id } });
  if (!user) throw new AppError(404, ErrorCode.NOT_FOUND, 'User not found');

  await userRepo().delete(id);
  return c.json({ success: true });
});

export default app;
