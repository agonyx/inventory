import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('stocktake_items')
export class StocktakeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Stocktake', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stocktakeId' })
  stocktake: import('./Stocktake').Stocktake;

  @Column({ type: 'uuid' })
  stocktakeId: string;

  @ManyToOne('ProductVariant', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variantId' })
  variant: import('./ProductVariant').ProductVariant;

  @Column({ type: 'uuid' })
  variantId: string;

  @Column({ type: 'int' })
  systemQuantity: number;

  @Column({ type: 'int', nullable: true })
  countedQuantity: number | null;

  @Column({ type: 'int', nullable: true })
  discrepancy: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
