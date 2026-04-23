import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Order', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: import('./Order').Order;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne('ProductVariant', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant: import('./ProductVariant').ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalSku: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @CreateDateColumn()
  createdAt: Date;
}
