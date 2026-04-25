import 'reflect-metadata';
import { AppDataSource } from './src/data-source';
import { User, UserRole } from './src/entities/User';
import { Location } from './src/entities/Location';
import { Supplier } from './src/entities/Supplier';
import { Product } from './src/entities/Product';
import { ProductVariant } from './src/entities/ProductVariant';
import { InventoryLevel } from './src/entities/InventoryLevel';
import { Order, OrderStatus } from './src/entities/Order';
import { OrderItem } from './src/entities/OrderItem';
import { PurchaseOrder, PurchaseOrderStatus } from './src/entities/PurchaseOrder';
import { PurchaseOrderItem } from './src/entities/PurchaseOrderItem';
import { hashPassword } from './src/services/auth';

async function seed() {
  await AppDataSource.initialize();
  const db = AppDataSource;

  // Ensure admin exists with known password
  const userRepo = db.getRepository(User);
  const existing = await userRepo.findOne({ where: { email: 'admin@nicheinventory.local' } });
  if (existing) {
    existing.passwordHash = await hashPassword('admin_password_2026');
    await userRepo.save(existing);
  } else {
    await userRepo.save(userRepo.create({
      email: 'admin@nicheinventory.local',
      passwordHash: await hashPassword('admin_password_2026'),
      name: 'Admin',
      role: UserRole.ADMIN,
    }));
  }

  // Manager and warehouse
  const [mgr, wh] = await userRepo.save([
    userRepo.create({ email: 'manager@nicheinventory.local', passwordHash: await hashPassword('admin_password_2026'), name: 'Sarah Manager', role: UserRole.MANAGER }),
    userRepo.create({ email: 'warehouse@nicheinventory.local', passwordHash: await hashPassword('admin_password_2026'), name: 'Tom Warehouse', role: UserRole.WAREHOUSE }),
  ]);

  const locRepo = db.getRepository(Location);
  const locs = await locRepo.save([
    locRepo.create({ name: 'Main Warehouse', type: 'warehouse', address: '100 Industrial Blvd, Suite A, Springfield, IL 62701' }),
    locRepo.create({ name: 'East Wing', type: 'warehouse', address: '200 Commerce Dr, East Wing Bldg, Springfield, IL 62702' }),
    locRepo.create({ name: 'Cold Storage', type: 'cold_storage', address: '300 Polar Ln, Springfield, IL 62703' }),
  ]);
  console.log('Created', locs.length, 'locations');

  const supRepo = db.getRepository(Supplier);
  const sups = await supRepo.save([
    supRepo.create({ name: 'Global Textiles Co.', contactName: 'Linda Chen', email: 'linda@globaltextiles.com', phone: '+1-555-0101', address: '888 Fabric Ave, Textile City, CA 90210', notes: 'Primary clothing supplier' }),
    supRepo.create({ name: 'TechParts Direct', contactName: 'Marcus Rivera', email: 'marcus@techparts.io', phone: '+1-555-0202', address: '42 Circuit Rd, San Jose, CA 95112', notes: 'Electronics components' }),
    supRepo.create({ name: 'EcoHome Goods', contactName: 'Priya Patel', email: 'priya@ecohome.co', phone: '+1-555-0303', address: '15 Green Way, Portland, OR 97201', notes: 'Sustainable home goods' }),
    supRepo.create({ name: 'FreshNature Organics', contactName: "James O'Brien", email: 'james@freshnature.org', phone: '+1-555-0404', address: '77 Orchard Ln, Sacramento, CA 95814', notes: 'Organic food supplier' }),
  ]);
  console.log('Created', sups.length, 'suppliers');

  const prodRepo = db.getRepository(Product);
  const prods = await prodRepo.save([
    prodRepo.create({ name: 'Organic Cotton T-Shirt', sku: 'OCT-001', description: 'Premium organic cotton crew-neck t-shirt', category: 'Apparel', price: 29.99, lowStockThreshold: 50, supplierId: sups[0].id }),
    prodRepo.create({ name: 'Wireless Bluetooth Speaker', sku: 'WBS-002', description: 'Portable waterproof bluetooth speaker with 12h battery', category: 'Electronics', price: 79.99, lowStockThreshold: 30, supplierId: sups[1].id }),
    prodRepo.create({ name: 'Bamboo Cutting Board Set', sku: 'BCB-003', description: 'Set of 3 eco-friendly bamboo cutting boards', category: 'Home & Kitchen', price: 34.99, lowStockThreshold: 25, supplierId: sups[2].id }),
    prodRepo.create({ name: 'Cold Brew Coffee Concentrate', sku: 'CBC-004', description: 'Organic cold brew coffee concentrate 32oz', category: 'Food & Beverage', price: 14.99, lowStockThreshold: 100, supplierId: sups[3].id }),
    prodRepo.create({ name: 'LED Desk Lamp', sku: 'LDL-005', description: 'Adjustable LED desk lamp with USB charging port', category: 'Electronics', price: 49.99, lowStockThreshold: 20, supplierId: sups[1].id }),
  ]);
  console.log('Created', prods.length, 'products');

  const varRepo = db.getRepository(ProductVariant);
  const vars = await varRepo.save([
    varRepo.create({ name: 'Organic Cotton T-Shirt - S / Black', sku: 'OCT-001-S-BLK', barcode: '1000001', productId: prods[0].id }),
    varRepo.create({ name: 'Organic Cotton T-Shirt - M / Black', sku: 'OCT-001-M-BLK', barcode: '1000002', productId: prods[0].id }),
    varRepo.create({ name: 'Organic Cotton T-Shirt - L / White', sku: 'OCT-001-L-WHT', barcode: '1000003', productId: prods[0].id }),
    varRepo.create({ name: 'Bluetooth Speaker - Midnight Black', sku: 'WBS-002-BLK', barcode: '2000001', productId: prods[1].id }),
    varRepo.create({ name: 'Bluetooth Speaker - Ocean Blue', sku: 'WBS-002-BLU', barcode: '2000002', productId: prods[1].id }),
    varRepo.create({ name: 'Bamboo Board Set - Standard', sku: 'BCB-003-STD', barcode: '3000001', productId: prods[2].id }),
    varRepo.create({ name: 'Cold Brew Concentrate - Original', sku: 'CBC-004-ORG', barcode: '4000001', productId: prods[3].id }),
    varRepo.create({ name: 'Cold Brew Concentrate - Vanilla', sku: 'CBC-004-VAN', barcode: '4000002', productId: prods[3].id }),
    varRepo.create({ name: 'LED Desk Lamp - Matte White', sku: 'LDL-005-WHT', barcode: '5000001', productId: prods[4].id }),
  ]);
  console.log('Created', vars.length, 'variants');

  const invRepo = db.getRepository(InventoryLevel);
  const invs = await invRepo.save([
    invRepo.create({ variantId: vars[0].id, locationId: locs[0].id, quantity: 120, reservedQuantity: 10 }),
    invRepo.create({ variantId: vars[0].id, locationId: locs[1].id, quantity: 45, reservedQuantity: 5 }),
    invRepo.create({ variantId: vars[1].id, locationId: locs[0].id, quantity: 200, reservedQuantity: 20 }),
    invRepo.create({ variantId: vars[2].id, locationId: locs[0].id, quantity: 80, reservedQuantity: 0 }),
    invRepo.create({ variantId: vars[2].id, locationId: locs[1].id, quantity: 30, reservedQuantity: 0 }),
    invRepo.create({ variantId: vars[3].id, locationId: locs[0].id, quantity: 60, reservedQuantity: 8 }),
    invRepo.create({ variantId: vars[3].id, locationId: locs[1].id, quantity: 25, reservedQuantity: 0 }),
    invRepo.create({ variantId: vars[4].id, locationId: locs[0].id, quantity: 35, reservedQuantity: 3 }),
    invRepo.create({ variantId: vars[5].id, locationId: locs[0].id, quantity: 90, reservedQuantity: 12 }),
    invRepo.create({ variantId: vars[5].id, locationId: locs[2].id, quantity: 15, reservedQuantity: 0 }),
    invRepo.create({ variantId: vars[6].id, locationId: locs[2].id, quantity: 300, reservedQuantity: 50 }),
    invRepo.create({ variantId: vars[6].id, locationId: locs[0].id, quantity: 150, reservedQuantity: 20 }),
    invRepo.create({ variantId: vars[7].id, locationId: locs[2].id, quantity: 200, reservedQuantity: 30 }),
    invRepo.create({ variantId: vars[7].id, locationId: locs[0].id, quantity: 75, reservedQuantity: 5 }),
    invRepo.create({ variantId: vars[8].id, locationId: locs[0].id, quantity: 40, reservedQuantity: 2 }),
    invRepo.create({ variantId: vars[8].id, locationId: locs[1].id, quantity: 18, reservedQuantity: 0 }),
  ]);
  console.log('Created', invs.length, 'inventory levels');

  const ordRepo = db.getRepository(Order);
  const orderData = [
    { externalOrderId: 'ORD-2024-001', status: OrderStatus.PENDING, customerName: 'Alice Johnson', customerEmail: 'alice@example.com', shippingAddress: '123 Maple St, Chicago, IL', totalAmount: 59.98, source: 'web' },
    { externalOrderId: 'ORD-2024-002', status: OrderStatus.CONFIRMED, customerName: 'Bob Smith', customerEmail: 'bob@example.com', shippingAddress: '456 Oak Ave, Detroit, MI', totalAmount: 79.99, source: 'web' },
    { externalOrderId: 'ORD-2024-003', status: OrderStatus.PACKED, customerName: 'Carol Davis', customerEmail: 'carol@example.com', shippingAddress: '789 Pine Rd, Milwaukee, WI', totalAmount: 114.97, source: 'amazon' },
    { externalOrderId: 'ORD-2024-004', status: OrderStatus.SHIPPED, customerName: 'Dan Wilson', customerEmail: 'dan@example.com', shippingAddress: '321 Elm St, Indianapolis, IN', totalAmount: 44.98, source: 'web', trackingNumber: '1Z999AA10123456784', shippingCarrier: 'UPS' },
    { externalOrderId: 'ORD-2024-005', status: OrderStatus.SHIPPED, customerName: 'Eva Martinez', customerEmail: 'eva@example.com', shippingAddress: '654 Birch Ln, Columbus, OH', totalAmount: 149.97, source: 'shopify', trackingNumber: '9400111899223100001234', shippingCarrier: 'USPS' },
    { externalOrderId: 'ORD-2024-006', status: OrderStatus.CANCELLED, customerName: 'Frank Lee', customerEmail: 'frank@example.com', shippingAddress: '987 Cedar Ct, Minneapolis, MN', totalAmount: 29.99, source: 'web' },
    { externalOrderId: 'ORD-2024-007', status: OrderStatus.PENDING, customerName: 'Grace Kim', customerEmail: 'grace@example.com', shippingAddress: '147 Walnut Dr, St. Louis, MO', totalAmount: 94.97, source: 'web' },
  ];
  const orders = await ordRepo.save(orderData.map(o => ordRepo.create(o)));

  const oiRepo = db.getRepository(OrderItem);
  await oiRepo.save([
    oiRepo.create({ orderId: orders[0].id, variantId: vars[0].id, quantity: 2, unitPrice: 29.99 }),
    oiRepo.create({ orderId: orders[1].id, variantId: vars[3].id, quantity: 1, unitPrice: 79.99 }),
    oiRepo.create({ orderId: orders[2].id, variantId: vars[1].id, quantity: 1, unitPrice: 29.99 }),
    oiRepo.create({ orderId: orders[2].id, variantId: vars[5].id, quantity: 1, unitPrice: 34.99 }),
    oiRepo.create({ orderId: orders[2].id, variantId: vars[8].id, quantity: 1, unitPrice: 49.99 }),
    oiRepo.create({ orderId: orders[3].id, variantId: vars[6].id, quantity: 2, unitPrice: 14.99 }),
    oiRepo.create({ orderId: orders[3].id, variantId: vars[0].id, quantity: 1, unitPrice: 29.99 }),
    oiRepo.create({ orderId: orders[4].id, variantId: vars[3].id, quantity: 1, unitPrice: 79.99 }),
    oiRepo.create({ orderId: orders[4].id, variantId: vars[2].id, quantity: 1, unitPrice: 29.99 }),
    oiRepo.create({ orderId: orders[4].id, variantId: vars[5].id, quantity: 1, unitPrice: 34.99 }),
    oiRepo.create({ orderId: orders[5].id, variantId: vars[0].id, quantity: 1, unitPrice: 29.99 }),
    oiRepo.create({ orderId: orders[6].id, variantId: vars[4].id, quantity: 1, unitPrice: 79.99 }),
    oiRepo.create({ orderId: orders[6].id, variantId: vars[1].id, quantity: 1, unitPrice: 29.99 }),
  ]);
  console.log('Created', orders.length, 'orders with items');

  // Purchase orders
  const poRepo = db.getRepository(PurchaseOrder);
  const pos = await poRepo.save([
    poRepo.create({ supplierId: sups[0].id, status: PurchaseOrderStatus.SENT, notes: 'Q2 restock for cotton t-shirts' }),
    poRepo.create({ supplierId: sups[1].id, status: PurchaseOrderStatus.PARTIALLY_RECEIVED, notes: 'Speaker reorder' }),
    poRepo.create({ supplierId: sups[3].id, status: PurchaseOrderStatus.DRAFT, notes: 'Cold brew seasonal order' }),
  ]);
  const poiRepo = db.getRepository(PurchaseOrderItem);
  await poiRepo.save([
    poiRepo.create({ purchaseOrderId: pos[0].id, variantId: vars[0].id, quantity: 500, receivedQuantity: 0, unitCost: 12.00 }),
    poiRepo.create({ purchaseOrderId: pos[0].id, variantId: vars[1].id, quantity: 500, receivedQuantity: 0, unitCost: 12.00 }),
    poiRepo.create({ purchaseOrderId: pos[1].id, variantId: vars[3].id, quantity: 200, receivedQuantity: 120, unitCost: 35.00 }),
    poiRepo.create({ purchaseOrderId: pos[1].id, variantId: vars[4].id, quantity: 150, receivedQuantity: 0, unitCost: 35.00 }),
    poiRepo.create({ purchaseOrderId: pos[2].id, variantId: vars[6].id, quantity: 1000, receivedQuantity: 0, unitCost: 5.50 }),
  ]);
  console.log('Created', pos.length, 'purchase orders');

  console.log('Seed complete!');
  await db.destroy();
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });
