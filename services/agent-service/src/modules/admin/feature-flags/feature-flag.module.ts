import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagEntity } from '@exprealty/database';
import { FeatureFlagService } from './feature-flag.service.js';
import { FeatureFlagController } from './feature-flag.controller.js';
import { FeatureFlagRepository } from './feature-flag.repository.js';

@Module({
	imports: [TypeOrmModule.forFeature([FeatureFlagEntity])],
	providers: [
		{
			provide: 'IFeatureFlagRepository',
			useClass: FeatureFlagRepository,
		},
		FeatureFlagService,
	],
	controllers: [FeatureFlagController],
	exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
