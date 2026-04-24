import { Hono } from 'hono';
import { z } from 'zod';
import { AppDataSource } from '../data-source';
import { WebhookConfig, WebhookEventType } from '../entities/WebhookConfig';

const app = new Hono();

const repo = () => AppDataSource.getRepository(WebhookConfig);

const ALL_EVENTS = Object.values(WebhookEventType);

const createSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(ALL_EVENTS as [string, ...string[]])).min(1),
  secret: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
});

const updateSchema = createSchema.partial().omit({});

app.get('/', async (c) => {
  const configs = await repo().find({ order: { createdAt: 'desc' } });
  return c.json(configs);
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
  return c.json(config, 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const config = await repo().findOne({ where: { id } });
  if (!config) {
    return c.json({ error: 'Webhook config not found' }, 404);
  }

  const body = updateSchema.parse(await c.req.json());
  if (body.url !== undefined) config.url = body.url;
  if (body.events !== undefined) config.events = body.events;
  if (body.secret !== undefined) config.secret = body.secret;
  if (body.isActive !== undefined) config.isActive = body.isActive;

  await repo().save(config);
  return c.json(config);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const config = await repo().findOne({ where: { id } });
  if (!config) {
    return c.json({ error: 'Webhook config not found' }, 404);
  }
  await repo().remove(config);
  return c.json({ success: true });
});

export default app;
