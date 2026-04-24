import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';

export enum ReturnItemCondition {
  NEW = 'new',
  DAMAGED = 'damaged',
  USED = 'used',
}

@Entity('return_items')
export class ReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Return', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'returnId' })
  return: import('./Return').Return;

  @Column({ type: 'uuid' })
  returnId: string;

  @ManyToOne('ProductVariant', { onDelete: 'SET NULL' })
  @JoinColumn()
  variant: import('./ProductVariant').ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 50, default: ReturnItemCondition.NEW })
  condition: ReturnItemCondition;

  @CreateDateColumn()
  createdAt: Date;
}
