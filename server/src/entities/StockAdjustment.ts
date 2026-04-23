import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';

export enum AdjustmentReason {
  MANUAL = 'manual',
  RECEIVED = 'received',
  DAMAGED = 'damaged',
  SHRINKAGE = 'shrinkage',
  RETURN = 'return',
  CORRECTION = 'correction',
}

@Entity('stock_adjustments')
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('InventoryLevel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_level_id' })
  inventoryLevel: import('./InventoryLevel').InventoryLevel;

  @Column({ type: 'uuid' })
  inventoryLevelId: string;

  @Column({ type: 'int' })
  quantityChange: number;

  @Column({ type: 'int' })
  previousQuantity: number;

  @Column({ type: 'int' })
  newQuantity: number;

  @Column({ type: 'enum', enum: AdjustmentReason, default: AdjustmentReason.MANUAL })
  reason: AdjustmentReason;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  adjustedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
