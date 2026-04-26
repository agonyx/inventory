import { Hono } from 'hono';
import { z } from 'zod';
import { AppDataSource } from '../data-source';

const app = new Hono();

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const groupBySchema = z.enum(['day', 'week', 'month']);

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// GET /api/reports/summary — KPI dashboard cards
app.get('/summary', async (c) => {
  const [productsRes, ordersRes, pendingRes, todayRes, lowStockRes, stockValueRes] = await Promise.all([
    AppDataSource.manager.query('SELECT COUNT(*)::int as "totalProducts" FROM products'),
    AppDataSource.manager.query('SELECT COUNT(*)::int as "totalOrders" FROM orders'),
    AppDataSource.manager.query('SELECT COUNT(*)::int as "pendingOrders" FROM orders WHERE status = $1', ['pending']),
    AppDataSource.manager.query('SELECT COUNT(*)::int as "ordersToday" FROM orders WHERE DATE("createdAt") = CURRENT_DATE'),
    AppDataSource.manager.query(
      `SELECT COUNT(*)::int as "lowStockCount" FROM inventory_levels il
       JOIN product_variants pv ON pv.id = il."variantId"
       JOIN products p ON p.id = pv."productId"
       WHERE (il.quantity - il."reservedQuantity") < p."lowStockThreshold" AND p."lowStockThreshold" > 0`
    ),
    AppDataSource.manager.query(
      `SELECT COALESCE(SUM(il.quantity * p.price), 0)::float as "totalStockValue"
       FROM inventory_levels il
       JOIN product_variants pv ON pv.id = il."variantId"
       JOIN products p ON p.id = pv."productId"`
    ),
  ]);

  return c.json({
    totalProducts: productsRes[0]?.totalProducts ?? 0,
    totalStockValue: Number(stockValueRes[0]?.totalStockValue ?? 0),
    lowStockCount: lowStockRes[0]?.lowStockCount ?? 0,
    pendingOrders: pendingRes[0]?.pendingOrders ?? 0,
    ordersToday: todayRes[0]?.ordersToday ?? 0,
    totalOrders: ordersRes[0]?.totalOrders ?? 0,
  });
});

// GET /api/reports/stock-by-location
app.get('/stock-by-location', async (c) => {
  const result = await AppDataSource.manager.query(
    `SELECT l.id as "locationId", l.name as "locationName",
            COALESCE(SUM(il.quantity), 0)::int as "totalQuantity",
            COUNT(DISTINCT il."variantId")::int as "variantCount"
     FROM locations l
     LEFT JOIN inventory_levels il ON il."locationId" = l.id
     GROUP BY l.id, l.name
     ORDER BY "totalQuantity" DESC`
  );

  return c.json(result);
});

// GET /api/reports/orders-over-time?from=...&to=...&groupby=day|week|month
app.get('/orders-over-time', async (c) => {
  const query = c.req.query();
  const parsed = dateRangeSchema.safeParse(query);
  const parsedGroup = groupBySchema.safeParse(query.groupby);

  const from = parsed.success && parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = parsed.success && parsed.data.to
    ? new Date(parsed.data.to)
    : new Date();
  const groupBy = parsedGroup.success ? parsedGroup.data : 'day';

  const result = await AppDataSource.manager.query(
    `SELECT DATE_TRUNC($1, o."createdAt") as period,
            COUNT(*)::int as count,
            COALESCE(SUM(o."totalAmount")::float, 0) as revenue
     FROM orders o
     WHERE o."createdAt" >= $2 AND o."createdAt" <= $3
     GROUP BY DATE_TRUNC($1, o."createdAt")
     ORDER BY period`,
    [groupBy, from.toISOString(), to.toISOString()]
  );

  return c.json(
    result.map((r: any) => ({
      period: r.period,
      count: r.count,
      revenue: Number(r.revenue),
    }))
  );
});

// GET /api/reports/top-products?limit=10&from=...&to=...
app.get('/top-products', async (c) => {
  const query = c.req.query();
  const { limit } = limitSchema.parse(query);
  const parsed = dateRangeSchema.safeParse(query);

  const from = parsed.success && parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = parsed.success && parsed.data.to
    ? new Date(parsed.data.to)
    : new Date();

  const result = await AppDataSource.manager.query(
    `SELECT p.id as "productId", p.name as "productName", p.sku as "sku",
            SUM(oi.quantity)::int as "totalQuantity",
            COALESCE(SUM(oi.quantity * oi."unitPrice")::float, 0) as "totalRevenue"
     FROM order_items oi
     JOIN product_variants pv ON pv.id = oi."variantId"
     JOIN products p ON p.id = pv."productId"
     JOIN orders o ON o.id = oi."orderId"
     WHERE o."createdAt" >= $1 AND o."createdAt" <= $2
     GROUP BY p.id, p.name, p.sku
     ORDER BY "totalQuantity" DESC
     LIMIT $3`,
    [from.toISOString(), to.toISOString(), limit]
  );

  return c.json(
    result.map((r: any) => ({
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      totalQuantity: r.totalQuantity,
      totalRevenue: Number(r.totalRevenue),
    }))
  );
});

// GET /api/reports/inventory-valuation
app.get('/inventory-valuation', async (c) => {
  const result = await AppDataSource.manager.query(
    `SELECT p.id as "productId", p.name as "productName", p.sku as "sku",
            COALESCE(SUM(il.quantity), 0)::int as "totalStock",
            p.price as "unitPrice",
            COALESCE(SUM(il.quantity * p.price)::float, 0) as "totalValue"
     FROM products p
     JOIN product_variants pv ON pv."productId" = p.id
     LEFT JOIN inventory_levels il ON il."variantId" = pv.id
     GROUP BY p.id, p.name, p.sku, p.price
     ORDER BY "totalValue" DESC`
  );

  return c.json(
    result.map((r: any) => ({
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      totalStock: r.totalStock,
      unitPrice: Number(r.unitPrice),
      totalValue: Number(r.totalValue),
    }))
  );
});

// GET /api/reports/orders-by-status
app.get('/orders-by-status', async (c) => {
  const result = await AppDataSource.manager.query(
    `SELECT status, COUNT(*)::int as count FROM orders GROUP BY status ORDER BY count DESC`
  );
  return c.json(result.map((r: any) => ({ status: r.status, count: r.count })));
});

export default app;
