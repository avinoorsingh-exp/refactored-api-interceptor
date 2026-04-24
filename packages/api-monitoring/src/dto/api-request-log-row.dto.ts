import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpMethod, ApiActorType, ApiErrorClassification } from '../domain/api-monitoring.types.js';

/**
 * OpenAPI shape for a request log row (replaces coupling to TypeORM entity class in DTOs).
 * @public
 */
export class ApiRequestLogRowDto {
	@ApiProperty({ format: 'uuid' })
	id!: string;

	@ApiProperty()
	route!: string;

	@ApiProperty({ enum: HttpMethod })
	method!: HttpMethod;

	@ApiProperty()
	statusCode!: number;

	@ApiProperty()
	latencyMs!: number;

	@ApiPropertyOptional()
	requestSizeBytes?: number;

	@ApiPropertyOptional()
	responseSizeBytes?: number;

	@ApiPropertyOptional()
	ipAddress?: string;

	@ApiPropertyOptional()
	userAgent?: string;

	@ApiProperty({ format: 'uuid' })
	correlationId!: string;

	@ApiProperty()
	timestamp!: Date;

	@ApiPropertyOptional({ format: 'uuid' })
	actorId?: string;

	@ApiPropertyOptional({ enum: ApiActorType })
	actorType?: ApiActorType;

	@ApiProperty()
	hasError!: boolean;

	@ApiPropertyOptional({ enum: ApiErrorClassification })
	errorClassification?: ApiErrorClassification;

	@ApiPropertyOptional()
	errorMessage?: string;

	@ApiPropertyOptional()
	stackTrace?: string;

	@ApiProperty()
	createdAt!: Date;
}
