import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ReturnStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  RECEIVED = 'received',
  REFUNDED = 'refunded',
  REJECTED = 'rejected',
}

@Entity('returns')
export class Return {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Order', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: import('./Order').Order;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 50, default: ReturnStatus.REQUESTED })
  status: ReturnStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany('ReturnItem', 'return', { cascade: true })
  items: import('./ReturnItem').ReturnItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
