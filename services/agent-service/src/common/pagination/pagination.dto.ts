import type { PaginationQuery } from "@exprealty/shared-domain";
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Number of items to skip', example: 0, minimum: 0, type: 'integer' })
    offset?: number;

    @ApiPropertyOptional({ description: 'Maximum number of items to return', example: 25, minimum: 1, maximum: 100, type: 'integer' })
    limit?: number;
}