import nodemailer from 'nodemailer';
import type { Order } from '../entities/Order';
import type { LowStockAlert } from './alerts';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const NOTIFICATION_EMAIL_FROM = process.env.NOTIFICATION_EMAIL_FROM || 'noreply@inventory.local';
const NOTIFICATION_EMAIL_TO = process.env.NOTIFICATION_EMAIL_TO || '';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function isConfigured(): boolean {
  return !!(SMTP_HOST && NOTIFICATION_EMAIL_TO);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isConfigured()) {
    console.log('[email] SMTP not configured, skipping email');
    return;
  }

  try {
    const info = await getTransporter().sendMail({
      from: NOTIFICATION_EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`[email] Sent to ${to}: ${info.messageId}`);
  } catch (err: unknown) {
    console.error(`[email] Failed to send to ${to}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function baseStyles(): string {
  return `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 24px; }
      .header { background: #1e40af; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0; }
      .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
      .body { background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th { text-align: left; background: #f9fafb; padding: 10px 12px; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; }
      td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
      .text-right { text-align: right; }
      .footer { margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
      .badge-warning { background: #fef3c7; color: #92400e; }
      .badge-danger { background: #fee2e2; color: #991b1b; }
      .badge-success { background: #d1fae5; color: #065f46; }
      .total-row td { font-weight: 600; border-top: 2px solid #e5e7eb; }
    </style>`;
}

interface OrderWithItems extends Order {
  items: import('../entities/OrderItem').OrderItem[];
}

export async function sendOrderConfirmation(order: OrderWithItems): Promise<void> {
  const itemRows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td>${(item as any).variant?.product?.name || (item as any).variant?.name || item.externalSku || 'N/A'}</td>
        <td>${item.externalSku || (item as any).variant?.sku || 'N/A'}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">$${Number(item.unitPrice).toFixed(2)}</td>
        <td class="text-right">$${(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${baseStyles()}</head>
    <body>
      <div class="container">
        <div class="header"><h1>Order Confirmation</h1></div>
        <div class="body">
          <p>Order <strong>${order.externalOrderId}</strong> has been received.</p>
          <p><strong>Customer:</strong> ${order.customerName}<br>
             <strong>Date:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr><th>Product</th><th>SKU</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr>
            </thead>
            <tbody>
              ${itemRows}
              <tr class="total-row"><td colspan="4" class="text-right">Total</td><td class="text-right">$${Number(order.totalAmount).toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="footer">Niche Inventory System</div>
      </div>
    </body>
    </html>`;

  await sendEmail(NOTIFICATION_EMAIL_TO, `Order Confirmation: ${order.externalOrderId}`, html);
}

export async function sendShippingConfirmation(order: OrderWithItems): Promise<void> {
  const itemRows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td>${(item as any).variant?.product?.name || (item as any).variant?.name || item.externalSku || 'N/A'}</td>
        <td class="text-right">${item.quantity}</td>
      </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${baseStyles()}</head>
    <body>
      <div class="container">
        <div class="header"><h1>Shipping Confirmation</h1></div>
        <div class="body">
          <p>Order <strong>${order.externalOrderId}</strong> has been shipped!</p>
          <p><strong>Customer:</strong> ${order.customerName}<br>
             <strong>Carrier:</strong> ${order.shippingCarrier || 'N/A'}<br>
             <strong>Tracking #:</strong> ${order.trackingNumber || 'N/A'}</p>
          ${order.shippingAddress ? `<p><strong>Shipping Address:</strong><br>${order.shippingAddress}</p>` : ''}
          <table>
            <thead>
              <tr><th>Product</th><th class="text-right">Qty</th></tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        <div class="footer">Niche Inventory System</div>
      </div>
    </body>
    </html>`;

  await sendEmail(NOTIFICATION_EMAIL_TO, `Order Shipped: ${order.externalOrderId} — ${order.trackingNumber || ''}`, html);
}

export async function sendLowStockAlert(alerts: LowStockAlert[]): Promise<void> {
  const rows = alerts
    .map(
      (a) => `
      <tr>
        <td>${a.productName}</td>
        <td>${a.sku}</td>
        <td>${a.variantName}</td>
        <td>${a.locationName}</td>
        <td class="text-right"><span class="badge ${a.currentQuantity === 0 ? 'badge-danger' : 'badge-warning'}">${a.currentQuantity}</span></td>
        <td class="text-right">${a.threshold}</td>
        <td class="text-right">${a.deficit}</td>
      </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${baseStyles()}</head>
    <body>
      <div class="container">
        <div class="header"><h1>Low Stock Alert</h1></div>
        <div class="body">
          <p>${alerts.length} product(s) are below their low stock threshold:</p>
          <table>
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Variant</th><th>Location</th><th class="text-right">Qty</th><th class="text-right">Threshold</th><th class="text-right">Deficit</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p>Please review and restock as needed.</p>
        </div>
        <div class="footer">Niche Inventory System</div>
      </div>
    </body>
    </html>`;

  await sendEmail(NOTIFICATION_EMAIL_TO, `Low Stock Alert: ${alerts.length} product(s) below threshold`, html);
}
