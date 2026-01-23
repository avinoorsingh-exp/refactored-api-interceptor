import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';

/**
 * Kafka service type enum values.
 * @public
 */
export enum KafkaServiceType {
	CONSUMER = 'consumer',
	PRODUCER = 'producer',
}

/**
 * TypeORM entity for kafka_service table.
 * Stores Kafka service definitions (consumers and producers).
 * Runtime state is NOT stored here - only service configuration.
 * 
 * @public
 */
@Entity({ name: 'kafka_service', schema: 'core' })
@Index('idx_kafka_service_topic_group', ['topic', 'groupId'], { unique: true })
export class KafkaServiceEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/**
	 * Service type (consumer or producer).
	 * @public
	 */
	@Column({ type: 'text' })
	type!: KafkaServiceType;

	/**
	 * Kafka topic name.
	 * @public
	 */
	@Column({ type: 'text' })
	topic!: string;

	/**
	 * Consumer group ID (nullable for producers).
	 * @public
	 */
	@Column({ name: 'group_id', type: 'text', nullable: true })
	groupId?: string;

	/**
	 * Whether the service is enabled.
	 * Only enabled services are started on application bootstrap.
	 * @public
	 */
	@Column({ type: 'boolean', default: true })
	enabled!: boolean;

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	/**
	 * Last update timestamp.
	 * Automatically updated by TypeORM on save.
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;
}


