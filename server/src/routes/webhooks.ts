import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { processWebhookOrder } from '../services/orderProcessor';

const webhookSchema = z.object({
  externalOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  shippingAddress: z.string().optional(),
  totalAmount: z.number().nonnegative(),
  source: z.string().min(1),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
});

const app = new Hono();

app.post('/orders', zValidator('json', webhookSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const order = await processWebhookOrder(data);
    return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('already exists') ? 409
      : message.includes('not found') || message.includes('No inventory') ? 404
      : message.includes('Insufficient') ? 400
      : 500;
    return c.json({ success: false, error: message }, status as 400 | 404 | 409 | 500);
  }
});

export default app;
