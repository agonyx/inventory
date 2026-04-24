import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Niche Inventory API',
    version: '1.0.0',
  },
  servers: [{ url: '/', description: 'Current server' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth' },
    { name: 'Products' },
    { name: 'Inventory' },
    { name: 'Orders' },
    { name: 'Locations' },
    { name: 'Transfers' },
    { name: 'Stocktakes' },
    { name: 'Pick List' },
    { name: 'Alerts' },
    { name: 'Audit Logs' },
    { name: 'Reports' },
    { name: 'Notifications' },
    { name: 'Webhooks' },
    { name: 'Users' },
    { name: 'Suppliers' },
    { name: 'Purchase Orders' },
    { name: 'Returns' },
    { name: 'Bulk' },
    { name: 'Health' },
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        security: [],
        responses: {
          '200': { description: 'Login successful' },
          '400': { description: 'Invalid credentials' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh token',
        security: [],
        responses: {
          '200': { description: 'Token refreshed' },
          '401': { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        security: [],
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        security: [],
        responses: {
          '200': { description: 'Current user info' },
          '401': { description: 'Not authenticated' },
        },
      },
    },
    '/auth/profile': {
      patch: {
        tags: ['Auth'],
        summary: 'Update profile',
        security: [],
        responses: {
          '200': { description: 'Profile updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Not authenticated' },
        },
      },
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List products',
        responses: {
          '200': { description: 'List of products' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create product',
        responses: {
          '200': { description: 'Product created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Product details' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Product not found' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update product',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Product updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Product deleted' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/products/{id}/images': {
      post: {
        tags: ['Products'],
        summary: 'Upload product image',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Image uploaded' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/inventory': {
      get: {
        tags: ['Inventory'],
        summary: 'List inventory',
        responses: {
          '200': { description: 'List of inventory items' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/inventory/adjust': {
      post: {
        tags: ['Inventory'],
        summary: 'Adjust inventory',
        responses: {
          '200': { description: 'Inventory adjusted' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List orders',
        responses: {
          '200': { description: 'List of orders' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create order',
        responses: {
          '200': { description: 'Order created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Order details' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Update order status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Order status updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/locations': {
      get: {
        tags: ['Locations'],
        summary: 'List locations',
        responses: {
          '200': { description: 'List of locations' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Locations'],
        summary: 'Create location',
        responses: {
          '200': { description: 'Location created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/locations/{id}': {
      put: {
        tags: ['Locations'],
        summary: 'Update location',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Location updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['Locations'],
        summary: 'Delete location',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Location deleted' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/transfers': {
      get: {
        tags: ['Transfers'],
        summary: 'List transfers',
        responses: {
          '200': { description: 'List of transfers' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Transfers'],
        summary: 'Create transfer',
        responses: {
          '200': { description: 'Transfer created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/transfers/{id}/status': {
      patch: {
        tags: ['Transfers'],
        summary: 'Update transfer status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Transfer status updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/stocktakes': {
      get: {
        tags: ['Stocktakes'],
        summary: 'List stocktakes',
        responses: {
          '200': { description: 'List of stocktakes' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Stocktakes'],
        summary: 'Create stocktake',
        responses: {
          '200': { description: 'Stocktake created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/stocktakes/{id}/complete': {
      patch: {
        tags: ['Stocktakes'],
        summary: 'Complete stocktake',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Stocktake completed' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/pick-list': {
      get: {
        tags: ['Pick List'],
        summary: 'List pick list items',
        responses: {
          '200': { description: 'List of pick list items' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/pick-list/{id}/pick': {
      patch: {
        tags: ['Pick List'],
        summary: 'Mark pick list item as picked',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Item picked' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/alerts': {
      get: {
        tags: ['Alerts'],
        summary: 'List alerts',
        responses: {
          '200': { description: 'List of alerts' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/audit-logs': {
      get: {
        tags: ['Audit Logs'],
        summary: 'List audit logs',
        responses: {
          '200': { description: 'List of audit logs' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/reports/inventory-value': {
      get: {
        tags: ['Reports'],
        summary: 'Get inventory value report',
        responses: {
          '200': { description: 'Inventory value report' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/reports/movement': {
      get: {
        tags: ['Reports'],
        summary: 'Get movement report',
        responses: {
          '200': { description: 'Movement report' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/reports/export/csv': {
      get: {
        tags: ['Reports'],
        summary: 'Export data as CSV',
        responses: {
          '200': { description: 'CSV file' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List notifications',
        responses: {
          '200': { description: 'List of notifications' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Notification marked as read' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/notifications/read-all': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        responses: {
          '200': { description: 'All notifications marked as read' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/webhooks/config': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhook configurations',
        responses: {
          '200': { description: 'List of webhook configs' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create webhook configuration',
        responses: {
          '200': { description: 'Webhook config created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/webhooks/config/{id}': {
      patch: {
        tags: ['Webhooks'],
        summary: 'Update webhook configuration',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Webhook config updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete webhook configuration',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Webhook config deleted' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/webhooks/orders': {
      post: {
        tags: ['Webhooks'],
        summary: 'Handle incoming order webhook',
        security: [],
        responses: {
          '200': { description: 'Webhook processed' },
          '400': { description: 'Invalid payload' },
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users',
        responses: {
          '200': { description: 'List of users' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        responses: {
          '200': { description: 'User created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/users/{id}': {
      patch: {
        tags: ['Users'],
        summary: 'Update user',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'User updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'User deleted' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/suppliers': {
      get: {
        tags: ['Suppliers'],
        summary: 'List suppliers',
        responses: {
          '200': { description: 'List of suppliers' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Suppliers'],
        summary: 'Create supplier',
        responses: {
          '200': { description: 'Supplier created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/suppliers/{id}': {
      put: {
        tags: ['Suppliers'],
        summary: 'Update supplier',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Supplier updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['Suppliers'],
        summary: 'Delete supplier',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Supplier deleted' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/purchase-orders': {
      get: {
        tags: ['Purchase Orders'],
        summary: 'List purchase orders',
        responses: {
          '200': { description: 'List of purchase orders' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Purchase Orders'],
        summary: 'Create purchase order',
        responses: {
          '200': { description: 'Purchase order created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/purchase-orders/{id}/status': {
      patch: {
        tags: ['Purchase Orders'],
        summary: 'Update purchase order status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Purchase order status updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/returns': {
      get: {
        tags: ['Returns'],
        summary: 'List returns',
        responses: {
          '200': { description: 'List of returns' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Returns'],
        summary: 'Create return',
        responses: {
          '200': { description: 'Return created' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/returns/{id}/status': {
      patch: {
        tags: ['Returns'],
        summary: 'Update return status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Return status updated' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/bulk/adjust': {
      post: {
        tags: ['Bulk'],
        summary: 'Bulk adjust inventory',
        responses: {
          '200': { description: 'Bulk adjustment complete' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': { description: 'Server is healthy' },
        },
      },
    },
  },
} as const;

export function setupDocs(app: Hono) {
  app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }));
  app.get('/docs/openapi.json', (c) => c.json(spec));
}
