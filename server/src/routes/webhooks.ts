import { Hono } from 'hono';
import { z } from 'zod';
import { createHmac } from 'crypto';
import { processWebhookOrder } from '../services/orderProcessor';
import { errorHandler } from '../middleware/error-handler';
import { AppError, ErrorCode } from '../errors/app-error';

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

function getWebhookSecret(): string {
  return process.env.WEBHOOK_SECRET || '';
}

function verifySignature(body: string, signature: string): boolean {
  const secret = getWebhookSecret();
  if (!secret) return true; // Skip verification if no secret configured
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return signature === `sha256=${expected}`;
}

const app = new Hono();
app.onError(errorHandler);

app.post('/orders', async (c) => {
  const secret = getWebhookSecret();
  const signature = c.req.header('X-Webhook-Signature');
  const bodyText = await c.req.text();

  if (secret && !signature) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing X-Webhook-Signature header');
  }

  if (signature && !verifySignature(bodyText, signature)) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid webhook signature');
  }

  const data = webhookSchema.safeParse(JSON.parse(bodyText));
  if (!data.success) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid request body', { issues: data.error.issues });
  }

  const order = await processWebhookOrder(data.data);
  return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
});

export default app;
