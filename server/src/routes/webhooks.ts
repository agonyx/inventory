import { Hono } from 'hono';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
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

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const app = new Hono();
app.onError(errorHandler);

app.post('/orders', async (c) => {
  const secret = getWebhookSecret();
  const signature = c.req.header('X-Webhook-Signature');
  const bodyText = await c.req.text();

  if (!secret) {
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Webhook endpoint not configured (missing WEBHOOK_SECRET)');
  }

  if (!signature) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Missing X-Webhook-Signature header');
  }

  if (!verifySignature(bodyText, signature, secret)) {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Invalid webhook signature');
  }

  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid JSON body');
  }

  const data = webhookSchema.safeParse(json);
  if (!data.success) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Invalid request body', { issues: data.error.issues });
  }

  const order = await processWebhookOrder(data.data);
  return c.json({ success: true, orderId: order.id, externalOrderId: order.externalOrderId, status: order.status }, 201);
});

export default app;
