import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne('Product', 'variants', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: import('./Product').Product;

  @OneToMany('InventoryLevel', 'variant')
  inventoryLevels: import('./InventoryLevel').InventoryLevel[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
