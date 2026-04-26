import { createHmac, timingSafeEqual } from 'crypto';
import { AppDataSource } from '../data-source';
import { WebhookConfig } from '../entities/WebhookConfig';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 5000, 15000]; // exponential-ish backoff

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fireWebhooks(event: string, data: Record<string, any>): Promise<void> {
  const configs = await AppDataSource.getRepository(WebhookConfig).find({
    where: { isActive: true },
  });

  const activeConfigs = configs.filter((c) => c.events.includes(event));
  if (activeConfigs.length === 0) return;

  const timestamp = new Date().toISOString();
  const payload: WebhookPayload = { event, timestamp, data };
  const payloadStr = JSON.stringify(payload);

  // Fire each webhook independently — don't block on failures
  const promises = activeConfigs.map(async (config) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Timestamp': timestamp,
        };

        if (config.secret) {
          headers['X-Webhook-Signature'] = `sha256=${signPayload(payloadStr, config.secret)}`;
        }

        const res = await fetch(config.url, {
          method: 'POST',
          headers,
          body: payloadStr,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (res.ok) {
          console.log(`[webhook] Delivered ${event} to ${config.url}`);
          return; // success
        }

        console.warn(`[webhook] ${config.url} returned ${res.status} for ${event} (attempt ${attempt + 1})`);
      } catch (err: unknown) {
        console.warn(`[webhook] Failed to deliver ${event} to ${config.url} (attempt ${attempt + 1}): ${err instanceof Error ? err.message : String(err)}`);
      }

      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }

    console.error(`[webhook] Gave up delivering ${event} to ${config.url} after ${MAX_RETRIES} attempts`);
  });

  // Fire all webhooks concurrently but don't await — fire-and-forget
  Promise.all(promises).catch(() => {});
}

export { WebhookEventType } from '../entities/WebhookConfig';
