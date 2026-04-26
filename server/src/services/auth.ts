import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { AppError, ErrorCode } from '../errors/app-error';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'JWT_SECRET is not configured');
  return secret;
}

const JWT_ACCESS_EXPIRY = '15m';
const JWT_REFRESH_EXPIRY = '7d';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export function generateTokens(user: User): TokenPair {
  const secret = getJwtSecret();
  const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, secret, { expiresIn: JWT_ACCESS_EXPIRY });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, secret, { expiresIn: JWT_REFRESH_EXPIRY });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload & { type?: string };
    if (decoded.type === 'refresh') {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid token type');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; type: string };
    if (decoded.type !== 'refresh') {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid token type');
    }
    return { userId: decoded.userId };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid or expired refresh token');
  }
}

export async function authenticateUser(email: string, password: string): Promise<{ user: User; tokens: TokenPair }> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { email } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid email or password');
  }

  user.lastLogin = new Date();
  await userRepo.save(user);

  return { user, tokens: generateTokens(user) };
}
