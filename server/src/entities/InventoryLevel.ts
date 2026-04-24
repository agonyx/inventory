import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index, VersionColumn } from 'typeorm';
import { ProductVariant } from './ProductVariant';

@Entity('inventory_levels')
@Index(['variantId', 'locationId'], { unique: true })
export class InventoryLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductVariant, (variant) => variant.inventoryLevels, { onDelete: 'CASCADE' })
  @JoinColumn()
  variant: ProductVariant;

  @Column({ type: 'uuid' })
  variantId: string;

  @ManyToOne('Location', 'inventoryLevels', { onDelete: 'CASCADE' })
  @JoinColumn()
  location: import('./Location').Location;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  reservedQuantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @VersionColumn({ default: 1 })
  version: number;

  get availableQuantity(): number {
    return this.quantity - this.reservedQuantity;
  }
}
