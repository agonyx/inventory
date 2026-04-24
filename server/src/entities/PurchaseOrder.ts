import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Supplier')
  @JoinColumn({ name: 'supplierId' })
  supplier: import('./Supplier').Supplier;

  @Column({ type: 'uuid' })
  supplierId: string;

  @Column({ type: 'varchar', length: 50, default: PurchaseOrderStatus.DRAFT })
  status: PurchaseOrderStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany('PurchaseOrderItem', 'purchaseOrder', { cascade: true })
  items: import('./PurchaseOrderItem').PurchaseOrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
