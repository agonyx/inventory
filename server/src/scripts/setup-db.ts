import { AppDataSource } from '../data-source';

async function setup() {
  await AppDataSource.initialize();
  // In production, synchronize is disabled on the DataSource.
  // We need to explicitly sync since there are no migration files yet.
  await AppDataSource.synchronize();
  console.log('Database synchronized');
  await AppDataSource.destroy();
  console.log('Database setup complete');
}

setup().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
