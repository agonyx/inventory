import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  LOW_STOCK = 'low_stock',
  ORDER_STATUS = 'order_status',
  STOCK_ADJUSTED = 'stock_adjusted',
  TRANSFER_COMPLETED = 'transfer_completed',
  SYSTEM = 'system',
}

@Entity('notifications')
@Index(['read', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType: string | null;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
