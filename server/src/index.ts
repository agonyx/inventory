import 'reflect-metadata';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { AppDataSource } from './data-source';
import { logger } from './utils/logger';
import { requestLogger } from './middleware/request-logger';
const app = new Hono();
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));

import { setupDocs } from './utils/openapi';
setupDocs(app);

import webhookRoute from './routes/webhooks';
import { errorHandler } from './middleware/error-handler';
import { jwtAuth } from './middleware/jwt-auth';
import { requireRole, requireAdmin, requirePermission } from './middleware/rbac';
import { UserRole } from './entities/User';
import productsRoute from './routes/products';
import inventoryRoute from './routes/inventory';
import locationsRoute from './routes/locations';
import ordersRoute from './routes/orders';
import pickListRoute from './routes/pickList';
import authRoute from './routes/auth';
import alertsRoute from './routes/alerts';
import auditLogsRoute from './routes/auditLogs';
import transfersRoute from './routes/transfers';
import stocktakesRoute from './routes/stocktakes';
import bulkRoute from './routes/bulk';
import reportsRoute from './routes/reports';
import notificationsRoute from './routes/notifications';
import webhookConfigsRoute from './routes/webhookConfigs';
import usersRoute from './routes/users';
import suppliersRoute from './routes/suppliers';
import returnsRoute from './routes/returns';
import purchaseOrdersRoute from './routes/purchaseOrders';

// Public routes
app.route('/webhooks', webhookRoute);
app.get('/health', (c) => c.json({ status: 'ok' }));

app.use('/uploads/*', serveStatic({ root: './' }));

// Auth routes (no JWT required — not under /api/*)
app.route('/auth', authRoute);

app.use('*', requestLogger);

// Auth middleware for /api/* routes only
app.use('/api/*', jwtAuth);

// RBAC-applied routes
app.use('/api/users/*', requireAdmin);
app.route('/api/users', usersRoute);

app.use('/api/webhooks/config/*', requireRole(UserRole.ADMIN), requirePermission('webhooks/config'));
app.route('/api/webhooks/config', webhookConfigsRoute);

app.use('/api/products/*', requireRole(UserRole.ADMIN, UserRole.MANAGER), requirePermission('products'));
app.route('/api/products', productsRoute);

app.use('/api/suppliers/*', requireRole(UserRole.ADMIN, UserRole.MANAGER), requirePermission('suppliers'));
app.route('/api/suppliers', suppliersRoute);

app.use('/api/purchase-orders/*', requireRole(UserRole.ADMIN, UserRole.MANAGER), requirePermission('purchase-orders'));
app.route('/api/purchase-orders', purchaseOrdersRoute);

app.use('/api/orders/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('orders'));
app.route('/api/orders', ordersRoute);

app.use('/api/reports/*', requireRole(UserRole.ADMIN, UserRole.MANAGER), requirePermission('reports'));
app.route('/api/reports', reportsRoute);

app.use('/api/audit-logs/*', requireRole(UserRole.ADMIN, UserRole.MANAGER), requirePermission('audit-logs'));
app.route('/api/audit-logs', auditLogsRoute);

app.use('/api/bulk/*', requireRole(UserRole.ADMIN, UserRole.MANAGER), requirePermission('products'));
app.route('/api/bulk', bulkRoute);

app.use('/api/pick-list/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('pick-list'));
app.route('/api/pick-list', pickListRoute);

app.use('/api/inventory/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('inventory'));
app.route('/api/inventory', inventoryRoute);

app.use('/api/transfers/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('transfers'));
app.route('/api/transfers', transfersRoute);

app.use('/api/stocktakes/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('stocktakes'));
app.route('/api/stocktakes', stocktakesRoute);

app.use('/api/locations/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('locations'));
app.route('/api/locations', locationsRoute);

app.use('/api/notifications/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('notifications'));
app.route('/api/notifications', notificationsRoute);

app.use('/api/alerts/*', requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE), requirePermission('inventory'));
app.route('/api/alerts', alertsRoute);

app.use('/api/returns/*', requireRole(UserRole.ADMIN, UserRole.MANAGER), requirePermission('returns'));
app.route('/api/returns', returnsRoute);

app.onError(errorHandler);
const port = parseInt(process.env.PORT || '3002');
AppDataSource.initialize().then(async () => {
  logger.info('Database connected');
  const { serve } = await import('@hono/node-server');
  serve({ fetch: app.fetch, port });
  logger.info({ port }, 'Server running');
}).catch((err) => { logger.error({ err }, 'Failed to start'); process.exit(1); });
