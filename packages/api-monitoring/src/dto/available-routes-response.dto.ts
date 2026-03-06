import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for available routes and error codes.
 * 
 * Contains arrays of distinct routes and status codes available
 * in the api_route_stats table for the specified time window.
 * 
 * @public
 */
export class AvailableRoutesResponseDto {
	@ApiProperty({
		description: 'Array of distinct route paths available in the time window',
		example: ['/v1/agents', '/v1/companies', '/v1/users'],
		type: [String],
	})
	routes!: string[];

	@ApiProperty({
		description: 'Array of distinct status codes (as strings) available in the time window',
		example: ['200', '400', '401', '404', '500'],
		type: [String],
	})
	errorCodes!: string[];
}

