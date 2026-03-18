import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for job name path parameter.
 */
export class AdminJobNameParamDto {
	@ApiProperty({
		description: 'Job name',
		example: 'kafka-message-cleanup',
	})
	name!: string;
}

