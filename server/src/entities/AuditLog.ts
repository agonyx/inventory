import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ADJUST_STOCK = 'adjust_stock',
  CREATE_ORDER = 'create_order',
  UPDATE_ORDER_STATUS = 'update_order_status',
  TRANSFER_COMPLETED = 'transfer_completed',
  TRANSFER_CANCELLED = 'transfer_cancelled',
  STOCKTAKE_COMPLETED = 'stocktake_completed',
  CREATE_RETURN = 'create_return',
  APPROVE_RETURN = 'approve_return',
  REJECT_RETURN = 'reject_return',
  RECEIVE_RETURN = 'receive_return',
  REFUND_RETURN = 'refund_return',
  CREATE_PURCHASE_ORDER = 'create_purchase_order',
  UPDATE_PURCHASE_ORDER = 'update_purchase_order',
  RECEIVE_PURCHASE_ORDER = 'receive_purchase_order',
  CANCEL_PURCHASE_ORDER = 'cancel_purchase_order',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 50 })
  entityType: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  performedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
