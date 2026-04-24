import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('transfer_items')
export class TransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Transfer', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transferId' })
  transfer: import('./Transfer').Transfer;

  @Column({ type: 'uuid' })
  transferId: string;

  @ManyToOne('ProductVariant', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variantId' })
  variant: import('./ProductVariant').ProductVariant;

  @Column({ type: 'uuid' })
  variantId: string;

  @Column({ type: 'int' })
  quantity: number;
}
