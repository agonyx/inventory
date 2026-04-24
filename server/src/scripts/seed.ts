import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entities/User';
import { Location } from '../entities/Location';
import { Supplier } from '../entities/Supplier';
import { Product } from '../entities/Product';
import { ProductVariant } from '../entities/ProductVariant';
import { InventoryLevel } from '../entities/InventoryLevel';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { PurchaseOrder, PurchaseOrderStatus } from '../entities/PurchaseOrder';
import { PurchaseOrderItem } from '../entities/PurchaseOrderItem';
import { hashPassword } from '../services/auth';

export async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected');

  const userRepo = AppDataSource.getRepository(User);
  const locationRepo = AppDataSource.getRepository(Location);
  const supplierRepo = AppDataSource.getRepository(Supplier);
  const productRepo = AppDataSource.getRepository(Product);
  const variantRepo = AppDataSource.getRepository(ProductVariant);
  const inventoryRepo = AppDataSource.getRepository(InventoryLevel);
  const orderRepo = AppDataSource.getRepository(Order);
  const orderItemRepo = AppDataSource.getRepository(OrderItem);
  const poRepo = AppDataSource.getRepository(PurchaseOrder);

  // ── Users ──────────────────────────────────────────────────────────
  if ((await userRepo.count()) > 0) {
    console.log('Users already exist, skipping seed');
    await AppDataSource.destroy();
    return;
  }

  console.log('Seeding users...');
  const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD || 'admin123');

  const admin = userRepo.create({
    email: process.env.ADMIN_EMAIL || 'admin@nicheinventory.local',
    passwordHash,
    name: 'Admin',
    role: UserRole.ADMIN,
  });
  await userRepo.save(admin);

  const manager = userRepo.create({
    email: 'manager@nicheinventory.local',
    passwordHash,
    name: 'Sarah Manager',
    role: UserRole.MANAGER,
  });
  await userRepo.save(manager);

  const warehouse = userRepo.create({
    email: 'warehouse@nicheinventory.local',
    passwordHash,
    name: 'Tom Warehouse',
    role: UserRole.WAREHOUSE,
  });
  await userRepo.save(warehouse);
  console.log('Created 3 users');

  // ── Locations ──────────────────────────────────────────────────────
  console.log('Seeding locations...');
  const locations = await locationRepo.save([
    locationRepo.create({ name: 'Main Warehouse', type: 'warehouse', address: '100 Industrial Blvd, Suite A, Springfield, IL 62701' }),
    locationRepo.create({ name: 'East Wing', type: 'warehouse', address: '200 Commerce Dr, East Wing Bldg, Springfield, IL 62702' }),
    locationRepo.create({ name: 'Cold Storage', type: 'cold_storage', address: '300 Polar Ln, Springfield, IL 62703' }),
  ]);
  console.log(`Created ${locations.length} locations`);

  // ── Suppliers ──────────────────────────────────────────────────────
  console.log('Seeding suppliers...');
  const suppliers = await supplierRepo.save([
    supplierRepo.create({ name: 'Global Textiles Co.', contactName: 'Linda Chen', email: 'linda@globaltextiles.com', phone: '+1-555-0101', address: '888 Fabric Ave, Textile City, CA 90210', notes: 'Primary clothing supplier' }),
    supplierRepo.create({ name: 'TechParts Direct', contactName: 'Marcus Rivera', email: 'marcus@techparts.io', phone: '+1-555-0202', address: '42 Circuit Rd, San Jose, CA 95112', notes: 'Electronics components' }),
    supplierRepo.create({ name: 'EcoHome Goods', contactName: 'Priya Patel', email: 'priya@ecohome.co', phone: '+1-555-0303', address: '15 Green Way, Portland, OR 97201', notes: 'Sustainable home goods' }),
    supplierRepo.create({ name: 'FreshNature Organics', contactName: 'James O\'Brien', email: 'james@freshnature.org', phone: '+1-555-0404', address: '77 Orchard Ln, Sacramento, CA 95814', notes: 'Organic food and beverage supplier' }),
  ]);
  console.log(`Created ${suppliers.length} suppliers`);

  // ── Products ───────────────────────────────────────────────────────
  console.log('Seeding products...');
  const products = await productRepo.save([
    productRepo.create({ name: 'Organic Cotton T-Shirt', sku: 'OCT-001', description: 'Premium organic cotton crew-neck t-shirt', category: 'Apparel', price: 29.99, lowStockThreshold: 50, supplierId: suppliers[0].id }),
    productRepo.create({ name: 'Wireless Bluetooth Speaker', sku: 'WBS-002', description: 'Portable waterproof bluetooth speaker with 12h battery', category: 'Electronics', price: 79.99, lowStockThreshold: 30, supplierId: suppliers[1].id }),
    productRepo.create({ name: 'Bamboo Cutting Board Set', sku: 'BCB-003', description: 'Set of 3 eco-friendly bamboo cutting boards', category: 'Home & Kitchen', price: 34.99, lowStockThreshold: 25, supplierId: suppliers[2].id }),
    productRepo.create({ name: 'Cold Brew Coffee Concentrate', sku: 'CBC-004', description: 'Organic cold brew coffee concentrate 32oz', category: 'Food & Beverage', price: 14.99, lowStockThreshold: 100, supplierId: suppliers[3].id }),
    productRepo.create({ name: 'LED Desk Lamp', sku: 'LDL-005', description: 'Adjustable LED desk lamp with USB charging port', category: 'Electronics', price: 49.99, lowStockThreshold: 20, supplierId: suppliers[1].id }),
  ]);
  console.log(`Created ${products.length} products`);

  // ── Product Variants ───────────────────────────────────────────────
  console.log('Seeding product variants...');
  const variants = await variantRepo.save([
    variantRepo.create({ name: 'Organic Cotton T-Shirt - S / Black', sku: 'OCT-001-S-BLK', barcode: '1000001', productId: products[0].id }),
    variantRepo.create({ name: 'Organic Cotton T-Shirt - M / Black', sku: 'OCT-001-M-BLK', barcode: '1000002', productId: products[0].id }),
    variantRepo.create({ name: 'Organic Cotton T-Shirt - L / White', sku: 'OCT-001-L-WHT', barcode: '1000003', productId: products[0].id }),
    variantRepo.create({ name: 'Bluetooth Speaker - Midnight Black', sku: 'WBS-002-BLK', barcode: '2000001', productId: products[1].id }),
    variantRepo.create({ name: 'Bluetooth Speaker - Ocean Blue', sku: 'WBS-002-BLU', barcode: '2000002', productId: products[1].id }),
    variantRepo.create({ name: 'Bamboo Board Set - Standard', sku: 'BCB-003-STD', barcode: '3000001', productId: products[2].id }),
    variantRepo.create({ name: 'Cold Brew Concentrate - Original', sku: 'CBC-004-ORG', barcode: '4000001', productId: products[3].id }),
    variantRepo.create({ name: 'Cold Brew Concentrate - Vanilla', sku: 'CBC-004-VAN', barcode: '4000002', productId: products[3].id }),
    variantRepo.create({ name: 'LED Desk Lamp - Matte White', sku: 'LDL-005-WHT', barcode: '5000001', productId: products[4].id }),
  ]);
  console.log(`Created ${variants.length} product variants`);

  // ── Inventory Levels ───────────────────────────────────────────────
  console.log('Seeding inventory levels...');
  const invEntries: Partial<InventoryLevel>[] = [
    { variantId: variants[0].id, locationId: locations[0].id, quantity: 120, reservedQuantity: 10 },
    { variantId: variants[0].id, locationId: locations[1].id, quantity: 45, reservedQuantity: 5 },
    { variantId: variants[1].id, locationId: locations[0].id, quantity: 200, reservedQuantity: 20 },
    { variantId: variants[2].id, locationId: locations[0].id, quantity: 80, reservedQuantity: 0 },
    { variantId: variants[2].id, locationId: locations[1].id, quantity: 30, reservedQuantity: 0 },
    { variantId: variants[3].id, locationId: locations[0].id, quantity: 60, reservedQuantity: 8 },
    { variantId: variants[3].id, locationId: locations[1].id, quantity: 25, reservedQuantity: 0 },
    { variantId: variants[4].id, locationId: locations[0].id, quantity: 35, reservedQuantity: 3 },
    { variantId: variants[5].id, locationId: locations[0].id, quantity: 90, reservedQuantity: 12 },
    { variantId: variants[5].id, locationId: locations[2].id, quantity: 15, reservedQuantity: 0 },
    { variantId: variants[6].id, locationId: locations[2].id, quantity: 300, reservedQuantity: 50 },
    { variantId: variants[6].id, locationId: locations[0].id, quantity: 150, reservedQuantity: 20 },
    { variantId: variants[7].id, locationId: locations[2].id, quantity: 200, reservedQuantity: 30 },
    { variantId: variants[7].id, locationId: locations[0].id, quantity: 75, reservedQuantity: 5 },
    { variantId: variants[8].id, locationId: locations[0].id, quantity: 40, reservedQuantity: 2 },
    { variantId: variants[8].id, locationId: locations[1].id, quantity: 18, reservedQuantity: 0 },
    { variantId: variants[1].id, locationId: locations[2].id, quantity: 10, reservedQuantity: 0 },
    { variantId: variants[4].id, locationId: locations[1].id, quantity: 50, reservedQuantity: 10 },
  ];

  const inventoryLevels = await inventoryRepo.save(
    invEntries.map((e) => inventoryRepo.create(e as InventoryLevel))
  );
  console.log(`Created ${inventoryLevels.length} inventory levels`);

  // ── Orders ─────────────────────────────────────────────────────────
  console.log('Seeding orders...');
  const orderData = [
    { externalOrderId: 'ORD-2024-001', status: OrderStatus.PENDING, customerName: 'Alice Johnson', customerEmail: 'alice@example.com', shippingAddress: '123 Maple St, Chicago, IL 60601', totalAmount: 59.98, source: 'web' },
    { externalOrderId: 'ORD-2024-002', status: OrderStatus.CONFIRMED, customerName: 'Bob Smith', customerEmail: 'bob@example.com', shippingAddress: '456 Oak Ave, Detroit, MI 48201', totalAmount: 79.99, source: 'web' },
    { externalOrderId: 'ORD-2024-003', status: OrderStatus.PACKED, customerName: 'Carol Davis', customerEmail: 'carol@example.com', shippingAddress: '789 Pine Rd, Milwaukee, WI 53201', totalAmount: 114.97, source: 'amazon' },
    { externalOrderId: 'ORD-2024-004', status: OrderStatus.SHIPPED, customerName: 'Dan Wilson', customerEmail: 'dan@example.com', shippingAddress: '321 Elm St, Indianapolis, IN 46201', totalAmount: 44.98, source: 'web', trackingNumber: '1Z999AA10123456784', shippingCarrier: 'UPS' },
    { externalOrderId: 'ORD-2024-005', status: OrderStatus.SHIPPED, customerName: 'Eva Martinez', customerEmail: 'eva@example.com', shippingAddress: '654 Birch Ln, Columbus, OH 43201', totalAmount: 149.97, source: 'shopify', trackingNumber: '9400111899223100001234', shippingCarrier: 'USPS' },
    { externalOrderId: 'ORD-2024-006', status: OrderStatus.CANCELLED, customerName: 'Frank Lee', customerEmail: 'frank@example.com', shippingAddress: '987 Cedar Ct, Minneapolis, MN 55401', totalAmount: 29.99, source: 'web' },
    { externalOrderId: 'ORD-2024-007', status: OrderStatus.PENDING, customerName: 'Grace Kim', customerEmail: 'grace@example.com', shippingAddress: '147 Walnut Dr, St. Louis, MO 63101', totalAmount: 94.97, source: 'web' },
    { externalOrderId: 'ORD-2024-008', status: OrderStatus.CONFIRMED, customerName: 'Henry Brown', customerEmail: 'henry@example.com', shippingAddress: '258 Spruce Way, Kansas City, MO 64101', totalAmount: 64.98, source: 'amazon' },
    { externalOrderId: 'ORD-2024-009', status: OrderStatus.SHIPPED, customerName: 'Iris Chen', customerEmail: 'iris@example.com', shippingAddress: '369 Ash Blvd, Des Moines, IA 50301', totalAmount: 179.96, source: 'web', trackingNumber: '74891382910483', shippingCarrier: 'FedEx' },
    { externalOrderId: 'ORD-2024-010', status: OrderStatus.PACKED, customerName: 'Jack Taylor', customerEmail: 'jack@example.com', shippingAddress: '480 Redwood Pl, Omaha, NE 68101', totalAmount: 34.99, source: 'shopify' },
  ];

  const orders = await orderRepo.save(orderData.map((o) => orderRepo.create(o)));

  const orderItems = await AppDataSource.getRepository(OrderItem).save([
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[0].id, variantId: variants[0].id, quantity: 2, unitPrice: 29.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[1].id, variantId: variants[3].id, quantity: 1, unitPrice: 79.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[2].id, variantId: variants[1].id, quantity: 1, unitPrice: 29.99, externalSku: 'OCT-001-M-BLK' }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[2].id, variantId: variants[5].id, quantity: 1, unitPrice: 34.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[2].id, variantId: variants[8].id, quantity: 1, unitPrice: 49.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[3].id, variantId: variants[6].id, quantity: 2, unitPrice: 14.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[3].id, variantId: variants[0].id, quantity: 1, unitPrice: 29.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[4].id, variantId: variants[3].id, quantity: 1, unitPrice: 79.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[4].id, variantId: variants[2].id, quantity: 1, unitPrice: 29.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[4].id, variantId: variants[5].id, quantity: 1, unitPrice: 34.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[5].id, variantId: variants[0].id, quantity: 1, unitPrice: 29.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[6].id, variantId: variants[4].id, quantity: 1, unitPrice: 79.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[6].id, variantId: variants[1].id, quantity: 1, unitPrice: 29.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[7].id, variantId: variants[8].id, quantity: 1, unitPrice: 49.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[7].id, variantId: variants[0].id, quantity: 1, unitPrice: 29.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[8].id, variantId: variants[4].id, quantity: 2, unitPrice: 79.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[8].id, variantId: variants[6].id, quantity: 1, unitPrice: 14.99 }),
    AppDataSource.getRepository(OrderItem).create({ orderId: orders[9].id, variantId: variants[5].id, quantity: 1, unitPrice: 34.99 }),
  ]);
  console.log(`Created ${orders.length} orders with ${orderItems.length} items`);

  // ── Purchase Orders ────────────────────────────────────────────────
  console.log('Seeding purchase orders...');
  const poData = [
    { supplierId: suppliers[0].id, status: PurchaseOrderStatus.SENT, notes: 'Q2 restock for cotton t-shirts' },
    { supplierId: suppliers[1].id, status: PurchaseOrderStatus.PARTIALLY_RECEIVED, notes: 'Speaker reorder - partial delivery received' },
    { supplierId: suppliers[3].id, status: PurchaseOrderStatus.DRAFT, notes: 'Upcoming cold brew seasonal order' },
  ];
  const purchaseOrders = await poRepo.save(poData.map((p) => poRepo.create(p)));

  const poItemRepo = AppDataSource.getRepository(PurchaseOrderItem);
  const poItems = await poItemRepo.save([
    poItemRepo.create({ purchaseOrderId: purchaseOrders[0].id, variantId: variants[0].id, quantity: 500, receivedQuantity: 0, unitCost: 12.00 }),
    poItemRepo.create({ purchaseOrderId: purchaseOrders[0].id, variantId: variants[1].id, quantity: 500, receivedQuantity: 0, unitCost: 12.00 }),
    poItemRepo.create({ purchaseOrderId: purchaseOrders[0].id, variantId: variants[2].id, quantity: 300, receivedQuantity: 0, unitCost: 12.00 }),
    poItemRepo.create({ purchaseOrderId: purchaseOrders[1].id, variantId: variants[3].id, quantity: 200, receivedQuantity: 120, unitCost: 35.00 }),
    poItemRepo.create({ purchaseOrderId: purchaseOrders[1].id, variantId: variants[4].id, quantity: 150, receivedQuantity: 0, unitCost: 35.00 }),
    poItemRepo.create({ purchaseOrderId: purchaseOrders[2].id, variantId: variants[6].id, quantity: 1000, receivedQuantity: 0, unitCost: 5.50 }),
    poItemRepo.create({ purchaseOrderId: purchaseOrders[2].id, variantId: variants[7].id, quantity: 800, receivedQuantity: 0, unitCost: 6.00 }),
  ]);
  console.log(`Created ${purchaseOrders.length} purchase orders with ${poItems.length} items`);

  console.log('Seed complete!');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
