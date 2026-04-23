import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
dotenv.config();
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: ['src/entities/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
});
if (import.meta.main) {
  const cmd = process.argv[2];
  AppDataSource.initialize().then(async (ds) => {
    if (cmd === 'sync') { await ds.synchronize(); console.log('Database synchronized'); }
    else if (cmd === 'drop') { await ds.dropDatabase(); console.log('Database dropped'); }
    else { console.log('Connected to database'); }
    await ds.destroy();
  }).catch((err) => { console.error('Database connection failed:', err); process.exit(1); });
}
