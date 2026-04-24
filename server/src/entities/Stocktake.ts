import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum StocktakeStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

@Entity('stocktakes')
export class Stocktake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Location', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'locationId' })
  location: import('./Location').Location;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'varchar', length: 50, default: StocktakeStatus.DRAFT })
  status: StocktakeStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @OneToMany('StocktakeItem', 'stocktake', { cascade: true })
  items: import('./StocktakeItem').StocktakeItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
