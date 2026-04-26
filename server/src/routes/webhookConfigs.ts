import { Hono } from 'hono';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { WebhookConfig, WebhookEventType } from '../entities/WebhookConfig';
import { AppError, ErrorCode } from '../errors/app-error';

const app = new Hono();

const repo = () => AppDataSource.getRepository(WebhookConfig);

const ALL_EVENTS = Object.values(WebhookEventType);

function sanitizeConfig(config: WebhookConfig) {
  const { secret: _, ...safe } = config;
  return { ...safe, secret: config.secret ? '••••••••' : null };
}

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^\[::1\]$/,
];

function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (PRIVATE_IP_RANGES.some((r) => r.test(hostname))) return true;
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      const ip = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
      if (ip >>> 24 === 10) return true;
      if (ip >>> 20 === 0xac1 || ip >>> 20 === 0xac2) return true;
      if (ip >>> 16 === 0xc0a8) return true;
    }
    return false;
  } catch {
    return true;
  }
}

const createSchema = z.object({
  url: z.string().url().max(500).refine((url) => {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  }, 'Only HTTP/HTTPS URLs allowed').refine((url) => !isPrivateUrl(url), 'Internal/private URLs are not allowed'),
  events: z.array(z.enum(ALL_EVENTS as [string, ...string[]])).min(1),
  secret: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
});

const updateSchema = createSchema.partial().omit({});

app.get('/', async (c) => {
  const configs = await repo().find({ order: { createdAt: 'desc' } });
  return c.json(configs.map(sanitizeConfig));
});

app.post('/', async (c) => {
  const body = createSchema.parse(await c.req.json());
  const config = repo().create({
    url: body.url,
    events: body.events,
    secret: body.secret || null,
    isActive: body.isActive,
  });
  await repo().save(config);
  return c.json(sanitizeConfig(config), 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const config = await repo().findOne({ where: { id } });
  if (!config) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'Webhook config not found');
  }

  const body = updateSchema.parse(await c.req.json());
  if (body.url !== undefined) config.url = body.url;
  if (body.events !== undefined) config.events = body.events;
  if (body.secret !== undefined) config.secret = body.secret;
  if (body.isActive !== undefined) config.isActive = body.isActive;

  await repo().save(config);
  return c.json(sanitizeConfig(config));
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const config = await repo().findOne({ where: { id } });
  if (!config) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'Webhook config not found');
  }
  await repo().remove(config);
  return c.json({ success: true });
});

export default app;
