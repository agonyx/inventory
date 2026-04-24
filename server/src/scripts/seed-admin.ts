import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entities/User';
import { hashPassword } from '../services/auth';

async function seedAdmin() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  const count = await userRepo.count();
  if (count > 0) {
    console.log('Users already exist, skipping admin seed');
    await AppDataSource.destroy();
    return;
  }

  const admin = userRepo.create({
    email: process.env.ADMIN_EMAIL || 'admin@nicheinventory.local',
    passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
    name: 'Admin',
    role: UserRole.ADMIN,
  });

  await userRepo.save(admin);
  console.log(`Admin user created: ${admin.email}`);
  await AppDataSource.destroy();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
