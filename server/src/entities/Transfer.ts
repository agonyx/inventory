import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TransferStatus {
  DRAFT = 'draft',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('transfers')
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Location', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fromLocationId' })
  fromLocation: import('./Location').Location;

  @Column({ type: 'uuid' })
  fromLocationId: string;

  @ManyToOne('Location', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'toLocationId' })
  toLocation: import('./Location').Location;

  @Column({ type: 'uuid' })
  toLocationId: string;

  @Column({ type: 'varchar', length: 50, default: TransferStatus.DRAFT })
  status: TransferStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @OneToMany('TransferItem', 'transfer', { cascade: true })
  items: import('./TransferItem').TransferItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
