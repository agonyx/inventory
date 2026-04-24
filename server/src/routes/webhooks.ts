import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { processWebhookOrder } from '../services/orderProcessor';
import { errorHandler } from '../middleware/error-handler';

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
app.onError(errorHandler);

app.post('/orders', zValidator('json', webhookSchema), async (c) => {
  const data = c.req.valid('json');
  const order = await processWebhookOrder(data);
  return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
});

export default app;
