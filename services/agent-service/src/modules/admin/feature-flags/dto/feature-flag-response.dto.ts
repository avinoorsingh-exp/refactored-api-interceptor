import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for a single feature flag. Exposes only key and enabled.
 */
export class FeatureFlagResponseDto {
	@ApiProperty({ enum: ['PHASE_2', 'PHASE_3'], description: 'Feature flag key' })
	key!: 'PHASE_2' | 'PHASE_3';

	@ApiProperty({ description: 'Whether the flag is enabled' })
	enabled!: boolean;
}
