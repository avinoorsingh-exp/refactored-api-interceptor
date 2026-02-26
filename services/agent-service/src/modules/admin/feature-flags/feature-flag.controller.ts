import {
	Controller,
	Get,
	Patch,
	Param,
	Body,
	HttpCode,
	HttpStatus,
	Req,
	BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { FeatureFlagService } from './feature-flag.service.js';
import { FeatureFlagResponseDto } from './dto/feature-flag-response.dto.js';
import { isAllowedFeatureFlagKey } from './feature-flag.constants.js';
import type { FeatureFlagKey } from './feature-flag.constants.js';

/** Body for PATCH /admin/feature-flags/:key */
export class UpdateFeatureFlagDto {
	enabled!: boolean;
}

@ApiTags('admin-feature-flags')
@Controller('v1/admin/feature-flags')
export class FeatureFlagController {
	constructor(private readonly featureFlagService: FeatureFlagService) {}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'List all feature flags', description: 'Returns all feature flags (key + enabled).' })
	@ApiResponse({ status: 200, description: 'List of feature flags', type: [FeatureFlagResponseDto] })
	async getFlags(@Req() req: Request): Promise<FeatureFlagResponseDto[]> {
		return this.featureFlagService.getAllFlags();
	}

	@Get(':key')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Get feature flag by key', description: 'Returns whether the flag is enabled (for frontend checks).' })
	@ApiParam({ name: 'key', enum: ['PHASE_2', 'PHASE_3'] })
	@ApiResponse({ status: 200, description: 'Flag state', type: FeatureFlagResponseDto })
	@ApiResponse({ status: 400, description: 'Invalid key' })
	@ApiResponse({ status: 404, description: 'Flag not found' })
	async getFlagByKey(
		@Param('key') key: string,
		@Req() req: Request,
	): Promise<FeatureFlagResponseDto> {
		if (!isAllowedFeatureFlagKey(key)) {
			throw new BadRequestException({
				message: `Invalid feature flag key: ${key}`,
				i18nType: 'admin.feature_flag.invalid_key',
			});
		}
		const enabled = await this.featureFlagService.isEnabled(key as FeatureFlagKey);
		return { key: key as FeatureFlagKey, enabled };
	}

	@Patch(':key')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Update a feature flag', description: 'Set enabled for the given flag key.' })
	@ApiParam({ name: 'key', enum: ['PHASE_2', 'PHASE_3'] })
	@ApiBody({ type: UpdateFeatureFlagDto })
	@ApiResponse({ status: 200, description: 'Updated flag', type: FeatureFlagResponseDto })
	@ApiResponse({ status: 400, description: 'Invalid key' })
	@ApiResponse({ status: 404, description: 'Flag not found' })
	async patchFlag(
		@Param('key') key: string,
		@Body() body: UpdateFeatureFlagDto,
		@Req() req: Request,
	): Promise<FeatureFlagResponseDto> {
		return this.featureFlagService.updateFlag(key, body.enabled);
	}
}
