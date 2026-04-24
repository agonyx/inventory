import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import {
  authenticateUser,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
} from '../services/auth';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const app = new Hono();

app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const { user, tokens } = await authenticateUser(email, password);
  return c.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens,
  });
});

app.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const { userId } = verifyRefreshToken(refreshToken);
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
  }
  const tokens = generateTokens(user);
  return c.json({ tokens });
});

app.post('/logout', async (c) => {
  // Stateless JWT — client discards tokens. In future, add token blacklist.
  return c.json({ success: true });
});

app.get('/me', async (c) => {
  const auth = c.req.header('Authorization');
  const token = auth?.replace('Bearer ', '');
  if (!token) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing authorization header');
  }
  const payload = verifyAccessToken(token);
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
  }
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});

app.onError(errorHandler);

export default app;
