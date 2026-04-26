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
  verifyPassword,
  hashPassword,
} from '../services/auth';
import { AppError, ErrorCode } from '../errors/app-error';
import { errorHandler } from '../middleware/error-handler';
import { jwtAuth } from '../middleware/jwt-auth';
import { loginRateLimit } from '../middleware/rate-limit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const app = new Hono();

app.post('/login', loginRateLimit, zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const { user, tokens } = await authenticateUser(email, password);
  return c.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens,
  });
});

app.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');
  const { userId, tokenVersion } = verifyRefreshToken(refreshToken);
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
  }
  if (user.tokenVersion !== tokenVersion) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Refresh token has been revoked');
  }
  const tokens = generateTokens(user);
  return c.json({ tokens });
});

app.post('/logout', jwtAuth, async (c) => {
  const auth = c.get('auth');
  const userRepo = AppDataSource.getRepository(User);
  await userRepo.increment({ id: auth.userId }, 'tokenVersion', 1);
  return c.json({ success: true });
});

app.get('/me', async (c) => {
  const auth = c.req.header('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

const updateProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

app.patch('/profile', jwtAuth, zValidator('json', updateProfileSchema), async (c) => {
  const auth = c.get('auth');
  const { name, email } = c.req.valid('json');

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: auth.userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
  }

  if (email !== user.email) {
    const existing = await userRepo.findOne({ where: { email } });
    if (existing) {
      throw new AppError(409, ErrorCode.CONFLICT, 'Email already in use');
    }
  }

  user.name = name;
  user.email = email;
  await userRepo.save(user);

  return c.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

app.post('/change-password', jwtAuth, zValidator('json', changePasswordSchema), async (c) => {
  const auth = c.get('auth');
  const { currentPassword, newPassword } = c.req.valid('json');

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: auth.userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'User not found');
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  await userRepo.save(user);

  return c.json({ success: true, message: 'Password changed successfully' });
});

app.onError(errorHandler);

export default app;
